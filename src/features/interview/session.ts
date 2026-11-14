/**
 * InterviewSession
 * ----------------
 * Orquesta el modo entrevista, en dos sentidos independientes:
 *
 *   Tú  (micrófono) → texto → traducción al idioma de ellos → tu voz clonada → micrófono virtual
 *   Ellos (audio del sistema) → texto → traducción a tu idioma → subtítulos en pantalla
 *
 * Cada sentido tiene su propia cola: los subtítulos de ellos nunca esperan a que termine de
 * hablar tu voz sintética, y el orden de tus frases se respeta.
 *
 * VELOCIDAD (lo que más se nota en una conversación):
 *  - Cada etapa se MIDE (esperar, transcribir, traducir, generar voz) y se muestra, para saber qué tarda.
 *  - La voz de una respuesta con varias frases se genera EN PARALELO por trozos y la primera suena en cuanto
 *    está lista (en vez de esperar al audio completo).
 *  - En modo manual puede dejarse la voz preparada de antemano: pulsar 🔊 suena al instante.
 *
 * No depende de React ni del navegador: las piezas externas llegan por `deps`, lo que permite
 * probarla con simulaciones.
 */

import { AppSettings } from '../../types';
import { meetingCapture, MeetingSegment } from '../meeting/capture/meetingCapture';
import { speechToText, SttResult } from './services/stt';
import { translateText, TranslateResult } from './services/translate';
import { synthesizeSpeech, SynthOptions } from './services/elevenlabs';
import { SpeechPlayer } from './services/speechPlayer';
import { isLikelyEcho, pruneSpoken, SpokenRecord } from './echoGuard';
import { splitForSpeech } from './sentences';
import { endsSentence, joinText, MAX_JOIN_CHARS } from './joinSegments';

export type LineSide = 'me' | 'them';
/** Tiempos de una frase al llegar: cuándo llegó el audio, cuánto esperó turno y cuánto tardó la transcripción */
interface Timing {
  arrived: number;
  waitMs: number;
  sttMs: number;
}
export type LineStatus = 'translating' | 'ready' | 'error';

/** Cuánto tardó cada etapa de una frase (milisegundos). */
export interface LineTimings {
  /** Esperando turno (otra frase anterior se estaba procesando) */
  waitMs?: number;
  sttMs?: number;
  translateMs?: number;
  /** Hasta tener lista la PRIMERA parte de la voz */
  ttsMs?: number;
  /** Desde que terminaste de hablar hasta que tu voz empieza a sonar (solo en modo automático) */
  totalMs?: number;
}

export interface InterviewLine {
  id: string;
  side: LineSide;
  original: string;
  translation: string;
  status: LineStatus;
  spoken: boolean;
  speaking: boolean;
  /** La voz ya está generada: al pulsar 🔊 suena al instante */
  audioReady?: boolean;
  timings?: LineTimings;
  error?: string;
  at: number;
}

export interface SpeedStats {
  count: number;
  sttMs: number;
  translateMs: number;
  ttsMs: number;
  totalMs: number;
}

export interface InterviewSnapshot {
  lines: InterviewLine[];
  running: boolean;
  /** Arrancando (mientras se conecta el audio): sirve para mostrar «Conectando…» al instante */
  starting: boolean;
  /** Se pueden emitir audios: hay micrófono virtual elegido y claves de ElevenLabs */
  canSpeak: boolean;
  autoSpeak: boolean;
  /** En modo manual, genera la voz en cuanto se traduce (gasta más caracteres, pero 🔊 suena al instante) */
  prefetch: boolean;
  /** Turno manual: lo que dices se junta en un borrador y se traduce TODO junto al pulsar «Traducir» */
  manualTurns: boolean;
  /** Borrador del turno manual (lo transcrito hasta ahora, sin traducir) */
  draft: string;
  speaking: boolean;
  pendingSpeech: number;
  /** Caracteres de voz generados (es lo que cobra ElevenLabs) */
  charsSpoken: number;
  /** Veces que se descartó tu propia voz traducida al volver a entrar por el audio del sistema */
  echoesBlocked: number;
  /** Se usa una fuente aislada para el audio de ellos (no hay riesgo de que entre tu propia voz) */
  isolated: boolean;
  /** Promedios de tiempo de tus frases (para ver dónde está la demora) */
  stats: SpeedStats;
  error: string;
  startedAt: number | null;
}

export interface InterviewDeps {
  speechToText: (blob: Blob, language: string, settings: AppSettings) => Promise<SttResult>;
  translateText: (text: string, from: string, to: string, settings: AppSettings, recent?: string[]) => Promise<TranslateResult>;
  synthesizeSpeech: (text: string, settings: AppSettings, options?: SynthOptions) => Promise<{ audio?: Blob; error?: string }>;
  capture: {
    startCapture: (o: {
      micDeviceId?: string;
      systemDeviceId?: string;
      silenceMs?: number;
      onSegment?: (s: MeetingSegment) => void;
    }) => Promise<{ success: boolean; error?: string }>;
    stop: () => Promise<void>;
  };
  createPlayer: (onChange: (pending: number, speaking: boolean) => void) => Pick<SpeechPlayer, 'setSink' | 'enqueue' | 'stop'>;
}

const defaultDeps: InterviewDeps = {
  speechToText,
  translateText,
  synthesizeSpeech,
  capture: meetingCapture,
  createPlayer: (onChange) => new SpeechPlayer(onChange)
};

/** 'default' y 'communications' son los dispositivos normales de Windows: usarlos provocaría eco y bucles. */
export function isUsableVirtualSink(deviceId?: string): boolean {
  return Boolean(deviceId) && deviceId !== 'default' && deviceId !== 'communications';
}

/** Peticiones de voz simultáneas (los planes de ElevenLabs limitan las concurrentes; 2 cabe en casi todos). */
const TTS_CONCURRENCY = 2;

export interface StartOptions {
  micDeviceId?: string;
  autoSpeak: boolean;
  /** Silencio (ms) que cierra una frase: menos = responde antes (pero puede partir frases con pausas). */
  silenceMs?: number;
  prefetch?: boolean;
  /** Si una frase queda a medias (sin . ? !), espera hasta este tiempo (ms) por si sigues, y traduce todo junto. 0 = no espera. */
  joinMs?: number;
  /** Turno manual: junta todo lo que dices y se traduce al pulsar «Traducir» */
  manualTurns?: boolean;
}

/** Promedio de los tiempos de las frases tuyas que ya tienen medición. */
export function computeStats(lines: InterviewLine[]): SpeedStats {
  const mine = lines.filter((l) => l.side === 'me' && l.timings && l.timings.translateMs !== undefined);
  const avg = (pick: (t: LineTimings) => number | undefined) => {
    const v = mine.map((l) => pick(l.timings as LineTimings)).filter((n): n is number => typeof n === 'number');
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  };
  return {
    count: mine.length,
    sttMs: avg((t) => t.sttMs),
    translateMs: avg((t) => t.translateMs),
    ttsMs: avg((t) => t.ttsMs),
    totalMs: avg((t) => t.totalMs)
  };
}

export class InterviewSession {
  private snapshot: InterviewSnapshot = {
    lines: [],
    running: false,
    starting: false,
    canSpeak: false,
    autoSpeak: true,
    prefetch: false,
    manualTurns: false,
    draft: '',
    speaking: false,
    pendingSpeech: 0,
    charsSpoken: 0,
    echoesBlocked: 0,
    isolated: false,
    stats: { count: 0, sttMs: 0, translateMs: 0, ttsMs: 0, totalMs: 0 },
    error: '',
    startedAt: null
  };

  private listeners = new Set<(s: InterviewSnapshot) => void>();
  private chains: Record<LineSide, Promise<void>> = { me: Promise.resolve(), them: Promise.resolve() };
  private player: ReturnType<InterviewDeps['createPlayer']>;
  private seq = 0;
  /** Lo que mi voz sintética dijo hace poco: sirve para reconocer su eco en el audio del sistema */
  private spoken: SpokenRecord[] = [];
  /** Voz ya generada por línea (trozos en orden): para «voz de antemano» y para repetir sin volver a pagar */
  private audioCache = new Map<string, Blob[]>();
  private arrivedAt = new Map<string, number>();
  private generation = 0; // se incrementa al detener para ignorar trabajo pendiente
  /** Espera máxima por una continuación cuando la frase quedó a medias (0 = desactivado) */
  private joinMs = 0;
  /** Texto de una frase a medias esperando que continúe, por lado */
  private held: Record<LineSide, { text: string; t: Timing } | null> = { me: null, them: null };
  private holdTimers: Record<LineSide, ReturnType<typeof setTimeout> | null> = { me: null, them: null };

  constructor(private getSettings: () => AppSettings, private deps: InterviewDeps = defaultDeps) {
    this.player = deps.createPlayer((pending, speaking) => this.patch({ pendingSpeech: pending, speaking }));
  }

  // ---------------------------------------------------------------- estado

  public subscribe(listener: (s: InterviewSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): InterviewSnapshot {
    return this.snapshot;
  }

  private patch(partial: Partial<InterviewSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.listeners.forEach((l) => l(this.snapshot));
  }

  private updateLine(id: string, partial: Partial<InterviewLine>): void {
    const lines = this.snapshot.lines.map((l) => (l.id === id ? { ...l, ...partial } : l));
    this.patch({ lines, stats: computeStats(lines) });
  }

  private mergeTimings(id: string, t: LineTimings): void {
    const line = this.snapshot.lines.find((l) => l.id === id);
    this.updateLine(id, { timings: { ...(line?.timings ?? {}), ...t } });
  }

  private addLine(side: LineSide, original: string): InterviewLine {
    const line: InterviewLine = {
      id: `ln-${Date.now()}-${++this.seq}`,
      side,
      original,
      translation: '',
      status: 'translating',
      spoken: false,
      speaking: false,
      at: Date.now()
    };
    this.patch({ lines: [...this.snapshot.lines, line] });
    return line;
  }

  private langs() {
    const s = this.getSettings();
    return { mine: s.interviewMyLang || 'es', theirs: s.interviewTheirLang || 'en' };
  }

  private recentOriginals(): string[] {
    return this.snapshot.lines.slice(-6).map((l) => l.original);
  }

  private canSpeakNow(): boolean {
    const s = this.getSettings();
    return isUsableVirtualSink(s.interviewOutputDeviceId) && Boolean(s.elevenLabsApiKey?.trim()) && Boolean(s.elevenLabsVoiceId?.trim());
  }

  // ---------------------------------------------------------------- ciclo de vida

  public clearError(): void {
    this.patch({ error: '' });
  }

  public setAutoSpeak(value: boolean): void {
    this.patch({ autoSpeak: value });
  }

  public setPrefetch(value: boolean): void {
    this.patch({ prefetch: value });
  }

  public async start(options: StartOptions): Promise<{ success: boolean; error?: string }> {
    if (this.snapshot.running || this.snapshot.starting) return { success: true };
    // Feedback inmediato: la pantalla puede mostrar «Conectando…» mientras Windows abre el audio.
    this.patch({ starting: true });
    const settings = this.getSettings();

    const sink = settings.interviewOutputDeviceId;
    const canSpeak = this.canSpeakNow();
    this.player.setSink(canSpeak ? (sink as string) : '');

    this.generation++;
    this.chains = { me: Promise.resolve(), them: Promise.resolve() };
    this.spoken = [];
    this.audioCache.clear();
    this.arrivedAt.clear();
    this.joinMs = Math.max(0, options.joinMs ?? 0);
    this.clearHold('me');
    this.clearHold('them');
    const systemDeviceId = settings.interviewTheirAudioDeviceId?.trim() || undefined;
    this.patch({
      lines: [],
      error: '',
      charsSpoken: 0,
      echoesBlocked: 0,
      stats: { count: 0, sttMs: 0, translateMs: 0, ttsMs: 0, totalMs: 0 },
      isolated: Boolean(systemDeviceId),
      canSpeak,
      autoSpeak: options.autoSpeak && canSpeak,
      prefetch: Boolean(options.prefetch) && canSpeak,
      manualTurns: Boolean(options.manualTurns),
      draft: ''
    });

    const gen = this.generation;
    const res = await this.deps.capture.startCapture({
      micDeviceId: options.micDeviceId,
      systemDeviceId,
      silenceMs: options.silenceMs,
      onSegment: (seg) => {
        if (gen === this.generation) this.enqueueSegment(seg);
      }
    });

    if (!res.success) {
      this.patch({ starting: false, error: res.error || 'No se pudo iniciar la captura de audio.' });
      return { success: false, error: res.error };
    }

    this.patch({ starting: false, running: true, startedAt: Date.now() });
    return { success: true };
  }

  public async stop(): Promise<void> {
    if (!this.snapshot.running) return;
    this.patch({ running: false });
    await this.deps.capture.stop();
    this.flushHeld('me'); // una frase a medias no se pierde al detener
    this.flushHeld('them');
    // Lo ya capturado todavía se traduce y se termina de decir (para no cortar tu última frase);
    // lo que se hable después no. Para cortar el audio al instante está silence().
    await Promise.all([this.chains.me, this.chains.them]);
    this.generation++;
  }

  /** Corta de inmediato lo que tu voz esté diciendo (por ejemplo, si la traducción salió mal). */
  public silence(): void {
    this.player.stop();
    this.patch({ lines: this.snapshot.lines.map((l) => (l.speaking ? { ...l, speaking: false } : l)) });
  }

  // ---------------------------------------------------------------- pipeline

  private enqueueSegment(seg: MeetingSegment): void {
    const side: LineSide = seg.source === 'mic' ? 'me' : 'them';
    const arrived = Date.now();
    this.clearHoldTimer(side); // llegó un trozo nuevo: la frase retenida espera a que se transcriba para unirse
    this.chains[side] = this.chains[side].then(() => this.processSegment(seg, side, arrived)).catch((e) => {
      console.warn('[InterviewSession] error procesando frase:', e);
    });
  }

  private async processSegment(seg: MeetingSegment, side: LineSide, arrived: number): Promise<void> {
    const settings = this.getSettings();
    const { mine, theirs } = this.langs();
    const from = side === 'me' ? mine : theirs;

    const waitMs = Date.now() - arrived;
    const tStt = Date.now();
    const stt = await this.deps.speechToText(seg.blob, from, settings);
    const sttMs = Date.now() - tStt;
    if (!stt.success) {
      this.patch({ error: stt.error || 'No se pudo transcribir el audio.' });
      this.armHold(side);
      return;
    }
    if (!stt.text) {
      this.armHold(side); // silencio o ruido: si había una frase a medias, sigue su cuenta atrás
      return;
    }

    // El audio del sistema también oye mi propia voz traducida: si es eso, no es «Ellos», es eco.
    // (Con una fuente aislada no puede ocurrir, así que no se filtra nada.)
    if (side === 'them' && !this.snapshot.isolated && isLikelyEcho(stt.text, this.spoken)) {
      this.patch({ echoesBlocked: this.snapshot.echoesBlocked + 1 });
      this.armHold(side);
      return;
    }

    await this.onTranscript(side, stt.text, { arrived, waitMs, sttMs });
  }

  /**
   * Qué hacer con lo recién transcrito:
   *  - Turno manual (tu lado): se acumula en el borrador; se traduce todo junto al pulsar «Traducir».
   *  - Si la frase quedó a medias (no termina en . ? !), se retiene un momento por si continúa y se une.
   *  - Si es una frase completa, se traduce de inmediato.
   */
  private async onTranscript(side: LineSide, text: string, t: Timing): Promise<void> {
    if (side === 'me' && this.snapshot.manualTurns) {
      this.patch({ draft: joinText(this.snapshot.draft, text) });
      return;
    }

    const held = this.held[side];
    if (held) {
      this.clearHold(side);
      text = joinText(held.text, text);
      // la medición cuenta desde el ÚLTIMO trozo (cuando terminaste de hablar); espera y transcripción se suman
      t = { arrived: t.arrived, waitMs: held.t.waitMs + t.waitMs, sttMs: held.t.sttMs + t.sttMs };
    }

    // Al detener ya no se espera nada: se traduce lo que haya
    if (this.snapshot.running && this.joinMs > 0 && !endsSentence(text) && text.length < MAX_JOIN_CHARS) {
      this.held[side] = { text, t };
      this.armHold(side);
      return;
    }
    await this.deliver(side, text, t);
  }

  private clearHoldTimer(side: LineSide): void {
    const timer = this.holdTimers[side];
    if (timer) clearTimeout(timer);
    this.holdTimers[side] = null;
  }

  private clearHold(side: LineSide): void {
    this.clearHoldTimer(side);
    this.held[side] = null;
  }

  /** (Re)inicia la cuenta atrás de una frase retenida; al agotarse se traduce tal cual. */
  private armHold(side: LineSide): void {
    if (!this.held[side]) return;
    this.clearHoldTimer(side);
    const gen = this.generation;
    this.holdTimers[side] = setTimeout(() => {
      if (gen === this.generation) this.flushHeld(side);
    }, this.joinMs);
  }

  private flushHeld(side: LineSide): void {
    this.clearHoldTimer(side);
    const h = this.held[side];
    if (!h) return;
    this.held[side] = null;
    this.chains[side] = this.chains[side]
      .then(() => this.deliver(side, h.text, h.t))
      .catch((e) => console.warn('[InterviewSession] error procesando frase:', e));
  }

  // ---------------------------------------------------------------- turno manual

  public setManualTurns(value: boolean): void {
    this.patch({ manualTurns: value });
    if (!value) this.translateDraft(); // al volver a automático no se pierde lo dicho
  }

  /** Traduce TODO lo acumulado en el borrador como una sola frase. */
  public translateDraft(): void {
    const text = this.snapshot.draft.trim();
    if (!text) return;
    const arrived = Date.now();
    this.patch({ draft: '' });
    this.chains.me = this.chains.me
      .then(() => this.deliver('me', text, { arrived, waitMs: 0, sttMs: 0 }))
      .catch((e) => console.warn('[InterviewSession] error procesando turno:', e));
  }

  public discardDraft(): void {
    this.patch({ draft: '' });
  }

  /** Muestra la frase, la traduce y (según el modo) la dice o deja la voz lista. */
  private async deliver(side: LineSide, text: string, t: Timing): Promise<void> {
    const settings = this.getSettings();
    const { mine, theirs } = this.langs();
    const from = side === 'me' ? mine : theirs;
    const to = side === 'me' ? theirs : mine;

    const line = this.addLine(side, text);
    this.arrivedAt.set(line.id, t.arrived);
    this.mergeTimings(line.id, { waitMs: t.waitMs, sttMs: t.sttMs });

    const tTr = Date.now();
    const tr = await this.deps.translateText(text, from, to, settings, this.recentOriginals());
    const translateMs = Date.now() - tTr;

    if (!tr.success || !tr.text) {
      this.updateLine(line.id, { status: 'error', error: tr.error || 'No se pudo traducir.' });
      this.patch({ error: tr.error || 'No se pudo traducir.' });
      return;
    }

    this.updateLine(line.id, { translation: tr.text, status: 'ready' });
    this.mergeTimings(line.id, { translateMs });

    if (side !== 'me' || !this.snapshot.canSpeak) return;
    if (this.snapshot.autoSpeak) {
      await this.speak(line.id, { auto: true });
    } else if (this.snapshot.prefetch) {
      await this.prefetchVoice(line.id); // el audio queda listo: pulsar 🔊 suena al instante
    }
  }

  // ---------------------------------------------------------------- voz

  /**
   * Genera la voz de una frase en trozos (frases) con hasta TTS_CONCURRENCY peticiones a la vez.
   * `onChunk` se llama EN ORDEN según va estando listo cada trozo, así el primero puede sonar enseguida.
   */
  private async synthesizeChunks(
    text: string,
    onChunk: (audio: Blob, index: number) => void
  ): Promise<{ blobs: Blob[]; error?: string; firstMs?: number }> {
    const settings = this.getSettings();
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) return { blobs: [] };

    const t0 = Date.now();
    let running = 0;
    const waiters: Array<() => void> = [];
    const acquire = async () => {
      if (running >= TTS_CONCURRENCY) await new Promise<void>((r) => waiters.push(r));
      running++;
    };
    const release = () => {
      running--;
      waiters.shift()?.();
    };

    const tasks = chunks.map(async (chunk, i) => {
      await acquire();
      try {
        return await this.deps.synthesizeSpeech(chunk, settings, {
          previousText: chunks[i - 1],
          nextText: chunks[i + 1],
          lowLatency: true
        });
      } finally {
        release();
      }
    });

    const blobs: Blob[] = [];
    let firstMs: number | undefined;
    for (let i = 0; i < tasks.length; i++) {
      const res = await tasks[i];
      if (!res.audio) {
        // Los trozos ya entregados quedan; se avisa del error y se descartan los siguientes.
        return { blobs, error: res.error || 'No se pudo generar la voz.', firstMs };
      }
      if (i === 0) firstMs = Date.now() - t0;
      blobs.push(res.audio);
      onChunk(res.audio, i);
    }
    return { blobs, firstMs };
  }

  /** Genera la voz de una frase SIN reproducirla (modo manual con «voz de antemano»). */
  private async prefetchVoice(lineId: string): Promise<void> {
    const line = this.snapshot.lines.find((l) => l.id === lineId);
    if (!line || !line.translation || this.audioCache.has(lineId)) return;
    const res = await this.synthesizeChunks(line.translation, () => {});
    if (res.error || res.blobs.length === 0) return; // no es grave: al pulsar 🔊 se intentará de nuevo
    this.audioCache.set(lineId, res.blobs);
    this.patch({ charsSpoken: this.snapshot.charsSpoken + line.translation.length });
    this.updateLine(lineId, { audioReady: true });
    this.mergeTimings(lineId, { ttsMs: res.firstMs });
  }

  /** Dice la traducción de una de tus frases con tu voz clonada. */
  public async speak(lineId: string, opts: { auto?: boolean } = {}): Promise<void> {
    const line = this.snapshot.lines.find((l) => l.id === lineId);
    if (!line || line.side !== 'me' || !line.translation) return;
    if (!this.snapshot.canSpeak) {
      this.patch({ error: 'Para hablar con tu voz elige el micrófono virtual y configura ElevenLabs en Ajustes → Entrevista.' });
      return;
    }

    this.updateLine(lineId, { speaking: true });
    const startedSpeaking = () => {
      this.spoken = pruneSpoken([...this.spoken, { text: line.translation, at: Date.now() }]);
    };

    // 1) Voz ya preparada: suena al instante.
    const cached = this.audioCache.get(lineId);
    if (cached) {
      cached.forEach((b) => this.player.enqueue(b));
      startedSpeaking();
      this.updateLine(lineId, { speaking: false, spoken: true });
      const arrived = this.arrivedAt.get(lineId);
      if (opts.auto && arrived) this.mergeTimings(lineId, { totalMs: Date.now() - arrived });
      return;
    }

    // 2) Generar por trozos; el primero suena en cuanto esté listo.
    let first = true;
    const tTts = Date.now();
    const res = await this.synthesizeChunks(line.translation, (audio) => {
      this.player.enqueue(audio);
      if (first) {
        first = false;
        startedSpeaking();
        const arrived = this.arrivedAt.get(lineId);
        this.mergeTimings(lineId, {
          ttsMs: Date.now() - tTts,
          ...(opts.auto && arrived ? { totalMs: Date.now() - arrived } : {})
        });
      }
    });

    if (res.blobs.length > 0) this.audioCache.set(lineId, res.blobs); // repetir 🔊 no vuelve a gastar
    if (res.error) {
      this.updateLine(lineId, { speaking: false, spoken: res.blobs.length > 0, error: res.error });
      this.patch({ error: res.error });
      return;
    }
    this.updateLine(lineId, { speaking: false, spoken: true, audioReady: true });
    this.patch({ charsSpoken: this.snapshot.charsSpoken + line.translation.length });
  }

  /**
   * Dice una frase tuya escrita (por ejemplo el aviso de que usas traducción en vivo):
   * se traduce al idioma de ellos y se pronuncia con tu voz.
   */
  public async sayText(textInMyLanguage: string): Promise<void> {
    const settings = this.getSettings();
    const { mine, theirs } = this.langs();
    const line = this.addLine('me', textInMyLanguage);
    const tr = await this.deps.translateText(textInMyLanguage, mine, theirs, settings, this.recentOriginals());
    if (!tr.success || !tr.text) {
      this.updateLine(line.id, { status: 'error', error: tr.error });
      this.patch({ error: tr.error || 'No se pudo traducir.' });
      return;
    }
    this.updateLine(line.id, { translation: tr.text, status: 'ready' });
    await this.speak(line.id);
  }
}
