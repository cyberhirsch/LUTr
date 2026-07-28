import { convertColor, colorSpaceLabel } from "./color-spaces.js";

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

// Canonical CUBEs are stored gzip-compressed (site/assets/luts/<id>.cube.gz)
// to fit GitHub Pages' size budget. This is the single fetch path every
// consumer -- the renderer, the viewer download, the compare dialog -- goes
// through, so the decompression logic exists exactly once.
export async function fetchCubeText(url) {
  const gzUrl = `${url}.gz`;
  const response = await fetch(gzUrl);
  if (!response.ok) throw new Error(`Unable to load ${gzUrl} (${response.status})`);
  if (!response.body || typeof DecompressionStream === "undefined") {
    throw new Error("This browser does not support streaming gzip decompression");
  }
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export function parseLutrHeader(text) {
  const metadata = {};
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.startsWith("#")) break;
    const match = line.match(/^#\s*LUTr-([A-Za-z0-9-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (Object.hasOwn(metadata, key)) {
      metadata[key] = Array.isArray(metadata[key]) ? [...metadata[key], value.trim()] : [metadata[key], value.trim()];
    } else {
      metadata[key] = value.trim();
    }
  }
  return metadata;
}

function colorSpaceParts(id) {
  return {
    srgb: ["rec709", "srgb"], rec709: ["rec709", "rec709"],
    "rec709-gamma24": ["rec709", "gamma24"], "linear-rec709": ["rec709", "linear"],
    "display-p3": ["display-p3", "srgb"], "linear-p3": ["display-p3", "linear"],
    "rec2020-gamma24": ["rec2020", "gamma24"], "linear-rec2020": ["rec2020", "linear"],
    acescg: ["aces-ap1", "linear"], "aces2065-1": ["aces-ap0", "linear"],
  }[id] || ["unspecified", "unspecified"];
}

export function parseCube(text, filename = "Uploaded LUT") {
  const metadata = parseLutrHeader(text);
  const size3d = Number(text.match(/^\s*LUT_3D_SIZE\s+(\d+)/im)?.[1] || 0);
  const size1d = Number(text.match(/^\s*LUT_1D_SIZE\s+(\d+)/im)?.[1] || 0);
  const size = size3d || size1d;
  const kind = size3d ? "3D" : "1D";
  if (!size || size < 2 || (kind === "3D" && size > 129) || (kind === "1D" && size > 65536)) {
    throw new Error("Supported CUBE sizes are 2–129 for 3D and 2–65536 for 1D");
  }
  const title = text.match(/^\s*TITLE\s+\"([^\"]+)\"/im)?.[1] || filename.replace(/\.cube$/i, "");
  const domainMin = (text.match(/^\s*DOMAIN_MIN\s+(.+)$/im)?.[1] || "0 0 0").trim().split(/\s+/).map(Number);
  const domainMax = (text.match(/^\s*DOMAIN_MAX\s+(.+)$/im)?.[1] || "1 1 1").trim().split(/\s+/).map(Number);
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    if (!/^[-+]?(?:\d|\.\d)/.test(clean)) continue;
    const numbers = clean.split(/\s+/).slice(0, 3).map(Number);
    if (numbers.length === 3 && numbers.every(Number.isFinite)) values.push(numbers);
  }
  const expected = kind === "3D" ? size ** 3 : size;
  if (values.length < expected) throw new Error(`Expected ${expected} LUT rows, found ${values.length}`);
  return {
    title,
    kind,
    size,
    domainMin,
    domainMax,
    values: values.slice(0, expected),
    metadata,
    schemaVersion: Number(metadata["Schema-Version"] || 0),
    id: metadata.ID || "",
    declaredInput: String(metadata["Input-Color-Space"] || "").toLowerCase(),
    declaredOutput: String(metadata["Output-Color-Space"] || "").toLowerCase(),
    inputGamut: metadata["Input-Gamut"] || "",
    inputTransfer: metadata["Input-Transfer"] || "",
    outputGamut: metadata["Output-Gamut"] || "",
    outputTransfer: metadata["Output-Transfer"] || "",
    transformClass: metadata["Transform-Class"] || "",
    tags: String(metadata.Tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

export function sampleLut(lut, color) {
  if (lut.kind === "1D") {
    return color.map((value, channel) => {
      const normalized = clamp((value - lut.domainMin[channel]) / (lut.domainMax[channel] - lut.domainMin[channel]));
      const point = normalized * (lut.size - 1);
      const lower = Math.floor(point);
      const upper = Math.min(lower + 1, lut.size - 1);
      const amount = point - lower;
      return lut.values[lower][channel] + (lut.values[upper][channel] - lut.values[lower][channel]) * amount;
    });
  }
  const point = color.map((value, channel) => {
    const normalized = (value - lut.domainMin[channel]) / (lut.domainMax[channel] - lut.domainMin[channel]);
    return clamp(normalized) * (lut.size - 1);
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

export function composeCube({
  lut,
  newInput,
  lutInput,
  lutOutput,
  newOutput,
  size = 33,
  title = lut.title,
  source = "LUTr — LUTrepository",
}) {
  if (![newInput, lutInput, lutOutput, newOutput].every(Boolean)) {
    throw new Error("All four color spaces must be defined");
  }
  const [inputGamut, inputTransfer] = colorSpaceParts(newInput);
  const [outputGamut, outputTransfer] = colorSpaceParts(newOutput);
  const conversionDate = new Date().toISOString().slice(0, 10);
  const lines = [
    "# LUTr-Schema-Version: 2",
    `# LUTr-ID: converted-${String(lut.id || lut.title).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "")}`,
    `# LUTr-Title: ${title}`,
    "# LUTr-Collection: User conversion",
    "# LUTr-Collection-ID: user-conversion",
    `# LUTr-Source: ${lut.metadata?.["Asset-URL"] || lut.metadata?.Source || source}`,
    `# LUTr-Retrieved: ${conversionDate}`,
    `# LUTr-Source-File: ${lut.metadata?.["Source-File"] || "browser-upload"}`,
    "# LUTr-Source-Format: CUBE",
    `# LUTr-Source-SHA256: ${lut.metadata?.["Source-SHA256"] || ""}`,
    `# LUTr-License: ${lut.metadata?.License || "Unspecified"}`,
    `# LUTr-License-URL: ${lut.metadata?.["License-URL"] || ""}`,
    `# LUTr-License-Basis: ${lut.metadata?.["License-Basis"] || "assumed"}`,
    `# LUTr-Transform-Class: ${lut.transformClass || "color-space-conversion"}`,
    `# LUTr-Tags: ${[...new Set([...(lut.tags || []), "converted", "cube"])].join(", ")}`,
    `# LUTr-Input-Color-Space: ${newInput}`,
    `# LUTr-Input-Gamut: ${inputGamut}`,
    `# LUTr-Input-Transfer: ${inputTransfer}`,
    `# LUTr-Output-Color-Space: ${newOutput}`,
    `# LUTr-Output-Gamut: ${outputGamut}`,
    `# LUTr-Output-Transfer: ${outputTransfer}`,
    "# LUTr-Color-Space-Confidence: declared-by-user",
    "# LUTr-Domain-Normalized: true",
    "# LUTr-Shaper: none",
    `# LUTr-Original-Grid: ${lut.kind === "1D" ? `${lut.size}-sample-1D` : `${lut.size}x${lut.size}x${lut.size}`}`,
    `# LUTr-Conversion-Grid: ${size}x${size}x${size}`,
    "# LUTr-Conversion-Interpolation: trilinear",
    "# LUTr-Conversion-Method: Browser-side color-space composition and LUT resampling",
    "# LUTr-Conversion-Tool: LUTr client converter 2.0.0",
    `# LUTr-Conversion-Date: ${conversionDate}`,
    `# LUTr-Composition: ${colorSpaceLabel(newInput)} -> ${colorSpaceLabel(lutInput)} -> LUT -> ${colorSpaceLabel(lutOutput)} -> ${colorSpaceLabel(newOutput)}`,
    "",
    `TITLE "${title.replaceAll('"', "'")}"`,
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const input = [r, g, b].map((value) => value / (size - 1));
        const lutDomain = convertColor(input, newInput, lutInput).map((value) => clamp(value));
        const transformed = sampleLut(lut, lutDomain);
        const output = convertColor(transformed, lutOutput, newOutput);
        lines.push(output.map((value) => Number.isFinite(value) ? value.toFixed(8) : "0.00000000").join(" "));
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
