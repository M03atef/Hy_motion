/**
 * Prompt 2 self-check (node). Run: node src/app/shared/shell.selftest.js
 * Covers Receptionist plans/settings hide, FEATURE_DISABLED, pending-probe hide,
 * JWT perm decode, bilingual message/messageAr.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

function loadIife(file, sandbox) {
  var code = fs.readFileSync(file, 'utf8');
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox;
}

var sharedDir = __dirname;

// ── mock browser globals ──
var storage = {};
function makeStore() {
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  };
}

function btoaNode(s) {
  return Buffer.from(s, 'binary').toString('base64');
}

function fakeJwt(payload) {
  var enc = btoaNode(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'hdr.' + enc + '.sig';
}

var sandbox = {
  console: console,
  atob: function (b64) { return Buffer.from(b64, 'base64').toString('binary'); },
  localStorage: makeStore(),
  sessionStorage: makeStore(),
  document: {
    readyState: 'complete',
    documentElement: {
      lang: 'en',
      dir: 'ltr',
      setAttribute: function (k, v) {
        this[k] = v;
      },
      getAttribute: function (k) {
        return this[k];
      }
    },
    body: { classList: { toggle: function () {} } },
    addEventListener: function () {},
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, classList: { toggle: function () {} }, addEventListener: function () {} }; },
    head: { appendChild: function () {} },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  },
  location: { pathname: '/dashboard/', href: '', origin: 'http://localhost:3000', replace: function () {} },
  CustomEvent: function () {},
  dispatchEvent: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

loadIife(path.join(sharedDir, 'authz.js'), sandbox);
loadIife(path.join(sharedDir, 'features.js'), sandbox);
loadIife(path.join(sharedDir, 'i18n-catalog.js'), sandbox);
loadIife(path.join(sharedDir, 'i18n.js'), sandbox);
loadIife(path.join(sharedDir, 'nav.js'), sandbox);
loadIife(path.join(sharedDir, 'shell.js'), sandbox);

var Authz = sandbox.GfpAuthz;
var Features = sandbox.GfpFeatures;
var I18n = sandbox.GfpI18n;
var Shell = sandbox.GfpShell;

assert(!!Authz && !!Features && !!I18n && !!Shell, 'shared modules attached');
assert(!!sandbox.GfpI18nCatalog && !!sandbox.GfpI18nCatalog.en, 'i18n catalog loaded');
assert(I18n.t('common.save', null, 'en') === 'Save', 'GfpI18n.t en');
assert(I18n.t('common.save', null, 'ar') === 'حفظ', 'GfpI18n.t ar');
assert(I18n.statusLabel('active', 'ar') === 'نشط', 'statusLabel ar');
assert(I18n.formatMoney(12500, 'en').indexOf('EGP') !== -1, 'formatMoney');
I18n.setLocale('ar');
assert(sandbox.document.documentElement.dir === 'rtl', 'RTL on ar locale');
I18n.setLocale('en');
assert(sandbox.document.documentElement.dir === 'ltr', 'LTR on en locale');

// ── Receptionist JWT (no plans.manage / settings.manage) ──
var receptionistPerms = [
  'members.view', 'members.create', 'members.edit', 'checkin.manual',
  'classes.view', 'attendance.view',
  'sales.sell', 'sales.discount.apply', 'payments.cash.accept', 'payments.refund.request',
  'shift.open', 'shift.close', 'inventory.view',
  'member_orders.view', 'member_orders.manage',
  'hr.view', 'hr.attendance.view', 'hr.attendance.manage'
];
storage.gfp_access_token = fakeJwt({
  sub: 'r1',
  role: 'Receptionist',
  perm: receptionistPerms
});
storage.gfp_user = JSON.stringify({ role: 'Receptionist', fullName: 'R' });

assert(Authz.useCan('sales.sell'), 'Receptionist can sales.sell');
assert(Authz.useCan('inventory.view'), 'Receptionist can inventory.view');
assert(!Authz.useCan('inventory.adjust'), 'Receptionist cannot inventory.adjust');
assert(!Authz.useCan('plans.manage'), 'Receptionist cannot plans.manage');
assert(!Authz.useCan('settings.manage'), 'Receptionist cannot settings.manage');
assert(Authz.useCanRole('AnyStaff'), 'Receptionist matches AnyStaff');
assert(!Authz.useCanRole('OwnerOnly'), 'Receptionist is not OwnerOnly');

var plans = Shell.NAV_ITEMS.find(function (n) { return n.key === 'plans'; });
var activities = Shell.NAV_ITEMS.find(function (n) { return n.key === 'activities'; });
var classes = Shell.NAV_ITEMS.find(function (n) { return n.key === 'classes'; });
var settings = Shell.NAV_ITEMS.find(function (n) { return n.key === 'settings'; });
var pos = Shell.NAV_ITEMS.find(function (n) { return n.key === 'pos'; });
var call = Shell.NAV_ITEMS.find(function (n) { return n.key === 'call-sheet'; });
var staff = Shell.NAV_ITEMS.find(function (n) { return n.key === 'staff'; });
var roles = Shell.NAV_ITEMS.find(function (n) { return n.key === 'roles'; });
var invHome = Shell.NAV_ITEMS.find(function (n) { return n.key === 'inv-home'; });
var invStock = Shell.NAV_ITEMS.find(function (n) { return n.key === 'inv-stock-hub'; });
var invProducts = Shell.NAV_ITEMS.find(function (n) { return n.key === 'inv-products'; });
var invAdjust = Shell.NAV_ITEMS.find(function (n) { return n.key === 'inv-adjustments'; });

var allOn = {
  sales: true, shifts: true, trials: true, refunds: true, debtors: true, imports: true,
  inventory: true, stock_management: true, hr: true, offers: true
};

assert(!!plans && !!activities && !!classes && !!pos && !!invHome && !!invStock && !!invProducts, 'nav items resolved by key');
assert(!invAdjust, 'Adjustments stay removed from Inventory nav registry');
assert(!Shell.isNavItemVisible(plans, allOn), 'Receptionist hides Plans');
assert(!Shell.isNavItemVisible(activities, allOn), 'Receptionist hides Activities catalog');
assert(Shell.isNavItemVisible(classes, allOn), 'Receptionist sees Classes');
assert(!Shell.isNavItemVisible(settings, allOn), 'Receptionist hides Settings');
assert(!Shell.isNavItemVisible(staff, allOn), 'Receptionist hides Staff');
assert(!!roles, 'Roles nav item is registered');
assert(!Shell.isNavItemVisible(roles, allOn), 'Receptionist hides Roles');
assert(Shell.isNavItemVisible(pos, allOn), 'Receptionist sees POS when sales enabled');
assert(Shell.isNavItemVisible(call, allOn), 'Receptionist sees Call sheet (no feature flag)');
assert(!Shell.isNavItemVisible(invHome, allOn), 'Shop UX hides Inventory Overview');
assert(!Shell.isNavItemVisible(invStock, allOn), 'Shop UX hides Stock Management hub');
assert(!Shell.isNavItemVisible(invProducts, allOn), 'Receptionist hides Inventory Products (no manage/purchase)');

var reports = Shell.NAV_ITEMS.find(function (n) { return n.key === 'reports'; });
var hrEmp = Shell.NAV_ITEMS.find(function (n) { return n.key === 'hr-employees'; });
assert(!!reports, 'Reports nav item is registered');
assert(!Shell.isNavItemVisible(reports, allOn), 'Receptionist hides Reports without financial.view');
assert(!!hrEmp, 'HR Employees nav item is registered');
assert(!Shell.isNavItemVisible(hrEmp, allOn), 'Receptionist HR Employees excluded despite hr claims');

// FEATURE_DISABLED
var salesOff = Object.assign({}, allOn, { sales: false });
assert(!Shell.isNavItemVisible(pos, salesOff), 'FEATURE_DISABLED hides POS');
assert(Shell.isNavItemVisible(call, salesOff), 'Call sheet stays when sales flag off');

var invOff = Object.assign({}, allOn, { inventory: false });
assert(!Shell.isNavItemVisible(invStock, invOff), 'FEATURE_DISABLED inventory hides Stock Management');

var stockMgmtOff = Object.assign({}, allOn, { stock_management: false });
assert(!Shell.isNavItemVisible(invStock, stockMgmtOff), 'stock_management off hides hub');
assert(!Shell.isNavItemVisible(invHome, stockMgmtOff), 'stock_management off hides Overview');

assert(Features.PHASE_HIDE_STOCK_MANAGEMENT, 'shop UX phase-hides Stock Management');
assert(Features.SHOP_OWNER_UX, 'SHOP_OWNER_UX is on');
assert(!Features.isModuleAvailable('stock_management', allOn), 'stock_management gated off in shop UX');

// Pending probe (null registry) — feature modules must NOT be clickable
assert(!Shell.isNavItemVisible(pos, null), 'Pending probe hides feature-gated POS');
assert(Shell.isNavItemVisible(call, null), 'Call sheet visible while probes pending');
assert(!Features.isModuleAvailable('sales', null), 'isModuleAvailable(null) is unavailable');
assert(Features.isModuleAvailable('sales', allOn), 'isModuleAvailable true when enabled');
assert(!Features.isModuleAvailable('sales', salesOff), 'isModuleAvailable false when disabled');
assert(Features.FEATURE_MODULES.indexOf('inventory') !== -1, 'FEATURE_MODULES lists inventory');
assert(Features.FEATURE_MODULES.indexOf('stock_management') !== -1, 'FEATURE_MODULES lists stock_management');

// ── Owner sees plans/settings / inventory adjust ──
storage.gfp_access_token = fakeJwt({
  role: 'Owner',
  perm: receptionistPerms.concat([
    'plans.manage', 'settings.manage', 'reports.financial.view',
    'inventory.manage', 'inventory.adjust', 'inventory.purchase', 'inventory.transfer'
  ])
});
storage.gfp_user = JSON.stringify({ role: 'Owner' });
assert(Shell.isNavItemVisible(plans, allOn), 'Owner sees Plans');
assert(Shell.isNavItemVisible(activities, allOn), 'Owner sees Activities');
assert(Shell.isNavItemVisible(settings, allOn), 'Owner sees Settings');
assert(Shell.isNavItemVisible(staff, allOn), 'Owner sees Staff');
assert(Shell.isNavItemVisible(roles, allOn), 'Owner sees Roles');
assert(!Shell.isNavItemVisible(invStock, allOn), 'Owner shop UX hides Stock Management hub');
assert(Shell.isNavItemVisible(invProducts, stockMgmtOff), 'Owner Growth packaging keeps Products');

// ── Manager: no plans.manage, not Owner ──
storage.gfp_access_token = fakeJwt({
  role: 'Manager',
  perm: receptionistPerms.concat([
    'reports.financial.view', 'payments.refund.approve', 'memberships.freeze',
    'inventory.manage', 'inventory.adjust', 'inventory.purchase', 'inventory.transfer'
  ])
});
storage.gfp_user = JSON.stringify({ role: 'Manager' });
assert(!Shell.isNavItemVisible(plans, allOn), 'Manager hides Plans (no plans.manage)');
assert(!Shell.isNavItemVisible(activities, allOn), 'Manager hides Activities (no plans.manage)');
assert(!Shell.isNavItemVisible(settings, allOn), 'Manager hides Settings (not Owner)');
assert(!Shell.isNavItemVisible(staff, allOn), 'Manager hides Staff');
assert(!Shell.isNavItemVisible(roles, allOn), 'Manager hides Roles');
assert(!Shell.isNavItemVisible(invStock, allOn), 'Manager shop UX hides Stock Management hub');
// ── Bilingual ──
assert(I18n.pickBilingual('Hello', 'مرحبا', 'ar') === 'مرحبا', 'pickBilingual prefers ar');
assert(I18n.displayBilingualText({ message: 'Open shift', messageAr: 'افتح الوردية' }, 'ar').indexOf('افتح') === 0, 'message/messageAr');
assert(I18n.displayBilingualText('English / العربية', 'ar') === 'العربية', 'slash split');
assert(I18n.displayApiError({ error: { message: 'A / ب' } }, 'ar') === 'ب', 'displayApiError');

// ── Sidebar layout clamp (Task 2) ──
assert(Shell.isDrawerViewport(767) === true, 'drawer below 768');
assert(Shell.isDrawerViewport(768) === false, 'persistent at 768');
assert(Shell.clampSidebarWidth(100, 1400) === 180, 'sidebar min 180');
assert(Shell.clampSidebarWidth(500, 1400) === 360, 'sidebar max 360');
assert(Shell.clampSidebarWidth(220, 1400) === 220, 'default 220 stays');
assert(Shell.clampSidebarWidth(400, 800) === 320, 'max leaves 480px for main');
assert(Shell.getSidebarMaxForViewport(1024) === 360, 'desktop max 360');
assert(Shell.getSidebarMaxForViewport(768) === 288, 'tablet max vw-480');
assert(Shell.canResizeSidebar(800) === true, 'resize when persistent and room');
assert(Shell.canResizeSidebar(700) === false, 'no resize in drawer viewport');

// ── Header CSS (Task 3) ──
var hdrCss = fs.readFileSync(path.join(sharedDir, 'shell-header.css'), 'utf8');
assert(hdrCss.indexOf('@media (min-width: 1024px)') !== -1, 'header keeps desktop row');
assert(hdrCss.indexOf('@media (max-width: 1023px)') !== -1, 'header tablet query');
assert(hdrCss.indexOf('@media (max-width: 767.98px)') !== -1, 'header mobile query');
assert(hdrCss.indexOf('@media (max-width: 479.98px)') !== -1, 'header compact-phone query');
assert(hdrCss.indexOf('.gfp-sb-toggle') !== -1, 'header keeps menu trigger unshrunk');
assert(hdrCss.indexOf('flex: 1 0 100%') !== -1, 'mobile actions move to second row');
assert(typeof Shell.wrapTopbarGym === 'function', 'wrapTopbarGym exported');
assert(typeof Shell.initHeaderLayout === 'function', 'initHeaderLayout exported');

// ── Table layout (Task 5) ──
var tblCss = fs.readFileSync(path.join(sharedDir, 'table-layout.css'), 'utf8');
assert(tblCss.indexOf('.gfp-table-scroll') !== -1, 'table CSS has generated wrap');
assert(tblCss.indexOf('.offers-table-wrap') !== -1, 'table CSS includes offers wrap');
assert(tblCss.indexOf('#tblWrap') !== -1, 'table CSS includes members tblWrap');
assert(tblCss.indexOf('overflow-x: auto !important') !== -1, 'table wrap beats overflow:hidden');
assert(tblCss.indexOf('max-width: 100%') !== -1, 'table wrap cannot exceed parent');
assert(tblCss.indexOf('@media print') !== -1, 'print restores visible overflow');
assert(tblCss.indexOf('white-space: nowrap') !== -1, 'headers stay readable in the scroll row');
assert(typeof Shell.wrapNakedTables === 'function', 'wrapNakedTables exported');
assert(typeof Shell.initTableLayout === 'function', 'initTableLayout exported');
assert(String(Shell.TABLE_WRAP_SEL).indexOf('.gfp-table-scroll') !== -1, 'TABLE_WRAP_SEL lists generated wrap');

var serverSrc = fs.readFileSync(path.join(sharedDir, '..', '..', '..', 'server.js'), 'utf8');
assert(serverSrc.indexOf('/shared/table-layout.css') !== -1, 'server injects table-layout.css');
assert(serverSrc.indexOf('shell.js?v=nav-ia1') !== -1, 'shell cache-bust includes nav IA overhaul');
assert(serverSrc.indexOf('nav.js?v=nav-ia1') !== -1, 'nav cache-bust includes nav IA overhaul');
assert(serverSrc.indexOf('/shared/prepare-gym.js?v=3') !== -1, 'server injects prepare-gym.js');
assert(serverSrc.indexOf('/shared/prepare-gym.css?v=1') !== -1, 'server injects prepare-gym.css');

// ── Form / filter layout (Task 6) ──
var formCss = fs.readFileSync(path.join(sharedDir, 'form-layout.css'), 'utf8');
assert(formCss.indexOf('@media (max-width: 1023px)') !== -1, 'forms keep a tablet query');
assert(formCss.indexOf('@media (max-width: 767.98px)') !== -1, 'forms stack on phone');
assert(formCss.indexOf('grid-template-columns: minmax(0, 1fr)') !== -1, 'phone stacks form columns');
assert(formCss.indexOf('.search-box') !== -1, 'search boxes shrink/wrap');
assert(formCss.indexOf('.filter-bar') !== -1, 'filter bars cannot overflow the page');
assert(formCss.indexOf('.modal-actions') !== -1, 'form actions wrap');
assert(formCss.indexOf('input[type=\'date\']') !== -1, 'date controls stay in the viewport');
assert(formCss.indexOf('flex: 1 1 100%') !== -1, 'phone search uses the full row');
assert(serverSrc.indexOf('/shared/form-layout.css') !== -1, 'server injects form-layout.css');

// ── Modal / dialog layout (Task 7) ──
var modalCss = fs.readFileSync(path.join(sharedDir, 'modal-layout.css'), 'utf8');
assert(modalCss.indexOf('.modal-overlay') !== -1, 'modal CSS targets overlays');
assert(modalCss.indexOf('.modal-ov') !== -1, 'modal CSS includes call-sheet overlays');
assert(modalCss.indexOf('.drawer') !== -1, 'modal CSS includes drawers');
assert(modalCss.indexOf('max-height: min(90vh, 90dvh') !== -1, 'dialogs cannot outgrow the viewport');
assert(modalCss.indexOf('.modal-body') !== -1, 'long content scrolls inside the dialog');
assert(modalCss.indexOf('.modal:has(> .modal-body)') !== -1, 'split chrome only when a body exists');
assert(modalCss.indexOf('@media (max-width: 767.98px)') !== -1, 'modals go full-width on phone');
assert(modalCss.indexOf('dialog:not(.fixed)') !== -1, 'native dialogs stay in the viewport');
assert(modalCss.indexOf('max-width: calc(100vw - 24px)') !== -1, 'dropdowns cannot exceed the viewport');
assert(serverSrc.indexOf('/shared/modal-layout.css') !== -1, 'server injects modal-layout.css');

// ── Full-app responsive sweep (Task 8) ──
var sweepCss = fs.readFileSync(path.join(sharedDir, 'sweep-layout.css'), 'utf8');
assert(sweepCss.indexOf('.toast') !== -1, 'sweep CSS constrains toasts');
assert(sweepCss.indexOf('.tab-nav') !== -1, 'sweep CSS scrolls tab rails');
assert(sweepCss.indexOf('.empty-state') !== -1, 'sweep CSS covers empty states');
assert(sweepCss.indexOf('.pay-leg') !== -1, 'sweep CSS stacks POS payment rows');
assert(sweepCss.indexOf('@media (max-width: 767.98px)') !== -1, 'sweep CSS has phone rules');
assert(sweepCss.indexOf('.page-title') !== -1, 'sweep CSS constrains page titles');
assert(sweepCss.indexOf('.heatmap-wrap') !== -1, 'sweep CSS constrains heatmaps');
assert(serverSrc.indexOf('/shared/sweep-layout.css') !== -1, 'server injects sweep-layout.css');

(function () {
  function makeEl(className) {
    return {
      className: className || '',
      classList: {
        contains: function (name) {
          return (' ' + (className || '') + ' ').indexOf(' ' + name + ' ') !== -1;
        }
      },
      style: { overflowX: '' },
      parentNode: null,
      parentElement: null,
      children: [],
      getAttribute: function () { return ''; },
      insertBefore: function (node, ref) {
        node.parentNode = this;
        node.parentElement = this;
        var idx = this.children.indexOf(ref);
        if (idx < 0) this.children.push(node);
        else this.children.splice(idx, 0, node);
        return node;
      },
      appendChild: function (ch) {
        ch.parentNode = this;
        ch.parentElement = this;
        this.children.push(ch);
        return ch;
      }
    };
  }

  function attachClosest(el) {
    el.closest = function (sel) {
      var parts = String(sel).split(',');
      var node = el;
      while (node) {
        for (var i = 0; i < parts.length; i++) {
          var s = parts[i].trim();
          var cn = ' ' + (node.className || '') + ' ';
          if (s.charAt(0) === '.' && cn.indexOf(' ' + s.slice(1) + ' ') !== -1) return node;
          if (s.charAt(0) === '#' && node.id === s.slice(1)) return node;
        }
        node = node.parentElement;
      }
      return null;
    };
  }

  var content = makeEl('content');
  var table = makeEl('');
  table.tagName = 'TABLE';
  table.nodeName = 'TABLE';
  content.children = [table];
  table.parentNode = content;
  table.parentElement = content;
  attachClosest(content);
  attachClosest(table);

  var created = [];
  var origCreate = sandbox.document.createElement;
  var origQsa = sandbox.document.querySelectorAll;
  sandbox.document.createElement = function (tag) {
    var el = makeEl('');
    el.tagName = String(tag).toUpperCase();
    created.push(el);
    attachClosest(el);
    return el;
  };
  sandbox.document.querySelectorAll = function (sel) {
    if (sel === 'table') return [table];
    return [];
  };
  sandbox.getComputedStyle = function () { return { overflowX: 'visible' }; };

  var n = Shell.wrapNakedTables();
  assert(n === 1, 'wraps a table that has no scroll parent');
  assert(created.length === 1 && created[0].className === 'gfp-table-scroll', 'uses gfp-table-scroll');
  assert(created[0].children.indexOf(table) !== -1, 'moves the table into the wrap');

  n = Shell.wrapNakedTables();
  assert(n === 0, 'does not wrap a table already inside gfp-table-scroll');

  var card = makeEl('tbl-card');
  var inner = makeEl('');
  inner.tagName = 'TABLE';
  inner.nodeName = 'TABLE';
  card.children = [inner];
  inner.parentNode = card;
  inner.parentElement = card;
  attachClosest(card);
  attachClosest(inner);
  sandbox.document.querySelectorAll = function (sel) {
    if (sel === 'table') return [inner];
    return [];
  };
  assert(Shell.wrapNakedTables() === 0, 'leaves tables inside tbl-card alone');

  var side = makeEl('sidebar');
  side.id = 'sidebar';
  var navTable = makeEl('');
  navTable.tagName = 'TABLE';
  navTable.nodeName = 'TABLE';
  side.children = [navTable];
  navTable.parentNode = side;
  navTable.parentElement = side;
  attachClosest(side);
  attachClosest(navTable);
  sandbox.document.querySelectorAll = function (sel) {
    if (sel === 'table') return [navTable];
    return [];
  };
  assert(Shell.wrapNakedTables() === 0, 'does not wrap tables in the sidebar');

  sandbox.document.createElement = origCreate;
  sandbox.document.querySelectorAll = origQsa;
})();

(function () {
  var gymEn = { id: 'gymName', className: 'gym-name', parentNode: null };
  var gymAr = { id: 'gymNameAr', className: 'gym-name-ar', parentNode: null };
  var wrapCreated = null;
  var right = {
    querySelector: function (sel) {
      if (String(sel).indexOf('gfp-tb-gym') !== -1) return wrapCreated;
      if (sel === '#gymName' || sel === '.tb-gym-name' || sel === '.gym-name') return gymEn;
      if (sel === '#gymNameAr' || sel === '.tb-gym-name-ar' || sel === '.gym-name-ar') return gymAr;
      return null;
    },
    children: [gymEn, gymAr],
    insertBefore: function (node) {
      node.parentNode = this;
      this.children.unshift(node);
      wrapCreated = node;
      return node;
    }
  };
  gymEn.parentNode = right;
  gymAr.parentNode = right;
  var origQS = sandbox.document.querySelector;
  sandbox.document.querySelector = function (sel) {
    if (sel === '.topbar .tb-right' || sel === '.topbar') return right;
    return origQS.apply(sandbox.document, arguments);
  };
  sandbox.document.createElement = function () {
    return {
      className: '',
      children: [],
      appendChild: function (ch) {
        ch.parentNode = this;
        this.children.push(ch);
        return ch;
      }
    };
  };
  Shell.wrapTopbarGym();
  assert(!!wrapCreated && wrapCreated.className === 'gfp-tb-gym', 'wraps sibling gym names');
  assert(wrapCreated.children.indexOf(gymEn) !== -1 && wrapCreated.children.indexOf(gymAr) !== -1, 'gym names moved into wrap');
})();

console.log('All Prompt 2 self-tests passed.');
