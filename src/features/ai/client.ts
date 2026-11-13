import { LONG_TIMEOUT_MS, MAX_TOKENS } from './config';
import { buildPrompt } from './prompts';
import { runAi } from './providers';
import { maskSensitiveContent } from './privacy';
import { queryCloudflareRag, retrieveRelevantNotesContext } from './rag';
import { AiRequestOptions, AiResponse } from './types';

/**
 * Punto de entrada único para las acciones de IA sobre notas.
 * Flujo: enmascarar datos sensibles → recuperar contexto (RAG) → armar prompt → proveedor.
 */
export async function executeAiTask(options: AiRequestOptions): Promise<AiResponse> {
  const { action, content, customPrompt, settings, allNotes, tone } = options;

  if (!content && action !== 'custom' && action !== 'generate_note') {
    return { success: false, error: 'Escribe algo o proporciona ideas para la IA.' };
  }

  // 1. Privacidad: nada de claves ni contraseñas sale hacia la IA.
  let text = content;
  let promptText = customPrompt;
  let maskedCount = 0;
  if (settings.enablePrivacyMasking !== false) {
    const maskedContent = maskSensitiveContent(text);
    text = maskedContent.maskedText;
    maskedCount += maskedContent.count;
    if (promptText) {
      const maskedPrompt = maskSensitiveContent(promptText);
      promptText = maskedPrompt.maskedText;
      maskedCount += maskedPrompt.count;
    }
  }

  // 2. Contexto de las notas del usuario, si aplica.
  let ragContext = '';
  if (action === 'rag_query' || settings.enableCloudflareRag) {
    if (settings.enableCloudflareRag) ragContext = await queryCloudflareRag(text, settings);
    if (!ragContext && allNotes?.length) ragContext = retrieveRelevantNotesContext(text, allNotes);
  }

  // 3. Prompt + proveedor.
  const { system, instruction } = buildPrompt(action, { tone, ragContext, customPrompt: promptText });
  const isLong = action === 'meeting_summary' || action === 'generate_note';
  const response = await runAi(
    {
      system,
      user: `${instruction}\n\n---\n${text}`,
      maxTokens: MAX_TOKENS[action === 'meeting_summary' || action === 'generate_note' ? action : 'default'],
      timeoutMs: isLong ? LONG_TIMEOUT_MS : undefined
    },
    settings
  );

  if (response.success && response.result && action === 'generate_note') {
    const heading = response.result.match(/^#\s+(.+)$/m);
    if (heading) response.suggestedTitle = heading[1].trim();
  }

  response.maskedInfo = {
    maskedCount,
    description:
      maskedCount > 0
        ? `Se protegieron y enmascararon ${maskedCount} datos sensibles (claves/tokens) antes de enviar a la IA.`
        : undefined
  };

  return response;
}
