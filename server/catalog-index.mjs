// A semantic-hash index of the already-published catalog, so a submission
// that duplicates an existing LUT's numeric content (not just its name) is
// caught before it reaches the approval queue. Built once at startup and
// refreshed on a timer -- the catalog only changes via merged PRs, which is
// infrequent, so recomputing per-submission (gunzip + parse ~1,170 cubes
// every time) would be wasted work for no correctness benefit.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseCube } from "../site/lut-io.js";
import { semanticHash } from "./validate.mjs";

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

export class CatalogIndex {
  constructor(siteDir) {
    this.siteDir = siteDir;
    this.byHash = new Map(); // semanticHash -> lutId
    this.builtAt = null;
    this.ready = false; // false until the first build completes
  }

  // Gunzip+parse ~1,000+ cubes is real CPU work with no async I/O to yield
  // on naturally; done synchronously in one pass, it blocks Node's single
  // thread for the entire duration -- long enough that a health check or
  // the first real requests during that window would hang and could look
  // like a crash. Yielding every BATCH_SIZE files keeps each blocking
  // stretch short enough that the server stays responsive throughout,
  // trading a slower overall build for one that never blocks for more than
  // a fraction of a second at a time.
  async rebuild() {
    const BATCH_SIZE = 25;
    const manifestFile = path.join(this.siteDir, "data", "cube-manifest.json");
    if (!fs.existsSync(manifestFile)) { this.byHash = new Map(); this.ready = true; return; }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const byHash = new Map();
    for (let i = 0; i < manifest.luts.length; i += 1) {
      const lut = manifest.luts[i];
      const gzFile = path.join(this.siteDir, ...lut.clientLut.split("/")) + ".gz";
      if (fs.existsSync(gzFile)) {
        try {
          const text = zlib.gunzipSync(fs.readFileSync(gzFile)).toString("utf8");
          byHash.set(semanticHash(parseCube(text)), lut.id);
        } catch {
          // A malformed cube in the existing catalog shouldn't block indexing
          // the rest, and it's already covered by scripts/validate-cubes.mjs.
        }
      }
      if (i % BATCH_SIZE === BATCH_SIZE - 1) await yieldToEventLoop();
    }
    this.byHash = byHash;
    this.builtAt = new Date().toISOString();
    this.ready = true;
  }

  // Returns null (no match) rather than blocking if the index hasn't
  // finished its first build yet -- a submission arriving in that narrow
  // startup window is still fully covered by the pending-submission hash
  // check, so this only affects catching a duplicate of a LUT already
  // published before the server started.
  find(hash) {
    return this.byHash.get(hash) || null;
  }
}

export function startCatalogIndex(siteDir, refreshMs = 6 * 60 * 60 * 1000) {
  const index = new CatalogIndex(siteDir);
  index.rebuild(); // not awaited: runs in the background, yielding between batches, while the caller starts the HTTP listener immediately
  const timer = setInterval(() => index.rebuild(), refreshMs);
  timer.unref();
  return index;
}
