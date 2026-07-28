# LUTr CUBE Header Specification

**Schema version 2** · Status: implemented · Supersedes the v1 block formerly
emitted by `scripts/convert-all-to-cube.mjs`

Every LUT hosted by LUTr is a `.cube` file carrying a comment header that is the
*only* source of truth for its identity, provenance, rights, and color path. This
document defines that header.

The governing rule: **a header field is either consumed by code or explicitly
documentary, and this document says which.** Fields that look authoritative but
are ignored by the pipeline are worse than no field at all.

---

## 1. Where the header sits in the pipeline

```
submissions/** or submissions-raw/**   upstream assets (CUBE, 3DL, CLF, Hald PNG/TIF)
   │
   ├─ scripts/convert-all-to-cube.mjs
   │     writes → site/assets/luts/<id>.cube      (canonical CUBE + this header)
   │     writes → site/data/cube-manifest.json    (parsed header, machine-readable)
   │
   ├─ scripts/build-prototype.mjs
   │     reads  ← cube-manifest.json              (the manifest is authoritative)
   │     writes → site/data/catalog.json
   │
   └─ site/app.js + lut-renderer.js + lut-io.js
         read   ← catalog.json, and the .cube directly for rendering/download
```

Two consequences worth stating plainly:

- The header is written **once**, at conversion time. Everything downstream
  consumes the manifest derived from it. A field absent from the header cannot
  be recovered later without a re-conversion.
- `build-prototype.mjs` still *defines* `collections`, `colorMetadata()`,
  `cleanTitle()`, `filenameTags()`, `sidecarMeta()`, `walk()`, `slug()` and
  `shortHash()`, but **calls none of them**. That is dead code left from the
  pre-manifest design; do not add fields there expecting them to take effect.

The local `submissions/**` library is intentionally excluded from GitHub. The
validator recomputes every `Source-SHA256` when that library is present; in the
source-free Pages checkout it validates header/manifest parity and reports the
source hash checks as explicitly skipped.

---

## 2. Syntax

- Header lines are CUBE comments: `# LUTr-<Field>: <value>`, one per line.
- The whole block sits at the top of the file, before `TITLE`, followed by one
  blank line. This is safe for ffmpeg, Resolve and Nuke.
- Field names are `PascalCase-With-Hyphens`. Values are free-form UTF-8 text on
  a single line; embedded newlines must be collapsed to spaces.
- Encoding is **UTF-8, no BOM, LF endings**. Author names such as `Celluloïd`
  are written literally, never escaped.
- Values that are enumerations, ids, or sequences use **ASCII only** — write
  `LUT1D -> Matrix`, not `LUT1D → Matrix`, so the value stays greppable.
- An empty value means *unknown*. Omit the line entirely only for fields marked
  optional below.

### Canonical parse rule

Parse the entire block with one regex into a map, rather than one regex per
field:

```js
const LUTR_FIELD = /^#\s*LUTr-([A-Za-z0-9-]+):\s*(.*)$/;

function parseLutrHeader(text) {
  const fields = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#")) break;          // header ends at the first non-comment
    const m = line.match(LUTR_FIELD);
    if (m) fields.set(m[1], m[2].trim());
  }
  return fields;
}
```

Adding a field then never requires touching the parser. Note this differs from
the current `headerValue()` helper in `convert-all-to-cube.mjs:153`, which builds
a fresh `RegExp` per field and requires `(.+)` — meaning it silently returns
`null` for a present-but-empty field, making "unknown" indistinguishable from
"absent".

### Precedence

When a value can come from more than one place, resolve in this order and emit a
build warning on every fallback:

1. Embedded `LUTr-*` header in the source file
2. `<file>.info.md` sidecar
3. Per-collection defaults table
4. Derived default (filename, extension, etc.)

The count of level-3 and level-4 fallbacks is the project's data-quality metric.

---

## 3. Field reference

Legend — **Req**: ✔ required, ○ optional. **Consumer**: what reads it today.
*needs code* = the field is specified here but nothing consumes it yet.

### 3.1 Identity

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Schema-Version` | ✔ | converter | Integer. `2` for this document. Reject unknown majors rather than guessing. |
| `ID` | ✔ | manifest → catalog | Stable, globally unique, URL-safe. See §4. |
| `Title` | ✔ | catalog → card, viewer | Display name. Authoritative over the `TITLE` line. |
| `Collection` | ✔ | catalog → facet | Human-readable collection name. |
| `Collection-ID` | ✔ | manifest | Folder slug. Must be the authority, so a new collection needs no code edit. |

### 3.2 Provenance

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Source` | ✔ | viewer "Open source" | Collection or repository homepage. |
| `Asset-URL` | ○ | viewer source link | Per-item permalink. Required for per-item sources (e.g. a community site); omit for monolithic repos. |
| `Author` | ○ | catalog → viewer | Required whenever authorship is per-item rather than per-collection. |
| `Author-URL` | ○ | catalog | |
| `Retrieved` | ✔ | audit | ISO 8601 date the upstream file was fetched. |
| `Source-File` | ✔ | audit | Repo-relative path of the **original**, pre-conversion asset. |
| `Source-Format` | ✔ | audit | `CUBE` \| `3DL` \| `CLF` \| `CSP` \| `HALD-PNG` \| `HALD-TIF`. |
| `Source-SHA256` | ✔ | audit | Hash of the **original** file, not the converted one. The anchor for reproducibility. |

### 3.3 Rights

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `License` | ✔ | catalog → facet, sort | SPDX identifier where one exists. |
| `License-URL` | ✔ | catalog | |
| `License-Basis` | ✔ | catalog → viewer | How the license was established. See §5. |
| `Attribution` | ○ | viewer | Credit line, carried even where the license does not require it. |

### 3.4 Classification

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Transform-Class` | ✔ | facet | One of `creative-look`, `film-emulation`, `camera-transform`, `display-transform`, `color-space-conversion`, `tone-map`, `accessibility`. |
| `Tags` | ✔ | facet, search | Comma-separated, lowercase, hyphenated. |
| `Source-Labels` | ○ | remapping | Verbatim upstream facet strings, unmapped. See §6. |
| `Duplicate-Assets` | ○ | importer → manifest → viewer | Semicolon-separated `upstream-id:asset-url` records collapsed into this transform after numeric-sample comparison. Documentary; the canonical asset remains authoritative. |

### 3.5 Color pipeline — the authoritative block

This is the block the renderer depends on. Getting it wrong costs a preview.

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Input-Color-Space` | ✔ | **renderer** | An id from `COLOR_SPACES`, or empty. **Never prose.** See §7. |
| `Input-Gamut` | ✔ | manifest → viewer | An id, or `unspecified`. See §8. |
| `Input-Transfer` | ✔ | manifest → viewer | A transfer id, or `unspecified`. See §8. |
| `Output-Color-Space` | ✔ | **renderer** | As above. |
| `Output-Gamut` | ✔ | manifest → viewer | |
| `Output-Transfer` | ✔ | manifest → viewer | |
| `Color-Space-Confidence` | ✔ | badge | See §5. |
| `Domain-Normalized` | ✔ | audit | `true` \| `false`. See §9. |
| `Shaper` | ✔ | audit | `none`, or a description of the input shaper/prelut baked in. |

### 3.6 Conversion audit trail

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Original-Grid` | ✔ | audit | e.g. `33x33x33`, `1024` for a 1D source, or `analytic` when the source contains only analytic operations. |
| `Conversion-Grid` | ✔ | audit | Must equal `Original-Grid` unless the source format forced a resample. |
| `Conversion-Interpolation` | ✔ | audit | `none` when values are carried verbatim; otherwise `tetrahedral`, `trilinear`, `linear`. |
| `Conversion-Method` | ✔ | catalog | One sentence, human-readable. |
| `Conversion-Tool` | ✔ | audit | Script path **and version**. |
| `Conversion-Date` | ✔ | audit | ISO 8601. |
| `Conversion-Warning` | ○ | catalog → viewer notice | Present only when the conversion lost or bounded information. See §9. |

**Never upsample a 3D mesh.** If the source is a 17³ mesh, ship 17³ and set
`Conversion-Interpolation: none`. Writing it out at 33³ invents data and makes
the grid field a lie. A 1D source may be sampled to a smaller separable 3D grid
when required for browser-compatible hosting; record the interpolation and a
conversion warning.

### 3.7 Upstream block (format-specific, optional)

Emitted when the source format carries structured metadata of its own — today
that means CLF/OCIO. These fields are *descriptive*: they record what upstream
said, and are never parsed as LUTr enums.

| Field | Req | Consumer | Notes |
|---|---|---|---|
| `Upstream-ID` | ○ | identity anchor | e.g. an ACES `urn:aswf:ocio:transformId:…`. Vendor-issued, version-pinned, globally unique — stronger than any hash. Use it to derive `ID` (§4). |
| `Upstream-Name` | ○ | viewer | Upstream's own display name. |
| `Upstream-Input-Descriptor` | ○ | viewer | Verbatim `<InputDescriptor>`. **This is where prose belongs.** |
| `Upstream-Output-Descriptor` | ○ | viewer | Verbatim `<OutputDescriptor>`. |
| `Upstream-Builtin-Transform` | ○ | audit | e.g. `CURVE - APPLE_LOG_to_LINEAR`. |
| `Upstream-Operations` | ○ | **conversion logic** | ASCII-arrow sequence, e.g. `LUT1D` or `LUT1D -> Matrix`. See §10. |
| `Upstream-Domain` | ○ | *needs code* | `bounded` \| `unbounded`. See §9. |
| `Upstream-Comment` | ○ | — | Repeatable. Verbatim non-LUTr comment lines from the source, capped at 30. |

---

## 4. Identity rules

`ID` must be stable across re-conversions and re-crawls. Derive it, in order of
preference, from:

1. `Upstream-ID` — normalise the URN to a URL-safe slug.
2. A stable upstream key (a per-item permalink id, e.g. `/luts/185` → `0000185`).
3. `Source-SHA256` — content identity.

Do **not** derive it from the local file path. The v1 scheme
(`slug(collection)--slug(title)--sha256(relativePath)[0:9]`) means renaming a
folder changes every id in it and orphans every cached preview.

---

## 5. Confidence and license-basis vocabularies

`Color-Space-Confidence`:

| Value | Meaning |
|---|---|
| `declared-by-source` | Upstream states the encoding explicitly. |
| `inferred-from-source-label` | A structured upstream camera/gamma label maps to a LUTr profile id; useful evidence, but not per-file technical documentation. |
| `documented-primaries-assumed` | Transfer documented, primaries inferred. |
| `assumed-display-referred` | No statement; treated as sRGB in and out. |
| `descriptor-only` | Upstream gives prose only, not a resolvable encoding. |
| `camera-profile-input-required` | Input depends on a camera profile LUTr does not model. |
| `unverified` | Nothing established. |

`License-Basis` — the honesty field:

| Value | Meaning |
|---|---|
| `per-asset-notice` | A license notice in or beside the file itself. |
| `repo-license-file` | A LICENSE file in the upstream repository. |
| `site-terms` | The hosting site's terms declare a blanket license. |
| `assumed` | Inferred. Not evidence. |

Without this, the catalog cannot distinguish "GPL-3.0 because the repo has a
LICENSE file" from "GPL-3.0 because someone typed it into a table". For a
project whose premise is *know the source*, that distinction **is** the product.

---

## 6. `Source-Labels`

Verbatim upstream classification strings, before any mapping:

```
# LUTr-Source-Labels: gamma=Arri log c; color=None; key=Neutral; style=Film emulation
```

Semicolon-separated `key=value` pairs. Opaque to the site — its only purpose is
that a mapping error becomes a table fix and a rebuild, rather than a re-crawl
of every upstream page. Cheap insurance on any one-way import.

---

## 7. `Input-Color-Space` / `Output-Color-Space` must be ids

`site/color-spaces.js` resolves these through a case-sensitive `Map.get`. The
complete set of valid ids today:

```
srgb              rec709            rec709-gamma24    linear-rec709
display-p3        linear-p3         rec2020-gamma24   linear-rec2020
acescg            aces2065-1
sony-slog3-sgamut3             sony-slog2-sgamut
sony-slog1-sgamut              arri-logc3-ei800-awg3
panasonic-vlog-vgamut          panasonic-vlogl-vgamut
dji-dlog-dgamut                bmd-film
bmd-film-4k                    canon-cinestyle
canon-log-cinema-gamut         canon-log2-cinema-gamut
canon-log3-cinema-gamut        red-logfilm-rwg
panasonic-cinelike-d           gopro-protune-native
```

Anything else resolves to `null` → `pipelineReady()` returns false → the card
renders the grey *"Input/output color space required"* placeholder instead of a
preview.

**This is the single most common way to break a LUT.** The schema-2 converter
lower-cases valid ids and promotes exact resolvable descriptors such as
`ACES2065-1`. In the 2026-07-28 build, 976 of 1,181 canonical transforms have a
complete input/output id path. Of those, six are still classified as bounded
approximations, leaving 970 immediately previewable transforms.

The cause in most cases is prose leaking into an enum field:

```
# WRONG — a descriptor in an id field
# LUTr-Input-Color-Space: Apple Log (arbitrary primaries)

# RIGHT — id field left empty, prose kept in the upstream block
# LUTr-Input-Color-Space:
# LUTr-Upstream-Input-Descriptor: Apple Log (arbitrary primaries)
```

### Normalise case before comparing

`aces2065-1` and `srgb` are canonical ids. The converter and browser reader both
lower-case ids before lookup; descriptors remain verbatim in the upstream block.

---

## 8. Splitting gamut from transfer

`(arbitrary primaries)` is upstream saying *this is a pure transfer curve with no
gamut*. LUTr's single-id model bundles primaries and transfer together and
structurally cannot express that — which is exactly why descriptors ended up in
the enum fields.

Record both decompositions:

```
# LUTr-Input-Color-Space:
# LUTr-Input-Gamut: unspecified
# LUTr-Input-Transfer: apple-log
```

`Input-Color-Space` stays authoritative when a single id captures the whole
encoding. When it cannot, the gamut/transfer pair carries the meaning.

This matches how the renderer is already built: `lut-renderer.js` applies
primaries as a `mat3` uniform (`sourceToLut`, `lutToDisplay`) and transfer as a
separate `int`. `Gamut: unspecified` maps to the identity matrix, so only the
curve needs implementing — which makes roughly half the ACES set renderable
without any gamut research.

> **Prerequisite.** No log transfer functions exist yet. `color-spaces.js`
> defines four: `0` linear, `1` sRGB, `2` Rec.709 OETF, `3` gamma 2.4. Each new
> curve must be added **twice** — `decodeTransfer`/`encodeTransfer` in
> `site/color-spaces.js` and `decodeValue`/`encodeValue` in the GLSL in
> `site/lut-renderer.js` — and the two are hand-duplicated with no test holding
> them in sync. Constants must come from published vendor specifications.

---

## 9. Domain and boundedness

The WebGL shader **ignores `DOMAIN_MIN`/`DOMAIN_MAX` entirely**: `sampleLut()`
clamps to 0–1 and there is no domain uniform. `site/lut-io.js` *does* honour the
domain. So a non-unit-domain LUT renders wrong on the site while converting
correctly in the browser converter, with nothing to warn you.

Therefore the converter must normalise to a 0–1 domain and assert it:

```
# LUTr-Domain-Normalized: true
```

Where the upstream transform is genuinely unbounded — a log→linear curve whose
output is scene-linear — normalisation is *lossy*, and that must be stated:

```
# LUTr-Upstream-Domain: unbounded
# LUTr-Conversion-Warning: A sampled 3D CUBE is bounded to DOMAIN_MIN/MAX 0..1
#   and cannot preserve CLF values outside its input domain.
```

58 entries currently carry this warning, and their data already falls outside the
representable range (the Apple Log curve's first sample is `-0.056410879`).

**Such entries should not be counted as previewable.** `previewStatus:
"bounded-approximation"` keeps them out of the "Visual previews only" filter and
stops `stats.metadataOnly: 0` from claiming more than the data supports.

---

## 10. `Upstream-Operations` is a correctness signal

Not trivia — branch on it during conversion:

| Value | Implication |
|---|---|
| `LUT1D` | Pure curve. `Gamut: unspecified` is truthful. Sampling into 33³ stores 35,937 samples for a 1D function — consider preserving it as 1D. |
| `LUT1D -> Matrix` | A gamut change **is** baked in. `(arbitrary primaries)` is false for this file, and `Gamut: unspecified` would be wrong. |
| `Matrix` | Pure gamut conversion; transfer is unchanged. |
| contains `LUT3D` | Genuine 3D transform; convert normally. |

---

## 11. Complete examples

### 11.1 Creative look, verbatim 3D CUBE

```
# LUTr-Schema-Version: 2
# LUTr-ID: freshluts--0000185-celluloid
# LUTr-Title: Celluloïd
# LUTr-Collection: Fresh LUTs
# LUTr-Collection-ID: freshluts-community
#
# LUTr-Source: https://freshluts.com
# LUTr-Asset-URL: https://freshluts.com/luts/185
# LUTr-Author: Celluloïd
# LUTr-Author-URL: https://freshluts.com/users/2555
# LUTr-Retrieved: 2026-07-27
# LUTr-Source-File: submissions/freshluts-community/0000185-celluloid.cube
# LUTr-Source-Format: CUBE
# LUTr-Source-SHA256: 478d75056b08288ed45372177631c78b4989ec14f355e3f1ecd0beaa8d80d047
#
# LUTr-License: CC0-1.0
# LUTr-License-URL: https://freshluts.com/termsandconditions
# LUTr-License-Basis: site-terms
# LUTr-Attribution: Celluloïd via Fresh LUTs (CC0; attribution not required)
#
# LUTr-Transform-Class: creative-look
# LUTr-Tags: creative, film-emulation, arri, logc, neutral
# LUTr-Source-Labels: gamma=Arri log c; color=None; key=Neutral; style=Film emulation
#
# LUTr-Input-Color-Space:
# LUTr-Input-Gamut: unspecified
# LUTr-Input-Transfer: arri-logc3-ei800
# LUTr-Output-Color-Space: srgb
# LUTr-Output-Gamut: rec709
# LUTr-Output-Transfer: srgb
# LUTr-Color-Space-Confidence: declared-by-source
# LUTr-Domain-Normalized: true
# LUTr-Shaper: none
#
# LUTr-Original-Grid: 33x33x33
# LUTr-Conversion-Grid: 33x33x33
# LUTr-Conversion-Interpolation: none
# LUTr-Conversion-Method: Verbatim 3D CUBE; header prepended, sample values unmodified
# LUTr-Conversion-Tool: LUTr scripts/import-freshluts.mjs 1.0.0
# LUTr-Conversion-Date: 2026-07-27
# LUTr-Note: Preserve this metadata and the upstream license notice when redistributing.

TITLE "Celluloïd"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
```

### 11.2 CLF curve with an unbounded output

```
# LUTr-Schema-Version: 2
# LUTr-ID: ocio-aces--apple-input-apple-log-curve-to-linear-1-0
# LUTr-Title: Apple Log to Linear Curve
# LUTr-Collection: OCIO ACES
# LUTr-Collection-ID: aswf-opencolorio-config-aces
#
# LUTr-Source: https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES
# LUTr-Retrieved: 2026-07-27
# LUTr-Source-File: submissions/aswf-opencolorio-config-aces/opencolorio_config_aces/clf/transforms/apple/input/Apple.Input.Apple_Log-Curve.clf
# LUTr-Source-Format: CLF
# LUTr-Source-SHA256: d174df49d3e327662d67a26c0b602da39acc31a678c0700c9e257fdabc2f27da
#
# LUTr-License: BSD-3-Clause
# LUTr-License-URL: https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/blob/main/LICENSE
# LUTr-License-Basis: repo-license-file
#
# LUTr-Transform-Class: color-space-conversion
# LUTr-Tags: technical, aces, ocio, clf, color-management, apple-log
#
# LUTr-Input-Color-Space:
# LUTr-Input-Gamut: unspecified
# LUTr-Input-Transfer: apple-log
# LUTr-Output-Color-Space:
# LUTr-Output-Gamut: unspecified
# LUTr-Output-Transfer: linear
# LUTr-Color-Space-Confidence: descriptor-only
# LUTr-Domain-Normalized: true
# LUTr-Shaper: none
#
# LUTr-Original-Grid: 65536
# LUTr-Conversion-Grid: 33x33x33
# LUTr-Conversion-Interpolation: linear
# LUTr-Conversion-Method: CLF operations evaluated as float and sampled to a 33x33x33 3D CUBE
# LUTr-Conversion-Tool: LUTr scripts/convert-all-to-cube.mjs 1.0.0
# LUTr-Conversion-Date: 2026-07-27
# LUTr-Conversion-Warning: A sampled 3D CUBE is bounded to DOMAIN_MIN/MAX 0..1 and cannot preserve CLF values outside its input domain.
#
# LUTr-Upstream-ID: urn:aswf:ocio:transformId:1.0:Apple:Input:Apple_Log-Curve_to_Linear:1.0
# LUTr-Upstream-Name: Apple Log to Linear Curve
# LUTr-Upstream-Input-Descriptor: Apple Log (arbitrary primaries)
# LUTr-Upstream-Output-Descriptor: Linear (arbitrary primaries)
# LUTr-Upstream-Builtin-Transform: CURVE - APPLE_LOG_to_LINEAR
# LUTr-Upstream-Operations: LUT1D
# LUTr-Upstream-Domain: unbounded
# LUTr-Note: Preserve this metadata and the upstream license notices when redistributing.

TITLE "Apple Log to Linear Curve"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
```

---

## 12. Conformance checklist

A file conforms to schema 2 when:

- [ ] `Schema-Version: 2` is the first `LUTr-` line.
- [ ] All ✔ fields from §3 are present; unknown values are empty, not omitted.
- [ ] `ID` derives from upstream identity, never from a local path (§4).
- [ ] `Input-Color-Space` and `Output-Color-Space` are either a valid id from
      §7 or empty. No prose, no mixed case.
- [ ] Any descriptor text lives in an `Upstream-*-Descriptor` field.
- [ ] `Domain-Normalized: true`, with `DOMAIN_MIN 0 0 0` / `DOMAIN_MAX 1 1 1`.
- [ ] `Conversion-Grid` ≤ `Original-Grid`; `Conversion-Interpolation: none`
      whenever values are carried verbatim.
- [ ] A `Conversion-Warning` is present whenever information was bounded or lost.
- [ ] `License-Basis` states how the license was established.
- [ ] The file is a 3D CUBE with `LUT_3D_SIZE` between 2 and 129 — `parseCube()`
      in `site/lut-io.js` rejects `LUT_1D_SIZE` outright.
- [ ] UTF-8, no BOM, LF, ASCII-only enum values.

---

## 13. Outstanding code work

The spec is ahead of the implementation. In dependency order:

1. **Teach `lut-renderer.js` to accept the emitted gamut/transfer pair** as an
   alternative to a single color-space id.
2. **Implement the log transfer curves** — in both `color-spaces.js` and the
   GLSL — for the encodings the catalog actually contains. Add a test asserting
   the JS and GLSL implementations agree.
3. **Carry provenance through `composeCube()`.** Downloads currently emit five
   comment lines and drop author, license, and source entirely — the inverse of
   what the source files carry.
4. **Delete the dead code in `build-prototype.mjs`** (§1) so the manifest is
   visibly the only authority.
