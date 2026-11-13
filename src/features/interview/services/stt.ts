import { AppSettings } from '../../../types';
import { isHallucination, transcribeAudio } from '../../meeting/stt/whisper';

const DEEPGRAM_TIMEOUT_MS = 15_000;

export interface SttResult {
  success: boolean;
  text: string;
  error?: string;
}

async function transcribeWithDeepgram(blob: Blob, apiKey: string, language: string): Promise<SttResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ model: 'nova-3', language, smart_format: 'true', punctuate: 'true' });
    const resp = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
      signal: controller.signal
    });

    if (resp.status === 401 || resp.status === 403) {
      return { success: false, text: '', error: 'La API Key de Deepgram no es válida.' };
    }
    if (resp.status === 402) {
      return { success: false, text: '', error: 'Tu cuenta de Deepgram se quedó sin crédito.' };
    }
    if (!resp.ok) {
      return { success: false, text: '', error: `Deepgram respondió ${resp.status}.` };
    }

    const data = await resp.json();
    const text: string = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
    return { success: true, text: isHallucination(text) ? '' : text };
  } catch (err: any) {
    return {
      success: false,
      text: '',
      error: err?.name === 'AbortError' ? 'Deepgram tardó demasiado.' : `Error de conexión con Deepgram: ${err?.message}`
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convierte una frase de audio a texto en el idioma indicado.
 * Usa Deepgram si hay clave (más rápido); si no, Whisper vía Hugging Face.
 */
export async function speechToText(blob: Blob, language: string, settings: AppSettings): Promise<SttResult> {
  const deepgramKey = settings.deepgramApiKey?.trim();
  if (deepgramKey) {
    return transcribeWithDeepgram(blob, deepgramKey, language);
  }
  const res = await transcribeAudio(blob, settings, { language });
  return { success: res.success, text: res.text?.trim() ?? '', error: res.error };
}
