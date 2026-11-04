/* Vercel serverless twin of staging/api/mock-lead.php (demo only).
 * Validates a lead and logs a MASKED line to the Vercel function logs. It never forwards the lead anywhere,
 * so a demo deployment collects nothing. Replace with the real endpoint before launch (see DEPLOY.md). */
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  const reply = (code, success, message) => res.status(code).send(JSON.stringify({ success, message }));
  if (req.method !== 'POST') return reply(405, false, 'Method not allowed');

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const g = k => (typeof body[k] === 'string' ? body[k].trim() : '');

  if (g('website')) return reply(200, true, 'Thank you');                         // honeypot
  if (g('name').length < 2) return reply(422, false, 'Invalid name');
  if (!/^\d{10}$/.test(g('mobile'))) return reply(422, false, 'Invalid mobile');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('email'))) return reply(422, false, 'Invalid email');
  if (g('city').length < 2) return reply(422, false, 'Invalid city');

  console.log(JSON.stringify({
    time: new Date().toISOString(), source: g('source'), college: g('college'), program: g('program'), page: g('page'),
    name: g('name').slice(0, 1) + '***', mobile: '******' + g('mobile').slice(-4), email: g('email').slice(0, 1) + '***@' + g('email').split('@')[1], city: g('city')
  }));
  return reply(200, true, 'Thank you');
};
