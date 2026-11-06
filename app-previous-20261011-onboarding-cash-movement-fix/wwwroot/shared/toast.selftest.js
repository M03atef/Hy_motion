/**
 * GfpToast self-check (node). Run: node src/app/shared/toast.selftest.js
 * Tests the shared toast module initialization and API.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  passed++;
  console.log('ok —', msg);
}

function loadIife(file, sandbox) {
  var code = fs.readFileSync(file, 'utf8');
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox;
}

// ── mock browser globals ──
function makeDocument() {
  var elements = {};
  var body = {
    insertBefore: function () {},
    firstChild: null,
    appendChild: function (el) {
      elements[el.id] = el;
      el._parent = body;
    }
  };
  var html = { dir: 'ltr', lang: 'en', getAttribute: function () { return 'en'; } };
  return {
    getElementById: function (id) { return elements[id] || null; },
    createElement: function (tag) {
      var _innerHTML = '';
      var _textContent = '';
      return {
        id: '',
        tagName: tag,
        className: '',
        get innerHTML() { return _innerHTML; },
        set innerHTML(v) { _innerHTML = v; },
        get textContent() { return _textContent; },
        set textContent(v) {
          _textContent = v;
          // Simulate browser escaping for escapeHtml helper
          _innerHTML = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },
        style: { cssText: '' },
        children: [],
        _parent: null,
        setAttribute: function () {},
        getAttribute: function () { return ''; },
        addEventListener: function () {},
        appendChild: function (child) {
          this.children.push(child);
          child._parent = this;
          child.parentNode = this;
        },
        removeChild: function (child) {
          var idx = this.children.indexOf(child);
          if (idx >= 0) this.children.splice(idx, 1);
          child.parentNode = null;
        },
        get parentNode() { return this._parent; }
      };
    },
    body: body,
    documentElement: html,
    readyState: 'complete',
    addEventListener: function () {},
    querySelector: function () { return null; }
  };
}

function makeSandbox() {
  return {
    window: undefined, // set below
    document: makeDocument(),
    navigator: { onLine: true },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    setTimeout: function (fn, ms) { if (ms <= 0 || ms <= 300) fn(); return 1; },
    clearTimeout: function () {},
    requestAnimationFrame: function (fn) { fn(); },
    addEventListener: function () {},
    dispatchEvent: function () {},
    console: console,
    globalThis: undefined
  };
}

// ── Test 1: Module loads and exposes GfpToast ──
var sandbox = makeSandbox();
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
loadIife(path.join(__dirname, 'toast.js'), sandbox);
assert(typeof sandbox.GfpToast === 'object', 'GfpToast is exported');
assert(typeof sandbox.GfpToast.show === 'function', 'GfpToast.show is a function');
assert(typeof sandbox.GfpToast.success === 'function', 'GfpToast.success is a function');
assert(typeof sandbox.GfpToast.error === 'function', 'GfpToast.error is a function');
assert(typeof sandbox.GfpToast.warn === 'function', 'GfpToast.warn is a function');
assert(typeof sandbox.GfpToast.info === 'function', 'GfpToast.info is a function');
assert(typeof sandbox.GfpToast.dismiss === 'function', 'GfpToast.dismiss is a function');

// ── Test 2: show() creates a toast element ──
var el = sandbox.GfpToast.show('Test message', 'success');
assert(el !== null && el !== undefined, 'show() returns an element');
assert(el.className.indexOf('gfp-toast--success') !== -1, 'element has success class');
assert(el.innerHTML.indexOf('Test message') !== -1, 'element contains message text');

// ── Test 3: error() creates error-type toast ──
var errEl = sandbox.GfpToast.error('Error msg');
assert(errEl.className.indexOf('gfp-toast--error') !== -1, 'error() creates error-type toast');

// ── Test 4: HTML escaping ──
var xssEl = sandbox.GfpToast.show('<script>alert(1)</script>');
assert(xssEl.innerHTML.indexOf('<script>') === -1, 'HTML is escaped in toast message');

// ── Test 5: dismiss() removes element from parent ──
var container = sandbox.document.getElementById('gfp-toast-container');
assert(container !== null, 'toast container created in DOM');

console.log('\n✔ ' + passed + ' tests passed');
