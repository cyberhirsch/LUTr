// LUTr community server: submission review queue (git-backed, via a GitHub
// App PR -- no clone), plus ratings/download-counts/reports in SQLite.
//
// No framework -- node:http only, matching the project's zero-dependency
// approach. Routing is a flat table matched by method + path pattern.
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCube } from "../site/lut-io.js";
import { openDb, hashIp, Queries } from "./db.mjs";
import { rateLimited } from "./ratelimit.mjs";
import { startCatalogIndex } from "./catalog-index.mjs";
import {
  validateSubmission, buildHeader, deriveId, scanUpstreamComments, SubmissionError, MAX_BODY_BYTES,
} from "./validate.mjs";
import { gzipCube, buildAtlas } from "./atlas.mjs";
import { GitHubAppClient, GitHubAppError } from "./github.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(__dirname, "..", "site");

const PORT = Number(process.env.PORT || 8420);
const DB_PATH = process.env.LUTR_DB_PATH || "/data/db/lutr.sqlite";
const IP_PEPPER = process.env.LUTR_IP_PEPPER || "";
if (!IP_PEPPER) {
  console.warn("LUTR_IP_PEPPER is not set -- IP hashes will not be stable across restarts. Set it in production.");
}
const ADMIN_TOKEN = process.env.LUTR_ADMIN_TOKEN || "";
const CORS_ORIGINS = (process.env.LUTR_CORS_ORIGINS || "https://cyberhirsch.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);
const BASE_BRANCH = process.env.LUTR_BASE_BRANCH || "main";

const db = openDb(DB_PATH);
const catalogIndex = startCatalogIndex(siteDir);

function clientIp(req) {
  // Behind the Cloudflare Tunnel used for every other service on this box,
  // the raw socket address is the tunnel's local hop, not the visitor --
  // CF-Connecting-IP is Cloudflare's own header for the true client IP.
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).split(",")[0].trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function ipHashFor(req) {
  return hashIp(clientIp(req), IP_PEPPER);
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(ADMIN_TOKEN);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function send(res, status, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(json);
}

function applyCors(req, res, pathname) {
  const origin = req.headers.origin;
  // A local file:// page (the gitignored admin panel) sends Origin: null,
  // not an https:// value -- allow that specifically for /admin/*, since
  // those routes are already gated by the bearer token, not by origin.
  // Public routes stay restricted to the configured origin list only.
  const isAdminRoute = pathname.startsWith("/admin/");
  const allowed = isAdminRoute ? origin === "null" || CORS_ORIGINS.includes(origin) : CORS_ORIGINS.includes(origin);
  if (origin && allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Reads the request body as JSON, aborting (never buffering unbounded) if
// it exceeds the byte cap. A submission's own field-level limit
// (MAX_BODY_BYTES, sized for a real LUT) is the largest of these; every
// other endpoint's body is tiny by comparison.
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new SubmissionError(`request body exceeds ${maxBytes} bytes`, 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new SubmissionError("request body is not valid JSON", 400)); }
    });
    req.on("error", reject);
  });
}

function stripExistingLutrHeader(text) {
  return text.replace(/^(#[^\n]*\n)+\n?/, "");
}

async function handleSubmit(req, res) {
  const ip = ipHashFor(req);
  if (rateLimited(`submit:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 })) {
    return send(res, 429, { error: "Too many submissions from this address. Try again later." });
  }
  const body = await readJsonBody(req, MAX_BODY_BYTES + 64 * 1024); // headroom for the JSON envelope around the cube text
  const { parsed, meta, hash, claims } = validateSubmission(body);

  const existingLutId = catalogIndex.find(hash);
  if (existingLutId) {
    return send(res, 409, {
      error: "A numerically identical LUT is already in the catalog.",
      existingLutId,
    });
  }
  const pendingMatch = Queries.findByHash(db, hash);
  if (pendingMatch) {
    return send(res, 409, {
      error: "A numerically identical LUT has already been submitted and is awaiting review.",
      submissionId: pendingMatch.id,
    });
  }

  const id = crypto.randomUUID();
  const status = claims.length ? "quarantined" : "pending";
  Queries.insertSubmission(db, {
    id,
    status,
    cubeText: body.cube,
    metaJson: JSON.stringify(meta),
    semanticHash: hash,
    claimsJson: JSON.stringify(claims),
    ipHash: ip,
    createdAt: new Date().toISOString(),
  });
  return send(res, 201, {
    status,
    id,
    note: status === "quarantined"
      ? "This submission's file contains a comment asserting a copyright or rights claim, and requires manual review before it can be published."
      : "Submitted for review.",
  });
}

function handleStatus(req, res, id) {
  const row = Queries.findSubmission(db, id);
  if (!row) return send(res, 404, { error: "not found" });
  return send(res, 200, {
    status: row.status,
    lutId: row.lut_id || null,
    prUrl: row.pr_url || null,
    rejectReason: row.reject_reason || null,
  });
}

async function handleRate(req, res) {
  const ip = ipHashFor(req);
  if (rateLimited(`rate:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 })) {
    return send(res, 429, { error: "Too many rating requests from this address." });
  }
  const body = await readJsonBody(req, 4096);
  const lutId = String(body.lutId || "").trim();
  const stars = Number(body.stars);
  if (!lutId) return send(res, 400, { error: "lutId is required" });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return send(res, 400, { error: "stars must be an integer 1-5" });
  Queries.rate(db, { lutId, ipHash: ip, stars, createdAt: new Date().toISOString() });
  const summary = Queries.ratingSummary(db, lutId);
  return send(res, 200, { lutId, average: summary.average, count: summary.count });
}

function handleRatingsGet(req, res, lutId) {
  const summary = Queries.ratingSummary(db, lutId);
  return send(res, 200, { lutId, average: summary.average, count: summary.count });
}

async function handleDownloadBeacon(req, res, lutId) {
  const ip = ipHashFor(req);
  if (rateLimited(`download:${ip}`, { limit: 60, windowMs: 10 * 60 * 1000 })) {
    return send(res, 429, { error: "Too many download beacons from this address." });
  }
  // This counter is an indicative signal, not an audited one -- a request
  // from a static page is trivially forgeable. The per-(lut,ip) window in
  // db.mjs keeps a naive retry loop from inflating one LUT's count; it is
  // not fraud prevention.
  Queries.registerDownload(db, { lutId, ipHash: ip, windowMs: 60 * 60 * 1000 });
  return send(res, 204, null);
}

function handleDownloadsGet(req, res, lutId) {
  return send(res, 200, { lutId, count: Queries.downloadCount(db, lutId) });
}

async function handleReport(req, res) {
  const ip = ipHashFor(req);
  if (rateLimited(`report:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return send(res, 429, { error: "Too many reports from this address." });
  }
  const body = await readJsonBody(req, 8192);
  const lutId = String(body.lutId || "").trim();
  const category = String(body.category || "").trim();
  if (!lutId) return send(res, 400, { error: "lutId is required" });
  if (!["copyright", "technical", "other"].includes(category)) {
    return send(res, 400, { error: "category must be one of copyright, technical, other" });
  }
  const detail = String(body.detail || "").trim().slice(0, 4000);
  const id = crypto.randomUUID();
  Queries.insertReport(db, { id, lutId, category, detail, ipHash: ip, createdAt: new Date().toISOString() });
  return send(res, 201, { id, status: "open" });
}

// --- admin: the actual build pipeline, run once per approval -------------

async function buildManifestEntry({ id, meta, parsed, header }) {
  const tags = [...new Set([...meta.tags, "community", "cube"])];
  return {
    id,
    title: meta.title,
    collection: "Community Submissions",
    collectionId: "community-submissions",
    transformClass: meta.transformClass,
    format: "CUBE",
    source: meta.source || "LUTr community submission",
    assetUrl: meta.assetUrl || null,
    author: meta.author,
    authorUrl: meta.authorUrl || null,
    retrieved: new Date().toISOString().slice(0, 10),
    license: meta.license,
    licenseUrl: meta.licenseUrl || null,
    licenseBasis: meta.licenseBasis,
    attribution: null,
    tags,
    sourceFile: `server-submission/${id}.cube`,
    sourceFormat: "CUBE",
    sourceSha256: crypto.createHash("sha256").update(header, "utf8").digest("hex"),
    clientLut: `assets/luts/${id}.cube`,
    clientLutSize: parsed.size,
    cubeKind: "3D",
    size: parsed.size,
    inputColorSpace: meta.inputColorSpace || null,
    outputColorSpace: meta.outputColorSpace || null,
    colorSpaceConfidence: meta.colorSpaceConfidence,
    inputGamut: meta.inputGamut,
    inputTransfer: meta.inputTransfer,
    outputGamut: meta.outputGamut,
    outputTransfer: meta.outputTransfer,
    domainNormalized: true,
    shaper: "none",
    originalGrid: `${parsed.size}x${parsed.size}x${parsed.size}`,
    conversionGrid: `${parsed.size}x${parsed.size}x${parsed.size}`,
    conversionInterpolation: "none",
    conversionMethod: "Verbatim community submission; header prepended, sample values unmodified",
    conversionWarning: null,
    sourceLabels: null,
    duplicateAssets: null,
    upstreamId: null,
    inputDescriptor: null,
    outputDescriptor: null,
    previewAtlas: `assets/atlas/${id}.png`,
    previewAtlasSize: 33,
  };
}

// Builds the canonical cube, gzip, atlas, and an updated manifest, then
// opens exactly one PR -- everything the offline build
// (convert-all-to-cube.mjs + build-preview-assets.mjs) would produce for
// one new LUT, run once instead of over the whole catalog. Deliberately
// does NOT touch catalog.json: that file's tags/completeness/previewType
// derivation lives in build-prototype.mjs, and reimplementing it here would
// be exactly the kind of second implementation LUT_HEADER_SPEC.md's
// "single source of truth" rule exists to prevent. The PR body says so.
async function approveSubmission(row, githubClient) {
  const meta = JSON.parse(row.meta_json);
  const claims = JSON.parse(row.claims_json || "[]");
  const cubeBody = stripExistingLutrHeader(row.cube_text).replace(/^\s*\n/, "");
  const parsed = parseCube(row.cube_text);
  const { credits } = scanUpstreamComments(row.cube_text);
  const id = deriveId(meta.title, row.semantic_hash);
  const header = buildHeader({
    id, meta, parsed, claims, credits,
    source: row.cube_text, retrievedDate: new Date().toISOString().slice(0, 10),
  });
  const canonicalCube = `${header}\n\n${cubeBody}`;

  const gz = gzipCube(canonicalCube);
  const atlasPng = buildAtlas(parsed);
  const manifestEntry = await buildManifestEntry({ id, meta, parsed, header });

  const { text: manifestText } = await githubClient.getFileText("site/data/cube-manifest.json", BASE_BRANCH);
  const manifest = JSON.parse(manifestText);
  manifest.luts.push(manifestEntry);
  manifest.luts.sort((a, b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title));
  manifest.total = manifest.luts.length;

  const branch = `community-submission/${id}-${Date.now()}`;
  const prUrl = await githubClient.openMultiFilePr({
    baseBranch: BASE_BRANCH,
    newBranch: branch,
    files: [
      { path: `site/assets/luts/${id}.cube.gz`, content: gz },
      { path: `site/assets/atlas/${id}.png`, content: atlasPng },
      { path: "site/data/cube-manifest.json", content: JSON.stringify(manifest, null, 2) },
    ],
    commitMessage: `Add community submission: ${meta.title}`,
    prTitle: `Community submission: ${meta.title}`,
    prBody: [
      `Automated submission via the LUTr community server.`,
      "",
      `- author: ${meta.author}`,
      `- license: ${meta.license} (${meta.licenseBasis})`,
      `- input: ${meta.inputColorSpace || "(unresolved)"} / output: ${meta.outputColorSpace || "(unresolved)"}`,
      "",
      "After merging: run `node scripts/build-prototype.mjs` to regenerate",
      "`site/data/catalog.json`, then `node scripts/validate-cubes.mjs` to confirm",
      "before the next deploy.",
    ].join("\n"),
  });

  return { id, prUrl };
}

async function handleAdminApprove(req, res, submissionId) {
  const row = Queries.findSubmission(db, submissionId);
  if (!row) return send(res, 404, { error: "not found" });
  if (!["pending", "quarantined"].includes(row.status)) {
    return send(res, 409, { error: `submission is already ${row.status}` });
  }
  let githubClient;
  try {
    githubClient = GitHubAppClient.fromEnv();
  } catch (error) {
    return send(res, 500, { error: `GitHub App not configured: ${error.message}` });
  }
  try {
    const { id, prUrl } = await approveSubmission(row, githubClient);
    Queries.decideSubmission(db, submissionId, { status: "approved", lutId: id, prUrl });
    return send(res, 200, { status: "approved", lutId: id, prUrl });
  } catch (error) {
    const message = error instanceof GitHubAppError ? error.message : `approval failed: ${error.message}`;
    return send(res, 502, { error: message });
  }
}

async function handleAdminReject(req, res, submissionId) {
  const body = await readJsonBody(req, 4096);
  const row = Queries.findSubmission(db, submissionId);
  if (!row) return send(res, 404, { error: "not found" });
  if (!["pending", "quarantined"].includes(row.status)) {
    // Without this guard, rejecting an already-approved submission would
    // silently null out its lut_id/pr_url (decideSubmission's defaults),
    // destroying the record of a PR that's already open.
    return send(res, 409, { error: `submission is already ${row.status}` });
  }
  Queries.decideSubmission(db, submissionId, { status: "rejected", rejectReason: String(body.reason || "").slice(0, 1000) });
  return send(res, 200, { status: "rejected" });
}

async function handleAdminResolveReport(req, res, reportId) {
  const body = await readJsonBody(req, 4096);
  Queries.resolveReport(db, reportId, String(body.note || "").slice(0, 1000));
  return send(res, 200, { status: "resolved" });
}

// --- routing ---------------------------------------------------------------

const routes = [
  ["GET", /^\/healthz$/, () => (req, res) => send(res, 200, { status: "ok" })],
  ["POST", /^\/submit$/, () => handleSubmit],
  ["GET", /^\/status\/([^/]+)$/, (id) => (req, res) => handleStatus(req, res, id)],
  ["POST", /^\/rate$/, () => handleRate],
  ["GET", /^\/ratings\/([^/]+)$/, (id) => (req, res) => handleRatingsGet(req, res, id)],
  ["POST", /^\/download\/([^/]+)$/, (id) => (req, res) => handleDownloadBeacon(req, res, id)],
  ["GET", /^\/downloads\/([^/]+)$/, (id) => (req, res) => handleDownloadsGet(req, res, id)],
  ["POST", /^\/report$/, () => handleReport],
  ["GET", /^\/admin\/pending$/, () => (req, res) => send(res, 200, Queries.listByStatus(db, "pending"))],
  ["GET", /^\/admin\/quarantined$/, () => (req, res) => send(res, 200, Queries.listByStatus(db, "quarantined"))],
  ["POST", /^\/admin\/approve\/([^/]+)$/, (id) => (req, res) => handleAdminApprove(req, res, id)],
  ["POST", /^\/admin\/reject\/([^/]+)$/, (id) => (req, res) => handleAdminReject(req, res, id)],
  ["GET", /^\/admin\/reports$/, () => (req, res) => {
    const url = new URL(req.url, "http://localhost");
    send(res, 200, Queries.listReports(db, url.searchParams.get("status") || "open"));
  }],
  ["POST", /^\/admin\/reports\/([^/]+)\/resolve$/, (id) => (req, res) => handleAdminResolveReport(req, res, id)],
];

const ADMIN_PREFIX = "/admin/";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  applyCors(req, res, url.pathname);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (url.pathname.startsWith(ADMIN_PREFIX) && !isAdmin(req)) {
    return send(res, 401, { error: "admin authorization required" });
  }

  for (const [method, pattern, makeHandler] of routes) {
    if (method !== req.method) continue;
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    try {
      await makeHandler(...match.slice(1))(req, res);
    } catch (error) {
      if (error instanceof SubmissionError) {
        send(res, error.status, { error: error.message });
      } else {
        console.error(error);
        send(res, 500, { error: "internal error" });
      }
    }
    return;
  }
  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`LUTr community server listening on :${PORT} (db=${DB_PATH})`);
});
