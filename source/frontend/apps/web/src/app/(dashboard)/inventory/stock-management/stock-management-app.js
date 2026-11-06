(function () {
  'use strict';

  var HUB = '/dashboard/inventory/stock-management/';
  var MODES = {
    'on-hand': {
      src: '/dashboard/inventory/stock/?embed=1',
      title: ['On Hand', 'الرصيد']
    },
    move: {
      src: '/dashboard/inventory/transfers/?embed=1',
      title: ['Move stock', 'نقل مخزون'],
      perm: 'inventory.transfer'
    },
    count: {
      src: '/dashboard/inventory/counts/?embed=1',
      title: ['Count stock', 'جرد'],
      perm: 'inventory.adjust'
    }
  };

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || 'null');
    } catch (e) {
      return null;
    }
  }
  function t(en, ar) {
    if (window.GfpI18n && window.GfpI18n.tLabel) return window.GfpI18n.tLabel(en, ar);
    return en;
  }
  function can(perm) {
    if (window.GfpAuthz && typeof window.GfpAuthz.can === 'function') {
      return window.GfpAuthz.can(perm);
    }
    if (window.useCan) return !!window.useCan(perm);
    var user = getUser();
    var role = (user && user.role) || '';
    if (/Owner|Manager/i.test(role)) return true;
    return false;
  }

  var user = getUser();
  if (!user || !getToken()) {
    location.href = '/auth/login/';
    return;
  }

  (function gateStockManagement() {
    var Features = window.GfpFeatures;
    if (!Features) return;
    function redirectIfNeeded(registry) {
      if (registry == null) return;
      if (registry.stock_management === false) {
        location.replace('/dashboard/inventory/products/');
      }
    }
    var reg = Features.readCache && Features.readCache();
    if (reg) {
      redirectIfNeeded(reg);
      return;
    }
    if (Features.probeAllModules) {
      Features.probeAllModules().then(redirectIfNeeded).catch(function () {});
    }
  })();

  var avatar = document.getElementById('userAvatar');
  var nameEl = document.getElementById('userName');
  var roleEl = document.getElementById('userRole');
  if (avatar) {
    avatar.textContent = String(user.fullName || 'U')
      .split(' ')
      .map(function (w) {
        return w[0];
      })
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  if (nameEl) nameEl.textContent = user.fullName || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Staff';
  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.onclick = function () {
      ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach(function (k) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
      location.href = '/auth/login/';
    };
  }

  var tabMove = document.getElementById('tabMove');
  var tabCount = document.getElementById('tabCount');
  if (tabMove) tabMove.hidden = !can('inventory.transfer');
  if (tabCount) tabCount.hidden = !can('inventory.adjust');

  var frame = document.getElementById('smFrame');
  var current = 'on-hand';

  function readTab() {
    try {
      var u = new URL(location.href);
      var tab = (u.searchParams.get('tab') || 'on-hand').toLowerCase();
      if (tab === 'transfer' || tab === 'transfers') tab = 'move';
      if (tab === 'counts') tab = 'count';
      if (!MODES[tab]) tab = 'on-hand';
      if (tab === 'move' && !can('inventory.transfer')) tab = 'on-hand';
      if (tab === 'count' && !can('inventory.adjust')) tab = 'on-hand';
      return tab;
    } catch (e) {
      return 'on-hand';
    }
  }

  function frameSrcFor(tab) {
    var mode = MODES[tab] || MODES['on-hand'];
    var src = new URL(mode.src, location.origin);
    try {
      var hub = new URL(location.href);
      ['productId', 'filter', 'q', 'warehouseId', 'from'].forEach(function (key) {
        if (hub.searchParams.has(key)) src.searchParams.set(key, hub.searchParams.get(key));
      });
    } catch (e) { /* ignore */ }
    src.searchParams.set('embed', '1');
    return src.pathname + src.search + src.hash;
  }

  function setTab(tab, opts) {
    opts = opts || {};
    if (!MODES[tab]) tab = 'on-hand';
    if (tab === 'move' && !can('inventory.transfer')) tab = 'on-hand';
    if (tab === 'count' && !can('inventory.adjust')) tab = 'on-hand';
    current = tab;
    document.querySelectorAll('.sm-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('act', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (frame) {
      var next = frameSrcFor(tab);
      if (frame.getAttribute('data-src') !== next) {
        frame.setAttribute('data-src', next);
        frame.src = next;
      }
    }
    if (!opts.skipUrl) {
      try {
        var u = new URL(location.href);
        u.searchParams.set('tab', tab);
        history.replaceState({}, '', u.pathname + u.search + u.hash);
      } catch (e) { /* ignore */ }
    }
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) {
      window.GfpI18n.applyDocumentLocale();
    }
  }

  document.querySelectorAll('.sm-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTab(btn.getAttribute('data-tab') || 'on-hand');
    });
  });

  window.addEventListener('gfp:locale', function () {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) {
      window.GfpI18n.applyDocumentLocale();
    }
  });

  setTab(readTab(), { skipUrl: false });
})();
