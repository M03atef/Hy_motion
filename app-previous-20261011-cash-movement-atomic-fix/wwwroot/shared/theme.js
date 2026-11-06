/**
 * HyMotion appearance: light | dark | system.
 * Preference is browser-local (optionally keyed by user id). Not Tenant.Settings.
 */
(function (global) {
  'use strict';
  var KEY = 'gfp_appearance';
  var mq = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;

  function userId() {
    try {
      var u = JSON.parse(global.localStorage.getItem('gfp_user') || global.sessionStorage.getItem('gfp_user') || 'null');
      return (u && (u.id || u.Id || u.userId || u.UserId)) || '';
    } catch (e) {
      return '';
    }
  }

  function scopedKey() {
    var id = userId();
    return id ? KEY + ':' + id : '';
  }

  function normalize(v) {
    return v === 'dark' || v === 'system' || v === 'light' ? v : '';
  }

  function getPref() {
    var scoped = scopedKey();
    var v = '';
    try {
      if (scoped) v = normalize(global.localStorage.getItem(scoped));
      if (!v) v = normalize(global.localStorage.getItem(KEY));
    } catch (e) { /* ignore */ }
    return v || 'light';
  }

  function resolved(pref) {
    pref = pref || getPref();
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return mq && mq.matches ? 'dark' : 'light';
  }

  function apply(pref) {
    pref = normalize(pref) || getPref();
    var theme = resolved(pref);
    var h = document.documentElement;
    h.setAttribute('data-appearance', pref);
    h.setAttribute('data-theme', theme);
    h.style.colorScheme = theme;
    try {
      global.dispatchEvent(new CustomEvent('gfp-theme-change', { detail: { pref: pref, theme: theme } }));
    } catch (e) { /* ignore */ }
    return theme;
  }

  function setPref(pref) {
    pref = normalize(pref) || 'light';
    try {
      global.localStorage.setItem(KEY, pref);
      var scoped = scopedKey();
      if (scoped) global.localStorage.setItem(scoped, pref);
    } catch (e) { /* ignore */ }
    return apply(pref);
  }

  if (mq) {
    var onMq = function () {
      if (getPref() === 'system') apply('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  apply(getPref());

  global.GfpTheme = {
    getPref: getPref,
    setPref: setPref,
    resolved: resolved,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
