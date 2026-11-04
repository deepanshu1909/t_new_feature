#!/usr/bin/env node
/* Builds the registry from the REAL colleges linked on the live homepage (our own site, GET only),
 * then reads each page with scrape-live.js's parser.
 *
 *   node scripts/build-live-registry.js [--cache]     (--cache re-parses cached HTML, no network)
 *
 * Writes staging/data/{colleges.public.json,featured.json,registry-meta.json}, scripts/live-data.json
 * and _private/live-report.md. Names and categories come from the homepage's own cards. Nothing is invented:
 * a value that the pages do not state stays empty and the site shows "Ask a counsellor". */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse, pickPhoto, PHOTOS, CACHE } = require('./scrape-live');
const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'staging');
const BASE = 'https://getyourcollege.co';
const OFFLINE = process.argv.includes('--cache');
const UA = { 'User-Agent': 'Mozilla/5.0 (GYC staging builder)' };

const CAT = [[/^Universities/, 'University'], [/^Engineering/, 'Engineering'], [/^Management/, 'Management'], [/^Law/, 'Law'], [/^Design/, 'Design & Fashion']];
// names that are typos / truncated / carry a year on the homepage (corrected by hand, listed in the report)
const NAME_FIX = { NMIMS2026: 'NMIMS', 'Ishan Institute Of': 'Ishan Institute of Law', 'Amity University': 'Amity University Noida', 'Jain University Banagalore': 'Jain University Bangalore', 'SPJIMR Admission 2026–28': 'SPJIMR', 'LBSIM PGDM 2026': 'LBSIM', 'NIFT Registration 2026': 'NIFT Registration', 'VITEEE Registration 2026': 'VITEEE Registration' };
const CAT_FIX = { 'frankfinn2025': 'Hospitality', 'AsianBusinessSchoolAbs_2026': 'Management', 'JainLp/JU/2026': 'University', 'ShooliniUniversitySolan_2026': 'University' };
// same college linked twice: keep the first, remember the other
// homepage link is broken but the same college has a working page elsewhere
const FALLBACK = { 'JainLp/JU/2026': 'JainUniversity2026' };
const SAME = { spjimr_2026: 'SPJIMR2026', IbusinessInstitute: 'IBI2026' };
const CITIES = ['Navi Mumbai', 'New Delhi', 'Gandhi Nagar', 'Bangalore', 'Bengaluru', 'Mumbai', 'Pune', 'Noida', 'Dubai', 'Gurgaon', 'Vadodara', 'Ahmedabad', 'Dehradun', 'Solan', 'Patiala', 'Ghaziabad', 'Kolkata', 'Chennai', 'Hyderabad', 'Patna', 'Bhopal'];
const EXTRA_EXAMS = [['neet_mock_test', 'NEET Mock Test'], ['viteee_slot_booking_2026', 'VITEEE Slot Booking']];
const FEATURED = ['ChristUniversityBangalore_2026', 'NMIMS2026', 'JainUniversity2026', 'SPJIMR2026', 'alliance2026', 'BitsPilaniDubai_2026', 'NirmaUniversityAhmedabad_2026', 'MICA2026'];

const decode = s => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2011;|‑/g, '-').replace(/\s+/g, ' ').trim();
const kebab = s => s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/-?(19|20)\d\d-?$/, '').replace(/^-|-$/g, '').toLowerCase();
async function get(url, cacheFile) {
  if (OFFLINE) return fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, 'utf8') : null;
  const r = await fetch(url, { headers: UA }); if (!r.ok) return { status: r.status };
  const t = await r.text(); fs.writeFileSync(cacheFile, t); return t;
}

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  const home = await get(BASE + '/', path.join(CACHE, '_home.html'));
  if (!home || typeof home !== 'string') { console.error('Could not read the homepage.'); process.exit(2); }

  /* 1. entries from the homepage cards */
  const entries = [], seen = new Map(), notes = [];
  for (const m of home.matchAll(/<article class="college-type-card">([\s\S]*?)<\/article>/g)) {
    const head = decode((m[1].match(/<h3>([\s\S]*?)<\/h3>/) || [, ''])[1]);
    const cat = (CAT.find(([re]) => re.test(head)) || [, 'Other'])[1];
    for (const l of m[1].matchAll(/<a href="\/([^"]+?)\/"[^>]*>([\s\S]*?)<\/a>/g)) {
      const folder = decodeURIComponent(l[1]), name = decode(l[2].replace(/<[^>]+>/g, ''));
      if (seen.has(folder)) { notes.push(`${folder}: listed under more than one group, kept "${seen.get(folder).cat}"`); continue; }
      const e = { folder, homeName: name, cat: CAT_FIX[folder] || cat }; seen.set(folder, e); entries.push(e);
    }
  }
  const byFolder = Object.fromEntries(entries.map(e => [e.folder, e]));
  const out = [], liveData = {}, review = [], skipped = [];
  const exams = entries.filter(e => /^(nift|viteee)[-_]registration$/.test(e.folder));
  for (const [f, n] of EXTRA_EXAMS) exams.push({ folder: f, homeName: n, cat: 'Exam', extra: true });
  const colleges = entries.filter(e => !exams.includes(e));

  const rec = async (e, type) => {
    if (SAME[e.folder] && byFolder[SAME[e.folder]]) { review.push(`${e.folder}: same college as ${SAME[e.folder]} (both linked on the homepage). Merged, kept ${SAME[e.folder]}. Confirm which page to send traffic to.`); return; }
    let url = BASE + '/' + e.folder.split('/').map(encodeURIComponent).join('/') + '/';
    let html = await get(url, path.join(CACHE, e.folder.replace(/\//g, '_') + '.html'));
    if (FALLBACK[e.folder] && (!html || typeof html !== 'string' || /HTTrack Website Copier/i.test(html))) {
      skipped.push(`${e.folder}: homepage link is broken (${html && html.status ? 'HTTP ' + html.status : 'mirror index'}); using ${FALLBACK[e.folder]}`);
      e = Object.assign({}, e, { folder: FALLBACK[e.folder] }); url = BASE + '/' + e.folder + '/'; html = await get(url, path.join(CACHE, e.folder + '.html'));
    }
    if (!html || typeof html !== 'string') { skipped.push(`${e.folder}: ${html && html.status ? 'HTTP ' + html.status : 'no cached page'}`); return; }
    if (/HTTrack Website Copier/i.test(html)) { skipped.push(`${e.folder}: HTTrack mirror index, not a landing page`); return; }
    const slug = kebab(e.folder === 'JainUniversity2026' ? 'jain-university' : e.folder) || e.folder.toLowerCase();
    const name = NAME_FIX[e.homeName] || NAME_FIX[e.folder] || e.homeName;
    const o = parse(html, url, type);
    const photo = OFFLINE ? (fs.existsSync(PHOTOS) ? fs.readdirSync(PHOTOS).find(f => f.startsWith(slug + '.')) : null) : await pickPhoto(html, url, slug, review);
    if (photo) o.photoFile = photo;
    o.scrapedAt = new Date().toISOString().slice(0, 10);
    liveData[slug] = o;
    const inText = t => CITIES.find(c => new RegExp('\\b' + c + '\\b', 'i').test(t || ''));
    const city = type === 'exam' ? null : inText(name) || inText(o.title) || inText((o.about || '').slice(0, 300)) || null;
    const r = { slug, name, shortName: name.length <= 24 ? name : (name.split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 6) || name), city: city === 'Bengaluru' ? 'Bangalore' : city, category: type === 'exam' ? 'Exam' : e.cat, type, lpUrl: url, logo: null, photo: null, exams: [], fees: null, deadline: null, about: null, courses: [] };
    out.push(r); r._lp = url; r._o = o; r._photoFile = photo; r._e = e;
  };
  for (const e of colleges) await rec(e, 'college');
  for (const e of exams) await rec(e, 'exam');

  /* 2. merge scraped details, copy photos */
  const photoDir = path.join(WEB, 'assets', 'photos'); fs.mkdirSync(photoDir, { recursive: true });
  for (const f of fs.readdirSync(photoDir)) fs.rmSync(path.join(photoDir, f), { recursive: true, force: true });
  // photos: skip promotional banners (text/people ads) and any image shared by several colleges
  const PHOTO_EXCLUDE = { lbsim: 'promotional banner with printed claims, not a campus photo' };
  const md5 = f => require('crypto').createHash('md5').update(fs.readFileSync(f)).digest('hex');
  const hashes = {}; for (const r of out) if (r._photoFile && fs.existsSync(path.join(PHOTOS, r._photoFile))) (hashes[md5(path.join(PHOTOS, r._photoFile))] = hashes[md5(path.join(PHOTOS, r._photoFile))] || []).push(r.slug);
  for (const r of out) {
    if (r._photoFile && PHOTO_EXCLUDE[r.slug]) { review.push(`${r.slug}: photo not used (${PHOTO_EXCLUDE[r.slug]})`); r._photoFile = null; }
    else if (r._photoFile && fs.existsSync(path.join(PHOTOS, r._photoFile)) && hashes[md5(path.join(PHOTOS, r._photoFile))].length > 1) { review.push(`${r.slug}: photo not used (same image on ${hashes[md5(path.join(PHOTOS, r._photoFile))].length} colleges)`); r._photoFile = null; }
  }
  for (const r of out) {
    const o = r._o;
    r.about = o.about || null; r.courses = o.courses || []; r.exams = o.exams || []; r.deadline = o.deadline || null;
    for (const k of ['programs', 'stats', 'highlights', 'examInfo']) if (o[k] && o[k].length) r[k] = o[k];
    r.source = { url: o.source, updated: o.scrapedAt };
    if (r._photoFile && fs.existsSync(path.join(PHOTOS, r._photoFile))) { r.photo = 'assets/photos/' + r.slug + path.extname(r._photoFile); fs.copyFileSync(path.join(PHOTOS, r._photoFile), path.join(WEB, r.photo)); }
    delete r._o; delete r._photoFile; delete r._e;
  }
  /* official-website layer (scripts/scrape-official.js) + hand-picked photos (scripts/photo-curation.json) */
  const BANNED = /(collegedunia|careers360|shiksha|collegedekho|getyourcollege|pagalguy)/i;
  const scrub = t => { if (!t) return null; const parts = String(t).match(/[^.!?]+[.!?]*\s*/g) || [String(t)]; const k = parts.filter(x => !BANNED.test(x) && !/(beta version|testing a|under construction|coming soon|lorem ipsum)/i.test(x)).join('').trim(); return k.length > 30 ? k : null; };
  let off = { data: {} }, cur = {};
  try { off = JSON.parse(fs.readFileSync(path.join(__dirname, 'official-data.json'), 'utf8')); } catch (e) { /* run scrape-official.js first */ }
  try { cur = JSON.parse(fs.readFileSync(path.join(__dirname, 'photo-curation.json'), 'utf8')); } catch (e) { /* none */ }
  const SITES = JSON.parse(fs.readFileSync(path.join(__dirname, 'official-sites.json'), 'utf8'));
  for (const r of out) {
    const O = off.data[r.slug], site = SITES[r.slug] && SITES[r.slug][0];
    r.website = site || null;
    const oa = scrub(O && O.about), la = scrub(r.about);
    r.about = oa && oa.length >= 220 ? oa : [oa, la && (!oa || !oa.includes(la.slice(0, 60))) ? la : null].filter(Boolean).join(' ') || null;
    if (r.about && r.about.length > 760) r.about = r.about.slice(0, 760).replace(/\s+\S*$/, '') + '…';
    const hl = [...((O && O.highlights) || []), ...(r.highlights || [])].filter(x => !BANNED.test(x));
    const seen = new Set(); r.highlights = hl.filter(x => { const k = x.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    if (!r.highlights.length) delete r.highlights;
    if (O && O.facts && O.facts.length) r.facts = O.facts;
    if (r.programs) r.programs = r.programs.filter(p => !BANNED.test(JSON.stringify(p))).map(p => Object.assign(p, { course: p.course.replace(/\s*[\d.,]+\s*[KkMm]?\s*Views?$/i, '').trim() }));
    if (r.exams) r.exams = r.exams.filter(x => !BANNED.test(x));
    const keep = cur[r.slug] || [], gallery = [];
    if (O && O.images) for (const img of O.images) { const n = parseInt(path.basename(img), 10); if (keep.includes(n) && fs.existsSync(path.join(ROOT, '_private', 'official', 'photos', img))) { const dest = 'assets/photos/' + r.slug + '/' + (gallery.length + 1) + '.jpg'; fs.mkdirSync(path.join(WEB, 'assets', 'photos', r.slug), { recursive: true }); fs.copyFileSync(path.join(ROOT, '_private', 'official', 'photos', img), path.join(WEB, dest)); gallery.push(dest); } }
    if (!gallery.length) { // fallback: open-licence Wikimedia Commons photos picked in scripts/wiki-curation.json
      try {
        const wc = JSON.parse(fs.readFileSync(path.join(__dirname, 'wiki-curation.json'), 'utf8')), cr = JSON.parse(fs.readFileSync(path.join(ROOT, '_private', 'wiki', 'credits.json'), 'utf8'));
        const credits = [];
        for (const x of cr[r.slug] || []) { const n = parseInt(path.basename(x.file), 10); const src = path.join(ROOT, '_private', 'wiki', x.file); if ((wc[r.slug] || []).includes(n) && fs.existsSync(src)) { const dest = 'assets/photos/' + r.slug + '/' + (gallery.length + 1) + '.jpg'; fs.mkdirSync(path.join(WEB, 'assets', 'photos', r.slug), { recursive: true }); fs.copyFileSync(src, path.join(WEB, dest)); gallery.push(dest); credits.push({ author: x.author, license: x.license, page: x.page }); } }
        if (credits.length) r.credits = credits;
      } catch (e) { /* no wiki photos yet */ }
    }
    if (gallery.length) { r.gallery = gallery; r.photo = gallery[0]; }
    else if (r.photo && !/\/[^/]+\/\d\.jpg$/.test(r.photo)) { /* keep photo taken from our own LP, if any */ }
    r.sources = { website: site || null, updated: (O && O.scrapedAt) || (r.source && r.source.updated) || null };
    delete r.source; delete r.lpUrl;
  }
  /* locations, deadlines, fee ranges (editable: scripts/locations.json, scripts/deadlines.json) */
  const LOC = JSON.parse(fs.readFileSync(path.join(__dirname, 'locations.json'), 'utf8')), DL = JSON.parse(fs.readFileSync(path.join(__dirname, 'deadlines.json'), 'utf8')).items;
  const TODAY = new Date(process.env.GYC_TODAY || Date.now()); TODAY.setUTCHours(0, 0, 0, 0);
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const endDate = str => { let last = null; for (const m of String(str || '').matchAll(/(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?,?\s*(20\d\d)?/g)) { const mon = MON[m[2].toLowerCase()]; if (mon === undefined) continue; last = { d: +m[1], mon, y: m[3] ? +m[3] : null }; } if (!last) return null; const yr = last.y || null; return yr ? new Date(Date.UTC(yr, last.mon, last.d)) : null; };
  const money = str => { const out = []; for (const m of String(str || '').replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|crores?|cr\b)?/gi)) { let n = +m[1], u = (m[2] || '').toLowerCase(); out.push({ n, u }); } if (!out.length) return null; const carry = out.map(o => o.u).find(Boolean); const vals = out.map(o => { const u = o.u || (o.n < 1000 && carry ? carry : ''); const mult = /^(l|lakh|lakhs|lac|lacs)$/.test(u) ? 1e5 : /^(cr|crore|crores)$/.test(u) ? 1e7 : 1; return o.n * mult; }).filter(v => v >= 5000 && v < 1e8); return vals.length ? [Math.min(...vals), Math.max(...vals)] : null; };
  const fmt = d => d.toISOString().slice(0, 10);
  for (const r of out) {
    const L = LOC[r.slug]; if (L) { if (L[0]) r.city = L[0]; r.state = L[1]; r.country = L[1] === 'UAE' ? 'UAE' : 'India'; }
    else if (r.type !== 'exam' && r.city) r.country = 'India';
    if (r.type === 'exam') { r.city = null; delete r.state; }
    // drop stale LP dates (before today) so old cycles never look current
    if (r.deadline) { const d = endDate(r.deadline); if (!d || d < TODAY) r.deadline = null; }
    if (r.programs) for (const p of r.programs) { if (p.dates) { const d = endDate(p.dates); if (d && d < TODAY) p.dates = null; } }
    // fee range (total course fees as the pages state them)
    let lo = Infinity, hi = 0; for (const p of r.programs || []) { const m = money(p.fees); if (m) { p.feeMin = m[0]; p.feeMax = m[1]; lo = Math.min(lo, m[0]); hi = Math.max(hi, m[1]); } }
    if (hi) { r.feeMin = lo; r.feeMax = hi; }
    const mine = DL.filter(x => x.slugs.includes(r.slug) && new Date(x.date + 'T00:00:00Z') >= TODAY).map(x => ({ label: x.label, date: x.date, tentative: !!x.tentative, note: x.note || null, source: x.source }));
    if (mine.length) { mine.sort((a, b) => a.date.localeCompare(b.date)); r.deadlines = mine; r.deadline = new Date(mine[0].date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  }
  /* national exams added by hand (scripts/exams-extra.json) */
  { const X = JSON.parse(fs.readFileSync(path.join(__dirname, 'exams-extra.json'), 'utf8'));
    for (const e of X.exams) {
      const dl = (e.dates || []).filter(d => new Date(d.date + 'T00:00:00Z') >= TODAY).map(d => ({ label: d.label, date: d.date, tentative: !!d.tentative, note: d.note || null, source: null }));
      const rec = { slug: e.slug, name: e.name, shortName: e.name, city: null, category: 'Exam', type: 'exam', logo: null, photo: null, exams: [], fees: null, deadline: null, about: e.about, courses: e.stream || [], examInfo: (e.facts || []).map(f => ({ label: f[0], value: f[1] })), website: null, sources: { website: null, updated: X.checked } };
      if (dl.length) { rec.deadlines = dl; rec.deadline = new Date(dl[0].date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
      else if (e.expected) rec.expected = e.expected;
      else continue;
      out.push(rec);
    } }
  for (const f of fs.readdirSync(path.join(WEB, 'assets', 'logos'))) if (f !== '.gitkeep') fs.unlinkSync(path.join(WEB, 'assets', 'logos', f));
  out.sort((a, b) => (a.type === 'exam') - (b.type === 'exam') || a.name.localeCompare(b.name));

  const featured = FEATURED.map(f => out.find(r => r._lp === BASE + '/' + f.split('/').map(encodeURIComponent).join('/') + '/')).filter(Boolean).map(r => r.slug);
  fs.writeFileSync(path.join(WEB, 'data', 'colleges.public.json'), JSON.stringify(out.map(r => { const c = Object.assign({}, r); delete c._lp; return c; }), null, 1) + '\n');
  fs.writeFileSync(path.join(WEB, 'data', 'featured.json'), JSON.stringify(featured) + '\n');
  fs.writeFileSync(path.join(WEB, 'data', 'registry-meta.json'), JSON.stringify({ sample: false, live: true }) + '\n');
  fs.writeFileSync(path.join(__dirname, 'live-data.json'), JSON.stringify({ _readme: 'Generated by build-live-registry.js / scrape-live.js from our own live pages.', skipped, data: liveData }, null, 1) + '\n');

  /* 3. report (outside the web root) */
  const n = (r, k) => (r[k] && r[k].length ? 1 : 0);
  const L = ['# Live registry report', '', `Generated ${new Date().toISOString()} from the live homepage.`, '', `**Listed:** ${out.filter(r => r.type !== 'exam').length} colleges, ${out.filter(r => r.type === 'exam').length} exams. **Skipped:** ${skipped.length}. **Needs review:** ${review.length}.`, '',
    '## Coverage (1 = has data)', '', '| slug | city | about | programs(fee table) | courses | stats | highlights | exams | photo |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of out) L.push(`| ${r.slug} | ${r.city || '-'} | ${n(r, 'about')} | ${(r.programs || []).length} | ${(r.courses || []).length} | ${(r.stats || []).length} | ${(r.highlights || []).length} | ${(r.exams || []).length} | ${r.photo ? 1 : 0} |`);
  L.push('', '## Needs review', ...review.map(x => '- ' + x), '', '## Skipped', ...skipped.map(x => '- ' + x), '', '## Notes', ...notes.map(x => '- ' + x));
  L.push('', '## Names corrected by hand', ...Object.entries(NAME_FIX).map(([a, b]) => `- "${a}" -> "${b}"`));
  fs.mkdirSync(path.join(ROOT, '_private'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '_private', 'live-report.md'), L.join('\n') + '\n');
  console.log(`Listed ${out.filter(r => r.type !== 'exam').length} colleges, ${out.filter(r => r.type === 'exam').length} exams. Skipped ${skipped.length}. Review ${review.length}. Featured: ${featured.join(', ')}`);
  console.log(skipped.map(s => ' - ' + s).join('\n'));
})();
