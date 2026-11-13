import React, { useState, useEffect } from 'react';
import { Volume2, RotateCcw } from 'lucide-react';
import { AppSettings } from '../../../types';
import { ttsService, TtsVoiceInfo, ALL_NATURAL_VOICES, VoiceLanguageCategory } from '../../../utils/ttsService';
import { SettingsTabProps } from '../types';

/** Voz y velocidad de lectura en voz alta (TTS). */
export const TtsTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [ttsLangTab, setTtsLangTab] = useState<VoiceLanguageCategory>('es');

  useEffect(() => {
    ttsService.getAvailableVoices().then((list) => {
      setVoices(list);
      if (!formData.ttsVoice) {
        setFormData((prev) => ({ ...prev, ttsVoice: 'es-MX-DaliaNeural' }));
      }
    });
  }, []);

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    ttsService.testVoice(
      formData.ttsVoice || 'es-MX-DaliaNeural',
      formData.ttsRate || 1.0,
      formData.ttsPitch || 1.0
    );
    setTimeout(() => setIsPlayingTest(false), 3500);
  };

  const handleResetRecommendedVoice = (lang?: VoiceLanguageCategory) => {
    const targetLang = lang || ttsLangTab;
    let recVoice = 'es-MX-DaliaNeural';
    if (targetLang === 'en') recVoice = 'en-US-JennyNeural';
    if (targetLang === 'fr') recVoice = 'fr-FR-DeniseNeural';

    setFormData((prev) => ({
      ...prev,
      ttsVoice: recVoice,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0
    }));
  };

  return (
    <div className="space-y-3.5 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Volume2 size={16} className="text-sky-600 dark:text-sky-400" />
          Lectura Natural de Notas (Voz Real Humana & Piper TTS)
        </h4>
        <p className="text-[11px] text-slate-500">
          Sustituye la voz robótica por voces neuronales de alta fidelidad y modelos Piper TTS que leen con calidez humana real en 3 idiomas.
        </p>
      </div>

      {/* Idioma Selector Tabs: Latino / Inglés / Francés */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => {
            setTtsLangTab('es');
            handleResetRecommendedVoice('es');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'es' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
        >
          <span>🌎 Español Latino</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTtsLangTab('en');
            handleResetRecommendedVoice('en');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'en' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
        >
          <span>🇺🇸 English</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTtsLangTab('fr');
            handleResetRecommendedVoice('fr');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'fr' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
        >
          <span>🇫🇷 Français</span>
        </button>
      </div>

      {/* Voice Selection Box */}
      <div className="p-3 bg-gradient-to-br from-sky-50/70 to-indigo-50/40 dark:from-sky-950/30 dark:to-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-800 dark:text-slate-100 block text-xs">
            Voz del Narrador ({ttsLangTab === 'es' ? 'Español Latino' : ttsLangTab === 'en' ? 'Inglés' : 'Francés'}):
          </label>
          <button
            type="button"
            onClick={() => handleResetRecommendedVoice(ttsLangTab)}
            className="text-[10px] text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1 font-medium cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>
              {ttsLangTab === 'es' ? 'Recomendar Dalia (México)' : ttsLangTab === 'en' ? 'Recomendar Jenny (EE.UU.)' : 'Recomendar Denise (Francia)'}
            </span>
          </button>
        </div>

        <select
          value={formData.ttsVoice || (ttsLangTab === 'es' ? 'es-MX-DaliaNeural' : ttsLangTab === 'en' ? 'en-US-JennyNeural' : 'fr-FR-DeniseNeural')}
          onChange={(e) => setFormData({ ...formData, ttsVoice: e.target.value })}
          className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
        >
          <optgroup label={`✨ Voces Neuronales de Alta Fidelidad (${ttsLangTab === 'es' ? 'Español Latino' : ttsLangTab === 'en' ? 'English' : 'Français'})`}>
            {ALL_NATURAL_VOICES.filter(v => v.category === ttsLangTab && v.engine !== 'piper').map(v => (
              <option key={v.id} value={v.id}>
                {v.flag} {v.name} ({v.country}) — {v.gender === 'female' ? 'Femenina' : 'Masculina'} • {v.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="⚡ Modelos Piper TTS (VITS Locales)">
            {ALL_NATURAL_VOICES.filter(v => v.category === ttsLangTab && v.engine === 'piper').map(v => (
              <option key={v.id} value={v.id}>
                {v.flag} {v.name} ({v.country}) — {v.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="🔊 Voces Locales del Sistema Operativo">
            {voices.filter(v => !v.isNeural && (
              ttsLangTab === 'es' ? v.lang.startsWith('es') :
              ttsLangTab === 'en' ? v.lang.startsWith('en') :
              v.lang.startsWith('fr')
            )).map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </optgroup>
        </select>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-sky-800/80 dark:text-sky-300/80">
            ✨ Sin costo • Entonación fluida humana real y Piper TTS
          </span>
          <button
            type="button"
            onClick={handleTestVoice}
            disabled={isPlayingTest}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Volume2 size={13} className={isPlayingTest ? 'animate-bounce' : ''} />
            <span>{isPlayingTest ? 'Reproduciendo muestra...' : 'Probar Voz'}</span>
          </button>
        </div>
      </div>

      {/* Speed / Rate slider */}
      <div className="space-y-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
            Velocidad de Lectura ({formData.ttsRate || 1.0}x)
          </span>
          <span className="text-[10px] text-slate-400">
            {(formData.ttsRate || 1.0) === 1.0 ? 'Normal (Recomendado)' : (formData.ttsRate || 1.0) < 1.0 ? 'Pausada' : 'Rápida'}
          </span>
        </div>
        <input
          type="range"
          min="0.7"
          max="1.4"
          step="0.05"
          value={formData.ttsRate || 1.0}
          onChange={(e) => setFormData({ ...formData, ttsRate: parseFloat(e.target.value) })}
          className="w-full accent-sky-600 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>0.7x (Pausada)</span>
          <span>1.0x (Natural)</span>
          <span>1.4x (Dinámica)</span>
        </div>
      </div>

      {/* Pitch slider */}
      <div className="space-y-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
            Tono de la Voz ({formData.ttsPitch || 1.0})
          </span>
          <span className="text-[10px] text-slate-400">
            {(formData.ttsPitch || 1.0) === 1.0 ? 'Natural' : (formData.ttsPitch || 1.0) < 1.0 ? 'Grave' : 'Agudo'}
          </span>
        </div>
        <input
          type="range"
          min="0.8"
          max="1.2"
          step="0.05"
          value={formData.ttsPitch || 1.0}
          onChange={(e) => setFormData({ ...formData, ttsPitch: parseFloat(e.target.value) })}
          className="w-full accent-sky-600 cursor-pointer"
        />
      </div>

      {/* Smart reader explanation card */}
      <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-1">
        <div className="font-semibold flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
          <span>✨ Modo Persona Real Activo</span>
        </div>
        <p>
          StickyFlow procesa el texto antes de leerlo: reconoce tareas completadas o pendientes, títulos, pausas y viñetas sin deletrear enlaces feos, para que suene exactamente como un audiolibro narrado por una persona real.
        </p>
      </div>
    </div>
  );
};
