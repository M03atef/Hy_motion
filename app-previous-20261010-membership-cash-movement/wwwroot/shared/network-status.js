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
  var HOST_BANNER_ID = 'gfp-host-banner';
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

  // ── Host-unreachable banner (multi-PC LAN) ──
  // navigator.onLine stays true when a client PC is on the LAN but the Host is down / wrong
  // address / firewall blocking, so the offline banner never fires there. api-client.js calls
  // hostUnreachable() whenever a request fails before reaching the server (fetch status 0) and
  // hostReachable() on the first successful response, so the banner appears and clears itself
  // without any per-page wiring.

  function tOr(key, fallback) {
    return global.GfpI18n && typeof global.GfpI18n.t === 'function' ? global.GfpI18n.t(key) : fallback;
  }

  function createHostBanner() {
    var el = global.document.getElementById(HOST_BANNER_ID);
    if (el) return el;
    el = global.document.createElement('div');
    el.id = HOST_BANNER_ID;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:10000;padding:12px 20px;text-align:center;font-size:13px;display:none;box-shadow:0 -2px 10px rgba(0,0,0,.12);';
    el.style.background = 'var(--err50, #fef2f2)';
    el.style.color = 'var(--err700, #b91c1c)';
    el.style.borderTop = '1px solid rgba(220,38,38,.35)';
    return el;
  }

  /**
   * Shows the "cannot reach the HyMotion Host" banner. `hostUrl` — the origin the app was
   * trying to reach, e.g. http://192.168.1.50:7140 (optional; defaults to the current origin).
   */
  function hostUnreachable(hostUrl) {
    var el = createHostBanner();
    el.textContent = '';

    var titleLine = global.document.createElement('div');
    titleLine.style.cssText = 'font-weight:700;font-size:14px;';
    titleLine.textContent = tOr('network.hostDown', 'Cannot connect to the HyMotion Host');
    el.appendChild(titleLine);

    var url = String(hostUrl || global.location.origin || '');
    if (url) {
      var urlLine = document.createElement('div');
      urlLine.style.cssText = 'margin-top:2px;direction:ltr;unicode-bidi:plaintext;';
      urlLine.textContent = url;
      el.appendChild(urlLine);
    }

    var checks = document.createElement('div');
    checks.style.cssText = 'margin-top:6px;font-weight:400;opacity:.9;';
    checks.textContent = tOr(
      'network.hostDownChecks',
      'Check: 1) the Host PC is on and HyMotion is running   2) both PCs are on the same network   3) the address is correct'
    );
    el.appendChild(checks);

    var retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = tOr('network.hostRetry', 'Try again');
    retry.style.cssText = 'margin-top:8px;padding:4px 14px;font-size:13px;font-weight:600;cursor:pointer;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit;';
    retry.addEventListener('click', function () {
      global.location.reload();
    });
    el.appendChild(retry);

    global.document.body.appendChild(el);
    el.style.display = 'block';
  }

  /** Hides the host-unreachable banner (called by api-client on the first successful response). */
  function hostReachable() {
    var el = global.document.getElementById(HOST_BANNER_ID);
    if (el) el.style.display = 'none';
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
    onRestore: onRestore,
    hostUnreachable: hostUnreachable,
    hostReachable: hostReachable
  };
})(typeof window !== 'undefined' ? window : globalThis);
