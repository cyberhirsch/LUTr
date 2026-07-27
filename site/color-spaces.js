const D60_TO_D65 = [
  [0.987224, -0.006113, 0.015953],
  [-0.007598, 1.001861, 0.005330],
  [0.003073, -0.005096, 1.081681],
];

const SRGB_TO_XYZ = [
  [0.4123907993, 0.3575843394, 0.1804807884],
  [0.2126390059, 0.7151686788, 0.0721923154],
  [0.0193308187, 0.1191947798, 0.9505321522],
];

const P3_TO_XYZ = [
  [0.4865709486, 0.2656676932, 0.1982172852],
  [0.2289745641, 0.6917385218, 0.0792869141],
  [0, 0.0451133819, 1.0439443689],
];

const REC2020_TO_XYZ = [
  [0.6369580483, 0.1446169036, 0.1688809752],
  [0.2627002120, 0.6779980715, 0.0593017165],
  [0, 0.0280726930, 1.0609850577],
];

const ACESCG_TO_XYZ_D60 = [
  [0.6624541811, 0.1340042065, 0.1561876870],
  [0.2722287168, 0.6740817658, 0.0536895174],
  [-0.0055746495, 0.0040607335, 1.0103391003],
];

const ACES2065_TO_XYZ_D60 = [
  [0.9525523959, 0, 0.0000936786],
  [0.3439664498, 0.7281660966, -0.0721325464],
  [0, 0, 1.0088251844],
];

function multiply3(a, b) {
  return a.map((row) => b[0].map((_, column) =>
    row.reduce((sum, value, index) => sum + value * b[index][column], 0)
  ));
}

function invert3(m) {
  const [a,b,c] = m[0];
  const [d,e,f] = m[1];
  const [g,h,i] = m[2];
  const A = e*i - f*h;
  const B = c*h - b*i;
  const C = b*f - c*e;
  const D = f*g - d*i;
  const E = a*i - c*g;
  const F = c*d - a*f;
  const G = d*h - e*g;
  const H = b*g - a*h;
  const I = a*e - b*d;
  const determinant = a*A + b*D + c*G;
  return [[A,B,C],[D,E,F],[G,H,I]].map((row) => row.map((value) => value / determinant));
}

function applyMatrix(matrix, color) {
  return matrix.map((row) => row[0] * color[0] + row[1] * color[1] + row[2] * color[2]);
}

const ACESCG_TO_XYZ = multiply3(D60_TO_D65, ACESCG_TO_XYZ_D60);
const ACES2065_TO_XYZ = multiply3(D60_TO_D65, ACES2065_TO_XYZ_D60);

export const COLOR_SPACES = [
  { id: "srgb", label: "sRGB / display Rec.709", transfer: 1, toXYZ: SRGB_TO_XYZ },
  { id: "rec709", label: "Rec.709 camera encoding", transfer: 2, toXYZ: SRGB_TO_XYZ },
  { id: "rec709-gamma24", label: "Rec.709 gamma 2.4", transfer: 3, toXYZ: SRGB_TO_XYZ },
  { id: "linear-rec709", label: "Linear Rec.709 / sRGB", transfer: 0, toXYZ: SRGB_TO_XYZ },
  { id: "display-p3", label: "Display-P3", transfer: 1, toXYZ: P3_TO_XYZ },
  { id: "linear-p3", label: "Linear P3-D65", transfer: 0, toXYZ: P3_TO_XYZ },
  { id: "rec2020-gamma24", label: "Rec.2020 gamma 2.4", transfer: 3, toXYZ: REC2020_TO_XYZ },
  { id: "linear-rec2020", label: "Linear Rec.2020", transfer: 0, toXYZ: REC2020_TO_XYZ },
  { id: "acescg", label: "ACEScg (AP1, linear)", transfer: 0, toXYZ: ACESCG_TO_XYZ },
  { id: "aces2065-1", label: "ACES2065-1 (AP0, linear)", transfer: 0, toXYZ: ACES2065_TO_XYZ },
];

const SPACE_MAP = new Map(COLOR_SPACES.map((space) => [
  space.id,
  { ...space, fromXYZ: invert3(space.toXYZ) },
]));

export function colorSpace(id) {
  return SPACE_MAP.get(String(id || "").toLowerCase()) || null;
}

export function colorSpaceLabel(id) {
  return colorSpace(id)?.label || "Unverified / not declared";
}

export function conversionMatrix(fromId, toId) {
  const from = colorSpace(fromId);
  const to = colorSpace(toId);
  if (!from || !to) throw new Error("Both color spaces must be declared");
  return multiply3(to.fromXYZ, from.toXYZ);
}

function signedPower(value, exponent) {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

export function decodeTransfer(value, transfer) {
  if (transfer === 0) return value;
  if (transfer === 1) return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  if (transfer === 2) return value < 0.081 ? value / 4.5 : Math.pow((value + 0.099) / 1.099, 1 / 0.45);
  if (transfer === 3) return signedPower(value, 2.4);
  return value;
}

export function encodeTransfer(value, transfer) {
  if (transfer === 0) return value;
  if (transfer === 1) return value <= 0.0031308 ? 12.92 * value : 1.055 * signedPower(value, 1 / 2.4) - 0.055;
  if (transfer === 2) return value < 0.018 ? 4.5 * value : 1.099 * signedPower(value, 0.45) - 0.099;
  if (transfer === 3) return signedPower(value, 1 / 2.4);
  return value;
}

export function convertColor(color, fromId, toId) {
  if (fromId === toId) return [...color];
  const from = colorSpace(fromId);
  const to = colorSpace(toId);
  if (!from || !to) throw new Error("Unsupported color-space conversion");
  const linear = color.map((value) => decodeTransfer(value, from.transfer));
  return applyMatrix(conversionMatrix(fromId, toId), linear)
    .map((value) => encodeTransfer(value, to.transfer));
}

export function glMatrix(matrix) {
  return new Float32Array([
    matrix[0][0], matrix[1][0], matrix[2][0],
    matrix[0][1], matrix[1][1], matrix[2][1],
    matrix[0][2], matrix[1][2], matrix[2][2],
  ]);
}

export function colorSpaceOptions({ placeholder = true } = {}) {
  return `${placeholder ? '<option value="">Choose a color space…</option>' : ""}${COLOR_SPACES
    .map((space) => `<option value="${space.id}">${space.label}</option>`)
    .join("")}`;
}
