import { ConversationKind } from './types';

const ROLE: Record<ConversationKind, string> = {
  interview:
    'una ENTREVISTA (de trabajo, técnica o con un cliente). La persona que te consulta es quien responde las preguntas y necesita contestar con claridad y seguridad.',
  meeting:
    'una REUNIÓN de trabajo. La persona que te consulta participa y necesita entender lo hablado, no perder pendientes y poder responder con precisión.'
};

/** Instrucciones del análisis. La respuesta DEBE ser JSON para poder mostrarla ordenada. */
export function analysisSystemPrompt(kind: ConversationKind, lang: string): string {
  return `Eres un asistente experto que ayuda a una persona DURANTE o justo después de ${ROLE[kind]}
Recibirás la transcripción (las líneas «Yo» son de la persona que te consulta; «Ellos»/«Participante» son los demás) y, si existe, CONTEXTO suyo: su CV, proyectos realizados, notas, información del cliente.

Tu trabajo: analizar lo conversado y ayudarle a responder bien.
Reglas:
- Escribe TODO en ${lang}.
- Sé concreto y breve. Nada de relleno ni frases genéricas.
- Las respuestas sugeridas van en PRIMERA PERSONA, como si las dijera la persona, naturales y habladas (2 a 4 frases), y deben apoyarse en el CONTEXTO cuando sea relevante (proyectos, tecnologías, resultados reales).
- NUNCA inventes experiencia, cifras, empresas ni datos que no estén en el contexto o en la conversación. Si falta información para responder bien, dilo en la respuesta de forma honesta (por ejemplo: «En ese tema tengo menos experiencia directa, pero…») o pide aclarar.
- Una pregunta cuenta como «answered: true» solo si la persona ya la contestó de forma suficiente en la conversación.
- Si algo no aplica, devuelve la lista vacía.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin bloques de código) con esta forma exacta:
{
  "summary": "resumen en 2 a 4 frases",
  "keyPoints": ["punto clave 1", "..."],
  "questions": [
    { "question": "pregunta hecha por los demás", "askedBy": "Ellos", "answered": false, "suggestedAnswer": "respuesta sugerida en primera persona" }
  ],
  "pending": ["algo que quedó sin responder o aclarar"],
  "actionItems": [ { "task": "tarea", "owner": "responsable o vacío", "due": "plazo o vacío" } ],
  "watchOuts": ["algo que conviene cuidar, aclarar o no prometer"],
  "followUps": ["pregunta inteligente que la persona podría hacer"]
}`;
}

export function analysisUserPrompt(args: { transcript: string; context: string; truncatedTranscript: boolean }): string {
  const parts: string[] = [];
  if (args.context.trim()) {
    parts.push(`=== CONTEXTO DE LA PERSONA (úsalo para sugerir respuestas; no lo repitas entero) ===\n${args.context.trim()}`);
  } else {
    parts.push('=== CONTEXTO DE LA PERSONA ===\n(No se cargó contexto. Basa las respuestas solo en lo conversado y sé honesto cuando falten datos.)');
  }
  parts.push(
    `=== TRANSCRIPCIÓN ===\n${args.truncatedTranscript ? '[… la parte inicial de la conversación se recortó por espacio]\n' : ''}${args.transcript.trim()}`
  );
  return parts.join('\n\n');
}

/** Para regenerar la respuesta de UNA pregunta (más breve / más detallada). */
export function answerSystemPrompt(lang: string, style: 'breve' | 'detallada'): string {
  return `Eres un asistente que ayuda a una persona a responder una pregunta en una entrevista o reunión.
Escribe en ${lang}, en PRIMERA PERSONA y con tono natural, como si lo dijera en voz alta.
${style === 'breve' ? 'Responde en 1 o 2 frases, directo al punto.' : 'Responde en 3 a 5 frases, con un ejemplo concreto si el contexto lo permite.'}
Apóyate en el CONTEXTO de la persona (proyectos, tecnologías, resultados reales). NUNCA inventes experiencia, cifras ni datos que no estén en el contexto; si falta información, responde con honestidad (por ejemplo, reconoce que tienes menos experiencia directa y di cómo lo abordarías).
Devuelve SOLO la respuesta, sin comillas ni explicaciones.`;
}

export function answerUserPrompt(args: { question: string; transcript: string; context: string }): string {
  return `${args.context.trim() ? `=== CONTEXTO DE LA PERSONA ===\n${args.context.trim()}\n\n` : ''}=== CONVERSACIÓN RECIENTE ===\n${args.transcript.trim() || '(sin conversación)'}\n\n=== PREGUNTA A RESPONDER ===\n${args.question.trim()}`;
}
