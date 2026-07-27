# Reference Images

This folder contains a compact set of reference images for LUT evaluation,
color-pipeline QA, HDR testing, and visual regression work. Every media file has
a same-filename `.info.md` sidecar containing searchable tags, provenance,
license terms, color/encoding notes, attribution, and a SHA-256 checksum.

## Contents

| Folder | Selected asset | Primary use | License status |
|---|---|---|---|
| `Marcie` | Kodak Digital LAD 2K DPX | Film-log response, skin, LAD calibration | No explicit redistribution license; internal technical use is the lower-risk boundary |
| `Sony F35 Still Life` | ACES Sony F35 EXR | Charts and practical objects | Academy ACES reference-image license; retain notices |
| `ACES Synthetic Chart` | ACES synthetic chart EXR | Mathematical correctness and regression | Academy ACES reference-image license; retain notices |
| `OpenEXR StillLife` | `StillLife.exr` | HDR and reflective objects | BSD-3-Clause |
| `OpenEXR MtTamWest` | `MtTamWest.exr` | Landscape and sky | BSD-3-Clause |
| `OpenEXR Desk` | `Desk.exr` | Indoor mixed colors | BSD-3-Clause |
| `Sparks` | Netflix ACES frame 02000 | Real HDR footage and highlights | CC-BY-4.0 |
| `Meridian` | Netflix P3/PQ frame 21000 | Cinematic skin and production lighting | CC-BY-4.0 |
| `Tears of Steel` | Final-film frame 10081 | Live-action face and VFX | CC-BY-3.0 |
| `Poly Haven HDRIs` | Kloofendal daylight + Studio Small artificial light | Daylight and artificial image-based illumination | CC0-1.0 |

## Important commercial-use boundary

All selected assets except Marcie have an explicit reuse license that permits
commercial use when its conditions are followed. Marcie was published as a
technical calibration aid, but the original Kodak package does not contain a
blanket redistribution or promotional-use license. Keep it internal unless
Kodak and any relevant likeness rights are cleared in writing.

The Tears of Steel selection is a frame from the CC-BY-3.0 final film. It is
not from the separately published raw actor-footage package, which carries an
additional restriction against using the actors' images in commercials.

These notes are a practical provenance record, not legal advice.
