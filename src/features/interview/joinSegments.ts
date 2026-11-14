/**
 * Unir fragmentos de una misma frase.
 * -----------------------------------
 * El audio se corta cuando hay un silencio (400–900 ms). Una pausa para pensar a mitad de frase la parte en dos y
 * cada trozo se traduce por separado ("Quiero contarte que" / "ayer cerramos el proyecto"), lo que sale mal.
 *
 * Regla: si lo transcrito NO termina como una frase (. ? ! …), se espera un poco por si sigues hablando y se
 * traduce todo junto. Si termina como frase, se traduce al instante (no se pierde velocidad en lo normal).
 */

/** Tope de caracteres que se acumulan esperando continuación (para no retener indefinidamente). */
export const MAX_JOIN_CHARS = 420;

/** ¿El texto termina como una frase completa? (admite comillas/paréntesis de cierre al final) */
export function endsSentence(text: string): boolean {
  return /[.!?…。？！]["'”’»)\]]*\s*$/.test(text.trim());
}

/** Une dos trozos con un solo espacio, respetando que el segundo no empiece con puntuación. */
export function joinText(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return /^[,.;:!?…]/.test(right) ? left + right : `${left} ${right}`;
}
