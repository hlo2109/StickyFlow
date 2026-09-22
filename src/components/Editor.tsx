import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Calendar,
  CodeXml,
  Mic,
  Headphones,
  Square,
  Loader2,
  Check,
  Pin
} from 'lucide-react';
import { Note, AppSettings } from '../types';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown';
import { audioRecorder, transcribeAudio, getAudioDevices, AudioDeviceInfo } from '../utils/audioService';

interface EditorProps {
  note: Note;
  settings: AppSettings;
  onChange: (noteId: string, updatedNote: Partial<Note>) => void;
  onAddBitacoraLog: (action: any, summary: string) => void;
  onOpenMeetingMode?: () => void;
  onToggleMiniSticky?: (note: Note) => void;
  isMiniPinned?: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  note,
  settings,
  onChange,
  onAddBitacoraLog,
  onOpenMeetingMode,
  onToggleMiniSticky,
  isMiniPinned
}) => {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [rawMarkdown, setRawMarkdown] = useState(note.markdownContent || '');

  // Dictation States
  const [isRecordingDictation, setIsRecordingDictation] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const [dictationMessage, setDictationMessage] = useState('');
  const [inputDevices, setInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [showMicPicker, setShowMicPicker] = useState(false);

  // Flag to prevent onUpdate from triggering during note transitions
  const isSwitchingRef = useRef(false);
  const currentNoteIdRef = useRef(note.id);
  currentNoteIdRef.current = note.id;

  // Load audio input devices on mount
  useEffect(() => {
    getAudioDevices().then(({ inputs }) => {
      setInputDevices(inputs);
      if (inputs.length > 0 && !selectedMicId) {
        setSelectedMicId(inputs[0].id);
      }
    });
  }, []);

  // Timer for dictation
  useEffect(() => {
    let interval: any = null;
    if (isRecordingDictation) {
      interval = setInterval(() => {
        setDictationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setDictationSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingDictation]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({
        placeholder: 'Escribe tu nota aquí... (admite markdown, tareas, dictado por voz y pegar imágenes)',
      }),
    ],
    content: note.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none p-3 min-h-[220px]',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64 = e.target?.result as string;
                if (base64) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src: base64 })
                    )
                  );
                }
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (isSwitchingRef.current) return;

      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      onChange(currentNoteIdRef.current, {
        content: html,
        markdownContent: md,
        updatedAt: new Date().toISOString()
      });
    },
  });

  // Keep editor content strictly in sync when active note changes OR external content updates (AI, meetings)
  useEffect(() => {
    const targetMd = note.markdownContent || htmlToMarkdown(note.content || '');
    if (targetMd !== rawMarkdown) {
      setRawMarkdown(targetMd);
    }

    if (editor) {
      const currentHtml = editor.getHTML();
      const normCurrent = (currentHtml === '<p></p>' || currentHtml === '') ? '' : currentHtml.trim();
      const normNote = (note.content === '<p></p>' || note.content === '') ? '' : (note.content || '').trim();

      if (normNote !== normCurrent) {
        isSwitchingRef.current = true;
        editor.commands.setContent(note.content || '', false);
        const timer = setTimeout(() => {
          isSwitchingRef.current = false;
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [note.id, note.content, note.markdownContent, note.updatedAt]);

  // When switching between different notes, cancel active dictation
  useEffect(() => {
    if (isRecordingDictation) {
      audioRecorder.stop();
      setIsRecordingDictation(false);
    }
  }, [note.id]);

  // Insert current timestamp (bitácora marker) into note
  const insertTimestampMarker = () => {
    const now = new Date();
    const formatted = `📅 [${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] - `;
    
    if (isMarkdownMode) {
      const newMd = rawMarkdown + '\n' + formatted;
      setRawMarkdown(newMd);
      onChange(note.id, {
        markdownContent: newMd,
        content: markdownToHtml(newMd),
        updatedAt: new Date().toISOString()
      });
    } else if (editor) {
      editor.chain().focus().insertContent(formatted).run();
    }

    onAddBitacoraLog('marcador', 'Marca temporal insertada');
  };

  // Start Voice Dictation Recording
  const handleStartDictation = async () => {
    setDictationMessage('');
    const res = await audioRecorder.start(selectedMicId);
    if (res.success) {
      setIsRecordingDictation(true);
      onAddBitacoraLog('dictado', 'Dictado de voz iniciado');
    } else {
      alert(`No se pudo iniciar el dictado: ${res.error || 'Verifica permisos del micrófono'}`);
    }
  };

  // Stop Dictation & Transcribe with Whisper
  const handleStopAndTranscribe = async () => {
    setIsTranscribing(true);
    setDictationMessage('Transcribiendo audio...');
    const audioBlob = await audioRecorder.stop();
    setIsRecordingDictation(false);

    if (audioBlob && audioBlob.size > 0) {
      const transRes = await transcribeAudio(audioBlob, settings);
      setIsTranscribing(false);
      setDictationMessage('');

      if (transRes.success && transRes.text) {
        const textToInsert = ' ' + transRes.text.trim();
        if (isMarkdownMode) {
          const updatedMd = rawMarkdown + textToInsert;
          setRawMarkdown(updatedMd);
          onChange(note.id, {
            markdownContent: updatedMd,
            content: markdownToHtml(updatedMd),
            updatedAt: new Date().toISOString()
          });
        } else if (editor) {
          editor.chain().focus().insertContent(textToInsert).run();
        }
      } else {
        alert(transRes.error || 'No se pudo transcribir el audio. Ingresa tu API Key de Hugging Face en Ajustes para activar Whisper.');
      }
    } else {
      setIsTranscribing(false);
      setDictationMessage('');
    }
  };

  // Cancel Dictation
  const handleCancelDictation = async () => {
    await audioRecorder.stop();
    setIsRecordingDictation(false);
    setIsTranscribing(false);
    setDictationMessage('');
  };

  // Toggle Markdown source mode vs WYSIWYG
  const toggleMarkdownMode = () => {
    if (isMarkdownMode) {
      const html = markdownToHtml(rawMarkdown);
      if (editor) {
        editor.commands.setContent(html);
      }
      onChange(note.id, {
        content: html,
        markdownContent: rawMarkdown,
        updatedAt: new Date().toISOString()
      });
      setIsMarkdownMode(false);
    } else {
      if (editor) {
        const md = htmlToMarkdown(editor.getHTML());
        setRawMarkdown(md);
      }
      setIsMarkdownMode(true);
    }
  };

  const handleRawMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawMarkdown(val);
    const html = markdownToHtml(val);
    onChange(note.id, {
      markdownContent: val,
      content: html,
      updatedAt: new Date().toISOString()
    });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(note.id, {
      title: e.target.value,
      updatedAt: new Date().toISOString()
    });
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 pt-2 pb-1 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
        <input
          type="text"
          value={note.title || ''}
          onChange={handleTitleChange}
          placeholder="Título de la nota..."
          className="w-full bg-transparent font-semibold text-base sm:text-lg focus:outline-none placeholder-current/40"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-[11px] opacity-50 whitespace-nowrap">
            {new Date(note.updatedAt || note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {onToggleMiniSticky && (
            <button
              onClick={() => onToggleMiniSticky(note)}
              title={isMiniPinned ? 'Cerrar mini stick flotante de pantalla' : 'Anclar como mini stick flotante en pantalla'}
              className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 transition-all ${
                isMiniPinned
                  ? 'bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold ring-1 ring-amber-500/50 shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Pin size={12} className={isMiniPinned ? 'fill-current' : ''} />
              <span className="text-[10px] hidden sm:inline">{isMiniPinned ? 'En Pantalla' : 'Anclar Stick'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Action / Formatting Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 text-xs">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {!isMarkdownMode && editor && (
            <>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('bold') ? 'bg-black/15 font-bold' : ''}`}
                title="Negrita (Ctrl + B)"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('italic') ? 'bg-black/15 italic' : ''}`}
                title="Cursiva (Ctrl + I)"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('strike') ? 'bg-black/15' : ''}`}
                title="Tachado"
              >
                <Strikethrough size={14} />
              </button>
              <div className="w-[1px] h-3.5 bg-black/15 dark:bg-white/15 mx-1" />
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('heading', { level: 1 }) ? 'bg-black/15 font-bold' : ''}`}
                title="Título H1"
              >
                <Heading1 size={14} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('heading', { level: 2 }) ? 'bg-black/15 font-bold' : ''}`}
                title="Título H2"
              >
                <Heading2 size={14} />
              </button>
              <div className="w-[1px] h-3.5 bg-black/15 dark:bg-white/15 mx-1" />
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('bulletList') ? 'bg-black/15' : ''}`}
                title="Lista con viñetas"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('taskList') ? 'bg-black/15' : ''}`}
                title="Lista de tareas con casillas"
              >
                <CheckSquare size={14} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 ${editor.isActive('codeBlock') ? 'bg-black/15' : ''}`}
                title="Bloque de código"
              >
                <Code size={14} />
              </button>
            </>
          )}

          {/* Insert Bitácora Marker */}
          <button
            type="button"
            onClick={insertTimestampMarker}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 flex items-center gap-1 font-medium text-[11px]"
            title="Insertar marca de tiempo para bitácora (F5)"
          >
            <Calendar size={13} />
            <span className="hidden xs:inline">Fecha</span>
          </button>

          {/* Microphone Dictation Button */}
          {!isRecordingDictation ? (
            <button
              type="button"
              onClick={handleStartDictation}
              disabled={isTranscribing}
              className="p-1 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/15 flex items-center gap-1 font-medium text-[11px] transition-all"
              title="Iniciar dictado por voz (Micrófono)"
            >
              <Mic size={13} className="text-red-500" />
              <span>Dictar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopAndTranscribe}
              className="p-1 px-2 rounded bg-red-600 text-white flex items-center gap-1 font-bold text-[11px] animate-pulse shadow-sm"
              title="Finalizar y transcribir audio"
            >
              <Square size={12} />
              <span>Listo ({formatTimer(dictationSeconds)})</span>
            </button>
          )}

          {/* Meeting Mode / System Audio Button */}
          {onOpenMeetingMode && (
            <button
              type="button"
              onClick={onOpenMeetingMode}
              className="p-1 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/15 flex items-center gap-1 font-medium text-[11px] text-purple-700 dark:text-purple-300"
              title="Tomar nota de reunión (Audio del sistema + Micrófono)"
            >
              <Headphones size={13} />
              <span className="hidden sm:inline">Reunión</span>
            </button>
          )}
        </div>

        {/* Toggle Mode: WYSIWYG vs Raw Markdown */}
        <button
          type="button"
          onClick={toggleMarkdownMode}
          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
            isMarkdownMode ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-black/10 dark:hover:bg-white/15 opacity-80'
          }`}
          title={isMarkdownMode ? 'Cambiar a editor visual enriquecido' : 'Ver y editar código fuente Markdown (.md)'}
        >
          <CodeXml size={13} />
          <span>{isMarkdownMode ? 'MD Raw' : 'Visual'}</span>
        </button>
      </div>

      {/* Real-time Dictation Active Floating Bar */}
      {isRecordingDictation && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/60 border-b border-red-300 dark:border-red-900 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span className="font-semibold text-red-700 dark:text-red-300">
              🎙️ Grabando audio ({formatTimer(dictationSeconds)}) - Habla con claridad...
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStopAndTranscribe}
              className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] flex items-center gap-1 shadow-xs"
            >
              <Check size={12} />
              <span>Transcribir</span>
            </button>
            <button
              onClick={handleCancelDictation}
              className="px-2 py-0.5 rounded hover:bg-red-200 dark:hover:bg-red-900 text-red-600 text-[11px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Transcribing loader banner */}
      {isTranscribing && (
        <div className="px-3 py-1 bg-purple-50 dark:bg-purple-950/60 border-b border-purple-300 dark:border-purple-900 flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 animate-pulse">
          <Loader2 size={14} className="animate-spin" />
          <span>Transcribiendo voz con Whisper e insertando en la nota...</span>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto relative">
        {isMarkdownMode ? (
          <textarea
            value={rawMarkdown}
            onChange={handleRawMarkdownChange}
            placeholder="# Escribe contenido en Markdown directamente..."
            className="w-full h-full p-3 bg-transparent font-mono text-sm resize-none focus:outline-none leading-relaxed"
          />
        ) : (
          <EditorContent editor={editor} className="h-full" />
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-3 py-1 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[11px] opacity-60">
        <span>
          {note.markdownContent ? `${note.markdownContent.trim().split(/\s+/).filter(Boolean).length} palabras` : '0 palabras'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          Sincronizado
        </span>
      </div>
    </div>
  );
};
