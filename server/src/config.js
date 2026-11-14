// Configuración leída de variables de entorno (ver .env.example). Se valida al arrancar.
import path from 'node:path';

const int = (v, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|si|sí)$/i.test(String(v)));

export function loadConfig(env = process.env) {
  const port = int(env.PORT, 3000);
  const signupMode = (env.SIGNUP_MODE || 'invite').toLowerCase();
  if (!['open', 'invite', 'closed'].includes(signupMode)) {
    throw new Error(`SIGNUP_MODE inválido: "${env.SIGNUP_MODE}" (usa open, invite o closed)`);
  }
  const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const smtpHost = env.SMTP_HOST || '';
  // PostgreSQL: DATABASE_URL (postgresql://usuario:clave@host:5432/base) o por partes con DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
  // (por partes no hace falta escribir la clave con códigos especiales). Sin ninguna de las dos se usa SQLite en DATA_DIR.
  let postgres = null;
  if (env.DATABASE_URL) {
    if (!/^postgres(ql)?:\/\//i.test(env.DATABASE_URL)) throw new Error('DATABASE_URL debe empezar por postgresql://');
    postgres = { connectionString: env.DATABASE_URL };
  } else if (env.DB_HOST) {
    postgres = {
      host: env.DB_HOST,
      port: int(env.DB_PORT, 5432),
      user: env.DB_USER || 'postgres',
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME || 'stickyflow',
    };
  }
  return {
    postgres,
    port,
    host: env.HOST || '0.0.0.0',
    publicUrl,
    dataDir: path.resolve(env.DATA_DIR || './data'),
    signupMode,
    inviteTtlDays: int(env.INVITE_TTL_DAYS, 7),
    sessionDays: int(env.SESSION_DAYS, 30),
    trustProxy: bool(env.TRUST_PROXY, true),
    smtp: smtpHost
      ? {
          host: smtpHost,
          port: int(env.SMTP_PORT, 587),
          secure: bool(env.SMTP_SECURE, int(env.SMTP_PORT, 587) === 465),
          user: env.SMTP_USER || '',
          pass: env.SMTP_PASS || '',
          from: env.SMTP_FROM || env.SMTP_USER || 'StickyFlow <no-reply@localhost>',
        }
      : null,
  };
}
