/**
 * VoiceNoteController
 * -------------------
 * Para mandar una NOTA DE VOZ (WhatsApp, Telegram, Teams…) con tu propia voz clonada:
 *
 *   1. Dictas o escribes tu mensaje.
 *   2. (Opcional) Se traduce al idioma del cliente. Puedes corregir el texto.
 *   3. Escuchas el resultado en tus auriculares ANTES de enviarlo.
 *   4. «Enviar»: cuenta atrás → tu voz suena por el micrófono virtual mientras la app de mensajería graba.
 *
 * No depende de React ni del navegador: las piezas externas llegan por `deps` (se prueba con simulaciones).
 */

import { AppSettings } from '../../types';
import { speechToText, SttResult } from '../interview/services/stt';
import { translateText, TranslateResult } from '../interview/services/translate';
import { synthesizeSpeech } from '../interview/services/elevenlabs';
import { SpeechPlayer } from '../interview/services/speechPlayer';
import { isUsableVirtualSink } from '../interview/session';
import { AudioRecorder } from '../../utils/audioService';

export type VoiceNoteStatus =
  | 'idle'
  | 'recording' // dictando
  | 'transcribing'
  | 'translating'
  | 'synthesizing'
  | 'countdown' // esperando para empezar a hablar (da tiempo a pulsar «grabar» en WhatsApp)
  | 'playing'; // tu voz suena por el micrófono virtual

export interface VoiceNoteSnapshot {
  status: VoiceNoteStatus;
  /** Lo que dictas o escribes, en tu idioma */
  sourceText: string;
  /** El texto final que se dirá (traducido o el mismo); editable */
  finalText: string;
  /** Idioma en el que se dirá (el de ellos, o el tuyo si no se traduce) */
  targetLang: string;
  countdown: number;
  charsUsed: number;
  /** Hay audio generado y vigente para el texto actual */
  hasAudio: boolean;
  /** Duración del audio generado, en segundos */
  audioSeconds: number | null;
  error: string;
}

export interface VoiceNoteDeps {
  speechToText: (blob: Blob, language: string, settings: AppSettings) => Promise<SttResult>;
  translateText: (text: string, from: string, to: string, settings: AppSettings, recent?: string[]) => Promise<TranslateResult>;
  synthesizeSpeech: (text: string, settings: AppSettings) => Promise<{ audio?: Blob; error?: string }>;
  recorder: { start: (deviceId?: string) => Promise<{ success: boolean; error?: string }>; stop: () => Promise<Blob | null> };
  createPlayer: (onChange: (pending: number, speaking: boolean) => void) => Pick<SpeechPlayer, 'setSink' | 'enqueue' | 'stop'>;
  sleep: (ms: number) => Promise<void>;
  /** Duración de un audio en segundos (para mostrarla); null si no se puede calcular */
  audioDuration: (blob: Blob) => Promise<number | null>;
}

/** ElevenLabs acepta hasta 5000 caracteres por petición; se deja margen. */
export const MAX_NOTE_CHARS = 4500;

const defaultDeps: VoiceNoteDeps = {
  speechToText,
  translateText,
  synthesizeSpeech,
  recorder: new AudioRecorder(),
  createPlayer: (onChange) => new SpeechPlayer(onChange),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  audioDuration: (blob) =>
    new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(Number.isFinite(a.duration) ? a.duration : null);
        };
        a.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    })
};

export class VoiceNoteController {
  private snap: VoiceNoteSnapshot = {
    status: 'idle',
    sourceText: '',
    finalText: '',
    targetLang: 'en',
    countdown: 0,
    charsUsed: 0,
    hasAudio: false,
    audioSeconds: null,
    error: ''
  };

  private listeners = new Set<(s: VoiceNoteSnapshot) => void>();
  /** Audio ya generado: si el texto no cambió, enviarlo no cuesta otra vez caracteres de ElevenLabs. */
  private cache: { key: string; blob: Blob } | null = null;
  private monitor: ReturnType<VoiceNoteDeps['createPlayer']>;
  private cable: ReturnType<VoiceNoteDeps['createPlayer']>;
  private sendToken = 0;

  constructor(private getSettings: () => AppSettings, private deps: VoiceNoteDeps = defaultDeps) {
    this.monitor = deps.createPlayer(() => {});
    this.monitor.setSink(''); // salida predeterminada: tus auriculares
    this.cable = deps.createPlayer((pending, speaking) => {
      if (this.snap.status === 'playing' && pending === 0 && !speaking) this.patch({ status: 'idle' });
    });
    const s = getSettings();
    this.snap.targetLang = s.interviewTheirLang || 'en';
  }

  // ------------------------------------------------------------ estado

  public subscribe(listener: (s: VoiceNoteSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snap);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): VoiceNoteSnapshot {
    return this.snap;
  }

  private patch(partial: Partial<VoiceNoteSnapshot>): void {
    this.snap = { ...this.snap, ...partial };
    this.listeners.forEach((l) => l(this.snap));
  }

  private myLang(): string {
    return this.getSettings().interviewMyLang || 'es';
  }

  private cacheKey(text: string): string {
    const s = this.getSettings();
    return `${s.elevenLabsVoiceId}|${s.elevenLabsModel}|${text}`;
  }

  private invalidateAudioIfTextChanged(text: string): void {
    if (this.cache && this.cache.key !== this.cacheKey(text)) {
      this.cache = null;
      this.patch({ hasAudio: false, audioSeconds: null });
    }
  }

  public clearError(): void {
    this.patch({ error: '' });
  }

  // ------------------------------------------------------------ texto e idioma

  public setSourceText(text: string): void {
    this.patch({ sourceText: text });
    // Si no se traduce, lo que se escribe ES lo que se dirá.
    if (this.snap.targetLang === this.myLang()) this.setFinalText(text);
  }

  public setFinalText(text: string): void {
    this.patch({ finalText: text });
    this.invalidateAudioIfTextChanged(text);
  }

  public setTargetLang(lang: string): void {
    this.patch({ targetLang: lang });
    if (lang === this.myLang()) this.setFinalText(this.snap.sourceText);
  }

  /** ¿Se va a traducir? (si el destino es mi mismo idioma, se dice tal cual) */
  public needsTranslation(): boolean {
    return this.snap.targetLang !== this.myLang();
  }

  // ------------------------------------------------------------ dictado

  public async startDictation(deviceId?: string): Promise<boolean> {
    if (this.snap.status !== 'idle') return false;
    const res = await this.deps.recorder.start(deviceId);
    if (!res.success) {
      this.patch({ error: res.error || 'No se pudo usar el micrófono.' });
      return false;
    }
    this.patch({ status: 'recording', error: '' });
    return true;
  }

  /** Detiene el dictado, transcribe y (si hace falta) traduce. */
  public async stopDictation(): Promise<void> {
    if (this.snap.status !== 'recording') return;
    this.patch({ status: 'transcribing' });
    const blob = await this.deps.recorder.stop();
    if (!blob || blob.size < 800) {
      this.patch({ status: 'idle', error: 'No se oyó nada. Habla más cerca del micrófono e inténtalo de nuevo.' });
      return;
    }

    const stt = await this.deps.speechToText(blob, this.myLang(), this.getSettings());
    if (!stt.success) {
      this.patch({ status: 'idle', error: stt.error || 'No se pudo transcribir el audio.' });
      return;
    }
    if (!stt.text) {
      this.patch({ status: 'idle', error: 'No se detectó voz en la grabación.' });
      return;
    }

    const joined = this.snap.sourceText.trim() ? `${this.snap.sourceText.trim()} ${stt.text}` : stt.text;
    this.patch({ status: 'idle', sourceText: joined });
    if (this.needsTranslation()) await this.translate();
    else this.setFinalText(joined);
  }

  // ------------------------------------------------------------ traducción

  public async translate(): Promise<boolean> {
    const text = this.snap.sourceText.trim();
    if (!text) {
      this.patch({ error: 'Escribe o dicta primero el mensaje.' });
      return false;
    }
    if (!this.needsTranslation()) {
      this.setFinalText(text);
      return true;
    }

    this.patch({ status: 'translating', error: '' });
    const res = await this.deps.translateText(text, this.myLang(), this.snap.targetLang, this.getSettings());
    if (!res.success || !res.text) {
      this.patch({ status: 'idle', error: res.error || 'No se pudo traducir.' });
      return false;
    }
    this.patch({ status: 'idle' });
    this.setFinalText(res.text);
    return true;
  }

  // ------------------------------------------------------------ voz

  /** Genera (o reutiliza) el audio del texto final con tu voz clonada. */
  public async prepareAudio(): Promise<Blob | null> {
    const text = this.snap.finalText.trim();
    if (!text) {
      this.patch({ error: 'No hay nada que decir: escribe o dicta el mensaje.' });
      return null;
    }
    if (text.length > MAX_NOTE_CHARS) {
      this.patch({ error: `El mensaje es muy largo (${text.length} caracteres; máximo ${MAX_NOTE_CHARS}). Divídelo en dos notas de voz.` });
      return null;
    }

    const key = this.cacheKey(text);
    if (this.cache && this.cache.key === key) return this.cache.blob;

    this.patch({ status: 'synthesizing', error: '' });
    const res = await this.deps.synthesizeSpeech(text, this.getSettings());
    if (!res.audio) {
      this.patch({ status: 'idle', error: res.error || 'No se pudo generar la voz.' });
      return null;
    }
    this.cache = { key, blob: res.audio };
    const seconds = await this.deps.audioDuration(res.audio);
    this.patch({ status: 'idle', hasAudio: true, audioSeconds: seconds, charsUsed: this.snap.charsUsed + text.length });
    return res.audio;
  }

  /** Lo reproduce en tus auriculares (salida predeterminada) para revisarlo antes de enviar. */
  public async preview(): Promise<void> {
    if (this.snap.status !== 'idle') return;
    const blob = await this.prepareAudio();
    if (blob) this.monitor.enqueue(blob);
  }

  /** ¿Se puede enviar por el micrófono virtual? */
  public canSend(): boolean {
    const s = this.getSettings();
    return isUsableVirtualSink(s.interviewOutputDeviceId) && Boolean(s.elevenLabsApiKey?.trim()) && Boolean(s.elevenLabsVoiceId?.trim());
  }

  /**
   * Cuenta atrás y luego tu voz suena por el micrófono virtual.
   * La cuenta atrás da tiempo a pulsar «grabar» en WhatsApp antes de que empiece a sonar.
   */
  public async send(countdownSeconds = 5): Promise<boolean> {
    if (this.snap.status !== 'idle') return false;
    if (!this.canSend()) {
      this.patch({
        error: 'Para enviar necesitas elegir el micrófono virtual y configurar ElevenLabs (Ajustes → Entrevista).'
      });
      return false;
    }

    const blob = await this.prepareAudio();
    if (!blob) return false;

    const token = ++this.sendToken;
    this.cable.setSink(this.getSettings().interviewOutputDeviceId as string);
    this.monitor.stop();

    for (let n = Math.max(0, Math.round(countdownSeconds)); n > 0; n--) {
      this.patch({ status: 'countdown', countdown: n });
      await this.deps.sleep(1000);
      if (token !== this.sendToken) return false; // cancelado durante la cuenta atrás
    }

    this.patch({ status: 'playing', countdown: 0 });
    this.cable.enqueue(blob);
    return true;
  }

  /** Cancela la cuenta atrás o corta lo que esté sonando. */
  public cancel(): void {
    this.sendToken++;
    this.cable.stop();
    this.monitor.stop();
    if (this.snap.status === 'countdown' || this.snap.status === 'playing') {
      this.patch({ status: 'idle', countdown: 0 });
    }
  }

  /** El audio listo para guardarlo como archivo (.mp3). */
  public getAudioForDownload(): { blob: Blob; fileName: string } | null {
    if (!this.cache) return null;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    return { blob: this.cache.blob, fileName: `nota-de-voz-${stamp}.mp3` };
  }

  /** Empieza de cero (texto, audio y errores). */
  public reset(): void {
    this.cancel();
    this.cache = null;
    this.patch({ sourceText: '', finalText: '', hasAudio: false, audioSeconds: null, error: '', status: 'idle' });
  }
}
