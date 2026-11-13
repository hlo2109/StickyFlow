import { AppSettings } from '../../types';
import { resolveClaudeModel } from './config';
import { isLocalUrl } from './presets';

/** Proveedor activo si es uno personalizado; undefined si es Hugging Face o Claude. */
export function getActiveCustomProvider(settings: AppSettings) {
  return settings.customProviders?.find((p) => p.id === settings.activeAiProvider);
}

/** ¿Hay lo necesario para usar la IA con el proveedor activo? */
export function isAiReady(settings: AppSettings): boolean {
  if (settings.activeAiProvider === 'claude') return Boolean(settings.claudeApiKey?.trim());
  const custom = getActiveCustomProvider(settings);
  if (custom) {
    return Boolean(custom.baseUrl.trim() && custom.model.trim() && (custom.apiKey.trim() || isLocalUrl(custom.baseUrl)));
  }
  // Hugging Face (y, como respaldo automático, Claude si tiene clave)
  return Boolean(settings.hfApiKey?.trim() || settings.claudeApiKey?.trim());
}

/** Nombre corto del proveedor activo para mostrar en pantalla. */
export function activeProviderLabel(settings: AppSettings): string {
  if (settings.activeAiProvider === 'claude') return `Claude (${resolveClaudeModel(settings.claudeModel)})`;
  const custom = getActiveCustomProvider(settings);
  if (custom) return `${custom.name} (${custom.model})`;
  return `Hugging Face (${settings.hfModel || 'Qwen'})`;
}
