import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { SyncStatus } from '../types';

function ago(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (Number.isNaN(s)) return '';
  if (s < 10) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

/** Qué mostrar según el estado de la sincronización con el servidor propio. */
export function describeSync(st: SyncStatus | null, nowMs: number): { label: string; title: string; tone: 'off' | 'ok' | 'busy' | 'warn' | 'bad' } {
  if (!st || !st.configured) {
    return { label: 'Sin servidor', title: 'No estás sincronizando con un servidor. Haz clic para conectarlo (Ajustes → Servidor propio).', tone: 'off' };
  }
  const where = `${st.email} · ${st.serverUrl}`;
  switch (st.phase) {
    case 'pending':
      return { label: 'Por sincronizar…', title: `Hay cambios que se enviarán en unos segundos\n${where}`, tone: 'busy' };
    case 'syncing':
      return { label: 'Sincronizando…', title: `Sincronizando con tu servidor\n${where}`, tone: 'busy' };
    case 'offline':
      return { label: 'Sin conexión', title: `${st.error || 'Sin conexión con el servidor'}\n${where}`, tone: 'warn' };
    case 'auth':
      return { label: 'Reconectar', title: `${st.error}\nHaz clic para abrir Ajustes → Servidor propio`, tone: 'bad' };
    case 'error':
      return { label: 'Error', title: `${st.error || 'Error al sincronizar'}\n${where}`, tone: 'bad' };
    default:
      return {
        label: st.lastSyncAt ? `Sincronizado ${ago(st.lastSyncAt, nowMs)}` : 'Conectado',
        title: `Notas sincronizadas con tu servidor${st.lastSyncAt ? ` (${ago(st.lastSyncAt, nowMs)})` : ''}\n${where}`,
        tone: 'ok',
      };
  }
}

const TONE: Record<string, string> = {
  off: 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800',
  ok: 'text-emerald-600 hover:bg-emerald-500/10',
  busy: 'text-sky-600 hover:bg-sky-500/10',
  warn: 'text-amber-600 hover:bg-amber-500/10',
  bad: 'text-red-600 hover:bg-red-500/10',
};

/**
 * Indicador de sincronización con el servidor propio. Aparece en la lista de notas y en cada nota;
 * al hacer clic abre Ajustes (pestaña del servidor). Sin Electron (web/pruebas) no se muestra.
 */
export const SyncBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [now, setNow] = useState(Date.now());
  const available = Boolean(window.electronAPI?.syncStatus);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    window.electronAPI?.syncStatus?.().then((s) => alive && setStatus(s));
    const off = window.electronAPI?.onSyncStatus?.((s) => alive && setStatus(s));
    const t = setInterval(() => setNow(Date.now()), 15000); // refresca el «hace X min»
    return () => {
      alive = false;
      off?.();
      clearInterval(t);
    };
  }, [available]);

  if (!available) return null;
  const d = describeSync(status, now);
  const Icon = d.tone === 'off' ? CloudOff : d.tone === 'ok' ? CloudCheck : d.tone === 'busy' ? (status?.phase === 'pending' ? Cloud : Loader2) : d.tone === 'warn' ? CloudOff : AlertTriangle;

  return (
    <button
      type="button"
      onClick={() => window.electronAPI?.openSettingsWindow?.()}
      title={d.title}
      className={`flex items-center gap-1 rounded-md cursor-pointer transition-colors ${compact ? 'p-1' : 'px-1.5 py-1 text-[10px] font-medium'} ${TONE[d.tone]}`}
    >
      <Icon size={compact ? 15 : 13} className={status?.phase === 'syncing' ? 'animate-spin' : ''} />
      {!compact && <span className="hidden min-[400px]:inline whitespace-nowrap">{d.label}</span>}
    </button>
  );
};
