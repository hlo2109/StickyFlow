import { AppSettings } from '../../types';
import { languageName } from '../interview/languages';
import { runAi } from '../ai/providers';
import { maskSensitiveContent } from '../ai/privacy';
import { InterviewLine } from '../interview/session';
import { answerSystemPrompt, answerUserPrompt, analysisSystemPrompt, analysisUserPrompt } from './prompts';
import { isEmptyAnalysis, parseAnalysis } from './parse';
import { AnalysisResult, ConversationKind } from './types';

/** Lo máximo de conversación que se envía (lo más reciente): ≈ 6.000 tokens. */
export const MAX_TRANSCRIPT_CHARS = 24_000;
const ANALYSIS_TIMEOUT_MS = 90_000;
const ANSWER_TIMEOUT_MS = 45_000;

// ------------------------------------------------------------------ transcripción

/**
 * Conversación de una entrevista: lo tuyo como «Yo» y lo de ellos como «Ellos» (ya traducido a tu idioma;
 * si no hay traducción, el original).
 */
export function buildInterviewTranscript(lines: InterviewLine[]): string {
  return lines
    .filter((l) => l.original?.trim())
    .map((l) => (l.side === 'me' ? `Yo: ${l.original.trim()}` : `Ellos: ${(l.translation || l.original).trim()}`))
    .join('\n');
}

/** Transcripción de una reunión: «[Tú] …» pasa a «Yo: …» y «[Participante] …» a «Participante: …». */
export function normalizeMeetingTranscript(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\[Tú\]\s*/, 'Yo: ').replace(/^\s*\[Participante\]\s*/, 'Participante: '))
    .join('\n')
    .trim();
}

/** Se queda con lo más reciente si la conversación es muy larga. */
export function limitTranscript(transcript: string, max = MAX_TRANSCRIPT_CHARS): { text: string; truncated: boolean } {
  if (transcript.length <= max) return { text: transcript, truncated: false };
  const tail = transcript.slice(-max);
  // empezar en una línea completa
  const nl = tail.indexOf('\n');
  return { text: nl === -1 ? tail : tail.slice(nl + 1), truncated: true };
}

const mask = (settings: AppSettings, text: string) => (settings.enablePrivacyMasking !== false ? maskSensitiveContent(text).maskedText : text);

// ------------------------------------------------------------------ análisis

export interface AnalyzeArgs {
  transcript: string;
  /** Contexto ya armado (ver buildContextBlock) */
  context: string;
  kind: ConversationKind;
  settings: AppSettings;
  contextParts?: number;
  contextTruncated?: boolean;
}

/** Analiza la conversación: resumen, puntos clave, preguntas con respuesta sugerida, pendientes, acciones y alertas. */
export async function analyzeConversation(args: AnalyzeArgs): Promise<AnalysisResult> {
  const { settings } = args;
  if (!args.transcript.trim()) {
    return { success: false, error: 'Todavía no hay conversación que analizar. Inicia la grabación y habla un poco.' };
  }

  const limited = limitTranscript(args.transcript);
  const lang = languageName(settings.interviewMyLang || 'es');

  const res = await runAi(
    {
      system: analysisSystemPrompt(args.kind, lang),
      user: analysisUserPrompt({
        transcript: mask(settings, limited.text),
        context: mask(settings, args.context),
        truncatedTranscript: limited.truncated
      }),
      maxTokens: 3500,
      timeoutMs: ANALYSIS_TIMEOUT_MS
    },
    settings
  );

  if (!res.success || !res.result) {
    return { success: false, error: res.error || 'No se pudo analizar la conversación.' };
  }

  const analysis = parseAnalysis(res.result);
  if (isEmptyAnalysis(analysis)) {
    return { success: false, error: 'La IA no devolvió un análisis utilizable. Intenta de nuevo.' };
  }
  return { success: true, analysis, contextParts: args.contextParts, contextTruncated: args.contextTruncated };
}

// ------------------------------------------------------------------ una respuesta

export interface SuggestAnswerArgs {
  question: string;
  transcript: string;
  context: string;
  settings: AppSettings;
  style?: 'breve' | 'detallada';
}

/** Genera (o regenera) la respuesta a UNA pregunta, breve o detallada. */
export async function suggestAnswer(args: SuggestAnswerArgs): Promise<{ success: boolean; answer?: string; error?: string }> {
  const { settings } = args;
  if (!args.question.trim()) return { success: false, error: 'Falta la pregunta.' };

  const lang = languageName(settings.interviewMyLang || 'es');
  const recent = limitTranscript(args.transcript, 8_000).text;

  const res = await runAi(
    {
      system: answerSystemPrompt(lang, args.style ?? 'breve'),
      user: answerUserPrompt({ question: mask(settings, args.question), transcript: mask(settings, recent), context: mask(settings, args.context) }),
      maxTokens: 900,
      timeoutMs: ANSWER_TIMEOUT_MS
    },
    settings
  );

  if (!res.success || !res.result) return { success: false, error: res.error || 'No se pudo generar la respuesta.' };
  const answer = res.result.replace(/^["«“]|["»”]$/g, '').trim();
  return answer ? { success: true, answer } : { success: false, error: 'La IA devolvió una respuesta vacía.' };
}
