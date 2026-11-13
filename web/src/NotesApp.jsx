import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Cloud, CloudOff, LogOut, Moon, Pin, PinOff, Plus, Search, Settings, StickyNote, Sun, Trash2 } from 'lucide-react';
import { api, ApiError } from './api.js';
import NoteEditor from './NoteEditor.jsx';
import Admin from './Admin.jsx';
import { COLORS, colorOf } from './colors.js';

const POLL_MS = 10000;
const SAVE_DELAY = 700;
const CLOCK_SKEW_MS = 10 * 60 * 1000; // el cursor de cambios retrocede 10 min: tolera relojes distintos entre dispositivos

const isBlank = (n) => !(n.title || '').trim() && !(n.markdownContent || '').trim() && !(n.content || '').replace(/<[^>]*>/g, '').trim();
const sortNotes = (list) => [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
const snippet = (n) => (n.markdownContent || '').replace(/[#*_`>\-\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110);
const newId = () => `web-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function NotesApp({ user, onLogout }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('notes'); // notes | admin
  const [status, setStatus] = useState('saved'); // saved | saving | offline
  const [dark, setDark] = useState(() => {
    const t = localStorage.getItem('sf_theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const notesRef = useRef([]);
  const timers = useRef({});
  const dirty = useRef(new Set());
  const synced = useRef(new Set()); // ids que ya existen en el servidor
  const cursor = useRef('');
  notesRef.current = notes;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sf_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const advanceCursor = (list) => {
    for (const n of list) if ((n.updatedAt || '') > cursor.current) cursor.current = n.updatedAt;
  };

  // Mezcla lo que llega del servidor con lo local (lo que se está editando no se pisa)
  const merge = useCallback((remote) => {
    advanceCursor(remote);
    setNotes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      for (const r of remote) {
        if (r.deletedAt) {
          if (!dirty.current.has(r.id)) { map.delete(r.id); synced.current.delete(r.id); }
          continue;
        }
        synced.current.add(r.id);
        const local = map.get(r.id);
        if (dirty.current.has(r.id) && local) continue;
        if (!local || (r.updatedAt || '') > (local.updatedAt || '')) map.set(r.id, r);
      }
      return [...map.values()];
    });
  }, []);

  const pull = useCallback(async (initial = false) => {
    try {
      const since = initial || !cursor.current ? '' : new Date(Date.parse(cursor.current) - CLOCK_SKEW_MS).toISOString();
      const { notes: remote } = await api('/notes' + (since ? '?since=' + encodeURIComponent(since) : ''));
      merge(remote);
      setStatus((s) => (s === 'offline' ? 'saved' : s));
    } catch (e) {
      if (!(e instanceof ApiError)) setStatus('offline');
    } finally {
      if (initial) setLoading(false);
    }
  }, [merge]);

  useEffect(() => {
    pull(true);
    const t = setInterval(() => document.visibilityState === 'visible' && pull(), POLL_MS);
    const onFocus = () => pull();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [pull]);

  const save = useCallback(async (id) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    if (isBlank(note) && !synced.current.has(id)) { dirty.current.delete(id); return; } // las notas en blanco no se guardan
    const sentAt = note.updatedAt;
    setStatus('saving');
    try {
      await api('/notes/' + encodeURIComponent(id), 'PUT', note);
      synced.current.add(id);
      const current = notesRef.current.find((n) => n.id === id);
      if (!current || current.updatedAt === sentAt) dirty.current.delete(id);
      setStatus(dirty.current.size ? 'saving' : 'saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.note) {
        dirty.current.delete(id);
        merge([e.data.note]);
        setNotes((p) => p.map((n) => (n.id === id ? e.data.note : n)));
        setStatus('saved');
      } else {
        setStatus('offline');
        timers.current[id] = setTimeout(() => save(id), 5000); // reintenta
      }
    }
  }, [merge]);

  const update = useCallback((id, patch) => {
    const updatedAt = new Date().toISOString();
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...patch, updatedAt } : n)));
    dirty.current.add(id);
    setStatus('saving');
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => save(id), SAVE_DELAY);
  }, [save]);

  // Al cerrar la pestaña con cambios sin enviar, avisar
  useEffect(() => {
    const h = (e) => { if (dirty.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const select = (id) => {
    // una nota nueva que se dejó en blanco no se guarda: se quita de la lista
    setNotes((p) => p.filter((n) => !(isBlank(n) && !synced.current.has(n.id) && n.id !== id)));
    setActiveId(id);
    setView('notes');
  };

  const create = () => {
    const blankOpen = notesRef.current.find((n) => isBlank(n) && !synced.current.has(n.id));
    if (blankOpen) return select(blankOpen.id);
    const now = new Date().toISOString();
    const note = { id: newId(), title: '', content: '', markdownContent: '', color: 'yellow', isPinned: false, tags: [], bitacora: [], createdAt: now, updatedAt: now };
    setNotes((p) => [note, ...p]);
    setActiveId(note.id);
    setView('notes');
  };

  const remove = async (id) => {
    const n = notesRef.current.find((x) => x.id === id);
    if (!n || !window.confirm(`¿Eliminar «${n.title || 'nota sin título'}»?`)) return;
    clearTimeout(timers.current[id]);
    dirty.current.delete(id);
    setNotes((p) => p.filter((x) => x.id !== id));
    setActiveId(null);
    if (synced.current.has(id)) {
      synced.current.delete(id);
      try { await api('/notes/' + encodeURIComponent(id), 'DELETE'); } catch { setStatus('offline'); }
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortNotes(notes).filter((n) => (filter === 'pinned' ? n.isPinned : true) && (!q || `${n.title} ${n.markdownContent}`.toLowerCase().includes(q)));
  }, [notes, query, filter]);

  const active = notes.find((n) => n.id === activeId) || null;
  const counts = { all: notes.filter((n) => !isBlank(n)).length, pinned: notes.filter((n) => n.isPinned).length };

  return (
    <div className={'shell' + (active || view === 'admin' ? ' has-detail' : '')}>
      <aside className="sidebar">
        <header className="side-head">
          <div className="brand"><span className="brand-mark"><StickyNote size={18} /></span> StickyFlow</div>
          <div className="side-actions">
            <span className={'sync ' + status} title={status === 'offline' ? 'Sin conexión: se reintentará' : status === 'saving' ? 'Guardando…' : 'Todo guardado'}>
              {status === 'offline' ? <CloudOff size={16} /> : <Cloud size={16} />}
            </span>
            <button className="icon-btn" onClick={() => setDark(!dark)} title="Cambiar tema">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            {user.isAdmin && <button className={'icon-btn' + (view === 'admin' ? ' on' : '')} onClick={() => setView(view === 'admin' ? 'notes' : 'admin')} title="Administrar"><Settings size={17} /></button>}
            <button className="icon-btn" onClick={onLogout} title={`Salir (${user.email})`}><LogOut size={17} /></button>
          </div>
        </header>

        <button className="btn primary new-btn" onClick={create}><Plus size={17} /> Nueva nota</button>

        <div className="search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en tus notas" />
        </div>
        <div className="tabs">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Todas <b>{counts.all}</b></button>
          <button className={filter === 'pinned' ? 'on' : ''} onClick={() => setFilter('pinned')}>Fijadas <b>{counts.pinned}</b></button>
        </div>

        <div className="list">
          {loading && <div className="empty"><div className="spinner" /></div>}
          {!loading && visible.length === 0 && (
            <div className="empty">
              <StickyNote size={28} />
              <p>{query ? 'Nada coincide con tu búsqueda.' : filter === 'pinned' ? 'No tienes notas fijadas.' : 'Aún no tienes notas.'}</p>
              {!query && filter === 'all' && <button className="btn" onClick={create}>Crear la primera</button>}
            </div>
          )}
          {visible.map((n) => (
            <button key={n.id} className={'card' + (n.id === activeId && view === 'notes' ? ' active' : '')} onClick={() => select(n.id)}>
              <span className="dot" style={{ background: colorOf(n.color).solid }} />
              <span className="card-body">
                <span className="card-title">{n.isPinned && <Pin size={12} />} {n.title || 'Nota sin título'}</span>
                <span className="card-snippet">{snippet(n) || 'Sin contenido'}</span>
              </span>
              <span className="card-date">{formatDate(n.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="detail">
        {view === 'admin' ? (
          <Admin me={user} onBack={() => setView('notes')} />
        ) : active ? (
          <>
            <div className="detail-bar">
              <button className="icon-btn back" onClick={() => select(null)} title="Volver a la lista"><ArrowLeft size={18} /></button>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button key={c.id} className={'swatch' + (active.color === c.id ? ' on' : '')} style={{ background: c.solid }} title={c.label} onClick={() => update(active.id, { color: c.id })} />
                ))}
              </div>
              <div className="grow" />
              <button className="icon-btn" onClick={() => update(active.id, { isPinned: !active.isPinned })} title={active.isPinned ? 'Quitar de fijadas' : 'Fijar arriba'}>
                {active.isPinned ? <PinOff size={17} /> : <Pin size={17} />}
              </button>
              <button className="icon-btn danger" onClick={() => remove(active.id)} title="Eliminar nota"><Trash2 size={17} /></button>
            </div>
            <NoteEditor key={active.id} note={active} onChange={(patch) => update(active.id, patch)} />
          </>
        ) : (
          <div className="placeholder">
            <StickyNote size={44} />
            <h2>Tus notas, en tu servidor</h2>
            <p>Elige una nota de la lista o crea una nueva. Lo que escribas aquí aparece también en la app de escritorio.</p>
            <button className="btn primary" onClick={create}><Plus size={17} /> Nueva nota</button>
          </div>
        )}
      </main>
    </div>
  );
}
