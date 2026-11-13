import React, { useState } from 'react';
import { Languages, Eye, EyeOff, Loader2, ExternalLink, ShieldCheck } from 'lucide-react';
import { SettingsTabProps } from '../types';
import { INTERVIEW_LANGUAGES, ELEVENLABS_MODELS } from '../../interview/languages';
import { listVoices, ElevenVoice } from '../../interview/services/elevenlabs';

const inputClass =
  'w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none';

/** Modo Entrevista: claves de Deepgram y ElevenLabs, tu voz, idiomas y contexto. */
export const InterviewTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  const [showDeepgram, setShowDeepgram] = useState(false);
  const [showEleven, setShowEleven] = useState(false);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState('');

  const update = (partial: Partial<typeof formData>) => setFormData((prev) => ({ ...prev, ...partial }));

  const handleLoadVoices = async () => {
    if (!formData.elevenLabsApiKey?.trim()) {
      setVoicesError('Primero escribe tu API Key de ElevenLabs.');
      return;
    }
    setLoadingVoices(true);
    setVoicesError('');
    const res = await listVoices(formData.elevenLabsApiKey);
    setLoadingVoices(false);
    if (res.error) {
      setVoicesError(res.error);
      return;
    }
    setVoices(res.voices);
    // Si todavía no hay voz elegida, se propone la primera clonada (tu voz).
    const firstCloned = res.voices.find((v) => v.category === 'cloned');
    if (!formData.elevenLabsVoiceId && firstCloned) update({ elevenLabsVoiceId: firstCloned.id });
  };

  return (
    <div className="space-y-3.5 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Languages size={16} className="text-sky-600" />
          Modo Entrevista (traducción en vivo)
        </h4>
        <p className="text-[11px] text-slate-500">
          Lo que digan los demás se traduce a tu idioma en pantalla, y lo que digas tú sale traducido con tu propia voz.
        </p>
      </div>

      {/* Idiomas */}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">Yo hablo</span>
          <select
            value={formData.interviewMyLang || 'es'}
            onChange={(e) => update({ interviewMyLang: e.target.value })}
            className={inputClass}
          >
            {INTERVIEW_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">Ellos hablan</span>
          <select
            value={formData.interviewTheirLang || 'en'}
            onChange={(e) => update({ interviewTheirLang: e.target.value })}
            className={inputClass}
          >
            {INTERVIEW_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Deepgram */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
        <div className="font-semibold text-slate-800 dark:text-slate-100">Transcripción rápida — Deepgram</div>
        <p className="text-[11px] text-slate-500">
          Opcional. Si la dejas vacía se usa Whisper con tu clave de Hugging Face (funciona, pero con más retraso).
        </p>
        <div className="relative">
          <input
            type={showDeepgram ? 'text' : 'password'}
            value={formData.deepgramApiKey || ''}
            onChange={(e) => update({ deepgramApiKey: e.target.value })}
            placeholder="API Key de Deepgram"
            autoComplete="off"
            className={`${inputClass} pr-8`}
          />
          <button
            type="button"
            onClick={() => setShowDeepgram(!showDeepgram)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {showDeepgram ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* ElevenLabs */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="font-semibold text-slate-800 dark:text-slate-100">Tu voz clonada — ElevenLabs</div>
        <p className="text-[11px] text-slate-500">
          Clona tu voz en elevenlabs.io (Voices → Add voice → Instant Voice Clone) y elígela aquí.
        </p>
        <div className="relative">
          <input
            type={showEleven ? 'text' : 'password'}
            value={formData.elevenLabsApiKey || ''}
            onChange={(e) => update({ elevenLabsApiKey: e.target.value })}
            placeholder="API Key de ElevenLabs"
            autoComplete="off"
            className={`${inputClass} pr-8`}
          />
          <button
            type="button"
            onClick={() => setShowEleven(!showEleven)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {showEleven ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={formData.elevenLabsVoiceId || ''}
            onChange={(e) => update({ elevenLabsVoiceId: e.target.value })}
            className={inputClass}
          >
            <option value="">— Elige tu voz —</option>
            {formData.elevenLabsVoiceId && !voices.some((v) => v.id === formData.elevenLabsVoiceId) && (
              <option value={formData.elevenLabsVoiceId}>Voz guardada ({formData.elevenLabsVoiceId.slice(0, 8)}…)</option>
            )}
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.category === 'cloned' ? '⭐ ' : ''}
                {v.name}
                {v.category === 'cloned' ? ' (tu voz clonada)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoadVoices}
            disabled={loadingVoices}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            {loadingVoices && <Loader2 size={12} className="animate-spin" />}
            Cargar mis voces
          </button>
        </div>
        {voicesError && <div className="text-[11px] text-red-500">{voicesError}</div>}

        <label className="space-y-1 block">
          <span className="font-medium text-slate-700 dark:text-slate-300">Modelo de voz</span>
          <select
            value={formData.elevenLabsModel || 'eleven_flash_v2_5'}
            onChange={(e) => update({ elevenLabsModel: e.target.value })}
            className={inputClass}
          >
            {ELEVENLABS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Contexto */}
      <label className="space-y-1 block">
        <span className="font-medium text-slate-700 dark:text-slate-300">Contexto para traducir mejor (opcional)</span>
        <textarea
          value={formData.interviewContext || ''}
          onChange={(e) => update({ interviewContext: e.target.value })}
          rows={3}
          placeholder="Ej: Soy desarrollador backend con experiencia en Node.js, Postgres y AWS. Entrevista técnica para un puesto de desarrollador senior."
          className={`${inputClass} resize-none`}
        />
        <span className="text-[11px] text-slate-500">
          Ayuda a elegir bien los términos técnicos. No se muestra a la otra persona.
        </span>
      </label>

      {/* Micrófono virtual */}
      <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 text-[11px] text-sky-900 dark:text-sky-200 space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <ExternalLink size={12} /> Para que te escuchen con tu voz traducida
        </div>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Instala <b>VB-CABLE</b> (gratis): vb-audio.com/Cable</li>
          <li>En la pantalla de Entrevista, elige <b>«CABLE Input»</b> como salida de tu voz traducida.</li>
          <li>En Zoom / Meet / Teams, elige <b>«CABLE Output»</b> como tu micrófono.</li>
        </ol>
      </div>

      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        <span>
          El audio de la conversación se envía a Deepgram/Hugging Face (texto) y tu texto traducido a ElevenLabs (voz).
          Las claves se guardan cifradas en tu equipo. Se recomienda avisar a la otra persona que usas traducción en
          tiempo real: hay un botón para hacerlo con tu voz.
        </span>
      </div>
    </div>
  );
};
