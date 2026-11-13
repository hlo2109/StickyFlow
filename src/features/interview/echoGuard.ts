/**
 * echoGuard
 * ---------
 * El audio del sistema (loopback de Windows) captura TODAS las salidas a la vez, incluida la
 * de tu voz traducida. Sin protección, tu propia traducción volvería a entrar como si la hubieran
 * dicho «Ellos» y se traduciría de nuevo.
 *
 * Esta protección compara lo que se "oye" en el audio del sistema con lo que tu voz acaba de decir:
 * si es lo mismo, es eco y se descarta. Es independiente de cómo esté enrutado el audio.
 */

export interface SpokenRecord {
  /** Texto que tu voz sintética dijo (ya traducido) */
  text: string;
  /** Momento (ms) en que se mandó a reproducir */
  at: number;
}

/** Minúsculas, sin tildes ni signos: «Hello, World!» y «hello world» son iguales. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cuánto tiempo después de mandar a hablar un texto puede llegar su eco ya transcrito:
 * lo que tarda en sonar (≈ 90 ms por carácter) + cola, silencio de cierre y transcripción.
 */
function maxEchoAgeMs(spokenText: string): number {
  return 6000 + spokenText.length * 90;
}

/** Una frase corta (1–2 palabras) solo se toma por eco si es idéntica y muy reciente: «Thank you» podría ser real. */
const SHORT_PHRASE_MAX_AGE_MS = 6000;
/** Qué parte de lo oído debe estar en lo que dije (precisión) y qué parte de lo que dije debe oírse (cobertura). */
const MIN_PRECISION = 0.75;
const MIN_COVERAGE = 0.4;

export function isLikelyEcho(heard: string, spoken: SpokenRecord[], now: number = Date.now()): boolean {
  const h = normalizeText(heard);
  if (!h) return false;
  const hTokens = h.split(' ');

  for (const s of spoken) {
    const n = normalizeText(s.text);
    if (!n) continue;
    const age = now - s.at;
    if (age < -2000 || age > maxEchoAgeMs(s.text) * 1.5) continue;

    // Idéntico (tras normalizar): eco. Si es una frase muy corta, solo si es muy reciente.
    if (h === n) {
      if (hTokens.length >= 3 || age <= SHORT_PHRASE_MAX_AGE_MS) return true;
      continue;
    }

    // Frases más largas: casi todas las palabras oídas están en lo que dije, y es una parte relevante de ello.
    const nTokens = n.split(' ');
    if (hTokens.length < 3 || nTokens.length < 3) continue;
    const nSet = new Set(nTokens);
    const hSet = new Set(hTokens);
    let shared = 0;
    hSet.forEach((t) => {
      if (nSet.has(t)) shared++;
    });
    const precision = shared / hSet.size;
    const coverage = shared / nSet.size;
    if (precision >= MIN_PRECISION && coverage >= MIN_COVERAGE) return true;
  }
  return false;
}

/** Conserva solo lo reciente y poco: el historial viejo no sirve y no debe crecer sin límite. */
export function pruneSpoken(spoken: SpokenRecord[], now: number = Date.now(), keep = 12): SpokenRecord[] {
  return spoken.filter((s) => now - s.at < 120_000).slice(-keep);
}
