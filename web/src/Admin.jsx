import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Copy, Link2, Mail, Shield, UserCheck, UserX } from 'lucide-react';
import { api } from './api.js';

export default function Admin({ me, onBack }) {
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [created, setCreated] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, u] = await Promise.all([api('/invites'), api('/users')]);
      setInvites(i.invites); setUsers(u.users);
    } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault(); setMsg(null); setCreated(null); setCopied(false);
    try {
      const r = await api('/invites', 'POST', { email: email.trim() || undefined });
      setCreated(r); setEmail(''); load();
    } catch (err) { setMsg(err.message); }
  };
  const copy = async () => { await navigator.clipboard.writeText(created.url).catch(() => {}); setCopied(true); };
  const act = (fn) => async () => { setMsg(null); try { await fn(); await load(); } catch (e) { setMsg(e.message); } };

  return (
    <div className="admin">
      <div className="detail-bar">
        <button className="icon-btn back" onClick={onBack}><ArrowLeft size={18} /></button>
        <h2 className="bar-title"><Shield size={17} /> Administrar</h2>
      </div>
      <div className="admin-body">
        {msg && <p className="notice err">{msg}</p>}

        <section className="panel">
          <h3><Link2 size={16} /> Invitar a alguien</h3>
          <p className="muted small">Crea un enlace de un solo uso. Si escribes un correo, también se le envía la invitación.</p>
          <form className="row-form" onSubmit={invite}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com (opcional)" />
            <button className="btn primary">Crear invitación</button>
          </form>
          {created && (
            <div className="created">
              <code>{created.url}</code>
              <button className="btn" onClick={copy}><Copy size={15} /> {copied ? 'Copiado' : 'Copiar'}</button>
              {created.email && <span className="muted small"><Mail size={13} /> {created.emailSent ? 'Enviada por correo' : 'No se pudo enviar el correo: comparte el enlace tú mismo'}</span>}
              <span className="muted small">Este enlace solo se muestra ahora.</span>
            </div>
          )}
        </section>

        <section className="panel">
          <h3>Invitaciones</h3>
          {invites.length === 0 && <p className="muted small">Todavía no hay invitaciones.</p>}
          {invites.map((i) => (
            <div className="line" key={i.id}>
              <span>{i.email || 'Sin correo'} {i.usedBy && <span className="muted">· {i.usedBy}</span>}</span>
              <span className={'pill ' + i.status}>{i.status}</span>
              {i.status === 'pendiente' && <button className="btn small" onClick={act(() => api('/invites/' + i.id, 'DELETE'))}>Revocar</button>}
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>Usuarios</h3>
          {users.map((u) => (
            <div className="line" key={u.id}>
              <span>{u.email} {u.isAdmin && <span className="pill is-admin">admin</span>}</span>
              {!u.active && <span className="pill revocada">desactivado</span>}
              {u.id !== me.id && (
                <button className="btn small" onClick={act(() => api('/users/' + u.id, 'PATCH', { active: !u.active }))}>
                  {u.active ? <><UserX size={14} /> Desactivar</> : <><UserCheck size={14} /> Activar</>}
                </button>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
