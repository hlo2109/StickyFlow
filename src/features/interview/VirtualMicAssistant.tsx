import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Loader2, Mic, Settings as SettingsIcon, XCircle, Zap } from 'lucide-react';
import { AudioDeviceInfo } from '../../utils/audioService';
import { isUsableVirtualSink } from './session';
import {
  cleanLabel,
  findVirtualPairs,
  SUGGESTED_MIC_NAME,
  SUGGESTED_OUTPUT_NAME,
  testVirtualMic,
  VirtualMicTestResult
} from './services/virtualMic';

interface VirtualMicAssistantProps {
  outputs: AudioDeviceInfo[];
  inputs: AudioDeviceInfo[];
  /** Salida elegida arriba (por donde sale tu voz traducida) */
  outputId: string;
  /** Micrófono virtual (la otra mitad del cable) */
  inputId: string;
  onInputChange: (id: string) => void;
  disabled?: boolean;
}

/**
 * Asistente del micrófono virtual de StickyFlow: empareja las dos mitades del cable, comprueba que el audio
 * llegue y ayuda a ponerle un nombre reconocible («StickyFlow Entrevista») para elegirlo en la videollamada.
 */
export const VirtualMicAssistant: React.FC<VirtualMicAssistantProps> = ({
  outputs,
  inputs,
  outputId,
  inputId,
  onInputChange,
  disabled
}) => {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<VirtualMicTestResult | null>(null);
  const [copied, setCopied] = useState(false);

  const output = outputs.find((o) => o.id === outputId);
  const input = inputs.find((i) => i.id === inputId);
  const outputOk = isUsableVirtualSink(outputId) && Boolean(output);
  const configured = outputOk && Boolean(input);
  const pairs = findVirtualPairs(outputs, inputs);

  // Si cambia la salida o el micrófono, el resultado anterior ya no vale.
  useEffect(() => {
    setResult(null);
  }, [outputId, inputId]);

  // Se abre solo cuando hace falta ayuda: sin configurar o con una prueba fallida.
  useEffect(() => {
    if (!configured || (result && !result.ok)) setOpen(true);
  }, [configured, result]);

  const handleTest = async () => {
    if (!output || !input) {
      setResult({ ok: false, level: 0, message: 'Elige la salida del cable arriba y su micrófono aquí para poder probar.' });
      return;
    }
    setTesting(true);
    setResult(null);
    setResult(await testVirtualMic(output.id, input.id, { output: cleanLabel(output.label), input: cleanLabel(input.label) }));
    setTesting(false);
  };

  const handleCopy = () => {
    const text = input ? cleanLabel(input.label) : SUGGESTED_MIC_NAME;
    if (window.electronAPI?.writeClipboard) window.electronAPI.writeClipboard(text);
    else navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const status = result?.ok
    ? { text: 'Listo y probado', cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', Icon: CheckCircle2 }
    : configured
      ? { text: 'Configurado, sin probar', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/10', Icon: Zap }
      : { text: 'Falta configurar', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/10', Icon: XCircle };

  return (
    <div className="border-b border-slate-800 shrink-0 text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-slate-800/50 cursor-pointer text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Mic size={14} className="text-sky-400" />
        <span className="font-medium">Micrófono virtual de StickyFlow</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] flex items-center gap-1 ${status.cls}`}>
          <status.Icon size={11} /> {status.text}
        </span>
        {configured && input && (
          <span className="text-slate-400 truncate">
            En Zoom/Meet elige: <b className="text-slate-200">{cleanLabel(input.label)}</b>
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2.5">
          <p className="text-slate-400 leading-snug">
            Windows no permite que una app cree un micrófono propio, así que StickyFlow usa un <b>cable virtual</b> (VB-CABLE):
            tu voz traducida entra por su <b>salida</b> y sale por su <b>micrófono</b>, que es el que eliges en la videollamada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-slate-400">Salida (elegida arriba)</span>
              <div className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 truncate">
                {outputOk && output ? cleanLabel(output.label) : '— elige la salida del cable arriba —'}
              </div>
            </div>
            <label className="space-y-1 block">
              <span className="text-slate-400">Micrófono que verá la videollamada (su pareja)</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || disabled}
              title="Envía un tono (silencioso para ti) por la salida y comprueba que llegue al micrófono"
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Probar micrófono virtual
            </button>
            <button
              type="button"
              onClick={() => window.electronAPI?.openSoundPanel?.('recording')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Abre Sonido de Windows en la pestaña Grabar"
            >
              <SettingsIcon size={13} /> Abrir Sonido (Grabar)
            </button>
            <button
              type="button"
              onClick={() => window.electronAPI?.openSoundPanel?.('playback')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Abre Sonido de Windows en la pestaña Reproducción"
            >
              <SettingsIcon size={13} /> Abrir Sonido (Reproducción)
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Copia el nombre que debes elegir en la videollamada"
            >
              <Copy size={13} /> {copied ? '¡Copiado!' : 'Copiar nombre del micrófono'}
            </button>
          </div>

          {result && (
            <div
              role="status"
              className={`p-2.5 rounded-lg border leading-snug flex items-start gap-2 ${
                result.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}
            >
              {result.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}

          <details className="text-slate-400">
            <summary className="cursor-pointer hover:text-slate-200">Ponerle nombre «StickyFlow» para reconocerlo fácil (opcional)</summary>
            <ol className="list-decimal ml-5 mt-1.5 space-y-0.5 leading-snug">
              <li>Pulsa <b>Abrir Sonido (Grabar)</b> → doble clic en el micrófono del cable → pestaña <b>General</b> → Nombre: <b>{SUGGESTED_MIC_NAME}</b>.</li>
              <li>Pulsa <b>Abrir Sonido (Reproducción)</b> → doble clic en la salida del cable → Nombre: <b>{SUGGESTED_OUTPUT_NAME}</b>.</li>
              <li>Vuelve aquí: el asistente los reconoce por el nombre «StickyFlow». (Si no aparecen cambiados, cierra y abre esta ventana.)</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
};
