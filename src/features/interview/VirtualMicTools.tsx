import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Settings as SettingsIcon, XCircle, Zap } from 'lucide-react';
import { AudioDeviceInfo } from '../../utils/audioService';
import {
  cleanLabel,
  findVirtualPairs,
  SUGGESTED_MIC_NAME,
  SUGGESTED_OUTPUT_NAME,
  testVirtualMic,
  VirtualMicTestResult
} from './services/virtualMic';
import { isUsableVirtualSink } from './session';

interface VirtualMicToolsProps {
  outputs: AudioDeviceInfo[];
  inputs: AudioDeviceInfo[];
  outputId: string;
  inputId: string;
  onInputChange: (id: string) => void;
  disabled?: boolean;
}

/**
 * Herramientas avanzadas del micrófono virtual (van dentro de «Opciones avanzadas»):
 * elegir la pareja a mano, comprobar que el audio llega, abrir Sonido de Windows y renombrar el cable.
 */
export const VirtualMicTools: React.FC<VirtualMicToolsProps> = ({ outputs, inputs, outputId, inputId, onInputChange, disabled }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<VirtualMicTestResult | null>(null);

  const output = outputs.find((o) => o.id === outputId);
  const input = inputs.find((i) => i.id === inputId);
  const pairs = findVirtualPairs(outputs, inputs);

  // Si cambia la salida o el micrófono, el resultado anterior ya no vale.
  useEffect(() => setResult(null), [outputId, inputId]);

  const handleTest = async () => {
    if (!output || !input || !isUsableVirtualSink(output.id)) {
      setResult({ ok: false, level: 0, message: 'Elige la salida del traductor y su micrófono pareja para poder probar.' });
      return;
    }
    setTesting(true);
    setResult(null);
    setResult(await testVirtualMic(output.id, input.id, { output: cleanLabel(output.label), input: cleanLabel(input.label) }));
    setTesting(false);
  };

  return (
    <div className="space-y-2.5 text-xs">
      <label className="block space-y-1">
        <span className="text-slate-400">Micrófono pareja de la salida (el que verá la otra app)</span>
        <select
          value={inputId}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60"
        >
          <option value="">— elige —</option>
          {inputs
            .filter((i) => i.id !== 'default' && i.id !== 'communications')
            .map((i) => (
              <option key={i.id} value={i.id}>
                {cleanLabel(i.label)}
                {pairs.some((p) => p.input?.id === i.id) ? '  ← pareja del cable' : ''}
              </option>
            ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || disabled}
          title="Envía un tono (silencioso para ti) por la salida y comprueba que llegue al micrófono"
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          Comprobar que el audio llega
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.openSoundPanel?.('recording')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
          title="Abre Sonido de Windows en la pestaña Grabar"
        >
          <SettingsIcon size={13} /> Sonido de Windows (Grabar)
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.openSoundPanel?.('playback')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
          title="Abre Sonido de Windows en la pestaña Reproducción"
        >
          <SettingsIcon size={13} /> Sonido de Windows (Reproducción)
        </button>
      </div>

      {result && (
        <div
          role="status"
          className={`p-2.5 rounded-lg border leading-snug flex items-start gap-2 ${
            result.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          {result.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
          <span>{result.message}</span>
        </div>
      )}

      <p className="text-slate-500 leading-snug">
        ¿Quieres reconocerlo fácil? En <b>Sonido de Windows</b> haz doble clic en el dispositivo → pestaña <b>General</b> y ponle
        el nombre <b>{SUGGESTED_MIC_NAME}</b> (micrófono) o <b>{SUGGESTED_OUTPUT_NAME}</b> (salida). Es solo una etiqueta.
      </p>
    </div>
  );
};
