import { AppSettings, MeetingDoubt } from '../../types';
import { MAX_TOKENS } from './config';
import { RADAR_SYSTEM_PROMPT } from './prompts';
import { runAi } from './providers';
import { maskSensitiveContent } from './privacy';

const RADAR_TIMEOUT_MS = 20_000;

const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Extrae el primer objeto JSON de la respuesta, aunque venga envuelto en ``` o con texto alrededor. */
function parseRadarJson(raw: string): { resolved?: any[]; newDoubts?: any[] } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('La IA no devolvió JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Radar de dudas en vivo:
 * compara el nuevo fragmento hablado contra las dudas abiertas, marca las resueltas
 * y sugiere nuevas preguntas cuando algo quedó ambiguo.
 *
 * Usa un modelo rápido y UN solo intento: corre cada pocos segundos y no debe acumular retraso.
 */
export async function analyzeMeetingDoubtRadar(
  newSegment: string,
  existingDoubts: MeetingDoubt[],
  settings: AppSettings
): Promise<{ updatedDoubts: MeetingDoubt[]; hasChanges: boolean; error?: string }> {
  if (!newSegment || newSegment.trim().length < 20) {
    return { updatedDoubts: existingDoubts, hasChanges: false };
  }

  const openDoubts = existingDoubts.filter((d) => d.status === 'open');
  const segment =
    settings.enablePrivacyMasking !== false ? maskSensitiveContent(newSegment.trim()).maskedText : newSegment.trim();

  const prompt = `DUDAS ABIERTAS EN ESTE MOMENTO:
${openDoubts.length > 0 ? JSON.stringify(openDoubts.map((d) => ({ id: d.id, question: d.question })), null, 2) : 'Ninguna duda abierta actualmente.'}

NUEVO SEGMENTO HABLADO EN LA REUNIÓN (Últimos segundos):
"""
${segment}
"""

Devuelve solo el JSON válido con "resolved" y "newDoubts", sin texto adicional.`;

  try {
    const ai = await runAi(
      {
        system: RADAR_SYSTEM_PROMPT,
        user: prompt,
        maxTokens: MAX_TOKENS.radar,
        fast: true,
        singleAttempt: true,
        timeoutMs: RADAR_TIMEOUT_MS
      },
      settings
    );

    if (!ai.success || !ai.result) {
      return { updatedDoubts: existingDoubts, hasChanges: false, error: ai.error };
    }

    const parsed = parseRadarJson(ai.result);
    let hasChanges = false;
    // Copias nuevas: no se modifican los objetos que React ya tiene en estado.
    let next = existingDoubts.map((d) => ({ ...d }));

    for (const item of parsed.resolved ?? []) {
      const target = item?.id ? next.find((d) => d.id === item.id && d.status === 'open') : undefined;
      if (target) {
        target.status = 'resolved';
        target.resolvedAnswer = item.answer || 'Aclarado durante la reunión';
        target.resolvedAt = nowLabel();
        hasChanges = true;
      }
    }

    for (const q of parsed.newDoubts ?? []) {
      const question = typeof q === 'string' ? q.trim() : q?.question ? String(q.question).trim() : '';
      if (question.length > 6 && !next.some((d) => d.question.toLowerCase() === question.toLowerCase())) {
        next = [
          ...next,
          {
            id: `d-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            question,
            status: 'open',
            createdAt: nowLabel()
          }
        ];
        hasChanges = true;
      }
    }

    return { updatedDoubts: next, hasChanges };
  } catch (err: any) {
    console.warn('Error en el radar de dudas:', err);
    return { updatedDoubts: existingDoubts, hasChanges: false, error: err.message };
  }
}
