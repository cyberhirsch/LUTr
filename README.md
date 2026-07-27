# LUTr — LUTrepository

**LUTr is short for LUTrepository.** It is a static, visual catalog for
browsing open LUT collections against curated reference images. The prototype
includes faceted include/exclude filters, measured sorting, provenance and
license metadata, a before/after viewer, and multi-LUT comparison.

The public site is deployed to GitHub Pages from `site/`.

## Build the prototype data

```powershell
node scripts/build-prototype.mjs
node scripts/render-prototype-previews.mjs
```

The preview render requires FFmpeg with the `lut3d`, `haldclut`, `tonemap`,
`zscale`, and WebP encoder components.

## Run locally

Serve `site/` with any static HTTP server. For example:

```powershell
npx serve site
```

See [`PRD_VISUAL_LUT_CATALOG.md`](PRD_VISUAL_LUT_CATALOG.md) for the product
requirements and color-management roadmap.
