(function () {
  'use strict';
  var C = window.GYC_CONFIG, G = window.GYC;
  var reg, sel = [], tracked = false;
  var list = G.$('#saved'), wrap = G.$('#compare-wrap'), empty = G.$('#empty'), cmp = G.$('#compare');

  function initSel() {
    var p = new URLSearchParams(location.search).get('compare');
    sel = p ? p.split(',').filter(function (s) { return reg.bySlug[s] && reg.bySlug[s].type !== 'exam'; }).slice(0, C.MAX_COMPARE) : [];
    if (!p) sel = G.shortlist.get().slice(0, C.MAX_COMPARE);
  }
  function saveSel() {
    try { history.replaceState(null, '', location.pathname + (sel.length ? '?compare=' + encodeURIComponent(sel.join(',')) : '')); } catch (e) {}
  }
  var ASK = '<span class="ask">Ask a counsellor</span>';
  function cell(v) { return v ? G.esc(v) : ASK; }
  function tags(a, n) { return a && a.length ? '<ul class="tags">' + a.slice(0, n).map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('') + (a.length > n ? '<li class="more">+' + (a.length - n) + '</li>' : '') + '</ul>' : ASK; }
  function renderTable() {
    var items = sel.map(function (s) { return reg.bySlug[s]; }).filter(Boolean);
    wrap.hidden = items.length < 2;
    G.$('#compare-hint').textContent = items.length < 2 ? 'Tick Compare on at least 2 saved colleges to see them side by side (up to ' + C.MAX_COMPARE + ').' : '';
    if (items.length < 2) { cmp.innerHTML = ''; return; }
    var rows = [
      ['Programs offered', function (c) { return tags(c.courses, 6) + '<small class="asof">Examples from this college\'s page.</small>'; }],
      ['At a glance', function (c) { var f = (c.facts || []).slice(0, 7); return f.length ? '<ul class="mini-fees">' + f.map(function (x) { return '<li><span>' + G.esc(x.label) + '</span><b>' + G.esc(x.value) + '</b></li>'; }).join('') + '</ul>' : ASK; }],
      ['Key numbers', function (c) { return c.stats && c.stats.length ? '<ul class="mini-stats">' + c.stats.slice(0, 6).map(function (x) { return '<li><b>' + G.esc(x.value) + '</b> ' + G.esc(x.label) + '</li>'; }).join('') + '</ul>' : ASK; }],
      ['Course-wise fees', function (c) { return c.programs && c.programs.length ? '<ul class="mini-fees">' + c.programs.slice(0, 6).map(function (p) { return '<li><span>' + G.esc(p.course) + '</span><b>' + (p.fees ? G.esc(p.fees) : 'Ask') + '</b></li>'; }).join('') + (c.programs.length > 6 ? '<li class="more">+' + (c.programs.length - 6) + ' more in Full details</li>' : '') + '</ul>' : ASK; }],
      ['Eligibility', function (c) { var e = (c.programs || []).filter(function (p) { return p.eligibility; }).slice(0, 4); return e.length ? '<ul class="mini-fees">' + e.map(function (p) { return '<li><span>' + G.esc(p.course) + '</span><b>' + G.esc(p.eligibility) + '</b></li>'; }).join('') + '</ul>' : ASK; }],
      ['Application dates', function (c) { var e = (c.programs || []).filter(function (p) { return p.dates; }).slice(0, 4); return e.length ? '<ul class="mini-fees">' + e.map(function (p) { return '<li><span>' + G.esc(p.course) + '</span><b>' + G.esc(p.dates) + '</b></li>'; }).join('') + '</ul>' : cell(c.deadline); }],
      ['Highlights', function (c) { return c.highlights && c.highlights.length ? '<ul class="mini-hl">' + c.highlights.slice(0, 3).map(function (t) { return '<li>' + G.esc(t.replace(/^[\u2022\u2705\s]+/, '')) + '</li>'; }).join('') + '</ul>' : ASK; }],
      ['Fees', function (c) { return c.fees && c.fees.value ? '<span class="big">' + G.esc(c.fees.value) + '</span>' + (c.fees.asOf ? '<small class="asof">As of ' + G.esc(c.fees.asOf) + '</small>' : '') : ASK; }],
      ['Entrance exams', function (c) { return tags(c.exams, 6); }],
      ['Location', function (c) { return cell([c.city, c.type === 'online' ? 'Online' : ''].filter(Boolean).join(' · ')); }],
      ['Category', function (c) { return cell(c.category); }],
      ['Explore further', function (c) { return '<div class="stack"><button type="button" class="btn small" data-guide="' + G.esc(c.slug) + '">Open guide</button><button type="button" class="btn small ghost" data-act2="details" data-slug2="' + G.esc(c.slug) + '">Full details</button><button type="button" class="btn small ghost" data-guide="' + G.esc(c.slug) + '">Talk to a counsellor</button></div>'; }]
    ];
    var h = '<table><caption class="sr">College comparison</caption><thead><tr><th scope="col">Compare</th>' +
      items.map(function (c) { return '<th scope="col"><span class="col-name">' + G.esc(c.name) + '</span></th>'; }).join('') + '</tr>' +
      '<tr class="pics"><th scope="row" class="sr">Photo</th>' + items.map(function (c) { return '<td><img src="' + G.esc(G.banner(c)) + '" alt="" width="400" height="160" loading="lazy"></td>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { var cells = items.map(function (c) { return r[1](c); }); if (r[0] !== 'Explore further' && cells.every(function (x) { return x === ASK; })) return; h += '<tr><th scope="row">' + r[0] + '</th>' + cells.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; });
    cmp.innerHTML = h + '</tbody></table><p class="foot-note">Details come from each college\'s own landing page. Fees and dates can change, so ask a counsellor to confirm before you decide.</p>';
    if (!tracked) { tracked = true; G.track('compare_open', { count: items.length }); }
  }
  function render() {
    var slugs = G.shortlist.get().filter(function (s) { return reg.bySlug[s]; });
    sel = sel.filter(function (s) { return slugs.indexOf(s) > -1 || new URLSearchParams(location.search).get('compare'); });
    G.$('#saved-count').textContent = G.plural(slugs.length, 'college', 'colleges') + ' saved';
    empty.hidden = slugs.length > 0 || sel.length > 0;
    list.innerHTML = slugs.map(function (s) { return G.cardHtml(reg.bySlug[s], { guide: true, remove: true, compareOn: sel.indexOf(s) > -1 }); }).join('');
    renderTable();
    var ex = G.$('#exam-grid'); if (ex) { ex.innerHTML = reg.exams.map(function (c) { return G.cardHtml(c); }).join(''); G.$('#exam-sec').hidden = !reg.exams.length; }
  }

  G.loadRegistry().then(function (r) { reg = r; initSel(); render(); }).catch(function () { G.fail(list, 'We could not load the college list. Please refresh the page.'); });

  document.addEventListener('click', function (e) {
    if (!reg) return;
    var dd = e.target.closest('[data-act2=details]');
    if (dd) { var d = G.$('.card[data-slug="' + dd.getAttribute('data-slug2') + '"]') || { getAttribute: function () { return dd.getAttribute('data-slug2'); } }; return G.showDetails(dd.getAttribute('data-slug2'), dd); }
    var g = e.target.closest('[data-guide]');
    if (g) return G.openGuide(reg, g.getAttribute('data-guide'), g);
    var b = e.target.closest('[data-act]'); if (!b) return;
    var slug = b.closest('.card').getAttribute('data-slug');
    if (b.getAttribute('data-act') === 'guide') G.openGuide(reg, slug, b);
    if (b.getAttribute('data-act') === 'remove') { G.shortlist.remove(slug); G.track('shortlist_remove', { college: slug }); sel = sel.filter(function (s) { return s !== slug; }); saveSel(); render(); }
    if (b.getAttribute('data-act') === 'toggle') { G.toggleShortlist(reg.bySlug[slug]); render(); }
  });
  document.addEventListener('change', function (e) {
    var k = e.target.closest('[data-act=compare]'); if (!k) return;
    var slug = k.closest('.card').getAttribute('data-slug'), i = sel.indexOf(slug);
    if (k.checked) {
      if (sel.length >= C.MAX_COMPARE) { k.checked = false; G.say('You can compare up to ' + C.MAX_COMPARE + ' colleges.'); return; }
      sel.push(slug);
    } else if (i > -1) sel.splice(i, 1);
    saveSel(); renderTable();
  });
  G.shortlist.onChange(function () { if (reg) render(); });
})();
