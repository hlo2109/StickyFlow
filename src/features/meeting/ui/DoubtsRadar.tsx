import React from 'react';
import { Check, CheckSquare, Copy, Plus, Sparkles, X } from 'lucide-react';
import { MeetingDoubt } from '../../../types';

interface DoubtsRadarProps {
  doubts: MeetingDoubt[];
  isRecording: boolean;
  newDoubt: string;
  onNewDoubtChange: (value: string) => void;
  onAdd: (e?: React.FormEvent) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onCopy: (id: string, text: string, e: React.MouseEvent) => void;
  copiedId: string | null;
}

/** Radar de dudas: lo que quedó ambiguo en la conversación y lo que ya se aclaró (la IA lo mantiene al día). */
export const DoubtsRadar: React.FC<DoubtsRadarProps> = ({ doubts, isRecording, newDoubt, onNewDoubtChange, onAdd, onToggle, onDelete, onCopy, copiedId }) => {
  const open = doubts.filter((d) => d.status === 'open');
  const resolved = doubts.filter((d) => d.status === 'resolved');

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 leading-snug flex-1">
          {isRecording ? 'La IA detecta lo que queda sin aclarar y te sugiere qué preguntar.' : 'Se activa al grabar en vivo.'}
        </p>
      </div>

      <form onSubmit={onAdd} className="flex items-center gap-1.5">
        <input
          type="text"
          value={newDoubt}
          onChange={(e) => onNewDoubtChange(e.target.value)}
          placeholder="Añadir una pregunta para que la IA la rastree…"
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 select-text"
        />
        <button
          type="submit"
          disabled={!newDoubt.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-medium flex items-center gap-1 cursor-pointer"
        >
          <Plus size={13} /> Añadir
        </button>
      </form>

      {doubts.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-700">
          <Sparkles size={24} className="mx-auto mb-2 text-slate-600" />
          <p className="font-medium text-slate-400">Sin dudas por ahora</p>
          <p className="text-[11px] mt-1 leading-snug">Si alguien plantea algo ambiguo o queda una pregunta sin resolver, aparecerá aquí sola.</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Por resolver ({open.length}) — ¡pregúntalo en la reunión!
          </h4>
          {open.map((d) => (
            <div key={d.id} className="p-3 rounded-xl bg-slate-800/60 border border-amber-500/30 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium leading-snug flex-1 select-text">{d.question}</span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">{d.createdAt}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/70">
                <button
                  type="button"
                  onClick={(e) => onCopy(d.id, d.question, e)}
                  className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center gap-1 cursor-pointer"
                  title="Copiar para el chat de Teams/Meet/Zoom"
                >
                  {copiedId === d.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copiedId === d.id ? 'Copiada' : 'Copiar'}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onToggle(d.id)} className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 cursor-pointer">
                    <Check size={12} /> Resuelta
                  </button>
                  <button type="button" onClick={(e) => onDelete(d.id, e)} className="p-1 text-slate-500 hover:text-red-400 cursor-pointer" title="Descartar">
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <CheckSquare size={12} /> Aclaradas ({resolved.length})
          </h4>
          {resolved.map((d) => (
            <div key={d.id} className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="line-through text-slate-500 font-medium">{d.question}</span>
                <span className="text-[10px] text-emerald-400 shrink-0">✓ {d.resolvedAt || 'Aclarada'}</span>
              </div>
              {d.resolvedAnswer && <p className="text-[11px] text-emerald-200 bg-slate-900/60 p-1.5 rounded-lg leading-relaxed select-text">💡 <b>Aclarado:</b> {d.resolvedAnswer}</p>}
              <div className="flex justify-end">
                <button type="button" onClick={() => onToggle(d.id)} className="text-[10px] text-slate-500 hover:text-amber-400 underline cursor-pointer">
                  Reabrir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
