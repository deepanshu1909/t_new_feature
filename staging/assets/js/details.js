/* "Details" dialog: everything the registry knows about one college. Missing fields are hidden. */
(function () {
  'use strict';
  var G = window.GYC, dlg;
  function row(k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; }
  function open(slug, opener) {
    var c = G.reg && G.reg.bySlug[slug]; if (!c) return;
    if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'modal wide'; dlg.setAttribute('aria-labelledby', 'det-title'); document.body.appendChild(dlg); dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); }); }
    var on = G.shortlist.has(slug);
    dlg.innerHTML = '<form method="dialog" class="x"><button class="close" aria-label="Close">&times;</button></form>' +
      '<div class="det-head" style="background-image:linear-gradient(rgba(31,42,68,.45),rgba(31,42,68,.85)),url(' + G.banner(c) + ')"><div><h2 id="det-title">' + G.esc(c.name) + '</h2><p class="meta light">' + [c.city, c.category].filter(Boolean).map(G.esc).join(' &middot; ') + '</p></div></div>' +
      (c.gallery && c.gallery.length ? '<div class="gallery" aria-label="Photos">' + c.gallery.map(function (g, i) { return '<img src="/' + G.esc(g) + '" alt="' + G.esc(c.name) + ' photo ' + (i + 1) + '" loading="lazy" decoding="async">'; }).join('') + '</div>' : '') +
      (c.about ? '<p class="lead-p">' + G.esc(c.about) + '</p>' : '') +
      (c.stats && c.stats.length ? '<ul class="stat-tiles">' + c.stats.map(function (x) { return '<li><b>' + G.esc(x.value) + '</b><span>' + G.esc(x.label) + '</span></li>'; }).join('') + '</ul>' : '') +
      '<dl class="facts big">' + row('Fees', c.fees && c.fees.value ? G.esc(c.fees.value) + (c.fees.asOf ? ' <small>as of ' + G.esc(c.fees.asOf) + '</small>' : '') : '') + row('Apply by', G.esc(c.deadline || '')) + row('City', G.esc(c.city || '')) + row('Category', G.esc(c.category || '')) + '</dl>' +
      (c.deadlines && c.deadlines.length ? '<h3>Application deadlines</h3><ul class="check-list">' + c.deadlines.map(function (d) { var l = G.daysLeft(d.date); return '<li><b>' + G.esc(d.label) + '</b>: ' + G.esc(G.fmtDate(d.date)) + (d.tentative ? ' (tentative)' : '') + (l >= 0 ? ' &middot; ' + G.leftText(l) : ' &middot; closed') + (d.note ? '<br><small class="muted">' + G.esc(d.note) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      (c.facts && c.facts.length ? '<h3>At a glance</h3><dl class="facts big compact">' + c.facts.map(function (f) { return row(G.esc(f.label), G.esc(f.value)); }).join('') + '</dl>' : '') +
      (c.examInfo && c.examInfo.length ? '<h3>Exam facts</h3><dl class="facts big compact">' + c.examInfo.map(function (f) { return row(G.esc(f.label), G.esc(f.value)); }).join('') + '</dl>' : '') +
      (c.programs && c.programs.length ? '<h3>Courses &amp; fees</h3><div class="table-wrap"><table class="prog-table"><thead><tr><th scope="col">Course</th><th scope="col">Total fees</th><th scope="col">Eligibility</th><th scope="col">Application dates</th></tr></thead><tbody>' + c.programs.map(function (p) {
        return '<tr><th scope="row">' + G.esc(p.course) + '</th><td>' + (p.fees ? G.esc(p.fees) : '<span class="ask">Ask a counsellor</span>') + '</td><td>' + (p.eligibility ? G.esc(p.eligibility) : '&mdash;') + '</td><td>' + (p.dates ? G.esc(p.dates) : '&mdash;') + '</td></tr>' +
          (p.specs && p.specs.length ? '<tr class="spec-row"><td colspan="4"><details><summary>' + p.specs.length + ' specialisations with fees</summary><ul class="spec-list">' + p.specs.map(function (x) { return '<li><span>' + G.esc(x.name) + '</span><b>' + G.esc(x.fee) + '</b></li>'; }).join('') + '</ul></details></td></tr>' : '');
      }).join('') + '</tbody></table></div>' : '') +
      (c.highlights && c.highlights.length ? '<h3>' + (c.type === 'exam' ? 'Key points' : 'Highlights') + '</h3><ul class="check-list">' + c.highlights.map(function (t) { return '<li>' + G.esc(t.replace(/^[\u2022\u2705\s]+/, '')) + '</li>'; }).join('') + '</ul>' : '') +
      (c.exams && c.exams.length ? '<h3>Entrance exams mentioned</h3><ul class="tags">' + c.exams.map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (c.courses && c.courses.length && !(c.programs && c.programs.length) ? '<h3>Programs</h3><ul class="tags">' + c.courses.map(function (t) { return '<li>' + G.esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (c.credits && c.credits.length ? '<p class="muted small">Photos: ' + c.credits.map(function (x) { return '<a href="' + G.esc(x.page) + '" target="_blank" rel="noopener noreferrer">' + G.esc(x.author || 'Wikimedia Commons') + '</a> (' + G.esc(x.license) + ')'; }).join(', ') + ' via Wikimedia Commons.</p>' : '') +
      '<p class="muted small src-note">Fees and dates can change, so ask a counsellor to confirm before you decide.</p>' +
      '<p class="muted small">Missing details? <strong>Ask a counsellor</strong> and we will confirm them for you.</p>' +
      '<div class="card-actions"><button type="button" class="btn" data-d="guide">Open guide</button><button type="button" class="btn ghost" data-d="toggle" aria-pressed="' + on + '">' + (on ? 'Shortlisted' : 'Add to shortlist') + '</button></div>';
    dlg.querySelector('[data-d=guide]').addEventListener('click', function () { dlg.close(); G.openGuide(G.reg, slug, opener); });
    dlg.querySelector('[data-d=toggle]').addEventListener('click', function (e) { var now = G.toggleShortlist(c); e.target.setAttribute('aria-pressed', now); e.target.textContent = now ? 'Shortlisted' : 'Add to shortlist'; });
    dlg.showModal();
  }
  G.showDetails = function (slug, opener) {
    var c = G.reg && G.reg.bySlug[slug]; if (!c) return;
    G.gate(slug, opener, function () { open(slug, opener); }, { title: 'See full details of ' + c.name, sub: 'Register once and everything unlocks: fees, eligibility, dates, exams, photos and more.', cta: 'Unlock full details' });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act=details]'); if (b) G.showDetails(b.closest('.card').getAttribute('data-slug'), b);
  });
})();
