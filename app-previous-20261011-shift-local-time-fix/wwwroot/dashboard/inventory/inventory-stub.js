/**
 * Shared stub body for inventory routes until FE-INVS-1..10 fill each page.
 * Page sets window.__INVENTORY_STUB__ = { title, titleAr, prompt, icon } before this script.
 */
(function () {
  'use strict';

  var cfg = window.__INVENTORY_STUB__ || {};
  var title = cfg.title || 'Inventory';
  var titleAr = cfg.titleAr || 'المخزون';
  var prompt = cfg.prompt || 'FE-INVS';
  var icon = cfg.icon || 'ti-box';

  var Authz = window.GfpAuthz;
  var Gfp = window.GfpApi;
  var user = Gfp && Gfp.tokens ? Gfp.tokens.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      user = null;
    }
  }
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }

  var ini = String(user.fullName || 'U')
    .split(/\s+/)
    .map(function (w) {
      return w[0];
    })
    .join('')
    .substring(0, 2)
    .toUpperCase();
  var el;
  if ((el = document.getElementById('userAvatar'))) el.textContent = ini;
  if ((el = document.getElementById('userName'))) el.textContent = user.fullName || 'User';
  if ((el = document.getElementById('userRole'))) el.textContent = user.role || 'Staff';

  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      if (Gfp) Gfp.logout();
      else window.location.href = '/auth/login/';
    });
  }

  var host = document.getElementById('stubBody');
  function paintStub() {
    if (!host) return;
    var shown = window.GfpI18n && window.GfpI18n.tLabel ? window.GfpI18n.tLabel(title, titleAr) : title;
    host.innerHTML =
      '<div class="inv-stub-card">' +
      '<div class="inv-stub-icon"><i class="ti ' +
      icon +
      '"></i></div>' +
      '<h1 class="inv-stub-title">' +
      shown +
      '</h1>' +
      '<p class="inv-stub-msg">Coming in <strong>' +
      prompt +
      '</strong> — real APIs only, no mock data.</p>' +
      '<p class="inv-stub-hint">Feature flag <code>inventory</code> · claim-gated via nav</p>' +
      '</div>';
  }
  paintStub();
  window.addEventListener('gfp:locale', paintStub);
})();
