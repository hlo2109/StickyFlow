import { AppSettings } from '../../../types';
import { AiResponse, ProviderRequest } from '../types';
import { callClaude } from './claude';
import { callHuggingFace } from './huggingface';
import { callOpenAiCompatible } from './openaiCompatible';

/**
 * Ejecuta la petición con el proveedor activo:
 *  - 'claude'                → Anthropic
 *  - id de proveedor propio  → servicio compatible con OpenAI (DeepSeek, OpenAI, Groq, Ollama…)
 *  - 'huggingface' (defecto) → Router de Hugging Face; si falla y hay clave de Claude, se usa Claude de respaldo
 */
export async function runAi(req: ProviderRequest, settings: AppSettings): Promise<AiResponse> {
  const active = settings.activeAiProvider;

  if (active === 'claude') {
    return callClaude(req, settings);
  }

  if (active && active !== 'huggingface') {
    const custom = settings.customProviders?.find((p) => p.id === active);
    if (!custom) {
      return {
        success: false,
        error: 'El proveedor de IA elegido ya no existe. Selecciona otro en Ajustes → IA.'
      };
    }
    return callOpenAiCompatible(req, custom);
  }

  const hf = await callHuggingFace(req, settings);
  if (hf.success || !settings.claudeApiKey?.trim()) return hf;

  console.warn('Hugging Face falló; usando Claude como respaldo.');
  return callClaude(req, settings);
}
