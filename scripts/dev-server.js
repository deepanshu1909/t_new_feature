#!/usr/bin/env node
/* Local static server for staging/ + a JS twin of staging/api/mock-lead.php (PHP is not needed locally).
 *   node scripts/dev-server.js [port]     -> http://localhost:8080
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', 'staging'), PRIV = path.resolve(__dirname, '..', '_private');
const PORT = +process.argv[2] || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webp': 'image/webp' };

function mockLead(req, res) {
  const out = (code, ok, msg) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex' }); res.end(JSON.stringify({ success: ok, message: msg })); };
  if (req.method !== 'POST') return out(405, false, 'Method not allowed');
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    let o = {}; try { o = (req.headers['content-type'] || '').includes('json') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body)); } catch (e) {}
    const g = k => (typeof o[k] === 'string' ? o[k].trim() : '');
    if (g('website')) return out(200, true, 'Thank you');
    if (g('name').length < 2) return out(422, false, 'Invalid name');
    if (!/^\d{10}$/.test(g('mobile'))) return out(422, false, 'Invalid mobile');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email'))) return out(422, false, 'Invalid email');
    if (g('city').length < 2) return out(422, false, 'Invalid city');
    const utm = {}; Object.keys(o).filter(k => k.startsWith('utm_')).forEach(k => utm[k] = o[k]);
    fs.mkdirSync(PRIV, { recursive: true });
    fs.appendFileSync(path.join(PRIV, 'mock-leads.log'), JSON.stringify({ time: new Date().toISOString(), source: g('source'), college: g('college'), program: g('program'), page: g('page'), name: g('name')[0] + '***', mobile: '******' + g('mobile').slice(-4), email: g('email')[0] + '***@' + g('email').split('@')[1], city: g('city'), utm }) + '\n');
    out(200, true, 'Thank you');
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  if (p === '/api/mock-lead.php' || p === '/api/mock-lead') return mockLead(req, res);
  if (p.includes('..') || /\/\.ht/.test(p)) { res.writeHead(403); return res.end('Forbidden'); }
  let f = path.join(ROOT, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'X-Robots-Tag': 'noindex, nofollow' }); res.end(data);
  });
}).listen(PORT, () => console.log('Staging preview: http://localhost:' + PORT));
