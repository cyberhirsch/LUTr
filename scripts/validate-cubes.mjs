import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseCube } from "../site/lut-io.js";

const root = process.cwd();
const lutDir = path.join(root, "site", "assets", "luts");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site", "data", "cube-manifest.json"), "utf8"));
const submissionsDir = path.join(root, "submissions");
const rawSubmissionsDir = path.join(root, "submissions-raw");
const sourceRoots = [submissionsDir, rawSubmissionsDir];
const sourceRootAvailability = new Map(sourceRoots.map((dir) => [
  dir,
  fs.existsSync(dir) && fs.readdirSync(dir, { withFileTypes: true }).some((entry) => entry.isDirectory()),
]));
const sourceLibraryAvailable = [...sourceRootAvailability.values()].some(Boolean);
const files = fs.readdirSync(lutDir);
const cubeFiles = files.filter((file) => path.extname(file).toLowerCase() === ".cube");
const failures = [];
const required = [
  "Schema-Version", "ID", "Title", "Collection", "Collection-ID",
  "Source", "Retrieved", "Source-File", "Source-Format", "Source-SHA256",
  "License", "License-URL", "License-Basis", "Transform-Class", "Tags",
  "Input-Color-Space", "Input-Gamut", "Input-Transfer",
  "Output-Color-Space", "Output-Gamut", "Output-Transfer",
  "Color-Space-Confidence", "Domain-Normalized", "Shaper", "Original-Grid",
  "Conversion-Grid", "Conversion-Interpolation", "Conversion-Method",
  "Conversion-Tool", "Conversion-Date",
];
const validColorSpaces = new Set([
  "", "srgb", "rec709", "rec709-gamma24", "linear-rec709", "display-p3",
  "linear-p3", "rec2020-gamma24", "linear-rec2020", "acescg", "aces2065-1",
  "sony-slog3-sgamut3", "sony-slog2-sgamut", "sony-slog1-sgamut",
  "arri-logc3-ei800-awg3", "panasonic-vlog-vgamut", "panasonic-vlogl-vgamut",
  "dji-dlog-dgamut", "bmd-film", "bmd-film-4k", "canon-cinestyle",
  "canon-log-cinema-gamut", "canon-log2-cinema-gamut", "canon-log3-cinema-gamut",
  "red-logfilm-rwg", "panasonic-cinelike-d", "gopro-protune-native",
]);
const validClasses = new Set([
  "creative-look", "film-emulation", "camera-transform", "display-transform",
  "color-space-conversion", "tone-map", "accessibility",
]);
const validConfidence = new Set([
  "declared-by-source", "documented-primaries-assumed", "assumed-display-referred",
  "descriptor-only", "camera-profile-input-required", "inferred-from-source-label", "unverified",
]);
const validLicenseBasis = new Set(["per-asset-notice", "repo-license-file", "site-terms", "assumed"]);
const validFormats = new Set(["CUBE", "3DL", "CLF", "CSP", "HALD-PNG", "HALD-TIF"]);
const validInterpolation = new Set(["none", "tetrahedral", "trilinear", "linear"]);
const manifestByFile = new Map(manifest.luts.map((lut) => [path.basename(lut.clientLut), lut]));
const kinds = {};
const sizes = {};
const sourceFormats = {};
let rows = 0;
let sourceHashesVerified = 0;
let sourceHashesSkipped = 0;

function parseHeader(text) {
  const fields = new Map();
  for (const line of text.split(/\n/)) {
    if (!line.startsWith("#")) break;
    const match = line.match(/^#\s*LUTr-([A-Za-z0-9-]+):\s*(.*)$/);
    if (match) fields.set(match[1], match[2].trim());
  }
  return fields;
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

for (const file of files) {
  if (path.extname(file).toLowerCase() !== ".cube") failures.push(`${file}: hosted LUT is not CUBE`);
}

for (const file of cubeFiles) {
  const fullPath = path.join(lutDir, file);
  const buffer = fs.readFileSync(fullPath);
  const text = buffer.toString("utf8");
  const header = parseHeader(text);
  const manifestEntry = manifestByFile.get(file);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) failures.push(`${file}: UTF-8 BOM is forbidden`);
  if (text.includes("\r")) failures.push(`${file}: line endings must be LF`);
  if (!text.startsWith("# LUTr-Schema-Version: 2\n")) failures.push(`${file}: Schema-Version 2 must be the first LUTr line`);
  for (const key of required) {
    if (!header.has(key)) failures.push(`${file}: missing ${key}`);
  }
  if (!validColorSpaces.has(header.get("Input-Color-Space"))) failures.push(`${file}: invalid Input-Color-Space`);
  if (!validColorSpaces.has(header.get("Output-Color-Space"))) failures.push(`${file}: invalid Output-Color-Space`);
  if (!validClasses.has(header.get("Transform-Class"))) failures.push(`${file}: invalid Transform-Class`);
  if (!validConfidence.has(header.get("Color-Space-Confidence"))) failures.push(`${file}: invalid Color-Space-Confidence`);
  if (!validLicenseBasis.has(header.get("License-Basis"))) failures.push(`${file}: invalid License-Basis`);
  if (!validFormats.has(header.get("Source-Format"))) failures.push(`${file}: invalid Source-Format`);
  if (!validInterpolation.has(header.get("Conversion-Interpolation"))) failures.push(`${file}: invalid Conversion-Interpolation`);
  if (header.get("Domain-Normalized") !== "true") failures.push(`${file}: domain is not normalized`);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(header.get("ID") || "")) failures.push(`${file}: ID is not URL-safe`);
  if (`${header.get("ID")}.cube` !== file) failures.push(`${file}: filename does not match header ID`);
  if (!manifestEntry) {
    failures.push(`${file}: missing manifest entry`);
  } else {
    const parity = {
      ID: manifestEntry.id, Title: manifestEntry.title, Collection: manifestEntry.collection,
      "Collection-ID": manifestEntry.collectionId, Source: manifestEntry.source,
      Retrieved: manifestEntry.retrieved, "Source-File": manifestEntry.sourceFile,
      "Source-Format": manifestEntry.sourceFormat, "Source-SHA256": manifestEntry.sourceSha256,
      License: manifestEntry.license, "License-URL": manifestEntry.licenseUrl,
      "License-Basis": manifestEntry.licenseBasis, "Transform-Class": manifestEntry.transformClass,
      "Input-Color-Space": manifestEntry.inputColorSpace || "",
      "Input-Gamut": manifestEntry.inputGamut, "Input-Transfer": manifestEntry.inputTransfer,
      "Output-Color-Space": manifestEntry.outputColorSpace || "",
      "Output-Gamut": manifestEntry.outputGamut, "Output-Transfer": manifestEntry.outputTransfer,
      "Color-Space-Confidence": manifestEntry.colorSpaceConfidence,
      "Original-Grid": manifestEntry.originalGrid,
      "Conversion-Grid": manifestEntry.conversionGrid,
      "Conversion-Interpolation": manifestEntry.conversionInterpolation,
    };
    for (const [field, value] of Object.entries(parity)) {
      if (header.get(field) !== String(value)) failures.push(`${file}: manifest/header mismatch for ${field}`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(header.get("Source-SHA256") || "")) failures.push(`${file}: invalid Source-SHA256`);
  const sourcePath = path.resolve(root, ...String(header.get("Source-File") || "").split("/"));
  const matchingRoot = sourceRoots.find((dir) => sourcePath.startsWith(path.resolve(dir) + path.sep));
  if (!matchingRoot) {
    failures.push(`${file}: Source-File must resolve inside submissions or submissions-raw`);
  } else if (fs.existsSync(sourcePath)) {
    sourceHashesVerified += 1;
    if (sha256(fs.readFileSync(sourcePath)) !== header.get("Source-SHA256")) {
      failures.push(`${file}: Source-SHA256 does not match original`);
    }
  } else if (sourceRootAvailability.get(matchingRoot)) {
    failures.push(`${file}: Source-File does not resolve`);
  } else {
    sourceHashesSkipped += 1;
  }
  try {
    const lut = parseCube(text, file);
    if (lut.kind !== "3D") failures.push(`${file}: hosted LUT must be a 3D CUBE`);
    if (lut.size < 2 || lut.size > 129) failures.push(`${file}: LUT_3D_SIZE outside 2..129`);
    if (lut.domainMin.some((value) => value !== 0) || lut.domainMax.some((value) => value !== 1)) {
      failures.push(`${file}: DOMAIN_MIN/MAX must be 0..1`);
    }
    kinds[lut.kind] = (kinds[lut.kind] || 0) + 1;
    sizes[`${lut.kind}-${lut.size}`] = (sizes[`${lut.kind}-${lut.size}`] || 0) + 1;
    rows += lut.values.length;
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}

const ids = new Set(manifest.luts.map((lut) => lut.id));
if (manifest.schemaVersion !== 2) failures.push(`manifest schema is ${manifest.schemaVersion}, expected 2`);
if (manifest.failures?.length) failures.push(`manifest records ${manifest.failures.length} conversion failures`);
if (cubeFiles.length !== manifest.total) failures.push(`${cubeFiles.length} files != ${manifest.total} manifest records`);
if (ids.size !== manifest.total) failures.push(`${ids.size} unique IDs != ${manifest.total} manifest records`);
for (const lut of manifest.luts) {
  sourceFormats[lut.sourceFormat] = (sourceFormats[lut.sourceFormat] || 0) + 1;
  const file = path.join(root, "site", ...lut.clientLut.split("/"));
  if (!fs.existsSync(file)) failures.push(`missing ${lut.clientLut}`);
}

console.log(JSON.stringify({
  schemaVersion: manifest.schemaVersion,
  sourceLibraryAvailable, sourceHashesVerified, sourceHashesSkipped,
  files: cubeFiles.length, rows, kinds, sizes, sourceFormats,
  failures: failures.length, failureDetails: failures.slice(0, 30),
}, null, 2));
if (failures.length) process.exitCode = 1;
