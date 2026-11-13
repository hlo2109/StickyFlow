/** Idiomas disponibles en el modo entrevista (compatibles con Deepgram Nova-3 y ElevenLabs Flash v2.5). */
export const INTERVIEW_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' }
];

export function languageName(code: string): string {
  return INTERVIEW_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

/** Nombre en inglés, para dárselo al modelo de traducción sin ambigüedad. */
const ENGLISH_NAMES: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian'
};

export function englishLanguageName(code: string): string {
  return ENGLISH_NAMES[code] ?? code;
}

export const ELEVENLABS_MODELS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5', hint: 'Más rápido y barato (recomendado para conversar)' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', hint: 'Equilibrio entre velocidad y calidad' },
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2', hint: 'Mayor calidad, más lento y más caro' }
];
