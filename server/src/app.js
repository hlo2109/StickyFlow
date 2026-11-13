import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './security.js';
import { authRoutes } from './routes/auth.js';
import { inviteRoutes } from './routes/invites.js';
import { noteRoutes } from './routes/notes.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp({ config, db, mailer, logger = false }) {
  const app = Fastify({
    logger,
    trustProxy: config.trustProxy,
    bodyLimit: 8 * 1024 * 1024, // una nota con imágenes en base64 puede ser grande
  });

  const ctx = { config, db, mailer };

  // Cabeceras de seguridad (la página de administración no carga nada externo)
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
  });

  // Autenticación por token (Authorization: Bearer ...)
  app.decorateRequest('user', null);
  app.decorate('authenticate', async (req, reply) => {
    const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
    if (m) {
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.is_admin, u.active, s.id AS session_id FROM sessions s
           JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
        )
        .get(sha256(m[1]), new Date().toISOString());
      if (row && row.active) {
        req.user = { id: row.id, email: row.email, isAdmin: Boolean(row.is_admin), sessionId: row.session_id };
        return;
      }
    }
    return reply.code(401).send({ error: 'No autorizado' });
  });
  app.decorate('requireAdmin', async (req, reply) => {
    await app.authenticate(req, reply);
    if (!reply.sent && !req.user?.isAdmin) return reply.code(403).send({ error: 'Solo administradores' });
  });

  app.get('/health', async () => ({ ok: true, service: 'stickyflow-server', time: new Date().toISOString() }));
  app.get('/api/info', async () => ({
    name: 'StickyFlow Server',
    signupMode: config.signupMode,
    smtp: mailer.enabled,
    hasUsers: db.prepare('SELECT 1 FROM users LIMIT 1').get() !== undefined,
  }));

  await app.register(async (api) => authRoutes(api, ctx));
  await app.register(async (api) => inviteRoutes(api, ctx));
  await app.register(async (api) => noteRoutes(api, ctx));

  await app.register(fastifyStatic, { root: path.join(here, '..', 'public'), prefix: '/' });
  // /invite/<token>, /reset/<token> y /verify/<token> abren la misma página, que lee el token de la URL
  for (const p of ['invite', 'reset', 'verify']) {
    app.get(`/${p}/:token`, (_req, reply) => reply.sendFile('index.html'));
  }

  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') ? reply.code(404).send({ error: 'No encontrado' }) : reply.code(404).send('No encontrado'),
  );
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) app.log.error(err);
    reply.code(status).send({ error: status === 500 ? 'Error interno' : err.message });
  });
  return app;
}
