import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle, Zap } from 'lucide-react';
import { ConnectionTestResult } from '../../../ai/connectionTest';

interface ConnectionTestButtonProps {
  /** Ejecuta la prueba con lo que haya ahora en el formulario */
  onTest: () => Promise<ConnectionTestResult>;
  /** Si cambia, se borra el resultado anterior (porque la configuración ya no es la que se probó) */
  resetKey: string;
  disabled?: boolean;
  disabledReason?: string;
}

/** Botón «Probar conexión»: muestra si el proveedor responde, en cuánto tiempo, o por qué falla. */
export const ConnectionTestButton: React.FC<ConnectionTestButtonProps> = ({
  onTest,
  resetKey,
  disabled,
  disabledReason
}) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    setResult(null);
  }, [resetKey]);

  const handleClick = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await onTest());
    } catch (err: any) {
      setResult({ ok: false, ms: 0, message: err?.message || 'Error inesperado al probar.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={running || disabled}
        title={disabled ? disabledReason : 'Envía una petición mínima para comprobar clave, modelo y conexión'}
        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="text-yellow-300" />}
        {running ? 'Probando…' : 'Probar conexión'}
      </button>

      {result && (
        <div
          role="status"
          className={`p-2 rounded-lg border text-[11px] flex items-start gap-1.5 leading-snug ${
            result.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {result.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <XCircle size={13} className="shrink-0 mt-0.5" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
};
