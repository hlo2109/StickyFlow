import React, { useEffect, useMemo, useRef } from 'react';
import { Headphones } from 'lucide-react';
import { parseTranscript } from './parseTranscript';

interface ConversationFeedProps {
  /** Transcripción con líneas «[Tú] …» y «[Participante] …» */
  text: string;
  isRecording: boolean;
}

/** La conversación, lado a lado: lo tuyo a la derecha, lo de los demás a la izquierda. */
export const ConversationFeed: React.FC<ConversationFeedProps> = ({ text, isRecording }) => {
  const bubbles = useMemo(() => parseTranscript(text), [text]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles.length]);

  if (bubbles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-2 px-8">
        <Headphones size={30} className="text-slate-600" />
        <p className="text-sm font-medium text-slate-400">{isRecording ? 'Escuchando…' : 'La conversación aparecerá aquí'}</p>
        <p className="text-xs max-w-sm leading-snug">
          {isRecording
            ? 'Cada frase se transcribe en cuanto termina, separando lo que dices tú de lo que dicen los demás.'
            : 'Pulsa «Iniciar» para grabar. Se captura el audio de la reunión y tu micrófono por separado.'}
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="h-full overflow-y-auto px-4 py-3 space-y-2">
      {bubbles.map((b, i) =>
        b.who === 'plain' ? (
          <div key={i} className="text-xs text-slate-400 leading-snug select-text px-2">
            {b.text}
          </div>
        ) : (
          <div key={i} className={`flex ${b.who === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-snug select-text ${
                b.who === 'me' ? 'bg-indigo-600/90 text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm'
              }`}
            >
              <div className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${b.who === 'me' ? 'text-indigo-200' : 'text-sky-400'}`}>
                {b.who === 'me' ? 'Tú' : 'Participante'}
              </div>
              {b.text}
            </div>
          </div>
        )
      )}
    </div>
  );
};
