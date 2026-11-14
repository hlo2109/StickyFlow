/**
 * Sincronización de notas con un StickyFlow Server propio.
 *
 * - Local primero: notes.json sigue siendo la fuente; el servidor es una copia compartida entre TUS dispositivos.
 * - Cada usuario solo ve sus notas (el servidor las filtra por cuenta); aquí nunca se pide nada de otros usuarios.
 * - El token vive solo en el proceso principal (cifrado en disco); la interfaz solo recibe el estado.
 * - Resolución de conflictos: gana la fecha de edición más reciente. El borrado se propaga.
 *
 * Sin dependencias de Electron: todo se inyecta (fetch, lectura/escritura de notas, almacén del estado) para poder
 * probarlo en Node contra el servidor real (docs/pruebas/sync-servidor.test.ts).
 */

const REQUEST_TIMEOUT_MS = 20000;
const DEVICE_NAME = 'StickyFlow Escritorio';

class SyncError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Solo https (o http en el propio equipo / red local, para pruebas). Devuelve el origen sin barra final. */
function normalizeServerUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new SyncError('Escribe la dirección de tu servidor');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new SyncError('La dirección del servidor no es válida');
  }
  const host = u.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^(10|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new SyncError('Usa una dirección https:// (http solo se admite en tu propio equipo o red local)');
  }
  return u.origin;
}

const isBlank = (n) =>
  !String(n.title || '').trim() &&
  !String(n.markdownContent || '').trim() &&
  !String(n.content || '').replace(/<[^>]*>/g, '').trim();

const toLocal = (r) => ({
  id: r.id,
  title: r.title || '',
  content: r.content || '',
  markdownContent: r.markdownContent || '',
  color: r.color || 'yellow',
  isPinned: Boolean(r.isPinned),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  tags: Array.isArray(r.tags) ? r.tags : [],
  bitacora: Array.isArray(r.bitacora) ? r.bitacora : [],
});

const toRemote = (n) => ({
  title: n.title || '',
  content: n.content || '',
  markdownContent: n.markdownContent || '',
  color: n.color,
  isPinned: Boolean(n.isPinned),
  tags: n.tags || [],
  bitacora: n.bitacora || [],
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

function createSyncEngine({ fetchImpl = fetch, readNotes, writeNotes, loadState, saveState, onStatus = () => {}, now = () => Date.now(), log = console }) {
  let state = loadState() || {};
  let running = false;
  let again = false;
  let timer = null;
  let interval = null;
  let runtime = { phase: 'idle', error: '' }; // idle | pending | syncing | error | offline | auth

  const configured = () => Boolean(state.serverUrl && state.token);
  const status = () => ({
    configured: configured(),
    serverUrl: state.serverUrl || '',
    email: state.email || '',
    deviceName: DEVICE_NAME,
    lastSyncAt: state.lastSyncAt || '',
    phase: configured() ? runtime.phase : 'idle',
    error: runtime.error,
  });
  const emit = () => onStatus(status());
  const persist = () => saveState(state);

  async function request(path, { method = 'GET', body, token = state.token, base = state.serverUrl } = {}) {
    let res;
    try {
      res = await fetchImpl(base + '/api' + path, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      throw new SyncError('No se pudo conectar con el servidor', 0, { network: true, cause: e?.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new SyncError(data.error || `Error ${res.status} del servidor`, res.status, data);
    return data;
  }

  // ---------- conexión ----------
  async function connectWithPassword({ serverUrl, email, password }) {
    const base = normalizeServerUrl(serverUrl);
    const r = await request('/auth/login', { method: 'POST', body: { email, password, device: DEVICE_NAME }, token: '', base });
    return adopt(base, r.token, r.user.email);
  }

  async function connectWithToken({ serverUrl, token }) {
    const base = normalizeServerUrl(serverUrl);
    const clean = String(token || '').trim();
    if (!clean) throw new SyncError('Pega tu token de acceso');
    const r = await request('/auth/me', { token: clean, base });
    return adopt(base, clean, r.user.email);
  }

  function adopt(base, token, email) {
    const sameAccount = state.serverUrl === base && state.email === email;
    // Otra cuenta u otro servidor: se empieza de cero (si no, se borrarían en el nuevo lo que no existe allí)
    state = { serverUrl: base, email, token, cursor: sameAccount ? Number(state.cursor) || 0 : 0, pushed: sameAccount ? state.pushed || {} : {}, lastSyncAt: '' };
    runtime = { phase: 'idle', error: '' };
    persist();
    emit();
    return status();
  }

  async function disconnect() {
    if (state.serverUrl && state.token) {
      // cierra la sesión de este dispositivo en el servidor (si hay red); no toca las notas locales
      await request('/auth/logout', { method: 'POST' }).catch(() => {});
    }
    state = {};
    runtime = { phase: 'idle', error: '' };
    persist();
    stop();
    emit();
    return status();
  }

  // ---------- sincronización ----------
  async function runOnce() {
    const pushed = (state.pushed = state.pushed || {});
    const ops = []; // cambios locales a aplicar al final sobre una lectura fresca: {type, note|id, base}
    const local = new Map(readNotes().map((n) => [n.id, n]));
    let cursor = Number(state.cursor) || 0; // contador del SERVIDOR (no depende de relojes de dispositivos)

    // 1) traer lo nuevo del servidor
    const { notes: remote, cursor: newCursor } = await request('/notes?since=' + cursor);
    if (Number.isFinite(newCursor)) cursor = newCursor;
    for (const r of remote) {
      const l = local.get(r.id);
      if (r.deletedAt) {
        if (l && l.updatedAt > r.updatedAt) continue; // se editó aquí después de borrarse allá: se conserva y se vuelve a subir
        if (l) { ops.push({ type: 'remove', id: r.id, base: l.updatedAt }); local.delete(r.id); }
        delete pushed[r.id];
        continue;
      }
      if (!l) {
        // Ya se sincronizó antes y aquí ya no está: se borró localmente y falta propagarlo (paso 3). No se vuelve a bajar.
        if (pushed[r.id] && r.updatedAt <= pushed[r.id]) continue;
        ops.push({ type: 'set', note: toLocal(r), base: null });
        local.set(r.id, toLocal(r));
        pushed[r.id] = r.updatedAt;
      } else if (r.updatedAt > l.updatedAt) {
        ops.push({ type: 'set', note: toLocal(r), base: l.updatedAt });
        local.set(r.id, toLocal(r));
        pushed[r.id] = r.updatedAt;
      } else if (r.updatedAt === l.updatedAt) {
        pushed[r.id] = r.updatedAt;
      }
    }

    // 2) subir lo que cambió aquí (las notas en blanco no se suben)
    for (const n of [...local.values()]) {
      if (isBlank(n) || pushed[n.id] === n.updatedAt) continue;
      try {
        await request('/notes/' + encodeURIComponent(n.id), { method: 'PUT', body: toRemote(n) });
        pushed[n.id] = n.updatedAt;
      } catch (e) {
        if (e.status === 409 && e.data?.note) {
          const s = toLocal(e.data.note);
          ops.push({ type: 'set', note: s, base: n.updatedAt });
          local.set(n.id, s);
          pushed[n.id] = s.updatedAt;
        } else if (e.status === 400 || e.status === 413) {
          log.warn?.('sync: el servidor rechazó una nota y se omite:', n.id, e.message);
          pushed[n.id] = n.updatedAt; // no reintentar eternamente una nota que el servidor no acepta
        } else {
          throw e;
        }
      }
    }

    // 3) propagar los borrados hechos aquí
    for (const id of Object.keys(pushed)) {
      if (local.has(id)) continue;
      try {
        await request('/notes/' + encodeURIComponent(id), { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      delete pushed[id];
    }

    // 4) aplicar cambios locales sobre una lectura fresca (por si se editó algo mientras sincronizaba)
    if (ops.length) {
      const fresh = new Map(readNotes().map((n) => [n.id, n]));
      let changed = false;
      for (const op of ops) {
        if (op.type === 'set') {
          const cur = fresh.get(op.note.id);
          if ((cur ? cur.updatedAt : null) !== op.base) continue; // se editó mientras tanto: gana lo local y se sube en la próxima
          fresh.set(op.note.id, op.note);
          changed = true;
        } else {
          const cur = fresh.get(op.id);
          if (cur && cur.updatedAt === op.base) { fresh.delete(op.id); changed = true; }
        }
      }
      if (changed) writeNotes([...fresh.values()]);
    }

    state.cursor = cursor;
    state.lastSyncAt = new Date(now()).toISOString();
    persist();
  }

  async function syncNow() {
    if (!configured()) return status();
    if (running) { again = true; return status(); }
    running = true;
    runtime = { phase: 'syncing', error: '' };
    emit();
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
      runtime = { phase: 'idle', error: '' };
    } catch (e) {
      if (e.status === 401) runtime = { phase: 'auth', error: 'Tu sesión con el servidor ya no es válida: vuelve a conectar' };
      else if (e.data?.network) runtime = { phase: 'offline', error: 'Sin conexión con el servidor; se reintentará' };
      else runtime = { phase: 'error', error: e.message };
      log.warn?.('sync:', e.message);
    } finally {
      running = false;
      emit();
    }
    return status();
  }

  /** Pide una sincronización pronto (agrupa varios guardados seguidos). */
  function schedule(ms = 2500) {
    if (!configured() || runtime.phase === 'auth') return;
    if (runtime.phase === 'idle' || runtime.phase === 'error') {
      runtime = { phase: 'pending', error: '' }; // «hay cambios por enviar» hasta que arranque la sincronización
      emit();
    }
    clearTimeout(timer);
    timer = setTimeout(() => { syncNow(); }, ms);
  }

  function start(everyMs = 30000) {
    stop();
    if (!configured()) return;
    interval = setInterval(() => { if (runtime.phase !== 'auth') syncNow(); }, everyMs);
    schedule(500);
  }
  function stop() {
    clearTimeout(timer);
    clearInterval(interval);
    timer = interval = null;
  }

  return { status, connectWithPassword, connectWithToken, disconnect, syncNow, schedule, start, stop };
}

module.exports = { createSyncEngine, normalizeServerUrl, SyncError, DEVICE_NAME };
