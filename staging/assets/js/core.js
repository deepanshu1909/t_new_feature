/* Shared helpers: analytics, registry loading, page chrome, college cards. */
(function () {
  'use strict';
  var C = window.GYC_CONFIG, G = window.GYC = window.GYC || {};

  G.$ = function (s, r) { return (r || document).querySelector(s); };
  G.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  G.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  G.initials = function (name) {
    var w = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
  };
  G.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  /* ---- analytics (GA4 only; never LP ad-conversion tags) ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (/^G-[A-Z0-9]+$/.test(C.GA4_ID) && C.GA4_ID.indexOf('X') < 0) {
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + C.GA4_ID;
    document.head.appendChild(s); gtag('js', new Date()); gtag('config', C.GA4_ID);
    G.gaOn = true;
  }
  G.track = function (name, params) {
    try { if (G.gaOn) gtag('event', name, params || {}); if (C.DEBUG_EVENTS) console.log('[gyc event]', name, params || {}); } catch (e) {}
  };

  /* ---- UTM persistence (sessionStorage, optional) ---- */
  G.utm = function () {
    var out = {}, p = new URLSearchParams(location.search), stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('gyc_utm') || '{}'); } catch (e) {}
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(function (k) {
      var v = p.get(k) || stored[k]; if (v) out[k] = v;
    });
    try { sessionStorage.setItem('gyc_utm', JSON.stringify(out)); } catch (e) {}
    return out;
  };
  G.utm();

  /* ---- registry ---- */
  var regPromise;
  G.loadRegistry = function () {
    if (regPromise) return regPromise;
    regPromise = fetch(C.REGISTRY_URL, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('registry ' + r.status); return r.json(); })
      .then(function (all) {
        var reg = G.reg = { all: all, bySlug: {}, colleges: [], exams: [] };
        all.forEach(function (c) { reg.bySlug[c.slug] = c; (c.type === 'exam' ? reg.exams : reg.colleges).push(c); });
        var az = function (a, b) { return a.name.localeCompare(b.name); };
        reg.colleges.sort(az); reg.exams.sort(az);
        reg.catPhotos = { _all: [] };
        reg.colleges.forEach(function (c) { (c.gallery || []).slice(0, 2).forEach(function (g) { (reg.catPhotos[c.category] = reg.catPhotos[c.category] || []).push(g); reg.catPhotos._all.push(g); }); });
        G.shortlist.prune(reg.colleges.map(function (c) { return c.slug; }));
        return reg;
      });
    return regPromise;
  };
  G.loadFeatured = function () { return fetch(C.FEATURED_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); };
  G.sampleBanner = function () {
    fetch(C.META_URL).then(function (r) { return r.ok ? r.json() : {}; }).then(function (m) {
      if (!m.sample) return;
      var d = document.createElement('div'); d.className = 'sample-banner'; d.setAttribute('role', 'note');
      d.textContent = 'Staging preview using SAMPLE data. Rebuild the registry from a real scan before launch.';
      document.body.insertBefore(d, document.body.firstChild);
    }).catch(function () {});
  };

  /* ---- page chrome ---- */
  G.chrome = function () {
    var hasContact = !!G.$('#contact');
    var contact = hasContact ? '#contact' : '/#contact';
    var path = location.pathname;
    var cur = function (p) { return path.indexOf(p) === 0 ? ' aria-current="page"' : ''; };
    var WA_SVG = '<svg class="wa-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.35-1.66a11.86 11.86 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.15-3.42-8.43zM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1-3.67-.24-.38a9.9 9.9 0 0 1-1.52-5.27c0-5.46 4.45-9.9 9.92-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.45 9.9-9.9 9.9zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>';
    var waAttrs = C.WHATSAPP_URL ? 'href="' + G.esc(C.WHATSAPP_URL) + '" target="_blank" rel="noopener noreferrer"' : 'href="' + contact + '" data-register';
    var h = G.$('#site-header');
    if (h) h.innerHTML =
      '<header class="site-header"><div class="wrap bar">' +
      '<a class="brand" href="/" aria-label="GetYourCollege home">GetYour<span>College</span></a>' +
      '<button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>' +
      '<nav id="main-nav" class="nav" aria-label="Main"><ul>' +
      '<li><a href="/colleges/"' + cur('/colleges/') + '>Colleges</a></li>' +
      '<li><a href="/shortlist/"' + cur('/shortlist/') + '>Shortlist <span class="badge" id="short-count" aria-live="polite" aria-atomic="true">0</span></a></li>' +
      '<li><a href="/#how-it-works">How it works</a></li>' +
      '<li><a href="' + contact + '">Contact</a></li></ul>' +
      '<a class="btn wa" ' + waAttrs + '>' + WA_SVG + '<span>' + G.esc(C.WHATSAPP_LABEL || 'Talk to expert') + '</span></a>' +
      '<a class="btn" href="' + contact + '" data-register>Register now</a></nav></div></header>';
    G.waSvg = WA_SVG;
    if (!G.$('.wa-float')) document.body.insertAdjacentHTML('beforeend', '<a class="wa-float" ' + waAttrs + ' aria-label="' + G.esc(C.WHATSAPP_LABEL || 'Talk to expert') + ' on WhatsApp">' + WA_SVG + '</a>');
    var f = G.$('#site-footer');
    if (f) f.innerHTML =
      '<footer class="site-footer"><div class="wrap">' +
      '<div class="foot-grid"><div><a class="brand" href="/">GetYour<span>College</span></a>' +
      '</div>' +
      '<ul class="foot-links"><li><a href="/colleges/">Colleges</a></li><li><a href="/shortlist/">Shortlist</a></li><li><a href="/#how-it-works">How it works</a></li><li><a href="' + C.POLICY_URL + '">Terms &amp; Privacy</a></li></ul></div>' +
      '<p class="copy">&copy; <span id="year"></span> GetYourCollege. All college names belong to their respective owners.</p></div></footer>';
    var y = G.$('#year'); if (y) y.textContent = new Date().getFullYear();
    var btn = G.$('.menu-btn'), nav = G.$('#main-nav');
    if (btn) btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open);
    });
    var badge = G.$('#short-count');
    var upd = function () { var n = G.shortlist.get().length; if (badge) { badge.textContent = n; badge.setAttribute('aria-label', G.plural(n, 'college', 'colleges') + ' shortlisted'); badge.classList.toggle('zero', !n); } };
    upd(); G.shortlist.onChange(upd);
  };

  /* ---- toast (aria-live) ---- */
  G.say = function (msg) {
    var t = G.$('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  };

  /* ---- dates and fees ---- */
  G.daysLeft = function (iso) { var d = new Date(iso + 'T00:00:00'), t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); };
  G.fmtDate = function (iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  G.leftText = function (n) { return n === 0 ? 'closes today' : n === 1 ? '1 day left' : n + ' days left'; };
  G.fmtFee = function (n) { return n >= 1e7 ? '\u20b9' + (n / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr' : n >= 1e5 ? '\u20b9' + (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' Lakhs' : '\u20b9' + n.toLocaleString('en-IN'); };
  G.FEE_BANDS = [['lt2', 'Under \u20b92 Lakhs', 0, 2e5], ['2-5', '\u20b92 - 5 Lakhs', 2e5, 5e5], ['5-10', '\u20b95 - 10 Lakhs', 5e5, 1e6], ['10-20', '\u20b910 - 20 Lakhs', 1e6, 2e6], ['gt20', 'Above \u20b920 Lakhs', 2e6, Infinity], ['none', 'Fees not listed', 0, 0]];
  G.inFeeBand = function (c, id) {
    var b = G.FEE_BANDS.filter(function (x) { return x[0] === id; })[0]; if (!b) return true;
    if (id === 'none') return !c.feeMin;
    return !!c.feeMin && c.feeMin < b[3] && c.feeMax >= b[2];
  };
  G.nextDeadline = function (c) { var l = (c.deadlines || []).filter(function (d) { return G.daysLeft(d.date) >= 0; }); return l[0] || null; };

  /* ---- college card ---- */
  G.logoHtml = function (c) {
    return c.logo
      ? '<span class="logo"><img src="/' + G.esc(c.logo) + '" alt="" width="48" height="48" loading="lazy" decoding="async"></span>'
      : '<span class="logo ph" aria-hidden="true">' + G.esc(G.initials(c.name)) + '</span>';
  };
  var LOCK = '<svg class="lock-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  G.cardHtml = function (c, o) {
    o = o || {};
    var meta = [c.city, c.category].filter(Boolean).map(G.esc).join(' &middot; ');
    var h = '<article class="card" data-slug="' + G.esc(c.slug) + '">' +
      '<div class="card-banner ' + G.catClass(c) + '"><img src="' + G.esc(G.banner(c)) + '" alt="" width="400" height="160" loading="lazy" decoding="async"></div>' +
      '<div class="card-body"><div class="card-head"><div><h3>' + G.esc(c.name) + '</h3>' + (meta ? '<p class="meta">' + meta + '</p>' : '') + '</div></div>';
    var nd = G.nextDeadline(c);
    if (nd) { var dl = G.daysLeft(nd.date); h += '<p class="close-badge' + (dl <= 30 ? ' urgent' : '') + '"><b>' + (nd.tentative ? 'Expected close ' : 'Closes ') + G.esc(G.fmtDate(nd.date)) + '</b> &middot; ' + G.leftText(dl) + '</p>'; }
    if (c.type === 'exam') {
      if (!nd && c.expected) h += '<p class="close-badge soft"><b>Dates awaited</b> &middot; ' + G.esc(c.expected) + '</p>';
      if (c.about) h += '<p class="about">' + G.esc(c.about) + '</p>';
      if (c.courses && c.courses.length) h += '<ul class="tags" aria-label="For courses">' + c.courses.slice(0, 4).map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('') + '</ul>';
      h += '<button type="button" class="lock-row" data-act="details">' + LOCK + '<span><b>Dates, fees, pattern and eligibility</b><small>Unlock with a free registration</small></span><em>Unlock</em></button>';
      h += '<div class="card-actions"><button type="button" class="btn" data-act="details">Full details</button></div></div></article>';
      return h;
    }
    var on = G.shortlist.has(c.slug);
    if (c.stats && c.stats.length) h += '<ul class="stat-line" aria-label="Key numbers">' + c.stats.filter(function (x) { return /^(students|avg|average|highest|nirf|accredited)/i.test(x.label); }).slice(0, 3).map(function (x) { return '<li><b>' + G.esc(x.value) + '</b> ' + G.esc(x.label) + '</li>'; }).join('') + '</ul>';
    if (c.about) h += '<p class="about">' + G.esc(c.about) + '</p>';
    if (c.courses && c.courses.length) h += '<ul class="tags" aria-label="Programs">' + c.courses.slice(0, 3).map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('') + (c.courses.length > 3 ? '<li class="more">+' + (c.courses.length - 3) + ' more</li>' : '') + '</ul>';
    var np = (c.programs || []).length;
    h += '<button type="button" class="lock-row" data-act="details">' + LOCK + '<span><b>' + (np ? 'Fees, eligibility and dates for ' + np + ' courses' : 'Fees, eligibility and deadlines') + '</b><small>Unlock with a free registration</small></span><em>Unlock</em></button>';
    h += '<div class="card-actions">';
    h += '<button type="button" class="btn" data-act="details">Full details</button>';
    if (o.guide) h += '<button type="button" class="btn ghost" data-act="guide">Talk to a counsellor</button>';
    h += '<button type="button" class="btn ghost" data-act="toggle" aria-pressed="' + on + '">' + (on ? 'Shortlisted' : 'Add to shortlist') + '</button>';
    if (o.remove) h += '<button type="button" class="btn ghost" data-act="remove">Remove</button>';
    h += '</div>';
    if (o.compare !== false) h += '<label class="check"><input type="checkbox" data-act="compare"' + (o.compareOn ? ' checked' : '') + '> Compare</label>';
    return h + '</div></article>';
  };
  var SCENES = { 'design & fashion': 'design' };
  G.sceneKey = function (c) { if (c.type === 'exam') return 'exam'; var k = String(c.category || 'other').toLowerCase(); return SCENES[k] || (['university', 'engineering', 'management', 'law', 'hospitality'].indexOf(k) > -1 ? k : 'other'); };
  G.banner = function (c) {
    if (c.photo) return '/' + c.photo;
    var r = G.reg, arr = r && r.catPhotos && ((r.catPhotos[c.category] || []).length ? r.catPhotos[c.category] : r.catPhotos._all);
    if (arr && arr.length) { var h = 0; for (var i = 0; i < c.slug.length; i++) h = (h * 31 + c.slug.charCodeAt(i)) >>> 0; return '/' + arr[h % arr.length]; }
    return '/assets/img/scene-' + G.sceneKey(c) + '.svg';
  };
  G.catPhoto = function (cat) { var r = G.reg, arr = (r && r.catPhotos && r.catPhotos[cat]) || []; return arr.length ? '/' + arr[0] : '/assets/img/scene-' + G.sceneKey({ category: cat }) + '.svg'; };
  G.catClass = function (c) { return 'cb-' + String(c.type === 'exam' ? 'exam' : c.category).toLowerCase().replace(/[^a-z]+/g, '-'); };
  G.toggleShortlist = function (c) {
    if (!G.unlocked()) {
      G.gate(c.slug, null, function () { G.toggleShortlist(c); G.syncToggles(document); }, { title: 'Register to save ' + c.name, sub: 'Register once to build your shortlist and compare colleges side by side.', cta: 'Register and save' });
      return false;
    }
    if (G.shortlist.has(c.slug)) { G.shortlist.remove(c.slug); G.track('shortlist_remove', { college: c.slug }); return false; }
    var r = G.shortlist.add(c.slug);
    if (r === 'full') { G.say('Your shortlist is full (' + C.MAX_SHORTLIST + ' colleges). Remove one to add another.'); return false; }
    G.track('shortlist_add', { college: c.slug }); return true;
  };
  G.syncToggles = function (root) {
    G.$$('.card', root).forEach(function (card) {
      var b = G.$('[data-act=toggle]', card); if (!b) return;
      var on = G.shortlist.has(card.getAttribute('data-slug'));
      b.setAttribute('aria-pressed', on); b.textContent = on ? 'Shortlisted' : 'Add to shortlist';
    });
  };
  G.fail = function (el, msg) { if (el) el.innerHTML = '<p class="notice" role="alert">' + G.esc(msg) + '</p>'; };

  document.addEventListener('DOMContentLoaded', G.chrome);
})();
