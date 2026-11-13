// API de notas por usuario. Cada nota lleva su fecha de edición: gana la más reciente; el borrado es lógico
// (deleted_at) para que otros dispositivos se enteren. El tiempo real (Yjs) se añade en la fase 4.
const COLORS = new Set(['yellow', 'orange', 'coral', 'pink', 'purple', 'indigo', 'blue', 'teal', 'green', 'dark']);
const iso = (ms) => new Date(ms).toISOString();
const MAX_TEXT = 6 * 1024 * 1024;

const toApi = (r) => ({
  id: r.id,
  title: r.title,
  content: r.content,
  markdownContent: r.markdown,
  color: r.color,
  isPinned: Boolean(r.pinned),
  tags: JSON.parse(r.tags),
  bitacora: JSON.parse(r.bitacora),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
  seq: r.seq,
});

const validDate = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export async function noteRoutes(app, { db }) {
  const pre = { preHandler: app.authenticate };

  // Cambios desde un cursor (?since=<seq>, 0 = todo). `seq` lo asigna el servidor en cada escritura, así que no
  // depende de los relojes de los dispositivos. Incluye las notas borradas para que el cliente las quite.
  const nextSeq = () => db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM notes').get().n;
  app.get('/api/notes', pre, async (req) => {
    const since = Number.parseInt(req.query?.since ?? '0', 10);
    const rows = db.prepare('SELECT * FROM notes WHERE user_id = ? AND seq > ? ORDER BY seq').all(req.user.id, Number.isFinite(since) && since > 0 ? since : 0);
    return { notes: rows.map(toApi), cursor: rows.length ? rows[rows.length - 1].seq : Math.max(0, since || 0), serverTime: iso(Date.now()) };
  });

  app.put('/api/notes/:id', pre, async (req, reply) => {
    const id = String(req.params.id || '');
    if (!/^[\w-]{1,100}$/.test(id)) return reply.code(400).send({ error: 'Id de nota no válido' });
    const b = req.body || {};
    const title = String(b.title ?? '');
    const content = String(b.content ?? '');
    const markdown = String(b.markdownContent ?? '');
    if (title.length > 500 || content.length > MAX_TEXT || markdown.length > MAX_TEXT) {
      return reply.code(413).send({ error: 'La nota es demasiado grande' });
    }
    const updatedAt = validDate(b.updatedAt) || iso(Date.now());
    const createdAt = validDate(b.createdAt) || updatedAt;
    const tags = Array.isArray(b.tags) ? b.tags.slice(0, 50).map((t) => String(t).slice(0, 60)) : [];
    const bitacora = Array.isArray(b.bitacora) ? b.bitacora.slice(0, 500) : [];

    const current = db.prepare('SELECT * FROM notes WHERE user_id = ? AND id = ?').get(req.user.id, id);
    if (current && current.updated_at > updatedAt) {
      // El servidor ya tiene algo más nuevo: el cliente debe tomar esa versión
      return reply.code(409).send({ error: 'conflicto', note: toApi(current) });
    }
    const color = COLORS.has(b.color) ? b.color : 'yellow';
    db.prepare(
      `INSERT INTO notes (user_id, id, title, content, markdown, color, pinned, tags, bitacora, created_at, updated_at, deleted_at, seq)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?)
       ON CONFLICT(user_id, id) DO UPDATE SET title=excluded.title, content=excluded.content, markdown=excluded.markdown,
         color=excluded.color, pinned=excluded.pinned, tags=excluded.tags, bitacora=excluded.bitacora,
         updated_at=excluded.updated_at, deleted_at=NULL, seq=excluded.seq`,
    ).run(req.user.id, id, title, content, markdown, color, b.isPinned ? 1 : 0, JSON.stringify(tags), JSON.stringify(bitacora), createdAt, updatedAt, nextSeq());
    return toApi(db.prepare('SELECT * FROM notes WHERE user_id = ? AND id = ?').get(req.user.id, id));
  });

  app.delete('/api/notes/:id', pre, async (req, reply) => {
    const now = iso(Date.now());
    const r = db.prepare('UPDATE notes SET deleted_at = ?, updated_at = ?, seq = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL').run(now, now, nextSeq(), req.user.id, req.params.id);
    if (!r.changes) return reply.code(404).send({ error: 'Nota no encontrada' });
    return { ok: true };
  });
}
