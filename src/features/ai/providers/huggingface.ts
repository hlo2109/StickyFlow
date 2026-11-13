import { AppSettings } from '../../../types';
import {
  DEFAULT_TIMEOUT_MS,
  HF_DEFAULT_ENDPOINT,
  HF_FALLBACK_MODELS,
  HF_UNSUPPORTED_MODELS
} from '../config';
import { ProviderRequest, AiResponse } from '../types';
import { describeNetworkError, fetchWithTimeout } from './http';

function modelsToTry(settings: AppSettings, singleAttempt?: boolean): string[] {
  const chosen = settings.hfModel?.trim();
  const usable = chosen && !HF_UNSUPPORTED_MODELS.some((m) => chosen.toLowerCase().includes(m)) ? [chosen] : [];
  const chain = singleAttempt ? usable : [...usable, ...HF_FALLBACK_MODELS];
  const unique = Array.from(new Set(chain));
  return unique.length > 0 ? unique : [HF_FALLBACK_MODELS[0]];
}

export async function callHuggingFace(req: ProviderRequest, settings: AppSettings): Promise<AiResponse> {
  const apiKey = settings.hfApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Falta la API Key de Hugging Face. Configúrala en Ajustes ⚙️ (pestaña IA).'
    };
  }

  const endpoint = (settings.hfEndpoint || HF_DEFAULT_ENDPOINT).replace(/\/+$/, '');
  let lastError = '';

  for (const model of modelsToTry(settings, req.singleAttempt)) {
    try {
      const response = await fetchWithTimeout(
        `${endpoint}/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.user }
            ],
            temperature: 0.6,
            max_tokens: req.maxTokens
          })
        },
        req.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

      if (response.ok) {
        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        if (result) return { success: true, result };
        lastError = 'El modelo devolvió una respuesta vacía.';
        continue;
      }

      // 402: cuenta sin créditos para este router. Probar más modelos no sirve de nada.
      if (response.status === 402) {
        return {
          success: false,
          error:
            'Hugging Face reportó límite de cuenta (error 402). Revisa tus créditos o cambia de proveedor en Ajustes ⚙️.'
        };
      }
      // 401/403: la clave es inválida; los demás modelos fallarán igual.
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'La API Key de Hugging Face no es válida o no tiene permisos.' };
      }
      // 400/404: el modelo no existe o no es de chat → pasar al siguiente.
      if (response.status === 400 || response.status === 404) {
        lastError = `El modelo ${model} no está disponible en el router.`;
        continue;
      }

      lastError = `Hugging Face ${response.status}: ${(await response.text()).substring(0, 100)}`;
    } catch (err: any) {
      lastError = describeNetworkError(err, 'Hugging Face');
    }
  }

  return {
    success: false,
    error: lastError || 'No se pudo conectar a Hugging Face. Verifica tu API Key en Ajustes ⚙️.'
  };
}
