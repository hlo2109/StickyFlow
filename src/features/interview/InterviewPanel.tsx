import React, { useEffect, useRef, useState } from 'react';
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
  Mic,
  Zap,
  Brain,
  Send
} from 'lucide-react';
import { AppSettings, Note } from '../../types';
import { useInterviewSession } from './useInterviewSession';
import { isUsableVirtualSink, InterviewLine } from './session';
import { languageName } from './languages';
import { isAiReady } from '../ai/status';
import { AudioSetup } from './AudioSetup';
import { useVirtualMicSetup } from './useVirtualMicSetup';
import { meetingCapture } from '../meeting/capture/meetingCapture';
import { fmtSeconds, speedTips, SPEED_PRESETS, SpeedPreset } from './speedTips';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { buildInterviewTranscript } from '../analysis/analyze';

interface InterviewPanelProps {
  settings: AppSettings;
  /** Notas del usuario: pueden usarse como contexto del Asistente */
  notes?: Note[];
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

/** «transcribir 0,5 s · traducir 1,1 s · voz 0,8 s · total 2,4 s»: dónde se fue el tiempo de esta frase. */
const Timings: React.FC<{ line: InterviewLine; tone: string }> = ({ line, tone }) => {
  const t = line.timings;
  if (!t || t.translateMs === undefined) return null;
  const parts = [
    t.sttMs !== undefined ? `transcribir ${fmtSeconds(t.sttMs)}` : '',
    `traducir ${fmtSeconds(t.translateMs)}`,
    t.ttsMs !== undefined ? `voz ${fmtSeconds(t.ttsMs)}` : '',
    t.totalMs !== undefined ? `total ${fmtSeconds(t.totalMs)}` : ''
  ].filter(Boolean);
  return <div className={`text-[10px] mt-1 ${tone}`}>⏱ {parts.join(' · ')}</div>;
};

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
          <Timings line={line} tone="text-slate-600" />
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
          {!line.spoken && line.audioReady && <div className="text-[10px] text-amber-200 mt-1">⚡ voz lista: suena al instante</div>}
          <Timings line={line} tone="text-indigo-200/70" />
        </div>
      </div>
    </div>
  );
};

export const InterviewPanel: React.FC<InterviewPanelProps> = ({ settings, notes = [], onBack, onOpenVoiceNote, onClose }) => {
  // Dispositivos de audio (autodetectados y recordados): lógica compartida con «Nota de voz».
  const setup = useVirtualMicSetup(settings);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showAssistant, setShowAssistant] = useState(() => localStorage.getItem('stickyflow.interview.assistant') !== '0');
  const [speed, setSpeed] = useState<SpeedPreset>(() => {
    const saved = localStorage.getItem('stickyflow.interview.speed');
    return saved && saved in SPEED_PRESETS ? (saved as SpeedPreset) : 'normal';
  });
  const [prefetch, setPrefetch] = useState(() => localStorage.getItem('stickyflow.interview.prefetch') === '1');
  const [manualTurns, setManualTurns] = useState(() => localStorage.getItem('stickyflow.interview.manual') === '1');
  const [now, setNow] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);
  const { session, snapshot } = useInterviewSession(setup.effectiveSettings);

  // «Iniciar» instantáneo: Windows tarda ~1 s en abrir el audio del sistema, así que se deja LISTO al abrir la
  // pantalla (y de nuevo al detener o cambiar de micrófono). Se libera al salir.
  useEffect(() => {
    if (snapshot.running || snapshot.starting) return;
    void meetingCapture.prepare({ micDeviceId: setup.micId || undefined, systemDeviceId: setup.theirSourceId || undefined });
  }, [setup.micId, setup.theirSourceId, snapshot.running, snapshot.starting]);

  useEffect(() => () => meetingCapture.release(), []);

  // Turno manual: Ctrl+Enter traduce todo lo acumulado
  useEffect(() => {
    if (!snapshot.running || !snapshot.manualTurns) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        session.translateDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, snapshot.running, snapshot.manualTurns]);

  useEffect(() => {
    if (!snapshot.running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [snapshot.running]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [snapshot.lines.length]);

  // Fuentes válidas para «Ellos»: nunca tu propio micrófono ni el cable por donde sale tu voz traducida
  // (ahí iría justo lo que NO queremos oír como si fuera de ellos).
  const theirSources = setup.mics.filter(
    (d) => d.id !== setup.micId && !/cable output/i.test(d.label) && !/^(default|communications)/i.test(d.label)
  );

  const sttReady = Boolean(settings.deepgramApiKey?.trim() || settings.hfApiKey?.trim());
  const translateReady = isAiReady(settings);
  const voiceReady = Boolean(settings.elevenLabsApiKey?.trim() && settings.elevenLabsVoiceId?.trim());
  const sinkReady = isUsableVirtualSink(setup.outputId);
  const canStart = sttReady && translateReady;

  const mine = settings.interviewMyLang || 'es';
  const theirs = settings.interviewTheirLang || 'en';

  const handleStart = () =>
    session.start({
      micDeviceId: setup.micId,
      autoSpeak,
      prefetch,
      silenceMs: SPEED_PRESETS[speed].silenceMs,
      joinMs: SPEED_PRESETS[speed].joinMs,
      manualTurns
    });
  const handleManualTurns = (value: boolean) => {
    setManualTurns(value);
    localStorage.setItem('stickyflow.interview.manual', value ? '1' : '0');
    session.setManualTurns(value);
  };
  const handleToggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    session.setAutoSpeak(next && snapshot.canSpeak);
  };
  const tips = speedTips(snapshot.stats, settings);
  const handleSpeed = (value: SpeedPreset) => {
    setSpeed(value);
    localStorage.setItem('stickyflow.interview.speed', value);
  };
  const handlePrefetch = (value: boolean) => {
    setPrefetch(value);
    localStorage.setItem('stickyflow.interview.prefetch', value ? '1' : '0');
    session.setPrefetch(value && snapshot.canSpeak);
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
            onClick={() => {
              const next = !showAssistant;
              setShowAssistant(next);
              localStorage.setItem('stickyflow.interview.assistant', next ? '1' : '0');
            }}
            title="Asistente: análisis de la entrevista y contexto (tu CV, proyectos)"
            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer border ${
              showAssistant ? 'bg-violet-600/30 border-violet-500/50 text-violet-200' : 'bg-slate-800 border-transparent hover:bg-slate-700'
            }`}
          >
            <Brain size={13} /> Asistente
          </button>
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

      {/* Audio: solo lo necesario; lo demás está en «Opciones avanzadas» */}
      <AudioSetup
        setup={setup}
        disabled={snapshot.running}
        noneLabel="— Ninguna (solo subtítulos) —"
        echoesBlocked={snapshot.echoesBlocked}
        rightSlot={
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
        }
        advanced={
          <label className="block space-y-1">
            <span className="text-slate-400">Audio de ellos</span>
            <select
              value={setup.theirSourceId}
              onChange={(e) => setup.changeTheirSource(e.target.value)}
              disabled={snapshot.running}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
            >
              <option value="">Audio del sistema (todo lo que suena)</option>
              {theirSources.map((d) => (
                <option key={d.id} value={d.id}>
                  Aislado: {d.label}
                </option>
              ))}
            </select>
            <span className={`block text-[11px] ${setup.theirSourceId ? 'text-emerald-400' : 'text-slate-500'}`}>
              {setup.theirSourceId
                ? '✓ Fuente aislada: tu voz traducida no puede colarse como si fuera de ellos'
                : 'Lo normal. Si tu voz traducida se cuela en «Ellos», se filtra sola (eco).'}
            </span>
          </label>
        }
      />

      {/* Conversación + Asistente (análisis y contexto) */}
      <div className="flex-1 flex min-h-0">
      <div ref={feedRef} className="flex-1 min-w-0 overflow-y-auto px-4 py-3 space-y-2.5">
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

      {showAssistant && (
        <aside className="w-[400px] shrink-0 border-l border-slate-800 min-h-0">
          <AssistantPanel
            kind="interview"
            settings={settings}
            notes={notes}
            getTranscript={() => buildInterviewTranscript(session.getSnapshot().lines)}
            onSayAnswer={snapshot.running && snapshot.canSpeak ? (text) => void session.sayText(text) : undefined}
          />
        </aside>
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

      {/* Turno manual: lo que vas diciendo se junta aquí y se traduce TODO junto al pulsar «Traducir» */}
      {snapshot.running && snapshot.manualTurns && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-sky-300">Tu turno (sin traducir todavía)</span>
            <span className="text-slate-500">Ctrl + Enter para traducir</span>
          </div>
          <div className={`text-sm min-h-[2.25rem] max-h-28 overflow-y-auto ${snapshot.draft ? 'text-slate-100' : 'text-slate-500 italic'}`}>
            {snapshot.draft || 'Habla con calma: aquí se irá juntando todo lo que digas, aunque hagas pausas.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => session.translateDraft()}
              disabled={!snapshot.draft.trim()}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={13} /> Traducir
            </button>
            <button
              type="button"
              onClick={() => session.discardDraft()}
              disabled={!snapshot.draft}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs cursor-pointer"
            >
              Borrar
            </button>
          </div>
        </div>
      )}

      {/* Velocidad: dónde se va el tiempo y cómo bajarlo */}
      {(tips.length > 0 || snapshot.stats.count >= 2) && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-[11px] text-slate-300 shrink-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 text-slate-400">
            <span className="font-semibold text-slate-200 flex items-center gap-1"><Zap size={12} className="text-amber-400" /> Velocidad (promedio de tus frases)</span>
            <span>transcribir {fmtSeconds(snapshot.stats.sttMs)}</span>
            <span>traducir {fmtSeconds(snapshot.stats.translateMs)}</span>
            {snapshot.stats.ttsMs > 0 && <span>voz {fmtSeconds(snapshot.stats.ttsMs)}</span>}
            {snapshot.stats.totalMs > 0 && <span className="text-slate-200">total {fmtSeconds(snapshot.stats.totalMs)}</span>}
          </div>
          {tips.map((t) => (
            <div key={t} className="text-amber-200/90">💡 {t}</div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {!snapshot.running ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || snapshot.starting}
              title={canStart ? '' : 'Configura las claves en Ajustes'}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 cursor-pointer"
            >
              {snapshot.starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {snapshot.starting ? 'Conectando…' : 'Iniciar'}
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
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5" title="Cuánto silencio espera antes de dar por terminada tu frase">
            Respuesta
            <select
              value={speed}
              onChange={(e) => handleSpeed(e.target.value as SpeedPreset)}
              disabled={snapshot.running || snapshot.starting}
              className="bg-slate-800 border border-slate-700 rounded-md px-1.5 py-1 text-slate-200 disabled:opacity-60"
            >
              {(Object.keys(SPEED_PRESETS) as SpeedPreset[]).map((k) => (
                <option key={k} value={k}>
                  {SPEED_PRESETS[k].label}
                </option>
              ))}
            </select>
          </label>
          <label
            className="flex items-center gap-1 cursor-pointer"
            title="Junta TODO lo que digas (aunque hagas pausas) y lo traduce de una vez al pulsar «Traducir» (Ctrl+Enter). Ideal para respuestas largas."
          >
            <input
              type="checkbox"
              checked={manualTurns}
              onChange={(e) => handleManualTurns(e.target.checked)}
              className="accent-sky-500"
            />
            ✋ Turno manual
          </label>
          {!autoSpeak && (
            <label
              className="flex items-center gap-1 cursor-pointer"
              title="En modo manual: genera la voz en cuanto se traduce, así 🔊 suena al instante. Gasta caracteres aunque no la uses."
            >
              <input
                type="checkbox"
                checked={prefetch}
                onChange={(e) => handlePrefetch(e.target.checked)}
                disabled={snapshot.running || snapshot.starting}
                className="accent-amber-500"
              />
              ⚡ Voz lista de antemano
            </label>
          )}
        </div>
        <div className="text-[11px] text-slate-500 text-right">
          {snapshot.speaking && <div className="text-sky-400">🔊 Hablando con tu voz…</div>}
          {snapshot.charsSpoken > 0 && <div>{snapshot.charsSpoken.toLocaleString()} caracteres de voz usados</div>}
        </div>
      </div>
    </div>
  );
};
