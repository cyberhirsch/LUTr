// Server-side validation for a community LUT submission.
//
// Never trusts what the client claims: re-parses the cube text, re-checks
// every metadata field against the exact vocabularies used everywhere else
// in the project (scripts/lib/color-space-ids.mjs), and re-derives anything
// the schema requires. The browser's own pre-flight check (if any) is UX,
// not a control.
import crypto from "node:crypto";
import { parseCube } from "../site/lut-io.js";
import {
  VALID_COLOR_SPACES, VALID_TRANSFORM_CLASSES, VALID_CONFIDENCE, VALID_LICENSE_BASIS,
} from "../scripts/lib/color-space-ids.mjs";

export const MAX_BODY_BYTES = 16 * 1024 * 1024; // real LUTs run to several MB; lensfit's 512 KB (sized for lens profiles) is far too small here

export class SubmissionError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

// Two different things live in upstream comments (mirrors the same split in
// scripts/import-freshluts.mjs): a CLAIM is a rights assertion that can
// contradict the license the submitter declared; a CREDIT is authorship or
// tool provenance, which every permissive license tolerates. Only a claim
// blocks a submission.
const CLAIM_PATTERN = /\bcopyright\b|\(c\)\s*\d{4}|©|all\s+rights\s+reserved|\bunauthoriz|\bresale\b|do\s+not\s+redistribute/i;
const CREDIT_PATTERN = /created\s+by|generated\s+by|https?:\/\/|\bby\s+\w/i;

export function scanUpstreamComments(text) {
  const comments = (text.match(/^#.*$/gm) || [])
    .map((line) => line.replace(/^#\s?/, "").trim())
    .filter(Boolean);
  const claims = comments.filter((line) => CLAIM_PATTERN.test(line)).slice(0, 8);
  const credits = comments.filter((line) => !claims.includes(line) && CREDIT_PATTERN.test(line)).slice(0, 8);
  return { claims, credits };
}

// Identity of the transform itself -- independent of title, header, or
// whitespace -- so a re-upload of an existing LUT under a new name is
// caught rather than silently duplicating the catalog. Fixed-point at 9
// decimals: unambiguous across locales, and LUT samples never carry
// meaningful precision beyond it.
export function semanticHash(parsed) {
  const fixed = (value) => Number(value).toFixed(9);
  const parts = [String(parsed.size), ...parsed.domainMin.map(fixed), ...parsed.domainMax.map(fixed)];
  for (const row of parsed.values) parts.push(...row.map(fixed));
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function requireString(value, field, { maxLength = 200 } = {}) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new SubmissionError(`${field} is required`);
  if (trimmed.length > maxLength) throw new SubmissionError(`${field} must be ${maxLength} characters or fewer`);
  return trimmed;
}

function requireEnum(value, field, vocabulary) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!vocabulary.has(normalized)) {
    throw new SubmissionError(`${field} must be one of the declared vocabulary values (got ${JSON.stringify(value)})`);
  }
  return normalized;
}

// Full validation of one submission: cube text + declared metadata.
// Returns { parsed, meta, hash, claims, credits } on success or throws
// SubmissionError with a message safe to show the submitter.
export function validateSubmission({ cube, meta } = {}) {
  if (typeof cube !== "string" || !cube.trim()) {
    throw new SubmissionError("cube text is required");
  }
  if (Buffer.byteLength(cube, "utf8") > MAX_BODY_BYTES) {
    throw new SubmissionError(`cube exceeds the ${MAX_BODY_BYTES} byte limit`, 413);
  }
  if (!meta || typeof meta !== "object") {
    throw new SubmissionError("meta is required");
  }

  let parsed;
  try {
    parsed = parseCube(cube, "submission.cube");
  } catch (error) {
    throw new SubmissionError(`could not parse CUBE: ${error.message}`);
  }
  if (parsed.kind !== "3D") {
    throw new SubmissionError("only 3D CUBE LUTs are accepted (1D LUTs are not supported)");
  }
  if (parsed.size < 2 || parsed.size > 129) {
    throw new SubmissionError(`LUT_3D_SIZE ${parsed.size} is outside the supported range 2-129`);
  }
  // The renderer ignores DOMAIN_MIN/DOMAIN_MAX entirely (site/lut-renderer.js
  // clamps to 0..1 with no domain uniform); a non-unit domain would render
  // wrong on the site with nothing to warn about it, so it is rejected here
  // rather than silently accepted.
  if (parsed.domainMin.some((v) => v !== 0) || parsed.domainMax.some((v) => v !== 1)) {
    throw new SubmissionError("DOMAIN_MIN/DOMAIN_MAX must be 0 0 0 / 1 1 1 -- normalize before submitting");
  }

  const title = requireString(meta.title, "title", { maxLength: 120 });
  const author = requireString(meta.author, "author");
  const license = requireString(meta.license, "license", { maxLength: 60 });
  const licenseUrl = String(meta.licenseUrl ?? "").trim();
  const licenseBasis = requireEnum(meta.licenseBasis, "licenseBasis", VALID_LICENSE_BASIS);
  const transformClass = requireEnum(meta.transformClass, "transformClass", VALID_TRANSFORM_CLASSES);
  const inputColorSpace = requireEnum(meta.inputColorSpace ?? "", "inputColorSpace", VALID_COLOR_SPACES);
  const outputColorSpace = requireEnum(meta.outputColorSpace ?? "", "outputColorSpace", VALID_COLOR_SPACES);
  const colorSpaceConfidence = requireEnum(meta.colorSpaceConfidence, "colorSpaceConfidence", VALID_CONFIDENCE);
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 20)
    : [];
  const authorUrl = String(meta.authorUrl ?? "").trim();
  const assetUrl = String(meta.assetUrl ?? "").trim();
  const source = String(meta.source ?? "").trim();
  const inputGamut = String(meta.inputGamut ?? "unspecified").trim();
  const inputTransfer = String(meta.inputTransfer ?? "unspecified").trim();
  const outputGamut = String(meta.outputGamut ?? "unspecified").trim();
  const outputTransfer = String(meta.outputTransfer ?? "unspecified").trim();

  const { claims, credits } = scanUpstreamComments(cube);

  return {
    parsed,
    hash: semanticHash(parsed),
    claims,
    credits,
    meta: {
      title, author, authorUrl, source, assetUrl, license, licenseUrl, licenseBasis,
      transformClass, tags, inputColorSpace, outputColorSpace, colorSpaceConfidence,
      inputGamut, inputTransfer, outputGamut, outputTransfer,
    },
  };
}

const slugify = (value) => String(value || "")
  .normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase()
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

// Schema-2 header for a community submission (LUT_HEADER_SPEC.md). Simpler
// than convert-all-to-cube.mjs's cubeMetadata() -- there is no upstream
// format conversion here, no CLF/3DL/CSP path, and provenance is exactly
// what the submitter declared, not derived from a collection table.
export function buildHeader({ id, meta, parsed, source: cubeSource, retrievedDate, claims = [], credits = [] }) {
  const gridLabel = `${parsed.size}x${parsed.size}x${parsed.size}`;
  const fields = [
    ["Schema-Version", 2],
    ["ID", id],
    ["Title", meta.title],
    ["Collection", "Community Submissions"],
    ["Collection-ID", "community-submissions"],
    null,
    ["Source", meta.source || "LUTr community submission"],
    ["Asset-URL", meta.assetUrl],
    ["Author", meta.author],
    ["Author-URL", meta.authorUrl],
    ["Retrieved", retrievedDate],
    ["Source-File", `server-submission/${id}.cube`],
    ["Source-Format", "CUBE"],
    ["Source-SHA256", crypto.createHash("sha256").update(cubeSource, "utf8").digest("hex")],
    null,
    ["License", meta.license],
    ["License-URL", meta.licenseUrl],
    ["License-Basis", meta.licenseBasis],
    ...(claims.length ? [["License-Conflict",
      "The uploaded file's own comments assert a copyright/rights claim that " +
      "may contradict the license declared above. This submission was quarantined " +
      "for that reason and approved only after manual review. Verify before any " +
      "further redistribution."]] : []),
    null,
    ["Transform-Class", meta.transformClass],
    ["Tags", [...new Set([...meta.tags, "community", "cube"])].join(", ")],
    null,
    ["Input-Color-Space", meta.inputColorSpace],
    ["Input-Gamut", meta.inputGamut],
    ["Input-Transfer", meta.inputTransfer],
    ["Output-Color-Space", meta.outputColorSpace],
    ["Output-Gamut", meta.outputGamut],
    ["Output-Transfer", meta.outputTransfer],
    ["Color-Space-Confidence", meta.colorSpaceConfidence],
    ["Domain-Normalized", "true"],
    ["Shaper", "none"],
    null,
    ["Original-Grid", gridLabel],
    ["Conversion-Grid", gridLabel],
    ["Conversion-Interpolation", "none"],
    ["Conversion-Method", "Verbatim community submission; header prepended, sample values unmodified"],
    ["Conversion-Tool", "LUTr community submission server 1.0.0"],
    ["Conversion-Date", retrievedDate],
    null,
    // Credits (tool/authorship provenance) are preserved even though CC0 and
    // similar licenses don't require it -- discarding them just because the
    // header gets rebuilt would be a quiet provenance loss. Claims are only
    // ever recorded here (never used to auto-reject); an admin who
    // force-approves a quarantined submission gets the exact claim text
    // carried forward, not just the generic License-Conflict warning above.
    ...credits.map((c) => ["Upstream-Comment", c]),
    ...claims.map((c) => ["Upstream-Comment", `[rights claim] ${c}`]),
    ["Note", "Preserve this metadata and the declared license when redistributing."],
  ];
  const line = ([name, value]) => (name === null ? "#" : `# LUTr-${name}: ${String(value ?? "").replace(/\r?\n/g, " ").trim()}`);
  return fields.map((f) => (f === null ? "#" : line(f))).join("\n");
}

export function deriveId(title, hash) {
  return `community--${slugify(title)}--${hash.slice(0, 9)}`;
}
