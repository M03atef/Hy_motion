/**
 * HyMotion — feature-flag module probe + cached registry (§0.8).
 * FEATURE_DISABLED (404 ProblemDetails title) → module unavailable (hide from nav).
 * Network errors: fail-open for core modules; fail-closed for stock_management (Growth desk).
 *
 * SHOP_OWNER_UX (2026-08-14 Product Accept — existing-desk preview):
 * Catalog = Products table + Suppliers table + Purchases. Hide warehouse /
 * transfers / counts / insights from owner nav. Engines + default warehouse stay.
 * PHASE_HIDE_STOCK_MANAGEMENT is forced on while shop UX is the product direction.
 *
 * PHASE_HIDE_OFFERS (2026-09-06 — pilot stage): Offers & Promotions is paused for the
 * current phase — nav entry hidden, API/data untouched. Flip to false to bring it back.
 */
(function (global) {
  'use strict';

  var CACHE_KEY = 'gfp_feature_modules_v6';
  var CACHE_TTL_MS = 10 * 60 * 1000;

  /** Shop UX: hide Stock Management hub / warehouses / transfers / counts for all tiers. */
  var SHOP_OWNER_UX = true;
  var PHASE_HIDE_STOCK_MANAGEMENT = SHOP_OWNER_UX;

  /** Pilot stage: Offers & Promotions paused (nav hidden only — /api/offers untouched). */
  var PHASE_HIDE_OFFERS = true;

  var FEATURE_MODULES = [
    'sales',
    'shifts',
    'trials',
    'refunds',
    'debtors',
    'imports',
    'inventory',
    'stock_management',
    'hr'
  ];

  /** Modules that must stay OFF when probe fails (tier packaging, not core POS). */
  var FAIL_CLOSED = { stock_management: true };

  var PROBES = {
    sales: { method: 'GET', path: '/promo-codes?page=1&pageSize=1' },
    shifts: { method: 'GET', path: '/shifts/current' },
    trials: { method: 'POST', path: '/trials/confirm', body: { phoneNumber: '0000000000', otp: '000000' } },
    refunds: { method: 'GET', path: '/refunds' },
    debtors: { method: 'GET', path: '/debtors?page=1&pageSize=1' },
    imports: { method: 'GET', path: '/imports/template.xlsx', raw: true },
    inventory: { method: 'GET', path: '/inventory/categories' },
    stock_management: { method: 'GET', path: '/inventory/transfers' },
    hr: { method: 'GET', path: '/hr/departments' }
  };

  function readCache() {
    try {
      var raw = global.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at || !parsed.modules) return null;
      if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return applyPhaseGates(parsed.modules);
    } catch (e) {
      return null;
    }
  }

  function writeCache(modules) {
    try {
      global.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), modules: modules }));
    } catch (e) { /* ignore */ }
  }

  function clearCache() {
    try { global.sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
    try { global.sessionStorage.removeItem('gfp_feature_modules_v3'); } catch (e) { /* ignore */ }
    try { global.sessionStorage.removeItem('gfp_feature_modules_v2'); } catch (e) { /* ignore */ }
    try { global.sessionStorage.removeItem('gfp_feature_modules_v1'); } catch (e) { /* ignore */ }
  }

  function applyPhaseGates(modules) {
    var out = {};
    for (var k in modules) {
      if (Object.prototype.hasOwnProperty.call(modules, k)) out[k] = modules[k];
    }
    if (PHASE_HIDE_STOCK_MANAGEMENT) out.stock_management = false;
    return out;
  }

  function isFeatureDisabled(result) {
    if (!result) return false;
    if (result.status !== 404) return false;
    var err = result.error;
    if (err && (err.code === 'FEATURE_DISABLED' || /FEATURE_DISABLED/i.test(String(err.message || '')))) return true;
    var d = result.data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { d = null; }
    }
    if (d && typeof d === 'object' && d.title === 'FEATURE_DISABLED') return true;
    return false;
  }

  async function probeModuleAvailable(module) {
    if (module === 'stock_management' && PHASE_HIDE_STOCK_MANAGEMENT) return false;
    if (module === 'offers') return !PHASE_HIDE_OFFERS;
    var probe = PROBES[module];
    if (!probe) return !FAIL_CLOSED[module];
    try {
      var Gfp = global.GfpApi;
      if (!Gfp) return !FAIL_CLOSED[module];
      var opts = { auth: true };
      if (probe.raw) opts.raw = true;
      var r;
      if (probe.method === 'POST') {
        r = await Gfp.post(probe.path, probe.body || {}, opts);
      } else {
        r = await Gfp.get(probe.path, opts);
      }

      if (probe.raw && r.response) {
        if (r.status === 404) {
          var ct = (r.headers && r.headers.get('content-type')) || '';
          if (ct.indexOf('application/json') !== -1) {
            try {
              var body = await r.response.clone().json();
              if (body && body.title === 'FEATURE_DISABLED') return false;
            } catch (e) { /* ignore */ }
          }
          return true;
        }
        return true;
      }

      if (isFeatureDisabled(r)) return false;
      return true;
    } catch (e) {
      return !FAIL_CLOSED[module];
    }
  }

  async function probeAllModules(force) {
    if (!force) {
      var cached = readCache();
      if (cached) return cached;
    }
    var modules = {};
    await Promise.all(
      FEATURE_MODULES.map(async function (key) {
        modules[key] = await probeModuleAvailable(key);
      })
    );
    modules = applyPhaseGates(modules);
    writeCache(modules);
    return modules;
  }

  function isModuleAvailable(key, registry) {
    if (!key) return true;
    if (key === 'stock_management' && PHASE_HIDE_STOCK_MANAGEMENT) return false;
    if (key === 'offers') return !PHASE_HIDE_OFFERS;
    if (registry == null) return false;
    if (registry[key] === undefined) return false;
    return !!registry[key];
  }

  var GfpFeatures = {
    FEATURE_MODULES: FEATURE_MODULES,
    PHASE_HIDE_STOCK_MANAGEMENT: PHASE_HIDE_STOCK_MANAGEMENT,
    PHASE_HIDE_OFFERS: PHASE_HIDE_OFFERS,
    SHOP_OWNER_UX: SHOP_OWNER_UX,
    probeModuleAvailable: probeModuleAvailable,
    probeAllModules: probeAllModules,
    isModuleAvailable: isModuleAvailable,
    clearCache: clearCache,
    readCache: readCache
  };

  global.GfpFeatures = GfpFeatures;
})(typeof window !== 'undefined' ? window : globalThis);
