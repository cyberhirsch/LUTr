# Open-Source LUT Collections

This collection register is maintained for **LUTr — LUTrepository**.

Verified on 2026-07-28. This list focuses on downloadable color-grading,
display-transform, camera, and accessibility LUT assets—not merely software
that can create or apply LUTs.

> **License note:** “Free download” does not mean open source. The main table
> only includes repositories with an explicit open license covering the
> repository. Always retain the original license and attribution files when
> redistributing a collection. Items in the caveats section need an additional
> provenance review before redistribution.

## Clearly licensed collections

| Collection | Contents and use | Formats / observed assets | License |
|---|---|---:|---|
| [Striped Purple Color Grading LUTs](https://github.com/stripedpurple/color-grading-luts) | A large set of original creative grades organized into categories such as Avant Garde. The author says the LUTs were primarily made and tested with Photoshop. | 49 `.cube` | MIT |
| [DJI D-Cinelike and Normal Blockbuster LUTs](https://github.com/IRCGraphic/D-Cinelike-and-Normal-Blockbuster-LUTs) | Warm “blockbuster” looks made for DJI Action 2 footage, with separate D-Cinelike and Normal-profile variants. The README documents recommended exposure offsets. | 10 `.cube` | CC0-1.0 |
| [Sony a6000 LUTs](https://github.com/jonmatifa/a6000-LUTs) | Camera-specific transforms made from the Sony a6000 Portrait profile: S-Log2-like, S-Log3-like, and a vivid film-emulation look. | 3 `.cube` | CC0-1.0 |
| [ChristophWurst Hald CLUTs](https://github.com/ChristophWurst/haldclut) | Small collection of custom color-grading profiles made for RawTherapee. | 3 `.tif` Hald CLUTs | CC-BY-SA-4.0 |
| [FilmSim](https://github.com/sguyader/FilmSim) | Film-simulation presets supplied as both Hald CLUT images and RawTherapee processing profiles. | 4 `.tif` Hald CLUTs + 4 `.pp3` | CC0-1.0 |
| [HDR2SDR LUTs](https://github.com/sverit/HDR2SDR-LUTs) | Several strength variants for compressing HDR screenshots into more reasonable SDR levels while restoring saturation. | 5 `.cube` | GPL-3.0 |
| [RED Conversion LUTs](https://github.com/videovillage/RED-Conversion-LUTs) | Forward/reverse, reverse-engineered transforms between REDlogFilm and REDgamma variants for post-debayered workflows. A larger ZIP is available from the repository release. | 4 `.cube`, 9 `.tif`, 1 preview `.png` in the repo | MIT |
| [Linear to Blender Filmic sRGB LUTs](https://github.com/Lauloque/LUTs-Linear-to-Blender-s-Filmic-sRGB) | Technical display transforms from linear input to Blender Filmic sRGB, with seven contrast looks from Very Low to Very High. | 7 `.3dl` + 7 test images | GPL-3.0 |
| [Natron HaldCLUT Presets](https://github.com/NatronGitHub/clut) | General-purpose creative and film-emulation Hald CLUT textures. The upstream README carries the license notice and attribution links. | 347 `.png` Hald CLUTs | CC-BY-SA-4.0 |
| [Arri Alexa LUTs](https://github.com/vfxwiki/ArriAlexaLuts) | A very small technical collection for ARRI Alexa workflows. Documentation is sparse, so test input/output assumptions before production use. | 2 `.cube` | LGPL-3.0 |
| [Colour-Blind LUTs](https://github.com/andrewwillmott/colour-blind-luts) | Simulation/correction LUTs for protanopia, deuteranopia, and tritanopia. Useful for accessibility testing and real-time shader workflows rather than creative grading. | 13 LUT-like `.png` assets | Unlicense |
| [OpenColorIO Config for ACES](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES) | Authoritative, production-oriented ACES transforms for camera inputs and color pipelines. This is a config/transform collection, not a pack of creative looks. | 58 `.clf` transforms observed | BSD-3-Clause |
| [Fresh LUTs](https://freshluts.com) | Community-uploaded creative and camera-profile looks. The site terms declare uploads CC0; LUTr separately quarantines files with contradictory embedded rights notices and collapses numerically identical transforms. See the [ingestion audit](FRESHLUTS_INGEST.md). | 679 canonical `.cube` transforms hosted from 720 captures | CC0-1.0 (site terms) |

## Licensed repositories with provenance caveats

These are useful public collections, but the repository license alone may not
settle the rights to every included asset.

| Collection | Why it needs extra review | Formats / observed assets | Repository license |
|---|---|---:|---|
| [cedeber/hald-clut](https://github.com/cedeber/hald-clut) | Aggregates material associated with RawTherapee film simulation, PictureFX, Fuji profiles, Apple Photos, and Pixelmator. The repository is GPL-3.0, but the README does not document a per-source relicensing chain. | 350 `.png` Hald CLUTs | GPL-3.0 |
| [cx-lut](https://github.com/ccxuan123/cx-lut) | The LUTs were generated from Snapseed film presets. The repo is MIT-licensed, but derivative-style and trademark questions may matter if the files are redistributed commercially. | 18 `.cube` | MIT |
| [HaldCLUT Cube Files](https://github.com/scernst13/HaldCLUT-Cube-Files) | Converts a subset of existing Hald CLUTs for Lumix real-time LUT use, but the README does not identify or license every upstream source. | 14 `.cube` | CC0-1.0 |

## Not included as open-source collections

- [Lumix V-Log LUTs](https://github.com/changyun233/Lumix-V-log-LUTs) has an
  MIT repository license, but its README says it collects LUTs published by
  multiple third-party creators and asks authors to request removal. That is
  not enough to establish that the MIT license covers every LUT.
- [G'MIC Film LUTs Collection](https://github.com/YahiaAngelo/Film-Luts) has
  an MIT license, but its disclaimer says the maintainer does not own the LUTs
  and that they may be subject to third-party copyright. Treat it as a discovery
  index, not a redistribution-safe open-source pack.
- Public repositories with no explicit asset license are omitted. Source
  visibility and a GitHub “public” setting do not grant reuse rights.

## Format notes

- **`.cube`** — widely supported by DaVinci Resolve, Premiere Pro, Final Cut
  Pro, Photoshop, FFmpeg, OBS-compatible filters, and many cameras.
- **Hald CLUT (`.png` / `.tif`)** — an image representation of a 3D LUT,
  commonly used by RawTherapee, G'MIC, ImageMagick, and darktable workflows.
- **`.3dl`** — an older but still supported 3D LUT format.
- **`.clf`** — Academy Common LUT Format, intended for precise,
  interoperable color transforms and modern OpenColorIO/ACES pipelines.
- A LUT is only predictable when its expected input color space, gamma/log
  curve, gamut, and output target are known. Test unknown creative LUTs on
  ramps, skin tones, and saturated colors before production use.

## Reference calibration image

The original 2K and 4K Kodak Digital LAD (“Marcie”) 10-bit DPX frames, their
original Kodak ZIP, Kodak's H-387 guide, checksums, provenance, and a
commercial-use assessment are saved in
[`reference-images/Kodak-Digital-LAD-Marcie`](reference-images/Kodak-Digital-LAD-Marcie/README.md).
