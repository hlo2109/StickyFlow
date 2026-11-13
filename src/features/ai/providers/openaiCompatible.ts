import { CustomAiProvider } from '../../../types';
import { DEFAULT_TIMEOUT_MS } from '../config';
import { isLocalUrl } from '../presets';
import { AiResponse, ProviderRequest } from '../types';
import { describeNetworkError, fetchWithTimeout } from './http';

/**
 * Cliente genérico para cualquier servicio con API compatible con OpenAI
 * (DeepSeek, OpenAI, Groq, Gemini, OpenRouter, Mistral, Ollama, ...).
 */

/** Acepta «https://api.deepseek.com», con barra final o con /chat/completions ya pegado. */
export function buildChatUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
  return `${clean}/chat/completions`;
}

/** Algunos modelos de razonamiento devuelven su "pensamiento" entre <think>…</think>; no es parte de la respuesta. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const raw = await response.text();
    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? raw).substring(0, 200);
    } catch {
      return raw.substring(0, 200);
    }
  } catch {
    return '';
  }
}

export async function callOpenAiCompatible(
  req: ProviderRequest,
  provider: CustomAiProvider
): Promise<AiResponse> {
  const name = provider.name || 'el proveedor';
  const baseUrl = provider.baseUrl?.trim();
  const apiKey = provider.apiKey?.trim();

  if (!baseUrl) return { success: false, error: `Falta la URL base de ${name} (Ajustes → IA).` };
  if (!/^https?:\/\//i.test(baseUrl)) {
    return { success: false, error: 'La URL base debe empezar por https:// (o http:// si es un servidor local).' };
  }
  if (!apiKey && !isLocalUrl(baseUrl)) {
    return { success: false, error: `Falta la API Key de ${name} (Ajustes → IA).` };
  }

  const model = (req.fast && provider.fastModel?.trim()) || provider.model?.trim();
  if (!model) return { success: false, error: `Falta el nombre del modelo de ${name} (Ajustes → IA).` };

  try {
    const response = await fetchWithTimeout(
      buildChatUrl(baseUrl),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user }
          ],
          temperature: 0.6,
          max_tokens: req.maxTokens,
          stream: false
        })
      },
      req.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      const detail = await readErrorMessage(response);
      switch (response.status) {
        case 401:
        case 403:
          return { success: false, error: `${name}: la API Key no es válida o no tiene permiso${detail ? ` (${detail})` : ''}.` };
        case 402:
          return { success: false, error: `${name}: saldo insuficiente. Recarga tu cuenta en el panel del proveedor.` };
        case 404:
          return { success: false, error: `${name}: no se encontró el modelo «${model}» o la URL base es incorrecta${detail ? ` (${detail})` : ''}.` };
        case 429:
          return { success: false, error: `${name}: demasiadas peticiones o límite de uso alcanzado. Espera un momento.` };
        default:
          return { success: false, error: `${name} respondió ${response.status}${detail ? `: ${detail}` : ''}` };
      }
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const result = typeof content === 'string' ? stripThinking(content) : '';
    if (!result) return { success: false, error: `${name} devolvió una respuesta vacía.` };
    return { success: true, result };
  } catch (err: any) {
    // En un servidor local, "Failed to fetch" casi siempre significa que no está encendido o bloquea el acceso (CORS).
    if (isLocalUrl(baseUrl) && err?.name !== 'AbortError') {
      return {
        success: false,
        error: `No se pudo conectar con ${name} en ${baseUrl}. ¿Está encendido? Si usas Ollama, inícialo con OLLAMA_ORIGINS=*`
      };
    }
    return { success: false, error: describeNetworkError(err, name) };
  }
}
