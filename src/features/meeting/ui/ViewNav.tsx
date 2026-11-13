import React from 'react';
import { Headphones, Languages, Mic } from 'lucide-react';

export type AppView = 'meeting' | 'interview' | 'voicenote';

const ITEMS: Array<{ id: AppView; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; active: string }> = [
  { id: 'meeting', label: 'Reunión', Icon: Headphones, active: 'bg-indigo-600 text-white' },
  { id: 'interview', label: 'Entrevista', Icon: Languages, active: 'bg-sky-600 text-white' },
  { id: 'voicenote', label: 'Nota de voz', Icon: Mic, active: 'bg-rose-600 text-white' }
];

/** Navegación entre las tres vistas de la ventana, siempre en el mismo lugar. */
export const ViewNav: React.FC<{ current: AppView; onNavigate: (view: AppView) => void; disabled?: boolean }> = ({ current, onNavigate, disabled }) => (
  <nav className="flex items-center p-0.5 rounded-lg bg-slate-800/80 border border-slate-700 window-no-drag" aria-label="Cambiar de vista">
    {ITEMS.map(({ id, label, Icon, active }) => (
      <button
        key={id}
        type="button"
        disabled={disabled && id !== current}
        aria-current={current === id ? 'page' : undefined}
        onClick={() => id !== current && onNavigate(id)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
          current === id ? active : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
        }`}
      >
        <Icon size={13} />
        {label}
      </button>
    ))}
  </nav>
);
