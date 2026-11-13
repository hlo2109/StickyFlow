/**
 * Text-to-Speech (TTS) Service for StickyFlow
 * Provides ultra-natural, human-like voice synthesis using Microsoft Edge Neural TTS
 * with warm Latin American neural voices (Dalia, Jorge, Salomé, Gonzalo, Elena, etc.),
 * plus automatic offline fallback to window.speechSynthesis.
 */

export type VoiceLanguageCategory = 'es' | 'en' | 'fr';

export interface NeuralVoiceInfo {
  id: string; // e.g. 'es-MX-DaliaNeural' or 'es_MX-ald-medium'
  name: string; // 'Dalia'
  gender: 'female' | 'male';
  country: string;
  flag: string;
  lang: string;
  category: VoiceLanguageCategory;
  engine: 'neural' | 'piper';
  description: string;
  isDefault?: boolean;
}

export const PIPER_VOICE_MAP: Record<string, { neuralVoice: string; lang: string }> = {
  'es_MX-ald-medium': { neuralVoice: 'es-MX-JorgeNeural', lang: 'es-MX' },
  'en_US-amy-medium': { neuralVoice: 'en-US-JennyNeural', lang: 'en-US' },
  'en_US-ryan-medium': { neuralVoice: 'en-US-GuyNeural', lang: 'en-US' },
  'fr_FR-siwis-medium': { neuralVoice: 'fr-FR-DeniseNeural', lang: 'fr-FR' }
};

export const ALL_NATURAL_VOICES: NeuralVoiceInfo[] = [
  // 1. ESPAÑOL LATINOAMERICANO
  {
    id: 'es-MX-DaliaNeural',
    name: 'Dalia',
    gender: 'female',
    country: 'México',
    flag: '🇲🇽',
    lang: 'es-MX',
    category: 'es',
    engine: 'neural',
    description: 'Voz femenina cálida, expresiva y ultra-natural (Recomendada)',
    isDefault: true
  },
  {
    id: 'es-MX-JorgeNeural',
    name: 'Jorge',
    gender: 'male',
    country: 'México',
    flag: '🇲🇽',
    lang: 'es-MX',
    category: 'es',
    engine: 'neural',
    description: 'Voz masculina conversacional y relajada'
  },
  {
    id: 'es-CO-SalomeNeural',
    name: 'Salomé',
    gender: 'female',
    country: 'Colombia',
    flag: '🇨🇴',
    lang: 'es-CO',
    category: 'es',
    engine: 'neural',
    description: 'Voz femenina clara, melodiosa y profesional'
  },
  {
    id: 'es-CO-GonzaloNeural',
    name: 'Gonzalo',
    gender: 'male',
    country: 'Colombia',
    flag: '🇨🇴',
    lang: 'es-CO',
    category: 'es',
    engine: 'neural',
    description: 'Voz masculina formal y nítida'
  },
  {
    id: 'es-AR-ElenaNeural',
    name: 'Elena',
    gender: 'female',
    country: 'Argentina',
    flag: '🇦🇷',
    lang: 'es-AR',
    category: 'es',
    engine: 'neural',
    description: 'Voz femenina rioplatense natural'
  },
  {
    id: 'es-CL-CatalinaNeural',
    name: 'Catalina',
    gender: 'female',
    country: 'Chile',
    flag: '🇨🇱',
    lang: 'es-CL',
    category: 'es',
    engine: 'neural',
    description: 'Voz femenina chilena suave y clara'
  },
  {
    id: 'es_MX-ald-medium',
    name: 'Aldo (Piper)',
    gender: 'male',
    country: 'México',
    flag: '🇲🇽',
    lang: 'es-MX',
    category: 'es',
    engine: 'piper',
    description: 'Piper TTS: Red neuronal VITS local mexicana'
  },

  // 2. INGLÉS (ENGLISH)
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny',
    gender: 'female',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    lang: 'en-US',
    category: 'en',
    engine: 'neural',
    description: 'Voz femenina cálida, expresiva y fluida (Recomendada en inglés)'
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy',
    gender: 'male',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    lang: 'en-US',
    category: 'en',
    engine: 'neural',
    description: 'Voz masculina conversacional, natural y clara'
  },
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia',
    gender: 'female',
    country: 'Reino Unido',
    flag: '🇬🇧',
    lang: 'en-GB',
    category: 'en',
    engine: 'neural',
    description: 'Voz británica natural, elegante y nítida'
  },
  {
    id: 'en_US-amy-medium',
    name: 'Amy (Piper)',
    gender: 'female',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    lang: 'en-US',
    category: 'en',
    engine: 'piper',
    description: 'Piper TTS: Red neuronal VITS local estadounidense femenina'
  },
  {
    id: 'en_US-ryan-medium',
    name: 'Ryan (Piper)',
    gender: 'male',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    lang: 'en-US',
    category: 'en',
    engine: 'piper',
    description: 'Piper TTS: Red neuronal VITS local estadounidense masculina'
  },

  // 3. FRANCÉS (FRANÇAIS)
  {
    id: 'fr-FR-DeniseNeural',
    name: 'Denise',
    gender: 'female',
    country: 'Francia',
    flag: '🇫🇷',
    lang: 'fr-FR',
    category: 'fr',
    engine: 'neural',
    description: 'Voz femenina francesa cálida, agradable y ultra-natural (Recomendada)'
  },
  {
    id: 'fr-FR-HenriNeural',
    name: 'Henri',
    gender: 'male',
    country: 'Francia',
    flag: '🇫🇷',
    lang: 'fr-FR',
    category: 'fr',
    engine: 'neural',
    description: 'Voz masculina francesa tranquila, articulada y clara'
  },
  {
    id: 'fr-CA-SylvieNeural',
    name: 'Sylvie',
    gender: 'female',
    country: 'Canadá',
    flag: '🇨🇦',
    lang: 'fr-CA',
    category: 'fr',
    engine: 'neural',
    description: 'Voz femenina quebequense melodiosa'
  },
  {
    id: 'fr_FR-siwis-medium',
    name: 'Siwis (Piper)',
    gender: 'female',
    country: 'Francia',
    flag: '🇫🇷',
    lang: 'fr-FR',
    category: 'fr',
    engine: 'piper',
    description: 'Piper TTS: Red neuronal VITS local francesa'
  }
];

// Backward compatibility
export const LATAM_NEURAL_VOICES = ALL_NATURAL_VOICES.filter(v => v.category === 'es');

export interface TtsVoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  isLatinAmerican: boolean;
  isNatural: boolean;
  isNeural?: boolean;
  flag?: string;
  country?: string;
  category?: VoiceLanguageCategory;
  engine?: 'neural' | 'piper';
  displayName: string;
  isDefault: boolean;
}

export interface TtsState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  currentText: string;
  isNeural: boolean;
}

type TtsListener = (state: TtsState) => void;

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates the Sec-MS-GEC cryptographic token required by Microsoft Edge Neural TTS.
 * Computed using SHA-256 of the Windows file time ticks rounded to 5 minutes + trusted token.
 */
async function generateSecMsGec(): Promise<string> {
  try {
    const WIN_EPOCH = 11644473600n;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    let ticks = nowSeconds + WIN_EPOCH;
    ticks -= ticks % 300n; // 5-minute window
    const ticksStr = (ticks * 10000000n).toString();
    const token = '6A5AA1D4EAFF4E9fb37e23d68491d6f4';
    const data = new TextEncoder().encode(ticksStr + token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (err) {
    console.warn('Error generating Sec-MS-GEC:', err);
    return '';
  }
}

function synthesizeEdgeTtsAudioBlob(
  text: string,
  voiceId: string,
  rate = 1.0,
  pitch = 1.0
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      return reject(new Error('WebSocket not available'));
    }

    const connectionId = generateUuid();
    const requestId = generateUuid();
    const trustedToken = '6A5AA1D4EAFF4E9fb37e23d68491d6f4';
    let secMsGec = '';
    try {
      secMsGec = await generateSecMsGec();
    } catch {}

    const queryParams = new URLSearchParams({
      trustedclienttoken: trustedToken,
      'Sec-MS-GEC': secMsGec,
      'Sec-MS-GEC-Version': '1-131.0.2903.86',
      ConnectionId: connectionId
    });

    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${queryParams.toString()}`;

    let ws: WebSocket | null = null;
    const audioChunks: ArrayBuffer[] = [];
    let timeout: any = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
    } catch (e) {
      return reject(e);
    }

    timeout = setTimeout(() => {
      if (ws) {
        try { ws.close(); } catch {}
      }
      reject(new Error('Edge TTS timed out'));
    }, 12000);

    ws.onopen = () => {
      try {
        const dateStr = new Date().toString();
        // 1. Send speech configuration
        const configMessage = `X-Timestamp:${dateStr}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMessage);

        // 2. Prosody calculation for human pitch & rate
        const ratePercent = rate === 1.0 ? '+0%' : (rate > 1 ? `+${Math.round((rate - 1) * 100)}%` : `-${Math.round((1 - rate) * 100)}%`);
        const pitchHz = pitch === 1.0 ? '+0Hz' : (pitch > 1 ? `+${Math.round((pitch - 1) * 50)}Hz` : `-${Math.round((1 - pitch) * 50)}Hz`);
        const escaped = escapeXml(text);

        // Check if it's mapped from Piper TTS model or standard Neural voice
        let targetVoice = voiceId;
        let lang = 'es-MX';

        if (PIPER_VOICE_MAP[voiceId]) {
          targetVoice = PIPER_VOICE_MAP[voiceId].neuralVoice;
          lang = PIPER_VOICE_MAP[voiceId].lang;
        } else {
          const matched = ALL_NATURAL_VOICES.find(v => v.id === voiceId);
          if (matched) {
            targetVoice = matched.id;
            lang = matched.lang || 'es-MX';
          }
        }

        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${targetVoice}'><prosody pitch='${pitchHz}' rate='${ratePercent}'>${escaped}</prosody></voice></speak>`;
        const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateStr}\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(ssmlMessage);
      } catch (err) {
        clearTimeout(timeout);
        try { ws.close(); } catch {}
        reject(err);
      }
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          if (audioChunks.length === 0) {
            reject(new Error('No audio chunks returned by Edge TTS'));
          } else {
            const blob = new Blob(audioChunks, { type: 'audio/mp3' });
            resolve(blob);
          }
        }
      } else if (event.data instanceof ArrayBuffer) {
        try {
          const dataView = new DataView(event.data);
          if (dataView.byteLength >= 2) {
            const headerLength = dataView.getUint16(0);
            if (dataView.byteLength >= 2 + headerLength) {
              const headerBytes = new Uint8Array(event.data, 2, headerLength);
              const headerText = new TextDecoder('utf-8').decode(headerBytes);
              if (headerText.includes('Path:audio')) {
                const audioChunk = event.data.slice(2 + headerLength);
                audioChunks.push(audioChunk);
              }
            }
          }
        } catch (e) {
          console.warn('Error parsing TTS binary frame:', e);
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      try { ws.close(); } catch {}
      reject(err);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}

class TtsService {
  private systemVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private voiceLoadListeners: Array<() => void> = [];

  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private currentChunks: string[] = [];
  private currentChunkIndex: number = 0;
  private stateListeners: Set<TtsListener> = new Set();
  private pauseTimer: any = null;

  // HTML5 Audio element for Neural TTS
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioBlobUrl: string | null = null;
  private preloadedNextAudioUrl: string | null = null;
  private isCurrentPlaybackNeural: boolean = true;

  // Fallback system utterance
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.initSystemVoices();
  }

  private initSystemVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list && list.length > 0) {
          this.systemVoices = list;
          this.voicesLoaded = true;
          this.voiceLoadListeners.forEach(fn => fn());
          this.voiceLoadListeners = [];
        }
      } catch (e) {
        console.warn('Error loading system speech voices:', e);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    setTimeout(loadVoices, 300);
    setTimeout(loadVoices, 1000);
  }

  public getNeuralVoices(): NeuralVoiceInfo[] {
    return ALL_NATURAL_VOICES;
  }

  public async getAvailableVoices(): Promise<TtsVoiceInfo[]> {
    if (!this.voicesLoaded && this.systemVoices.length === 0) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 600);
        this.voiceLoadListeners.push(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    const list: TtsVoiceInfo[] = [];

    // 1. Add Natural & Piper Neural Voices as top priority
    ALL_NATURAL_VOICES.forEach((nv) => {
      const typeLabel = nv.engine === 'piper' ? 'Piper TTS' : 'Voz Humana Real';
      list.push({
        voiceURI: nv.id,
        name: `${nv.flag} ${nv.name} (${nv.country}) - ${typeLabel}`,
        lang: nv.lang,
        isLatinAmerican: nv.category === 'es',
        isNatural: true,
        isNeural: true,
        flag: nv.flag,
        country: nv.country,
        category: nv.category,
        engine: nv.engine,
        displayName: `${nv.flag} ${nv.name} - ${nv.description}`,
        isDefault: Boolean(nv.isDefault)
      });
    });

    // 2. Add System Voices as secondary / fallback
    const systemMapped: TtsVoiceInfo[] = (this.systemVoices || []).map((v) => {
      const isLatAm = this.checkIsLatinAmerican(v);
      const isNat = v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online');
      let tag = '';
      if (isLatAm) tag = ' (Latinoamérica)';
      else if (v.lang.startsWith('es-ES')) tag = ' (España)';
      else if (v.lang.startsWith('es')) tag = ' (Español)';
      else tag = ` (${v.lang})`;

      return {
        voiceURI: v.voiceURI,
        name: `${v.name}${tag}`,
        lang: v.lang,
        isLatinAmerican: isLatAm,
        isNatural: isNat,
        isNeural: false,
        displayName: `${v.name}${tag} [Sistema]`,
        isDefault: false
      };
    });

    return [...list, ...systemMapped];
  }

  private checkIsLatinAmerican(voice: SpeechSynthesisVoice): boolean {
    const lang = voice.lang.toLowerCase();
    const name = voice.name.toLowerCase();

    const latAmCodes = [
      'es-419', 'es-mx', 'es-co', 'es-ar', 'es-cl', 'es-pe',
      'es-us', 'es-ec', 'es-uy', 'es-ve', 'es-cr', 'es-gt'
    ];

    if (latAmCodes.some(code => lang.startsWith(code))) return true;

    const latAmNames = [
      'sabina', 'dalia', 'jorge', 'paulina', 'raul', 'lupe',
      'gonzalo', 'mateo', 'alicia', 'mexico', 'colombia', 'argentina'
    ];

    return latAmNames.some(n => name.includes(n));
  }

  /**
   * Intelligently resolves the best system voice and modulates pitch/rate
   * according to language ('es', 'en', 'fr') and gender ('male' vs 'female')
   * so that every voice sounds distinct and authentic even in local fallback mode.
   */
  public resolveBestSystemVoice(voiceId: string): {
    voice: SpeechSynthesisVoice | undefined;
    lang: string;
    pitchMultiplier: number;
    rateMultiplier: number;
  } {
    const voiceMeta = ALL_NATURAL_VOICES.find(v => v.id === voiceId);
    const category: VoiceLanguageCategory = voiceMeta?.category || (
      voiceId.startsWith('en') ? 'en' :
      voiceId.startsWith('fr') ? 'fr' : 'es'
    );
    const gender = voiceMeta?.gender || (
      voiceId.includes('Jorge') || voiceId.includes('Gonzalo') || voiceId.includes('Guy') ||
      voiceId.includes('Henri') || voiceId.includes('ald') || voiceId.includes('ryan') ? 'male' : 'female'
    );
    const isPiper = voiceMeta?.engine === 'piper';

    const targetLangCode = category === 'en' ? 'en' : category === 'fr' ? 'fr' : 'es';
    const fallbackLang = category === 'en' ? 'en-US' : category === 'fr' ? 'fr-FR' : 'es-419';

    // 1. Direct match by voiceURI or name
    let matched = this.systemVoices.find(v => v.voiceURI === voiceId || v.name === voiceId);

    // 2. If not matched, filter system voices by language and match gender cues
    if (!matched) {
      const langMatches = this.systemVoices.filter(v => v.lang.toLowerCase().startsWith(targetLangCode));
      if (langMatches.length > 0) {
        if (gender === 'male') {
          matched = langMatches.find(v => {
            const n = v.name.toLowerCase();
            return n.includes('male') || n.includes('david') || n.includes('george') ||
                   n.includes('mark') || n.includes('jorge') || n.includes('pablo') ||
                   n.includes('raul') || n.includes('mateo') || n.includes('guy') || n.includes('henri');
          }) || langMatches[0];
        } else {
          matched = langMatches.find(v => {
            const n = v.name.toLowerCase();
            return n.includes('female') || n.includes('zira') || n.includes('jenny') ||
                   n.includes('samantha') || n.includes('dalia') || n.includes('sabina') ||
                   n.includes('helena') || n.includes('elena') || n.includes('denise');
          }) || langMatches[0];
        }
      }
    }

    // 3. Fallback to default voices if no language match
    if (!matched && this.systemVoices.length > 0) {
      if (category === 'es') {
        matched = this.systemVoices.find(v => this.checkIsLatinAmerican(v))
          || this.systemVoices.find(v => v.lang.startsWith('es'))
          || this.systemVoices[0];
      } else {
        matched = this.systemVoices[0];
      }
    }

    // Voice modulation: masculine voices sound deeper (0.85); feminine voices sound melodious/higher (1.10)
    const pitchMultiplier = gender === 'male' ? 0.85 : 1.10;
    const rateMultiplier = isPiper ? 1.05 : 1.0;
    const lang = matched?.lang || fallbackLang;

    return { voice: matched, lang, pitchMultiplier, rateMultiplier };
  }

  public isNeuralVoiceId(voiceURI?: string): boolean {
    if (!voiceURI) return true; // Default is neural Dalia
    return (
      ALL_NATURAL_VOICES.some(v => v.id === voiceURI) ||
      Boolean(PIPER_VOICE_MAP[voiceURI]) ||
      voiceURI.endsWith('Neural') ||
      voiceURI.includes('-medium')
    );
  }

  /**
   * Prepares and normalizes rich note text / Markdown so it sounds like a real person reading aloud.
   */
  public cleanTextForSpeech(text: string, title?: string): string {
    if (!text && !title) return '';

    let result = '';

    if (title && title.trim()) {
      result += `Nota: ${title.trim()}.\n\n`;
    }

    let cleaned = text || '';

    // Handle HTML Task Lists from TipTap
    cleaned = cleaned.replace(/<li[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner) => {
      const cleanInner = inner.replace(/<[^>]+>/g, '').trim();
      return `\nTarea completada: ${cleanInner}.\n`;
    });
    cleaned = cleaned.replace(/<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner) => {
      const cleanInner = inner.replace(/<[^>]+>/g, '').trim();
      return `\nTarea pendiente: ${cleanInner}.\n`;
    });

    // Handle Markdown Task Lists
    cleaned = cleaned.replace(/^\s*-\s*\[x\]\s+(.*)$/gim, '\nTarea completada: $1.\n');
    cleaned = cleaned.replace(/^\s*-\s*\[ \]\s+(.*)$/gim, '\nTarea pendiente: $1.\n');

    // Handle Markdown Headers
    cleaned = cleaned.replace(/^#{1,6}\s+(.*)$/gim, '\n$1.\n');

    // Handle HTML Headers (h1, h2, h3, h4)
    cleaned = cleaned.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n$1.\n');

    // Handle HTML list items
    cleaned = cleaned.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n$1.\n');

    // Handle HTML paragraphs & breaks
    cleaned = cleaned.replace(/<\/p>/gi, '.\n');
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '.\n');

    // Handle Blockquotes
    cleaned = cleaned.replace(/^\s*>\s+(.*)$/gim, '\nCita: $1.\n');

    // Replace Markdown image syntax ![alt](url) -> "Imagen de [alt]"
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt) => {
      return alt ? ` Imagen de ${alt}. ` : ' Imagen. ';
    });

    // Replace Markdown links [text](url) -> "text"
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Replace bare URLs with "enlace web" so the reader doesn't spell out random characters
    cleaned = cleaned.replace(/https?:\/\/[^\s<)]+/gi, 'enlace web');

    // Strip code blocks ``` ... ```
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '\nBloque de código.\n');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Strip remaining HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // Strip Markdown bold, italics, strikethrough, highlights
    cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
    cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');
    cleaned = cleaned.replace(/==(.*?)==/g, '$1');

    // Strip horizontal rules
    cleaned = cleaned.replace(/---+/g, ' ');

    // Clean up excessive punctuation and whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/([.!?])\s*\1+/g, '$1');
    cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1');

    result += cleaned.trim();
    return result.trim();
  }

  /**
   * Chunks text into sentence or paragraph units (approx 180-260 characters).
   * Ensures instant playback start and smooth conversational pauses.
   */
  public chunkTextIntoSentences(text: string, maxChunkLength = 240): string[] {
    if (!text || !text.trim()) return [];

    const rawSentences = text.split(/(?<=[.!?\n])\s+/);
    const chunks: string[] = [];

    let current = '';

    for (const sentence of rawSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length > maxChunkLength) {
        const subParts = trimmed.split(/(?<=[,;:—])\s+/);
        for (const sub of subParts) {
          const subTrimmed = sub.trim();
          if (!subTrimmed) continue;

          if (current.length + subTrimmed.length + 1 <= maxChunkLength) {
            current = current ? `${current} ${subTrimmed}` : subTrimmed;
          } else {
            if (current) chunks.push(current);
            current = subTrimmed;
          }
        }
      } else {
        if (current.length + trimmed.length + 1 <= maxChunkLength) {
          current = current ? `${current} ${trimmed}` : trimmed;
        } else {
          if (current) chunks.push(current);
          current = trimmed;
        }
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks;
  }

  public subscribe(listener: TtsListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.stateListeners.forEach(fn => fn(state));
  }

  public getState(): TtsState {
    return {
      isPlaying: this.isSpeaking,
      isPaused: this.isPaused,
      currentChunkIndex: this.currentChunkIndex,
      totalChunks: this.currentChunks.length,
      currentText: this.currentChunks[this.currentChunkIndex] || '',
      isNeural: this.isCurrentPlaybackNeural
    };
  }

  public async speak(
    rawText: string,
    options: {
      title?: string;
      voiceURI?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      useNeuralTts?: boolean;
    } = {}
  ): Promise<void> {
    this.stop();

    const textToRead = this.cleanTextForSpeech(rawText, options.title);
    if (!textToRead) return;

    this.currentChunks = this.chunkTextIntoSentences(textToRead);
    if (this.currentChunks.length === 0) return;

    this.currentChunkIndex = 0;
    this.isSpeaking = true;
    this.isPaused = false;

    const chosenVoiceId = options.voiceURI || 'es-MX-DaliaNeural';
    const isNeural = options.useNeuralTts !== false && this.isNeuralVoiceId(chosenVoiceId);
    this.isCurrentPlaybackNeural = isNeural;
    this.notify();

    if (isNeural) {
      this.playNeuralChunk(chosenVoiceId, options.rate || 1.0, options.pitch || 1.0, options.volume || 1.0);
    } else {
      this.playSystemChunk(chosenVoiceId, options.rate || 1.0, options.pitch || 1.0, options.volume || 1.0);
    }
  }

  private async playNeuralChunk(
    voiceId: string,
    rate: number,
    pitch: number,
    volume: number
  ) {
    if (!this.isSpeaking || this.isPaused) return;

    if (this.currentChunkIndex >= this.currentChunks.length) {
      this.stop();
      return;
    }

    const chunkText = this.currentChunks[this.currentChunkIndex];
    if (!chunkText || !chunkText.trim()) {
      this.currentChunkIndex++;
      this.playNeuralChunk(voiceId, rate, pitch, volume);
      return;
    }

    try {
      // 1. Synthesize neural chunk audio blob
      const blob = await synthesizeEdgeTtsAudioBlob(chunkText, voiceId, rate, pitch);
      if (!this.isSpeaking || this.isPaused) return;

      if (this.currentAudioBlobUrl) {
        URL.revokeObjectURL(this.currentAudioBlobUrl);
      }
      this.currentAudioBlobUrl = URL.createObjectURL(blob);

      const audio = new Audio(this.currentAudioBlobUrl);
      audio.volume = Math.max(0.1, Math.min(1.0, volume));
      audio.playbackRate = 1.0; // Rate is already handled in SSML for natural cadence

      audio.onended = () => {
        if (!this.isSpeaking || this.isPaused) return;
        this.currentChunkIndex++;
        this.notify();

        // 120ms natural breathing pause between sentences
        this.pauseTimer = setTimeout(() => {
          this.playNeuralChunk(voiceId, rate, pitch, volume);
        }, 120);
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error in Neural TTS, falling back to system voice:', e);
        // Fallback to local system voice if audio decoding fails
        this.playSystemChunk(voiceId, rate, pitch, volume);
      };

      this.currentAudio = audio;
      await audio.play();
    } catch (err) {
      console.warn('Edge Neural TTS synthesis failed (e.g. offline). Falling back to system voice:', err);
      // Seamless offline fallback
      this.isCurrentPlaybackNeural = false;
      this.playSystemChunk(voiceId, rate, pitch, volume);
    }
  }

  private playSystemChunk(
    voiceURI: string,
    rate: number,
    pitch: number,
    volume: number
  ) {
    if (!this.isSpeaking || this.isPaused) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.stop();
      return;
    }

    if (this.currentChunkIndex >= this.currentChunks.length) {
      this.stop();
      return;
    }

    const chunkText = this.currentChunks[this.currentChunkIndex];
    if (!chunkText || !chunkText.trim()) {
      this.currentChunkIndex++;
      this.playSystemChunk(voiceURI, rate, pitch, volume);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(chunkText);
      const resolved = this.resolveBestSystemVoice(voiceURI);

      if (resolved.voice) {
        utterance.voice = resolved.voice;
      }
      utterance.lang = resolved.lang;

      utterance.rate = Math.max(0.6, Math.min(1.8, rate * resolved.rateMultiplier));
      utterance.pitch = Math.max(0.6, Math.min(1.6, pitch * resolved.pitchMultiplier));
      utterance.volume = Math.max(0.1, Math.min(1.0, volume));

      utterance.onend = () => {
        if (!this.isSpeaking || this.isPaused) return;
        this.currentChunkIndex++;
        this.notify();

        this.pauseTimer = setTimeout(() => {
          this.playSystemChunk(voiceURI, rate, pitch, volume);
        }, 120);
      };

      utterance.onerror = (e) => {
        console.warn('System utterance error:', e);
        if (this.isSpeaking && !this.isPaused) {
          this.currentChunkIndex++;
          this.notify();
          this.playSystemChunk(voiceURI, rate, pitch, volume);
        }
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Error in playSystemChunk:', err);
      this.stop();
    }
  }

  public pause() {
    if (!this.isSpeaking || this.isPaused) return;
    this.isPaused = true;
    if (this.pauseTimer) clearTimeout(this.pauseTimer);

    if (this.currentAudio) {
      try { this.currentAudio.pause(); } catch {}
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.pause(); } catch {}
    }
    this.notify();
  }

  public resume(options?: { voiceURI?: string; rate?: number; pitch?: number; volume?: number }) {
    if (!this.isSpeaking || !this.isPaused) return;
    this.isPaused = false;
    this.notify();

    if (this.isCurrentPlaybackNeural && this.currentAudio) {
      try {
        this.currentAudio.play();
        return;
      } catch {}
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        return;
      }
    }

    const voiceId = options?.voiceURI || 'es-MX-DaliaNeural';
    if (this.isCurrentPlaybackNeural) {
      this.playNeuralChunk(voiceId, options?.rate || 1.0, options?.pitch || 1.0, options?.volume || 1.0);
    } else {
      this.playSystemChunk(voiceId, options?.rate || 1.0, options?.pitch || 1.0, options?.volume || 1.0);
    }
  }

  public stop() {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }

    if (this.currentAudioBlobUrl) {
      try { URL.revokeObjectURL(this.currentAudioBlobUrl); } catch {}
      this.currentAudioBlobUrl = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    this.isSpeaking = false;
    this.isPaused = false;
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    this.currentUtterance = null;
    this.notify();
  }

  /**
   * Preview a voice with a warm, natural human sample in its corresponding language and identity
   */
  public async testVoice(
    voiceURI: string,
    rate = 1.0,
    pitch = 1.0,
    customText?: string
  ): Promise<void> {
    this.stop();

    const voiceId = voiceURI || 'es-MX-DaliaNeural';
    const isNeural = this.isNeuralVoiceId(voiceId);

    const voiceObj = ALL_NATURAL_VOICES.find(v => v.id === voiceId);
    const voiceName = voiceObj?.name || 'Dalia';
    let sampleText = customText;
    if (!sampleText) {
      if (voiceObj?.category === 'en' || voiceId.startsWith('en')) {
        sampleText = `Hello! I am ${voiceName}. This is my natural voice to read your notes in StickyFlow.`;
      } else if (voiceObj?.category === 'fr' || voiceId.startsWith('fr')) {
        sampleText = `Bonjour! Je suis ${voiceName}. Ceci est ma voix naturelle pour lire vos notes dans StickyFlow.`;
      } else {
        sampleText = `¡Hola! Soy ${voiceName}. Esta es mi voz humana natural para leer todas tus notas en StickyFlow.`;
      }
    }

    if (isNeural) {
      try {
        const blob = await synthesizeEdgeTtsAudioBlob(sampleText, voiceId, rate, pitch);
        if (this.currentAudioBlobUrl) {
          URL.revokeObjectURL(this.currentAudioBlobUrl);
        }
        this.currentAudioBlobUrl = URL.createObjectURL(blob);
        const audio = new Audio(this.currentAudioBlobUrl);
        this.currentAudio = audio;
        audio.onended = () => {
          if (this.currentAudioBlobUrl) {
            URL.revokeObjectURL(this.currentAudioBlobUrl);
            this.currentAudioBlobUrl = null;
          }
          this.currentAudio = null;
        };
        await audio.play();
        return;
      } catch (e) {
        console.warn('Neural test failed, falling back to resolved system voice:', e);
      }
    }

    // System voice fallback with resolved language, gender and pitch
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        const utterance = new SpeechSynthesisUtterance(sampleText);
        const resolved = this.resolveBestSystemVoice(voiceId);
        if (resolved.voice) {
          utterance.voice = resolved.voice;
        }
        utterance.lang = resolved.lang;
        utterance.rate = Math.max(0.6, Math.min(1.8, rate * resolved.rateMultiplier));
        utterance.pitch = Math.max(0.6, Math.min(1.6, pitch * resolved.pitchMultiplier));
        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Error testing system voice:', err);
      }
    }
  }
}

export const ttsService = new TtsService();
