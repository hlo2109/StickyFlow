import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { AppSettings } from '../../../types';
import { SettingsTabProps } from '../types';

/** Enmascarado de datos sensibles antes de enviarlos a la IA. */
export const PrivacyTab: React.FC<SettingsTabProps> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-3 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <ShieldCheck size={16} className="text-amber-500" />
          Privacidad Estricta & Seguridad de Datos
        </h4>
        <p className="text-[11px] text-slate-500">
          Controla qué datos pueden salir hacia los modelos de IA para garantizar que tus contraseñas y claves nunca se filtren.
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
          <div>
            <span className="font-semibold block text-amber-900 dark:text-amber-200">Enmascaramiento Automático de Secretos</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300">
              Oculta automáticamente claves API (`hf_...`, `sk-...`), contraseñas y tokens Bearer antes de enviar la nota a la IA.
            </span>
          </div>
          <input
            type="checkbox"
            checked={formData.enablePrivacyMasking !== false}
            onChange={(e) => setFormData({ ...formData, enablePrivacyMasking: e.target.checked })}
            className="w-4 h-4 rounded text-amber-600"
          />
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
          <span className="font-semibold block text-slate-700 dark:text-slate-300">Garantía de Privacidad Local:</span>
          <ul className="list-disc pl-4 space-y-1 text-slate-500">
            <li>Todas tus notas se guardan en tu disco duro (`Documentos\StickyFlow_Notas`).</li>
            <li>No existe telemetría ni rastreo de uso.</li>
            <li>Las llamadas a Hugging Face o Claude solo se ejecutan cuando tú presionas el botón explícitamente.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
