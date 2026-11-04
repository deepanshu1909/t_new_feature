# DEPLOY (read, do not run blindly)

## 0. Preconditions
1. Registry rebuilt from the REAL folders. The on-page sample banner was removed, so confirm `staging/data/registry-meta.json` says `"sample": false` (the builder also prints a SAMPLE warning).
2. `node scripts/test.js <real public_html copy>` passes.
3. `canonical-report.md` "needs review" groups checked; fixes in `scripts/overrides.json`, rebuilt.
4. `GA4_ID`, `FIELD_MAP`, `isSuccess` set in config.js (see README TODO).

## 1. Staging first (outside public_html)
- Create subdomain `staging.getyourcollege.co` with document root `/home/getyourcollege/staging_site/` (NOT inside public_html).
- Upload the contents of `staging/` to that root (including `.htaccess`, `robots.txt`, `api/mock-lead.php`).
- Create the password file outside the web root: `htpasswd -c /home/getyourcollege/_private/.htpasswd <user>` and make sure the `AuthUserFile` path in `.htaccess` matches. Choose the password yourself; do not paste it into any file in this project.
- Mock leads are logged (masked) to `/home/getyourcollege/_private/mock-leads.log`.

## 2. Going live: files to upload to public_html (ONLY these)
| Upload | Notes |
|---|---|
| `index.html` | **Back up the current `index.html` first**: `cp index.html index.old.html` on the server. |
| `colleges/index.html` | new folder |
| `shortlist/index.html` | new folder |
| `assets/css/`, `assets/js/`, `assets/logos/` | new folder `assets/`; **check it does not already exist first** |
| `data/colleges.public.json`, `data/featured.json` | new folder `data/`; check it does not already exist. Do NOT upload `registry-meta.json` if it says sample. |

Do NOT upload: `.htaccess` (staging auth!), `robots.txt` (it is Disallow-all), `api/mock-lead.php`, `website-policy.html` (stub; the live one stays), `scripts/`, `_private/`, `README.md`, `DEPLOY.md`.

> **Never overwrite or delete any LP folder.** The hub only links to them. Before uploading, confirm none of `colleges/`, `shortlist/`, `assets/`, `data/` exist in public_html. If any does, STOP and rename ours first.

Also remove the `<meta name="robots" content="noindex, nofollow">` line from the three pages before going live, or the hub will never be indexed.

## 3. Switch from the mock endpoint to the real one
In `assets/js/config.js` (the only place):
```js
LEAD_ENDPOINT: '/submitLead.php',   // was '/api/mock-lead.php'
```
Keep `source: "hub"` (SOURCE) so hub leads are attributable. Send one test lead and confirm it arrives and the response is accepted by `isSuccess`.

## 4. Rollback
1. `cp index.old.html index.html` (restores the old homepage).
2. Delete only what we added: `colleges/`, `shortlist/`, `assets/` and `data/` (only if we created them).
3. LP folders are untouched, so nothing else to restore.
