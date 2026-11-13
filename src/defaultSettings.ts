import { AppSettings } from './types';
import { CLAUDE_DEFAULT_MODEL } from './features/ai/config';

/**
 * Ajustes por defecto de StickyFlow: ÚNICA fuente de verdad.
 * (Antes estaban copiados en 4 archivos y se habían desincronizado.)
 * Las claves van siempre vacías: nunca se escriben credenciales en el código.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  hfEndpoint: 'https://router.huggingface.co/v1',
  hfModel: 'Qwen/Qwen2.5-72B-Instruct',
  hfApiKey: '',
  claudeApiKey: '',
  claudeModel: CLAUDE_DEFAULT_MODEL,
  activeAiProvider: 'huggingface',
  customProviders: [],
  enableCloudflareRag: false,
  cloudflareAccountId: '',
  cloudflareApiToken: '',
  cloudflareVectorizeIndex: '',
  cloudflareRagEndpoint: '',
  dbMode: 'local',
  remoteDbProvider: 'supabase',
  remoteDbUrl: '',
  remoteDbApiKey: '',
  autoSyncRemote: false,
  deepgramApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  elevenLabsModel: 'eleven_flash_v2_5',
  interviewMyLang: 'es',
  interviewTheirLang: 'en',
  interviewOutputDeviceId: '',
  interviewVirtualMicInputId: '',
  interviewTheirAudioDeviceId: '',
  interviewContext: '',
  enablePrivacyMasking: true,
  maskSensitiveRegex: true,
  speechLang: 'es-ES',
  ttsVoice: 'es-MX-DaliaNeural',
  ttsRate: 1.0,
  ttsPitch: 1.0,
  ttsVolume: 1.0,
  useNeuralTts: true,
  autoBackupEnabled: true,
  autoBackupFrequency: 'daily',
  alwaysOnTop: true,
  defaultColor: 'yellow',
  opacity: 0.98,
  startDockOnly: true,
  dockPosition: 'right',
  dockShowTitles: true,
  dockEnabled: true,
  dockAlwaysOnTop: true,
  dockedNoteIds: []
};
