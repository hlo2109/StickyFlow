import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Pin,
  PinOff,
  ChevronRight,
  FolderOpen,
  Calendar,
  Clock,
  StickyNote
} from 'lucide-react';
import { Note } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  activeNoteId: string;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote: (id: string, e: React.MouseEvent) => void;
  onTogglePinNote: (id: string, e: React.MouseEvent) => void;
  onOpenFolder: () => void;
  onToggleMiniSticky?: (note: Note, e: React.MouseEvent) => void;
  openMiniStickIds?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onTogglePinNote,
  onOpenFolder,
  onToggleMiniSticky,
  openMiniStickIds = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all');

  if (!isOpen) return null;

  // Filter notes correctly: empty search must show all notes
  const filteredNotes = notes.filter((n) => {
    const query = searchQuery.trim().toLowerCase();

    // When there is no search query, show all notes (or filter by pinned)
    if (!query) {
      if (filterMode === 'pinned') {
        return Boolean(n.isPinned);
      }
      return true;
    }

    // When search query is present, check title, markdownContent, content and tags
    const titleMatch = Boolean(n.title && n.title.toLowerCase().includes(query));
    const mdMatch = Boolean(n.markdownContent && n.markdownContent.toLowerCase().includes(query));
    const contentMatch = Boolean(n.content && n.content.toLowerCase().includes(query));
    const tagMatch = Boolean(n.tags && n.tags.some((t) => t.toLowerCase().includes(query)));

    const matchesSearch = titleMatch || mdMatch || contentMatch || tagMatch;

    if (filterMode === 'pinned') {
      return matchesSearch && Boolean(n.isPinned);
    }
    return matchesSearch;
  });

  // Sort notes: pinned first, then by updated date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const getColorBg = (color: string) => {
    switch (color) {
      case 'yellow': return 'bg-amber-400';
      case 'blue': return 'bg-sky-400';
      case 'green': return 'bg-emerald-400';
      case 'purple': return 'bg-purple-400';
      case 'pink': return 'bg-pink-400';
      case 'dark': return 'bg-slate-600';
      default: return 'bg-amber-400';
    }
  };

  const getCleanSnippet = (note: Note) => {
    const raw = note.markdownContent || note.content || '';
    if (raw) {
      const clean = raw
        .replace(/<[^>]*>?/gm, '')
        .replace(/#+\s+/g, '')
        .replace(/\[\s*\]/g, '☐ ')
        .replace(/\[x\]/g, '☑ ')
        .replace(/\*+/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/>\s*/g, '')
        .replace(/\n+/g, ' ')
        .trim();
      if (clean) return clean;
    }
    return 'Nota vacía...';
  };

  return (
    <aside className="w-72 h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-lg select-none transition-all">
      {/* Top Sidebar Header */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Mis Notas ({notes.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewNote}
            className="p-1 rounded bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 text-xs px-2"
            title="Crear nueva nota"
          >
            <Plus size={14} />
            <span>Nueva</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
            title="Ocultar panel"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en notas..."
            className="w-full pl-8 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterMode('pinned')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              filterMode === 'pinned'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Pin size={11} />
            Fijadas
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {sortedNotes.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            {searchQuery ? 'No hay notas que coincidan con la búsqueda' : 'No hay notas aún. ¡Crea una!'}
          </div>
        ) : (
          sortedNotes.map((note) => {
            const isActive = note.id === activeNoteId;
            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`group relative p-2.5 rounded-lg cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${getColorBg(note.color)}`} />
                    <h4 className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                      {note.title && note.title.trim() ? note.title : 'Nota sin título'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {openMiniStickIds.includes(note.id) && (
                      <span title="Anclada en pantalla como mini stick" className="p-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <StickyNote size={11} />
                      </span>
                    )}
                    {note.isPinned && (
                      <Pin size={12} className="text-amber-500" />
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                  {getCleanSnippet(note)}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-0.5">
                    <Clock size={10} />
                    {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onToggleMiniSticky && (
                      <button
                        onClick={(e) => onToggleMiniSticky(note, e)}
                        title={openMiniStickIds.includes(note.id) ? 'Cerrar mini stick en pantalla' : 'Anclar como mini stick flotante en pantalla'}
                        className={`p-1 rounded transition-colors ${
                          openMiniStickIds.includes(note.id)
                            ? 'text-amber-600 bg-amber-500/20'
                            : 'hover:text-amber-500'
                        }`}
                      >
                        <StickyNote size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => onTogglePinNote(note.id, e)}
                      title={note.isPinned ? 'Desfijar' : 'Fijar al inicio'}
                      className="p-1 hover:text-amber-500 rounded"
                    >
                      {note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    <button
                      onClick={(e) => onDeleteNote(note.id, e)}
                      title="Eliminar nota"
                      className="p-1 hover:text-red-500 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer: Open Folder */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Ver archivos .md en el explorador de archivos"
        >
          <FolderOpen size={13} />
          <span className="text-[11px]">Carpeta de notas (.md)</span>
        </button>
      </div>
    </aside>
  );
};
