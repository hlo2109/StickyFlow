// Página de administración: entrar, registrarse (invitación), recuperar contraseña, invitar y ver usuarios.
// Todo el texto del servidor se inserta con textContent (nunca innerHTML).
(() => {
  const view = document.getElementById('view');
  const msgEl = document.getElementById('msg');
  const KEY = 'sf_token';
  let token = localStorage.getItem(KEY) || '';

  const say = (text, kind = '') => { msgEl.textContent = text || ''; msgEl.className = 'msg ' + kind; };
  const h = (tag, props = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };
  const field = (label, id, type = 'text', extra = {}) => [h('label', { for: id }, label), h('input', { id, type, ...extra })];
  const val = (id) => document.getElementById(id).value.trim();
  const show = (...nodes) => { view.replaceChildren(...nodes); };

  async function api(path, method = 'GET', body) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
    return data;
  }
  const run = (fn) => async () => { say(''); try { await fn(); } catch (e) { say(e.message, 'err'); } };

  function loginView(info) {
    const card = h('div', { class: 'card' },
      h('h2', {}, info.hasUsers ? 'Entrar' : 'Crear la cuenta de administrador'),
      field('Correo', 'email', 'email', { autocomplete: 'username' }),
      field('Contraseña', 'pw', 'password', { autocomplete: info.hasUsers ? 'current-password' : 'new-password' }),
      h('button', { onclick: run(async () => {
        const path = info.hasUsers ? '/auth/login' : '/auth/register';
        const r = await api(path, 'POST', { email: val('email'), password: document.getElementById('pw').value, device: 'web' });
        token = r.token; localStorage.setItem(KEY, token); start();
      }) }, info.hasUsers ? 'Entrar' : 'Crear cuenta'),
    );
    const extra = [];
    if (info.hasUsers) {
      extra.push(h('button', { class: 'ghost', onclick: run(async () => {
        await api('/auth/forgot', 'POST', { email: val('email') });
        say(info.smtp ? 'Si el correo existe, te enviamos un enlace.' : 'El servidor no tiene SMTP: pide a un administrador que cambie la clave.', 'ok');
      }) }, 'Olvidé mi contraseña'));
    }
    show(card, ...extra);
  }

  function tokenView(kind, tok) {
    if (kind === 'invite') {
      api('/invites/check/' + encodeURIComponent(tok)).then((c) => {
        if (!c.valid) return show(h('div', { class: 'card' }, 'Esta invitación no es válida o ya caducó.'));
        show(h('div', { class: 'card' }, h('h2', {}, 'Crea tu cuenta'),
          field('Correo', 'email', 'email', c.email ? { value: c.email, readonly: 'readonly' } : {}),
          field('Contraseña (mín. 8)', 'pw', 'password', { autocomplete: 'new-password' }),
          h('button', { onclick: run(async () => {
            const r = await api('/auth/register', 'POST', { email: val('email'), password: document.getElementById('pw').value, inviteToken: tok, device: 'web' });
            token = r.token; localStorage.setItem(KEY, token); history.replaceState(null, '', '/'); start();
          }) }, 'Crear cuenta')));
      });
    } else if (kind === 'reset') {
      show(h('div', { class: 'card' }, h('h2', {}, 'Nueva contraseña'),
        field('Contraseña (mín. 8)', 'pw', 'password', { autocomplete: 'new-password' }),
        h('button', { onclick: run(async () => {
          await api('/auth/reset', 'POST', { token: tok, password: document.getElementById('pw').value });
          history.replaceState(null, '', '/'); say('Contraseña cambiada. Ya puedes entrar.', 'ok'); start();
        }) }, 'Guardar')));
    } else {
      api('/auth/verify', 'POST', { token: tok }).then(() => { history.replaceState(null, '', '/'); say('Correo confirmado. Ya puedes entrar.', 'ok'); start(); })
        .catch((e) => say(e.message, 'err'));
    }
  }

  async function adminView(me) {
    const out = [h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', {}, 'Sesión: ' + me.email + (me.isAdmin ? ' (administrador)' : '')),
      h('button', { class: 'ghost small', onclick: run(async () => { await api('/auth/logout', 'POST').catch(() => {}); localStorage.removeItem(KEY); token = ''; start(); }) }, 'Salir')))];
    if (!me.isAdmin) { out.push(h('div', { class: 'card mut' }, 'Tus notas se sincronizan desde la app de escritorio.')); return show(...out); }

    const list = h('div', {});
    const users = h('div', {});
    const link = h('p', { class: 'mut' });
    async function refresh() {
      const [inv, usr] = await Promise.all([api('/invites'), api('/users')]);
      list.replaceChildren(...(inv.invites.length ? inv.invites.map((i) => h('div', { class: 'row' },
        h('span', {}, (i.email || 'sin correo') + ' · ' + i.status + (i.usedBy ? ' (' + i.usedBy + ')' : '')),
        i.status === 'pendiente' ? h('button', { class: 'ghost small', onclick: run(async () => { await api('/invites/' + i.id, 'DELETE'); refresh(); }) }, 'Revocar') : null))
        : [h('div', { class: 'mut' }, 'Aún no hay invitaciones.')]));
      users.replaceChildren(...usr.users.map((u) => h('div', { class: 'row' },
        h('span', {}, u.email + (u.isAdmin ? ' · admin' : '') + (u.active ? '' : ' · desactivado')),
        u.id === me.id ? null : h('button', { class: 'ghost small', onclick: run(async () => { await api('/users/' + u.id, 'PATCH', { active: !u.active }); refresh(); }) }, u.active ? 'Desactivar' : 'Activar'))));
    }
    out.push(h('div', { class: 'card' }, h('h2', {}, 'Invitar a alguien'),
      field('Correo (opcional: si lo pones, se le envía por correo)', 'inv-email', 'email'),
      h('button', { onclick: run(async () => {
        const r = await api('/invites', 'POST', { email: val('inv-email') || undefined });
        link.replaceChildren('Enlace (se muestra solo ahora' + (r.emailSent ? ', y se envió por correo' : '') + '): ', h('code', {}, r.url));
        refresh();
      }) }, 'Crear enlace'), link, h('h2', {}, 'Invitaciones'), list),
      h('div', { class: 'card' }, h('h2', {}, 'Usuarios'), users));
    show(...out);
    refresh().catch((e) => say(e.message, 'err'));
  }

  async function start() {
    const m = /^\/(invite|reset|verify)\/([^/]+)$/.exec(location.pathname);
    if (m) return tokenView(m[1], decodeURIComponent(m[2]));
    try {
      if (token) { const { user } = await api('/auth/me'); return adminView(user); }
    } catch { localStorage.removeItem(KEY); token = ''; }
    loginView(await api('/info'));
  }
  start().catch((e) => say(e.message, 'err'));
})();
