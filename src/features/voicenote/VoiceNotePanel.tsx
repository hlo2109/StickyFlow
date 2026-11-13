import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Headphones,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Send,
  Square,
  Trash2,
  Volume2,
  X
} from 'lucide-react';
import { AppSettings } from '../../types';
import { useVoiceNote } from './useVoiceNote';
import { MAX_NOTE_CHARS } from './VoiceNoteController';
import { useVirtualMicSetup } from '../interview/useVirtualMicSetup';
import { VirtualMicAssistant } from '../interview/VirtualMicAssistant';
import { INTERVIEW_LANGUAGES, languageName } from '../interview/languages';
import { isUsableVirtualSink } from '../interview/session';
import { isAiReady } from '../ai/status';

interface VoiceNotePanelProps {
  settings: AppSettings;
  onShowMeeting: () => void;
  onShowInterview: () => void;
  onClose: () => void;
}

const Chip: React.FC<{ ok: boolean; label: string; hint: string }> = ({ ok, label, hint }) => (
  <div
    title={ok ? label : hint}
    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${
      ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    }`}
  >
    {ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
    <span>{label}</span>
  </div>
);

const Card: React.FC<{ step: string; title: string; children: React.ReactNode }> = ({ step, title, children }) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
    <h3 className="text-sm font-semibold flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[11px] flex items-center justify-center">{step}</span>
      {title}
    </h3>
    {children}
  </section>
);

const textareaClass =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 select-text';

export const VoiceNotePanel: React.FC<VoiceNotePanelProps> = ({ settings, onShowMeeting, onShowInterview, onClose }) => {
  const setup = useVirtualMicSetup(settings);
  const { controller, snapshot } = useVoiceNote(setup.effectiveSettings);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [recSeconds, setRecSeconds] = useState(0);

  const mine = settings.interviewMyLang || 'es';
  const busy = snapshot.status !== 'idle';
  const recording = snapshot.status === 'recording';

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const sttReady = Boolean(settings.deepgramApiKey?.trim() || settings.hfApiKey?.trim());
  const translateReady = isAiReady(settings);
  const voiceReady = Boolean(settings.elevenLabsApiKey?.trim() && settings.elevenLabsVoiceId?.trim());
  const sinkReady = isUsableVirtualSink(setup.outputId);

  const handleDownload = () => {
    const file = controller.getAudioForDownload();
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleSaveAudio = async () => {
    if (await controller.prepareAudio()) handleDownload();
  };

  const targetOptions = [
    { code: mine, label: `Mismo idioma (${languageName(mine)}) — sin traducir` },
    ...INTERVIEW_LANGUAGES.filter((l) => l.code !== mine).map((l) => ({ code: l.code, label: l.name }))
  ];
  const needsTranslation = snapshot.targetLang !== mine;
  const overLimit = snapshot.finalText.length > MAX_NOTE_CHARS;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Cabecera */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 window-drag-region cursor-move">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-rose-600/30 text-rose-400 rounded-lg">
            <Mic size={18} />
          </div>
          <div>
            <div className="font-semibold text-sm">Nota de voz · con tu propia voz</div>
            <div className="text-[11px] text-slate-400">Para WhatsApp, Telegram, Teams o cualquier app que grabe audio</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 window-no-drag">
          <button type="button" onClick={onShowMeeting} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer">
            <ArrowLeft size={13} /> Reunión
          </button>
          <button type="button" onClick={onShowInterview} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1.5 cursor-pointer">
            <Languages size={13} /> Entrevista
          </button>
          <button type="button" onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-red-600/80 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
        <Chip ok={sttReady} label="Dictado" hint="Para dictar falta una clave de Deepgram o de Hugging Face (Ajustes). Escribir funciona sin ella" />
        <Chip ok={translateReady} label="Traducción" hint="Falta la clave del proveedor de IA activo (Ajustes → IA). Sin traducir funciona sin ella" />
        <Chip ok={voiceReady} label="Tu voz (ElevenLabs)" hint="Falta la clave o elegir tu voz (Ajustes → Entrevista)" />
        <Chip ok={sinkReady} label="Micrófono virtual" hint="Elige la salida del cable abajo. Sin él puedes escuchar y guardar el MP3, pero no enviar" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 1 · Mensaje */}
        <Card step="1" title="Dicta o escribe tu mensaje">
          <textarea
            value={snapshot.sourceText}
            onChange={(e) => controller.setSourceText(e.target.value)}
            rows={3}
            placeholder={`Escribe o dicta lo que quieres decir (en ${languageName(mine)})…`}
            className={textareaClass}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={setup.micId}
              onChange={(e) => setup.setMicId(e.target.value)}
              disabled={busy}
              title="Tu micrófono para dictar"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 max-w-[16rem] disabled:opacity-60"
            >
              {setup.mics.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {!recording ? (
              <button
                type="button"
                onClick={() => controller.startDictation(setup.micId)}
                disabled={busy || !sttReady}
                title={sttReady ? '' : 'Falta una clave de transcripción (Ajustes)'}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Mic size={14} /> Dictar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => controller.stopDictation()}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-1.5 animate-pulse cursor-pointer"
              >
                <Square size={14} /> Listo ({String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')})
              </button>
            )}
            {(snapshot.status === 'transcribing' || snapshot.status === 'translating') && (
              <span className="text-sky-300 flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                {snapshot.status === 'transcribing' ? 'Transcribiendo…' : 'Traduciendo…'}
              </span>
            )}
            <button
              type="button"
              onClick={() => controller.reset()}
              disabled={busy && !recording}
              className="ml-auto px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 size={13} /> Limpiar
            </button>
          </div>
        </Card>

        {/* 2 · Idioma */}
        <Card step="2" title="Idioma de la nota de voz">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={snapshot.targetLang}
              onChange={(e) => controller.setTargetLang(e.target.value)}
              disabled={busy}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
            >
              {targetOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsTranslation && (
              <button
                type="button"
                onClick={() => controller.translate()}
                disabled={busy || !snapshot.sourceText.trim() || !translateReady}
                title={translateReady ? '' : 'Falta la clave de IA (Ajustes → IA)'}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Languages size={13} /> Traducir
              </button>
            )}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">
              Lo que se dirá con tu voz {needsTranslation ? `(traducido al ${languageName(snapshot.targetLang)} — puedes corregirlo)` : '(puedes corregirlo)'}
            </span>
            <textarea
              value={snapshot.finalText}
              onChange={(e) => controller.setFinalText(e.target.value)}
              rows={3}
              placeholder="Aquí aparecerá el texto final…"
              className={textareaClass}
            />
          </label>
          <div className={`text-[11px] text-right ${overLimit ? 'text-red-400' : 'text-slate-500'}`}>
            {snapshot.finalText.length.toLocaleString()} / {MAX_NOTE_CHARS.toLocaleString()} caracteres
          </div>
        </Card>

        {/* 3 · Revisar y enviar */}
        <Card step="3" title="Escucha y envíala">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => controller.preview()}
              disabled={busy || !snapshot.finalText.trim() || !voiceReady}
              title={voiceReady ? 'Suena en tus auriculares para que la revises antes de enviarla' : 'Falta configurar ElevenLabs (Ajustes → Entrevista)'}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Headphones size={14} /> Escuchar en mis auriculares
            </button>

            <label className="flex items-center gap-1.5 text-slate-400">
              Empezar a hablar en
              <select
                value={countdownSeconds}
                onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                disabled={busy}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 disabled:opacity-60"
              >
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} s
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => controller.send(countdownSeconds)}
              disabled={busy || !snapshot.finalText.trim() || !voiceReady || !sinkReady}
              title={sinkReady && voiceReady ? '' : 'Necesitas el micrófono virtual y ElevenLabs'}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} /> Enviar a la nota de voz
            </button>

            {(snapshot.status === 'countdown' || snapshot.status === 'playing') && (
              <button type="button" onClick={() => controller.cancel()} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 cursor-pointer">
                <MicOff size={14} /> Cancelar
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAudio}
              disabled={busy || !snapshot.finalText.trim() || !voiceReady}
              title="Guarda el audio como archivo MP3 para adjuntarlo"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Download size={14} /> Guardar MP3
            </button>
          </div>

          {snapshot.status === 'synthesizing' && (
            <div className="text-xs text-sky-300 flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Generando tu voz…
            </div>
          )}

          {snapshot.status === 'countdown' && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-4">
              <div className="text-4xl font-bold text-amber-300 w-12 text-center">{snapshot.countdown}</div>
              <div className="text-sm text-amber-100 leading-snug">
                <b>Pulsa GRABAR en WhatsApp ahora.</b> En {snapshot.countdown} s empiezo a hablar con tu voz. Cuando termine, suelta o detén la grabación.
              </div>
            </div>
          )}

          {snapshot.status === 'playing' && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100 flex items-center gap-2">
              <Volume2 size={16} className="animate-pulse" />
              Hablando con tu voz… mantén la grabación y detenla cuando termine.
            </div>
          )}

          <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4">
            {snapshot.audioSeconds !== null && snapshot.hasAudio && <span>Duración: {Math.round(snapshot.audioSeconds)} s</span>}
            {snapshot.charsUsed > 0 && <span>{snapshot.charsUsed.toLocaleString()} caracteres de voz usados en esta sesión</span>}
            {snapshot.hasAudio && <span className="text-emerald-400">✓ Audio listo (enviarlo no vuelve a gastar caracteres)</span>}
          </div>
        </Card>

        {snapshot.error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <span className="flex-1">{snapshot.error}</span>
            <button type="button" onClick={() => controller.clearError()} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X size={13} />
            </button>
          </div>
        )}

        <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-300">
          <summary className="cursor-pointer font-semibold text-sm">Cómo mandarla en WhatsApp (y otras apps)</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1.5 leading-snug">
            <li>
              En la app donde vas a grabar, elige como <b>micrófono</b> el del cable (aparece arriba como «pareja del cable»):
              <ul className="list-disc ml-5 mt-0.5 text-slate-400">
                <li><b>WhatsApp Web</b>: al pulsar grabar, el navegador te deja elegir el micrófono (icono de la barra de direcciones).</li>
                <li><b>WhatsApp de escritorio</b>: usa el micrófono predeterminado de Windows. Cámbialo en Sonido → Grabar → clic derecho en el micrófono del cable → «Establecer como dispositivo predeterminado», y devuélvelo después a tu micrófono normal.</li>
                <li><b>Telegram, Teams, Slack, Discord…</b>: lo eliges en los ajustes de audio de cada app.</li>
              </ul>
            </li>
            <li>Escribe o dicta, revisa el texto y pulsa <b>Escuchar en mis auriculares</b>.</li>
            <li>Pulsa <b>Enviar a la nota de voz</b>: durante la cuenta atrás pulsa <b>grabar</b> en WhatsApp.</li>
            <li>Cuando termine de hablar, detén la grabación y envía.</li>
            <li>¿Prefieres adjuntar un archivo? Usa <b>Guardar MP3</b> (en WhatsApp llegará como audio, no como nota de voz).</li>
          </ol>
        </details>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <VirtualMicAssistant
            outputs={setup.outputs}
            inputs={setup.mics}
            outputId={setup.outputId}
            inputId={setup.virtualInputId}
            onInputChange={setup.changeVirtualInput}
            disabled={busy}
          />
          <div className="px-4 py-2.5 text-xs space-y-1">
            <label className="block space-y-1">
              <span className="text-slate-400">Salida de StickyFlow (por donde sale tu voz)</span>
              <select
                value={setup.outputId}
                onChange={(e) => setup.changeOutput(e.target.value)}
                disabled={busy}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
              >
                <option value="">— Ninguno (solo escuchar y guardar MP3) —</option>
                {setup.outputs
                  .filter((d) => isUsableVirtualSink(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
