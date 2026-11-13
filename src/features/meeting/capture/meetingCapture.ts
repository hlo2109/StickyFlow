/**
 * MeetingCapture
 * --------------
 * Captura el audio de una reunión en DOS pistas separadas:
 *   - 'system': lo que suena en el PC (los demás participantes), vía loopback de Windows.
 *   - 'mic'   : tu micrófono, con cancelación de eco y reducción de ruido.
 *
 * Separadas, cada frase llega etiquetada y se transcribe en su propio idioma
 * (por ejemplo: tú en español, ellos en inglés).
 *
 * RAPIDEZ: arrancar la captura del audio del sistema tarda ~1 s en Windows (2 s en frío) y no se puede
 * acelerar, así que `prepare()` la deja LISTA en cuanto se abre la pantalla. Al pulsar «Iniciar»
 * solo se arrancan los procesadores de audio (instantáneo). Además, sistema y micrófono se piden en
 * paralelo (antes uno esperaba al otro).
 */

import { SpeechSegmenter, MeetingSegment } from './speechSegmenter';

export type { MeetingSegment, AudioSource } from './speechSegmenter';

export interface PrepareOptions {
  micDeviceId?: string;
  /**
   * Fuente del audio de los demás. Vacío = audio del sistema (loopback: captura TODO lo que suena, incluida
   * tu propia voz traducida). Con un id de dispositivo de entrada (p. ej. la salida de un cable virtual)
   * se captura SOLO ese dispositivo, sin mezclar nada más.
   */
  systemDeviceId?: string;
}

export interface StartCaptureOptions extends PrepareOptions {
  /** Se llama cada vez que se completa una frase. Si no se pasa, igual se acumulan en getSegments(). */
  onSegment?: (segment: MeetingSegment) => void;
  /** Silencio (ms) que cierra una frase. Menos = responde antes pero puede partir frases con pausas. */
  silenceMs?: number;
}

type Prepared = { key: string; stream: MediaStream };

const systemKey = (o: PrepareOptions) => o.systemDeviceId || 'loopback';
const micKey = (o: PrepareOptions) => o.micDeviceId || 'default';
const isLive = (s: MediaStream) => s.getTracks().length > 0 && s.getTracks().every((t) => t.readyState === 'live');

async function acquireSystem(o: PrepareOptions): Promise<MediaStream | null> {
  try {
    if (o.systemDeviceId) {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: o.systemDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false
      });
    }
    // Electron exige pedir también el video en el loopback; se descarta enseguida.
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        // @ts-ignore: opciones propias de Chromium
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false
      }
    });
    display.getVideoTracks().forEach((t) => t.stop());
    const audioTracks = display.getAudioTracks();
    return audioTracks.length > 0 ? new MediaStream(audioTracks) : null;
  } catch (e) {
    console.warn('[MeetingCapture] sin audio del sistema:', e);
    return null;
  }
}

async function acquireMic(o: PrepareOptions): Promise<MediaStream | null> {
  try {
    // Micrófono con procesado de voz para evitar eco y ruido de fondo.
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(o.micDeviceId ? { deviceId: { exact: o.micDeviceId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  } catch (e) {
    console.warn('[MeetingCapture] sin micrófono:', e);
    return null;
  }
}

export class MeetingCapture {
  private audioCtx: AudioContext | null = null;
  private segmenters: SpeechSegmenter[] = [];
  private streams: MediaStream[] = [];
  private segments: MeetingSegment[] = [];
  private capturing = false;

  private prepared: { system?: Prepared; mic?: Prepared } = {};
  /** Cadena de preparaciones: si se pide varias seguidas (p. ej. cambiar de micrófono), se hacen de una en una. */
  private preparing: Promise<void> = Promise.resolve();

  public getIsCapturing(): boolean {
    return this.capturing;
  }

  /** ¿Hay una captura del sistema ya lista para arrancar al instante? */
  public isPrepared(o: PrepareOptions = {}): boolean {
    const sys = this.prepared.system;
    return Boolean(sys && sys.key === systemKey(o) && isLive(sys.stream));
  }

  /** Todas las frases capturadas hasta ahora, en orden cronológico. */
  public getSegments(): MeetingSegment[] {
    return [...this.segments].sort((a, b) => a.startedAt - b.startedAt);
  }

  // ------------------------------------------------------------------ preparación

  /**
   * Deja listas las entradas de audio (sistema y micrófono) sin empezar a procesar nada.
   * Es seguro llamarla varias veces: reutiliza lo que ya está listo y solo pide lo que falte o cambió.
   */
  public prepare(o: PrepareOptions = {}): Promise<void> {
    this.preparing = this.preparing.then(() => this.doPrepare(o)).catch(() => {});
    return this.preparing;
  }

  private async doPrepare(o: PrepareOptions): Promise<void> {
    if (this.capturing) return;
    const tasks: Promise<void>[] = [];

    const sys = this.prepared.system;
    if (!(sys && sys.key === systemKey(o) && isLive(sys.stream))) {
      this.dropPrepared('system');
      tasks.push(
        acquireSystem(o).then((stream) => {
          if (stream) this.prepared.system = { key: systemKey(o), stream };
        })
      );
    }

    const mic = this.prepared.mic;
    if (!(mic && mic.key === micKey(o) && isLive(mic.stream))) {
      this.dropPrepared('mic');
      tasks.push(
        acquireMic(o).then((stream) => {
          if (stream) this.prepared.mic = { key: micKey(o), stream };
        })
      );
    }

    await Promise.all(tasks);
  }

  private dropPrepared(kind: 'system' | 'mic'): void {
    this.prepared[kind]?.stream.getTracks().forEach((t) => t.stop());
    delete this.prepared[kind];
  }

  /** Libera lo preparado (al cerrar la pantalla): se apaga la captura y el micrófono. */
  public release(): void {
    this.preparing = this.preparing.then(() => {
      this.dropPrepared('system');
      this.dropPrepared('mic');
    });
  }

  /** Usa lo preparado si coincide; si no, lo pide ahora. */
  private async take(kind: 'system' | 'mic', o: PrepareOptions): Promise<MediaStream | null> {
    const p = this.prepared[kind];
    const key = kind === 'system' ? systemKey(o) : micKey(o);
    if (p && p.key === key && isLive(p.stream)) {
      delete this.prepared[kind]; // pasa a ser de la captura en curso
      return p.stream;
    }
    this.dropPrepared(kind);
    return kind === 'system' ? acquireSystem(o) : acquireMic(o);
  }

  // ------------------------------------------------------------------ captura

  public async startCapture(
    options: StartCaptureOptions = {}
  ): Promise<{ success: boolean; error?: string; micAvailable?: boolean; systemAvailable?: boolean; preparedAhead?: boolean }> {
    if (this.capturing) return { success: true };

    try {
      this.segments = [];
      await this.preparing; // por si hay una preparación en curso, se aprovecha en vez de pedirla otra vez
      const preparedAhead = this.isPrepared(options);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();

      const handleSegment = (segment: MeetingSegment) => {
        this.segments.push(segment);
        options.onSegment?.(segment);
      };

      // Sistema y micrófono EN PARALELO (antes uno esperaba al otro).
      const [system, mic] = await Promise.all([this.take('system', options), this.take('mic', options)]);

      for (const [source, stream] of [['system', system], ['mic', mic]] as const) {
        if (!stream) continue;
        this.streams.push(stream);
        this.segmenters.push(
          new SpeechSegmenter({
            source,
            audioContext: this.audioCtx,
            stream,
            onSegment: handleSegment,
            ...(options.silenceMs ? { silenceMs: options.silenceMs } : {})
          })
        );
      }

      if (!system && !mic) {
        await this.cleanup();
        return {
          success: false,
          error:
            'No se pudo acceder ni al audio del sistema ni al micrófono. Revisa los permisos de Windows (Privacidad → Micrófono).'
        };
      }

      this.capturing = true;
      this.segmenters.forEach((s) => s.start());
      return { success: true, micAvailable: Boolean(mic), systemAvailable: Boolean(system), preparedAhead };
    } catch (err: any) {
      await this.cleanup();
      return { success: false, error: err?.message || 'No se pudo iniciar la captura de audio.' };
    }
  }

  /** Detiene la captura y entrega las últimas frases pendientes por el mismo callback. */
  public async stop(): Promise<void> {
    if (!this.capturing) return;
    this.capturing = false;
    await Promise.all(this.segmenters.map((s) => s.stop()));
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.segmenters = [];
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    this.streams = [];
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { await this.audioCtx.close(); } catch { /* ya cerrado */ }
    }
    this.audioCtx = null;
  }
}

export const meetingCapture = new MeetingCapture();
