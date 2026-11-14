import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  PinOff,
  Minus,
  X,
  Sparkles,
  BookOpen,
  Settings,
  LayoutList,
  Copy,
  Plus,
  Palette,
  FolderOpen,
  Check,
  Bot,
  Headphones,
  StickyNote,
  ExternalLink,
  MoreVertical,
  Volume2
} from 'lucide-react';
import { NoteColor } from '../types';
import { SyncBadge } from './SyncBadge';

interface HeaderProps {
  isPinned: boolean;
  onTogglePin: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onNewNote: () => void;
  currentColor: NoteColor;
  onChangeColor: (color: NoteColor) => void;
  onOpenNotesList: () => void;
  onOpenAiModal: () => void;
  onOpenBitacoraModal: () => void;
  onOpenSettings: () => void;
  onOpenMeetingMode: () => void;
  onCopyMarkdown: () => void;
  onCopyForClaude: () => void;
  onOpenFolder: () => void;
  onToggleMiniStick?: () => void;
  isMiniPinned?: boolean;
  onOpenInNewWindow?: () => void;
  onReadNote?: () => void;
}

const COLORS: { id: NoteColor; bg: string; label: string }[] = [
  { id: 'yellow', bg: '#fef08a', label: 'Amarillo' },
  { id: 'orange', bg: '#fed7aa', label: 'Naranja' },
  { id: 'coral', bg: '#fecaca', label: 'Coral' },
  { id: 'pink', bg: '#fbcfe8', label: 'Rosa' },
  { id: 'purple', bg: '#e9d5ff', label: 'Púrpura' },
  { id: 'indigo', bg: '#c7d2fe', label: 'Índigo' },
  { id: 'blue', bg: '#bae6fd', label: 'Azul' },
  { id: 'teal', bg: '#99f6e4', label: 'Turquesa' },
  { id: 'green', bg: '#bbf7d0', label: 'Verde' },
  { id: 'dark', bg: '#1e293b', label: 'Oscuro' },
];

export const Header: React.FC<HeaderProps> = ({
  isPinned,
  onTogglePin,
  onMinimize,
  onClose,
  onNewNote,
  currentColor,
  onChangeColor,
  onOpenNotesList,
  onOpenAiModal,
  onOpenBitacoraModal,
  onOpenSettings,
  onOpenMeetingMode,
  onCopyMarkdown,
  onCopyForClaude,
  onOpenFolder,
  onToggleMiniStick,
  isMiniPinned,
  onOpenInNewWindow,
  onReadNote
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);

  const paletteRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close palette and menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyMd = () => {
    onCopyMarkdown();
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyClaude = () => {
    onCopyForClaude();
    setCopiedClaude(true);
    setTimeout(() => setCopiedClaude(false), 2000);
  };

  return (
    <header className="note-header flex items-center justify-between px-2.5 py-1.5 border-b border-black/10 dark:border-white/10 window-drag-region select-none transition-colors">
      {/* Left controls: New note, Palette, Pin toggle, Bitacora */}
      <div className="flex items-center gap-1 window-no-drag shrink-0">
        {/* New Note Button */}
        <button
          onClick={onNewNote}
          title="Nueva Nota (Ctrl + N)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current active:scale-95 cursor-pointer"
        >
          <Plus size={16} />
        </button>

        {/* Pin / Always on Top Window */}
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Desactivar ventana siempre flotante' : 'Mantener ventana siempre flotante'}
          className={`p-1 rounded-md transition-all active:scale-95 cursor-pointer ${
            isPinned
              ? 'bg-black/15 dark:bg-white/20 font-bold'
              : 'hover:bg-black/10 dark:hover:bg-white/15 opacity-70'
          }`}
        >
          {isPinned ? <Pin size={16} className="text-amber-700 dark:text-amber-300" /> : <PinOff size={16} />}
        </button>

        {/* Mini Sticky to Desktop Pin Button */}
        {onToggleMiniStick && (
          <button
            onClick={onToggleMiniStick}
            title={
              isMiniPinned
                ? 'Desanclar del dock de separadores de pantalla'
                : 'Fijar como separador de cuaderno en pantalla (Dock)'
            }
            className={`p-1 rounded-md transition-all active:scale-95 cursor-pointer ${
              isMiniPinned
                ? 'bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold ring-1 ring-amber-500/50'
                : 'hover:bg-black/10 dark:hover:bg-white/15 opacity-70 hover:opacity-100'
            }`}
          >
            <StickyNote size={15} />
          </button>
        )}

        {/* Color Palette dropdown with spacious, clean UI */}
        <div className="relative" ref={paletteRef}>
          <button
            onClick={() => setShowPalette(!showPalette)}
            title="Cambiar color de nota"
            className={`p-1 rounded-md transition-all text-current cursor-pointer ${
              showPalette ? 'bg-black/15 dark:bg-white/20 font-bold' : 'hover:bg-black/10 dark:hover:bg-white/15'
            }`}
          >
            <Palette size={16} />
          </button>

          {showPalette && (
            <div className="absolute top-9 left-0 z-50 w-56 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 select-none">
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-700/80">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Palette size={13} className="text-purple-600 dark:text-purple-400" />
                  Color de la nota
                </span>
                <span className="text-[10px] text-slate-400 capitalize">
                  {COLORS.find(c => c.id === currentColor)?.label || currentColor}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChangeColor(c.id);
                      setShowPalette(false);
                    }}
                    title={c.label}
                    className={`w-8 h-8 rounded-full border border-black/15 dark:border-white/20 transition-all duration-150 hover:scale-115 flex items-center justify-center cursor-pointer shadow-xs ${
                      currentColor === c.id
                        ? 'ring-2 ring-purple-600 dark:ring-purple-400 ring-offset-2 dark:ring-offset-slate-800 scale-105'
                        : 'hover:shadow-md'
                    }`}
                    style={{ backgroundColor: c.bg }}
                  >
                    {currentColor === c.id && (
                      <Check size={15} className={c.id === 'dark' ? 'text-white' : 'text-slate-800 font-bold'} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bitácora / Timeline Button */}
        <button
          onClick={onOpenBitacoraModal}
          title="Ver Bitácora de la nota y marcas de tiempo"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current flex items-center gap-0.5 text-xs font-medium cursor-pointer"
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">Bitácora</span>
        </button>
      </div>

      {/* Middle/Right Quick Actions: AI, Meeting, Dropdown Menu, Settings, Sidebar */}
      <div className="flex items-center gap-1 window-no-drag shrink-0">
        <SyncBadge compact />
        {/* HuggingFace AI Button */}
        <button
          onClick={onOpenAiModal}
          title="Asistente de IA (Resumir, Crear notas desde ideas, RAG)"
          className="px-1.5 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles size={13} className="text-yellow-300" />
          <span>IA</span>
        </button>

        {/* Meeting Audio Mode Button */}
        <button
          onClick={onOpenMeetingMode}
          title="Modo Reunión (Audio en vivo con Radar de Dudas o Grabación Normal)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 text-current cursor-pointer"
        >
          <Headphones size={15} className="text-purple-600 dark:text-purple-400" />
        </button>

        {/* Dropdown Menu (Copiar, Copiar Claude, Abrir Carpeta, etc.) */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            title="Más opciones (Copiar, Claude, Carpeta)"
            className={`p-1 rounded-md transition-all cursor-pointer ${
              showMenu
                ? 'bg-black/15 dark:bg-white/20 font-bold'
                : 'hover:bg-black/10 dark:hover:bg-white/15 text-current opacity-80 hover:opacity-100'
            }`}
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute top-9 right-0 z-50 w-52 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 text-xs select-none">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 mb-1">
                Acciones de la nota
              </div>

              {/* Copiar contenido Markdown */}
              <button
                type="button"
                onClick={() => {
                  handleCopyMd();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Copy size={14} className="text-slate-500 dark:text-slate-400" />
                  <span>Copiar nota (Markdown)</span>
                </div>
                {copiedMd && <span className="text-[10px] text-emerald-600 font-semibold">¡Copiado!</span>}
              </button>

              {/* Copiar para Claude */}
              <button
                type="button"
                onClick={() => {
                  handleCopyClaude();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bot size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>Copiar para Claude</span>
                </div>
                {copiedClaude ? (
                  <span className="text-[10px] text-emerald-600 font-semibold">¡Copiado!</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Prompt</span>
                )}
              </button>

              {/* Leer nota en voz alta */}
              {onReadNote && (
                <button
                  type="button"
                  onClick={() => {
                    onReadNote();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-sky-600 dark:text-sky-400" />
                    <span>Leer nota en voz alta</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">Voz</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-100 dark:border-slate-700/80"></div>

              {/* Abrir carpeta local */}
              <button
                type="button"
                onClick={() => {
                  onOpenFolder();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <FolderOpen size={14} className="text-blue-500" />
                <span>Abrir carpeta de notas</span>
              </button>

              {/* Abrir en ventana independiente */}
              {onOpenInNewWindow && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInNewWindow();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <ExternalLink size={14} className="text-indigo-500" />
                  <span>Abrir en ventana flotante</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Ajustes (API Keys, IA, Configuración)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current opacity-75 hover:opacity-100 cursor-pointer"
        >
          <Settings size={15} />
        </button>

        {/* Lista de notas: abre su propia ventana */}
        <button
          onClick={onOpenNotesList}
          title="Abrir la lista de notas (Ctrl + B)"
          className="p-1 rounded-md transition-all cursor-pointer hover:bg-black/10 dark:hover:bg-white/15"
        >
          <LayoutList size={16} />
        </button>

        {/* Window controls: Minimize & Close */}
        <div className="flex items-center ml-1 border-l border-black/15 dark:border-white/15 pl-1 gap-0.5 shrink-0">
          <button
            onClick={onMinimize}
            title="Minimizar"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 transition-colors text-current cursor-pointer"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={onClose}
            title="Cerrar"
            className="p-1 rounded hover:bg-red-500 hover:text-white transition-colors text-current cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};
