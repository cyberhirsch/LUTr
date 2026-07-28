// Minimal 8-bit RGB PNG encoder with adaptive per-row filtering.
//
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
// consistently beat a fixed "None" filter.
//
// Shared by scripts/build-preview-assets.mjs (the offline catalog build) and
// server/atlas.mjs (per-submission atlas generation) so there is exactly one
// PNG encoder, not two that could quietly drift.
import zlib from "node:zlib";

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

export function encodePng(width, height, rgb) {
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

// Fixed layout used for every LUTr preview atlas: a size^3 grid flattened at
// a constant width. Shared so the server and the offline build always agree
// on how a given LUT's atlas is shaped without either hardcoding the other's
// constant.
export const ATLAS_WIDTH = 512;

export function buildAtlasPng(size, sampleAt) {
  const texelCount = size ** 3;
  const width = Math.min(ATLAS_WIDTH, texelCount);
  const height = Math.ceil(texelCount / width);
  const rgb = Buffer.alloc(width * height * 3); // zero-filled; unused trailing texels stay black and are never addressed
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const index = r + size * g + size * size * b;
        const sampled = sampleAt(r, g, b);
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
