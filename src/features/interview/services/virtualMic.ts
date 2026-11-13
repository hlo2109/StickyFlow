/**
 * Micrófono virtual de StickyFlow
 * -------------------------------
 * Windows no deja que una app cree dispositivos de audio (hace falta un controlador firmado),
 * así que se usa un cable virtual (VB-CABLE) como motor:
 *
 *      StickyFlow → [salida del cable] ═══▶ [micrófono del cable] → Zoom / Meet / Teams
 *
 * Este módulo encuentra las dos mitades del cable, las empareja y comprueba que el audio llegue de verdad.
 */

import { AudioDeviceInfo } from '../../../utils/audioService';

/** Nombre recomendado al renombrarlo en Windows (así se reconoce fácil en la videollamada). */
export const SUGGESTED_MIC_NAME = 'StickyFlow Entrevista (micrófono)';
export const SUGGESTED_OUTPUT_NAME = 'StickyFlow Entrevista (salida)';

const isDefaultAlias = (d: AudioDeviceInfo) => d.id === 'default' || d.id === 'communications';

/** Quita el prefijo "Default - " / "Communications - " que añade Chromium. */
export function cleanLabel(label: string): string {
  return label.replace(/^(default|communications)\s*-\s*/i, '').trim();
}

/** ¿Parece una salida de cable virtual (VB-CABLE o una ya renombrada como StickyFlow)? */
export function isVirtualOutputLabel(label: string): boolean {
  const l = cleanLabel(label);
  if (/16ch/i.test(l)) return false; // el cable de 16 canales es otro producto
  return /cable input/i.test(l) || /stickyflow/i.test(l);
}

export interface VirtualPair {
  output: AudioDeviceInfo;
  /** La otra mitad (lo que verá la videollamada como micrófono); puede no encontrarse */
  input?: AudioDeviceInfo;
  how: 'nombre' | 'grupo' | 'ninguno';
}

/** Busca la mitad de entrada que corresponde a una salida de cable. */
export function findPairedInput(output: AudioDeviceInfo, inputs: AudioDeviceInfo[]): VirtualPair {
  const candidates = inputs.filter((i) => !isDefaultAlias(i));

  // 1) Por nombre: «CABLE Input (…)» ⇄ «CABLE Output (…)»
  const wanted = cleanLabel(output.label).replace(/input/i, 'output').toLowerCase();
  const byName = candidates.find((i) => cleanLabel(i.label).toLowerCase() === wanted);
  if (byName) return { output, input: byName, how: 'nombre' };

  // 2) Por grupo (sirve cuando se renombraron los dispositivos)
  if (output.groupId) {
    const byGroup = candidates.find((i) => i.groupId && i.groupId === output.groupId);
    if (byGroup) return { output, input: byGroup, how: 'grupo' };
  }

  // 3) Renombrado con StickyFlow en ambos lados: «StickyFlow … (salida)» ⇄ «StickyFlow … (micrófono)»
  if (/stickyflow/i.test(output.label)) {
    const sf = candidates.filter((i) => /stickyflow/i.test(i.label));
    if (sf.length === 1) return { output, input: sf[0], how: 'nombre' };
  }

  return { output, how: 'ninguno' };
}

export function findVirtualPairs(outputs: AudioDeviceInfo[], inputs: AudioDeviceInfo[]): VirtualPair[] {
  return outputs
    .filter((o) => !isDefaultAlias(o) && isVirtualOutputLabel(o.label))
    .map((o) => findPairedInput(o, inputs));
}

export interface VirtualMicTestResult {
  ok: boolean;
  /** Nivel máximo recibido (0–1) */
  level: number;
  message: string;
}

/**
 * Manda un tono (silencioso para ti: solo va al cable) por la salida y comprueba que llegue al micrófono.
 * Si no llega, en la videollamada tampoco te oirían con tu voz traducida.
 */
export async function testVirtualMic(
  sinkId: string,
  inputId: string,
  names: { output: string; input: string }
): Promise<VirtualMicTestResult> {
  if (!sinkId || sinkId === 'default' || sinkId === 'communications') {
    return { ok: false, level: 0, message: 'Elige primero la salida del cable (no vale «Default»).' };
  }
  if (!inputId) {
    return { ok: false, level: 0, message: 'Elige el micrófono que corresponde a esa salida.' };
  }

  let stream: MediaStream | null = null;
  const ctx = new AudioContext();
  const toneCtx = new AudioContext();
  let audio: HTMLAudioElement | null = null;
  let osc: OscillatorNode | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: inputId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const rms = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / buf.length);
    };
    const peak = async (ms: number) => {
      let max = 0;
      const end = Date.now() + ms;
      while (Date.now() < end) {
        max = Math.max(max, rms());
        await new Promise((r) => setTimeout(r, 40));
      }
      return max;
    };

    const baseline = await peak(500);

    // Tono de 440 Hz hacia la salida del cable
    osc = toneCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 440;
    const gain = toneCtx.createGain();
    gain.gain.value = 0.2;
    const dest = toneCtx.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    audio = new Audio();
    audio.srcObject = dest.stream;
    await (audio as any).setSinkId(sinkId);
    await audio.play();
    await new Promise((r) => setTimeout(r, 400));
    const during = await peak(1200);

    const ok = during > 0.01 && during > baseline * 4;
    if (ok) {
      return {
        ok: true,
        level: during,
        message: `✓ Funciona: lo que StickyFlow envía a «${names.output}» llega a «${names.input}». En Zoom/Meet elige «${names.input}» como micrófono.`
      };
    }
    return {
      ok: false,
      level: during,
      message:
        `✗ No llega audio de «${names.output}» a «${names.input}». ` +
        'Revisa en Windows (Sonido → Grabar → ese micrófono → Propiedades): que no esté silenciado, que el nivel no esté a 0 ' +
        'y que sea la pareja correcta de la salida. Si todo está bien, reinicia el servicio de audio o reinstala el cable como administrador.'
    };
  } catch (err: any) {
    return {
      ok: false,
      level: 0,
      message: `No se pudo hacer la prueba: ${err?.message || 'error de audio'}. Comprueba que el dispositivo exista y que Windows permita el micrófono a las apps de escritorio.`
    };
  } finally {
    try { audio?.pause(); } catch { /* ya detenido */ }
    try { osc?.stop(); } catch { /* ya detenido */ }
    stream?.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    toneCtx.close().catch(() => {});
  }
}
