import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createMailer } from './mail.js';
import { buildApp } from './app.js';
import { isPersistent } from './persistence.js';

const config = loadConfig();
const db = await openDb(config.postgres ? { postgres: config.postgres } : config.dataDir);
// Con PostgreSQL los datos viven en la base (su propio volumen); con SQLite hace falta un volumen en DATA_DIR
const persistent = config.postgres ? true : isPersistent(config.dataDir);
const app = await buildApp({ config, db, mailer: createMailer(config.smtp, console), logger: { level: 'info' }, persistent });

const stop = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

const userCount = Number((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n);
app.log.info(
  config.postgres
    ? `Base de datos: PostgreSQL · usuarios existentes: ${userCount}`
    : `Base de datos: SQLite en ${config.dataDir} · usuarios existentes: ${userCount} (si tras cada deploy vuelve a 0, el volumen de /data no está montado)`,
);

if (!persistent) {
  app.log.warn(`⚠ ${config.dataDir} NO es un volumen: las cuentas y notas se perderán en cada despliegue. Monta un volumen en ${config.dataDir} (Dokploy → Advanced → Volumes).`);
}

await app.listen({ port: config.port, host: config.host });
app.log.info(`StickyFlow Server en ${config.publicUrl} · registro: ${config.signupMode} · SMTP: ${config.smtp ? 'sí' : 'no'}`);
