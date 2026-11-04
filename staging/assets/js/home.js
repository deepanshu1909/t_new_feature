(function () {
  'use strict';
  var G = window.GYC, C = window.GYC_CONFIG;
  var ORDER = ['University', 'Engineering', 'Management', 'Law', 'Design & Fashion', 'Hospitality', 'Other'];
  Promise.all([G.loadRegistry(), G.loadFeatured()]).then(function (res) {
    var reg = res[0], feat = res[1], n = reg.colleges.length;
    G.$$('[data-count]').forEach(function (el) { el.textContent = n + ' colleges listed'; });

    var cats = {}; reg.colleges.forEach(function (c) { cats[c.category] = (cats[c.category] || 0) + 1; });
    var list = ORDER.filter(function (c) { return cats[c]; });
    G.$('#chips').innerHTML = list.map(function (c) { return '<a class="chip" href="/colleges/?category=' + encodeURIComponent(c) + '">' + G.esc(c) + '</a>'; }).join('');
    var cg = G.$('#cat-grid');
    if (cg) cg.innerHTML = list.map(function (c) {
      return '<a class="cat-card" href="/colleges/?category=' + encodeURIComponent(c) + '"><img src="' + G.esc(G.catPhoto(c)) + '" alt="" width="400" height="160" loading="lazy"><span class="cat-name">' + G.esc(c) + '</span><span class="cat-n">' + G.plural(cats[c], 'college', 'colleges') + '</span></a>';
    }).join('');

    /* hero collage: four photos, all the same size */
    var cp = G.$('#collage');
    if (cp) {
      var pics = ['christ-university-bangalore', 'bits-pilani-dubai', 'nift-bhopal', 'alliance'].map(function (k) { return reg.bySlug[k]; }).filter(function (c) { return c && c.photo; }).slice(0, 4);
      cp.innerHTML = pics.map(function (c, i) { return '<img src="/' + G.esc(c.photo) + '" alt="" width="640" height="480"' + (i > 1 ? ' loading="lazy"' : '') + '>'; }).join('');
    }

    /* featured colleges */
    var fs = feat.map(function (s) { return reg.bySlug[s]; }).filter(function (c) { return c && c.type !== 'exam'; }).slice(0, 8);
    var box = G.$('#featured-grid');
    if (!fs.length) G.$('#featured').hidden = true;
    else {
      box.innerHTML = fs.map(function (c) { return G.cardHtml(c, { compare: false }); }).join('');
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act=toggle]'); if (!b) return;
        G.toggleShortlist(reg.bySlug[b.closest('.card').getAttribute('data-slug')]); G.syncToggles(box);
      });
      G.shortlist.onChange(function () { G.syncToggles(box); });
    }

    /* closing soon: dated items first (soonest), then exams whose dates are still awaited */
    var rows = [], seen = {};
    reg.exams.concat(reg.colleges).forEach(function (c) {
      var d = G.nextDeadline(c), kind = c.type === 'exam' ? 'exam' : 'college';
      if (d) { var k = d.label + d.date; if (seen[k]) return; seen[k] = 1; rows.push({ c: c, d: d, left: G.daysLeft(d.date), kind: kind }); }
      else if (c.expected) rows.push({ c: c, exp: c.expected, left: 99999, kind: 'exam' });
    });
    rows.sort(function (a, b) { return a.left - b.left; });
    var filt = 'all', row = G.$('#closing-row');
    function drawRow() {
      var shown = rows.filter(function (x) { return filt === 'all' || x.kind === filt; });
      row.innerHTML = shown.map(function (x) {
        var c = x.c, pill, line;
        if (x.exp) { pill = '<span class="close-pill soft">EXPECTED &middot; DATES AWAITED</span>'; line = '<p class="close-date soft">' + G.esc(x.exp) + '</p>'; }
        else { pill = '<span class="close-pill' + (x.left <= 30 ? ' urgent' : '') + '">' + (x.d.tentative ? 'EXPECTED' : 'LIVE') + ' &middot; ' + G.leftText(x.left).toUpperCase() + '</span>'; line = '<p class="close-date">' + (x.d.tentative ? 'Expected ' : 'Closes ') + G.esc(G.fmtDate(x.d.date)) + '</p>'; }
        var tags = (c.courses || []).slice(0, 3).map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('');
        return '<article class="close-card">' + pill + '<span class="close-kind">' + (x.kind === 'exam' ? 'National exam' : 'College') + '</span><h3>' + G.esc(c.name) + '</h3><p class="muted small">' + G.esc(x.d ? x.d.label : (c.about || '').split('. ')[0]) + '</p>' + line + (tags ? '<ul class="tags dark">' + tags + '</ul>' : '') + '<div class="card-actions"><button type="button" class="btn small ghost" data-slug="' + G.esc(c.slug) + '" data-act="soon-details">Full details</button><button type="button" class="btn small" data-slug="' + G.esc(c.slug) + '" data-act="soon-apply">Register now</button></div></article>';
      }).join('');
    }
    if (rows.length) {
      var ne = rows.filter(function (x) { return x.kind === 'exam'; }).length;
      G.$('#closing-pills').innerHTML = [['all', 'All (' + rows.length + ')'], ['exam', 'Exams (' + ne + ')'], ['college', 'Colleges (' + (rows.length - ne) + ')']].map(function (p) { return '<button type="button" class="pill' + (p[0] === 'all' ? ' on' : '') + '" data-f="' + p[0] + '" aria-pressed="' + (p[0] === 'all') + '">' + p[1] + '</button>'; }).join('');
      drawRow(); G.$('#closing-soon').hidden = false;
      G.$('#closing-pills').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; filt = b.getAttribute('data-f'); G.$$('.pill', this).forEach(function (p) { var on = p === b; p.classList.toggle('on', on); p.setAttribute('aria-pressed', on); }); drawRow(); row.scrollLeft = 0; });
      G.$('#close-prev').addEventListener('click', function () { row.scrollBy({ left: -320, behavior: 'smooth' }); });
      G.$('#close-next').addEventListener('click', function () { row.scrollBy({ left: 320, behavior: 'smooth' }); });
      row.addEventListener('click', function (e) { var b = e.target.closest('[data-slug]'); if (!b) return; if (b.getAttribute('data-act') === 'soon-details') G.showDetails(b.getAttribute('data-slug'), b); else G.openGuide(G.reg, b.getAttribute('data-slug'), b); });
    }

    /* budget tiles + location photo tiles */
    G.$('#fee-chips').innerHTML = G.FEE_BANDS.filter(function (b) { return b[0] !== 'none'; }).map(function (b, i) {
      var k = reg.colleges.filter(function (c) { return G.inFeeBand(c, b[0]); }).length;
      return k ? '<a class="budget-tile t' + i + '" href="/colleges/?fee=' + b[0] + '"><span class="b-rs" aria-hidden="true">&#8377;</span><b>' + b[1] + '</b><span>' + G.plural(k, 'college', 'colleges') + '</span></a>' : '';
    }).join('');
    var sc = {}; reg.colleges.forEach(function (c) { if (c.state) sc[c.state] = (sc[c.state] || 0) + 1; });
    var states = Object.keys(sc).filter(function (k) { return k !== 'Pan-India'; }).sort(function (a, b) { return sc[b] - sc[a]; });
    var withPhoto = function (k) { return reg.colleges.filter(function (c) { return c.state === k && c.photo && c.slug !== 'aidtm' && c.slug !== 'ibi'; })[0]; };
    var top = states.filter(function (k) { return withPhoto(k); }).slice(0, 8);
    G.$('#state-tiles').innerHTML = top.map(function (k) {
      var c = withPhoto(k), cities = {}; reg.colleges.forEach(function (x) { if (x.state === k && x.city) cities[x.city] = 1; });
      return '<a class="loc-tile" href="/colleges/?state=' + encodeURIComponent(k) + '"><img src="/' + G.esc(c.photo) + '" alt="" loading="lazy" width="400" height="300"><span><b>' + G.esc(k) + '</b><small>' + G.plural(sc[k], 'college', 'colleges') + ' &middot; ' + G.esc(Object.keys(cities).slice(0, 2).join(', ')) + '</small></span></a>';
    }).join('');
    G.$('#state-chips').innerHTML = states.filter(function (k) { return top.indexOf(k) < 0; }).map(function (k) { return '<a class="chip" href="/colleges/?state=' + encodeURIComponent(k) + '">' + G.esc(k) + ' <small>(' + sc[k] + ')</small></a>'; }).join('');

    /* how it works photo */
    var hp = G.$('#how-photo');
    if (hp) {
      var hc = reg.bySlug['nirma-university-ahmedabad'] || reg.bySlug['christ-university-bangalore'], g = hc && hc.gallery && (hc.gallery[2] || hc.gallery[0]);
      if (g) hp.innerHTML = '<img src="/' + G.esc(g) + '" alt="" loading="lazy" width="640" height="480"><div class="how-card"><b>Register once</b><span>Fees, eligibility, deadlines and exams for every college unlock.</span></div>';
    }
    /* FAQ help card: WhatsApp (needs the link later) + register */
    var fa = G.$('#faq-actions');
    if (fa) fa.innerHTML = '<a class="btn wa" ' + (C.WHATSAPP_URL ? 'href="' + G.esc(C.WHATSAPP_URL) + '" target="_blank" rel="noopener noreferrer"' : 'href="#contact" data-register') + '>' + G.waSvg + '<span>' + G.esc(C.WHATSAPP_LABEL || 'Talk to expert') + '</span></a><a class="btn light" href="#contact" data-register>Register now</a>';

    /* exams on the home page: dated first, then awaited */
    var ex = reg.exams.slice().sort(function (a, b) { var x = G.nextDeadline(a), y = G.nextDeadline(b); return (x ? x.date : '9999').localeCompare(y ? y.date : '9999') || a.name.localeCompare(b.name); }).slice(0, 8);
    var eg = G.$('#exams-grid');
    if (ex.length) { eg.innerHTML = ex.map(function (c) { return G.cardHtml(c); }).join(''); G.$('#exams-home').hidden = false; }

    var cities = {}; reg.colleges.forEach(function (c) { if (c.city) cities[c.city] = 1; });
    var st = [[n, 'colleges listed'], [list.length, 'categories'], [Object.keys(cities).length, 'cities'], [reg.exams.length, 'exams and tools']].filter(function (x) { return x[0]; });
    G.$('#stats').innerHTML = st.map(function (x) { return '<li><strong>' + x[0] + '</strong><span>' + x[1] + '</span></li>'; }).join('');
    G.contactForm(G.$('#contact-form'), reg);
  }).catch(function () { G.fail(G.$('#contact-form'), 'We could not load the college list. Please refresh the page.'); });

  G.$('#hero-search').addEventListener('submit', function (e) {
    e.preventDefault(); var q = G.$('#hero-q').value.trim();
    location.href = '/colleges/' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
})();
