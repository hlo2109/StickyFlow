import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Languages,
  Play,
  Square,
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Megaphone,
  Loader2,
  Settings as SettingsIcon,
  Mic
} from 'lucide-react';
import { AppSettings } from '../../types';
import { getAudioDevices, AudioDeviceInfo } from '../../utils/audioService';
import { useInterviewSession } from './useInterviewSession';
import { isUsableVirtualSink, InterviewLine } from './session';
import { languageName } from './languages';
import { isAiReady } from '../ai/status';
import { VirtualMicAssistant } from './VirtualMicAssistant';
import { findPairedInput, isVirtualOutputLabel } from './services/virtualMic';

interface InterviewPanelProps {
  settings: AppSettings;
  onBack: () => void;
  onOpenVoiceNote?: () => void;
  onClose: () => void;
}

/** Aviso honesto para la otra persona: se dice con tu voz, traducido a su idioma. */
const DISCLOSURE: Record<string, string> = {
  es: 'Hola, estoy usando una herramienta de traducción en tiempo real con mi propia voz, así que notarán una pequeña pausa entre mis respuestas. Gracias por su paciencia.',
  en: "Hi, I'm using a real-time translation tool with my own voice, so you may notice a short pause before my answers. Thank you for your patience."
};

const formatTimer = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const Check: React.FC<{ ok: boolean; label: string; hint?: string }> = ({ ok, label, hint }) => (
  <div
    title={ok ? label : hint}
    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${
      ok
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    }`}
  >
    {ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
    <span>{label}</span>
  </div>
);

const LineBubble: React.FC<{ line: InterviewLine; canSpeak: boolean; onSpeak: (id: string) => void }> = ({
  line,
  canSpeak,
  onSpeak
}) => {
  if (line.side === 'them') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-800 border border-slate-700 px-3.5 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-sky-400 font-semibold mb-0.5">Ellos</div>
          {line.status === 'translating' ? (
            <div className="text-sm text-slate-400 flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Traduciendo…
            </div>
          ) : (
            <div className="text-sm text-slate-100 leading-snug">{line.translation || line.original}</div>
          )}
          <div className="text-[11px] text-slate-500 italic mt-1">{line.original}</div>
          {line.status === 'error' && <div className="text-[11px] text-red-400 mt-1">{line.error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-600/90 border border-indigo-400/40 px-3.5 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-indigo-200 font-semibold mb-0.5">Tú</div>
        <div className="text-sm text-white leading-snug">{line.original}</div>
        <div className="mt-1.5 pt-1.5 border-t border-white/20">
          {line.status === 'translating' ? (
            <div className="text-xs text-indigo-200 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Traduciendo…
            </div>
          ) : line.status === 'error' ? (
            <div className="text-[11px] text-red-200">{line.error}</div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="text-sm text-indigo-50 font-medium leading-snug flex-1">{line.translation}</div>
              <button
                type="button"
                disabled={!canSpeak || line.speaking}
                onClick={() => onSpeak(line.id)}
                title={line.spoken ? 'Decir de nuevo con tu voz' : 'Decir con tu voz'}
                className="shrink-0 p-1 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-40 cursor-pointer"
              >
                {line.speaking ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
              </button>
            </div>
          )}
          {line.spoken && <div className="text-[10px] text-emerald-200 mt-1">✓ dicho con tu voz</div>}
        </div>
      </div>
    </div>
  );
};

export const InterviewPanel: React.FC<InterviewPanelProps> = ({ settings, onBack, onOpenVoiceNote, onClose }) => {
  const [mics, setMics] = useState<AudioDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<AudioDeviceInfo[]>([]);
  const [micId, setMicId] = useState('');
  const [outputId, setOutputId] = useState(settings.interviewOutputDeviceId || '');
  const [theirSourceId, setTheirSourceId] = useState(settings.interviewTheirAudioDeviceId || '');
  const [virtualInputId, setVirtualInputId] = useState(settings.interviewVirtualMicInputId || '');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [now, setNow] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);

  // El micrófono virtual elegido aquí se usa en vivo y se recuerda para la próxima vez.
  const effectiveSettings = useMemo<AppSettings>(
    () => ({ ...settings, interviewOutputDeviceId: outputId, interviewTheirAudioDeviceId: theirSourceId }),
    [settings, outputId, theirSourceId]
  );
  const { session, snapshot } = useInterviewSession(effectiveSettings);

  useEffect(() => {
    getAudioDevices().then(({ inputs, outputs: outs }) => {
      setMics(inputs);
      setOutputs(outs);
      if (inputs.length > 0) setMicId((prev) => prev || inputs[0].id);
      // Autodetectar VB-CABLE si todavía no se eligió un micrófono virtual.
      setOutputId((prev) => {
        if (isUsableVirtualSink(prev) && outs.some((o) => o.id === prev)) return prev;
        return outs.find((o) => /cable input/i.test(o.label))?.id ?? '';
      });
    });
  }, []);

  useEffect(() => {
    if (!snapshot.running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [snapshot.running]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [snapshot.lines.length]);

  const handleOutputChange = (id: string) => {
    setOutputId(id);
    window.electronAPI?.saveSettings?.({ ...settings, interviewOutputDeviceId: id, interviewTheirAudioDeviceId: theirSourceId, interviewVirtualMicInputId: virtualInputId });
  };

  // Empareja el micrófono virtual con la salida elegida (si todavía no hay uno válido).
  useEffect(() => {
    const out = outputs.find((o) => o.id === outputId);
    if (!out || !isVirtualOutputLabel(out.label)) return;
    if (virtualInputId && mics.some((m) => m.id === virtualInputId)) return;
    const pair = findPairedInput(out, mics);
    if (pair.input) setVirtualInputId(pair.input.id);
  }, [outputs, mics, outputId, virtualInputId]);

  const handleVirtualInputChange = (id: string) => {
    setVirtualInputId(id);
    window.electronAPI?.saveSettings?.({
      ...settings,
      interviewOutputDeviceId: outputId,
      interviewTheirAudioDeviceId: theirSourceId,
      interviewVirtualMicInputId: id
    });
  };

  const handleTheirSourceChange = (id: string) => {
    setTheirSourceId(id);
    window.electronAPI?.saveSettings?.({ ...settings, interviewOutputDeviceId: outputId, interviewTheirAudioDeviceId: id, interviewVirtualMicInputId: virtualInputId });
  };

  // Fuentes válidas para «Ellos»: nunca tu propio micrófono ni el cable por donde sale tu voz traducida
  // (ahí iría justo lo que NO queremos oír como si fuera de ellos).
  const theirSources = mics.filter((d) => d.id !== micId && !/cable output/i.test(d.label) && !/^(default|communications)/i.test(d.label));

  const sttReady = Boolean(settings.deepgramApiKey?.trim() || settings.hfApiKey?.trim());
  const translateReady = isAiReady(settings);
  const voiceReady = Boolean(settings.elevenLabsApiKey?.trim() && settings.elevenLabsVoiceId?.trim());
  const sinkReady = isUsableVirtualSink(outputId);
  const canStart = sttReady && translateReady;

  const mine = settings.interviewMyLang || 'es';
  const theirs = settings.interviewTheirLang || 'en';

  const handleStart = () => session.start({ micDeviceId: micId, autoSpeak });
  const handleToggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    session.setAutoSpeak(next && snapshot.canSpeak);
  };
  const handleDisclosure = () => session.sayText(DISCLOSURE[mine] ?? DISCLOSURE.en);

  const openSettings = () => window.electronAPI?.openSettingsWindow?.();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Cabecera */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 window-drag-region cursor-move">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-600/30 text-sky-400 rounded-lg">
            <Languages size={18} />
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              Modo Entrevista · Traducción en vivo
              {snapshot.running && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  EN VIVO {snapshot.startedAt ? formatTimer(now - snapshot.startedAt) : ''}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              Tú: {languageName(mine)} → Ellos: {languageName(theirs)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 window-no-drag">
          <button
            type="button"
            onClick={onBack}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={13} /> Reunión
          </button>
          {onOpenVoiceNote && (
            <button
              type="button"
              onClick={onOpenVoiceNote}
              title="Nota de voz con tu voz clonada (WhatsApp y más)"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Mic size={13} /> Nota de voz
            </button>
          )}
          <button
            type="button"
            onClick={openSettings}
            title="Ajustes de entrevista"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <SettingsIcon size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="p-1.5 rounded-lg hover:bg-red-600/80 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Estado de la configuración */}
      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
        <Check ok={sttReady} label="Transcripción" hint="Falta una clave de Deepgram o de Hugging Face (Ajustes)" />
        <Check ok={translateReady} label="Traducción" hint="Falta la clave del proveedor de IA activo (Ajustes → IA)" />
        <Check ok={voiceReady} label="Tu voz (ElevenLabs)" hint="Sin esto solo verás subtítulos (Ajustes → Entrevista)" />
        <Check
          ok={sinkReady}
          label="Micrófono virtual"
          hint="Instala VB-CABLE (gratis) y elige 'CABLE Input' abajo. Sin esto solo verás subtítulos."
        />
      </div>

      {/* Dispositivos */}
      <div className="px-4 py-2.5 border-b border-slate-800 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end shrink-0 text-xs">
        <label className="space-y-1">
          <span className="text-slate-400">Tu micrófono (lo que dices)</span>
          <select
            value={micId}
            onChange={(e) => setMicId(e.target.value)}
            disabled={snapshot.running}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
          >
            {mics.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-slate-400">Salida de StickyFlow (por donde sale tu voz traducida)</span>
          <select
            value={outputId}
            onChange={(e) => handleOutputChange(e.target.value)}
            disabled={snapshot.running}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
          >
            <option value="">— Ninguno (solo subtítulos) —</option>
            {outputs
              .filter((d) => isUsableVirtualSink(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleToggleAutoSpeak}
          disabled={!voiceReady || !sinkReady}
          title="Si está apagado, revisas la traducción y la dices con el botón 🔊 cuando quieras"
          className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
            autoSpeak && voiceReady && sinkReady
              ? 'bg-sky-600/20 border-sky-500/40 text-sky-300'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {autoSpeak && voiceReady && sinkReady ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {autoSpeak && voiceReady && sinkReady ? 'Hablar automático' : 'Hablar manual'}
        </button>
      </div>

      {/* Micrófono virtual de StickyFlow: emparejar, probar y nombrar */}
      <VirtualMicAssistant
        outputs={outputs}
        inputs={mics}
        outputId={outputId}
        inputId={virtualInputId}
        onInputChange={handleVirtualInputChange}
        disabled={snapshot.running}
      />

      {/* Fuente del audio de ellos */}
      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0 text-xs">
        <label className="flex items-center gap-2 min-w-0">
          <span className="text-slate-400 shrink-0">Audio de ellos</span>
          <select
            value={theirSourceId}
            onChange={(e) => handleTheirSourceChange(e.target.value)}
            disabled={snapshot.running}
            title="Audio del sistema oye todo lo que suena, incluida tu voz traducida (se filtra el eco). Un dispositivo de entrada aislado no mezcla nada más."
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 max-w-[22rem] disabled:opacity-60"
          >
            <option value="">Audio del sistema (todo lo que suena)</option>
            {theirSources.map((d) => (
              <option key={d.id} value={d.id}>
                Aislado: {d.label}
              </option>
            ))}
          </select>
        </label>
        <span className={`text-[11px] ${theirSourceId ? 'text-emerald-400' : 'text-slate-500'}`}>
          {theirSourceId
            ? '✓ Fuente aislada: tu voz traducida no puede colarse'
            : 'Se filtra automáticamente el eco de tu voz traducida'}
        </span>
        {snapshot.echoesBlocked > 0 && (
          <span className="text-[11px] text-sky-400" title="Veces que tu propia voz traducida volvió a entrar por el audio del sistema y se descartó">
            🔇 {snapshot.echoesBlocked} eco{snapshot.echoesBlocked === 1 ? '' : 's'} de tu voz filtrado{snapshot.echoesBlocked === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Conversación */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {snapshot.lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs gap-2 px-8">
            <Languages size={28} className="text-slate-600" />
            <p>
              {snapshot.running
                ? 'Escuchando… cuando alguien hable verás aquí la traducción.'
                : 'Pulsa «Iniciar» para empezar. Lo que digan los demás aparecerá traducido a tu idioma, y lo que digas tú se traducirá y saldrá con tu voz.'}
            </p>
            {!sinkReady && (
              <p className="text-amber-400/80 max-w-md">
                Para que te escuchen con tu voz traducida instala <b>VB-CABLE</b> (gratis, vb-audio.com/Cable) y en la
                videollamada elige <b>«CABLE Output»</b> como micrófono.
              </p>
            )}
          </div>
        ) : (
          snapshot.lines.map((line) => (
            <LineBubble key={line.id} line={line} canSpeak={snapshot.canSpeak} onSpeak={(id) => session.speak(id)} />
          ))
        )}
      </div>

      {snapshot.error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 shrink-0">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{snapshot.error}</span>
          <button type="button" onClick={() => session.clearError()} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Controles */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {!snapshot.running ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              title={canStart ? '' : 'Configura las claves en Ajustes'}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 cursor-pointer"
            >
              <Play size={15} /> Iniciar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => session.stop()}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm flex items-center gap-2 cursor-pointer"
            >
              <Square size={15} /> Detener
            </button>
          )}
          <button
            type="button"
            onClick={() => session.silence()}
            disabled={!snapshot.speaking && snapshot.pendingSpeech === 0}
            title="Corta de inmediato lo que tu voz esté diciendo"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <VolumeX size={14} /> Silenciar
          </button>
          <button
            type="button"
            onClick={handleDisclosure}
            disabled={!snapshot.running || !voiceReady || !sinkReady}
            title="Dice con tu voz, traducido, que estás usando traducción en tiempo real"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Megaphone size={14} /> Avisar que uso traducción
          </button>
        </div>
        <div className="text-[11px] text-slate-500 text-right">
          {snapshot.speaking && <div className="text-sky-400">🔊 Hablando con tu voz…</div>}
          {snapshot.charsSpoken > 0 && <div>{snapshot.charsSpoken.toLocaleString()} caracteres de voz usados</div>}
        </div>
      </div>
    </div>
  );
};
