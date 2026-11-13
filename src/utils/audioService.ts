/**
 * Audio Service: selección de dispositivos y grabación para dictado
 */

export interface AudioDeviceInfo {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

/**
 * Enumerate all connected audio input (microphones, stereo mix) and output devices
 */
export async function getAudioDevices(): Promise<{ inputs: AudioDeviceInfo[]; outputs: AudioDeviceInfo[] }> {
  try {
    // Request permission once if needed so device labels are visible
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }

    try {
      // Small dummy stream to unlock device labels in Chromium
      const dummy = await navigator.mediaDevices.getUserMedia({ audio: true });
      dummy.getTracks().forEach(t => t.stop());
    } catch {}

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs: AudioDeviceInfo[] = [];
    const outputs: AudioDeviceInfo[] = [];

    devices.forEach(d => {
      if (d.kind === 'audioinput') {
        inputs.push({
          id: d.deviceId,
          label: d.label || `Micrófono ${inputs.length + 1}`,
          kind: 'audioinput'
        });
      } else if (d.kind === 'audiooutput') {
        outputs.push({
          id: d.deviceId,
          label: d.label || `Altavoz / Salida ${outputs.length + 1}`,
          kind: 'audiooutput'
        });
      }
    });

    return { inputs, outputs };
  } catch (err) {
    console.warn('Error enumerating audio devices:', err);
    return { inputs: [], outputs: [] };
  }
}

/**
 * La transcripción y la captura de reuniones viven ahora en src/features/meeting/.
 * Se re-exporta transcribeAudio para no romper el dictado del editor.
 */
export { transcribeAudio } from '../features/meeting/stt/whisper';

/**
 * Universal Audio Recorder for Dictation and Meetings
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording: boolean = false;

  public async start(deviceId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg');

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // capture every 250ms
      this.isRecording = true;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'No se pudo acceder al micrófono.' };
    }
  }

  public stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        this.audioChunks = [];
        this.isRecording = false;

        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
          this.stream = null;
        }

        resolve(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}

export const audioRecorder = new AudioRecorder();
