import React, { useState, useEffect } from 'react';
import { SettingsModal } from './SettingsModal';
import { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  hfEndpoint: 'https://router.huggingface.co/v1',
  hfModel: 'Qwen/Qwen2.5-72B-Instruct',
  hfApiKey: '',
  claudeApiKey: '',
  claudeModel: 'claude-3-5-sonnet-20241022',
  activeAiProvider: 'huggingface',
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

export const SettingsWindowView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.loadSettings) {
      window.electronAPI.loadSettings().then((loaded) => {
        if (loaded) {
          setSettings((prev) => ({ ...prev, ...loaded }));
        }
        setIsLoaded(true);
      }).catch(() => setIsLoaded(true));
    } else {
      setIsLoaded(true);
    }
  }, []);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(newSettings);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  const handleOpenFolder = () => {
    if (window.electronAPI?.openNotesFolder) {
      window.electronAPI.openNotesFolder();
    }
  };

  if (!isLoaded) {
    return <div className="h-screen w-screen bg-slate-900 text-white flex items-center justify-center text-xs">Cargando configuración...</div>;
  }

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none">
      <SettingsModal
        isOpen={true}
        onClose={handleClose}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onOpenNotesFolder={handleOpenFolder}
      />
    </div>
  );
};
