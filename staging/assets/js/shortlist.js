/* Shortlist store: localStorage "gyc_shortlist_v1" holds ONLY an array of slugs. No cookies, no accounts. */
(function () {
  'use strict';
  var C = window.GYC_CONFIG, G = window.GYC = window.GYC || {};
  var KEY = 'gyc_shortlist_v1', mem = [], listeners = [];

  function clean(a) {
    var out = [];
    if (Array.isArray(a)) a.forEach(function (s) { if (typeof s === 'string' && s && out.indexOf(s) < 0 && out.length < C.MAX_SHORTLIST) out.push(s); });
    return out;
  }
  function read() {
    try { var raw = window.localStorage.getItem(KEY); return raw ? clean(JSON.parse(raw)) : []; }
    catch (e) { return mem.slice(); }
  }
  function write(a) {
    mem = a.slice();
    try { window.localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* storage blocked: stay in memory */ }
  }
  function emit(change) { listeners.forEach(function (fn) { try { fn(read(), change); } catch (e) {} }); }

  var S = G.shortlist = {
    get: read,
    has: function (slug) { return read().indexOf(slug) > -1; },
    add: function (slug) {
      var a = read();
      if (a.indexOf(slug) > -1) return 'exists';
      if (a.length >= C.MAX_SHORTLIST) return 'full';
      a.push(slug); write(a); emit({ type: 'add', slug: slug }); return 'ok';
    },
    remove: function (slug) {
      var a = read(), i = a.indexOf(slug);
      if (i < 0) return;
      a.splice(i, 1); write(a); emit({ type: 'remove', slug: slug });
    },
    prune: function (valid) {            // drop slugs that no longer exist in the registry
      var a = read(), keep = a.filter(function (s) { return valid.indexOf(s) > -1; });
      if (keep.length !== a.length) { write(keep); emit({ type: 'prune' }); }
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  // other tabs (also fires with key === null when storage is cleared)
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) emit({ type: 'external' });
  });
})();
