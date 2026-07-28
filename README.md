# LUTr

**LUTr is short for LUTrepository.** It is a static, visual catalog for
browsing open LUT collections against curated reference images. The prototype
includes faceted include/exclude filters, measured sorting, provenance and
license metadata, a color-managed before/after viewer, local image uploads,
converted CUBE downloads, a local LUT converter, and multi-LUT comparison.

The public site is deployed to GitHub Pages from `site/`.

## Build the prototype data

```powershell
node scripts/convert-all-to-cube.mjs
node scripts/build-prototype.mjs
node scripts/validate-cubes.mjs
  node scripts/render-prototype-previews.mjs --bases-only
```

Canonical conversion and reference-proxy generation require FFmpeg/FFprobe with
the `tonemap`, `zscale`, rawvideo, PNG, and WebP components. LUT-applied previews
are not stored; the browser renders them from the canonical CUBEs.

Every LUT hosted by the static site is a metadata-rich CUBE. Original CUBE
samples are retained; 3DL, CSP, Hald/strip LUT images, and the supported ACES
CLF operation set are normalized by `convert-all-to-cube.mjs`. WebGL parses
those CUBEs directly as floating-point textures and composes the declared image
space, LUT input space, LUT output space, and sRGB display conversion entirely
in the browser.

The committed `site/data/cube-manifest.json` records source checksums,
conversion methods, grid sizes, color-space confidence, and any known
conversion limitation for all canonical files.

## Run locally

Serve `site/` with any static HTTP server. For example:

```powershell
npx serve site
```

See [`PRD_VISUAL_LUT_CATALOG.md`](PRD_VISUAL_LUT_CATALOG.md) for the product
requirements and color-management roadmap.
