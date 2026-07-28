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

// Camera-gamut matrices are D65 RGB-to-XYZ transforms. Legacy profiles whose
// manufacturers did not publish a stable gamut definition intentionally use
// Rec.709 primaries and carry an "approximate" note in the UI metadata.
const SONY_SGAMUT3_TO_XYZ = [
  [0.7064827132, 0.1288010498, 0.1151721641],
  [0.2709796708, 0.7866064112, -0.0575860820],
  [-0.0096778454, 0.0046000375, 1.0890577508],
];

const ARRI_WIDE_GAMUT_3_TO_XYZ = [
  [0.6380076193, 0.2147038563, 0.0977444514],
  [0.2919537790, 0.8238410415, -0.1157948205],
  [0.0027982790, -0.0670342357, 1.1532937074],
];

const PANASONIC_VGAMUT_TO_XYZ = [
  [0.679644, 0.152211, 0.118600],
  [0.260686, 0.774894, -0.035580],
  [-0.009310, -0.004612, 1.102980],
];

const CANON_CINEMA_GAMUT_TO_XYZ = [
  [0.740951, 0.088457, 0.120998],
  [0.285577, 0.707229, 0.007194],
  [-0.009737, -0.004474, 1.102537],
];

const RED_WIDE_GAMUT_TO_XYZ = [
  [0.735275, 0.068609, 0.146571],
  [0.286694, 0.842979, -0.129673],
  [-0.079681, -0.347343, 1.516082],
];

const ARRI_WIDE_GAMUT_4_TO_XYZ = [
  [0.7045962430, 0.1310105900, 0.1148490234],
  [0.2539827829, 0.7836988275, -0.0376817771],
  [0.0003330848, -0.0045009989, 1.0932264298],
];

const BLACKMAGIC_WIDE_GAMUT_TO_XYZ = [
  [0.6064044135, 0.2217196395, 0.1223318034],
  [0.2677105643, 0.8350287428, -0.1027394738],
  [-0.0295631637, -0.0914890150, 1.2101106944],
];

const DAVINCI_WIDE_GAMUT_TO_XYZ = [
  [0.7004726196, 0.1502710609, 0.0997121760],
  [0.2737693262, 0.8762781263, -0.1500476192],
  [-0.0990929299, -0.1433767140, 1.3315281595],
];

const DJI_DGAMUT_TO_XYZ = [
  [0.6480310340, 0.1953612403, 0.1070635822],
  [0.2826839976, 0.8154973332, -0.0981814974],
  [-0.0183169359, -0.0879684394, 1.1953438910],
];

const SONY_SGAMUT3_CINE_TO_XYZ = [
  [0.5988827366, 0.2502590632, 0.1013140567],
  [0.2146513138, 0.8874235436, -0.1020750240],
  [-0.0318818633, -0.0325713872, 1.1535117662],
];

const SONY_VENICE_SGAMUT3_TO_XYZ = [
  [0.7439823418, 0.0791961145, 0.1272774001],
  [0.2802735079, 0.7825837575, -0.0628574321],
  [-0.0197188406, 0.0102115128, 1.0985658435],
];

const SONY_VENICE_SGAMUT3_CINE_TO_XYZ = [
  [0.6320480372, 0.2017368335, 0.1166709857],
  [0.2232348425, 0.8824344404, -0.1056694495],
  [-0.0408824556, -0.0234263339, 1.1533673052],
];

const ADOBE_RGB_TO_XYZ = [
  [0.5767309, 0.1855540, 0.1881852],
  [0.2973769, 0.6273491, 0.0752741],
  [0.0270343, 0.0706872, 0.9911085],
];

const XYZ_D65_TO_XYZ = [[1,0,0],[0,1,0],[0,0,1]];

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
  { id: "sony-slog3-sgamut3", label: "Sony S-Log3 / S-Gamut3", transfer: 4, toXYZ: SONY_SGAMUT3_TO_XYZ },
  { id: "sony-slog2-sgamut", label: "Sony S-Log2 / S-Gamut", transfer: 7, toXYZ: SONY_SGAMUT3_TO_XYZ },
  { id: "sony-slog1-sgamut", label: "Sony S-Log / S-Gamut", transfer: 8, toXYZ: SONY_SGAMUT3_TO_XYZ },
  { id: "arri-logc3-ei800-awg3", label: "ARRI LogC3 EI800 / Wide Gamut 3", transfer: 5, toXYZ: ARRI_WIDE_GAMUT_3_TO_XYZ },
  { id: "panasonic-vlog-vgamut", label: "Panasonic V-Log / V-Gamut", transfer: 6, toXYZ: PANASONIC_VGAMUT_TO_XYZ },
  { id: "panasonic-vlogl-vgamut", label: "Panasonic V-Log L / V-Gamut", transfer: 6, toXYZ: PANASONIC_VGAMUT_TO_XYZ },
  { id: "dji-dlog-dgamut", label: "DJI D-Log / D-Gamut (legacy approximation)", transfer: 9, toXYZ: REC2020_TO_XYZ, approximate: true },
  { id: "bmd-film", label: "Blackmagic Film (legacy approximation)", transfer: 10, toXYZ: SRGB_TO_XYZ, approximate: true },
  { id: "bmd-film-4k", label: "Blackmagic Film 4K (legacy approximation)", transfer: 10, toXYZ: SRGB_TO_XYZ, approximate: true },
  { id: "canon-cinestyle", label: "Technicolor CineStyle / Rec.709 (approximation)", transfer: 11, toXYZ: SRGB_TO_XYZ, approximate: true },
  { id: "canon-log-cinema-gamut", label: "Canon Log / Cinema Gamut (approximation)", transfer: 12, toXYZ: CANON_CINEMA_GAMUT_TO_XYZ, approximate: true },
  { id: "canon-log2-cinema-gamut", label: "Canon Log 2 / Cinema Gamut (approximation)", transfer: 13, toXYZ: CANON_CINEMA_GAMUT_TO_XYZ, approximate: true },
  { id: "canon-log3-cinema-gamut", label: "Canon Log 3 / Cinema Gamut (approximation)", transfer: 14, toXYZ: CANON_CINEMA_GAMUT_TO_XYZ, approximate: true },
  { id: "red-logfilm-rwg", label: "RED Log Film / REDWideGamutRGB", transfer: 15, toXYZ: RED_WIDE_GAMUT_TO_XYZ },
  { id: "panasonic-cinelike-d", label: "Panasonic Cinelike-D / Rec.709 (approximation)", transfer: 16, toXYZ: SRGB_TO_XYZ, approximate: true },
  { id: "gopro-protune-native", label: "GoPro Protune Native (approximation)", transfer: 17, toXYZ: REC2020_TO_XYZ, approximate: true },
  { id: "cie-xyz-d65", label: "CIE XYZ D65 (scene-linear)", transfer: 0, toXYZ: XYZ_D65_TO_XYZ },
  { id: "rec709-gamma18", label: "Rec.709 gamma 1.8", transfer: 18, toXYZ: SRGB_TO_XYZ },
  { id: "rec709-gamma22", label: "Rec.709 gamma 2.2", transfer: 19, toXYZ: SRGB_TO_XYZ },
  { id: "linear-adobe-rgb", label: "Linear Adobe RGB (1998)", transfer: 0, toXYZ: ADOBE_RGB_TO_XYZ },
  { id: "adobe-rgb-gamma22", label: "Adobe RGB (1998) gamma 2.2", transfer: 19, toXYZ: ADOBE_RGB_TO_XYZ },
  { id: "acescg-gamma22", label: "ACES AP1 gamma 2.2", transfer: 19, toXYZ: ACESCG_TO_XYZ },
  { id: "acescg-srgb", label: "ACES AP1 with sRGB transfer", transfer: 1, toXYZ: ACESCG_TO_XYZ },
  { id: "apple-log-bt2020", label: "Apple Log / BT.2020 (endpoint approximation)", transfer: 20, toXYZ: REC2020_TO_XYZ, approximate: true },
  { id: "arri-logc4-awg4", label: "ARRI LogC4 / Wide Gamut 4", transfer: 21, toXYZ: ARRI_WIDE_GAMUT_4_TO_XYZ },
  { id: "linear-arri-wide-gamut3", label: "Linear ARRI Wide Gamut 3", transfer: 0, toXYZ: ARRI_WIDE_GAMUT_3_TO_XYZ },
  { id: "linear-arri-wide-gamut4", label: "Linear ARRI Wide Gamut 4", transfer: 0, toXYZ: ARRI_WIDE_GAMUT_4_TO_XYZ },
  { id: "bmd-film-gen5-widegamut", label: "Blackmagic Film Gen 5 / Wide Gamut", transfer: 22, toXYZ: BLACKMAGIC_WIDE_GAMUT_TO_XYZ },
  { id: "linear-bmd-widegamut", label: "Linear Blackmagic Wide Gamut", transfer: 0, toXYZ: BLACKMAGIC_WIDE_GAMUT_TO_XYZ },
  { id: "davinci-intermediate-widegamut", label: "DaVinci Intermediate / Wide Gamut", transfer: 23, toXYZ: DAVINCI_WIDE_GAMUT_TO_XYZ },
  { id: "linear-davinci-widegamut", label: "Linear DaVinci Wide Gamut", transfer: 0, toXYZ: DAVINCI_WIDE_GAMUT_TO_XYZ },
  { id: "linear-canon-cinema-gamut", label: "Linear Canon Cinema Gamut (D55)", transfer: 0, toXYZ: CANON_CINEMA_GAMUT_TO_XYZ },
  { id: "linear-dji-dgamut", label: "Linear DJI D-Gamut", transfer: 0, toXYZ: DJI_DGAMUT_TO_XYZ },
  { id: "linear-panasonic-vgamut", label: "Linear Panasonic V-Gamut", transfer: 0, toXYZ: PANASONIC_VGAMUT_TO_XYZ },
  { id: "red-log3g10-rwg", label: "RED Log3G10 / REDWideGamutRGB (endpoint approximation)", transfer: 24, toXYZ: RED_WIDE_GAMUT_TO_XYZ, approximate: true },
  { id: "linear-red-wide-gamut", label: "Linear REDWideGamutRGB", transfer: 0, toXYZ: RED_WIDE_GAMUT_TO_XYZ },
  { id: "linear-sony-sgamut", label: "Linear Sony S-Gamut", transfer: 0, toXYZ: SONY_SGAMUT3_TO_XYZ },
  { id: "linear-sony-sgamut3", label: "Linear Sony S-Gamut3", transfer: 0, toXYZ: SONY_SGAMUT3_TO_XYZ },
  { id: "sony-slog3-sgamut3cine", label: "Sony S-Log3 / S-Gamut3.Cine", transfer: 4, toXYZ: SONY_SGAMUT3_CINE_TO_XYZ },
  { id: "linear-sony-sgamut3cine", label: "Linear Sony S-Gamut3.Cine", transfer: 0, toXYZ: SONY_SGAMUT3_CINE_TO_XYZ },
  { id: "sony-slog3-venice-sgamut3", label: "Sony S-Log3 / Venice S-Gamut3", transfer: 4, toXYZ: SONY_VENICE_SGAMUT3_TO_XYZ },
  { id: "linear-sony-venice-sgamut3", label: "Linear Sony Venice S-Gamut3", transfer: 0, toXYZ: SONY_VENICE_SGAMUT3_TO_XYZ },
  { id: "sony-slog3-venice-sgamut3cine", label: "Sony S-Log3 / Venice S-Gamut3.Cine", transfer: 4, toXYZ: SONY_VENICE_SGAMUT3_CINE_TO_XYZ },
  { id: "linear-sony-venice-sgamut3cine", label: "Linear Sony Venice S-Gamut3.Cine", transfer: 0, toXYZ: SONY_VENICE_SGAMUT3_CINE_TO_XYZ },
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
  if (transfer === 4) {
    const cut = 171.2102946929 / 1023;
    return value >= cut
      ? Math.pow(10, (value * 1023 - 420) / 261.5) * 0.19 - 0.01
      : (value * 1023 - 95) * 0.01125 / (171.2102946929 - 95);
  }
  if (transfer === 5) return value > 0.1496582
    ? (Math.pow(10, (value - 0.385537) / 0.24719) - 0.052272) / 5.555556
    : (value - 0.092809) / 5.367655;
  if (transfer === 6) return value < 0.181
    ? (value - 0.125) / 5.6
    : Math.pow(10, (value - 0.598206) / 0.241514) - 0.00873;
  if (transfer === 7) return (Math.pow(10, (value - 0.616596 - 0.03) / 0.432699) - 0.037584) / 4.5;
  if (transfer === 8) return (Math.pow(10, (value - 0.616596 - 0.03) / 0.432699) - 0.037584);
  if (transfer === 9) return Math.max(0, Math.pow(10, (value - 0.53) / 0.38) - 0.01);
  if (transfer === 10) return value < 0.0928 ? (value - 0.0928) / 4.5 : Math.pow(10, (value - 0.456) / 0.224) - 0.005;
  if (transfer === 11) return signedPower((value - 0.035) / 0.965, 2.2);
  if (transfer === 12) return Math.pow(10, (value - 0.4) / 0.3) - 0.01;
  if (transfer === 13) return Math.pow(10, (value - 0.38) / 0.28) - 0.01;
  if (transfer === 14) return Math.pow(10, (value - 0.4) / 0.32) - 0.01;
  if (transfer === 15) return Math.pow(10, (value - 0.685) / 0.2471896) - 0.01;
  if (transfer === 16) return signedPower(value, 2.4);
  if (transfer === 17) return signedPower(value, 2.2);
  if (transfer === 18) return signedPower(value, 1.8);
  if (transfer === 19) return signedPower(value, 2.2);
  if (transfer === 20) return Math.sign(value - 0.4) * (Math.pow(2, 12 * Math.abs(value - 0.4)) - 1) / 64;
  if (transfer === 21) {
    const breakEncoded = 0.0647954196341293 * Math.log2(2231.82630906769 * -0.0180569961199113 + 64) - 0.295908392682586;
    return value > breakEncoded
      ? (Math.pow(2, (value + 0.295908392682586) / 0.0647954196341293) - 64) / 2231.82630906769
      : (value - breakEncoded) / 8.803033210537 + -0.0180569961199113;
  }
  if (transfer === 22) return value >= 0.133883
    ? Math.exp((value - 0.530013) / 0.0869288) - 0.00549407
    : (value - 0.0924658) / 8.2836059;
  if (transfer === 23) return value > 0.02740668
    ? Math.pow(2, value * 14 - 7) - 0.0075
    : value / 10.44426855;
  if (transfer === 24) return Math.sign(value - 0.333) * (Math.pow(10, Math.abs(value - 0.333) / 0.224282) - 1) / 64;
  return value;
}

export function encodeTransfer(value, transfer) {
  if (transfer === 0) return value;
  if (transfer === 1) return value <= 0.0031308 ? 12.92 * value : 1.055 * signedPower(value, 1 / 2.4) - 0.055;
  if (transfer === 2) return value < 0.018 ? 4.5 * value : 1.099 * signedPower(value, 0.45) - 0.099;
  if (transfer === 3) return signedPower(value, 1 / 2.4);
  if (transfer === 4) return value >= 0.01125
    ? (420 + Math.log10((value + 0.01) / 0.19) * 261.5) / 1023
    : (value * (171.2102946929 - 95) / 0.01125 + 95) / 1023;
  if (transfer === 5) return value > 0.010591
    ? 0.24719 * Math.log10(5.555556 * value + 0.052272) + 0.385537
    : 5.367655 * value + 0.092809;
  if (transfer === 6) return value < 0.01
    ? 5.6 * value + 0.125
    : 0.241514 * Math.log10(value + 0.00873) + 0.598206;
  if (transfer === 7) return 0.432699 * Math.log10(4.5 * value + 0.037584) + 0.616596 + 0.03;
  if (transfer === 8) return 0.432699 * Math.log10(value + 0.037584) + 0.616596 + 0.03;
  if (transfer === 9) return 0.38 * Math.log10(Math.max(0, value) + 0.01) + 0.53;
  if (transfer === 10) return value < 0 ? 4.5 * value + 0.0928 : 0.224 * Math.log10(value + 0.005) + 0.456;
  if (transfer === 11) return 0.965 * signedPower(value, 1 / 2.2) + 0.035;
  if (transfer === 12) return 0.3 * Math.log10(value + 0.01) + 0.4;
  if (transfer === 13) return 0.28 * Math.log10(value + 0.01) + 0.38;
  if (transfer === 14) return 0.32 * Math.log10(value + 0.01) + 0.4;
  if (transfer === 15) return 0.2471896 * Math.log10(value + 0.01) + 0.685;
  if (transfer === 16) return signedPower(value, 1 / 2.4);
  if (transfer === 17) return signedPower(value, 1 / 2.2);
  if (transfer === 18) return signedPower(value, 1 / 1.8);
  if (transfer === 19) return signedPower(value, 1 / 2.2);
  if (transfer === 20) return Math.sign(value) * Math.log2(1 + 64 * Math.abs(value)) / 12 + 0.4;
  if (transfer === 21) {
    const breakEncoded = 0.0647954196341293 * Math.log2(2231.82630906769 * -0.0180569961199113 + 64) - 0.295908392682586;
    return value > -0.0180569961199113
      ? 0.0647954196341293 * Math.log2(2231.82630906769 * value + 64) - 0.295908392682586
      : 8.803033210537 * (value + 0.0180569961199113) + breakEncoded;
  }
  if (transfer === 22) return value >= 0.005
    ? 0.0869288 * Math.log(value + 0.00549407) + 0.530013
    : 8.2836059 * value + 0.0924658;
  if (transfer === 23) return value > 0.00262409
    ? (Math.log2(value + 0.0075) + 7) / 14
    : value * 10.44426855;
  if (transfer === 24) return Math.sign(value) * 0.224282 * Math.log10(1 + 64 * Math.abs(value)) + 0.333;
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
