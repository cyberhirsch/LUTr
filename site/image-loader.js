import { conversionMatrix, encodeTransfer } from "./color-spaces.js";
import { FloatType, RGBAFormat } from "three";
import { EXRLoader } from "./vendor/three/examples/jsm/loaders/EXRLoader.js";
import { HDRLoader } from "./vendor/three/examples/jsm/loaders/HDRLoader.js";
import { TIFFLoader } from "./vendor/three/examples/jsm/loaders/TIFFLoader.js";

const EXTENSION_DEFAULTS = new Map([
  ["exr", ["linear-rec709", "EXR is normally scene-linear; no recognized chromaticities were embedded."]],
  ["hdr", ["linear-rec709", "Radiance HDR stores scene-linear RGBE values."]],
  ["pic", ["linear-rec709", "Radiance HDR/PIC stores scene-linear RGBE values."]],
  ["jpg", ["srgb", "JPEG defaults to sRGB when no recognized ICC profile is found."]],
  ["jpeg", ["srgb", "JPEG defaults to sRGB when no recognized ICC profile is found."]],
  ["jpe", ["srgb", "JPEG defaults to sRGB when no recognized ICC profile is found."]],
  ["png", ["srgb", "PNG defaults to sRGB when no recognized profile or color-space chunk is found."]],
  ["webp", ["srgb", "WebP defaults to sRGB when no recognized ICC profile is found."]],
  ["avif", ["srgb", "AVIF is treated as sRGB when its color metadata is not exposed by the browser."]],
  ["heic", ["srgb", "HEIC is treated as sRGB when its color metadata is not exposed by the browser."]],
  ["heif", ["srgb", "HEIF is treated as sRGB when its color metadata is not exposed by the browser."]],
  ["gif", ["srgb", "GIF is conventionally display-referred sRGB."]],
  ["bmp", ["srgb", "BMP is treated as display-referred sRGB."]],
  ["svg", ["srgb", "SVG colors are interpreted in sRGB unless the document declares otherwise."]],
  ["tif", ["srgb", "TIFF is ambiguous; no recognized profile was found, so sRGB is the conservative display default."]],
  ["tiff", ["srgb", "TIFF is ambiguous; no recognized profile was found, so sRGB is the conservative display default."]],
]);

const PRIMARIES = [
  { id: "aces2065-1", label: "ACES2065-1/AP0 chromaticities", values: [0.7347, 0.2653, 0, 1, 0.0001, -0.077, 0.32168, 0.33767] },
  { id: "acescg", label: "ACEScg/AP1 chromaticities", values: [0.713, 0.293, 0.165, 0.830, 0.128, 0.044, 0.32168, 0.33767] },
  { id: "linear-rec2020", label: "Rec.2020 chromaticities", values: [0.708, 0.292, 0.170, 0.797, 0.131, 0.046, 0.3127, 0.3290] },
  { id: "linear-p3", label: "Display-P3/P3-D65 chromaticities", values: [0.680, 0.320, 0.265, 0.690, 0.150, 0.060, 0.3127, 0.3290] },
  { id: "linear-rec709", label: "Rec.709/sRGB chromaticities", values: [0.640, 0.330, 0.300, 0.600, 0.150, 0.060, 0.3127, 0.3290] },
];

const extensionOf = (file) => file.name.split(".").at(-1)?.toLowerCase() || "";
const near = (a, b, tolerance = 0.004) => Math.abs(Number(a) - Number(b)) <= tolerance;

function chromaticityGuess(header) {
  if (header?.acesImageContainerFlag) {
    return { id: "aces2065-1", confidence: "embedded", reason: "EXR ACES image-container flag." };
  }
  const c = header?.chromaticities;
  if (!c) return null;
  const values = [c.redX, c.redY, c.greenX, c.greenY, c.blueX, c.blueY, c.whiteX, c.whiteY];
  const match = PRIMARIES.find((candidate) => candidate.values.every((value, index) => near(values[index], value)));
  return match ? { id: match.id, confidence: "embedded", reason: `Embedded ${match.label}.` } : null;
}

function textMetadataGuess(bytes, fileName) {
  const sample = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 4 * 1024 * 1024)));
  const text = `${fileName}\n${sample}`.toLowerCase();
  const candidates = [
    ["aces2065-1", /\b(aces2065[-_ ]?1|aces ?ap0)\b/, "ACES2065-1/AP0 marker"],
    ["acescg", /\b(acescg|aces ?ap1)\b/, "ACEScg/AP1 marker"],
    ["linear-rec2020", /\b(linear[-_ ]?(rec\.? ?2020|bt\.? ?2020)|rec\.? ?2020[-_ ]?linear)\b/, "linear Rec.2020 marker"],
    ["rec2020-gamma24", /\b(rec\.? ?2020|bt\.? ?2020)\b/, "Rec.2020 marker"],
    ["linear-p3", /\blinear[-_ ]?(display[-_ ]?)?p3\b/, "linear P3 marker"],
    ["display-p3", /\b(display[-_ ]?p3|p3[-_ ]?d65)\b/, "Display-P3 marker"],
    ["linear-rec709", /\b(linear[-_ ]?(rec\.? ?709|srgb)|rec\.? ?709[-_ ]?linear)\b/, "linear Rec.709 marker"],
    ["rec709-gamma24", /\b(rec\.? ?709|bt\.? ?709)[-_ ]?(gamma[-_ ]?)?2\.?4\b/, "Rec.709 gamma 2.4 marker"],
    ["srgb", /\b(srgb|iec ?61966[-_ ]?2[-_ ]?1)\b/, "sRGB/ICC marker"],
  ];
  const match = candidates.find(([, pattern]) => pattern.test(text));
  return match ? { id: match[0], confidence: "metadata", reason: `${match[2]} found in file metadata or filename.` } : null;
}

export function inferImageColorSpace(file, bytes, metadata = {}) {
  const embedded = chromaticityGuess(metadata.header);
  if (embedded) return embedded;
  const textGuess = textMetadataGuess(new Uint8Array(bytes), file.name);
  if (textGuess) return textGuess;
  const fallback = EXTENSION_DEFAULTS.get(extensionOf(file));
  if (fallback) return { id: fallback[0], confidence: "format", reason: fallback[1] };
  return { id: "srgb", confidence: "fallback", reason: "Unknown image format; sRGB is a provisional guess. Confirm it before judging a LUT." };
}

function sourceFromParsed(parsed, dataType) {
  return { width: parsed.width, height: parsed.height, data: parsed.data, dataType, flipY: parsed.flipY !== false };
}

function multiply(matrix, color) {
  return matrix.map((row) => row[0] * color[0] + row[1] * color[1] + row[2] * color[2]);
}

function floatDisplayCanvas(source, sourceSpace) {
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / source.width);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const toDisplay = conversionMatrix(sourceSpace, "linear-rec709");
  for (let y = 0; y < height; y += 1) {
    const logicalY = Math.min(source.height - 1, Math.floor(y / scale));
    const sourceY = source.flipY ? logicalY : source.height - 1 - logicalY;
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      const linear = multiply(toDisplay, [
        source.data[sourceIndex],
        source.data[sourceIndex + 1],
        source.data[sourceIndex + 2],
      ]);
      for (let channel = 0; channel < 3; channel += 1) {
        const positive = Math.max(0, linear[channel]);
        image.data[targetIndex + channel] = Math.round(255 * Math.min(1, encodeTransfer(positive / (1 + positive), 1)));
      }
      image.data[targetIndex + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function byteDisplayCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  const image = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  if (source.flipY) {
    const scratch = document.createElement("canvas");
    scratch.width = source.width;
    scratch.height = source.height;
    scratch.getContext("2d").putImageData(image, 0, 0);
    context.translate(0, source.height);
    context.scale(1, -1);
    context.drawImage(scratch, 0, 0);
  } else {
    context.putImageData(image, 0, 0);
  }
  return canvas;
}

async function canvasToImage(canvas) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("Could not create a display proxy")),
    "image/webp",
    0.92,
  ));
  const proxy = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = proxy;
  await image.decode();
  return { image, proxy };
}

async function decodeSpecialized(bytes, extension) {
  if (extension === "exr") {
    const parsed = new EXRLoader().setDataType(FloatType).setOutputFormat(RGBAFormat).parse(bytes);
    return { parsed, source: sourceFromParsed(parsed, "float"), format: "OpenEXR" };
  }
  if (extension === "hdr" || extension === "pic") {
    const parsed = new HDRLoader().setDataType(FloatType).parse(bytes);
    return { parsed, source: sourceFromParsed(parsed, "float"), format: "Radiance HDR" };
  }
  if (extension === "tif" || extension === "tiff") {
    const parsed = new TIFFLoader().parse(bytes);
    return { parsed, source: sourceFromParsed(parsed, "uint8"), format: "TIFF" };
  }
  return null;
}

async function decodeNative(file) {
  const proxy = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = proxy;
  try {
    await image.decode();
    return { image, proxy, source: image, format: file.type || extensionOf(file).toUpperCase() || "image" };
  } catch (error) {
    URL.revokeObjectURL(proxy);
    throw error;
  }
}

export async function decodeImageFile(file) {
  const bytes = await file.arrayBuffer();
  const extension = extensionOf(file);
  const specialized = await decodeSpecialized(bytes, extension);
  const guess = inferImageColorSpace(file, bytes, specialized?.parsed);
  if (!specialized) {
    try {
      const native = await decodeNative(file);
      return { ...native, guess };
    } catch {
      throw new Error(`The browser could not decode .${extension || "unknown"} files. LUTr currently decodes browser-native images, EXR, HDR/PIC, and TIFF.`);
    }
  }
  const display = specialized.source.dataType === "float"
    ? floatDisplayCanvas(specialized.source, guess.id)
    : byteDisplayCanvas(specialized.source);
  const { image, proxy } = await canvasToImage(display);
  return { ...specialized, image, proxy, guess };
}
