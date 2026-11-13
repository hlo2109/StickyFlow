import React, { useState, useEffect } from 'react';
import { MeetingModal } from './MeetingModal';
import { InterviewPanel } from '../features/interview/InterviewPanel';
import { VoiceNotePanel } from '../features/voicenote/VoiceNotePanel';
import { Note, AppSettings, BitacoraEntry } from '../types';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown';

interface MeetingWindowViewProps {
  noteId?: string;
}

export const MeetingWindowView: React.FC<MeetingWindowViewProps> = ({ noteId }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>(noteId || '');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  type View = 'meeting' | 'interview' | 'voicenote';
  const isView = (v: unknown): v is View => v === 'meeting' || v === 'interview' || v === 'voicenote';
  // La vista inicial viene en la URL (la bandeja del sistema abre directo en Entrevista o Nota de voz).
  const [view, setView] = useState<View>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('view');
    return isView(fromUrl) ? fromUrl : 'meeting';
  });

  useEffect(() => {
    const init = async () => {
      let loadedNotes: Note[] = [];
      let loadedSettings: AppSettings = DEFAULT_SETTINGS;

      if (window.electronAPI) {
        try {
          loadedNotes = await window.electronAPI.loadNotes();
          loadedSettings = await window.electronAPI.loadSettings();
        } catch (e) {
          console.error('Error loading data for meeting window:', e);
        }
      }

      if (loadedNotes && loadedNotes.length > 0) {
        setNotes(loadedNotes);
        const matched = noteId && loadedNotes.find(n => n.id === noteId);
        setActiveNoteId(matched ? matched.id : loadedNotes[0].id);
      }
      if (loadedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      }
      setIsLoaded(true);
    };

    init();

    if (window.electronAPI?.onNotesUpdated) {
      window.electronAPI.onNotesUpdated((updated) => {
        if (Array.isArray(updated)) setNotes(updated);
      });
    }

    if (window.electronAPI?.onMeetingSetView) {
      window.electronAPI.onMeetingSetView((next) => {
        if (isView(next)) setView(next);
      });
    }

    if (window.electronAPI?.onMeetingSetNoteId) {
      window.electronAPI.onMeetingSetNoteId((targetId) => {
        if (targetId) setActiveNoteId(targetId);
      });
    }
  }, [noteId]);

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0] || {
    id: 'default-note',
    title: 'Nota de Reunión',
    content: '',
    markdownContent: '',
    color: 'yellow',
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    bitacora: []
  };

  const handleInsertMeetingNote = async (title: string, markdown: string, asNewNote: boolean) => {
    let updatedNotes: Note[];

    if (asNewNote) {
      const newNote: Note = {
        id: 'note-' + Date.now(),
        title: title || `Minuta de Reunión - ${new Date().toLocaleDateString('es-ES')}`,
        content: markdownToHtml(markdown),
        markdownContent: markdown,
        color: settings.defaultColor || 'yellow',
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['reunion', 'minuta'],
        bitacora: [
          {
            id: 'b-' + Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: 'reunion',
            summary: 'Minuta generada por dictado / grabación'
          }
        ]
      };
      updatedNotes = [newNote, ...notes];
      setActiveNoteId(newNote.id);
    } else {
      const currentMd = activeNote.markdownContent || htmlToMarkdown(activeNote.content || '');
      const prefix = currentMd.trim() ? `${currentMd.trim()}\n\n---\n### 🎙️ Minuta de Reunión\n` : `### 🎙️ Minuta de Reunión\n`;
      const cleanMarkdown = markdown.replace(/^\n\n---\n/, '');
      const updatedMd = prefix + cleanMarkdown;
      const updatedHtml = markdownToHtml(updatedMd);
      const titleUpdate = (!activeNote.title || activeNote.title.trim() === '') && title ? { title } : {};

      updatedNotes = notes.map(n => {
        if (n.id === activeNote.id) {
          return {
            ...n,
            markdownContent: updatedMd,
            content: updatedHtml,
            ...titleUpdate,
            updatedAt: new Date().toISOString()
          };
        }
        return n;
      });
    }

    setNotes(updatedNotes);
    if (window.electronAPI?.saveNotes) {
      await window.electronAPI.saveNotes(updatedNotes);
    }
  };

  const handleAddBitacoraLog = async (action: any, summary: string) => {
    const newEntry: BitacoraEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }),
      action,
      summary
    };

    const updated = notes.map(n => {
      if (n.id === activeNote.id) {
        return {
          ...n,
          bitacora: [...(n.bitacora || []), newEntry],
          updatedAt: new Date().toISOString()
        };
      }
      return n;
    });

    setNotes(updated);
    if (window.electronAPI?.saveNotes) {
      await window.electronAPI.saveNotes(updated);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  if (!isLoaded) {
    return <div className="h-screen w-screen bg-slate-900 text-white flex items-center justify-center text-xs">Iniciando modo reunión...</div>;
  }

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none">
      {view === 'interview' ? (
        <InterviewPanel
          settings={settings}
          notes={notes}
          onBack={() => setView('meeting')}
          onOpenVoiceNote={() => setView('voicenote')}
          onClose={handleClose}
        />
      ) : view === 'voicenote' ? (
        <VoiceNotePanel
          settings={settings}
          onShowMeeting={() => setView('meeting')}
          onShowInterview={() => setView('interview')}
          onClose={handleClose}
        />
      ) : (
        <MeetingModal
          isOpen={true}
          onClose={handleClose}
          activeNote={activeNote}
          notes={notes}
          settings={settings}
          onInsertMeetingNote={handleInsertMeetingNote}
          onAddBitacoraLog={handleAddBitacoraLog}
          onOpenInterview={() => setView('interview')}
          onOpenVoiceNote={() => setView('voicenote')}
        />
      )}
    </div>
  );
};
