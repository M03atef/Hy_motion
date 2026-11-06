/**
 * HyMotion — proactive session expiry warning.
 * Checks token expiry periodically and warns the user 2 minutes before
 * the access token expires (if silent refresh is unavailable).
 * Also triggers silent refresh proactively rather than waiting for a failed request.
 *
 * Does NOT replace the api-client.js Token-Expired interceptor — this is an additional
 * UX layer that prevents the "suddenly logged out" experience.
 */
(function (global) {
  'use strict';

  var WARN_BEFORE_MS = 2 * 60 * 1000; // 2 minutes before expiry
  var CHECK_INTERVAL_MS = 30 * 1000;   // check every 30s
  var warned = false;
  var timer = null;

  function getExpiresAt() {
    var raw = (global.GfpApi && global.GfpApi.tokens) ? global.GfpApi.tokens.getExpiresAt() : null;
    if (!raw) return null;
    var ms = new Date(raw).getTime();
    return isNaN(ms) ? null : ms;
  }

  function hasRefreshToken() {
    if (global.GfpApi && global.GfpApi.tokens && typeof global.GfpApi.tokens.hasRefreshCredential === 'function') {
      return !!global.GfpApi.tokens.hasRefreshCredential();
    }
    return !!(global.GfpApi && global.GfpApi.tokens && global.GfpApi.tokens.getRefresh());
  }

  function check() {
    var exp = getExpiresAt();
    if (!exp) return; // not logged in

    var remaining = exp - Date.now();

    // Already expired — api-client handles this via Token-Expired header
    if (remaining <= 0) return;

    // Proactive refresh: if <2min left and we have a refresh token, trigger silent refresh
    if (remaining < WARN_BEFORE_MS && hasRefreshToken()) {
      if (global.GfpApi && global.GfpApi.auth && global.GfpApi.auth.refresh) {
        global.GfpApi.auth.refresh();
      }
      warned = false;
      return;
    }

    // Warn only if no refresh token (session-only, can't auto-refresh)
    if (remaining < WARN_BEFORE_MS && !hasRefreshToken() && !warned) {
      warned = true;
      if (global.GfpToast) {
        var message =
          global.GfpI18n && typeof global.GfpI18n.t === 'function'
            ? global.GfpI18n.t('session.expiringSoon')
            : 'session.expiringSoon';
        global.GfpToast.warn(message, { duration: 10000 });
      }
    }
  }

  function start() {
    stop();
    warned = false;
    timer = setInterval(check, CHECK_INTERVAL_MS);
    // First check after a short delay
    setTimeout(check, 5000);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Auto-start when a session exists
  if (typeof global.document !== 'undefined') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  global.GfpSessionGuard = { start: start, stop: stop, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
