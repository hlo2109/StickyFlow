export type Bubble = { who: 'me' | 'them' | 'plain'; text: string };

/** Convierte «[Tú] hola» / «[Participante] buenas» en burbujas por hablante; lo demás queda como texto neutro. */
export function parseTranscript(text: string): Bubble[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): Bubble => {
      const m = line.match(/^\[(Tú|Participante)\]\s*(.*)$/);
      if (!m) return { who: 'plain', text: line };
      return { who: m[1] === 'Tú' ? 'me' : 'them', text: m[2] };
    });
}
