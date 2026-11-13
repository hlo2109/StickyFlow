import { newId, newToken, sha256, normalizeEmail, isEmail } from '../security.js';

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

export async function inviteRoutes(app, { config, db, mailer }) {
  // Crear invitación (administrador): enlace de un solo uso; si trae correo, también se envía por SMTP
  app.post('/api/invites', { preHandler: app.requireAdmin }, async (req, reply) => {
    const raw = req.body?.email;
    const email = raw ? normalizeEmail(raw) : null;
    if (email && !isEmail(email)) return reply.code(400).send({ error: 'Correo no válido' });
    if (email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return reply.code(409).send({ error: 'Ese correo ya tiene cuenta' });
    }
    const token = newToken();
    const id = newId();
    const expiresAt = iso(Date.now() + config.inviteTtlDays * DAY);
    db.prepare('INSERT INTO invites (id, token_hash, email, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?)').run(
      id, sha256(token), email, req.user.id, iso(Date.now()), expiresAt,
    );
    const url = `${config.publicUrl}/invite/${token}`;
    let emailSent = false;
    if (email) {
      const r = await mailer.send({
        to: email,
        subject: 'Te invitaron a StickyFlow',
        text: `${req.user.email} te invitó a su servidor de notas StickyFlow.\n\nCrea tu cuenta aquí (el enlace caduca el ${expiresAt.slice(0, 10)}):\n${url}`,
      });
      emailSent = r.ok;
    }
    return reply.code(201).send({ id, url, email, expiresAt, emailSent }); // el token solo se muestra ahora
  });

  app.get('/api/invites', { preHandler: app.requireAdmin }, async () => ({
    invites: db
      .prepare(
        `SELECT i.id, i.email, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.email AS used_by_email
         FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC LIMIT 200`,
      )
      .all()
      .map((i) => ({
        id: i.id,
        email: i.email,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
        status: i.revoked_at ? 'revocada' : i.used_at ? 'usada' : i.expires_at <= iso(Date.now()) ? 'caducada' : 'pendiente',
        usedBy: i.used_by_email || null,
      })),
  }));

  app.delete('/api/invites/:id', { preHandler: app.requireAdmin }, async (req, reply) => {
    const r = db.prepare('UPDATE invites SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL').run(iso(Date.now()), req.params.id);
    if (!r.changes) return reply.code(404).send({ error: 'Invitación no encontrada o ya usada' });
    return { ok: true };
  });

  // Público: comprueba si un enlace sirve (la página lo usa para mostrar el formulario)
  app.get('/api/invites/check/:token', async (req) => {
    const inv = db.prepare('SELECT email, used_at, revoked_at, expires_at FROM invites WHERE token_hash = ?').get(sha256(req.params.token));
    const valid = Boolean(inv && !inv.used_at && !inv.revoked_at && inv.expires_at > iso(Date.now()));
    return { valid, email: valid ? inv.email : null };
  });
}
