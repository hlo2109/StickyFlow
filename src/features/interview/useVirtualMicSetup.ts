import { useEffect, useMemo, useState } from 'react';
import { AppSettings } from '../../types';
import { getAudioDevices, AudioDeviceInfo } from '../../utils/audioService';
import { isUsableVirtualSink } from './session';
import { findPairedInput, isVirtualOutputLabel } from './services/virtualMic';

/**
 * Dispositivos de audio para los modos que usan el micrófono virtual (Entrevista y Nota de voz):
 * tu micrófono real, la salida del cable y su micrófono pareja. Se recuerdan entre sesiones.
 */
export function useVirtualMicSetup(settings: AppSettings) {
  const [mics, setMics] = useState<AudioDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<AudioDeviceInfo[]>([]);
  const [micId, setMicId] = useState('');
  const [outputId, setOutputId] = useState(settings.interviewOutputDeviceId || '');
  const [virtualInputId, setVirtualInputId] = useState(settings.interviewVirtualMicInputId || '');

  useEffect(() => {
    getAudioDevices().then(({ inputs, outputs: outs }) => {
      setMics(inputs);
      setOutputs(outs);
      if (inputs.length > 0) setMicId((prev) => prev || inputs[0].id);
      // Autodetectar el cable si todavía no se eligió una salida válida.
      setOutputId((prev) => {
        if (isUsableVirtualSink(prev) && outs.some((o) => o.id === prev)) return prev;
        return outs.find((o) => /cable input/i.test(o.label))?.id ?? '';
      });
    });
  }, []);

  // Empareja el micrófono virtual con la salida elegida (si todavía no hay uno válido).
  useEffect(() => {
    const out = outputs.find((o) => o.id === outputId);
    if (!out || !isVirtualOutputLabel(out.label)) return;
    if (virtualInputId && mics.some((m) => m.id === virtualInputId)) return;
    const pair = findPairedInput(out, mics);
    if (pair.input) setVirtualInputId(pair.input.id);
  }, [outputs, mics, outputId, virtualInputId]);

  const persist = (over: { outputId?: string; virtualInputId?: string }) => {
    window.electronAPI?.saveSettings?.({
      ...settings,
      interviewOutputDeviceId: over.outputId ?? outputId,
      interviewVirtualMicInputId: over.virtualInputId ?? virtualInputId
    });
  };

  const changeOutput = (id: string) => {
    setOutputId(id);
    persist({ outputId: id });
  };

  const changeVirtualInput = (id: string) => {
    setVirtualInputId(id);
    persist({ virtualInputId: id });
  };

  /** Los ajustes con la salida elegida aquí (lo que usan los controladores). */
  const effectiveSettings = useMemo<AppSettings>(
    () => ({ ...settings, interviewOutputDeviceId: outputId, interviewVirtualMicInputId: virtualInputId }),
    [settings, outputId, virtualInputId]
  );

  return { mics, outputs, micId, setMicId, outputId, changeOutput, virtualInputId, changeVirtualInput, effectiveSettings };
}
