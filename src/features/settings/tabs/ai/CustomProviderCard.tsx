import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, CheckCircle2 } from 'lucide-react';
import { CustomAiProvider } from '../../../../types';
import { testCustomProvider } from '../../../ai/connectionTest';
import { isLocalUrl } from '../../../ai/presets';
import { ConnectionTestButton } from './ConnectionTestButton';

interface CustomProviderCardProps {
  provider: CustomAiProvider;
  isActive: boolean;
  hint?: string;
  onChange: (provider: CustomAiProvider) => void;
  onActivate: () => void;
  onRemove: () => void;
}

const inputClass =
  'w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs';

/** Un proveedor compatible con OpenAI (DeepSeek, OpenAI, Groq, Ollama…): sus datos, su prueba y sus acciones. */
export const CustomProviderCard: React.FC<CustomProviderCardProps> = ({
  provider,
  isActive,
  hint,
  onChange,
  onActivate,
  onRemove
}) => {
  const [showKey, setShowKey] = useState(false);
  const update = (partial: Partial<CustomAiProvider>) => onChange({ ...provider, ...partial });
  const local = isLocalUrl(provider.baseUrl);
  const incomplete = !provider.baseUrl.trim() || !provider.model.trim() || (!provider.apiKey.trim() && !local);

  return (
    <div
      className={`p-3 rounded-lg border space-y-2 ${
        isActive
          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-400 dark:border-sky-700'
          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={provider.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Nombre (p. ej. DeepSeek)"
          className="font-semibold text-xs text-slate-700 dark:text-slate-200 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:outline-none focus:border-sky-500 flex-1 min-w-0"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive ? (
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1">
              <CheckCircle2 size={12} /> En uso
            </span>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-semibold cursor-pointer"
            >
              Usar este
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Eliminar el proveedor «${provider.name || 'sin nombre'}»?`)) onRemove();
            }}
            title="Eliminar proveedor"
            className="p-1 rounded text-slate-400 hover:text-red-500 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {hint && <p className="text-[10px] text-slate-500 leading-snug">{hint}</p>}

      <div>
        <label className="text-[11px] text-slate-500 block mb-0.5">URL base</label>
        <input
          type="text"
          value={provider.baseUrl}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder="https://api.deepseek.com"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Modelo</label>
          <input
            type="text"
            value={provider.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder="deepseek-chat"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Modelo rápido (opcional)</label>
          <input
            type="text"
            value={provider.fastModel || ''}
            onChange={(e) => update({ fastModel: e.target.value })}
            placeholder="el mismo"
            title="Para tareas frecuentes como la traducción en vivo y el radar de dudas"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-500 block mb-0.5">
          API Key {local && <span className="text-slate-400">(no necesaria en servidores locales)</span>}
        </label>
        <div className="relative flex items-center">
          <input
            type={showKey ? 'text' : 'password'}
            value={provider.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder={local ? 'opcional' : 'sk-...'}
            autoComplete="off"
            className={`${inputClass} pr-7`}
          />
          <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 text-slate-400 cursor-pointer">
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>

      <ConnectionTestButton
        onTest={() => testCustomProvider(provider)}
        resetKey={`${provider.baseUrl}|${provider.model}|${provider.apiKey}`}
        disabled={incomplete}
        disabledReason="Completa la URL base, el modelo y la API Key para probar"
      />
    </div>
  );
};
