import React, { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import AuthScreen from './AuthScreen.jsx';
import NotesApp from './NotesApp.jsx';

const linkMatch = () => /^\/(invite|reset|verify)\/([^/]+)$/.exec(location.pathname);

export default function App() {
  const [state, setState] = useState({ loading: true, user: null, info: null });

  const boot = useCallback(async () => {
    let info = { signupMode: 'invite', smtp: false, hasUsers: true };
    try { info = await api('/info'); } catch { /* servidor sin responder */ }
    if (getToken() && !linkMatch()) {
      try {
        const { user } = await api('/auth/me');
        return setState({ loading: false, user, info });
      } catch { setToken(''); }
    }
    setState({ loading: false, user: null, info });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(''); setState((s) => ({ ...s, user: null })); });
    boot();
  }, [boot]);

  const onAuth = (token, user) => {
    setToken(token);
    if (linkMatch()) history.replaceState(null, '', '/');
    setState((s) => ({ ...s, user }));
  };
  const logout = async () => {
    await api('/auth/logout', 'POST').catch(() => {});
    setToken('');
    setState((s) => ({ ...s, user: null }));
  };

  if (state.loading) return <div className="splash"><div className="spinner" /></div>;
  if (!state.user) return <AuthScreen info={state.info} link={linkMatch()} onAuth={onAuth} />;
  return <NotesApp user={state.user} onLogout={logout} />;
}
