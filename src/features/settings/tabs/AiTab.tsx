import React, { useState } from 'react';
import { Settings, Sparkles, Bot, Eye, EyeOff } from 'lucide-react';
import { AppSettings } from '../../../types';
import { SettingsTabProps } from '../types';

/** Proveedor de IA, modelos y claves (Hugging Face / Claude). */
export const AiTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  const [showHfKey, setShowHfKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);

  return (
    <div className="space-y-3.5 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sparkles size={16} className="text-purple-600" />
          Configuración de Inteligencia Artificial
        </h4>
        <p className="text-[11px] text-slate-500">Selecciona tu proveedor principal e introduce tus claves.</p>
      </div>

      {/* Provider Selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, activeAiProvider: 'huggingface' })}
          className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
            formData.activeAiProvider === 'huggingface'
              ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 font-bold'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles size={16} className="text-purple-600" />
          <div>
            <div className="text-xs">Hugging Face</div>
            <div className="text-[10px] text-slate-500 font-normal">Qwen 2.5 72B (Gratuito)</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFormData({ ...formData, activeAiProvider: 'claude' })}
          className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
            formData.activeAiProvider === 'claude'
              ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 font-bold'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Bot size={16} className="text-amber-600" />
          <div>
            <div className="text-xs">Claude (Anthropic)</div>
            <div className="text-[10px] text-slate-500 font-normal">Claude 3.5 Sonnet</div>
          </div>
        </button>
      </div>

      {/* Hugging Face Settings */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Hugging Face Router</span>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Endpoint</label>
          <input
            type="text"
            value={formData.hfEndpoint}
            onChange={(e) => setFormData({ ...formData, hfEndpoint: e.target.value })}
            className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
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
            className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
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
              className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
            />
            <button
              type="button"
              onClick={() => setShowHfKey(!showHfKey)}
              className="absolute right-2 text-slate-400"
            >
              {showHfKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Claude Settings */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Claude (Anthropic)</span>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">API Key de Anthropic (sk-ant-...)</label>
          <div className="relative flex items-center">
            <input
              type={showClaudeKey ? 'text' : 'password'}
              value={formData.claudeApiKey}
              onChange={(e) => setFormData({ ...formData, claudeApiKey: e.target.value })}
              placeholder="sk-ant-..."
              className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
            />
            <button
              type="button"
              onClick={() => setShowClaudeKey(!showClaudeKey)}
              className="absolute right-2 text-slate-400"
            >
              {showClaudeKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
