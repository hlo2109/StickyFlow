import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { buildApp } from '../src/app.js';

const sent = [];

// Con TEST_DATABASE_URL las mismas pruebas corren contra PostgreSQL (cada prueba parte de una base limpia)
const PG = process.env.TEST_DATABASE_URL;
const opened = [];
async function testDb() {
  let db;
  if (!PG) db = await openDb(':memory:');
  else {
    const { default: pg } = await import('pg');
    const c = new pg.Client({ connectionString: PG });
    await c.connect();
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await c.end();
    db = await openDb({ postgres: { connectionString: PG } });
  }
  opened.push(db);
  return db;
}
after(async () => { for (const d of opened) await d.close().catch(() => {}); });
const fakeMailer = (enabled = true) => ({
  enabled,
  async send(m) { sent.push(m); return { ok: enabled }; },
});

async function make(env = {}, mailer = fakeMailer()) {
  const config = loadConfig({ SIGNUP_MODE: 'invite', PUBLIC_URL: 'https://notas.test', ...env });
  const app = await buildApp({ config, db: await testDb(), mailer });
  const call = async (method, url, { body, token } = {}) => {
    const res = await app.inject({ method, url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  };
  return { app, call };
}
const reg = (call, email, extra = {}) => call('POST', '/api/auth/register', { body: { email, password: 'clave-larga-1', ...extra } });
const tokenFromLink = (url) => url.split('/').pop();

test('configuración: valida SIGNUP_MODE y valores por defecto', () => {
  assert.equal(loadConfig({}).signupMode, 'invite');
  assert.equal(loadConfig({}).inviteTtlDays, 7);
  assert.throws(() => loadConfig({ SIGNUP_MODE: 'cualquiera' }));
  assert.equal(loadConfig({ PUBLIC_URL: 'https://x.com///' }).publicUrl, 'https://x.com');
  assert.equal(loadConfig({}).smtp, null);
  assert.equal(loadConfig({ SMTP_HOST: 'smtp.x.com', SMTP_PORT: '465' }).smtp.secure, true);
});

test('el primer usuario se registra y es administrador; luego el registro libre se bloquea', async () => {
  const { call } = await make();
  assert.equal((await call('GET', '/api/info')).body.hasUsers, false);
  const a = await reg(call, 'Admin@Test.com');
  assert.equal(a.status, 201);
  assert.equal(a.body.user.isAdmin, true);
  assert.equal(a.body.user.email, 'admin@test.com');
  const b = await reg(call, 'otro@test.com');
  assert.equal(b.status, 403);
});

test('modo closed bloquea; modo open permite (y verifica por correo si hay SMTP)', async () => {
  const closed = await make({ SIGNUP_MODE: 'closed' });
  await reg(closed.call, 'admin@test.com');
  assert.equal((await reg(closed.call, 'x@test.com')).status, 403);

  sent.length = 0;
  const open = await make({ SIGNUP_MODE: 'open' });
  await reg(open.call, 'admin@test.com');
  const r = await reg(open.call, 'nuevo@test.com');
  assert.equal(r.status, 201);
  assert.equal(r.body.needsVerification, true);
  assert.equal((await open.call('POST', '/api/auth/login', { body: { email: 'nuevo@test.com', password: 'clave-larga-1' } })).status, 403);
  const link = sent.at(-1).text.match(/https:\/\/notas\.test\/verify\/(\S+)/)[1];
  assert.equal((await open.call('POST', '/api/auth/verify', { body: { token: link } })).status, 200);
  assert.equal((await open.call('POST', '/api/auth/verify', { body: { token: link } })).status, 400, 'el enlace es de un solo uso');
  assert.equal((await open.call('POST', '/api/auth/login', { body: { email: 'nuevo@test.com', password: 'clave-larga-1' } })).status, 200);
});

test('validaciones de registro y login', async () => {
  const { call } = await make();
  assert.equal((await reg(call, 'no-es-correo')).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'a@b.co', password: 'corta' } })).status, 400);
  await reg(call, 'admin@test.com');
  assert.equal((await reg(call, 'admin@test.com')).status, 403, 'sin invitación no se revela si el correo existe');
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'mala-clave-1' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'nadie@test.com', password: 'clave-larga-1' } })).status, 401);
  const ok = await call('POST', '/api/auth/login', { body: { email: 'ADMIN@test.com', password: 'clave-larga-1' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: ok.body.token })).body.user.email, 'admin@test.com');
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', { token: 'falso' })).status, 401);
});

test('bloqueo tras demasiados intentos fallidos', async () => {
  const { call } = await make();
  await reg(call, 'admin@test.com');
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'mala-clave-1' } })).status);
  assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(codes[5], 429);
  // el bloqueo limita los intentos FALLIDOS (5 por 15 min); la clave correcta sigue entrando
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'clave-larga-1' } })).status, 200);
});

test('invitaciones: crear, usar una vez, correo fijo, caducidad y revocación', async () => {
  sent.length = 0;
  const { call } = await make();
  const admin = (await reg(call, 'admin@test.com')).body.token;

  assert.equal((await call('POST', '/api/invites', { body: {} })).status, 401);
  const inv = await call('POST', '/api/invites', { token: admin, body: {} });
  assert.equal(inv.status, 201);
  assert.match(inv.body.url, /^https:\/\/notas\.test\/invite\/.+/);
  const tok = tokenFromLink(inv.body.url);
  assert.deepEqual((await call('GET', `/api/invites/check/${tok}`)).body, { valid: true, email: null });
  assert.equal((await call('GET', '/api/invites/check/inventado')).body.valid, false);

  const u = await reg(call, 'amigo@test.com', { inviteToken: tok });
  assert.equal(u.status, 201);
  assert.equal(u.body.user.isAdmin, false);
  assert.equal((await reg(call, 'otro@test.com', { inviteToken: tok })).status, 403, 'un solo uso');
  // un usuario normal no puede invitar ni listar usuarios
  assert.equal((await call('POST', '/api/invites', { token: u.body.token, body: {} })).status, 403);
  assert.equal((await call('GET', '/api/users', { token: u.body.token })).status, 403);

  // invitación con correo: se envía y fija el correo
  const withMail = await call('POST', '/api/invites', { token: admin, body: { email: 'Ana@Test.com' } });
  assert.equal(withMail.body.emailSent, true);
  assert.equal(sent.at(-1).to, 'ana@test.com');
  assert.equal((await reg(call, 'otra@test.com', { inviteToken: tokenFromLink(withMail.body.url) })).status, 400);
  assert.equal((await reg(call, 'ana@test.com', { inviteToken: tokenFromLink(withMail.body.url) })).status, 201);
  assert.equal((await call('POST', '/api/invites', { token: admin, body: { email: 'ana@test.com' } })).status, 409, 'ya tiene cuenta');

  // revocar
  const rev = await call('POST', '/api/invites', { token: admin, body: {} });
  assert.equal((await call('DELETE', `/api/invites/${rev.body.id}`, { token: admin })).status, 200);
  assert.equal((await reg(call, 'z@test.com', { inviteToken: tokenFromLink(rev.body.url) })).status, 403);

  // caducada
  const old = await call('POST', '/api/invites', { token: admin, body: {} });
  const list = await call('GET', '/api/invites', { token: admin });
  assert.ok(list.body.invites.some((i) => i.status === 'usada'));
  assert.ok(list.body.invites.some((i) => i.status === 'revocada'));
  assert.ok(old.body.id);
});

test('invitación caducada no sirve', async () => {
  const config = loadConfig({ SIGNUP_MODE: 'invite' });
  const db = await testDb();
  const app = await buildApp({ config, db, mailer: fakeMailer() });
  const call = async (m, u, o = {}) => {
    const r = await app.inject({ method: m, url: u, payload: o.body, headers: o.token ? { authorization: `Bearer ${o.token}` } : {} });
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };
  const admin = (await reg(call, 'admin@test.com')).body.token;
  const inv = await call('POST', '/api/invites', { token: admin, body: {} });
  await db.prepare('UPDATE invites SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
  assert.equal((await call('GET', `/api/invites/check/${tokenFromLink(inv.body.url)}`)).body.valid, false);
  assert.equal((await reg(call, 'x@test.com', { inviteToken: tokenFromLink(inv.body.url) })).status, 403);
});

test('recuperar contraseña: no revela cuentas, enlace de un solo uso y cierra sesiones', async () => {
  sent.length = 0;
  const { call } = await make();
  const t = (await reg(call, 'admin@test.com')).body.token;
  assert.deepEqual((await call('POST', '/api/auth/forgot', { body: { email: 'nadie@test.com' } })).body, { ok: true });
  assert.equal(sent.length, 0);
  assert.deepEqual((await call('POST', '/api/auth/forgot', { body: { email: 'admin@test.com' } })).body, { ok: true });
  const rt = sent.at(-1).text.match(/\/reset\/(\S+)/)[1];
  assert.equal((await call('POST', '/api/auth/reset', { body: { token: rt, password: 'corta' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { body: { token: rt, password: 'otra-clave-nueva' } })).status, 200);
  assert.equal((await call('POST', '/api/auth/reset', { body: { token: rt, password: 'otra-clave-nueva' } })).status, 400);
  assert.equal((await call('GET', '/api/auth/me', { token: t })).status, 401, 'la sesión vieja se cerró');
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'otra-clave-nueva' } })).status, 200);
});

test('administrar usuarios: desactivar cierra sesiones y no deja entrar', async () => {
  const { call } = await make();
  const admin = await reg(call, 'admin@test.com');
  const inv = await call('POST', '/api/invites', { token: admin.body.token, body: {} });
  const u = await reg(call, 'amigo@test.com', { inviteToken: tokenFromLink(inv.body.url) });
  assert.equal((await call('PATCH', `/api/users/${admin.body.user.id}`, { token: admin.body.token, body: { active: false } })).status, 400);
  assert.equal((await call('PATCH', `/api/users/${u.body.user.id}`, { token: admin.body.token, body: { active: false } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: u.body.token })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'amigo@test.com', password: 'clave-larga-1' } })).status, 401);
  assert.equal((await call('GET', '/api/users', { token: admin.body.token })).body.users.length, 2);
});

test('notas: crear, listar por fecha, conflicto, borrado lógico y aislamiento entre usuarios', async () => {
  const { call } = await make();
  const admin = await reg(call, 'admin@test.com');
  const inv = await call('POST', '/api/invites', { token: admin.body.token, body: {} });
  const other = await reg(call, 'amigo@test.com', { inviteToken: tokenFromLink(inv.body.url) });
  const A = admin.body.token;
  const B = other.body.token;

  assert.equal((await call('GET', '/api/notes')).status, 401);
  const n1 = { title: 'Compras', content: '<p>leche</p>', markdownContent: 'leche', color: 'blue', isPinned: true, tags: ['a'], updatedAt: '2026-05-01T10:00:00.000Z', createdAt: '2026-05-01T09:00:00.000Z' };
  const put = await call('PUT', '/api/notes/n1', { token: A, body: n1 });
  assert.equal(put.status, 200);
  assert.equal(put.body.title, 'Compras');
  assert.equal(put.body.isPinned, true);
  assert.equal(put.body.color, 'blue');

  // más antigua que la del servidor → conflicto con la versión del servidor
  const stale = await call('PUT', '/api/notes/n1', { token: A, body: { ...n1, title: 'Vieja', updatedAt: '2026-04-01T00:00:00.000Z' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.note.title, 'Compras');
  // más nueva → se aplica
  assert.equal((await call('PUT', '/api/notes/n1', { token: A, body: { ...n1, title: 'Compras 2', updatedAt: '2026-06-01T00:00:00.000Z' } })).body.title, 'Compras 2');

  assert.equal((await call('GET', '/api/notes', { token: A })).body.notes.length, 1);
  const first = (await call('GET', '/api/notes', { token: A })).body;
  assert.ok(first.cursor > 0);
  assert.equal((await call('GET', `/api/notes?since=${first.cursor}`, { token: A })).body.notes.length, 0, 'sin cambios desde el cursor');
  // una nota con fecha MUY antigua (dispositivo con reloj atrasado / editada sin conexión) igual aparece tras el cursor
  await call('PUT', '/api/notes/old', { token: A, body: { title: 'vieja', content: '<p>x</p>', markdownContent: 'x', updatedAt: '2001-01-01T00:00:00.000Z' } });
  const later = (await call('GET', `/api/notes?since=${first.cursor}`, { token: A })).body.notes;
  assert.deepEqual(later.map((n) => n.id), ['old']);
  await call('DELETE', '/api/notes/old', { token: A });
  // el otro usuario no ve nada ni puede tocarla
  assert.equal((await call('GET', '/api/notes', { token: B })).body.notes.length, 0);
  assert.equal((await call('DELETE', '/api/notes/n1', { token: B })).status, 404);

  // borrar: queda como tombstone para que otros dispositivos lo sepan
  assert.equal((await call('DELETE', '/api/notes/n1', { token: A })).status, 200);
  const after = (await call('GET', '/api/notes', { token: A })).body.notes;
  const gone = after.filter((n) => n.id === 'n1');
  assert.equal(gone.length, 1);
  assert.ok(gone[0].deletedAt);
  assert.equal((await call('DELETE', '/api/notes/n1', { token: A })).status, 404);

  // validaciones
  assert.equal((await call('PUT', '/api/notes/../x', { token: A, body: {} })).status, 404);
  assert.equal((await call('PUT', '/api/notes/bad id', { token: A, body: {} })).status, 400);
  assert.equal((await call('PUT', '/api/notes/n2', { token: A, body: { title: 'x'.repeat(501) } })).status, 413);
  assert.equal((await call('PUT', '/api/notes/n3', { token: A, body: { title: 'ok', color: 'rojo-raro' } })).body.color, 'yellow');
});

test('tokens personales: crear, usar, listar, revocar y aislamiento entre usuarios', async () => {
  const { call } = await make();
  const admin = await reg(call, 'admin@test.com');
  const A = admin.body.token;
  const inv = await call('POST', '/api/invites', { token: A, body: {} });
  const other = await reg(call, 'amigo@test.com', { inviteToken: tokenFromLink(inv.body.url) });
  const B = other.body.token;

  assert.equal((await call('POST', '/api/sessions', { token: A, body: {} })).status, 400, 'pide nombre');
  const tk = await call('POST', '/api/sessions', { token: A, body: { name: 'Mi PC' } });
  assert.equal(tk.status, 201);
  assert.ok(tk.body.token.length > 30);
  // el token creado funciona y pertenece a su dueño
  assert.equal((await call('GET', '/api/auth/me', { token: tk.body.token })).body.user.email, 'admin@test.com');
  await call('PUT', '/api/notes/n1', { token: tk.body.token, body: { title: 'privada', content: '<p>x</p>', markdownContent: 'x' } });
  assert.equal((await call('GET', '/api/notes', { token: A })).body.notes.length, 1);

  // lista: sin valores de token, con el nombre
  const list = (await call('GET', '/api/sessions', { token: A })).body.sessions;
  assert.ok(list.some((s) => s.device === 'Mi PC'));
  assert.ok(list.every((s) => !('token' in s) && !('tokenHash' in s)));
  assert.ok(list.some((s) => s.current));

  // el otro usuario NO ve ni toca los tokens ni las notas de A, ni siquiera siendo A administrador
  assert.equal((await call('GET', '/api/sessions', { token: B })).body.sessions.every((s) => s.device !== 'Mi PC'), true);
  assert.equal((await call('DELETE', `/api/sessions/${tk.body.id}`, { token: B })).status, 404);
  assert.equal((await call('GET', '/api/notes', { token: B })).body.notes.length, 0);
  assert.equal((await call('GET', '/api/notes', { token: tk.body.token })).body.notes.length, 1);

  // revocar: el token deja de servir
  assert.equal((await call('DELETE', `/api/sessions/${tk.body.id}`, { token: A })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: tk.body.token })).status, 401);
});

test('migración: una base antigua (sin seq) conserva las notas y se pueden sincronizar', { skip: Boolean(PG) && 'solo SQLite' }, async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-mig-'));
  const old = new DatabaseSync(path.join(dir, 'stickyflow.db'));
  old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, verified_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE notes (user_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', markdown TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'yellow', pinned INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]', bitacora TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, PRIMARY KEY (user_id, id));
    INSERT INTO users VALUES ('u1','a@b.co','x',1,1,'2026-01-01','2026-01-01');
    INSERT INTO notes (user_id,id,title,created_at,updated_at) VALUES ('u1','a','Vieja A','2026-01-01','2026-01-01'),('u1','b','Vieja B','2026-01-02','2026-01-02');`);
  old.close();
  const db = await openDb(dir);
  const rows = await db.prepare('SELECT id, seq FROM notes ORDER BY seq').all();
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b']);
  assert.ok(rows.every((r) => r.seq > 0));
  await db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persistencia: detecta si /data es un volumen y lo expone en /api/info', async () => {
  const { isPersistent } = await import('../src/persistence.js');
  const fake = (docker, dataDev, rootDev) => ({ existsSync: () => docker, statSync: (p) => ({ dev: p === '/' ? rootDev : dataDev }) });
  assert.equal(isPersistent('/data', fake(false, 1, 1)), true, 'fuera de Docker siempre');
  assert.equal(isPersistent('/data', fake(true, 1, 1)), false, 'en Docker, mismo dispositivo que / = sin volumen');
  assert.equal(isPersistent('/data', fake(true, 2, 1)), true, 'en Docker, dispositivo distinto = volumen');
  const config = loadConfig({});
  const app = await buildApp({ config, db: await testDb(), mailer: fakeMailer(), persistent: false });
  const info = JSON.parse((await app.inject({ method: 'GET', url: '/api/info' })).body);
  assert.equal(info.persistent, false);
  assert.equal(info.database, PG ? 'postgres' : 'sqlite');
});

test('JSON: cuerpo vacío con Content-Type se acepta y el JSON roto da 400', async () => {
  const { app, call } = await make();
  const t = (await reg(call, 'admin@test.com')).body.token;
  await call('PUT', '/api/notes/n1', { token: t, body: { title: 'x', content: '<p>x</p>', markdownContent: 'x' } });
  const del = await app.inject({ method: 'DELETE', url: '/api/notes/n1', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' } });
  assert.equal(del.statusCode, 200);
  const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: '{roto', headers: { 'content-type': 'application/json' } });
  assert.equal(bad.statusCode, 400);
});

test('páginas: salud, cabeceras de seguridad y rutas de enlaces', async () => {
  const { app } = await make();
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.match(health.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(health.headers['x-frame-options'], 'DENY');
  for (const p of ['/', '/invite/abc', '/reset/abc', '/verify/abc']) {
    const r = await app.inject({ method: 'GET', url: p });
    assert.equal(r.statusCode, 200, p);
    assert.match(r.body, /StickyFlow/);
  }
  assert.equal((await app.inject({ method: 'GET', url: '/api/nada' })).statusCode, 404);
});
