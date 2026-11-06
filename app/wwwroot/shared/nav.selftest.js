/**
 * Four fixture JWTs → assert filtered NavCategory[] keys.
 * Run: node src/app/shared/nav.selftest.js
 * (from apps/web)
 *
 * Fixtures mirror DefaultPermissionProvider (+ Local modules on).
 * Receptionist HR claims exist but HR nav is excludeRoles-gated (API unchanged).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fixtureToken(role, perms) {
  return (
    b64url({ alg: 'none', typ: 'JWT' }) +
    '.' +
    b64url({ role: role, perm: perms }) +
    '.sig'
  );
}

const INV_VIEW = 'inventory.view';
const INV_MANAGE = 'inventory.manage';
const INV_ADJUST = 'inventory.adjust';
const INV_PURCHASE = 'inventory.purchase';
const INV_TRANSFER = 'inventory.transfer';

const HR_PERMS = [
  'hr.view',
  'hr.manage',
  'hr.shifts.manage',
  'hr.attendance.manage',
  'hr.attendance.view',
  'hr.leave.view',
  'hr.leave.manage',
  'hr.payroll.view',
  'hr.payroll.manage'
];

const ALL_PERMS = [
  'members.view',
  'members.create',
  'members.edit',
  'checkin.manual',
  'classes.view',
  'attendance.view',
  'sales.sell',
  'sales.discount.apply',
  'sales.discount.override',
  'payments.cash.accept',
  'payments.refund.request',
  'payments.refund.approve',
  'shift.open',
  'shift.close',
  'shift.reconcile.approve',
  'memberships.freeze',
  'plans.manage',
  'reports.financial.view',
  'reports.expenses.view',
  'reports.expenses.manage',
  'settings.manage',
  INV_VIEW,
  INV_MANAGE,
  INV_ADJUST,
  INV_PURCHASE,
  INV_TRANSFER,
  'member_orders.view',
  'member_orders.manage'
].concat(HR_PERMS);

const FRONT_DESK_KEYS = [
  'shifts',
  'members',
  'attendance',
  'pos',
  'call-sheet',
  'classes',
  'member-orders',
  'access-cards'
];
const BUSINESS_OWNER_KEYS = ['plans', 'invoices', 'expenses', 'reports', 'z-report'];
const BUSINESS_MANAGER_KEYS = ['invoices', 'expenses', 'reports', 'z-report'];
const PEOPLE_HR_OWNER = [
  'hr-employees',
  'hr-departments',
  'hr-positions',
  'hr-attendance',
  'hr-schedule',
  'hr-leaves',
  'hr-payroll'
];
// Manager: All perms minus plans.manage + settings.manage — has hr.leave.view, hr.payroll.view
const PEOPLE_HR_MANAGER = PEOPLE_HR_OWNER.slice();
const CATALOG_OWNER = [
  'inv-products',
  'inv-suppliers',
  'inv-purchase-orders'
];
const CATALOG_MANAGER = CATALOG_OWNER.slice();
const TOOLS_OWNER = [
  'activities',
  'invitations',
  'hr-biometric-devices',
  'imports'
];
const TOOLS_MANAGER = [
  'invitations',
  'hr-biometric-devices'
];

const SYSTEM_OWNER_KEYS = ['notifications', 'staff', 'roles', 'audit', 'settings', 'backup'];

const FIXTURES = {
  Owner: { role: 'Owner', perms: ALL_PERMS.slice() },
  Manager: {
    role: 'Manager',
    perms: ALL_PERMS.filter(function (p) {
      return p !== 'plans.manage' && p !== 'settings.manage';
    })
  },
  Trainer: {
    role: 'Trainer',
    perms: ['checkin.manual', 'classes.view', 'attendance.view']
  },
  Receptionist: {
    role: 'Receptionist',
    // Mirrors DefaultPermissionProvider Receptionist (incl. HR claims).
    perms: [
      'members.view',
      'members.create',
      'members.edit',
      'checkin.manual',
      'classes.view',
      'attendance.view',
      'sales.sell',
      'sales.discount.apply',
      'payments.cash.accept',
      'payments.refund.request',
      'shift.open',
      'shift.close',
      INV_VIEW,
      'member_orders.view',
      'member_orders.manage',
      'hr.view',
      'hr.attendance.manage',
      'hr.attendance.view'
    ]
  }
};

function loadShared() {
  const dir = __dirname;
  const sandbox = {
    console: console,
    atob: function (s) {
      return Buffer.from(s, 'base64').toString('binary');
    },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    document: { readyState: 'complete', addEventListener: function () {} },
    location: { pathname: '/dashboard/', href: '', replace: function () {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  function run(file) {
    const code = fs.readFileSync(path.join(dir, file), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: file });
  }

  run('authz.js');
  run('features.js');
  run('nav.js');

  sandbox.GfpFeatures.isModuleAvailable = function (key, registry) {
    if (!key) return true;
    if (key === 'stock_management' && sandbox.GfpFeatures.PHASE_HIDE_STOCK_MANAGEMENT) return false;
    if (key === 'offers') return !sandbox.GfpFeatures.PHASE_HIDE_OFFERS;
    if (registry == null) return false;
    return !!registry[key];
  };

  return sandbox;
}

function shape(cats) {
  const out = {};
  cats.forEach(function (c) {
    out[c.key] = c.items.map(function (i) {
      return i.key;
    });
  });
  return out;
}

function assertShape(label, actual, expected) {
  const aKeys = Object.keys(actual).sort();
  const eKeys = Object.keys(expected).sort();
  assert(
    aKeys.join(',') === eKeys.join(','),
    label +
      ': categories\n  got:  ' +
      aKeys.join(',') +
      '\n  want: ' +
      eKeys.join(',')
  );
  eKeys.forEach(function (k) {
    assert(
      (actual[k] || []).join(',') === expected[k].join(','),
      label +
        ': ' +
        k +
        '\n  got:  ' +
        (actual[k] || []).join(',') +
        '\n  want: ' +
        expected[k].join(',')
    );
  });
}

function runFixture(name, modulesOn) {
  const sandbox = loadShared();
  const f = FIXTURES[name];
  const token = fixtureToken(f.role, f.perms);
  sandbox.localStorage.getItem = function (k) {
    if (k === 'gfp_access_token') return token;
    if (k === 'gfp_user') return JSON.stringify({ role: f.role, fullName: name });
    return null;
  };
  const registry = {};
  (sandbox.GfpFeatures.FEATURE_MODULES || []).forEach(function (k) {
    registry[k] = modulesOn(k);
  });
  return shape(
    sandbox.GfpNav.useVisibleNav(registry, {
      accessToken: token,
      role: f.role
    })
  );
}

const ALL_ON = function () {
  return true;
};

assert(
  (loadShared().GfpFeatures.FEATURE_MODULES || []).indexOf('inventory') !== -1,
  'FEATURE_MODULES includes inventory'
);
assert(
  (loadShared().GfpFeatures.FEATURE_MODULES || []).indexOf('stock_management') !== -1,
  'FEATURE_MODULES includes stock_management'
);
assert(
  (loadShared().GfpFeatures.FEATURE_MODULES || []).indexOf('hr') !== -1,
  'FEATURE_MODULES includes hr'
);

// ── Category label assertions ──
{
  const cats = loadShared().GfpNav.NAV_CATEGORIES;
  const home = cats.find(function (c) { return c.key === 'overview'; });
  const core = cats.find(function (c) { return c.key === 'core'; });
  const biz = cats.find(function (c) { return c.key === 'management'; });
  assert(home && home.label === 'Home', 'Home category label');
  assert(core && core.label === 'Front Desk', 'Front Desk category label');
  assert(biz && biz.label === 'Business & Finance', 'Business & Finance category label');
  assert(biz && biz.labelAr === 'الأعمال والمالية', 'Business & Finance AR label');
  const people = cats.find(function (c) { return c.key === 'people'; });
  assert(people && people.label === 'People & HR', 'People & HR category label');
  const catalog = cats.find(function (c) { return c.key === 'catalog'; });
  assert(catalog && catalog.label === 'Catalog & Inventory', 'Catalog & Inventory category label');
  const tools = cats.find(function (c) { return c.key === 'tools'; });
  assert(tools && tools.label === 'Tools', 'Tools category label');
  const admin = cats.find(function (c) { return c.key === 'administration'; });
  assert(admin && admin.label === 'System' && admin.labelAr === 'النظام', 'System AR label');
}

// ── Shape assertions ──
assertShape('Owner', runFixture('Owner', ALL_ON), {
  overview: ['dashboard'],
  core: FRONT_DESK_KEYS.slice(),
  management: BUSINESS_OWNER_KEYS.slice(),
  people: PEOPLE_HR_OWNER.slice(),
  catalog: CATALOG_OWNER.slice(),
  tools: TOOLS_OWNER.slice(),
  administration: SYSTEM_OWNER_KEYS.slice()
});

assertShape('Manager', runFixture('Manager', ALL_ON), {
  overview: ['dashboard'],
  core: FRONT_DESK_KEYS.slice(),
  management: BUSINESS_MANAGER_KEYS.slice(),
  people: PEOPLE_HR_MANAGER.slice(),
  catalog: CATALOG_MANAGER.slice(),
  tools: TOOLS_MANAGER.slice(),
  administration: ['notifications']
});

assertShape('Trainer', runFixture('Trainer', ALL_ON), {
  overview: ['dashboard'],
  core: ['attendance', 'classes'],
  administration: ['notifications']
});

// Receptionist: hr-attendance visible (Receptionists check employees in/out at the desk)
assertShape('Receptionist', runFixture('Receptionist', ALL_ON), {
  overview: ['dashboard'],
  core: FRONT_DESK_KEYS.slice(),
  people: ['hr-attendance'],
  tools: ['invitations'],
  administration: ['notifications']
});

// Receptionist: most HR nav excluded except hr-attendance; no finance Reports
{
  const actual = runFixture('Receptionist', ALL_ON);
  const people = actual.people || [];
  assert(!actual.management, 'Receptionist has no Business category without financial.view');
  assert(people.length === 1 && people[0] === 'hr-attendance', 'Receptionist sees only Employee Attendance in People & HR');
  assert(!(actual.catalog || []).length, 'Receptionist has no Catalog & Inventory');
}

// FEATURE_DISABLED sales — POS hidden from Front Desk; Call Sheet stays
{
  const actual = runFixture('Receptionist', function (k) {
    return k !== 'sales';
  });
  assert(!actual.core.includes('pos'), 'sales flag hides Sales');
  assert(actual.core.includes('call-sheet'), 'Call Sheet never flag-gated');
  assert(!actual.core.includes('debtors'), 'Debtors is not a primary nav module');
  assert(!actual.management || !actual.management.includes('offers'), 'Offers stays hidden');
}

// Offers paused
{
  const onFixture = runFixture('Owner', ALL_ON);
  assert(!onFixture.management.includes('offers'), 'Offers hidden in pilot phase with all flags on');
}

// FEATURE_DISABLED inventory
{
  const actual = runFixture('Owner', function (k) {
    return k !== 'inventory';
  });
  assert(!(actual.catalog || []).length, 'inventory flag off hides Catalog & Inventory category');
  assert(actual.management && actual.management.includes('plans'), 'Plans stays in Business when inventory off');
}

// Growth packaging: inventory on, stock_management off
{
  const actual = runFixture('Owner', function (k) {
    return k !== 'stock_management';
  });
  assert(
    actual.catalog && actual.catalog.join(',') === CATALOG_OWNER.join(','),
    'Shop UX Catalog = Products + Suppliers + Purchases (no stock hub)'
  );
}

// Claims over role name — Plans in Business; Staff/Roles stay OwnerOnly; HR still excluded for Receptionist (except attendance)
{
  const sandbox = loadShared();
  const token = fixtureToken('Receptionist', ALL_PERMS.slice());
  const registry = {};
  sandbox.GfpFeatures.FEATURE_MODULES.forEach(function (k) {
    registry[k] = true;
  });
  const cats = sandbox.GfpNav.useVisibleNav(registry, {
    accessToken: token,
    role: 'Receptionist'
  });
  const core = cats.find(function (c) {
    return c.key === 'core';
  });
  const management = cats.find(function (c) {
    return c.key === 'management';
  });
  assert(management && management.items.some(function (i) {
    return i.key === 'plans';
  }), 'plans.manage claim shows Plans in Business regardless of role name');
  const tools = cats.find(function (c) {
    return c.key === 'tools';
  });
  assert(tools && tools.items.some(function (i) {
    return i.key === 'activities';
  }), 'plans.manage claim shows Activities in Tools');
  const people = cats.find(function (c) {
    return c.key === 'people';
  });
  assert(people && people.items.some(function (i) {
    return i.key === 'hr-attendance';
  }), 'Receptionist sees Employee Attendance');
  assert(people && !people.items.some(function (i) {
    return i.key === 'hr-employees';
  }), 'Receptionist excluded from Employees');
  assert(people && !people.items.some(function (i) {
    return i.key === 'hr-payroll';
  }), 'Receptionist excluded from Payroll');
  const catalog = cats.find(function (c) {
    return c.key === 'catalog';
  });
  assert(catalog && catalog.items.some(function (i) {
    return i.key === 'inv-products';
  }), 'full inventory perms still show Products in Catalog');
  assert(
    core && !core.items.some(function (i) {
      return i.key === 'staff';
    }),
    'Staff stays OwnerOnly even with full perms'
  );
  const admin = cats.find(function (c) {
    return c.key === 'administration';
  });
  assert(
    admin && !admin.items.some(function (i) {
      return i.key === 'roles';
    }),
    'Roles stays OwnerOnly even with full perms'
  );
  assert(
    admin && !admin.items.some(function (i) {
      return i.key === 'staff';
    }),
    'Staff stays OwnerOnly in System'
  );
}

function landingFor(name, modulesOn) {
  const sandbox = loadShared();
  const f = FIXTURES[name];
  const token = fixtureToken(f.role, f.perms);
  const registry = {};
  (sandbox.GfpFeatures.FEATURE_MODULES || []).forEach(function (k) {
    registry[k] = modulesOn(k);
  });
  const cats = sandbox.GfpNav.useVisibleNav(registry, {
    accessToken: token,
    role: f.role
  });
  return sandbox.GfpNav.getDefaultLandingPath(cats);
}

assert(landingFor('Owner', ALL_ON) === '/dashboard/', 'Owner lands Dashboard');
assert(landingFor('Manager', ALL_ON) === '/dashboard/', 'Manager lands Dashboard');
assert(landingFor('Trainer', ALL_ON) === '/dashboard/', 'Trainer lands Dashboard (first of Home)');
assert(landingFor('Receptionist', ALL_ON) === '/dashboard/', 'Receptionist lands Dashboard');

// Empty claims → overview only
{
  const sandbox = loadShared();
  const token = fixtureToken('Receptionist', []);
  const registry = {};
  sandbox.GfpFeatures.FEATURE_MODULES.forEach(function (k) {
    registry[k] = true;
  });
  const cats = sandbox.GfpNav.useVisibleNav(registry, {
    accessToken: token,
    role: 'Receptionist'
  });
  assert(cats.length >= 1, 'AnyStaff still has Home even with zero perms');
  assert(sandbox.GfpNav.getDefaultLandingPath(cats) === '/dashboard/', 'zero-perm staff lands Dashboard');
}

// Member role → empty
{
  const sandbox = loadShared();
  const token = fixtureToken('Member', []);
  const registry = {};
  sandbox.GfpFeatures.FEATURE_MODULES.forEach(function (k) {
    registry[k] = true;
  });
  const cats = sandbox.GfpNav.useVisibleNav(registry, {
    accessToken: token,
    role: 'Member'
  });
  assert(cats.length === 0, 'Member role yields empty visible nav');
  assert(sandbox.GfpNav.getDefaultLandingPath(cats) === null, 'empty nav → null landing');
}

// ── Collapse defaults ──
{
  const cats = loadShared().GfpNav.NAV_CATEGORIES;
  const catalog = cats.find(function (c) { return c.key === 'catalog'; });
  const tools = cats.find(function (c) { return c.key === 'tools'; });
  const admin = cats.find(function (c) { return c.key === 'administration'; });
  const core = cats.find(function (c) { return c.key === 'core'; });
  const people = cats.find(function (c) { return c.key === 'people'; });
  assert(catalog && catalog.defaultCollapsed, 'Catalog & Inventory starts collapsed');
  assert(tools && tools.defaultCollapsed, 'Tools starts collapsed');
  assert(admin && !admin.defaultCollapsed, 'System is NOT collapsed (Notifications visible)');
  assert(core && !core.defaultCollapsed, 'Front Desk stays expanded');
  assert(people && !people.defaultCollapsed, 'People & HR stays expanded');
}

console.log('apps/web nav.selftest: OK (Home/Front Desk/Business & Finance/People & HR/Catalog/Tools/System + HR exclude + landing)');

