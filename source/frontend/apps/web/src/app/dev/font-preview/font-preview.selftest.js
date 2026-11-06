/**
 * Font preview self-check. Run:
 *   node src/app/dev/font-preview/font-preview.selftest.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var dir = __dirname;
var shared = path.join(dir, '..', '..', 'shared');

function load(file, sandbox) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}

var storage = {};
var sandbox = {
  console: console,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  },
  document: {
    readyState: 'complete',
    documentElement: { lang: 'en', dir: 'ltr', setAttribute: function () {}, getAttribute: function () { return null; } },
    body: { classList: { toggle: function () {} } },
    head: { appendChild: function (n) { sandbox.__links.push(n); } },
    createElement: function () {
      return { rel: '', href: '', setAttribute: function () {}, style: {} };
    },
    getElementById: function (id) {
      return sandbox.__els[id] || null;
    },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  },
  addEventListener: function () {},
  CustomEvent: function () {},
  dispatchEvent: function () {},
  __links: [],
  __els: {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

function el(id) {
  var node = {
    id: id,
    innerHTML: '',
    textContent: '',
    classList: { toggle: function () {}, add: function () {}, remove: function () {} },
    disabled: false,
    title: '',
    addEventListener: function (ev, fn) {
      this['on' + ev] = fn;
    },
    click: function () { if (this.onclick) this.onclick({ target: this }); }
  };
  sandbox.__els[id] = node;
  return node;
}

['fpGrid', 'fpCompareChecks', 'fpLangEn', 'fpLangAr', 'fpSelectAll', 'fpClearCompare', 'fpApply', 'fpSelectionLabel']
  .forEach(el);

load(path.join(shared, 'i18n-catalog.js'), sandbox);
load(path.join(shared, 'i18n.js'), sandbox);
load(path.join(dir, 'font-preview-app.js'), sandbox);

var FP = sandbox.GfpFontPreview;
assert.ok(FP, 'GfpFontPreview exported');
assert.ok(FP.FONTS.length >= 10, 'at least 10 font options');
assert.ok(FP.FONTS.some(function (f) { return f.id === 'din-next' && !f.available; }), 'DIN Next marked unavailable');
assert.ok(FP.FONTS.filter(function (f) { return f.available; }).length >= 9, 'available fonts present');

FP.loadGoogle(FP.FONTS.find(function (f) { return f.id === 'cairo'; }));
assert.ok(sandbox.__links.length >= 1, 'lazy-loads Google Font stylesheet');

sandbox.GfpI18n.setLocale('ar');
assert.strictEqual(sandbox.document.documentElement.dir, 'rtl', 'RTL on ar');
sandbox.GfpI18n.setLocale('en');
assert.strictEqual(sandbox.document.documentElement.dir, 'ltr', 'LTR on en');

assert.strictEqual(sandbox.GfpI18n.t('fontPreview.title', null, 'en').indexOf('Font Preview') !== -1, true, 'catalog key en');
assert.ok(sandbox.GfpI18n.t('fontPreview.title', null, 'ar').length > 4, 'catalog key ar');

var html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
assert.ok(html.indexOf('data-i18n="fontPreview.title"') !== -1, 'page uses data-i18n');
assert.ok(html.indexOf('font-preview-app.js') !== -1, 'app script linked');

var css = fs.readFileSync(path.join(dir, 'font-preview.css'), 'utf8');
assert.ok(css.indexOf('--fp-stack') !== -1, 'scoped stack var');
assert.ok(css.indexOf("body{font-family:var(--fd)") === -1, 'does not override production body --fd');

console.log('font-preview.selftest: OK (' + FP.FONTS.length + ' fonts)');
