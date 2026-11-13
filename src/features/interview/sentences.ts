/**
 * Divide un texto en trozos para sintetizar la voz EN PARALELO y empezar a hablar antes:
 * la primera frase suena en cuanto está lista, sin esperar a que se genere el resto.
 *
 * Reglas:
 *  - Se corta en . ! ? … y saltos de línea (sin partir abreviaturas con punto seguido de minúscula ni números como 3.5).
 *  - Los trozos muy cortos se pegan al siguiente (una voz que dice "Yes." sola suena rara y gasta una petición).
 *  - Como máximo `maxChunks` trozos (se agrupan los últimos) para no saturar el límite de peticiones simultáneas.
 */
const MIN_CHUNK_CHARS = 28;

export function splitForSpeech(text: string, maxChunks = 4): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  // Cortar después de . ! ? … cuando lo siguiente es un espacio y empieza una frase nueva (mayúscula, número, comilla o ¿¡).
  const rough = clean.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ0-9"'«¿¡(])/u).map((s) => s.trim()).filter(Boolean);

  // Pegar trozos cortos al siguiente
  const merged: string[] = [];
  let carry = '';
  for (const part of rough) {
    const candidate = carry ? `${carry} ${part}` : part;
    if (candidate.length < MIN_CHUNK_CHARS) {
      carry = candidate;
    } else {
      merged.push(candidate);
      carry = '';
    }
  }
  if (carry) {
    if (merged.length > 0) merged[merged.length - 1] = `${merged[merged.length - 1]} ${carry}`;
    else merged.push(carry);
  }

  // No más de maxChunks: se agrupan los últimos
  while (merged.length > maxChunks) {
    const last = merged.pop() as string;
    merged[merged.length - 1] = `${merged[merged.length - 1]} ${last}`;
  }
  return merged;
}
