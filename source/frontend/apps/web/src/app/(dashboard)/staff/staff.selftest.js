/**
 * Staff rules self-check. Run: node src/app/(dashboard)/staff/staff.selftest.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

var code = fs.readFileSync(path.join(__dirname, 'staff-rules.js'), 'utf8');
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox, { filename: 'staff-rules.js' });
var R = sandbox.GfpStaffRules;

assert(R.PASSWORD_POLICY.minLength === 6, 'password min length is 6 (Identity)');
assert(R.PASSWORD_POLICY.requireSpecial === false, 'special character is optional');
assert(R.passwordMeetsPolicy('Passw0rd') === true, 'Passw0rd meets backend policy');
assert(R.passwordMeetsPolicy('Passw0rd!') === true, 'special char still allowed');
assert(R.passwordMeetsPolicy('passw0rd') === false, 'missing uppercase fails');
assert(R.passwordMeetsPolicy('PASSWORD1') === false, 'missing lowercase fails');
assert(R.passwordMeetsPolicy('Password') === false, 'missing digit fails');
assert(R.passwordMeetsPolicy('Pw0rd') === false, '5 chars fail');

assert(R.canonicalRole('manager') === 'Manager', 'lowercase manager → Manager');
assert(R.canonicalRole('RECEPTIONIST') === 'Receptionist', 'upper receptionist → Receptionist');
assert(R.isOwnerRole('Owner') && R.isOwnerRole('owner'), 'Owner detection');
assert(R.isOwnerRole('OWNER') && R.isOwnerRole(' Owner '), 'Owner detection ignores case/space');
assert(R.isOwnerRole(['Owner']) && !R.isOwnerRole('Manager'), 'Owner detection from role array');
assert(R.isCreatableRole('Trainer') && !R.isCreatableRole('Owner') && !R.isCreatableRole('Member'), 'creatable roles');

assert(R.formatLastLogin(null).text === 'Never logged in', 'null last login');
assert(R.formatLastLogin(undefined).cls === 'never', 'undefined last login');
assert(R.formatLastLogin('not-a-date').text === 'Never logged in', 'invalid last login');
assert(R.parseApiUtc('2026-08-26T17:28:00').getTime() === R.parseApiUtc('2026-08-26T17:28:00Z').getTime(),
  'UTC without Z treated as UTC');

var rec = R.permissionsForRole('Receptionist');
assert(rec.indexOf('members.view') !== -1, 'receptionist has members.view');
assert(rec.indexOf('member_orders.manage') !== -1, 'receptionist has member_orders.manage');
assert(rec.indexOf('plans.manage') === -1, 'receptionist does not have plans.manage');
assert(rec.indexOf('settings.manage') === -1, 'receptionist does not have settings.manage');

var trainer = R.permissionsForRole('Trainer');
assert(
  trainer.length === 3 && trainer.indexOf('checkin.manual') !== -1 &&
    trainer.indexOf('classes.view') !== -1 && trainer.indexOf('attendance.view') !== -1,
  'trainer is check-in, classes and attendance view only'
);

var owner = R.permissionsForRole('Owner');
assert(owner.indexOf('inventory.transfer') !== -1, 'owner has inventory.transfer once');
assert(owner.filter(function (p) { return p === 'inventory.transfer'; }).length === 1, 'no duplicate inventory.transfer');

assert(R.STAFF_ROLES.join(',') === 'Owner,Manager,Receptionist,Trainer', 'staff roles order; Member omitted');
assert(R.STAFF_ROLES.indexOf('Member') === -1, 'Member is not a staff role on the viewer');
assert(!R.isStaffRole('Member') && R.isStaffRole('Owner'), 'isStaffRole hides Member');

assert(R.permissionUniverseCount() === 41, 'universe is Permissions.All (41)');
assert(R.permissionCount('Owner') === 41, 'Owner count derived = 41');
assert(R.permissionCount('Manager') === 39, 'Manager count derived = 39');
assert(R.permissionCount('Receptionist') === 18, 'Receptionist count derived = 18');
assert(R.permissionCount('Trainer') === 3, 'Trainer count derived = 3');
assert(R.permissionCount('Member') === 0, 'Member is not in the provider map');

var groupedKeys = [];
R.PERMISSION_GROUPS.forEach(function (g) {
  g.keys.forEach(function (k) { groupedKeys.push(k); });
});
assert(groupedKeys.sort().join(',') === Object.keys(R.PERMISSION_LABELS).slice().sort().join(','), 'every permission sits in exactly one group');

var trainerGroups = R.groupsForRole('Trainer');
assert(trainerGroups.length === 1 && trainerGroups[0].id === 'attendance', 'Trainer shows Attendance only');
assert(trainerGroups[0].items.length === 3 && trainerGroups[0].items[0].key === 'checkin.manual', 'Trainer items are checkin.manual, classes.view, attendance.view');

var managerGroups = R.groupsForRole('Manager');
var managerIds = managerGroups.map(function (g) { return g.id; });
assert(managerIds.indexOf('plans') === -1, 'Manager omits empty Plans group');
assert(managerIds.indexOf('settings') === -1, 'Manager omits empty Settings group');
assert(managerIds.indexOf('payments') !== -1, 'Manager shows Payments');

var ownerGroups = R.groupsForRole('Owner');
assert(ownerGroups.length === R.PERMISSION_GROUPS.length, 'Owner sees every domain that has a permission');
assert(ownerGroups.every(function (g) {
  return g.items.every(function (i) { return i.allowed; });
}), 'Owner items are all allowed (Permissions.All)');

var recGroups = R.groupsForRole('Receptionist');
var recPay = recGroups.filter(function (g) { return g.id === 'payments'; })[0];
assert(recPay, 'Receptionist shows Payments (has cash + request)');
var recApprove = recPay.items.filter(function (i) { return i.key === 'payments.refund.approve'; })[0];
assert(recApprove && recApprove.allowed === false, 'Receptionist does not approve refunds');
assert(R.permissionsForRole('Receptionist').indexOf('sales.discount.override') === -1, 'Receptionist actual set excludes override');

var counts = R.countStaffByRole([
  { role: 'Owner' }, { role: 'manager' }, { role: 'Manager' }, { role: 'Trainer' }
]);
assert(counts.Owner === 1 && counts.Manager === 2 && counts.Trainer === 1 && counts.Receptionist === 0, 'staff counts from existing list shape');
assert(R.countStaffByRole(null) === null, 'missing staff list omits counts');
assert(typeof R.groupsForKeys === 'function', 'groupsForKeys available');
assert(R.groupsForKeys(['checkin.manual'], false).length === R.PERMISSION_GROUPS.length, 'edit matrix shows every domain');
assert(R.permissionsFromCatalog('Trainer', { roles: [{ id: 'Trainer', permissions: ['checkin.manual', 'members.view'] }] }).indexOf('members.view') !== -1, 'catalog overlay wins for Staff preview');

var universe = Object.keys(R.PERMISSION_LABELS);
var jobs = ['Manager', 'Receptionist', 'Trainer'];
var preventFails = [];
jobs.forEach(function (role) {
  universe.forEach(function (perm) {
    var kept = R.permissionsForRole(role).filter(function (p) { return p !== perm; });
    var catalog = { roles: [{ id: role, permissions: kept }] };
    var got = R.permissionsFromCatalog(role, catalog);
    if (got.indexOf(perm) !== -1) preventFails.push(role + ' still has ' + perm);
    var item = R.groupsForKeys(kept, false).reduce(function (hit, g) {
      return hit || g.items.filter(function (i) { return i.key === perm; })[0];
    }, null);
    if (!item || item.allowed) preventFails.push(role + ' checkbox still on for ' + perm);
  });
});
assert(preventFails.length === 0, 'prevent every task on every editable job (' + (preventFails[0] || universe.length * jobs.length + ' ok') + ')');

var ownerFail = universe.filter(function (perm) {
  return R.permissionsForRole('Owner').indexOf(perm) === -1;
});
assert(ownerFail.length === 0, 'Owner defaults still include every task');
assert(R.permissionsForRole('Member').length === 0, 'Member has no desk tasks');

var staffApp = fs.readFileSync(path.join(__dirname, 'staff-app.js'), 'utf8');
assert(staffApp.indexOf('This job can') !== -1, 'Add/Edit staff shows this job can');
assert(staffApp.indexOf('roleTasksHtml') !== -1, 'role pick paints the job task list');
assert(staffApp.indexOf('permissionsFromCatalog') !== -1, 'staff uses effective catalog when loaded');
assert(staffApp.indexOf('/dashboard/roles/') !== -1, 'staff points task edits to Roles');
assert(Array.isArray(R.DEPARTMENTS) && R.DEPARTMENTS.length === 6, 'six controlled departments');
assert(staffApp.indexOf('/admin/staff/') !== -1 && staffApp.indexOf('/activity') !== -1, '360 activity uses staff activity API');
assert(staffApp.indexOf('staffNumber') !== -1, 'list and 360 show staff number');
assert(staffApp.indexOf('jobTitle') !== -1 && staffApp.indexOf('department') !== -1, 'job title and department are on the desk');
assert(staffApp.indexOf('if (hire) work.hireDate = hire') !== -1, 'empty hire date is omitted from create/update JSON');

console.log('\nAll staff.selftest checks passed.');
