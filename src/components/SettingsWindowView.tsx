import React, { useState, useEffect } from 'react';
import { SettingsModal } from './SettingsModal';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../defaultSettings';

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
