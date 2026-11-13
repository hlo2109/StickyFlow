import { AppSettings, Note, MeetingDoubt } from '../types';

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
      systemMessage = 'Eres un asistente de reuniones ejecutivas de alto nivel. Analizas transcripciones de audio (sistema y micrófono), acuerdos y el radar de dudas para generar minutas claras, estructuradas y accionables.';
      promptInstruction = `Analiza la siguiente información de la reunión (transcripción viva, notas manuales y radar de dudas) y genera una minuta profesional en Markdown con:\n1. 🎯 Temas Clave y Contexto General\n2. 🤝 Decisiones y Acuerdos Tomados\n3. 💡 Dudas Resueltas durante la sesión\n4. ❓ Preguntas Pendientes / Cabos Sueltos por Aclarar\n5. 📌 Lista de Tareas y Pendientes (con casillas '- [ ]' y responsables/plazos si se mencionaron)\n\nInformación de la Reunión:`;
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
 * Classic HuggingFace Free Serverless Inference (raw model endpoint)
 */
async function callClassicHfInference(model: string, userMessage: string, systemPrompt: string, apiKey: string): Promise<string | null> {
  try {
    const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`;
    
    // Try both new router serverless and classic api-inference endpoints
    const endpoints = [
      `https://router.huggingface.co/hf-inference/models/${model}`,
      `https://api-inference.huggingface.co/models/${model}`
    ];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: fullPrompt,
            parameters: {
              max_new_tokens: 1400,
              temperature: 0.6,
              return_full_text: false
            },
            options: {
              wait_for_model: true,
              use_cache: false
            }
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          let rawText = '';
          if (Array.isArray(data) && data[0]?.generated_text) {
            rawText = data[0].generated_text;
          } else if (data?.generated_text) {
            rawText = data.generated_text;
          }
          if (rawText) {
            const cleaned = rawText
              .replace(/<\|im_end\|>/g, '')
              .replace(/<\|im_start\|>assistant/g, '')
              .trim();
            if (cleaned) return cleaned;
          }
        }
      } catch (innerErr) {
        console.warn(`Endpoint ${ep} failed for ${model}:`, innerErr);
      }
    }
  } catch (e) {
    console.warn(`Classic HF inference failed for ${model}:`, e);
  }
  return null;
}

/**
 * HuggingFace AI Client with Dual Router & Classic Free Serverless Fallback
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

  // Step 1: Filter out incompatible or paid models from the router list
  const isRouterChatCompatible = (m?: string) => {
    if (!m) return false;
    const lower = m.toLowerCase();
    if (lower.includes('mistral-7b-instruct-v0.3')) return false;
    if (lower.includes('gpt-oss-120b')) return false;
    return true;
  };

  const routerModelsToTry: string[] = [];
  const userModel = settings.hfModel?.trim();

  if (userModel && isRouterChatCompatible(userModel)) {
    routerModelsToTry.push(userModel);
  }

  // Known free OpenAI-compatible models supported on Hugging Face router
  routerModelsToTry.push(
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/Llama-3.3-70B-Instruct',
    'meta-llama/Llama-3.2-3B-Instruct',
    'deepseek-ai/DeepSeek-R1'
  );

  const uniqueRouterModels = Array.from(new Set(routerModelsToTry));
  let routerHad402 = false;
  let lastErrorMsg = '';

  for (const model of uniqueRouterModels) {
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

      if (response.ok) {
        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        if (result) {
          return { success: true, result };
        }
      }

      if (response.status === 402) {
        routerHad402 = true;
        // Router requires paid credits for this model, break to free serverless fallback immediately!
        break;
      }

      // If model not found or not a chat model on router, try next router model
      if (response.status === 404 || response.status === 400) {
        continue;
      }

      const errText = await response.text();
      lastErrorMsg = `Router error ${response.status}: ${errText.substring(0, 100)}`;
    } catch (err: any) {
      lastErrorMsg = err.message || 'Error de conexión con router';
    }
  }

  // Step 2: Classic Free Serverless Inference (100% free serverless tier, no credits/payment required)
  const classicModels = [
    'Qwen/Qwen2.5-72B-Instruct',
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
    'meta-llama/Llama-3.2-3B-Instruct',
    'google/gemma-2-9b-it'
  ];

  for (const classicModel of classicModels) {
    const classicResult = await callClassicHfInference(classicModel, userMessage, systemPrompt, apiKey);
    if (classicResult) {
      return { success: true, result: classicResult };
    }
  }

  // Step 3: If user has Claude API key configured as alternative, fallback to Claude automatically
  if (settings.claudeApiKey?.trim()) {
    console.warn('Falling back to Claude API...');
    return executeClaudeRequest(userMessage, settings, systemPrompt);
  }

  return {
    success: false,
    error: routerHad402
      ? 'Hugging Face Router reportó límite de cuenta (Error 402). Se intentó con los servidores gratuitos de respaldo pero no respondieron a tiempo. Intenta de nuevo en unos segundos.'
      : (lastErrorMsg || 'No se pudo conectar a los modelos de Hugging Face. Verifica tu API Key en Ajustes ⚙️.')
  };
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

/**
 * Radar Dinámico de Reunión en Vivo:
 * Analiza el nuevo segmento transcrito comparándolo contra las dudas abiertas.
 * - Si alguien respondió una duda abierta, la marca como resuelta con la respuesta concreta.
 * - Si surgió una ambigüedad o vacío crítico, formula una nueva pregunta estratégica.
 */
export async function analyzeMeetingDoubtRadar(
  newSegment: string,
  existingDoubts: MeetingDoubt[],
  settings: AppSettings
): Promise<{ updatedDoubts: MeetingDoubt[]; hasChanges: boolean; error?: string }> {
  if (!newSegment || newSegment.trim().length < 20) {
    return { updatedDoubts: existingDoubts, hasChanges: false };
  }

  const openDoubts = existingDoubts.filter(d => d.status === 'open');

  const systemPrompt = `Eres un copiloto ejecutivo de reuniones en tiempo real. Tu misión es mantener un radar inteligente de dudas y preguntas para el usuario.
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

  const promptContent = `DUDAS ABIERTAS EN ESTE MOMENTO:
${openDoubts.length > 0 ? JSON.stringify(openDoubts.map(d => ({ id: d.id, question: d.question })), null, 2) : 'Ninguna duda abierta actualmente.'}

NUEVO SEGMENTO HABLADO EN LA REUNIÓN (Últimos segundos):
"""
${newSegment.trim()}
"""

Instrucciones estrictas:
- Devuelve solo el JSON válido con "resolved" y "newDoubts".
- No agregues texto introductorio ni explicaciones fuera del JSON.`;

  try {
    let aiResponse: AiResponse;
    if (settings.activeAiProvider === 'claude') {
      aiResponse = await executeClaudeRequest(promptContent, settings, systemPrompt);
    } else {
      aiResponse = await executeHuggingFaceRequest(promptContent, settings, systemPrompt);
    }

    if (!aiResponse.success || !aiResponse.result) {
      return { updatedDoubts: existingDoubts, hasChanges: false, error: aiResponse.error };
    }

    let cleaned = aiResponse.result.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    const parsed = JSON.parse(cleaned);
    let hasChanges = false;
    let nextDoubts = [...existingDoubts];

    // Marcar dudas resueltas
    if (Array.isArray(parsed.resolved) && parsed.resolved.length > 0) {
      parsed.resolved.forEach((resItem: any) => {
        if (!resItem || !resItem.id) return;
        const target = nextDoubts.find(d => d.id === resItem.id && d.status === 'open');
        if (target) {
          target.status = 'resolved';
          target.resolvedAnswer = resItem.answer || 'Aclarado durante la reunión';
          target.resolvedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          hasChanges = true;
        }
      });
    }

    // Agregar nuevas dudas detectadas
    if (Array.isArray(parsed.newDoubts) && parsed.newDoubts.length > 0) {
      parsed.newDoubts.forEach((q: any) => {
        const questionText = typeof q === 'string' ? q.trim() : (q?.question ? String(q.question).trim() : '');
        if (questionText && questionText.length > 6) {
          const isDuplicate = nextDoubts.some(d => d.question.toLowerCase() === questionText.toLowerCase());
          if (!isDuplicate) {
            nextDoubts.push({
              id: 'd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              question: questionText,
              status: 'open',
              createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            hasChanges = true;
          }
        }
      });
    }

    return { updatedDoubts: nextDoubts, hasChanges };
  } catch (err: any) {
    console.warn('Error in analyzeMeetingDoubtRadar:', err);
    return { updatedDoubts: existingDoubts, hasChanges: false, error: err.message };
  }
}

