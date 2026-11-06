/**
 * Sidebar scroll continuity selftest (MPA full-page navigation).
 * Run: node src/app/shared/shell-scroll.selftest.js
 * (from apps/web)
 *
 * Regression: the dashboard uses intentional full-page navigation (<a href>),
 * so every page load rebuilt .sb-nav at scrollTop 0 and a user scrolled down
 * to the System section lost their place on every click. shell.js now saves
 * the sidebar scroll offset on pagehide/click and restores it inside
 * renderShellNav (once per document, clamped, no flicker).
 *
 * shell.js is loaded fresh into a vm sandbox per scenario — module state
 * (the restore-once flag) is per-document, so each scenario is a new document.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeStorage() {
  const m = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    setItem: (k, v) => {
      m[k] = String(v);
    },
    removeItem: (k) => {
      delete m[k];
    },
  };
}

function makeMain() {
  return { children: [] };
}

/**
 * Loads shell.js into a fresh sandbox. `sbNav` is the fake .sb-nav element
 * returned by document.querySelector('.sb-nav'). Returns { sandbox, handlers }
 * where handlers collects registered pagehide/click listeners.
 */
function loadShell(sbNav) {
  const handlers = { pagehide: [], click: [] };
  const document = {
    readyState: 'loading',
    querySelector: (sel) => (sel === '.sb-nav' ? sbNav : sel === '.main' ? makeMain() : null),
    getElementById: () => null,
    addEventListener: (type, fn) => {
      if (type === 'click') handlers.click.push(fn);
    },
    documentElement: {},
    body: null,
    createElement: () => ({ style: {}, setAttribute() {}, classList: { add() {} } }),
  };
  const sandbox = {
    console,
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    addEventListener: (type, fn) => {
      if (type === 'pagehide') handlers.pagehide.push(fn);
    },
    location: { pathname: '/dashboard/notifications/', search: '', origin: 'http://127.0.0.1:7140' },
    navigator: { language: 'en' },
    document,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  // Authz stub: every permission/policy granted — renderShellNav must build
  // the full nav in every scenario (visibility filtering is not under test).
  sandbox.GfpAuthz = {
    getAccessToken: () => 'test-token',
    getUserRole: () => 'Owner',
    normalizeRole: (r) => String(r || '').trim().toLowerCase(),
    canPermission: () => true,
    matchesRolePolicy: () => true,
  };

  const code = fs.readFileSync(path.join(__dirname, 'shell.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'shell.js' });
  return { sandbox, handlers };
}

function makeNav(scenario) {
  const element = {
    scrollTop: 0,
    scrollHeight: scenario.scrollHeight,
    clientHeight: scenario.clientHeight,
    innerHTML: '',
    classList: { add() {}, contains: () => false },
    querySelector: (sel) => (sel === '.gfp-nav-item.act' ? scenario.activeItem || null : null),
    querySelectorAll: () => [],
    insertBefore() {},
  };
  if (scenario.spy) {
    scenario.scrollIntoViewCalls = [];
    scenario.activeItem = {
      scrollIntoView(opts) {
        scenario.scrollIntoViewCalls.push(opts);
      },
    };
  }
  return element;
}

// The GfpNav registry data shell.js consumes.
function withNavApi(sandbox) {
  const navCode = fs.readFileSync(path.join(__dirname, 'nav.js'), 'utf8');
  vm.runInNewContext(navCode, sandbox, { filename: 'nav.js' });
}

const SCENARIOS = [
  {
    name: 'saved scroll position is restored',
    saved: '400',
    scrollHeight: 1200,
    clientHeight: 400, // max scroll = 800 → 400 fits
    expectScrollTop: 400,
  },
  {
    name: 'saved scroll is clamped when new page content is shorter',
    saved: '900',
    scrollHeight: 1000,
    clientHeight: 400, // max scroll = 600
    expectScrollTop: 600,
  },
  {
    name: 'invalid saved value falls back to active-item reveal',
    saved: 'not-a-number',
    scrollHeight: 1200,
    clientHeight: 400,
    expectScrollTop: 0,
    spy: true,
    expectScrollIntoView: { block: 'nearest' },
  },
  {
    name: 'no saved value on a fresh session reveals active item minimally',
    saved: null,
    scrollHeight: 1200,
    clientHeight: 400,
    expectScrollTop: 0,
    spy: true,
    expectScrollIntoView: { block: 'nearest' },
  },
  {
    name: 'saved scroll on a short page (no scroll range) stays at top',
    saved: '400',
    scrollHeight: 300,
    clientHeight: 400, // max scroll = 0
    expectScrollTop: 0,
  },
];

let failures = 0;
for (const scenario of SCENARIOS) {
  try {
    const nav = makeNav(scenario);
    const { sandbox, handlers } = loadShell(nav);
    withNavApi(sandbox);
    sandbox.sessionStorage.setItem('gfp_sb_scroll', scenario.saved);

    // First render after page load — restore must happen inside this call.
    sandbox.GfpShell.renderShellNav(null);
    assert(
      nav.scrollTop === scenario.expectScrollTop,
      `${scenario.name}: expected scrollTop ${scenario.expectScrollTop}, got ${nav.scrollTop}`
    );
    if (scenario.expectScrollIntoView) {
      assert(
        scenario.scrollIntoViewCalls.length === 1 &&
          JSON.stringify(scenario.scrollIntoViewCalls[0]) === JSON.stringify(scenario.expectScrollIntoView),
        `${scenario.name}: expected exactly one minimal scrollIntoView({block:'nearest'})`
      );
    } else {
      assert(
        !scenario.scrollIntoViewCalls || scenario.scrollIntoViewCalls.length === 0,
        `${scenario.name}: scrollIntoView must not run when a saved position exists`
      );
    }

    // Second render in the SAME document (feature probes re-render) must not
    // re-scroll: the once-per-document flag holds.
    nav.scrollTop = 123;
    sandbox.GfpShell.renderShellNav(null);
    assert(
      nav.scrollTop === 123,
      `${scenario.name}: second render must not reset/re-restore scroll (got ${nav.scrollTop})`
    );

    // pagehide must persist the current sidebar offset for the next page.
    nav.scrollTop = 250;
    handlers.pagehide.forEach((fn) => fn());
    assert(
      sandbox.sessionStorage.getItem('gfp_sb_scroll') === '250',
      `${scenario.name}: pagehide must save the current sidebar scrollTop`
    );

    console.log('PASS —', scenario.name);
  } catch (e) {
    failures++;
    console.error('FAIL —', scenario.name, '\n   ', e.message, '\n   ', (e.stack || '').split('\n')[1] || '');
  }
}

// Click-capture safety net: clicking a sidebar item saves before navigating.
try {
  const nav = makeNav({ scrollHeight: 1200, clientHeight: 400 });
  const { sandbox, handlers } = loadShell(nav);
  withNavApi(sandbox);
  sandbox.sessionStorage.setItem('gfp_sb_scroll', '0');
  nav.scrollTop = 470;
  assert(handlers.click.length === 1, 'one capture-phase click listener registered');
  const fakeItem = { classList: { contains: (c) => c === 'sb-item' }, parentNode: null };
  const fakeTarget = { classList: { contains: () => false }, parentNode: fakeItem };
  handlers.click[0]({ target: fakeTarget });
  assert(
    sandbox.sessionStorage.getItem('gfp_sb_scroll') === '470',
    'clicking a sidebar item saves the current scroll before navigation'
  );
  console.log('PASS — click-capture saves scroll before navigation');
} catch (e) {
  failures++;
  console.error('FAIL — click-capture saves scroll before navigation\n   ', e.message);
}

if (failures) {
  console.error(`\n${failures} scenario(s) FAILED`);
  process.exit(1);
}
console.log('\nAll sidebar scroll continuity scenarios passed.');
