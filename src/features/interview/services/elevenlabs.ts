import { AppSettings } from '../../../types';

const API = 'https://api.elevenlabs.io/v1';
const TTS_TIMEOUT_MS = 20_000;

export interface ElevenVoice {
  id: string;
  name: string;
  /** 'cloned' = tu voz clonada; 'premade' = voces de la librería */
  category: string;
}

function errorFromStatus(status: number): string {
  switch (status) {
    case 401:
      return 'La API Key de ElevenLabs no es válida.';
    case 402:
    case 429:
      return 'ElevenLabs: se agotó tu cuota de caracteres o hay demasiadas peticiones a la vez.';
    case 404:
    case 422:
      return 'ElevenLabs no encuentra esa voz. Revisa el ID de voz en Ajustes → Entrevista.';
    default:
      return `ElevenLabs respondió ${status}.`;
  }
}

/** Lista las voces de la cuenta (las clonadas primero), para elegirlas en Ajustes. */
export async function listVoices(apiKey: string): Promise<{ voices: ElevenVoice[]; error?: string }> {
  try {
    const resp = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey.trim() } });
    if (!resp.ok) return { voices: [], error: errorFromStatus(resp.status) };
    const data = await resp.json();
    const voices: ElevenVoice[] = (data.voices ?? []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category
    }));
    voices.sort((a, b) => Number(b.category === 'cloned') - Number(a.category === 'cloned') || a.name.localeCompare(b.name));
    return { voices };
  } catch (err: any) {
    return { voices: [], error: `No se pudo conectar con ElevenLabs: ${err?.message}` };
  }
}

export interface SynthOptions {
  /** Texto que viene ANTES/DESPUÉS (cuando una frase larga se divide en trozos): mantiene la entonación entre ellos */
  previousText?: string;
  nextText?: string;
  /** Audio más ligero (64 kbps): baja unos cientos de ms en conversación en vivo. Para guardar/adjuntar, mejor la calidad normal. */
  lowLatency?: boolean;
}

/** Convierte texto en audio con tu voz clonada. Devuelve un MP3. */
export async function synthesizeSpeech(
  text: string,
  settings: AppSettings,
  options: SynthOptions = {}
): Promise<{ audio?: Blob; error?: string }> {
  const apiKey = settings.elevenLabsApiKey?.trim();
  const voiceId = settings.elevenLabsVoiceId?.trim();
  if (!apiKey) return { error: 'Falta la API Key de ElevenLabs (Ajustes → Entrevista).' };
  if (!voiceId) return { error: 'Falta elegir tu voz de ElevenLabs (Ajustes → Entrevista).' };

  const format = options.lowLatency ? 'mp3_44100_64' : 'mp3_44100_128';
  const request = async (withContext: boolean): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
      return await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${format}`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: settings.elevenLabsModel || 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          ...(withContext && options.previousText ? { previous_text: options.previousText } : {}),
          ...(withContext && options.nextText ? { next_text: options.nextText } : {})
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const hasContext = Boolean(options.previousText || options.nextText);
    let resp = await request(hasContext);
    // Si el modelo no admite el contexto, se reintenta sin él (solo perdería un poco de continuidad).
    if (resp.status === 422 && hasContext) resp = await request(false);
    if (!resp.ok) return { error: errorFromStatus(resp.status) };
    return { audio: await resp.blob() };
  } catch (err: any) {
    return { error: err?.name === 'AbortError' ? 'ElevenLabs tardó demasiado en responder.' : `Error de conexión con ElevenLabs: ${err?.message}` };
  }
}
