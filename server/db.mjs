// SQLite is this server's entire datastore -- ratings, download counts,
// reports, and the submission queue. node:sqlite (built into Node 22.5+,
// still experimental as of this writing) needs no dependency, matching the
// rest of this project's zero-package.json approach. The file lives in a
// Docker named volume (see docker-compose.yml) so it survives a container
// rebuild; nothing else in this service holds state.
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | quarantined | approved | rejected
      cube_text TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      semantic_hash TEXT NOT NULL,
      claims_json TEXT NOT NULL DEFAULT '[]',
      ip_hash TEXT NOT NULL,
      lut_id TEXT,
      pr_url TEXT,
      reject_reason TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_hash ON submissions(semantic_hash);

    CREATE TABLE IF NOT EXISTS ratings (
      lut_id TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      stars INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (lut_id, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS downloads (
      lut_id TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS download_beacons (
      lut_id TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      last_at TEXT NOT NULL,
      PRIMARY KEY (lut_id, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      lut_id TEXT NOT NULL,
      category TEXT NOT NULL, -- copyright | technical | other
      detail TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', -- open | resolved
      resolution_note TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  `);
  return db;
}

// IPs are never stored raw -- only a keyed hash, so the database itself
// isn't a list of who-did-what-from-where even if it leaked. The pepper is
// server-side and never sent to a client.
export function hashIp(ip, pepper) {
  return crypto.createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export const Queries = {
  insertSubmission(db, row) {
    db.prepare(`
      INSERT INTO submissions (id, status, cube_text, meta_json, semantic_hash, claims_json, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.status, row.cubeText, row.metaJson, row.semanticHash, row.claimsJson, row.ipHash, row.createdAt);
  },

  findSubmission(db, id) {
    return db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  },

  findByHash(db, hash) {
    return db.prepare(
      "SELECT id, status, lut_id FROM submissions WHERE semantic_hash = ? AND status != 'rejected'",
    ).get(hash);
  },

  listByStatus(db, status) {
    return db.prepare("SELECT * FROM submissions WHERE status = ? ORDER BY created_at ASC").all(status);
  },

  decideSubmission(db, id, { status, lutId = null, prUrl = null, rejectReason = null }) {
    db.prepare(`
      UPDATE submissions SET status = ?, lut_id = ?, pr_url = ?, reject_reason = ?, decided_at = ?
      WHERE id = ?
    `).run(status, lutId, prUrl, rejectReason, new Date().toISOString(), id);
  },

  rate(db, { lutId, ipHash, stars, createdAt }) {
    db.prepare(`
      INSERT INTO ratings (lut_id, ip_hash, stars, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(lut_id, ip_hash) DO UPDATE SET stars = excluded.stars, created_at = excluded.created_at
    `).run(lutId, ipHash, stars, createdAt);
  },

  ratingSummary(db, lutId) {
    return db.prepare(
      "SELECT COUNT(*) AS count, AVG(stars) AS average FROM ratings WHERE lut_id = ?",
    ).get(lutId);
  },

  // Increments the download counter for lutId unless this ip_hash already
  // beaconed within windowMs -- a beacon from a static page is forgeable by
  // design, this only stops a naive retry loop from inflating one count.
  // Returns true if the counter was incremented.
  registerDownload(db, { lutId, ipHash, windowMs }) {
    const now = Date.now();
    const beacon = db.prepare(
      "SELECT last_at FROM download_beacons WHERE lut_id = ? AND ip_hash = ?",
    ).get(lutId, ipHash);
    if (beacon && now - Date.parse(beacon.last_at) < windowMs) return false;
    const nowIso = new Date(now).toISOString();
    db.prepare(`
      INSERT INTO download_beacons (lut_id, ip_hash, last_at) VALUES (?, ?, ?)
      ON CONFLICT(lut_id, ip_hash) DO UPDATE SET last_at = excluded.last_at
    `).run(lutId, ipHash, nowIso);
    db.prepare(`
      INSERT INTO downloads (lut_id, count) VALUES (?, 1)
      ON CONFLICT(lut_id) DO UPDATE SET count = count + 1
    `).run(lutId);
    return true;
  },

  downloadCount(db, lutId) {
    return db.prepare("SELECT count FROM downloads WHERE lut_id = ?").get(lutId)?.count ?? 0;
  },

  insertReport(db, row) {
    db.prepare(`
      INSERT INTO reports (id, lut_id, category, detail, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)
    `).run(row.id, row.lutId, row.category, row.detail, row.ipHash, row.createdAt);
  },

  listReports(db, status) {
    return db.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created_at ASC").all(status);
  },

  resolveReport(db, id, note) {
    db.prepare(
      "UPDATE reports SET status = 'resolved', resolution_note = ?, resolved_at = ? WHERE id = ?",
    ).run(note ?? null, new Date().toISOString(), id);
  },
};
