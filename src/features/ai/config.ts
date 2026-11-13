/**
 * Modelos y límites de la capa de IA en un solo lugar.
 * Para actualizar un modelo, se cambia aquí y solo aquí.
 */

export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-5-5';
/** Modelo rápido y económico para tareas frecuentes como el radar de dudas. */
export const CLAUDE_FAST_MODEL = 'claude-haiku-5-5';

/** Modelos de Claude que ya no existen y deben reemplazarse por el actual. */
const RETIRED_CLAUDE_PREFIXES = ['claude-3-', 'claude-2', 'claude-instant'];

export function resolveClaudeModel(configured: string | undefined, fast = false): string {
  if (fast) return CLAUDE_FAST_MODEL;
  const model = configured?.trim();
  if (!model || RETIRED_CLAUDE_PREFIXES.some((p) => model.startsWith(p))) return CLAUDE_DEFAULT_MODEL;
  return model;
}

export const HF_DEFAULT_ENDPOINT = 'https://router.huggingface.co/v1';

/** Modelos que el router de Hugging Face rechaza en chat; se omiten para no perder tiempo. */
export const HF_UNSUPPORTED_MODELS = ['mistral-7b-instruct-v0.3', 'gpt-oss-120b'];

/** Respaldo corto (máximo 2) cuando el modelo elegido falla. */
export const HF_FALLBACK_MODELS = ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'];

export const DEFAULT_TIMEOUT_MS = 45_000;
export const LONG_TIMEOUT_MS = 90_000;

/** Tokens de salida por acción: las minutas largas necesitan más espacio que un resumen. */
export const MAX_TOKENS = {
  default: 2048,
  meeting_summary: 4096,
  generate_note: 3072,
  radar: 600
} as const;
