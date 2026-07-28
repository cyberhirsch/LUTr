# Changelog

All notable changes to LUTr are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); dates are UTC.

## [Unreleased] — 2026-07-28

### Added

- **Preview-atlas tier for card thumbnails.** `scripts/build-preview-assets.mjs`
  is a new, dependency-free Node script that bakes a fixed 33³ 8-bit PNG "hald"
  atlas per canonical LUT (`site/assets/atlas/<id>.png`). Card thumbnails and
  the compare-dialog grid now render from this atlas — one native `<img>`
  decode straight to a WebGL texture — instead of fetching and parsing a
  full-precision `.cube` per card. The viewer (1600px) and every download keep
  reading the exact canonical cube untouched; the atlas tier exists only for
  the grid and never feeds a download.
  - `LutRenderer.renderAtlas()` / `LutRenderer.atlasImage()` in
    `site/lut-renderer.js` are the new entry points; the shader itself
    (`readLut()`/`sampleLut()`, `lutSize`/`atlasWidth` uniforms) is unchanged —
    it already addressed a flat atlas texture, so only the JS-side
    texture-fill branches on `lut.image` (8-bit) vs. `lut.pixels` (float).
  - The PNG encoder is hand-rolled (PNG signature + IHDR/IDAT/IEND chunks,
    CRC-32 per the public PNG spec, `zlib.deflateSync` for the zlib-wrapped
    IDAT stream) since the project has no `package.json`/dependencies and the
    container format is simple enough not to warrant adding one. Each
    scanline is filtered adaptively — all five PNG filter types (None, Sub,
    Up, Average, Paeth) are computed per row and whichever minimizes the sum
    of absolute (signed) byte values is kept, the heuristic the PNG spec
    itself recommends. LUT atlas data is smooth (neighboring grid samples
    are near-identical colors), which is exactly the case Up/Paeth filtering
    favors. Round-trip verified: a from-scratch decoder was written
    independently of the encoder and its output compared byte-for-byte
    against fresh `sampleLut()` calls across 9 LUTs / 54 texels — 0
    mismatches.
  - `cube-manifest.json` (and, via `build-prototype.mjs`, `catalog.json`) gain
    two additive fields per LUT: `previewAtlas` (path) and `previewAtlasSize`
    (`33`). No existing field changed shape.

- **Gzip-compressed canonical CUBEs.** The same build script also writes
  `site/assets/luts/<id>.cube.gz` for every canonical cube
  (`zlib.gzipSync`, level 9). `site/lut-io.js` exports one new function,
  `fetchCubeText(url)`, that fetches `${url}.gz` and decompresses it via the
  browser's native `DecompressionStream("gzip")` — the single fetch path
  every consumer (the renderer's viewer path, the catalog-LUT download, the
  compare dialog) now goes through, so the decompression logic exists exactly
  once.

- `site/data/preview-asset-report.json` — a build report (files processed,
  gzip/atlas written vs. skipped, failures, byte totals) in the same style as
  the project's other `*-report.json` build artifacts.

### Changed

- **Canonical cubes are gitignored in plaintext; only `.cube.gz` is tracked.**
  `site/assets/luts/*.cube` is now in `.gitignore`. The 1,170 previously
  tracked plaintext cubes were removed from the git index (`git rm --cached`;
  the files themselves are untouched on disk — they remain the local build
  artifact that `build-preview-assets.mjs` reads and regenerates from). Only
  `<id>.cube.gz` and the new atlas PNGs are tracked and deployed.
- `scripts/validate-cubes.mjs` now validates `site/assets/luts/*.cube.gz`
  (gunzipping before every existing check — BOM, LF-only, schema-header,
  header/manifest parity, structural `parseCube()` checks — all run against
  the decompressed text exactly as before) and additionally confirms every
  manifest entry's `previewAtlas` PNG exists on disk. A plaintext `.cube`
  sitting alongside its `.gz` companion is recognized and allowed but is
  itself unvalidated — it is a legitimate, gitignored local artifact, not
  something a checkout is expected to contain.
- `site/app.js`: `renderClientThumbnails()` and `openCompareDialog()` call
  `lutRenderer.renderAtlas()` against `lut.previewAtlas`/`previewAtlasSize`
  instead of `render()` against the full cube. `downloadCatalogLut()` uses
  `fetchCubeText()` instead of a raw `fetch()` + `.text()`. The card-gating
  logic (`clientPreview`/`needsColorSpace` in `card()`) now checks
  `lut.previewAtlas` rather than `lut.clientLut`, since that's what actually
  feeds the thumbnail now.

### Measured impact

Run against the full catalog of 1,170 canonical CUBEs (2026-07-28):

| | Before | After |
|---|---|---|
| Deployed (`site/`) footprint | 926 MB (93% of GitHub Pages' 1 GB cap) | **~304 MB** |
| 60-card catalog page load | ~47 MB (one full cube per card) | **~1.6 MB** (atlas only) |
| Full-precision cube (viewer/download) | 798 KB average | unchanged — 266.7 MB total, gzipped (~31% of the 855.4 MB plaintext) |
| Average preview atlas | — (didn't exist) | **~27.7 KB** (was ~75.7 KB before adaptive filtering, below) |

`scripts/validate-cubes.mjs` reports 0 failures across all 1,170 gzipped
cubes and 1,170 atlases. Verified live in a browser: card thumbnails load
only atlas PNGs (zero `/assets/luts/` requests on initial page load), the
viewer fetches and decompresses `.cube.gz` and renders correctly (confirmed
visually), the compare dialog renders from atlases, and a converted download
completes without error.

### Fixed

- **Atlas encoder now uses adaptive per-row PNG filtering** (see the Added
  section above). The first pass of `build-preview-assets.mjs` always used
  filter type "None," which left compression on the table for this kind of
  smooth gradient data: atlases averaged 75.7 KB. Adaptive filtering (all
  1,170 atlases regenerated via `--force-atlas`, which skips re-gzipping
  since that tier was already correct) brought the average to **27.7 KB** —
  better than the original ~50 KB estimate — and dropped the deployed
  footprint a further ~55 MB, from ~359 MB to ~304 MB. `--force-atlas` is a
  new CLI flag alongside the existing `--force`, for regenerating just the
  atlas tier without re-touching the unchanged `.gz` files.

### Notes

- `task.md` in the repo root is this session's planning document and was
  intentionally left untracked/uncommitted.
- Card and compare-dialog rendering is now 8-bit (atlas-derived), matching
  the precision of the display itself. The viewer and every downloaded
  `.cube` remain full-precision, sourced from the canonical cube — the
  design explicitly avoids the earlier project's regression where downloads
  were composed from a low-precision atlas.
