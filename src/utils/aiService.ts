import { AppSettings, Note } from '../types';

export interface AiRequestOptions {
  action: 'summarize' | 'improve' | 'todo' | 'grammar' | 'continue' | 'custom' | 'generate_note' | 'meeting_summary' | 'rag_query';
  content: string;
  customPrompt?: string;
  settings: AppSettings;
  allNotes?: Note[]; // for local or Cloudflare RAG context
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

/**
 * Mask sensitive data (API keys, passwords, bearer tokens, secrets) before sending to external LLM
 */
export function maskSensitiveContent(text: string): { maskedText: string; count: number } {
  if (!text) return { maskedText: '', count: 0 };

  let count = 0;
  let masked = text;

  // 1. Hugging Face API keys
  masked = masked.replace(/hf_[a-zA-Z0-9]{25,}/g, () => {
    count++;
    return '[PROTEGIDO:HF_KEY]';
  });

  // 2. Anthropic / Claude API keys
  masked = masked.replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, () => {
    count++;
    return '[PROTEGIDO:CLAUDE_KEY]';
  });

  // 3. OpenAI and generic API keys
  masked = masked.replace(/sk-[a-zA-Z0-9]{20,}/g, () => {
    count++;
    return '[PROTEGIDO:API_KEY]';
  });

  // 4. GitHub Tokens
  masked = masked.replace(/ghp_[a-zA-Z0-9]{30,}/g, () => {
    count++;
    return '[PROTEGIDO:GITHUB_TOKEN]';
  });

  // 5. Password / Token lines (e.g. password: 12345, clave: secret)
  masked = masked.replace(/(password|passwd|clave|contraseña|secret|token|api_key)\s*[:=]\s*([^\s,;]+)/gi, (_match, p1) => {
    count++;
    return `${p1}: [PROTEGIDO:SECRETO]`;
  });

  // 6. Bearer tokens
  masked = masked.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, () => {
    count++;
    return 'Bearer [PROTEGIDO:BEARER_TOKEN]';
  });

  return { maskedText: masked, count };
}

/**
 * Local fast RAG retrieval across notes
 */
function retrieveRelevantNotesContext(query: string, notes: Note[], maxResults = 3): string {
  if (!notes || notes.length === 0 || !query) return '';

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return '';

  const scoredNotes = notes.map(note => {
    const text = `${note.title} ${note.markdownContent || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (text.includes(word)) score += 1;
    });
    return { note, score };
  }).filter(item => item.score > 0);

  scoredNotes.sort((a, b) => b.score - a.score);
  const topNotes = scoredNotes.slice(0, maxResults).map(item => item.note);

  if (topNotes.length === 0) return '';

  return [
    '### Contexto Relevante de la Base de Conocimiento de Notas:',
    ...topNotes.map(n => `- **[${n.title || 'Sin título'}]**: ${(n.markdownContent || '').substring(0, 300)}...`)
  ].join('\n\n');
}

/**
 * Cloudflare RAG Query
 */
async function queryCloudflareRag(query: string, settings: AppSettings): Promise<string> {
  if (!settings.enableCloudflareRag || !settings.cloudflareApiToken) {
    return '';
  }

  const ragEndpoint = settings.cloudflareRagEndpoint?.trim();
  if (ragEndpoint) {
    try {
      const resp = await fetch(ragEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.cloudflareApiToken}`
        },
        body: JSON.stringify({ query, limit: 3 })
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.context || data.results?.map((r: any) => r.text).join('\n') || '';
      }
    } catch (e) {
      console.warn('Error querying custom Cloudflare RAG endpoint:', e);
    }
  }

  return '';
}

export async function executeAiTask(options: AiRequestOptions): Promise<AiResponse> {
  const { action, content, customPrompt, settings, allNotes, tone } = options;

  if (!content && action !== 'custom' && action !== 'generate_note') {
    return { success: false, error: 'Escribe algo o proporciona ideas para la IA.' };
  }

  // 1. Apply Privacy Masking if enabled
  let textToSend = content;
  let maskedCount = 0;
  if (settings.enablePrivacyMasking !== false) {
    const maskResult = maskSensitiveContent(textToSend);
    textToSend = maskResult.maskedText;
    maskedCount = maskResult.count;
  }

  // 2. Retrieve RAG Context if relevant
  let ragContext = '';
  if (action === 'rag_query' || settings.enableCloudflareRag) {
    if (settings.enableCloudflareRag) {
      ragContext = await queryCloudflareRag(textToSend, settings);
    }
    if (!ragContext && allNotes && allNotes.length > 0) {
      ragContext = retrieveRelevantNotesContext(textToSend, allNotes);
    }
  }

  // 3. Build Prompt Instructions based on action
  let promptInstruction = '';
  let systemMessage = 'Eres un asistente de notas inteligente, conciso, productivo y privado en español. Usa Markdown limpio.';

  switch (action) {
    case 'summarize':
      promptInstruction = `Genera un resumen claro, estructurado y conciso del siguiente texto. Usa viñetas breves:`;
      break;
    case 'improve':
      promptInstruction = `Mejora la redacción, claridad, estilo y coherencia del siguiente texto en español, manteniéndolo natural y profesional. Devuelve solo el texto mejorado:`;
      break;
    case 'todo':
      promptInstruction = `Analiza la siguiente nota y extrae todas las tareas pendientes, acciones a realizar o elementos To-Do. Devuélvelas como una lista de verificación en formato Markdown '- [ ] Tarea':`;
      break;
    case 'grammar':
      promptInstruction = `Corrige la ortografía, puntuación y gramática del siguiente texto en español, sin alterar el sentido original. Devuelve solo el texto corregido:`;
      break;
    case 'continue':
      promptInstruction = `Continúa desarrollando la siguiente idea o texto de forma coherente y útil:`;
      break;
    case 'generate_note':
      systemMessage = 'Eres un redactor experto. Tu labor es transformar pensamientos sueltos, notas rápidas o ideas desordenadas en una nota de trabajo perfectamente estructurada en Markdown (con título en #, subtítulos ##, listas de verificación - [ ] y notas clave).';
      promptInstruction = `A partir de las siguientes ideas y notas sueltas, crea una nota completa, pulida y bien estructurada. Tono sugerido: ${tone || 'Profesional y Organizado'}.\n\nIdeas iniciales:`;
      break;
    case 'meeting_summary':
      systemMessage = 'Eres un asistente de reuniones ejecutivas. Analizas transcripciones de audio (sistema y micrófono) para generar minutas claras.';
      promptInstruction = `Analiza la siguiente transcripción de reunión y genera una minuta con:\n1. 🎯 Temas Clave Discutidos\n2. 🤝 Decisiones y Acuerdos Tomados\n3. 📌 Lista de Tareas y Pendientes (con casillas '- [ ]')\n\nTranscripción:`;
      break;
    case 'rag_query':
      promptInstruction = `Responde a la siguiente consulta utilizando el conocimiento de las notas del usuario si aplica:\n\n${ragContext ? `Contexto:\n${ragContext}\n\n` : ''}Pregunta:`;
      break;
    case 'custom':
      promptInstruction = customPrompt || 'Analiza el siguiente texto:';
      if (ragContext) {
        promptInstruction += `\n\n${ragContext}`;
      }
      break;
  }

  const userMessage = `${promptInstruction}\n\n---\n${textToSend}`;

  // Execute request with active provider
  let response: AiResponse;
  if (settings.activeAiProvider === 'claude') {
    response = await executeClaudeRequest(userMessage, settings, systemMessage);
  } else {
    response = await executeHuggingFaceRequest(userMessage, settings, systemMessage);
  }

  // If this was a note generation, extract suggested title if present
  if (response.success && response.result && action === 'generate_note') {
    const firstHeadingMatch = response.result.match(/^#\s+(.+)$/m);
    if (firstHeadingMatch) {
      response.suggestedTitle = firstHeadingMatch[1].trim();
    }
  }

  response.maskedInfo = {
    maskedCount,
    description: maskedCount > 0 ? `Se protegieron y enmascararon ${maskedCount} datos sensibles (claves/tokens) antes de enviar a la IA.` : undefined
  };

  return response;
}

/**
 * HuggingFace OpenAI-compatible Router Client
 */
async function executeHuggingFaceRequest(userMessage: string, settings: AppSettings, systemPrompt: string): Promise<AiResponse> {
  const apiKey = settings.hfApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Falta la API Key de Hugging Face. Configúrala en Ajustes ⚙️ (pestaña IA).'
    };
  }

  const endpoint = (settings.hfEndpoint || 'https://router.huggingface.co/v1').replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;
  const model = settings.hfModel || 'openai/gpt-oss-120b';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.6,
        max_tokens: 1600
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Error ${response.status} (${response.statusText})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errorMsg = parsed.error.message;
        else if (parsed.message) errorMsg = parsed.message;
      } catch {
        if (errText) errorMsg += `: ${errText.substring(0, 150)}`;
      }
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || 'No se recibió respuesta del modelo.';
    return { success: true, result };
  } catch (err: any) {
    console.error('Hugging Face AI error:', err);
    return { success: false, error: `Error de conexión: ${err.message || 'Error desconocido'}` };
  }
}

/**
 * Claude (Anthropic API) Client
 */
async function executeClaudeRequest(userMessage: string, settings: AppSettings, systemPrompt: string): Promise<AiResponse> {
  const apiKey = settings.claudeApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Falta la API Key de Claude (Anthropic). Configúrala en Ajustes ⚙️ o cambia el proveedor a Hugging Face.'
    };
  }

  const model = settings.claudeModel || 'claude-3-5-sonnet-20241022';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1600,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errorMsg = parsed.error.message;
      } catch {
        errorMsg += `: ${errText.substring(0, 150)}`;
      }
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const result = data.content?.[0]?.text?.trim() || 'Sin respuesta de Claude.';
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: `Error de conexión con Claude: ${err.message}` };
  }
}
