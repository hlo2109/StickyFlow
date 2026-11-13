import { AppSettings, CustomAiProvider } from '../../types';
import { resolveClaudeModel } from './config';
import { callClaude } from './providers/claude';
import { callHuggingFace } from './providers/huggingface';
import { callOpenAiCompatible } from './providers/openaiCompatible';
import { AiResponse, ProviderRequest } from './types';

export interface ConnectionTestResult {
  ok: boolean;
  ms: number;
  /** Mensaje listo para mostrar al usuario */
  message: string;
}

/** Petición mínima: gasta casi nada y comprueba clave, URL, modelo y red de una vez. */
const PROBE: ProviderRequest = {
  system: 'Responde únicamente con la palabra OK.',
  user: 'Ping',
  maxTokens: 64,
  singleAttempt: true,
  timeoutMs: 20_000
};

async function measure(run: () => Promise<AiResponse>, label: string): Promise<ConnectionTestResult> {
  const start = performance.now();
  const res = await run();
  const ms = Math.round(performance.now() - start);
  if (res.success) {
    const reply = (res.result || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return { ok: true, ms, message: `✓ ${label} responde en ${ms} ms${reply ? ` — «${reply}»` : ''}` };
  }
  return { ok: false, ms, message: res.error || 'No se pudo conectar.' };
}

/** Prueba un proveedor con los valores que hay AHORA en el formulario (aunque no se hayan guardado). */
export function testHuggingFace(settings: AppSettings): Promise<ConnectionTestResult> {
  return measure(() => callHuggingFace(PROBE, settings), `Hugging Face (${settings.hfModel || 'modelo por defecto'})`);
}

export function testClaude(settings: AppSettings): Promise<ConnectionTestResult> {
  return measure(() => callClaude(PROBE, settings), `Claude (${resolveClaudeModel(settings.claudeModel)})`);
}

export function testCustomProvider(provider: CustomAiProvider): Promise<ConnectionTestResult> {
  return measure(() => callOpenAiCompatible(PROBE, provider), `${provider.name || 'Proveedor'} (${provider.model})`);
}
