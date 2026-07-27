import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const siteDir = path.join(root, "site");
const dataDir = path.join(siteDir, "data");
fs.mkdirSync(dataDir, { recursive: true });

const collections = {
  "stripedpurple-color-grading-luts": ["Striped Purple", "MIT", "creative-look", ["creative", "stylized"]],
  "ircgraphic-d-cinelike-blockbuster": ["DJI Blockbuster", "CC0-1.0", "creative-look", ["creative", "camera", "dji", "cinematic"]],
  "jonmatifa-a6000-luts": ["Sony a6000", "CC0-1.0", "camera-transform", ["camera", "sony", "log"]],
  "christophwurst-haldclut": ["ChristophWurst Hald", "CC-BY-SA-4.0", "creative-look", ["creative", "hald-clut"]],
  "sguyader-filmsim": ["FilmSim", "CC0-1.0", "film-emulation", ["film", "film-emulation", "hald-clut"]],
  "sverit-hdr2sdr-luts": ["HDR2SDR", "GPL-3.0", "tone-map", ["technical", "hdr", "sdr", "tone-map"]],
  "videovillage-red-conversion-luts": ["RED Conversion", "MIT", "camera-transform", ["technical", "camera", "red"]],
  "lauloque-linear-to-blender-filmic": ["Blender Filmic", "GPL-3.0", "display-transform", ["technical", "filmic", "display-transform"]],
  "natron-haldclut-presets": ["Natron HaldCLUT", "CC-BY-SA-4.0", "film-emulation", ["creative", "film", "hald-clut"]],
  "vfxwiki-arri-alexa-luts": ["ARRI Alexa", "LGPL-3.0", "camera-transform", ["technical", "camera", "arri", "alexa"]],
  "andrewwillmott-colour-blind-luts": ["Colour-Blind LUTs", "Unlicense", "accessibility", ["technical", "accessibility", "color-vision"]],
  "aswf-opencolorio-config-aces": ["OCIO ACES", "BSD-3-Clause", "color-space-conversion", ["technical", "aces", "ocio", "clf"]],
};

const images = [
  {
    id: "marcie",
    title: "Marcie",
    subtitle: "Film-log response · skin · LAD calibration",
    sourceFile: "Images/Marcie/Digital_LAD_2048x1556.dpx",
    sourceUrl: "https://web.archive.org/web/20160408080623id_/http://motion.kodak.com/KodakGCG/uploadedfiles/motion/Digital_LAD_dpx.zip",
    license: "Kodak archive · redistribution unclear",
    tags: ["calibration", "film-log", "skin", "lad", "dpx"],
    encoding: "10-bit Kodak Digital LAD film-log DPX",
    proxyMode: "display",
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    subtitle: "Face · VFX · cinematic light",
    sourceFile: "Images/Tears of Steel/10081.png",
    sourceUrl: "https://media.xiph.org/tearsofsteel/tearsofsteel-1080bis-png/10081.png",
    license: "CC-BY-3.0",
    tags: ["face", "skin", "vfx", "cinematic", "sdr"],
    encoding: "Display-referred sRGB",
    proxyMode: "display",
  },
  {
    id: "sony-f35-still-life",
    title: "Sony F35 Still Life",
    subtitle: "Charts · practical objects",
    sourceFile: "Images/Sony F35 Still Life/SonyF35.StillLife.exr",
    sourceUrl: "https://acescentral.com/knowledge-base-2/using-aces-reference-images/",
    license: "Academy ACES terms",
    tags: ["charts", "camera", "practical", "aces", "hdr"],
    encoding: "Scene-linear ACES reference",
    proxyMode: "linear",
  },
  {
    id: "aces-synthetic-chart",
    title: "ACES Synthetic Chart",
    subtitle: "Ramps · primaries · regression",
    sourceFile: "Images/ACES Synthetic Chart/syntheticChart.01.exr",
    sourceUrl: "https://acescentral.com/knowledge-base-2/using-aces-reference-images/",
    license: "Academy ACES terms",
    tags: ["chart", "synthetic", "ramps", "aces", "technical"],
    encoding: "Scene-linear ACES2065-1",
    proxyMode: "linear",
  },
  {
    id: "openexr-still-life",
    title: "OpenEXR StillLife",
    subtitle: "HDR · reflective objects",
    sourceFile: "Images/OpenEXR StillLife/StillLife.exr",
    sourceUrl: "https://github.com/AcademySoftwareFoundation/openexr-images",
    license: "BSD-3-Clause",
    tags: ["hdr", "reflective", "highlights", "still-life"],
    encoding: "Scene-linear OpenEXR",
    proxyMode: "linear",
  },
  {
    id: "openexr-mt-tam",
    title: "OpenEXR MtTamWest",
    subtitle: "Landscape · sky · foliage",
    sourceFile: "Images/OpenEXR MtTamWest/MtTamWest.exr",
    sourceUrl: "https://github.com/AcademySoftwareFoundation/openexr-images",
    license: "BSD-3-Clause",
    tags: ["landscape", "sky", "foliage", "hdr"],
    encoding: "Scene-linear OpenEXR",
    proxyMode: "linear",
  },
  {
    id: "openexr-desk",
    title: "OpenEXR Desk",
    subtitle: "Interior · mixed color",
    sourceFile: "Images/OpenEXR Desk/Desk.exr",
    sourceUrl: "https://github.com/AcademySoftwareFoundation/openexr-images",
    license: "BSD-3-Clause",
    tags: ["interior", "mixed-color", "objects", "hdr"],
    encoding: "Scene-linear OpenEXR",
    proxyMode: "linear",
  },
  {
    id: "polyhaven-daylight",
    title: "Kloofendal Daylight",
    subtitle: "Outdoor · cloudy daylight",
    sourceFile: "Images/Poly Haven HDRIs/kloofendal_48d_partly_cloudy_2k.hdr",
    sourceUrl: "https://polyhaven.com/a/kloofendal_48d_partly_cloudy",
    license: "CC0-1.0",
    tags: ["hdri", "daylight", "outdoor", "sky"],
    encoding: "Scene-linear Radiance HDR",
    proxyMode: "linear",
  },
  {
    id: "polyhaven-studio",
    title: "Studio Small 08",
    subtitle: "Artificial · softbox studio",
    sourceFile: "Images/Poly Haven HDRIs/studio_small_08_2k.hdr",
    sourceUrl: "https://polyhaven.com/a/studio_small_08",
    license: "CC0-1.0",
    tags: ["hdri", "studio", "artificial", "softbox"],
    encoding: "Scene-linear Radiance HDR",
    proxyMode: "linear",
  },
  {
    id: "sparks",
    title: "Sparks",
    subtitle: "Real HDR footage · practical highlights",
    sourceFile: "Images/Sparks/SPARKS_ACES_02000.exr",
    sourceUrl: "https://s3.amazonaws.com/download.opencontent.netflix.com/sparks/aces_image_sequence_59_94_fps/SPARKS_ACES_02000.exr",
    license: "CC-BY-4.0",
    tags: ["hdr", "footage", "highlights", "aces", "netflix"],
    encoding: "Scene-linear ACES",
    proxyMode: "linear",
  },
  {
    id: "meridian",
    title: "Meridian",
    subtitle: "Cinematic skin · production lighting",
    sourceFile: "Images/Meridian/Meridian_UHD4k5994p_HDR_P3PQ_21000.tif",
    sourceUrl: "https://s3.amazonaws.com/download.opencontent.netflix.com/Meridian/tiffs/Meridian_UHD4k5994p_HDR_P3PQ_21000.tif",
    license: "CC-BY-4.0",
    tags: ["hdr", "skin", "production-lighting", "p3", "pq", "netflix"],
    encoding: "Display-referred P3/PQ",
    proxyMode: "display",
  },
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name.endsWith(".info.md")) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72);
}

function shortHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 9);
}

function cleanTitle(file, content = "") {
  const title = content.match(/^\s*TITLE\s+"([^"]+)"/im)?.[1];
  const base = title && !/^(generated by resolve|untitled)$/i.test(title.trim())
    ? title
    : path.basename(file, path.extname(file));
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
    ["protanopia", /protan/],
    ["deuteranopia", /deuter/],
    ["tritanopia", /tritan/],
    ["hdr", /\bhdr\b/],
    ["sdr", /\bsdr\b/],
  ];
  for (const [tag, pattern] of rules) if (pattern.test(lower)) tags.push(tag);
  return tags;
}

function parseCubeMetrics(content) {
  const size = Number(content.match(/^\s*LUT_3D_SIZE\s+(\d+)/im)?.[1] || 0);
  if (!size) return { size: null, intensity: null, warmth: null, saturation: null, clipping: null };
  const lines = content.split(/\r?\n/);
  const values = [];
  for (const line of lines) {
    if (!/^\s*[-+]?(?:\d|\.\d)/.test(line)) continue;
    const n = line.trim().split(/\s+/).map(Number);
    if (n.length >= 3 && n.slice(0, 3).every(Number.isFinite)) values.push(n.slice(0, 3));
  }
  const expected = size ** 3;
  if (values.length < expected) return { size, intensity: null, warmth: null, saturation: null, clipping: null };
  const stride = Math.max(1, Math.floor(expected / 4096));
  let diff = 0;
  let warmth = 0;
  let satDelta = 0;
  let clipping = 0;
  let count = 0;
  for (let i = 0; i < expected; i += stride) {
    const r = i % size;
    const g = Math.floor(i / size) % size;
    const b = Math.floor(i / (size * size)) % size;
    const input = [r, g, b].map((v) => v / (size - 1));
    const output = values[i];
    diff += (Math.abs(output[0] - input[0]) + Math.abs(output[1] - input[1]) + Math.abs(output[2] - input[2])) / 3;
    warmth += (output[0] - output[2]) - (input[0] - input[2]);
    const inChroma = Math.max(...input) - Math.min(...input);
    const outChroma = Math.max(...output) - Math.min(...output);
    satDelta += outChroma - inChroma;
    if (output.some((v) => v <= 0 || v >= 1)) clipping += 1;
    count += 1;
  }
  return {
    size,
    intensity: Number((diff / count).toFixed(4)),
    warmth: Number((warmth / count).toFixed(4)),
    saturation: Number((satDelta / count).toFixed(4)),
    clipping: Number((clipping / count).toFixed(4)),
  };
}

function sidecarMeta(file) {
  const sidecar = `${file}.info.md`;
  if (!fs.existsSync(sidecar)) return {};
  const text = fs.readFileSync(sidecar, "utf8");
  const field = (name) => text.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, "im"))?.[1]?.trim();
  return {
    source: field("Source"),
    license: field("License"),
    tags: field("Tags")?.split(",").map((v) => v.trim()).filter(Boolean) || [],
  };
}

const submissionRoot = path.join(root, "submissions");
const luts = [];

for (const [folder, [collection, defaultLicense, transformClass, collectionTags]] of Object.entries(collections)) {
  const dir = path.join(submissionRoot, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const ext = path.extname(file).toLowerCase();
    const rel = path.relative(root, file).replaceAll("\\", "/");
    let previewType = null;
    if (ext === ".cube") previewType = "lut3d";
    if (ext === ".3dl") previewType = "lut3d";
    if ((folder === "natron-haldclut-presets" || folder === "christophwurst-haldclut" || folder === "sguyader-filmsim") && [".png", ".tif", ".tiff"].includes(ext)) previewType = "hald";
    const isCatalogAsset =
      [".cube", ".3dl", ".clf"].includes(ext) ||
      previewType === "hald" ||
      (folder === "andrewwillmott-colour-blind-luts" && ext === ".png");
    if (!isCatalogAsset) continue;

    const content = [".cube", ".3dl", ".clf"].includes(ext) ? fs.readFileSync(file, "utf8") : "";
    if (ext === ".cube" && /^\s*LUT_1D_SIZE\s+/im.test(content)) previewType = "lut1d";
    const sidecar = sidecarMeta(file);
    const embeddedSource = content.match(/^# LUTr-Source:\s*(.+)$/im)?.[1]?.trim();
    const embeddedLicense = content.match(/^# LUTr-License:\s*(.+)$/im)?.[1]?.trim();
    const embeddedTags = content.match(/^# LUTr-Tags:\s*(.+)$/im)?.[1]?.split(",").map((v) => v.trim()) || [];
    const title = cleanTitle(file, content);
    const id = `${slug(collection)}--${slug(title)}--${shortHash(rel)}`;
    const metrics = ext === ".cube" && previewType === "lut3d" ? parseCubeMetrics(content) : {
      size: ext === ".3dl" ? Number(content.match(/3DMESH\s*\n\s*(\d+)/i)?.[1] || 0) || null : null,
      intensity: null,
      warmth: null,
      saturation: null,
      clipping: null,
    };
    const tags = [...new Set([...collectionTags, ...embeddedTags, ...(sidecar.tags || []), ...filenameTags(title)])];
    if (metrics.warmth != null) {
      if (metrics.warmth > 0.035) tags.push("warm");
      if (metrics.warmth < -0.035) tags.push("cool");
    }
    if (metrics.intensity != null) {
      tags.push(metrics.intensity < 0.06 ? "subtle" : metrics.intensity < 0.15 ? "moderate" : "strong");
    }
    const source = embeddedSource || sidecar.source || `https://github.com/${folder}`;
    const license = (embeddedLicense || sidecar.license || defaultLicense).replace(/\.$/, "");

    luts.push({
      id,
      title,
      collection,
      collectionId: folder,
      transformClass,
      format: ext.slice(1).toUpperCase(),
      source,
      license,
      tags: [...new Set(tags)],
      sourceFile: rel,
      previewType,
      previewStatus: previewType ? "illustrative" : "metadata-only",
      clientLut: previewType ? `assets/luts/${id}.png` : null,
      clientLutSize: previewType ? 25 : null,
      size: metrics.size,
      intensity: metrics.intensity,
      warmth: metrics.warmth,
      saturation: metrics.saturation,
      clipping: metrics.clipping,
      completeness: Number((
        [title, collection, source, license, transformClass, tags.length, previewType].filter(Boolean).length / 7
      ).toFixed(2)),
    });
  }
}

luts.sort((a, b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title));
const previewableCount = luts.filter((lut) => lut.previewType).length;

const output = {
  generatedAt: new Date().toISOString(),
  methodology: "Prototype previews are illustrative display-referred renders. Input/output color-space validation is planned; unknown combinations are labeled.",
  stats: {
    luts: luts.length,
    previewable: previewableCount,
    metadataOnly: luts.length - previewableCount,
    collections: new Set(luts.map((lut) => lut.collection)).size,
    images: images.length,
  },
  images: images.map((image) => ({
    ...image,
    sourceFile: undefined,
    proxy: `assets/images/${image.id}.webp`,
  })),
  luts,
};

fs.writeFileSync(path.join(dataDir, "catalog.json"), JSON.stringify(output), "utf8");
fs.writeFileSync(path.join(dataDir, "images-build.json"), JSON.stringify(images, null, 2), "utf8");
console.log(JSON.stringify(output.stats, null, 2));
