// Convert the raw freshluts capture into schema-2 CUBEs for LUTr.
//
//   node scripts/import-freshluts.mjs [--out submissions/freshluts-community]
//
// Reads  submissions-raw/freshluts/index.ndjson + cubes/
// Writes <out>/<id>-<slug>.cube  with the header defined in LUT_HEADER_SPEC.md
// Writes <out>/../freshluts-import-report.json
//
// Honesty rule from the spec (§7): LUTr-Input-Color-Space carries an id from
// site/color-spaces.js or nothing at all. Camera log encodings have no id yet,
// so those files ship with an empty id plus a Gamut/Transfer pair (§8), and are
// flagged in the report as blocked-on-color-space.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const rawDir = path.join(root, "submissions-raw", "freshluts");
const outArg = process.argv.indexOf("--out");
const outDir = path.join(root, outArg > -1 ? process.argv[outArg + 1] : "submissions/freshluts-community");

// Ids that site/color-spaces.js actually resolves. Keep in sync.
const RESOLVABLE = new Set([
  "srgb", "rec709", "rec709-gamma24", "linear-rec709",
  "display-p3", "linear-p3", "rec2020-gamma24", "linear-rec2020",
  "acescg", "aces2065-1",
  "sony-slog3-sgamut3", "sony-slog2-sgamut", "sony-slog1-sgamut",
  "arri-logc3-ei800-awg3", "panasonic-vlog-vgamut", "panasonic-vlogl-vgamut",
  "dji-dlog-dgamut", "bmd-film", "bmd-film-4k", "canon-cinestyle",
  "canon-log-cinema-gamut", "canon-log2-cinema-gamut", "canon-log3-cinema-gamut",
  "red-logfilm-rwg", "panasonic-cinelike-d", "gopro-protune-native",
]);

// freshluts "Gamma" -> { transfer, gamut, colorSpace }
// colorSpace is set ONLY when a single existing id captures the whole encoding.
const GAMMA_MAP = {
  "rec 709":                 { transfer: "rec709",              gamut: "rec709",             colorSpace: "rec709" },
  "linear":                  { transfer: "linear",              gamut: "rec709",             colorSpace: "linear-rec709" },
  "arri log c":              { transfer: "arri-logc3-ei800",    gamut: "arri-wide-gamut-3", colorSpace: "arri-logc3-ei800-awg3" },
  "sony s-log":              { transfer: "sony-s-log1",         gamut: "sony-s-gamut", colorSpace: "sony-slog1-sgamut" },
  "sony s-log 2":            { transfer: "sony-s-log2",         gamut: "sony-s-gamut", colorSpace: "sony-slog2-sgamut" },
  "sony s-log 3":            { transfer: "sony-s-log3",         gamut: "sony-s-gamut3", colorSpace: "sony-slog3-sgamut3" },
  "panasonic v-log":         { transfer: "panasonic-v-log",     gamut: "panasonic-v-gamut", colorSpace: "panasonic-vlog-vgamut" },
  "panasonic v-log l":       { transfer: "panasonic-v-log-l",   gamut: "panasonic-v-gamut", colorSpace: "panasonic-vlogl-vgamut" },
  "panasonic cinelike-d":    { transfer: "panasonic-cinelike-d", gamut: "rec709", colorSpace: "panasonic-cinelike-d" },
  "dji d-log":               { transfer: "dji-d-log",           gamut: "dji-d-gamut", colorSpace: "dji-dlog-dgamut" },
  "red log film":            { transfer: "red-logfilm",         gamut: "red-wide-gamut-rgb", colorSpace: "red-logfilm-rwg" },
  "red color":               { transfer: "unspecified",         gamut: "red-wide-gamut-rgb" },
  "blackmagic bmd film":     { transfer: "bmd-film",            gamut: "bmd-film-gamut", colorSpace: "bmd-film" },
  "blackmagic bmd film 4k":  { transfer: "bmd-film-4k",         gamut: "bmd-film-gamut", colorSpace: "bmd-film-4k" },
  "canon cinestyle":         { transfer: "canon-cinestyle",     gamut: "rec709", colorSpace: "canon-cinestyle" },
  "canon c-log":             { transfer: "canon-log",           gamut: "canon-cinema-gamut", colorSpace: "canon-log-cinema-gamut" },
  "canon c-log 2":           { transfer: "canon-log2",          gamut: "canon-cinema-gamut", colorSpace: "canon-log2-cinema-gamut" },
  "canon c-log 3":           { transfer: "canon-log3",          gamut: "canon-cinema-gamut", colorSpace: "canon-log3-cinema-gamut" },
  "gopro protune":           { transfer: "gopro-protune",       gamut: "gopro-protune-native", colorSpace: "gopro-protune-native" },
  "other":                   { transfer: "unspecified",         gamut: "unspecified" },
};

const STYLE_TAGS = {
  "black and white": ["black-and-white"],
  "film emulation": ["film-emulation"],
  "bleach bypass": ["bleach-bypass"],
  "cross process": ["cross-process"],
  "high contrast": ["high-contrast"],
  "blockbuster": ["cinematic", "blockbuster"],
  "noir": ["noir", "cinematic"],
  "faded": ["faded", "vintage"],
  "vintage": ["vintage"],
};

const slug = (v) => String(v || "")
  .normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase()
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const pad = (n) => String(n).padStart(7, "0");
const esc = (v) => String(v ?? "").replace(/\r?\n/g, " ").trim();

function readIndex() {
  const file = path.join(rawDir, "index.ndjson");
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run the crawl first.`);
  return fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean).map((l) => JSON.parse(l));
}

const cubeDir = path.join(rawDir, "cubes");
const cubeById = new Map(
  fs.existsSync(cubeDir)
    ? fs.readdirSync(cubeDir)
      .filter((name) => path.extname(name).toLowerCase() === ".cube")
      .map((name) => [Number(name.split("__")[0]), path.join(cubeDir, name)])
    : [],
);

function inspectCube(text) {
  const size = Number(text.match(/^\s*LUT_3D_SIZE\s+(\d+)/im)?.[1] || 0);
  if (!size || size < 2 || size > 129) throw new Error("missing or invalid LUT_3D_SIZE");
  const domainMin = (text.match(/^\s*DOMAIN_MIN\s+(.+)$/im)?.[1] || "0 0 0")
    .trim().split(/\s+/).slice(0, 3).map(Number);
  const domainMax = (text.match(/^\s*DOMAIN_MAX\s+(.+)$/im)?.[1] || "1 1 1")
    .trim().split(/\s+/).slice(0, 3).map(Number);
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    if (!/^[-+]?(?:\d|\.\d)/.test(clean)) continue;
    const values = clean.split(/\s+/).slice(0, 3).map(Number);
    if (values.length === 3 && values.every(Number.isFinite)) rows.push(values);
  }
  if (rows.length < size ** 3) throw new Error(`expected ${size ** 3} rows, found ${rows.length}`);
  const normalized = [size, ...domainMin, ...domainMax, ...rows.slice(0, size ** 3).flat()]
    .map((value) => Number(value).toPrecision(12)).join(",");
  return { size, semanticHash: sha256(normalized) };
}

function buildHeader(meta, body, sourceRel, hash, duplicateAssets = []) {
  const gamma = GAMMA_MAP[String(meta.gamma || "").toLowerCase().trim()] || GAMMA_MAP.other;
  const inputId = gamma.colorSpace && RESOLVABLE.has(gamma.colorSpace) ? gamma.colorSpace : "";

  const tags = new Set(["creative", "freshluts", "cube"]);
  for (const t of STYLE_TAGS[String(meta.style || "").toLowerCase()] || []) tags.add(t);
  if (meta.color && !/^none$/i.test(meta.color)) tags.add(slug(meta.color));
  if (meta.key && !/^neutral$/i.test(meta.key)) tags.add(slug(meta.key));
  if (gamma.transfer && gamma.transfer !== "unspecified") tags.add(slug(gamma.transfer));

  // Two different things live in upstream comments, and conflating them would
  // either quarantine harmless files or launder real copyright claims into CC0.
  //
  //   CLAIM  - an assertion of rights that contradicts the site's blanket CC0
  //            ("Copyright (C) 2018 X", "All Rights Reserved", "(C) 2019 Y")
  //   CREDIT - authorship or tool provenance, which CC0 explicitly tolerates
  //            ("Created by Adobe Photoshop Export Color Lookup Plugin")
  //
  // Only a CLAIM quarantines the file.
  const comments = (body.match(/^#.*$/gm) || [])
    .map((l) => l.replace(/^#\s?/, "").trim())
    .filter(Boolean);

  const claims = comments
    .filter((l) => /\bcopyright\b|\(c\)\s*\d{4}|©|all\s+rights\s+reserved|\bunauthoriz|\bresale\b|do\s+not\s+redistribute/i.test(l))
    .slice(0, 8);

  const credits = comments
    .filter((l) => !claims.includes(l) && /created\s+by|generated\s+by|https?:\/\/|\bby\s+\w/i.test(l))
    .slice(0, 8);

  const notices = [...claims, ...credits].slice(0, 12);

  const size = meta.lutSize ? `${meta.lutSize}x${meta.lutSize}x${meta.lutSize}` : "unknown";

  const fields = [
    ["Schema-Version", 2],
    ["ID", `freshluts--${pad(meta.id)}-${slug(meta.title)}`],
    ["Title", esc(meta.title)],
    ["Collection", "Fresh LUTs"],
    ["Collection-ID", "freshluts-community"],
    null,
    ["Source", "https://freshluts.com"],
    ["Asset-URL", meta.url],
    ["Author", esc(meta.author)],
    ["Author-URL", meta.authorUrl || ""],
    ["Retrieved", meta.retrieved],
    ["Source-File", sourceRel],
    ["Source-Format", "CUBE"],
    ["Source-SHA256", hash],
    null,
    ["License", "CC0-1.0"],
    ["License-URL", "https://freshluts.com/termsandconditions"],
    ["License-Basis", "site-terms"],
    ["Attribution", `${esc(meta.author) || "Unknown"} via Fresh LUTs`],
    ...(claims.length ? [["License-Conflict", "Upstream file asserts rights that contradict the site-wide CC0 declaration. Quarantined; verify before any use or redistribution."]] : []),
    null,
    ["Transform-Class", "creative-look"],
    ["Tags", [...tags].join(", ")],
    ["Source-Labels", `gamma=${esc(meta.gamma)}; color=${esc(meta.color)}; key=${esc(meta.key)}; style=${esc(meta.style)}`],
    ...(duplicateAssets.length ? [["Duplicate-Assets", duplicateAssets.map((item) => `${item.id}:${item.url}`).join("; ")]] : []),
    null,
    ["Input-Color-Space", inputId],
    ["Input-Gamut", gamma.gamut],
    ["Input-Transfer", gamma.transfer],
    ["Output-Color-Space", "srgb"],
    ["Output-Gamut", "rec709"],
    ["Output-Transfer", "srgb"],
    ["Color-Space-Confidence", inputId ? "inferred-from-source-label" : "camera-profile-input-required"],
    ["Domain-Normalized", "true"],
    ["Shaper", "none"],
    null,
    ["Original-Grid", size],
    ["Conversion-Grid", size],
    ["Conversion-Interpolation", "none"],
    ["Conversion-Method", "Verbatim 3D CUBE; header prepended, sample values unmodified"],
    ["Conversion-Tool", "LUTr scripts/import-freshluts.mjs 1.0.0"],
    ["Conversion-Date", new Date().toISOString().slice(0, 10)],
    null,
    ...notices.map((n) => ["Upstream-Comment", n]),
    ["Note", "Preserve this metadata and the upstream license notice when redistributing."],
  ];

  const lines = fields.map((f) => {
    if (f === null) return "#";
    const value = esc(f[1]);
    return `# LUTr-${f[0]}:${value ? ` ${value}` : ""}`;
  });
  return { header: lines.join("\n"), blocked: !inputId, transfer: gamma.transfer, claims, credits };
}

function stripExistingHeader(text) {
  return text.replace(/^(#\s*LUTr-[^\n]*\n)+/gm, "");
}

const qArg = process.argv.indexOf("--quarantine");
const quarantineDir = path.join(root, qArg > -1 ? process.argv[qArg + 1] : "submissions-quarantine/freshluts-copyright-conflict");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(quarantineDir, { recursive: true });
for (const dir of [outDir, quarantineDir]) {
  for (const name of fs.readdirSync(dir)) {
    if (name.toLowerCase().endsWith(".cube") || name === "CONFLICTS.json") {
      fs.rmSync(path.join(dir, name), { force: true });
    }
  }
}
const records = readIndex();
const report = {
  total: records.length, written: 0, quarantined: 0, skipped: [],
  blockedOnColorSpace: 0, byGamma: {}, byTransfer: {}, conflicts: [],
  duplicateFiles: 0, duplicateGroups: [],
};

const candidates = [];
for (const meta of records.sort((a, b) => Number(a.id) - Number(b.id))) {
  const cubeFile = cubeById.get(Number(meta.id));
  if (!cubeFile) { report.skipped.push({ id: meta.id, reason: "no cube captured" }); continue; }
  const raw = fs.readFileSync(cubeFile);
  const body = raw.toString("utf8");
  let cube;
  try {
    cube = inspectCube(body);
  } catch (error) {
    report.skipped.push({ id: meta.id, reason: `invalid 3D CUBE: ${error.message}` });
    continue;
  }

  const outName = `${pad(meta.id)}-${slug(meta.title)}.cube`;
  const sourceRel = `submissions-raw/freshluts/cubes/${path.basename(cubeFile)}`;
  const sourceHash = sha256(raw);
  const headerInfo = buildHeader(meta, body, sourceRel, sourceHash);
  candidates.push({ meta, raw, body, cube, outName, sourceRel, sourceHash, ...headerInfo });
}

const eligibleBySemanticHash = new Map();
for (const candidate of candidates) {
  const { meta, body, outName, sourceRel, sourceHash, claims } = candidate;
  // A rights claim in the file contradicts the site's blanket CC0. Those go to
  // quarantine and stay out of submissions/ entirely, so no build step can pick
  // them up by accident.
  if (claims.length) {
    fs.writeFileSync(
      path.join(quarantineDir, outName),
      `${candidate.header}\n\n${stripExistingHeader(body).replace(/^\s*\n/, "")}`,
      "utf8",
    );
    report.quarantined += 1;
    report.conflicts.push({ id: meta.id, title: meta.title, author: meta.author, url: meta.url, file: outName, claims });
  } else {
    const group = eligibleBySemanticHash.get(candidate.cube.semanticHash) || [];
    group.push(candidate);
    eligibleBySemanticHash.set(candidate.cube.semanticHash, group);
  }
}

for (const group of eligibleBySemanticHash.values()) {
  const canonical = group[0];
  const duplicates = group.slice(1).map(({ meta, sourceRel, sourceHash }) => ({
    id: meta.id, title: meta.title, url: meta.url, sourceFile: sourceRel, sourceSha256: sourceHash,
  }));
  const { header, blocked, transfer } = buildHeader(
    canonical.meta, canonical.body, canonical.sourceRel, canonical.sourceHash, duplicates,
  );
  fs.writeFileSync(
    path.join(outDir, canonical.outName),
    `${header}\n\n${stripExistingHeader(canonical.body).replace(/^\s*\n/, "")}`,
    "utf8",
  );
  report.written += 1;
  if (blocked) report.blockedOnColorSpace += 1;
  report.byGamma[canonical.meta.gamma || "(none)"] = (report.byGamma[canonical.meta.gamma || "(none)"] || 0) + 1;
  report.byTransfer[transfer] = (report.byTransfer[transfer] || 0) + 1;
  if (duplicates.length) {
    report.duplicateFiles += duplicates.length;
    report.duplicateGroups.push({
      semanticSha256: canonical.cube.semanticHash,
      canonical: { id: canonical.meta.id, title: canonical.meta.title, url: canonical.meta.url },
      duplicates,
    });
  }
}

// A manifest of exactly what was withheld and why, so the decision is reviewable
// rather than buried in a folder.
fs.writeFileSync(
  path.join(quarantineDir, "CONFLICTS.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: report.conflicts.length, conflicts: report.conflicts }, null, 2),
  "utf8",
);

fs.writeFileSync(path.join(root, "submissions-raw", "freshluts-import-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({
  total: report.total,
  written: report.written,
  quarantined: report.quarantined,
  skipped: report.skipped.length,
  duplicateFiles: report.duplicateFiles,
  duplicateGroups: report.duplicateGroups.length,
  blockedOnColorSpace: report.blockedOnColorSpace,
  byGamma: report.byGamma,
  outDir: path.relative(root, outDir),
  quarantineDir: path.relative(root, quarantineDir),
}, null, 2));
