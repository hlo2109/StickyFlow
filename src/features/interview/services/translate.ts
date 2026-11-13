import { AppSettings } from '../../../types';
import { runAi } from '../../ai/providers';
import { englishLanguageName } from '../languages';

const TRANSLATE_TIMEOUT_MS = 15_000;

export interface TranslateResult {
  success: boolean;
  text: string;
  error?: string;
}

function buildSystemPrompt(from: string, to: string, context?: string): string {
  return [
    `You are a professional real-time interpreter. Translate the user's message from ${englishLanguageName(from)} to ${englishLanguageName(to)}.`,
    'Rules:',
    '- Output ONLY the translation. No quotes, notes, explanations or language labels.',
    '- Keep the speaker\'s tone, register and intent. Keep it natural and spoken, not literal.',
    '- Preserve names, numbers, dates, brand names and technical terms (translate a term only if there is a standard equivalent).',
    '- The text comes from speech recognition and may have small errors; interpret what the speaker most likely meant.',
    '- If the message is empty, meaningless noise, or already in the target language, return it unchanged.',
    context?.trim() ? `\nBackground about the speaker (use it to choose correct technical vocabulary, do not mention it):\n${context.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

/** Quita comillas o prefijos que algunos modelos añaden aunque se les pida que no. */
function cleanTranslation(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^(translation|traducci[oó]n)\s*:\s*/i, '');
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Traduce una frase. `recent` son los últimos turnos de la conversación (solo como contexto).
 * Usa el modelo rápido del proveedor activo y un único intento: en una conversación en vivo
 * es mejor fallar rápido que esperar.
 */
export async function translateText(
  text: string,
  from: string,
  to: string,
  settings: AppSettings,
  recent: string[] = []
): Promise<TranslateResult> {
  const clean = text.trim();
  if (!clean) return { success: true, text: '' };
  if (from === to) return { success: true, text: clean };

  const context = recent.length
    ? `Previous turns of the conversation (context only, do NOT translate them):\n${recent.slice(-4).map((r) => `- ${r}`).join('\n')}\n\n`
    : '';

  const res = await runAi(
    {
      system: buildSystemPrompt(from, to, settings.interviewContext),
      user: `${context}Message to translate:\n${clean}`,
      maxTokens: Math.min(800, Math.max(120, clean.length * 3)),
      fast: true,
      singleAttempt: true,
      timeoutMs: TRANSLATE_TIMEOUT_MS
    },
    settings
  );

  if (!res.success || !res.result) {
    return { success: false, text: '', error: res.error || 'No se pudo traducir.' };
  }
  return { success: true, text: cleanTranslation(res.result) };
}
