import { useEffect, useState } from 'react';
import { contextStore, ContextState } from './contextStore';

/** Estado de la biblioteca de contexto, siempre al día en cualquier pantalla. */
export function useContextStore() {
  const [state, setState] = useState<ContextState>(contextStore.getState());
  useEffect(() => contextStore.subscribe(setState), []);
  return { state, store: contextStore };
}
