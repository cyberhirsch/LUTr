// The controlled vocabularies for the LUTr schema-2 header
// (see LUT_HEADER_SPEC.md). This is the single source of truth: previously
// the same lists were duplicated verbatim in scripts/convert-all-to-cube.mjs
// and scripts/validate-cubes.mjs (and were about to become a third copy in
// server/validate.mjs). Every consumer imports from here so the two never
// drift apart -- exactly the failure mode LUT_HEADER_SPEC.md section 7 is
// about.
//
// Note this is broader than site/color-spaces.js's COLOR_SPACES: that file
// is the renderer's set -- the ids it can actually compute a preview for.
// This list is the catalog's set -- every id a LUT is allowed to declare,
// including log encodings the renderer cannot yet render (those LUTs are
// still valid catalog entries; they show the "space required" placeholder
// until a transfer curve is implemented for them).

export const VALID_COLOR_SPACES = new Set([
  "", "srgb", "rec709", "rec709-gamma24", "linear-rec709", "display-p3",
  "linear-p3", "rec2020-gamma24", "linear-rec2020", "acescg", "aces2065-1",
  "sony-slog3-sgamut3", "sony-slog2-sgamut", "sony-slog1-sgamut",
  "arri-logc3-ei800-awg3", "panasonic-vlog-vgamut", "panasonic-vlogl-vgamut",
  "dji-dlog-dgamut", "bmd-film", "bmd-film-4k", "canon-cinestyle",
  "canon-log-cinema-gamut", "canon-log2-cinema-gamut", "canon-log3-cinema-gamut",
  "red-logfilm-rwg", "panasonic-cinelike-d", "gopro-protune-native",
  "cie-xyz-d65", "rec709-gamma18", "rec709-gamma22", "linear-adobe-rgb",
  "adobe-rgb-gamma22", "acescg-gamma22", "acescg-srgb", "apple-log-bt2020",
  "arri-logc4-awg4", "linear-arri-wide-gamut3", "linear-arri-wide-gamut4",
  "bmd-film-gen5-widegamut", "linear-bmd-widegamut",
  "davinci-intermediate-widegamut", "linear-davinci-widegamut",
  "linear-canon-cinema-gamut", "linear-dji-dgamut", "linear-panasonic-vgamut",
  "red-log3g10-rwg", "linear-red-wide-gamut", "linear-sony-sgamut",
  "linear-sony-sgamut3", "sony-slog3-sgamut3cine", "linear-sony-sgamut3cine",
  "sony-slog3-venice-sgamut3", "linear-sony-venice-sgamut3",
  "sony-slog3-venice-sgamut3cine", "linear-sony-venice-sgamut3cine",
]);

export const VALID_TRANSFORM_CLASSES = new Set([
  "creative-look", "film-emulation", "camera-transform", "display-transform",
  "color-space-conversion", "tone-map", "accessibility",
]);

export const VALID_CONFIDENCE = new Set([
  "declared-by-source", "documented-primaries-assumed", "assumed-display-referred",
  "descriptor-only", "camera-profile-input-required", "inferred-from-source-label", "unverified",
]);

export const VALID_LICENSE_BASIS = new Set([
  "per-asset-notice", "repo-license-file", "site-terms", "assumed",
]);

export const VALID_SOURCE_FORMATS = new Set(["CUBE", "3DL", "CLF", "CSP", "HALD-PNG", "HALD-TIF"]);

export const VALID_INTERPOLATION = new Set(["none", "tetrahedral", "trilinear", "linear"]);
