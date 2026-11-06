/**
 * Gym Identity Phase A — tenant branding for the whole desk shell.
 * Applies on every dashboard page: CSS vars, sidebar mark/logo, topbar gym name.
 * Cache is keyed by tenantId (no cross-tenant leak).
 */
(function (global) {
  'use strict';
  var KEY_PREFIX = 'gfp_branding:';
  var injectedStyleId = 'gfp-branding-runtime';
  var lastBranding = null;
  var applying = false;

  function getUser() {
    try {
      return JSON.parse(
        localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || 'null'
      );
    } catch (e) {
      return null;
    }
  }

  function tenantId() {
    var u = getUser();
    return (u && (u.tenantId || u.TenantId)) || 'unknown';
  }

  function cacheKey() {
    return KEY_PREFIX + tenantId();
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(cacheKey());
      if (!raw) {
        // migrate legacy unscoped cache once
        raw = localStorage.getItem('gfp_branding');
      }
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function apiBases() {
    var list = [];
    try {
      var b = String(global.API_BASE || '').replace(/\/$/, '');
      if (b) list.push(b);
    } catch (e) { /* ignore */ }
    return list;
  }

  function apiOriginFromBase(base) {
    try {
      return new URL(base).origin;
    } catch (e) {
      return '';
    }
  }

  function ensureRuntimeCss() {
    var style = document.getElementById(injectedStyleId);
    if (!style) {
      style = document.createElement('style');
      style.id = injectedStyleId;
      document.head.appendChild(style);
    }
    // Re-write each apply so late-loaded page CSS cannot win without !important fights
    style.textContent =
      ':root,html{' +
      '--l500:var(--gfp-brand-primary,#7ACC00);' +
      '--l600:var(--gfp-brand-primary,#7ACC00);' +
      '--l400:var(--gfp-brand-accent,#A0E040);' +
      '--l300:var(--gfp-brand-accent,#A0E040);' +
      '--l100:color-mix(in srgb,var(--gfp-brand-primary,#7ACC00) 16%,var(--ls1,#fff));' +
      '}' +
      '.sb-hdr svg rect{fill:var(--gfp-brand-primary,#7ACC00)!important}' +
      '.sb-hdr span{color:var(--gfp-brand-accent,#A0E040)!important}' +
      '.sb-hdr .gfp-brand-logo{width:32px;height:32px;border-radius:8px;object-fit:contain;background:#fff;flex-shrink:0;display:block}' +
      '.sb-hdr .gfp-brand-mark{width:32px;height:32px;border-radius:8px;background:var(--gfp-brand-primary,#7ACC00);flex-shrink:0}' +
      '.sb-item.act{' +
      'background:color-mix(in srgb,var(--gfp-brand-primary,#7ACC00) 14%,transparent)!important;' +
      'color:var(--gfp-brand-accent,#A0E040)!important;' +
      'border-left-color:var(--gfp-brand-primary,#7ACC00)!important}' +
      '.sb-item.act i{color:var(--gfp-brand-accent,#A0E040)!important;opacity:1!important}' +
      '.av-sm{background:color-mix(in srgb,var(--gfp-brand-primary,#7ACC00) 35%,var(--ls1,#fff))!important}' +
      '.btn.primary,.btn-save,.btn-qr:not(.outline),button.primary{' +
      'background:var(--gfp-brand-primary,#7ACC00)!important;' +
      'border-color:var(--gfp-brand-primary,#7ACC00)!important;' +
      'color:#0D0D0D!important}' +
      '.page-title i,.st-pill .st-dot.active{color:var(--gfp-brand-primary,#7ACC00)}';
  }

  function mediaCandidates(logoUrl) {
    var u = String(logoUrl || '').trim();
    if (!u) return [];
    if (/^(blob:|data:)/i.test(u)) return [u];
    if (/^https?:\/\//i.test(u)) return [u];
    var path = u.charAt(0) === '/' ? u : '/' + u;
    var out = [];
    var seen = {};
    function add(x) {
      if (!x || seen[x]) return;
      seen[x] = true;
      out.push(x);
    }
    apiBases().forEach(function (base) {
      var origin = apiOriginFromBase(base);
      if (origin) add(origin + path);
    });
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      add(window.location.origin + path);
    }
    return out;
  }

  /** Prefer direct <img src> — fetch()/blob needs CORS on /uploads and often fails in the browser. */
  function bindLogoImg(img, logoUrl, onFail) {
    var candidates = mediaCandidates(logoUrl);
    var idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        if (onFail) onFail();
        return;
      }
      var url = candidates[idx++];
      img.onerror = function () {
        tryNext();
      };
      img.onload = function () {
        img.onerror = null;
      };
      img.src = url;
    }
    tryNext();
  }

  function applyCssVars(b) {
    var primary = b.primaryColor || b.PrimaryColor || '#7ACC00';
    var accent = b.accentColor || b.AccentColor || '#A0E040';
    var secondary = b.secondaryColor || b.SecondaryColor || '#148F8F';
    var root = document.documentElement;
    root.style.setProperty('--gfp-brand-primary', primary);
    root.style.setProperty('--gfp-brand-accent', accent);
    root.style.setProperty('--gfp-brand-secondary', secondary);
    // Also set legacy tokens used by every page stylesheet
    root.style.setProperty('--l500', primary);
    root.style.setProperty('--l400', accent);
    root.style.setProperty('--l600', primary);
    root.style.setProperty('--l300', accent);
    root.dataset.gfpBrandTenant = tenantId();
  }

  function applyNames(b) {
    var name = b.gymName || b.GymName || '';
    var nameAr = b.gymNameAr || b.GymNameAr || '';
    var shortName = b.shortName || b.ShortName || '';
    var display = shortName || name || 'HyMotion';

    document.querySelectorAll('#gymName, .tb-gym-name, .gym-name').forEach(function (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if (name) el.textContent = name;
    });
    document.querySelectorAll('#gymNameAr, .tb-gym-name-ar, .gym-name-ar').forEach(function (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      el.textContent = nameAr || '';
    });

    var hdr = document.querySelector('.sb-hdr span');
    if (hdr && !hdr.closest('form')) {
      hdr.textContent = display;
    }
  }

  function paintSvgMark(primary) {
    document.querySelectorAll('.sb-hdr svg rect').forEach(function (rect) {
      rect.setAttribute('fill', primary);
    });
  }

  async function applyShellMark(b) {
    var hdr = document.querySelector('.sb-hdr');
    if (!hdr) return;
    var primary = b.primaryColor || b.PrimaryColor || '#7ACC00';
    var showLogo = b.showGymLogoOnCard !== false && b.ShowGymLogoOnCard !== false;
    var logoUrl = b.logoUrl || b.LogoUrl || '';
    var existingLogo = hdr.querySelector('.gfp-brand-logo');
    var existingMark = hdr.querySelector('.gfp-brand-mark');
    var svg = hdr.querySelector('svg');

    function showFallbackMark() {
      if (existingLogo) existingLogo.style.display = 'none';
      if (svg) {
        svg.style.display = '';
        paintSvgMark(primary);
        return;
      }
      if (!existingMark) {
        existingMark = document.createElement('div');
        existingMark.className = 'gfp-brand-mark';
        existingMark.setAttribute('aria-hidden', 'true');
        hdr.insertBefore(existingMark, hdr.firstChild);
      }
      existingMark.style.display = '';
      existingMark.style.background = primary;
    }

    if (showLogo && logoUrl) {
      if (svg) svg.style.display = 'none';
      if (existingMark) existingMark.style.display = 'none';
      if (!existingLogo) {
        existingLogo = document.createElement('img');
        existingLogo.className = 'gfp-brand-logo';
        existingLogo.alt = '';
        hdr.insertBefore(existingLogo, hdr.firstChild);
      }
      existingLogo.style.display = '';
      bindLogoImg(existingLogo, logoUrl, showFallbackMark);
      return;
    }

    showFallbackMark();
  }

  var pendingReapply = false;

  async function apply(b) {
    if (!b) return;
    if (applying) {
      pendingReapply = true;
      lastBranding = b;
      return;
    }
    applying = true;
    try {
      lastBranding = b;
      ensureRuntimeCss();
      applyCssVars(b);
      applyNames(b);
      try {
        localStorage.setItem(cacheKey(), JSON.stringify(b));
      } catch (e) { /* ignore */ }
      await applyShellMark(b);
      try {
        global.dispatchEvent(new CustomEvent('gfp:branding', { detail: b }));
      } catch (e) { /* ignore */ }
    } finally {
      applying = false;
      if (pendingReapply) {
        pendingReapply = false;
        var again = lastBranding;
        if (again) {
          setTimeout(function () {
            apply(again);
          }, 0);
        }
      }
    }
  }

  function reapply() {
    if (lastBranding) return apply(lastBranding);
    var cached = readCache();
    if (cached) return apply(cached);
    return Promise.resolve();
  }

  async function fetchBranding() {
    var token =
      localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
    if (!token) return null;
    var bases = apiBases();
    for (var i = 0; i < bases.length; i++) {
      try {
        var res = await fetch(bases[i] + '/settings/branding', {
          headers: {
            Authorization: 'Bearer ' + token,
            'ngrok-skip-browser-warning': 'true'
          }
        });
        if (!res.ok) continue;
        return await res.json();
      } catch (e) { /* try next base */ }
    }
    return null;
  }

  async function load() {
    ensureRuntimeCss();
    var cached = readCache();
    if (cached) await apply(cached);
    var data = await fetchBranding();
    if (data) await apply(data);
  }

  function clear() {
    lastBranding = null;
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(KEY_PREFIX) === 0) localStorage.removeItem(k);
      });
      localStorage.removeItem('gfp_branding');
    } catch (e) { /* ignore */ }
  }

  // Paint cached colors ASAP (before DOMContentLoaded) to avoid green flash
  try {
    var early = readCache();
    if (early) {
      ensureRuntimeCss();
      applyCssVars(early);
    }
  } catch (e) { /* ignore */ }

  global.GfpBranding = { apply: apply, load: load, clear: clear, reapply: reapply };

  function boot() {
    load().then(function () {
      // Pages often rewrite gymName after load — re-assert branding once more
      setTimeout(function () {
        reapply();
      }, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
