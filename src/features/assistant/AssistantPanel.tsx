import React, { useState } from 'react';
import { Brain, BookOpen } from 'lucide-react';
import { AppSettings, Note } from '../../types';
import { ConversationKind } from '../analysis/types';
import { ContextManager } from '../context/ContextManager';
import { useContextStore } from '../context/useContextStore';
import { AnalysisView } from './AnalysisView';

export interface ExtraTab {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Número pequeño junto al nombre (p. ej. dudas abiertas) */
  badge?: number;
  content: React.ReactNode;
}

interface AssistantPanelProps {
  kind: ConversationKind;
  settings: AppSettings;
  notes: Note[];
  getTranscript: () => string;
  onSayAnswer?: (text: string) => void;
  /** Pestañas propias de cada pantalla (p. ej. el Radar de dudas en Reunión) */
  extraTabs?: ExtraTab[];
  defaultTab?: string;
}

/**
 * Asistente de la conversación (se usa en Entrevista y en Reunión):
 *   🧠 Análisis  → puntos clave, preguntas con respuesta sugerida, pendientes, acciones
 *   📚 Contexto  → tu CV, proyectos y notas, para que las respuestas se basen en lo que has hecho
 */
export const AssistantPanel: React.FC<AssistantPanelProps> = ({ kind, settings, notes, getTranscript, onSayAnswer, extraTabs = [], defaultTab = 'analysis' }) => {
  const [tab, setTab] = useState(defaultTab);
  const { state } = useContextStore();

  const tabs: ExtraTab[] = [
    ...extraTabs,
    { id: 'analysis', label: 'Análisis', Icon: Brain, content: null },
    { id: 'context', label: 'Contexto', Icon: BookOpen, badge: state.selected.length || undefined, content: null }
  ];

  return (
    <div className="h-full flex flex-col min-h-0 bg-slate-950/40">
      <div role="tablist" className="flex items-stretch border-b border-slate-800 shrink-0 px-2 pt-2 gap-1">
        {tabs.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 rounded-t-lg text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              tab === id ? 'text-white border-violet-500 bg-slate-800/60' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Icon size={13} />
            {label}
            {badge ? <span className="px-1.5 rounded-full bg-violet-600/40 text-violet-200 text-[10px]">{badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {/* Todas las pestañas quedan montadas y solo se ocultan: así el análisis (y lo que escribes en Contexto)
            NO se pierde al cambiar de pestaña. */}
        <div hidden={tab !== 'analysis'}>
          <AnalysisView kind={kind} settings={settings} notes={notes} getTranscript={getTranscript} onSayAnswer={onSayAnswer} onGoToContext={() => setTab('context')} />
        </div>
        <div hidden={tab !== 'context'}>
          <ContextManager notes={notes} />
        </div>
        {extraTabs.map((t) => (
          <div key={t.id} hidden={tab !== t.id}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
};
