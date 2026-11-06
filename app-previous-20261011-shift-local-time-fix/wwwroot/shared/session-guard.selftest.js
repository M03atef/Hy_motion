/**
 * GfpSessionGuard self-check (node). Run: node src/app/shared/session-guard.selftest.js
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

function makeSandbox(expiresAt, refreshToken) {
  var intervals = [];
  var timeouts = [];
  var sb = {
    window: undefined,
    Date: Date,
    document: {
      readyState: 'complete',
      documentElement: { lang: 'en' },
      addEventListener: function () {}
    },
    setInterval: function (fn, ms) {
      intervals.push({ fn: fn, ms: ms });
      return intervals.length;
    },
    clearInterval: function () {},
    setTimeout: function (fn, ms) {
      timeouts.push({ fn: fn, ms: ms });
      return timeouts.length;
    },
    GfpApi: {
      tokens: {
        getExpiresAt: function () { return expiresAt; },
        getRefresh: function () { return refreshToken; }
      },
      auth: {
        refresh: function () { sb._refreshCalled = true; }
      }
    },
    GfpToast: {
      warn: function (msg) { sb._warnMsg = msg; }
    },
    console: console,
    globalThis: undefined,
    _intervals: intervals,
    _timeouts: timeouts,
    _refreshCalled: false,
    _warnMsg: null
  };
  sb.window = sb;
  sb.globalThis = sb;
  return sb;
}

// ── Test 1: Module loads and exposes GfpSessionGuard ──
var sb1 = makeSandbox(new Date(Date.now() + 600000).toISOString(), 'rt-123');
loadIife(path.join(__dirname, 'session-guard.js'), sb1);
assert(typeof sb1.GfpSessionGuard === 'object', 'GfpSessionGuard is exported');
assert(typeof sb1.GfpSessionGuard.check === 'function', 'check is a function');
assert(typeof sb1.GfpSessionGuard.start === 'function', 'start is a function');

// ── Test 2: check() triggers proactive refresh when <2min left with refresh token ──
var sb2 = makeSandbox(new Date(Date.now() + 60000).toISOString(), 'rt-123'); // 1 min left
loadIife(path.join(__dirname, 'session-guard.js'), sb2);
sb2.GfpSessionGuard.check();
assert(sb2._refreshCalled === true, 'proactive refresh triggered when <2min left + refresh token');

// ── Test 3: check() warns when <2min left with NO refresh token ──
var sb3 = makeSandbox(new Date(Date.now() + 60000).toISOString(), null); // 1 min left, no RT
loadIife(path.join(__dirname, 'session-guard.js'), sb3);
sb3.GfpSessionGuard.check();
assert(sb3._warnMsg !== null, 'warning toast shown when <2min left + no refresh token');

// ── Test 4: check() does nothing when plenty of time ──
var sb4 = makeSandbox(new Date(Date.now() + 600000).toISOString(), 'rt-123'); // 10 min left
loadIife(path.join(__dirname, 'session-guard.js'), sb4);
sb4.GfpSessionGuard.check();
assert(sb4._refreshCalled === false, 'no refresh when 10min remaining');
assert(sb4._warnMsg === null, 'no warning when 10min remaining');

// ── Test 5: auto-starts interval on load ──
assert(sb1._intervals.length > 0, 'periodic check interval registered');

console.log('\n✔ ' + passed + ' tests passed');
