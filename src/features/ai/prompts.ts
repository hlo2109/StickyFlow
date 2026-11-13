import { AiAction } from './types';

const DEFAULT_SYSTEM =
  'Eres un asistente de notas inteligente, conciso, productivo y privado en español. Usa Markdown limpio.';

interface PromptContext {
  tone?: string;
  ragContext?: string;
  customPrompt?: string;
}

interface Prompt {
  system: string;
  instruction: string;
}

/** Instrucciones por acción. Mantenerlas aquí evita mezclar textos de prompts con la lógica de red. */
export function buildPrompt(action: AiAction, ctx: PromptContext = {}): Prompt {
  switch (action) {
    case 'summarize':
      return {
        system: DEFAULT_SYSTEM,
        instruction: 'Genera un resumen claro, estructurado y conciso del siguiente texto. Usa viñetas breves:'
      };
    case 'improve':
      return {
        system: DEFAULT_SYSTEM,
        instruction:
          'Mejora la redacción, claridad, estilo y coherencia del siguiente texto en español, manteniéndolo natural y profesional. Devuelve solo el texto mejorado:'
      };
    case 'todo':
      return {
        system: DEFAULT_SYSTEM,
        instruction:
          "Analiza la siguiente nota y extrae todas las tareas pendientes, acciones a realizar o elementos To-Do. Devuélvelas como una lista de verificación en formato Markdown '- [ ] Tarea':"
      };
    case 'grammar':
      return {
        system: DEFAULT_SYSTEM,
        instruction:
          'Corrige la ortografía, puntuación y gramática del siguiente texto en español, sin alterar el sentido original. Devuelve solo el texto corregido:'
      };
    case 'continue':
      return {
        system: DEFAULT_SYSTEM,
        instruction: 'Continúa desarrollando la siguiente idea o texto de forma coherente y útil:'
      };
    case 'generate_note':
      return {
        system:
          'Eres un redactor experto. Tu labor es transformar pensamientos sueltos, notas rápidas o ideas desordenadas en una nota de trabajo perfectamente estructurada en Markdown (con título en #, subtítulos ##, listas de verificación - [ ] y notas clave).',
        instruction: `A partir de las siguientes ideas y notas sueltas, crea una nota completa, pulida y bien estructurada. Tono sugerido: ${ctx.tone || 'Profesional y Organizado'}.\n\nIdeas iniciales:`
      };
    case 'meeting_summary':
      return {
        system:
          'Eres un asistente de reuniones ejecutivas de alto nivel. Analizas transcripciones de audio (etiquetadas [Tú] y [Participante]), acuerdos y el radar de dudas para generar minutas claras, estructuradas y accionables.',
        instruction:
          "Analiza la siguiente información de la reunión (transcripción viva, notas manuales y radar de dudas) y genera una minuta profesional en Markdown con:\n1. 🎯 Temas Clave y Contexto General\n2. 🤝 Decisiones y Acuerdos Tomados\n3. 💡 Dudas Resueltas durante la sesión\n4. ❓ Preguntas Pendientes / Cabos Sueltos por Aclarar\n5. 📌 Lista de Tareas y Pendientes (con casillas '- [ ]' y responsables/plazos si se mencionaron)\n\nInformación de la Reunión:"
      };
    case 'rag_query':
      return {
        system: DEFAULT_SYSTEM,
        instruction: `Responde a la siguiente consulta utilizando el conocimiento de las notas del usuario si aplica:\n\n${ctx.ragContext ? `Contexto:\n${ctx.ragContext}\n\n` : ''}Pregunta:`
      };
    case 'custom':
    default:
      return {
        system: DEFAULT_SYSTEM,
        instruction: `${ctx.customPrompt || 'Analiza el siguiente texto:'}${ctx.ragContext ? `\n\n${ctx.ragContext}` : ''}`
      };
  }
}

export const RADAR_SYSTEM_PROMPT = `Eres un copiloto ejecutivo de reuniones en tiempo real. Tu misión es mantener un radar inteligente de dudas y preguntas para el usuario.
Analiza lo que acaban de hablar en el nuevo fragmento:
1. Revisa las dudas abiertas: ¿Alguien en la reunión acaba de responder, aclarar o acordar la solución a alguna de ellas? Si es así, indícala en "resolved" con una explicación de 1 frase.
2. Revisa el nuevo tema: ¿Se mencionó algo ambiguo, una tarea sin responsable, una fecha tentativa o un punto crítico no resuelto? Si es así, formula 1 (o máximo 2) preguntas concisas y directas en "newDoubts" para que el usuario las haga. Si la conversación es clara o rutinaria, deja "newDoubts" vacío.

Responde ÚNICAMENTE en formato JSON válido:
{
  "resolved": [
    { "id": "id_de_la_duda", "answer": "frase corta explicando cómo se resolvió" }
  ],
  "newDoubts": [
    "Pregunta sugerida 1"
  ]
}`;
