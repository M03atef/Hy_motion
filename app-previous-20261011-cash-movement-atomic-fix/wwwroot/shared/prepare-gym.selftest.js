/**
 * Prepare Your Gym checklist — completion, skip/resume, role gating.
 * Run: node src/app/shared/prepare-gym.selftest.js  (from apps/web)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const storage = {};
const sandbox = {
  console: console,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  },
  sessionStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  document: {
    documentElement: {
      getAttribute: function () { return 'local'; }
    }
  },
  location: { search: '' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, 'prepare-gym.js'), 'utf8'),
  sandbox,
  { filename: 'prepare-gym.js' }
);

const PG = sandbox.GfpPrepareGym;
assert(!!PG, 'GfpPrepareGym attached');

const seed = [
  { name: 'Monthly Unlimited', price: 500, isActive: true },
  { name: 'Session Pack 20', price: 800, isActive: true },
  { name: 'Morning Pass', price: 300, isActive: true }
];

assert(PG.looksLikeSeedTemplates(seed), 'seed templates detected');
assert(!PG.hasUsablePlan([]) , 'no plans is incomplete');
assert(PG.hasUsablePlan(seed), 'seed plans are usable after review');

const owner = { role: 'Owner', tenantId: 'gym-1' };
const manager = { role: 'Manager', tenantId: 'gym-1' };
const receptionist = { role: 'Receptionist', tenantId: 'gym-1' };

assert(PG.shouldShow({ edition: 'Local', user: owner }), 'Owner sees Prepare Gym on Local');
assert(PG.shouldShow({ edition: 'Local', user: manager }), 'Manager sees Prepare Gym on Local');
assert(!PG.shouldShow({ edition: 'Local', user: receptionist }), 'Receptionist does not see Prepare Gym');
assert(!PG.shouldShow({ edition: 'SaaS', user: owner }), 'SaaS owner does not see Prepare Gym');

function fakeAuthz(role, perms) {
  return {
    useCan: function (need) {
      const list = Array.isArray(need) ? need : [need];
      return list.some(function (p) { return perms.indexOf(p) !== -1; });
    },
    useCanRole: function (policy) {
      if (policy === 'OwnerOnly') return role === 'Owner';
      if (policy === 'ManagerOrAbove') return role === 'Owner' || role === 'Manager';
      return true;
    },
    canPermission: function (_t, v) { return this.useCan(v); }
  };
}

const ownerAuthz = fakeAuthz('Owner', [
  'plans.manage', 'memberships.assign', 'shift.open', 'members.create',
  'members.view', 'sales.sell', 'checkin.manual'
]);

let empty = PG.deriveChecklist({
  plans: seed,
  staff: [{ role: 'Owner', isActive: true }],
  currentShift: null,
  shifts: [],
  members: [],
  invoices: [],
  todayAttendance: [],
  prefs: { plansReviewed: false },
  user: owner,
  Authz: ownerAuthz
});
assert(empty.total === 6, 'Owner sees 6 first-hour steps');
assert(empty.done === 0, 'seed plans without review are not complete');
assert(empty.next && empty.next.id === 'plans', 'first incomplete step is plans');

empty = PG.deriveChecklist({
  plans: seed,
  staff: [{ role: 'Owner', isActive: true }],
  currentShift: null,
  shifts: [],
  members: [],
  invoices: [],
  todayAttendance: [],
  prefs: { plansReviewed: true },
  user: owner,
  Authz: ownerAuthz
});
assert(empty.steps.find(function (s) { return s.id === 'plans'; }).complete, 'explicit review completes plans');
assert(empty.next && empty.next.id === 'staff', 'next is staff after plans');
assert(!PG.hasFrontDeskStaff([{ role: 'Owner', isActive: true }]), 'Owner alone is not front-desk staff');

const receptionistStaff = [{ role: 'Receptionist', isActive: true, fullName: 'Nour' }];
assert(PG.hasFrontDeskStaff(receptionistStaff), 'active receptionist completes staff');
assert(!PG.hasFrontDeskStaff([{ role: 'Receptionist', isActive: false }]), 'inactive receptionist does not count');

assert(PG.hasOpenedShift({ id: 's1', status: 'open' }, []), 'current shift completes shift');
assert(PG.hasOpenedShift(null, { items: [{ id: 'hist' }] }), 'any listed shift completes shift');
assert(!PG.hasOpenedShift(null, { items: [] }), 'no shift is incomplete');

assert(PG.hasMember({ items: [{ id: 'm1' }] }), 'member list completes member');
assert(!PG.hasMember({ items: [] }), 'empty members incomplete');

assert(!PG.hasMembershipSale({ items: [{ id: 'm1', membershipStatus: 'none' }] }, []), 'no sale when membership none');
assert(PG.hasMembershipSale({ items: [{ id: 'm1', membershipStatus: 'active', activePlan: 'Monthly' }] }, []), 'active plan is a sale');
assert(PG.hasMembershipSale({ items: [] }, { items: [{ id: 'inv1' }] }), 'membership invoice is a sale');

assert(PG.hasCheckin([{ id: 'a1' }], false), 'today attendance completes check-in');
assert(PG.hasCheckin([], true), 'observed check-in persists after today list is empty');
assert(!PG.hasCheckin([], false), 'no check-in is incomplete');

const ready = PG.deriveChecklist({
  plans: [{ name: 'Gold', price: 900, isActive: true }],
  staff: receptionistStaff,
  currentShift: { id: 's1' },
  shifts: { items: [{ id: 's1' }] },
  members: { items: [{ id: 'm1', membershipStatus: 'active', activePlan: 'Gold' }] },
  invoices: { items: [{ id: 'i1' }] },
  todayAttendance: [{ id: 'a1' }],
  prefs: {},
  user: owner,
  Authz: ownerAuthz
});
assert(ready.complete, 'all real state completes the checklist');
assert(ready.done === 6 && ready.total === 6, '6/6 when gym is operating');
assert(!ready.templates, 'custom plan is not a seed template');

const editedSeed = PG.deriveChecklist({
  plans: [{ name: 'Monthly Unlimited', price: 750, isActive: true }],
  staff: [],
  prefs: { plansReviewed: false },
  user: owner,
  Authz: ownerAuthz
});
assert(editedSeed.steps.find(function (s) { return s.id === 'plans'; }).complete, 'changed seed price counts as configured');

PG.savePrefs({ dismissed: true, plansReviewed: true }, { user: owner });
const prefs = PG.loadPrefs({ user: owner });
assert(prefs.dismissed === true, 'skip persists in gym-scoped storage');
assert(prefs.plansReviewed === true, 'review persists');

PG.patchPrefs({ dismissed: false }, { user: owner });
assert(PG.loadPrefs({ user: owner }).dismissed === false, 'resume clears skip');
assert(PG.loadPrefs({ user: owner }).plansReviewed === true, 'resume keeps review');

const otherGym = PG.loadPrefs({ user: { role: 'Owner', tenantId: 'gym-2' } });
assert(otherGym.plansReviewed === false, 'prefs are gym-scoped (resume after login on another gym is independent)');

const managerAuthz = fakeAuthz('Manager', [
  'shift.open', 'members.create', 'members.view', 'sales.sell', 'checkin.manual', 'memberships.assign'
]);
const mgr = PG.deriveChecklist({
  plans: seed,
  staff: [],
  prefs: { plansReviewed: true },
  user: manager,
  Authz: managerAuthz
});
assert(!mgr.steps.some(function (s) { return s.id === 'staff'; }), 'Manager does not see Owner-only staff step');
assert(mgr.steps.some(function (s) { return s.id === 'shift'; }), 'Manager still sees shift step');

const recAuthz = fakeAuthz('Receptionist', ['members.view', 'sales.sell', 'shift.open', 'checkin.manual']);
const rec = PG.deriveChecklist({
  plans: seed,
  user: receptionist,
  Authz: recAuthz
});
assert(!rec.steps.some(function (s) { return s.id === 'plans'; }), 'Receptionist without plans.manage hides plans step');
assert(!rec.steps.some(function (s) { return s.id === 'staff'; }), 'Receptionist hides staff step');

const html = fs.readFileSync(path.join(__dirname, '..', '(dashboard)', 'members', 'index.html'), 'utf8');
assert(html.indexOf('cannot use membership-based check-in') !== -1, 'skip-membership explains check-in limit');
assert(html.indexOf('Open a cash shift first') !== -1, 'onboard payment teaches shift-before-cash');

const modals = fs.readFileSync(path.join(__dirname, '..', '(dashboard)', 'members', 'member-modals.js'), 'utf8');
assert(modals.indexOf('cannot use membership-based check-in') !== -1, 'skip confirm uses real-membership warning');
assert(modals.indexOf('/dashboard/shifts/') !== -1, 'cash-without-shift links to shift screen');

const posHtml = fs.readFileSync(path.join(__dirname, '..', '(dashboard)', 'pos', 'index.html'), 'utf8');
assert(posHtml.indexOf('Open a cash shift first') !== -1, 'POS shift gate explains cash-before-sale');
assert(posHtml.indexOf('/dashboard/shifts/') !== -1, 'POS shift gate links to Current Shift');

const nav = fs.readFileSync(path.join(__dirname, 'nav.js'), 'utf8');
assert(nav.indexOf("key: 'core'") !== -1, 'Front Desk/core category exists');
assert(nav.indexOf("key: 'catalog'") !== -1, 'Catalog & Inventory category exists');
assert(nav.indexOf("key: 'tools'") !== -1, 'Tools category exists');
assert(nav.indexOf('defaultCollapsed: true') !== -1, 'Catalog/Tools collapse by default (progressive disclosure)');
assert(nav.indexOf("key: 'members'") !== -1 && nav.indexOf("path: '/dashboard/members/'") !== -1, 'Members route unchanged');
// Test host element resolution (string ID, element object, invalid host)
(async function testHostResolution() {
  const dummyEl = { innerHTML: '', querySelectorAll: function () { return []; } };
  sandbox.document.getElementById = function (id) {
    if (id === 'prepareGymHost') return dummyEl;
    return null;
  };

  // String host ID resolution
  await PG.mount('prepareGymHost', { edition: 'Local', user: owner, snapshot: { plans: [], staff: [], shifts: [], members: [], invoices: [], todayAttendance: [] } });
  assert(dummyEl.innerHTML.length > 0, 'mount works with string host ID');

  // String host ID that does not exist
  const nullResult = await PG.mount('nonExistentHost', { edition: 'SaaS' });
  assert(nullResult === null, 'mount gracefully handles non-existent host string without error');
})();

console.log('apps/web prepare-gym.selftest: OK (completion, skip/resume, roles, cash/skip copy, nav IA, host resolution)');

