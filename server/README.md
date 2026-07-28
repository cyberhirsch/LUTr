# lutr-server

The backend for LUT submission, rating, download counting, and reporting.
`site/` stays a static GitHub Pages deploy; this is the one piece that needs
a server, reachable from the Pages site over a Cloudflare Tunnel.

## Why this exists, and why it's split the way it is

Ratings, download counts, and reports are ordinary mutable state -- a
database, not a git history. Submissions are the opposite: LUTr's whole
premise is that every LUT's provenance is traceable, and that means a
submission has to land in the repo, with a real commit and a real PR, not a
row in a table somewhere. So this service is two things wearing one process:

- **Submission** works like [lensfit's](../../lensfit) no-account
  contribution path: validate, then open a pull request on the submitter's
  behalf via a GitHub App -- no clone, no working tree, built entirely
  through the Git Data API. The App's permissions are scoped to exactly this
  repo (Contents + Pull requests, read & write) and can be revoked without
  touching any personal account.
- **Ratings, downloads, and reports** live in SQLite
  (`node:sqlite`, built into Node -- no dependency, matching this project's
  zero-`package.json` approach elsewhere). This is the *only* state that
  needs a database; it never touches git.

A submission does **not** land in `submissions/` the way the rest of the
catalog's sources do -- that directory is gitignored, so nothing pushed
there would ever reach a checkout, and `scripts/convert-all-to-cube.mjs`
can't run in CI for the same reason. Instead this server *is* the
single-entry version of that build pipeline: it validates the upload, builds
the schema-2 header (see `../LUT_HEADER_SPEC.md`), gzips the canonical cube,
bakes its 33-cube preview atlas (reusing `scripts/lib/png.mjs` -- the exact
encoder the offline catalog build uses, not a second implementation), and
opens one PR containing three files:

```
site/assets/luts/<id>.cube.gz
site/assets/atlas/<id>.png
site/data/cube-manifest.json   (one entry appended)
```

**It deliberately does not touch `site/data/catalog.json`.** That file's
tags/completeness/`previewType` derivation belongs to
`scripts/build-prototype.mjs`, and reimplementing that logic here would be
exactly the kind of second implementation `LUT_HEADER_SPEC.md`'s "one source
of truth" rule exists to prevent. The PR body says so explicitly: after
merging, run `build-prototype.mjs` then `validate-cubes.mjs` before the next
deploy. This is a real, human-in-the-loop step -- publishing an approved
submission is not fully automatic yet.

## Flow

```
browser --POST /submit--> validate, dedupe, rate-limit --> SQLite row (pending)
                                                              |
                                                    admin reviews, approves
                                                              |
                                        build cube.gz + atlas + manifest entry
                                                              |
                                                   GitHub App opens ONE pull request
                                                              |
                                              (human merges) -> build-prototype.mjs
                                                              |
                                                    validate-cubes.mjs -> deploy
```

Ratings/downloads/reports don't go through any of this -- they're a direct
SQLite write, visible to the admin endpoints immediately.

## Endpoints

Public:
- `POST /submit` -- `{ cube, meta }`, `meta` matching `LUT_HEADER_SPEC.md`'s
  fields (title, author, license, licenseBasis, transformClass,
  inputColorSpace, outputColorSpace, colorSpaceConfidence, tags[], ...).
  Re-validates everything server-side; nothing from the client is trusted.
- `GET /status/:id`
- `POST /rate` -- `{ lutId, stars }`, one vote per IP per LUT (upsert)
- `GET /ratings/:lutId`
- `POST /download/:lutId` -- a beacon, rate-limited per (LUT, IP); **this
  count is indicative, not audited** -- a request from a static page is
  trivially forgeable, the same as freshluts' own download counters
- `GET /downloads/:lutId`
- `POST /report` -- `{ lutId, category: copyright|technical|other, detail }`

Admin (`Authorization: Bearer <LUTR_ADMIN_TOKEN>`):
- `GET /admin/pending`, `GET /admin/quarantined`
- `POST /admin/approve/:id` -- runs the build pipeline above and opens the PR
- `POST /admin/reject/:id` -- `{ reason }`
- `GET /admin/reports?status=open|resolved`
- `POST /admin/reports/:id/resolve` -- `{ note }`

A submission is auto-**quarantined** (not rejected) rather than pending
whenever the uploaded file's own comments assert a copyright/rights claim
(the same CLAIM/CREDIT split `scripts/import-freshluts.mjs` uses) --
force-approving one carries the claim text forward into the header as an
explicit `LUTr-License-Conflict` + `LUTr-Upstream-Comment` rather than
silently laundering it into a clean-looking submission.

## One-time setup

1. **Create the GitHub App**: github.com -> Settings -> Developer settings ->
   GitHub Apps -> New GitHub App.
   - Webhook: uncheck "Active" -- this service doesn't receive webhooks.
   - Permissions: Repository -> Contents: Read and write, Pull requests:
     Read and write. Nothing else.
2. Generate a **private key**, download the `.pem`.
3. **Install the app** on the `LUTr` repo; note the installation ID from the
   URL you land on (`.../installations/<this number>`).
4. **Create the Cloudflare Tunnel**: Zero Trust dashboard -> Networks ->
   Tunnels -> Create a tunnel -> name it `lutr` -> public hostname routing to
   `http://lutr-server:8420` (the compose service name, not `localhost`).

## Deploy

```bash
mkdir -p ~/lutr-server
scp -r server ../site/lut-io.js ../site/color-spaces.js ../scripts/lib cyberhirsch@pi:~/lutr-server/
scp path/to/downloaded-key.pem cyberhirsch@pi:~/lutr-server/server/github-app-key.pem
ssh cyberhirsch@pi
cd ~/lutr-server/server
cp .env.example .env
nano .env   # GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, LUTR_ADMIN_TOKEN, LUTR_IP_PEPPER, CLOUDFLARE tunnel token
chmod 600 github-app-key.pem .env
docker compose up -d --build
```

Verify:
```bash
docker compose logs -f lutr-server
curl http://localhost:8420/healthz   # from inside the Pi, or via the tunnel hostname from outside
```

## Known limitations

- **`node:sqlite` is experimental** (Node's own designation, not this
  project's). It's the only way to get SQLite with zero dependencies; if it
  changes incompatibly in a future Node release, `server/db.mjs` is the one
  file that would need updating.
- **Startup cost.** The dedup index (a semantic hash of every cube already
  in the catalog, so a re-upload of an existing LUT is caught) is built by
  gunzipping and parsing roughly a thousand cubes. It runs in the
  background in small batches so the server starts accepting requests
  immediately -- `/healthz` responds right away -- but the index itself
  isn't complete for the first 30-90 seconds after a (re)start. A submission
  during that window is still fully covered by the separate
  duplicate-of-a-pending-submission check; only a duplicate of something
  already published before this restart could slip through in that narrow
  window, and it refreshes every 6 hours after that regardless.
- **Concurrent approvals can race on `cube-manifest.json`.** Two approvals
  in quick succession each read the manifest, append their own entry, and
  open independent PRs against the same base commit. If both PRs get
  merged, the second merge can silently drop the first PR's entry (a JSON
  file has no natural conflict markers the way most text diffs do). Low
  probability given approval is a manual, one-at-a-time admin action, and
  the PR review step is a real chance to catch it -- but worth knowing
  before assuming every approved submission is automatically safe to merge
  back-to-back without looking at the diff.
- **Download counts are a beacon, not an audit.** See the endpoint list
  above.
