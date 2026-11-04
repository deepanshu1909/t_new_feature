#!/usr/bin/env node
/* Reads the LIVE landing pages of the colleges/exams already in the registry (our own site only)
 * and writes scripts/live-data.json, which build-registry.js merges into the public JSON.
 *
 *   node scripts/scrape-live.js            fetch every lpUrl from staging/data/colleges.public.json
 *   node scripts/scrape-live.js --cache    re-parse the cached HTML in _private/live/ (no network)
 *
 * Read-only: only GET requests to the pages' own URLs. Nothing is invented: a field is written only
 * when the page states it. Pages that are not real LPs (404, HTTrack index) are skipped and listed. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'live-data.json');
const CACHE = path.join(ROOT, '_private', 'live');
const PHOTOS = path.join(CACHE, 'photos');
const REG = path.join(ROOT, 'staging', 'data', 'colleges.public.json');
const OFFLINE = process.argv.includes('--cache');
fs.mkdirSync(PHOTOS, { recursive: true });

const EXAMS = ['JEE Main', 'JEE Advanced', 'CUET', 'CAT', 'MAT', 'XAT', 'CMAT', 'GMAT', 'GRE', 'ATMA', 'SNAP', 'NMAT', 'BITSAT', 'VITEEE', 'NEET', 'NIFT', 'NID', 'UCEED', 'CEED', 'NATA', 'CLAT', 'LSAT', 'KCET', 'MHT CET', 'SAT', 'IPMAT', 'AIEEE', 'PGCET', 'NET', 'GATE'];
const STAT_LABELS = /^(students|avg package|average package|average ctc|highest package|highest ctc|nirf|est\.?|courses|seats available|application fee|alumni network|accredited|placement rate|recruiters|campus life|b\.des credits|b\.des specialisations)/i;
const NOISE = /(submit|terms|privacy|disclaimer|cookie|skip to content|full name|enter |select |apply now|unlock|register|enquire|get free|check your eligibility|download brochure|\bsign in\b|whatsapp|©)/i;

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '-').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
const clean = s => decode(s).replace(/[ \s]+/g, ' ').trim();

function toLines(html) {
  const h = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<\/?(p|div|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|nav|br|button|label|option|select|span|a|b|strong|em|small)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return h.split('\n').map(clean).filter(Boolean);
}
function lisOf(html) {
  const body = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ');
  return [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => clean(m[1].replace(/<[^>]+>/g, ' '))).filter(Boolean);
}
function optionsOf(html) {
  const sel = [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/gi)].map(m => [...m[1].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map(o => clean(o[1])));
  // the programme/course select: has short course-like labels and is not the city list
  const bad = /^(select|choose|--|mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|other)/i;
  const cand = sel.map(a => a.filter(x => x && !bad.test(x))).filter(a => a.length >= 2 && a.length <= 40 && a.every(x => x.length <= 80));
  return cand[0] || [];
}

function parse(html, url, type) {
  const lines = toLines(html);
  const o = {};
  const title = clean((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const metaD = html.match(/<meta[^>]+name=["']description["'][^>]+content=(?:"([^"]{40,500})"|'([^']{40,500})')/i);

  // about: the paragraph(s) following an "About ..." heading, else the first long non-noise paragraph
  let about = null;
  const ai = lines.findIndex((l, i) => /^About\s+(?!us\b|collegedunia\b)[A-Z]/.test(l) && l.length < 90 && lines[i + 1] && lines[i + 1].length > 80);
  if (ai >= 0) {
    const parts = []; for (let i = ai + 1; i < lines.length && parts.join(' ').length < 900; i++) { if (lines[i].length > 60 && !NOISE.test(lines[i].slice(0, 40))) parts.push(lines[i]); else if (parts.length) break; }
    about = parts.join(' ');
  }
  if (type === 'exam') { const body = lines.filter(l => l.length >= 55 && l.length < 400 && !NOISE.test(l) && !/[?]$/.test(l)); about = body.slice(0, 2).join(' ') || about; }
  if (!about) { const p = lines.find(l => l.length > 140 && l.length < 900 && !NOISE.test(l)); about = p || (metaD ? clean(metaD[1] || metaD[2]) : null); }
  if (about) o.about = about.length > 900 ? about.slice(0, 900).replace(/\s+\S*$/, '') + '…' : about;

  // fee table, row-based (works for <tr><td> markup)
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1].replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))));
  const feeRows = rows.filter(r => r.length >= 4 && /apply now/i.test(r[r.length - 1]) && r[0] && !/^course$/i.test(r[0]));
  if (feeRows.length) o.programs = feeRows.map(r => ({ course: r[0], fees: r[1] && /\d/.test(r[1]) ? (/^[\d.,]+\s*[LC]r?$/i.test(r[1]) ? '₹' + r[1].replace(/\s*L$/i, ' Lakhs') : r[1]) : null, eligibility: r[2] && r[2] !== '-' ? r[2] : null, dates: r[3] && r[3] !== '-' ? r[3] : null }));
  // fee table: 5-line rows ending in "Apply Now" (also gives specialisation-wise fees)
  const hi = lines.findIndex((l, i) => l === 'Total Fees' && lines[i + 1] === 'Eligibility');
  if (hi >= 0) {
    let i = lines.indexOf('Action', hi) + 1; const programs = [];
    while (i + 4 < lines.length && /^apply now$/i.test(lines[i + 4])) { programs.push({ course: lines[i], fees: lines[i + 1], eligibility: lines[i + 2] === '-' ? null : lines[i + 2], dates: lines[i + 3] === '-' ? null : lines[i + 3] }); i += 5; }
    if (programs.length && !o.programs) o.programs = programs;
    // specialisation-wise fees: "<Course> Courses" / "Fees" then name + ₹ pairs
    const specs = {};
    for (let j = i; j < lines.length; j++) {
      const m = lines[j].match(/^(.{1,30}) Courses$/);
      if (m && lines[j + 1] === 'Fees') {
        const arr = []; let k = j + 2;
        while (k + 1 < lines.length && /^₹[\d,]+/.test(lines[k + 1]) && !/ Courses$/.test(lines[k])) { arr.push({ name: lines[k].replace(/\s*\[[^\]]+\]\s*/g, ' ').replace(/\s+/g, ' ').trim(), fee: lines[k + 1] }); k += 2; }
        if (arr.length) specs[m[1]] = arr; j = k - 1;
      }
    }
    if (o.programs) for (const p of o.programs) if (specs[p.course]) p.specs = specs[p.course];
  }

  // stat tiles: value line + label line (either order), whitelisted labels only
  const stats = []; const seen = new Set();
  for (let i = 0; i < lines.length - 1 && i < 200; i++) {
    const a = lines[i], b = lines[i + 1];
    const isVal = x => x.length <= 22 && /(\d|^NAAC|^Not disclosed)/.test(x) && !/[.!?]$/.test(x) && x.split(' ').length <= 4;
    let label = null, value = null;
    if (STAT_LABELS.test(b) && b.length <= 30 && isVal(a)) { value = a; label = b; }
    else if (STAT_LABELS.test(a) && a.length <= 30 && isVal(b) && !STAT_LABELS.test(b)) { label = a; value = b; }
    if (label && /^(highest|average|avg)/i.test(label) && /^LPA$/i.test(lines[i + 2] || '') && !/LPA/i.test(value)) value += ' LPA';
    if (label) { if (value !== 'NAAC GRADE' && !seen.has(label.toLowerCase())) { seen.add(label.toLowerCase()); stats.push({ label: label.replace(/\s+/g, ' '), value }); } i++; }
  }
  // sidpune style: "Highest CTC / ₹18 / LPA"
  if (!stats.length) {
    for (let i = 0; i < lines.length - 2 && i < 120; i++) if (/^(highest|average) (ctc|package)$/i.test(lines[i]) && /₹?\d/.test(lines[i + 1]) && /^LPA$/i.test(lines[i + 2])) { stats.push({ label: lines[i], value: lines[i + 1] + ' ' + lines[i + 2] }); i += 2; }
  }
  if (stats.length) o.stats = stats.slice(0, 8);

  // highlights: list items that read like selling points (not nav, not forms, not course names)
  const hl = lisOf(html).filter(t => t.length >= 35 && t.length <= 220 && !NOISE.test(t) && /\s/.test(t) && !/~\s|\bI (am|was|have)\b|\bmy\b/i.test(t));
  const uniq = [...new Set(hl)];
  if (uniq.length) o.highlights = uniq.slice(0, 8);

  // programmes offered (course select of the LP's own form)
  const opts = optionsOf(html); if (opts.length) o.courses = opts;
  if (!o.courses && o.programs) o.courses = o.programs.map(p => p.course);

  // exams named on the page (case-sensitive, whole word)
  const text = lines.join('\n');
  const found = EXAMS.filter(e => new RegExp('(^|[^A-Za-z])' + e.replace(/ /g, '\\s') + '(?![A-Za-z])').test(text));
  if (found.length && type !== 'exam') o.exams = found.slice(0, 8);

  // exam facts: "Key:" newline "Value" pairs, and pattern table pairs
  const info = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z ()\-]{3,50}):$/);
    if (m && lines[i + 1].length <= 90 && !/:$/.test(lines[i + 1])) info.push({ label: m[1], value: lines[i + 1] });
  }
  for (const k of ['Mode', 'Total Questions', 'Total Marks', 'Duration', 'Subjects', 'Languages', 'Correct Answer', 'Incorrect Answer']) {
    const i = lines.indexOf(k); if (i >= 0 && lines[i + 1] && lines[i + 1].length <= 60 && !info.some(x => x.label === k)) info.push({ label: k, value: lines[i + 1] });
  }
  const fee = text.match(/Rs\.?\s?([\d,]+)\/?-?\s+is the application fee/i); if (fee) info.push({ label: 'Application fee', value: 'Rs. ' + fee[1] });
  const seats = text.match(/(\d{2,4}\+?)\s*\n?\s*Seats Available/i);
  const goodInfo = info.filter(x => !/enter|frequently|details|scholarship/i.test(x.label) && !/^(enter|when|what|how)\b/i.test(x.value) && !/\?$/.test(x.value) && !/^[₹\s—-]+$/.test(x.value));
  if (type === 'exam' && goodInfo.length) o.examInfo = goodInfo.slice(0, 12);

  // deadline: an explicit sentence only
  const dl = text.match(/(?:last date[^.\n]{0,80}?|deadline:?)\s*(?:is\s*)?(?:till\s*)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\.?\s+20\d\d)/i);
  if (dl) o.deadline = dl[1];
  o.title = title;
  o.source = url;
  return o;
}

// photo: only an image whose filename says campus/banner/hero/building, with valid image bytes, ≤250KB.
// Logos, stock people and accreditation badges are never used (checked by eye on the first run).
const MAGIC = b => (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP');
async function pickPhoto(html, base, slug, notes) {
  const imgs = [...new Set([...html.matchAll(/(?:src|data-src|url\()=?["']?([^"'\s)]+\.(?:jpe?g|png|webp))/gi)].map(m => m[1]))].filter(s => /(campus|banner|hero|building)/i.test(s) && !/(logo|icon|favicon|gyc_fav)/i.test(s));
  for (const s of imgs.slice(0, 4)) {
    try {
      const u = new URL(s, base).href;
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (GYC staging builder)' } });
      if (!r.ok) { notes.push(`${slug}: photo ${u} HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (!MAGIC(buf)) { notes.push(`${slug}: photo ${u} is not an image`); continue; }
      if (buf.length < 15000) continue;
      let ext = (u.match(/\.(jpe?g|png|webp)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg'), data = buf;
      if (buf.length > 250000) { // shrink with macOS sips (resize + JPEG), otherwise skip
        try {
          const tin = path.join(PHOTOS, '_in.' + ext), tout = path.join(PHOTOS, '_out.jpg');
          fs.writeFileSync(tin, buf);
          require('child_process').execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '60', '-Z', '1000', tin, '--out', tout], { stdio: 'ignore' });
          data = fs.readFileSync(tout); ext = 'jpg'; fs.unlinkSync(tin); fs.unlinkSync(tout);
        } catch (e) { data = buf; }
        if (data.length > 250000) { notes.push(`${slug}: photo ${u} is ${Math.round(buf.length / 1024)}KB (> 250KB cap), skipped`); continue; }
      }
      const f = slug + '.' + ext; fs.writeFileSync(path.join(PHOTOS, f), data); return f;
    } catch (e) { /* try the next image */ }
  }
  return null;
}

module.exports = { parse, pickPhoto, PHOTOS, CACHE };
if (require.main === module) (async () => {
  const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const data = {}, skipped = [];
  for (const f of fs.readdirSync(PHOTOS)) if (!OFFLINE) fs.unlinkSync(path.join(PHOTOS, f));
  for (const r of reg) {
    const cf = path.join(CACHE, r.slug + '.html');
    let html = null;
    if (OFFLINE) { if (fs.existsSync(cf)) html = fs.readFileSync(cf, 'utf8'); }
    else {
      try {
        const res = await fetch(r.lpUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (GYC staging builder)' } });
        if (!res.ok) { skipped.push(`${r.slug}: HTTP ${res.status} at ${r.lpUrl}`); continue; }
        html = await res.text(); fs.writeFileSync(cf, html);
      } catch (e) { skipped.push(`${r.slug}: ${e.message}`); continue; }
    }
    if (!html) { skipped.push(`${r.slug}: no cached HTML`); continue; }
    if (/HTTrack Website Copier/i.test(html)) { skipped.push(`${r.slug}: ${r.lpUrl} is an HTTrack mirror index, not a landing page`); continue; }
    const o = parse(html, r.lpUrl, r.type);
    const photo = OFFLINE ? (fs.readdirSync(PHOTOS).find(f => f.startsWith(r.slug + '.')) || null) : await pickPhoto(html, r.lpUrl, r.slug, skipped);
    if (photo) o.photoFile = photo;
    o.scrapedAt = new Date().toISOString().slice(0, 10);
    data[r.slug] = o;
    const n = k => o[k] ? (Array.isArray(o[k]) ? o[k].length : 1) : 0;
    console.log(`${r.slug.padEnd(28)} about:${n('about')} programs:${n('programs')} courses:${n('courses')} stats:${n('stats')} highlights:${n('highlights')} exams:${n('exams')} info:${n('examInfo')} photo:${photo ? 'y' : 'n'}`);
  }
  fs.writeFileSync(OUT, JSON.stringify({ _readme: 'Generated by scrape-live.js from our own live landing pages. Re-run to refresh. Do not hand-edit; use overrides.json for corrections.', skipped, data }, null, 1) + '\n');
  console.log('\nSkipped:\n' + skipped.map(s => ' - ' + s).join('\n'));
})();
