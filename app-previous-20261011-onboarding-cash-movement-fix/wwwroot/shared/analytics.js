/**
 * HyMotion — safe analytics abstraction.
 *
 * This app does not require an analytics provider for correctness.
 * By default analytics is OFF. If an external provider is configured, we
 * forward beta-safe events only (no PII, no secrets).
 *
 * Provider contract (optional):
 * - window.GfpAnalyticsProvider = {
 *     track: function(eventName, properties) {}
 *   }
 * - or window.GfpAnalyticsTrack = function(eventName, properties) {}
 */
(function (global) {
  'use strict';

  function readEnabled() {
    try {
      var v = global.localStorage && global.localStorage.getItem && global.localStorage.getItem('gfp_analytics_enabled');
      if (v === '1') return true;
    } catch (e) { /* ignore */ }

    try {
      var meta = global.document && global.document.querySelector && global.document.querySelector('meta[name="gfp-analytics-enabled"]');
      if (meta && meta.getAttribute) return meta.getAttribute('content') === '1';
    } catch (e2) { /* ignore */ }

    return false;
  }

  var enabled = readEnabled();

  function safeProps(props) {
    if (!props || typeof props !== 'object') return {};
    // Strip obvious secrets/tokens if someone accidentally passes them.
    var out = {};
    Object.keys(props).forEach(function (k) {
      var lk = String(k || '').toLowerCase();
      if (lk.indexOf('token') !== -1) return;
      if (lk.indexOf('password') !== -1) return;
      if (lk.indexOf('secret') !== -1) return;
      if (lk.indexOf('refresh') !== -1) return;
      out[k] = props[k];
    });
    return out;
  }

  function track(eventName, properties) {
    try {
      if (!enabled) return;
      if (!eventName) return;

      var props = safeProps(properties);
      props.appVersion = global.GfpVersion && typeof global.GfpVersion.get === 'function' ? global.GfpVersion.get() : undefined;

      if (global.GfpAnalyticsProvider && typeof global.GfpAnalyticsProvider.track === 'function') {
        global.GfpAnalyticsProvider.track(eventName, props);
        return;
      }
      if (typeof global.GfpAnalyticsTrack === 'function') {
        global.GfpAnalyticsTrack(eventName, props);
        return;
      }
    } catch (e) {
      // Analytics must never break core UX.
      try { console.warn('[GfpAnalytics] track failed', e && e.message ? e.message : e); } catch (e2) { }
    }
  }

  global.GfpAnalytics = {
    enabled: enabled,
    track: track
  };
})(typeof window !== 'undefined' ? window : globalThis);

