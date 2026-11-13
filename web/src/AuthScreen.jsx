import React, { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { api } from './api.js';

function Shell({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark"><StickyNote size={20} /></span> StickyFlow</div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export default function AuthScreen({ info, link, onAuth }) {
  const kind = link?.[1];
  const tok = link ? decodeURIComponent(link[2]) : '';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null); // {text, ok}
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState('login'); // login | register | forgot

  useEffect(() => {
    if (kind === 'invite') {
      api('/invites/check/' + encodeURIComponent(tok)).then((c) => { setInvite(c); if (c.email) setEmail(c.email); }).catch(() => setInvite({ valid: false }));
    }
    if (kind === 'verify') {
      api('/auth/verify', 'POST', { token: tok })
        .then(() => setMsg({ text: 'Correo confirmado. Ya puedes entrar.', ok: true }))
        .catch((e) => setMsg({ text: e.message }))
        .finally(() => setDone(true));
    }
  }, [kind, tok]);

  const go = (fn) => async (e) => {
    e?.preventDefault();
    setMsg(null); setBusy(true);
    try { await fn(); } catch (err) { setMsg({ text: err.message }); } finally { setBusy(false); }
  };
  const goHome = () => { history.replaceState(null, '', '/'); location.reload(); };

  const note = msg && <p className={'notice ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</p>;

  if (kind === 'verify') {
    return <Shell title="Confirmar correo">{note}{done && <button className="btn primary block" onClick={goHome}>Ir a entrar</button>}</Shell>;
  }

  if (kind === 'reset') {
    return (
      <Shell title="Nueva contraseña" subtitle="Elige una contraseña nueva para tu cuenta.">
        <form onSubmit={go(async () => {
          await api('/auth/reset', 'POST', { token: tok, password: pw });
          setMsg({ text: 'Contraseña cambiada. Ya puedes entrar.', ok: true }); setDone(true);
        })}>
          <Field label="Contraseña (mínimo 8)" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required minLength={8} />
          {note}
          {done ? <button type="button" className="btn primary block" onClick={goHome}>Ir a entrar</button>
            : <button className="btn primary block" disabled={busy}>Guardar contraseña</button>}
        </form>
      </Shell>
    );
  }

  if (kind === 'invite') {
    if (!invite) return <Shell title="Invitación"><div className="spinner" /></Shell>;
    if (!invite.valid) return <Shell title="Invitación no válida" subtitle="El enlace ya se usó, caducó o fue revocado. Pide uno nuevo a quien te invitó." />;
    return (
      <Shell title="Crea tu cuenta" subtitle="Te invitaron a este espacio de notas.">
        <form onSubmit={go(async () => {
          const r = await api('/auth/register', 'POST', { email, password: pw, inviteToken: tok, device: 'web' });
          onAuth(r.token, r.user);
        })}>
          <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={Boolean(invite.email)} autoComplete="username" required />
          <Field label="Contraseña (mínimo 8)" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required minLength={8} />
          {note}
          <button className="btn primary block" disabled={busy}>Crear cuenta</button>
        </form>
      </Shell>
    );
  }

  const first = !info.hasUsers;
  const canSignup = !first && info.signupMode === 'open';
  const current = first ? 'register' : mode;

  return (
    <Shell
      title={first ? 'Bienvenido' : current === 'login' ? 'Entrar' : current === 'register' ? 'Crear cuenta' : 'Recuperar contraseña'}
      subtitle={first ? 'Crea la cuenta de administrador de tu servidor.' : current === 'forgot' ? 'Te enviaremos un enlace al correo.' : 'Tus notas, en tu propio servidor.'}
    >
      <form onSubmit={go(async () => {
        if (current === 'forgot') {
          await api('/auth/forgot', 'POST', { email });
          return setMsg({ text: info.smtp ? 'Si el correo existe, te enviamos un enlace.' : 'Este servidor no tiene correo configurado; pide a un administrador que lo restablezca.', ok: true });
        }
        const r = await api(current === 'login' ? '/auth/login' : '/auth/register', 'POST', { email, password: pw, device: 'web' });
        if (r.needsVerification) return setMsg({ text: 'Revisa tu correo para confirmar la cuenta.', ok: true });
        onAuth(r.token, r.user);
      })}>
        <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        {current !== 'forgot' && (
          <Field label={current === 'register' ? 'Contraseña (mínimo 8)' : 'Contraseña'} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={current === 'login' ? 'current-password' : 'new-password'} required minLength={current === 'register' ? 8 : undefined} />
        )}
        {note}
        <button className="btn primary block" disabled={busy}>{current === 'login' ? 'Entrar' : current === 'register' ? 'Crear cuenta' : 'Enviar enlace'}</button>
      </form>
      {!first && (
        <div className="auth-links">
          {current !== 'login' && <button className="link" onClick={() => { setMode('login'); setMsg(null); }}>Volver a entrar</button>}
          {current === 'login' && <button className="link" onClick={() => { setMode('forgot'); setMsg(null); }}>Olvidé mi contraseña</button>}
          {current === 'login' && canSignup && <button className="link" onClick={() => { setMode('register'); setMsg(null); }}>Crear cuenta</button>}
        </div>
      )}
      {!first && !canSignup && current === 'login' && <p className="muted small">El registro es solo por invitación.</p>}
    </Shell>
  );
}
