/**
 * HyMotion — app version identifier for beta readiness.
 * Exposes build version for crash reports, feedback forms, and support.
 * Version is set at build time or defaults to a timestamp-based fallback.
 *
 * Usage: GfpVersion.get()   → "1.0.0-beta.20260903"
 *        GfpVersion.label() → "HyMotion v1.0.0-beta.20260903"
 */
(function (global) {
  'use strict';

  // Build tooling can replace this string at deploy time
  var BUILD_VERSION = '1.0.0-beta.20260903';
  var BUILD_ENV = 'development';

  function get() {
    return BUILD_VERSION;
  }

  function env() {
    // Check meta tag override (set by deploy pipeline)
    var meta = global.document && global.document.querySelector('meta[name="gfp-version"]');
    if (meta) return meta.getAttribute('content') || BUILD_VERSION;
    return BUILD_VERSION;
  }

  function label() {
    return 'HyMotion v' + get();
  }

  function environment() {
    var meta = global.document && global.document.querySelector('meta[name="gfp-env"]');
    if (meta) return meta.getAttribute('content') || BUILD_ENV;
    return BUILD_ENV;
  }

  // Attach to error reports
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('gfp:error', function (ev) {
      if (ev.detail) {
        ev.detail.appVersion = get();
        ev.detail.appEnv = environment();
      }
    });
  }

  global.GfpVersion = {
    get: get,
    label: label,
    env: environment
  };
})(typeof window !== 'undefined' ? window : globalThis);
