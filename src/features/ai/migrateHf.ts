import { AppSettings, CustomAiProvider } from '../../types';
import { HF_DEFAULT_ENDPOINT } from './config';
import { PROVIDER_PRESETS } from './presets';

/**
 * Antes de existir «Otros proveedores», para usar DeepSeek (u otro) había que escribir su URL y su clave en los
 * campos de Hugging Face. Funciona a medias (y rompe el respaldo con Whisper, que usa ese mismo endpoint).
 * Estas funciones detectan ese caso y lo convierten en un proveedor propio.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** ¿El «endpoint de Hugging Face» en realidad apunta a otro servicio? */
export function hfPointsElsewhere(settings: Pick<AppSettings, 'hfEndpoint'>): boolean {
  const endpoint = settings.hfEndpoint?.trim();
  if (!endpoint) return false;
  const host = hostOf(endpoint);
  return Boolean(host) && !host.endsWith('huggingface.co');
}

/** Nombre legible del servicio a partir de la URL (usa las plantillas conocidas: «DeepSeek», «OpenAI»…). */
export function providerNameFromUrl(url: string): string {
  const host = hostOf(url);
  const known = PROVIDER_PRESETS.find((p) => p.baseUrl && hostOf(p.baseUrl) === host);
  if (known) return known.name;
  const core = host.replace(/^(api|www)\./, '').split('.')[0] || 'Proveedor';
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/**
 * Cambios para convertir esa configuración en un proveedor propio:
 * crea el proveedor (con la URL, el modelo y la clave que ya estaban), lo deja en uso si Hugging Face lo estaba,
 * y devuelve los campos de Hugging Face a sus valores normales (sin la clave ajena).
 */
export function convertForeignHfToCustom(settings: AppSettings): Partial<AppSettings> {
  const baseUrl = settings.hfEndpoint.trim();
  const preset = PROVIDER_PRESETS.find((p) => p.baseUrl && hostOf(p.baseUrl) === hostOf(baseUrl));
  const provider: CustomAiProvider = {
    id: `custom-${Date.now().toString(36)}`,
    name: providerNameFromUrl(baseUrl),
    baseUrl,
    apiKey: settings.hfApiKey || '',
    model: settings.hfModel || preset?.model || '',
    fastModel: preset?.fastModel
  };
  const wasActive = settings.activeAiProvider === 'huggingface' || !settings.activeAiProvider;
  return {
    customProviders: [...(settings.customProviders ?? []), provider],
    activeAiProvider: wasActive ? provider.id : settings.activeAiProvider,
    hfEndpoint: HF_DEFAULT_ENDPOINT,
    hfApiKey: '',
    hfModel: 'Qwen/Qwen2.5-72B-Instruct'
  };
}
