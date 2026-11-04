# GetYourCollege redesign (local build)

Plain HTML/CSS/JS. Nothing here touches the live site.

```
staging/            <- the web root (what would be served)
scripts/            <- builder, dev server, tests, fixture (NEVER upload)
_private/           <- reports, scan cache, mock lead log (NEVER upload)
DEPLOY.md
```

## Run locally
```bash
node scripts/dev-server.js        # http://localhost:8080  (includes a JS twin of api/mock-lead.php)
# or, static only (the lead form will fail without the mock):  python3 -m http.server 8080 --directory staging
```

## Data
`staging/data/colleges.public.json` is currently built from a **fake fixture** (`scripts/make-fixture.js`)
because no real `public_html` copy was available. Check `staging/data/registry-meta.json` (`"sample": true`) to tell.
To build from the real folders (a read-only copy of public_html, or run on the server against the real path):
```bash
node scripts/build-registry.js --scan /path/to/public_html_copy
node scripts/build-registry.js          # re-apply scripts/overrides.json only (uses the cached scan)
node scripts/test.js /path/to/public_html_copy
```
Then review `_private/canonical-report.md` and fix things in `scripts/overrides.json`.

## Still TODO before launch
- `GA4_ID` in `staging/assets/js/config.js` (paste the homepage's GA4 ID; no GA hits are sent while it is the placeholder).
- `FIELD_MAP` and `isSuccess` in config.js: confirm against the real `submitLead.php`. The scan prints the POST keys it finds into the private report.
- Merge the real homepage program list into `G.PROGRAMS` in `assets/js/lead.js` (Design and Law are included).
- Replace the stub `website-policy.html` (live site has its own).
- The GA4 tag sets its own cookies; the shortlist itself uses localStorage only.

## Live details (scripts/scrape-live.js)
`node scripts/scrape-live.js` reads the live landing pages of the colleges/exams already in the registry (our own site, GET only) and writes `scripts/live-data.json`; `node scripts/build-registry.js` merges it (overrides.json still wins). Pages that 404 or are not real LPs are listed under `skipped` in that file. Photos are only taken when the filename says campus/banner/hero/building, bytes are a valid image, and size ≤250KB (larger ones are shrunk with macOS `sips`).

## Registry from the live homepage (current data source)
`node scripts/build-live-registry.js` builds the registry from the colleges linked on https://getyourcollege.co/ (names and groups come from the homepage cards), reads each page with the parser in `scripts/scrape-live.js`, and writes `staging/data/*.json`, `scripts/live-data.json` and `_private/live-report.md` (coverage, merged duplicates, skipped links). Add `--cache` to re-parse saved pages without the network. `registry-meta.json` is `{sample:false, live:true}`.
`build-registry.js` (folder scan of a public_html copy) is still there for the canonical-LP work but would overwrite these files with fixture data if run without a real scan, so do not run it now.

## Official-website layer
`scripts/official-sites.json` maps each college/exam to its official site. `node scripts/scrape-official.js` reads the home and about pages (curl, GET only) and writes `scripts/official-data.json` (short summary, facts, highlights, photo candidates in `_private/official/photos/`). Photos are chosen by eye in `scripts/photo-curation.json` (ads, logos and posters excluded). `node scripts/build-live-registry.js --cache` merges everything; `lpUrl` and any getyourcollege.co / Collegedunia text are removed from the public data. Demo only: get the colleges' permission for photos and text before launch.

## Deadlines, fee/location filters, WhatsApp
- `scripts/deadlines.json`: upcoming application deadlines (each with source and checked date). Edit it, then `node scripts/build-live-registry.js --cache`. Past dates hide themselves; the marquee, "Closing soon" cards, card badges and Details read from it.
- `scripts/locations.json`: city and state per college (used by the Location filter).
- Fee ranges are parsed from the course fee tables (`feeMin` / `feeMax`); colleges without a published table show under "Fees not listed".
- WhatsApp: set `WHATSAPP_URL` in `staging/assets/js/config.js` (for example `https://wa.me/91XXXXXXXXXX?text=Hi`). While empty, the "Talk to expert" button and the floating icon open the Register form.
- Photos: `scripts/photo-curation.json` (official sites) and `scripts/wiki-curation.json` (Wikimedia Commons, credits shown in Details).

## Lead gate
Full details, shortlist and compare unlock after one successful registration (`gyc_lead_v1` in localStorage, set by `G.unlock()` in `lead.js`). Everything goes through `G.gate(slug, opener, afterFn, {title, sub, cta})`; `G.showDetails(slug)` is the single entry point for a college's full-details pop-up, which is where a per-college database can be plugged in later. To reset while testing: `localStorage.removeItem('gyc_lead_v1')`.

## Exams row, forms
- `scripts/exams-extra.json`: national exams shown in "Closing soon" and the Exams section (dated deadlines hide themselves once past; `expected` is shown for exams whose dates are not announced). Re-run `node scripts/build-live-registry.js --cache` after editing.
- Forms: city is a searchable list (`gyc-cities` datalist in `lead.js`; any city can be typed), course is a dropdown (the chosen college's own courses when it lists enough, else a general list). Any element with `data-register` opens the registration pop-up.

## Deploying the demo to Vercel
Import the GitHub repo in Vercel: Framework "Other", no build command, output directory `staging` (already set in `vercel.json`). `api/mock-lead.js` is the serverless lead handler (validates, logs a masked line, forwards nothing). The site sends `X-Robots-Tag: noindex`. Before launch: replace the lead endpoint, set `WHATSAPP_URL` and `GA4_ID` in `staging/assets/js/config.js`, and get permission for the college photos and text.
