/**
 * SpeechSegmenter
 * ---------------
 * Corta un MediaStream en frases usando detección de voz (VAD por energía),
 * en lugar de cortar cada N segundos con el reloj (lo que partía palabras a la mitad).
 *
 * Funcionamiento:
 *  - Hay SIEMPRE un MediaRecorder activo. Así, cuando alguien empieza a hablar, el audio
 *    ya lleva unos instantes grabados y no se pierde el comienzo de la primera palabra.
 *  - Mientras hay silencio, el grabador se descarta y se reinicia cada `idleRestartMs`.
 *  - Cuando hay voz y luego `silenceMs` de silencio, se cierra el segmento y se emite.
 *  - Si alguien habla sin parar, se corta en `maxSegmentMs` para no acumular retraso.
 *  - El umbral de ruido se adapta solo al nivel del ambiente.
 */

export type AudioSource = 'mic' | 'system';

export interface MeetingSegment {
  id: string;
  source: AudioSource;
  blob: Blob;
  /** Marca de tiempo (ms epoch) del inicio del segmento */
  startedAt: number;
  durationMs: number;
}

export interface SegmenterOptions {
  source: AudioSource;
  audioContext: AudioContext;
  stream: MediaStream;
  onSegment: (segment: MeetingSegment) => void;
  /** Silencio necesario para cerrar una frase */
  silenceMs?: number;
  /** Voz mínima acumulada para considerar que el segmento vale la pena */
  minSpeechMs?: number;
  /** Duración máxima de un segmento aunque se siga hablando */
  maxSegmentMs?: number;
  /** Cada cuánto se reinicia el grabador mientras solo hay silencio */
  idleRestartMs?: number;
}

const TICK_MS = 50;
const MIN_THRESHOLD = 0.012;

function pickMimeType(): string {
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
}

export class SpeechSegmenter {
  private readonly opts: Required<Omit<SegmenterOptions, 'audioContext' | 'stream' | 'onSegment' | 'source'>>;
  private readonly source: AudioSource;
  private readonly stream: MediaStream;
  private readonly onSegment: (segment: MeetingSegment) => void;
  private readonly analyser: AnalyserNode;
  private readonly sourceNode: MediaStreamAudioSourceNode;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private readonly mimeType = pickMimeType();

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recorderStartedAt = 0;

  private noiseFloor = 0.004;
  private speechMs = 0;
  private silenceRunMs = 0;
  private inSpeech = false;
  private running = false;

  constructor(options: SegmenterOptions) {
    this.source = options.source;
    this.stream = options.stream;
    this.onSegment = options.onSegment;
    this.opts = {
      silenceMs: options.silenceMs ?? 700,
      minSpeechMs: options.minSpeechMs ?? 250,
      maxSegmentMs: options.maxSegmentMs ?? 20000,
      idleRestartMs: options.idleRestartMs ?? 2000
    };

    this.analyser = options.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buffer = new Float32Array(this.analyser.fftSize);
    // Solo se analiza: NO se conecta a los altavoces para no generar eco.
    this.sourceNode = options.audioContext.createMediaStreamSource(options.stream);
    this.sourceNode.connect(this.analyser);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.beginRecorder();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Detiene todo y emite lo que quedaba en curso si tenía voz suficiente. */
  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    await this.closeRecorder(this.speechMs >= this.opts.minSpeechMs);
    try { this.sourceNode.disconnect(); } catch { /* ya desconectado */ }
  }

  // ---------------------------------------------------------------------------

  private currentLevel(): number {
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    return Math.sqrt(sum / this.buffer.length);
  }

  private tick(): void {
    const level = this.currentLevel();
    const threshold = Math.max(MIN_THRESHOLD, this.noiseFloor * 3);
    const isVoice = level > threshold;

    if (isVoice) {
      this.inSpeech = true;
      this.speechMs += TICK_MS;
      this.silenceRunMs = 0;
    } else {
      // El piso de ruido solo se actualiza cuando NO hay voz.
      this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05;
      if (this.inSpeech) this.silenceRunMs += TICK_MS;
    }

    const age = Date.now() - this.recorderStartedAt;

    if (this.inSpeech && this.silenceRunMs >= this.opts.silenceMs) {
      void this.rotate(this.speechMs >= this.opts.minSpeechMs);
    } else if (this.inSpeech && age >= this.opts.maxSegmentMs) {
      void this.rotate(true);
    } else if (!this.inSpeech && age >= this.opts.idleRestartMs) {
      void this.rotate(false);
    }
  }

  private rotating = false;

  /** Cierra el grabador actual (emitiendo o descartando) y abre uno nuevo. */
  private async rotate(emit: boolean): Promise<void> {
    if (this.rotating) return;
    this.rotating = true;
    // El nuevo grabador arranca de inmediato para no perder audio mientras se cierra el anterior.
    const old = this.detachRecorder();
    this.resetCounters();
    if (this.running) this.beginRecorder();
    await this.finishDetached(old, emit);
    this.rotating = false;
  }

  private resetCounters(): void {
    this.speechMs = 0;
    this.silenceRunMs = 0;
    this.inSpeech = false;
  }

  private beginRecorder(): void {
    this.chunks = [];
    this.recorderStartedAt = Date.now();
    try {
      const rec = new MediaRecorder(this.stream, { mimeType: this.mimeType });
      const myChunks = this.chunks;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) myChunks.push(e.data);
      };
      rec.start(200);
      this.recorder = rec;
    } catch (err) {
      console.warn(`[SpeechSegmenter:${this.source}] no se pudo iniciar el grabador:`, err);
      this.recorder = null;
    }
  }

  private detachRecorder() {
    const detached = {
      rec: this.recorder,
      chunks: this.chunks,
      startedAt: this.recorderStartedAt
    };
    this.recorder = null;
    return detached;
  }

  private finishDetached(
    d: { rec: MediaRecorder | null; chunks: Blob[]; startedAt: number },
    emit: boolean
  ): Promise<void> {
    return new Promise((resolve) => {
      const { rec, chunks, startedAt } = d;
      if (!rec || rec.state === 'inactive') {
        resolve();
        return;
      }
      rec.onstop = () => {
        if (emit && chunks.length > 0) {
          const blob = new Blob(chunks, { type: this.mimeType });
          if (blob.size > 800) {
            this.onSegment({
              id: `seg-${this.source}-${startedAt}`,
              source: this.source,
              blob,
              startedAt,
              durationMs: Date.now() - startedAt
            });
          }
        }
        resolve();
      };
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
  }

  private async closeRecorder(emit: boolean): Promise<void> {
    const d = this.detachRecorder();
    this.resetCounters();
    await this.finishDetached(d, emit);
  }
}
