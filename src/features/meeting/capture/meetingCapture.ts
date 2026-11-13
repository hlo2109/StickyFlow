/**
 * MeetingCapture
 * --------------
 * Captura el audio de una reunión en DOS pistas separadas:
 *   - 'system': lo que suena en el PC (los demás participantes), vía loopback de Windows.
 *   - 'mic'   : tu micrófono, con cancelación de eco y reducción de ruido.
 *
 * Antes ambas se mezclaban en una sola pista sin cancelación de eco: se oía doble y no se
 * podía saber quién dijo qué. Separadas, cada frase llega etiquetada y se transcribe en
 * su propio idioma (por ejemplo: tú en español, ellos en inglés).
 */

import { SpeechSegmenter, MeetingSegment } from './speechSegmenter';

export type { MeetingSegment, AudioSource } from './speechSegmenter';

export interface StartCaptureOptions {
  micDeviceId?: string;
  /** Se llama cada vez que se completa una frase. Si no se pasa, igual se acumulan en getSegments(). */
  onSegment?: (segment: MeetingSegment) => void;
}

export class MeetingCapture {
  private audioCtx: AudioContext | null = null;
  private segmenters: SpeechSegmenter[] = [];
  private streams: MediaStream[] = [];
  private segments: MeetingSegment[] = [];
  private capturing = false;

  public getIsCapturing(): boolean {
    return this.capturing;
  }

  /** Todas las frases capturadas hasta ahora, en orden cronológico. */
  public getSegments(): MeetingSegment[] {
    return [...this.segments].sort((a, b) => a.startedAt - b.startedAt);
  }

  public async startCapture(
    options: StartCaptureOptions = {}
  ): Promise<{ success: boolean; error?: string; micAvailable?: boolean; systemAvailable?: boolean }> {
    if (this.capturing) return { success: true };

    try {
      this.segments = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();

      const handleSegment = (segment: MeetingSegment) => {
        this.segments.push(segment);
        options.onSegment?.(segment);
      };

      // 1. Audio del sistema (loopback). Electron exige pedir también el video; se descarta enseguida.
      let systemAvailable = false;
      try {
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
        if (audioTracks.length > 0) {
          const sysStream = new MediaStream(audioTracks);
          this.streams.push(sysStream);
          this.segmenters.push(
            new SpeechSegmenter({
              source: 'system',
              audioContext: this.audioCtx,
              stream: sysStream,
              onSegment: handleSegment
            })
          );
          systemAvailable = true;
        }
      } catch (e) {
        console.warn('[MeetingCapture] sin audio del sistema:', e);
      }

      // 2. Micrófono, con procesado de voz para evitar eco y ruido de fondo.
      let micAvailable = false;
      try {
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(options.micDeviceId ? { deviceId: { exact: options.micDeviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        this.streams.push(mic);
        this.segmenters.push(
          new SpeechSegmenter({
            source: 'mic',
            audioContext: this.audioCtx,
            stream: mic,
            onSegment: handleSegment
          })
        );
        micAvailable = true;
      } catch (e) {
        console.warn('[MeetingCapture] sin micrófono:', e);
      }

      if (!systemAvailable && !micAvailable) {
        await this.cleanup();
        return {
          success: false,
          error:
            'No se pudo acceder ni al audio del sistema ni al micrófono. Revisa los permisos de Windows (Privacidad → Micrófono).'
        };
      }

      this.capturing = true;
      this.segmenters.forEach((s) => s.start());
      return { success: true, micAvailable, systemAvailable };
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
