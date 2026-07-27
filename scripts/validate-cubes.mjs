import fs from "node:fs";
import path from "node:path";
import { parseCube } from "../site/lut-io.js";

const root = process.cwd();
const lutDir = path.join(root, "site", "assets", "luts");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site", "data", "cube-manifest.json"), "utf8"));
const files = fs.readdirSync(lutDir);
const cubeFiles = files.filter((file) => path.extname(file).toLowerCase() === ".cube");
const failures = [];
const required = [
  "Project", "Schema-Version", "ID", "Title", "Collection", "Collection-ID",
  "Source", "Source-File", "Source-Format", "Source-SHA256", "License",
  "License-URL", "Tags", "Transform-Class", "Input-Color-Space",
  "Output-Color-Space", "Color-Space-Confidence", "Conversion-Method",
  "Conversion-Date", "Conversion-Tool", "Conversion-Grid", "Note",
];
const kinds = {};
const sizes = {};
const sourceFormats = {};
let rows = 0;

for (const file of files) {
  if (path.extname(file).toLowerCase() !== ".cube") failures.push(`${file}: hosted LUT is not CUBE`);
}

for (const file of cubeFiles) {
  const text = fs.readFileSync(path.join(lutDir, file), "utf8");
  try {
    const lut = parseCube(text, file);
    kinds[lut.kind] = (kinds[lut.kind] || 0) + 1;
    sizes[`${lut.kind}-${lut.size}`] = (sizes[`${lut.kind}-${lut.size}`] || 0) + 1;
    rows += lut.values.length;
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
  for (const key of required) {
    if (!new RegExp(`^# LUTr-${key}:\\s*.+$`, "m").test(text)) failures.push(`${file}: missing ${key}`);
  }
}

const ids = new Set(manifest.luts.map((lut) => lut.id));
if (manifest.failures?.length) failures.push(`manifest records ${manifest.failures.length} conversion failures`);
if (cubeFiles.length !== manifest.total) failures.push(`${cubeFiles.length} files != ${manifest.total} manifest records`);
if (ids.size !== manifest.total) failures.push(`${ids.size} unique IDs != ${manifest.total} manifest records`);
for (const lut of manifest.luts) {
  sourceFormats[lut.sourceFormat] = (sourceFormats[lut.sourceFormat] || 0) + 1;
  const file = path.join(root, "site", ...lut.clientLut.split("/"));
  if (!fs.existsSync(file)) failures.push(`missing ${lut.clientLut}`);
}

console.log(JSON.stringify({
  files: cubeFiles.length, rows, kinds, sizes, sourceFormats,
  failures: failures.length, failureDetails: failures.slice(0, 30),
}, null, 2));
if (failures.length) process.exitCode = 1;
