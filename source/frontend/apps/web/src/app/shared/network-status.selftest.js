/**
 * GfpNetwork self-check (node). Run: node src/app/shared/network-status.selftest.js
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

function makeSandbox(online) {
  var listeners = {};
  var sb = {
    window: undefined,
    navigator: { onLine: online },
    document: {
      readyState: 'complete',
      getElementById: function () { return null; },
      createElement: function () {
        return {
          id: '',
          style: { cssText: '' },
          innerHTML: '',
          textContent: '',
          setAttribute: function () {},
          addEventListener: function () {},
          appendChild: function () {}
        };
      },
      body: {
        insertBefore: function () {},
        firstChild: null
      },
      documentElement: { dir: 'ltr', lang: 'en' },
      addEventListener: function () {}
    },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    setTimeout: function (fn) { fn(); return 1; },
    clearTimeout: function () {},
    requestAnimationFrame: function (fn) { fn(); },
    addEventListener: function (ev, fn) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    },
    dispatchEvent: function () {},
    console: console,
    CustomEvent: function (type, opts) { this.type = type; this.detail = (opts || {}).detail; },
    globalThis: undefined,
    _listeners: listeners
  };
  sb.window = sb;
  sb.globalThis = sb;
  return sb;
}

// ── Test 1: Module loads and exposes GfpNetwork ──
var sb = makeSandbox(true);
loadIife(path.join(__dirname, 'network-status.js'), sb);
assert(typeof sb.GfpNetwork === 'object', 'GfpNetwork is exported');
assert(typeof sb.GfpNetwork.isOnline === 'function', 'isOnline is a function');
assert(typeof sb.GfpNetwork.onRestore === 'function', 'onRestore is a function');

// ── Test 2: isOnline reflects navigator.onLine ──
assert(sb.GfpNetwork.isOnline() === true, 'isOnline returns true when online');

var sbOff = makeSandbox(false);
loadIife(path.join(__dirname, 'network-status.js'), sbOff);
assert(sbOff.GfpNetwork.isOnline() === false, 'isOnline returns false when offline');

// ── Test 3: offline/online event listeners are registered ──
assert(sb._listeners['offline'] && sb._listeners['offline'].length > 0, 'offline listener registered');
assert(sb._listeners['online'] && sb._listeners['online'].length > 0, 'online listener registered');

console.log('\n✔ ' + passed + ' tests passed');
