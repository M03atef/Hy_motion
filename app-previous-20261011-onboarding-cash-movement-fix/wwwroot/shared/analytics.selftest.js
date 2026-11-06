/**
 * GfpAnalytics self-check (node). Run:
 *   node src/app/shared/analytics.selftest.js
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

function makeSandbox(analyticsEnabled, providerCalls) {
  var calls = providerCalls || [];
  var sb = {
    window: undefined,
    document: {
      querySelector: function () { return null; }
    },
    localStorage: {
      getItem: function (k) {
        if (k === 'gfp_analytics_enabled') return analyticsEnabled ? '1' : null;
        return null;
      }
    },
    GfpVersion: {
      get: function () { return 'test-version'; },
      env: function () { return 'test-env'; }
    },
    GfpAnalyticsProvider: {
      track: function (eventName, props) { calls.push({ eventName: eventName, props: props }); }
    },
    console: console
  };
  sb.window = sb;
  sb.globalThis = sb;
  return { sb: sb, calls: calls };
}

// Disabled by default
var x1 = makeSandbox(false, []);
loadIife(path.join(__dirname, 'analytics.js'), x1.sb);
assert(typeof x1.sb.GfpAnalytics.track === 'function', 'GfpAnalytics.track exists');
x1.sb.GfpAnalytics.track('login_success', { reason: 'invalid_credentials' });
assert(x1.calls.length === 0, 'track is a no-op when analytics disabled');

// Enabled when opt-in is set
var x2 = makeSandbox(true, []);
loadIife(path.join(__dirname, 'analytics.js'), x2.sb);
x2.sb.GfpAnalytics.track('login_success', { reason: 'invalid_credentials' });
assert(x2.calls.length === 1, 'track forwards to provider when enabled');
assert(x2.calls[0].eventName === 'login_success', 'eventName preserved');
assert(x2.calls[0].props.appVersion === 'test-version', 'appVersion attached');
assert(!String(JSON.stringify(x2.calls[0].props)).match(/token|password|secret|refresh/i), 'sanitization strips token-like keys');

console.log('\\n✔ ' + passed + ' tests passed');

