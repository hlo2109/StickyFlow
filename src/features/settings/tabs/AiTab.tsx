import React, { useState } from 'react';
import { Sparkles, Bot, Eye, EyeOff, Plus, Server } from 'lucide-react';
import { CustomAiProvider } from '../../../types';
import { SettingsTabProps } from '../types';
import { CLAUDE_DEFAULT_MODEL, resolveClaudeModel } from '../../ai/config';
import { PROVIDER_PRESETS } from '../../ai/presets';
import { testClaude, testHuggingFace } from '../../ai/connectionTest';
import { convertForeignHfToCustom, hfPointsElsewhere, providerNameFromUrl } from '../../ai/migrateHf';
import { ConnectionTestButton } from './ai/ConnectionTestButton';
import { CustomProviderCard } from './ai/CustomProviderCard';

const inputClass =
  'w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs';
const cardClass = 'p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2';

const selectorClass = (active: boolean, activeStyle: string) =>
  `p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
    active ? `${activeStyle} font-bold` : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
  }`;

/** Proveedor de IA: Hugging Face, Claude o cualquier servicio compatible con OpenAI (DeepSeek, OpenAI, Groq, Ollama…). */
export const AiTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  const [showHfKey, setShowHfKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [presetHint, setPresetHint] = useState('');

  const providers = formData.customProviders ?? [];
  const active = formData.activeAiProvider;

  const setActive = (id: string) => setFormData((prev) => ({ ...prev, activeAiProvider: id }));

  const updateProvider = (updated: CustomAiProvider) =>
    setFormData((prev) => ({
      ...prev,
      customProviders: (prev.customProviders ?? []).map((p) => (p.id === updated.id ? updated : p))
    }));

  const removeProvider = (id: string) =>
    setFormData((prev) => ({
      ...prev,
      customProviders: (prev.customProviders ?? []).filter((p) => p.id !== id),
      // Si se borra el que estaba en uso, se vuelve a Hugging Face para no dejar la IA apuntando a la nada.
      activeAiProvider: prev.activeAiProvider === id ? 'huggingface' : prev.activeAiProvider
    }));

  const addFromPreset = (presetKey: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const provider: CustomAiProvider = {
      id: `custom-${Date.now().toString(36)}`,
      name: preset.key === 'custom' ? '' : preset.name,
      baseUrl: preset.baseUrl,
      apiKey: '',
      model: preset.model,
      fastModel: preset.fastModel
    };
    setPresetHint(preset.hint || '');
    setFormData((prev) => ({ ...prev, customProviders: [...(prev.customProviders ?? []), provider] }));
  };

  return (
    <div className="space-y-3.5 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sparkles size={16} className="text-purple-600" />
          Configuración de Inteligencia Artificial
        </h4>
        <p className="text-[11px] text-slate-500">
          Elige qué IA usar y pega su clave. Puedes añadir cualquier servicio compatible con OpenAI (DeepSeek, OpenAI, Groq,
          Gemini, Ollama…).
        </p>
      </div>

      {/* Selector del proveedor en uso */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActive('huggingface')}
          className={selectorClass(active === 'huggingface' || !active, 'border-purple-600 bg-purple-50 dark:bg-purple-950/40')}
        >
          <Sparkles size={16} className="text-purple-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs">Hugging Face</div>
            <div className="text-[10px] text-slate-500 font-normal truncate">{formData.hfModel || 'Qwen 2.5 72B'}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActive('claude')}
          className={selectorClass(active === 'claude', 'border-amber-600 bg-amber-50 dark:bg-amber-950/40')}
        >
          <Bot size={16} className="text-amber-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs">Claude (Anthropic)</div>
            <div className="text-[10px] text-slate-500 font-normal truncate">{resolveClaudeModel(formData.claudeModel)}</div>
          </div>
        </button>

        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={selectorClass(active === p.id, 'border-sky-600 bg-sky-50 dark:bg-sky-950/40')}
          >
            <Server size={16} className="text-sky-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs truncate">{p.name || 'Sin nombre'}</div>
              <div className="text-[10px] text-slate-500 font-normal truncate">{p.model || 'sin modelo'}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Hugging Face */}
      <div className={cardClass}>
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Hugging Face Router</span>

        {hfPointsElsewhere(formData) && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
            <div>
              <b>Este endpoint no es de Hugging Face</b> (es de {providerNameFromUrl(formData.hfEndpoint)}). Funciona a medias y
              hace fallar el dictado con Whisper. Conviértelo en un proveedor propio para que todo vaya bien.
            </div>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, ...convertForeignHfToCustom(prev) }))}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
            >
              Convertir en proveedor propio ({providerNameFromUrl(formData.hfEndpoint)})
            </button>
          </div>
        )}
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Endpoint</label>
          <input
            type="text"
            value={formData.hfEndpoint}
            onChange={(e) => setFormData({ ...formData, hfEndpoint: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[11px] text-slate-500">Modelo Chat / Instruct</label>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Recomendados</span>
          </div>
          <input
            type="text"
            value={formData.hfModel}
            onChange={(e) => setFormData({ ...formData, hfModel: e.target.value })}
            className={inputClass}
            placeholder="Qwen/Qwen2.5-72B-Instruct"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {[
              { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B (Gratuito)' },
              { id: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B (Rápido)' },
              { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
              { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFormData({ ...formData, hfModel: m.id })}
                className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                  formData.hfModel === m.id
                    ? 'bg-purple-600 text-white border-purple-600 font-semibold'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">API Key de Hugging Face (hf_...)</label>
          <div className="relative flex items-center">
            <input
              type={showHfKey ? 'text' : 'password'}
              value={formData.hfApiKey}
              onChange={(e) => setFormData({ ...formData, hfApiKey: e.target.value })}
              placeholder="hf_..."
              autoComplete="off"
              className={`${inputClass} pr-7`}
            />
            <button type="button" onClick={() => setShowHfKey(!showHfKey)} className="absolute right-2 text-slate-400 cursor-pointer">
              {showHfKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <ConnectionTestButton
          onTest={() => testHuggingFace(formData)}
          resetKey={`${formData.hfEndpoint}|${formData.hfModel}|${formData.hfApiKey}`}
          disabled={!formData.hfApiKey?.trim()}
          disabledReason="Escribe tu API Key de Hugging Face para probar"
        />
      </div>

      {/* Claude */}
      <div className={cardClass}>
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Claude (Anthropic)</span>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">API Key de Anthropic (sk-ant-...)</label>
          <div className="relative flex items-center">
            <input
              type={showClaudeKey ? 'text' : 'password'}
              value={formData.claudeApiKey}
              onChange={(e) => setFormData({ ...formData, claudeApiKey: e.target.value })}
              placeholder="sk-ant-..."
              autoComplete="off"
              className={`${inputClass} pr-7`}
            />
            <button type="button" onClick={() => setShowClaudeKey(!showClaudeKey)} className="absolute right-2 text-slate-400 cursor-pointer">
              {showClaudeKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Modelo (opcional)</label>
          <input
            type="text"
            value={formData.claudeModel?.startsWith('claude-3') ? '' : formData.claudeModel || ''}
            onChange={(e) => setFormData({ ...formData, claudeModel: e.target.value })}
            placeholder={CLAUDE_DEFAULT_MODEL}
            className={inputClass}
          />
        </div>
        <ConnectionTestButton
          onTest={() => testClaude(formData)}
          resetKey={`${formData.claudeModel}|${formData.claudeApiKey}`}
          disabled={!formData.claudeApiKey?.trim()}
          disabledReason="Escribe tu API Key de Anthropic para probar"
        />
      </div>

      {/* Proveedores personalizados */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-xs text-slate-700 dark:text-slate-200">Otros proveedores (compatibles con OpenAI)</div>
            <div className="text-[10px] text-slate-500">DeepSeek, OpenAI, Groq, Gemini, OpenRouter, Ollama local…</div>
          </div>
          <label className="relative shrink-0">
            <span className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer pointer-events-none">
              <Plus size={13} /> Añadir
            </span>
            <select
              aria-label="Añadir proveedor de IA"
              value=""
              onChange={(e) => {
                addFromPreset(e.target.value);
                e.target.value = '';
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            >
              <option value="">Elige una plantilla…</option>
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {providers.length === 0 && (
          <div className="p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-500 text-center">
            Aún no tienes ninguno. Pulsa <b>Añadir</b> y elige, por ejemplo, <b>DeepSeek</b>: se rellenan la URL y el modelo,
            solo falta tu API Key.
          </div>
        )}

        {providers.map((p) => (
          <CustomProviderCard
            key={p.id}
            provider={p}
            isActive={active === p.id}
            hint={presetHint && providers[providers.length - 1]?.id === p.id ? presetHint : undefined}
            onChange={updateProvider}
            onActivate={() => setActive(p.id)}
            onRemove={() => removeProvider(p.id)}
          />
        ))}
      </div>
    </div>
  );
};
