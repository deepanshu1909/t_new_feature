(function () {
  'use strict';
  var C = window.GYC_CONFIG, G = window.GYC;
  var reg, shown = 0, matches = [], compare = [];
  var grid = G.$('#grid'), more = G.$('#more'), status = G.$('#result-status');
  var q = G.$('#q'), cat = G.$('#cat'), city = G.$('#city'), state = G.$('#state'), fee = G.$('#fee'), sort = G.$('#sort');

  function params() {
    var p = new URLSearchParams(location.search);
    q.value = p.get('q') || ''; cat.value = p.get('category') || ''; state.value = p.get('state') || ''; cityOptions(); city.value = p.get('city') || ''; fee.value = p.get('fee') || ''; sort.value = p.get('sort') || '';
  }
  function cityOptions() {
    var cities = {}; reg.colleges.forEach(function (c) { if (c.city && (!state.value || c.state === state.value)) cities[c.city] = 1; });
    var keep = city.value;
    city.innerHTML = '<option value="">All cities</option>' + Object.keys(cities).sort().map(function (c) { return '<option>' + G.esc(c) + '</option>'; }).join('');
    city.value = cities[keep] ? keep : '';
  }
  function filter() {
    var t = q.value.trim().toLowerCase();
    matches = reg.colleges.filter(function (c) {
      return (!t || c.name.toLowerCase().indexOf(t) > -1 || (c.city || '').toLowerCase().indexOf(t) > -1) &&
        (!cat.value || c.category === cat.value) && (!state.value || c.state === state.value) && (!city.value || c.city === city.value) && (!fee.value || G.inFeeBand(c, fee.value));
    });
    if (sort.value === 'fee') matches.sort(function (a, b) { return (a.feeMin || 1e12) - (b.feeMin || 1e12) || a.name.localeCompare(b.name); });
    else if (sort.value === 'closing') matches.sort(function (a, b) { var x = G.nextDeadline(a), y = G.nextDeadline(b); return (x ? x.date : '9999').localeCompare(y ? y.date : '9999') || a.name.localeCompare(b.name); });
    shown = 0; grid.innerHTML = ''; page();
    var ex = reg.exams.filter(function (c) { return !t || c.name.toLowerCase().indexOf(t) > -1; });
    G.$('#exams').hidden = !ex.length || !!(cat.value || city.value || state.value || fee.value);
    G.$('#exam-grid').innerHTML = ex.map(function (c) { return G.cardHtml(c); }).join('');
    var u = new URLSearchParams(); if (q.value.trim()) u.set('q', q.value.trim()); if (cat.value) u.set('category', cat.value); if (state.value) u.set('state', state.value); if (city.value) u.set('city', city.value); if (fee.value) u.set('fee', fee.value); if (sort.value) u.set('sort', sort.value);
    try { history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '')); } catch (e) {}
  }
  function page() {
    var next = matches.slice(shown, shown + C.BATCH);
    grid.insertAdjacentHTML('beforeend', next.map(function (c) { return G.cardHtml(c, { compareOn: compare.indexOf(c.slug) > -1 }); }).join(''));
    shown += next.length;
    more.hidden = shown >= matches.length;
    status.textContent = matches.length ? 'Showing ' + shown + ' of ' + G.plural(matches.length, 'college', 'colleges') : 'No colleges match your search. Try clearing a filter.';
  }
  function bar() {
    var b = G.$('#compare-bar'); b.hidden = !compare.length;
    G.$('#compare-n').textContent = G.plural(compare.length, 'college', 'colleges') + ' selected';
    var go = G.$('#compare-go');
    go.setAttribute('aria-disabled', compare.length < 2);
    go.href = compare.length < 2 ? '#' : '/shortlist/?compare=' + encodeURIComponent(compare.join(','));
  }

  G.loadRegistry().then(function (r) {
    reg = r;
    var cats = {}, cities = {};
    reg.colleges.forEach(function (c) { cats[c.category] = 1; if (c.city) cities[c.city] = 1; });
    cat.innerHTML = '<option value="">All categories</option>' + Object.keys(cats).sort().map(function (c) { return '<option>' + G.esc(c) + '</option>'; }).join('');
    var states = {}; reg.colleges.forEach(function (c) { if (c.state) states[c.state] = (states[c.state] || 0) + 1; });
    state.innerHTML = '<option value="">All locations</option>' + Object.keys(states).sort().map(function (c) { return '<option value="' + G.esc(c) + '">' + G.esc(c) + ' (' + states[c] + ')</option>'; }).join('');
    fee.innerHTML = '<option value="">Any budget</option>' + G.FEE_BANDS.map(function (b) { return '<option value="' + b[0] + '">' + b[1] + ' (' + reg.colleges.filter(function (c) { return G.inFeeBand(c, b[0]); }).length + ')</option>'; }).join('');
    city.innerHTML = '<option value="">All cities</option>' + Object.keys(cities).sort().map(function (c) { return '<option>' + G.esc(c) + '</option>'; }).join('');
    G.$$('[data-count]').forEach(function (el) { el.textContent = reg.colleges.length + ' colleges listed'; });
    params(); filter();
    G.contactForm(G.$('#contact-form'), reg);
  }).catch(function () { G.fail(grid, 'We could not load the college list. Please refresh the page.'); });

  var tm; q.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(filter, 150); });
  cat.addEventListener('change', filter); city.addEventListener('change', filter); fee.addEventListener('change', filter); sort.addEventListener('change', filter); state.addEventListener('change', function () { cityOptions(); filter(); });
  G.$('#filters').addEventListener('submit', function (e) { e.preventDefault(); filter(); });
  more.addEventListener('click', page);

  document.addEventListener('click', function (e) {
    var go = e.target.closest('#compare-go'); if (go && compare.length < 2) { e.preventDefault(); G.say('Select at least 2 colleges to compare.'); }
    var b = e.target.closest('[data-act=toggle]'); if (!b || !reg) return;
    G.toggleShortlist(reg.bySlug[b.closest('.card').getAttribute('data-slug')]); G.syncToggles(grid);
  });
  document.addEventListener('change', function (e) {
    var k = e.target.closest('[data-act=compare]'); if (!k) return;
    var slug = k.closest('.card').getAttribute('data-slug'), i = compare.indexOf(slug);
    if (k.checked && !G.unlocked()) {
      k.checked = false;
      G.gate(slug, null, function () { k.checked = true; k.dispatchEvent(new Event('change', { bubbles: true })); }, { title: 'Register to compare colleges', sub: 'Compare fees, eligibility, dates and exams side by side. Register once and it unlocks.', cta: 'Register and compare' });
      return;
    }
    if (k.checked) {
      if (compare.length >= C.MAX_COMPARE) { k.checked = false; G.say('You can compare up to ' + C.MAX_COMPARE + ' colleges.'); return; }
      compare.push(slug);
    } else if (i > -1) compare.splice(i, 1);
    bar();
  });
  G.shortlist.onChange(function () { if (reg) G.syncToggles(grid); });
})();
