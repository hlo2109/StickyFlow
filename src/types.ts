export interface BitacoraEntry {
  id: string;
  timestamp: string;
  action: 'creacion' | 'edicion' | 'ia_resumen' | 'ia_redaccion' | 'ia_todo' | 'nota_rapida' | 'marcador' | 'ia_creacion' | 'dictado' | 'reunion';
  summary: string;
}

export type NoteColor = 'yellow' | 'orange' | 'coral' | 'pink' | 'purple' | 'indigo' | 'blue' | 'teal' | 'green' | 'dark';

export interface Note {
  id: string;
  title: string;
  content: string; // HTML rich content for TipTap
  markdownContent: string; // Markdown text
  color: NoteColor;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  bitacora: BitacoraEntry[];
}

export interface MeetingDoubt {
  id: string;
  question: string;
  status: 'open' | 'resolved';
  resolvedAnswer?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type DbMode = 'local' | 'remote';
export type RemoteDbProvider = 'rest' | 'supabase' | 'cloudflare_d1' | 'custom';

/** Proveedor de IA con formato OpenAI (DeepSeek, OpenAI, Groq, Gemini, Ollama, OpenRouter...). */
export interface CustomAiProvider {
  id: string;
  name: string;
  /** URL base, p. ej. https://api.deepseek.com  (se le añade /chat/completions) */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Modelo más rápido/barato para tareas frecuentes (radar, traducción en vivo). Opcional */
  fastModel?: string;
}

export interface AppSettings {
  // Hugging Face AI
  hfEndpoint: string;
  hfModel: string;
  hfApiKey: string;

  // Claude AI
  claudeApiKey: string;
  claudeModel: string;
  /** 'huggingface' | 'claude' | id de un proveedor personalizado */
  activeAiProvider: string;
  customProviders?: CustomAiProvider[];

  // Cloudflare RAG (Vectorize / Workers AI / Knowledge base)
  enableCloudflareRag: boolean;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  cloudflareVectorizeIndex: string;
  cloudflareRagEndpoint: string; // Optional custom worker URL

  // External Database (Online / Remote Sync)
  dbMode: DbMode;
  remoteDbProvider: RemoteDbProvider;
  remoteDbUrl: string;
  remoteDbApiKey: string;
  autoSyncRemote: boolean;

  // Modo Entrevista (traducción en vivo con tu propia voz)
  deepgramApiKey?: string; // Transcripción rápida. Si está vacía se usa Whisper (Hugging Face)
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string; // ID de tu voz clonada
  elevenLabsModel?: string; // p. ej. 'eleven_flash_v2_5'
  interviewMyLang?: string; // idioma en el que hablas, p. ej. 'es'
  interviewTheirLang?: string; // idioma de la otra persona, p. ej. 'en'
  interviewOutputDeviceId?: string; // micrófono virtual (VB-CABLE) donde sale tu voz traducida
  interviewVirtualMicInputId?: string; // el micrófono virtual que se elige en la videollamada (la otra mitad del cable)
  interviewTheirAudioDeviceId?: string; // fuente del audio de ellos: vacío = audio del sistema (todo); o un dispositivo de entrada aislado
  interviewContext?: string; // contexto para traducir mejor términos técnicos

  // Privacy & Data Security
  enablePrivacyMasking: boolean; // Mask API keys, passwords, bearer tokens before LLM
  maskSensitiveRegex: boolean;

  // Audio & Speech
  speechLang: string; // e.g. 'es-ES'
  ttsVoice?: string; // Voice URI or Neural Voice ID (e.g. 'es-MX-DaliaNeural')
  ttsRate?: number; // 0.7 - 1.5, default 1.0
  ttsPitch?: number; // 0.8 - 1.2, default 1.0
  ttsVolume?: number; // 0.1 - 1.0, default 1.0
  useNeuralTts?: boolean; // True for ultra-natural human voice (default true)

  // Window & Appearance
  alwaysOnTop: boolean;
  defaultColor: NoteColor;
  opacity: number;
  notesFolderPath?: string;
  quickShortcuts?: boolean; // Atajos globales Ctrl+Alt+R / E / V (por defecto sí)
  startWithWindows?: boolean; // Iniciar con Windows (solo versión instalada)
  showTrayIcon?: boolean; // Icono en la bandeja del sistema con acceso rápido (por defecto sí)
  startDockOnly?: boolean; // When PC/app starts, only show the small notebook dock tabs (default true)

  // Cloud Backup & Storage Sync
  customStorageDir?: string;
  cloudProvider?: 'documents' | 'onedrive' | 'gdrive' | 'dropbox' | 'icloud' | 'custom';
  autoBackupEnabled?: boolean;
  autoBackupFrequency?: 'daily' | 'weekly' | 'manual';
  lastBackupTime?: string;
  lastBackupSize?: string;

  // Notebook Separators Dock (Separadores de Cuaderno)
  dockPosition?: 'left' | 'right' | 'top' | 'bottom';
  dockShowTitles?: boolean;
  dockEnabled?: boolean;
  dockAlwaysOnTop?: boolean;
  dockedNoteIds?: string[];
}

export interface CloudFolderItem {
  id: string;
  name: string;
  type: 'local' | 'onedrive' | 'gdrive' | 'dropbox' | 'icloud' | 'custom';
  path: string;
  exists: boolean;
  isCloud: boolean;
  icon: string;
}

export interface BackupFileItem {
  fileName: string;
  filePath: string;
  size: string;
  sizeBytes: number;
  time: string;
  notesCount: number;
}

export interface BackupStatusInfo {
  activeStorageDir: string;
  detectedClouds: CloudFolderItem[];
  lastBackupTime?: string;
  lastBackupSize?: string;
  backupCount: number;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'manual';
}

export interface ElectronAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  toggleAlwaysOnTop: () => Promise<boolean>;
  getAlwaysOnTop: () => Promise<boolean>;
  setOpacity: (val: number) => Promise<void>;
  resizeWindow: (width: number, height: number) => Promise<void>;
  loadNotes: () => Promise<Note[]>;
  saveNotes: (notes: Note[]) => Promise<{ success: boolean; error?: string }>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;
  openNotesFolder: () => Promise<string>;
  getNotesFolderPath: () => Promise<string>;
  exportNoteMarkdown: (note: Note) => Promise<{ success: boolean }>;
  writeClipboard: (text: string) => Promise<boolean>;
  /** Abre el panel de Sonido de Windows en la pestaña de Reproducción o de Grabación */
  openSoundPanel?: (tab: 'playback' | 'recording') => Promise<boolean>;
  /** Crea en el escritorio accesos directos a Reunión, Entrevista y Nota de voz (para anclar a la barra de tareas) */
  createShortcuts?: () => Promise<{ created: string[]; failed: string[]; dir: string }>;
  /** Abre la configuración de la barra de tareas de Windows (para mostrar siempre el icono de la bandeja) */
  openTaskbarSettings?: () => Promise<boolean>;
  /** Qué atajos globales quedaron registrados y cuáles estaban ocupados por otra app */
  getShortcutStatus?: () => Promise<{ registered: string[]; failed: string[] }>;
  onAlwaysOnTopChanged: (callback: (val: boolean) => void) => void;
  getDesktopSources?: () => Promise<Array<{ id: string; name: string }>>;

  // Cloud Backup & Storage API
  getBackupInfo?: () => Promise<BackupStatusInfo>;
  createBackup?: () => Promise<{ success: boolean; filePath?: string; fileName?: string; timestamp?: string; size?: string; notesCount?: number; error?: string }>;
  listBackups?: () => Promise<BackupFileItem[]>;
  restoreBackup?: (filePath?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  exportBackupDialog?: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  importBackupDialog?: () => Promise<{ success: boolean; count?: number; error?: string }>;
  changeStorageDir?: (newPath: string, copyExisting?: boolean) => Promise<{ success: boolean; dir?: string; error?: string }>;
  selectFolderDialog?: () => Promise<string | null>;
  cleanNotesGarbage?: () => Promise<{ success: boolean; removedCount: number; remainingCount: number; error?: string }>;

  // Independent Windows (Configuración y Dictado/Reunión)
  openSettingsWindow?: () => Promise<void>;
  openMeetingWindow?: (noteId?: string, view?: 'meeting' | 'interview' | 'voicenote') => Promise<void>;

  // Mini Stickies (multi-window floating desktop widgets)
  openMiniSticky: (note: Note) => Promise<void>;
  closeMiniSticky: (noteId: string) => Promise<void>;
  toggleMiniSticky: (note: Note) => Promise<boolean>;
  getOpenMiniStickies: () => Promise<string[]>;
  expandMiniSticky: (noteId: string) => Promise<void>;
  onMiniStickyStatusChanged: (callback: (data: { noteId: string; isOpen: boolean }) => void) => void;
  onNoteUpdated: (callback: (note: Note) => void) => void;
  onSelectNote: (callback: (noteId: string) => void) => void;

  // Notebook Separators Dock (Dock de Separadores de Cuaderno)
  setDockMouseIgnore?: (ignore: boolean) => Promise<boolean>;
  setDockPosition?: (pos: 'left' | 'right' | 'top' | 'bottom') => Promise<boolean>;
  setDockAlwaysOnTop?: (val: boolean) => Promise<boolean>;
  bringDockToTop?: () => Promise<boolean>;
  openNoteInMain?: (noteId: string) => Promise<boolean>;
  openNoteWindow?: (noteId: string) => Promise<boolean>;
  toggleDockPin?: (noteId: string) => Promise<string[]>;
  getDockedNotes?: () => Promise<string[]>;
  quitApp?: () => Promise<void>;
  onNotesUpdated?: (callback: (notes: Note[]) => void) => void;
  onDockNotesUpdated?: (callback: (notes: Note[]) => void) => void;
  onDockSettingsUpdated?: (callback: (settings: AppSettings) => void) => void;
  onDockedIdsChanged?: (callback: (dockedIds: string[]) => void) => void;

  // Text-To-Speech context menu events
  onTtsSpeakSelection?: (callback: (text: string) => void) => void;
  onTtsSpeakCurrentNote?: (callback: () => void) => void;

  // Meeting window target note update
  onMeetingSetNoteId?: (callback: (noteId: string) => void) => void;
  onMeetingSetView?: (callback: (view: 'meeting' | 'interview' | 'voicenote') => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

