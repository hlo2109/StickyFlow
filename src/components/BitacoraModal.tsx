import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Copy,
  Check,
  Sparkles,
  Edit3,
  CheckCircle2,
  FilePlus2
} from 'lucide-react';
import { Note, BitacoraEntry } from '../types';

interface BitacoraModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onAddBitacoraEntry: (entry: string) => void;
}

export const BitacoraModal: React.FC<BitacoraModalProps> = ({
  isOpen,
  onClose,
  note,
  onAddBitacoraEntry
}) => {
  const [newLogText, setNewLogText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogText.trim()) return;
    onAddBitacoraEntry(newLogText.trim());
    setNewLogText('');
  };

  const handleCopyBitacora = () => {
    const text = [
      `# Bitácora de la Nota: ${note.title || 'Sin título'}`,
      `Creada: ${new Date(note.createdAt).toLocaleString('es-ES')}`,
      `Modificada: ${new Date(note.updatedAt).toLocaleString('es-ES')}`,
      `----------------------------------------`,
      ...(note.bitacora || []).map(b => `[${b.timestamp}] (${b.action}) ${b.summary}`)
    ].join('\n');

    if (window.electronAPI?.writeClipboard) {
      window.electronAPI.writeClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'creacion':
        return <FilePlus2 size={13} className="text-emerald-500" />;
      case 'edicion':
        return <Edit3 size={13} className="text-blue-500" />;
      case 'ia_resumen':
      case 'ia_redaccion':
      case 'ia_todo':
      case 'ia_custom':
        return <Sparkles size={13} className="text-purple-500" />;
      case 'marcador':
        return <Calendar size={13} className="text-amber-500" />;
      default:
        return <CheckCircle2 size={13} className="text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-emerald-200" />
            <h3 className="font-semibold text-sm">
              Bitácora & Registro Temporal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Metadata summary */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Calendar size={13} className="text-emerald-500" />
            <span>Creada: {new Date(note.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Clock size={13} className="text-blue-500" />
            <span>Actualizada: {new Date(note.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>

        {/* Quick Add Log Entry */}
        <form onSubmit={handleAddEntry} className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex gap-2">
          <input
            type="text"
            value={newLogText}
            onChange={(e) => setNewLogText(e.target.value)}
            placeholder="Registrar entrada de bitácora rápida..."
            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!newLogText.trim()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            <span>Añadir</span>
          </button>
        </form>

        {/* Timeline list */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 select-text">
          {(!note.bitacora || note.bitacora.length === 0) ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No hay entradas de bitácora aún. Escribe arriba para registrar un hito.
            </div>
          ) : (
            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-3">
              {[...note.bitacora].reverse().map((entry) => (
                <div key={entry.id} className="relative group">
                  <div className="absolute -left-[23px] top-0.5 p-1 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700">
                    {getActionIcon(entry.action)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>{entry.timestamp}</span>
                      <span className="uppercase font-semibold tracking-wider text-[9px] px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded">
                        {entry.action}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
                      {entry.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={handleCopyBitacora}
            className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            <span>{copied ? '¡Bitácora Copiada!' : 'Copiar Bitácora'}</span>
          </button>
          <span className="text-[11px] text-slate-400">
            {note.bitacora?.length || 0} registros
          </span>
        </div>
      </div>
    </div>
  );
};
