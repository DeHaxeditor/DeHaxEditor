// Exercise the real branding loader and both admin upload/save paths without network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const brandSource = read('assets/js/site-settings.js');
const adminSource = read('assets/js/admin.js');
const noop = () => {};
const db = {
  brand_logo_url: '/assets/brand/dehax-logo.png',
  public_site_content: {logo: 'https://media.example/previous.png', site_name: 'Preserved name'}
};
const nodes = new Map();
const toasts = [], writes = [], requests = [];
let initAdmin, loadBrand, rejectSave = false;
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {
    value: '', textContent: '', innerHTML: '', dataset: {}, files: [], checked: false, style: {},
    classList: {add: noop, remove: noop, toggle: noop},
    addEventListener: noop, setAttribute: noop, remove: noop,
    appendChild(child) { if (selector === '#toasts') toasts.push(child); },
    querySelector: child => node(selector + ' ' + child), querySelectorAll: () => []
  });
  return nodes.get(selector);
}
const logos = [node('header-logo'), node('sidebar-logo')];
const icon = node('favicon');
const publicUpload = node('[data-public-upload="logo"]');
publicUpload.dataset.publicUpload = 'logo';
const document = {
  readyState: 'loading',
  addEventListener(type, callback) { if (type === 'DOMContentLoaded') loadBrand = callback; },
  documentElement: {style: {setProperty: noop}},
  createElement: () => ({}), querySelector: node,
  querySelectorAll(selector) {
    if (selector.includes('img[data-brand-logo]')) return logos;
    if (selector === 'link[data-brand-logo]') return [icon];
    if (selector === '[data-public-upload]') return [publicUpload];
    return [];
  }
};
const rows = () => Object.entries(db).map(([key, value]) => ({key, value}));
const api = {
  currentUser: async () => ({email: 'admin@example.test'}),
  currentProfile: async () => ({role: 'admin'}), token: () => 'test-session',
  adminFetch: async table => table === 'app_settings' ? rows() : [],
  async adminUpsert(table, values, conflict) {
    if (rejectSave) throw new Error('Save failed');
    assert.equal(table, 'app_settings');
    assert.equal(conflict, 'key');
    assert.ok(Array.isArray(values), 'Related settings must be saved in one request.');
    writes.push(values);
    for (const {key, value} of values) db[key] = value;
  },
  callFunction: async (name, args) => {
    assert.equal(name, 'admin-upload-url');
    return {uploadUrl: 'https://upload.example/file', publicUrl: 'https://media.example/' + args.filename};
  }
};
const context = vm.createContext({
  window: {DEHAX_CONFIG: {supabaseUrl: 'https://db.example', supabaseAnonKey: 'public-test-key'}, DehaxUI: {enhanceAll: noop, refreshSelect: noop}},
  document, URL, console, DehaxAPI: api,
  location: {origin: 'https://dehax.example', hash: '', href: ''}, history: {replaceState: noop},
  addEventListener: noop,
  setTimeout(callback, delay) { if (delay === 0) initAdmin = callback; return 1; },
  async fetch(url, options) {
    requests.push({url, options});
    return {ok: true, json: async () => url.includes('/rest/v1/') ? rows() : {logo: '/assets/brand/dehax-logo.png'}};
  }
});
vm.runInContext(brandSource, context);
await loadBrand();
const brand = context.window.DehaxBrand;
assert.equal(logos[0].src, db.public_site_content.logo, 'Legacy public uploads must appear on platform pages.');
assert.equal(icon.href, logos[0].src);
assert.ok(requests.every(r => r.options.cache === 'no-store'), 'Settings and local content must be revalidated.');
assert.equal(brand.normalizeLogo('/assets/brand/dehax-logo.png?v=old'), brand.DEFAULT_LOGO);
assert.equal(brand.normalizeLogo('javascript:alert(1)'), brand.DEFAULT_LOGO);
logos[0].onerror();
assert.equal(logos[0].src, brand.DEFAULT_LOGO, 'Broken uploads fall back to the bundled logo.');

vm.runInContext(adminSource, context);
await initAdmin();
assert.equal(node('#pLogo').value, node('#sBrandLogo').value);

async function checkSave(action, expected) {
  const before = writes.length;
  await action();
  assert.equal(writes.length, before + 1, 'One atomic save for both settings.');
  assert.equal(db.brand_logo_url, expected);
  assert.equal(db.public_site_content.logo, expected);
  assert.equal(db.public_site_content.site_name, 'Preserved name');
  for (const img of logos) assert.equal(img.src, expected, 'Repeated updates must reach an already-customized logo.');
  assert.equal(node('#pLogo').value, expected);
  assert.equal(node('#sBrandLogo').value, expected);
  assert.equal(icon.href, expected);
}
node('#pLogo').value = 'https://media.example/public-save.png';
await checkSave(() => node('#savePublicSite').onclick(), node('#pLogo').value);
node('#sBrandLogo').value = 'https://media.example/brand-save.png';
await checkSave(() => node('#saveSiteSettings').onclick(), node('#sBrandLogo').value);
node('#pLogoFile').files = [{name: 'public-upload.png', type: 'image/png', size: 100}];
await checkSave(() => publicUpload.onclick(), 'https://media.example/public-upload.png');
node('#siteLogoFile').files = [{name: 'brand-upload.png', type: 'image/png', size: 100}];
await checkSave(() => node('#uploadSiteLogo').onclick(), 'https://media.example/brand-upload.png');
rejectSave = true;
node('#siteLogoFile').files = [{name: 'failed.png', type: 'image/png', size: 100}];
await node('#uploadSiteLogo').onclick();
assert.equal(db.brand_logo_url, 'https://media.example/brand-upload.png');
assert.equal(logos[0].src, db.brand_logo_url, 'Failed saves must retain the published logo.');
assert.ok(toasts.at(-1).textContent.includes('Falha ao atualizar logo'));

for (const page of ['index.html','portfolio/index.html','manager/index.html','comunidade/index.html','entrar/index.html','confirmar-email/index.html','app/index.html','admin/index.html','checkout/index.html','privacidade/index.html','termos/index.html','cookies/index.html']) {
  const html = read(page);
  assert.match(html, /site-settings\.js\?v=20260928/, page + ' must load current branding');
  assert.match(html, /<img[^>]*data-brand-logo/, page + ' must identify its logo');
  for (const image of html.matchAll(/<img[^>]*dehax-logo\.png[^>]*>/g)) assert.ok(image[0].includes('data-brand-logo'), page);
}
console.log('Branding smoke test passed: legacy uploads, both saves, both automatic uploads, repeat updates, failed save, fallback and all 12 pages.');
