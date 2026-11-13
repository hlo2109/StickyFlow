import { AppSettings } from '../../../types';
import { AiResponse, ProviderRequest } from '../types';
import { callClaude } from './claude';
import { callHuggingFace } from './huggingface';

/**
 * Ejecuta la petición con el proveedor activo.
 * Si es Hugging Face y falla, usa Claude como respaldo cuando hay clave configurada.
 */
export async function runAi(req: ProviderRequest, settings: AppSettings): Promise<AiResponse> {
  if (settings.activeAiProvider === 'claude') {
    return callClaude(req, settings);
  }

  const hf = await callHuggingFace(req, settings);
  if (hf.success || !settings.claudeApiKey?.trim()) return hf;

  console.warn('Hugging Face falló; usando Claude como respaldo.');
  return callClaude(req, settings);
}
