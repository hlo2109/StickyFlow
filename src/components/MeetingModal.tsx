import React, { useState, useEffect } from 'react';
import {
  X,
  Headphones,
  Mic,
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
  AlertCircle
} from 'lucide-react';
import { Note, AppSettings } from '../types';
import { meetingAudioCapture, getAudioDevices, AudioDeviceInfo, transcribeAudio } from '../utils/audioService';
import { executeAiTask } from '../utils/aiService';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNote: Note;
  settings: AppSettings;
  onInsertMeetingNote: (title: string, markdown: string, asNewNote: boolean) => void;
  onAddBitacoraLog: (action: any, summary: string) => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  activeNote,
  settings,
  onInsertMeetingNote,
  onAddBitacoraLog
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [copied, setCopied] = useState(false);

  // Device Selection
  const [inputDevices, setInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');

  // Load available devices when modal opens
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

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

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Start Meeting Audio Recording
  const handleStartMeeting = async () => {
    setErrorMessage('');
    setStatusMessage('Conectando dispositivos de audio...');

    const res = await meetingAudioCapture.startCapture(selectedMicId);
    if (!res.success) {
      setErrorMessage(res.error || 'No se pudo iniciar la captura de audio.');
      setStatusMessage('');
      return;
    }

    setIsRecording(true);
    setStatusMessage('🎧 Escuchando audio del sistema y micrófono...');
    onAddBitacoraLog('reunion', 'Grabación de reunión iniciada');
  };

  // Stop Recording
  const handleStopMeeting = async () => {
    setStatusMessage('Procesando audio...');
    const audioBlob = await meetingAudioCapture.stop();
    setIsRecording(false);

    if (audioBlob && audioBlob.size > 0) {
      setStatusMessage('Transcribiendo audio de la reunión...');
      const transRes = await transcribeAudio(audioBlob, settings);
      if (transRes.success && transRes.text) {
        setTranscriptText(transRes.text);
        setStatusMessage('Transcripción completada.');
      } else {
        setStatusMessage('');
        setErrorMessage(transRes.error || 'No se pudo transcribir el audio automáticamente. Puedes ingresar notas manuales abajo.');
      }
    } else {
      setStatusMessage('');
    }
  };

  // Generate Meeting Minutes with AI
  const handleGenerateSummary = async () => {
    if (isRecording) {
      await handleStopMeeting();
    }

    setIsAnalyzing(true);
    setMeetingSummary('');

    const combinedConversation = [
      transcriptText ? `### Transcripción del Audio de la Reunión:\n${transcriptText}` : '',
      manualNotes ? `### Notas y Acuerdos de la Reunión:\n${manualNotes}` : ''
    ].filter(Boolean).join('\n\n');

    if (!combinedConversation.trim()) {
      setIsAnalyzing(false);
      setErrorMessage('No hay transcripción ni notas manuales para procesar.');
      return;
    }

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
      onAddBitacoraLog('ia_resumen', 'Minuta de reunión generada con IA');
    } else {
      setErrorMessage(res.error || 'Error al generar la minuta con la IA.');
    }
  };

  const handleCopy = () => {
    if (meetingSummary) {
      if (window.electronAPI?.writeClipboard) {
        window.electronAPI.writeClipboard(meetingSummary);
      } else {
        navigator.clipboard.writeText(meetingSummary);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-3 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones size={18} className="text-purple-200" />
            <div>
              <h3 className="font-semibold text-sm">Modo Reunión & Audio del Sistema</h3>
              <p className="text-[10px] text-purple-200 opacity-90">Captura lo que dicen en la reunión y tu micrófono para generar la minuta</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isRecording) handleStopMeeting();
              onClose();
            }}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Device Selection Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Sliders size={12} />
            Selección de Dispositivos de Audio
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">🎙️ Micrófono de Entrada</label>
              <select
                disabled={isRecording}
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs truncate disabled:opacity-60"
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

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">🔊 Audio del Sistema / Salida</label>
              <select
                disabled={isRecording}
                value={selectedOutputId}
                onChange={(e) => setSelectedOutputId(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs truncate disabled:opacity-60"
              >
                {outputDevices.length === 0 ? (
                  <option value="">Audio del sistema (Loopback Windows)</option>
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
        </div>

        {/* Action Controls */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={handleStartMeeting}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Play size={14} />
                <span>Iniciar Escucha</span>
              </button>
            ) : (
              <button
                onClick={handleStopMeeting}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm animate-pulse"
              >
                <Square size={14} />
                <span>Detener Grabación ({formatTimer(elapsedSeconds)})</span>
              </button>
            )}

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Volume2 size={13} className={isRecording ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />
              <span>{statusMessage || (isRecording ? `Grabando: ${formatTimer(elapsedSeconds)}` : 'Listo para iniciar')}</span>
            </div>
          </div>

          <button
            onClick={handleGenerateSummary}
            disabled={isAnalyzing || (!transcriptText && !manualNotes && !isRecording)}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-yellow-300" />}
            <span>Generar Minuta con IA</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 mx-3 mt-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-xs flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Meeting Body: Live Transcripts & Manual Notes */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          
          {/* Transcript Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Transcripción de Audio de la Reunión
              </span>
              {transcriptText && (
                <span className="text-[10px] text-emerald-600 font-medium">Transcrito ✓</span>
              )}
            </div>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Aquí aparecerá el texto transcrito de lo que dijeron los participantes y tú en la reunión..."
              className="w-full h-28 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed font-sans"
            />
          </div>

          {/* Quick Manual Notes during Meeting */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Tus Notas y Acuerdos Rápidos (Opcional)
            </span>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Escribe acuerdos clave, nombres o números mientras se desarrolla la reunión..."
              className="w-full h-16 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed"
            />
          </div>

          {/* AI Generated Meeting Minutes Result */}
          {isAnalyzing && (
            <div className="p-6 text-center text-xs text-purple-600 dark:text-purple-400 flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin" />
              <span>Analizando la reunión completa con IA para extraer acuerdos y tareas...</span>
            </div>
          )}

          {meetingSummary && !isAnalyzing && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <Check size={13} />
                  Minuta Generada con Éxito
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1 px-2 rounded bg-slate-200 dark:bg-slate-700 text-[11px] font-medium flex items-center gap-1"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 text-xs whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto select-text">
                {meetingSummary}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    onInsertMeetingNote(suggestedTitle, '\n\n---\n' + meetingSummary, false);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-medium flex items-center gap-1"
                >
                  <FileText size={13} />
                  <span>Insertar en nota actual</span>
                </button>
                <button
                  onClick={() => {
                    onInsertMeetingNote(suggestedTitle, meetingSummary, true);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium flex items-center gap-1 shadow-sm"
                >
                  <PlusCircle size={13} />
                  <span>Crear como Nueva Nota</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
