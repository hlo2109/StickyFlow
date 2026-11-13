import { AppSettings } from '../../types';
import { activeProviderLabel } from '../ai/status';
import { SpeedStats } from './session';

/** «1,3 s» (coma decimal, como se escribe en español). */
export function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

/** Tiempos de cierre de frase: menos silencio = responde antes, pero puede partir frases con pausas. */
export const SPEED_PRESETS = {
  rapida: { label: 'Rápida', silenceMs: 400, hint: 'Responde antes; puede partir frases si haces pausas largas' },
  normal: { label: 'Normal', silenceMs: 600, hint: 'Equilibrada' },
  cuidadosa: { label: 'Cuidadosa', silenceMs: 900, hint: 'Espera más antes de traducir; no parte frases con pausas' }
} as const;
export type SpeedPreset = keyof typeof SPEED_PRESETS;

/**
 * Consejos según DÓNDE se va el tiempo (se miden las etapas reales de tus últimas frases).
 * Devuelve como máximo 2, empezando por la etapa más lenta.
 */
export function speedTips(stats: SpeedStats, settings: AppSettings): string[] {
  if (stats.count < 2) return []; // con una sola frase el dato no es fiable

  const tips: Array<{ weight: number; text: string }> = [];

  if (stats.translateMs > 1800) {
    tips.push({
      weight: stats.translateMs,
      text: `La traducción tarda ${fmtSeconds(stats.translateMs)} (${activeProviderLabel(settings)}). Un modelo rápido y SIN razonamiento la deja en ~0,5 s: Claude Haiku, deepseek-chat o Llama en Groq (Ajustes → IA).`
    });
  }

  if (stats.sttMs > 1200) {
    tips.push({
      weight: stats.sttMs,
      text: settings.deepgramApiKey?.trim()
        ? `La transcripción tarda ${fmtSeconds(stats.sttMs)}: revisa tu conexión a internet.`
        : `La transcripción tarda ${fmtSeconds(stats.sttMs)}. Con una clave de Deepgram baja a ~0,4 s (Ajustes → Entrevista).`
    });
  }

  if (stats.ttsMs > 1500) {
    tips.push({
      weight: stats.ttsMs,
      text:
        (settings.elevenLabsModel || 'eleven_flash_v2_5') !== 'eleven_flash_v2_5'
          ? `Generar tu voz tarda ${fmtSeconds(stats.ttsMs)}. El modelo «Flash v2.5» es el más rápido (Ajustes → Entrevista).`
          : `Generar tu voz tarda ${fmtSeconds(stats.ttsMs)}: puede ser tu conexión o el servicio. En modo manual, activa «⚡ Voz lista de antemano».`
    });
  }

  if (tips.length === 0 && stats.totalMs > 3500) {
    tips.push({
      weight: stats.totalMs,
      text: `Desde que terminas de hablar hasta que suena pasan ${fmtSeconds(stats.totalMs)}. Prueba la velocidad «Rápida» o el modo manual con «⚡ Voz lista de antemano».`
    });
  }

  return tips.sort((a, b) => b.weight - a.weight).slice(0, 2).map((t) => t.text);
}
