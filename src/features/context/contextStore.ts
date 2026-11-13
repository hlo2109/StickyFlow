import { Note } from '../../types';

/**
 * Biblioteca de CONTEXTO: lo que quieres que la IA sepa al analizar una reunión o preparar respuestas
 * (tu CV, proyectos que hiciste, el brief del cliente, tus propias notas…).
 *
 * Se guarda en este equipo (localStorage). Nada sale de aquí hasta que pides un análisis; entonces se envía
 * solo lo SELECCIONADO, recortado a un presupuesto, y con los datos sensibles enmascarados.
 */

export type ContextKind = 'text' | 'file' | 'note';

export interface ContextItem {
  id: string;
  title: string;
  kind: ContextKind;
  /** Texto (text/file). Para notas se lee de la nota en el momento de usarla, así siempre está al día. */
  content: string;
  noteId?: string;
  addedAt: string;
}

export interface ContextState {
  items: ContextItem[];
  /** Ids de los elementos que se usan en los análisis */
  selected: string[];
}

export const MAX_ITEM_CHARS = 80_000;
export const MAX_TOTAL_CHARS = 400_000;
/** Lo máximo que se envía a la IA como contexto (≈ 3.500 tokens): suficiente para un CV y un par de proyectos. */
export const DEFAULT_CONTEXT_BUDGET = 14_000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'stickyflow.context.v1';
const EMPTY: ContextState = { items: [], selected: [] };

export class ContextStore {
  private state: ContextState;
  private listeners = new Set<(s: ContextState) => void>();

  constructor(private storage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.state = this.read();
  }

  private read(): ContextState {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return { ...EMPTY, items: [], selected: [] };
      const parsed = JSON.parse(raw);
      const items: ContextItem[] = Array.isArray(parsed.items) ? parsed.items.filter((i: any) => i && typeof i.id === 'string') : [];
      const ids = new Set(items.map((i) => i.id));
      const selected: string[] = Array.isArray(parsed.selected) ? parsed.selected.filter((id: string) => ids.has(id)) : [];
      return { items, selected };
    } catch {
      return { items: [], selected: [] };
    }
  }

  private commit(next: ContextState): void {
    this.state = next;
    try {
      this.storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Almacenamiento lleno: el estado en memoria sigue siendo válido durante esta sesión.
    }
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): ContextState {
    return this.state;
  }

  public subscribe(listener: (s: ContextState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private totalChars(): number {
    return this.state.items.reduce((sum, i) => sum + i.content.length, 0);
  }

  private newId(): string {
    return `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  /** Añade texto pegado o el contenido de un archivo. Queda seleccionado. */
  public add(kind: 'text' | 'file', title: string, content: string): { ok: true; id: string } | { ok: false; error: string } {
    const text = content.trim();
    if (!text) return { ok: false, error: 'No hay texto que guardar.' };
    if (text.length > MAX_ITEM_CHARS) {
      return { ok: false, error: `El texto es demasiado largo (${text.length.toLocaleString()} caracteres; máximo ${MAX_ITEM_CHARS.toLocaleString()}). Divídelo o deja solo lo importante.` };
    }
    if (this.totalChars() + text.length > MAX_TOTAL_CHARS) {
      return { ok: false, error: 'La biblioteca de contexto está llena. Elimina algún elemento antes de añadir otro.' };
    }
    const id = this.newId();
    const item: ContextItem = { id, title: title.trim() || 'Sin título', kind, content: text, addedAt: new Date().toISOString() };
    this.commit({ items: [...this.state.items, item], selected: [...this.state.selected, id] });
    return { ok: true, id };
  }

  /** Usa una nota de StickyFlow como contexto (se lee de la nota al usarla; si ya estaba, no se duplica). */
  public addNote(note: Pick<Note, 'id' | 'title'>): void {
    const existing = this.state.items.find((i) => i.kind === 'note' && i.noteId === note.id);
    if (existing) {
      if (!this.state.selected.includes(existing.id)) this.commit({ ...this.state, selected: [...this.state.selected, existing.id] });
      return;
    }
    const id = this.newId();
    const item: ContextItem = { id, title: note.title || 'Nota sin título', kind: 'note', content: '', noteId: note.id, addedAt: new Date().toISOString() };
    this.commit({ items: [...this.state.items, item], selected: [...this.state.selected, id] });
  }

  public remove(id: string): void {
    this.commit({ items: this.state.items.filter((i) => i.id !== id), selected: this.state.selected.filter((s) => s !== id) });
  }

  public toggle(id: string, on?: boolean): void {
    const has = this.state.selected.includes(id);
    const want = on ?? !has;
    if (want === has) return;
    this.commit({ ...this.state, selected: want ? [...this.state.selected, id] : this.state.selected.filter((s) => s !== id) });
  }

  public rename(id: string, title: string): void {
    this.commit({ ...this.state, items: this.state.items.map((i) => (i.id === id ? { ...i, title: title.trim() || i.title } : i)) });
  }

  public clear(): void {
    this.commit({ items: [], selected: [] });
  }
}

export const contextStore = new ContextStore();
