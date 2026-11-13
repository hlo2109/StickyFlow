import { useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings } from '../../types';
import { InterviewSession, InterviewSnapshot } from './session';

/** Conecta una InterviewSession con React. Siempre usa los ajustes más recientes. */
export function useInterviewSession(settings: AppSettings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const session = useMemo(() => new InterviewSession(() => settingsRef.current), []);
  const [snapshot, setSnapshot] = useState<InterviewSnapshot>(session.getSnapshot());

  useEffect(() => session.subscribe(setSnapshot), [session]);

  // Al cerrar la pantalla se libera el micrófono y el audio del sistema.
  useEffect(() => {
    return () => {
      void session.stop();
      session.silence();
    };
  }, [session]);

  return { session, snapshot };
}
