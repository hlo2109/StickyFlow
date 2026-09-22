import React, { useEffect, useState } from 'react';
import { Pin, Maximize2, X, Clock, ExternalLink } from 'lucide-react';
import { Note, NoteColor } from '../types';

interface MiniStickyViewProps {
  noteId: string;
}

const COLOR_CLASSES: Record<NoteColor, {
  container: string;
  header: string;
  title: string;
  text: string;
  border: string;
  pin: string;
  badge: string;
}> = {
  yellow: {
    container: 'bg-[#fef9c3] text-amber-950',
    header: 'bg-[#fef08a]/80 border-b border-amber-300/60',
    title: 'text-amber-950',
    text: 'text-amber-900/90',
    border: 'border-amber-300',
    pin: 'text-amber-600',
    badge: 'bg-amber-200/80 text-amber-800'
  },
  blue: {
    container: 'bg-[#e0f2fe] text-sky-950',
    header: 'bg-[#bae6fd]/80 border-b border-sky-300/60',
    title: 'text-sky-950',
    text: 'text-sky-900/90',
    border: 'border-sky-300',
    pin: 'text-sky-600',
    badge: 'bg-sky-200/80 text-sky-800'
  },
  green: {
    container: 'bg-[#dcfce7] text-emerald-950',
    header: 'bg-[#bbf7d0]/80 border-b border-emerald-300/60',
    title: 'text-emerald-950',
    text: 'text-emerald-900/90',
    border: 'border-emerald-300',
    pin: 'text-emerald-600',
    badge: 'bg-emerald-200/80 text-emerald-800'
  },
  purple: {
    container: 'bg-[#f3e8ff] text-purple-950',
    header: 'bg-[#e9d5ff]/80 border-b border-purple-300/60',
    title: 'text-purple-950',
    text: 'text-purple-900/90',
    border: 'border-purple-300',
    pin: 'text-purple-600',
    badge: 'bg-purple-200/80 text-purple-800'
  },
  pink: {
    container: 'bg-[#fce7f3] text-rose-950',
    header: 'bg-[#fbcfe8]/80 border-b border-rose-300/60',
    title: 'text-rose-950',
    text: 'text-rose-900/90',
    border: 'border-rose-300',
    pin: 'text-rose-600',
    badge: 'bg-rose-200/80 text-rose-800'
  },
  dark: {
    container: 'bg-[#0f172a] text-slate-100',
    header: 'bg-[#1e293b]/90 border-b border-slate-700',
    title: 'text-slate-100',
    text: 'text-slate-300',
    border: 'border-slate-700',
    pin: 'text-amber-400',
    badge: 'bg-slate-800 text-slate-300'
  }
};

export const MiniStickyView: React.FC<MiniStickyViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // Load note data on mount
  useEffect(() => {
    const fetchNote = async () => {
      try {
        if (window.electronAPI?.loadNotes) {
          const notes = await window.electronAPI.loadNotes();
          const target = notes.find((n) => n.id === noteId);
          if (target) {
            setNote(target);
          }
        }
      } catch (e) {
        console.error('Failed to load note in mini sticky:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();

    // Listen for real-time updates from main window
    if (window.electronAPI?.onNoteUpdated) {
      window.electronAPI.onNoteUpdated((updatedNote: Note) => {
        if (updatedNote.id === noteId) {
          setNote(updatedNote);
        }
      });
    }
  }, [noteId]);

  const handleExpand = () => {
    if (window.electronAPI?.expandMiniSticky) {
      window.electronAPI.expandMiniSticky(noteId);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI?.closeMiniSticky) {
      window.electronAPI.closeMiniSticky(noteId);
    } else {
      window.close();
    }
  };

  const cleanSnippet = (text: string) => {
    if (!text) return 'Sin contenido adicional...';
    return text
      .replace(/<[^>]*>?/gm, '')
      .replace(/#+\s/g, '')
      .replace(/\[\s*\]/g, '☐')
      .replace(/\[x\]/g, '☑')
      .replace(/\*+/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/>\s*/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  };

  const colorConfig = note ? COLOR_CLASSES[note.color || 'yellow'] : COLOR_CLASSES.yellow;

  if (loading) {
    return (
      <div className="h-screen w-screen bg-yellow-100 flex items-center justify-center p-3 text-xs text-amber-900 select-none">
        <div className="animate-pulse flex items-center gap-1.5 font-medium">
          <Pin size={14} className="animate-spin text-amber-600" />
          <span>Cargando recordatorio...</span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="h-screen w-screen bg-amber-50 flex flex-col items-center justify-center p-3 text-xs text-amber-900 select-none border border-amber-300 rounded-lg">
        <p className="font-semibold mb-2">Nota no encontrada</p>
        <button
          onClick={handleClose}
          className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 rounded text-[11px] font-medium"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col rounded-xl shadow-2xl border ${colorConfig.border} ${colorConfig.container} overflow-hidden font-sans select-none transition-colors duration-150 relative`}
      style={{ boxSizing: 'border-box' }}
      onDoubleClick={handleExpand}
    >
      {/* Draggable Top Bar with Tape / Pin styling */}
      <div
        className={`flex items-center justify-between px-2.5 py-1.5 ${colorConfig.header} window-drag-region cursor-move shrink-0`}
      >
        <div className="flex items-center gap-1.5">
          <Pin size={13} className={`${colorConfig.pin} fill-current shrink-0`} />
          <span className="text-[10px] font-bold tracking-wider uppercase opacity-75">
            Stick
          </span>
        </div>

        {/* Action buttons (Non-draggable) */}
        <div className="flex items-center gap-1 window-no-drag">
          <button
            onClick={handleExpand}
            title="Abrir en grande en StickyFlow"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current active:scale-95"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={handleClose}
            title="Desanclar / Cerrar"
            className="p-1 rounded hover:bg-red-500 hover:text-white transition-all text-current active:scale-95"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Note Body (Click to expand) */}
      <div
        onClick={handleExpand}
        className="flex-1 p-2.5 flex flex-col justify-between cursor-pointer hover:opacity-95 transition-opacity overflow-hidden"
        title="Clic para abrir en grande"
      >
        <div>
          {/* Title */}
          <h3 className={`text-xs font-bold leading-snug line-clamp-1 mb-1 ${colorConfig.title}`}>
            {note.title || 'Nota sin título'}
          </h3>

          {/* Snippet Preview */}
          <p className={`text-[11px] leading-relaxed line-clamp-3 ${colorConfig.text} font-normal opacity-90`}>
            {cleanSnippet(note.markdownContent || note.content)}
          </p>
        </div>

        {/* Footer info: Timestamp and Expand prompt */}
        <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5 text-[9px] opacity-65">
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {new Date(note.updatedAt || note.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          <span className="flex items-center gap-0.5 hover:underline">
            <span>Abrir</span>
            <ExternalLink size={8} />
          </span>
        </div>
      </div>
    </div>
  );
};
