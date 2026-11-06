/**
 * HyMotion — network status detection + offline banner.
 * Provides navigator.onLine tracking, shows a non-intrusive banner when offline,
 * auto-hides on reconnect, and fires custom events for page-level handling.
 *
 * Events:
 *   gfp:offline  — fired when connection is lost
 *   gfp:online   — fired when connection is restored
 *
 * API:
 *   GfpNetwork.isOnline()   — current status
 *   GfpNetwork.onRestore(fn) — one-shot callback when next online
 */
(function (global) {
  'use strict';

  var BANNER_ID = 'gfp-offline-banner';
  var restoreCallbacks = [];
  var wasOffline = false;
  var editionChecked = false;
  var isLocalEdition = false;
  var editionPending = null;

  function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // HyMotion Local Edition has no internet dependency at all (same-machine/LAN API, no online
  // payment gateways) — navigator.onLine legitimately reads false there whenever the PC's network
  // adapters are off, which is a completely normal setup for a Local install, so the "you're not
  // connected to the internet" banner is just noise on every page nav. Ask the API (same call
  // gfp-deployment.js makes) once and cache the answer; on real SaaS this always resolves 'SaaS'
  // (or fails closed to it) so behavior there is unchanged.
  function checkEdition() {
    if (editionChecked) return Promise.resolve(isLocalEdition);
    if (editionPending) return editionPending;
    if (typeof global.fetch !== 'function') {
      editionChecked = true;
      return Promise.resolve(isLocalEdition);
    }
    var base = String(global.API_BASE || global.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
    editionPending = global
      .fetch(base + '/deployment/info', { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(function (r) { return r.ok ? r.json() : { edition: 'SaaS' }; })
      .then(function (data) {
        editionChecked = true;
        isLocalEdition = !!(data && data.edition === 'Local');
        return isLocalEdition;
      })
      .catch(function () {
        editionChecked = true;
        isLocalEdition = false;
        return isLocalEdition;
      });
    return editionPending;
  }

  function createBanner() {
    var el = global.document.getElementById(BANNER_ID);
    if (el) return el;
    el = global.document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;padding:10px 20px;text-align:center;font-size:13px;font-weight:600;display:none;transition:transform .3s ease;';
    el.style.background = 'var(--wrn100, #fef9c3)';
    el.style.color = 'var(--wrn700, #a16207)';
    el.style.borderBottom = '1px solid rgba(234,179,8,.3)';

    var dir = global.document.documentElement && global.document.documentElement.dir ? global.document.documentElement.dir : '';
    var isRtl = dir === 'rtl';
    var text =
      global.GfpI18n && typeof global.GfpI18n.t === 'function'
        ? global.GfpI18n.t('network.offline')
        : 'network.offline';

    el.innerHTML = '<i class="ti ti-wifi-off" style="margin-' + (isRtl ? 'left' : 'right') + ':8px;font-size:16px"></i>';
    var span = global.document.createElement('span');
    span.textContent = text;
    el.appendChild(span);

    global.document.body.insertBefore(el, global.document.body.firstChild);
    return el;
  }

  function showBanner() {
    var banner = createBanner();
    banner.style.display = 'block';
    requestAnimationFrame(function () {
      banner.style.transform = 'translateY(0)';
    });
  }

  function hideBanner() {
    var banner = global.document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.style.display = 'none';
  }

  function handleOffline() {
    wasOffline = true;
    checkEdition().then(function (isLocal) {
      if (!isLocal) showBanner();
    });
    try {
      global.dispatchEvent(new CustomEvent('gfp:offline'));
    } catch (e) { /* IE fallback not needed */ }
  }

  function handleOnline() {
    hideBanner();
    if (wasOffline) {
      wasOffline = false;
      // Show brief "back online" toast if GfpToast is available
      if (global.GfpToast) {
        var restored =
          global.GfpI18n && typeof global.GfpI18n.t === 'function'
            ? global.GfpI18n.t('network.restored')
            : 'network.restored';
        global.GfpToast.success(restored);
      }
      try {
        global.dispatchEvent(new CustomEvent('gfp:online'));
      } catch (e) { /* ignore */ }
      // Fire one-shot restore callbacks
      var cbs = restoreCallbacks.splice(0);
      cbs.forEach(function (fn) {
        try { fn(); } catch (e) { /* ignore */ }
      });
    }
  }

  function onRestore(fn) {
    if (typeof fn === 'function') {
      if (isOnline() && wasOffline) {
        fn();
      } else {
        restoreCallbacks.push(fn);
      }
    }
  }

  // Bind events
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('offline', handleOffline);
    global.addEventListener('online', handleOnline);
    // Show banner immediately if page loads offline
    if (typeof global.document !== 'undefined') {
      if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', function () {
          if (!isOnline()) handleOffline();
        });
      } else {
        if (!isOnline()) handleOffline();
      }
    }
  }

  global.GfpNetwork = {
    isOnline: isOnline,
    onRestore: onRestore
  };
})(typeof window !== 'undefined' ? window : globalThis);
