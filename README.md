# LUTr

**LUTr is short for LUTrepository.** It is a static, visual catalog for
browsing open LUT collections against curated reference images. The prototype
includes faceted include/exclude filters, measured sorting, provenance and
license metadata, a color-managed before/after viewer, local image uploads,
converted CUBE downloads, a local LUT converter, and multi-LUT comparison.

The public site is deployed to GitHub Pages from `site/`.

## Build the prototype data

```powershell
node scripts/build-prototype.mjs
node scripts/build-client-luts.mjs
node scripts/render-prototype-previews.mjs
```

The client-LUT and fallback preview renders require FFmpeg with the `lut3d`,
`haldclut`, `tonemap`, `zscale`, PNG, and WebP encoder components.

The static site converts supported LUT assets into compact 25³ atlases. WebGL
then composes the declared image color space, LUT input space, LUT output
space, and sRGB display conversion entirely in the browser.

## Run locally

Serve `site/` with any static HTTP server. For example:

```powershell
npx serve site
```

See [`PRD_VISUAL_LUT_CATALOG.md`](PRD_VISUAL_LUT_CATALOG.md) for the product
requirements and color-management roadmap.
