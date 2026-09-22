import React, { useState } from 'react';
import {
  X,
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
  Cloud
} from 'lucide-react';
import { AppSettings, DbMode, RemoteDbProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onOpenNotesFolder: () => void;
}

type SettingsTab = 'ai' | 'rag' | 'database' | 'privacy' | 'window';

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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[520px] max-h-[90vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} className="text-blue-400" />
            <h3 className="font-semibold text-sm">Configuración de StickyFlow</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
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
              <Database size={14} className={currentTab === 'database' ? 'text-white' : 'text-emerald-500'} />
              <span>Base de Datos</span>
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
                      <div className="text-[10px] text-slate-500 font-normal">gpt-oss-120b</div>
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
                    <label className="text-[11px] text-slate-500 block mb-0.5">Modelo</label>
                    <input
                      type="text"
                      value={formData.hfModel}
                      onChange={(e) => setFormData({ ...formData, hfModel: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
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

            {/* TAB 3: BASE DE DATOS */}
            {currentTab === 'database' && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Database size={16} className="text-emerald-500" />
                    Base de Datos & Almacenamiento
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Elige si deseas operar 100% offline o sincronizar con una base de datos externa en línea.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dbMode: 'local' })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      formData.dbMode !== 'remote'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Lock size={16} className="text-emerald-600 mb-1" />
                    <div className="text-xs">Solo Local (Privado)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Sin latencia, sin nube, 100% en tu equipo</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dbMode: 'remote' })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      formData.dbMode === 'remote'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Cloud size={16} className="text-blue-600 mb-1" />
                    <div className="text-xs">Base de Datos Online</div>
                    <div className="text-[10px] text-slate-500 font-normal">Sincroniza con Supabase / REST / Cloudflare D1</div>
                  </button>
                </div>

                {formData.dbMode === 'remote' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Tipo de Proveedor Online</label>
                      <select
                        value={formData.remoteDbProvider || 'supabase'}
                        onChange={(e) => setFormData({ ...formData, remoteDbProvider: e.target.value as RemoteDbProvider })}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      >
                        <option value="supabase">Supabase (PostgreSQL / REST)</option>
                        <option value="cloudflare_d1">Cloudflare D1 / Workers</option>
                        <option value="rest">API REST Personalizada</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">URL de la Base de Datos</label>
                      <input
                        type="text"
                        value={formData.remoteDbUrl || ''}
                        onChange={(e) => setFormData({ ...formData, remoteDbUrl: e.target.value })}
                        placeholder="https://xyz.supabase.co o endpoint REST"
                        className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">API Key / Token de Acceso</label>
                      <div className="relative flex items-center">
                        <input
                          type={showRemoteDbKey ? 'text' : 'password'}
                          value={formData.remoteDbApiKey || ''}
                          onChange={(e) => setFormData({ ...formData, remoteDbApiKey: e.target.value })}
                          placeholder="Clave de API pública o servicio"
                          className="w-full px-2.5 py-1 pr-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRemoteDbKey(!showRemoteDbKey)}
                          className="absolute right-2 text-slate-400"
                        >
                          {showRemoteDbKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
    </div>
  );
};
