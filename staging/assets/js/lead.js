/* Lead flow: registration pop-up (gate + "Register now"), inline contact forms, submit. */
(function () {
  'use strict';
  var C = window.GYC_CONFIG, G = window.GYC;

  var COURSES = ['B.Tech / B.E.', 'M.Tech', 'MBA / PGDM', 'BBA / BMS', 'BCA', 'MCA', 'B.Com', 'M.Com', 'B.Sc', 'M.Sc', 'BA', 'MA', 'LLB / BA LLB', 'LLM', 'B.Des / Fashion Design', 'M.Des', 'Hotel Management', 'Architecture (B.Arch)', 'MBBS / BDS / Nursing', 'Pharmacy', 'Aviation', 'PhD', 'Other'];
  G.COURSES = COURSES; G.PROGRAMS = COURSES;
  var CITIES = ['Agra', 'Ahmedabad', 'Ajmer', 'Aligarh', 'Allahabad (Prayagraj)', 'Amritsar', 'Aurangabad', 'Bangalore', 'Bareilly', 'Bhopal', 'Bhubaneswar', 'Bikaner', 'Chandigarh', 'Chennai', 'Coimbatore', 'Cuttack', 'Dehradun', 'Delhi', 'Dhanbad', 'Dubai', 'Faridabad', 'Ghaziabad', 'Goa', 'Greater Noida', 'Guwahati', 'Gurgaon', 'Gwalior', 'Hubli', 'Hyderabad', 'Indore', 'Jabalpur', 'Jaipur', 'Jalandhar', 'Jammu', 'Jamshedpur', 'Jodhpur', 'Kanpur', 'Kochi', 'Kolhapur', 'Kolkata', 'Kota', 'Kozhikode', 'Lucknow', 'Ludhiana', 'Madurai', 'Mangalore', 'Meerut', 'Mumbai', 'Mysore', 'Nagpur', 'Nashik', 'Navi Mumbai', 'New Delhi', 'Noida', 'Panipat', 'Patiala', 'Patna', 'Pune', 'Raipur', 'Rajkot', 'Ranchi', 'Rohtak', 'Salem', 'Shimla', 'Siliguri', 'Solan', 'Sonipat', 'Surat', 'Thane', 'Thiruvananthapuram', 'Tiruchirappalli', 'Udaipur', 'Vadodara', 'Varanasi', 'Vijayawada', 'Visakhapatnam', 'Warangal', 'Other'];

  /* registration gate: full details, shortlist and compare unlock after one successful registration */
  var KEY = 'gyc_lead_v1', mem = false, pending = null;
  G.unlocked = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return mem; } };
  G.unlock = function () { mem = true; try { localStorage.setItem(KEY, '1'); } catch (e) {} G.track('unlock', {}); };
  G.gate = function (slug, opener, after, opts) {
    if (G.unlocked()) { after(); return; }
    pending = after; G.openGuide(G.reg, slug, opener, opts || {});
  };

  function consent(names) {
    var who = names.length ? names.join(', ') : 'the colleges that match your interest';
    return 'By submitting, you agree to be contacted by GetYourCollege and to share your details with ' + who + '. <a href="' + C.POLICY_URL + '">Terms &amp; Privacy</a>';
  }
  function valid(v) {
    var e = {};
    if (!v.name || v.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^\d{10}$/.test(v.mobile)) e.mobile = 'Enter a 10-digit mobile number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = 'Enter a valid email address.';
    if (!v.city || v.city.trim().length < 2) e.city = 'Choose or type your city.';
    if (!v.program) e.program = 'Select a course.';
    return e;
  }
  function payload(v, college) {
    var m = C.FIELD_MAP, data = {};
    data[m.name] = v.name.trim(); data[m.mobile] = v.mobile; data[m.email] = v.email.trim(); data[m.city] = v.city.trim();
    data[m.college] = college ? college.name : '';
    if (v.program) data[m.program] = v.program;
    data[m.source] = C.SOURCE; data[m.page] = location.pathname;
    var u = G.utm(); Object.keys(u).forEach(function (k) { data[k] = u[k]; });
    return data;
  }
  function post(data) {
    var opts = { method: 'POST' };
    if (C.SEND_AS === 'json') { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(data); }
    else opts.body = new URLSearchParams(data);
    return fetch(C.LEAD_ENDPOINT, opts).then(function (res) {
      return res.text().then(function (text) {
        var json = null; try { json = JSON.parse(text); } catch (e) {}
        return { ok: C.isSuccess(json, text, res), msg: json && json.message };
      });
    });
  }
  G.navigate = function (url) { location.assign(url); };   // overridable in tests

  /* Shared submit handler. form: element with named fields, getCollege(): selected college or null. */
  function handle(form, getCollege, status) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = form.elements, v = { name: f.name.value, mobile: f.mobile.value.replace(/\s+/g, ''), email: f.email.value, city: f.city.value, program: f.program ? f.program.value : '' };
      var errs = valid(v);
      G.$$('.field-err', form).forEach(function (n) { n.textContent = ''; });
      G.$$('[aria-invalid]', form).forEach(function (n) { n.removeAttribute('aria-invalid'); });
      var first = null;
      Object.keys(errs).forEach(function (k) {
        var el = f[k], msg = G.$('[data-err=' + k + ']', form);
        if (msg) msg.textContent = errs[k]; el.setAttribute('aria-invalid', 'true'); first = first || el;
      });
      if (first) { first.focus(); return; }
      var college = getCollege();
      if (f.website && f.website.value) {           // honeypot: bots only; pretend success, send nothing
        status.className = 'notice ok'; status.textContent = 'Thank you! We will be in touch.'; return;
      }
      var btn = G.$('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Sending...';
      status.className = 'notice'; status.textContent = '';
      post(payload(v, college)).then(function (r) {
        if (!r.ok) throw new Error(r.msg || 'failed');
        G.track('lead_submit', { college: college ? college.slug : 'none', form: form.getAttribute('data-form') || 'form' });
        status.className = 'notice ok';
        G.unlock();
        var fn = pending; pending = null;
        form.reset(); btn.disabled = false; btn.textContent = 'Register now';
        if (fn) { status.textContent = 'Thank you! Unlocking now...'; setTimeout(function () { if (dlg && dlg.open) dlg.close(); fn(); }, 600); }
        else if (college) status.textContent = 'Thank you! A counsellor will contact you about ' + college.name + '. Full details, shortlist and compare are now unlocked.';
        else status.textContent = 'Thank you! A counsellor will contact you soon. Full details, shortlist and compare are now unlocked.';
      }).catch(function () {
        status.className = 'notice err'; status.setAttribute('role', 'alert');
        status.textContent = 'Sorry, we could not send your details. Please check your connection and try again.';
        btn.disabled = false; btn.textContent = 'Try again';
      });
    });
  }

  function field(id, label, attrs, cls) {
    var n = id.replace(/^[a-z]+-/, '');
    return '<div class="field' + (cls ? ' ' + cls : '') + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + n + '" ' + attrs + ' required>' +
      '<p class="field-err" data-err="' + n + '" role="alert"></p></div>';
  }
  function cityField(id) { return field(id, 'City', 'type="text" list="gyc-cities" autocomplete="off" placeholder="Search your city"'); }
  function courseField(id) {
    return '<div class="field f-course"><label for="' + id + '">Course</label><select id="' + id + '" name="program" required></select><p class="field-err" data-err="program" role="alert"></p></div>';
  }
  function ensureCities() {
    if (G.$('#gyc-cities')) return;
    document.body.insertAdjacentHTML('beforeend', '<datalist id="gyc-cities">' + CITIES.map(function (c) { return '<option value="' + G.esc(c) + '"></option>'; }).join('') + '</datalist>');
  }
  /* courses of the chosen college (when it lists enough real ones), otherwise the general list */
  function courseOptions(c) {
    var seen = {}, own = ((c && c.courses) || []).filter(function (x) {
      if (!x || x.length > 34 || /^[a-z0-9\-]+$/.test(x) || /^\d/.test(x) || seen[x]) return false; seen[x] = 1; return true;
    }).slice(0, 14);
    var list = own.length >= 3 ? own.concat(['Other']) : COURSES;
    return '<option value="">Select course</option>' + list.map(function (x) { return '<option>' + G.esc(x) + '</option>'; }).join('');
  }
  var HONEY = '<div class="hp" aria-hidden="true"><label>Leave empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>';

  /* ---- registration pop-up ---- */
  var dlg;
  function ensureModal(reg) {
    if (dlg) return;
    ensureCities();
    dlg = document.createElement('dialog'); dlg.className = 'modal reg'; dlg.setAttribute('aria-labelledby', 'lead-title');
    dlg.innerHTML = '<form method="dialog" class="x"><button class="close" aria-label="Close">&times;</button></form>' +
      '<form class="lead-form" data-form="guide" novalidate><h2 id="lead-title">Register now</h2>' +
      '<p class="muted" id="lead-sub"></p>' +
      '<ul class="gate-list"><li>Course-wise fees</li><li>Eligibility and dates</li><li>Exams accepted</li><li>Counsellor callback</li></ul>' +
      field('m-name', 'Full name', 'type="text" autocomplete="name"') +
      field('m-mobile', 'Mobile number', 'type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10-digit number"') +
      field('m-email', 'Email', 'type="email" autocomplete="email"') +
      cityField('m-city') +
      '<div class="field f-college"><label for="m-college">College</label><select id="m-college" name="college"></select></div>' +
      courseField('m-program') + HONEY +
      '<p class="consent" id="m-consent"></p><div id="m-status" class="notice" aria-live="polite"></div>' +
      '<button type="submit" class="btn block" id="m-cta">Register now</button></form>';
    document.body.appendChild(dlg);
    var sel = G.$('#m-college', dlg), prog = G.$('#m-program', dlg);
    sel.innerHTML = '<option value="">Not sure yet</option>' + reg.colleges.map(function (c) { return '<option value="' + G.esc(c.slug) + '">' + G.esc(c.name) + '</option>'; }).join('');
    var upd = function () {
      var c = reg.bySlug[sel.value], keep = prog.value;
      G.$('#m-consent', dlg).innerHTML = consent(c ? [c.name] : []);
      prog.innerHTML = courseOptions(c); if (keep) prog.value = keep;
    };
    sel.addEventListener('change', upd); upd();
    handle(G.$('.lead-form', dlg), function () { return reg.bySlug[sel.value] || null; }, G.$('#m-status', dlg));
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
  G.openGuide = function (reg, slug, opener, opts) {
    opts = opts || {};
    ensureModal(reg);
    var sel = G.$('#m-college', dlg); sel.value = reg.bySlug[slug] ? slug : ''; sel.dispatchEvent(new Event('change'));
    var c = reg.bySlug[sel.value];
    dlg.classList.toggle('gate-mode', !!opts.title && !!c);
    G.$('#lead-title', dlg).textContent = opts.title || 'Register now';
    G.$('#lead-sub', dlg).textContent = opts.sub || 'Tell us a little about you and a counsellor will help you choose' + (c ? ' (' + c.name + ')' : '') + '.';
    var btn = G.$('#m-cta', dlg); btn.disabled = false; btn.textContent = opts.cta || 'Register now';
    G.$('#m-status', dlg).textContent = ''; G.$('#m-status', dlg).className = 'notice';
    G.track('open_guide', { college: slug || 'none' });
    dlg.showModal(); G.$('#m-name', dlg).focus();
    dlg.addEventListener('close', function once() { dlg.removeEventListener('close', once); pending = null; if (opener && opener.focus) opener.focus(); });
  };
  /* any [data-register] element opens the registration pop-up */
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-register]'); if (!r) return;
    e.preventDefault();
    var mb = G.$('.menu-btn'); if (mb && mb.getAttribute('aria-expanded') === 'true') mb.click();
    G.loadRegistry().then(function (reg) { G.openGuide(reg, '', r, { title: 'Register now', cta: 'Register now' }); });
  });

  /* ---- inline contact form (homepage, /colleges/) ---- */
  G.contactForm = function (mount, reg, preselect) {
    ensureCities();
    mount.innerHTML = '<form class="lead-form" data-form="contact" novalidate>' +
      field('c-name', 'Full name', 'type="text" autocomplete="name"') +
      field('c-mobile', 'Mobile number', 'type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10-digit number"') +
      field('c-email', 'Email', 'type="email" autocomplete="email"') +
      cityField('c-city') +
      '<div class="field"><label for="c-college">College</label><select id="c-college" name="college"><option value="">Not sure yet</option>' +
      reg.colleges.map(function (c) { return '<option value="' + G.esc(c.slug) + '">' + G.esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      courseField('c-program') + HONEY +
      '<p class="consent" id="c-consent"></p><div id="c-status" class="notice" aria-live="polite"></div>' +
      '<button type="submit" class="btn block">Register now</button></form>';
    var form = G.$('form', mount), sel = G.$('#c-college', mount), prog = G.$('#c-program', mount);
    var upd = function () {
      var c = reg.bySlug[sel.value], keep = prog.value;
      G.$('#c-consent', mount).innerHTML = consent(c ? [c.name] : []);
      prog.innerHTML = courseOptions(c); if (keep) prog.value = keep;
    };
    sel.addEventListener('change', upd);
    if (preselect && reg.bySlug[preselect]) sel.value = preselect; upd();
    G.contactSelect = function (slug) { sel.value = slug; upd(); };
    handle(form, function () { return sel.value ? reg.bySlug[sel.value] : null; }, G.$('#c-status', mount));
  };
})();
