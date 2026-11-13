/**
 * SpeechPlayer
 * ------------
 * Reproduce en orden los audios de tu voz traducida y los envía a un dispositivo de salida
 * concreto: el micrófono virtual (p. ej. "CABLE Input" de VB-CABLE). En la videollamada se elige
 * "CABLE Output" como micrófono y la otra persona escucha tu voz traducida.
 *
 * Importante: el audio NO sale por tus altavoces/auriculares, así que no se mezcla con lo que
 * captura el modo reunión (sin eco ni bucles).
 */
export class SpeechPlayer {
  private queue: Blob[] = [];
  private playing = false;
  private current: HTMLAudioElement | null = null;
  private sinkId = '';
  private onChange: (pending: number, speaking: boolean) => void;

  constructor(onChange: (pending: number, speaking: boolean) => void = () => {}) {
    this.onChange = onChange;
  }

  public setSink(deviceId: string): void {
    this.sinkId = deviceId;
  }

  public enqueue(audio: Blob): void {
    this.queue.push(audio);
    this.emit();
    void this.drain();
  }

  /** Corta lo que se esté diciendo y vacía la cola. */
  public stop(): void {
    this.queue = [];
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
    this.playing = false;
    this.emit();
  }

  private emit(): void {
    this.onChange(this.queue.length, this.playing);
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.emit();

    while (this.queue.length > 0) {
      const blob = this.queue.shift()!;
      this.emit();
      await this.playOne(blob);
    }

    this.playing = false;
    this.emit();
  }

  private playOne(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.current = audio;

      const finish = () => {
        URL.revokeObjectURL(url);
        if (this.current === audio) this.current = null;
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;

      const start = async () => {
        try {
          // setSinkId elige el dispositivo de salida (soportado en Chromium/Electron).
          if (this.sinkId && typeof (audio as any).setSinkId === 'function') {
            await (audio as any).setSinkId(this.sinkId);
          }
          await audio.play();
        } catch (err) {
          console.warn('[SpeechPlayer] no se pudo reproducir:', err);
          finish();
        }
      };
      void start();
    });
  }
}
