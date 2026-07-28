// Browser-facing copies of the schema-2 controlled vocabularies enforced by
// scripts/lib/color-space-ids.mjs and server/validate.mjs. Keep the equality
// assertion in scripts/test-community-integration.mjs green when editing.
export const SUBMISSION_COLOR_SPACES = [
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
];

export const SUBMISSION_TRANSFORM_CLASSES = [
  "creative-look", "film-emulation", "camera-transform", "display-transform",
  "color-space-conversion", "tone-map", "accessibility",
];

export const SUBMISSION_CONFIDENCE = [
  "declared-by-source", "documented-primaries-assumed", "assumed-display-referred",
  "descriptor-only", "camera-profile-input-required", "inferred-from-source-label", "unverified",
];

export const SUBMISSION_LICENSE_BASIS = [
  "per-asset-notice", "repo-license-file", "site-terms", "assumed",
];
