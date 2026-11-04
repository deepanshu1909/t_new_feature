#!/usr/bin/env node
/* Fallback photos from Wikimedia Commons (open licences) for colleges whose own site gave no usable photo.
 *   node scripts/wiki-photos.js            -> _private/wiki/<slug>/n.jpg + _private/wiki/credits.json
 * Only CC / public-domain files; each credit (author, licence, file page) is kept so it can be shown. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, '_private', 'wiki');
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'staging', 'data', 'colleges.public.json'), 'utf8'));
const cur = JSON.parse(fs.readFileSync(path.join(__dirname, 'photo-curation.json'), 'utf8'));
const TITLES = { 'ahmd-uni': 'Ahmedabad University', 'amity-university-dubai': 'Amity University Dubai', 'amity-noida': 'Amity University, Noida', 'asian-business-school-abs': 'Asian Business School', 'atlas': 'Atlas SkillTech University', 'chitkara-university-cu-patiala': 'Chitkara University', 'fergusson-college-pune': 'Fergusson College', 'frankfinn': 'Frankfinn Institute of Air Hostess Training', 'gibs': 'Global Institute of Business Studies', 'imsghaz': 'Institute of Management Studies, Ghaziabad', 'jagsom': 'Jagdish Sheth School of Management', 'jain-university': 'Jain University', 'jdift': 'JD Institute of Fashion Technology', 'kj-somaiya-institute': 'K. J. Somaiya Institute of Management Studies and Research', 'mdi-gurgaon': 'Management Development Institute', 'nmims': 'NMIMS', 'op-jindal-global-university': 'O. P. Jindal Global University', 'symbiosis-institute-of-business': 'Symbiosis Institute of Business Management, Pune', 'symbiosis-institute-of-design': 'Symbiosis Institute of Design', 'symbiosis-law-school-sls': 'Symbiosis Law School, Pune' };
const prev = fs.existsSync(path.join(OUT, 'credits.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'credits.json'), 'utf8')) : {};
const slugs = reg.filter(r => r.type !== 'exam' && !cur[r.slug] && TITLES[r.slug] && (process.argv.includes('--all') || !(prev[r.slug] && prev[r.slug].length))).map(r => r.slug);
const get = u => { execFileSync('sleep', ['1.2']); return JSON.parse(execFileSync('curl', ['-sL', '-m', '30', '-A', 'GYC-demo-builder/1.0 (contact: local demo)', u]).toString()); };
const bin = u => execFileSync('curl', ['-sL', '-m', '40', '-A', 'GYC-demo-builder/1.0 (local demo)', u], { maxBuffer: 40e6 });
const credits = fs.existsSync(path.join(OUT, 'credits.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'credits.json'), 'utf8')) : {};
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
for (const slug of slugs) {
  const dir = path.join(OUT, slug); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let files = [];
  try {
    const q = get('https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=images&imlimit=60&titles=' + encodeURIComponent(TITLES[slug]));
    const pg = Object.values(q.query.pages)[0]; files = (pg.images || []).map(i => i.title).filter(t => /\.(jpe?g)$/i.test(t) && !/(logo|icon|map|flag|symbol|signature|seal|emblem|banner|poster|crest|wordmark|commons-logo)/i.test(t));
    // also search Commons by name
    const c = get('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=' + encodeURIComponent(TITLES[slug] + ' campus filetype:bitmap'));
    for (const p of Object.values((c.query || {}).pages || {})) if (/\.(jpe?g)$/i.test(p.title) && !/(logo|icon|map|flag|poster|banner)/i.test(p.title)) files.push(p.title);
  } catch (e) { console.log('x', slug, e.message); continue; }
  files = [...new Set(files)].slice(0, 14); const got = [];
  for (const f of files) {
    if (got.length >= 4) break;
    try {
      const info = get('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200&titles=' + encodeURIComponent(f));
      const ii = Object.values(info.query.pages)[0].imageinfo[0], md = ii.extmetadata || {};
      const lic = strip((md.LicenseShortName || {}).value); if (!/^(CC BY|CC0|Public domain|PD|CC BY-SA)/i.test(lic)) continue;
      if (ii.width < 900 || ii.width / ii.height < 1.2 || ii.width / ii.height > 2.8) continue;
      const buf = bin(ii.thumburl || ii.url); if (buf.length < 20000 || !(buf[0] === 0xff && buf[1] === 0xd8)) continue;
      const tmp = path.join(dir, '_t.jpg'), out = path.join(dir, (got.length + 1) + '.jpg'); fs.writeFileSync(tmp, buf);
      let ok = false; for (const qv of [72, 60, 48]) { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(qv), '-Z', '1200', tmp, '--out', out], { stdio: 'ignore' }); if (fs.statSync(out).size <= 240000) { ok = true; break; } }
      fs.rmSync(tmp, { force: true }); if (!ok) { fs.rmSync(out, { force: true }); continue; }
      got.push({ file: slug + '/' + (got.length + 1) + '.jpg', title: f, author: strip((md.Artist || {}).value).slice(0, 80), license: lic, page: ii.descriptionurl });
    } catch (e) { /* next file */ }
  }
  credits[slug] = got; console.log(slug.padEnd(32), got.length, 'photos from', files.length, 'candidates');
}
fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 1));
