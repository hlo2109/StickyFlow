export interface BitacoraEntry {
  id: string;
  timestamp: string;
  action: 'creacion' | 'edicion' | 'ia_resumen' | 'ia_redaccion' | 'ia_todo' | 'nota_rapida' | 'marcador' | 'ia_creacion' | 'dictado' | 'reunion';
  summary: string;
}

export type NoteColor = 'yellow' | 'blue' | 'green' | 'purple' | 'pink' | 'dark';

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

export type DbMode = 'local' | 'remote';
export type RemoteDbProvider = 'rest' | 'supabase' | 'cloudflare_d1' | 'custom';

export interface AppSettings {
  // Hugging Face AI
  hfEndpoint: string;
  hfModel: string;
  hfApiKey: string;

  // Claude AI
  claudeApiKey: string;
  claudeModel: string;
  activeAiProvider: 'huggingface' | 'claude';

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

  // Privacy & Data Security
  enablePrivacyMasking: boolean; // Mask API keys, passwords, bearer tokens before LLM
  maskSensitiveRegex: boolean;

  // Audio & Speech
  speechLang: string; // e.g. 'es-ES'

  // Window & Appearance
  alwaysOnTop: boolean;
  defaultColor: NoteColor;
  opacity: number;
  notesFolderPath?: string;
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
  onAlwaysOnTopChanged: (callback: (val: boolean) => void) => void;
  getDesktopSources?: () => Promise<Array<{ id: string; name: string }>>;

  // Mini Stickies (multi-window floating desktop widgets)
  openMiniSticky: (note: Note) => Promise<void>;
  closeMiniSticky: (noteId: string) => Promise<void>;
  toggleMiniSticky: (note: Note) => Promise<boolean>;
  getOpenMiniStickies: () => Promise<string[]>;
  expandMiniSticky: (noteId: string) => Promise<void>;
  onMiniStickyStatusChanged: (callback: (data: { noteId: string; isOpen: boolean }) => void) => void;
  onNoteUpdated: (callback: (note: Note) => void) => void;
  onSelectNote: (callback: (noteId: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
