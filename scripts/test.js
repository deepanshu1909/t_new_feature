#!/usr/bin/env node
/* Automated checks: node scripts/test.js [path-to-scanned-public_html]  (default: the sample fixture) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), WEB = path.join(ROOT, 'staging');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, 'fixture', 'public_html'));
const reg = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'colleges.public.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'registry-meta.json'), 'utf8'));
const LIVE = !!meta.live;
let fail = 0;
const t = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fail++; };
const folderOf = u => u ? decodeURIComponent(new URL(u).pathname.split('/')[1]) : '';

// 1. only canonical entries
const bad = reg.filter(r => { if (!r.lpUrl) return false; const f = folderOf(r.lpUrl); return /(_bing|_coursefees|_cd|_av|_copy|_copy_nm)(\/|$)/.test(f) || /_coursefees|_bing$|_cd$|_av$|__bak_|^GENERATOR_SOURCE/.test(f) || /__bak_|GENERATOR/.test(r.lpUrl); });
t('no variant / copy / bak / GENERATOR entries', bad.length === 0, bad.map(b => b.lpUrl).join(', '));
const slugs = reg.map(r => r.slug); t('slugs unique', new Set(slugs).size === slugs.length);
t('exams are type "exam" and colleges are not', reg.filter(r => r.type === 'exam').length > 0 && reg.filter(r => r.type !== 'exam').every(r => ['college', 'online'].includes(r.type)));

// 2. every lpUrl points to an existing folder with index.html (fixture) / is on the site origin (live)
if (LIVE) {
  t('every college has an https official website', reg.filter(r => r.type !== 'exam').every(r => /^https:\/\//.test(r.website || '')));
  t('no entry links to getyourcollege.co (lpUrl removed)', reg.every(r => !r.lpUrl) && !/getyourcollege\.co/i.test(JSON.stringify(reg)));
  t('no Collegedunia / other aggregator text in data', !/(collegedunia|careers360|shiksha|collegedekho|pagalguy)/i.test(JSON.stringify(reg)));
  t('every gallery image exists and is under 250KB', reg.every(r => (r.gallery || []).every(g => fs.existsSync(path.join(WEB, g)) && fs.statSync(path.join(WEB, g)).size < 250 * 1024)));
  t('every live entry has a name and category', reg.every(r => r.name && r.category));
} else {
const missing = reg.filter(r => { const u = new URL(r.lpUrl); const p = path.join(SRC, decodeURIComponent(u.pathname)); return !fs.existsSync(path.join(p, 'index.html')); });
t('every lpUrl points to an existing folder', missing.length === 0, missing.map(m => m.lpUrl).join(', '));
const nosub = reg.filter(r => r.type !== 'exam' && !fs.existsSync(path.join(SRC, folderOf(r.lpUrl), 'submitLead.php')) && !fs.readdirSync(path.join(SRC, folderOf(r.lpUrl))).some(d => fs.existsSync(path.join(SRC, folderOf(r.lpUrl), d, 'submitLead.php'))));
t('no listed college lacks submitLead.php', nosub.length === 0, nosub.map(n => n.slug).join(', '));
}

// 3. public JSON only has allowed fields
const ALLOWED = ['slug', 'name', 'shortName', 'city', 'category', 'type', 'lpUrl', 'logo', 'fees', 'deadline', 'about', 'courses', 'exams', 'photo', 'programs', 'stats', 'highlights', 'examInfo', 'source', 'website', 'facts', 'gallery', 'sources', 'state', 'country', 'feeMin', 'feeMax', 'deadlines', 'credits', 'expected'];
t('public JSON has only the allowed fields', reg.every(r => Object.keys(r).every(k => ALLOWED.includes(k))));

// 4. no tracking IDs / endpoints / secrets / internal names in the web root
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } })(WEB);
const cfg = fs.readFileSync(path.join(WEB, 'assets/js/config.js'), 'utf8');
const ga4 = (cfg.match(/GA4_ID:\s*'([^']+)'/) || [])[1];
const PATTERNS = [[/\bAW-\d+/, 'Google Ads ID'], [/\bGTM-[A-Z0-9]+/, 'GTM ID'], [/\bUA-\d+-\d+/, 'UA ID'], [/fbq\(|connect\.facebook\.net/, 'Meta pixel'], [/send_to/, 'ad conversion send_to'],
  [/submitLead\.php/, 'real endpoint'], [/__bak_|GENERATOR_SOURCE|_coursefees|_bing\b/, 'internal folder name'], [/smtp|password\s*[:=]|api[_-]?key|secret/i, 'secret keyword']];
const hits = [];
for (const f of files.filter(f => /\.(html|js|json|css|txt|php|htaccess)$|\.htaccess$/.test(f))) {
  const s = fs.readFileSync(f, 'utf8'); const rel = path.relative(WEB, f);
  for (const [re, label] of PATTERNS) if (re.test(s) && !(label === 'secret keyword' && rel === '.htaccess')) hits.push(rel + ': ' + label);
  for (const m of s.match(/\bG-[A-Z0-9]{6,}\b/g) || []) if (m !== ga4) hits.push(rel + ': stray GA id');
}
t('no tracking IDs / endpoints / secrets / internal names in staging web root', hits.length === 0, hits.join('; '));
t('GA4 ID appears only in config.js', !files.some(f => !f.endsWith('config.js') && /\bG-[A-Z0-9]{6,}\b/.test(fs.readFileSync(f, 'utf8'))));
t('forms never reference the real endpoint', !/submitLead/.test(cfg));
t('JS total under 100KB', files.filter(f => f.endsWith('.js')).reduce((n, f) => n + fs.statSync(f).size, 0) < 100 * 1024);
t('noindex: robots.txt, meta tags, X-Robots-Tag', /Disallow: \//.test(fs.readFileSync(path.join(WEB, 'robots.txt'), 'utf8')) && /noindex/.test(fs.readFileSync(path.join(WEB, 'index.html'), 'utf8')) && /X-Robots-Tag/.test(fs.readFileSync(path.join(WEB, '.htaccess'), 'utf8')));
const banned = files.filter(f => /\.html$/.test(f)).filter(f => /98%|42K\+|1,200\+/.test(fs.readFileSync(f, 'utf8')));
t('removed claims (98%, 42K+, 1,200+) absent', banned.length === 0);
t('every logo < 60KB', files.filter(f => /assets[\/\\]logos/.test(f)).every(f => fs.statSync(f).size < 60 * 1024));
t('every photo < 250KB', files.filter(f => /assets[\/\\]photos/.test(f)).every(f => fs.statSync(f).size < 250 * 1024));
console.log(`\n${reg.filter(r => r.type !== 'exam').length} colleges, ${reg.filter(r => r.type === 'exam').length} exams. ${fail ? fail + ' FAILED' : 'All passed'}`);
process.exit(fail ? 1 : 0);
