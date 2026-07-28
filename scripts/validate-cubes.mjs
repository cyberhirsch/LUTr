import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseCube } from "../site/lut-io.js";
import {
  VALID_COLOR_SPACES, VALID_TRANSFORM_CLASSES, VALID_CONFIDENCE,
  VALID_LICENSE_BASIS, VALID_SOURCE_FORMATS, VALID_INTERPOLATION,
} from "./lib/color-space-ids.mjs";

const root = process.cwd();
const siteDir = path.join(root, "site");
const lutDir = path.join(siteDir, "assets", "luts");
const atlasDir = path.join(siteDir, "assets", "atlas");
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
// Canonical CUBEs ship gzip-compressed (site/assets/luts/<id>.cube.gz); the
// plaintext .cube some of these entries also have on disk is a local build
// artifact (gitignored, produced by convert-all-to-cube.mjs /
// build-preview-assets.mjs) and is neither required nor validated here --
// only its presence would be a bug in .gitignore, not something this script
// can detect from inside a checkout where it's legitimately absent.
const cubeFiles = files.filter((file) => file.toLowerCase().endsWith(".cube.gz"));
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
const validColorSpaces = VALID_COLOR_SPACES;
const validClasses = VALID_TRANSFORM_CLASSES;
const validConfidence = VALID_CONFIDENCE;
const validLicenseBasis = VALID_LICENSE_BASIS;
const validFormats = VALID_SOURCE_FORMATS;
const validInterpolation = VALID_INTERPOLATION;
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
  const lower = file.toLowerCase();
  // A plaintext "<id>.cube" alongside its "<id>.cube.gz" is the expected,
  // gitignored local build artifact -- allowed, but not itself validated
  // (the .gz is what's tracked and deployed, and what every check below
  // actually inspects). Anything that is neither is unexpected.
  if (!lower.endsWith(".cube.gz") && !lower.endsWith(".cube")) {
    failures.push(`${file}: unexpected file in site/assets/luts (expected .cube.gz)`);
  }
}

for (const file of cubeFiles) {
  const idFile = file.replace(/\.gz$/i, ""); // e.g. "<id>.cube", used for header/manifest filename comparisons
  const fullPath = path.join(lutDir, file);
  const gzBuffer = fs.readFileSync(fullPath);
  if (gzBuffer[0] !== 0x1f || gzBuffer[1] !== 0x8b) failures.push(`${file}: not a valid gzip stream (bad magic bytes)`);
  let buffer;
  try {
    buffer = zlib.gunzipSync(gzBuffer);
  } catch (error) {
    failures.push(`${file}: failed to gunzip (${error.message})`);
    continue;
  }
  const text = buffer.toString("utf8");
  const header = parseHeader(text);
  const manifestEntry = manifestByFile.get(idFile);
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
  if (`${header.get("ID")}.cube` !== idFile) failures.push(`${file}: filename does not match header ID`);
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
let atlasesVerified = 0;
for (const lut of manifest.luts) {
  sourceFormats[lut.sourceFormat] = (sourceFormats[lut.sourceFormat] || 0) + 1;
  // The plaintext .cube (lut.clientLut) is a gitignored local build artifact
  // and is expected to be absent from a checkout; only the deployed .gz is
  // required to exist.
  const gzFile = path.join(root, "site", ...lut.clientLut.split("/")) + ".gz";
  if (!fs.existsSync(gzFile)) failures.push(`missing ${lut.clientLut}.gz`);
  if (lut.previewAtlas) {
    const atlasFile = path.join(root, "site", ...lut.previewAtlas.split("/"));
    if (!fs.existsSync(atlasFile)) failures.push(`missing ${lut.previewAtlas}`);
    else atlasesVerified += 1;
  } else {
    failures.push(`${lut.id}: missing previewAtlas`);
  }
}

console.log(JSON.stringify({
  schemaVersion: manifest.schemaVersion,
  sourceLibraryAvailable, sourceHashesVerified, sourceHashesSkipped,
  files: cubeFiles.length, rows, kinds, sizes, sourceFormats, atlasesVerified,
  failures: failures.length, failureDetails: failures.slice(0, 30),
}, null, 2));
if (failures.length) process.exitCode = 1;
