#!/usr/bin/env node
/* Reads each college's OFFICIAL website (scripts/official-sites.json) and writes scripts/official-data.json:
 * short factual summary, facts (established, accreditation, campus size, numbers), highlights and up to 4 photos.
 *
 *   node scripts/scrape-official.js [slug ...]     only those slugs (default: all)
 *   node scripts/scrape-official.js --cache        re-parse cached HTML, no network
 *
 * Demo use: text is trimmed to short excerpts and every record carries its source URL and date. Photos stay in
 * _private/official/photos (copied into the site by build-live-registry.js). Get the colleges' permission
 * for photos and text before a public launch. GET requests only; nothing is submitted. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SITES = JSON.parse(fs.readFileSync(path.join(__dirname, 'official-sites.json'), 'utf8')); delete SITES._readme;
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'staging', 'data', 'colleges.public.json'), 'utf8'));
const CACHE = path.join(ROOT, '_private', 'official');
const PHOTOS = path.join(CACHE, 'photos');
const OUT = path.join(__dirname, 'official-data.json');
const OFFLINE = process.argv.includes('--cache');
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('--'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
fs.mkdirSync(PHOTOS, { recursive: true });

const BAN = /(collegedunia|careers360|shiksha|collegedekho|getyourcollege|pagalguy|\bcd\b link)/i;
const NOISE = /(cookie|privacy policy|copyright|all rights reserved|apply now|enquire|subscribe|sign in|log ?in|click here|read more|learn more|download|terms|disclaimer|javascript)/i;
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#8216;/g, "'").replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"').replace(/&ndash;|&mdash;|&#8211;|&#8212;/g, '-').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
const clean = s => decode(s).replace(/\s+/g, ' ').trim();

function fetchText(url, file) {
  if (OFFLINE) return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  try {
    const out = execFileSync('curl', ['-sL', '--compressed', '-m', '40', '-A', UA, '-H', 'Accept: text/html,*/*', url], { maxBuffer: 30 * 1024 * 1024 }).toString('utf8');
    if (out.length < 500) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, out); return out;
  } catch (e) { return null; }
}
function fetchBin(url) { try { return execFileSync('curl', ['-sL', '-m', '40', '-A', UA, '-e', url, url], { maxBuffer: 30 * 1024 * 1024 }); } catch (e) { return null; } }

const strip = h => h.replace(/<(script|style|noscript|svg|template|iframe|nav|footer|form)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
function blocks(html, tags) { const re = new RegExp('<(' + tags + ')\\b[^>]*>([\\s\\S]*?)</\\1>', 'gi'); return [...strip(html).matchAll(re)].map(m => clean(m[2].replace(/<[^>]+>/g, ' '))).filter(Boolean); }
const meta = (h, n) => { const m = h.match(new RegExp('<meta[^>]+(?:name|property)=["\']' + n + '["\'][^>]*content=["\']([^"\']+)["\']', 'i')) || h.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:name|property)=["\']' + n + '["\']', 'i')); return m ? clean(m[1]) : null; };

function aboutLinks(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const txt = clean(m[2].replace(/<[^>]+>/g, ' ')).toLowerCase();
    if (!/^(about|about us|about [a-z .&]{2,30}|overview|at a glance|why [a-z .&]{2,25}|institute|the university|our story|history|rankings?|accreditations?)$/.test(txt) && !/\/(about(-us)?|overview|at-a-glance)\/?$/i.test(m[1])) continue;
    try { const u = new URL(m[1], base); if (u.host.replace(/^www\./, '') !== new URL(base).host.replace(/^www\./, '')) continue; if (/\.(pdf|jpg|png|docx?)$/i.test(u.pathname)) continue; if (!out.includes(u.href)) out.push(u.href); } catch (e) { /* skip */ }
  }
  return out.slice(0, 2);
}

const ACCRED = ['NAAC', 'NBA', 'AICTE', 'UGC', 'AACSB', 'EQUIS', 'AMBA', 'NIRF', 'BCI', 'ACU', 'IACBE', 'PRME'];
function facts(text, isExam) {
  const f = []; const add = (label, value) => { if (value && !f.some(x => x.label === label)) f.push({ label, value }); };
  if (isExam) return f;
  const est = text.match(/\b(?:established|founded|since|est\.?|started in|inaugurated in)\s*(?:in\s*|:)?\s*(18\d\d|19\d\d|20[0-2]\d)\b/i); if (est) add('Established', est[1]);
  const naac = text.match(/NAAC[^.\n]{0,50}?\b(A\+\+|A\+|A|B\+\+|B\+)(?![A-Za-z+])/) || text.match(/\b(A\+\+|A\+)\s*(?:grade\s*)?(?:accredited\s*)?by\s*NAAC/i); if (naac) add('NAAC grade', naac[1].toUpperCase());
  const acc = ACCRED.filter(a => new RegExp('\\b' + a + '\\b').test(text)); if (acc.length) add('Accreditations / approvals', acc.join(', '));
  const acre = text.match(/(\d{1,4}(?:\.\d+)?)\s*[-\s]?\s*acres?\b/i); if (acre) add('Campus size', acre[1] + ' acres');
  const nirf = text.match(/(?:ranked|rank|ranking)?\s*(?:no\.?|#)?\s*(\d{1,3})(?:st|nd|rd|th)?\s*(?:rank\s*)?(?:in|by|under|among)?\s*(?:the\s*)?NIRF[^.\n]{0,40}/i) || text.match(/NIRF[^.\n]{0,50}?(?:rank(?:ed|ing)?|#|no\.?)\s*(\d{1,3})(?:st|nd|rd|th)?\b/i); if (nirf && +nirf[1] > 0 && +nirf[1] <= 300) add('NIRF rank (as stated)', '#' + (+nirf[1]));
  for (const [label, re] of [['Students', /(\d[\d,]*\+?)\s*\+?\s*(?:current\s+)?students\b/i], ['Alumni', /(\d[\d,]*\+?)\s*\+?\s*alumni\b/i], ['Faculty', /(\d[\d,]*\+?)\s*\+?\s*(?:full[- ]time\s+)?faculty\b/i], ['Recruiters', /(\d[\d,]*\+?)\s*\+?\s*(?:top\s+)?(?:recruiters|companies visit|recruiting companies)\b/i], ['Programmes', /(\d[\d,]*\+?)\s*\+?\s*(?:academic\s+)?(?:programmes|programs|courses)\b/i]]) { const m = text.match(re); const n = m ? +m[1].replace(/\D/g, '') : 0; const min = { Students: 500, Alumni: 500, Faculty: 20, Recruiters: 20, Programmes: 5 }[label]; if (m && n >= min && n < 1000000 && !(n >= 1900 && n <= 2100 && !m[1].includes(','))) add(label, m[1]); }
  const hp = text.match(/highest\s*(?:domestic\s*)?(?:package|salary|ctc)[^₹\dA-Za-z]{0,30}(?:₹|inr|rs\.?)\s?([\d.,]+)\s*(lpa|lakhs?|l\.p\.a|crores?|cr)?/i); if (hp) add('Highest package (as stated)', '₹' + hp[1] + ' ' + (hp[2] || 'LPA').toUpperCase().replace('LAKHS', 'Lakhs').replace('LAKH', 'Lakh'));
  const ap = text.match(/average\s*(?:package|salary|ctc)[^₹\dA-Za-z]{0,30}(?:₹|inr|rs\.?)\s?([\d.,]+)\s*(lpa|lakhs?|l\.p\.a|crores?|cr)?/i); if (ap) add('Average package (as stated)', '₹' + ap[1] + ' ' + (ap[2] || 'LPA').toUpperCase().replace('LAKHS', 'Lakhs').replace('LAKH', 'Lakh'));
  return f;
}
const HL = /(rank|accredit|naac|nirf|aacsb|equis|nba\b|placement|package|recruiter|campus|scholarship|international|industry|research|alumni|established|first|top\b|among|leading|premier|laborator|intake|exchange|partner)/i;
function highlights(lists, name) {
  const seen = new Set(), out = [];
  for (const t0 of lists) {
    const t = t0.replace(/^[•✅✓\s•-]+/, '').trim();
    if (t.length < 45 || t.length > 210 || /^(discover|explore|gain|conduct|join|apply|learn|find|visit|get|read|watch|view|see|know|check|take|start|begin|enrol|register)\b/i.test(t) || NOISE.test(t) || BAN.test(t) || !HL.test(t) || /[{}<>]|©/.test(t)) continue;
    if ((t.match(/[A-Z]/g) || []).length > t.length * 0.45) continue; // ALL CAPS menus
    const k = t.toLowerCase().slice(0, 50); if (seen.has(k)) continue; seen.add(k); out.push(t.endsWith('.') ? t : t);
    if (out.length >= 8) break;
  }
  return out;
}
function summary(paras, name) {
  const toks = name.toLowerCase().replace(/[()&,.-]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/^(institute|university|college|school|management|business|national)$/.test(w));
  const ok = paras.filter(p => p.length >= 110 && p.length <= 900 && !NOISE.test(p.slice(0, 80)) && !BAN.test(p) && !/[{}<>]/.test(p) && (p.match(/[.!?]/g) || []).length >= 1);
  const pick = ok.find(p => toks.some(t => p.toLowerCase().includes(t))) || ok[0];
  if (!pick) return null;
  const sents = pick.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [pick]; let s = ''; for (const x of sents) { if ((s + x).length > 520) break; s += x; }
  return (s || pick.slice(0, 480)).trim();
}

/* photos: landscape images of decent size, resized to a web-friendly JPEG (macOS sips) */
const BADIMG = /(logo|icon|sprite|favicon|flag|avatar|placeholder|loader|arrow|facebook|twitter|linkedin|youtube|instagram|whatsapp|badge|rank|accredit|award|naac|nirf|nba|aicte|partner|recruit|testimonial|alumni-|student-speak|\.svg|\.gif|qr|ad-|poster|brochure|admission-open|apply)/i;
const GOODIMG = /(campus|hero|banner|slider|slide|building|infra|library|auditorium|about|gallery|facility|facilities|lab|classroom|aerial|front|entrance|block|university|college|institute)/i;
function imgCandidates(html, base) {
  const c = []; const og = meta(html, 'og:image'); if (og) c.push({ u: og, w: 100 });
  for (const m of html.matchAll(/(?:\bsrc|data-src|data-lazy-src|data-original)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']|url\(["']?([^"')]+\.(?:jpe?g|png|webp)[^"')]*)/gi)) c.push({ u: m[1] || m[2], w: 0 });
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) { const parts = m[1].split(',').map(x => x.trim().split(/\s+/)); const best = parts.sort((a, b) => parseInt(b[1] || 0) - parseInt(a[1] || 0))[0]; if (best && /\.(jpe?g|png|webp)/i.test(best[0])) c.push({ u: best[0], w: 0 }); }
  const seen = new Set(), out = [];
  for (const x of c) { let u; try { u = new URL(x.u.replace(/&amp;/g, '&'), base).href; } catch (e) { continue; } if (seen.has(u) || BADIMG.test(u)) continue; seen.add(u); out.push({ u, score: x.w + (GOODIMG.test(u) ? 5 : 0) }); }
  return out.sort((a, b) => b.score - a.score);
}
function dims(f) { try { const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f]).toString(); return [+/pixelWidth: (\d+)/.exec(o)[1], +/pixelHeight: (\d+)/.exec(o)[1]]; } catch (e) { return null; } }
function savePhotos(slug, cands, used) {
  const dir = path.join(PHOTOS, slug); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const got = [], hashes = new Set(), tmp = path.join(CACHE, '_tmp_' + slug);
  let tried = 0;
  for (const c of cands) {
    if (got.length >= 4 || tried >= 14) break; tried++;
    const buf = fetchBin(c.u); if (!buf || buf.length < 25000) continue;
    const ok = (buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50) || (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP'); if (!ok) continue;
    const h = crypto.createHash('md5').update(buf).digest('hex'); if (hashes.has(h) || used.has(h)) continue;
    const ext = buf[0] === 0xff ? 'jpg' : buf[0] === 0x89 ? 'png' : 'webp';
    fs.writeFileSync(tmp + '.' + ext, buf); const d = dims(tmp + '.' + ext); if (!d || d[0] < 700 || d[0] / d[1] < 1.25 || d[0] / d[1] > 2.8) continue;
    const out = path.join(dir, (got.length + 1) + '.jpg'); let done = false;
    for (const q of [72, 60, 48, 38]) { try { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), '-Z', '1200', tmp + '.' + ext, '--out', out], { stdio: 'ignore' }); } catch (e) { break; } if (fs.statSync(out).size <= 240000) { done = true; break; } }
    if (!done) { fs.rmSync(out, { force: true }); continue; }
    hashes.add(h); got.push({ file: slug + '/' + (got.length + 1) + '.jpg', from: c.u, hash: h });
  }
  for (const f of fs.readdirSync(CACHE)) if (f.startsWith('_tmp_' + slug + '.')) fs.unlinkSync(path.join(CACHE, f));
  return got;
}

async function one(r, used) {
  const [site] = SITES[r.slug];
  const dir = path.join(CACHE, r.slug);
  const home = fetchText(site, path.join(dir, 'home.html'));
  if (!home) return { slug: r.slug, error: 'could not read ' + site };
  const pages = [{ url: site, html: home }];
  for (const [i, u] of aboutLinks(home, site).entries()) { const h = fetchText(u, path.join(dir, 'about' + i + '.html')); if (h) pages.push({ url: u, html: h }); }
  const paras = [], lis = [], head = [];
  for (const p of pages) { paras.push(...blocks(p.html, 'p')); lis.push(...blocks(p.html, 'li'), ...blocks(p.html, 'p')); head.push(...blocks(p.html, 'h1|h2|h3|h4')); }
  const text = [...head, ...paras, ...lis].join('\n').replace(/\s+/g, ' ');
  const isExam = r.type === 'exam';
  const o = { website: site, title: clean((home.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]), pages: pages.map(p => p.url) };
  const desc = meta(home, 'og:description') || meta(home, 'description');
  o.about = summary(paras, r.name) || (desc && !BAN.test(desc) && desc.length > 60 ? desc.slice(0, 480) : null);
  const f = facts(text, isExam); if (f.length) o.facts = f;
  const hl = highlights(lis, r.name); if (hl.length) o.highlights = hl;
  if (!isExam && !OFFLINE) {
    const cands = pages.flatMap(p => imgCandidates(p.html, p.url)).sort((a, b) => b.score - a.score);
    const ph = savePhotos(r.slug, cands, used); for (const x of ph) used.add(x.hash);
    if (ph.length) o.images = ph.map(x => x.file); o.imageSources = ph.map(x => x.from);
  } else if (!isExam && fs.existsSync(path.join(PHOTOS, r.slug))) o.images = fs.readdirSync(path.join(PHOTOS, r.slug)).sort().map(f => r.slug + '/' + f);
  o.scrapedAt = new Date().toISOString().slice(0, 10);
  return { slug: r.slug, o };
}

(async () => {
  const todo = REG.filter(r => SITES[r.slug] && (!ONLY.length || ONLY.includes(r.slug)));
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { data: {}, errors: [] };
  const data = ONLY.length ? old.data : {}, errors = [], used = new Set();
  for (const r of REG) if (!SITES[r.slug]) errors.push(`${r.slug}: no official site mapped`);
  let i = 0;
  const worker = async () => { while (i < todo.length) { const r = todo[i++]; const res = await one(r, used); if (res.error) { errors.push(`${r.slug}: ${res.error}`); console.log('x', r.slug, res.error); } else { data[r.slug] = res.o; console.log('ok', r.slug.padEnd(32), 'about:' + (res.o.about ? 1 : 0), 'facts:' + (res.o.facts || []).length, 'hl:' + (res.o.highlights || []).length, 'img:' + (res.o.images || []).length); } } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  fs.writeFileSync(OUT, JSON.stringify({ _readme: 'Generated by scrape-official.js from each college official website. Demo data; verify before launch.', errors, data }, null, 1) + '\n');
  console.log('\nDone:', Object.keys(data).length, 'records;', errors.length, 'problems');
  errors.forEach(e => console.log(' - ' + e));
})();
