import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createMailer } from './mail.js';
import { buildApp } from './app.js';

const config = loadConfig();
const db = openDb(config.dataDir);
const app = await buildApp({ config, db, mailer: createMailer(config.smtp, console), logger: { level: 'info' } });

const stop = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

await app.listen({ port: config.port, host: config.host });
app.log.info(`StickyFlow Server en ${config.publicUrl} · registro: ${config.signupMode} · SMTP: ${config.smtp ? 'sí' : 'no'}`);
