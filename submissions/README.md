# License-Cleared LUT Submissions

This folder contains shallow checkouts of every collection in
`OPEN_SOURCE_LUT_COLLECTIONS.md` that had an explicit repository or asset
license. Collections listed under provenance caveats or the not-included
section were deliberately not downloaded.

## Metadata convention

- Every `.cube` begins with `# LUTr-Collection`, `# LUTr-Source`,
  `# LUTr-License`, `# LUTr-License-URL`, and `# LUTr-Tags` comments.
- Formats without a reliably portable tag/comment field have a neighboring
  `<original-filename>.info.md` file with tags, source, license, commercial-use
  notes, repository path, and SHA-256.
- Original repository license, notice, and README files remain in place.
- Metadata comments and sidecars do not replace the upstream license terms.

## Imported collections

| Folder | Main LUT assets | License |
|---|---:|---|
| `stripedpurple-color-grading-luts` | 49 CUBE | MIT |
| `ircgraphic-d-cinelike-blockbuster` | 10 CUBE | CC0-1.0 |
| `jonmatifa-a6000-luts` | 3 CUBE | CC0-1.0 |
| `christophwurst-haldclut` | 3 TIFF Hald CLUTs | CC-BY-SA-4.0 |
| `sguyader-filmsim` | 4 TIFF Hald CLUTs + 4 PP3 | CC0-1.0 |
| `sverit-hdr2sdr-luts` | 5 CUBE | GPL-3.0 |
| `videovillage-red-conversion-luts` | 4 CUBE + TIFF/PNG companions | MIT |
| `lauloque-linear-to-blender-filmic` | 7 3DL + test images | GPL-3.0 |
| `natron-haldclut-presets` | 347 PNG Hald CLUTs | CC-BY-SA-4.0 |
| `vfxwiki-arri-alexa-luts` | 2 CUBE | LGPL-3.0 |
| `andrewwillmott-colour-blind-luts` | 13 PNG LUT assets | Unlicense |
| `aswf-opencolorio-config-aces` | 58 CLF transforms | BSD-3-Clause |

Validated totals: 73 CUBE files with embedded source/license comments and 454
non-CUBE assets with same-filename metadata sidecars.

## Excluded after provenance review

- `cedeber/hald-clut`: aggregates assets from several upstream sources without
  a documented per-asset relicensing chain.
- `ccxuan123/cx-lut`: LUTs derive from Snapseed presets; the repository license
  does not remove the derivative-work uncertainty.
- `scernst13/HaldCLUT-Cube-Files`: converted upstream Hald CLUTs are not mapped
  to complete source/license records.
- `changyun233/Lumix-V-log-LUTs`: explicitly aggregates third-party LUTs.
- `YahiaAngelo/Film-Luts`: the maintainer says the LUTs may remain subject to
  third-party copyright.

## Rebuild metadata

Run `node scripts/annotate-assets.mjs` from the repository root after refreshing
the imported collections. The script is idempotent for CUBE headers and
regenerates sidecars and checksums.
