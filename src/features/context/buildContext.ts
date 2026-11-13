import { Note } from '../../types';
import { ContextItem, ContextState, DEFAULT_CONTEXT_BUDGET } from './contextStore';

export interface ContextPart {
  id: string;
  title: string;
  chars: number;
  /** Cuántos caracteres entraron al final (si es menor que `chars`, se recortó) */
  usedChars: number;
  truncated: boolean;
  /** La nota ya no existe */
  missing?: boolean;
}

export interface ContextBlock {
  /** Texto listo para enviar a la IA (vacío si no hay contexto seleccionado) */
  text: string;
  usedChars: number;
  totalChars: number;
  truncated: boolean;
  parts: ContextPart[];
}

const TRUNCATION_MARK = '\n[… recortado por espacio]';
/** Ningún elemento se reduce por debajo de esto (si no, no aporta nada). */
const MIN_SHARE = 800;

/**
 * Reparte el presupuesto de forma justa («llenado de agua»): los elementos pequeños entran completos y lo que
 * sobra se reparte entre los grandes. Así un CV corto no se recorta porque haya un documento enorme.
 */
export function allocateBudget(sizes: number[], budget: number): number[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total <= budget) return [...sizes];

  const alloc = new Array(sizes.length).fill(0);
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[a] - sizes[b]);
  let remaining = budget;
  let left = sizes.length;
  for (const i of order) {
    const fair = Math.max(MIN_SHARE, Math.floor(remaining / left));
    alloc[i] = Math.min(sizes[i], fair);
    remaining = Math.max(0, remaining - alloc[i]);
    left--;
  }
  return alloc;
}

/** Contenido real de un elemento: las notas se leen de la nota actual. */
function resolve(item: ContextItem, notes: Note[]): { text: string; missing: boolean } {
  if (item.kind !== 'note') return { text: item.content, missing: false };
  const note = notes.find((n) => n.id === item.noteId);
  if (!note) return { text: '', missing: true };
  return { text: (note.markdownContent || '').trim(), missing: false };
}

export function buildContextBlock(
  state: ContextState,
  notes: Note[],
  budget: number = DEFAULT_CONTEXT_BUDGET
): ContextBlock {
  const selected = state.items.filter((i) => state.selected.includes(i.id));
  const resolved = selected.map((item) => ({ item, ...resolve(item, notes) }));
  const usable = resolved.filter((r) => !r.missing && r.text.length > 0);

  const sizes = usable.map((r) => r.text.length);
  const alloc = allocateBudget(sizes, budget);

  const parts: ContextPart[] = resolved.map((r) => {
    const idx = usable.indexOf(r);
    const used = idx === -1 ? 0 : alloc[idx];
    return {
      id: r.item.id,
      title: r.item.title,
      chars: r.text.length,
      usedChars: used,
      truncated: used < r.text.length,
      ...(r.missing ? { missing: true } : {})
    };
  });

  const blocks = usable.map((r, i) => {
    const cut = alloc[i] < r.text.length;
    const body = cut ? r.text.slice(0, alloc[i]).trimEnd() + TRUNCATION_MARK : r.text;
    return `### ${r.item.title}\n${body}`;
  });

  return {
    text: blocks.join('\n\n'),
    usedChars: alloc.reduce((a, b) => a + b, 0),
    totalChars: sizes.reduce((a, b) => a + b, 0),
    truncated: parts.some((p) => p.truncated),
    parts
  };
}
