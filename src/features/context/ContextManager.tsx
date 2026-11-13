import React, { useMemo, useRef, useState } from 'react';
import { FileText, FileUp, Plus, StickyNote, Trash2, ShieldCheck, AlertTriangle, Type } from 'lucide-react';
import { Note } from '../../types';
import { useContextStore } from './useContextStore';
import { readContextFile } from './fileText';
import { buildContextBlock } from './buildContext';
import { DEFAULT_CONTEXT_BUDGET, ContextKind } from './contextStore';

interface ContextManagerProps {
  notes: Note[];
}

const KIND_LABEL: Record<ContextKind, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; cls: string }> = {
  text: { label: 'Texto', Icon: Type, cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  file: { label: 'Archivo', Icon: FileText, cls: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
  note: { label: 'Nota', Icon: StickyNote, cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
};

const fmt = (n: number) => n.toLocaleString('es');

/**
 * Biblioteca de CONTEXTO: lo que la IA debe saber de ti y del tema (tu CV, proyectos que hiciste, el brief del
 * cliente, tus notas de StickyFlow). Se usa para responder con base en lo que realmente has hecho.
 */
export const ContextManager: React.FC<ContextManagerProps> = ({ notes }) => {
  const { state, store } = useContextStore();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const block = useMemo(() => buildContextBlock(state, notes, DEFAULT_CONTEXT_BUDGET), [state, notes]);
  const usedPct = Math.min(100, Math.round((block.usedChars / DEFAULT_CONTEXT_BUDGET) * 100));
  const notesAvailable = notes.filter((n) => !state.items.some((i) => i.kind === 'note' && i.noteId === n.id));

  const flash = (ok: boolean, msg: string) => {
    setMessage({ ok, text: msg });
    setTimeout(() => setMessage(null), 6000);
  };

  const handleAddText = () => {
    const res = store.add('text', title || 'Texto pegado', text);
    if (res.ok === false) {
      flash(false, res.error);
      return;
    }
    setTitle('');
    setText('');
    setShowPaste(false);
    flash(true, 'Contexto añadido.');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    const errors: string[] = [];
    let added = 0;
    for (const file of Array.from(files)) {
      const r = await readContextFile(file);
      if ('error' in r) {
        errors.push(r.error);
        continue;
      }
      const res = store.add('file', r.title, r.text);
      if (res.ok === false) errors.push(`«${file.name}»: ${res.error}`);
      else added++;
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (errors.length) flash(false, errors.join(' '));
    else flash(true, `${added} archivo${added === 1 ? '' : 's'} añadido${added === 1 ? '' : 's'}.`);
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-slate-400 leading-snug">
        Carga lo que quieres que la IA tenga en cuenta: tu <b className="text-slate-200">CV</b>, <b className="text-slate-200">proyectos que has hecho</b>, el
        brief del cliente o tus propias notas. Así las respuestas sugeridas se basan en <b className="text-slate-200">lo que realmente has hecho</b>.
      </p>

      {/* Añadir */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          title="Archivos .txt, .md, .docx (Word), .html, .csv, .json"
        >
          <FileUp size={13} /> Cargar archivo
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.docx,.html,.htm,.csv,.tsv,.json,.log,.yml,.yaml,.xml,.pdf"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setShowPaste(!showPaste)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={13} /> Pegar texto
        </button>
        {notesAvailable.length > 0 && (
          <label className="relative">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer pointer-events-none">
              <StickyNote size={13} /> Usar una nota mía
            </span>
            <select
              aria-label="Usar una nota de StickyFlow como contexto"
              value=""
              onChange={(e) => {
                const n = notes.find((x) => x.id === e.target.value);
                if (n) store.addNote(n);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            >
              <option value="">Elige una nota…</option>
              {notesAvailable.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || 'Sin título'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {showPaste && (
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (p. ej. Mi CV, Proyecto de pagos)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 select-text"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Pega aquí el texto…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 resize-none select-text leading-snug"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowPaste(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddText}
              disabled={!text.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40 cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`px-2.5 py-2 rounded-lg border leading-snug ${message.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Lista */}
      {state.items.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-slate-700 text-center text-slate-500 leading-snug">
          Aún no hay contexto. Empieza por cargar tu <b>CV</b> o pegar un resumen de tus <b>proyectos</b>.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {state.items.map((item) => {
            const checked = state.selected.includes(item.id);
            const part = block.parts.find((p) => p.id === item.id);
            const { label, Icon, cls } = KIND_LABEL[item.kind];
            const chars = item.kind === 'note' ? part?.chars ?? 0 : item.content.length;
            return (
              <li key={item.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${checked ? 'bg-slate-800/70 border-slate-600' : 'bg-slate-900/40 border-slate-800 opacity-70'}`}>
                <input type="checkbox" checked={checked} onChange={() => store.toggle(item.id)} className="accent-sky-500 cursor-pointer" title="Usar en los análisis" />
                <span className={`px-1.5 py-0.5 rounded border text-[10px] flex items-center gap-1 shrink-0 ${cls}`}>
                  <Icon size={10} /> {label}
                </span>
                <span className="flex-1 min-w-0 truncate" title={item.title}>
                  {item.title}
                </span>
                {part?.missing ? (
                  <span className="text-red-400 text-[10px]" title="La nota ya no existe">
                    nota eliminada
                  </span>
                ) : (
                  <span className="text-slate-500 text-[10px] shrink-0">{fmt(chars)} car.</span>
                )}
                {checked && part?.truncated && (
                  <span className="text-amber-400 text-[10px] shrink-0" title="No cabe todo: se envía una parte">
                    recortado
                  </span>
                )}
                <button type="button" onClick={() => store.remove(item.id)} title="Quitar" className="text-slate-500 hover:text-red-400 cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Presupuesto */}
      {state.selected.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Se enviará a la IA: {fmt(block.usedChars)} / {fmt(DEFAULT_CONTEXT_BUDGET)} caracteres
            </span>
            <span>{usedPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className={`h-full ${block.truncated ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${usedPct}%` }} />
          </div>
          {block.truncated && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300 leading-snug">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              Hay más contexto del que cabe: de cada documento se envía una parte. Desmarca lo que no sea necesario para esta reunión.
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
        <ShieldCheck size={12} className="shrink-0 mt-0.5 text-emerald-500" />
        <span>
          El contexto se guarda solo en este equipo. Se envía a tu proveedor de IA <b>únicamente cuando pides un análisis</b>, y las claves y
          contraseñas se enmascaran antes de salir.
        </span>
      </div>
    </div>
  );
};
