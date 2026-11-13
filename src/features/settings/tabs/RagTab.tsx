import React, { useState } from 'react';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { AppSettings } from '../../../types';
import { SettingsTabProps } from '../types';

/** Base de conocimiento remota con Cloudflare (opcional). */
export const RagTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  const [showCfToken, setShowCfToken] = useState(false);

  return (
    <div className="space-y-3 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Zap size={16} className="text-blue-500" />
          RAG & Sincronización de Conocimiento (Cloudflare)
        </h4>
        <p className="text-[11px] text-slate-500">
          Sincroniza tus notas con Cloudflare Vectorize o Workers AI para respuestas semánticas ultrarrápidas sobre todas tus notas.
        </p>
      </div>

      <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
        <div>
          <span className="font-semibold block text-blue-900 dark:text-blue-200">Activar RAG Cloudflare</span>
          <span className="text-[10px] text-blue-700 dark:text-blue-300">Permite buscar conocimiento semántico en tu base de notas</span>
        </div>
        <input
          type="checkbox"
          checked={formData.enableCloudflareRag || false}
          onChange={(e) => setFormData({ ...formData, enableCloudflareRag: e.target.checked })}
          className="w-4 h-4 rounded text-blue-600"
        />
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Cloudflare Account ID</label>
          <input
            type="text"
            value={formData.cloudflareAccountId || ''}
            onChange={(e) => setFormData({ ...formData, cloudflareAccountId: e.target.value })}
            placeholder="Tu Account ID de Cloudflare"
            className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Cloudflare API Token / Worker Key</label>
          <div className="relative flex items-center">
            <input
              type={showCfToken ? 'text' : 'password'}
              value={formData.cloudflareApiToken || ''}
              onChange={(e) => setFormData({ ...formData, cloudflareApiToken: e.target.value })}
              placeholder="Token con permisos Workers AI / Vectorize"
              className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
            />
            <button
              type="button"
              onClick={() => setShowCfToken(!showCfToken)}
              className="absolute right-2 text-slate-400"
            >
              {showCfToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 block mb-0.5">Vectorize Index Name / Endpoint RAG</label>
          <input
            type="text"
            value={formData.cloudflareRagEndpoint || ''}
            onChange={(e) => setFormData({ ...formData, cloudflareRagEndpoint: e.target.value })}
            placeholder="https://tu-worker-rag.workers.dev o nombre del índice"
            className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
          />
        </div>
      </div>

      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[11px] text-slate-500 leading-relaxed border border-slate-200 dark:border-slate-700">
        💡 <em>Nota: Si no configuras Cloudflare, la app utiliza automáticamente el motor RAG local integrado para consultar entre todas tus notas sin enviar nada fuera.</em>
      </div>
    </div>
  );
};
