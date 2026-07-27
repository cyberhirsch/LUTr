import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();

const collections = {
  "stripedpurple-color-grading-luts": {
    name: "Striped Purple Color Grading LUTs",
    source: "https://github.com/stripedpurple/color-grading-luts",
    license: "MIT",
    licenseUrl: "https://github.com/stripedpurple/color-grading-luts/blob/master/LICENSE",
    tags: ["creative", "color-grading", "3d-lut"],
  },
  "ircgraphic-d-cinelike-blockbuster": {
    name: "DJI D-Cinelike and Normal Blockbuster LUTs",
    source: "https://github.com/IRCGraphic/D-Cinelike-and-Normal-Blockbuster-LUTs",
    license: "CC0-1.0",
    licenseUrl: "https://github.com/IRCGraphic/D-Cinelike-and-Normal-Blockbuster-LUTs/blob/main/LICENSE",
    tags: ["creative", "dji", "d-cinelike", "blockbuster", "3d-lut"],
  },
  "jonmatifa-a6000-luts": {
    name: "Sony a6000 LUTs",
    source: "https://github.com/jonmatifa/a6000-LUTs",
    license: "CC0-1.0",
    licenseUrl: "https://github.com/jonmatifa/a6000-LUTs/blob/master/LICENSE",
    tags: ["camera", "sony", "a6000", "log", "3d-lut"],
  },
  "christophwurst-haldclut": {
    name: "ChristophWurst Hald CLUTs",
    source: "https://github.com/ChristophWurst/haldclut",
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://github.com/ChristophWurst/haldclut/blob/master/LICENSE",
    tags: ["creative", "hald-clut", "rawtherapee"],
  },
  "sguyader-filmsim": {
    name: "FilmSim",
    source: "https://github.com/sguyader/FilmSim",
    license: "CC0-1.0",
    licenseUrl: "https://github.com/sguyader/FilmSim/blob/master/LICENSE",
    tags: ["creative", "film-emulation", "hald-clut", "rawtherapee"],
  },
  "sverit-hdr2sdr-luts": {
    name: "HDR2SDR LUTs",
    source: "https://github.com/sverit/HDR2SDR-LUTs",
    license: "GPL-3.0",
    licenseUrl: "https://github.com/sverit/HDR2SDR-LUTs/blob/main/LICENSE",
    tags: ["technical", "hdr", "sdr", "tone-mapping", "3d-lut"],
  },
  "videovillage-red-conversion-luts": {
    name: "RED Conversion LUTs",
    source: "https://github.com/videovillage/RED-Conversion-LUTs",
    license: "MIT",
    licenseUrl: "https://github.com/videovillage/RED-Conversion-LUTs/blob/master/LICENSE.md",
    tags: ["technical", "camera", "red", "redlogfilm", "redgamma"],
  },
  "lauloque-linear-to-blender-filmic": {
    name: "Linear to Blender Filmic sRGB LUTs",
    source: "https://github.com/Lauloque/LUTs-Linear-to-Blender-s-Filmic-sRGB",
    license: "GPL-3.0",
    licenseUrl: "https://github.com/Lauloque/LUTs-Linear-to-Blender-s-Filmic-sRGB/blob/master/LICENSE",
    tags: ["technical", "linear", "blender-filmic", "srgb", "display-transform"],
  },
  "natron-haldclut-presets": {
    name: "Natron HaldCLUT Presets",
    source: "https://github.com/NatronGitHub/clut",
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://github.com/NatronGitHub/clut#license",
    tags: ["creative", "film-emulation", "hald-clut", "natron"],
  },
  "vfxwiki-arri-alexa-luts": {
    name: "ARRI Alexa LUTs",
    source: "https://github.com/vfxwiki/ArriAlexaLuts",
    license: "LGPL-3.0",
    licenseUrl: "https://github.com/vfxwiki/ArriAlexaLuts/blob/master/LICENSE",
    tags: ["technical", "camera", "arri", "alexa", "3d-lut"],
  },
  "andrewwillmott-colour-blind-luts": {
    name: "Colour-Blind LUTs",
    source: "https://github.com/andrewwillmott/colour-blind-luts",
    license: "Unlicense",
    licenseUrl: "https://github.com/andrewwillmott/colour-blind-luts/blob/master/LICENSE",
    tags: ["technical", "accessibility", "color-vision", "simulation", "correction"],
  },
  "aswf-opencolorio-config-aces": {
    name: "OpenColorIO Config for ACES",
    source: "https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES",
    license: "BSD-3-Clause",
    licenseUrl: "https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/LICENSE",
    tags: ["technical", "aces", "ocio", "clf", "color-management"],
  },
};

const imageAssets = [
  {
    file: "Images/Marcie/Digital_LAD_2048x1556.dpx",
    title: "Kodak Digital LAD (Marcie), 2K",
    purpose: "Film-log response, skin tone, neutral LAD patches, and film-recorder calibration.",
    tags: ["calibration", "film-log", "skin-tone", "dpx", "10-bit", "kodak-lad"],
    source: "https://web.archive.org/web/20160408080623id_/http://motion.kodak.com/KodakGCG/uploadedfiles/motion/Digital_LAD_dpx.zip",
    license: "No explicit redistribution license found in the original Kodak archive.",
    commercial: "Internal technical use matches Kodak's documented purpose. Obtain written clearance before redistribution, advertising, branding, or other public commercial use.",
    color: "10-bit DPX film-scan reference; use Kodak H-387 and pipeline documentation to establish the intended log interpretation.",
    attribution: "Eastman Kodak Company; Digital LAD / “Marcie”.",
  },
  {
    file: "Images/Sony F35 Still Life/SonyF35.StillLife.exr",
    title: "Sony F35 Still Life",
    purpose: "Charts, practical objects, skin-like colors, exposure range, and camera-transform evaluation.",
    tags: ["reference", "sony-f35", "still-life", "charts", "practical-objects", "aces", "exr"],
    source: "https://www.dropbox.com/sh/9xcfbespknayuft/AACYLWs5QGYGTym07gtGYaOLa/ACES?dl=1&preview=SonyF35.StillLife.exr",
    license: "Academy ACES reference-image license; retain notices. Third-party rights are not independently granted.",
    commercial: "Permissive technical reuse is intended under the Academy license; review any depicted trademarks or third-party rights for promotional use.",
    color: "ACES reference EXR; treat as scene-linear ACES2065-1 unless your ACES reference documentation specifies otherwise.",
    attribution: "Academy of Motion Picture Arts and Sciences ACES reference images; Sony F35 source.",
  },
  {
    file: "Images/ACES Synthetic Chart/syntheticChart.01.exr",
    title: "ACES Synthetic Chart 01",
    purpose: "Mathematical correctness, range handling, primaries, ramps, and transform regression tests.",
    tags: ["synthetic", "chart", "aces", "mathematical", "regression", "exr"],
    source: "https://www.dropbox.com/sh/9xcfbespknayuft/AACYLWs5QGYGTym07gtGYaOLa/ACES?dl=1&preview=syntheticChart.01.exr",
    license: "Academy ACES reference-image license; retain notices.",
    commercial: "Permitted by the Academy license, subject to its notice and disclaimer terms.",
    color: "Scene-linear ACES2065-1 / AP0 reference values.",
    attribution: "Academy of Motion Picture Arts and Sciences ACES reference images.",
  },
  {
    file: "Images/OpenEXR StillLife/StillLife.exr",
    title: "OpenEXR StillLife",
    purpose: "HDR range, reflective objects, saturated materials, and highlight behavior.",
    tags: ["hdr", "still-life", "reflective", "highlights", "openexr", "exr"],
    source: "https://github.com/AcademySoftwareFoundation/openexr-images/blob/main/ScanLines/StillLife.exr",
    license: "BSD-3-Clause (openexr-images repository).",
    commercial: "Permitted with the BSD copyright and license notices retained.",
    color: "Scene-referred OpenEXR test image; inspect its EXR attributes and the upstream test-image notes before assuming primaries.",
    attribution: "OpenEXR test images contributors / Academy Software Foundation.",
  },
  {
    file: "Images/OpenEXR MtTamWest/MtTamWest.exr",
    title: "OpenEXR MtTamWest",
    purpose: "Landscape, sky gradients, foliage, distant detail, and natural highlight roll-off.",
    tags: ["hdr", "landscape", "sky", "foliage", "openexr", "exr"],
    source: "https://github.com/AcademySoftwareFoundation/openexr-images/blob/main/ScanLines/MtTamWest.exr",
    license: "BSD-3-Clause (openexr-images repository).",
    commercial: "Permitted with the BSD copyright and license notices retained.",
    color: "Scene-referred OpenEXR test image; inspect its EXR attributes and the upstream test-image notes before assuming primaries.",
    attribution: "OpenEXR test images contributors / Academy Software Foundation.",
  },
  {
    file: "Images/OpenEXR Desk/Desk.exr",
    title: "OpenEXR Desk",
    purpose: "Indoor mixed colors, practical surfaces, small detail, and local contrast.",
    tags: ["hdr", "indoor", "mixed-colors", "desk", "openexr", "exr"],
    source: "https://github.com/AcademySoftwareFoundation/openexr-images/blob/main/ScanLines/Desk.exr",
    license: "BSD-3-Clause (openexr-images repository).",
    commercial: "Permitted with the BSD copyright and license notices retained.",
    color: "Scene-referred OpenEXR test image; inspect its EXR attributes and the upstream test-image notes before assuming primaries.",
    attribution: "OpenEXR test images contributors / Academy Software Foundation.",
  },
  {
    file: "Images/Sparks/SPARKS_ACES_02000.exr",
    title: "Netflix Sparks — ACES frame 02000",
    purpose: "Real HDR footage, bright practicals, specular highlights, and motion-picture material.",
    tags: ["hdr", "netflix", "sparks", "aces", "highlights", "footage", "exr"],
    source: "https://s3.amazonaws.com/download.opencontent.netflix.com/sparks/aces_image_sequence_59_94_fps/SPARKS_ACES_02000.exr",
    license: "CC-BY-4.0.",
    commercial: "Permitted with attribution and the CC BY 4.0 license notice.",
    color: "Scene-linear ACES image sequence frame.",
    attribution: "Netflix, “Sparks” open content.",
  },
  {
    file: "Images/Meridian/Meridian_UHD4k5994p_HDR_P3PQ_21000.tif",
    title: "Netflix Meridian — P3/PQ frame 21000",
    purpose: "Cinematic skin, production lighting, wardrobe, and HDR display-transform evaluation.",
    tags: ["hdr", "netflix", "meridian", "skin-tone", "production-lighting", "p3", "pq", "tiff"],
    source: "https://s3.amazonaws.com/download.opencontent.netflix.com/Meridian/tiffs/Meridian_UHD4k5994p_HDR_P3PQ_21000.tif",
    license: "CC-BY-4.0.",
    commercial: "Permitted with attribution and the CC BY 4.0 license notice.",
    color: "Display-referred P3 primaries with PQ transfer, as encoded in the source filename.",
    attribution: "Netflix, “Meridian” open content.",
  },
  {
    file: "Images/Tears of Steel/10081.png",
    title: "Tears of Steel — final-film frame 10081",
    purpose: "Live-action face, cinematic lighting, composited display graphics, and VFX.",
    tags: ["live-action", "face", "vfx", "cinematic", "tears-of-steel", "png"],
    source: "https://media.xiph.org/tearsofsteel/tearsofsteel-1080bis-png/10081.png",
    license: "CC-BY-3.0.",
    commercial: "Permitted with attribution under CC BY 3.0. This is a final-film frame, not the raw actor-footage package with its additional advertising restriction.",
    color: "Final graded, display-referred PNG; normally interpreted as sRGB.",
    attribution: "© Blender Foundation | mango.blender.org, “Tears of Steel”.",
  },
  {
    file: "Images/Poly Haven HDRIs/kloofendal_48d_partly_cloudy_2k.hdr",
    title: "Poly Haven Kloofendal 48d Partly Cloudy, 2K",
    purpose: "Outdoor daylight illumination, sky gradients, and image-based lighting.",
    tags: ["hdri", "daylight", "outdoor", "partly-cloudy", "ibl", "equirectangular"],
    source: "https://polyhaven.com/a/kloofendal_48d_partly_cloudy",
    license: "CC0-1.0.",
    commercial: "Permitted without attribution; attribution is appreciated.",
    color: "Scene-linear Radiance HDR equirectangular environment map.",
    attribution: "Poly Haven / asset creator (optional under CC0).",
  },
  {
    file: "Images/Poly Haven HDRIs/studio_small_08_2k.hdr",
    title: "Poly Haven Studio Small 08, 2K",
    purpose: "Artificial studio illumination, softboxes, controlled reflections, and image-based lighting.",
    tags: ["hdri", "artificial-light", "studio", "softbox", "ibl", "equirectangular"],
    source: "https://polyhaven.com/a/studio_small_08",
    license: "CC0-1.0.",
    commercial: "Permitted without attribution; attribution is appreciated.",
    color: "Scene-linear Radiance HDR equirectangular environment map.",
    attribution: "Poly Haven / asset creator (optional under CC0).",
  },
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeUtf8(file, text) {
  fs.writeFileSync(file, text.replace(/\r?\n/g, "\n"), "utf8");
}

function annotateCube(file, meta) {
  let data = fs.readFileSync(file);
  let text = data.toString("utf8");
  if (text.includes("# LUTr-Source:")) {
    if (!text.includes("# LUTr-Project:")) {
      text = text.replace(
        /^# LUTr-Collection:/m,
        "# LUTr-Project: LUTr — LUTrepository\n# LUTr-Collection:",
      );
      writeUtf8(file, text);
      return true;
    }
    return false;
  }
  const header = [
    "# LUTr-Project: LUTr — LUTrepository",
    `# LUTr-Collection: ${meta.name}`,
    `# LUTr-Source: ${meta.source}`,
    `# LUTr-License: ${meta.license}`,
    `# LUTr-License-URL: ${meta.licenseUrl}`,
    `# LUTr-Tags: ${meta.tags.join(", ")}`,
    "# LUTr-Note: Preserve the upstream license and attribution files when redistributing.",
    "",
  ].join("\n");
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    text = text.slice(1);
  }
  writeUtf8(file, header + text);
  return true;
}

function writeLutSidecar(file, meta) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const ext = path.extname(file).slice(1).toLowerCase();
  const sidecar = `${file}.info.md`;
  const tags = [...new Set([...meta.tags, ext])];
  const content = `# ${path.basename(file)}

- **Collection:** ${meta.name}
- **Tags:** ${tags.join(", ")}
- **Source:** ${meta.source}
- **License:** ${meta.license}
- **License text:** ${meta.licenseUrl}
- **Commercial use:** Allowed subject to the named license; preserve upstream notices, attribution, and share-alike/source obligations where applicable.
- **Repository path:** \`${rel}\`
- **SHA-256:** \`${sha256(file)}\`

This sidecar is part of LUTr — LUTrepository. It carries searchable provenance and tags because the asset format does not have a reliably portable metadata/comment convention.
`;
  writeUtf8(sidecar, content);
}

const submissionRoot = path.join(root, "submissions");
const sidecarExtensions = new Set([".3dl", ".clf", ".png", ".tif", ".tiff", ".pp3"]);
let cubeCount = 0;
let lutSidecarCount = 0;

for (const [folder, meta] of Object.entries(collections)) {
  const dir = path.join(submissionRoot, folder);
  if (!fs.existsSync(dir)) throw new Error(`Missing collection: ${dir}`);
  for (const file of walk(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".cube") {
      if (annotateCube(file, meta)) cubeCount += 1;
    } else if (sidecarExtensions.has(ext)) {
      writeLutSidecar(file, meta);
      lutSidecarCount += 1;
    }
  }
}

for (const asset of imageAssets) {
  const file = path.join(root, ...asset.file.split("/"));
  if (!fs.existsSync(file)) throw new Error(`Missing image asset: ${file}`);
  const content = `# ${asset.title}

- **File:** \`${path.basename(file)}\`
- **Purpose:** ${asset.purpose}
- **Tags:** ${asset.tags.join(", ")}
- **Source:** ${asset.source}
- **License:** ${asset.license}
- **Commercial use:** ${asset.commercial}
- **Color / encoding:** ${asset.color}
- **Attribution:** ${asset.attribution}
- **SHA-256:** \`${sha256(file)}\`

This same-filename sidecar is part of LUTr — LUTrepository and is the searchable metadata record for an image format that does not provide a dependable portable tag field. This is a provenance note, not legal advice.
`;
  writeUtf8(`${file}.info.md`, content);
}

console.log(JSON.stringify({ cubeHeadersAdded: cubeCount, lutSidecarsWritten: lutSidecarCount, imageSidecarsWritten: imageAssets.length }, null, 2));
