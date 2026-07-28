# OCIO ACES authoritative descriptor resolution

LUTr maps the transform names, `InputDescriptor`, `OutputDescriptor`,
`ACEStransformID`, and `BuiltinTransform` fields shipped by the
AcademySoftwareFoundation OpenColorIO ACES configuration. These fields are the
authority for endpoint identity; filenames and LUT appearance are not used to
guess an encoding.

## 2026-07-28 result

| State | Count |
|---|---:|
| OCIO ACES transforms | 58 |
| Complete before this pass | 6 |
| Newly resolved complete endpoints | 36 |
| Complete after this pass | 42 |
| Intentionally gamut-unbound curve transforms | 16 |

The resolved endpoints cover Apple Log/BT.2020, ARRI LogC3 and LogC4, ARRI Wide
Gamut 3 and 4, Blackmagic Film Gen 5/Wide Gamut, DaVinci
Intermediate/Wide Gamut, Canon Cinema Gamut, DJI D-Gamut, Panasonic V-Gamut,
REDWideGamutRGB, Sony S-Gamut variants, CIE XYZ D65, Adobe RGB, AP1, and
Rec.709 gamma utilities.

The 16 remaining records are not missing discoverable metadata. Fifteen
descriptors explicitly say `arbitrary primaries`; the ITU Rec.709 curve uses
`generic linear RGB`. They are transfer-only transforms designed to preserve
whatever primaries surround them. LUTr's color-space ids deliberately bundle a
gamut and transfer, so assigning one would contradict the authoritative
descriptor. Their gamut/transfer decomposition remains available in the v2
header while `Input-Color-Space` or `Output-Color-Space` stays empty.

Camera-gamut matrices are derived from the authoritative CLF matrices into
ACES2065-1. Endpoint implementations labelled `approximation` in the browser
identify cases where the transform name is authoritative but LUTr's analytic
client-side inverse is an approximation of the source CLF lookup.
