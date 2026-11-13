import {
  hashPassword, verifyPassword, newId, newToken, sha256, normalizeEmail, isEmail, passwordProblem, createLimiter,
} from '../security.js';

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

export async function authRoutes(app, { config, db, mailer }) {
  const authLimiter = createLimiter(30, 15 * 60 * 1000); // por IP, todas las rutas de cuenta
  const loginFails = createLimiter(5, 15 * 60 * 1000); // por IP+correo (solo cuenta los fallos)
  const DUMMY_HASH = await hashPassword('no-existe'); // "usuario inexistente" tarda igual que "clave mala"

  const publicUser = (u) => ({ id: u.id, email: u.email, isAdmin: Boolean(u.is_admin) });

  function createSession(userId, device) {
    const token = newToken();
    db.prepare('INSERT INTO sessions (id, user_id, token_hash, device, created_at, expires_at) VALUES (?,?,?,?,?,?)').run(
      newId(), userId, sha256(token), String(device || '').slice(0, 80), iso(Date.now()), iso(Date.now() + config.sessionDays * DAY),
    );
    return token;
  }

  function findInvite(token) {
    if (!token) return null;
    const inv = db.prepare('SELECT * FROM invites WHERE token_hash = ?').get(sha256(token));
    if (!inv || inv.used_at || inv.revoked_at || inv.expires_at <= iso(Date.now())) return null;
    return inv;
  }

  async function sendLink(user, kind, ttlMs, urlPath, subject, intro) {
    const token = newToken();
    db.prepare('INSERT INTO tokens (id, user_id, kind, token_hash, expires_at) VALUES (?,?,?,?,?)').run(
      newId(), user.id, kind, sha256(token), iso(Date.now() + ttlMs),
    );
    return mailer.send({
      to: user.email,
      subject,
      text: `${intro}\n\n${config.publicUrl}/${urlPath}/${token}\n\nSi no fuiste tú, ignora este mensaje.`,
    });
  }

  const tooMany = (reply) => reply.code(429).send({ error: 'Demasiados intentos, espera unos minutos' });

  app.post('/api/auth/register', async (req, reply) => {
    if (!authLimiter.hit(`reg:${req.ip}`)) return tooMany(reply);
    const { email: rawEmail, password, inviteToken, device } = req.body || {};
    const email = normalizeEmail(rawEmail);
    if (!isEmail(email)) return reply.code(400).send({ error: 'Correo no válido' });
    const pwProblem = passwordProblem(password);
    if (pwProblem) return reply.code(400).send({ error: pwProblem });

    const isFirst = db.prepare('SELECT 1 FROM users LIMIT 1').get() === undefined;
    const invite = isFirst ? null : findInvite(inviteToken);
    if (!isFirst && !invite && config.signupMode !== 'open') {
      return reply.code(403).send({ error: config.signupMode === 'closed' ? 'El registro está cerrado' : 'Necesitas un enlace de invitación' });
    }
    if (invite?.email && invite.email !== email) return reply.code(400).send({ error: 'Esta invitación es para otro correo' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return reply.code(409).send({ error: 'Ese correo ya tiene cuenta' });

    // En modo abierto con SMTP el correo se verifica; con invitación o siendo el primer usuario ya está probado
    const needsVerify = !isFirst && !invite && mailer.enabled;
    const id = newId();
    db.prepare('INSERT INTO users (id, email, password_hash, is_admin, active, verified_at, created_at) VALUES (?,?,?,?,1,?,?)').run(
      id, email, await hashPassword(password), isFirst ? 1 : 0, needsVerify ? null : iso(Date.now()), iso(Date.now()),
    );
    if (invite) db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE id = ?').run(id, iso(Date.now()), invite.id);

    if (needsVerify) {
      await sendLink({ id, email }, 'verify', DAY, 'verify', 'Confirma tu correo en StickyFlow', 'Confirma tu correo para activar la cuenta:');
      return reply.code(201).send({ needsVerification: true });
    }
    return reply.code(201).send({ token: createSession(id, device), user: { id, email, isAdmin: isFirst } });
  });

  app.post('/api/auth/login', async (req, reply) => {
    if (!authLimiter.hit(`login:${req.ip}`)) return tooMany(reply);
    const { email: rawEmail, password, device } = req.body || {};
    const email = normalizeEmail(rawEmail);
    const key = `${req.ip}|${email}`;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = await verifyPassword(String(password ?? ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok || !user.active) {
      if (!loginFails.hit(key)) return tooMany(reply);
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos' });
    }
    if (!user.verified_at) return reply.code(403).send({ error: 'Confirma tu correo antes de entrar' });
    loginFails.reset(key);
    return { token: createSession(user.id, device), user: publicUser(user) };
  });

  app.post('/api/auth/logout', { preHandler: app.authenticate }, async (req) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.user.sessionId);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.authenticate }, async (req) => ({
    user: { id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin },
  }));

  const findToken = (kind, token) =>
    db.prepare('SELECT * FROM tokens WHERE kind = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?').get(
      kind, sha256(token || ''), iso(Date.now()),
    );

  app.post('/api/auth/verify', async (req, reply) => {
    const row = findToken('verify', req.body?.token);
    if (!row) return reply.code(400).send({ error: 'Enlace no válido o caducado' });
    db.prepare('UPDATE tokens SET used_at = ? WHERE id = ?').run(iso(Date.now()), row.id);
    db.prepare('UPDATE users SET verified_at = ? WHERE id = ?').run(iso(Date.now()), row.user_id);
    return { ok: true };
  });

  // Responde igual exista o no el correo (no revela qué correos tienen cuenta)
  app.post('/api/auth/forgot', async (req, reply) => {
    if (!authLimiter.hit(`forgot:${req.ip}`)) return tooMany(reply);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalizeEmail(req.body?.email));
    if (user && mailer.enabled) {
      await sendLink(user, 'reset', 60 * 60 * 1000, 'reset', 'Recupera tu cuenta de StickyFlow', 'Usa este enlace para elegir una contraseña nueva (válido 1 hora):');
    }
    return { ok: true };
  });

  app.post('/api/auth/reset', async (req, reply) => {
    if (!authLimiter.hit(`reset:${req.ip}`)) return tooMany(reply);
    const pwProblem = passwordProblem(req.body?.password);
    if (pwProblem) return reply.code(400).send({ error: pwProblem });
    const row = findToken('reset', req.body?.token);
    if (!row) return reply.code(400).send({ error: 'Enlace no válido o caducado' });
    db.prepare('UPDATE tokens SET used_at = ? WHERE id = ?').run(iso(Date.now()), row.id);
    db.prepare('UPDATE users SET password_hash = ?, verified_at = COALESCE(verified_at, ?) WHERE id = ?').run(
      await hashPassword(req.body.password), iso(Date.now()), row.user_id,
    );
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id); // cierra todas las sesiones
    return { ok: true };
  });

  // ---- Administración de usuarios ----
  app.get('/api/users', { preHandler: app.requireAdmin }, async () => ({
    users: db
      .prepare('SELECT id, email, is_admin, active, verified_at, created_at FROM users ORDER BY created_at')
      .all()
      .map((u) => ({
        id: u.id, email: u.email, isAdmin: Boolean(u.is_admin), active: Boolean(u.active), verified: Boolean(u.verified_at), createdAt: u.created_at,
      })),
  }));

  app.patch('/api/users/:id', { preHandler: app.requireAdmin }, async (req, reply) => {
    if (req.params.id === req.user.id) return reply.code(400).send({ error: 'No puedes desactivarte a ti mismo' });
    const active = req.body?.active ? 1 : 0;
    const r = db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, req.params.id);
    if (!r.changes) return reply.code(404).send({ error: 'Usuario no encontrado' });
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
    return { ok: true };
  });
}
