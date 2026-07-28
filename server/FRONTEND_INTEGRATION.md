# `site/` community-server integration

Implemented on 2026-07-28. The static frontend now uses the deployed
community server for asynchronously loaded ratings and download counts,
1–5 star ratings, download beacons, reports, validated CUBE submissions,
and locally remembered submission-status checks. This document remains the
integration contract and test order for those features.

Base URL: `https://lutr.sebhirsch.com`. CORS is already configured
server-side for `https://cyberhirsch.github.io` (see `server/.env`'s
`LUTR_CORS_ORIGINS`) -- nothing to configure on the client side for that.

## 0. A shared API client

Before touching any UI, add one new module, `site/community-api.js`,
exporting a thin wrapper per endpoint. Every other step below calls into
this instead of using `fetch` directly, so the base URL and error handling
exist in exactly one place.

```js
const API_BASE = "https://lutr.sebhirsch.com";

async function call(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `${path} failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const submitLut = (payload) => call("/submit", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
});
export const getSubmissionStatus = (id) => call(`/status/${encodeURIComponent(id)}`);
export const rateLut = (lutId, stars) => call("/rate", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lutId, stars }),
});
export const getRatings = (lutId) => call(`/ratings/${encodeURIComponent(lutId)}`);
export const beaconDownload = (lutId) => call(`/download/${encodeURIComponent(lutId)}`, { method: "POST" });
export const getDownloadCount = (lutId) => call(`/downloads/${encodeURIComponent(lutId)}`);
export const reportLut = (lutId, category, detail) => call("/report", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ lutId, category, detail }),
});
```

Every call can throw (network failure, 4xx, 5xx, or a 429 rate limit) --
every call site below needs a `catch`. None of these are essential to the
page rendering; a failure should degrade to "not shown," never break the
catalog.

## 1. Download counts and rating display (read-only, lowest risk)

Start here -- no new UI, no form validation, nothing that can be submitted
wrong. In `card()` and in `openViewer()` (`site/app.js`), after the existing
render, fetch `getRatings(lut.id)` and `getDownloadCount(lut.id)` and paint
the numbers in wherever makes sense (a small badge on the card, a line in
the viewer's metadata list). Both calls are public, unauthenticated, and
side-effect-free. Do them in parallel with `Promise.allSettled`, not
sequentially, and don't block the rest of the render on them.

## 2. Rating widget

In the viewer (`openViewer()` / the dialog markup in `index.html`), add a
1-5 star control. On click, call `rateLut(lut.id, stars)`, then re-render
the average from the response (the endpoint returns the fresh aggregate, so
there's no need for a second `getRatings` call). Handle the case where the
user has already rated -- the server does a per-IP upsert
(`POST /rate` twice from the same visitor just changes their vote), so the
UI can simply always show the control as available, no "already voted"
state needs to be tracked client-side.

## 3. Download beacon

In `downloadCatalogLut()` (`site/app.js`), after the actual conversion and
`downloadText()` call succeeds, fire `beaconDownload(lut.id)` -- don't
`await` it in a way that delays the download itself, and swallow any
error silently (a failed beacon should never surface as a user-facing
error; it's an indicative count, not a feature the download depends on).

## 4. Report button

Add a "Report" action next to "Add to compare" in the viewer. On click,
show a small inline form: a category select (`copyright` / `technical` /
`other`) and a short text field, then `reportLut(lut.id, category, detail)`.
On success, replace the form with a plain "Thanks, this has been flagged
for review" -- there is nothing else for the user to see or track; reports
have no status the public API exposes.

## 5. Submission form (the largest piece)

A new section parallel to the existing full-width "Convert a LUT" section
in `index.html`/`app.js`. It needs:

- A file input accepting `.cube`, read via `file.text()` -- same pattern
  `loadConverterFile()` already uses.
- Fields for every required `meta` key the server validates (see
  `server/validate.mjs`'s `validateSubmission()` and
  `../LUT_HEADER_SPEC.md` for what each one means): `title`, `author`,
  `license`, `licenseBasis`, `transformClass`, `inputColorSpace`,
  `outputColorSpace`, `colorSpaceConfidence`, and optionally `authorUrl`,
  `source`, `assetUrl`, `tags`. **The color-space and transform-class
  fields must be `<select>` elements populated from the same vocabularies
  the server enforces** -- reuse `colorSpaceOptions()` from
  `site/color-spaces.js` for the two color-space dropdowns exactly like the
  converter panel already does, so a submitter can never even construct an
  invalid value client-side. `transformClass`/`colorSpaceConfidence`/
  `licenseBasis` need their own small option lists; copy the exact string
  values from `scripts/lib/color-space-ids.mjs`'s
  `VALID_TRANSFORM_CLASSES` / `VALID_CONFIDENCE` / `VALID_LICENSE_BASIS` so
  the client and server vocabularies can never drift apart.
- Before allowing submit, run the browser's own `parseCube()` (from
  `site/lut-io.js`) as a pre-flight check -- reject 1D LUTs and a non-unit
  domain immediately, with the same messages the server would give, so a
  submitter finds out in the browser instead of waiting on a round trip.
  This is UX only; the server re-validates everything regardless.
- On submit, call `submitLut({ cube, meta })`. Handle each status
  distinctly:
  - `201` with `status: "pending"` -- show the returned `id` and a message
    that it's awaiting review.
  - `201` with `status: "quarantined"` -- show the server's own `note`
    field verbatim (it already explains the copyright-claim reason).
  - `409` -- the response includes either `existingLutId` (already in the
    catalog) or `submissionId` (already pending); link to whichever is
    given rather than just showing a generic error.
  - `422` -- a validation error; show `body.error` directly, it's already
    written to be shown to a submitter.
  - `429` -- rate limited; show the message and don't offer an immediate
    retry button.
  - `413` -- the file is too large; state the limit (16 MB).
- Optionally, store the returned submission `id` in `localStorage` and poll
  `getSubmissionStatus(id)` next time the page loads, so a returning
  submitter can see whether their LUT was approved, rejected, or is still
  pending -- entirely optional, the id itself is not guessable so there's no
  privacy concern in storing it client-side.

## Build/test order

Steps 1-4 can each ship independently and are low-risk -- do them first, in
order, verifying each one against the deployed server before moving on.
Step 5 is the biggest and the one most likely to need iteration on the
vocabulary dropdowns; build it last, once the simpler read/write paths are
proven to work against the real deployment.
