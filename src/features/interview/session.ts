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
 * No depende de React ni del navegador: las piezas externas llegan por `deps`, lo que permite
 * probarla con simulaciones.
 */

import { AppSettings } from '../../types';
import { meetingCapture, MeetingSegment } from '../meeting/capture/meetingCapture';
import { speechToText, SttResult } from './services/stt';
import { translateText, TranslateResult } from './services/translate';
import { synthesizeSpeech } from './services/elevenlabs';
import { SpeechPlayer } from './services/speechPlayer';

export type LineSide = 'me' | 'them';
export type LineStatus = 'translating' | 'ready' | 'error';

export interface InterviewLine {
  id: string;
  side: LineSide;
  original: string;
  translation: string;
  status: LineStatus;
  spoken: boolean;
  speaking: boolean;
  error?: string;
  at: number;
}

export interface InterviewSnapshot {
  lines: InterviewLine[];
  running: boolean;
  /** Se pueden emitir audios: hay micrófono virtual elegido y claves de ElevenLabs */
  canSpeak: boolean;
  autoSpeak: boolean;
  speaking: boolean;
  pendingSpeech: number;
  charsSpoken: number;
  error: string;
  startedAt: number | null;
}

export interface InterviewDeps {
  speechToText: (blob: Blob, language: string, settings: AppSettings) => Promise<SttResult>;
  translateText: (text: string, from: string, to: string, settings: AppSettings, recent?: string[]) => Promise<TranslateResult>;
  synthesizeSpeech: (text: string, settings: AppSettings) => Promise<{ audio?: Blob; error?: string }>;
  capture: {
    startCapture: (o: { micDeviceId?: string; onSegment?: (s: MeetingSegment) => void }) => Promise<{ success: boolean; error?: string }>;
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

export interface StartOptions {
  micDeviceId?: string;
  autoSpeak: boolean;
}

export class InterviewSession {
  private snapshot: InterviewSnapshot = {
    lines: [],
    running: false,
    canSpeak: false,
    autoSpeak: true,
    speaking: false,
    pendingSpeech: 0,
    charsSpoken: 0,
    error: '',
    startedAt: null
  };

  private listeners = new Set<(s: InterviewSnapshot) => void>();
  private chains: Record<LineSide, Promise<void>> = { me: Promise.resolve(), them: Promise.resolve() };
  private player: ReturnType<InterviewDeps['createPlayer']>;
  private seq = 0;
  private generation = 0; // se incrementa al detener para ignorar trabajo pendiente

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
    this.patch({ lines: this.snapshot.lines.map((l) => (l.id === id ? { ...l, ...partial } : l)) });
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

  // ---------------------------------------------------------------- ciclo de vida

  public clearError(): void {
    this.patch({ error: '' });
  }

  public setAutoSpeak(value: boolean): void {
    this.patch({ autoSpeak: value });
  }

  public async start(options: StartOptions): Promise<{ success: boolean; error?: string }> {
    if (this.snapshot.running) return { success: true };
    const settings = this.getSettings();

    const sink = settings.interviewOutputDeviceId;
    const canSpeak =
      isUsableVirtualSink(sink) && Boolean(settings.elevenLabsApiKey?.trim()) && Boolean(settings.elevenLabsVoiceId?.trim());
    this.player.setSink(canSpeak ? (sink as string) : '');

    this.generation++;
    this.chains = { me: Promise.resolve(), them: Promise.resolve() };
    this.patch({
      lines: [],
      error: '',
      charsSpoken: 0,
      canSpeak,
      autoSpeak: options.autoSpeak && canSpeak
    });

    const gen = this.generation;
    const res = await this.deps.capture.startCapture({
      micDeviceId: options.micDeviceId,
      onSegment: (seg) => {
        if (gen === this.generation) this.enqueueSegment(seg);
      }
    });

    if (!res.success) {
      this.patch({ error: res.error || 'No se pudo iniciar la captura de audio.' });
      return { success: false, error: res.error };
    }

    this.patch({ running: true, startedAt: Date.now() });
    return { success: true };
  }

  public async stop(): Promise<void> {
    if (!this.snapshot.running) return;
    this.patch({ running: false });
    await this.deps.capture.stop();
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
    this.chains[side] = this.chains[side].then(() => this.processSegment(seg, side)).catch((e) => {
      console.warn('[InterviewSession] error procesando frase:', e);
    });
  }

  private async processSegment(seg: MeetingSegment, side: LineSide): Promise<void> {
    const settings = this.getSettings();
    const { mine, theirs } = this.langs();
    const from = side === 'me' ? mine : theirs;
    const to = side === 'me' ? theirs : mine;

    const stt = await this.deps.speechToText(seg.blob, from, settings);
    if (!stt.success) {
      this.patch({ error: stt.error || 'No se pudo transcribir el audio.' });
      return;
    }
    if (!stt.text) return; // silencio o ruido

    const line = this.addLine(side, stt.text);
    const tr = await this.deps.translateText(stt.text, from, to, settings, this.recentOriginals());

    if (!tr.success || !tr.text) {
      this.updateLine(line.id, { status: 'error', error: tr.error || 'No se pudo traducir.' });
      this.patch({ error: tr.error || 'No se pudo traducir.' });
      return;
    }

    this.updateLine(line.id, { translation: tr.text, status: 'ready' });

    if (side === 'me' && this.snapshot.autoSpeak && this.snapshot.canSpeak) {
      await this.speak(line.id);
    }
  }

  // ---------------------------------------------------------------- voz

  /** Dice la traducción de una de tus frases con tu voz clonada. */
  public async speak(lineId: string): Promise<void> {
    const line = this.snapshot.lines.find((l) => l.id === lineId);
    if (!line || line.side !== 'me' || !line.translation) return;
    if (!this.snapshot.canSpeak) {
      this.patch({ error: 'Para hablar con tu voz elige el micrófono virtual y configura ElevenLabs en Ajustes → Entrevista.' });
      return;
    }

    this.updateLine(lineId, { speaking: true });
    const res = await this.deps.synthesizeSpeech(line.translation, this.getSettings());
    if (!res.audio) {
      this.updateLine(lineId, { speaking: false, error: res.error });
      this.patch({ error: res.error || 'No se pudo generar la voz.' });
      return;
    }

    this.player.enqueue(res.audio);
    this.updateLine(lineId, { speaking: false, spoken: true });
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
