import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minus,
  Pin,
  PinOff,
  Headphones,
  Square,
  Play,
  Sparkles,
  Loader2,
  FileText,
  PlusCircle,
  Copy,
  Check,
  Volume2,
  Sliders,
  AlertCircle,
  Plus,
  CheckSquare,
  Mic,
  Pencil
} from 'lucide-react';
import { Note, AppSettings, MeetingDoubt } from '../types';
import { getAudioDevices, AudioDeviceInfo } from '../utils/audioService';
import { meetingCapture, MeetingSegment } from '../features/meeting/capture/meetingCapture';
import { transcribeAudio } from '../features/meeting/stt/whisper';
import { executeAiTask, analyzeMeetingDoubtRadar } from '../features/ai';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { ViewNav } from '../features/meeting/ui/ViewNav';
import { ConversationFeed } from '../features/meeting/ui/ConversationFeed';
import { DoubtsRadar } from '../features/meeting/ui/DoubtsRadar';
import { normalizeMeetingTranscript } from '../features/analysis/analyze';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNote: Note;
  /** Todas las notas del usuario (pueden usarse como contexto del Asistente) */
  notes?: Note[];
  settings: AppSettings;
  onInsertMeetingNote: (title: string, markdown: string, asNewNote: boolean) => void;
  onAddBitacoraLog: (action: any, summary: string) => void;
  /** Si se pasa, se muestra un botón para cambiar al modo Entrevista (traducción en vivo) */
  onOpenInterview?: () => void;
  /** Si se pasa, se muestra un botón para cambiar a «Nota de voz» */
  onOpenVoiceNote?: () => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  activeNote,
  notes = [],
  settings,
  onInsertMeetingNote,
  onAddBitacoraLog,
  onOpenInterview,
  onOpenVoiceNote
}) => {
  const [isPinned, setIsPinned] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  // Real-time Chunk & Radar States
  const [isChunkTranscribing, setIsChunkTranscribing] = useState(false);
  const [isRadarScanning, setIsRadarScanning] = useState(false);
  const [radarNotification, setRadarNotification] = useState<string | null>(null);
  const [doubts, setDoubts] = useState<MeetingDoubt[]>([]);
  const [newManualDoubt, setNewManualDoubt] = useState('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Doubts ref to avoid stale closure during async chunk callbacks
  const doubtsRef = useRef<MeetingDoubt[]>([]);
  doubtsRef.current = doubts;

  const isRecordingRef = useRef(false);
  const [recordingMode, setRecordingMode] = useState<'live' | 'normal'>('live');
  const recordingModeRef = useRef<'live' | 'normal'>('live');
  recordingModeRef.current = recordingMode;

  // Queue references to process chunks sequentially
  const sliceQueueRef = useRef<MeetingSegment[]>([]);
  const isProcessingQueueRef = useRef(false);
  const transcriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Device Selection
  const [inputDevices, setInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');

  // Expand window when opening Meeting Modal so it has full, spacious room (only if in main note window)
  const isStandaloneWindow = typeof window !== 'undefined' && (
    window.location.search.includes('mode=meeting') ||
    window.location.hash.includes('mode=meeting')
  );

  useEffect(() => {
    if (isOpen) {
      if (window.electronAPI?.getAlwaysOnTop) {
        window.electronAPI.getAlwaysOnTop().then((val) => setIsPinned(Boolean(val)));
      }
      if (window.electronAPI?.onAlwaysOnTopChanged) {
        window.electronAPI.onAlwaysOnTopChanged((val) => setIsPinned(Boolean(val)));
      }
      if (!isStandaloneWindow && window.electronAPI?.resizeWindow) {
        window.electronAPI.resizeWindow(880, 660);
      }
      getAudioDevices().then(({ inputs, outputs }) => {
        setInputDevices(inputs);
        setOutputDevices(outputs);
        if (inputs.length > 0 && !selectedMicId) {
          setSelectedMicId(inputs[0].id);
        }
        if (outputs.length > 0 && !selectedOutputId) {
          setSelectedOutputId(outputs[0].id);
        }
      });
    }
  }, [isOpen, isStandaloneWindow]);

  const handleTogglePin = async () => {
    if (window.electronAPI?.toggleAlwaysOnTop) {
      const nextVal = await window.electronAPI.toggleAlwaysOnTop();
      setIsPinned(Boolean(nextVal));
    } else {
      setIsPinned(!isPinned);
    }
  };

  // Clean close handler that restores window dimensions
  const handleCloseModal = () => {
    if (isRecording) {
      handleStopMeeting();
    }
    if (!isStandaloneWindow && window.electronAPI?.resizeWindow) {
      window.electronAPI.resizeWindow(490, 560);
    }
    onClose();
  };

  // Timer for active recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Flash notification timer
  useEffect(() => {
    if (radarNotification) {
      const t = setTimeout(() => setRadarNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [radarNotification]);

  // Auto-scroll transcript textarea to bottom on new text
  useEffect(() => {
    if (transcriptTextareaRef.current) {
      transcriptTextareaRef.current.scrollTop = transcriptTextareaRef.current.scrollHeight;
    }
  }, [transcriptText]);

  // Vista de edición manual del texto, y «Conectando…» mientras Windows abre el audio.
  const [editTranscript, setEditTranscript] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // «Iniciar» instantáneo: Windows tarda ~1 s en abrir el audio del sistema, así que se deja listo al abrir la
  // pantalla (y al cambiar de micrófono o terminar una grabación). Se libera al cerrar.
  useEffect(() => {
    if (!isOpen || isRecording || isStarting) return;
    void meetingCapture.prepare({ micDeviceId: selectedMicId || undefined });
  }, [isOpen, isRecording, isStarting, selectedMicId]);

  useEffect(() => () => meetingCapture.release(), []);

  /** La conversación para el análisis: «[Tú]» pasa a «Yo:», y se añaden tus notas. */
  const getAnalysisTranscript = () =>
    normalizeMeetingTranscript(transcriptText) + (manualNotes.trim() ? `\n\nNotas escritas por mí durante la reunión:\n${manualNotes.trim()}` : '');

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Tú hablas en el idioma de los ajustes; la otra parte se detecta sola (puede ser otro idioma).
  const transcribeSegment = (seg: MeetingSegment) =>
    transcribeAudio(seg.blob, settings, { language: seg.source === 'system' ? 'auto' : settings.speechLang });

  const speakerLabel = (seg: MeetingSegment) => (seg.source === 'mic' ? 'Tú' : 'Participante');

  const appendTranscript = (prev: string, seg: MeetingSegment, text: string) => {
    const sep = prev.trim() ? '\n' : '';
    return `${prev.trim()}${sep}[${speakerLabel(seg)}] ${text}`;
  };

  // Process a newly recorded audio slice in real time
  const processSliceQueue = async () => {
    if (isProcessingQueueRef.current || sliceQueueRef.current.length === 0) return;
    isProcessingQueueRef.current = true;

    while (sliceQueueRef.current.length > 0) {
      const segment = sliceQueueRef.current.shift();
      if (!segment || segment.blob.size < 800) continue;

      setIsChunkTranscribing(true);
      setStatusMessage('Transcribiendo segmento en tiempo real...');

      try {
        const transRes = await transcribeSegment(segment);
        if (transRes.success && transRes.text && transRes.text.trim()) {
          const sliceText = transRes.text.trim();
          setErrorMessage('');

          // 1. Append smoothly to live transcript
          setTranscriptText(prev => {
            const sep = prev.trim() ? '\n' : '';
            return `${prev.trim()}${sep}${sliceText}`;
          });

          setStatusMessage('Segmento transcrito ✓ Analizando radar de dudas...');

          // 2. Evaluate with Radar de Dudas
          setIsRadarScanning(true);
          const currentDoubtsSnapshot = doubtsRef.current;
          const radarRes = await analyzeMeetingDoubtRadar(sliceText, currentDoubtsSnapshot, settings);
          setIsRadarScanning(false);

          if (radarRes.hasChanges) {
            setDoubts(radarRes.updatedDoubts);

            const newlyResolved = radarRes.updatedDoubts.filter(
              d => d.status === 'resolved' && currentDoubtsSnapshot.some(od => od.id === d.id && od.status === 'open')
            );
            const newlyCreated = radarRes.updatedDoubts.filter(
              d => !currentDoubtsSnapshot.some(od => od.id === d.id)
            );

            if (newlyResolved.length > 0) {
              setRadarNotification(`🟢 Duda respondida y tachada: "${newlyResolved[0].question.substring(0, 50)}..."`);
            } else if (newlyCreated.length > 0) {
              setRadarNotification(`💡 Nueva duda detectada: "${newlyCreated[0].question.substring(0, 50)}..."`);
            }
          }
        } else if (!transRes.success && transRes.error) {
          console.warn('Transcription error:', transRes.error);
          setErrorMessage(transRes.error);
        }
      } catch (err: any) {
        console.warn('Error in handleAudioSlice:', err);
      } finally {
        setIsChunkTranscribing(false);
        if (isRecordingRef.current) {
          setStatusMessage('🎧 Escuchando en vivo...');
        } else {
          setStatusMessage('Grabación finalizada. Minuta lista para generar.');
        }
      }
    }

    isProcessingQueueRef.current = false;
  };

  const handleAudioSlice = (segment: MeetingSegment) => {
    if (!segment || segment.blob.size < 800) return;
    sliceQueueRef.current.push(segment);
    processSliceQueue();
  };

  // Start Meeting Audio Recording in either 'live' mode (real-time Doubt Radar) or 'normal' mode (full meeting)
  const handleStartMeeting = async (mode: 'live' | 'normal' = 'live') => {
    setErrorMessage('');
    setRecordingMode(mode);
    setStatusMessage(
      mode === 'live'
        ? 'Conectando loopback de Windows y micrófono (Modo En Vivo)...'
        : 'Conectando loopback de Windows y micrófono (Modo Normal)...'
    );

    const onChunkCallback = mode === 'live' ? handleAudioSlice : undefined;
    setIsStarting(true);
    const res = await meetingCapture.startCapture({ micDeviceId: selectedMicId, onSegment: onChunkCallback });
    setIsStarting(false);
    if (!res.success) {
      setErrorMessage(res.error || 'No se pudo iniciar la captura de audio.');
      setStatusMessage('');
      return;
    }

    setIsRecording(true);
    isRecordingRef.current = true;
    if (mode === 'live') {
      setStatusMessage('🎧 Escuchando en vivo (Radar activo)...');
      onAddBitacoraLog('reunion', 'Grabación de reunión en tiempo real con Radar iniciada');
    } else {
      setStatusMessage('🎙️ Grabación normal activa. Capturando reunión...');
      onAddBitacoraLog('reunion', 'Grabación de reunión en modo normal iniciada');
    }
  };

  // Stop Recording
  const handleStopMeeting = async () => {
    const currentMode = recordingModeRef.current;
    setIsRecording(false);
    isRecordingRef.current = false;

    if (currentMode === 'live') {
      setStatusMessage('Finalizando y procesando último segmento...');
      try {
        // stop() entrega por onSegment la última frase pendiente.
        await meetingCapture.stop();
      } catch (e) {
        console.warn('Error stopping capture:', e);
      }
      setStatusMessage('⏹️ Grabación finalizada. Minuta lista para generar.');
    } else {
      // Normal mode: Stop and transcribe all recorded audio
      setStatusMessage('⏹️ Grabación detenida. Procesando audio y transcribiendo...');
      setIsChunkTranscribing(true);

      try {
        await meetingCapture.stop();
        const segments = meetingCapture.getSegments();

        if (segments.length > 0) {
          let accumulatedText = transcriptText;
          for (let i = 0; i < segments.length; i++) {
            setStatusMessage(`🎙️ Transcribiendo audio (${i + 1}/${segments.length})...`);
            const transRes = await transcribeSegment(segments[i]);
            if (transRes.success && transRes.text && transRes.text.trim()) {
              accumulatedText = appendTranscript(accumulatedText, segments[i], transRes.text.trim());
              setTranscriptText(accumulatedText);
            } else if (!transRes.success && transRes.error) {
              setErrorMessage(transRes.error);
            }
          }
          setStatusMessage('✓ Transcripción completada. Minuta lista para generar.');
        } else {
          setStatusMessage('⏹️ Grabación finalizada (no se detectó voz).');
        }
      } catch (e: any) {
        console.warn('Error processing normal recording:', e);
        setErrorMessage(e.message || 'Error al transcribir la grabación.');
      } finally {
        setIsChunkTranscribing(false);
      }
    }
  };

  // Add Manual Doubt
  const handleAddManualDoubt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newManualDoubt.trim();
    if (!text) return;

    const newDoubt: MeetingDoubt = {
      id: 'd-man-' + Date.now(),
      question: text,
      status: 'open',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDoubts(prev => [newDoubt, ...prev]);
    setNewManualDoubt('');
    setRadarNotification('➕ Pregunta agregada al radar');
  };

  // Toggle Doubt status between open and resolved
  const handleToggleDoubt = (id: string) => {
    setDoubts(prev =>
      prev.map(d => {
        if (d.id === id) {
          const nextStatus = d.status === 'open' ? 'resolved' : 'open';
          return {
            ...d,
            status: nextStatus,
            resolvedAnswer: nextStatus === 'resolved' ? (d.resolvedAnswer || 'Aclarado manualmente por el usuario') : undefined,
            resolvedAt: nextStatus === 'resolved' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
          };
        }
        return d;
      })
    );
  };

  // Delete Doubt
  const handleDeleteDoubt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDoubts(prev => prev.filter(d => d.id !== id));
  };

  // Copy Question to Clipboard (for pasting into meeting chat)
  const handleCopyQuestion = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI?.writeClipboard) {
      window.electronAPI.writeClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedQuestionId(id);
    setTimeout(() => setCopiedQuestionId(null), 1800);
  };

  // Generate Executive Minutes
  const handleGenerateSummary = async () => {
    if (isRecording) {
      await handleStopMeeting();
    }

    setIsAnalyzing(true);
    setStatusMessage('🤖 Generando minuta ejecutiva con IA...');
    setErrorMessage('');
    setMeetingSummary('');

    // Format doubts for the prompt
    const openDoubtsList = doubts.filter(d => d.status === 'open');
    const resolvedDoubtsList = doubts.filter(d => d.status === 'resolved');

    const doubtsSection = [
      resolvedDoubtsList.length > 0
        ? `### Dudas y Preguntas Aclaradas Durante la Reunión:\n${resolvedDoubtsList.map(d => `- [x] ~~${d.question}~~ (Aclarado: ${d.resolvedAnswer || 'Sí'})`).join('\n')}`
        : '',
      openDoubtsList.length > 0
        ? `### Preguntas Pendientes / Cabos Sueltos No Resueltos:\n${openDoubtsList.map(d => `- [ ] ${d.question}`).join('\n')}`
        : ''
    ].filter(Boolean).join('\n\n');

    const combinedConversation = [
      transcriptText ? `### Transcripción de la Conversación:\n${transcriptText}` : '',
      manualNotes ? `### Notas y Acuerdos Anotados por el Usuario:\n${manualNotes}` : '',
      doubtsSection ? `### Radar de Preguntas y Dudas:\n${doubtsSection}` : ''
    ].filter(Boolean).join('\n\n---\n\n');

    if (!combinedConversation.trim()) {
      setIsAnalyzing(false);
      setStatusMessage('⏹️ Grabación finalizada. Minuta lista para generar.');
      setErrorMessage('No hay transcripción ni notas para generar la minuta.');
      return;
    }

    try {
      const res = await executeAiTask({
        action: 'meeting_summary',
        content: combinedConversation,
        settings
      });

      setIsAnalyzing(false);

      if (res.success && res.result) {
        setMeetingSummary(res.result);
        const titleMatch = res.result.match(/^#\s+(.+)$/m);
        setSuggestedTitle(titleMatch ? titleMatch[1].trim() : `Minuta de Reunión - ${new Date().toLocaleDateString('es-ES')}`);
        setStatusMessage('✨ Minuta ejecutiva generada con éxito.');
        onAddBitacoraLog('ia_resumen', 'Minuta de reunión generada con IA y radar de dudas');
      } else {
        setErrorMessage(res.error || 'Error al generar la minuta con la IA.');
        setStatusMessage('Error al generar la minuta. Revisa el mensaje arriba.');
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMessage(err.message || 'Error inesperado al contactar con el modelo de IA.');
      setStatusMessage('Error al contactar con la IA.');
    }
  };

  const handleCopySummary = () => {
    if (meetingSummary) {
      if (window.electronAPI?.writeClipboard) {
        window.electronAPI.writeClipboard(meetingSummary);
      } else {
        navigator.clipboard.writeText(meetingSummary);
      }
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const openDoubts = doubts.filter(d => d.status === 'open');
  const resolvedDoubts = doubts.filter(d => d.status === 'resolved');

  // Dynamically compute clean, non-conflicting status message
  const getDisplayStatus = () => {
    if (isAnalyzing) {
      return '🤖 Sintetizando minuta ejecutiva con IA... Analizando acuerdos y tareas.';
    }
    if (isRecording) {
      if (recordingMode === 'live') {
        if (isChunkTranscribing) return '🎙️ Transcribiendo audio en vivo...';
        if (isRadarScanning) return '🔍 Evaluando radar de dudas en vivo...';
        return statusMessage || '🎧 Escuchando en vivo (Radar activo)...';
      } else {
        return statusMessage || '🎙️ Grabando reunión en modo normal (audio del sistema y micrófono)...';
      }
    }
    // When NOT recording:
    if (isChunkTranscribing) {
      return '🎙️ Procesando y transcribiendo audio...';
    }
    if (isRadarScanning) {
      return '🔍 Evaluando dudas finales...';
    }
    if (statusMessage && !statusMessage.toLowerCase().includes('escuchando')) {
      return statusMessage;
    }
    if (transcriptText || manualNotes || doubts.length > 0) {
      return '⏹️ Grabación finalizada. Minuta lista para generar.';
    }
    return 'Listo para iniciar la reunión.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col w-full h-full overflow-hidden select-none animate-in fade-in">
      {/* Cabecera */}
      <header className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0 window-drag-region cursor-move">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-indigo-600/30 text-indigo-400 rounded-lg shrink-0">
            <Headphones size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Reunión</span>
              {isRecording ? (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {recordingMode === 'live' ? 'EN VIVO' : 'GRABANDO'} {formatTimer(elapsedSeconds)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">Lista</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight truncate">Transcripción en vivo, radar de dudas y análisis con tu contexto</p>
          </div>
        </div>

        {(onOpenInterview || onOpenVoiceNote) && (
          <ViewNav
            current="meeting"
            onNavigate={(view) => {
              if (isRecording) handleStopMeeting();
              if (view === 'interview') onOpenInterview?.();
              if (view === 'voicenote') onOpenVoiceNote?.();
            }}
          />
        )}

        <div className="flex items-center gap-2 window-no-drag shrink-0">
          {!isRecording ? (
            <>
              <div className="flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px]" role="group" aria-label="Tipo de grabación">
                <button
                  type="button"
                  onClick={() => setRecordingMode('live')}
                  title="Transcribe cada frase en cuanto termina y vigila las dudas con IA"
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${recordingMode === 'live' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  En vivo
                </button>
                <button
                  type="button"
                  onClick={() => setRecordingMode('normal')}
                  title="Graba la reunión completa y, al detener, la transcribe toda"
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${recordingMode === 'normal' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Completa
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleStartMeeting(recordingMode)}
                disabled={isStarting}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                {isStarting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {isStarting ? 'Conectando…' : 'Iniciar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStopMeeting}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Square size={13} />
              Detener
            </button>
          )}

          <button
            onClick={handleGenerateSummary}
            disabled={isAnalyzing || (!transcriptText && !manualNotes && doubts.length === 0 && !isRecording)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 cursor-pointer"
          >
            {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Generar minuta
          </button>

          <button
            onClick={() => setShowDeviceSettings(!showDeviceSettings)}
            title="Elegir micrófono"
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              showDeviceSettings ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Sliders size={14} />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={handleTogglePin}
            title={isPinned ? 'Desactivar siempre visible' : 'Fijar la ventana siempre visible'}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              isPinned ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
          >
            {isPinned ? <Pin size={14} className="text-amber-400" /> : <PinOff size={14} />}
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.minimize()}
            title="Minimizar (la grabación continúa)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Micrófono */}
      {showDeviceSettings && (
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-3 text-xs shrink-0 animate-in slide-in-from-top-1">
          <label className="flex items-center gap-2 flex-1 min-w-0">
            <Mic size={14} className="text-slate-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Mi micrófono</span>
            <select
              disabled={isRecording}
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg truncate disabled:opacity-50"
            >
              {inputDevices.length === 0 ? (
                <option value="">Micrófono predeterminado</option>
              ) : (
                inputDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))
              )}
            </select>
          </label>
          <span className="text-slate-500 hidden md:block">El audio de los demás se captura del sistema.</span>
        </div>
      )}

      {/* Estado en tiempo real */}
      <div className="px-4 py-1.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 size={13} className={isRecording ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
          <span className="text-slate-300 text-[11px] truncate font-medium">{getDisplayStatus()}</span>
          {isChunkTranscribing && (
            <span className="px-2 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-medium flex items-center gap-1 animate-pulse shrink-0">
              <Loader2 size={10} className="animate-spin" /> Transcribiendo…
            </span>
          )}
          {isRadarScanning && (
            <span className="px-2 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-medium flex items-center gap-1 animate-pulse shrink-0">
              <Sparkles size={10} /> Evaluando dudas…
            </span>
          )}
          {isAnalyzing && (
            <span className="px-2 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-medium flex items-center gap-1 animate-pulse shrink-0">
              <Loader2 size={10} className="animate-spin" /> Generando minuta…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-[11px] font-medium shrink-0">
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {openDoubts.length} {openDoubts.length === 1 ? 'duda abierta' : 'dudas abiertas'}
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {resolvedDoubts.length} {resolvedDoubts.length === 1 ? 'resuelta' : 'resueltas'}
          </span>
        </div>
      </div>

      {radarNotification && (
        <div className="px-4 py-1.5 bg-purple-500/10 border-b border-purple-500/30 text-xs text-purple-200 font-medium flex items-center justify-between shrink-0 animate-in fade-in">
          <span className="truncate">{radarNotification}</span>
          <button onClick={() => setRadarNotification(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Conversación (izquierda) + Asistente (derecha) */}
      <main className="flex-1 flex min-h-0">
        <section className="flex-1 min-w-0 flex flex-col min-h-0 border-r border-slate-800">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0">
            <span className="font-semibold text-xs flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-400" />
              Conversación
            </span>
            <div className="flex items-center gap-2">
              {transcriptText && (
                <span className="text-[10px] text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {transcriptText.split(/\s+/).filter(Boolean).length} palabras
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditTranscript(!editTranscript)}
                className={`px-2 py-1 rounded-md text-[11px] flex items-center gap-1 cursor-pointer ${editTranscript ? 'bg-slate-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                title="Corregir el texto a mano"
              >
                <Pencil size={11} /> {editTranscript ? 'Listo' : 'Editar'}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {editTranscript ? (
              <textarea
                ref={transcriptTextareaRef}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="La conversación se transcribe aquí…"
                className="w-full h-full bg-slate-900 text-sm resize-none focus:outline-none p-4 leading-relaxed text-slate-200 select-text"
              />
            ) : (
              <ConversationFeed text={transcriptText} isRecording={isRecording} />
            )}
          </div>

          <div className="border-t border-slate-800 px-4 py-2.5 shrink-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Tus notas y acuerdos</label>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Apunta compromisos, nombres o cifras clave…"
              rows={2}
              className="w-full bg-slate-800/60 border border-slate-800 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed text-slate-200 placeholder:text-slate-500 select-text"
            />
          </div>
        </section>

        <aside className="w-[420px] shrink-0 min-h-0">
          <AssistantPanel
            kind="meeting"
            settings={settings}
            notes={notes}
            getTranscript={getAnalysisTranscript}
            defaultTab="radar"
            extraTabs={[
              {
                id: 'radar',
                label: 'Radar de dudas',
                Icon: Sparkles,
                badge: openDoubts.length || undefined,
                content: (
                  <DoubtsRadar
                    doubts={doubts}
                    isRecording={isRecording}
                    newDoubt={newManualDoubt}
                    onNewDoubtChange={setNewManualDoubt}
                    onAdd={handleAddManualDoubt}
                    onToggle={handleToggleDoubt}
                    onDelete={handleDeleteDoubt}
                    onCopy={handleCopyQuestion}
                    copiedId={copiedQuestionId}
                  />
                )
              }
            ]}
          />
        </aside>
      </main>

      {isAnalyzing && (
        <div className="p-3 mx-4 mb-3 text-center text-xs text-indigo-200 flex items-center justify-center gap-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 animate-pulse shrink-0">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span className="font-medium">Analizando la reunión, los acuerdos y el radar de dudas para redactar la minuta…</span>
        </div>
      )}

      {meetingSummary && !isAnalyzing && (
        <div className="p-4 mx-4 mb-4 bg-slate-800/60 rounded-xl border border-indigo-500/30 space-y-2 shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Check size={14} />
              Minuta lista
            </span>
            <button
              onClick={handleCopySummary}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedSummary ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedSummary ? 'Copiada' : 'Copiar minuta'}
            </button>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto select-text">
            {meetingSummary}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                onInsertMeetingNote(suggestedTitle, '\n\n---\n' + meetingSummary, false);
                handleCloseModal();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText size={13} />
              Insertar en la nota actual
            </button>
            <button
              onClick={() => {
                onInsertMeetingNote(suggestedTitle, meetingSummary, true);
                handleCloseModal();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle size={13} />
              Crear como nueva nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
