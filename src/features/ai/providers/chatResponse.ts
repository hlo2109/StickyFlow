/**
 * Lectura de respuestas de «chat completions» (formato OpenAI) y manejo del caso "respuesta vacía".
 *
 * Caso típico: un modelo que «razona» antes de contestar (DeepSeek R1/reasoner/flash, gpt-oss, QwQ, o1…) gasta
 * todos los tokens permitidos en pensar y devuelve `content` vacío con `finish_reason: "length"`. No es un fallo
 * de red ni de clave: simplemente no le quedó espacio para escribir la respuesta.
 */

export interface ParsedChat {
  text: string;
  finishReason?: string;
  /** El modelo devolvió "razonamiento" aparte del contenido */
  hadReasoning: boolean;
}

/** Algunos modelos incluyen su pensamiento entre <think>…</think>; no es parte de la respuesta. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function parseChat(data: any): ParsedChat {
  const choice = data?.choices?.[0];
  const message = choice?.message ?? {};
  const content = typeof message.content === 'string' ? message.content : '';
  const reasoning = message.reasoning_content ?? message.reasoning ?? '';
  return {
    text: stripThinking(content),
    finishReason: choice?.finish_reason,
    hadReasoning: Boolean(reasoning) || /<think>/i.test(content)
  };
}

/** ¿Vale la pena reintentar con más espacio? Solo si se cortó por límite de tokens. */
export function shouldRetryWithMoreTokens(parsed: ParsedChat): boolean {
  return !parsed.text && (parsed.finishReason === 'length' || parsed.hadReasoning);
}

/** Presupuesto del reintento: bastante mayor, con tope razonable. */
export function retryBudget(maxTokens: number): number {
  return Math.min(4096, Math.max(2048, maxTokens * 6));
}

/** Mensaje claro cuando, aun reintentando, no hay texto. */
export function emptyResponseMessage(provider: string, model: string, parsed: ParsedChat): string {
  if (parsed.hadReasoning || parsed.finishReason === 'length') {
    return (
      `${provider}: el modelo «${model}» se quedó «pensando» y no llegó a escribir la respuesta. ` +
      'Es un modelo de razonamiento: prueba con uno de chat normal (por ejemplo «deepseek-chat» en DeepSeek o «Qwen/Qwen2.5-72B-Instruct» en Hugging Face).'
    );
  }
  return `${provider}: el modelo «${model}» devolvió una respuesta vacía. Comprueba el nombre del modelo con «Probar conexión» en Ajustes → IA.`;
}
