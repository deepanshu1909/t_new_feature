#!/usr/bin/env node
/* Generates a FAKE public_html tree (scripts/fixture/public_html) to exercise build-registry.js.
 * Content is placeholder text only: no real fees, deadlines or claims. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'fixture', 'public_html');
fs.rmSync(path.join(__dirname, 'fixture'), { recursive: true, force: true });

const zlib = require('zlib');
function bigPng(w, h) { // real gradient PNG (>3KB) so the photo path can be tested
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = (x * 7 + (x * y) % 31) & 255; raw[i + 1] = (y * 9 + (x ^ y)) & 255; raw[i + 2] = ((x * y) >> 2) & 255; } }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xFFFFFFFF; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; };
  const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SUBMIT = '<?php\n$name = $_POST["name"]; $mobile = $_POST["mobile"]; $email = $_POST["email"]; $city = $_POST["city"]; $college = $_POST["college"];\necho json_encode(["success" => true, "message" => "Thank you"]);\n';

const UNI = 'Programs: B.Tech, MBA, BBA, LLB, design and more.';
const ENG = 'B.Tech Computer Science, B.Tech Mechanical, B.Tech Civil, engineering labs.';
const MGT = 'MBA and PGDM programs, management, BBA.';
function EXAMS_P(b) { return b === ENG ? '<p>Accepted entrance exams: JEE Main, BITSAT.</p>' : b === MGT ? '<p>Accepted entrance exams: CAT, MAT, CMAT.</p>' : b === UNI ? '<p>Accepted entrance exams: CUET, JEE Main.</p>' : ''; }
function w(rel, content) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
function lp(folder, o = {}) {
  const sub = o.sub || '';
  const dir = folder + (sub ? '/' + sub : '');
  const C = { [UNI]: ['B.Tech', 'MBA', 'BBA', 'LLB', 'B.Des', 'BCA'], [ENG]: ['B.Tech Computer Science', 'B.Tech Mechanical', 'B.Tech Civil', 'M.Tech'], [MGT]: ['MBA', 'PGDM', 'BBA'] };
  const courses = o.courses || C[o.body] || (o.body && /Hotel/.test(o.body) ? ['BHM Hotel Management', 'Culinary Arts'] : /Design/.test(o.body || '') ? ['B.Des Fashion Design', 'B.Des Communication Design'] : /LLB/.test(o.body || '') ? ['BA LLB', 'LLB', 'LLM'] : []);
  const html = `<!doctype html><html><head><title>${o.title}</title><meta name="description" content="Sample description. The real text is read from the college's own landing page during the scan.">${o.ga ? '<script async src="https://www.googletagmanager.com/gtag/js?id=G-FIXTURE01"></script>' : ''}</head><body>` +
    `${o.logo ? '<img class="logo" src="logo.png" alt="">' : ''}${o.photo ? '<img src="campus.png" alt="">' : ''}<h1>${o.h1 || o.title}</h1><p>${o.body || 'Placeholder content.'}</p>${EXAMS_P(o.body)}${courses.length ? '<h2>Programs offered</h2><ul>' + courses.map(c => '<li>' + c + '</li>').join('') + '</ul>' : ''}</body></html>`;
  w(dir + '/index.html', html);
  if (o.logo) w(dir + '/logo.png', PNG);
  if (o.photo) w(dir + '/campus.png', bigPng(64, 64));
  if (o.submit !== false) w(folder + '/submitLead.php', SUBMIT);
}

lp('ChristUniversityBangalore_2026', { title: 'Christ University Bangalore | Admission 2026', body: UNI, ga: 1, logo: 1 });
lp('christuniversitybangalore_2026_v2', { title: 'Christ University Bangalore | Admission 2026', body: UNI, ga: 1 });
lp('christuniversitybangalore_2026_bing', { title: 'Christ University Bangalore', body: UNI, ga: 1 });
lp('ChristUniversityBangalore_2026_copy', { title: 'Christ University Bangalore', body: UNI });
lp('ChristUniversityBangalore_2026__bak_0301', { title: 'Christ University Bangalore', body: UNI });
lp('GENERATOR_SOURCE_main', { title: 'Template', body: UNI });
lp('NMIMS2026', { title: 'NMIMS | Admission 2026', body: MGT });
lp('nmimsmumbai', { title: 'NMIMS Mumbai | Admission 2026', body: MGT, ga: 1 });
lp('alliance2026', { title: 'Alliance University | Admission 2026', body: UNI });
lp('alliance-university-2027', { title: 'Alliance University | Admission 2027', body: UNI, ga: 1 });
lp('allianceuniversitybangalore', { title: 'Alliance University Bangalore', body: UNI });
lp('JainLp', { sub: 'JU/2026', title: 'Jain University | Admission 2026', body: UNI });
lp('JainUniversity2026', { title: 'Jain University | Admission 2026', body: UNI, ga: 1 });
lp('jain_tech_2026', { title: 'Jain Tech | Admission 2026', body: ENG });
lp('amityjaipur_2026', { title: 'Amity University Jaipur | Admission 2026', body: UNI, logo: 1, photo: 1 });
lp('amitymumbai_2026', { title: 'Amity University Mumbai | Admission 2026', body: UNI });
lp('amityonline_2026', { title: 'Amity Online | Admission 2026', body: UNI });
lp('spjimr_2026', { title: 'SPJIMR | Admission 2026', body: MGT });
lp('SPJIMR2026', { title: 'SPJIMR PGDM | Admission 2026', body: MGT });
lp('csmu_2026', { title: 'Home', body: 'Welcome.' });
lp('dcrust_2026', { title: 'Document', body: ENG });
lp('upes_2026_cd', { title: 'UPES', body: ENG });
lp('gitam2026', { title: 'GITAM | Admission 2026', body: UNI });
lp('gitamhyderabad_2026', { title: 'GITAM Hyderabad | Admission 2026', body: UNI });
lp('iihm_mumbai_2026_v2', { title: 'IIHM Mumbai | Admission 2026', body: 'Hotel management and hospitality degrees, culinary arts.' });
lp('indianinstituteofhospitalityandmanagementmumbai', { title: 'Indian Institute of Hospitality and Management Mumbai', body: 'Hotel management and hospitality degrees, culinary arts.' });
lp('sidpune_2027', { title: 'Symbiosis Institute of Design | Admission 2027', body: 'Design and fashion design programs. Design studio.' });
lp('SymbiosisInstituteOfDesign_2026', { title: 'Symbiosis Institute of Design | Admission 2026', body: 'Design and fashion design programs. Design studio.' });
lp('isbr-2027', { title: 'ISBR | Admission 2027', body: MGT });
lp('isbr_2027_v2', { title: 'ISBR | Admission 2027', body: MGT });
lp('KccInstituteOfLaw_2026', { title: 'KCC Institute of Law | Admission 2026', body: 'LLB, BA LLB, law moot court, law library, LLM.' });
// sample-only fictional institute: the single place a fee and deadline are stated, to test extraction
lp('sampletestinstitute_2026', { title: 'Sample Test Institute | Admission 2026', body: 'MBA program fees: INR 1,00,000 for the 2026 batch. Last date to apply: 15 March 2026. MBA, PGDM, BBA, management.', logo: 1 });
lp('NoSubmitCollege_2026', { title: 'No Submit College', body: UNI, submit: false });
w('NoIndexFolder/readme.txt', 'x');
for (const e of ['neet_mock_test', 'nift_registration', 'viteee-registration', 'viteee_slot_booking_2026'])
  lp(e, { title: e.replace(/[_-]/g, ' ') + ' | 2026', body: 'Exam tool.', submit: false });
w('submitLead.php', SUBMIT);
w('index.html', '<a href="/ChristUniversityBangalore_2026/">x</a><a href="https://getyourcollege.co/KccInstituteOfLegal_2026/">y</a><a href="/ShooliniUniversitySolan_2026/">z</a><a href="/amityjaipur_2026/">a</a>');
console.log('Fixture written to', ROOT);
