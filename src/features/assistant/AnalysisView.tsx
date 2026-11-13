import React, { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Volume2
} from 'lucide-react';
import { AppSettings, Note } from '../../types';
import { isAiReady } from '../ai/status';
import { analyzeConversation, suggestAnswer } from '../analysis/analyze';
import { AnalysisQuestion, ConversationAnalysis, ConversationKind } from '../analysis/types';
import { buildContextBlock } from '../context/buildContext';
import { useContextStore } from '../context/useContextStore';

interface AnalysisViewProps {
  kind: ConversationKind;
  settings: AppSettings;
  notes: Note[];
  /** Conversación hasta ahora, en texto («Yo: …», «Ellos: …») */
  getTranscript: () => string;
  /** Solo en Entrevista: decir una respuesta con tu voz (se traduce y sale por el micrófono virtual) */
  onSayAnswer?: (text: string) => void;
  onGoToContext: () => void;
}

const copy = (text: string) => {
  if (window.electronAPI?.writeClipboard) window.electronAPI.writeClipboard(text);
  else navigator.clipboard?.writeText(text);
};

const Section: React.FC<{ title: string; Icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; children: React.ReactNode }> = ({
  title,
  Icon,
  tone,
  children
}) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
    <h4 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${tone}`}>
      <Icon size={13} /> {title}
    </h4>
    {children}
  </section>
);

const Bullets: React.FC<{ items: string[]; onCopy?: boolean }> = ({ items, onCopy }) => (
  <ul className="space-y-1.5">
    {items.map((t, i) => (
      <li key={i} className="flex items-start gap-2 leading-snug">
        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500 shrink-0" />
        <span className="flex-1 select-text">{t}</span>
        {onCopy && (
          <button type="button" onClick={() => copy(t)} title="Copiar" className="text-slate-500 hover:text-slate-200 cursor-pointer">
            <Copy size={12} />
          </button>
        )}
      </li>
    ))}
  </ul>
);

const QuestionCard: React.FC<{
  q: AnalysisQuestion;
  busy: boolean;
  canSay: boolean;
  onRegenerate: (style: 'breve' | 'detallada') => void;
  onSay: () => void;
}> = ({ q, busy, canSay, onRegenerate, onSay }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5 space-y-2">
    <div className="flex items-start gap-2">
      <span className="flex-1 font-medium leading-snug select-text">{q.question}</span>
      <span className="text-[10px] text-slate-400 shrink-0">{q.askedBy}</span>
      {q.answered ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shrink-0 flex items-center gap-1">
          <CheckCircle2 size={10} /> ya respondida
        </span>
      ) : (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0 flex items-center gap-1">
          <Clock size={10} /> por responder
        </span>
      )}
    </div>

    {q.suggestedAnswer && (
      <div className="rounded-md bg-sky-500/10 border border-sky-500/20 p-2 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300 flex items-center gap-1">
          <MessageSquareQuote size={11} /> Cómo podrías responder
        </div>
        <p className="leading-snug text-slate-100 select-text">{busy ? 'Generando…' : q.suggestedAnswer}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <button type="button" onClick={() => copy(q.suggestedAnswer)} className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center gap-1 text-[11px] cursor-pointer">
            <Copy size={11} /> Copiar
          </button>
          {canSay && (
            <button type="button" onClick={onSay} className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[11px] cursor-pointer" title="Se traduce y se dice con tu voz por el micrófono virtual">
              <Volume2 size={11} /> Decir con mi voz
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => onRegenerate('breve')} className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] disabled:opacity-50 cursor-pointer">
            Más breve
          </button>
          <button type="button" disabled={busy} onClick={() => onRegenerate('detallada')} className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] disabled:opacity-50 cursor-pointer">
            Más detallada
          </button>
          {busy && <Loader2 size={12} className="animate-spin text-sky-300" />}
        </div>
      </div>
    )}
  </div>
);

/**
 * Análisis de la conversación: resumen, puntos clave, las preguntas que te hicieron con una respuesta sugerida
 * (basada en tu contexto), pendientes, acciones y alertas. Es la ayuda para responder con claridad.
 */
export const AnalysisView: React.FC<AnalysisViewProps> = ({ kind, settings, notes, getTranscript, onSayAnswer, onGoToContext }) => {
  const { state } = useContextStore();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ at: Date; parts: number; truncated: boolean } | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const aiReady = isAiReady(settings);
  const contextBlock = buildContextBlock(state, notes);
  const contextCount = contextBlock.parts.filter((p) => !p.missing && p.chars > 0).length;

  const run = async () => {
    setLoading(true);
    setError('');
    const res = await analyzeConversation({
      transcript: getTranscript(),
      context: contextBlock.text,
      kind,
      settings,
      contextParts: contextCount,
      contextTruncated: contextBlock.truncated
    });
    setLoading(false);
    if (!res.success || !res.analysis) {
      setError(res.error || 'No se pudo analizar.');
      return;
    }
    setAnalysis(res.analysis);
    setMeta({ at: new Date(), parts: contextCount, truncated: contextBlock.truncated });
  };

  const regenerate = async (index: number, style: 'breve' | 'detallada') => {
    if (!analysis) return;
    setBusyIdx(index);
    const res = await suggestAnswer({
      question: analysis.questions[index].question,
      transcript: getTranscript(),
      context: contextBlock.text,
      settings,
      style
    });
    setBusyIdx(null);
    if (res.success && res.answer) {
      setAnalysis({ ...analysis, questions: analysis.questions.map((q, i) => (i === index ? { ...q, suggestedAnswer: res.answer as string } : q)) });
    } else {
      setError(res.error || 'No se pudo generar otra versión.');
    }
  };

  const pendingQs = analysis ? analysis.questions.filter((q) => !q.answered) : [];
  const answeredQs = analysis ? analysis.questions.filter((q) => q.answered) : [];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={loading || !aiReady}
          title={aiReady ? '' : 'Configura la IA en Ajustes → IA'}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          {loading ? 'Analizando…' : analysis ? 'Actualizar análisis' : kind === 'interview' ? 'Analizar la entrevista' : 'Analizar la reunión'}
        </button>
        {meta && (
          <span className="text-[11px] text-slate-500">
            Analizado a las {meta.at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            {meta.parts > 0 ? `usó ${meta.parts} documento${meta.parts === 1 ? '' : 's'} de contexto` : 'sin contexto'}
          </span>
        )}
      </div>

      {contextCount === 0 && (
        <button
          type="button"
          onClick={onGoToContext}
          className="w-full text-left px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 leading-snug cursor-pointer hover:bg-amber-500/15"
        >
          💡 <b>Sin contexto cargado:</b> las respuestas serán generales. Carga tu CV o tus proyectos en la pestaña <b>Contexto</b> para respuestas basadas en lo que
          realmente has hecho.
        </button>
      )}
      {meta?.truncated && <div className="text-[11px] text-amber-300">⚠ Parte del contexto no cupo y se envió recortada.</div>}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 leading-snug flex items-start gap-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="px-4 py-6 rounded-xl border border-dashed border-slate-700 text-center text-slate-500 leading-snug">
          <Sparkles size={22} className="mx-auto mb-2 text-slate-600" />
          Pulsa el botón durante o después de la conversación para obtener: <b>puntos clave</b>, <b>las preguntas que te hicieron con una respuesta sugerida</b>,
          lo que <b>quedó pendiente</b>, <b>acciones</b> y <b>alertas</b>.
        </div>
      )}

      {analysis?.rawFallback && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          <div className="text-[11px] text-amber-300 font-semibold">La IA respondió en texto libre (no en el formato esperado). Esto es lo que dijo:</div>
          <p className="whitespace-pre-wrap leading-snug select-text text-slate-200">{analysis.summary}</p>
        </div>
      )}

      {analysis && !analysis.rawFallback && (
        <div className="space-y-2.5">
          {analysis.summary && (
            <Section title="Resumen" Icon={Sparkles} tone="text-violet-300">
              <p className="leading-snug select-text">{analysis.summary}</p>
            </Section>
          )}

          {analysis.keyPoints.length > 0 && (
            <Section title="Puntos clave" Icon={ListChecks} tone="text-sky-300">
              <Bullets items={analysis.keyPoints} />
            </Section>
          )}

          {pendingQs.length > 0 && (
            <Section title={`Preguntas por responder (${pendingQs.length})`} Icon={HelpCircle} tone="text-amber-300">
              <div className="space-y-2">
                {pendingQs.map((q) => {
                  const idx = analysis.questions.indexOf(q);
                  return (
                    <QuestionCard
                      key={idx}
                      q={q}
                      busy={busyIdx === idx}
                      canSay={Boolean(onSayAnswer)}
                      onRegenerate={(style) => regenerate(idx, style)}
                      onSay={() => onSayAnswer?.(q.suggestedAnswer)}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {answeredQs.length > 0 && (
            <Section title={`Preguntas ya respondidas (${answeredQs.length})`} Icon={CheckCircle2} tone="text-emerald-300">
              <div className="space-y-2">
                {answeredQs.map((q) => {
                  const idx = analysis.questions.indexOf(q);
                  return (
                    <QuestionCard
                      key={idx}
                      q={q}
                      busy={busyIdx === idx}
                      canSay={Boolean(onSayAnswer)}
                      onRegenerate={(style) => regenerate(idx, style)}
                      onSay={() => onSayAnswer?.(q.suggestedAnswer)}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {analysis.pending.length > 0 && (
            <Section title="Quedó pendiente" Icon={Clock} tone="text-amber-300">
              <Bullets items={analysis.pending} />
            </Section>
          )}

          {analysis.actionItems.length > 0 && (
            <Section title="Acciones y compromisos" Icon={CheckSquare} tone="text-emerald-300">
              <ul className="space-y-1.5">
                {analysis.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 leading-snug">
                    <input type="checkbox" className="mt-0.5 accent-emerald-500" />
                    <span className="flex-1 select-text">
                      {a.task}
                      {(a.owner || a.due) && (
                        <span className="text-slate-500">
                          {' '}
                          — {[a.owner, a.due].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {analysis.watchOuts.length > 0 && (
            <Section title="Cuidado con" Icon={AlertTriangle} tone="text-red-300">
              <Bullets items={analysis.watchOuts} />
            </Section>
          )}

          {analysis.followUps.length > 0 && (
            <Section title="Preguntas que puedes hacer" Icon={Lightbulb} tone="text-yellow-300">
              <Bullets items={analysis.followUps} onCopy />
            </Section>
          )}
        </div>
      )}
    </div>
  );
};
