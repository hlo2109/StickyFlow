import { AppSettings } from '../../../types';
import { DEFAULT_TIMEOUT_MS, resolveClaudeModel } from '../config';
import { ProviderRequest, AiResponse } from '../types';
import { describeNetworkError, fetchWithTimeout } from './http';

export async function callClaude(req: ProviderRequest, settings: AppSettings): Promise<AiResponse> {
  const apiKey = settings.claudeApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Falta la API Key de Claude (Anthropic). Configúrala en Ajustes ⚙️ o cambia el proveedor a Hugging Face.'
    };
  }

  try {
    const response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: resolveClaudeModel(settings.claudeModel, req.fast),
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.user }]
        })
      },
      req.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      const errText = await response.text();
      let message = `Error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        message += `: ${errText.substring(0, 150)}`;
      }
      return { success: false, error: message };
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
      .trim();
    return text ? { success: true, result: text } : { success: false, error: 'Claude no devolvió texto.' };
  } catch (err: any) {
    return { success: false, error: describeNetworkError(err, 'Claude') };
  }
}
