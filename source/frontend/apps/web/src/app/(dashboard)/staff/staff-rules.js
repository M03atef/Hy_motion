/**
 * Staff Management display rules.
 * Password policy mirrors Identity in InfrastructureServiceExtensions.
 * ROLE_PERMISSIONS is the DefaultPermissionProvider display copy (gym defaults).
 * Effective grants for this gym come from GET /api/admin/roles (tenant overlay).
 * Staff API ids are ApplicationUser.Id (Identity / JWT sub), never AppUser.Id.
 */
(function (global) {
  'use strict';

  var PASSWORD_POLICY = {
    minLength: 6,
    requireDigit: true,
    requireLower: true,
    requireUpper: true,
    requireSpecial: false
  };

  var DEPARTMENTS = ['Front Desk', 'Sales', 'Training', 'Management', 'Operations', 'Other'];
  var CREATABLE_ROLES = ['Manager', 'Trainer', 'Receptionist'];

  var ROLE_META = {
    Owner:        { icon: 'ti-crown',     cls: 'owner',        label: 'Owner' },
    Manager:      { icon: 'ti-briefcase', cls: 'manager',      label: 'Manager' },
    Trainer:      { icon: 'ti-barbell',   cls: 'trainer',      label: 'Trainer' },
    Receptionist: { icon: 'ti-desk',      cls: 'receptionist', label: 'Receptionist' }
  };

  var PERMISSION_LABELS = {
    'members.view': 'View members',
    'members.create': 'Create members',
    'members.edit': 'Edit members',
    'checkin.manual': 'Manual check-in',
    'classes.view': 'View classes',
    'attendance.view': 'View attendance',
    'sales.sell': 'Sell',
    'sales.discount.apply': 'Apply sales discount',
    'sales.discount.override': 'Override sales discount',
    'payments.cash.accept': 'Accept cash payments',
    'payments.refund.request': 'Request refund',
    'payments.refund.approve': 'Approve refund',
    'shift.open': 'Open shift',
    'shift.close': 'Close shift',
    'shift.reconcile.approve': 'Approve shift reconcile',
    'memberships.freeze': 'Freeze memberships',
    'memberships.assign': 'Assign / renew memberships',
    'plans.manage': 'Manage plans',
    'reports.financial.view': 'View financial reports',
    'reports.expenses.view': 'View expenses',
    'reports.expenses.manage': 'Manage expenses',
    'settings.manage': 'Manage gym settings',
    'inventory.view': 'View inventory',
    'inventory.manage': 'Manage inventory',
    'inventory.adjust': 'Adjust stock',
    'inventory.purchase': 'Purchase stock',
    'inventory.transfer': 'Transfer stock',
    'member_orders.view': 'View member app orders',
    'member_orders.manage': 'Manage member app orders',
    'hr.view': 'View HR directory',
    'hr.manage': 'Manage HR directory',
    'hr.shifts.manage': 'Manage shift templates & schedules',
    'hr.attendance.manage': 'Manage staff attendance',
    'hr.attendance.view': 'View staff attendance',
    'hr.leave.view': 'View staff leave',
    'hr.leave.manage': 'Manage staff leave',
    'hr.leave.approve': 'Approve staff leave',
    'hr.payroll.view': 'View payroll',
    'hr.payroll.manage': 'Manage payroll',
    'hr.payroll.approve': 'Approve payroll',
    'hr.documents.view': 'View staff documents',
    'hr.documents.manage': 'Manage staff documents'
  };

  var ALL_PERMS = Object.keys(PERMISSION_LABELS);

  /** Closed Identity staff roles shown on the Roles viewer. Member is omitted. */
  var STAFF_ROLES = ['Owner', 'Manager', 'Receptionist', 'Trainer'];

  var ROLE_DESCRIPTIONS = {
    Owner: 'Full access. System role — cannot be edited or assigned in Staff.',
    Manager: 'Everything except plans and gym settings.',
    Receptionist: 'Front desk: members, sale, shifts, app orders.',
    Trainer: 'Manual check-in.'
  };

  /**
   * Presentation groups for the Roles viewer. Keys must match PERMISSION_LABELS.
   * This is not a second grant matrix — grants stay in ROLE_PERMISSIONS.
   */
  var PERMISSION_GROUPS = [
    { id: 'members', label: 'Members', keys: ['members.view', 'members.create', 'members.edit'] },
    { id: 'attendance', label: 'Attendance', keys: ['checkin.manual', 'classes.view', 'attendance.view'] },
    { id: 'sales', label: 'Sales', keys: ['sales.sell', 'sales.discount.apply', 'sales.discount.override'] },
    { id: 'payments', label: 'Payments', keys: ['payments.cash.accept', 'payments.refund.request', 'payments.refund.approve'] },
    { id: 'shifts', label: 'Shifts', keys: ['shift.open', 'shift.close', 'shift.reconcile.approve'] },
    { id: 'memberships', label: 'Memberships', keys: ['memberships.freeze', 'memberships.assign'] },
    { id: 'plans', label: 'Plans', keys: ['plans.manage'] },
    { id: 'reports', label: 'Reports', keys: ['reports.financial.view', 'reports.expenses.view', 'reports.expenses.manage'] },
    { id: 'settings', label: 'Settings', keys: ['settings.manage'] },
    { id: 'inventory', label: 'Inventory', keys: ['inventory.view', 'inventory.manage', 'inventory.adjust', 'inventory.purchase', 'inventory.transfer'] },
    { id: 'member-orders', label: 'Member Orders', keys: ['member_orders.view', 'member_orders.manage'] },
    { id: 'hr', label: 'HR', keys: [
      'hr.view', 'hr.manage', 'hr.shifts.manage', 'hr.attendance.manage', 'hr.attendance.view',
      'hr.leave.view', 'hr.leave.manage', 'hr.leave.approve',
      'hr.payroll.view', 'hr.payroll.manage', 'hr.payroll.approve',
      'hr.documents.view', 'hr.documents.manage'
    ] }
  ];

  var ROLE_PERMISSIONS = {
    Owner: ALL_PERMS.slice(),
    Manager: ALL_PERMS.filter(function (p) {
      return p !== 'plans.manage' && p !== 'settings.manage';
    }),
    Receptionist: [
      'members.view', 'members.create', 'members.edit',
      'checkin.manual', 'classes.view', 'attendance.view',
      'sales.sell', 'sales.discount.apply',
      'payments.cash.accept', 'payments.refund.request',
      'shift.open', 'shift.close',
      'inventory.view',
      'member_orders.view', 'member_orders.manage',
      'hr.view', 'hr.attendance.manage', 'hr.attendance.view'
    ],
    Trainer: ['checkin.manual', 'classes.view', 'attendance.view']
  };

  function canonicalRole(role) {
    if (Array.isArray(role)) role = role[0];
    var raw = String(role || '').trim();
    if (!raw) return '';
    var lower = raw.toLowerCase();
    if (lower === 'owner') return 'Owner';
    if (lower === 'manager') return 'Manager';
    if (lower === 'trainer') return 'Trainer';
    if (lower === 'receptionist') return 'Receptionist';
    if (lower === 'member') return 'Member';
    return raw;
  }

  function isOwnerRole(role) {
    return canonicalRole(role) === 'Owner';
  }

  function isCreatableRole(role) {
    return CREATABLE_ROLES.indexOf(canonicalRole(role)) !== -1;
  }

  function checkPassword(pw) {
    pw = String(pw || '');
    return {
      length: pw.length >= PASSWORD_POLICY.minLength,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: !PASSWORD_POLICY.requireSpecial || /[^A-Za-z0-9]/.test(pw)
    };
  }

  function passwordMeetsPolicy(pw) {
    var c = checkPassword(pw);
    return c.length && c.upper && c.lower && c.number && c.special;
  }

  function parseApiUtc(iso) {
    if (iso == null || iso === '') return null;
    if (iso instanceof Date) return isNaN(iso.getTime()) ? null : iso;
    var s = String(iso).trim();
    if (!s) return null;
    if (/[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s)) {
      var withTz = new Date(s);
      return isNaN(withTz.getTime()) ? null : withTz;
    }
    s = s.replace(' ', 'T');
    var asUtc = new Date(/[Tt]/.test(s) ? s + 'Z' : s + 'T00:00:00Z');
    return isNaN(asUtc.getTime()) ? null : asUtc;
  }

  function formatLastLogin(iso) {
    if (!iso) return { text: 'Never logged in', cls: 'never', days: -1 };
    var now = new Date();
    var dt = parseApiUtc(iso);
    if (!dt || isNaN(dt.getTime())) return { text: 'Never logged in', cls: 'never', days: -1 };
    var diff = Math.floor((now - dt) / (1000 * 60 * 60 * 24));
    if (diff === 0) {
      var h = dt.getHours();
      var m = dt.getMinutes();
      var ampm = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 || 12;
      return { text: 'Today at ' + h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm, cls: 'recent', days: 0 };
    }
    if (diff === 1) return { text: 'Yesterday', cls: 'recent', days: 1 };
    if (diff <= 13) return { text: diff + ' days ago', cls: diff <= 3 ? 'recent' : 'moderate', days: diff };
    return { text: diff + ' days ago', cls: 'old', days: diff };
  }

  function permissionsForRole(role) {
    var key = canonicalRole(role);
    return (ROLE_PERMISSIONS[key] || []).slice();
  }

  function permissionCount(role) {
    return permissionsForRole(role).length;
  }

  function permissionUniverseCount() {
    return ALL_PERMS.length;
  }

  function isStaffRole(role) {
    return STAFF_ROLES.indexOf(canonicalRole(role)) !== -1;
  }

  function roleDescription(role) {
    return ROLE_DESCRIPTIONS[canonicalRole(role)] || '';
  }

  /**
   * Groups that contain at least one granted permission for the role.
   * Empty domains are omitted so Trainer does not see a blank Sales matrix.
   */
  function groupsForRole(role) {
    var granted = {};
    permissionsForRole(role).forEach(function (p) { granted[p] = true; });
    return PERMISSION_GROUPS.filter(function (g) {
      return g.keys.some(function (k) { return granted[k]; });
    }).map(function (g) {
      return {
        id: g.id,
        label: g.label,
        items: g.keys.map(function (k) {
          return {
            key: k,
            label: PERMISSION_LABELS[k] || k,
            allowed: !!granted[k]
          };
        })
      };
    });
  }

  function groupsForKeys(keys, onlyGrantedGroups) {
    var granted = {};
    (keys || []).forEach(function (p) { granted[p] = true; });
    var groups = PERMISSION_GROUPS.map(function (g) {
      return {
        id: g.id,
        label: g.label,
        items: g.keys.map(function (k) {
          return {
            key: k,
            label: PERMISSION_LABELS[k] || k,
            allowed: !!granted[k]
          };
        })
      };
    });
    if (onlyGrantedGroups) {
      groups = groups.filter(function (g) {
        return g.items.some(function (i) { return i.allowed; });
      });
    }
    return groups;
  }

  function permissionsFromCatalog(role, catalog) {
    var key = canonicalRole(role);
    if (catalog && Array.isArray(catalog.roles)) {
      var hit = catalog.roles.filter(function (r) { return r.id === key; })[0];
      if (hit && Array.isArray(hit.permissions)) return hit.permissions.slice();
    }
    return permissionsForRole(key);
  }

  /**
   * Count staff per closed role from GET /api/admin/staff.
   * Returns null when the list is missing so the UI can omit the figure.
   */
  function countStaffByRole(staffList) {
    if (!Array.isArray(staffList)) return null;
    var counts = { Owner: 0, Manager: 0, Receptionist: 0, Trainer: 0 };
    staffList.forEach(function (s) {
      var k = canonicalRole(s && s.role);
      if (Object.prototype.hasOwnProperty.call(counts, k)) counts[k] += 1;
    });
    return counts;
  }

  global.GfpStaffRules = {
    PASSWORD_POLICY: PASSWORD_POLICY,
    CREATABLE_ROLES: CREATABLE_ROLES,
    DEPARTMENTS: DEPARTMENTS,
    STAFF_ROLES: STAFF_ROLES,
    ROLE_META: ROLE_META,
    ROLE_DESCRIPTIONS: ROLE_DESCRIPTIONS,
    PERMISSION_LABELS: PERMISSION_LABELS,
    PERMISSION_GROUPS: PERMISSION_GROUPS,
    ROLE_PERMISSIONS: ROLE_PERMISSIONS,
    canonicalRole: canonicalRole,
    isOwnerRole: isOwnerRole,
    isStaffRole: isStaffRole,
    isCreatableRole: isCreatableRole,
    checkPassword: checkPassword,
    passwordMeetsPolicy: passwordMeetsPolicy,
    formatLastLogin: formatLastLogin,
    parseApiUtc: parseApiUtc,
    permissionsForRole: permissionsForRole,
    permissionCount: permissionCount,
    permissionUniverseCount: permissionUniverseCount,
    roleDescription: roleDescription,
    groupsForRole: groupsForRole,
    groupsForKeys: groupsForKeys,
    permissionsFromCatalog: permissionsFromCatalog,
    countStaffByRole: countStaffByRole
  };
})(typeof window !== 'undefined' ? window : globalThis);
