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

const root = process.cwd();
const siteDir = path.join(root, "site");
const lutDir = path.join(siteDir, "assets", "luts");
const atlasDir = path.join(siteDir, "assets", "atlas");
const manifestFile = path.join(siteDir, "data", "cube-manifest.json");

const ATLAS_SIZE = 33; // grid resolution baked into every preview atlas
const ATLAS_WIDTH = 512; // fixed layout width; matches lut-renderer.js's own atlas sizing convention
const force = process.argv.includes("--force");
const forceAtlas = force || process.argv.includes("--force-atlas");

fs.mkdirSync(atlasDir, { recursive: true });

// --- minimal PNG encoder (8-bit RGB, adaptive per-row filtering, single IDAT)
// No external dependency exists in this project (no package.json); PNG's
// container is simple enough that a hand-rolled encoder is less risk than
// adding one. CRC-32, the chunk layout, and the five filter types below
// follow the public PNG specification exactly; zlib.deflateSync already
// produces the zlib-wrapped stream (RFC 1950) that an IDAT chunk requires.
//
// Every scanline picks whichever of the spec's five filters (None, Sub, Up,
// Average, Paeth) minimizes the sum of absolute values of the filtered
// bytes (interpreted as signed) -- the "minimum sum of absolute differences"
// heuristic the PNG spec itself recommends for encoders. LUT atlas data is
// smooth (neighbouring grid entries are near-identical colors), so Paeth/Up
// consistently beat the fixed "None" filter this encoder used previously.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Sum of absolute values, treating each byte as signed (-128..127) -- the
// heuristic score the spec recommends for choosing a filter per row.
function absSum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    sum += value < 128 ? value : 256 - value;
  }
  return sum;
}

function filterRow(current, prior, bpp) {
  const stride = current.length;
  const candidates = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  const [none, sub, up, average, paeth] = candidates;
  for (let i = 0; i < stride; i += 1) {
    const x = current[i];
    const a = i >= bpp ? current[i - bpp] : 0; // left
    const b = prior ? prior[i] : 0; // up
    const c = prior && i >= bpp ? prior[i - bpp] : 0; // upper-left
    none[i] = x;
    sub[i] = (x - a) & 0xff;
    up[i] = (x - b) & 0xff;
    average[i] = (x - ((a + b) >> 1)) & 0xff;
    paeth[i] = (x - paethPredictor(a, b, c)) & 0xff;
  }
  let bestType = 0;
  let bestScore = absSum(none);
  for (let type = 1; type < candidates.length; type += 1) {
    const score = absSum(candidates[type]);
    if (score < bestScore) { bestScore = score; bestType = type; }
  }
  return { type: bestType, bytes: candidates[bestType] };
}

function encodePng(width, height, rgb) {
  const bpp = 3; // bytes per pixel: 8-bit RGB, no alpha
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (1 + stride));
  let prior = null;
  for (let y = 0; y < height; y += 1) {
    const current = rgb.subarray(y * stride, (y + 1) * stride);
    const { type, bytes } = filterRow(current, prior, bpp);
    const rowStart = y * (1 + stride);
    raw[rowStart] = type;
    bytes.copy(raw, rowStart + 1);
    prior = current;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB, no alpha
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // compression/filter/interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- atlas sampling ----------------------------------------------------

function buildAtlas(lut) {
  const texelCount = ATLAS_SIZE ** 3;
  const width = Math.min(ATLAS_WIDTH, texelCount);
  const height = Math.ceil(texelCount / width);
  const rgb = Buffer.alloc(width * height * 3); // zero-filled; unused trailing texels stay black and are never addressed
  for (let b = 0; b < ATLAS_SIZE; b += 1) {
    for (let g = 0; g < ATLAS_SIZE; g += 1) {
      for (let r = 0; r < ATLAS_SIZE; r += 1) {
        const index = r + ATLAS_SIZE * g + ATLAS_SIZE * ATLAS_SIZE * b;
        const input = [r, g, b].map((value) => value / (ATLAS_SIZE - 1));
        const sampled = sampleLut(lut, input);
        const offset = index * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          const clamped = Math.max(0, Math.min(1, sampled[channel]));
          rgb[offset + channel] = Math.round(clamped * 255);
        }
      }
    }
  }
  return encodePng(width, height, rgb);
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
