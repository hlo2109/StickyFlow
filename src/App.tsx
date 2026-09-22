import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, AppSettings, NoteColor, BitacoraEntry } from './types';
import { Header } from './components/Header';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { AiModal } from './components/AiModal';
import { BitacoraModal } from './components/BitacoraModal';
import { SettingsModal } from './components/SettingsModal';
import { MeetingModal } from './components/MeetingModal';
import { htmlToMarkdown, markdownToHtml, formatNoteForClaude } from './utils/markdown';

const DEFAULT_SETTINGS: AppSettings = {
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
  opacity: 0.98
};

const INITIAL_WELCOME_NOTE: Note = {
  id: 'welcome-1',
  title: '👋 ¡Bienvenido a StickyFlow!',
  content: `<h2>📌 Tu Bloc de Notas Flotante e Inteligente</h2>
<p>Esta es tu nueva aplicación de notas tipo <strong>sticky note</strong> para Windows, siempre flotante, rápida y sin lag.</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Ventana flotante configurable (📌 arriba a la izquierda)</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Panel lateral derecho plegable para organizar notas</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Configurar tu clave API en ⚙️ Ajustes</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Probar el botón <strong>✨ IA</strong> (Resumir, Crear nota desde ideas o RAG)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Presionar <strong>🎙️ Dictar</strong> para escribir con tu voz</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Presionar <strong>📅 Fecha</strong> para registrar en la bitácora</p></div></li>
</ul>
<p>💡 <em>Tip: Puedes pegar imágenes directamente con <strong>Ctrl+V</strong> o cambiar a modo Markdown puro en cualquier momento.</em></p>`,
  markdownContent: `## 📌 Tu Bloc de Notas Flotante e Inteligente

Esta es tu nueva aplicación de notas tipo **sticky note** para Windows, siempre flotante, rápida y sin lag.

- [x] Ventana flotante configurable (📌 arriba a la izquierda)
- [x] Panel lateral derecho plegable para organizar notas
- [ ] Configurar tu clave API en ⚙️ Ajustes
- [ ] Probar el botón **✨ IA** (Resumir, Crear nota desde ideas o RAG)
- [ ] Presionar **🎙️ Dictar** para escribir con tu voz
- [ ] Presionar **📅 Fecha** para registrar en la bitácora

💡 *Tip: Puedes pegar imágenes directamente con **Ctrl+V** o cambiar a modo Markdown puro en cualquier momento.*`,
  color: 'yellow',
  isPinned: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['bienvenida', 'guía'],
  bitacora: [
    {
      id: 'b-init',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'creacion',
      summary: 'Nota de bienvenida creada automáticamente'
    }
  ]
};

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isBitacoraModalOpen, setIsBitacoraModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  // Autosave timer ref
  const saveTimeoutRef = useRef<any>(null);

  // Active Note - safe lookup
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // Load notes & settings on initial mount
  useEffect(() => {
    const initData = async () => {
      let loadedNotes: Note[] = [];
      let loadedSettings: AppSettings = DEFAULT_SETTINGS;

      if (window.electronAPI) {
        try {
          loadedNotes = await window.electronAPI.loadNotes();
          loadedSettings = await window.electronAPI.loadSettings();
          const alwaysOnTopState = await window.electronAPI.getAlwaysOnTop();
          setIsPinned(alwaysOnTopState);
        } catch (e) {
          console.error('Error loading initial data from Electron:', e);
        }
      } else {
        const local = localStorage.getItem('stickyflow_notes');
        if (local) {
          try { loadedNotes = JSON.parse(local); } catch {}
        }
        const localSettings = localStorage.getItem('stickyflow_settings');
        if (localSettings) {
          try { loadedSettings = JSON.parse(localSettings); } catch {}
        }
      }

      if (loadedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      }

      if (loadedNotes && loadedNotes.length > 0) {
        const hasRealContent = loadedNotes.some((n) =>
          (n.title && n.title.trim() !== '') ||
          (n.markdownContent && n.markdownContent.trim() !== '') ||
          (n.content && n.content.replace(/<[^>]*>?/gm, '').trim() !== '')
        );

        let finalNotes: Note[];
        if (!hasRealContent) {
          finalNotes = [INITIAL_WELCOME_NOTE];
        } else {
          let hasOneBlank = false;
          finalNotes = loadedNotes.filter((n) => {
            const isBlank =
              (!n.title || n.title.trim() === '') &&
              (!n.content || n.content.replace(/<[^>]*>?/gm, '').trim() === '') &&
              (!n.markdownContent || n.markdownContent.trim() === '');
            if (isBlank) {
              if (!hasOneBlank) {
                hasOneBlank = true;
                return true;
              }
              return false;
            }
            return true;
          });
        }

        setNotes(finalNotes);
        setActiveNoteId(finalNotes[0].id);
        if (finalNotes.length !== loadedNotes.length) {
          triggerSave(finalNotes);
        }
      } else {
        setNotes([INITIAL_WELCOME_NOTE]);
        setActiveNoteId(INITIAL_WELCOME_NOTE.id);
      }
    };

    initData();

    if (window.electronAPI?.onAlwaysOnTopChanged) {
      window.electronAPI.onAlwaysOnTopChanged((val) => {
        setIsPinned(val);
      });
    }
  }, []);

  // Track floating mini sticky notes on desktop
  const [openMiniStickIds, setOpenMiniStickIds] = useState<string[]>([]);

  useEffect(() => {
    if (window.electronAPI?.getOpenMiniStickies) {
      window.electronAPI.getOpenMiniStickies().then((ids) => {
        if (Array.isArray(ids)) setOpenMiniStickIds(ids);
      });
    }

    if (window.electronAPI?.onMiniStickyStatusChanged) {
      window.electronAPI.onMiniStickyStatusChanged(({ noteId, isOpen }) => {
        setOpenMiniStickIds((prev) =>
          isOpen ? Array.from(new Set([...prev, noteId])) : prev.filter((id) => id !== noteId)
        );
      });
    }

    if (window.electronAPI?.onSelectNote) {
      window.electronAPI.onSelectNote((noteId: string) => {
        handleSelectNote(noteId);
      });
    }
  }, []);

  const handleToggleMiniSticky = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.electronAPI?.toggleMiniSticky) {
      await window.electronAPI.toggleMiniSticky(note);
    }
  };


  // Debounced save of notes
  const triggerSave = useCallback((notesToSave: Note[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (window.electronAPI) {
        await window.electronAPI.saveNotes(notesToSave);
      } else {
        localStorage.setItem('stickyflow_notes', JSON.stringify(notesToSave));
      }

      // Sync to Remote DB if configured
      if (settings.dbMode === 'remote' && settings.remoteDbUrl && settings.autoSyncRemote) {
        try {
          await fetch(settings.remoteDbUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(settings.remoteDbApiKey ? { 'Authorization': `Bearer ${settings.remoteDbApiKey}` } : {})
            },
            body: JSON.stringify(notesToSave)
          });
        } catch (err) {
          console.warn('Remote sync failed:', err);
        }
      }
    }, 400);
  }, [settings]);

  // Update a note specifically by its noteId to prevent cross-note overwrites
  const handleUpdateNote = (noteId: string, updatedFields: Partial<Note>) => {
    setNotes((prevNotes) => {
      const nextNotes = prevNotes.map((n) => {
        if (n.id === noteId) {
          return {
            ...n,
            ...updatedFields,
            updatedAt: updatedFields.updatedAt || new Date().toISOString()
          };
        }
        return n;
      });
      triggerSave(nextNotes);
      return nextNotes;
    });
  };

  // Safe Note Selection - cancels any pending debounced save
  const handleSelectNote = (id: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setActiveNoteId(id);
  };

  // Add bitácora entry
  const handleAddBitacoraLog = (action: BitacoraEntry['action'], summary: string) => {
    if (!activeNote) return;

    const newEntry: BitacoraEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }),
      action,
      summary
    };

    setNotes((prevNotes) => {
      const nextNotes = prevNotes.map((n) => {
        if (n.id === activeNote.id) {
          return {
            ...n,
            bitacora: [...(n.bitacora || []), newEntry],
            updatedAt: new Date().toISOString()
          };
        }
        return n;
      });
      triggerSave(nextNotes);
      return nextNotes;
    });
  };

  // Add quick bitacora entry and append to content
  const handleAddManualBitacora = (text: string) => {
    const now = new Date();
    const formattedDate = `\n\n> 📅 **[${now.toLocaleString('es-ES')}]** - ${text}`;

    if (activeNote) {
      const updatedMd = (activeNote.markdownContent || '') + formattedDate;
      const updatedHtml = markdownToHtml(updatedMd);

      handleUpdateNote(activeNote.id, {
        markdownContent: updatedMd,
        content: updatedHtml
      });
      handleAddBitacoraLog('nota_rapida', text);
    }
  };

  // Create new blank note
  const handleCreateNewNote = () => {
    // If there is already an existing blank note in the list, just navigate to it
    const isBlank = (n: Note) =>
      (!n.title || n.title.trim() === '') &&
      (!n.content || n.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, '').trim() === '') &&
      (!n.markdownContent || n.markdownContent.trim() === '');

    const existingBlank = notes.find(isBlank);
    if (existingBlank) {
      setActiveNoteId(existingBlank.id);
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const newNote: Note = {
      id: 'note-' + Date.now(),
      title: '',
      content: '',
      markdownContent: '',
      color: settings.defaultColor || 'yellow',
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      bitacora: [
        {
          id: 'b-' + Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: 'creacion',
          summary: 'Nota creada'
        }
      ]
    };

    const nextNotes = [newNote, ...notes];
    setNotes(nextNotes);
    setActiveNoteId(newNote.id);
    triggerSave(nextNotes);
  };

  // Create Note from AI Ideas
  const handleCreateNewNoteFromAi = (title: string, markdown: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const newNote: Note = {
      id: 'note-' + Date.now(),
      title: title || 'Nota Asistida por IA',
      content: markdownToHtml(markdown),
      markdownContent: markdown,
      color: settings.defaultColor || 'yellow',
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['ia', 'ideas'],
      bitacora: [
        {
          id: 'b-' + Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: 'ia_creacion',
          summary: 'Nota estructurada y generada a partir de ideas con IA'
        }
      ]
    };

    const nextNotes = [newNote, ...notes];
    setNotes(nextNotes);
    setActiveNoteId(newNote.id);
    triggerSave(nextNotes);
  };

  // Insert meeting minutes note
  const handleInsertMeetingNote = (title: string, markdown: string, asNewNote: boolean) => {
    if (asNewNote) {
      handleCreateNewNoteFromAi(title || `Minuta de Reunión - ${new Date().toLocaleDateString('es-ES')}`, markdown);
    } else if (activeNote) {
      const currentMd = activeNote.markdownContent || htmlToMarkdown(activeNote.content || '');
      const prefix = currentMd.trim() ? `${currentMd.trim()}\n\n---\n### 🎙️ Minuta de Reunión\n` : `### 🎙️ Minuta de Reunión\n`;
      const cleanMarkdown = markdown.replace(/^\n\n---\n/, '');
      const updatedMd = prefix + cleanMarkdown;
      const updatedHtml = markdownToHtml(updatedMd);
      const titleUpdate = (!activeNote.title || activeNote.title.trim() === '') && title ? { title } : {};
      handleUpdateNote(activeNote.id, {
        markdownContent: updatedMd,
        content: updatedHtml,
        ...titleUpdate,
        updatedAt: new Date().toISOString()
      });
      handleAddBitacoraLog('reunion', 'Minuta de reunión insertada');
    }
  };

  // Delete note
  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notes.length <= 1) {
      const resetNote: Note = {
        id: 'note-' + Date.now(),
        title: '',
        content: '',
        markdownContent: '',
        color: 'yellow',
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        bitacora: []
      };
      setNotes([resetNote]);
      setActiveNoteId(resetNote.id);
      triggerSave([resetNote]);
      return;
    }

    const nextNotes = notes.filter((n) => n.id !== id);
    setNotes(nextNotes);
    if (activeNoteId === id) {
      setActiveNoteId(nextNotes[0].id);
    }
    triggerSave(nextNotes);
  };

  // Toggle pin in list
  const handleTogglePinNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
      triggerSave(next);
      return next;
    });
  };

  // Change color
  const handleChangeColor = (color: NoteColor) => {
    if (activeNote) {
      handleUpdateNote(activeNote.id, { color });
    }
  };

  // Window pin / always on top toggle
  const handleToggleWindowPin = async () => {
    if (window.electronAPI) {
      const state = await window.electronAPI.toggleAlwaysOnTop();
      setIsPinned(state);
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleClose = () => window.electronAPI?.close();

  // Toggle Sidebar
  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);

    if (window.electronAPI?.resizeWindow) {
      if (nextState) {
        window.electronAPI.resizeWindow(730, 600);
      } else {
        window.electronAPI.resizeWindow(440, 560);
      }
    }
  };

  const handleOpenFolder = () => {
    if (window.electronAPI?.openNotesFolder) {
      window.electronAPI.openNotesFolder();
    } else {
      alert('Esta función abre la carpeta de notas locales (.md) en el ejecutable de Windows.');
    }
  };

  const handleCopyMarkdown = () => {
    if (!activeNote) return;
    const md = activeNote.markdownContent || htmlToMarkdown(activeNote.content);
    const textToCopy = `# ${activeNote.title || 'Nota'}\n\n${md}`;
    if (window.electronAPI?.writeClipboard) {
      window.electronAPI.writeClipboard(textToCopy);
    } else {
      navigator.clipboard.writeText(textToCopy);
    }
  };

  const handleCopyForClaude = () => {
    if (!activeNote) return;
    const prompt = formatNoteForClaude(activeNote);
    if (window.electronAPI?.writeClipboard) {
      window.electronAPI.writeClipboard(prompt);
    } else {
      navigator.clipboard.writeText(prompt);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(newSettings);
    } else {
      localStorage.setItem('stickyflow_settings', JSON.stringify(newSettings));
    }
  };

  const handleInsertAiResult = (resultText: string) => {
    if (!activeNote) return;
    const currentMd = activeNote.markdownContent || htmlToMarkdown(activeNote.content || '');
    const prefix = currentMd.trim() ? `${currentMd.trim()}\n\n---\n` : '';
    const updatedMd = prefix + resultText.trim();
    const updatedHtml = markdownToHtml(updatedMd);
    handleUpdateNote(activeNote.id, {
      markdownContent: updatedMd,
      content: updatedHtml,
      updatedAt: new Date().toISOString()
    });
    handleAddBitacoraLog('ia_resumen', 'Contenido de IA insertado al final');
  };

  const handleReplaceAiResult = (resultText: string) => {
    if (!activeNote) return;
    const updatedHtml = markdownToHtml(resultText);
    handleUpdateNote(activeNote.id, {
      markdownContent: resultText,
      content: updatedHtml,
      updatedAt: new Date().toISOString()
    });
    handleAddBitacoraLog('ia_redaccion', 'Contenido reemplazado por IA');
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNewNote();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleAddBitacoraLog('marcador', 'Marca de fecha y hora insertada (F5)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, notes, activeNoteId]);

  const currentColor = activeNote?.color || 'yellow';

  return (
    <div
      className={`h-screen w-screen flex flex-col note-bg-${currentColor} rounded-xl shadow-2xl border border-black/15 dark:border-white/10 overflow-hidden font-sans transition-colors duration-200 select-none`}
      style={{ opacity: settings.opacity || 0.98 }}
    >
      {/* Custom Window Header */}
      <Header
        isPinned={isPinned}
        onTogglePin={handleToggleWindowPin}
        onMinimize={handleMinimize}
        onClose={handleClose}
        onNewNote={handleCreateNewNote}
        currentColor={currentColor}
        onChangeColor={handleChangeColor}
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenBitacoraModal={() => setIsBitacoraModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenMeetingMode={() => setIsMeetingModalOpen(true)}
        onCopyMarkdown={handleCopyMarkdown}
        onCopyForClaude={handleCopyForClaude}
        onOpenFolder={handleOpenFolder}
        onToggleMiniStick={activeNote ? () => handleToggleMiniSticky(activeNote) : undefined}
        isMiniPinned={activeNote ? openMiniStickIds.includes(activeNote.id) : false}
      />

      {/* Main Workspace (Editor + Right Collapsible Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full overflow-hidden flex flex-col">
          {activeNote ? (
            <Editor
              key={activeNote.id}
              note={activeNote}
              settings={settings}
              onChange={handleUpdateNote}
              onAddBitacoraLog={handleAddBitacoraLog}
              onOpenMeetingMode={() => setIsMeetingModalOpen(true)}
              onToggleMiniSticky={handleToggleMiniSticky}
              isMiniPinned={openMiniStickIds.includes(activeNote.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs opacity-50">
              Selecciona o crea una nota
            </div>
          )}
        </main>

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => handleToggleSidebar()}
          notes={notes}
          activeNoteId={activeNote?.id || ''}
          onSelectNote={handleSelectNote}
          onNewNote={handleCreateNewNote}
          onDeleteNote={handleDeleteNote}
          onTogglePinNote={handleTogglePinNote}
          onOpenFolder={handleOpenFolder}
          onToggleMiniSticky={handleToggleMiniSticky}
          openMiniStickIds={openMiniStickIds}
        />
      </div>

      {/* Modals */}
      {activeNote && (
        <>
          <AiModal
            isOpen={isAiModalOpen}
            onClose={() => setIsAiModalOpen(false)}
            note={activeNote}
            allNotes={notes}
            settings={settings}
            onOpenSettings={() => {
              setIsAiModalOpen(false);
              setIsSettingsModalOpen(true);
            }}
            onInsertResult={handleInsertAiResult}
            onReplaceResult={handleReplaceAiResult}
            onCreateNewNoteFromAi={handleCreateNewNoteFromAi}
            onAddBitacoraLog={handleAddBitacoraLog}
          />

          <BitacoraModal
            isOpen={isBitacoraModalOpen}
            onClose={() => setIsBitacoraModalOpen(false)}
            note={activeNote}
            onAddBitacoraEntry={handleAddManualBitacora}
          />

          <MeetingModal
            isOpen={isMeetingModalOpen}
            onClose={() => setIsMeetingModalOpen(false)}
            activeNote={activeNote}
            settings={settings}
            onInsertMeetingNote={handleInsertMeetingNote}
            onAddBitacoraLog={handleAddBitacoraLog}
          />
        </>
      )}

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onOpenNotesFolder={handleOpenFolder}
      />
    </div>
  );
};
