import React, { useState, useEffect } from 'react';
import { X, Minus, Pin, PinOff, Settings as SettingsIcon, Check } from 'lucide-react';
import { AppSettings } from '../../types';
import { SettingsTab, SETTINGS_TABS } from './types';
import { AiTab } from './tabs/AiTab';
import { RagTab } from './tabs/RagTab';
import { DatabaseTab } from './tabs/DatabaseTab';
import { PrivacyTab } from './tabs/PrivacyTab';
import { WindowTab } from './tabs/WindowTab';
import { TtsTab } from './tabs/TtsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onOpenNotesFolder: () => void;
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
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const tabProps = { formData, setFormData, onOpenNotesFolder };

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
            {SETTINGS_TABS.map(({ id, label, Icon, activeBg, activeIcon, idleIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentTab(id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                  currentTab === id
                    ? `${activeBg} text-white shadow-xs font-semibold`
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} className={currentTab === id ? activeIcon : idleIcon} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Right Panel: Category Content */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-between text-xs space-y-4">
            {currentTab === 'ai' && <AiTab {...tabProps} />}
            {currentTab === 'rag' && <RagTab {...tabProps} />}
            {currentTab === 'database' && <DatabaseTab {...tabProps} />}
            {currentTab === 'privacy' && <PrivacyTab {...tabProps} />}
            {currentTab === 'window' && <WindowTab {...tabProps} />}
            {currentTab === 'tts' && <TtsTab {...tabProps} />}

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
