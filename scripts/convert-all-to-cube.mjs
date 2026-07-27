import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const submissions = path.join(root, "submissions");
const outputDir = path.join(root, "site", "assets", "luts");
const manifestFile = path.join(root, "site", "data", "cube-manifest.json");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const generatedDate = new Date().toISOString().slice(0, 10);
const retrievedDate = "2026-07-27";
const toolVersion = "2.0.0";
const validColorSpaces = new Set([
  "srgb", "rec709", "rec709-gamma24", "linear-rec709", "display-p3",
  "linear-p3", "rec2020-gamma24", "linear-rec2020", "acescg", "aces2065-1",
]);
const offsetArg = process.argv.find((value) => value.startsWith("--offset="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const sourceOffset = Math.max(0, Number(offsetArg?.split("=")[1] || 0));
const sourceLimit = Math.max(1, Number(limitArg?.split("=")[1] || Number.MAX_SAFE_INTEGER));
const partialRun = Boolean(offsetArg || limitArg);

const collections = {
  "stripedpurple-color-grading-luts": {
    name: "Striped Purple", source: "https://github.com/stripedpurple/color-grading-luts",
    license: "MIT", licenseUrl: "https://github.com/stripedpurple/color-grading-luts/blob/master/LICENSE",
    transformClass: "creative-look", tags: ["creative", "stylized", "color-grading"],
    input: "srgb", output: "srgb", confidence: "assumed-display-referred", licenseBasis: "repo-license-file",
  },
  "ircgraphic-d-cinelike-blockbuster": {
    name: "DJI Blockbuster", source: "https://github.com/IRCGraphic/D-Cinelike-and-Normal-Blockbuster-LUTs",
    license: "CC0-1.0", licenseUrl: "https://github.com/IRCGraphic/D-Cinelike-and-Normal-Blockbuster-LUTs/blob/main/LICENSE",
    transformClass: "creative-look", tags: ["creative", "camera", "dji", "d-cinelike", "cinematic"],
    input: null, output: "srgb", confidence: "camera-profile-input-required", licenseBasis: "repo-license-file",
  },
  "jonmatifa-a6000-luts": {
    name: "Sony a6000", source: "https://github.com/jonmatifa/a6000-LUTs",
    license: "CC0-1.0", licenseUrl: "https://github.com/jonmatifa/a6000-LUTs/blob/master/LICENSE",
    transformClass: "camera-transform", tags: ["camera", "sony", "a6000", "log"],
    input: null, output: null, confidence: "unverified", licenseBasis: "repo-license-file",
  },
  "christophwurst-haldclut": {
    name: "ChristophWurst Hald", source: "https://github.com/ChristophWurst/haldclut",
    license: "CC-BY-SA-4.0", licenseUrl: "https://github.com/ChristophWurst/haldclut/blob/master/LICENSE",
    transformClass: "creative-look", tags: ["creative", "hald-clut", "rawtherapee"],
    input: "srgb", output: "srgb", confidence: "assumed-display-referred", licenseBasis: "repo-license-file",
  },
  "sguyader-filmsim": {
    name: "FilmSim", source: "https://github.com/sguyader/FilmSim",
    license: "CC0-1.0", licenseUrl: "https://github.com/sguyader/FilmSim/blob/master/LICENSE",
    transformClass: "film-emulation", tags: ["creative", "film", "film-emulation", "hald-clut"],
    input: "srgb", output: "srgb", confidence: "assumed-display-referred", licenseBasis: "repo-license-file",
  },
  "sverit-hdr2sdr-luts": {
    name: "HDR2SDR", source: "https://github.com/sverit/HDR2SDR-LUTs",
    license: "GPL-3.0", licenseUrl: "https://github.com/sverit/HDR2SDR-LUTs/blob/main/LICENSE",
    transformClass: "tone-map", tags: ["technical", "hdr", "sdr", "tone-map"],
    input: null, output: null, confidence: "unverified", licenseBasis: "repo-license-file",
  },
  "videovillage-red-conversion-luts": {
    name: "RED Conversion", source: "https://github.com/videovillage/RED-Conversion-LUTs",
    license: "MIT", licenseUrl: "https://github.com/videovillage/RED-Conversion-LUTs/blob/master/LICENSE.md",
    transformClass: "camera-transform", tags: ["technical", "camera", "red", "redlogfilm"],
    input: null, output: null, confidence: "unverified", licenseBasis: "repo-license-file",
  },
  "lauloque-linear-to-blender-filmic": {
    name: "Blender Filmic", source: "https://github.com/Lauloque/LUTs-Linear-to-Blender-s-Filmic-sRGB",
    license: "GPL-3.0", licenseUrl: "https://github.com/Lauloque/LUTs-Linear-to-Blender-s-Filmic-sRGB/blob/master/LICENSE",
    transformClass: "display-transform", tags: ["technical", "linear", "blender-filmic", "srgb", "display-transform"],
    input: "linear-rec709", output: "srgb", confidence: "documented-primaries-assumed", licenseBasis: "repo-license-file",
  },
  "natron-haldclut-presets": {
    name: "Natron HaldCLUT", source: "https://github.com/NatronGitHub/clut",
    license: "CC-BY-SA-4.0", licenseUrl: "https://github.com/NatronGitHub/clut#license",
    transformClass: "film-emulation", tags: ["creative", "film", "film-emulation", "hald-clut", "natron"],
    input: "srgb", output: "srgb", confidence: "assumed-display-referred", licenseBasis: "repo-license-file",
  },
  "vfxwiki-arri-alexa-luts": {
    name: "ARRI Alexa", source: "https://github.com/vfxwiki/ArriAlexaLuts",
    license: "LGPL-3.0", licenseUrl: "https://github.com/vfxwiki/ArriAlexaLuts/blob/master/LICENSE",
    transformClass: "camera-transform", tags: ["technical", "camera", "arri", "alexa", "logc"],
    input: null, output: "srgb", confidence: "camera-profile-input-required", licenseBasis: "repo-license-file",
  },
  "andrewwillmott-colour-blind-luts": {
    name: "Colour-Blind LUTs", source: "https://github.com/andrewwillmott/colour-blind-luts",
    license: "Unlicense", licenseUrl: "https://github.com/andrewwillmott/colour-blind-luts/blob/master/LICENSE",
    transformClass: "accessibility", tags: ["technical", "accessibility", "color-vision", "simulation", "correction"],
    input: "srgb", output: "srgb", confidence: "assumed-display-referred", licenseBasis: "repo-license-file",
  },
  "aswf-opencolorio-config-aces": {
    name: "OCIO ACES", source: "https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES",
    license: "BSD-3-Clause", licenseUrl: "https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/LICENSE",
    transformClass: "color-space-conversion", tags: ["technical", "aces", "ocio", "clf", "color-management"],
    input: null, output: null, confidence: "descriptor-only", licenseBasis: "repo-license-file",
  },
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name.endsWith(".info.md")) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function slug(value) {
  return value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase()
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 72);
}

function shortHash(value) {
  return sha256(value).slice(0, 9);
}

function cleanTitle(file, content = "") {
  const embedded = content.match(/^\s*TITLE\s+"([^"]+)"/im)?.[1];
  const base = embedded && !/^(generated by resolve|untitled)$/i.test(embedded.trim())
    ? embedded : path.basename(file, path.extname(file));
  return base.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function filenameTags(title) {
  const lower = title.toLowerCase();
  const tags = [];
  const rules = [
    ["black-and-white", /\b(bw|b&w|black.?and.?white|mono|monochrome|acros|neopan|apx)\b/],
    ["warm", /\b(warm|orange|amber|gold|sunset|sepia)\b/],
    ["cool", /\b(cool|cold|blue|cyan)\b/],
    ["high-contrast", /\b(high|strong|hard)[ -]?contrast\b/],
    ["low-contrast", /\b(low|soft)[ -]?contrast\b/],
    ["vintage", /\b(vintage|retro|old|faded|instant)\b/],
    ["cinematic", /\b(cine|cinematic|blockbuster|film)\b/],
    ["simulation", /\b(simulate|simulation)\b/],
    ["correction", /\b(correct|correction|daltonise)\b/],
    ["protanopia", /protan/], ["deuteranopia", /deuter/], ["tritanopia", /tritan/],
    ["hdr", /\bhdr\b/], ["sdr", /\bsdr\b/],
  ];
  for (const [tag, pattern] of rules) if (pattern.test(lower)) tags.push(tag);
  return tags;
}

function sidecarMeta(file) {
  const sidecar = `${file}.info.md`;
  if (!fs.existsSync(sidecar)) return {};
  const text = fs.readFileSync(sidecar, "utf8");
  const field = (name) => text.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, "im"))?.[1]?.trim();
  return {
    source: field("Source"), license: field("License"),
    licenseUrl: field("License URL"), attribution: field("Attribution"),
    assetUrl: field("Asset URL"), author: field("Author"), authorUrl: field("Author URL"),
    retrieved: field("Retrieved"), licenseBasis: field("License Basis"),
    tags: field("Tags")?.split(",").map((value) => value.trim()).filter(Boolean) || [],
  };
}

function parseLutrHeader(content) {
  const fields = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("#")) break;
    const match = line.match(/^#\s*LUTr-([A-Za-z0-9-]+):\s*(.*)$/);
    if (match) fields.set(match[1], match[2].trim());
  }
  return fields;
}

function normalizedColorSpace(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return validColorSpaces.has(normalized) ? normalized : "";
}

function identitySlug(value) {
  return value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase()
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}

function stableId(header, parsed, sourceSha) {
  if (header.get("Schema-Version") === "2" && header.get("ID")) return header.get("ID");
  if (parsed.upstreamId) return `upstream-${identitySlug(parsed.upstreamId)}--${shortHash(parsed.upstreamId)}`;
  return `sha256-${sourceSha}`;
}

function colorParts(id) {
  return {
    srgb: ["rec709", "srgb"], rec709: ["rec709", "rec709"],
    "rec709-gamma24": ["rec709", "gamma24"], "linear-rec709": ["rec709", "linear"],
    "display-p3": ["display-p3", "srgb"], "linear-p3": ["display-p3", "linear"],
    "rec2020-gamma24": ["rec2020", "gamma24"], "linear-rec2020": ["rec2020", "linear"],
    acescg: ["aces-ap1", "linear"], "aces2065-1": ["aces-ap0", "linear"],
  }[id] || ["unspecified", "unspecified"];
}

function descriptorParts(descriptor = "") {
  const value = descriptor.toLowerCase();
  let gamut = "unspecified";
  if (/aces2065|ap0/.test(value)) gamut = "aces-ap0";
  else if (/ap1|acescg/.test(value)) gamut = "aces-ap1";
  else if (/rec\.? ?709/.test(value)) gamut = "rec709";
  else if (/rec\.? ?2020/.test(value)) gamut = "rec2020";
  else if (/p3/.test(value)) gamut = "display-p3";
  else if (/adobe ?rgb/.test(value)) gamut = "adobe-rgb";
  else if (/arri wide gamut 4/.test(value)) gamut = "arri-wide-gamut-4";
  else if (/arri wide gamut 3/.test(value)) gamut = "arri-wide-gamut-3";
  else if (/blackmagic wide gamut/.test(value)) gamut = "blackmagic-wide-gamut";
  else if (/davinci wide gamut/.test(value)) gamut = "davinci-wide-gamut";
  else if (/cinema gamut/.test(value)) gamut = "canon-cinema-gamut";
  else if (/d-gamut/.test(value)) gamut = "dji-d-gamut";
  else if (/v-gamut/.test(value)) gamut = "panasonic-v-gamut";
  else if (/redwidegamut/.test(value)) gamut = "red-wide-gamut-rgb";
  else if (/venice s-gamut3\.cine/.test(value)) gamut = "sony-venice-s-gamut3-cine";
  else if (/venice s-gamut3/.test(value)) gamut = "sony-venice-s-gamut3";
  else if (/s-gamut3\.cine/.test(value)) gamut = "sony-s-gamut3-cine";
  else if (/s-gamut3/.test(value)) gamut = "sony-s-gamut3";
  else if (/s-gamut/.test(value)) gamut = "sony-s-gamut";

  let transfer = "unspecified";
  if (/linear/.test(value)) transfer = "linear";
  else if (/apple log/.test(value)) transfer = "apple-log";
  else if (/logc3/.test(value)) transfer = "arri-logc3-ei800";
  else if (/logc4/.test(value)) transfer = "arri-logc4";
  else if (/blackmagic film/.test(value)) transfer = "blackmagic-film-gen5";
  else if (/davinci intermediate/.test(value)) transfer = "davinci-intermediate";
  else if (/clog ?2|canon log 2/.test(value)) transfer = "canon-log2";
  else if (/clog ?3|canon log 3/.test(value)) transfer = "canon-log3";
  else if (/d-log/.test(value)) transfer = "dji-d-log";
  else if (/v-log/.test(value)) transfer = "panasonic-v-log";
  else if (/log3g10/.test(value)) transfer = "red-log3g10";
  else if (/s-log2/.test(value)) transfer = "sony-s-log2";
  else if (/s-log3/.test(value)) transfer = "sony-s-log3";
  else if (/srgb/.test(value)) transfer = "srgb";
  else if (/rec\.? ?709 camera oetf/.test(value)) transfer = "rec709";
  else if (/1\.8 gamma/.test(value)) transfer = "gamma18";
  else if (/2\.2 gamma/.test(value)) transfer = "gamma22";
  else if (/2\.4 gamma|rec\.?1886/.test(value)) transfer = "gamma24";
  else if (/2084|pq/.test(value)) transfer = "pq";
  return [gamut, transfer];
}

function descriptorColorSpace(descriptor = "") {
  const value = descriptor.trim().toLowerCase();
  if (value === "aces2065-1") return "aces2065-1";
  if (value === "srgb" || value === "srgb encoded rgb") return "srgb";
  if (/^linear p3 primaries/.test(value)) return "linear-p3";
  if (/^linear rec\.?2020 primaries/.test(value)) return "linear-rec2020";
  if (/^linear rec\.?709 primaries/.test(value)) return "linear-rec709";
  if (/^2\.4 gamma-corrected rec\.?709 primaries/.test(value)) return "rec709-gamma24";
  if (/^rec\.?709 camera oetf rec\.?709 primaries/.test(value)) return "rec709";
  return "";
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function sample1D(values, value, channel) {
  const position = clamp(value) * (values.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, values.length - 1);
  const amount = position - lower;
  return values[lower][channel] + (values[upper][channel] - values[lower][channel]) * amount;
}

function sample3D(lut, color) {
  const point = color.map((value, channel) => {
    const min = lut.domainMin?.[channel] ?? 0;
    const max = lut.domainMax?.[channel] ?? 1;
    return clamp((value - min) / (max - min)) * (lut.size - 1);
  });
  const lower = point.map(Math.floor);
  const upper = lower.map((value) => Math.min(value + 1, lut.size - 1));
  const amount = point.map((value, channel) => value - lower[channel]);
  const read = (r, g, b) => lut.values[r + lut.size * g + lut.size * lut.size * b];
  const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);
  const c00 = mix(read(lower[0], lower[1], lower[2]), read(upper[0], lower[1], lower[2]), amount[0]);
  const c10 = mix(read(lower[0], upper[1], lower[2]), read(upper[0], upper[1], lower[2]), amount[0]);
  const c01 = mix(read(lower[0], lower[1], upper[2]), read(upper[0], lower[1], upper[2]), amount[0]);
  const c11 = mix(read(lower[0], upper[1], upper[2]), read(upper[0], upper[1], upper[2]), amount[0]);
  return mix(mix(c00, c10, amount[1]), mix(c01, c11, amount[1]), amount[2]);
}

function resample(lut, size) {
  const values = [];
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    values.push(sample3D(lut, [r, g, b].map((value) => value / (size - 1))));
  }
  return { size, values, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
}

function parseCube(text) {
  const size3d = Number(text.match(/^\s*LUT_3D_SIZE\s+(\d+)/im)?.[1] || 0);
  const size1d = Number(text.match(/^\s*LUT_1D_SIZE\s+(\d+)/im)?.[1] || 0);
  const size = size3d || size1d;
  if (!size) throw new Error("Missing CUBE size");
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    if (!/^[-+]?(?:\d|\.\d)/.test(clean)) continue;
    const row = clean.split(/\s+/).slice(0, 3).map(Number);
    if (row.length === 3 && row.every(Number.isFinite)) values.push(row);
  }
  return {
    kind: size3d ? "3D" : "1D", size, values,
    originalGrid: size3d ? `${size}x${size}x${size}` : `${size}`,
    domainMin: (text.match(/^\s*DOMAIN_MIN\s+(.+)$/im)?.[1] || "0 0 0").trim().split(/\s+/).map(Number),
    domainMax: (text.match(/^\s*DOMAIN_MAX\s+(.+)$/im)?.[1] || "1 1 1").trim().split(/\s+/).map(Number),
  };
}

function parse3dl(text) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
  const shaper = lines.shift().split(/\s+/).map(Number);
  const size = shaper.length;
  const rows = lines.map((line) => line.split(/\s+/).slice(0, 3).map(Number)).filter((row) => row.length === 3);
  if (rows.length < size ** 3) throw new Error(`Invalid 3DL: expected ${size ** 3} rows`);
  const scale = Math.max(...rows.flat()) <= 4095 ? 4095 : 65535;
  const source = [];
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    source.push(rows[b + size * g + size * size * r].map((value) => value / scale));
  }
  const sourceLut = { size, values: source, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
  const maxShaper = shaper.at(-1);
  const mapAxis = (value) => {
    const target = value * maxShaper;
    let upper = shaper.findIndex((node) => node >= target);
    if (upper <= 0) return upper < 0 ? 1 : 0;
    const lower = upper - 1;
    return (lower + (target - shaper[lower]) / (shaper[upper] - shaper[lower])) / (size - 1);
  };
  const values = [];
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    values.push(sample3D(sourceLut, [r, g, b].map((value) => mapAxis(value / (size - 1)))));
  }
  return {
    kind: "3D", size, values, originalGrid: `${size}x${size}x${size}`,
    domainMin: [0, 0, 0], domainMax: [1, 1, 1],
    shaper: `${size}-node integer input shaper from 3DL`,
    interpolation: "linear",
  };
}

function parseAttributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function decodeXml(text = "") {
  return text.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function floatToHalfBits(value) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false);
  const bits = view.getUint32(0, false);
  const sign = (bits >>> 16) & 0x8000;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let mantissa = bits & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    mantissa = (mantissa | 0x800000) >>> (1 - exponent);
    return sign | ((mantissa + 0x1000) >>> 13);
  }
  if (exponent >= 31) return sign | 0x7c00;
  return sign | (exponent << 10) | ((mantissa + 0x1000) >>> 13);
}

function parseClf(text) {
  const rootAttrs = parseAttributes(text.match(/<ProcessList\b([^>]*)>/)?.[1] || "");
  const descriptor = (tag) => decodeXml(text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() || "");
  const operations = [];
  const operationPattern = /<(Matrix|Log|Exponent|LUT1D)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const match of text.matchAll(operationPattern)) {
    const [, type, attrText, body] = match;
    const attrs = parseAttributes(attrText);
    if (type === "Matrix") {
      const array = body.match(/<Array\b([^>]*)>([\s\S]*?)<\/Array>/);
      operations.push({ type, matrix: array[2].trim().split(/\s+/).map(Number), dimensions: parseAttributes(array[1]).dim });
    } else if (type === "Log") {
      operations.push({ type, style: attrs.style, params: parseAttributes(body.match(/<LogParams\b([^>]*)\/>/)?.[1] || "") });
    } else if (type === "Exponent") {
      operations.push({ type, style: attrs.style, params: parseAttributes(body.match(/<ExponentParams\b([^>]*)\/>/)?.[1] || "") });
    } else {
      const array = body.match(/<Array\b([^>]*)>([\s\S]*?)<\/Array>/);
      operations.push({
        type, halfDomain: attrs.halfDomain === "true",
        values: array[2].trim().split(/\s+/).map(Number),
        dimensions: parseAttributes(array[1]).dim,
      });
    }
  }

  const applyLog = (value, operation) => {
    const p = Object.fromEntries(Object.entries(operation.params).map(([key, item]) => [key, Number(item)]));
    const base = p.base || 2;
    if (operation.style !== "cameraLogToLin") throw new Error(`Unsupported CLF Log style: ${operation.style}`);
    const breakPoint = p.linSideBreak ?? 0;
    const logAtBreak = p.logSideSlope * (Math.log(p.linSideSlope * breakPoint + p.linSideOffset) / Math.log(base)) + p.logSideOffset;
    const linearSlope = p.linearSlope || (p.logSideSlope * p.linSideSlope) /
      (Math.log(base) * (p.linSideSlope * breakPoint + p.linSideOffset));
    return value >= logAtBreak
      ? (base ** ((value - p.logSideOffset) / p.logSideSlope) - p.linSideOffset) / p.linSideSlope
      : breakPoint + (value - logAtBreak) / linearSlope;
  };

  const applyExponent = (value, operation) => {
    const exponent = Number(operation.params.exponent);
    const offset = Number(operation.params.offset || 0);
    if (operation.style === "basicPassThruRev") return value < 0 ? value : value ** (1 / exponent);
    if (operation.style === "monCurveRev") {
      const breakPoint = offset / (exponent - 1);
      const slope = ((exponent - 1) / offset) ** (exponent - 1) * (exponent / (1 + offset)) ** exponent;
      const encodedBreak = breakPoint * slope;
      return value <= encodedBreak ? value / slope : (1 + offset) * Math.max(value, 0) ** (1 / exponent) - offset;
    }
    throw new Error(`Unsupported CLF Exponent style: ${operation.style}`);
  };

  const apply = (input) => {
    let value = [...input];
    for (const operation of operations) {
      if (operation.type === "Matrix") {
        const m = operation.matrix;
        value = [
          m[0] * value[0] + m[1] * value[1] + m[2] * value[2],
          m[3] * value[0] + m[4] * value[1] + m[5] * value[2],
          m[6] * value[0] + m[7] * value[1] + m[8] * value[2],
        ];
      } else if (operation.type === "Log") {
        value = value.map((channel) => applyLog(channel, operation));
      } else if (operation.type === "Exponent") {
        value = value.map((channel) => applyExponent(channel, operation));
      } else {
        const count = Number(operation.dimensions.split(/\s+/)[0]);
        value = value.map((channel) => operation.halfDomain
          ? operation.values[floatToHalfBits(channel)]
          : sample1D(operation.values.map((entry) => [entry, entry, entry]), channel, 0));
        if (operation.values.length !== count) throw new Error("Invalid CLF LUT1D array");
      }
    }
    return value;
  };

  const size = 33;
  const values = [];
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    values.push(apply([r, g, b].map((value) => value / (size - 1))));
  }
  return {
    kind: "3D", size, values, domainMin: [0, 0, 0], domainMax: [1, 1, 1],
    originalGrid: operations.find((operation) => operation.type === "LUT1D")
      ?.dimensions?.split(/\s+/)[0] || "analytic",
    upstreamId: rootAttrs.id || null, upstreamName: rootAttrs.name || null,
    inputDescriptor: descriptor("InputDescriptor") || null,
    outputDescriptor: descriptor("OutputDescriptor") || null,
    builtinTransform: descriptor("BuiltinTransform") || null,
    operations: operations.map((operation) => operation.type).join(" -> "),
    upstreamDomain: "unbounded",
    interpolation: "linear",
  };
}

function parseCsp(text) {
  const metadata = text.match(/BEGIN METADATA([\s\S]*?)END METADATA/)?.[1]?.trim() || null;
  const body = text.replace(/[\s\S]*?END METADATA/, "").trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pre = [];
  let cursor = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const count = Number(body[cursor++]);
    const inputs = body[cursor++].split(/\s+/).map(Number);
    const outputs = body[cursor++].split(/\s+/).map(Number);
    if (inputs.length !== count || outputs.length !== count) throw new Error("Invalid CSP pre-LUT");
    pre.push({ inputs, outputs });
  }
  const dimensions = body[cursor++].split(/\s+/).map(Number);
  if (!dimensions.every((value) => value === dimensions[0])) throw new Error("Non-cubic CSP is unsupported");
  const size = dimensions[0];
  const sourceValues = body.slice(cursor).map((line) => line.split(/\s+/).slice(0, 3).map(Number));
  if (sourceValues.length < size ** 3) throw new Error("Invalid CSP 3D array");
  const mapPre = (value, curve) => {
    let upper = curve.inputs.findIndex((node) => node >= value);
    if (upper <= 0) return upper < 0 ? curve.outputs.at(-1) : curve.outputs[0];
    const lower = upper - 1;
    const amount = (value - curve.inputs[lower]) / (curve.inputs[upper] - curve.inputs[lower]);
    return curve.outputs[lower] + (curve.outputs[upper] - curve.outputs[lower]) * amount;
  };
  const source = { size, values: sourceValues, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
  const values = [];
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    const input = [r, g, b].map((value, channel) => mapPre(value / (size - 1), pre[channel]));
    values.push(sample3D(source, input));
  }
  return {
    kind: "3D", size, values, originalGrid: `${size}x${size}x${size}`,
    domainMin: [0, 0, 0], domainMax: [1, 1, 1], upstreamMetadata: metadata,
    shaper: "CSP per-channel pre-LUT baked into the 3D samples",
    interpolation: "trilinear",
  };
}

function imagePixels(file) {
  const probe = spawnSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x", file,
  ], { encoding: "utf8", windowsHide: true });
  if (probe.status !== 0) throw new Error(probe.stderr || `ffprobe failed for ${file}`);
  const [width, height] = probe.stdout.trim().split("x").map(Number);
  const decoded = spawnSync(ffmpeg, [
    "-v", "error", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-",
  ], { encoding: null, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (decoded.status !== 0) throw new Error(decoded.stderr?.toString() || `ffmpeg failed for ${file}`);
  const values = [];
  for (let offset = 0; offset < decoded.stdout.length; offset += 6) {
    values.push([
      decoded.stdout.readUInt16LE(offset) / 65535,
      decoded.stdout.readUInt16LE(offset + 2) / 65535,
      decoded.stdout.readUInt16LE(offset + 4) / 65535,
    ]);
  }
  return { width, height, values };
}

function parseLutImage(file, collectionId) {
  const image = imagePixels(file);
  const cubeSize = Math.round(Math.cbrt(image.width * image.height));
  if (cubeSize ** 3 === image.width * image.height) {
    const lut = {
      kind: "3D", size: cubeSize, values: image.values,
      originalGrid: `${cubeSize}x${cubeSize}x${cubeSize}`,
      domainMin: [0, 0, 0], domainMax: [1, 1, 1],
    };
    const targetSize = collectionId === "andrewwillmott-colour-blind-luts" ? cubeSize : 25;
    return targetSize === cubeSize ? lut : {
      kind: "3D", ...resample(lut, targetSize), originalGrid: lut.originalGrid,
      interpolation: "trilinear",
    };
  }
  if (collectionId === "andrewwillmott-colour-blind-luts" && image.width === 256) {
    const ramp = image.values.slice(0, 256);
    const size = 32;
    const values = [];
    for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / (size - 1);
      const position = luminance * 255;
      const lower = Math.floor(position);
      const upper = Math.min(lower + 1, 255);
      const amount = position - lower;
      values.push(ramp[lower].map((value, channel) => value + (ramp[upper][channel] - value) * amount));
    }
    return {
      kind: "3D", size, values, domainMin: [0, 0, 0], domainMax: [1, 1, 1],
      originalGrid: "256", interpolation: "linear",
      warning: "Source is a 256-sample false-colour ramp; converted as Rec.709 luminance to RGB.",
    };
  }
  throw new Error(`Unrecognized LUT image layout ${image.width}x${image.height}`);
}

function unitDomain(parsed) {
  return parsed.domainMin.every((value) => value === 0)
    && parsed.domainMax.every((value) => value === 1);
}

function canonicalizeCube(parsed) {
  if (parsed.kind === "1D") {
    const size = Math.min(33, parsed.size);
    const values = [];
    for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
      const input = [r, g, b].map((value) => value / (size - 1));
      values.push(input.map((value, channel) => {
        const min = parsed.domainMin[channel] ?? 0;
        const max = parsed.domainMax[channel] ?? 1;
        return sample1D(parsed.values, (value - min) / (max - min), channel);
      }));
    }
    return {
      ...parsed, kind: "3D", size, values, domainMin: [0, 0, 0], domainMax: [1, 1, 1],
      interpolation: "linear",
      canonicalWarning: `A ${parsed.size}-sample 1D CUBE was sampled to ${size}x${size}x${size} for browser-compatible 3D CUBE hosting.`,
    };
  }
  if (!unitDomain(parsed)) {
    return {
      ...parsed, ...resample(parsed, parsed.size), interpolation: "trilinear",
      canonicalWarning: `The source domain ${parsed.domainMin.join(" ")} to ${parsed.domainMax.join(" ")} was normalized to 0..1.`,
    };
  }
  return parsed;
}

function joinWarnings(...warnings) {
  return warnings.filter(Boolean).join(" ");
}

function cubeMetadata(meta, source, parsed, method, warning) {
  const [inputGamut, inputTransfer] = meta.input
    ? colorParts(meta.input) : descriptorParts(parsed.inputDescriptor);
  const [outputGamut, outputTransfer] = meta.output
    ? colorParts(meta.output) : descriptorParts(parsed.outputDescriptor);
  const requiredFields = [
    ["Schema-Version", "2"],
    ["ID", meta.id], ["Title", meta.title], ["Collection", meta.collection.name],
    ["Collection-ID", meta.collectionId], ["Source", meta.source],
    ["Retrieved", meta.retrieved],
    ["Source-File", meta.relativeSource], ["Source-Format", meta.sourceFormat],
    ["Source-SHA256", meta.sourceSha], ["License", meta.license],
    ["License-URL", meta.licenseUrl], ["License-Basis", meta.licenseBasis],
    ["Transform-Class", meta.collection.transformClass], ["Tags", meta.tags.join(", ")],
    ["Input-Color-Space", meta.input],
    ["Input-Gamut", inputGamut], ["Input-Transfer", inputTransfer],
    ["Output-Color-Space", meta.output],
    ["Output-Gamut", outputGamut], ["Output-Transfer", outputTransfer],
    ["Color-Space-Confidence", meta.confidence],
    ["Domain-Normalized", "true"], ["Shaper", parsed.shaper || "none"],
    ["Original-Grid", parsed.originalGrid],
    ["Conversion-Grid", `${parsed.size}x${parsed.size}x${parsed.size}`],
    ["Conversion-Interpolation", parsed.interpolation || "none"],
    ["Conversion-Method", method],
    ["Conversion-Tool", `LUTr scripts/convert-all-to-cube.mjs ${toolVersion}`],
    ["Conversion-Date", generatedDate],
  ];
  const optionalFields = [
    ["Asset-URL", meta.assetUrl], ["Author", meta.author], ["Author-URL", meta.authorUrl],
    ["Attribution", meta.attribution], ["Source-Labels", meta.sourceLabels],
    ["Conversion-Warning", warning],
    ["Upstream-ID", parsed.upstreamId], ["Upstream-Name", parsed.upstreamName],
    ["Upstream-Input-Descriptor", parsed.inputDescriptor],
    ["Upstream-Output-Descriptor", parsed.outputDescriptor],
    ["Upstream-Builtin-Transform", parsed.builtinTransform],
    ["Upstream-Operations", parsed.operations],
    ["Upstream-Domain", parsed.upstreamDomain],
    ["Upstream-Metadata", parsed.upstreamMetadata?.replace(/\s+/g, " ")],
    ["Note", "Preserve this metadata and the upstream license notices when redistributing."],
  ].filter(([, value]) => value != null && value !== "");
  const upstreamComments = source.split(/\r?\n/)
    .filter((line) => /^\s*#/.test(line) && !/^\s*#\s*LUTr-/i.test(line))
    .slice(0, 30)
    .map((line) => `# LUTr-Upstream-Comment: ${line.replace(/^\s*#\s?/, "").trim()}`);
  const line = ([name, value]) => `# LUTr-${name}: ${String(value ?? "").replace(/\r?\n/g, " ")}`;
  return [...requiredFields.map(line), ...optionalFields.map(line), ...upstreamComments].join("\n");
}

function serializeCube(meta, parsed, header) {
  const formatNumber = (value) => Number.isFinite(value)
    ? Number(Number(value).toPrecision(8)).toString()
    : "0";
  const lines = [header, "", `TITLE "${meta.title.replaceAll('"', "'")}"`, `LUT_3D_SIZE ${parsed.size}`];
  lines.push(
    `DOMAIN_MIN ${parsed.domainMin.map(formatNumber).join(" ")}`,
    `DOMAIN_MAX ${parsed.domainMax.map(formatNumber).join(" ")}`,
  );
  for (const row of parsed.values) {
    lines.push(row.map(formatNumber).join(" "));
  }
  return `${lines.join("\n")}\n`;
}

function sourceFiles(collectionId) {
  const dir = path.join(submissions, collectionId);
  return walk(dir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    if ([".cube", ".3dl", ".clf", ".csp"].includes(ext)) return true;
    if (collectionId === "natron-haldclut-presets") return ext === ".png";
    if (["christophwurst-haldclut", "sguyader-filmsim"].includes(collectionId)) return [".tif", ".tiff"].includes(ext);
    if (collectionId === "andrewwillmott-colour-blind-luts") {
      return ext === ".png" && path.basename(path.dirname(file)).toLowerCase() === "luts";
    }
    return false;
  });
}

if (!fs.existsSync(submissions)) throw new Error("The local submissions source library is required");
fs.mkdirSync(outputDir, { recursive: true });
const expected = new Set();
const previousManifest = partialRun && fs.existsSync(manifestFile)
  ? JSON.parse(fs.readFileSync(manifestFile, "utf8")).luts || []
  : [];
const manifestById = new Map(previousManifest.map((lut) => [lut.id, lut]));
const failures = [];

const allSources = Object.entries(collections).flatMap(([collectionId, collection]) =>
  sourceFiles(collectionId).map((file) => ({ collectionId, collection, file })));
const selectedSources = allSources.slice(sourceOffset, sourceOffset + sourceLimit);

for (const { collectionId, collection, file } of selectedSources) {
    const sourceBuffer = fs.readFileSync(file);
    const sourceText = [".cube", ".3dl", ".clf", ".csp"].includes(path.extname(file).toLowerCase())
      ? sourceBuffer.toString("utf8").replace(/^\uFEFF/, "") : "";
    const relativeSource = path.relative(root, file).replaceAll("\\", "/");
    const extension = path.extname(file).toLowerCase();
    const sourceFormat = extension === ".png" ? "HALD-PNG"
      : [".tif", ".tiff"].includes(extension) ? "HALD-TIF"
        : extension.slice(1).toUpperCase();
    const sidecar = sidecarMeta(file);
    const sourceHeader = parseLutrHeader(sourceText);
    const headerValue = (name, fallback = "") => sourceHeader.has(name) ? sourceHeader.get(name) : fallback;
    const title = headerValue("Title", cleanTitle(file, sourceText));
    const input = normalizedColorSpace(headerValue("Input-Color-Space", collection.input));
    const output = normalizedColorSpace(headerValue("Output-Color-Space", collection.output));
    const sourceUrl = headerValue("Source", sidecar.source || collection.source);
    const license = headerValue("License", sidecar.license || collection.license).replace(/\.$/, "");
    const licenseUrl = headerValue("License-URL", sidecar.licenseUrl || collection.licenseUrl);
    const embeddedTags = headerValue("Tags").split(",").map((value) => value.trim()).filter(Boolean);
    const tags = [...new Set([...collection.tags, ...embeddedTags, ...(sidecar.tags || []), ...filenameTags(title), "cube"])];
    const sourceSha = sha256(sourceBuffer);
    const meta = {
      title, collection, collectionId, relativeSource, sourceFormat,
      sourceSha, source: sourceUrl, license, licenseUrl, tags, input, output,
      confidence: headerValue("Color-Space-Confidence", collection.confidence),
      retrieved: headerValue("Retrieved", sidecar.retrieved || retrievedDate),
      licenseBasis: headerValue("License-Basis", sidecar.licenseBasis || collection.licenseBasis),
      assetUrl: headerValue("Asset-URL", sidecar.assetUrl),
      author: headerValue("Author", sidecar.author),
      authorUrl: headerValue("Author-URL", sidecar.authorUrl),
      attribution: headerValue("Attribution", sidecar.attribution),
      sourceLabels: headerValue("Source-Labels"),
    };
    try {
      let parsed;
      let method;
      if (sourceFormat === "CUBE") {
        parsed = parseCube(sourceText);
        method = "Metadata normalization; numeric LUT samples preserved";
      } else if (sourceFormat === "3DL") {
        parsed = parse3dl(sourceText);
        method = "Native 3DL mesh and shaper converted to 3D CUBE";
      } else if (sourceFormat === "CLF") {
        parsed = parseClf(sourceText);
        method = "CLF operations evaluated as float and sampled to 33x33x33 3D CUBE";
      } else if (sourceFormat === "CSP") {
        parsed = parseCsp(sourceText);
        method = "CSP pre-LUT and 3D mesh evaluated at native grid resolution";
      } else {
        parsed = parseLutImage(file, collectionId);
        method = `${sourceFormat} LUT image decoded at 16-bit and sampled to ${parsed.size}x${parsed.size}x${parsed.size} 3D CUBE`;
      }
      const originalParsed = parsed;
      parsed = canonicalizeCube(parsed);
      parsed.originalGrid ||= originalParsed.originalGrid;
      if (!meta.input) meta.input = descriptorColorSpace(parsed.inputDescriptor);
      if (!meta.output) meta.output = descriptorColorSpace(parsed.outputDescriptor);
      if (meta.confidence === "descriptor-only" && meta.input && meta.output) {
        meta.confidence = "declared-by-source";
      }
      if (originalParsed.kind === "1D") {
        method = `Source 1D CUBE sampled to browser-compatible ${parsed.size}x${parsed.size}x${parsed.size} 3D CUBE`;
      } else if (!unitDomain(originalParsed)) {
        method = `${method}; source domain normalized to 0..1`;
      }
      meta.id = stableId(sourceHeader, parsed, sourceSha);
      const id = meta.id;
      const [inputGamut, inputTransfer] = meta.input
        ? colorParts(meta.input) : descriptorParts(parsed.inputDescriptor);
      const [outputGamut, outputTransfer] = meta.output
        ? colorParts(meta.output) : descriptorParts(parsed.outputDescriptor);
      const warning = joinWarnings(
        sourceFormat === "CLF"
          ? "A sampled 3D CUBE is bounded to DOMAIN_MIN/MAX 0..1 and cannot preserve CLF values outside its input domain."
          : null,
        parsed.warning,
        parsed.canonicalWarning,
      );
      const header = cubeMetadata(meta, sourceText, parsed, method, warning);
      const outputFile = path.join(outputDir, `${id}.cube`);
      fs.writeFileSync(outputFile, serializeCube(meta, parsed, header), "utf8");
      expected.add(path.basename(outputFile));
      manifestById.set(id, {
        id, title, collection: collection.name, collectionId,
        transformClass: collection.transformClass, format: "CUBE",
        source: sourceUrl, assetUrl: meta.assetUrl || null,
        author: meta.author || null, authorUrl: meta.authorUrl || null,
        retrieved: meta.retrieved, license, licenseUrl, licenseBasis: meta.licenseBasis,
        attribution: meta.attribution || null, tags,
        sourceFile: relativeSource, sourceFormat, sourceSha256: meta.sourceSha,
        clientLut: `assets/luts/${id}.cube`, clientLutSize: parsed.size,
        cubeKind: parsed.kind, size: parsed.size, inputColorSpace: meta.input || null,
        outputColorSpace: meta.output || null, colorSpaceConfidence: meta.confidence,
        inputGamut, inputTransfer, outputGamut, outputTransfer,
        domainNormalized: true, shaper: parsed.shaper || "none",
        originalGrid: parsed.originalGrid,
        conversionGrid: `${parsed.size}x${parsed.size}x${parsed.size}`,
        conversionInterpolation: parsed.interpolation || "none",
        conversionMethod: method, conversionWarning: warning || null,
        upstreamId: parsed.upstreamId || null,
        inputDescriptor: parsed.inputDescriptor || null,
        outputDescriptor: parsed.outputDescriptor || null,
      });
      if (manifestById.size % 50 === 0) console.log(`CUBE ${manifestById.size}`);
    } catch (error) {
      failures.push({ source: relativeSource, error: String(error.message || error) });
    }
}

if (!partialRun) {
  for (const file of fs.readdirSync(outputDir)) {
    if (!expected.has(file)) {
      const target = path.resolve(outputDir, file);
      if (!target.startsWith(path.resolve(outputDir) + path.sep)) throw new Error(`Refusing to remove ${target}`);
      fs.rmSync(target, { force: true });
    }
  }
}

const manifest = [...manifestById.values()];
manifest.sort((a, b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title));
fs.writeFileSync(manifestFile, JSON.stringify({
  schemaVersion: 2, generatedAt: `${generatedDate}T00:00:00.000Z`,
  total: manifest.length, failures, luts: manifest,
}, null, 2), "utf8");
console.log(JSON.stringify({
  processed: selectedSources.length, convertedTotal: manifest.length,
  sourceTotal: allSources.length, failed: failures.length, outputDir,
}, null, 2));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
