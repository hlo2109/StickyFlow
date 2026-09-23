import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Wand2,
  CheckSquare,
  SpellCheck,
  Send,
  Copy,
  PlusCircle,
  Replace,
  AlertCircle,
  Settings as SettingsIcon,
  Loader2,
  Check,
  ShieldCheck,
  Lightbulb,
  Search
} from 'lucide-react';
import { Note, AppSettings } from '../types';
import { executeAiTask, AiRequestOptions } from '../utils/aiService';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  allNotes: Note[];
  settings: AppSettings;
  onOpenSettings: () => void;
  onInsertResult: (text: string) => void;
  onReplaceResult: (text: string) => void;
  onCreateNewNoteFromAi: (title: string, content: string) => void;
  onAddBitacoraLog: (action: any, summary: string) => void;
}

export const AiModal: React.FC<AiModalProps> = ({
  isOpen,
  onClose,
  note,
  allNotes,
  settings,
  onOpenSettings,
  onInsertResult,
  onReplaceResult,
  onCreateNewNoteFromAi,
  onAddBitacoraLog
}) => {
  const [activeTab, setActiveTab] = useState<'actions' | 'creator' | 'rag'>('actions');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [lastAction, setLastAction] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [maskedCount, setMaskedCount] = useState(0);

  // Note Creator Fields
  const [rawIdeas, setRawIdeas] = useState('');
  const [noteTone, setNoteTone] = useState('Profesional y Estructurado');
  const [suggestedTitle, setSuggestedTitle] = useState('');

  // RAG Question
  const [ragQuery, setRagQuery] = useState('');

  if (!isOpen) return null;

  const hasApiKey =
    (settings.activeAiProvider === 'claude' && settings.claudeApiKey?.trim()) ||
    (settings.activeAiProvider !== 'claude' && settings.hfApiKey?.trim());

  const handleAction = async (action: AiRequestOptions['action'], label: string, inputOverride?: string) => {
    setLoading(true);
    setErrorMessage('');
    setAiResult('');
    setMaskedCount(0);
    setLastAction(label);

    const noteContent = inputOverride !== undefined ? inputOverride : (note.markdownContent || note.content || '');

    const res = await executeAiTask({
      action,
      content: noteContent,
      customPrompt: action === 'custom' ? customPrompt : (action === 'rag_query' ? ragQuery : undefined),
      settings,
      allNotes,
      tone: noteTone
    });

    setLoading(false);

    if (res.success && res.result) {
      setAiResult(res.result);
      if (res.suggestedTitle) {
        setSuggestedTitle(res.suggestedTitle);
      }
      if (res.maskedInfo?.maskedCount) {
        setMaskedCount(res.maskedInfo.maskedCount);
      }
      onAddBitacoraLog(`ia_${action}` as any, `IA ejecutó '${label}'`);
    } else {
      setErrorMessage(res.error || 'Ocurrió un error al contactar al modelo.');
    }
  };

  const handleCopy = () => {
    if (aiResult) {
      if (window.electronAPI?.writeClipboard) {
        window.electronAPI.writeClipboard(aiResult);
      } else {
        navigator.clipboard.writeText(aiResult);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateNote = () => {
    if (aiResult) {
      const finalTitle = suggestedTitle || 'Nota Asistida por IA';
      onCreateNewNoteFromAi(finalTitle, aiResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-300" />
            <div>
              <h3 className="font-semibold text-sm">
                Asistente de IA ({settings.activeAiProvider === 'claude' ? 'Claude' : 'HuggingFace GPT-OSS'})
              </h3>
              <p className="text-[10px] text-purple-200 opacity-90 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-300" />
                <span>Privacidad activa: claves y tokens enmascarados</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-1 py-2 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'actions'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={13} />
            <span>Nota Actual</span>
          </button>

          <button
            onClick={() => setActiveTab('creator')}
            className={`flex-1 py-2 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'creator'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lightbulb size={13} className="text-amber-500" />
            <span>Crear desde Ideas</span>
          </button>

          <button
            onClick={() => setActiveTab('rag')}
            className={`flex-1 py-2 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'rag'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Search size={13} className="text-blue-500" />
            <span>Consultar Notas (RAG)</span>
          </button>
        </div>

        {/* Missing API Key Warning */}
        {!hasApiKey && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-amber-600" />
              <span>Falta la clave API para usar la IA.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1 shadow-xs"
            >
              <SettingsIcon size={12} />
              Configurar
            </button>
          </div>
        )}

        {/* Tab 1: Current Note Actions */}
        {activeTab === 'actions' && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAction('summarize', 'Resumir')}
                disabled={loading}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <FileText size={15} className="text-blue-500" />
                <span>Resumir nota</span>
              </button>

              <button
                onClick={() => handleAction('improve', 'Mejorar redacción')}
                disabled={loading}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Wand2 size={15} className="text-purple-500" />
                <span>Mejorar redacción</span>
              </button>

              <button
                onClick={() => handleAction('todo', 'Extraer tareas')}
                disabled={loading}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckSquare size={15} className="text-green-500" />
                <span>Extraer To-Do</span>
              </button>

              <button
                onClick={() => handleAction('grammar', 'Corregir ortografía')}
                disabled={loading}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <SpellCheck size={15} className="text-amber-500" />
                <span>Corregir ortografía</span>
              </button>
            </div>

            {/* Custom Instruction Input */}
            <div className="mt-2.5 flex items-center gap-1.5">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPrompt.trim()) {
                    handleAction('custom', 'Instrucción personalizada');
                  }
                }}
                placeholder="Instrucción libre (ej: Traduce al inglés, explica en viñetas...)"
                className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={() => handleAction('custom', 'Instrucción personalizada')}
                disabled={loading || !customPrompt.trim()}
                className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Create Note from Raw Ideas */}
        {activeTab === 'creator' && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Escribe tus ideas sueltas o borrador:
              </span>
              <select
                value={noteTone}
                onChange={(e) => setNoteTone(e.target.value)}
                className="text-[11px] p-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
              >
                <option value="Profesional y Estructurado">Profesional y Estructurado</option>
                <option value="Plan de Acción con Tareas">Plan de Acción / To-Do</option>
                <option value="Minuta de Trabajo">Minuta de Trabajo</option>
                <option value="Creativo y Lluvia de Ideas">Creativo / Brainstorming</option>
              </select>
            </div>

            <textarea
              value={rawIdeas}
              onChange={(e) => setRawIdeas(e.target.value)}
              placeholder="Ej: reunion con cliente mañana a las 10, revisar precios de la propuesta, pedir adelanto 50%, no olvidar adjuntar el PDF de requerimientos..."
              className="w-full h-20 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed"
            />

            <button
              onClick={() => handleAction('generate_note', 'Crear Nota Completa', rawIdeas)}
              disabled={loading || !rawIdeas.trim()}
              className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles size={14} className="text-yellow-300" />
              <span>Redactar y Estructurar Nota con IA</span>
            </button>
          </div>
        )}

        {/* Tab 3: RAG Knowledge Query */}
        {activeTab === 'rag' && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold uppercase tracking-wider">
                Pregunta a toda tu base de notas ({allNotes.length} notas indexadas):
              </span>
              {settings.enableCloudflareRag && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
                  Cloudflare RAG Conectado
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ragQuery.trim()) {
                    handleAction('rag_query', 'Búsqueda RAG en Notas', ragQuery);
                  }
                }}
                placeholder="Ej: ¿Qué acordamos sobre los entregables del proyecto X?"
                className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => handleAction('rag_query', 'Búsqueda RAG en Notas', ragQuery)}
                disabled={loading || !ragQuery.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Search size={14} />
                <span>Consultar</span>
              </button>
            </div>
          </div>
        )}

        {/* Masked Content Security Badge */}
        {maskedCount > 0 && (
          <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <ShieldCheck size={14} />
            <span>Filtro de Privacidad: Se ocultaron {maskedCount} credenciales/claves antes de enviar a la nube.</span>
          </div>
        )}

        {/* Content / Result Area */}
        <div className="flex-1 p-3 overflow-y-auto select-text min-h-[140px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span className="text-xs">Procesando de forma segura con {settings.activeAiProvider === 'claude' ? 'Claude' : settings.hfModel}...</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-xs leading-relaxed">
              <div className="font-semibold mb-1">Error de IA:</div>
              {errorMessage}
            </div>
          )}

          {aiResult && !loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Resultado: {lastAction}</span>
                <span className="text-green-600 font-semibold">Listo ✓</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                {aiResult}
              </div>
            </div>
          )}

          {!loading && !aiResult && !errorMessage && (
            <div className="text-center py-6 text-xs text-slate-400">
              {activeTab === 'creator'
                ? 'Escribe tus ideas arriba y la IA te estructurará una nota profesional.'
                : activeTab === 'rag'
                ? 'Haz una pregunta sobre tus notas y la IA buscará en todo tu historial.'
                : 'Selecciona una acción arriba para analizar la nota actual.'}
            </div>
          )}
        </div>

        {/* Action Footer for Result */}
        {aiResult && !loading && (
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-1.5">
            <button
              onClick={handleCopy}
              className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => {
                  onInsertResult(aiResult);
                  onClose();
                }}
                className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Añadir este contenido al final de la nota que tienes abierta"
              >
                <FileText size={13} />
                <span>Insertar en nota actual</span>
              </button>

              {activeTab !== 'creator' && (
                <button
                  onClick={() => {
                    onReplaceResult(aiResult);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                  title="Reemplazar el contenido de la nota actual con este resultado"
                >
                  <Replace size={13} />
                  <span>Reemplazar</span>
                </button>
              )}

              <button
                onClick={() => {
                  onCreateNewNoteFromAi(suggestedTitle || lastAction || 'Nota Asistida por IA', aiResult);
                  onClose();
                }}
                className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Crear una nueva nota independiente con este texto"
              >
                <PlusCircle size={14} />
                <span>Crear nueva nota</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
