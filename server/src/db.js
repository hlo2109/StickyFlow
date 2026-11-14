// Base de datos con dos motores intercambiables:
//   · SQLite embebido en Node (node:sqlite): un archivo en DATA_DIR. Sin dependencias nativas. Es el valor por defecto.
//   · PostgreSQL (paquete `pg`): si hay DATABASE_URL o DB_HOST. Sus datos viven en el volumen de la propia base.
//
// El resto del servidor solo ve esta interfaz asíncrona (SQL con «?» como marcador; se traduce a $1, $2… en Postgres):
//   db.prepare(sql).get(...params)  → fila | undefined
//   db.prepare(sql).all(...params)  → filas
//   db.prepare(sql).run(...params)  → { changes }
//   db.exec(sql), db.close(), db.dialect, db.nextSeq()
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  verified_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by TEXT,
  used_at TEXT,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  markdown TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  pinned INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  bitacora TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS notes_user_seq ON notes(user_id, seq);
CREATE INDEX IF NOT EXISTS notes_seq ON notes(seq);
`;

const wrap = (adapter) => ({
  dialect: adapter.dialect,
  prepare: (sql) => ({
    get: (...p) => adapter.get(sql, p),
    all: (...p) => adapter.all(sql, p),
    run: (...p) => adapter.run(sql, p),
  }),
  exec: (sql) => adapter.exec(sql),
  close: () => adapter.close(),
  // Siguiente número de cambio (cursor de sincronización). Se llama dentro del candado de escritura de notas.
  nextSeq: async () => Number((await adapter.get('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM notes', [])).n),
  isUniqueViolation: adapter.isUniqueViolation,
});

// ------------------------------------------------------------------ SQLite
async function openSqlite(dataDir) {
  const { DatabaseSync } = await import('node:sqlite');
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    fs.mkdirSync(dataDir, { recursive: true });
    file = path.join(dataDir, 'stickyflow.db');
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  // Migración de bases antiguas (creadas antes de existir la columna seq)
  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='notes'").get();
  if (tableExists) {
    const cols = db.prepare('PRAGMA table_info(notes)').all().map((c) => c.name);
    if (!cols.includes('seq')) {
      db.exec('ALTER TABLE notes ADD COLUMN seq INTEGER NOT NULL DEFAULT 0');
      db.exec('UPDATE notes SET seq = rowid');
    }
  }
  db.exec(SCHEMA);

  return {
    dialect: 'sqlite',
    get: async (sql, p) => db.prepare(sql).get(...p),
    all: async (sql, p) => db.prepare(sql).all(...p),
    run: async (sql, p) => ({ changes: Number(db.prepare(sql).run(...p).changes) }),
    exec: async (sql) => db.exec(sql),
    close: async () => db.close(),
    isUniqueViolation: (e) => /UNIQUE constraint failed/i.test(e?.message || ''),
  };
}

// ------------------------------------------------------------------ PostgreSQL
const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

const dbNameOf = (cfg) => {
  if (cfg.database) return cfg.database;
  try {
    return decodeURIComponent(new URL(cfg.connectionString).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
};

/** Si la base indicada no existe (error 3D000), la crea conectando a «postgres» (si el usuario tiene permiso). */
async function ensureDatabase(Pool, cfg) {
  const name = dbNameOf(cfg);
  if (!/^[\w-]{1,63}$/.test(name)) throw new Error(`Nombre de base de datos no válido: "${name}"`);
  const admin = cfg.connectionString
    ? new Pool({ connectionString: cfg.connectionString.replace(/\/[^/?]*(\?|$)/, '/postgres$1'), max: 1 })
    : new Pool({ ...cfg, database: 'postgres', max: 1 });
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end().catch(() => {});
  }
}

async function openPostgres(cfg) {
  const { default: pg } = await import('pg');
  // Los BIGINT (p. ej. COUNT) llegarían como texto; aquí caben en un número normal
  pg.types.setTypeParser(20, (v) => Number(v));
  const settings = cfg.connectionString
    ? { connectionString: cfg.connectionString, max: 5 }
    : { host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, max: 5 };

  let pool = new pg.Pool(settings);
  pool.on('error', () => {}); // una conexión inactiva que se cae no debe tumbar el servidor
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    if (e?.code !== '3D000') {
      await pool.end().catch(() => {});
      throw new Error(`No se pudo conectar a PostgreSQL: ${e.message}`);
    }
    await pool.end().catch(() => {});
    await ensureDatabase(pg.Pool, cfg);
    pool = new pg.Pool(settings);
    pool.on('error', () => {});
    await pool.query('SELECT 1');
  }
  await pool.query(SCHEMA);

  return {
    dialect: 'postgres',
    get: async (sql, p) => (await pool.query(toPg(sql), p)).rows[0],
    all: async (sql, p) => (await pool.query(toPg(sql), p)).rows,
    run: async (sql, p) => ({ changes: (await pool.query(toPg(sql), p)).rowCount }),
    exec: async (sql) => void (await pool.query(sql)),
    close: async () => pool.end(),
    isUniqueViolation: (e) => e?.code === '23505',
  };
}

/**
 * Abre la base. `target`: ':memory:' o la carpeta de datos (SQLite), u `{ postgres: {connectionString | host,port,user,password,database} }`.
 * Siempre devuelve una promesa.
 */
export async function openDb(target) {
  if (target && typeof target === 'object' && target.postgres) return wrap(await openPostgres(target.postgres));
  return wrap(await openSqlite(target));
}
