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
  Languages
} from 'lucide-react';
import { Note, AppSettings, MeetingDoubt } from '../types';
import { getAudioDevices, AudioDeviceInfo } from '../utils/audioService';
import { meetingCapture, MeetingSegment } from '../features/meeting/capture/meetingCapture';
import { transcribeAudio } from '../features/meeting/stt/whisper';
import { executeAiTask, analyzeMeetingDoubtRadar } from '../features/ai';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNote: Note;
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
    const res = await meetingCapture.startCapture({ micDeviceId: selectedMicId, onSegment: onChunkCallback });
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
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col w-full h-full overflow-hidden text-slate-800 dark:text-slate-100 select-none animate-in fade-in">
      
      {/* Top Navigation & Action Header (Draggable Window Region) */}
      <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shadow-sm shrink-0 window-drag-region cursor-move select-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-600/30 text-indigo-400 rounded-lg shrink-0">
            <Headphones size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Modo Reunión & Radar de Dudas</span>
              {isRecording ? (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1.5 animate-pulse window-no-drag">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {recordingMode === 'live' ? 'EN VIVO (Radar activo)' : 'GRABANDO (Modo Normal)'} ({formatTimer(elapsedSeconds)})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
                  Listo para iniciar
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Escucha continua del audio del sistema y micrófono • Arrastra aquí para mover ventana
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 window-no-drag">
          {!isRecording ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartMeeting('live')}
                title="Transcribe cada frase en cuanto termina y evalúa dudas dinámicamente con IA"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Play size={13} />
                <span>Grabar en Vivo (Radar)</span>
              </button>

              <button
                type="button"
                onClick={() => handleStartMeeting('normal')}
                title="Graba la reunión completa en segundo plano; al presionar detener, transcribe todo el audio"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Mic size={13} />
                <span>Grabar Normal</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStopMeeting}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm animate-pulse cursor-pointer"
            >
              <Square size={13} />
              <span>Detener Reunión</span>
            </button>
          )}

          <button
            onClick={handleGenerateSummary}
            disabled={isAnalyzing || (!transcriptText && !manualNotes && doubts.length === 0 && !isRecording)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 cursor-pointer"
          >
            {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Generar Minuta con IA</span>
          </button>

          {onOpenVoiceNote && (
            <button
              type="button"
              onClick={() => {
                if (isRecording) handleStopMeeting();
                onOpenVoiceNote();
              }}
              title="Nota de voz: manda un audio con tu voz clonada por WhatsApp y más"
              className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Mic size={14} />
              <span>Nota de voz</span>
            </button>
          )}

          {onOpenInterview && (
            <button
              type="button"
              onClick={() => {
                if (isRecording) handleStopMeeting();
                onOpenInterview();
              }}
              title="Modo Entrevista: traducción en vivo con tu voz"
              className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 border border-sky-500/40 text-sky-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Languages size={14} />
              <span>Entrevista</span>
            </button>
          )}

          <button
            onClick={() => setShowDeviceSettings(!showDeviceSettings)}
            title="Ajustar micrófonos y audio"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              showDeviceSettings ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Sliders size={14} />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5"></div>

          {/* Toggle Always On Top Pin */}
          <button
            type="button"
            onClick={handleTogglePin}
            title={isPinned ? 'Desactivar siempre visible (desanclar ventana)' : 'Fijar ventana siempre visible sobre otras ventanas'}
            className={`p-1.5 rounded-lg border text-xs flex items-center transition-colors cursor-pointer ${
              isPinned ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
          >
            {isPinned ? <Pin size={14} className="text-amber-400" /> : <PinOff size={14} />}
          </button>

          {/* Minimize Window */}
          <button
            type="button"
            onClick={() => window.electronAPI?.minimize()}
            title="Minimizar ventana (la grabación continúa activa en segundo plano)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Minus size={14} />
          </button>

          {/* Close Window */}
          <button
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
            title="Cerrar ventana de reunión"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Collapsible Audio Devices Bar */}
      {showDeviceSettings && (
        <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-1 shrink-0">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-slate-400 block mb-0.5">🎙️ Micrófono de Entrada</label>
            <select
              disabled={isRecording}
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200 rounded text-xs truncate disabled:opacity-50"
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
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-slate-400 block mb-0.5">🔊 Audio de la Reunión (Sistema / Salida)</label>
            <select
              disabled={isRecording}
              value={selectedOutputId}
              onChange={(e) => setSelectedOutputId(e.target.value)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200 rounded text-xs truncate disabled:opacity-50"
            >
              {outputDevices.length === 0 ? (
                <option value="">Loopback del Sistema (predeterminado)</option>
              ) : (
                outputDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      {/* Sub-bar: Real-time Live Status Indicators & Flash Banners */}
      <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Volume2 size={13} className={isRecording ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />
          <span className="text-slate-600 dark:text-slate-300 text-[11px] truncate font-medium">
            {getDisplayStatus()}
          </span>
          {isChunkTranscribing && (
            <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-medium flex items-center gap-1 animate-pulse">
              <Loader2 size={10} className="animate-spin" />
              Transcribiendo bloque...
            </span>
          )}
          {isRadarScanning && (
            <span className="px-2 py-0.2 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-medium flex items-center gap-1 animate-pulse">
              <Sparkles size={10} />
              Evaluando dudas...
            </span>
          )}
          {isAnalyzing && (
            <span className="px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-medium flex items-center gap-1 animate-pulse">
              <Loader2 size={10} className="animate-spin" />
              Generando minuta con IA...
            </span>
          )}
        </div>

        {/* Counter badges */}
        <div className="flex items-center gap-2.5 text-[11px] font-medium">
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {openDoubts.length} {openDoubts.length === 1 ? 'duda abierta' : 'dudas abiertas'}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {resolvedDoubts.length} {resolvedDoubts.length === 1 ? 'resuelta' : 'resueltas'}
          </span>
        </div>
      </div>

      {/* Floating Notification Flash */}
      {radarNotification && (
        <div className="px-4 py-1.5 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-emerald-500/10 border-b border-purple-200 dark:border-purple-900 text-xs text-purple-800 dark:text-purple-300 font-medium flex items-center justify-between shrink-0 animate-in fade-in">
          <span className="truncate">{radarNotification}</span>
          <button onClick={() => setRadarNotification(null)} className="opacity-60 hover:opacity-100 text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-500 font-bold text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Full-Height Workspace: Two Spacious Panes */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0 bg-white dark:bg-slate-900">
        
        {/* Left Pane (Col 6): Live Stream Transcript & Fast Notes */}
        <div className="md:col-span-6 flex flex-col gap-3 h-full overflow-hidden min-h-0">
          
          {/* Live Transcript Stream Box */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/80">
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-500" />
                Transcripción en Vivo de la Reunión
              </span>
              {transcriptText && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {transcriptText.split(/\s+/).filter(Boolean).length} palabras
                </span>
              )}
            </div>

            <textarea
              ref={transcriptTextareaRef}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="El audio de la reunión y tu micrófono se transcribirán aquí automáticamente en bloques de 10 segundos..."
              className="flex-1 w-full bg-transparent text-xs resize-none focus:outline-none font-sans leading-relaxed text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>

          {/* Quick Notes / Key Points Box */}
          <div className="h-28 flex flex-col bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs shrink-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              ✍️ Tus Notas Rápidas y Acuerdos
            </span>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Apunta compromisos, nombres o cifras clave aquí..."
              className="flex-1 w-full bg-transparent text-xs resize-none focus:outline-none leading-relaxed text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Right Pane (Col 6): Autonomous Q&A Radar */}
        <div className="md:col-span-6 flex flex-col h-full overflow-hidden min-h-0 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
          
          {/* Radar Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                Radar de Dudas & Preguntas en Vivo
              </span>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-medium border border-purple-200 dark:border-purple-800">
              {isRecording ? 'Monitoreo 100% manos libres' : 'Radar listo'}
            </span>
          </div>

          {/* Quick Manual Doubt Form */}
          <form onSubmit={handleAddManualDoubt} className="py-2 flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={newManualDoubt}
              onChange={(e) => setNewManualDoubt(e.target.value)}
              placeholder="Opcional: Agregar una pregunta para que la IA la rastree..."
              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!newManualDoubt.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Añadir</span>
            </button>
          </form>

          {/* Doubts Feed */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 min-h-0">
            
            {/* Empty state */}
            {doubts.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 dark:text-slate-500">
                <Sparkles size={28} className="mb-2 stroke-1 opacity-40 text-purple-500" />
                <p className="text-xs font-medium">El radar está escuchando la conversación</p>
                <p className="text-[11px] max-w-xs mt-1 opacity-70">
                  En cuanto alguien plantee un tema ambiguo o surja una pregunta no resuelta, aparecerá aquí automáticamente.
                </p>
              </div>
            )}

            {/* Section 1: Open Doubts */}
            {openDoubts.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Dudas por Resolver ({openDoubts.length}) — ¡Pregunta en la reunión!
                </span>

                {openDoubts.map((doubt) => (
                  <div
                    key={doubt.id}
                    className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs space-y-2 shadow-2xs hover:shadow-xs transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100 flex-1 leading-snug">
                        {doubt.question}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {doubt.createdAt}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <button
                        onClick={(e) => handleCopyQuestion(doubt.id, doubt.question, e)}
                        className="p-1 px-2.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copiar pregunta para el chat de Teams/Meet/Zoom"
                      >
                        {copiedQuestionId === doubt.id ? (
                          <>
                            <Check size={11} className="text-emerald-600" />
                            <span>Copiada ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleDoubt(doubt.id)}
                          className="p-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Marcar como aclarada/resuelta"
                        >
                          <Check size={12} />
                          <span>Marcar Resuelta</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteDoubt(doubt.id, e)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Descartar duda"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 2: Resolved Doubts */}
            {resolvedDoubts.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckSquare size={12} />
                  Dudas Aclaradas durante la Reunión ({resolvedDoubts.length})
                </span>

                {resolvedDoubts.map((doubt) => (
                  <div
                    key={doubt.id}
                    className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs space-y-1 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-through text-slate-500 dark:text-slate-400 font-medium">
                        {doubt.question}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                        ✓ {doubt.resolvedAt || 'Aclarada'}
                      </span>
                    </div>

                    {doubt.resolvedAnswer && (
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 p-1.5 rounded-lg text-xs leading-relaxed border border-emerald-100 dark:border-emerald-900/50">
                        💡 <strong>Aclarado:</strong> {doubt.resolvedAnswer}
                      </p>
                    )}

                    <div className="flex justify-end pt-0.5">
                      <button
                        onClick={() => handleToggleDoubt(doubt.id)}
                        className="text-[10px] text-slate-400 hover:text-amber-600 underline cursor-pointer"
                      >
                        Reabrir duda
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* AI Analyzing Overlay Banner */}
      {isAnalyzing && (
        <div className="p-4 mx-4 mb-3 text-center text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-pulse shrink-0">
          <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="font-medium">
            Analizando la reunión completa, acuerdos y radar de dudas para redactar la minuta ejecutiva...
          </span>
        </div>
      )}

      {/* Generated Minutes Drawer */}
      {meetingSummary && !isAnalyzing && (
        <div className="p-4 mx-4 mb-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2 shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check size={14} />
              Minuta Ejecutiva Generada con Éxito
            </span>
            <button
              onClick={handleCopySummary}
              className="p-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center gap-1 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {copiedSummary ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              <span>{copiedSummary ? 'Copiado' : 'Copiar Minuta'}</span>
            </button>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto select-text font-sans">
            {meetingSummary}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                onInsertMeetingNote(suggestedTitle, '\n\n---\n' + meetingSummary, false);
                handleCloseModal();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText size={13} />
              <span>Insertar en nota actual</span>
            </button>
            <button
              onClick={() => {
                onInsertMeetingNote(suggestedTitle, meetingSummary, true);
                handleCloseModal();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle size={13} />
              <span>Crear como Nueva Nota</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
