import React, { useEffect, useState } from 'react';
import { Keyboard, Pin, Loader2 } from 'lucide-react';
import { AppSettings } from '../../../types';

interface QuickAccessSectionProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; title: string; hint: string; disabled?: boolean }> = ({
  checked,
  onChange,
  title,
  hint,
  disabled
}) => (
  <div className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-60' : ''}`}>
    <div>
      <span className="font-semibold block text-slate-700 dark:text-slate-200">{title}</span>
      <span className="text-[10px] text-slate-500">{hint}</span>
    </div>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
    />
  </div>
);

/**
 * Acceso rápido a Reunión, Entrevista y Nota de voz SIN abrir notas ni entrar a Ajustes:
 * atajos de teclado globales, accesos directos para la barra de tareas e inicio con Windows.
 */
export const QuickAccessSection: React.FC<QuickAccessSectionProps> = ({ formData, setFormData }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [busyShortcuts, setBusyShortcuts] = useState<{ registered: string[]; failed: string[] } | null>(null);

  useEffect(() => {
    window.electronAPI?.getShortcutStatus?.().then(setBusyShortcuts).catch(() => {});
  }, [formData.quickShortcuts]);

  const handleCreate = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await window.electronAPI?.createShortcuts?.();
      if (!res) {
        setMessage('No se pudieron crear los accesos directos.');
      } else if (res.failed.length > 0 && res.created.length === 0) {
        setMessage('Windows no permitió crear los accesos directos en el escritorio.');
      } else {
        setMessage(
          `✓ Creados ${res.created.length} accesos directos en el escritorio. Para anclarlos a la barra: clic derecho sobre uno → «Mostrar más opciones» → «Anclar a la barra de tareas».`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
      <div>
        <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Keyboard size={14} className="text-sky-500" /> Acceso rápido a Reunión, Entrevista y Nota de voz
        </span>
        <span className="text-[10px] text-slate-500">Sin abrir notas ni entrar a Ajustes.</span>
      </div>

      <Toggle
        checked={formData.quickShortcuts !== false}
        onChange={(v) => setFormData({ ...formData, quickShortcuts: v })}
        title="Atajos de teclado globales"
        hint="Ctrl+Alt+R Reunión · Ctrl+Alt+E Entrevista · Ctrl+Alt+V Nota de voz (funcionan aunque la app esté en segundo plano)"
      />
      {busyShortcuts && busyShortcuts.failed.length > 0 && formData.quickShortcuts !== false && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠ Otra aplicación ya usa: {busyShortcuts.failed.join(', ')}. Esos atajos no funcionarán.
        </div>
      )}

      <Toggle
        checked={Boolean(formData.startWithWindows)}
        onChange={(v) => setFormData({ ...formData, startWithWindows: v })}
        title="Iniciar con Windows"
        hint="Así el icono y los atajos están siempre listos (solo en la versión instalada)"
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          title="Crea en el escritorio un acceso directo para cada uno, listos para anclar a la barra de tareas"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Pin size={12} />}
          Crear accesos directos (para la barra de tareas)
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.openTaskbarSettings?.()}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-medium cursor-pointer"
          title="Windows esconde por defecto los iconos nuevos tras la flecha ^. Ahí puedes activar «StickyFlow» para verlo siempre."
        >
          Mostrar siempre el icono junto al reloj
        </button>
      </div>
      {message && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-snug">{message}</div>}
    </div>
  );
};
