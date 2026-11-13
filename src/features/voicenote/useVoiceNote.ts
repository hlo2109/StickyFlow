import { useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings } from '../../types';
import { VoiceNoteController, VoiceNoteSnapshot } from './VoiceNoteController';

/** Conecta un VoiceNoteController con React. Siempre usa los ajustes más recientes. */
export function useVoiceNote(settings: AppSettings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const controller = useMemo(() => new VoiceNoteController(() => settingsRef.current), []);
  const [snapshot, setSnapshot] = useState<VoiceNoteSnapshot>(controller.getSnapshot());

  useEffect(() => controller.subscribe(setSnapshot), [controller]);

  // Al salir de la pantalla se corta el audio y se libera el micrófono.
  useEffect(() => {
    return () => controller.cancel();
  }, [controller]);

  return { controller, snapshot };
}
