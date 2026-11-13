import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, KeyRound, Loader2, LogOut, RefreshCw, Server, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SyncReply, SyncStatus } from '../../../types';

const inputCls =
  'w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold disabled:opacity-60';
const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60';

const PHASE: Record<SyncStatus['phase'], { text: string; cls: string }> = {
  idle: { text: 'Al día', cls: 'text-emerald-600' },
  syncing: { text: 'Sincronizando…', cls: 'text-cyan-600' },
  offline: { text: 'Sin conexión (se reintentará)', cls: 'text-amber-600' },
  auth: { text: 'Hay que volver a conectar', cls: 'text-red-600' },
  error: { text: 'Error al sincronizar', cls: 'text-red-600' },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Conexión con un StickyFlow Server propio. Es independiente del formulario de Ajustes: habla con el proceso principal,
 * que guarda el token cifrado; aquí nunca se ve ni se guarda.
 */
export const ServerTab: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [useToken, setUseToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    window.electronAPI?.syncStatus?.().then((s) => alive && s && setStatus(s));
    const off = window.electronAPI?.onSyncStatus?.((s) => alive && setStatus(s));
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  const run = async (fn: () => Promise<SyncReply | undefined>) => {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      if (r && r.ok === false) setError(r.error);
      else if (r && r.ok === true) setStatus(r.status);
    } finally {
      setBusy(false);
    }
  };

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = useToken
        ? await window.electronAPI?.syncConnectToken?.({ serverUrl, token })
        : await window.electronAPI?.syncConnect?.({ serverUrl, email, password });
      if (r?.ok) {
        setPassword('');
        setToken('');
      }
      return r;
    });
  };

  const connected = status?.configured;
  const phase = status ? PHASE[status.phase] : null;

  return (
    <div className="space-y-3 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Server size={16} className="text-cyan-500" />
          Servidor propio
        </h4>
        <p className="text-[11px] text-slate-500">
          Sincroniza tus notas entre tus dispositivos y la web con tu propio StickyFlow Server. Es opcional: sin servidor todo sigue funcionando en este equipo.
        </p>
      </div>

      <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-[11px] text-emerald-800 dark:text-emerald-200 flex gap-2">
        <ShieldCheck size={15} className="shrink-0 mt-0.5" />
        <span>
          Tus notas son <b>privadas de tu cuenta</b>: cada usuario solo ve las suyas, también el administrador del servidor. Aquí se guarda solo un token de acceso, cifrado con la seguridad de Windows.
        </span>
      </div>

      {connected && status ? (
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{status.email}</span>
              <span className="block text-[11px] text-slate-500 truncate">{status.serverUrl}</span>
            </div>
            {phase && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold shrink-0 ${phase.cls}`}>
                {status.phase === 'syncing' ? <Loader2 size={13} className="animate-spin" /> : status.phase === 'idle' ? <CheckCircle2 size={13} /> : status.phase === 'offline' ? <CloudOff size={13} /> : <TriangleAlert size={13} />}
                {phase.text}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">Última sincronización: {status.lastSyncAt ? formatWhen(status.lastSyncAt) : 'aún no'}</div>
          {status.error && <div className="text-[11px] text-red-600">{status.error}</div>}
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={busy || status.phase === 'syncing'} onClick={() => run(() => window.electronAPI?.syncNow?.() as Promise<SyncReply>)}>
              <RefreshCw size={13} /> Sincronizar ahora
            </button>
            <button
              className={btnGhost}
              disabled={busy}
              onClick={() => window.confirm('¿Desconectar este equipo del servidor? Tus notas se quedan aquí y en el servidor.') && run(() => window.electronAPI?.syncDisconnect?.() as Promise<SyncReply>)}
            >
              <LogOut size={13} /> Desconectar
            </button>
          </div>
          {status.phase === 'auth' && (
            <div className="text-[11px] text-slate-500">Desconecta y vuelve a conectar con tu correo y contraseña (o un token nuevo).</div>
          )}
        </div>
      ) : (
        <form onSubmit={connect} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2.5">
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">Dirección del servidor</span>
            <input className={inputCls} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://notas.tu-dominio.com" autoComplete="off" required />
          </label>

          {useToken ? (
            <label className="block">
              <span className="block text-[11px] text-slate-500 mb-1">Token de acceso (se crea en la web: Dispositivos)</span>
              <input className={inputCls} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="block text-[11px] text-slate-500 mb-1">Correo</span>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
              </label>
              <label className="block">
                <span className="block text-[11px] text-slate-500 mb-1">Contraseña</span>
                <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
            </>
          )}

          {error && <div className="text-[11px] text-red-600">{error}</div>}
          <div className="flex items-center justify-between gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Server size={13} />} Conectar
            </button>
            <button type="button" className="text-[11px] text-cyan-600 hover:underline flex items-center gap-1" onClick={() => { setUseToken(!useToken); setError(''); }}>
              <KeyRound size={12} /> {useToken ? 'Usar correo y contraseña' : 'Usar un token de acceso'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Al conectar se unen tus notas de aquí con las del servidor (no se borra nada). Para crear tu cuenta pide una invitación al administrador de tu servidor.
          </p>
        </form>
      )}
    </div>
  );
};
