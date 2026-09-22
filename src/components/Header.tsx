import React, { useState } from 'react';
import {
  Pin,
  PinOff,
  Minus,
  X,
  Sparkles,
  BookOpen,
  Settings,
  PanelRight,
  Copy,
  Plus,
  Palette,
  FolderOpen,
  Check,
  Bot,
  Headphones,
  StickyNote
} from 'lucide-react';
import { NoteColor } from '../types';

interface HeaderProps {
  isPinned: boolean;
  onTogglePin: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onNewNote: () => void;
  currentColor: NoteColor;
  onChangeColor: (color: NoteColor) => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenAiModal: () => void;
  onOpenBitacoraModal: () => void;
  onOpenSettings: () => void;
  onOpenMeetingMode: () => void;
  onCopyMarkdown: () => void;
  onCopyForClaude: () => void;
  onOpenFolder: () => void;
  onToggleMiniStick?: () => void;
  isMiniPinned?: boolean;
}

const COLORS: { id: NoteColor; bg: string; label: string }[] = [
  { id: 'yellow', bg: '#fef08a', label: 'Amarillo' },
  { id: 'blue', bg: '#bae6fd', label: 'Azul' },
  { id: 'green', bg: '#bbf7d0', label: 'Verde' },
  { id: 'purple', bg: '#e9d5ff', label: 'Púrpura' },
  { id: 'pink', bg: '#fbcfe8', label: 'Rosa' },
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
  onToggleSidebar,
  isSidebarOpen,
  onOpenAiModal,
  onOpenBitacoraModal,
  onOpenSettings,
  onOpenMeetingMode,
  onCopyMarkdown,
  onCopyForClaude,
  onOpenFolder,
  onToggleMiniStick,
  isMiniPinned
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);

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
      {/* Left controls: New note, Palette, Pin toggle */}
      <div className="flex items-center gap-1 window-no-drag">
        {/* New Note Button */}
        <button
          onClick={onNewNote}
          title="Nueva Nota (Ctrl + N)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current active:scale-95"
        >
          <Plus size={16} />
        </button>

        {/* Pin / Always on Top Window */}
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Desactivar ventana siempre flotante' : 'Mantener ventana siempre flotante'}
          className={`p-1 rounded-md transition-all active:scale-95 ${
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
            title={isMiniPinned ? 'Cerrar mini stick flotante de pantalla' : 'Anclar esta nota a la pantalla como mini stick flotante (Recordatorio)'}
            className={`p-1 rounded-md transition-all active:scale-95 ${
              isMiniPinned
                ? 'bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold ring-1 ring-amber-500/50'
                : 'hover:bg-black/10 dark:hover:bg-white/15 opacity-70 hover:opacity-100'
            }`}
          >
            <StickyNote size={15} />
          </button>
        )}

        {/* Color Palette dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPalette(!showPalette)}
            title="Cambiar color de nota"
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current"
          >
            <Palette size={16} />
          </button>

          {showPalette && (
            <div className="absolute top-8 left-0 z-50 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex gap-1.5 animate-in fade-in zoom-in-95">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChangeColor(c.id);
                    setShowPalette(false);
                  }}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border border-black/20 dark:border-white/30 transition-transform hover:scale-110 flex items-center justify-center`}
                  style={{ backgroundColor: c.bg }}
                >
                  {currentColor === c.id && <Check size={12} className={c.id === 'dark' ? 'text-white' : 'text-slate-800'} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bitácora / Timeline Button */}
        <button
          onClick={onOpenBitacoraModal}
          title="Ver Bitácora de la nota y marcas de tiempo"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current flex items-center gap-0.5 text-xs font-medium"
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">Bitácora</span>
        </button>
      </div>

      {/* Middle/Right Quick Actions: AI, Claude, Copy MD, Sidebar */}
      <div className="flex items-center gap-1 window-no-drag">
        {/* HuggingFace AI Button */}
        <button
          onClick={onOpenAiModal}
          title="Asistente de IA (Resumir, Crear notas desde ideas, RAG)"
          className="px-1.5 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
        >
          <Sparkles size={13} className="text-yellow-300" />
          <span>IA</span>
        </button>

        {/* Meeting Audio Mode Button */}
        <button
          onClick={onOpenMeetingMode}
          title="Modo Reunión (Escuchar audio del sistema y transcribir)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 text-current"
        >
          <Headphones size={15} className="text-purple-600 dark:text-purple-400" />
        </button>

        {/* Copy for Claude button */}
        <button
          onClick={handleCopyClaude}
          title="Copiar prompt completo con bitácora para analizar en Claude"
          className={`px-1.5 py-0.5 rounded-md font-medium text-xs flex items-center gap-1 transition-all ${
            copiedClaude
              ? 'bg-amber-600 text-white'
              : 'hover:bg-black/10 dark:hover:bg-white/15 text-current'
          }`}
        >
          <Bot size={13} />
          <span>{copiedClaude ? '¡Copiado!' : 'Claude'}</span>
        </button>

        {/* Copy as Markdown button */}
        <button
          onClick={handleCopyMd}
          title="Copiar tarjeta en formato Markdown (.md)"
          className={`p-1 rounded-md transition-all ${
            copiedMd
              ? 'bg-green-600 text-white'
              : 'hover:bg-black/10 dark:hover:bg-white/15 text-current'
          }`}
        >
          {copiedMd ? <Check size={15} /> : <Copy size={15} />}
        </button>

        {/* Open Notes Folder button */}
        <button
          onClick={onOpenFolder}
          title="Abrir carpeta local de notas en Markdown (mis_notas)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current opacity-75 hover:opacity-100"
        >
          <FolderOpen size={15} />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Ajustes (API Keys, IA, Configuración)"
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-all text-current opacity-75 hover:opacity-100"
        >
          <Settings size={15} />
        </button>

        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Ocultar lista de notas' : 'Mostrar lista de notas (Ctrl + B)'}
          className={`p-1 rounded-md transition-all ${
            isSidebarOpen ? 'bg-black/15 dark:bg-white/20 font-bold' : 'hover:bg-black/10 dark:hover:bg-white/15'
          }`}
        >
          <PanelRight size={16} />
        </button>

        {/* Window controls: Minimize & Close */}
        <div className="flex items-center ml-1 border-l border-black/15 dark:border-white/15 pl-1 gap-0.5">
          <button
            onClick={onMinimize}
            title="Minimizar"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 transition-colors text-current"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={onClose}
            title="Cerrar"
            className="p-1 rounded hover:bg-red-500 hover:text-white transition-colors text-current"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};
