/**
 * HyMotion — hides Local-Edition-only nav items (Backup & Recovery today) on SaaS.
 * nav.js has no edition concept (deliberately, to avoid growing its access-kind vocabulary for
 * one item — see nav.js's comment on the "backup" entry), so this sets a data-gfp-edition
 * attribute on <html> once the edition is known; theme.css hides [data-nav-key="backup"] when
 * that attribute is "saas". CSS-attribute driven (not a one-time DOM removal) so it stays correct
 * across shell.js's repeated renderShellNav() calls (locale switch, sidebar collapse, etc.)
 * without this script needing to hook every one of them.
 * Same self-contained /api/deployment/info check as network-status.js/gfp-deployment.js - no
 * hard dependency on gfp-deployment.js being loaded on this particular page.
 */
(function (global) {
  'use strict';
  if (typeof global.document === 'undefined') return;

  function applyGate(isLocal) {
    global.document.documentElement.setAttribute('data-gfp-edition', isLocal ? 'local' : 'saas');
    if (global.GfpApi && typeof global.GfpApi.setLocalEdition === 'function') {
      global.GfpApi.setLocalEdition(isLocal);
    }
    try {
      global.document.dispatchEvent(new CustomEvent('gfp:edition', { detail: { local: !!isLocal } }));
    } catch (e) { /* ignore */ }
  }

  if (typeof global.fetch !== 'function') {
    applyGate(false);
    return;
  }

  var base = String(global.API_BASE || global.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
  global
    .fetch(base + '/deployment/info', { headers: { 'ngrok-skip-browser-warning': 'true' } })
    .then(function (r) { return r.ok ? r.json() : { edition: 'SaaS' }; })
    .then(function (data) { applyGate(data && data.edition === 'Local'); })
    .catch(function () { applyGate(false); });
})(typeof window !== 'undefined' ? window : globalThis);
