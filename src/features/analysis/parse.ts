import { AnalysisAction, AnalysisQuestion, ConversationAnalysis } from './types';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

const strList = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : [];

/** Quita ```json … ``` y razonamientos <think> que algunos modelos añaden alrededor del JSON. */
function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

/**
 * Convierte la respuesta de la IA en un análisis ordenado. Es tolerante: campos que faltan quedan vacíos,
 * tipos equivocados se corrigen, y si no hay JSON utilizable el texto se conserva como resumen (`rawFallback`).
 */
export function parseAnalysis(raw: string): ConversationAnalysis {
  const empty: ConversationAnalysis = { summary: '', keyPoints: [], questions: [], pending: [], actionItems: [], watchOuts: [], followUps: [] };
  const json = extractJson(raw);
  if (!json) return { ...empty, summary: raw.trim(), rawFallback: true };

  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    // JSON cortado o con comas sobrantes: se intenta una limpieza simple antes de rendirse
    try {
      data = JSON.parse(json.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return { ...empty, summary: raw.trim(), rawFallback: true };
    }
  }
  if (!data || typeof data !== 'object') return { ...empty, summary: raw.trim(), rawFallback: true };

  const questions: AnalysisQuestion[] = (Array.isArray(data.questions) ? data.questions : [])
    .map((q: any): AnalysisQuestion => ({
      question: str(q?.question),
      askedBy: str(q?.askedBy) || 'Ellos',
      answered: q?.answered === true || q?.answered === 'true',
      suggestedAnswer: str(q?.suggestedAnswer)
    }))
    .filter((q: AnalysisQuestion) => q.question)
    .slice(0, 15);

  const actionItems: AnalysisAction[] = (Array.isArray(data.actionItems) ? data.actionItems : [])
    .map((a: any): AnalysisAction => (typeof a === 'string' ? { task: a.trim(), owner: '', due: '' } : { task: str(a?.task), owner: str(a?.owner), due: str(a?.due) }))
    .filter((a: AnalysisAction) => a.task)
    .slice(0, 15);

  return {
    summary: str(data.summary),
    keyPoints: strList(data.keyPoints),
    questions,
    pending: strList(data.pending),
    actionItems,
    watchOuts: strList(data.watchOuts),
    followUps: strList(data.followUps)
  };
}

/** ¿El análisis trae algo para mostrar? */
export function isEmptyAnalysis(a: ConversationAnalysis): boolean {
  return !a.summary && a.keyPoints.length === 0 && a.questions.length === 0 && a.pending.length === 0 && a.actionItems.length === 0 && a.watchOuts.length === 0 && a.followUps.length === 0;
}
