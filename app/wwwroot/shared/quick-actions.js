/**
 * HyMotion — tenant Quick Actions catalog + settings client.
 *
 * Whitelist is fixed. Do not accept arbitrary routes.
 * Persist via GET/PUT /settings/quick-actions (AnyStaff read, ManagerOrAbove write).
 * Do not use localStorage as source of truth.
 *
 * Excluded (not single-step desk actions): Settings, Staff, Reports, Audit,
 * Inventory, New Invitation (member-app send only — no staff create screen).
 */
(function (global) {
  'use strict';

  var MAX_TILES = 6;

  var DEFAULT_KEYS = ['new_member', 'checkin', 'new_sale', 'collect_payment'];

  /**
   * @typedef {{
   *   key: string,
   *   en: string,
   *   ar: string,
   *   icon: string,
   *   accent: string,
   *   href: string,
   *   access: { kind: string, value: string|string[] },
   *   featureFlag?: string
   * }} QuickActionDef
   */

  /** @type {QuickActionDef[]} */
  var WHITELIST = [
    {
      key: 'new_member',
      en: 'New Member',
      ar: 'عضو جديد',
      icon: 'ti-user-plus',
      accent: 'qa-member',
      href: '/dashboard/members/?action=new',
      access: { kind: 'permission', value: 'members.create' }
    },
    {
      key: 'checkin',
      en: 'Check-in',
      ar: 'تسجيل حضور',
      icon: 'ti-door-enter',
      accent: 'qa-checkin',
      href: '/dashboard/attendance/',
      access: { kind: 'permission', value: ['checkin.manual', 'members.view'] }
    },
    {
      key: 'new_sale',
      en: 'New Sale',
      ar: 'بيع جديد',
      icon: 'ti-shopping-cart',
      accent: 'qa-sale',
      href: '/dashboard/pos/?mode=retail',
      access: { kind: 'permission', value: 'sales.sell' },
      featureFlag: 'sales'
    },
    {
      key: 'collect_payment',
      en: 'Collect Payment',
      ar: 'تحصيل',
      icon: 'ti-cash',
      accent: 'qa-collect',
      href: '/dashboard/members/',
      access: { kind: 'permission', value: 'sales.sell' },
      featureFlag: 'sales'
    },
    {
      key: 'open_shift',
      en: 'Open Shift',
      ar: 'فتح وردية',
      icon: 'ti-lock-open',
      accent: 'qa-shift',
      href: '/dashboard/shifts/',
      access: { kind: 'permission', value: 'shift.open' },
      featureFlag: 'shifts'
    },
    {
      key: 'close_shift',
      en: 'Close Shift',
      ar: 'قفل وردية',
      icon: 'ti-lock',
      accent: 'qa-close',
      href: '/dashboard/shifts/',
      access: { kind: 'permission', value: 'shift.close' },
      featureFlag: 'shifts'
    },
    {
      key: 'add_promo_code',
      en: 'Add Promo Code',
      ar: 'إضافة كود خصم',
      icon: 'ti-discount-2',
      accent: 'qa-offer',
      href: '/dashboard/offers/',
      access: { kind: 'permission', value: ['sales.sell', 'plans.manage'] },
      // Paused alongside the Offers & Promotions nav entry (PHASE_HIDE_OFFERS) — same page.
      featureFlag: 'offers'
    },
    {
      key: 'freeze_membership',
      en: 'Freeze Membership',
      ar: 'تجميد عضوية',
      icon: 'ti-snowflake',
      accent: 'qa-freeze',
      href: '/dashboard/memberships/',
      access: { kind: 'permission', value: 'memberships.freeze' }
    },
    {
      key: 'book_class',
      en: 'Book Class',
      ar: 'حجز حصة',
      icon: 'ti-calendar-plus',
      accent: 'qa-class',
      href: '/dashboard/classes/',
      access: { kind: 'permission', value: ['classes.view', 'members.view'] }
    },
    {
      key: 'view_classes',
      en: 'View Classes',
      ar: 'عرض الحصص',
      icon: 'ti-calendar-event',
      accent: 'qa-class',
      href: '/dashboard/classes/',
      access: { kind: 'permission', value: ['classes.view', 'members.view'] }
    },
    {
      key: 'checkin_member',
      en: 'Check-in Member',
      ar: 'تسجيل حضور عضو',
      icon: 'ti-user-check',
      accent: 'qa-checkin',
      href: '/dashboard/attendance/',
      access: { kind: 'permission', value: ['checkin.manual', 'attendance.view'] }
    }
  ];

  var BY_KEY = Object.create(null);
  WHITELIST.forEach(function (entry) {
    BY_KEY[entry.key] = entry;
  });

  function canEdit() {
    return !!(global.GfpAuthz && global.GfpAuthz.useCanRole('ManagerOrAbove'));
  }

  function flagOn(key) {
    if (!key) return true;
    var Features = global.GfpFeatures;
    if (!Features) return true;
    var registry = Features.readCache && Features.readCache();
    if (registry == null) return true;
    return Features.isModuleAvailable(key, registry);
  }

  function isTenantEnabled(entry) {
    if (!entry) return false;
    return flagOn(entry.featureFlag);
  }

  function hasAccess(entry) {
    if (!entry || !global.GfpAuthz) return false;
    var access = entry.access;
    // useCan('perm') string form — object form is for nav, not required here
    if (access && access.kind === 'permission') {
      return global.GfpAuthz.useCan(access.value);
    }
    return global.GfpAuthz.useCan(access);
  }

  function isAvailable(entry) {
    if (!isTenantEnabled(entry)) return false;
    // Owner/Manager see gym-configured shortcuts even if JWT perm claims are sparse.
    if (canEdit()) return true;
    return hasAccess(entry);
  }

  function byKey(key) {
    return BY_KEY[key] || null;
  }

  function normalizeKeys(raw) {
    var seen = Object.create(null);
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (item) {
      var key = String(item || '').trim();
      if (key === 'new_offer') key = 'add_promo_code';
      if (!BY_KEY[key] || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function defaultKeys() {
    return DEFAULT_KEYS.slice();
  }

  function parsePayload(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.keys)) return data.keys;
    if (Array.isArray(data.Keys)) return data.Keys;
    if (Array.isArray(data.quickActionKeys)) return data.quickActionKeys;
    if (Array.isArray(data.QuickActionKeys)) return data.QuickActionKeys;
    return null;
  }

  /**
   * @returns {Promise<string[]>}
   */
  async function load() {
    if (!global.GfpApi) return defaultKeys();
    var r = await global.GfpApi.get('/settings/quick-actions');
    if (!r.ok) return defaultKeys();
    var parsed = parsePayload(r.data);
    if (parsed == null) return defaultKeys();
    var keys = normalizeKeys(parsed);
    return keys.length ? keys : defaultKeys();
  }

  /**
   * @param {string[]} keys
   * @returns {Promise<{ ok: boolean, status: number, error?: string }>}
   */
  async function save(keys) {
    var body = { keys: normalizeKeys(keys).slice(0, MAX_TILES) };
    if (!global.GfpApi) {
      return { ok: false, status: 0, error: 'API unavailable', missingEndpoint: true };
    }
    var r = await global.GfpApi.put('/settings/quick-actions', body);
    if (r.ok) return { ok: true, status: r.status };
    var missing = r.status === 404 || r.status === 405 || r.status === 501;
    var generic =
      !r.error ||
      r.error.message === 'Request failed' ||
      r.error.message === 'Network error';
    var msg = missing
      ? 'Backend has no PUT /api/settings/quick-actions yet. Shortcuts cannot be saved until that endpoint ships.'
      : (r.error && !generic && r.error.message) ||
        (r.data && (r.data.detail || r.data.title || r.data.message)) ||
        'Could not save quick actions.';
    return { ok: false, status: r.status, error: String(msg), missingEndpoint: missing };
  }

  global.GfpQuickActions = {
    MAX_TILES: MAX_TILES,
    DEFAULT_KEYS: DEFAULT_KEYS,
    WHITELIST: WHITELIST,
    byKey: byKey,
    canEdit: canEdit,
    isTenantEnabled: isTenantEnabled,
    hasAccess: hasAccess,
    isAvailable: isAvailable,
    normalizeKeys: normalizeKeys,
    defaultKeys: defaultKeys,
    load: load,
    save: save
  };
})(typeof window !== 'undefined' ? window : globalThis);
