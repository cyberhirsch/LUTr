// Two additive passes over the canonical CUBEs already produced by
// convert-all-to-cube.mjs, run after it and before build-prototype.mjs:
//
//   1. gzip each <id>.cube to <id>.cube.gz (site/assets/luts/ is a 1 GB
//      GitHub Pages budget; a plaintext cube catalog exceeds it, the
//      gzipped one does not). The plaintext .cube stays on disk as a local
//      build artifact -- see .gitignore -- but only the .gz is tracked and
//      deployed.
//   2. bake a fixed-size 8-bit PNG "hald" atlas per LUT for card thumbnails,
//      so a catalog page renders from ~50 KB textures instead of fetching
//      and parsing a full-precision cube per card. The viewer and downloads
//      keep reading the full cube untouched -- this tier exists only for
//      the grid.
//
// Reuses parseCube/sampleLut from site/lut-io.js rather than reimplementing
// cube sampling a third time; those functions are pure (no browser APIs) and
// already the single source of truth for CUBE parsing on the client.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseCube, sampleLut } from "../site/lut-io.js";
import { buildAtlasPng } from "./lib/png.mjs";

const root = process.cwd();
const siteDir = path.join(root, "site");
const lutDir = path.join(siteDir, "assets", "luts");
const atlasDir = path.join(siteDir, "assets", "atlas");
const manifestFile = path.join(siteDir, "data", "cube-manifest.json");

const ATLAS_SIZE = 33; // grid resolution baked into every preview atlas
const force = process.argv.includes("--force");
const forceAtlas = force || process.argv.includes("--force-atlas");

fs.mkdirSync(atlasDir, { recursive: true });

// PNG encoding lives in ./lib/png.mjs -- shared with server/atlas.mjs, which
// bakes the same kind of atlas for a single freshly submitted LUT instead of
// the whole catalog.
function buildAtlas(lut) {
  return buildAtlasPng(ATLAS_SIZE, (r, g, b) => sampleLut(lut, [r, g, b].map((value) => value / (ATLAS_SIZE - 1))));
}

// --- main pass -----------------------------------------------------------

if (!fs.existsSync(manifestFile)) {
  throw new Error("Missing site/data/cube-manifest.json; run scripts/convert-all-to-cube.mjs first");
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));

let gzipWritten = 0;
let gzipSkipped = 0;
let atlasWritten = 0;
let atlasSkipped = 0;
const failures = [];
let plaintextBytes = 0;
let gzipBytes = 0;
let atlasBytes = 0;

for (const lut of manifest.luts) {
  const cubeFile = path.join(siteDir, ...lut.clientLut.split("/"));
  if (!fs.existsSync(cubeFile)) {
    failures.push({ id: lut.id, error: `missing canonical CUBE: ${lut.clientLut}` });
    continue;
  }
  const cubeBuffer = fs.readFileSync(cubeFile);
  plaintextBytes += cubeBuffer.length;

  const gzFile = `${cubeFile}.gz`;
  if (force || !fs.existsSync(gzFile) || fs.statSync(gzFile).mtimeMs < fs.statSync(cubeFile).mtimeMs) {
    fs.writeFileSync(gzFile, zlib.gzipSync(cubeBuffer, { level: 9 }));
    gzipWritten += 1;
  } else {
    gzipSkipped += 1;
  }
  gzipBytes += fs.statSync(gzFile).size;

  const atlasFile = path.join(atlasDir, `${lut.id}.png`);
  if (forceAtlas || !fs.existsSync(atlasFile)) {
    try {
      const parsed = parseCube(cubeBuffer.toString("utf8"));
      const png = buildAtlas(parsed);
      fs.writeFileSync(atlasFile, png);
      atlasWritten += 1;
      atlasBytes += png.length;
    } catch (error) {
      failures.push({ id: lut.id, error: `atlas generation failed: ${error.message}` });
      continue;
    }
  } else {
    atlasSkipped += 1;
    atlasBytes += fs.statSync(atlasFile).size;
  }

  lut.previewAtlas = `assets/atlas/${lut.id}.png`;
  lut.previewAtlasSize = ATLAS_SIZE;
}

fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

const report = {
  total: manifest.luts.length,
  gzipWritten, gzipSkipped, atlasWritten, atlasSkipped,
  failed: failures.length, failures,
  plaintextBytes, gzipBytes, atlasBytes,
};
fs.writeFileSync(
  path.join(siteDir, "data", "preview-asset-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(JSON.stringify({
  ...report,
  plaintextMB: (plaintextBytes / 1024 / 1024).toFixed(1),
  gzipMB: (gzipBytes / 1024 / 1024).toFixed(1),
  atlasMB: (atlasBytes / 1024 / 1024).toFixed(1),
}, null, 2));
if (failures.length) process.exitCode = 1;
