/**
 * Transcripción de audio con Whisper (Hugging Face Router) y respaldo en Cloudflare Workers AI.
 *
 * Cambios frente a la versión anterior:
 *  - El idioma sale de los ajustes (antes estaba fijo en 'es'). Con 'auto' Whisper lo detecta,
 *    útil para el audio de la otra persona cuando habla otro idioma.
 *  - Límite de tiempo por petición y UN solo reintento (antes llegaba a ~8 peticiones por fallo).
 *  - Se eliminó el endpoint "api-inference" clásico, que Hugging Face ya retiró.
 *  - Se descartan alucinaciones típicas de Whisper con silencio ("Subtítulos por...", etc.).
 */

import { AppSettings } from '../../../types';

export interface TranscribeOptions {
  /** Código ISO ('es', 'en'...) o 'auto' para detección automática. Por defecto: ajustes del usuario. */
  language?: string;
  timeoutMs?: number;
}

export interface TranscribeResult {
  success: boolean;
  text?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 25000;
const WHISPER_MODEL = 'openai/whisper-large-v3-turbo';

/** 'es-ES' → 'es' */
export function toIsoLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  if (lang === 'auto') return 'auto';
  return lang.split('-')[0].toLowerCase();
}

// Frases que Whisper inventa cuando recibe silencio o ruido.
const HALLUCINATIONS = [
  /^(¡)?gracias por (ver|vernos|escuchar)( el video| este video)?[.!]*$/i,
  /^subt[ií]tulos? (realizados? )?por.*$/i,
  /^suscr[ií]bete.*$/i,
  /amara\.org/i,
  /^thanks for watching[.!]*$/i,
  /^thank you( for watching)?[.!]*$/i,
  /^you[.!]*$/i,
  /^\.+$/
];

export function isHallucination(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  return HALLUCINATIONS.some((re) => re.test(t));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeWithHuggingFace(
  blob: Blob,
  apiKey: string,
  settings: AppSettings,
  language: string | undefined,
  timeoutMs: number
): Promise<TranscribeResult & { retryable?: boolean }> {
  const endpoint = (settings.hfEndpoint || 'https://router.huggingface.co/v1').replace(/\/+$/, '');

  // Ruta principal: endpoint compatible con OpenAI.
  try {
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', WHISPER_MODEL);
    if (language && language !== 'auto') form.append('language', language);

    const resp = await fetchWithTimeout(
      `${endpoint}/audio/transcriptions`,
      { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form },
      timeoutMs
    );

    if (resp.ok) {
      const data = await resp.json();
      return { success: true, text: (data.text || '').trim() };
    }

    // Errores que sí valen un reintento: límite de uso o fallo del servidor.
    if (resp.status === 429 || resp.status >= 500) {
      return { success: false, error: `Hugging Face ${resp.status}`, retryable: true };
    }
    // Si la ruta no existe para este modelo, probamos la ruta de inferencia directa.
    if (resp.status !== 404 && resp.status !== 400) {
      const body = (await resp.text()).substring(0, 120);
      return { success: false, error: `Hugging Face ${resp.status}: ${body}` };
    }
  } catch (e: any) {
    return { success: false, error: e?.name === 'AbortError' ? 'La transcripción tardó demasiado.' : e?.message, retryable: true };
  }

  // Ruta alternativa: inferencia directa con el binario.
  try {
    const resp = await fetchWithTimeout(
      `https://router.huggingface.co/hf-inference/models/${WHISPER_MODEL}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'audio/webm' },
        body: blob
      },
      timeoutMs
    );
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, text: (data.text || '').trim() };
    }
    return { success: false, error: `Hugging Face ${resp.status}`, retryable: resp.status === 429 || resp.status >= 500 };
  } catch (e: any) {
    return { success: false, error: e?.name === 'AbortError' ? 'La transcripción tardó demasiado.' : e?.message, retryable: true };
  }
}

async function transcribeWithCloudflare(blob: Blob, settings: AppSettings, timeoutMs: number): Promise<TranscribeResult> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${settings.cloudflareAccountId}/ai/run/@cf/openai/whisper`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.cloudflareApiToken}`,
          'Content-Type': 'application/octet-stream'
        },
        body: blob
      },
      timeoutMs
    );
    if (!resp.ok) return { success: false, error: `Cloudflare ${resp.status}` };
    const data = await resp.json();
    return { success: true, text: (data.result?.text || '').trim() };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  settings: AppSettings,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  if (!audioBlob || audioBlob.size === 0) {
    return { success: false, error: 'No se grabó ningún audio.' };
  }

  const language = toIsoLanguage(options.language ?? settings.speechLang) ?? 'es';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hfKey = settings.hfApiKey?.trim();
  let lastError = '';

  if (hfKey) {
    let result = await transcribeWithHuggingFace(audioBlob, hfKey, settings, language, timeoutMs);
    if (!result.success && result.retryable) {
      await new Promise((r) => setTimeout(r, 1200));
      result = await transcribeWithHuggingFace(audioBlob, hfKey, settings, language, timeoutMs);
    }
    if (result.success) {
      const text = result.text || '';
      // Silencio o alucinación: no es un error, simplemente no hay nada que anotar.
      return { success: true, text: isHallucination(text) ? '' : text };
    }
    lastError = result.error || '';
  }

  if (settings.enableCloudflareRag && settings.cloudflareAccountId && settings.cloudflareApiToken) {
    const cf = await transcribeWithCloudflare(audioBlob, settings, timeoutMs);
    if (cf.success) {
      const text = cf.text || '';
      return { success: true, text: isHallucination(text) ? '' : text };
    }
    lastError = lastError || cf.error || '';
  }

  return {
    success: false,
    error:
      lastError ||
      'Para transcribir audio con alta precisión, ingresa tu API Key de Hugging Face en Ajustes ⚙️ (pestaña IA).'
  };
}
