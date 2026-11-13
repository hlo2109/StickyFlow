export type ConversationKind = 'interview' | 'meeting';

export interface AnalysisQuestion {
  /** La pregunta, tal como se planteó (en tu idioma) */
  question: string;
  /** Quién la hizo ("Ellos", "Participante", nombre…) */
  askedBy: string;
  /** ¿Ya se respondió bien durante la conversación? */
  answered: boolean;
  /** Respuesta sugerida, en primera persona y en tu idioma, basada en tu contexto */
  suggestedAnswer: string;
}

export interface AnalysisAction {
  task: string;
  owner: string;
  due: string;
}

/** Resultado del análisis de una entrevista o reunión. */
export interface ConversationAnalysis {
  summary: string;
  keyPoints: string[];
  /** Preguntas que se hicieron, con respuesta sugerida */
  questions: AnalysisQuestion[];
  /** Cosas que quedaron sin responder o aclarar */
  pending: string[];
  actionItems: AnalysisAction[];
  /** Alertas: lo que conviene cuidar, aclarar o no prometer */
  watchOuts: string[];
  /** Preguntas inteligentes que podrías hacer tú */
  followUps: string[];
  /** La IA no devolvió el formato esperado: `summary` trae su texto tal cual */
  rawFallback?: boolean;
}

export interface AnalysisResult {
  success: boolean;
  analysis?: ConversationAnalysis;
  error?: string;
  /** Contexto usado en este análisis (para mostrar «usé 3 documentos») */
  contextParts?: number;
  contextTruncated?: boolean;
}
