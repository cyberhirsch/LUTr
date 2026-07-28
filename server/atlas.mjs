// Builds the two deployable artifacts for one approved submission: the
// gzip-compressed canonical CUBE and its 33-cube preview atlas. Reuses
// exactly the same encoder as the offline catalog build
// (scripts/build-preview-assets.mjs) via scripts/lib/png.mjs, so a
// community-submitted LUT's atlas is generated identically to every other
// LUT already in the catalog.
import zlib from "node:zlib";
import { sampleLut } from "../site/lut-io.js";
import { buildAtlasPng } from "../scripts/lib/png.mjs";

export const ATLAS_SIZE = 33;

export function gzipCube(cubeText) {
  return zlib.gzipSync(Buffer.from(cubeText, "utf8"), { level: 9 });
}

export function buildAtlas(parsed) {
  return buildAtlasPng(ATLAS_SIZE, (r, g, b) =>
    sampleLut(parsed, [r, g, b].map((value) => value / (ATLAS_SIZE - 1))));
}
