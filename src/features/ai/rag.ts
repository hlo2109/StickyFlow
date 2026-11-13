import { AppSettings, Note } from '../../types';

/** Búsqueda local rápida por palabras sobre las notas del usuario. */
export function retrieveRelevantNotesContext(query: string, notes: Note[], maxResults = 3): string {
  if (!notes || notes.length === 0 || !query) return '';

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return '';

  const top = notes
    .map((note) => {
      const text = `${note.title} ${note.markdownContent || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
      return { note, score: words.filter((w) => text.includes(w)).length };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.note);

  if (top.length === 0) return '';

  return [
    '### Contexto Relevante de la Base de Conocimiento de Notas:',
    ...top.map((n) => `- **[${n.title || 'Sin título'}]**: ${(n.markdownContent || '').substring(0, 300)}...`)
  ].join('\n\n');
}

/** Consulta opcional a un worker propio de Cloudflare (RAG remoto). */
export async function queryCloudflareRag(query: string, settings: AppSettings): Promise<string> {
  const endpoint = settings.cloudflareRagEndpoint?.trim();
  if (!settings.enableCloudflareRag || !settings.cloudflareApiToken || !endpoint) return '';

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.cloudflareApiToken}`
      },
      body: JSON.stringify({ query, limit: 3 }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return data.context || data.results?.map((r: any) => r.text).join('\n') || '';
  } catch (e) {
    console.warn('Error consultando el RAG de Cloudflare:', e);
    return '';
  }
}
