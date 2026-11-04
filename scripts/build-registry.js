#!/usr/bin/env node
/*
 * GetYourCollege registry builder (runs OUTSIDE the web root, read-only on the scanned tree).
 *
 *   node scripts/build-registry.js --scan <path-to-public_html-copy> [--sample]
 *       Scans top-level LP folders (read-only), caches raw findings in _private/registry.raw.json,
 *       then builds staging/data/colleges.public.json, featured.json, logos and the private report.
 *
 *   node scripts/build-registry.js
 *       Re-applies scripts/overrides.json to the cached scan (no access to public_html needed).
 *
 * Options: --out <web root>  --base <https://getyourcollege.co>  --private <dir>  --overrides <file>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = n => argv.includes('--' + n);

const OUT = path.resolve(opt('out', path.join(ROOT, 'staging')));
const PRIVATE = path.resolve(opt('private', path.join(ROOT, '_private')));
const BASE = opt('base', 'https://getyourcollege.co').replace(/\/$/, '');
const OVERRIDES = path.resolve(opt('overrides', path.join(__dirname, 'overrides.json')));
const RAW = path.join(PRIVATE, 'registry.raw.json');
const LOGO_CACHE = path.join(PRIVATE, 'logo-cache');
const PHOTO_CACHE = path.join(PRIVATE, 'photo-cache');
const EXAM_NAMES = ['JEE Main', 'JEE Advanced', 'BITSAT', 'VITEEE', 'SRMJEEE', 'KCET', 'MHT CET', 'COMEDK', 'WBJEE', 'CAT', 'MAT', 'CMAT', 'XAT', 'GMAT', 'NMAT', 'SNAP', 'NEET', 'CLAT', 'AILET', 'LSAT', 'CUET', 'NIFT', 'NID', 'UCEED', 'NATA', 'SAT'];
const MAX_LOGO = 60 * 1024;
const MAX_PHOTO = 250 * 1024, MIN_PHOTO = 3 * 1024;

/* ---------- rules from the brief ---------- */
const EXAMS = ['neet_mock_test', 'nift_registration', 'viteee-registration', 'viteee_slot_booking_2026'];
const VARIANT_SUFFIXES = ['_coursefees_bing', '_coursefees', '_bing', '_cd', '_av']; // longest first
const ALIAS_GROUPS = [
  ['NMIMS2026', 'nmimsmumbai'], ['Atlas2026', 'atlasskilltechuniversitymumbai'],
  ['IMSghaz2026', 'imsghaziabaduniversity'], ['IBI2026', 'IbusinessInstitute'],
  ['GIBS2026', 'gibsbusinessschoolbangalore'], ['NewHorizon2026', 'nhce'],
  ['mastersunion2026', 'mastersunion'],
  ['alliance2026', 'alliance-university-2027', 'allianceuniversitybangalore'],
  ['rv_university_bangalore_2027', 'rvuniversitybangalore'], ['isbr-2027', 'isbr_2027_v2'],
  ['sidpune_2027', 'SymbiosisInstituteOfDesign_2026'], ['JainLp', 'JainUniversity2026'],
  ['krmangalamuniversitygurgaon', 'krmangalamuniversitygurugram'],
  ['iihm_mumbai_2026_v2', 'indianinstituteofhospitalityandmanagementmumbai'],
  ['chitkarauniversity', 'ChitkaraUniversityCuPatiala']
];
// same normalised key but different institutions: keep apart by exact (case-sensitive) stripped name
const SPLIT_BY_NAME = ['spjimr_2026', 'SPJIMR2026'];
// kept separate on purpose; flagged "confirm" in the report
const FLAG_SEPARATE = ['amityonline', 'gitam2026', 'srmu_2026', 'jain_tech_2026', 'krupanidhidegreecollegebangalore', 'krupanidhigroupofinstitutionsbangalore', 'spjimr'];
const ONLINE_KEYS = ['amityonline'];
const NO_EXPAND = ['csmu', 'dcrust', 'gniot', 'ncu', 'pmist', 'rkgit', 'srmu', 'wctm', 'upes', 'iism', 'sjcc'];
const CHECK_LINKS = ['KccInstituteOfLegal_2026', 'ShooliniUniversitySolan_2026'];
const CITIES = ['greater noida', 'navi mumbai', 'bangalore', 'bengaluru', 'pune', 'mumbai', 'delhi', 'gurgaon', 'gurugram', 'noida', 'ghaziabad', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'lucknow', 'patna', 'raipur', 'ranchi', 'gwalior', 'indore', 'bhopal', 'ahmedabad', 'chandigarh', 'mohali', 'solan', 'patiala', 'sonepat', 'dehradun', 'nagpur', 'goa', 'kochi', 'coimbatore', 'vellore', 'mysore', 'mangalore', 'bhubaneswar', 'guwahati', 'faridabad', 'kanpur', 'varanasi', 'vadodara', 'surat', 'ludhiana', 'jalandhar', 'amritsar', 'thane', 'visakhapatnam', 'vijayawada', 'dubai'];
const CATEGORIES = ['University', 'Engineering', 'Management', 'Law', 'Design & Fashion', 'Hospitality', 'Other'];

/* ---------- helpers ---------- */
const readText = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const isFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const titleCase = s => s.replace(/\b([a-z])/g, m => m.toUpperCase());

function stripVariants(name) {
  let s = name, changed = true;
  while (changed) {
    changed = false;
    for (const v of VARIANT_SUFFIXES) if (s.toLowerCase().endsWith(v)) { s = s.slice(0, -v.length); changed = true; }
    const m = s.match(/(?:_v\d+)$/i); if (m) { s = s.slice(0, -m[0].length); changed = true; }
    const y = s.match(/[_-]?(2025|2026|2027)$/); if (y) { s = s.slice(0, -y[0].length); changed = true; }
  }
  return s;
}
const variantOf = n => VARIANT_SUFFIXES.find(v => n.toLowerCase().endsWith(v)) || (/_(?:bing|cd|av|coursefees)(?:_v\d+)?$/i.test(n) ? 'variant' : null);
const normKey = n => stripVariants(n).toLowerCase().replace(/[-_]/g, '');
const yearOf = n => { const m = n.match(/(2025|2026|2027)/g); return m ? +m[m.length - 1] : 0; };
const verOf = n => { const m = n.match(/_v(\d+)/i); return m ? +m[1] : 1; };
function kebab(name) {
  return stripVariants(name).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const stripTags = h => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/* ---------- scan (read-only) ---------- */
function listDirs(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { return []; } }
const SKIP_DESC = new Set(['node_modules', 'assets', 'css', 'js', 'images', 'img', 'fonts', 'vendor']);

// breadth-first: shallowest index.html within 3 levels (folder/a/b)
function findFile(top, file) {
  let level = [''];
  for (let depth = 0; depth < 3; depth++) {
    for (const rel of level) if (isFile(path.join(top, rel, file))) return rel;
    const next = [];
    for (const rel of level) for (const d of listDirs(path.join(top, rel))) if (!SKIP_DESC.has(d.toLowerCase())) next.push(path.join(rel, d));
    level = next;
  }
  return null;
}

function extract(folder, lpDir, html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const t = title ? stripTags(title) : '', h = h1 ? stripTags(h1) : '';
  const text = stripTags(html).slice(0, 120000);
  const low = text.toLowerCase();
  const flags = [];

  // name
  const clean = s => s.split(/\s*[|–—]\s*|\s+-\s+/)[0].replace(/\b(admissions?|apply now|enrol+ment|registrations?)\b.*$/i, '').replace(/\b20(25|26|27)\b/g, '').replace(/[\s:,-]+$/, '').trim();
  let name = clean(t) || clean(h), nameOk = true;
  if (!name || name.length < 3 || /^(home|document|untitled|index|landing page)$/i.test(name)) nameOk = false;
  const stripped = stripVariants(folder);
  if (!nameOk) {
    const base = kebab(folder).split('-');
    name = base.map(w => (NO_EXPAND.includes(w) || w.length <= 4 && !/[aeiou]/.test(w)) ? w.toUpperCase() : titleCase(w)).join(' ');
    flags.push('name prettified from slug (unreadable title)');
  }
  if (NO_EXPAND.includes(stripped.toLowerCase().replace(/[-_]/g, ''))) flags.push('abbreviation: name not expanded, confirm');

  // city: slug first, then title/h1 only
  const find = s => { const l = s.toLowerCase(); return CITIES.find(c => new RegExp('(^|[^a-z])' + c.replace(' ', '[ _-]?') + '([^a-z]|$)').test(l) || l.includes(c.replace(' ', ''))); };
  let city = find(stripped) || find(t + ' ' + h) || null;
  if (city === 'bengaluru') city = 'bengaluru';
  if (city) city = titleCase(city);

  // category
  const kw = {
    Engineering: /b\.?\s?tech|engineering|m\.?\s?tech/g, Management: /\bmba\b|pgdm|\bbba\b|management/g,
    Law: /\bllb\b|\bllm\b|\blaw\b/g, 'Design & Fashion': /\bdesign|fashion/g, Hospitality: /hotel management|hospitality|culinary/g
  };
  const score = {};
  for (const [k, re] of Object.entries(kw)) score[k] = (low.match(re) || []).length;
  const nameLow = name.toLowerCase();
  for (const [k, re] of Object.entries(kw)) if (re.test(nameLow)) score[k] += 5;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const multi = ranked.filter(r => r[1] >= 2).length;
  let category, catConf = 'high';
  if (/universit/i.test(name) && multi >= 3) category = 'University';
  else if (ranked[0][1] >= 3 && ranked[0][1] >= 2 * ranked[1][1]) category = ranked[0][0];
  else if (/universit/i.test(name)) { category = 'University'; catConf = 'low'; }
  else if (ranked[0][1] >= 2) { category = ranked[0][0]; catConf = 'low'; }
  else { category = 'Other'; catConf = 'low'; }
  if (catConf === 'low') flags.push('category low-confidence: ' + category);

  // fees: explicit course + amount + year only
  let fees = null;
  const fm = text.match(/\b(B\.?Tech|M\.?Tech|MBA|PGDM|BBA|BCA|B\.?Des|LLB|BA LLB|BHM|B\.?Com)\b[^.₹]{0,60}?(?:fees?|fee structure)[^.₹]{0,40}?((?:₹|Rs\.?|INR)\s?[\d.,]+(?:\s?(?:Lakhs?|L))?)[^.]{0,60}?\b(2025|2026|2027)\b/i);
  if (fm) fees = { value: `${fm[2].replace(/\s+/g, ' ')} (${fm[1]})`, asOf: fm[3], source: null };
  // deadline
  let deadline = null;
  const dm = text.match(/(?:last date|deadline|apply (?:by|before))[^0-9]{0,30}(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+20(?:25|26|27))/i);
  if (dm) deadline = dm[1];

  // about + courses (only what the LP itself states)
  let about = null;
  const md = html.match(/<meta[^>]+name=["']description["'][^>]*content=(?:"([^"]{40,400})"|'([^']{40,400})')/i);
  if (md) about = decode(md[1] || md[2]).trim();
  else { const pm = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => stripTags(m[1])).find(x => x.length >= 60 && x.length <= 400); if (pm) about = pm; }
  const courses = [];
  const hm = html.match(/<h[23][^>]*>[^<]*(?:programs?|courses?)[^<]*<\/h[23]>[\s\S]{0,400}?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (hm) for (const li of hm[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) { const t = stripTags(li[1]); if (t && t.length <= 70 && !courses.includes(t)) courses.push(t); }

  // entrance exams the LP itself mentions (case-sensitive: avoids matching words like "cat")
  const exams = EXAM_NAMES.filter(e => new RegExp('(?<![A-Za-z])' + e.replace(' ', '\\s') + '(?![A-Za-z])').test(text));

  // logo
  let logoSrc = null;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const li = imgs.find(i => /logo/i.test(i));
  if (li) {
    const src = (li.match(/\bsrc=["']([^"']+)["']/i) || [])[1];
    if (src && !/^(https?:)?\/\//.test(src) && !src.startsWith('data:')) {
      const cand = src.startsWith('/') ? null : path.join(lpDir, src.split('?')[0]);
      if (cand && isFile(cand)) {
        const size = fs.statSync(cand).size;
        if (size <= MAX_LOGO) logoSrc = cand; else flags.push('logo skipped: ' + Math.round(size / 1024) + 'KB > 60KB');
      }
    }
  }
  // photo: the LP's own largest-looking non-logo image (same owner as this site)
  let photoSrc = null;
  for (const i of imgs) {
    if (/logo|icon|favicon|sprite|pixel/i.test(i)) continue;
    const src = (i.match(/\bsrc=["']([^"']+)["']/i) || [])[1];
    if (!src || /^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('/') || !/\.(jpe?g|png|webp)(\?|$)/i.test(src)) continue;
    const cand = path.join(lpDir, src.split('?')[0]);
    if (isFile(cand)) { const z = fs.statSync(cand).size; if (z >= MIN_PHOTO && z <= MAX_PHOTO) { photoSrc = cand; break; } }
  }
  return { name, nameOk, city, category, catConf, fees, deadline, about, courses: courses.slice(0, 14), exams, logoSrc, photoSrc, ga: /\bG-[A-Z0-9]{6,}\b/.test(html), flags };
}

function scan(src) {
  const raw = { generatedAt: new Date().toISOString(), base: BASE, excluded: [], folders: [], leadPhp: null, homepageLinks: [] };
  fs.mkdirSync(LOGO_CACHE, { recursive: true }); fs.mkdirSync(PHOTO_CACHE, { recursive: true });
  const tops = listDirs(src).sort();
  for (const folder of tops) {
    if (folder.startsWith('.')) continue;
    if (folder.startsWith('GENERATOR_SOURCE')) { raw.excluded.push({ folder, reason: 'GENERATOR_SOURCE template folder' }); continue; }
    if (folder.includes('__bak_') || /_copy(_nm)?$/.test(folder)) { raw.excluded.push({ folder, reason: 'backup/copy folder' }); continue; }
    const top = path.join(src, folder);
    const rel = findFile(top, 'index.html');
    if (rel === null) { raw.excluded.push({ folder, reason: 'no index.html within 3 levels' }); continue; }
    const isExam = EXAMS.includes(folder);
    const subRel = findFile(top, 'submitLead.php');
    if (!isExam && subRel === null) { raw.excluded.push({ folder, reason: 'no submitLead.php' }); continue; }
    const lpDir = path.join(top, rel);
    const html = readText(path.join(lpDir, 'index.html')) || '';
    const f = extract(folder, lpDir, html);
    let logoFile = null;
    if (f.logoSrc) { logoFile = folder + path.extname(f.logoSrc).toLowerCase(); fs.copyFileSync(f.logoSrc, path.join(LOGO_CACHE, logoFile)); }
    let photoFile = null;
    if (f.photoSrc) { photoFile = folder + path.extname(f.photoSrc).toLowerCase(); fs.copyFileSync(f.photoSrc, path.join(PHOTO_CACHE, photoFile)); }
    delete f.logoSrc; delete f.photoSrc;
    const lpPath = rel.split(path.sep).filter(Boolean).join('/');
    raw.folders.push({
      folder, lpPath, kind: isExam ? 'exam' : (variantOf(folder) ? 'variant' : 'college'),
      year: yearOf(folder) || yearOf(lpPath), ver: verOf(folder), hasSubmit: subRel !== null, ...f, logoFile, photoFile
    });
  }
  // lead endpoint intel (private report only)
  const lead = readText(path.join(src, 'submitLead.php'));
  if (lead) {
    const keys = [...new Set([...lead.matchAll(/\$_(?:POST|REQUEST)\[\s*['"]([^'"]+)['"]\s*\]/g)].map(m => m[1]))];
    const resp = lead.split('\n').filter(l => /json_encode|echo\s/.test(l)).slice(0, 6).map(l => l.trim().slice(0, 140));
    raw.leadPhp = { postKeys: keys, responseLines: resp };
  }
  // homepage links to folders
  const home = readText(path.join(src, 'index.html')) || '';
  const seen = new Set();
  for (const m of home.matchAll(/href=["'](?:https?:\/\/(?:www\.)?getyourcollege\.co)?\/([^\/"'#?]+)\/?[^"']*["']/gi)) seen.add(decodeURIComponent(m[1]));
  raw.homepageLinks = [...seen].sort().map(n => ({ folder: n, exists: isDir(path.join(src, n)) }));
  raw.linkChecks = CHECK_LINKS.map(n => ({ folder: n, exists: isDir(path.join(src, n)) }));
  return raw;
}

/* ---------- build ---------- */
function build(raw, ov) {
  const aliasMap = {};
  for (const g of ALIAS_GROUPS) for (const n of g) aliasMap[normKey(n)] = normKey(g[0]);
  const aliasedKeys = new Set(Object.keys(aliasMap));
  const groups = new Map();
  const add = (key, f) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(f); };

  const exams = [];
  for (const f of raw.folders) {
    if (f.kind === 'exam') { exams.push(f); continue; }
    let key = normKey(f.folder);
    key = aliasMap[key] || key;
    const strippedCase = stripVariants(f.folder);
    if (SPLIT_BY_NAME.includes(strippedCase)) key += '|' + strippedCase;
    add(key, f);
  }

  const used = new Set(), out = [], report = { groups: [], variantOnly: [], review: [], lowConf: [], confirmAlias: [], flagged: [] };
  const entries = [];
  for (const [key, members] of groups) {
    const cands = members.filter(m => m.kind === 'college');
    const variants = members.filter(m => m.kind === 'variant');
    if (!cands.length) { report.variantOnly.push({ key, folders: variants.map(v => v.folder) }); continue; }
    const sorted = [...cands].sort((a, b) => b.year - a.year || b.ver - a.ver || (+(b.hasSubmit && b.ga) - +(a.hasSubmit && a.ga)) || a.folder.localeCompare(b.folder));
    const pick = sorted[0];
    let slug = kebab(pick.folder) || key; if (used.has(slug)) slug = slug + '-' + pick.folder.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    used.add(slug);
    entries.push({ key, slug, members, cands, variants, sorted, pick, needsReview: cands.length >= 2 });
  }
  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = Object.fromEntries(entries.map(e => [e.slug, e]));

  // overrides: mergeInto
  for (const [slug, o] of Object.entries(ov)) {
    if (!o.mergeInto || !bySlug[slug] || !bySlug[o.mergeInto]) continue;
    const s = bySlug[slug], t = bySlug[o.mergeInto];
    t.cands.push(...s.cands); t.variants.push(...s.variants); t.members.push(...s.members);
    t.sorted = [...t.cands].sort((a, b) => b.year - a.year || b.ver - a.ver || a.folder.localeCompare(b.folder));
    t.pick = t.sorted[0]; t.needsReview = true; t.merged = (t.merged || []).concat(slug);
    s.dropped = true;
  }

  const logoDir = path.join(OUT, 'assets', 'logos');
  fs.mkdirSync(logoDir, { recursive: true });
  for (const f of fs.readdirSync(logoDir)) if (f !== '.gitkeep') fs.unlinkSync(path.join(logoDir, f));
  const photoDir = path.join(OUT, 'assets', 'photos');
  fs.mkdirSync(photoDir, { recursive: true });
  for (const f of fs.readdirSync(photoDir)) fs.unlinkSync(path.join(photoDir, f));

  const featured = [];
  const record = (slug, pick, type, o, group) => {
    let logo = null;
    const withLogo = [pick, ...(group || [])].find(c => c.logoFile && isFile(path.join(LOGO_CACHE, c.logoFile)));
    if (withLogo) {
      logo = 'assets/logos/' + slug + path.extname(withLogo.logoFile);
      fs.copyFileSync(path.join(LOGO_CACHE, withLogo.logoFile), path.join(OUT, logo));
    }
    let photo = null;
    const withPhoto = [pick, ...(group || [])].find(c => c.photoFile && isFile(path.join(PHOTO_CACHE, c.photoFile)));
    if (withPhoto) { photo = 'assets/photos/' + slug + path.extname(withPhoto.photoFile); fs.copyFileSync(path.join(PHOTO_CACHE, withPhoto.photoFile), path.join(OUT, photo)); }
    const exams = Array.isArray(o.exams) ? o.exams : ((pick.exams && pick.exams.length ? pick.exams : ((group || []).find(c => c.exams && c.exams.length) || {}).exams) || []);
    const cityFallback = (group || []).map(c => c.city).find(Boolean) || null;
    const name = o.name || pick.name;
    const lpUrl = BASE + '/' + encodeURI(pick.folder) + '/' + (pick.lpPath ? pick.lpPath + '/' : '');
    const fees = pick.fees ? { value: pick.fees.value, asOf: pick.fees.asOf, source: '/' + pick.folder + '/' + (pick.lpPath ? pick.lpPath + '/' : '') } : null;
    const words = name.split(/\s+/);
    const shortName = name.length <= 24 ? name : (words.filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 6) || name);
    return {
      slug, name, shortName, city: o.city !== undefined ? o.city : (pick.city || cityFallback), category: CATEGORIES.includes(o.category) ? o.category : (type === 'exam' ? 'Exam' : pick.category),
      type, lpUrl, logo, photo, exams, fees, deadline: pick.deadline || null,
      about: o.about !== undefined ? o.about : (pick.about || (group || []).map(c => c.about).find(Boolean) || null),
      courses: Array.isArray(o.courses) ? o.courses : ((pick.courses && pick.courses.length ? pick.courses : ((group || []).find(c => c.courses && c.courses.length) || {}).courses) || [])
    };
  };

  // live data scraped from our own landing pages (scripts/scrape-live.js); overrides.json still wins
  let live = {};
  try { live = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-data.json'), 'utf8')).data || {}; } catch (e) { /* not scraped yet */ }
  const applyLive = rec => {
    const o = ov[rec.slug] || {}, L = live[rec.slug];
    if (!L) { if (rec.about && /^Sample description/i.test(rec.about)) rec.about = null; return; }
    if (o.about === undefined && L.about) rec.about = L.about;
    if (!Array.isArray(o.courses) && L.courses && L.courses.length) rec.courses = L.courses;
    if (!Array.isArray(o.exams) && L.exams && L.exams.length) rec.exams = L.exams;
    if (L.deadline) rec.deadline = L.deadline;
    for (const k of ['programs', 'stats', 'highlights', 'examInfo']) if (L[k] && L[k].length) rec[k] = L[k];
    rec.source = { url: L.source, updated: L.scrapedAt };
    if (!rec.photo && L.photoFile && isFile(path.join(__dirname, '..', '_private', 'live', 'photos', L.photoFile))) {
      rec.photo = 'assets/photos/' + rec.slug + path.extname(L.photoFile);
      fs.copyFileSync(path.join(__dirname, '..', '_private', 'live', 'photos', L.photoFile), path.join(OUT, rec.photo));
    }
  };

  for (const e of entries) {
    if (e.dropped) continue;
    const o = ov[e.slug] || {};
    if (o.canonical) { const forced = e.cands.find(c => c.folder === o.canonical); if (forced) e.pick = forced; else report.flagged.push(`override canonical "${o.canonical}" for ${e.slug} not found among candidates`); }
    const type = ONLINE_KEYS.includes(e.key) ? 'online' : 'college';
    const rec = record(e.slug, e.pick, type, o, e.sorted);
    applyLive(rec);
    e.rec = rec; e.hidden = !!o.hidden;
    if (!o.hidden) { out.push(rec); if (o.featured) featured.push(e.slug); }
    if (e.pick.catConf === 'low' && !o.category) report.lowConf.push(`${e.slug}: category "${rec.category}" low confidence`);
    if (!e.pick.nameOk && !o.name) report.lowConf.push(`${e.slug}: name prettified from slug ("${rec.name}")`);
    if (e.pick.flags.some(f => f.startsWith('abbreviation'))) report.lowConf.push(`${e.slug}: abbreviation, name not expanded ("${rec.name}")`);
    if (!rec.city) report.lowConf.push(`${e.slug}: city unknown (null)`);
  }
  for (const x of exams) {
    const slug = kebab(x.folder);
    const rec = record(slug, x, 'exam', ov[slug] || {});
    rec.city = null; rec.fees = x.fees ? rec.fees : null;
    applyLive(rec);
    if (!(ov[slug] || {}).hidden) out.push(rec);
    entries.push({ slug, exam: true, pick: x, cands: [x], variants: [], rec });
  }

  out.sort((a, b) => (a.type === 'exam') - (b.type === 'exam') || a.name.localeCompare(b.name));
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'data', 'colleges.public.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'data', 'featured.json'), JSON.stringify(featured) + '\n');
  fs.writeFileSync(path.join(OUT, 'data', 'registry-meta.json'), JSON.stringify({ sample: !!raw.sample }) + '\n');

  /* private report */
  const allFolders = new Set(raw.folders.map(f => f.folder));
  const L = [];
  L.push('# Canonical report', '', `Generated ${new Date().toISOString()} from ${raw.sample ? '**SAMPLE FIXTURE (not real data)**' : 'scan'} taken ${raw.generatedAt}.`, '');
  const colleges = out.filter(r => r.type !== 'exam'), ex = out.filter(r => r.type === 'exam');
  L.push(`**Listed:** ${colleges.length} colleges, ${ex.length} exams/tools.  **Excluded folders:** ${raw.excluded.length}.  **Needs review:** ${entries.filter(e => e.needsReview && !e.dropped).length}.`, '');
  if (raw.leadPhp) {
    L.push('## Lead endpoint intel (from submitLead.php, read-only)', '', 'POST keys read: ' + (raw.leadPhp.postKeys.map(k => '`' + k + '`').join(', ') || '(none found)'), '', 'Response lines:', '```', ...raw.leadPhp.responseLines, '```', '', 'Mirror these in `staging/assets/js/config.js` (FIELD_MAP, isSuccess).', '');
  } else L.push('## Lead endpoint intel', '', 'No `submitLead.php` at the scan root. FIELD_MAP / isSuccess in config.js are **unverified defaults (TODO)**.', '');

  L.push('## Groups (college -> chosen LP)', '', '| Slug | Chosen LP | Alternatives (non-canonical) | Review |', '|---|---|---|---|');
  for (const e of entries.filter(e => !e.exam && !e.dropped)) {
    const alts = [...e.cands.filter(c => c !== e.pick).map(c => c.folder), ...e.variants.map(v => v.folder + ' (variant)')];
    L.push(`| ${e.slug}${e.hidden ? ' (hidden)' : ''}${e.merged ? ' (merged: ' + e.merged.join(', ') + ')' : ''} | ${e.pick.folder}/${e.pick.lpPath} | ${alts.join(', ') || '-'} | ${e.needsReview ? 'needs review' : ''} |`);
  }
  L.push('', '## Exams and tools', '');
  for (const e of entries.filter(e => e.exam)) L.push(`- ${e.slug} -> ${e.pick.folder}/${e.pick.lpPath}`);
  L.push('', '## Needs review (2+ distinct candidates; default pick = highest year, then _vN, then submitLead+GA4)', '');
  for (const e of entries.filter(e => e.needsReview && !e.dropped)) L.push(`- **${e.slug}**: picked \`${e.pick.folder}\`; also: ${e.sorted.filter(c => c !== e.pick).map(c => '`' + c.folder + '`').join(', ')}`);
  L.push('', '## Alias merges applied (confirm each)', '');
  for (const g of ALIAS_GROUPS) { const present = g.filter(n => [...allFolders].some(f => normKey(f) === normKey(n))); L.push(`- confirm: ${g.join(' + ')}${present.length ? '' : ' (no matching folders in this scan)'}`); }
  L.push('', '## Kept separate on purpose (flagged)', '');
  for (const n of FLAG_SEPARATE) { const hit = [...allFolders].filter(f => normKey(f) === normKey(n) || f.toLowerCase().startsWith(n.toLowerCase())); if (hit.length) L.push(`- flag: ${n} -> ${hit.join(', ')}`); }
  L.push('- Every Amity campus, GITAM campus, NIFT city, IHM/IIHM city, SRM Ghaziabad/Sonepat is a separate college by design.');
  L.push('', '## Variant-only groups (no canonical LP; NOT listed)', '');
  L.push(...(report.variantOnly.length ? report.variantOnly.map(v => `- ${v.folders.join(', ')}`) : ['- none']));
  L.push('', '## Excluded folders', '', '| Folder | Reason |', '|---|---|');
  for (const x of raw.excluded) L.push(`| ${x.folder} | ${x.reason} |`);
  L.push('', '### Without submitLead.php', '');
  const ns = raw.excluded.filter(x => x.reason === 'no submitLead.php');
  L.push(...(ns.length ? ns.map(x => `- ${x.folder}`) : ['- none']));
  L.push('', '## Low-confidence items', '', ...(report.lowConf.length ? report.lowConf.map(s => '- ' + s) : ['- none']));
  if (report.flagged.length) L.push('', '## Override warnings', '', ...report.flagged.map(s => '- ' + s));
  L.push('', '## Homepage links pointing to missing folders', '');
  const miss = raw.homepageLinks.filter(l => !l.exists);
  L.push(...(miss.length ? miss.map(l => `- /${l.folder}/`) : ['- none (or homepage not scanned)']));
  L.push('', '## Specific checks', '', ...(raw.linkChecks || []).map(l => `- /${l.folder}/ : ${l.exists ? 'exists' : 'MISSING'}`));
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(path.join(PRIVATE, 'canonical-report.md'), L.join('\n') + '\n');
  return { colleges: colleges.length, exams: ex.length, featured: featured.length };
}

/* ---------- main ---------- */
function main() {
  fs.mkdirSync(PRIVATE, { recursive: true });
  let raw;
  const scanDir = opt('scan');
  if (has('scan') && !scanDir) { console.error('--scan needs a path to a (copy of) public_html'); process.exit(2); }
  if (scanDir) {
    if (!isDir(scanDir)) { console.error('Scan path not found: ' + scanDir); process.exit(2); }
    raw = scan(path.resolve(scanDir));
    raw.sample = has('sample');
    fs.writeFileSync(RAW, JSON.stringify(raw, null, 1));
  } else {
    if (!isFile(RAW)) { console.error('No cached scan. Run with --scan <public_html copy> first.'); process.exit(2); }
    raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
  }
  let ov = {};
  const ovText = readText(OVERRIDES);
  if (ovText) { try { ov = JSON.parse(ovText); } catch (e) { console.error('overrides.json is not valid JSON'); process.exit(2); } }
  delete ov._readme;
  const r = build(raw, ov);
  console.log(`Built: ${r.colleges} colleges, ${r.exams} exams, ${r.featured} featured -> ${path.relative(ROOT, OUT)}/data`);
  if (raw.sample) console.log('WARNING: registry built from SAMPLE fixture data. Do not deploy.');
}
main();
