import { AppSettings, Note } from '../../types';

export type AiAction =
  | 'summarize'
  | 'improve'
  | 'todo'
  | 'grammar'
  | 'continue'
  | 'custom'
  | 'generate_note'
  | 'meeting_summary'
  | 'rag_query';

export interface AiRequestOptions {
  action: AiAction;
  content: string;
  customPrompt?: string;
  settings: AppSettings;
  /** Notas del usuario para dar contexto (RAG local) */
  allNotes?: Note[];
  tone?: string;
}

export interface AiResponse {
  success: boolean;
  result?: string;
  suggestedTitle?: string;
  error?: string;
  maskedInfo?: {
    maskedCount: number;
    description?: string;
  };
}

/** Petición ya armada, lista para enviarse a cualquier proveedor. */
export interface ProviderRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Prioriza rapidez y costo sobre calidad (por ejemplo, el radar de dudas en vivo). */
  fast?: boolean;
  /** Si es true, el proveedor no recorre cadenas de modelos alternativos: una sola intención, un solo intento. */
  singleAttempt?: boolean;
  timeoutMs?: number;
}

export type ProviderFn = (req: ProviderRequest, settings: AppSettings) => Promise<AiResponse>;
