import React, { useState, useEffect, useRef } from 'react';
import {
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Compass,
  Plus,
  StickyNote,
  X
} from 'lucide-react';
import { Note, AppSettings, NoteColor } from '../types';

const COLOR_THEMES: Record<NoteColor, {
  tabBg: string;
  tabHover: string;
  tabBorder: string;
  tabText: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardHeaderBg: string;
  badge: string;
}> = {
  yellow: {
    tabBg: 'bg-[#fef08a]',
    tabHover: 'bg-[#fde047]',
    tabBorder: 'border-[#eab308]',
    tabText: 'text-amber-950',
    accent: '#ca8a04',
    cardBg: 'bg-[#fffbeb] dark:bg-[#1c1808]',
    cardBorder: 'border-[#facc15] dark:border-[#ca8a04]',
    cardText: 'text-amber-950 dark:text-amber-100',
    cardHeaderBg: 'bg-amber-100/90 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-900',
    badge: 'bg-amber-200/90 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
  },
  blue: {
    tabBg: 'bg-[#bae6fd]',
    tabHover: 'bg-[#7dd3fc]',
    tabBorder: 'border-[#0284c7]',
    tabText: 'text-sky-950',
    accent: '#0284c7',
    cardBg: 'bg-[#f0f9ff] dark:bg-[#071926]',
    cardBorder: 'border-[#38bdf8] dark:border-[#0369a1]',
    cardText: 'text-sky-950 dark:text-sky-100',
    cardHeaderBg: 'bg-sky-100/90 dark:bg-sky-950/80 border-b border-sky-200 dark:border-sky-900',
    badge: 'bg-sky-200/90 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200'
  },
  green: {
    tabBg: 'bg-[#bbf7d0]',
    tabHover: 'bg-[#86efac]',
    tabBorder: 'border-[#16a34a]',
    tabText: 'text-emerald-950',
    accent: '#16a34a',
    cardBg: 'bg-[#f0fdf4] dark:bg-[#061f10]',
    cardBorder: 'border-[#4ade80] dark:border-[#15803d]',
    cardText: 'text-emerald-950 dark:text-emerald-100',
    cardHeaderBg: 'bg-emerald-100/90 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-900',
    badge: 'bg-emerald-200/90 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
  },
  purple: {
    tabBg: 'bg-[#e9d5ff]',
    tabHover: 'bg-[#d8b4fe]',
    tabBorder: 'border-[#9333ea]',
    tabText: 'text-purple-950',
    accent: '#9333ea',
    cardBg: 'bg-[#faf5ff] dark:bg-[#1a0b29]',
    cardBorder: 'border-[#c084fc] dark:border-[#7e22ce]',
    cardText: 'text-purple-950 dark:text-purple-100',
    cardHeaderBg: 'bg-purple-100/90 dark:bg-purple-950/80 border-b border-purple-200 dark:border-purple-900',
    badge: 'bg-purple-200/90 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200'
  },
  pink: {
    tabBg: 'bg-[#fbcfe8]',
    tabHover: 'bg-[#f9a8d4]',
    tabBorder: 'border-[#db2777]',
    tabText: 'text-rose-950',
    accent: '#db2777',
    cardBg: 'bg-[#fff1f2] dark:bg-[#260813]',
    cardBorder: 'border-[#f472b6] dark:border-[#be185d]',
    cardText: 'text-rose-950 dark:text-rose-100',
    cardHeaderBg: 'bg-rose-100/90 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-900',
    badge: 'bg-rose-200/90 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200'
  },
  dark: {
    tabBg: 'bg-[#1e293b]',
    tabHover: 'bg-[#334155]',
    tabBorder: 'border-[#475569]',
    tabText: 'text-slate-100',
    accent: '#38bdf8',
    cardBg: 'bg-[#0f172a] text-slate-100',
    cardBorder: 'border-slate-700',
    cardText: 'text-slate-100',
    cardHeaderBg: 'bg-slate-800/90 border-b border-slate-700',
    badge: 'bg-slate-800 text-slate-300'
  }
};

export const NotebookDockView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    hfEndpoint: 'https://router.huggingface.co/v1',
    hfModel: 'openai/gpt-oss-120b',
    hfApiKey: '',
    claudeApiKey: '',
    claudeModel: 'claude-3-5-sonnet-20241022',
    activeAiProvider: 'huggingface',
    enableCloudflareRag: false,
    cloudflareAccountId: '',
    cloudflareApiToken: '',
    cloudflareVectorizeIndex: '',
    cloudflareRagEndpoint: '',
    dbMode: 'local',
    remoteDbProvider: 'supabase',
    remoteDbUrl: '',
    remoteDbApiKey: '',
    autoSyncRemote: false,
    enablePrivacyMasking: true,
    maskSensitiveRegex: true,
    speechLang: 'es-ES',
    alwaysOnTop: true,
    defaultColor: 'yellow',
    opacity: 0.98,
    dockPosition: 'right',
    dockShowTitles: true,
    dockEnabled: true,
    dockAlwaysOnTop: true,
    dockedNoteIds: []
  });

  const [dockedIds, setDockedIds] = useState<string[]>([]);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  const isMouseIgnoringRef = useRef<boolean>(true);

  const position = settings.dockPosition || 'right';
  const showTitles = settings.dockShowTitles !== false;
  const isAlwaysOnTop = settings.dockAlwaysOnTop !== false;

  // Load initial notes and settings
  useEffect(() => {
    const init = async () => {
      if (window.electronAPI?.loadNotes) {
        const loadedNotes = await window.electronAPI.loadNotes();
        if (Array.isArray(loadedNotes)) setNotes(loadedNotes);
      }
      if (window.electronAPI?.loadSettings) {
        const loadedSettings = await window.electronAPI.loadSettings();
        if (loadedSettings) setSettings(loadedSettings);
      }
      if (window.electronAPI?.getDockedNotes) {
        const ids = await window.electronAPI.getDockedNotes();
        if (Array.isArray(ids)) setDockedIds(ids);
      }
    };

    init();

    if (window.electronAPI?.onDockNotesUpdated) {
      window.electronAPI.onDockNotesUpdated((updatedNotes) => {
        setNotes(updatedNotes);
      });
    }

    if (window.electronAPI?.onDockSettingsUpdated) {
      window.electronAPI.onDockSettingsUpdated((updatedSettings) => {
        setSettings(updatedSettings);
      });
    }

    if (window.electronAPI?.onDockedIdsChanged) {
      window.electronAPI.onDockedIdsChanged((ids) => {
        setDockedIds(ids);
      });
    }
  }, []);

  // Sync mouse ignore state with Electron
  const setMouseIgnore = (ignore: boolean) => {
    if (isMouseIgnoringRef.current !== ignore) {
      isMouseIgnoringRef.current = ignore;
      if (window.electronAPI?.setDockMouseIgnore) {
        window.electronAPI.setDockMouseIgnore(ignore);
      }
    }
  };

  // Window-wide mouse move listener to gracefully switch ignore states
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const isOverInteractive = elem?.closest('.dock-interactive') !== null;

      if (isOverInteractive) {
        setMouseIgnore(false);
      } else {
        setMouseIgnore(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Hover handlers for tabs
  const handleTabMouseEnter = (noteId: string) => {
    setMouseIgnore(false);
    setHoveredNoteId(noteId);
  };

  const handleTabMouseLeave = () => {
    setHoveredNoteId(null);
    setMouseIgnore(true);
  };

  // Action handlers
  const handleOpenNote = (noteId: string) => {
    if (window.electronAPI?.openNoteWindow) {
      window.electronAPI.openNoteWindow(noteId);
    } else if (window.electronAPI?.openNoteInMain) {
      window.electronAPI.openNoteInMain(noteId);
    } else if (window.electronAPI?.expandMiniSticky) {
      window.electronAPI.expandMiniSticky(noteId);
    }
  };

  const handleToggleTitles = async () => {
    const nextShow = !showTitles;
    const nextSettings = { ...settings, dockShowTitles: nextShow };
    setSettings(nextSettings);
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(nextSettings);
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    const nextVal = !isAlwaysOnTop;
    const nextSettings = { ...settings, dockAlwaysOnTop: nextVal };
    setSettings(nextSettings);
    if (window.electronAPI?.setDockAlwaysOnTop) {
      await window.electronAPI.setDockAlwaysOnTop(nextVal);
    }
  };

  const handleRotatePosition = async () => {
    const positions: Array<'right' | 'bottom' | 'left' | 'top'> = ['right', 'bottom', 'left', 'top'];
    const currentIndex = positions.indexOf(position);
    const nextPosition = positions[(currentIndex + 1) % positions.length];

    const nextSettings = { ...settings, dockPosition: nextPosition };
    setSettings(nextSettings);
    if (window.electronAPI?.setDockPosition) {
      await window.electronAPI.setDockPosition(nextPosition);
    }
  };

  const handleQuitApp = () => {
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  // Filter docked notes
  const dockedNotes = notes.filter((n) => {
    if (dockedIds.length > 0) {
      return dockedIds.includes(n.id) || n.isPinned;
    }
    return true; // Default: show all notes on first launch
  });

  const isVertical = position === 'left' || position === 'right';

  return (
    <div
      className={`h-screen w-screen bg-transparent select-none overflow-hidden relative font-sans flex ${
        position === 'right'
          ? 'justify-end items-center pr-0'
          : position === 'left'
          ? 'justify-start items-center pl-0'
          : position === 'top'
          ? 'justify-center items-start pt-0'
          : 'justify-center items-end pb-0'
      }`}
    >

      {/* Dock Tabs Container + Toolbar */}
      <div
        className={`dock-interactive flex items-center transition-all duration-200 z-30 ${
          isVertical ? 'flex-col gap-2' : 'flex-row gap-2'
        } ${position === 'right' ? 'items-end' : ''} ${
          position === 'left' ? 'items-start' : ''
        } ${position === 'top' ? 'items-center' : ''} ${
          position === 'bottom' ? 'items-center' : ''
        }`}
        onMouseEnter={() => setMouseIgnore(false)}
        onMouseLeave={handleTabMouseLeave}
      >
        {/* Quick Toolbar Pill */}
        <div
          className={`dock-interactive flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200/90 dark:border-slate-700/90 p-1 text-slate-600 dark:text-slate-300 text-xs transition-opacity opacity-85 hover:opacity-100 ${
            position === 'right' ? 'mr-1' : position === 'left' ? 'ml-1' : ''
          }`}
          title="Herramientas de Separadores"
        >
          {/* Toggle Titles: Show / Hide */}
          <button
            onClick={handleToggleTitles}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={showTitles ? 'Ocultar nombres (Modo compacto)' : 'Mostrar nombres de notas'}
          >
            {showTitles ? <Eye size={12} className="text-blue-600 dark:text-blue-400" /> : <EyeOff size={12} />}
          </button>

          {/* Toggle Always on Top for Dock */}
          <button
            onClick={handleToggleAlwaysOnTop}
            className={`p-1 rounded-full transition-colors ${
              isAlwaysOnTop
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400'
            }`}
            title={
              isAlwaysOnTop
                ? 'Separadores siempre por encima de las ventanas (Activo)'
                : 'Separadores detrás de las ventanas (Inactivo)'
            }
          >
            {isAlwaysOnTop ? <Pin size={12} className="fill-current" /> : <PinOff size={12} />}
          </button>

          {/* Switch Edge: Left / Right / Top / Bottom */}
          <button
            onClick={handleRotatePosition}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={`Cambiar borde (Actual: ${position})`}
          >
            <Compass size={12} className="text-sky-600 dark:text-sky-400" />
          </button>

          {/* Open Main StickyFlow Window */}
          <button
            onClick={() => handleOpenNote(notes[0]?.id || '')}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Abrir ventana principal de StickyFlow"
          >
            <Plus size={12} className="text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Quit StickyFlow Completely */}
          <button
            onClick={handleQuitApp}
            className="p-1 rounded-full hover:bg-red-500 hover:text-white transition-colors"
            title="Cerrar StickyFlow por completo"
          >
            <X size={12} />
          </button>
        </div>

        {/* Separadores Tabs Stack - Pinned Flush to the Screen Wall */}
        <div
          className={`dock-interactive flex ${
            isVertical
              ? 'flex-col gap-2 max-h-[82vh] overflow-y-auto'
              : 'flex-row gap-2 max-w-[85vw] overflow-x-auto'
          } ${position === 'right' ? 'items-end' : position === 'left' ? 'items-start' : 'items-center'} scrollbar-none`}
        >
          {dockedNotes.length === 0 ? (
            /* Empty State: Mini protruding tab */
            <div
              onClick={() => handleOpenNote(notes[0]?.id || '')}
              className={`dock-interactive cursor-pointer group flex items-center gap-1.5 px-3 py-2 bg-amber-200 hover:bg-amber-300 text-amber-950 font-medium text-xs shadow-md border border-amber-400 transition-all ${
                position === 'right'
                  ? 'rounded-l-xl border-r-0'
                  : position === 'left'
                  ? 'rounded-r-xl border-l-0'
                  : position === 'top'
                  ? 'rounded-b-xl border-t-0'
                  : 'rounded-t-xl border-b-0'
              }`}
              title="Haz clic para fijar notas aquí desde StickyFlow"
            >
              <StickyNote size={13} className="text-amber-800 shrink-0" />
              {showTitles && <span className="text-[11px] font-bold tracking-wide">Fijar Notas</span>}
            </div>
          ) : (
            dockedNotes.map((note) => {
              const theme = COLOR_THEMES[note.color || 'yellow'];
              const isHovered = hoveredNoteId === note.id;

              // Flush shape classes: NO translate-x, NO gap from wall!
              let positionShapeClasses = '';
              let widthClass = '';

              if (position === 'right') {
                positionShapeClasses = 'rounded-l-xl border-r-0 justify-start pl-3 pr-2';
                // Width expands inwards on hover while right side stays 100% glued to right wall
                widthClass = showTitles
                  ? isHovered ? 'w-44 shadow-xl' : 'w-36 hover:w-44'
                  : isHovered ? 'w-12 shadow-xl' : 'w-9 hover:w-12';
              } else if (position === 'left') {
                positionShapeClasses = 'rounded-r-xl border-l-0 justify-start pl-2 pr-3';
                widthClass = showTitles
                  ? isHovered ? 'w-44 shadow-xl' : 'w-36 hover:w-44'
                  : isHovered ? 'w-12 shadow-xl' : 'w-9 hover:w-12';
              } else if (position === 'top') {
                positionShapeClasses = 'rounded-b-xl border-t-0 justify-start pt-2 pb-2 px-2.5';
                widthClass = showTitles
                  ? isHovered ? 'h-14 shadow-xl w-36' : 'h-10 hover:h-14 w-36'
                  : isHovered ? 'h-12 shadow-xl w-10' : 'h-8 hover:h-12 w-10';
              } else {
                // bottom
                positionShapeClasses = 'rounded-t-xl border-b-0 justify-start pt-2 pb-2 px-2.5';
                widthClass = showTitles
                  ? isHovered ? 'h-14 shadow-xl w-36' : 'h-10 hover:h-14 w-36'
                  : isHovered ? 'h-12 shadow-xl w-10' : 'h-8 hover:h-12 w-10';
              }

              return (
                <div
                  key={note.id}
                  onMouseEnter={() => handleTabMouseEnter(note.id)}
                  onClick={() => handleOpenNote(note.id)}
                  className={`dock-interactive cursor-pointer flex items-center transition-all duration-200 ease-out relative border shadow-md ${
                    theme.tabBg
                  } ${theme.tabBorder} ${theme.tabText} ${positionShapeClasses} ${widthClass} ${
                    isVertical ? 'py-1.5' : ''
                  }`}
                  style={{
                    boxShadow: isHovered
                      ? `0 8px 20px -2px rgba(0,0,0,0.2)`
                      : undefined
                  }}
                  title={note.title || 'Nota sin título'}
                >
                  {/* Notebook Bookmark Accent Line */}
                  <div
                    className={`absolute ${
                      position === 'right'
                        ? 'left-1 top-2 bottom-2 w-1 rounded-full'
                        : position === 'left'
                        ? 'right-1 top-2 bottom-2 w-1 rounded-full'
                        : position === 'top'
                        ? 'bottom-1 left-2 right-2 h-1 rounded-full'
                        : 'top-1 left-2 right-2 h-1 rounded-full'
                    }`}
                    style={{ backgroundColor: theme.accent, opacity: 0.8 }}
                  />

                  {/* Icon and Title */}
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Pin
                      size={11}
                      className="shrink-0 fill-current opacity-80"
                      style={{ color: theme.accent }}
                    />

                    {showTitles && (
                      <span className="text-[11px] font-bold tracking-tight truncate leading-tight select-none">
                        {note.title && note.title.trim() ? note.title : 'Sin título'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
