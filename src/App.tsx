import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, AppSettings, NoteColor, BitacoraEntry } from './types';
import { Header } from './components/Header';
import { Editor } from './components/Editor';
import { AiModal } from './components/AiModal';
import { BitacoraModal } from './components/BitacoraModal';
import { SettingsModal } from './features/settings/SettingsModal';
import { MeetingModal } from './components/MeetingModal';
import { htmlToMarkdown, markdownToHtml, formatNoteForClaude } from './utils/markdown';
import { ttsService } from './utils/ttsService';
import { DEFAULT_SETTINGS } from './defaultSettings';
import { INITIAL_WELCOME_NOTE } from './features/notes/welcomeNote';
import { isBlankNote, planNewNote } from './features/notes/notesLogic';

const getParamFromUrl = (name: string): string | null => {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has(name)) return searchParams.get(name);

    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    if (hashParams.has(name)) return hashParams.get(name);
  } catch {}
  return null;
};

export const App: React.FC = () => {
  const requestedNoteId = getParamFromUrl('noteId');
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>(requestedNoteId || '');
  const [isPinned, setIsPinned] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isBitacoraModalOpen, setIsBitacoraModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  // Autosave timer ref
  const saveTimeoutRef = useRef<any>(null);
  // ¿La nota de esta ventana se vio ya en el disco? (distingue «la borraron desde otra ventana» de «es nueva y aún no se guardó»)
  const noteSeenOnDisk = useRef(false);
  const notesRef = useRef<Note[]>([]);

  // Active Note - safe lookup
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];
  notesRef.current = notes;

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
        const sanitized = { ...DEFAULT_SETTINGS, ...loadedSettings };
        if (
          !sanitized.hfModel ||
          sanitized.hfModel === 'openai/gpt-oss-120b' ||
          sanitized.hfModel.includes('Mistral-7B-Instruct-v0.3')
        ) {
          sanitized.hfModel = 'Qwen/Qwen2.5-72B-Instruct';
        }
        setSettings(sanitized);
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

        const savedCount = finalNotes.length; // antes de añadir un posible borrador

        // Ventana de UNA nota: o está en el disco, o es una nota NUEVA (borrador en memoria), o ya no existe (se cierra).
        if (requestedNoteId) {
          if (finalNotes.some((n) => n.id === requestedNoteId)) {
            noteSeenOnDisk.current = true;
          } else {
            const draft = await window.electronAPI?.takeNoteDraft?.(requestedNoteId);
            if (draft) {
              finalNotes = [draft, ...finalNotes];
            } else {
              window.electronAPI?.close();
              return;
            }
          }
        }
        const initialId = (requestedNoteId && finalNotes.some((n) => n.id === requestedNoteId))
          ? requestedNoteId
          : finalNotes[0].id;

        setNotes(finalNotes);
        setActiveNoteId(initialId);
        if (savedCount !== loadedNotes.length) {
          triggerSave(finalNotes.filter((n) => !(requestedNoteId && n.id === requestedNoteId && isBlankNote(n))));
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

    if (window.electronAPI?.onNotesUpdated) {
      window.electronAPI.onNotesUpdated((updatedNotes) => {
        if (Array.isArray(updatedNotes) && updatedNotes.length > 0) {
          if (requestedNoteId) {
            const mine = notesRef.current.find((n) => n.id === requestedNoteId);
            if (updatedNotes.some((n) => n.id === requestedNoteId)) {
              noteSeenOnDisk.current = true;
            } else if (noteSeenOnDisk.current && mine && !isBlankNote(mine)) {
              window.electronAPI?.close(); // la nota de esta ventana se eliminó desde la lista
              return;
            } else if (mine) {
              // Nota nueva que todavía no está en el disco: se conserva (si no, esta ventana la perdería)
              setNotes([mine, ...updatedNotes]);
              return;
            }
          }
          setNotes(updatedNotes);
        }
      });
    }
  }, []);

  // Track floating mini sticky notes and docked notebook tabs
  const [openMiniStickIds, setOpenMiniStickIds] = useState<string[]>([]);
  const [dockedNoteIds, setDockedNoteIds] = useState<string[]>([]);

  useEffect(() => {
    if (window.electronAPI?.getOpenMiniStickies) {
      window.electronAPI.getOpenMiniStickies().then((ids) => {
        if (Array.isArray(ids)) setOpenMiniStickIds(ids);
      });
    }

    if (window.electronAPI?.getDockedNotes) {
      window.electronAPI.getDockedNotes().then((ids) => {
        if (Array.isArray(ids)) setDockedNoteIds(ids);
      });
    }

    if (window.electronAPI?.onDockedIdsChanged) {
      window.electronAPI.onDockedIdsChanged((ids) => {
        setDockedNoteIds(ids);
      });
    }

    if (window.electronAPI?.onMiniStickyStatusChanged) {
      window.electronAPI.onMiniStickyStatusChanged(({ noteId, isOpen }) => {
        setOpenMiniStickIds((prev) =>
          isOpen ? Array.from(new Set([...prev, noteId])) : prev.filter((id) => id !== noteId)
        );
      });
    }

  }, []);

  const handleToggleMiniSticky = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.electronAPI?.toggleDockPin) {
      const updated = await window.electronAPI.toggleDockPin(note.id);
      setDockedNoteIds(updated);
    } else if (window.electronAPI?.toggleMiniSticky) {
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

  /** Guarda YA la lista (sin esperar al guardado diferido) y abre esa nota en su propia ventana. */
  const saveAndOpenInWindow = async (nextNotes: Note[], noteId: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setNotes(nextNotes);
    if (window.electronAPI) {
      await window.electronAPI.saveNotes(nextNotes); // antes de abrir, para que la ventana nueva la encuentre
      window.electronAPI.openNoteWindow?.(noteId);
    } else {
      localStorage.setItem('stickyflow_notes', JSON.stringify(nextNotes));
      setActiveNoteId(noteId);
    }
  };

  // Nueva nota: se abre en su propia ventana (si ya hay una en blanco, se reutiliza)
  const handleCreateNewNote = () => {
    const plan = planNewNote(notes, settings);
    if (!plan.created) {
      if (window.electronAPI?.openNoteWindow) window.electronAPI.openNoteWindow(plan.note.id);
      else setActiveNoteId(plan.note.id);
      return;
    }
    // Nota nueva (en blanco): va a su ventana como borrador y se guarda cuando se escriba algo.
    if (window.electronAPI?.openNoteDraft) {
      void window.electronAPI.openNoteDraft(plan.note);
    } else {
      void saveAndOpenInWindow(plan.notes, plan.note.id);
    }
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

    void saveAndOpenInWindow([newNote, ...notes], newNote.id);
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

  // La lista de notas es su propia ventana (la principal): se abre o se trae al frente
  const handleOpenNotesList = () => {
    window.electronAPI?.openNotesList?.();
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
        handleOpenNotesList();
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
  }, [notes, activeNoteId]);

  const handleOpenInNewWindow = (noteId?: string) => {
    const targetId = noteId || activeNote?.id;
    if (targetId && window.electronAPI?.openNoteWindow) {
      window.electronAPI.openNoteWindow(targetId);
    }
  };

  const handleReadCurrentNote = () => {
    if (!activeNote) return;
    const textToRead = activeNote.markdownContent || htmlToMarkdown(activeNote.content || '');
    ttsService.speak(textToRead, {
      title: activeNote.title,
      voiceURI: settings.ttsVoice || 'es-MX-DaliaNeural',
      rate: settings.ttsRate || 1.0,
      pitch: settings.ttsPitch || 1.0,
      volume: settings.ttsVolume || 1.0,
      useNeuralTts: settings.useNeuralTts !== false
    });
  };

  const handleOpenSettingsAction = () => {
    if (window.electronAPI?.openSettingsWindow) {
      window.electronAPI.openSettingsWindow();
    } else {
      setIsSettingsModalOpen(true);
    }
  };

  const handleOpenMeetingAction = () => {
    if (window.electronAPI?.openMeetingWindow) {
      window.electronAPI.openMeetingWindow(activeNote?.id);
    } else {
      setIsMeetingModalOpen(true);
    }
  };

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
        onOpenNotesList={handleOpenNotesList}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenBitacoraModal={() => setIsBitacoraModalOpen(true)}
        onOpenSettings={handleOpenSettingsAction}
        onOpenMeetingMode={handleOpenMeetingAction}
        onCopyMarkdown={handleCopyMarkdown}
        onCopyForClaude={handleCopyForClaude}
        onOpenFolder={handleOpenFolder}
        onToggleMiniStick={activeNote ? () => handleToggleMiniSticky(activeNote) : undefined}
        isMiniPinned={activeNote ? (dockedNoteIds.includes(activeNote.id) || openMiniStickIds.includes(activeNote.id)) : false}
        onOpenInNewWindow={() => handleOpenInNewWindow(activeNote?.id)}
        onReadNote={handleReadCurrentNote}
      />

      {/* Espacio de trabajo: el editor de esta nota */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full overflow-hidden flex flex-col">
          {activeNote ? (
            <Editor
              key={activeNote.id}
              note={activeNote}
              settings={settings}
              onChange={handleUpdateNote}
              onAddBitacoraLog={handleAddBitacoraLog}
              onOpenMeetingMode={handleOpenMeetingAction}
              onToggleMiniSticky={handleToggleMiniSticky}
              isMiniPinned={dockedNoteIds.includes(activeNote.id) || openMiniStickIds.includes(activeNote.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs opacity-50">
              Selecciona o crea una nota
            </div>
          )}
        </main>
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
            onOpenSettings={handleOpenSettingsAction}
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
