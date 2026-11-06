/**
 * HyMotion web — deployment edition helper (SaaS | Local).
 * Single place that knows which payment method codes are "online gateway" methods and how to
 * ask the backend which edition this install is running as (GET /api/deployment/info, anonymous).
 * Pages needing to hide/disable online payment options in Local Edition should use this instead
 * of hardcoding their own edition checks — see hideOnlineGatewayRadios / isOnlineGatewayMethod.
 */
(function (global) {
  'use strict';

  // Method codes used across the app for card/wallet gateways (POS split-payment select values,
  // member onboarding / membership-assign radio values — the two naming conventions in use).
  var ONLINE_GATEWAY_METHODS = ['card_paymob', 'paymob', 'fawry', 'vodafone', 'vodafone_cash', 'instapay'];

  var cachedEdition = null;
  var pending = null;

  function apiBase() {
    return String(global.API_BASE || global.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
  }

  function getEdition() {
    if (cachedEdition) return Promise.resolve(cachedEdition);
    if (pending) return pending;
    pending = fetch(apiBase() + '/deployment/info', { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(function (r) { return r.ok ? r.json() : { edition: 'SaaS' }; })
      .then(function (data) {
        cachedEdition = data && data.edition === 'Local' ? 'Local' : 'SaaS';
        return cachedEdition;
      })
      .catch(function () {
        return 'SaaS'; // Fail safe to full SaaS behavior if the check itself fails.
      });
    return pending;
  }

  function isOnlineGatewayMethod(code) {
    return ONLINE_GATEWAY_METHODS.indexOf(String(code || '').toLowerCase()) !== -1;
  }

  /** Removes online-gateway entries from a plain array of method codes (e.g. POS split-payment select). */
  function filterOnlineGatewayCodes(codes) {
    return (codes || []).filter(function (c) { return !isOnlineGatewayMethod(c); });
  }

  /**
   * Hides the <label> wrapper around any ".payment-radios input[type=radio]" whose value is an
   * online gateway method, scoped to `root` (defaults to the whole document). Safe to call
   * multiple times / before the radios exist yet — no-ops on SaaS.
   */
  function hideOnlineGatewayRadios(root) {
    return getEdition().then(function (edition) {
      if (edition !== 'Local') return;
      var scope = root || document;
      var radios = scope.querySelectorAll('.payment-radios input[type="radio"]');
      for (var i = 0; i < radios.length; i++) {
        var input = radios[i];
        if (isOnlineGatewayMethod(input.value)) {
          var label = input.closest('label');
          if (label) label.style.display = 'none';
        }
      }
    });
  }

  global.GfpDeployment = {
    getEdition: getEdition,
    isOnlineGatewayMethod: isOnlineGatewayMethod,
    filterOnlineGatewayCodes: filterOnlineGatewayCodes,
    hideOnlineGatewayRadios: hideOnlineGatewayRadios,
  };
})(typeof window !== 'undefined' ? window : globalThis);
