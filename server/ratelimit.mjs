// IP-based sliding-window rate limiter.
//
// lensfit-server's limiter keys on a client-reported install_id, which is
// fine there -- it only guards against a desktop app's own retry loop, not
// abuse. Every endpoint here is a public, anonymous, internet-facing
// surface accepting multi-megabyte uploads, so the key has to be something
// the caller can't just change on request: the connecting IP.
//
// In-memory, not persisted -- a restart resetting the window is an
// acceptable trade-off for what this defends against (retry loops, casual
// spam), and keeps this server's only persistent state in db.mjs/SQLite.
const buckets = new Map(); // key -> array of timestamps (ms)

export function rateLimited(key, { limit, windowMs }) {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return false;
}

// Periodic sweep so the map doesn't grow unbounded under sustained traffic.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of buckets) {
    const kept = timestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
    if (kept.length) buckets.set(key, kept); else buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
