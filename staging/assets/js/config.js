/* Single place for endpoint and analytics settings. */
window.GYC_CONFIG = {
  // STAGING: mock endpoint (logs to a file outside the web root, never reaches real leads).
  // PRODUCTION value is documented in DEPLOY.md only.
  LEAD_ENDPOINT: '/api/mock-lead',
  SOURCE: 'hub',

  // WhatsApp "Talk to expert". TODO: paste the wa.me link, e.g. 'https://wa.me/91XXXXXXXXXX?text=Hi%20GetYourCollege'.
  // While it is empty the button opens the Register form instead.
  WHATSAPP_URL: '',
  WHATSAPP_LABEL: 'Talk to expert',

  // GA4 measurement ID of the existing homepage. TODO: paste it here (not an ad-conversion tag).
  // While it contains "X" no analytics script loads.
  GA4_ID: 'G-XXXXXXXXXX',
  DEBUG_EVENTS: false,

  REGISTRY_URL: '/data/colleges.public.json',
  FEATURED_URL: '/data/featured.json',
  META_URL: '/data/registry-meta.json',
  POLICY_URL: '/website-policy.html',

  MAX_SHORTLIST: 20,
  MAX_COMPARE: 4,
  BATCH: 24,

  // TODO: mirror the real lead endpoint (see DEPLOY.md). Keys = our field, values = POST field name it expects.
  FIELD_MAP: { name: 'name', mobile: 'mobile', email: 'email', city: 'city', college: 'college', program: 'program', source: 'source', page: 'page' },
  SEND_AS: 'form', // 'form' (urlencoded) or 'json'
  // TODO: mirror the real response format.
  isSuccess: function (json, text, res) {
    if (!res.ok) return false;
    if (json) return json.success === true || json.status === 'success';
    return /success/i.test(text || '');
  }
};
