/** fetch con límite de tiempo: una IA que no responde no debe bloquear la app indefinidamente. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function describeNetworkError(err: any, provider: string): string {
  if (err?.name === 'AbortError') return `${provider} tardó demasiado en responder. Intenta de nuevo.`;
  return `Error de conexión con ${provider}: ${err?.message || 'desconocido'}`;
}
