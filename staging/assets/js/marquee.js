/* Deadline marquee under the navbar: colleges and exams whose applications close soon (data: deadlines in the registry). */
(function () {
  'use strict';
  var G = window.GYC, host = G.$('#site-header'); if (!host) return;
  G.loadRegistry().then(function (reg) {
    var groups = {};
    reg.colleges.concat(reg.exams).forEach(function (c) {
      (c.deadlines || []).forEach(function (d) {
        var left = G.daysLeft(d.date); if (left < 0) return;
        var k = d.label + '|' + d.date; (groups[k] = groups[k] || { d: d, left: left, list: [] }).list.push(c);
      });
    });
    var arr = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.left - b.left; });
    if (!arr.length) return;
    function item(g) {
      var lead = g.list.filter(function (c) { return c.type === 'exam'; })[0] || g.list[0], extra = g.list.length - 1;
      var name = G.esc(lead.type === 'exam' ? lead.name : lead.shortName && lead.name.length > 34 ? lead.shortName : lead.name) + (extra > 0 ? ' <small>+' + extra + ' more</small>' : '');
      return '<button type="button" class="dl-item' + (g.left <= 30 ? ' urgent' : '') + '" data-slug="' + G.esc(lead.slug) + '"><span class="dl-kind">' + (lead.type === 'exam' ? 'Exam' : 'College') + '</span> <b>' + name + '</b> <span class="dl-label">' + G.esc(g.d.label) + '</span> <span class="dl-date">' + (g.d.tentative ? 'expected ' : 'by ') + G.esc(G.fmtDate(g.d.date)) + '</span> <span class="dl-left">' + G.leftText(g.left) + '</span></button>';
    }
    var html = arr.map(item).join('');
    var dur = Math.max(30, arr.length * 9);
    host.insertAdjacentHTML('afterend', '<div class="deadline-bar" role="region" aria-label="Applications closing soon"><div class="wrap"><span class="dl-title"><i class="live-dot" aria-hidden="true"></i>Closing soon</span><div class="dl-view"><div class="dl-track" style="animation-duration:' + dur + 's">' + html + '<span class="dl-copy" aria-hidden="true">' + html.replace(/<button /g, '<button tabindex="-1" ') + '</span></div></div><button type="button" class="dl-pause" aria-pressed="false" aria-label="Pause scrolling">Pause</button></div></div>');
    var bar = G.$('.deadline-bar'), pb = G.$('.dl-pause', bar);
    pb.addEventListener('click', function () { var p = bar.classList.toggle('paused'); pb.setAttribute('aria-pressed', p); pb.textContent = p ? 'Play' : 'Pause'; pb.setAttribute('aria-label', p ? 'Resume scrolling' : 'Pause scrolling'); });
    bar.addEventListener('click', function (e) { var b = e.target.closest('.dl-item'); if (b && G.showDetails) G.showDetails(b.getAttribute('data-slug'), b); });
  });
})();
