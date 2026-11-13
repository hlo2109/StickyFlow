import React, { useState, useEffect } from 'react';
import {
  X,
  Minus,
  Pin,
  PinOff,
  Settings as SettingsIcon,
  Sparkles,
  Bot,
  Eye,
  EyeOff,
  Check,
  Zap,
  Database,
  ShieldCheck,
  Sliders,
  FolderOpen,
  ExternalLink,
  Lock,
  Cloud,
  StickyNote,
  Volume2,
  RotateCcw,
  HardDrive,
  Download,
  Upload,
  History,
  FileJson,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { AppSettings, DbMode, RemoteDbProvider, BackupStatusInfo, BackupFileItem } from '../types';
import { ttsService, TtsVoiceInfo, ALL_NATURAL_VOICES, VoiceLanguageCategory } from '../utils/ttsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onOpenNotesFolder: () => void;
}

type SettingsTab = 'ai' | 'rag' | 'database' | 'privacy' | 'window' | 'tts';

function pathNormalize(p?: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onOpenNotesFolder
}) => {
  const [currentTab, setCurrentTab] = useState<SettingsTab>('ai');
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [showHfKey, setShowHfKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showCfToken, setShowCfToken] = useState(false);
  const [showRemoteDbKey, setShowRemoteDbKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Text-To-Speech (TTS) Voices State
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [ttsLangTab, setTtsLangTab] = useState<VoiceLanguageCategory>('es');

  // Backup & Cloud Sync State
  const [backupInfo, setBackupInfo] = useState<BackupStatusInfo | null>(null);
  const [backupsList, setBackupsList] = useState<BackupFileItem[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [showAdvancedDb, setShowAdvancedDb] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);

  // Garbage Cleaning State
  const [isCleaningGarbage, setIsCleaningGarbage] = useState(false);
  const [garbageCleanResult, setGarbageCleanResult] = useState<string | null>(null);

  // Standalone window detection & pin state
  const isStandaloneWindow = typeof window !== 'undefined' && (
    window.location.search.includes('mode=settings') ||
    window.location.hash.includes('mode=settings')
  );
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (isStandaloneWindow) {
      if (window.electronAPI?.getAlwaysOnTop) {
        window.electronAPI.getAlwaysOnTop().then((val) => setIsPinned(Boolean(val)));
      }
      if (window.electronAPI?.onAlwaysOnTopChanged) {
        window.electronAPI.onAlwaysOnTopChanged((val) => setIsPinned(Boolean(val)));
      }
    }
  }, [isStandaloneWindow]);

  const handleTogglePin = async () => {
    if (window.electronAPI?.toggleAlwaysOnTop) {
      const nextVal = await window.electronAPI.toggleAlwaysOnTop();
      setIsPinned(Boolean(nextVal));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const refreshBackupData = () => {
    if (window.electronAPI?.getBackupInfo) {
      window.electronAPI.getBackupInfo().then((info) => {
        setBackupInfo(info);
      }).catch(() => {});
    }
    if (window.electronAPI?.listBackups) {
      window.electronAPI.listBackups().then((list) => {
        setBackupsList(list);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshBackupData();
      ttsService.getAvailableVoices().then((list) => {
        setVoices(list);
        if (!formData.ttsVoice) {
          setFormData((prev) => ({ ...prev, ttsVoice: 'es-MX-DaliaNeural' }));
        }
      });
    }
  }, [isOpen]);

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    ttsService.testVoice(
      formData.ttsVoice || 'es-MX-DaliaNeural',
      formData.ttsRate || 1.0,
      formData.ttsPitch || 1.0
    );
    setTimeout(() => setIsPlayingTest(false), 3500);
  };

  const handleResetRecommendedVoice = (lang?: VoiceLanguageCategory) => {
    const targetLang = lang || ttsLangTab;
    let recVoice = 'es-MX-DaliaNeural';
    if (targetLang === 'en') recVoice = 'en-US-JennyNeural';
    if (targetLang === 'fr') recVoice = 'fr-FR-DeniseNeural';

    setFormData((prev) => ({
      ...prev,
      ttsVoice: recVoice,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0
    }));
  };

  const handleCleanGarbage = async () => {
    if (!window.electronAPI?.cleanNotesGarbage) return;
    setIsCleaningGarbage(true);
    setGarbageCleanResult(null);
    try {
      const res = await window.electronAPI.cleanNotesGarbage();
      if (res && res.success) {
        setGarbageCleanResult(`🧹 ¡Limpieza completa! Se eliminaron ${res.removedCount} elementos de basura/huérfanos. Quedan ${res.remainingCount} notas activas reales.`);
        refreshBackupData();
        setTimeout(() => setGarbageCleanResult(null), 6000);
      } else {
        alert('No se pudo completar la limpieza: ' + (res.error || 'Error desconocido'));
      }
    } catch (err: any) {
      alert('Error al limpiar basura: ' + err.message);
    } finally {
      setIsCleaningGarbage(false);
    }
  };

  const handleCreateBackupNow = async () => {
    if (!window.electronAPI?.createBackup) return;
    setIsCreatingBackup(true);
    setBackupSuccessMessage('');
    try {
      const res = await window.electronAPI.createBackup();
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia de seguridad guardada! (${res.notesCount || 0} notas, ${res.size})`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else {
        alert(res.error || 'No se pudo crear la copia de seguridad.');
      }
    } catch (e: any) {
      alert('Error creando respaldo: ' + e.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreFromPath = async (filePath?: string) => {
    if (!window.electronAPI?.restoreBackup) return;
    const ok = window.confirm('¿Deseas restaurar esta copia de seguridad? Tus notas se sincronizarán con este respaldo.');
    if (!ok) return;

    setIsRestoring(true);
    try {
      const res = await window.electronAPI.restoreBackup(filePath);
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia restaurada con éxito! (${res.count || 0} notas cargadas)`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else {
        alert(res.error || 'No se pudo restaurar la copia.');
      }
    } catch (e: any) {
      alert('Error al restaurar: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleImportBackup = async () => {
    if (!window.electronAPI?.importBackupDialog) return;
    setIsRestoring(true);
    try {
      const res = await window.electronAPI.importBackupDialog();
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia importada con éxito! (${res.count || 0} notas restauradas)`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else if (res && res.error) {
        alert(res.error);
      }
    } catch (e: any) {
      alert('Error importando copia: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportBackup = async () => {
    if (!window.electronAPI?.exportBackupDialog) return;
    try {
      const res = await window.electronAPI.exportBackupDialog();
      if (res && res.success) {
        setBackupSuccessMessage('Copia de seguridad exportada con éxito.');
        setTimeout(() => setBackupSuccessMessage(''), 4000);
      }
    } catch (e: any) {
      alert('Error exportando: ' + e.message);
    }
  };

  const handleChangeStorageFolder = async (folderPath: string) => {
    if (!window.electronAPI?.changeStorageDir) return;
    try {
      const res = await window.electronAPI.changeStorageDir(folderPath, true);
      if (res && res.success) {
        refreshBackupData();
        setBackupSuccessMessage('Carpeta de sincronización actualizada.');
        setTimeout(() => setBackupSuccessMessage(''), 4000);
      }
    } catch (e: any) {
      alert('Error cambiando carpeta: ' + e.message);
    }
  };

  const handleSelectCustomFolder = async () => {
    if (!window.electronAPI?.selectFolderDialog) return;
    try {
      const folder = await window.electronAPI.selectFolderDialog();
      if (folder) {
        await handleChangeStorageFolder(folder);
      }
    } catch (e: any) {
      alert('Error seleccionando carpeta: ' + e.message);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const modalContent = (
    <div className={`flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 ${
      isStandaloneWindow
        ? 'w-full h-full bg-white dark:bg-slate-900 select-none'
        : 'w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 h-[560px] max-h-[90vh]'
    }`}>
      {/* Header */}
      <div className={`p-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700 select-none shrink-0 ${
        isStandaloneWindow ? 'window-drag-region cursor-move' : ''
      }`}>
        <div className="flex items-center gap-2">
          <SettingsIcon size={18} className="text-blue-400" />
          <h3 className="font-semibold text-sm">Configuración de StickyFlow</h3>
          {isStandaloneWindow && (
            <span className="text-[11px] text-slate-400 ml-1 hidden sm:inline">
              • Arrastra aquí para mover
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 window-no-drag">
          {isStandaloneWindow && (
            <>
              {/* Toggle Pin */}
              <button
                type="button"
                onClick={handleTogglePin}
                title={isPinned ? 'Desactivar siempre visible (desanclar)' : 'Fijar ventana siempre visible'}
                className={`p-1.5 rounded-md border text-xs flex items-center transition-colors cursor-pointer ${
                  isPinned ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                {isPinned ? <Pin size={13} className="text-amber-400" /> : <PinOff size={13} />}
              </button>

              {/* Minimize */}
              <button
                type="button"
                onClick={() => window.electronAPI?.minimize()}
                title="Minimizar ventana"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                <Minus size={13} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Cerrar configuración"
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Modal Layout: Left Navigation + Right Content */}
      <form onSubmit={handleSubmit} className="flex-1 flex overflow-hidden">
          
          {/* Left Navigation Bar */}
          <nav className="w-44 bg-slate-50 dark:bg-slate-950/80 border-r border-slate-200 dark:border-slate-800 p-2 space-y-1 text-xs select-none shrink-0">
            <button
              type="button"
              onClick={() => setCurrentTab('ai')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'ai'
                  ? 'bg-purple-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles size={14} className={currentTab === 'ai' ? 'text-yellow-300' : 'text-purple-500'} />
              <span>IA & Modelos</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('rag')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'rag'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Zap size={14} className={currentTab === 'rag' ? 'text-yellow-300' : 'text-blue-500'} />
              <span>RAG & Cloudflare</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('database')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Cloud size={14} className={currentTab === 'database' ? 'text-white' : 'text-emerald-500'} />
              <span>Copia & Nube</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('privacy')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'privacy'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck size={14} className={currentTab === 'privacy' ? 'text-white' : 'text-amber-500'} />
              <span>Privacidad & Seguridad</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('window')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'window'
                  ? 'bg-slate-700 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders size={14} className={currentTab === 'window' ? 'text-white' : 'text-slate-500'} />
              <span>Ventana & General</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('tts')}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                currentTab === 'tts'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Volume2 size={14} className={currentTab === 'tts' ? 'text-white' : 'text-sky-500'} />
              <span>Voz & Lectura (TTS)</span>
            </button>
          </nav>

          {/* Right Panel: Category Content */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-between text-xs space-y-4">
            
            {/* TAB 1: IA & MODELOS */}
            {currentTab === 'ai' && (
              <div className="space-y-3.5 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-purple-600" />
                    Configuración de Inteligencia Artificial
                  </h4>
                  <p className="text-[11px] text-slate-500">Selecciona tu proveedor principal e introduce tus claves.</p>
                </div>

                {/* Provider Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, activeAiProvider: 'huggingface' })}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      formData.activeAiProvider === 'huggingface'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sparkles size={16} className="text-purple-600" />
                    <div>
                      <div className="text-xs">Hugging Face</div>
                      <div className="text-[10px] text-slate-500 font-normal">Qwen 2.5 72B (Gratuito)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, activeAiProvider: 'claude' })}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      formData.activeAiProvider === 'claude'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bot size={16} className="text-amber-600" />
                    <div>
                      <div className="text-xs">Claude (Anthropic)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Claude 3.5 Sonnet</div>
                    </div>
                  </button>
                </div>

                {/* Hugging Face Settings */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Hugging Face Router</span>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Endpoint</label>
                    <input
                      type="text"
                      value={formData.hfEndpoint}
                      onChange={(e) => setFormData({ ...formData, hfEndpoint: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[11px] text-slate-500">Modelo Chat / Instruct</label>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Recomendados</span>
                    </div>
                    <input
                      type="text"
                      value={formData.hfModel}
                      onChange={(e) => setFormData({ ...formData, hfModel: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      placeholder="Qwen/Qwen2.5-72B-Instruct"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B (Gratuito)' },
                        { id: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B (Rápido)' },
                        { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
                        { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, hfModel: m.id })}
                          className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                            formData.hfModel === m.id
                              ? 'bg-purple-600 text-white border-purple-600 font-semibold'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">API Key de Hugging Face (hf_...)</label>
                    <div className="relative flex items-center">
                      <input
                        type={showHfKey ? 'text' : 'password'}
                        value={formData.hfApiKey}
                        onChange={(e) => setFormData({ ...formData, hfApiKey: e.target.value })}
                        placeholder="hf_..."
                        className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowHfKey(!showHfKey)}
                        className="absolute right-2 text-slate-400"
                      >
                        {showHfKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Claude Settings */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Claude (Anthropic)</span>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">API Key de Anthropic (sk-ant-...)</label>
                    <div className="relative flex items-center">
                      <input
                        type={showClaudeKey ? 'text' : 'password'}
                        value={formData.claudeApiKey}
                        onChange={(e) => setFormData({ ...formData, claudeApiKey: e.target.value })}
                        placeholder="sk-ant-..."
                        className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClaudeKey(!showClaudeKey)}
                        className="absolute right-2 text-slate-400"
                      >
                        {showClaudeKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RAG & CLOUDFLARE */}
            {currentTab === 'rag' && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Zap size={16} className="text-blue-500" />
                    RAG & Sincronización de Conocimiento (Cloudflare)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Sincroniza tus notas con Cloudflare Vectorize o Workers AI para respuestas semánticas ultrarrápidas sobre todas tus notas.
                  </p>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
                  <div>
                    <span className="font-semibold block text-blue-900 dark:text-blue-200">Activar RAG Cloudflare</span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-300">Permite buscar conocimiento semántico en tu base de notas</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableCloudflareRag || false}
                    onChange={(e) => setFormData({ ...formData, enableCloudflareRag: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Cloudflare Account ID</label>
                    <input
                      type="text"
                      value={formData.cloudflareAccountId || ''}
                      onChange={(e) => setFormData({ ...formData, cloudflareAccountId: e.target.value })}
                      placeholder="Tu Account ID de Cloudflare"
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Cloudflare API Token / Worker Key</label>
                    <div className="relative flex items-center">
                      <input
                        type={showCfToken ? 'text' : 'password'}
                        value={formData.cloudflareApiToken || ''}
                        onChange={(e) => setFormData({ ...formData, cloudflareApiToken: e.target.value })}
                        placeholder="Token con permisos Workers AI / Vectorize"
                        className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCfToken(!showCfToken)}
                        className="absolute right-2 text-slate-400"
                      >
                        {showCfToken ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Vectorize Index Name / Endpoint RAG</label>
                    <input
                      type="text"
                      value={formData.cloudflareRagEndpoint || ''}
                      onChange={(e) => setFormData({ ...formData, cloudflareRagEndpoint: e.target.value })}
                      placeholder="https://tu-worker-rag.workers.dev o nombre del índice"
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[11px] text-slate-500 leading-relaxed border border-slate-200 dark:border-slate-700">
                  💡 <em>Nota: Si no configuras Cloudflare, la app utiliza automáticamente el motor RAG local integrado para consultar entre todas tus notas sin enviar nada fuera.</em>
                </div>
              </div>
            )}

            {/* TAB 3: COPIA DE SEGURIDAD & NUBE */}
            {currentTab === 'database' && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Cloud size={16} className="text-emerald-600 dark:text-emerald-400" />
                    Copia de Seguridad & Nube
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Respaldo y sincronización automática sin configuraciones complejas. Tus notas se respaldan en tu nube personal (OneDrive / Google Drive) con 1 solo clic.
                  </p>
                </div>

                {garbageCleanResult && (
                  <div className="p-2 bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 rounded-lg text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                    <span className="font-medium">{garbageCleanResult}</span>
                  </div>
                )}

                {/* 0. GARBAGE CLEANUP CARD */}
                <div className="flex items-center justify-between p-2.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="pr-2">
                    <span className="font-bold block text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Trash2 size={14} className="text-amber-500" />
                      Limpieza de Basura y Archivos Obsoletos
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Elimina notas vacías, fantasmas y archivos .md de notas borradas para que tu copia contenga exactamente tus notas reales.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCleanGarbage}
                    disabled={isCleaningGarbage}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <span>{isCleaningGarbage ? 'Limpiando...' : '🧹 Limpiar Basura'}</span>
                  </button>
                </div>

                {backupSuccessMessage && (
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span className="font-medium">{backupSuccessMessage}</span>
                  </div>
                )}

                {/* 1. BACKUP STATUS CARD */}
                <div className="p-3 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <HardDrive size={15} className="text-emerald-600" />
                        <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                          Estado de Copia de Seguridad
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
                        Última copia:{' '}
                        <strong className="text-emerald-950 dark:text-white">
                          {backupInfo?.lastBackupTime
                            ? new Date(backupInfo.lastBackupTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                            : (formData.lastBackupTime ? new Date(formData.lastBackupTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca realizada')}
                        </strong>
                      </div>
                      <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                        Tamaño:{' '}
                        {backupInfo?.lastBackupSize || formData.lastBackupSize || '0 KB'} •{' '}
                        {backupInfo?.backupCount || backupsList.length} copias guardadas
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateBackupNow}
                      disabled={isCreatingBackup}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Download size={13} className={isCreatingBackup ? 'animate-bounce' : ''} />
                      <span>{isCreatingBackup ? 'Guardando...' : 'Hacer Copia Ahora'}</span>
                    </button>
                  </div>

                  {/* Secondary Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px]">
                    <button
                      type="button"
                      onClick={handleImportBackup}
                      disabled={isRestoring}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Upload size={12} className="text-emerald-600" />
                      <span>Restaurar Copia...</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <FileJson size={12} className="text-blue-600" />
                      <span>Exportar Archivo (.json)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBackupHistory(!showBackupHistory)}
                      className="ml-auto text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      <History size={11} />
                      <span>{showBackupHistory ? 'Ocultar Historial' : `Historial (${backupsList.length})`}</span>
                    </button>
                  </div>

                  {/* Expandable Backup History */}
                  {showBackupHistory && (
                    <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 max-h-36 overflow-y-auto animate-in fade-in">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        Copias de seguridad disponibles en tu equipo:
                      </div>
                      {backupsList.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-1">No hay copias previas aún. Haz clic en "Hacer Copia Ahora".</div>
                      ) : (
                        backupsList.map((b) => (
                          <div
                            key={b.fileName}
                            className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 text-[11px]"
                          >
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{b.fileName}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(b.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • {b.size} • {b.notesCount} notas
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRestoreFromPath(b.filePath)}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                            >
                              Restaurar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 2. CLOUD SYNC LOCATION SELECTOR (ZERO SETUP) */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-100 text-xs">
                      Ubicación de Sincronización en la Nube
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Tus notas se sincronizan automáticamente con la nube mediante tu carpeta personal:
                    </span>
                  </div>

                  {/* Cloud Providers Detected Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {(backupInfo?.detectedClouds || []).map((cloud) => {
                      const isCurrent = backupInfo?.activeStorageDir ? pathNormalize(backupInfo.activeStorageDir) === pathNormalize(cloud.path) : false;
                      return (
                        <button
                          key={cloud.id}
                          type="button"
                          onClick={() => handleChangeStorageFolder(cloud.path)}
                          className={`p-2 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                            isCurrent
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base mt-0.5">
                            {cloud.type === 'onedrive' ? '☁️' : cloud.type === 'gdrive' ? '📁' : cloud.type === 'dropbox' ? '📦' : cloud.type === 'icloud' ? '🍏' : '💻'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">
                                {cloud.name}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold shrink-0">
                                  ACTIVA
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {cloud.exists ? (cloud.isCloud ? 'Sincronizado en tiempo real' : 'Carpeta local') : 'No detectada'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Path Display & Custom Folder Button */}
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                    <div className="truncate pr-2 text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-500">Ruta: </span>
                      <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                        {backupInfo?.activeStorageDir || 'Documentos\\StickyFlow_Notas'}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectCustomFolder}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-[10px] font-medium border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        Cambiar carpeta...
                      </button>
                      <button
                        type="button"
                        onClick={onOpenNotesFolder}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        title="Abrir en el Explorador de Windows"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. AUTO-BACKUP FREQUENCY */}
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-200 text-xs">
                      Copia de Seguridad Automática
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Crea un respaldo automático periódico en tu nube sin interrumpirte
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.autoBackupFrequency || 'daily'}
                      onChange={(e) => setFormData({ ...formData, autoBackupFrequency: e.target.value as any })}
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-medium"
                    >
                      <option value="daily">Diaria (WhatsApp)</option>
                      <option value="weekly">Semanal</option>
                      <option value="manual">Solo manual</option>
                    </select>
                    <input
                      type="checkbox"
                      checked={formData.autoBackupEnabled !== false}
                      onChange={(e) => setFormData({ ...formData, autoBackupEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 4. ADVANCED REMOTE DB (COLLAPSIBLE) */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedDb(!showAdvancedDb)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚙️ Opciones avanzadas de Base de Datos externa (Supabase / Cloudflare D1)</span>
                    <span className="text-[9px]">{showAdvancedDb ? '▲' : '▼'}</span>
                  </button>

                  {showAdvancedDb && (
                    <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, dbMode: 'local' })}
                          className={`p-2 rounded border text-left text-xs ${formData.dbMode !== 'remote' ? 'border-emerald-600 font-bold bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          Modo Normal (Local + Nube OneDrive/Google Drive)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, dbMode: 'remote' })}
                          className={`p-2 rounded border text-left text-xs ${formData.dbMode === 'remote' ? 'border-blue-600 font-bold bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          Conectar Servidor SQL / REST Remoto
                        </button>
                      </div>

                      {formData.dbMode === 'remote' && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="text-[10px] text-slate-500 block">Proveedor</label>
                            <select
                              value={formData.remoteDbProvider || 'supabase'}
                              onChange={(e) => setFormData({ ...formData, remoteDbProvider: e.target.value as any })}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                            >
                              <option value="supabase">Supabase (PostgreSQL / REST)</option>
                              <option value="cloudflare_d1">Cloudflare D1</option>
                              <option value="rest">API REST</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block">URL de la Base de Datos</label>
                            <input
                              type="text"
                              value={formData.remoteDbUrl || ''}
                              onChange={(e) => setFormData({ ...formData, remoteDbUrl: e.target.value })}
                              placeholder="https://xyz.supabase.co"
                              className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block">API Key</label>
                            <input
                              type="password"
                              value={formData.remoteDbApiKey || ''}
                              onChange={(e) => setFormData({ ...formData, remoteDbApiKey: e.target.value })}
                              className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: PRIVACIDAD & SEGURIDAD */}
            {currentTab === 'privacy' && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-amber-500" />
                    Privacidad Estricta & Seguridad de Datos
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Controla qué datos pueden salir hacia los modelos de IA para garantizar que tus contraseñas y claves nunca se filtren.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
                    <div>
                      <span className="font-semibold block text-amber-900 dark:text-amber-200">Enmascaramiento Automático de Secretos</span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">
                        Oculta automáticamente claves API (`hf_...`, `sk-...`), contraseñas y tokens Bearer antes de enviar la nota a la IA.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enablePrivacyMasking !== false}
                      onChange={(e) => setFormData({ ...formData, enablePrivacyMasking: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
                    <span className="font-semibold block text-slate-700 dark:text-slate-300">Garantía de Privacidad Local:</span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-500">
                      <li>Todas tus notas se guardan en tu disco duro (`Documentos\StickyFlow_Notas`).</li>
                      <li>No existe telemetría ni rastreo de uso.</li>
                      <li>Las llamadas a Hugging Face o Claude solo se ejecutan cuando tú presionas el botón explícitamente.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: VENTANA & GENERAL */}
            {currentTab === 'window' && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Sliders size={16} className="text-slate-600 dark:text-slate-300" />
                    Comportamiento de Ventana & Sistema
                  </h4>
                  <p className="text-[11px] text-slate-500">Ajustes visuales y acceso directo a archivos.</p>
                </div>

                <div className="space-y-3">
                  {/* Inicio discreto con solo separadores */}
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                    <div className="pr-2">
                      <span className="font-semibold block text-emerald-950 dark:text-emerald-200 text-xs">
                        Al Iniciar la PC: Mostrar solo pestañas pequeñas (Dock)
                      </span>
                      <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80">
                        No abre la ventana grande al arrancar la PC; únicamente muestra los separadores discretos en el borde. Las notas se abren cuando haces clic en ellas.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.startDockOnly !== false}
                      onChange={(e) => setFormData({ ...formData, startDockOnly: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer shrink-0"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold block text-slate-700 dark:text-slate-200">Siempre Flotante por Defecto</span>
                      <span className="text-[10px] text-slate-500">Fija la ventana por encima de todas las aplicaciones</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.alwaysOnTop}
                      onChange={(e) => setFormData({ ...formData, alwaysOnTop: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Opacidad de la Ventana ({Math.round((formData.opacity || 1) * 100)}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={formData.opacity || 0.98}
                      onChange={(e) => setFormData({ ...formData, opacity: parseFloat(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* SECCIÓN DE SEPARADORES DE CUADERNO / DOCK */}
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <StickyNote size={15} className="text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                          Separadores de Cuaderno en Pantalla (Dock)
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.dockEnabled !== false}
                        onChange={(e) => setFormData({ ...formData, dockEnabled: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600"
                      />
                    </div>

                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                      Agrupa tus notas ancladas como pequeños separadores centrados en el borde de tu pantalla. Al pasar el cursor se expande una descripción completa, sin saturar la barra de tareas de Windows.
                    </p>

                    {formData.dockEnabled !== false && (
                      <div className="space-y-2.5 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                        {/* Position selector */}
                        <div>
                          <label className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 block mb-1">
                            Borde de la pantalla:
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: 'left', label: 'Izquierda', icon: '⬅️' },
                              { id: 'right', label: 'Derecha', icon: '➡️' },
                              { id: 'top', label: 'Arriba', icon: '⬆️' },
                              { id: 'bottom', label: 'Abajo', icon: '⬇️' }
                            ].map((pos) => {
                              const isSelected = (formData.dockPosition || 'right') === pos.id;
                              return (
                                <button
                                  key={pos.id}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, dockPosition: pos.id as any })}
                                  className={`py-1.5 px-2 rounded-md border text-center transition-all text-xs font-medium flex flex-col items-center gap-0.5 ${
                                    isSelected
                                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-100/50'
                                  }`}
                                >
                                  <span>{pos.icon}</span>
                                  <span className="text-[10px]">{pos.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Show / Hide Titles toggle */}
                        <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                          <div>
                            <span className="font-medium text-[11px] text-amber-950 dark:text-amber-200 block">
                              Mostrar nombres de notas en los separadores
                            </span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400">
                              {formData.dockShowTitles !== false
                                ? 'Nombre visible en cada pestaña'
                                : 'Modo discreto / compacto (solo pestaña de color)'}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.dockShowTitles !== false}
                            onChange={(e) => setFormData({ ...formData, dockShowTitles: e.target.checked })}
                            className="w-4 h-4 rounded text-amber-600"
                          />
                        </div>

                        {/* Always on top toggle for dock */}
                        <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                          <div>
                            <span className="font-medium text-[11px] text-amber-950 dark:text-amber-200 block">
                              Separadores siempre visibles (Fijos e independientes)
                            </span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400">
                              {formData.dockAlwaysOnTop !== false
                                ? 'Permanece siempre fijo en el borde sin afectarse si desanclas la ventana grande'
                                : 'Permite que otras ventanas cubran los separadores'}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.dockAlwaysOnTop !== false}
                            onChange={(e) => setFormData({ ...formData, dockAlwaysOnTop: e.target.checked })}
                            className="w-4 h-4 rounded text-amber-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900 space-y-1.5">
                    <span className="font-semibold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <FolderOpen size={14} className="text-blue-600" />
                      Carpeta Local de Notas (.md)
                    </span>
                    <p className="text-[11px] text-blue-800 dark:text-blue-300">
                      Ubicación: <code>Documentos\StickyFlow_Notas</code> (Sincronizada para Claude y Cursor).
                    </p>
                    <button
                      type="button"
                      onClick={onOpenNotesFolder}
                      className="mt-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium flex items-center gap-1 shadow-xs"
                    >
                      <ExternalLink size={12} />
                      Abrir carpeta de notas
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: VOZ & LECTURA (TTS) */}
            {currentTab === 'tts' && (
              <div className="space-y-3.5 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Volume2 size={16} className="text-sky-600 dark:text-sky-400" />
                    Lectura Natural de Notas (Voz Real Humana & Piper TTS)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Sustituye la voz robótica por voces neuronales de alta fidelidad y modelos Piper TTS que leen con calidez humana real en 3 idiomas.
                  </p>
                </div>

                {/* Idioma Selector Tabs: Latino / Inglés / Francés */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setTtsLangTab('es');
                      handleResetRecommendedVoice('es');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'es' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
                  >
                    <span>🌎 Español Latino</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTtsLangTab('en');
                      handleResetRecommendedVoice('en');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'en' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
                  >
                    <span>🇺🇸 English</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTtsLangTab('fr');
                      handleResetRecommendedVoice('fr');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ttsLangTab === 'fr' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'}`}
                  >
                    <span>🇫🇷 Français</span>
                  </button>
                </div>

                {/* Voice Selection Box */}
                <div className="p-3 bg-gradient-to-br from-sky-50/70 to-indigo-50/40 dark:from-sky-950/30 dark:to-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 dark:text-slate-100 block text-xs">
                      Voz del Narrador ({ttsLangTab === 'es' ? 'Español Latino' : ttsLangTab === 'en' ? 'Inglés' : 'Francés'}):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleResetRecommendedVoice(ttsLangTab)}
                      className="text-[10px] text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      <span>
                        {ttsLangTab === 'es' ? 'Recomendar Dalia (México)' : ttsLangTab === 'en' ? 'Recomendar Jenny (EE.UU.)' : 'Recomendar Denise (Francia)'}
                      </span>
                    </button>
                  </div>

                  <select
                    value={formData.ttsVoice || (ttsLangTab === 'es' ? 'es-MX-DaliaNeural' : ttsLangTab === 'en' ? 'en-US-JennyNeural' : 'fr-FR-DeniseNeural')}
                    onChange={(e) => setFormData({ ...formData, ttsVoice: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                  >
                    <optgroup label={`✨ Voces Neuronales de Alta Fidelidad (${ttsLangTab === 'es' ? 'Español Latino' : ttsLangTab === 'en' ? 'English' : 'Français'})`}>
                      {ALL_NATURAL_VOICES.filter(v => v.category === ttsLangTab && v.engine !== 'piper').map(v => (
                        <option key={v.id} value={v.id}>
                          {v.flag} {v.name} ({v.country}) — {v.gender === 'female' ? 'Femenina' : 'Masculina'} • {v.description}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="⚡ Modelos Piper TTS (VITS Locales)">
                      {ALL_NATURAL_VOICES.filter(v => v.category === ttsLangTab && v.engine === 'piper').map(v => (
                        <option key={v.id} value={v.id}>
                          {v.flag} {v.name} ({v.country}) — {v.description}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🔊 Voces Locales del Sistema Operativo">
                      {voices.filter(v => !v.isNeural && (
                        ttsLangTab === 'es' ? v.lang.startsWith('es') :
                        ttsLangTab === 'en' ? v.lang.startsWith('en') :
                        v.lang.startsWith('fr')
                      )).map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-sky-800/80 dark:text-sky-300/80">
                      ✨ Sin costo • Entonación fluida humana real y Piper TTS
                    </span>
                    <button
                      type="button"
                      onClick={handleTestVoice}
                      disabled={isPlayingTest}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Volume2 size={13} className={isPlayingTest ? 'animate-bounce' : ''} />
                      <span>{isPlayingTest ? 'Reproduciendo muestra...' : 'Probar Voz'}</span>
                    </button>
                  </div>
                </div>

                {/* Speed / Rate slider */}
                <div className="space-y-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                      Velocidad de Lectura ({formData.ttsRate || 1.0}x)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(formData.ttsRate || 1.0) === 1.0 ? 'Normal (Recomendado)' : (formData.ttsRate || 1.0) < 1.0 ? 'Pausada' : 'Rápida'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.05"
                    value={formData.ttsRate || 1.0}
                    onChange={(e) => setFormData({ ...formData, ttsRate: parseFloat(e.target.value) })}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>0.7x (Pausada)</span>
                    <span>1.0x (Natural)</span>
                    <span>1.4x (Dinámica)</span>
                  </div>
                </div>

                {/* Pitch slider */}
                <div className="space-y-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                      Tono de la Voz ({formData.ttsPitch || 1.0})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(formData.ttsPitch || 1.0) === 1.0 ? 'Natural' : (formData.ttsPitch || 1.0) < 1.0 ? 'Grave' : 'Agudo'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={formData.ttsPitch || 1.0}
                    onChange={(e) => setFormData({ ...formData, ttsPitch: parseFloat(e.target.value) })}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* Smart reader explanation card */}
                <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <span>✨ Modo Persona Real Activo</span>
                  </div>
                  <p>
                    StickyFlow procesa el texto antes de leerlo: reconoce tareas completadas o pendientes, títulos, pausas y viñetas sin deletrear enlaces feos, para que suene exactamente como un audiolibro narrado por una persona real.
                  </p>
                </div>
              </div>
            )}

            {/* Save Button Footer */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                {savedSuccess ? (
                  <>
                    <Check size={14} className="text-green-400" />
                    <span>¡Configuración Guardada!</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </button>
            </div>
          </div>
        </form>
    </div>
  );

  if (isStandaloneWindow) {
    return modalContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      {modalContent}
    </div>
  );
};
