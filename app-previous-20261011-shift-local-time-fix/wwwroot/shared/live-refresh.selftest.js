/**
 * GfpLiveRefresh self-check (node). Run: node src/app/shared/live-refresh.selftest.js
 * Validates subscription routing, debounce coalescing, and unsubscribe — no SignalR needed.
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

var timers = [];
var sandbox = {
  console: console,
  setTimeout: function (fn, ms) {
    var t = { fn: fn, ms: ms, cleared: false };
    timers.push(t);
    return t;
  },
  clearTimeout: function (t) {
    if (t) t.cleared = true;
  },
  setInterval: function () { return null; },
  clearInterval: function () {},
  localStorage: { getItem: function () { return null; } },
  sessionStorage: { getItem: function () { return null; } },
  document: {
    readyState: 'complete',
    addEventListener: function () {},
    createElement: function () { return { addEventListener: function () {} }; },
    head: { appendChild: function () {} }
  }
  // Deliberately NO signalR, NO CustomEvent — module must degrade silently.
};
sandbox.window = sandbox;

var file = path.join(__dirname, 'live-refresh.js');
vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });

var GfpLive = sandbox.GfpLive;
assert(GfpLive && typeof GfpLive.on === 'function', 'GfpLive.on exposed');
assert(typeof GfpLive.debounce === 'function', 'GfpLive.debounce exposed');
assert(typeof GfpLive.isConnected === 'function', 'GfpLive.isConnected exposed');
assert(GfpLive.isConnected() === false, 'not connected without SignalR (silent)');

function flush() {
  var due = timers.filter(function (t) { return !t.cleared; });
  timers = [];
  due.forEach(function (t) { if (!t.cleared) t.fn(); });
}

var memberCalls = [];
var saleCalls = [];
var unsubMembers = GfpLive.on(['members', 'memberships'], function (d) { memberCalls.push(d); });
var unsubSales = GfpLive.on(['sales'], function (d) { saleCalls.push(d); });
assert(typeof unsubMembers === 'function' && typeof unsubSales === 'function', 'on() returns unsubscribe');

GfpLive._simulate({ entity: 'members', action: 'created', id: 'm1', atUtc: '2026-01-01T00:00:00Z' });
flush();
assert(memberCalls.length === 1 && memberCalls[0].id === 'm1', 'event routed to matching subscription');
assert(saleCalls.length === 0, 'event NOT routed to non-matching subscription');

// Debounce: two events for the same sub within the window → one callback invocation.
GfpLive._simulate({ entity: 'members', action: 'updated', id: 'm1', atUtc: 'x' });
GfpLive._simulate({ entity: 'memberships', action: 'renewed', id: 'm2', atUtc: 'x' });
flush();
assert(memberCalls.length === 2, 'debounce coalesced 2 events into 1 refetch (total 2 calls)');

// Unsubscribe stops routing.
unsubMembers();
GfpLive._simulate({ entity: 'members', action: 'updated', id: 'm3', atUtc: 'x' });
flush();
assert(memberCalls.length === 2, 'unsubscribed callback no longer invoked');
assert(saleCalls.length === 0, 'other subscription unaffected by unrelated entities');

console.log('\nAll ' + passed + ' assertions passed.');
