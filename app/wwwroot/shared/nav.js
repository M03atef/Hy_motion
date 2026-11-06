/**
 * Declarative navigation registry (§0.4) — apps/web.
 * Data only (no DOM). Icons are Tabler class names (`ti-*`).
 *
 * Category table (staff console IA — Red Team overhaul 2026-09-20):
 * | Category            | Items                                                         |
 * |---------------------|---------------------------------------------------------------|
 * | Home                | Dashboard                                                     |
 * | Front Desk          | Current Shift, Members, Member Attendance, Sales, Call Sheet, |
 * |                     | Classes, Member Orders, Access Cards                          |
 * | Business & Finance  | Plans, Invoices, Expenses, Reports, Shift Summaries           |
 * |                     | (Offers paused — pilot)                                       |
 * | People & HR         | Employees, Departments, Positions, Employee Attendance,       |
 * |                     | Schedule, Leaves, Payroll                                     |
 * | Catalog & Inventory | Products, Suppliers, Purchases                                |
 * |                     | (Stock hub / Overview / Insights when stock_management on)    |
 * | Tools               | Activities, Invitations, Biometric Devices, Import            |
 * | System              | Notifications, Staff Accounts, Roles & Permissions,           |
 * |                     | Audit Log, Settings, Backup & Recovery                        |
 */
(function (global) {
  'use strict';

  /**
   * @typedef {|
   *   { kind: 'permission', value: string|string[] } |
   *   { kind: 'policy', value: 'OwnerOnly'|'ManagerOrAbove'|'AnyStaff' } |
   *   { kind: 'any' }
   * } NavAccess
   */

  /**
   * @typedef {{
   *   key: string,
   *   label: string,
   *   labelAr: string,
   *   path: string,
   *   icon: string,
   *   access: NavAccess,
   *   featureFlag?: 'sales'|'shifts'|'trials'|'refunds'|'debtors'|'imports'|'inventory'|'stock_management'|'hr'|'offers',
   *   featureFlags?: Array<'sales'|'shifts'|'trials'|'refunds'|'debtors'|'imports'|'inventory'|'stock_management'|'hr'|'offers'>,
   *   excludeRoles?: string[]
   * }} NavItem
   */

  /**
   * @typedef {{ key: string, label: string, labelAr: string, defaultCollapsed?: boolean, items: NavItem[] }} NavCategory
   */

  /** @type {NavCategory[]} */
  var NAV_CATEGORIES = [
    /* ── Home ── */
    {
      key: 'overview',
      label: 'Home',
      labelAr: 'الرئيسية',
      items: [
        {
          key: 'dashboard',
          label: 'Dashboard',
          labelAr: 'لوحة التحكم',
          path: '/dashboard/',
          icon: 'ti-layout-dashboard',
          access: { kind: 'any' }
        }
      ]
    },

    /* ── Front Desk — daily member-facing operations ── */
    {
      key: 'core',
      label: 'Front Desk',
      labelAr: 'المكتب الأمامي',
      items: [
        {
          key: 'shifts',
          label: 'Current Shift',
          labelAr: 'الوردية الحالية',
          path: '/dashboard/shifts/',
          icon: 'ti-cash',
          access: { kind: 'permission', value: ['shift.open', 'shift.close'] },
          featureFlag: 'shifts'
        },
        {
          key: 'members',
          label: 'Members',
          labelAr: 'الأعضاء',
          path: '/dashboard/members/',
          icon: 'ti-users',
          access: { kind: 'permission', value: 'members.view' }
        },
        {
          key: 'attendance',
          label: 'Member Attendance',
          labelAr: 'حضور الأعضاء',
          path: '/dashboard/attendance/',
          icon: 'ti-door-enter',
          access: { kind: 'permission', value: ['checkin.manual', 'members.view'] }
        },
        {
          key: 'pos',
          // Retail / general sales — membership onboarding lives in Members
          label: 'Sales',
          labelAr: 'المبيعات',
          path: '/dashboard/pos/?mode=retail',
          icon: 'ti-shopping-cart',
          access: { kind: 'permission', value: 'sales.sell' },
          featureFlag: 'sales'
        },
        {
          key: 'call-sheet',
          label: 'Call Sheet',
          labelAr: 'ورقة المتابعة',
          path: '/dashboard/call-sheet/',
          icon: 'ti-phone-call',
          access: { kind: 'permission', value: 'sales.sell' }
          // never featureFlag — Call Sheet is not flag-gated (§0.8)
        },
        {
          key: 'classes',
          label: 'Classes',
          labelAr: 'الحصص',
          path: '/dashboard/classes/',
          icon: 'ti-calendar-event',
          access: { kind: 'permission', value: ['members.view', 'classes.view'] }
        },
        {
          key: 'member-orders',
          label: 'Member Orders',
          labelAr: 'طلبات الأعضاء',
          path: '/dashboard/member-orders/',
          icon: 'ti-shopping-bag',
          access: {
            kind: 'permission',
            value: ['sales.sell', 'member_orders.view', 'member_orders.manage']
          }
        },
        {
          key: 'access-cards',
          label: 'Access Cards',
          labelAr: 'كارنيهات الدخول',
          path: '/dashboard/access-cards/',
          icon: 'ti-id',
          access: { kind: 'permission', value: 'members.view' }
        }
      ]
    },

    /* ── Business & Finance — revenue, plans, financial visibility ── */
    {
      key: 'management',
      label: 'Business & Finance',
      labelAr: 'الأعمال والمالية',
      items: [
        {
          key: 'plans',
          label: 'Plans',
          labelAr: 'الباقات',
          path: '/dashboard/plans/',
          icon: 'ti-package',
          access: { kind: 'permission', value: 'plans.manage' }
        },
        {
          // Paused for the pilot phase (2026-09-06) — PHASE_HIDE_OFFERS in features.js.
          // Page, API, and data are untouched; only the nav entry is hidden.
          key: 'offers',
          label: 'Offers & Promotions',
          labelAr: 'العروض والترويج',
          path: '/dashboard/offers/',
          icon: 'ti-discount-2',
          access: { kind: 'permission', value: ['sales.sell', 'plans.manage'] },
          featureFlag: 'offers'
        },
        {
          key: 'invoices',
          label: 'Invoices',
          labelAr: 'الفواتير',
          path: '/dashboard/invoices/',
          icon: 'ti-file-invoice',
          access: { kind: 'permission', value: 'reports.financial.view' }
        },
        {
          key: 'expenses',
          label: 'Expenses',
          labelAr: 'المصروفات',
          path: '/dashboard/reports/?tab=expenses',
          icon: 'ti-receipt',
          access: { kind: 'permission', value: ['reports.expenses.view', 'reports.expenses.manage'] }
        },
        {
          key: 'reports',
          label: 'Reports',
          labelAr: 'التقارير',
          path: '/dashboard/reports/',
          icon: 'ti-chart-bar',
          access: { kind: 'permission', value: 'reports.financial.view' }
        },
        {
          key: 'z-report',
          label: 'Shift Summaries',
          labelAr: 'ملخص الورديات',
          path: '/dashboard/z-report/',
          icon: 'ti-report-money',
          access: { kind: 'permission', value: 'reports.financial.view' }
        }
      ]
    },

    /* ── People & HR — first-class management area (not hidden) ── */
    {
      key: 'people',
      label: 'People & HR',
      labelAr: 'الموظفون والموارد البشرية',
      items: [
        {
          key: 'hr-employees',
          label: 'Employees',
          labelAr: 'بيانات الموظفين',
          path: '/dashboard/hr/employees/',
          icon: 'ti-id-badge-2',
          access: { kind: 'permission', value: 'hr.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'hr-departments',
          label: 'Departments',
          labelAr: 'الأقسام',
          path: '/dashboard/hr/departments/',
          icon: 'ti-building',
          access: { kind: 'permission', value: 'hr.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'hr-positions',
          label: 'Positions',
          labelAr: 'المناصب',
          path: '/dashboard/hr/positions/',
          icon: 'ti-hierarchy-2',
          access: { kind: 'permission', value: 'hr.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'hr-attendance',
          label: 'Employee Attendance',
          labelAr: 'حضور الموظفين',
          path: '/dashboard/hr/attendance/',
          icon: 'ti-fingerprint',
          access: { kind: 'permission', value: 'hr.attendance.view' },
          featureFlag: 'hr'
          // Receptionists CAN see this — they check employees in/out at the desk
        },
        {
          key: 'hr-schedule',
          label: 'Schedule',
          labelAr: 'الجدول الوظيفي',
          path: '/dashboard/hr/schedule/',
          icon: 'ti-calendar-week',
          access: { kind: 'permission', value: 'hr.attendance.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'hr-leaves',
          label: 'Leaves',
          labelAr: 'الإجازات',
          path: '/dashboard/hr/leaves/',
          icon: 'ti-beach',
          access: { kind: 'permission', value: 'hr.leave.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'hr-payroll',
          label: 'Payroll',
          labelAr: 'الرواتب',
          path: '/dashboard/hr/payroll/',
          icon: 'ti-cash-banknote',
          access: { kind: 'permission', value: 'hr.payroll.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        }
      ]
    },

    /* ── Catalog & Inventory — products, suppliers, procurement ── */
    {
      key: 'catalog',
      label: 'Catalog & Inventory',
      labelAr: 'الكتالوج والمخزون',
      defaultCollapsed: true,
      items: [
        {
          key: 'inv-products',
          label: 'Products',
          labelAr: 'المنتجات',
          path: '/dashboard/inventory/products/',
          icon: 'ti-box',
          access: { kind: 'permission', value: ['inventory.manage', 'inventory.purchase'] },
          featureFlag: 'inventory'
        },
        {
          key: 'inv-suppliers',
          label: 'Suppliers',
          labelAr: 'الموردون',
          path: '/dashboard/inventory/suppliers/',
          icon: 'ti-truck',
          access: { kind: 'permission', value: ['inventory.purchase', 'inventory.manage'] },
          featureFlag: 'inventory'
        },
        {
          key: 'inv-purchase-orders',
          label: 'Purchases',
          labelAr: 'المشتريات',
          path: '/dashboard/inventory/purchase-orders/',
          icon: 'ti-clipboard-list',
          access: { kind: 'permission', value: 'inventory.purchase' },
          featureFlag: 'inventory'
        },
        {
          key: 'inv-stock-hub',
          label: 'Stock Management',
          labelAr: 'إدارة المخزون',
          path: '/dashboard/inventory/stock-management/',
          icon: 'ti-stack-2',
          access: { kind: 'permission', value: 'inventory.view' },
          featureFlags: ['inventory', 'stock_management']
        },
        {
          key: 'inv-home',
          label: 'Inventory Overview',
          labelAr: 'نظرة عامة',
          path: '/dashboard/inventory/',
          icon: 'ti-gauge',
          access: { kind: 'permission', value: 'inventory.view' },
          featureFlags: ['inventory', 'stock_management']
        },
        {
          key: 'inv-reports',
          label: 'Insights',
          labelAr: 'رؤى وتقارير',
          path: '/dashboard/inventory/reports/',
          icon: 'ti-chart-histogram',
          access: { kind: 'permission', value: 'inventory.view' },
          featureFlags: ['inventory', 'stock_management']
        }
      ]
    },

    /* ── Tools — setup, configuration, utilities ── */
    {
      key: 'tools',
      label: 'Tools',
      labelAr: 'الأدوات',
      defaultCollapsed: true,
      items: [
        {
          key: 'activities',
          label: 'Activities',
          labelAr: 'الأنشطة',
          path: '/dashboard/activities/',
          icon: 'ti-run',
          access: { kind: 'permission', value: 'plans.manage' }
        },
        {
          key: 'invitations',
          label: 'Invitations',
          labelAr: 'الدعوات',
          path: '/dashboard/invitations/',
          icon: 'ti-user-plus',
          access: { kind: 'permission', value: 'members.view' }
        },
        {
          key: 'hr-biometric-devices',
          label: 'Biometric Devices',
          labelAr: 'أجهزة البصمة',
          path: '/dashboard/hr/biometric-devices/',
          icon: 'ti-device-desktop',
          access: { kind: 'permission', value: 'hr.attendance.view' },
          featureFlag: 'hr',
          excludeRoles: ['Receptionist']
        },
        {
          key: 'imports',
          label: 'Import',
          labelAr: 'الاستيراد',
          path: '/dashboard/imports/',
          icon: 'ti-file-import',
          access: { kind: 'permission', value: 'settings.manage' },
          featureFlag: 'imports'
        }
      ]
    },

    /* ── System — accounts, permissions, admin ── */
    {
      key: 'administration',
      label: 'System',
      labelAr: 'النظام',
      // Not collapsed — Notifications is here and accessible to all roles
      items: [
        {
          key: 'notifications',
          label: 'Notifications',
          labelAr: 'الإشعارات',
          path: '/dashboard/notifications/',
          icon: 'ti-bell',
          access: { kind: 'any' }
        },
        {
          key: 'staff',
          label: 'Staff Accounts',
          labelAr: 'حسابات الموظفين',
          path: '/dashboard/staff/',
          icon: 'ti-user-shield',
          access: { kind: 'policy', value: 'OwnerOnly' }
        },
        {
          key: 'roles',
          label: 'Roles & Permissions',
          labelAr: 'الأدوار والصلاحيات',
          path: '/dashboard/roles/',
          icon: 'ti-shield-lock',
          access: { kind: 'policy', value: 'OwnerOnly' }
        },
        {
          key: 'audit',
          label: 'Audit Log',
          labelAr: 'سجل التدقيق',
          path: '/dashboard/audit/',
          icon: 'ti-list-search',
          access: { kind: 'permission', value: 'settings.manage' }
        },
        {
          key: 'settings',
          label: 'Settings',
          labelAr: 'الإعدادات',
          path: '/dashboard/settings/',
          icon: 'ti-settings',
          access: { kind: 'policy', value: 'OwnerOnly' }
        },
        {
          // Local Edition only (backend 404s this on SaaS via [RequireLocalEdition] - the page
          // itself checks GfpDeployment.getEdition() and shows a clear "not available" state
          // rather than the nav model here growing an edition-aware access kind for one item).
          key: 'backup',
          label: 'Backup & Recovery',
          labelAr: 'النسخ الاحتياطي والاسترداد',
          path: '/dashboard/backup/',
          icon: 'ti-database-export',
          access: { kind: 'policy', value: 'OwnerOnly' }
        }
      ]
    }
  ];


  var NAV_ITEMS = NAV_CATEGORIES.reduce(function (acc, cat) {
    return acc.concat(cat.items);
  }, []);

  /**
   * Never branch on role string for permission items — use access + claims.
   * excludeRoles is nav-only progressive disclosure (API permissions unchanged).
   * @param {NavAccess} access
   * @param {{ accessToken?: string|null, role?: string|null, Authz?: object }} [opts]
   */
  function canAccess(access, opts) {
    opts = opts || {};
    var Authz = opts.Authz || global.GfpAuthz;
    if (!Authz) return false;
    var token = opts.accessToken != null ? opts.accessToken : Authz.getAccessToken();
    var role = opts.role != null ? opts.role : Authz.getUserRole();

    if (!access || !access.kind) return false;
    if (access.kind === 'permission') {
      return Authz.canPermission(token, access.value);
    }
    if (access.kind === 'policy') {
      return Authz.matchesRolePolicy(role, access.value);
    }
    if (access.kind === 'any') {
      return Authz.matchesRolePolicy(role, 'AnyStaff');
    }
    return false;
  }

  function isRoleExcluded(item, opts) {
    if (!item || !item.excludeRoles || !item.excludeRoles.length) return false;
    opts = opts || {};
    var Authz = opts.Authz || global.GfpAuthz;
    var role = opts.role != null ? opts.role : Authz && Authz.getUserRole ? Authz.getUserRole() : null;
    if (!role) return false;
    var norm = Authz && Authz.normalizeRole ? Authz.normalizeRole(role) : String(role).trim().toLowerCase();
    for (var i = 0; i < item.excludeRoles.length; i++) {
      var ex = item.excludeRoles[i];
      var exNorm = Authz && Authz.normalizeRole ? Authz.normalizeRole(ex) : String(ex).trim().toLowerCase();
      if (exNorm === norm) return true;
    }
    return false;
  }

  /**
   * @param {NavItem} item
   * @param {Record<string,boolean>|null} registry
   * @param {{ accessToken?: string|null, role?: string|null }} [opts]
   */
  function isNavItemVisible(item, registry, opts) {
    opts = opts || {};
    if (isRoleExcluded(item, opts)) return false;
    var Features = global.GfpFeatures;
    var flags = item.featureFlags;
    if (flags && flags.length) {
      if (!Features) return false;
      for (var i = 0; i < flags.length; i++) {
        if (!Features.isModuleAvailable(flags[i], registry)) return false;
      }
    } else if (item.featureFlag) {
      if (!Features || !Features.isModuleAvailable(item.featureFlag, registry)) {
        return false;
      }
    }
    return canAccess(item.access, opts);
  }

  /**
   * Filters categories by useCan(access) + feature-flag registry; drops empty categories.
   * Re-evaluate on login/refresh only (claims baked into JWT) — not on a timer.
   * @param {Record<string,boolean>|null} [registry]
   * @param {{ accessToken?: string|null, role?: string|null, categories?: NavCategory[] }} [opts]
   * @returns {NavCategory[]}
   */
  function useVisibleNav(registry, opts) {
    opts = opts || {};
    var cats = opts.categories || NAV_CATEGORIES;
    if (registry === undefined) {
      registry = (global.GfpFeatures && global.GfpFeatures.readCache()) || null;
    }
    return cats
      .map(function (cat) {
        return {
          key: cat.key,
          label: cat.label,
          labelAr: cat.labelAr,
          defaultCollapsed: !!cat.defaultCollapsed,
          items: cat.items.filter(function (item) {
            return isNavItemVisible(item, registry, opts);
          })
        };
      })
      .filter(function (cat) {
        return cat.items.length > 0;
      });
  }

  /**
   * Default landing = first item of first non-empty filtered category.
   * Not hardcoded by role — adapts when claims / flags change.
   * @param {NavCategory[]} [categories]
   * @returns {string|null}
   */
  function getDefaultLandingPath(categories) {
    var cats = categories;
    if (!cats) {
      cats = useVisibleNav();
    }
    if (!cats || !cats.length) return null;
    var first = cats[0];
    if (!first.items || !first.items.length) return null;
    return first.items[0].path || null;
  }

  global.GfpNav = {
    NAV_CATEGORIES: NAV_CATEGORIES,
    NAV_ITEMS: NAV_ITEMS,
    canAccess: canAccess,
    isNavItemVisible: isNavItemVisible,
    useVisibleNav: useVisibleNav,
    getDefaultLandingPath: getDefaultLandingPath
  };
  global.useVisibleNav = useVisibleNav;
})(typeof window !== 'undefined' ? window : globalThis);
