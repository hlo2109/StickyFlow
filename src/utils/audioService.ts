/**
 * Audio Service for Device Selection, Robust Dictation, System Audio Capture, and Whisper Transcription
 */

import { AppSettings } from '../types';

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
 * Transcribe an audio Blob using Hugging Face Whisper, Cloudflare Workers AI or local speech
 */
export async function transcribeAudio(audioBlob: Blob, settings: AppSettings): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!audioBlob || audioBlob.size === 0) {
    return { success: false, error: 'No se grabó ningún audio.' };
  }

  // Option 1: Hugging Face Whisper
  const hfKey = settings.hfApiKey?.trim();
  let lastHfError = '';
  if (hfKey) {
    try {
      // 1. Try Hugging Face Inference API for Whisper (new router endpoint)
      const response = await fetch('https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': audioBlob.type || 'audio/webm'
        },
        body: audioBlob
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.text?.trim();
        if (text) {
          return { success: true, text };
        }
      } else {
        const errText = await response.text();
        lastHfError = `Error HF ${response.status}: ${errText.substring(0, 120)}`;
      }

      // 2. Fallback to router OpenAI-compatible audio endpoint
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'openai/whisper-large-v3-turbo');
      formData.append('language', 'es');

      const endpoint = (settings.hfEndpoint || 'https://router.huggingface.co/v1').replace(/\/+$/, '');
      const routerResp = await fetch(`${endpoint}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`
        },
        body: formData
      });

      if (routerResp.ok) {
        const data = await routerResp.json();
        if (data.text) return { success: true, text: data.text.trim() };
      } else if (!lastHfError) {
        lastHfError = `Error router: ${routerResp.statusText}`;
      }
    } catch (e: any) {
      console.warn('Hugging Face whisper error:', e);
      lastHfError = e.message || 'Error de conexión';
    }
  }

  // Option 2: Cloudflare Workers AI Whisper if configured
  if (settings.enableCloudflareRag && settings.cloudflareAccountId && settings.cloudflareApiToken) {
    try {
      const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${settings.cloudflareAccountId}/ai/run/@cf/openai/whisper`;
      const cfResp = await fetch(cfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.cloudflareApiToken}`,
          'Content-Type': 'application/octet-stream'
        },
        body: audioBlob
      });

      if (cfResp.ok) {
        const cfData = await cfResp.json();
        const text = cfData.result?.text?.trim();
        if (text) return { success: true, text };
      }
    } catch (e) {
      console.warn('Cloudflare whisper error:', e);
    }
  }

  return {
    success: false,
    error: lastHfError || 'Para transcribir audio con alta precisión, ingresa tu API Key de Hugging Face en Ajustes ⚙️ (pestaña IA).'
  };
}

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

/**
 * Meeting System Audio Capture (captures desktop loopback + mic)
 */
export class MeetingAudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isCapturing: boolean = false;

  public async startCapture(micDeviceId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. In Electron, request display media with loopback audio enabled
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          // @ts-ignore
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false
        }
      });

      // Stop unused video track
      displayStream.getVideoTracks().forEach(t => t.stop());
      const sysAudioTracks = displayStream.getAudioTracks();

      // 2. Also capture microphone audio
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true
        });
      } catch (e) {
        console.warn('Could not attach microphone to meeting capture, continuing with system audio only:', e);
      }

      // 3. Mix system audio + microphone using Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      if (sysAudioTracks.length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(new MediaStream(sysAudioTracks));
        sysSource.connect(dest);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
      }

      this.mediaStream = dest.stream;
      this.recordedChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      this.audioRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.audioRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.audioRecorder.start(300);
      this.isCapturing = true;

      return { success: true };
    } catch (err: any) {
      console.warn('Error starting meeting audio capture:', err);
      return {
        success: false,
        error: err.message || 'No se pudo conectar al audio del sistema. Asegúrate de otorgar los permisos de captura de pantalla/audio.'
      };
    }
  }

  public stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.audioRecorder || !this.isCapturing) {
        resolve(null);
        return;
      }

      this.audioRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.recordedChunks = [];
        this.isCapturing = false;

        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
        }

        resolve(blob);
      };

      try {
        this.audioRecorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }
}

export const audioRecorder = new AudioRecorder();
export const meetingAudioCapture = new MeetingAudioCapture();
