import { Note, NoteColor, AppSettings } from '../../types';

/**
 * Lógica pura de la lista de notas (búsqueda, orden, resumen, creación). Sin React ni Electron,
 * para poder probarla a fondo.
 */

/** Una nota sin título ni contenido. */
export function isBlankNote(n: Note): boolean {
  const html = (n.content || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, '').trim();
  return !(n.title && n.title.trim()) && !html && !(n.markdownContent && n.markdownContent.trim());
}

export type NoteFilter = 'all' | 'pinned';

/** Filtra por texto (título, contenido, etiquetas) y, si se pide, solo las fijadas. */
export function filterNotes(notes: Note[], query: string, filter: NoteFilter): Note[] {
  const q = query.trim().toLowerCase();
  return notes.filter((n) => {
    if (filter === 'pinned' && !n.isPinned) return false;
    if (!q) return true;
    return Boolean(
      (n.title && n.title.toLowerCase().includes(q)) ||
        (n.markdownContent && n.markdownContent.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });
}

/** Fijadas primero; dentro de cada grupo, la modificada más recientemente arriba. */
export function sortNotes(notes: Note[]): Note[] {
  const time = (n: Note) => new Date(n.updatedAt || n.createdAt || 0).getTime() || 0;
  return [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return time(b) - time(a);
  });
}

/** Resumen de una línea para la tarjeta de la lista. */
export function noteSnippet(note: Note): string {
  const raw = note.markdownContent || note.content || '';
  if (raw) {
    const clean = raw
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/#+\s+/g, '')
      .replace(/\[\s*\]/g, '☐ ')
      .replace(/\[x\]/g, '☑ ')
      .replace(/\*+/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/>\s*/g, '')
      .replace(/\n+/g, ' ')
      .replace(/ {2,}/g, ' ') // sin espacios dobles (p. ej. tras las casillas)
      .trim();
    if (clean) return clean;
  }
  return 'Nota vacía…';
}

/** «23 sep», «Reciente» si no hay fecha válida. */
export function formatNoteDate(dateStr?: string): string {
  if (!dateStr) return 'Reciente';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Reciente';
  return d.toLocaleDateString('es', { month: 'short', day: 'numeric' });
}

export const NOTE_COLOR_DOT: Record<NoteColor, string> = {
  yellow: 'bg-amber-400',
  orange: 'bg-orange-400',
  coral: 'bg-rose-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  indigo: 'bg-indigo-400',
  blue: 'bg-sky-400',
  teal: 'bg-teal-400',
  green: 'bg-emerald-400',
  dark: 'bg-slate-600'
};

/** Una nota nueva en blanco con el color por defecto de los ajustes. */
export function createBlankNote(settings: Pick<AppSettings, 'defaultColor'>, now: Date = new Date()): Note {
  const stamp = now.getTime();
  return {
    id: 'note-' + stamp,
    title: '',
    content: '',
    markdownContent: '',
    color: settings.defaultColor || 'yellow',
    isPinned: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    tags: [],
    bitacora: [
      {
        id: 'b-' + stamp,
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'creacion',
        summary: 'Nota creada'
      }
    ]
  };
}

/**
 * «Nueva nota»: si ya hay una en blanco se reutiliza (así no se acumulan notas vacías); si no, se crea una.
 * Devuelve la lista resultante, la nota a abrir y si hubo que crearla.
 */
export function planNewNote(
  notes: Note[],
  settings: Pick<AppSettings, 'defaultColor'>,
  now: Date = new Date()
): { notes: Note[]; note: Note; created: boolean } {
  const existing = notes.find(isBlankNote);
  if (existing) return { notes, note: existing, created: false };
  const note = createBlankNote(settings, now);
  return { notes: [note, ...notes], note, created: true };
}

/**
 * Borrar una nota. Si era la única, la lista no queda vacía: se deja una nota en blanco.
 * (`removedId` permite que la ventana de esa nota se cierre.)
 */
export function planDeleteNote(
  notes: Note[],
  id: string,
  settings: Pick<AppSettings, 'defaultColor'>,
  now: Date = new Date()
): { notes: Note[]; removedId: string } {
  const remaining = notes.filter((n) => n.id !== id);
  if (remaining.length === 0) return { notes: [createBlankNote(settings, now)], removedId: id };
  return { notes: remaining, removedId: id };
}

export function togglePinned(notes: Note[], id: string): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
}

/** Título para mostrar en la lista. */
export function noteTitle(note: Note): string {
  return note.title && note.title.trim() ? note.title : 'Nota sin título';
}
