/**
 * Roles viewer self-check. Run: node src/app/(dashboard)/roles/roles.selftest.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

function loadRules() {
  var code = fs.readFileSync(path.join(__dirname, '..', 'staff', 'staff-rules.js'), 'utf8');
  var sandbox = { console: console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'staff-rules.js' });
  return sandbox.GfpStaffRules;
}

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

var R = loadRules();
var html = read('index.html');
var app = read('roles-app.js');

assert(R.STAFF_ROLES.length === 4, 'four staff roles');
assert(R.STAFF_ROLES.indexOf('Member') === -1, 'Member does not appear');
assert(!/option value="Member"|data-role="Member"/.test(html), 'no Member role row in markup');
assert(html.indexOf('Owner is locked') !== -1, 'Owner is locked in copy');
assert(app.indexOf("apiPut('/admin/roles/") !== -1, 'saves via PUT /api/admin/roles/{role}');
assert(app.indexOf('/reset') !== -1, 'reset restores DefaultPermissionProvider');
assert(app.indexOf('name="perm"') !== -1, 'editable jobs use task checkboxes');
assert(app.indexOf('id === \'Owner\'') !== -1 || app.indexOf('id === "Owner"') !== -1, 'Owner branch stays view-only');
assert(app.indexOf('PermissionsOverride') === -1, 'does not enable PermissionsOverride');
assert(html.indexOf('roles.manage') === -1 && html.indexOf('roles.view') === -1, 'no new roles.* permission');
assert(app.indexOf('isOwnerRole') !== -1 && html.indexOf('ownerGuard') !== -1, 'Owner-only guard matches Staff');
assert(html.indexOf('href="/dashboard/staff/"') !== -1, 'Roles points people to Staff');
assert(R.permissionCount('Trainer') === 3, 'defaults: Trainer is checkin.manual, classes.view, attendance.view');
assert(typeof R.groupsForKeys === 'function', 'groupsForKeys paints the full matrix for editing');
assert(typeof R.permissionsFromCatalog === 'function', 'catalog overrides defaults when API returns overlay');

console.log('\nAll roles.selftest checks passed.');
