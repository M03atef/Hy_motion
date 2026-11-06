/**
 * HyMotion — sidebar/topbar shell (Prompt 2B).
 * Consumes useVisibleNav(): grouped collapsible categories, RTL-aware, active route,
 * claim-driven default landing, empty-nav friendly state.
 */
(function (global) {
  'use strict';

  var COLLAPSE_KEY = 'gfp_nav_collapse_v1';
  var lastRegistry = null;
  var bootDone = false;
  /** @type {Record<string, boolean>} categoryKey → collapsed */
  var collapsedState = loadCollapseState();

  function navApi() {
    return global.GfpNav || null;
  }

  function getNavItems() {
    var Nav = navApi();
    return (Nav && Nav.NAV_ITEMS) || [];
  }

  function loadCollapseState() {
    try {
      var raw = global.sessionStorage.getItem(COLLAPSE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveCollapseState() {
    try {
      global.sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedState));
    } catch (e) { /* ignore */ }
  }

  function isCollapsed(key, cat) {
    if (Object.prototype.hasOwnProperty.call(collapsedState, key)) {
      return !!collapsedState[key];
    }
    return !!(cat && cat.defaultCollapsed);
  }

  function setCategoryCollapsed(key, value) {
    collapsedState[key] = !!value;
    saveCollapseState();
  }

  function normalizePath(href) {
    try {
      var u = new URL(href, global.location.origin);
      var p = u.pathname.replace(/\/+$/, '') || '/';
      return p.endsWith('/') ? p : p + '/';
    } catch (e) {
      return String(href || '');
    }
  }

  function findNavConfig(pathname) {
    var p = normalizePath(pathname);
    // Stock Management hub owns legacy On Hand / Move / Count + Buy/Fix deep links
    var stockHubRoots = [
      '/dashboard/inventory/stock-management/',
      '/dashboard/inventory/stock/',
      '/dashboard/inventory/transfers/',
      '/dashboard/inventory/counts/',
      '/dashboard/inventory/adjustments/'
    ];
    var i;
    for (i = 0; i < stockHubRoots.length; i++) {
      var root = normalizePath(stockHubRoots[i]);
      if (p === root || p.indexOf(root) === 0) {
        var hub = null;
        getNavItems().forEach(function (item) {
          if (item.key === 'inv-stock-hub') hub = item;
        });
        if (hub) return hub;
        break;
      }
    }
    // Legacy Promo Codes desk highlights Offers & Promotions nav item
    if (p === '/dashboard/promo-codes/' || p.indexOf('/dashboard/promo-codes/') === 0) {
      var offersNav = null;
      getNavItems().forEach(function (item) {
        if (item.key === 'offers') offersNav = item;
      });
      if (offersNav) return offersNav;
    }
    // HR secondary desks — promoted items have own nav keys; others alias to parent
    var hrAliases = [
      { prefix: '/dashboard/hr/shifts/', key: 'hr-schedule' },
      { prefix: '/dashboard/hr/settings/', key: 'hr-employees' },
      { prefix: '/dashboard/hr/documents/', key: 'hr-employees' },
      { prefix: '/dashboard/hr/biometric-events/', key: 'hr-biometric-devices' }
    ];
    for (i = 0; i < hrAliases.length; i++) {
      var alias = hrAliases[i];
      var pref = normalizePath(alias.prefix);
      if (p === pref || p.indexOf(pref) === 0) {
        var hrNav = null;
        getNavItems().forEach(function (item) {
          if (item.key === alias.key) hrNav = item;
        });
        if (hrNav) return hrNav;
        break;
      }
    }
    var best = null;
    getNavItems().forEach(function (item) {
      var ip = normalizePath(item.path);
      if (p === ip || (ip !== '/dashboard/' && p.indexOf(ip) === 0)) {
        if (!best || ip.length > normalizePath(best.path).length) best = item;
      }
    });
    return best;
  }

  function isNavItemVisible(item, registry) {
    var Nav = navApi();
    if (Nav && Nav.isNavItemVisible) return Nav.isNavItemVisible(item, registry);
    return true;
  }

  function useVisibleNav(registry) {
    var Nav = navApi();
    if (Nav && Nav.useVisibleNav) {
      return Nav.useVisibleNav(registry !== undefined ? registry : lastRegistry);
    }
    // GfpNav missing (stale server inject / hard-cache) — never dump an authenticated
    // staff user into an empty shell; expose Overview at minimum.
    if (global.console && console.warn) {
      console.warn('[GfpShell] GfpNav missing — /shared/nav.js not loaded. Restart apps/web.');
    }
    if (global.GfpAuthz && global.GfpAuthz.useCanRole('AnyStaff')) {
      return [
        {
          key: 'overview',
          label: 'Home',
          labelAr: 'الرئيسية',
          items: [
            {
              key: 'dashboard',
              label: 'Dashboard',
              labelAr: 'لوحة التحكم',
              path: '/dashboard/',
              icon: 'ti-layout-dashboard',
              access: { kind: 'any' }
            }
          ]
        }
      ];
    }
    return [];
  }

  function getDefaultLandingPath(registry) {
    var Nav = navApi();
    var cats = useVisibleNav(registry !== undefined ? registry : lastRegistry);
    if (Nav && Nav.getDefaultLandingPath) return Nav.getDefaultLandingPath(cats);
    if (!cats.length || !cats[0].items.length) return null;
    return cats[0].items[0].path;
  }

  function getLocale() {
    return (global.GfpI18n && global.GfpI18n.getLocale()) || 'en';
  }

  function isRtl() {
    return getLocale() === 'ar' || (global.document.documentElement && global.document.documentElement.dir === 'rtl');
  }

  function tLabel(en, ar) {
    if (global.GfpI18n) return global.GfpI18n.tLabel(en, ar, getLocale());
    return getLocale() === 'ar' ? ar || en : en;
  }

  function ensureShellStyles() {
    if (global.document.getElementById('gfp-shell-css')) return;
    var css = global.document.createElement('style');
    css.id = 'gfp-shell-css';
    css.textContent = [
      '.gfp-lang-toggle{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--ls3,#E8E8E8);background:var(--ls1,#fff);border-radius:999px;font-size:var(--gfp-fs-sm,13px);font-weight:700;cursor:pointer;color:var(--lts,#4A4A4A);flex-shrink:0}',
      '.gfp-lang-toggle:hover{border-color:var(--l500,#7ACC00);color:var(--l600,#5EAF00)}',
      '.gfp-appear-toggle{display:inline-flex;align-items:center;padding:2px;border:1px solid var(--ls3,#E8E8E8);background:var(--ls2,#F5F5F5);border-radius:999px;flex-shrink:0;gap:2px}',
      '.gfp-appear-toggle button{height:26px;min-width:30px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:var(--lts,#4A4A4A);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px}',
      '.gfp-appear-toggle button.act{background:var(--l500,#7ACC00);color:#0D0D0D}',
      '.gfp-appear-toggle button:focus-visible{outline:2px solid var(--l400,#A0E040);outline-offset:1px}',
      'html[dir=rtl] .sidebar{left:auto;right:0}',
      'html[dir=rtl] .main{margin-left:0;margin-right:var(--sidebar-w,240px)}',
      '.sidebar{width:var(--sidebar-w,240px)}',
      '.main{margin-left:var(--sidebar-w,240px)}',
      '.gfp-sb-nav{display:flex;flex-direction:column;gap:6px;padding:10px 0 12px;overflow-y:auto;flex:1;min-height:0}',
      'html[dir=rtl] .gfp-sb-nav{direction:rtl}',
      '.gfp-nav-cat{display:flex;flex-direction:column;gap:2px}',
      '.gfp-nav-cat-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:10px 14px 6px;border:0;background:transparent;cursor:pointer;color:var(--c400,#9CA3AF);font-size:var(--gfp-fs-xs,12px);font-weight:700;letter-spacing:.4px;text-align:start;border-radius:6px}',
      'html[dir=ltr] .gfp-nav-cat-hdr{text-transform:uppercase;letter-spacing:.6px}',
      'html[dir=rtl] .gfp-nav-cat-hdr{text-transform:none;letter-spacing:0;font-family:var(--fa,"Cairo"),sans-serif}',
      '.gfp-nav-cat-hdr:hover{color:var(--c200,#E5E7EB)}',
      '.gfp-nav-cat-hdr:focus-visible{outline:2px solid var(--l400,#A0E040);outline-offset:2px}',
      '.gfp-nav-cat.has-active > .gfp-nav-cat-hdr{color:var(--l400,#A0E040)}',
      '.gfp-nav-cat-hdr .gfp-chev{font-size:15px;transition:transform .15s ease;flex-shrink:0}',
      '.gfp-nav-cat.collapsed .gfp-nav-items{display:none}',
      '.gfp-nav-items{display:flex;flex-direction:column;gap:1px;padding:0 6px 8px}',
      'html[dir=rtl] .gfp-nav-items{direction:rtl}',
      '.gfp-nav-item{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:8px;color:var(--c200,#E5E7EB);text-decoration:none;font-size:var(--gfp-fs-md,14px);font-weight:600;line-height:1.35;border-inline-start:3px solid transparent}',
      '.gfp-nav-item .gfp-nav-label{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere}',
      '.gfp-nav-item:hover{background:rgba(255,255,255,.06);color:#fff}',
      '.gfp-nav-item:focus-visible{outline:2px solid var(--l400,#A0E040);outline-offset:1px}',
      '.gfp-nav-item.act{background:rgba(122,204,0,.12);color:var(--l400,#A0E040);border-inline-start-color:var(--l500,#7ACC00)}',
      '.gfp-nav-item i{font-size:19px;opacity:.9;flex-shrink:0;margin-top:1px;width:20px;text-align:center}',
      '.gfp-nav-empty{padding:20px 16px;text-align:center;color:var(--c400,#9CA3AF);font-size:var(--gfp-fs-md,14px);line-height:1.5}',
      '.gfp-nav-empty i{font-size:28px;display:block;margin-bottom:10px;opacity:.7}',
      '.gfp-nav-empty .ar{font-family:var(--fa,"Cairo"),sans-serif;direction:rtl;margin-top:8px;font-size:var(--gfp-fs-sm,13px)}',
      '.gfp-shell-empty-main{display:flex;align-items:center;justify-content:center;min-height:50vh;padding:40px 24px;text-align:center}',
      '.gfp-shell-empty-main .card{max-width:420px;padding:32px;border-radius:16px;background:var(--ls1,#fff);border:1px solid var(--ls3,#E8E8E8);box-shadow:var(--sh2,0 4px 16px rgba(0,0,0,.06))}',
      '.gfp-shell-empty-main i{font-size:40px;color:var(--l500,#7ACC00);margin-bottom:12px;display:block}',
      '.sb-item[hidden],.sb-item.gfp-nav-hidden{display:none!important;pointer-events:none!important}'
    ].join('\n');
    global.document.head.appendChild(css);
  }

  function injectLangToggle() {
    if (global.document.getElementById('gfpLangToggle')) return;
    var I18n = global.GfpI18n;
    if (!I18n) return;
    // Never inject into .sb-ft — that footer is already tight (avatar + name + logout).
    var host =
      global.document.querySelector('.tb-right') ||
      global.document.querySelector('.topbar');
    if (!host) return;
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.id = 'gfpLangToggle';
    btn.className = 'gfp-lang-toggle';
    function paint() {
      // Show the CURRENT language (not the target). "EN" while Arabic was active
      // made owners think English was selected while the sidebar stayed Arabic.
      var loc = I18n.getLocale();
      var isAr = loc === 'ar';
      btn.textContent = isAr ? 'AR' : 'EN';
      btn.setAttribute('data-locale', loc);
      btn.setAttribute(
        'aria-label',
        isAr
          ? 'Current language: Arabic. Click to switch to English'
          : 'Current language: English. Click to switch to Arabic'
      );
      btn.title = isAr
        ? 'العربية — انقر للإنجليزية'
        : 'English — click for Arabic';
    }
    paint();
    btn.addEventListener('click', function () {
      I18n.toggleLocale();
      paint();
      renderShellNav(lastRegistry);
    });
    if (host.classList.contains('tb-right') || host.classList.contains('topbar')) {
      host.insertBefore(btn, host.firstChild);
    } else {
      host.appendChild(btn);
    }
  }

  function injectAppearanceToggle() {
    if (global.document.getElementById('gfpAppearToggle')) return;
    var Theme = global.GfpTheme;
    if (!Theme || !Theme.setPref) return;
    // Never inject into .sb-ft — keeps the user/logout row usable.
    var host =
      global.document.querySelector('.tb-right') ||
      global.document.querySelector('.topbar');
    if (!host) return;
    var wrap = global.document.createElement('div');
    wrap.id = 'gfpAppearToggle';
    wrap.className = 'gfp-appear-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Appearance');
    var opts = [
      { id: 'light', icon: 'ti-sun', title: 'Light' },
      { id: 'dark', icon: 'ti-moon', title: 'Dark' },
      { id: 'system', icon: 'ti-device-desktop', title: 'System' }
    ];
    function paint() {
      var pref = Theme.getPref();
      wrap.querySelectorAll('[data-appearance]').forEach(function (btn) {
        btn.classList.toggle('act', btn.getAttribute('data-appearance') === pref);
      });
    }
    opts.forEach(function (opt) {
      var btn = global.document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-appearance', opt.id);
      btn.title = opt.title;
      btn.setAttribute('aria-label', opt.title);
      btn.innerHTML = '<i class="ti ' + opt.icon + '"></i>';
      btn.addEventListener('click', function () {
        Theme.setPref(opt.id);
        paint();
      });
      wrap.appendChild(btn);
    });
    paint();
    if (host.classList.contains('tb-right') || host.classList.contains('topbar')) {
      host.insertBefore(wrap, host.firstChild);
    } else {
      host.appendChild(wrap);
    }
  }

  function pathIsActive(itemPath, currentPath) {
    var itemUrl;
    var curUrl;
    try {
      itemUrl = new URL(itemPath, global.location.origin);
      curUrl = new URL(currentPath, global.location.origin);
    } catch (e) {
      var ip0 = normalizePath(itemPath);
      var cp0 = normalizePath(currentPath);
      if (cp0 === ip0) return true;
      if (ip0 === normalizePath('/dashboard/')) return cp0 === ip0;
      return cp0.indexOf(ip0) === 0;
    }
    var ip = normalizePath(itemUrl.pathname);
    var cp = normalizePath(curUrl.pathname);
    // Dashboard root: only exact match so /dashboard/members/ isn't "Dashboard"
    if (ip === normalizePath('/dashboard/')) return cp === ip;
    // POS vs Sell retail share pathname — distinguish by ?mode=retail
    if (ip === normalizePath('/dashboard/pos/')) {
      if (cp !== ip) return false;
      var itemRetail = itemUrl.searchParams.get('mode') === 'retail';
      var curRetail = curUrl.searchParams.get('mode') === 'retail';
      return itemRetail === curRetail;
    }
    // Expenses deep-links to /dashboard/reports/?tab=expenses — distinguish from Reports
    if (ip === normalizePath('/dashboard/reports/')) {
      if (cp !== ip) return false;
      var itemTab = itemUrl.searchParams.get('tab') || '';
      var curTab = curUrl.searchParams.get('tab') || '';
      // Expenses nav item: active only when ?tab=expenses
      if (itemTab === 'expenses') return curTab === 'expenses';
      // Reports nav item: active when no ?tab=expenses
      return curTab !== 'expenses';
    }
    // Inventory overview is exact-only (do not steal On Hand / nested routes)
    if (ip === normalizePath('/dashboard/inventory/')) {
      return cp === ip;
    }
    // Stock Management hub — active for hub + legacy stock/move/count + Buy/Fix deep links
    if (ip === normalizePath('/dashboard/inventory/stock-management/')) {
      if (cp === ip) return true;
      if (cp.indexOf(normalizePath('/dashboard/inventory/stock')) === 0) return true;
      if (cp.indexOf(normalizePath('/dashboard/inventory/transfers')) === 0) return true;
      if (cp.indexOf(normalizePath('/dashboard/inventory/counts')) === 0) return true;
      if (cp.indexOf(normalizePath('/dashboard/inventory/adjustments')) === 0) return true;
      return false;
    }
    // Legacy On Hand path (redirects to hub) — keep Buy/Fix highlight
    if (ip === normalizePath('/dashboard/inventory/stock/')) {
      if (cp === ip) return true;
      if (cp.indexOf(normalizePath('/dashboard/inventory/adjustments')) === 0) return true;
      return false;
    }
    if (cp === ip) return true;
    return cp.indexOf(ip) === 0;
  }

  function getSbNavHost() {
    var existing = global.document.querySelector('.sb-nav');
    if (existing) return existing;
    var sidebar = global.document.querySelector('.sidebar') || global.document.getElementById('sidebar');
    if (!sidebar) return null;
    var nav = global.document.createElement('nav');
    nav.className = 'sb-nav gfp-sb-nav';
    var hdr = sidebar.querySelector('.sb-hdr');
    if (hdr && hdr.nextSibling) sidebar.insertBefore(nav, hdr.nextSibling);
    else sidebar.insertBefore(nav, sidebar.firstChild);
    return nav;
  }

  function chevronIcon(collapsed) {
    // RTL: expanded → chevron points "end"; flip for collapse
    var rtl = isRtl();
    if (collapsed) return rtl ? 'ti-chevron-left' : 'ti-chevron-right';
    return 'ti-chevron-down';
  }

  function renderEmptyNav(host) {
    host.innerHTML =
      '<div class="gfp-nav-empty" role="status">' +
      '<i class="ti ti-lock-access"></i>' +
      '<div><strong>No accessible sections</strong></div>' +
      '<div style="margin-top:6px">Contact your gym owner to grant permissions.</div>' +
      '<div class="ar">لا توجد أقسام متاحة — تواصل مع مالك الصالة لمنح الصلاحيات</div>' +
      '</div>';
  }

  function showEmptyMainIfNeeded(cats) {
    var main = global.document.querySelector('.main .content') || global.document.querySelector('.main');
    if (!main) return;

    if (cats.length) {
      var mainEmpty = global.document.getElementById('gfpShellEmptyMain');
      if (mainEmpty) mainEmpty.remove();
      Array.prototype.forEach.call(main.children, function (ch) {
        if (ch.getAttribute && ch.getAttribute('data-gfp-shell-hidden') === '1') {
          ch.style.removeProperty('display');
          ch.removeAttribute('data-gfp-shell-hidden');
        }
      });
      return;
    }

    // Blank shell on any dashboard route when zero categories
    if (global.document.getElementById('gfpShellEmptyMain')) return;
    var wrap = global.document.createElement('div');
    wrap.id = 'gfpShellEmptyMain';
    wrap.className = 'gfp-shell-empty-main';
    wrap.innerHTML =
      '<div class="card">' +
      '<i class="ti ti-shield-off"></i>' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:8px">' +
      tLabel('No accessible sections', 'لا توجد أقسام متاحة') +
      '</div>' +
      '<div style="font-size:14px;color:var(--ltt,#888)">' +
      tLabel(
        'This staff account has no permitted screens. Contact your gym owner.',
        'هذا الحساب لا يملك صلاحيات للوصول. تواصل مع مالك الصالة.'
      ) +
      '</div></div>';
    // Hide noisy page content
    Array.prototype.forEach.call(main.children, function (ch) {
      if (ch.id !== 'gfpShellEmptyMain') {
        ch.setAttribute('data-gfp-shell-hidden', '1');
        ch.style.display = 'none';
      }
    });
    main.appendChild(wrap);
  }

  function renderShellNav(registry) {
    if (registry !== undefined) lastRegistry = registry;
    var host = getSbNavHost();
    if (!host) return;

    // Hide legacy flat links that pages still include in markup
    host.querySelectorAll(':scope > a.sb-item').forEach(function (a) {
      a.classList.add('gfp-nav-hidden');
      a.hidden = true;
      a.removeAttribute('href');
    });

    var cats = useVisibleNav(registry);
    host.classList.add('gfp-sb-nav');

    if (!cats.length) {
      renderEmptyNav(host);
      showEmptyMainIfNeeded(cats);
      return;
    }
    showEmptyMainIfNeeded(cats);

    var current = global.location.pathname + global.location.search;
    var rtl = isRtl();
    var html = '';

    // Category order follows registry; DOM dir=rtl mirrors start/end (chevron + border)
    cats.forEach(function (cat) {
      var collapsed = isCollapsed(cat.key, cat);
      var hasActive = cat.items.some(function (item) {
        return pathIsActive(item.path, current);
      });
      if (hasActive) collapsed = false;
      var catLabel = tLabel(cat.label, cat.labelAr);
      html +=
        '<div class="gfp-nav-cat' +
        (collapsed ? ' collapsed' : '') +
        (hasActive ? ' has-active' : '') +
        '" data-cat="' +
        cat.key +
        '">' +
        '<button type="button" class="gfp-nav-cat-hdr" data-cat-toggle="' +
        cat.key +
        '" aria-expanded="' +
        (!collapsed) +
        '">' +
        '<span>' +
        catLabel +
        '</span>' +
        '<i class="ti ' +
        chevronIcon(collapsed) +
        ' gfp-chev" aria-hidden="true"></i>' +
        '</button>' +
        '<div class="gfp-nav-items">';

      cat.items.forEach(function (item) {
        var active = pathIsActive(item.path, current);
        var itemLabel = tLabel(item.label, item.labelAr);
        html +=
          '<a class="gfp-nav-item sb-item' +
          (active ? ' act' : '') +
          '" href="' +
          item.path +
          '" data-gfp-href="' +
          item.path +
          '" data-nav-key="' +
          item.key +
          '" title="' +
          itemLabel.replace(/"/g, '&quot;') +
          '">' +
          '<i class="ti ' +
          (item.icon || 'ti-circle') +
          '"></i>' +
          '<span class="gfp-nav-label">' +
          itemLabel +
          '</span>' +
          (item.key === 'notifications'
            ? '<span class="gfp-notif-badge" hidden></span>'
            : '') +
          '</a>';
      });

      html += '</div></div>';
    });

    host.innerHTML = html;

    host.querySelectorAll('[data-cat-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = this.getAttribute('data-cat-toggle');
        var catEl = this.closest('.gfp-nav-cat');
        var currentlyCollapsed = catEl && catEl.classList.contains('collapsed');
        setCategoryCollapsed(key, !currentlyCollapsed);
        renderShellNav(lastRegistry);
      });
    });
  }

  function enforceRouteAccess(registry) {
    var path = normalizePath(global.location.pathname);
    if (path.indexOf('/dashboard') !== 0) return;
    // Backup & Recovery is Local-only and Owner-gated on the page itself
    // (API 403 / edition empty-state). Never bounce this URL to Overview —
    // that looks like a dead sidebar link.
    if (path === '/dashboard/backup/' || path.indexOf('/dashboard/backup/') === 0) return;

    var cats = useVisibleNav(registry);
    if (!cats.length) {
      // Stay put — empty shell UI handles messaging
      return;
    }

    var cfg = findNavConfig(path);
    // Wait for feature probes before kicking off feature-gated routes
    if (cfg && (cfg.featureFlag || cfg.featureModule) && registry == null) return;

    // Known nav item the user cannot access → Overview. Unknown nested desk
    // routes (Backup & Recovery, member detail fallbacks, new pages whose
    // nav.js is still cached) must stay — bouncing them to /dashboard/ looks
    // like a broken sidebar link.
    if (!cfg) return;

    var allowed = isNavItemVisible(cfg, registry);
    if (allowed) return;

    var land = getDefaultLandingPath(registry) || '/dashboard/';
    if (normalizePath(land) !== path) {
      global.location.replace(land);
    }
  }

  function clearInlineOwnerOnlyHacks() {
    var staff = global.document.getElementById('navStaff');
    if (staff && staff.style) staff.style.removeProperty('display');
  }

  /**
   * Post-login / session restore landing — first visible item (fail-open modules if needed).
   * @returns {Promise<string>}
   */
  async function resolveLandingPath() {
    var registry = null;
    if (global.GfpFeatures) {
      try {
        registry = await global.GfpFeatures.probeAllModules(false);
      } catch (e) {
        registry = {};
        (global.GfpFeatures.FEATURE_MODULES || []).forEach(function (k) {
          // stock_management is packaging — never fail-open onto Pro hub
          registry[k] = k !== 'stock_management';
        });
      }
    } else {
      registry = {};
    }
    lastRegistry = registry;
    return getDefaultLandingPath(registry) || '/dashboard/';
  }

  function shopUxShouldRedirect(pathname, search) {
    var Features = global.GfpFeatures;
    if (!Features || !Features.SHOP_OWNER_UX) return false;
    if (search && String(search).indexOf('embed=1') !== -1) return false;
    var p = normalizePath(pathname);
    if (p === '/dashboard/inventory/') return true;
    var blocked = [
      '/dashboard/inventory/stock-management/',
      '/dashboard/inventory/stock/',
      '/dashboard/inventory/transfers/',
      '/dashboard/inventory/counts/',
      '/dashboard/inventory/warehouses/',
      '/dashboard/inventory/reports/',
      '/dashboard/inventory/adjustments/'
    ];
    var i;
    for (i = 0; i < blocked.length; i++) {
      var root = normalizePath(blocked[i]);
      if (p === root || p.indexOf(root) === 0) return true;
    }
    return false;
  }

  function maybeShopUxRedirect() {
    if (!global.location || !shopUxShouldRedirect(global.location.pathname, global.location.search)) return;
    global.location.replace('/dashboard/inventory/products/');
  }

  /* ── Sidebar ↔ main layout (Task 2) ── */
  var SB_MIN = 180;
  var SB_MAX = 360;
  var SB_DEFAULT = 240;
  var MAIN_MIN = 480;
  var DRAWER_BP = 768;
  var WIDTH_KEY = 'gfp_sidebar_w';
  var COLLAPSE_PREF_KEY = 'gfp_sidebar_collapsed';
  var layoutBooted = false;
  var drawerOpen = false;
  var collapsedPref = false;
  var savedWidth = SB_DEFAULT;
  var dragState = null;

  function getViewportWidth() {
    return (global.innerWidth || (global.document.documentElement && global.document.documentElement.clientWidth) || 1024);
  }

  function isDrawerViewport(vw) {
    return (vw == null ? getViewportWidth() : vw) < DRAWER_BP;
  }

  function getSidebarMaxForViewport(vw) {
    vw = vw == null ? getViewportWidth() : vw;
    return Math.max(SB_MIN, Math.min(SB_MAX, vw - MAIN_MIN));
  }

  function canResizeSidebar(vw) {
    vw = vw == null ? getViewportWidth() : vw;
    return !isDrawerViewport(vw) && getSidebarMaxForViewport(vw) > SB_MIN;
  }

  function clampSidebarWidth(px, vw) {
    var n = Number(px);
    if (!isFinite(n)) n = SB_DEFAULT;
    var max = getSidebarMaxForViewport(vw);
    return Math.round(Math.min(max, Math.max(SB_MIN, n)));
  }

  function compactDefaultWidth(vw) {
    vw = vw == null ? getViewportWidth() : vw;
    var fallback = vw < 1024 ? 200 : SB_DEFAULT;
    return clampSidebarWidth(fallback, vw);
  }

  function readWidthPref() {
    try {
      var raw = global.localStorage.getItem(WIDTH_KEY);
      if (raw == null) return null;
      var n = parseInt(raw, 10);
      return isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  function writeWidthPref(px) {
    try {
      global.localStorage.setItem(WIDTH_KEY, String(px));
    } catch (e) { /* ignore */ }
  }

  function readCollapsedPref() {
    try {
      return global.localStorage.getItem(COLLAPSE_PREF_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function writeCollapsedPref(value) {
    try {
      global.localStorage.setItem(COLLAPSE_PREF_KEY, value ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function getSidebarEl() {
    return global.document.getElementById('sidebar') || global.document.querySelector('.sidebar');
  }

  function isEmbedShell() {
    var el = global.document.documentElement;
    return !!(el && (el.classList.contains('stock-embed') || el.classList.contains('hr-embed')));
  }

  function ensureShellLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-shell-layout-css')) return;
    if (global.document.querySelector('link[href*="shell-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-shell-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/shell-layout.css?v=3';
    global.document.head.appendChild(link);
  }

  function ensureShellHeaderCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-shell-header-css')) return;
    if (global.document.querySelector('link[href*="shell-header.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-shell-header-css';
    link.rel = 'stylesheet';
    link.href = '/shared/shell-header.css?v=1';
    global.document.head.appendChild(link);
  }

  var TABLE_WRAP_SEL =
    '.table-wrap, .tbl-card, .table-card, .roles-table-card, .att-table-wrap, .offers-table-wrap, .gfp-table-scroll, #tblWrap';
  var TABLE_SKIP_SEL = '.sidebar, #sidebar';
  var tableLayoutBooted = false;
  var tableWrapTimer = null;

  function ensureTableLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-table-layout-css')) return;
    if (global.document.querySelector('link[href*="table-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-table-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/table-layout.css?v=1';
    global.document.head.appendChild(link);
  }

  function ensureFormLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-form-layout-css')) return;
    if (global.document.querySelector('link[href*="form-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-form-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/form-layout.css?v=1';
    global.document.head.appendChild(link);
  }

  function ensureModalLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-modal-layout-css')) return;
    if (global.document.querySelector('link[href*="modal-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-modal-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/modal-layout.css?v=2';
    global.document.head.appendChild(link);
  }

  function ensureSweepLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-sweep-layout-css')) return;
    if (global.document.querySelector('link[href*="sweep-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-sweep-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/sweep-layout.css?v=2';
    global.document.head.appendChild(link);
  }

  function classListHas(el, name) {
    if (!el || !name) return false;
    var cn = el.className;
    if (cn && typeof cn === 'string') {
      return (' ' + cn + ' ').indexOf(' ' + name + ' ') !== -1;
    }
    if (el.classList && typeof el.classList.contains === 'function') {
      return el.classList.contains(name);
    }
    return false;
  }

  function isTableWrapEl(el) {
    return (
      (el && el.id === 'tblWrap') ||
      classListHas(el, 'table-wrap') ||
      classListHas(el, 'tbl-card') ||
      classListHas(el, 'table-card') ||
      classListHas(el, 'roles-table-card') ||
      classListHas(el, 'att-table-wrap') ||
      classListHas(el, 'offers-table-wrap') ||
      classListHas(el, 'gfp-table-scroll')
    );
  }

  function overflowXOf(el) {
    if (!el) return '';
    if (el.style && el.style.overflowX) return String(el.style.overflowX);
    var attr = el.getAttribute && el.getAttribute('style');
    if (attr) {
      var m = /overflow-x\s*:\s*([a-z-]+)/i.exec(attr);
      if (m) return m[1].toLowerCase();
    }
    if (typeof global.getComputedStyle === 'function') {
      try {
        var st = global.getComputedStyle(el);
        if (st && st.overflowX) return String(st.overflowX);
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  function shouldSkipTable(table) {
    if (!table) return true;
    var tag = table.tagName || table.nodeName;
    if (tag && String(tag).toUpperCase() !== 'TABLE') return true;
    if (table.closest) {
      if (table.closest(TABLE_SKIP_SEL)) return true;
      if (table.closest(TABLE_WRAP_SEL)) return true;
    }
    var p = table.parentElement;
    while (p && p !== global.document.body && p !== global.document.documentElement) {
      if (isTableWrapEl(p)) return true;
      var ox = overflowXOf(p);
      if (ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  }

  function wrapNakedTables(root) {
    var doc = global.document;
    if (!doc || !doc.querySelectorAll) return 0;
    var scope = root && root.querySelectorAll ? root : doc;
    var list = scope.querySelectorAll('table');
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var table = list[i];
      if (shouldSkipTable(table)) continue;
      var parent = table.parentNode;
      if (!parent || !parent.insertBefore) continue;
      var wrap = doc.createElement('div');
      wrap.className = 'gfp-table-scroll';
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
      n++;
    }
    return n;
  }

  function initTableLayout() {
    if (!global.document) return;
    ensureTableLayoutCss();
    wrapNakedTables();
    if (tableLayoutBooted) return;
    tableLayoutBooted = true;
    if (!global.MutationObserver || !global.document.body) return;
    var obs = new global.MutationObserver(function () {
      if (tableWrapTimer) global.clearTimeout(tableWrapTimer);
      tableWrapTimer = global.setTimeout(function () {
        wrapNakedTables();
      }, 40);
    });
    try {
      obs.observe(global.document.body, { childList: true, subtree: true });
    } catch (e) { /* ignore non-Node bodies in tests */ }
  }

  function wrapTopbarGym() {
    var right = global.document && global.document.querySelector('.topbar .tb-right');
    if (!right || right.querySelector('.gfp-tb-gym')) return;
    var en =
      right.querySelector('#gymName') ||
      right.querySelector('.tb-gym-name') ||
      right.querySelector('.gym-name');
    if (!en) return;
    var ar =
      right.querySelector('#gymNameAr') ||
      right.querySelector('.tb-gym-name-ar') ||
      right.querySelector('.gym-name-ar');
    var parent = en.parentNode;
    if (parent && parent !== right && parent.children && parent.children.length <= 2) {
      parent.classList.add('gfp-tb-gym');
      return;
    }
    var wrap = global.document.createElement('div');
    wrap.className = 'gfp-tb-gym';
    parent.insertBefore(wrap, en);
    wrap.appendChild(en);
    if (ar && ar.parentNode === parent) wrap.appendChild(ar);
  }

  function initHeaderLayout() {
    if (!global.document || !global.document.querySelector) return;
    if (!global.document.querySelector('.topbar')) return;
    ensureShellHeaderCss();
    wrapTopbarGym();
  }

  function injectSidebarChrome() {
    var doc = global.document;
    var sidebar = getSidebarEl();
    if (!sidebar) return;

    if (!sidebar.id) sidebar.id = 'sidebar';

    var hdr = sidebar.querySelector('.sb-hdr');
    if (hdr && !doc.getElementById('gfpSbClose')) {
      var close = doc.createElement('button');
      close.type = 'button';
      close.id = 'gfpSbClose';
      close.className = 'gfp-sb-close';
      close.innerHTML =
        '<i class="ti ti-x gfp-sb-close-x" aria-hidden="true"></i>' +
        '<i class="ti ti-chevron-left gfp-sb-close-collapse" aria-hidden="true"></i>';
      hdr.appendChild(close);
    }

    if (!sidebar.querySelector('.gfp-sb-resizer')) {
      var handle = doc.createElement('div');
      handle.className = 'gfp-sb-resizer';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      handle.tabIndex = 0;
      sidebar.appendChild(handle);
    }

    if (!doc.getElementById('gfpSbOverlay')) {
      var overlay = doc.createElement('button');
      overlay.type = 'button';
      overlay.id = 'gfpSbOverlay';
      overlay.className = 'gfp-sb-overlay';
      overlay.setAttribute('aria-label', 'Close menu');
      overlay.tabIndex = -1;
      doc.body.appendChild(overlay);
    }

    var existing = doc.getElementById('mobToggle') || doc.querySelector('.mob-toggle');
    if (existing) {
      existing.classList.add('gfp-sb-toggle');
      existing.setAttribute('aria-controls', sidebar.id);
      if (!existing.getAttribute('aria-label')) {
        existing.setAttribute('aria-label', 'Open menu');
      }
    } else if (!doc.getElementById('gfpSbToggle')) {
      var host =
        doc.querySelector('.topbar .tb-left') ||
        doc.querySelector('.topbar');
      if (host) {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.id = 'gfpSbToggle';
        btn.className = 'gfp-sb-toggle mob-toggle';
        btn.setAttribute('aria-controls', sidebar.id);
        btn.setAttribute('aria-label', 'Open menu');
        btn.innerHTML = '<i class="ti ti-menu-2" aria-hidden="true"></i>';
        host.insertBefore(btn, host.firstChild);
      }
    }
  }

  function syncSidebarControls() {
    var html = global.document.documentElement;
    var mode = html.getAttribute('data-gfp-sb');
    var open = html.hasAttribute('data-gfp-sb-open');
    var expanded = mode === 'expanded';
    var toggle =
      global.document.getElementById('gfpSbToggle') ||
      global.document.getElementById('mobToggle') ||
      global.document.querySelector('.gfp-sb-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', mode === 'drawer' ? (open ? 'true' : 'false') : 'false');
      toggle.setAttribute(
        'aria-label',
        mode === 'drawer'
          ? tLabel('Open menu', 'فتح القائمة')
          : tLabel('Open sidebar', 'فتح الشريط الجانبي')
      );
      toggle.title = toggle.getAttribute('aria-label');
    }

    var close = global.document.getElementById('gfpSbClose');
    if (close) {
      close.setAttribute(
        'aria-label',
        expanded ? tLabel('Collapse sidebar', 'طي الشريط الجانبي') : tLabel('Close menu', 'إغلاق القائمة')
      );
      close.title = close.getAttribute('aria-label');
    }

    var overlay = global.document.getElementById('gfpSbOverlay');
    if (overlay) {
      overlay.setAttribute('aria-label', tLabel('Close menu', 'إغلاق القائمة'));
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    var resizer = global.document.querySelector('.gfp-sb-resizer');
    if (resizer) {
      var show = expanded && canResizeSidebar();
      resizer.hidden = !show;
      resizer.setAttribute('aria-hidden', show ? 'false' : 'true');
      resizer.setAttribute('aria-label', tLabel('Resize sidebar', 'تغيير عرض الشريط الجانبي'));
      resizer.setAttribute('aria-valuemin', String(SB_MIN));
      resizer.setAttribute('aria-valuemax', String(getSidebarMaxForViewport()));
      resizer.setAttribute('aria-valuenow', String(savedWidth));
    }

    var sidebar = getSidebarEl();
    if (sidebar) {
      var exposed = mode === 'expanded' || (mode === 'drawer' && open);
      sidebar.setAttribute('aria-hidden', exposed ? 'false' : 'true');
      if (mode === 'drawer' && open) sidebar.setAttribute('aria-modal', 'true');
      else sidebar.removeAttribute('aria-modal');
      if (exposed) sidebar.removeAttribute('inert');
      else sidebar.setAttribute('inert', '');
    }
  }

  function applySidebarLayout() {
    var html = global.document.documentElement;
    if (!html || isEmbedShell()) return;
    var vw = getViewportWidth();
    var stored = readWidthPref();
    savedWidth = clampSidebarWidth(stored != null ? stored : compactDefaultWidth(vw), vw);
    collapsedPref = readCollapsedPref();
    html.style.setProperty('--gfp-sb-rail-w', savedWidth + 'px');

    var sidebar = getSidebarEl();
    if (isDrawerViewport(vw)) {
      html.setAttribute('data-gfp-sb', 'drawer');
      html.style.setProperty('--sidebar-w', '0px');
      if (drawerOpen) html.setAttribute('data-gfp-sb-open', '');
      else html.removeAttribute('data-gfp-sb-open');
      if (sidebar) {
        sidebar.classList.toggle('open', drawerOpen);
        sidebar.classList.toggle('gfp-open', drawerOpen);
      }
    } else {
      drawerOpen = false;
      html.removeAttribute('data-gfp-sb-open');
      if (collapsedPref) {
        html.setAttribute('data-gfp-sb', 'collapsed');
        html.style.setProperty('--sidebar-w', '0px');
        if (sidebar) {
          sidebar.classList.remove('open');
          sidebar.classList.remove('gfp-open');
        }
      } else {
        html.setAttribute('data-gfp-sb', 'expanded');
        html.style.setProperty('--sidebar-w', savedWidth + 'px');
        if (sidebar) {
          sidebar.classList.remove('open');
          sidebar.classList.remove('gfp-open');
        }
      }
    }
    // Narrow rail: hide name/role so avatar + logout stay tappable (no overflow crowd).
    if (html.getAttribute('data-gfp-sb') === 'expanded' && savedWidth < 210) {
      html.setAttribute('data-gfp-sb-compact-ft', '');
    } else {
      html.removeAttribute('data-gfp-sb-compact-ft');
    }
    syncUserFooterTitles();
    syncSidebarControls();
  }

  function syncUserFooterTitles() {
    var nm = global.document.getElementById('userName');
    var rl = global.document.getElementById('userRole');
    var av = global.document.getElementById('userAvatar');
    var logout = global.document.getElementById('btnLogout') || global.document.querySelector('.sb-logout');
    var name = nm && nm.textContent ? String(nm.textContent).trim() : '';
    var role = rl && rl.textContent ? String(rl.textContent).trim() : '';
    var tip = [name, role].filter(Boolean).join(' · ');
    if (av && tip) {
      av.title = tip;
      av.setAttribute('aria-label', tip);
    }
    if (logout) {
      var outLabel = tLabel('Log out', 'تسجيل الخروج');
      var switchHint = tLabel(
        'Sign out of this account. This PC still belongs to this gym.',
        'تسجيل الخروج من هذا الحساب. هذا الجهاز ما زال تابعاً لهذا النادي.'
      );
      var local = global.document.documentElement.getAttribute('data-gfp-edition') === 'local';
      logout.title = local ? switchHint : (tip ? tip + ' — ' + outLabel : outLabel);
      logout.setAttribute('aria-label', outLabel);
    }
    ensureSwitchAccountControl();
  }

  function ensureSwitchAccountControl() {
    if (!global.document) return;
    if (global.document.documentElement.getAttribute('data-gfp-edition') !== 'local') return;
    if (!global.location || !/\/dashboard(\/|$)/.test(global.location.pathname)) return;
    var info = global.document.querySelector('.sb-ft-info');
    if (!info || global.document.getElementById('btnSwitchAccount')) return;
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnSwitchAccount';
    btn.className = 'sb-switch-acc';
    btn.textContent = tLabel('Switch account', 'تبديل الحساب');
    btn.title = tLabel(
      'Sign out of this account. This PC still belongs to this gym.',
      'تسجيل الخروج من هذا الحساب. هذا الجهاز ما زال تابعاً لهذا النادي.'
    );
    info.appendChild(btn);
  }

  function setDrawerOpen(next) {
    drawerOpen = !!next;
    applySidebarLayout();
    if (drawerOpen) {
      var close = global.document.getElementById('gfpSbClose');
      if (close && close.focus) close.focus();
    } else {
      var toggle =
        global.document.getElementById('gfpSbToggle') ||
        global.document.getElementById('mobToggle');
      if (toggle && toggle.focus && getViewportWidth() < DRAWER_BP) toggle.focus();
    }
  }

  function setCollapsed(next) {
    collapsedPref = !!next;
    writeCollapsedPref(collapsedPref);
    applySidebarLayout();
    if (collapsedPref) {
      var toggle =
        global.document.getElementById('gfpSbToggle') ||
        global.document.getElementById('mobToggle');
      if (toggle && toggle.focus) toggle.focus();
    }
  }

  function toggleSidebarLayout() {
    if (isDrawerViewport()) {
      setDrawerOpen(!drawerOpen);
      return;
    }
    setCollapsed(!collapsedPref);
  }

  function closeSidebarLayout() {
    if (isDrawerViewport()) setDrawerOpen(false);
    else if (!collapsedPref) setCollapsed(true);
  }

  function onSidebarPointerDown(e) {
    if (!canResizeSidebar()) return;
    if (e.button != null && e.button !== 0) return;
    var html = global.document.documentElement;
    if (html.getAttribute('data-gfp-sb') !== 'expanded') return;
    dragState = {
      x: e.clientX,
      w: savedWidth,
      rtl: isRtl()
    };
    html.classList.add('gfp-sb-dragging');
    if (e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }
    }
    e.preventDefault();
  }

  function onSidebarPointerMove(e) {
    if (!dragState) return;
    var dx = e.clientX - dragState.x;
    var next = dragState.w + (dragState.rtl ? -dx : dx);
    savedWidth = clampSidebarWidth(next, getViewportWidth());
    global.document.documentElement.style.setProperty('--sidebar-w', savedWidth + 'px');
    global.document.documentElement.style.setProperty('--gfp-sb-rail-w', savedWidth + 'px');
    var resizer = global.document.querySelector('.gfp-sb-resizer');
    if (resizer) resizer.setAttribute('aria-valuenow', String(savedWidth));
  }

  function onSidebarPointerUp() {
    if (!dragState) return;
    dragState = null;
    global.document.documentElement.classList.remove('gfp-sb-dragging');
    writeWidthPref(savedWidth);
    applySidebarLayout();
  }

  function onSidebarKeyResize(e) {
    if (!canResizeSidebar()) return;
    if (global.document.documentElement.getAttribute('data-gfp-sb') !== 'expanded') return;
    var step = e.shiftKey ? 24 : 8;
    var rtl = isRtl();
    var delta = 0;
    if (e.key === 'ArrowLeft') delta = rtl ? step : -step;
    else if (e.key === 'ArrowRight') delta = rtl ? -step : step;
    else if (e.key === 'Home') {
      savedWidth = SB_MIN;
      writeWidthPref(savedWidth);
      applySidebarLayout();
      e.preventDefault();
      return;
    } else if (e.key === 'End') {
      savedWidth = getSidebarMaxForViewport();
      writeWidthPref(savedWidth);
      applySidebarLayout();
      e.preventDefault();
      return;
    } else return;
    savedWidth = clampSidebarWidth(savedWidth + delta, getViewportWidth());
    writeWidthPref(savedWidth);
    applySidebarLayout();
    e.preventDefault();
  }

  function bindSidebarLayout() {
    var doc = global.document;
    doc.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('.gfp-sb-toggle') || t.closest('#mobToggle') || t.closest('.mob-toggle')) {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebarLayout();
        } else if (t.closest('#gfpSbClose')) {
          e.preventDefault();
          closeSidebarLayout();
        } else if (t.closest('#gfpSbOverlay')) {
          e.preventDefault();
          setDrawerOpen(false);
        } else if (isDrawerViewport() && drawerOpen && t.closest('.sidebar a, .sidebar .gfp-nav-item')) {
          setDrawerOpen(false);
        }
      },
      true
    );

    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (isDrawerViewport() && drawerOpen) {
        setDrawerOpen(false);
        e.preventDefault();
      }
    });

    var resizer = doc.querySelector('.gfp-sb-resizer');
    if (resizer) {
      resizer.addEventListener('pointerdown', onSidebarPointerDown);
      resizer.addEventListener('keydown', onSidebarKeyResize);
    }
    global.addEventListener('pointermove', onSidebarPointerMove);
    global.addEventListener('pointerup', onSidebarPointerUp);
    global.addEventListener('pointercancel', onSidebarPointerUp);

    var resizeTimer = null;
    global.addEventListener('resize', function () {
      if (resizeTimer) global.clearTimeout(resizeTimer);
      resizeTimer = global.setTimeout(function () {
        applySidebarLayout();
      }, 80);
    });
  }

  function initSidebarLayout() {
    if (layoutBooted) return;
    if (!global.document) return;
    if (isEmbedShell()) {
      global.document.documentElement.style.setProperty('--sidebar-w', '0px');
      return;
    }
    if (!getSidebarEl()) return;
    layoutBooted = true;
    savedWidth = clampSidebarWidth(readWidthPref() != null ? readWidthPref() : compactDefaultWidth(), getViewportWidth());
    collapsedPref = readCollapsedPref();
    ensureShellLayoutCss();
    injectSidebarChrome();
    bindSidebarLayout();
    applySidebarLayout();
  }

  async function boot() {
    if (bootDone) return;
    // Beta analytics: app opened (no-op unless analytics explicitly enabled/configured)
    try {
      if (
        global.GfpAnalytics &&
        typeof global.GfpAnalytics.track === 'function' &&
        !global.GfpAnalytics._appOpenedTracked
      ) {
        global.GfpAnalytics._appOpenedTracked = true;
        global.GfpAnalytics.track('app_opened', {
          path: global.location && global.location.pathname ? global.location.pathname : ''
        });
      }
    } catch (e) { /* ignore */ }

    // Desk feedback: floating button opens premium modal (persists via POST /api/feedback).
    try {
      var onDashboard = global.location && /\/dashboard(\/|$)/.test(global.location.pathname);
      if (
        onDashboard &&
        typeof global.document !== 'undefined' &&
        global.document.body &&
        !global.document.getElementById('gfpBetaFeedbackBtn')
      ) {
        if (typeof isEmbedShell === 'function' && isEmbedShell()) {
          // Embedded shell: keep UI minimal.
        } else {
          var btn = global.document.createElement('button');
          btn.type = 'button';
          btn.id = 'gfpBetaFeedbackBtn';
          btn.className = 'gfp-beta-feedback-btn';
          var feedbackLabel = 'Feedback';
          if (global.GfpI18n && typeof global.GfpI18n.t === 'function') {
            feedbackLabel = global.GfpI18n.t('feedback.title');
            if (!feedbackLabel || feedbackLabel === 'feedback.title') {
              feedbackLabel = global.GfpI18n.t('beta.feedback');
            }
          }
          btn.setAttribute('aria-label', feedbackLabel);
          btn.title = feedbackLabel;
          // Icon-only: long AR label was covering the sidebar user footer.
          btn.innerHTML = '<i class="ti ti-message-report" aria-hidden="true"></i>';
          btn.style.cssText =
            'position:fixed;bottom:24px;inset-inline-end:24px;z-index:900;' +
            'width:44px;height:44px;padding:0;border-radius:999px;' +
            'display:inline-flex;align-items:center;justify-content:center;' +
            'background:var(--l100,#d9f99d);color:var(--c900,#0D0D0D);' +
            'border:1px solid rgba(122,204,0,.35);font-size:20px;cursor:pointer;' +
            'box-shadow:0 4px 14px rgba(0,0,0,.18);';

          btn.addEventListener('click', function () {
            try {
              if (global.GfpFeedback && typeof global.GfpFeedback.open === 'function') {
                global.GfpFeedback.open();
                return;
              }
              // Lazy-load feedback.js once if injector missed it.
              if (!global.document.getElementById('gfpFeedbackJs')) {
                var s = global.document.createElement('script');
                s.id = 'gfpFeedbackJs';
                s.src = '/shared/feedback.js?v=1';
                s.onload = function () {
                  if (global.GfpFeedback && global.GfpFeedback.open) global.GfpFeedback.open();
                };
                global.document.body.appendChild(s);
              }
            } catch (e) { /* ignore */ }
          });

          global.document.body.appendChild(btn);
        }
      }
    } catch (e) { /* ignore */ }

    maybeShopUxRedirect();
    if (!/\/dashboard(\/|$)/.test(global.location.pathname)) return;
    if (!global.GfpAuthz) return;

    var token = global.GfpAuthz.getAccessToken();
    if (!token || !global.GfpAuthz.useCanRole('AnyStaff')) {
      global.location.href = '/auth/login/';
      return;
    }

    // Sidebar logout: pages wire #btnLogout, but the resize handle used to cover it.
    // Delegate so a single reliable path always works on the desk.
    if (!global.document.documentElement.getAttribute('data-gfp-logout-bound')) {
      global.document.documentElement.setAttribute('data-gfp-logout-bound', '1');
      global.document.addEventListener(
        'click',
        function (ev) {
          var t = ev.target;
          if (!t || !t.closest) return;
          var btn = t.closest('#btnLogout, .sb-logout, #btnSwitchAccount');
          if (!btn) return;
          ev.preventDefault();
          ev.stopPropagation();
          try {
            if (global.GfpApi && typeof global.GfpApi.logout === 'function') {
              global.GfpApi.logout();
              return;
            }
          } catch (e) { /* fall through */ }
          try {
            ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at', 'gfp_persist'].forEach(function (k) {
              try { global.localStorage.removeItem(k); } catch (e1) {}
              try { global.sessionStorage.removeItem(k); } catch (e2) {}
            });
          } catch (e3) {}
          global.location.href = '/auth/login/';
        },
        true
      );
    }

    bootDone = true;
    ensureShellStyles();
    injectLangToggle();
    injectAppearanceToggle();
    initHeaderLayout();
    initSidebarLayout();
    initTableLayout();
    ensureFormLayoutCss();
    ensureModalLayoutCss();
    ensureSweepLayoutCss();
    clearInlineOwnerOnlyHacks();
    if (global.GfpI18n && global.GfpI18n.applyDocumentLocale) {
      global.GfpI18n.applyDocumentLocale();
    }

    if (global.GfpBranding && typeof global.GfpBranding.load === 'function') {
      try {
        await global.GfpBranding.load();
      } catch (e) { /* branding is non-blocking */ }
    }

    var cached = (global.GfpFeatures && global.GfpFeatures.readCache()) || null;
    renderShellNav(cached);
    enforceRouteAccess(cached);

    if (global.GfpBranding && typeof global.GfpBranding.reapply === 'function') {
      try {
        await global.GfpBranding.reapply();
      } catch (e) { /* ignore */ }
    }

    if (global.GfpFeatures) {
      try {
        var registry = await global.GfpFeatures.probeAllModules(false);
        renderShellNav(registry);
        enforceRouteAccess(registry);
        if (global.GfpBranding && global.GfpBranding.reapply) {
          await global.GfpBranding.reapply();
        }
      } catch (e) {
        var open = {};
        (global.GfpFeatures.FEATURE_MODULES || []).forEach(function (k) {
          open[k] = k !== 'stock_management';
        });
        renderShellNav(open);
        enforceRouteAccess(open);
      }
    } else {
      renderShellNav({});
      enforceRouteAccess({});
    }

    global.addEventListener('gfp:locale', function () {
      if (global.GfpI18n && global.GfpI18n.applyDocumentLocale) {
        global.GfpI18n.applyDocumentLocale();
      }
      renderShellNav(lastRegistry);
      syncSidebarControls();
      syncUserFooterTitles();
      var switchBtn = global.document.getElementById('btnSwitchAccount');
      if (switchBtn) {
        switchBtn.textContent = tLabel('Switch account', 'تبديل الحساب');
      }
      var betaBtn = global.document.getElementById('gfpBetaFeedbackBtn');
      if (betaBtn && global.GfpI18n && typeof global.GfpI18n.t === 'function') {
        var label = global.GfpI18n.t('feedback.title');
        if (!label || label === 'feedback.title') label = global.GfpI18n.t('beta.feedback');
        betaBtn.setAttribute('aria-label', label);
        betaBtn.title = label;
      }
    });

    // Pages fill #userName after shell boot — refresh titles once identity is present.
    global.setTimeout(syncUserFooterTitles, 0);
    global.setTimeout(syncUserFooterTitles, 500);
    if (global.document && global.document.addEventListener) {
      global.document.addEventListener('gfp:edition', function () {
        ensureSwitchAccountControl();
        syncUserFooterTitles();
      });
    }
  }

  if (global.GfpApi && global.GfpApi.logout) {
    var prevLogout = global.GfpApi.logout.bind(global.GfpApi);
    global.GfpApi.logout = function () {
      if (global.GfpFeatures) global.GfpFeatures.clearCache();
      return prevLogout();
    };
  }

  global.GfpShell = {
    get NAV_ITEMS() {
      return getNavItems();
    },
    get NAV_CATEGORIES() {
      var Nav = navApi();
      return (Nav && Nav.NAV_CATEGORIES) || [];
    },
    isNavItemVisible: isNavItemVisible,
    findNavConfig: findNavConfig,
    useVisibleNav: useVisibleNav,
    getDefaultLandingPath: getDefaultLandingPath,
    resolveLandingPath: resolveLandingPath,
    renderShellNav: renderShellNav,
    applyNavVisibility: renderShellNav,
    enforceRouteAccess: enforceRouteAccess,
    shopUxShouldRedirect: shopUxShouldRedirect,
    boot: boot,
    clampSidebarWidth: clampSidebarWidth,
    isDrawerViewport: isDrawerViewport,
    getSidebarMaxForViewport: getSidebarMaxForViewport,
    canResizeSidebar: canResizeSidebar,
    initSidebarLayout: initSidebarLayout,
    wrapTopbarGym: wrapTopbarGym,
    initHeaderLayout: initHeaderLayout,
    TABLE_WRAP_SEL: TABLE_WRAP_SEL,
    wrapNakedTables: wrapNakedTables,
    initTableLayout: initTableLayout
  };
  global.useVisibleNav = useVisibleNav;

  function start() {
    if (global.location && /\/dashboard(\/|$)/.test(global.location.pathname)) {
      ensureShellLayoutCss();
      ensureShellHeaderCss();
      ensureTableLayoutCss();
      ensureFormLayoutCss();
      ensureModalLayoutCss();
      ensureSweepLayoutCss();
      initTableLayout();
    }
    boot();
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
