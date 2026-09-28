// Regression: execute the real Admin script through its initial render.
// A syntax check alone missed an earlier querySelector(...).forEach crash.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/admin.js', import.meta.url), 'utf8');
const nodes = new Map();
let initCallback;
let loaderRemoved = false;
const noop = () => {};

function node(selector) {
  if (!nodes.has(selector)) {
    nodes.set(selector, {
      value: '', textContent: '', innerHTML: '', dataset: {},
      files: [], checked: false, style: {},
      classList: { add: noop, remove: noop, toggle: noop },
      setAttribute: noop, addEventListener: noop, appendChild: noop,
      querySelector: () => null, querySelectorAll: () => [],
      remove() { if (selector === '#adminLoading') loaderRemoved = true; }
    });
  }
  return nodes.get(selector);
}

const document = {
  querySelector: node, querySelectorAll: () => [],
  createElement: () => node('__created'),
  documentElement: { style: { setProperty: noop } }
};
const api = {
  currentUser: async () => ({ email: 'admin-smoke@example.com' }),
  currentProfile: async () => ({ role: 'admin', email: 'admin-smoke@example.com' }),
  token: () => 'demo-token'
};

vm.runInNewContext(source, {
  document,
  window: { DehaxUI: { enhanceAll: noop, refreshSelect: noop } },
  DehaxAPI: api,
  location: { hash: '', href: '' },
  history: { replaceState: noop },
  addEventListener: noop,
  setTimeout(callback) { if (!initCallback) initCallback = callback; return 1; },
  fetch: async () => ({ ok: true, json: async () => ({}) })
}, { filename: 'assets/js/admin.js' });

assert.equal(typeof initCallback, 'function', 'Admin must schedule initialization.');
await initCallback();
assert.ok(loaderRemoved, 'Admin should render and remove its loading overlay. ' + node('#adminLoading').innerHTML);
assert.ok(node('#categoryAdminGrid').innerHTML.includes('category-admin-card'), 'Admin should render category cards.');
console.log('Admin boot smoke test passed.');
