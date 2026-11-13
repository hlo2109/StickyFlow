import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Copy, KeyRound, MonitorSmartphone, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from './api.js';

const when = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Account({ me, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [name, setName] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { setSessions((await api('/sessions')).sessions); } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault(); setMsg(null); setCopied(false);
    try { setCreated(await api('/sessions', 'POST', { name })); setName(''); load(); } catch (err) { setMsg(err.message); }
  };
  const revoke = async (s) => {
    if (!window.confirm(`¿Revocar «${s.device}»? Ese dispositivo dejará de sincronizar.`)) return;
    try { await api('/sessions/' + s.id, 'DELETE'); if (created?.id === s.id) setCreated(null); load(); } catch (err) { setMsg(err.message); }
  };
  const copy = async () => { await navigator.clipboard.writeText(created.token).catch(() => {}); setCopied(true); };

  return (
    <div className="admin">
      <div className="detail-bar">
        <button className="icon-btn back" onClick={onBack}><ArrowLeft size={18} /></button>
        <h2 className="bar-title"><MonitorSmartphone size={17} /> Mi cuenta y dispositivos</h2>
      </div>
      <div className="admin-body">
        {msg && <p className="notice err">{msg}</p>}

        <section className="panel">
          <h3><ShieldCheck size={16} /> {me.email}</h3>
          <p className="muted small">Tus notas son privadas de esta cuenta: ningún otro usuario las ve, ni siquiera el administrador del servidor. Cada dispositivo que conectas tiene su propio acceso y puedes quitarlo cuando quieras.</p>
        </section>

        <section className="panel">
          <h3><KeyRound size={16} /> Conectar la app de escritorio</h3>
          <p className="muted small">
            En la app: <b>Ajustes → Servidor propio</b>. Escribe la dirección de este servidor y entra con tu correo y contraseña; no necesitas nada más.
            Si prefieres usar un token, créalo aquí y pégalo en la app.
          </p>
          <form className="row-form" onSubmit={create}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del dispositivo (ej. Mi PC)" maxLength={80} required />
            <button className="btn primary">Crear token</button>
          </form>
          {created && (
            <div className="created">
              <code>{created.token}</code>
              <button className="btn" onClick={copy}><Copy size={15} /> {copied ? 'Copiado' : 'Copiar'}</button>
              <span className="muted small">Cópialo ahora: por seguridad no se vuelve a mostrar. Si lo pierdes, revócalo y crea otro.</span>
            </div>
          )}
        </section>

        <section className="panel">
          <h3>Dispositivos con acceso</h3>
          {sessions.map((s) => (
            <div className="line" key={s.id}>
              <span>{s.device} <span className="muted">· desde {when(s.createdAt)}</span> {s.current && <span className="pill usada">este navegador</span>}</span>
              {!s.current && <button className="btn small" onClick={() => revoke(s)}><Trash2 size={14} /> Revocar</button>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
