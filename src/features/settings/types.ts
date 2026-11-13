import React from 'react';
import { Sparkles, Zap, Cloud, ShieldCheck, Sliders, Volume2, Languages } from 'lucide-react';
import { AppSettings } from '../../types';

export type SettingsTab = 'ai' | 'rag' | 'database' | 'privacy' | 'window' | 'tts' | 'interview';

/** Props comunes de todas las pestañas: trabajan sobre una copia del formulario. */
export interface SettingsTabProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
  onOpenNotesFolder: () => void;
}

/** Definición de la barra lateral. Las clases de Tailwind van completas para que se detecten al compilar. */
export const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  activeBg: string;
  activeIcon: string;
  idleIcon: string;
}> = [
  { id: 'ai', label: 'IA & Modelos', Icon: Sparkles, activeBg: 'bg-purple-600', activeIcon: 'text-yellow-300', idleIcon: 'text-purple-500' },
  { id: 'rag', label: 'RAG & Cloudflare', Icon: Zap, activeBg: 'bg-blue-600', activeIcon: 'text-yellow-300', idleIcon: 'text-blue-500' },
  { id: 'database', label: 'Copia & Nube', Icon: Cloud, activeBg: 'bg-emerald-600', activeIcon: 'text-white', idleIcon: 'text-emerald-500' },
  { id: 'privacy', label: 'Privacidad & Seguridad', Icon: ShieldCheck, activeBg: 'bg-amber-600', activeIcon: 'text-white', idleIcon: 'text-amber-500' },
  { id: 'window', label: 'Ventana & General', Icon: Sliders, activeBg: 'bg-slate-700', activeIcon: 'text-white', idleIcon: 'text-slate-500' },
  { id: 'tts', label: 'Voz & Lectura (TTS)', Icon: Volume2, activeBg: 'bg-sky-600', activeIcon: 'text-white', idleIcon: 'text-sky-500' },
  { id: 'interview', label: 'Entrevista', Icon: Languages, activeBg: 'bg-cyan-600', activeIcon: 'text-white', idleIcon: 'text-cyan-500' }
];
