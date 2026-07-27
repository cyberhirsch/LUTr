# Product Requirements Document: LUTr — LUTrepository Visual Catalog

**Working title:** LUTr — LUTrepository  
**Document status:** Draft for implementation  
**Target release:** MVP  
**Hosting:** GitHub Pages  
**Product type:** Static, read-only website  
**Primary repository data:** `submissions/`, `Images/`, and their metadata sidecars

## 1. Product summary

LUTr, short for **LUTrepository**, is a fast, static visual catalog for
discovering, understanding, and comparing open, license-cleared LUTs.

Visitors first browse a curated set of reference images. After choosing an
image, they see that image rendered through every compatible LUT in a visual
grid. They can search, filter, sort, inspect provenance, compare variants, and
download the original LUT without creating an account.

The catalog must prioritize color-science correctness over a superficially
large result count. A LUT should not be presented as a meaningful visual result
unless the selected image can be transformed into the LUT's expected input
encoding and the LUT output can be transformed correctly for browser display.
Unknown or incompatible combinations may be exposed behind an explicit
“experimental” control, but must never look equivalent to validated previews.

## 2. Problem statement

Open LUT collections are fragmented across repositories and use inconsistent
names, formats, documentation, licenses, and color-space assumptions. A folder
of LUT files does not answer the questions users actually have:

- What does this LUT look like on skin, charts, landscapes, interiors, or HDR?
- Is it creative, technical, corrective, accessibility-oriented, or a display
  transform?
- What input color space and transfer function does it expect?
- What does it output?
- Can it be used commercially, and what attribution or source obligations
  apply?
- Is the preview colorimetrically valid or merely illustrative?
- Which LUTs are similar, more extreme, safer, reversible, or better documented?

The site solves this by combining controlled reference images, normalized
metadata, color-managed previews, and a faceted discovery system.

## 3. Goals

### 3.1 Primary goals

1. Let a visitor choose a reference image and visually scan all compatible LUTs.
2. Make filtering and sorting powerful enough for both casual look discovery
   and technical pipeline work.
3. Expose source, license, attribution, input/output assumptions, checksum, and
   provenance for every LUT.
4. Provide trustworthy comparisons with a consistent, documented rendering
   pipeline.
5. Remain fully static, privacy-respecting, and deployable through GitHub Pages.
6. Make catalog additions reproducible through repository metadata and a build
   process, not hand-authored website pages.

### 3.2 Secondary goals

- Encourage better LUT metadata and tagging practices.
- Make obscure non-CUBE collections browsable through build-time normalization.
- Allow deep links to an image, LUT, filter state, or comparison.
- Provide machine-readable catalog JSON for reuse.
- Make license and provenance problems visible instead of silently omitting
  context.

### 3.3 Non-goals for MVP

- User accounts, cloud libraries, ratings, comments, or social features.
- Browser uploads of private footage.
- Selling LUTs or accepting payments.
- Claiming that a visual preview is a substitute for production validation.
- Editing LUTs or authoring new LUTs.
- Applying every CLF transform without an explicit, valid color path.
- Hosting unlicensed, ambiguously licensed, or provenance-unclear collections.

## 4. Target users

### 4.1 Colorist or finishing artist

Needs to narrow creative looks quickly, confirm expected input/output, evaluate
skin and highlight behavior, and download the original transform with its
license.

### 4.2 Filmmaker or editor

May not know color-management terminology. Needs visual browsing, plain-language
descriptions, sensible defaults, and warnings before using a technically
incompatible LUT.

### 4.3 DIT, pipeline TD, or color scientist

Needs exact format, dimensions, domain, transform class, encoding, checksum,
provenance, clipping behavior, monotonicity, and validation status.

### 4.4 Developer or researcher

Needs deterministic metadata, stable IDs, catalog JSON, source URLs, licenses,
and test assets suitable for regression workflows.

### 4.5 Accessibility specialist

Needs to find simulation and correction LUTs by vision condition, purpose, and
severity without mixing them into creative-look results.

## 5. Product principles

1. **Compatibility before aesthetics.** Valid input/output handling determines
   whether a preview belongs in the default result set.
2. **Every result explains itself.** Source, license, transform purpose, and
   preview validity are always reachable.
3. **Filters use controlled vocabulary.** Free-form tags remain searchable but
   do not replace normalized facets.
4. **The original is always available.** A processed image must have an obvious
   before view.
5. **Static does not mean simplistic.** Search, filtering, comparison, and URL
   state all run locally after compact indexes load.
6. **Unknown is a value, not an omission.** Missing metadata is displayed and
   filterable.
7. **License clarity is a feature.** Commercial-use and attribution filters
   must not reduce nuanced licenses to an unexplained green checkmark.

## 6. Information architecture

### 6.1 Primary routes

| Route | Purpose |
|---|---|
| `/` | Landing page, image chooser, featured collections, catalog statistics |
| `/images/` | Browse all reference images by scene content and encoding |
| `/image/{image-id}/` | Selected-image LUT gallery |
| `/lut/{lut-id}/` | LUT detail, previews across multiple reference images |
| `/compare/` | Compare 2–4 LUTs on one image |
| `/collections/` | Browse source collections |
| `/collection/{collection-id}/` | Collection detail and contained LUTs |
| `/licenses/` | License glossary, obligations, and catalog counts |
| `/methodology/` | Rendering pipeline, validation rules, limitations |
| `/about/` | Project scope, contribution workflow, repository link |

Static generation must produce a real `index.html` for important detail routes.
Client-side routing may enhance navigation but must not be required for direct
links or refreshes.

### 6.2 Global navigation

- Images
- LUTs
- Collections
- Compare
- Methodology
- GitHub

The global header also contains compact search and a theme selector.

## 7. Core user flows

### 7.1 Browse an image, then all LUTs

1. User lands on the image chooser.
2. User filters images by content such as skin, chart, landscape, HDR, or
   artificial light.
3. User selects an image.
4. The gallery opens with “compatible and validated” LUTs selected by default.
5. Thumbnails progressively load in the current sort order.
6. User adjusts filters or chooses a sorting mode.
7. User opens a LUT card for a larger before/after view and metadata.
8. User may add the LUT to Compare or download the original.

### 7.2 Find a LUT for a known pipeline

1. User opens the LUT catalog.
2. User selects input gamut, input transfer, and desired output.
3. User limits results to technical transforms or creative looks.
4. User chooses a permissive-license preset if required.
5. User sorts by metadata completeness or validation status.
6. User opens the LUT detail and confirms its assumptions.

### 7.3 Discover a creative look

1. User selects a skin, landscape, or interior reference.
2. User chooses Creative Look.
3. User selects tonal and color facets such as warm, low contrast, muted, or
   film-like.
4. User sorts by visual similarity, intensity, or name.
5. User uses a before/after wipe and adds candidates to Compare.

### 7.4 Audit licensing

1. User filters Commercial use = allowed.
2. User optionally selects Attribution = not required.
3. Results show license badges with obligations, not just license names.
4. User opens a LUT and follows the source and license links.
5. Download includes or links to the original license and attribution record.

## 8. Image catalog requirements

### 8.1 Initial image set

The MVP uses the existing curated references:

- Kodak Digital LAD “Marcie”
- Sony F35 Still Life
- ACES Synthetic Chart
- OpenEXR StillLife
- OpenEXR MtTamWest
- OpenEXR Desk
- Netflix Sparks frame
- Netflix Meridian frame
- Tears of Steel frame
- Poly Haven daylight HDRI
- Poly Haven artificial-light HDRI

Marcie must be marked **internal/reference only — redistribution rights unclear**
and must not be included in the public deployed artifact unless documented
permission is obtained. Its catalog record may exist without a publicly served
image, or development builds may use a locally supplied copy.

### 8.2 Image facets

- Content: face, skin, chart, grayscale, saturated objects, practical objects,
  landscape, sky, foliage, interior, reflective material, VFX, text/UI
- Lighting: daylight, overcast, studio, artificial, mixed, emissive, high
  contrast, low contrast
- Dynamic range: SDR, HDR, extended scene-linear, unknown
- Source type: camera, scan, synthetic, rendered, final film, HDRI
- Encoding: log, scene-linear, PQ, display-referred, Radiance HDR, unknown
- Gamut/primaries: ACES AP0, P3-D65, Rec.2020, sRGB/Rec.709, unspecified
- License status: cleared, conditional, internal only, unknown
- Technical purpose: skin, highlight roll-off, gamut stress, ramps, neutral
  balance, mathematical regression, IBL

### 8.3 Image card

Each card shows:

- Web preview
- Title and source
- Primary content tags
- Encoding badge
- HDR/SDR badge
- License-status badge
- Count of compatible LUTs
- Warning icon if the browser preview is tone-mapped or otherwise not a direct
  representation of the source

## 9. LUT taxonomy

The taxonomy is hierarchical. Each LUT has one primary transform class and may
have multiple secondary descriptors.

### 9.1 Primary transform class

- Creative look
- Camera/input transform
- Display/output transform
- Color-space conversion
- Tone map / HDR-to-SDR
- Film emulation
- Print-film emulation
- Utility / calibration
- Accessibility simulation
- Accessibility correction
- Experimental / unknown

### 9.2 Signal role

- Scene-referred
- Display-referred
- Input device transform
- Look modification transform
- Output device transform
- Round-trip / inverse
- Unknown

### 9.3 Expected input

Separate facets must be used rather than one compound string:

- Camera/manufacturer
- Camera/model
- Picture profile
- Input gamut/primaries
- Input transfer/gamma/log curve
- Input range: full, legal/video, normalized, HDR absolute, unknown
- Input white point
- Scene-referred/display-referred

Examples include Sony a6000 Portrait, DJI D-Cinelike, REDlogFilm,
scene-linear, ACES2065-1, ACEScct, sRGB, P3/PQ, and unknown.

### 9.4 Output

- Output gamut/primaries
- Output transfer function
- Output dynamic range
- Display target and peak luminance when known
- Creative intent versus technical target
- White point
- Legal/full range

### 9.5 Look characteristics

Controlled values:

- Temperature: cool, neutral, warm
- Tint: green, neutral, magenta
- Contrast: lifted, low, medium, high, crushed
- Black behavior: lifted, neutral, crushed, tinted
- Highlight behavior: soft, neutral, hard, clipped
- Saturation: monochrome, muted, neutral, saturated
- Color bias: cyan, teal, blue, green, yellow, orange, red, magenta
- Skin behavior: protected, warmed, cooled, shifted, unknown
- Palette: complementary, teal-orange, monochromatic, pastel, bleach bypass,
  vintage, clean, stylized
- Medium/style: print film, negative film, slide film, instant film, digital,
  broadcast, cinematic
- Intensity: subtle, moderate, strong, extreme

These may initially be human-authored. Later releases may suggest values from
computed measurements, but automated classifications must be identified as
machine-derived.

### 9.6 Technical properties

- Original format: CUBE, 3DL, CLF, Hald PNG, Hald TIFF, PP3
- Normalized preview format and cube size
- 1D, 3D, 1D+3D, process list, or image CLUT
- Grid size
- Domain minimum/maximum
- Bit depth where applicable
- Interpolation recommendation
- Forward, inverse, or unknown direction
- Monotonic/non-monotonic
- Clipping detected: shadows, highlights, gamut
- Values outside normalized range
- Alpha behavior
- Parse/validation status
- Deterministic checksum

### 9.7 Provenance and license

- Collection
- Creator/maintainer
- Source repository
- Source file path
- Upstream version or commit
- SHA-256
- License identifier
- Commercial use: allowed, conditional, unclear, prohibited
- Attribution required
- Share-alike required
- Source/license notice required
- Modification allowed
- Redistribution allowed
- Trademark/provenance caveat
- Provenance tier:
  - A: explicit per-file or uniform collection license and known author
  - B: explicit repository license with adequate collection-level provenance
  - C: licensed but incomplete input/output metadata
  - Quarantined: unclear upstream rights; not published

## 10. Search, filtering, and sorting

### 10.1 Search

Search covers:

- LUT title and filename
- Collection and creator
- Controlled tags and aliases
- Camera, gamut, transfer function, and output target
- License name
- Description and notes

Search must normalize punctuation, hyphens, case, and common aliases. Examples:

- `slog2`, `s-log2`, and `S Log 2`
- `rec709`, `Rec. 709`, and `BT.709`
- `black and white`, `b&w`, and `monochrome`
- `cc0`, `public domain`, and `no attribution`

Quoted phrases require an exact phrase. Prefixes such as `license:`, `input:`,
`output:`, `tag:`, `format:`, and `collection:` provide expert search without
being required for normal use.

### 10.2 Filter behavior

- AND across different facets.
- OR within one facet.
- Every value supports include, exclude, or neutral state.
- Active filters appear as removable chips.
- Each option shows the prospective result count.
- Counts update without a page reload.
- Filter state is encoded in the URL.
- Browser Back/Forward restores state.
- “Clear all” and “Reset to recommended” are always visible.
- Empty results explain which constraints conflict and offer one-click
  relaxation suggestions.
- Desktop uses a persistent sidebar; mobile uses a full-height filter drawer.
- Long facets support search, selected-first ordering, and collapsed overflow.
- Users may save named filter presets in local storage.

### 10.3 Core filter groups

Recommended default order:

1. Preview compatibility
2. Transform class
3. Expected input
4. Output
5. Look characteristics
6. Scene suitability
7. Technical properties
8. License and commercial use
9. Validation and provenance
10. Collection and creator

### 10.4 Preview compatibility filter

Values:

- Validated for selected image
- Convertible with known color path
- Illustrative only
- Input metadata unknown
- Incompatible
- Preview unavailable

Default: the first two values only.

“Show experimental results” reveals illustrative, unknown, and incompatible
combinations with striped warning treatment and without mixing them into the
default ranking.

### 10.5 License filter

User-facing presets:

- Any published license
- Commercial use allowed
- No attribution required
- Permissive software-style licenses
- Copyleft/share-alike acceptable
- Redistribution allowed
- Modification allowed

The UI must show obligations separately. “Commercial use allowed” must not imply
that attribution, share-alike, trademark, or notice obligations disappear.

### 10.6 Scene-suitability filter

Values:

- Skin/faces
- Landscape/sky
- Interior/mixed light
- Reflective/specular
- HDR highlights
- Charts/ramps
- VFX/compositing
- Accessibility testing
- General purpose

Suitability can be curated or derived from evaluation coverage. The catalog
must not claim a LUT is good for skin merely because it was previewed on skin.

### 10.7 Sort modes

| Sort | Definition |
|---|---|
| Recommended | Compatibility, preview validity, metadata completeness, then stable title |
| Search relevance | Text relevance, compatibility boost, exact-tag boost |
| Name A–Z / Z–A | Locale-aware display title with filename tie-breaker |
| Collection | Collection title, LUT title |
| Recently added | Catalog import date, newest first |
| Recently updated | Upstream commit/import timestamp |
| Most documented | Metadata completeness score |
| License permissiveness | CC0/Unlicense, permissive, attribution, copyleft/share-alike, unclear |
| Preview confidence | Validated, convertible, illustrative, unknown, unavailable |
| Subtle → extreme | Computed transform-intensity score |
| Extreme → subtle | Reverse intensity |
| Low → high contrast | Measured neutral-ramp contrast effect |
| Cool → warm | Measured neutral/skin-region temperature shift |
| Muted → saturated | Measured chroma response |
| Least → most clipping | Measured clipped-sample percentage |
| Most similar | Distance from a chosen LUT fingerprint |
| Most different | Reverse visual distance for exploration |
| Randomized | Seeded deterministic shuffle; seed stored in URL |

All sorts require a stable final tie-breaker using LUT ID so cards do not jump
between renders.

### 10.8 Recommended ranking

The default score is transparent and documented:

- 40% selected-image compatibility
- 20% preview validation confidence
- 15% metadata completeness
- 10% provenance tier
- 10% selected filter/tag affinity
- 5% deterministic discovery rotation

License permissiveness must not silently affect Recommended ranking unless the
user selects a license preference.

### 10.9 Visual fingerprint

The build pipeline should evaluate each applicable LUT against a standard
linear/log test volume and store a compact fingerprint:

- Mean lightness shift
- Shadow, midtone, and highlight slope
- Black and white clipping percentage
- Mean chroma ratio
- Warm/cool axis shift
- Green/magenta axis shift
- Skin-line displacement
- Primary and secondary hue rotations
- Gamut excursion
- Non-monotonic sample percentage

Fingerprints enable intensity, warmth, saturation, clipping, similarity, and
difference sorting. They are diagnostic measurements, not aesthetic ratings.

## 11. Selected-image LUT gallery

### 11.1 Header

- Image title, source, encoding, license, and purpose
- Change-image control
- Original-image button
- Compatible-result count
- Methodology link
- Tone-map/display warning when applicable

### 11.2 Gallery card

Each card contains:

- Processed thumbnail
- LUT title
- Collection
- Transform-class badge
- Input → output summary
- License badge
- Preview confidence indicator
- Favorite/Compare toggle stored locally
- Overflow menu: details, copy link, download, source

Hover may temporarily reveal the original. Keyboard focus must expose the same
function. Touch devices use a visible before/after toggle.

### 11.3 Detail viewer

- Large color-managed preview
- Original / processed toggle
- Draggable vertical wipe
- Split, flicker, and side-by-side modes
- Zoom and pan
- Optional waveform, RGB parade, vectorscope, and false-color overlays
- LUT metadata and source/license panel
- Preview-pipeline explanation
- Download original asset
- Add to Compare
- “Report metadata problem” link that opens a prefilled GitHub issue

### 11.4 Compare mode

- Compare 2–4 LUTs on the same selected image
- Synchronized zoom/pan
- Grid, wipe, and A/B flicker
- Lock one reference slot to Original
- Compact metadata-difference table
- Shareable URL containing image and LUT IDs
- Graceful warning when selected LUTs require incompatible input pipelines

## 12. Rendering and color-management pipeline

### 12.1 Build-time pipeline

1. Parse image and LUT sidecars.
2. Validate source/license requirements.
3. Parse CUBE files and inspect dimensions/domain.
4. Convert supported Hald CLUT and 3DL assets into a normalized preview
   representation while retaining the original download.
5. Resolve CLF only when an explicit input/output context permits deterministic
   baking; otherwise publish metadata without a visual preview.
6. Transform each reference image into the LUT's expected input.
7. Apply the LUT with the documented interpolation.
8. Transform the result to the site's browser-display target.
9. Generate responsive AVIF/WebP/JPEG previews and a small dominant-color
   placeholder.
10. Record the complete transform path and tool versions in the preview
    manifest.

OpenColorIO should be the reference implementation for known color-space
transforms. Equivalent tooling may be used only if regression tests demonstrate
matching output within a documented tolerance.

### 12.2 Browser display target

- Default output: sRGB / standard dynamic range.
- Preserve an obvious label when HDR material has been tone-mapped for browser
  display.
- A later enhancement may offer browser HDR where supported, but SDR must remain
  deterministic and fully functional.
- Do not serve EXR, DPX, high-bit-depth TIFF, or Radiance HDR as the primary web
  display asset; generate web-compatible derivatives.

### 12.3 Preview status

Every image×LUT combination has one status:

- `validated`
- `converted`
- `illustrative`
- `incompatible`
- `unknown`
- `unavailable`

Only `validated` and `converted` appear by default.

### 12.4 Pre-rendered versus client-rendered

MVP uses pre-rendered thumbnails for correctness and broad device support.
Client-side WebGL may provide interactive full-resolution adjustments later,
but it must use the same catalog metadata and be regression-tested against the
build-time reference renderer.

### 12.5 Preview explosion control

The pipeline must not blindly generate every possible Cartesian product.

- Generate validated and convertible combinations.
- Generate illustrative combinations only for explicitly enabled collections.
- Skip incompatible and unknown paths by default.
- Use content-addressed output names to reuse unchanged previews.
- Generate multiple responsive sizes from one color-managed master.

## 13. Data model

### 13.1 LUT record

```json
{
  "id": "sha256-stable-prefix",
  "slug": "collection--lut-name",
  "title": "Display title",
  "filename": "original.cube",
  "collectionId": "collection-id",
  "source": {
    "repository": "https://github.com/…",
    "path": "path/to/original.cube",
    "commit": "full-commit-sha",
    "sha256": "…"
  },
  "license": {
    "spdx": "MIT",
    "url": "https://…/LICENSE",
    "commercialUse": "allowed",
    "attributionRequired": false,
    "shareAlike": false,
    "noticeRequired": true,
    "caveats": []
  },
  "classification": {
    "primary": "creative-look",
    "signalRole": "display-referred",
    "tags": ["warm", "high-contrast", "cinematic"]
  },
  "input": {
    "gamut": "unknown",
    "transfer": "unknown",
    "range": "normalized",
    "reference": "unknown"
  },
  "output": {
    "gamut": "unknown",
    "transfer": "unknown",
    "dynamicRange": "sdr"
  },
  "technical": {
    "format": "cube",
    "dimension": "3d",
    "gridSize": 33,
    "domainMin": [0, 0, 0],
    "domainMax": [1, 1, 1],
    "validation": "parsed"
  },
  "fingerprint": {
    "intensity": 0.42,
    "contrast": 0.18,
    "warmth": 0.23,
    "saturation": -0.08,
    "clipping": 0.003
  },
  "metadataCompleteness": 0.84,
  "provenanceTier": "A",
  "importedAt": "ISO-8601 timestamp"
}
```

### 13.2 Image record

```json
{
  "id": "tears-of-steel-10081",
  "title": "Tears of Steel — frame 10081",
  "sourceUrl": "https://…",
  "license": "CC-BY-3.0",
  "publiclyServe": true,
  "encoding": {
    "gamut": "sRGB",
    "transfer": "sRGB",
    "reference": "display"
  },
  "contentTags": ["face", "skin", "vfx", "cinematic"],
  "technicalTags": ["sdr", "final-grade"],
  "sha256": "…",
  "derivatives": {
    "thumb": "assets/images/…-320.avif",
    "card": "assets/images/…-640.avif",
    "detail": "assets/images/…-1600.avif"
  }
}
```

### 13.3 Preview record

```json
{
  "imageId": "tears-of-steel-10081",
  "lutId": "stable-lut-id",
  "status": "converted",
  "pipeline": [
    "sRGB-to-linear",
    "linear-to-required-input",
    "apply-lut",
    "output-to-sRGB"
  ],
  "rendererVersion": "…",
  "warnings": [],
  "derivatives": {
    "thumb": "assets/previews/…-320.avif",
    "card": "assets/previews/…-640.avif",
    "detail": "assets/previews/…-1600.avif"
  }
}
```

## 14. Static architecture

### 14.1 Recommended implementation

- TypeScript
- Vite-based static build
- Preact, React, Vue, or equivalent component layer; Preact is preferred for a
  smaller client payload
- Static HTML generation for indexable routes
- Compact JSON catalog split by route/use case
- Local in-browser faceted index
- OpenColorIO-based build tools for preview generation
- GitHub Actions for validation, build, and GitHub Pages deployment

The framework choice is secondary to deterministic static output, accessible
HTML, small JavaScript bundles, and reproducible color rendering.

### 14.2 Repository layout

```text
/
├─ Images/                    # Source references and sidecars
├─ submissions/               # Licensed upstream collections
├─ catalog/                   # Curated overrides and controlled vocabulary
├─ scripts/                   # Import, validation, fingerprint, render, index
├─ site/                      # Website source
├─ generated/                 # Ignored local build intermediates
├─ dist/                      # GitHub Pages artifact
└─ .github/workflows/
   ├─ validate.yml
   └─ deploy-pages.yml
```

### 14.3 Build outputs

- Static HTML
- Hashed CSS and JavaScript
- `catalog-summary.json`
- Route-specific LUT and image indexes
- Search index
- Responsive image derivatives
- Preview manifests
- License glossary and attribution report
- Machine-readable validation report

### 14.4 GitHub Pages constraints

The current source material is already large, so the deployed artifact must not
contain full-resolution source images or cloned Git histories. GitHub documents
a recommended 1 GB source-repository limit, a 1 GB published-site limit, a
10-minute Pages deployment timeout, and a soft 100 GB/month bandwidth limit.
Git LFS objects cannot be served through GitHub Pages.

Requirements:

- Deploy only `dist/`, not the source collections.
- Keep the initial page payload below the performance budgets in this PRD.
- Use responsive images and lazy loading.
- Avoid preloading gallery results.
- Keep the complete Pages artifact below 500 MB for MVP, leaving growth room.
- Link to original repositories for source downloads where possible.
- If original downloads must be mirrored, use clearly licensed GitHub Release
  assets or another approved origin rather than the Pages artifact.
- Use a custom GitHub Actions Pages workflow.

Official references:

- <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- <https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage>

## 15. Performance requirements

Measured on a mid-range mobile device and normal broadband:

- Initial route HTML + critical CSS: under 100 KB compressed
- Initial JavaScript: under 180 KB compressed
- Initial catalog summary: under 100 KB compressed
- Route-specific index: under 500 KB compressed
- Largest Contentful Paint: target under 2.5 seconds
- Interaction to Next Paint: target under 200 ms
- Cumulative Layout Shift: target under 0.1
- Filter response after index load: under 100 ms for the current catalog and
  under 250 ms for 10,000 LUTs
- First gallery render: cards appear before all images finish loading
- Thumbnail images: responsive, lazy-loaded, and decoded asynchronously

Virtualize or incrementally render galleries above 200 visible results.

## 16. Accessibility requirements

- Target WCAG 2.2 AA.
- Complete keyboard operation for search, filters, cards, viewer, wipe, and
  compare mode.
- Visible focus treatment.
- Semantic headings, landmarks, buttons, and form labels.
- Color is never the only indicator of license, compatibility, or validation.
- Processed-image alt text identifies the LUT and selected source image without
  claiming subjective quality.
- Before/after wipe has keyboard controls and a textual toggle alternative.
- Respect reduced-motion preferences.
- Maintain usable contrast in both light and dark themes.
- Charts/scopes include textual summaries where practical.

## 17. Privacy and security

- No account system.
- No cookies required for core use.
- Preferences and saved filters stay in local storage.
- Analytics are omitted in MVP. If later added, use a privacy-preserving,
  cookieless option and disclose it.
- No user-provided file is uploaded in MVP.
- External links are identified.
- Catalog descriptions and imported metadata are treated as untrusted text and
  escaped during rendering.
- Build validation rejects path traversal, executable assets, malformed LUT
  dimensions, and unexpectedly large generated files.

## 18. SEO and sharing

- Unique title, description, canonical URL, and social preview per image, LUT,
  and collection route.
- Structured breadcrumbs.
- Sitemap and robots file.
- Share URLs preserve image, LUT, filters, sort, compare slots, and random seed.
- Social cards use licensed, public-safe references only; never Marcie without
  explicit clearance.

## 19. Contribution and catalog governance

### 19.1 Submission workflow

1. Contributor opens a pull request.
2. LUT and metadata are placed in the documented submission structure.
3. CI verifies format, checksum, required source URL, and license evidence.
4. CI rejects ambiguous license or provenance.
5. CI parses technical properties and produces a preview report.
6. A maintainer reviews input/output assumptions and human-authored tags.
7. Approved changes regenerate the catalog and previews.

### 19.2 Required submission metadata

- Original title and filename
- Creator/maintainer
- Source URL
- License identifier and license URL/file
- Expected input
- Expected output
- Transform class
- Redistribution and attribution obligations
- At least one purpose tag
- SHA-256

Unknown input/output is allowed only when prominently marked. It lowers
metadata completeness and prevents validated previews.

### 19.3 Controlled vocabulary

Controlled tags live in a versioned file with:

- Stable machine ID
- Display label
- Description
- Parent facet
- Aliases
- Deprecated aliases
- Mutually exclusive values where applicable

Free-form tags are accepted as searchable keywords but must not automatically
be promoted to filter facets.

## 20. Analytics and success metrics

MVP can be evaluated without tracking individual visitors:

- Catalog build succeeds reproducibly.
- Percentage of LUTs with known input and output.
- Percentage of LUTs with validated previews.
- Percentage with provenance tier A or B.
- Number of broken source/license links found by scheduled validation.
- Median and 95th-percentile filter latency.
- Pages artifact size and route payload size.
- Accessibility audit score.
- Number of catalog issues and pull requests.

If privacy-preserving usage analytics are later approved:

- Image-to-gallery conversion
- Filter use
- Compare-mode use
- Source/license detail opens
- Download-link activation
- Zero-result frequency by filter combination

## 21. MVP scope

### Must have

- Image chooser using the public-safe reference set
- Selected-image LUT gallery
- Pre-rendered, color-managed previews
- Search
- Compatibility, transform class, input, output, look, technical, collection,
  license, and provenance filters
- Recommended, name, collection, documentation, license, confidence, intensity,
  warmth, saturation, and clipping sorts
- LUT detail route
- Before/after viewer
- Two-LUT compare
- Source, license, tags, checksum, and attribution display
- Original-source download links
- Shareable URL state
- Responsive and keyboard-accessible UI
- GitHub Actions validation and GitHub Pages deployment

### Should have

- Four-way compare
- Similarity and difference sorting
- Visual fingerprints
- Filter presets in local storage
- Collection and license browse pages
- Prefilled GitHub issue links
- Machine-readable public catalog JSON

### Could have

- Scopes and false color
- Seeded discovery mode
- Installable PWA shell
- Browser-side WebGL full-resolution preview
- User-provided local image processing without upload
- Browser HDR

## 22. Phased roadmap

### Phase 0: Data readiness

- Normalize collection metadata.
- Establish controlled vocabulary.
- Audit input/output assumptions.
- Define public-safe image policy.
- Build parser and validation reports.

### Phase 1: Catalog MVP

- Static image chooser, gallery, detail pages, core filters, core sorts,
  pre-rendered thumbnails, and GitHub Pages deployment.

### Phase 2: Comparison and diagnostics

- Multi-LUT compare, visual fingerprints, similarity sorting, scopes, and
  richer validation.

### Phase 3: Local interactive processing

- Optional browser-side LUT application to locally chosen user images, with no
  upload, after WebGL output matches the reference renderer.

### Phase 4: Ecosystem

- Documented catalog API, external catalog consumers, richer contribution
  tooling, and scheduled provenance checks.

## 23. Acceptance criteria

The MVP is complete when:

1. A visitor can choose any public-safe reference image and browse all valid
   LUT previews without a server or account.
2. Default results exclude incompatible and unknown color paths.
3. Every displayed LUT exposes source, license, collection, checksum, input,
   output, and preview status.
4. Every CUBE source retains the embedded provenance comments already defined
   by the repository.
5. Non-CUBE assets resolve to their same-filename metadata sidecars.
6. Search aliases and include/exclude facet logic behave as specified.
7. Filter and sort state survives refresh through the URL.
8. Before/after and two-LUT comparison work by keyboard and pointer.
9. Marcie is not deployed publicly without explicit clearance.
10. Automated checks fail the build for missing license evidence, broken
    metadata references, malformed LUTs, or absent public preview derivatives.
11. The Pages artifact remains under 500 MB.
12. The site passes the agreed accessibility, performance, and rendering
    regression checks.

## 24. Open decisions

- Final product name and visual identity
- Exact component framework
- Whether source LUT downloads link upstream or use versioned GitHub Releases
- Which LUTs have sufficient input/output metadata for the first validated
  preview set
- Whether CC-BY-SA and GPL assets need a dedicated redistribution bundle
- Whether the public site should list internal-only images without thumbnails
- Initial fingerprint thresholds for subtle/moderate/strong/extreme
- Human review policy for subjective look tags
- Long-term asset hosting if the Pages artifact approaches its size or
  bandwidth limits

## 25. Recommended first implementation milestone

Build a vertical slice containing:

1. Tears of Steel frame 10081 as the selected public-safe image.
2. The 73 CUBE files currently carrying embedded provenance comments.
3. Compatibility and transform-class filters.
4. Search, Recommended sort, Name sort, and Collection sort.
5. Pre-rendered 320 px and 640 px WebP/AVIF previews.
6. LUT detail drawer with source, license, tags, and checksum.
7. Original/processed toggle and two-LUT comparison.
8. A deployable GitHub Pages artifact and automated validation report.

This slice proves the metadata pipeline, color rendering, browser experience,
and deployment budget before expanding to hundreds of Hald CLUT and CLF assets.

## 26. Color-managed conversion extension

Every built-in and user-uploaded input image must declare the encoding of its
decoded RGB pixels. An upload cannot enter the comparison workflow until the
visitor selects that color space.

Every rendered result uses an explicit browser-side path:

`image encoding → LUT input encoding → LUT → LUT output encoding → sRGB display`

When a creative LUT has sufficiently reliable input and output metadata, LUTr
automatically inserts the required conversions. When either endpoint is
unknown, the preview remains blocked until the visitor explicitly supplies the
missing metadata; LUTr must not guess a camera-log encoding.

The LUT detail view must let visitors choose a desired input and output color
space and download a composed 3D CUBE. Catalog exports are generated directly
from the canonical floating-point CUBE. A separate
right-side conversion utility accepts an original 1D or 3D CUBE, requires its
existing input/output path plus the desired new path, and performs the
conversion entirely in the browser. This original-file route is the
higher-fidelity option and preserves the source LUT precision before resampling
to the selected 17³, 33³, or 65³ output grid.

The first client-side matrix/transfer implementation supports sRGB, Rec.709,
Rec.709 gamma 2.4, linear Rec.709, Display P3, linear Display P3, Rec.2020
gamma 2.4, linear Rec.2020, ACEScg, and ACES2065-1. Unsupported transfer
functions remain visibly unavailable rather than receiving approximate labels.

## 27. Canonical hosted LUT format

CUBE is the only LUT asset format deployed by LUTr — LUTrepository. Source
CUBE, 3DL, CSP, CLF, Hald/strip PNG, and Hald TIFF transforms are normalized
into canonical `.cube` files before publication. Reference and interface
images are unaffected by this restriction.

Every canonical file carries structured `# LUTr-*` comments for identity,
collection, source URL and source path, original format and SHA-256, license
and license URL, tags, transform class, declared input/output encodings and
confidence, conversion method/tool/date/grid, warnings, and applicable
upstream identifiers and descriptors. These comments are portable provenance
records; applications that do not understand them may safely ignore them.

The client parses the hosted CUBE text directly into a floating-point WebGL
texture. No PNG LUT atlas is deployed or used as an intermediate. Original
CUBE sample grids are preserved. Sampled conversions must disclose their
resolution and bounded-domain limitations in both the CUBE header and catalog
manifest.
