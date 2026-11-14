import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SyncBadge } from './SyncBadge';
import {
  Clock,
  ExternalLink,
  FolderOpen,
  Headphones,
  Languages,
  Mic,
  Minus,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings as SettingsIcon,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import { AppSettings, Note } from '../types';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import { INITIAL_WELCOME_NOTE } from '../features/notes/welcomeNote';
import {
  NOTE_COLOR_DOT,
  NoteFilter,
  filterNotes,
  formatNoteDate,
  noteSnippet,
  noteTitle,
  planDeleteNote,
  planNewNote,
  sortNotes,
  togglePinned
} from '../features/notes/notesLogic';

/**
 * Ventana principal de StickyFlow: LA LISTA DE NOTAS.
 * Un clic en una nota la abre en su propia ventana. Esta ventana no edita nada y solo guarda cuando haces una
 * acción (crear, borrar, fijar), así que nunca pisa lo que estés escribiendo en otra ventana.
 */
export const NotesListWindow: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [isPinned, setIsPinned] = useState(true);
  const [dockedIds, setDockedIds] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ---- Carga y sincronización con las otras ventanas
  useEffect(() => {
    const api = window.electronAPI;
    const init = async () => {
      let loadedNotes: Note[] = [];
      try {
        loadedNotes = (await api?.loadNotes()) || [];
        const s = await api?.loadSettings();
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
        setIsPinned(Boolean(await api?.getAlwaysOnTop()));
        const docked = await api?.getDockedNotes?.();
        if (Array.isArray(docked)) setDockedIds(docked);
      } catch (e) {
        console.error('Error cargando las notas:', e);
      }

      // Primera vez (o sin ninguna nota con contenido): se crea la nota de bienvenida
      const hasContent = loadedNotes.some((n) => n.title?.trim() || n.markdownContent?.trim() || n.content?.replace(/<[^>]*>?/gm, '').trim());
      if (loadedNotes.length === 0 || !hasContent) {
        loadedNotes = [INITIAL_WELCOME_NOTE, ...loadedNotes.filter((n) => n.id !== INITIAL_WELCOME_NOTE.id)];
        await api?.saveNotes(loadedNotes);
      }
      setNotes(loadedNotes);
      setLoaded(true);
    };
    void init();

    api?.onNotesUpdated?.((updated) => {
      if (Array.isArray(updated) && updated.length > 0) setNotes(updated);
    });
    api?.onDockedIdsChanged?.((ids) => setDockedIds(ids));
    api?.onAlwaysOnTopChanged?.((v) => setIsPinned(Boolean(v)));
  }, []);

  const persist = async (next: Note[]) => {
    setNotes(next);
    await window.electronAPI?.saveNotes(next);
  };

  // ---- Acciones
  const openNote = (id: string) => void window.electronAPI?.openNoteWindow?.(id);

  const handleNewNote = async () => {
    const plan = planNewNote(notes, settings);
    setFilter('all');
    setQuery('');
    // Una nota nueva está en blanco y StickyFlow no guarda notas en blanco: viaja a su ventana como borrador y se
    // guarda cuando escribas algo. Si ya hay una nueva sin escribir abierta, se reutiliza.
    if (plan.created) await window.electronAPI?.openNoteDraft?.(plan.note);
    else openNote(plan.note.id);
  };

  const handleDelete = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar «${noteTitle(note)}»? Esta acción no se puede deshacer.`)) return;
    await persist(planDeleteNote(notes, note.id, settings).notes);
  };

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await persist(togglePinned(notes, id));
  };

  const handleToggleDock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = await window.electronAPI?.toggleDockPin?.(id);
    if (Array.isArray(ids)) setDockedIds(ids);
  };

  const handleToggleWindowPin = async () => setIsPinned(Boolean(await window.electronAPI?.toggleAlwaysOnTop()));

  // ---- Atajos: Ctrl+N nueva nota, Ctrl+F buscar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        void handleNewNote();
      } else if (k === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visible = useMemo(() => sortNotes(filterNotes(notes, query, filter)), [notes, query, filter]);
  const pinnedCount = notes.filter((n) => n.isPinned).length;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl border border-black/15 dark:border-white/10 overflow-hidden font-sans select-none shadow-2xl">
      {/* Barra de título (arrastrable) */}
      <header className="px-3 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 window-drag-region cursor-move">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-400/90 text-amber-950 shrink-0">
            <StickyNote size={15} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight">Mis notas</div>
            <div className="text-[10px] text-slate-500 leading-tight">
              {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
              {pinnedCount > 0 ? ` · ${pinnedCount} fijada${pinnedCount === 1 ? '' : 's'}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 window-no-drag">
          <SyncBadge />
          <button
            type="button"
            onClick={handleToggleWindowPin}
            title={isPinned ? 'Dejar de mantener esta ventana por encima de las demás' : 'Mantener esta ventana siempre visible'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isPinned ? 'text-amber-600 bg-amber-500/15' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button type="button" onClick={() => window.electronAPI?.minimize()} title="Minimizar" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
            <Minus size={14} />
          </button>
          <button type="button" onClick={() => window.electronAPI?.close()} title="Cerrar" className="p-1.5 rounded-md text-slate-500 hover:bg-red-500 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Nueva nota + accesos rápidos */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void handleNewNote()}
          className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition cursor-pointer"
          title="Crear una nota nueva y abrirla (Ctrl + N)"
        >
          <Plus size={16} /> Nueva nota
        </button>
        {[
          { title: 'Reunión (Ctrl+Alt+R)', Icon: Headphones, view: 'meeting' as const, cls: 'text-indigo-500' },
          { title: 'Entrevista (Ctrl+Alt+E)', Icon: Languages, view: 'interview' as const, cls: 'text-sky-500' },
          { title: 'Nota de voz (Ctrl+Alt+V)', Icon: Mic, view: 'voicenote' as const, cls: 'text-rose-500' }
        ].map(({ title, Icon, view, cls }) => (
          <button
            key={view}
            type="button"
            onClick={() => void window.electronAPI?.openMeetingWindow?.(undefined, view)}
            title={title}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Icon size={16} className={cls} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => void window.electronAPI?.openSettingsWindow?.()}
          title="Ajustes"
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <SettingsIcon size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Buscar y filtrar */}
      <div className="px-3 pb-2 shrink-0 space-y-2">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en tus notas…  (Ctrl + F)"
            className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 select-text"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer" title="Limpiar búsqueda">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {(['all', 'pinned'] as NoteFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                filter === f ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f === 'pinned' && <Pin size={11} />}
              {f === 'all' ? 'Todas' : 'Fijadas'}
            </button>
          ))}
          {(query || filter === 'pinned') && (
            <span className="ml-auto text-slate-400">
              {visible.length} de {notes.length}
            </span>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-0">
        {!loaded ? (
          <div className="py-10 text-center text-xs text-slate-400">Cargando tus notas…</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 leading-relaxed">
            {query ? (
              <>No hay notas que coincidan con «{query}».</>
            ) : filter === 'pinned' ? (
              <>Aún no has fijado ninguna nota.</>
            ) : (
              <>
                Todavía no tienes notas.
                <br />
                Pulsa <b>Nueva nota</b> para empezar.
              </>
            )}
          </div>
        ) : (
          visible.map((note) => {
            const docked = dockedIds.includes(note.id);
            return (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={() => openNote(note.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openNote(note.id);
                }}
                title="Clic para abrir la nota en su propia ventana"
                className="group relative flex rounded-xl cursor-pointer bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all overflow-hidden"
              >
                <span className={`w-1.5 shrink-0 ${NOTE_COLOR_DOT[note.color] || 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-semibold truncate">{noteTitle(note)}</h4>
                    <div className="flex items-center gap-1 shrink-0">
                      {docked && (
                        <span title="Fijada en los separadores del borde de la pantalla" className="p-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          <StickyNote size={11} />
                        </span>
                      )}
                      {note.isPinned && <Pin size={12} className="text-amber-500" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mt-1">{noteSnippet(note)}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {formatNoteDate(note.updatedAt || note.createdAt)}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openNote(note.id); }} title="Abrir en su ventana" className="p-1 rounded hover:text-blue-500 cursor-pointer">
                        <ExternalLink size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleDock(note.id, e)}
                        title={docked ? 'Quitar de los separadores del borde' : 'Fijar como separador en el borde de la pantalla'}
                        className={`p-1 rounded cursor-pointer ${docked ? 'text-amber-600 bg-amber-500/20' : 'hover:text-amber-500'}`}
                      >
                        <StickyNote size={12} />
                      </button>
                      <button type="button" onClick={(e) => handleTogglePin(note.id, e)} title={note.isPinned ? 'Quitar de las fijadas' : 'Fijar arriba en la lista'} className="p-1 rounded hover:text-amber-500 cursor-pointer">
                        {note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                      </button>
                      <button type="button" onClick={(e) => handleDelete(note, e)} title="Eliminar nota" className="p-1 rounded hover:text-red-500 cursor-pointer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pie */}
      <footer className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <button type="button" onClick={() => window.electronAPI?.openNotesFolder?.()} className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer" title="Ver los archivos .md en el explorador">
          <FolderOpen size={13} /> Carpeta de notas (.md)
        </button>
        <span className="text-slate-400">Ctrl+N nueva · Ctrl+F buscar</span>
      </footer>
    </div>
  );
};
