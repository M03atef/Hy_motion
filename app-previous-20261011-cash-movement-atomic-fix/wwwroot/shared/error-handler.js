/**
 * HyMotion — global unhandled error/rejection handler.
 * Catches unhandled errors and promise rejections, shows a user-friendly toast,
 * logs to console, and fires events for crash reporting.
 *
 * Does NOT swallow errors — they still appear in devtools.
 * Does NOT show toasts for expected auth redirects (session expiry).
 *
 * Events:
 *   gfp:error — fired on unhandled error with { error, source, line, col } detail
 */
(function (global) {
  'use strict';

  // Dedupe: don't spam the same message within 3s
  var recentErrors = {};
  var DEDUPE_MS = 3000;

  function isDuplicate(msg) {
    var key = String(msg).slice(0, 120);
    if (recentErrors[key]) return true;
    recentErrors[key] = true;
    setTimeout(function () { delete recentErrors[key]; }, DEDUPE_MS);
    return false;
  }

  // Ignore expected conditions
  function shouldIgnore(msg) {
    msg = String(msg || '').toLowerCase();
    // Auth redirects (silent refresh → logout is intentional)
    if (msg.indexOf('session expired') !== -1) return true;
    // ResizeObserver loop limit exceeded — harmless browser noise
    if (msg.indexOf('resizeobserver') !== -1) return true;
    // Script loading errors from extensions
    if (msg.indexOf('extension') !== -1) return true;
    return false;
  }

  function handleError(msg, source, line, col, err) {
    if (shouldIgnore(msg)) return;
    if (isDuplicate(msg)) return;

    console.error('[GfpError]', msg, source, line, col, err);

    // Optional external crash providers (if already configured elsewhere).
    // This must never break the app.
    try {
      var appVersion =
        global.GfpVersion && typeof global.GfpVersion.get === 'function' ? global.GfpVersion.get() : undefined;
      var appEnv =
        global.GfpVersion && typeof global.GfpVersion.env === 'function' ? global.GfpVersion.env() : undefined;
      var page = global.location && global.location.pathname ? global.location.pathname : '';
      var safeTags = { appVersion: appVersion, appEnv: appEnv, page: page };

      if (global.Sentry && typeof global.Sentry.captureException === 'function') {
        var ex = err instanceof Error ? err : new Error(msg);
        global.Sentry.captureException(ex, { tags: safeTags });
      } else if (global.Bugsnag && typeof global.Bugsnag.notify === 'function') {
        global.Bugsnag.notify(err instanceof Error ? err : new Error(msg), { tags: safeTags });
      }
    } catch (providerErr) {
      // ignore
    }

    // Show user-friendly toast — never raw stack traces
    if (global.GfpToast) {
      var message =
        global.GfpI18n && typeof global.GfpI18n.t === 'function'
          ? global.GfpI18n.t('errors.unexpected')
          : 'errors.unexpected';
      global.GfpToast.error(
        message
      );
    }

    // Fire event for crash reporting integration
    try {
      global.dispatchEvent(new CustomEvent('gfp:error', {
        detail: {
          message: String(msg || ''),
          source: source || '',
          line: line || 0,
          col: col || 0,
          stack: err && err.stack ? err.stack : ''
        }
      }));
    } catch (e) { /* ignore */ }
  }

  global.addEventListener('error', function (ev) {
    handleError(ev.message, ev.filename, ev.lineno, ev.colno, ev.error);
  });

  global.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled promise rejection');
    handleError(msg, '', 0, 0, reason instanceof Error ? reason : null);
  });

  global.GfpErrorHandler = {
    report: handleError
  };
})(typeof window !== 'undefined' ? window : globalThis);
