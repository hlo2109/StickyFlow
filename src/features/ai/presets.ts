/**
 * Plantillas de proveedores compatibles con el formato OpenAI (POST {baseUrl}/chat/completions).
 * Los nombres de modelo cambian con el tiempo: son solo una sugerencia y se pueden editar.
 */
export interface ProviderPreset {
  key: string;
  name: string;
  baseUrl: string;
  model: string;
  fastModel?: string;
  /** Texto de ayuda que se muestra al elegir la plantilla */
  hint?: string;
  /** No necesita API Key (servidor local) */
  noKey?: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    hint: 'Clave en platform.deepseek.com. «deepseek-reasoner» razona más pero es más lento.'
  },
  {
    key: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: 'Clave en platform.openai.com.'
  },
  {
    key: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
    hint: 'Muy rápido, con plan gratuito. Clave en console.groq.com.'
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    hint: 'Un solo acceso a cientos de modelos. Clave en openrouter.ai.'
  },
  {
    key: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    hint: 'Clave en aistudio.google.com.'
  },
  {
    key: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest'
  },
  {
    key: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
  },
  {
    key: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3-mini'
  },
  {
    key: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    noKey: true,
    hint: 'Corre en tu PC, sin clave. Si da error de acceso, inicia Ollama con OLLAMA_ORIGINS=* .'
  },
  {
    key: 'custom',
    name: 'Otro (personalizado)',
    baseUrl: '',
    model: '',
    hint: 'Cualquier servicio con API compatible con OpenAI: pon su URL base y el nombre del modelo.'
  }
];

export function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url.trim());
}
