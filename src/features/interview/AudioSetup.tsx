import React, { useState } from 'react';
import { Copy, ChevronRight, ChevronDown } from 'lucide-react';
import { VirtualMicSetup } from './useVirtualMicSetup';
import { VirtualMicTools } from './VirtualMicTools';
import { cleanLabel } from './services/virtualMic';
import { isUsableVirtualSink } from './session';

interface AudioSetupProps {
  setup: VirtualMicSetup;
  disabled?: boolean;
  /** Texto de la opción «sin salida» */
  noneLabel: string;
  /** Algo a la derecha de los dos selectores (p. ej. «Hablar automático») */
  rightSlot?: React.ReactNode;
  /** Contenido extra dentro de «Opciones avanzadas» (p. ej. «Audio de ellos» en Entrevista) */
  advanced?: React.ReactNode;
  /** Ecos de tu propia voz filtrados (solo Entrevista) */
  echoesBlocked?: number;
}

const selectClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 disabled:opacity-60';

/**
 * Configuración de audio, lo mínimo:
 *   • Mi micrófono            → el tuyo de siempre
 *   • Salida del traductor    → por dónde habla tu voz traducida (el cable)
 * y una línea que dice QUÉ ELEGIR en Zoom / Meet / WhatsApp. Lo demás está en «Opciones avanzadas».
 */
export const AudioSetup: React.FC<AudioSetupProps> = ({ setup, disabled, noneLabel, rightSlot, advanced, echoesBlocked }) => {
  const [copied, setCopied] = useState(false);

  const sinkOk = isUsableVirtualSink(setup.outputId) && setup.outputs.some((o) => o.id === setup.outputId);
  const paired = setup.mics.find((m) => m.id === setup.virtualInputId);
  const cableExists = setup.outputs.some((o) => /cable input/i.test(o.label));

  const handleCopy = () => {
    if (!paired) return;
    const text = cleanLabel(paired.label);
    if (window.electronAPI?.writeClipboard) window.electronAPI.writeClipboard(text);
    else navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="px-4 py-3 border-b border-slate-800 space-y-2 shrink-0 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label className="space-y-1">
          <span className="text-slate-400">Mi micrófono</span>
          <select value={setup.micId} onChange={(e) => setup.setMicId(e.target.value)} disabled={disabled} className={selectClass}>
            {setup.mics.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-slate-400">Salida del traductor <span className="text-slate-500">(por aquí habla tu voz traducida)</span></span>
          <select value={setup.outputId} onChange={(e) => setup.changeOutput(e.target.value)} disabled={disabled} className={selectClass}>
            <option value="">{noneLabel}</option>
            {setup.outputs
              .filter((d) => isUsableVirtualSink(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
          </select>
        </label>

        {rightSlot}
      </div>

      {/* Qué elegir en la otra app */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        {sinkOk && paired ? (
          <>
            <span className="text-slate-300">
              👉 En Zoom, Meet, WhatsApp o Teams elige como micrófono: <b className="text-white">{cleanLabel(paired.label)}</b>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Copy size={11} /> {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </>
        ) : sinkOk ? (
          <span className="text-amber-300">
            Elige en esa app el micrófono que corresponde a esta salida (si es VB-CABLE, «CABLE Output»). Puedes indicarlo en
            «Opciones avanzadas».
          </span>
        ) : cableExists ? (
          <span className="text-amber-300">Elige como salida «CABLE Input» para que el traductor pueda hablar. Sin ella solo verás subtítulos.</span>
        ) : (
          <span className="text-amber-300">
            No encuentro el cable virtual. Instala <b>VB-CABLE</b> (gratis, vb-audio.com/Cable) y reinicia StickyFlow. Sin él solo verás subtítulos.
          </span>
        )}
        {echoesBlocked ? (
          <span className="text-sky-400 text-[11px]" title="Veces que tu propia voz traducida volvió a entrar por el audio del sistema y se descartó">
            🔇 {echoesBlocked} eco{echoesBlocked === 1 ? '' : 's'} de tu voz filtrado{echoesBlocked === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <AdvancedBox>
        <VirtualMicTools
          outputs={setup.outputs}
          inputs={setup.mics}
          outputId={setup.outputId}
          inputId={setup.virtualInputId}
          onInputChange={setup.changeVirtualInput}
          disabled={disabled}
        />
        {advanced}
      </AdvancedBox>
    </div>
  );
};

/** «Opciones avanzadas» plegado por defecto: lo normal es no tener que tocarlo. */
const AdvancedBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Opciones avanzadas
      </button>
      {open && <div className="mt-2 pl-3 border-l border-slate-800 space-y-3">{children}</div>}
    </div>
  );
};
