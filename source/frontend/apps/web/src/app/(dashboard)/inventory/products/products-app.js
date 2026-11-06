/**
 * Inventory products + categories (FE-INVS-1).
 * Real APIs only via GfpApi + GfpInventoryApi.paths.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Inv = window.GfpInventoryApi;

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  }

  var user = getUser();
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }
  if (!Authz || !(Authz.useCan('inventory.manage') || Authz.useCan('inventory.purchase'))) {
    window.location.href = '/dashboard/inventory/';
    return;
  }

  var canManage = Authz.useCan('inventory.manage');
  var canAdjust = Authz.useCan('inventory.adjust');
  var canPurchase = Authz.useCan('inventory.purchase');
  var canSeeCost =
    Authz.useCan('inventory.manage') ||
    Authz.useCan('inventory.purchase') ||
    Authz.useCan('reports.financial.view');
  var paths = (Inv && Inv.paths) || {};
  var categories = [];
  var products = [];
  var editingId = null;
  var localPreviewUrl = null;
  var searchTimer = null;
  var VIEW_KEY = 'gfp_inv_products_view';
  var viewMode = 'table';
  var stockByProduct = {};
  var stockHydrating = false;
  /** Pro+ Stock Management hub available (nav). Products desk always keeps Add stock / Fix qty. */
  var hasStockManagement = false;
  var stockDrawerMode = 'add'; // 'add' | 'fix'
  var stockDrawerProductId = null;
  var buyDrawerProductId = null;
  var buySuppliers = [];
  var productSuppliers = [];
  /** Owner can buy if manage or purchase (receive needs purchase — Owner has both). */
  var canBuy = canManage || canPurchase;
  /** '' | 'low' | 'oos' — from ?alert= on inventory home deep-links */
  var stockAlert = '';
  try {
    var alertQ = new URLSearchParams(window.location.search).get('alert');
    if (alertQ === 'low' || alertQ === 'oos') stockAlert = alertQ;
  } catch (e) { /* ignore */ }
  try {
    var savedView = localStorage.getItem(VIEW_KEY);
    if (window.GfpFeatures && window.GfpFeatures.SHOP_OWNER_UX) viewMode = 'table';
    else if (savedView === 'table' || savedView === 'cards') viewMode = savedView;
  } catch (e) { /* ignore */ }

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n) {
    var v = Number(n);
    if (n == null || Number.isNaN(v)) return 'EGP 0.00';
    try {
      return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(v);
    } catch (e) {
      return 'EGP ' + v.toFixed(2);
    }
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (typeof detail === 'object' && detail) detail = detail.message || detail.error || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    if (detail && detail !== 'Request failed') return String(detail);
    return t('Request failed', 'فشل الطلب') + (r.status ? ' (' + r.status + ')' : '');
  }

  function isSimpleDesk() {
    // Products is always the sellable-items desk (Add stock / Fix qty / Sell).
    // Stock Management hub (Move / Count / On Hand board) stays Pro-only in the sidebar.
    return true;
  }

  function productAllowsSimpleStock(p) {
    return !!(p && p.trackStock && !p.trackBatch && !p.trackExpiry && !p.isArchived);
  }

  function applyPackagingChrome() {
    var chips = document.getElementById('stockChips');
    var sub = document.getElementById('pageSubtitle');
    var crumbInv = document.querySelector(
      '.tb-breadcrumb [data-en="Inventory"], .tb-breadcrumb [data-en="Catalog"]'
    );
    if (chips) chips.hidden = false;
    if (sub) {
      sub.setAttribute(
        'data-en',
        'What you sell, the price, and how many you have. Buy from a supplier — no warehouse screens.'
      );
      sub.setAttribute(
        'data-ar',
        'إيه اللي بتبيعه، السعر، والكمية. اشتري من المورد — من غير شاشات مخازن.'
      );
      sub.textContent =
        'What you sell, the price, and how many you have. Buy from a supplier — no warehouse screens.';
    }
    if (crumbInv) {
      crumbInv.setAttribute('data-en', 'Catalog');
      crumbInv.setAttribute('data-ar', 'الكتالوج');
      crumbInv.textContent = 'Catalog';
    }
    document.querySelectorAll('#stockChips .chip').forEach(function (b) {
      b.classList.toggle('act', (b.getAttribute('data-alert') || '') === stockAlert);
    });
  }

  async function resolveStockManagementFlag() {
    var Features = window.GfpFeatures;
    hasStockManagement = false;
    if (Features) {
      try {
        var reg = (Features.readCache && Features.readCache()) || null;
        if (!reg && Features.probeAllModules) {
          reg = await Features.probeAllModules(false);
        }
        if (reg && reg.stock_management === true) {
          hasStockManagement = true;
        } else if (Features.probeModuleAvailable) {
          // Explicit check — FEATURE_DISABLED must keep hub link hidden
          var on = await Features.probeModuleAvailable('stock_management');
          hasStockManagement = on === true;
        }
      } catch (e) {
        hasStockManagement = false;
      }
    }
    applyPackagingChrome();
  }
  function openModal(id) {
    document.getElementById(id).hidden = false;
  }
  function closeModal(id) {
    document.getElementById(id).hidden = true;
  }

  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  (function initChrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) {
        return w[0];
      })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    var a = document.getElementById('userAvatar');
    var n = document.getElementById('userName');
    var o = document.getElementById('userRole');
    if (a) a.textContent = ini;
    if (n) n.textContent = user.fullName || 'User';
    if (o) o.textContent = user.role || 'Staff';
    var btn = document.getElementById('btnLogout');
    if (btn) {
      btn.addEventListener('click', function () {
        if (Gfp) Gfp.logout();
        else window.location.href = '/auth/login/';
      });
    }
    if (canManage) {
      var ma = document.getElementById('manageActions');
      if (ma) ma.hidden = false;
    }
  })();

  (async function loadGym() {
    if (!Gfp) return;
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      var gn = document.getElementById('gymName');
      var ga = document.getElementById('gymNameAr');
      if (gn) gn.textContent = r.data.gymName || 'HyMotion';
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  function fillCategorySelects() {
    var I18n = window.GfpI18n;
    var allLabel =
      I18n && I18n.tLabel ? I18n.tLabel('All categories', 'كل التصنيفات') : 'All categories';
    var noneLabel =
      I18n && I18n.tLabel ? I18n.tLabel('-- No category --', '-- بدون تصنيف --') : '-- No category --';
    var filter = document.getElementById('filterCategory');
    var formSel = document.getElementById('pCategory');
    var curF = filter.value;
    var curP = formSel.value;
    filter.innerHTML = '<option value="">' + esc(allLabel) + '</option>';
    formSel.innerHTML = '<option value="">' + esc(noneLabel) + '</option>';
    categories
      .slice()
      .sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      })
      .forEach(function (c) {
        var label = c.name + (c.isActive ? '' : ' (' + t('inactive', 'غير نشط') + ')');
        filter.appendChild(new Option(label, c.id));
        formSel.appendChild(new Option(c.name, c.id));
      });
    if (curF) filter.value = curF;
    if (curP) formSel.value = curP;
  }

  async function loadProductSuppliers() {
    var r = await Gfp.get(paths.suppliers());
    productSuppliers = r.ok && Array.isArray(r.data) ? r.data : [];
  }

  async function fillDefaultSupplierSelect(selectedId) {
    await loadProductSuppliers();
    var sel = document.getElementById('pDefaultSupplier');
    if (!sel) return;
    var none = t('No default supplier', 'بدون مورد افتراضي');
    sel.innerHTML = '<option value="">' + esc(none) + '</option>';
    var seen = {};
    productSuppliers
      .slice()
      .sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .forEach(function (s) {
        if (s.isActive === false && s.id !== selectedId) return;
        var label = s.name || '';
        if (s.isActive === false) label += ' (' + t('inactive', 'غير نشط') + ')';
        sel.appendChild(new Option(label, s.id));
        seen[s.id] = true;
      });
    if (selectedId && !seen[selectedId]) {
      sel.appendChild(new Option(t('Unknown supplier', 'مورد غير معروف'), selectedId));
    }
    sel.value = selectedId || '';
  }

  async function loadCategories() {
    var r = await Gfp.get(paths.categories());
    if (!r.ok) {
      toast(apiError(r), 'err');
      categories = [];
      return;
    }
    categories = Array.isArray(r.data) ? r.data : [];
    fillCategorySelects();
  }

  function listQuery() {
    return {
      q: document.getElementById('filterQ').value.trim() || undefined,
      categoryId: document.getElementById('filterCategory').value || undefined,
      includeArchived: document.getElementById('filterArchived').checked ? 'true' : undefined
    };
  }

  async function loadProducts() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading products…</p></div>';
    var r = await Gfp.get(paths.products(listQuery()));
    if (!r.ok) {
      host.innerHTML =
        '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    products = Array.isArray(r.data) ? r.data : [];
    stockByProduct = {};
    renderProducts();
    hydrateStock();
  }

  async function hydrateStock() {
    if (stockHydrating) return;
    stockHydrating = true;
    stockByProduct = {};
    try {
      var br = await Gfp.get(paths.stockBoard());
      if (br.ok && Array.isArray(br.data)) {
        br.data.forEach(function (row) {
          if (!row || !row.productId) return;
          stockByProduct[row.productId] = {
            onHand: row.onHand != null ? Number(row.onHand) : 0,
            available:
              row.available != null
                ? Number(row.available)
                : row.onHand != null
                  ? Number(row.onHand)
                  : 0
          };
        });
      }
    } catch (e) {
      /* board failed — badges stay empty until next refresh */
    }
    products.forEach(function (p) {
      if (p.trackStock && !p.isArchived && !Object.prototype.hasOwnProperty.call(stockByProduct, p.id)) {
        stockByProduct[p.id] = { onHand: 0, available: 0 };
      }
    });
    stockHydrating = false;
    renderProducts();
  }

  function setViewMode(mode) {
    viewMode = mode === 'table' ? 'table' : 'cards';
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch (e) { /* ignore */ }
    document.querySelectorAll('.view-btn').forEach(function (b) {
      b.classList.toggle('act', b.getAttribute('data-view') === viewMode);
    });
    renderProducts();
  }

  function mediaUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    var origin = String(window.API_BASE || (Gfp && Gfp.apiBase && Gfp.apiBase()) || '')
      .replace(/\/api\/?$/i, '');
    if (!origin && Gfp && typeof Gfp.apiBase === 'function') {
      origin = String(Gfp.apiBase()).replace(/\/api\/?$/i, '');
    }
    if (!origin) {
      try {
        origin = new URL(window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api', window.location.origin).origin;
      } catch (e) {
        origin = window.location.origin;
      }
    }
    return origin + (u.charAt(0) === '/' ? u : '/' + u);
  }

  function thumbHtml(url, large) {
    var resolved = mediaUrl(url);
    if (resolved) {
      return (
        '<img class="' +
        (large ? '' : 'thumb') +
        '" src="' +
        esc(resolved) +
        '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.hidden=false)">' +
        (large
          ? '<div class="ph" hidden><i class="ti ti-photo-off"></i><span>' + esc(t('Broken link', 'الرابط مش شغال')) + '</span></div>'
          : '<span class="thumb-ph" hidden><i class="ti ti-photo-off"></i></span>')
      );
    }
    if (large) {
      return '<div class="ph"><i class="ti ti-photo"></i><span>' + esc(t('No photo', 'مفيش صورة')) + '</span></div>';
    }
    return '<span class="thumb-ph"><i class="ti ti-photo"></i></span>';
  }

  function memberAppVisible(p) {
    return !!(p && (p.isVisibleToMembers != null ? p.isVisibleToMembers : p.visibleToMembers));
  }

  function memberAppBadgeHtml(p) {
    return memberAppVisible(p)
      ? '<span class="badge badge-ok">ON</span>'
      : '<span class="badge badge-off">OFF</span>';
  }

  function stockQtyState(p) {
    if (!p || !p.trackStock) return null;
    if (!Object.prototype.hasOwnProperty.call(stockByProduct, p.id)) return 'pending';
    var entry = stockByProduct[p.id];
    var avail =
      typeof entry === 'object'
        ? Number(entry.available != null ? entry.available : entry.onHand)
        : Number(entry);
    if (Number.isNaN(avail)) return null;
    var min = Number(p.reorderMinQty) || 0;
    if (avail <= 0) return 'out';
    if (min > 0 && avail <= min) return 'low';
    return 'ok';
  }

  function stockStatusHtml(p) {
    var st = stockQtyState(p);
    if (st === 'out') return '<span class="badge badge-out">Out of stock</span>';
    if (st === 'low') return '<span class="badge badge-low">Low stock</span>';
    if (st === 'ok') return '<span class="badge badge-ok">In stock</span>';
    return '';
  }

  function statusBadge(p) {
    if (p.isArchived) return '<span class="badge badge-arch">مؤرشف</span>';
    if (p.isActive) return '<span class="badge badge-ok">نشط</span>';
    return '<span class="badge badge-off">متوقف</span>';
  }

  function stockBadgeHtml(p) {
    if (!p.trackStock) return '<span class="stock-badge stock-na" title="لا يتتبع مخزون">—</span>';
    if (!Object.prototype.hasOwnProperty.call(stockByProduct, p.id)) {
      return '<span class="stock-badge stock-pending">…</span>';
    }
    var entry = stockByProduct[p.id];
    if (entry == null || (typeof entry === 'object' && entry.available == null && entry.onHand == null)) {
      if (entry == null || Number.isNaN(Number(entry))) return '<span class="stock-badge stock-na">—</span>';
    }
    var avail =
      typeof entry === 'object'
        ? Number(entry.available != null ? entry.available : entry.onHand)
        : Number(entry);
    var onHand = typeof entry === 'object' ? Number(entry.onHand != null ? entry.onHand : avail) : avail;
    if (Number.isNaN(avail)) return '<span class="stock-badge stock-na">—</span>';
    var min = Number(p.reorderMinQty) || 0;
    var cls = 'stock-ok';
    if (avail <= 0 && onHand > 0) cls = 'stock-out';
    else if (avail <= 0) cls = 'stock-out';
    else if (min > 0 && avail <= min) cls = 'stock-low';
    return (
      '<span class="stock-badge ' +
      cls +
      '" data-stock-available="' +
      esc(String(avail)) +
      '" data-stock-onhand="' +
      esc(String(onHand)) +
      '" title="' +
      esc(avail <= 0 && onHand > 0 ? 'منتهي — مش هيتباع' : 'قابل للبيع') +
      '">' +
      esc(String(avail)) +
      '</span>'
    );
  }

  function stockPillHtml(p) {
    if (!p.trackStock) return '';
    if (!Object.prototype.hasOwnProperty.call(stockByProduct, p.id)) {
      return '<span class="stock-pill stock-pending">…</span>';
    }
    var entry = stockByProduct[p.id];
    var avail =
      typeof entry === 'object'
        ? Number(entry.available != null ? entry.available : entry.onHand)
        : Number(entry);
    if (Number.isNaN(avail)) return '';
    var min = Number(p.reorderMinQty) || 0;
    var cls = 'stock-ok';
    var txt = avail + ' left';
    if (avail <= 0) {
      cls = 'stock-out';
      txt = 'Empty';
    } else if (min > 0 && avail <= min) {
      cls = 'stock-low';
      txt = 'Only ' + avail + ' left';
    }
    return '<span class="stock-pill ' + cls + '">' + esc(txt) + '</span>';
  }

  function bindProductActions(host) {
    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openProductEditor(b.getAttribute('data-edit'));
      });
    });
    host.querySelectorAll('[data-archive]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        archiveProduct(b.getAttribute('data-archive'));
      });
    });
    host.querySelectorAll('[data-unarchive]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        unarchiveProduct(b.getAttribute('data-unarchive'));
      });
    });
    host.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        if (ev.target.closest('.row-actions')) return;
        openProductDetail(b.getAttribute('data-open'));
      });
    });
    host.querySelectorAll('[data-stock-add]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openStockDrawer(b.getAttribute('data-stock-add'), 'add');
      });
    });
    host.querySelectorAll('[data-stock-fix]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openStockDrawer(b.getAttribute('data-stock-fix'), 'fix');
      });
    });
    host.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openBuyDrawer(b.getAttribute('data-buy'));
      });
    });
  }

  function productActionsHtml(p) {
    var html = '<div class="row-actions">';
    if (canBuy && !p.isArchived && p.isPurchasable !== false) {
      html +=
        '<button type="button" class="primary" data-buy="' + esc(p.id) + '">' + t('Buy', 'شراء') + '</button>';
    }
    if (canAdjust && productAllowsSimpleStock(p)) {
      html +=
        '<button type="button" data-stock-add="' +
        esc(p.id) +
        '">' + t('Add stock', 'إضافة مخزون') + '</button>';
    }
    if (canManage) {
      html += '<button type="button" data-edit="' + esc(p.id) + '">' + t('Edit', 'تعديل') + '</button>';
    }
    html += '</div>';
    return html;
  }

  function stockEntrySellable(entry) {
    if (entry == null) return null;
    if (typeof entry === 'object') {
      var a = entry.available != null ? entry.available : entry.onHand;
      return a == null || Number.isNaN(Number(a)) ? null : Number(a);
    }
    var n = Number(entry);
    return Number.isNaN(n) ? null : n;
  }

  function openProductDetail(id) {
    var p = products.find(function (x) {
      return x.id === id;
    });
    if (!p) return;
    var profit =
      canSeeCost && p.costPrice != null
        ? Number(p.sellPrice || 0) - Number(p.costPrice || 0)
        : null;
    var sellable = stockEntrySellable(stockByProduct[p.id]);
    var qty =
      Object.prototype.hasOwnProperty.call(stockByProduct, p.id) && sellable != null
        ? String(sellable)
        : p.trackStock
          ? '…'
          : '—';
    var img = p.imageUrl
      ? '<img class="detail-hero-img" src="' + esc(mediaUrl(p.imageUrl)) + '" alt="">'
      : '<div class="detail-hero-ph"><i class="ti ti-photo"></i></div>';
    document.getElementById('detailTitle').textContent = p.nameAr || p.name || 'المنتج';
    document.getElementById('detailBody').innerHTML =
      '<div class="detail-hero">' +
      img +
      '<div>' +
      '<div style="font-family:var(--fd);font-size:20px;font-weight:700">' +
      esc(p.name) +
      '</div>' +
      (p.nameAr
        ? '<div dir="rtl" style="color:var(--ltt);margin-top:2px">' + esc(p.nameAr) + '</div>'
        : '') +
      '<div class="barcode-cell" style="margin-top:6px">' +
      esc(p.barcode || p.sku) +
      '</div>' +
      '<div style="margin-top:8px">' +
      statusBadge(p) +
      ' ' +
      stockBadgeHtml(p) +
      '</div></div></div>' +
      '<div class="detail-kv">' +
      '<div class="kv"><div class="k">' +
      esc(t('Category', 'التصنيف')) +
      '</div><div class="v">' +
      esc(p.categoryName || '—') +
      '</div></div>' +
      '<div class="kv"><div class="k">' +
      esc(t('Default supplier', 'المورد الافتراضي')) +
      '</div><div class="v">' +
      esc(p.defaultSupplierName || t('Not set', 'غير محدد')) +
      '</div></div>' +
      '<div class="kv"><div class="k">' + esc(t('Unit', 'الوحدة')) + '</div><div class="v">' +
      esc(p.unitOfMeasure || 'pcs') +
      '</div></div>' +
      (canSeeCost
        ? '<div class="kv"><div class="k">' + esc(t('Cost price', 'سعر الشراء')) + '</div><div class="v">' +
          money(p.costPrice) +
          '</div></div>'
        : '') +
      '<div class="kv"><div class="k">' + esc(t('Sell price', 'سعر البيع')) + '</div><div class="v">' +
      money(p.sellPrice) +
      '</div></div>' +
      (profit != null
        ? '<div class="kv"><div class="k">' + esc(t('Profit per unit', 'الربح للقطعة')) + '</div><div class="v profit">' +
          money(profit) +
          '</div></div>'
        : '') +
      '<div class="kv"><div class="k">' + esc(t('Reorder minimum', 'الحد الأدنى')) + '</div><div class="v">' +
      esc(String(p.reorderMinQty != null ? p.reorderMinQty : 0)) +
      '</div></div>' +
      '<div class="kv"><div class="k">' + esc(t('Stock', 'المخزون')) + '</div><div class="v">' +
      esc(qty) +
      '</div></div>' +
      '<div class="kv"><div class="k">' + esc(t('Currency', 'العملة')) + '</div><div class="v">' +
      esc(p.currency || 'EGP') +
      '</div></div>' +
      '<div class="kv"><div class="k">' + esc(t('POS', 'نقطة البيع')) + '</div><div class="v">' +
      esc(p.isSellable !== false ? t('Sellable', 'قابل للبيع') : t('Off', 'متوقف')) +
      '</div></div>' +
      '<div class="kv"><div class="k">' + esc(t('Member App', 'تطبيق العضو')) + '</div><div class="v">' +
      esc(memberAppVisible(p) ? t('Visible', 'ظاهر') : t('Hidden', 'مخفي')) +
      '</div></div>' +
      '</div>' +
      '<div class="detail-actions">' +
      (canAdjust && productAllowsSimpleStock(p)
        ? '<button type="button" class="btn-create" data-stock-add="' +
          esc(p.id) +
          '"><i class="ti ti-package-import"></i> ' + t('Add stock', 'إضافة مخزون') + '</button>' +
          '<button type="button" class="btn-secondary" data-stock-fix="' +
          esc(p.id) +
          '"><i class="ti ti-adjustments"></i> ' + t('Fix qty', 'تصحيح الكمية') + '</button>'
        : '') +
      (canBuy && !p.isArchived && p.isPurchasable !== false
        ? '<button type="button" class="btn-secondary" data-buy="' +
          esc(p.id) +
          '"><i class="ti ti-truck"></i> ' + t('Buy', 'شراء') + '</button>'
        : '') +
      (canManage
        ? '<button type="button" class="btn-create" data-edit="' +
          esc(p.id) +
          '"><i class="ti ti-pencil"></i> ' + t('Edit', 'تعديل') + '</button>'
        : '') +
      '<a class="btn-secondary" href="/dashboard/pos/" style="text-decoration:none"><i class="ti ti-shopping-cart"></i> ' + t('Sell', 'بيع') + '</a>' +
      '</div>';
    document.getElementById('detailDrawer').hidden = false;
    var editBtn = document.querySelector('#detailBody [data-edit]');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        document.getElementById('detailDrawer').hidden = true;
        openProductEditor(p.id);
      });
    }
    var addBtn = document.querySelector('#detailBody [data-stock-add]');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        document.getElementById('detailDrawer').hidden = true;
        openStockDrawer(p.id, 'add');
      });
    }
    var fixBtn = document.querySelector('#detailBody [data-stock-fix]');
    if (fixBtn) {
      fixBtn.addEventListener('click', function () {
        document.getElementById('detailDrawer').hidden = true;
        openStockDrawer(p.id, 'fix');
      });
    }
    var buyBtn = document.querySelector('#detailBody [data-buy]');
    if (buyBtn) {
      buyBtn.addEventListener('click', function () {
        document.getElementById('detailDrawer').hidden = true;
        openBuyDrawer(p.id);
      });
    }
  }

  function openStockDrawer(id, mode) {
    var p = products.find(function (x) {
      return x.id === id;
    });
    if (!p || !canAdjust) return;
    if (!productAllowsSimpleStock(p)) {
      toast(
        'Batch/expiry items need Pro Stock Management or Fix quantities desk.',
        'err'
      );
      return;
    }
    stockDrawerProductId = id;
    stockDrawerMode = mode === 'fix' ? 'fix' : 'add';
    var sellable = stockEntrySellable(stockByProduct[p.id]);
    var qty =
      sellable != null
        ? String(sellable)
        : Object.prototype.hasOwnProperty.call(stockByProduct, p.id)
          ? '0'
          : '…';
    document.getElementById('stockDrawerTitle').textContent = p.nameAr || p.name || 'Product';
    document.getElementById('stockDrawerMeta').textContent =
      (p.sku || '') + (p.categoryName ? ' · ' + p.categoryName : '');
    document.getElementById('stockDrawerQty').textContent = qty;
    var input = document.getElementById('stockInputQty');
    var label = document.getElementById('stockInputLabel');
    var submitLabel = document.getElementById('btnStockSubmitLabel');
    var hint = document.getElementById('stockDrawerHint');
    if (stockDrawerMode === 'fix') {
      label.textContent = 'Correct qty left';
      submitLabel.textContent = 'Save qty';
      input.value = sellable != null ? String(sellable) : '';
      input.min = '0';
      hint.textContent = 'Sets sellable qty to this number (posts a fix).';
    } else {
      label.textContent = 'Add stock';
      submitLabel.textContent = 'Put stock in';
      input.value = '';
      input.min = '1';
      hint.textContent = 'Adds this amount to qty left (opening-style put-in).';
    }
    document.getElementById('stockDrawer').hidden = false;
    input.focus();
  }

  async function postSimpleStockDelta(productId, qtyDelta, reasonCode, note) {
    if (!canAdjust || !qtyDelta) return { ok: true, skipped: true };
    var whPath = paths.warehouseDefault ? paths.warehouseDefault() : '/inventory/warehouses/default';
    var wh = await Gfp.get(whPath);
    if (!wh.ok || !wh.data || !wh.data.id) {
      return { ok: false, error: 'Unable to resolve stock location. Please contact support.' };
    }
    var body = {
      warehouseId: wh.data.id,
      reasonCode: reasonCode,
      lines: [{ productId: productId, qtyDelta: qtyDelta }]
    };
    if (note) body.note = note;
    var create = await Gfp.post(paths.adjustments(), body);
    if (!create.ok) return { ok: false, error: apiError(create) };
    var adjId = create.data && create.data.id;
    if (!adjId) return { ok: false, error: 'Draft created without id' };
    var posted = await Gfp.post(paths.adjustmentPost(adjId), {});
    if (!posted.ok) return { ok: false, error: apiError(posted) };
    return { ok: true };
  }

  async function submitStockDrawer() {
    var p = products.find(function (x) {
      return x.id === stockDrawerProductId;
    });
    if (!p || !canAdjust) return;
    var raw = Number(document.getElementById('stockInputQty').value);
    if (Number.isNaN(raw) || raw < 0) {
      toast('Enter a valid quantity', 'err');
      return;
    }
    var btn = document.getElementById('btnStockSubmit');
    btn.disabled = true;
    var res;
    if (stockDrawerMode === 'fix') {
      var current = stockEntrySellable(stockByProduct[p.id]);
      if (current == null) current = 0;
      var delta = raw - current;
      if (Math.abs(delta) < 1e-9) {
        btn.disabled = false;
        toast('Qty unchanged', 'ok');
        document.getElementById('stockDrawer').hidden = true;
        return;
      }
      res = await postSimpleStockDelta(
        p.id,
        delta,
        'manual_count',
        'Fix qty from Products desk'
      );
    } else {
      if (raw <= 0) {
        btn.disabled = false;
        toast('Add stock needs qty > 0', 'err');
        return;
      }
      res = await postSimpleStockDelta(p.id, raw, 'opening', 'Add stock from Products desk');
    }
    btn.disabled = false;
    if (!res.ok) {
      toast(res.error || 'Stock update failed', 'err');
      return;
    }
    toast(stockDrawerMode === 'fix' ? 'Qty fixed' : 'Stock added', 'ok');
    document.getElementById('stockDrawer').hidden = true;
    await loadProducts();
  }

  async function loadBuySuppliers() {
    var r = await Gfp.get(paths.suppliers());
    buySuppliers = r.ok && Array.isArray(r.data) ? r.data : [];
    var sel = document.getElementById('buySupplier');
    if (!sel) return;
    var active = buySuppliers.filter(function (s) {
      return s.isActive !== false;
    });
    sel.innerHTML =
      '<option value="">' +
      (active.length ? 'Select supplier' : 'No suppliers yet') +
      '</option>' +
      active
        .map(function (s) {
          var label = s.name || '';
          if (s.phone) label += ' · ' + s.phone;
          return '<option value="' + esc(s.id) + '">' + esc(label) + '</option>';
        })
        .join('') +
      '<option value="__new__">+ New supplier…</option>';
    var wrap = document.getElementById('buyNewSupplierWrap');
    if (wrap) wrap.hidden = active.length > 0;
    if (!active.length) {
      sel.value = '__new__';
      if (wrap) wrap.hidden = false;
    }
  }

  function syncBuyNewSupplierField() {
    var sel = document.getElementById('buySupplier');
    var wrap = document.getElementById('buyNewSupplierWrap');
    var phoneWrap = document.getElementById('buyNewSupplierPhoneWrap');
    if (!sel || !wrap) return;
    var activeCount = buySuppliers.filter(function (s) {
      return s.isActive !== false;
    }).length;
    var showNew = sel.value === '__new__' || activeCount === 0;
    wrap.hidden = !showNew;
    if (phoneWrap) phoneWrap.hidden = !showNew;
  }

  function updateBuySupplierMeta() {
    var sel = document.getElementById('buySupplier');
    var meta = document.getElementById('buySupplierMeta');
    if (!sel || !meta) return;
    if (!sel.value || sel.value === '__new__') {
      meta.hidden = true;
      meta.textContent = '';
      return;
    }
    var s = buySuppliers.find(function (x) {
      return x.id === sel.value;
    });
    if (!s) {
      meta.hidden = true;
      meta.textContent = '';
      return;
    }
    var bits = [];
    bits.push(s.phone ? s.phone : 'No phone on file');
    meta.hidden = false;
    meta.textContent = bits.join('  ·  ');
  }

  function applyDefaultBuySupplier(p) {
    var sel = document.getElementById('buySupplier');
    if (!sel || !p || !p.defaultSupplierId) return;
    if (sel.value === '__new__') return;
    var match = Array.prototype.some.call(sel.options, function (opt) {
      return opt.value === p.defaultSupplierId;
    });
    if (match) sel.value = p.defaultSupplierId;
  }

  async function openBuyDrawer(id) {
    var p = products.find(function (x) {
      return x.id === id;
    });
    if (!p || !canBuy) return;
    if (p.isPurchasable === false) {
      toast('This product is not purchasable', 'err');
      return;
    }
    buyDrawerProductId = id;
    document.getElementById('buyDrawerTitle').textContent = 'Buy';
    document.getElementById('buyDrawerMeta').textContent =
      (p.name || '') + (p.sku ? ' · ' + p.sku : '') + (p.categoryName ? ' · ' + p.categoryName : '');
    document.getElementById('buyQty').value = '';
    document.getElementById('buyUnitCost').value =
      p.costPrice != null && !Number.isNaN(Number(p.costPrice)) ? String(p.costPrice) : '0';
    document.getElementById('buyPaidNow').value = '0';
    document.getElementById('buyPayMethod').value = 'cash';
    document.getElementById('buyNotes').value = '';
    document.getElementById('buyBatch').value = '';
    document.getElementById('buyExpiry').value = '';
    var newName = document.getElementById('buyNewSupplier');
    if (newName) newName.value = '';
    var newPhone = document.getElementById('buyNewSupplierPhone');
    if (newPhone) newPhone.value = '';
    document.getElementById('buyDrawerHint').textContent = '';
    document.getElementById('buyBatchWrap').hidden = !p.trackBatch;
    document.getElementById('buyExpiryWrap').hidden = !p.trackExpiry;
    document.getElementById('buyCostWrap').hidden = !canSeeCost;
    document.getElementById('buyMoneyBox').hidden = !canSeeCost;
    var payStep = document.getElementById('buyPayStep');
    if (payStep) payStep.hidden = !canSeeCost;
    var result = document.getElementById('buyResultPanel');
    if (result) {
      result.hidden = true;
      result.innerHTML = '';
      result.classList.remove('has-due', 'has-credit');
    }
    var actions = document.getElementById('buyActions');
    if (actions) actions.hidden = false;
    await loadBuySuppliers();
    applyDefaultBuySupplier(p);
    syncBuyNewSupplierField();
    updateBuySupplierMeta();
    updateBuyTotalPreview();
    document.getElementById('buyDrawer').hidden = false;
    document.getElementById('buyQty').focus();
  }

  function updateBuyTotalPreview() {
    var el = document.getElementById('buyTotalPreview');
    if (!el) return;
    var qtyEl = document.getElementById('buyQty');
    var unitEl = document.getElementById('buyUnitCost');
    var qty = Number(qtyEl && qtyEl.value);
    var unit = Number(unitEl && unitEl.value);
    if (!Number.isFinite(qty) || qty < 0) qty = 0;
    if (!Number.isFinite(unit) || unit < 0) unit = 0;
    var total = qty * unit;
    el.textContent = money(total);
    el.classList.toggle('is-zero', total < 0.005);
  }

  async function resolveBuySupplierId() {
    var sel = document.getElementById('buySupplier');
    var val = sel ? sel.value : '';
    if (val && val !== '__new__') return { ok: true, id: val };
    var name = (document.getElementById('buyNewSupplier').value || '').trim();
    if (!name) {
      return {
        ok: false,
        error: 'Pick a supplier or type a new name / اختار مورد أو اكتب اسم جديد'
      };
    }
    var created = await Gfp.post(paths.suppliers(), {
      name: name,
      phone: (document.getElementById('buyNewSupplierPhone').value || '').trim() || null,
      isActive: true
    });
    if (!created.ok || !created.data || !created.data.id) {
      return { ok: false, error: apiError(created) };
    }
    return { ok: true, id: created.data.id };
  }

  async function submitBuyDrawer() {
    var p = products.find(function (x) {
      return x.id === buyDrawerProductId;
    });
    if (!p || !canBuy) return;
    var qty = Number(document.getElementById('buyQty').value);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast('Enter qty bought / أدخل الكمية', 'err');
      return;
    }
    if (p.trackBatch && !(document.getElementById('buyBatch').value || '').trim()) {
      toast('Batch # required / رقم التشغيلة مطلوب', 'err');
      return;
    }
    if (p.trackExpiry && !document.getElementById('buyExpiry').value) {
      toast('Expiry date required / تاريخ الصلاحية مطلوب', 'err');
      return;
    }
    var unitCost = Number(document.getElementById('buyUnitCost').value);
    if (!Number.isFinite(unitCost) || unitCost < 0) unitCost = 0;
    if (canSeeCost && unitCost <= 0) {
      if (
        !window.confirm(
          'Unit cost is 0 — supplier purchase total will be 0. Continue?\nسعر الوحدة صفر — إجمالي الشراء عند المورد هيبقى صفر. تكمل؟'
        )
      ) {
        return;
      }
    }
    var paidNow = Number(document.getElementById('buyPaidNow').value);
    if (!Number.isFinite(paidNow) || paidNow < 0) paidNow = 0;
    var purchaseTotal = qty * unitCost;
    if (paidNow > purchaseTotal + 0.001) {
      toast('Paid now cannot exceed purchase total / المدفوع أكبر من الإجمالي', 'err');
      return;
    }
    var payMethod = document.getElementById('buyPayMethod').value || 'cash';
    var notes = (document.getElementById('buyNotes').value || '').trim() || null;
    var hint = document.getElementById('buyDrawerHint');
    var btn = document.getElementById('btnBuySubmit');
    btn.disabled = true;
    hint.textContent = 'Saving…';

    var whPath = paths.warehouseDefault ? paths.warehouseDefault() : '/inventory/warehouses/default';
    var wh = await Gfp.get(whPath);
    if (!wh.ok || !wh.data || !wh.data.id) {
      btn.disabled = false;
      hint.textContent = '';
      toast('No default stock location yet. Create one warehouse once in settings/inventory.', 'err');
      return;
    }

    var supplier = await resolveBuySupplierId();
    if (!supplier.ok) {
      btn.disabled = false;
      hint.textContent = '';
      toast(supplier.error, 'err');
      return;
    }

    var created = await Gfp.post(paths.purchaseOrders(), {
      supplierId: supplier.id,
      warehouseId: wh.data.id,
      notes: notes,
      lines: [{ productId: p.id, qtyOrdered: qty, unitCost: unitCost }]
    });
    if (!created.ok || !created.data || !created.data.id) {
      btn.disabled = false;
      hint.textContent = '';
      toast(apiError(created), 'err');
      return;
    }
    var poId = created.data.id;

    var approved = await Gfp.post(paths.purchaseOrderApprove(poId), {});
    if (!approved.ok) {
      btn.disabled = false;
      hint.textContent = '';
      toast('Order saved as draft but approve failed: ' + apiError(approved), 'err');
      return;
    }

    var detail = await Gfp.get(paths.purchaseOrder(poId));
    var lines = detail.ok && detail.data && detail.data.lines ? detail.data.lines : [];
    var line = lines.find(function (l) {
      return l.productId === p.id && Number(l.qtyRemaining) > 0;
    }) || lines[0];
    if (!line || !line.id) {
      btn.disabled = false;
      hint.textContent = '';
      toast('Approved, but could not find a line to receive.', 'err');
      return;
    }

    var recvQty = Number(line.qtyRemaining) > 0 ? Number(line.qtyRemaining) : qty;
    var recvBody = {
      lines: [
        {
          purchaseOrderLineId: line.id,
          qty: recvQty,
          unitCost: unitCost,
          batchNumber: p.trackBatch
            ? (document.getElementById('buyBatch').value || '').trim()
            : null,
          expiresOn: p.trackExpiry ? document.getElementById('buyExpiry').value || null : null
        }
      ]
    };
    var received = await Gfp.post(paths.purchaseOrderReceive(poId), recvBody);
    if (!received.ok) {
      btn.disabled = false;
      hint.textContent = '';
      toast('Approved, but receive failed: ' + apiError(received), 'err');
      return;
    }

    var grnId = received.data && received.data.id;
    var recordedTotal =
      received.data && received.data.totalAmount != null
        ? Number(received.data.totalAmount)
        : purchaseTotal;
    var payNote = notes || 'Payment on purchase receive';
    var payErr = '';
    if (canPurchase && paidNow > 0) {
      var payRes = await Gfp.post(paths.supplierPayments(supplier.id), {
        amount: paidNow,
        method: payMethod,
        note: payNote
      });
      if (!payRes.ok) payErr = apiError(payRes);
    }

    var bal = await Gfp.get(paths.supplierBalance(supplier.id));
    var due = bal.ok && bal.data ? Number(bal.data.dueTotal) : recordedTotal - paidNow;
    if (!Number.isFinite(due)) due = recordedTotal - paidNow;
    var remainThis = Math.max(0, recordedTotal - paidNow);
    var dueAll = due;
    var supplierRow = buySuppliers.find(function (x) {
      return x.id === supplier.id;
    });
    var supplierName =
      (supplierRow && supplierRow.name) ||
      (document.getElementById('buyNewSupplier').value || '').trim() ||
      'Supplier';
    var supplierPhone =
      (supplierRow && supplierRow.phone) ||
      (document.getElementById('buyNewSupplierPhone').value || '').trim() ||
      '';

    btn.disabled = false;
    hint.textContent = '';
    var actions = document.getElementById('buyActions');
    if (actions) actions.hidden = true;
    var panel = document.getElementById('buyResultPanel');
    if (panel) {
      panel.hidden = false;
      var isLeh = dueAll > 0.001;
      var isAlyh = dueAll < -0.001;
      panel.classList.toggle('has-due', isLeh);
      panel.classList.toggle('has-credit', isAlyh);
      var dueBlock = '';
      if (isLeh) {
        dueBlock =
          '<div class="buy-due-banner">' +
          '<div class="buy-result-title">باقيله (له)</div>' +
          '<div class="buy-due-amt">' +
          esc(money(dueAll)) +
          '</div>' +
          '<div>' +
          esc(supplierName) +
          (supplierPhone ? ' · ' + esc(supplierPhone) : '') +
          '</div>' +
          (remainThis > 0.001
            ? '<div style="margin-top:6px">من الصفقة دي لسه ' + esc(money(remainThis)) + '</div>'
            : '') +
          '</div>';
      } else if (isAlyh) {
        dueBlock =
          '<div class="buy-due-banner">' +
          '<div class="buy-result-title">عليه</div>' +
          '<div class="buy-due-amt">' +
          esc(money(Math.abs(dueAll))) +
          '</div>' +
          '<div>' +
          esc(supplierName) +
          (supplierPhone ? ' · ' + esc(supplierPhone) : '') +
          '</div>' +
          '</div>';
      } else {
        dueBlock = '<div class="buy-due-banner"><div class="buy-result-title">مفيش باقي</div><div>الحساب متعادل بعد الشراء.</div></div>';
      }
      panel.innerHTML =
        '<div class="buy-result-title">Purchase recorded / تم تسجيل الشراء</div>' +
        '<div>Purchase: <strong>' +
        esc(money(recordedTotal)) +
        '</strong></div>' +
        '<div>Paid now: <strong>' +
        esc(money(paidNow)) +
        '</strong>' +
        (payErr ? ' <span style="color:#991B1B">(' + esc(payErr) + ')</span>' : '') +
        '</div>' +
        dueBlock +
        (grnId
          ? '<div style="margin-top:10px"><a href="/dashboard/invoices/?tab=buy&grnId=' +
            encodeURIComponent(grnId) +
            '">Open purchase invoice / فتح فاتورة الشراء</a></div>'
          : '') +
        '<div class="detail-actions" style="margin-top:12px">' +
        '<button type="button" class="btn-create" id="btnBuyDone">Done</button>' +
        '</div>';
      var done = document.getElementById('btnBuyDone');
      if (done) {
        done.addEventListener('click', function () {
          document.getElementById('buyDrawer').hidden = true;
        });
      }
    } else {
      toast('Bought and stock updated', 'ok');
      document.getElementById('buyDrawer').hidden = true;
    }
    await loadProducts();
  }

  function matchesStockAlert(p) {
    if (!stockAlert) return true;
    if (!p.trackStock || p.isArchived) return false;
    if (!Object.prototype.hasOwnProperty.call(stockByProduct, p.id)) return true;
    var q = stockEntrySellable(stockByProduct[p.id]);
    if (q == null || Number.isNaN(q)) return false;
    if (stockAlert === 'oos') return q <= 0;
    var min = Number(p.reorderMinQty) || 0;
    return q > 0 && min > 0 && q <= min;
  }

  function visibleProducts() {
    return products.filter(matchesStockAlert);
  }

  function renderAlertBanner() {
    var el = document.getElementById('alertBanner');
    if (!el) return;
    if (!stockAlert) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    var label =
      stockAlert === 'oos'
        ? 'نفد من المخزون / Out of stock'
        : 'يحتاج طلب / Low stock';
    el.hidden = false;
    el.innerHTML =
      '<i class="ti ti-alert-triangle"></i> <span>' +
      esc(label) +
      '</span> <a href="/dashboard/inventory/products/">إظهار الكل / Show all</a>';
  }

  function renderProducts() {
    var host = document.getElementById('tableHost');
    var list = visibleProducts();
    var active = products.filter(function (p) {
      return p.isActive && !p.isArchived;
    }).length;
    var archived = products.filter(function (p) {
      return p.isArchived;
    }).length;
    document.getElementById('statTotal').textContent = String(list.length);
    document.getElementById('statActive').textContent = String(active);
    document.getElementById('statArchived').textContent = String(archived);

    var lowCount = 0;
    var outCount = 0;
    products.forEach(function (p) {
      if (!p.trackStock || p.isArchived) return;
      var q = stockEntrySellable(stockByProduct[p.id]);
      if (q == null || Number.isNaN(q)) return;
      if (q <= 0) outCount += 1;
      else {
        var min = Number(p.reorderMinQty) || 0;
        if (min > 0 && q <= min) lowCount += 1;
      }
    });
    var lowPill = document.getElementById('statLowPill');
    var outPill = document.getElementById('statOutPill');
    var activePill = document.getElementById('statActivePill');
    var archivedPill = document.getElementById('statArchivedPill');
    if (isSimpleDesk()) {
      if (activePill) activePill.hidden = true;
      if (archivedPill) archivedPill.hidden = true;
      if (lowPill) {
        lowPill.hidden = !lowCount;
        document.getElementById('statLow').textContent = String(lowCount);
      }
      if (outPill) {
        outPill.hidden = !outCount;
        document.getElementById('statOut').textContent = String(outCount);
      }
    } else {
      if (activePill) activePill.hidden = false;
      if (archivedPill) archivedPill.hidden = false;
      if (lowPill) lowPill.hidden = true;
      if (outPill) outPill.hidden = true;
    }

    renderAlertBanner();

    if (!products.length) {
      host.innerHTML =
        '<div class="empty-state table-wrap"><i class="ti ti-box-off" style="font-size:32px"></i>' +
        '<p><strong>' + esc(t('No products yet', 'لسه مفيش منتجات')) + '</strong></p>' +
        '<p style="font-size:13px;margin-top:6px">' + esc(t('Add your first item (water, protein, snacks). You can set opening qty when you create it.', 'ضيف أول صنف (مية، بروتين، سناكس). تقدر تحط كمية بداية وأنت بتعمله.')) + '</p>' +
        (canManage
          ? '<div style="margin-top:14px"><button type="button" class="btn-create" id="btnEmptyCreate"><i class="ti ti-plus"></i> ' + esc(t('New product', 'منتج جديد')) + '</button></div>'
          : '') +
        '</div>';
      var emptyBtn = document.getElementById('btnEmptyCreate');
      if (emptyBtn) emptyBtn.addEventListener('click', function () {
        openProductEditor(null);
      });
      return;
    }

    if (!list.length) {
      host.innerHTML =
        '<div class="empty-state table-wrap"><i class="ti ti-circle-check" style="font-size:32px"></i><p>لا أصناف في هذا التنبيه</p><p style="font-size:13px;margin-top:6px"><a href="/dashboard/inventory/products/">عرض كل المنتجات</a></p></div>';
      return;
    }

    if (viewMode === 'cards') {
      host.innerHTML =
        '<div class="product-grid">' +
        list
          .map(function (p) {
            return (
              '<article class="product-card' +
              (p.isArchived ? ' archived' : '') +
              '">' +
              '<div class="product-card-img" data-open="' +
              esc(p.id) +
              '" style="cursor:pointer">' +
              thumbHtml(p.imageUrl, true) +
              stockPillHtml(p) +
              '</div>' +
              '<div class="product-card-body">' +
              '<button type="button" class="prod-link" data-open="' +
              esc(p.id) +
              '">' +
              esc(p.name) +
              '</button>' +
              (p.nameAr
                ? '<div class="product-card-name-ar" dir="rtl">' + esc(p.nameAr) + '</div>'
                : '') +
              '<div class="product-card-meta"><span class="cat-tag">' +
              esc(p.categoryName || '—') +
              '</span></div>' +
              '<div class="product-card-prices">' +
              (canSeeCost && !isSimpleDesk()
                ? '<span class="product-card-cost">شراء ' + money(p.costPrice) + '</span>'
                : '') +
              '<span class="product-card-price">' +
              money(p.sellPrice) +
              '</span></div>' +
              '<div class="product-card-foot">' +
              (isSimpleDesk() ? '' : stockBadgeHtml(p) + statusBadge(p)) +
              '</div>' +
              productActionsHtml(p) +
              '</div></article>'
            );
          })
          .join('') +
        '</div>';
      bindProductActions(host);
      return;
    }

    var simple = isSimpleDesk();
    var rows = list
      .map(function (p) {
        if (simple) {
          return (
            '<tr class="clickable' +
            (p.isArchived ? ' archived' : '') +
            '" data-open="' +
            esc(p.id) +
            '">' +
            '<td><div class="prod-cell">' +
            thumbHtml(p.imageUrl, false) +
            '<div><button type="button" class="prod-link">' +
            esc(p.name) +
            '</button>' +
            '<div class="sku">' +
            esc(p.sku || p.barcode || '') +
            '</div></div></div></td>' +
            '<td class="price-sell">' +
            money(p.sellPrice) +
            '</td>' +
            '<td><div class="qty-cell">' +
            stockBadgeHtml(p) +
            stockStatusHtml(p) +
            '</div></td>' +
            '<td>' +
            memberAppBadgeHtml(p) +
            '</td>' +
            '<td>' +
            productActionsHtml(p) +
            '</td></tr>'
          );
        }
        return (
          '<tr class="' +
          (p.isArchived ? 'archived' : '') +
          '">' +
          '<td>' +
          thumbHtml(p.imageUrl, false) +
          '</td>' +
          '<td class="barcode-cell">' +
          esc(p.barcode || p.sku) +
          '</td>' +
          '<td><button type="button" class="prod-link" data-open="' +
          esc(p.id) +
          '">' +
          esc(p.name) +
          '</button>' +
          (p.nameAr
            ? '<div style="color:var(--ltt);font-size:12px" dir="rtl">' + esc(p.nameAr) + '</div>'
            : '') +
          '</td>' +
          '<td><span class="cat-tag">' +
          esc(p.categoryName || 'بدون') +
          '</span></td>' +
          '<td class="price-buy">' +
          (canSeeCost ? money(p.costPrice) : '—') +
          '</td>' +
          '<td class="price-sell">' +
          money(p.sellPrice) +
          '</td>' +
          '<td>' +
          stockBadgeHtml(p) +
          '</td>' +
          '<td>' +
          statusBadge(p) +
          '</td>' +
          '<td>' +
          productActionsHtml(p) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    host.innerHTML = simple
      ? '<div class="table-wrap"><table class="inv"><thead><tr>' +
        '<th>' + t('Product', 'المنتج') + '</th><th>' + t('Sell price', 'سعر البيع') + '</th><th>' + t('Qty left', 'المخزون') + '</th><th>' + t('Member App', 'تطبيق العضو') + '</th><th>' + t('Actions', 'إجراءات') + '</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table></div>'
      : '<div class="table-wrap"><table class="inv"><thead><tr>' +
        '<th>' + t('Photo', 'صورة') + '</th><th>' + t('Barcode', 'الباركود') + '</th><th>' + t('Product', 'المنتج') + '</th><th>' + t('Category', 'التصنيف') + '</th><th>' + t('Cost price', 'سعر الشراء') + '</th><th>' + t('Sell price', 'سعر البيع') + '</th><th>' + t('Stock', 'المخزون') + '</th><th>' + t('Status', 'الحالة') + '</th><th>' + t('Actions', 'إجراءات') + '</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table></div>';
    bindProductActions(host);
  }

  function updateImagePreview() {
    var raw = (document.getElementById('pImage').value || '').trim() || localPreviewUrl;
    var url = mediaUrl(raw) || raw;
    var box = document.getElementById('pImagePreview');
    if (!box) return;
    if (!url) {
      box.innerHTML = '<i class="ti ti-photo"></i><span>' + esc(t('No photo', 'مفيش صورة')) + '</span>';
      return;
    }
    box.innerHTML = '<img src="' + esc(url) + '" alt="">';
    var img = box.querySelector('img');
    if (img) {
      img.addEventListener('error', function () {
        box.innerHTML = '<i class="ti ti-photo-off"></i><span>' + esc(t('Broken link', 'الرابط مش شغال')) + '</span>';
      });
    }
  }

  function paintImageFileName() {
    var input = document.getElementById('pImageFile');
    var nameEl = document.getElementById('pImageFileName');
    if (!nameEl) return;
    var file = input && input.files && input.files[0];
    if (file) {
      nameEl.removeAttribute('data-en');
      nameEl.removeAttribute('data-ar');
      nameEl.textContent = file.name;
      return;
    }
    nameEl.setAttribute('data-en', 'No photo chosen');
    nameEl.setAttribute('data-ar', 'مفيش صورة متختارة');
    nameEl.textContent = t('No photo chosen', 'مفيش صورة متختارة');
  }

  async function uploadProductImage(file) {
    var fd = new FormData();
    fd.append('file', file, file.name || 'product.jpg');
    var token =
      (Gfp && Gfp.tokens && Gfp.tokens.getAccess && Gfp.tokens.getAccess()) ||
      localStorage.getItem('gfp_access_token') ||
      sessionStorage.getItem('gfp_access_token');
    var base = window.API_BASE || (Gfp && Gfp.apiBase && Gfp.apiBase()) || window.GFP_DEFAULT_API_BASE || '/api';
    var res = await fetch(base + '/inventory/products/image', {
      method: 'POST',
      headers: {
        Authorization: token ? 'Bearer ' + token : '',
        'ngrok-skip-browser-warning': 'true'
      },
      body: fd
    });
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var msg =
        (data && (data.error || data.message || data.detail)) ||
        'Image upload failed (' + res.status + ')';
      return { ok: false, error: msg };
    }
    // Prefer relative path so images work across localhost/ngrok hosts via mediaUrl().
    return {
      ok: true,
      imageUrl: data && (data.relativeUrl || data.imageUrl)
    };
  }

  function updateProfit() {
    var box = document.getElementById('pProfit');
    if (!box) return;
    var sell = Number(document.getElementById('pSell').value) || 0;
    var cost = Number(document.getElementById('pCost').value) || 0;
    var profit = sell - cost;
    var pct = sell > 0 ? (profit / sell) * 100 : 0;
    box.textContent =
      profit.toFixed(2) + ' (' + (Number.isFinite(pct) ? pct.toFixed(0) : '0') + '%)';
    box.classList.toggle('neg', profit < 0);
  }

  function ensureUomOption(uom) {
    var sel = document.getElementById('pUom');
    if (!uom) return;
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === uom) {
        found = true;
        break;
      }
    }
    if (!found) sel.appendChild(new Option(uom, uom));
    sel.value = uom;
  }

  function autoSkuFromName(name) {
    // SKU column is VARCHAR — ASCII only. Arabic names must not become "??????".
    var base = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 12);
    if (!base) base = 'PRD';
    var suffix = Date.now().toString(36).slice(-5).toUpperCase();
    return (base + '-' + suffix).slice(0, 64);
  }

  function setProductMoreOpen(open) {
    var more = document.getElementById('productMore');
    var btn = document.getElementById('btnMoreProduct');
    if (!more || !btn) return;
    more.hidden = !open;
    if (open) {
      btn.setAttribute('data-en', 'Hide extra options');
      btn.setAttribute('data-ar', 'إخفاء خيارات زيادة');
      btn.textContent = t('Hide extra options', 'إخفاء خيارات زيادة');
    } else {
      btn.setAttribute('data-en', 'More options');
      btn.setAttribute('data-ar', 'خيارات زيادة');
      btn.textContent = t('More options', 'خيارات زيادة');
    }
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setCreateModeUi(isCreate) {
    var openWrap = document.getElementById('pOpeningWrap');
    if (openWrap) openWrap.style.display = isCreate ? '' : 'none';
    var title = document.getElementById('productModalTitle');
    var sub = document.getElementById('productModalSub');
    if (isCreate) {
      title.setAttribute('data-en', 'New product');
      title.setAttribute('data-ar', 'منتج جديد');
      title.textContent = t('New product', 'منتج جديد');
      if (sub) {
        sub.setAttribute('data-en', 'Name and sell price. You can add a photo.');
        sub.setAttribute('data-ar', 'الاسم وسعر البيع. تقدر تضيف صورة');
        sub.textContent = t('Name and sell price. You can add a photo.', 'الاسم وسعر البيع. تقدر تضيف صورة');
      }
    } else {
      title.setAttribute('data-en', 'Edit product');
      title.setAttribute('data-ar', 'تعديل المنتج');
      title.textContent = t('Edit product', 'تعديل المنتج');
      if (sub) {
        sub.setAttribute('data-en', 'Change the name or price. Extra options stay hidden.');
        sub.setAttribute('data-ar', 'غيّر الاسم أو السعر. الخيارات الزيادة مخفية.');
        sub.textContent = t('Change the name or price. Extra options stay hidden.', 'غيّر الاسم أو السعر. الخيارات الزيادة مخفية.');
      }
    }
    if (!canSeeCost) {
      document.getElementById('pCostWrap').style.display = 'none';
      document.getElementById('pProfitWrap').style.display = 'none';
    } else {
      document.getElementById('pCostWrap').style.display = '';
      document.getElementById('pProfitWrap').style.display = '';
    }
  }

  function renderTable() {
    renderProducts();
  }

  function syncTrackFlags() {
    var trackStock = document.getElementById('pTrackStock').checked;
    var batch = document.getElementById('pTrackBatch');
    var expiry = document.getElementById('pTrackExpiry');
    if (!trackStock) {
      batch.checked = false;
      expiry.checked = false;
      batch.disabled = true;
      expiry.disabled = true;
    } else {
      batch.disabled = false;
      expiry.disabled = false;
    }
    if (expiry.checked && !batch.checked) batch.checked = true;
  }

  document.getElementById('pTrackStock').addEventListener('change', syncTrackFlags);
  document.getElementById('pTrackExpiry').addEventListener('change', syncTrackFlags);
  document.getElementById('pTrackBatch').addEventListener('change', function () {
    if (!document.getElementById('pTrackBatch').checked) {
      document.getElementById('pTrackExpiry').checked = false;
    }
  });

  function resetProductForm() {
    editingId = null;
    localPreviewUrl = null;
    document.getElementById('pSku').value = '';
    document.getElementById('pBarcode').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pNameAr').value = '';
    document.getElementById('pCategory').value = '';
    var ds = document.getElementById('pDefaultSupplier');
    if (ds) ds.value = '';
    document.getElementById('pBrand').value = '';
    ensureUomOption('pcs');
    document.getElementById('pCurrency').value = 'EGP';
    document.getElementById('pSell').value = '0';
    document.getElementById('pCost').value = '0';
    document.getElementById('pVat').value = '';
    document.getElementById('pReorder').value = '5';
    document.getElementById('pOpeningQty').value = '0';
    document.getElementById('pDesc').value = '';
    document.getElementById('pDescAr').value = '';
    document.getElementById('pImage').value = '';
    document.getElementById('pImageFile').value = '';
    document.getElementById('pTaxable').checked = true;
    document.getElementById('pTrackStock').checked = true;
    document.getElementById('pTrackBatch').checked = false;
    document.getElementById('pTrackExpiry').checked = false;
    document.getElementById('pFractional').checked = false;
    document.getElementById('pSellable').checked = true;
    document.getElementById('pPurchasable').checked = true;
    document.getElementById('pVisibleToMembers').checked = false;
    document.getElementById('pActive').checked = true;
    document.getElementById('productFormHint').textContent = '';
    setProductMoreOpen(false);
    syncTrackFlags();
    updateProfit();
    updateImagePreview();
    paintImageFileName();
    setCreateModeUi(true);
  }

  function fillProductForm(p) {
    editingId = p.id;
    localPreviewUrl = null;
    document.getElementById('pSku').value = isBrokenSku(p.sku) ? autoSkuFromName(p.name) : p.sku || '';
    if (isBrokenSku(p.sku)) {
      var hint = document.getElementById('productFormHint');
      if (hint) hint.textContent = 'Broken SKU will be replaced with ASCII on Save / سيتم استبدال الكود التالف';
    }
    document.getElementById('pBarcode').value = p.barcode || '';
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pNameAr').value = p.nameAr || '';
    document.getElementById('pCategory').value = p.categoryId || '';
    document.getElementById('pBrand').value = p.brand || '';
    ensureUomOption(p.unitOfMeasure || 'pcs');
    document.getElementById('pCurrency').value = p.currency || 'EGP';
    document.getElementById('pSell').value = p.sellPrice != null ? p.sellPrice : 0;
    document.getElementById('pCost').value = p.costPrice != null ? p.costPrice : 0;
    document.getElementById('pVat').value =
      p.vatRatePercent != null && p.vatRatePercent !== '' ? p.vatRatePercent : '';
    document.getElementById('pReorder').value = p.reorderMinQty != null ? p.reorderMinQty : 0;
    document.getElementById('pOpeningQty').value = '0';
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pDescAr').value = p.descriptionAr || '';
    document.getElementById('pImage').value = p.imageUrl || '';
    document.getElementById('pImageFile').value = '';
    document.getElementById('pTaxable').checked = !!p.taxable;
    document.getElementById('pTrackStock').checked = !!p.trackStock;
    document.getElementById('pTrackBatch').checked = !!p.trackBatch;
    document.getElementById('pTrackExpiry').checked = !!p.trackExpiry;
    document.getElementById('pFractional').checked = !!p.allowFractionalQty;
    document.getElementById('pSellable').checked = !!p.isSellable;
    document.getElementById('pPurchasable').checked = !!p.isPurchasable;
    document.getElementById('pVisibleToMembers').checked = !!(
      p.isVisibleToMembers != null ? p.isVisibleToMembers : p.visibleToMembers
    );
    document.getElementById('pActive').checked = !!p.isActive;
    document.getElementById('productFormHint').textContent = '';
    setProductMoreOpen(false);
    syncTrackFlags();
    updateProfit();
    updateImagePreview();
    paintImageFileName();
    setCreateModeUi(false);
  }

  async function openProductEditor(id) {
    if (!canManage) return;
    fillCategorySelects();
    if (!id) {
      resetProductForm();
      await fillDefaultSupplierSelect(null);
      openModal('productModal');
      var nameEl = document.getElementById('pName');
      if (nameEl) nameEl.focus();
      return;
    }
    var r = await Gfp.get(paths.product(id));
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    fillProductForm(r.data);
    await fillDefaultSupplierSelect(r.data.defaultSupplierId || null);
    openModal('productModal');
  }

  function isBrokenSku(sku) {
    return !sku || /[?]/.test(sku) || /[^\x20-\x7E]/.test(sku);
  }

  function readProductBody() {
    var vatRaw = document.getElementById('pVat').value.trim();
    var sku = document.getElementById('pSku').value.trim();
    var name = document.getElementById('pName').value.trim();
    // Create: auto-SKU. Edit: heal legacy Arabic→?????? SKUs from older builds.
    if (!sku || isBrokenSku(sku)) sku = autoSkuFromName(name);
    return {
      categoryId: document.getElementById('pCategory').value || null,
      defaultSupplierId: document.getElementById('pDefaultSupplier').value || null,
      sku: sku,
      barcode: document.getElementById('pBarcode').value.trim() || null,
      name: name,
      nameAr: document.getElementById('pNameAr').value.trim() || null,
      description: document.getElementById('pDesc').value.trim() || null,
      descriptionAr: document.getElementById('pDescAr').value.trim() || null,
      brand: document.getElementById('pBrand').value.trim() || null,
      imageUrl: document.getElementById('pImage').value.trim() || null,
      unitOfMeasure: document.getElementById('pUom').value.trim() || 'pcs',
      sellPrice: Number(document.getElementById('pSell').value),
      costPrice: Number(document.getElementById('pCost').value) || 0,
      currency: (document.getElementById('pCurrency').value.trim() || 'EGP').toUpperCase(),
      taxable: document.getElementById('pTaxable').checked,
      vatRatePercent: vatRaw === '' ? null : Number(vatRaw),
      trackStock: document.getElementById('pTrackStock').checked,
      trackBatch: document.getElementById('pTrackBatch').checked,
      trackExpiry: document.getElementById('pTrackExpiry').checked,
      allowFractionalQty: document.getElementById('pFractional').checked,
      isSellable: document.getElementById('pSellable').checked,
      isPurchasable: document.getElementById('pPurchasable').checked,
      visibleToMembers: document.getElementById('pVisibleToMembers').checked,
      reorderMinQty: Number(document.getElementById('pReorder').value) || 0,
      isActive: document.getElementById('pActive').checked
    };
  }

  function validateProductClient(body) {
    if (!body.name) return 'Product name is required / اسم المنتج مطلوب';
    if (!body.sku) return 'SKU is required / كود المنتج مطلوب';
    if (body.sellPrice < 0 || body.costPrice < 0) return 'Prices must be ≥ 0';
    if (body.imageUrl && body.imageUrl.length > 500)
      return 'Image URL too long (max 500). Use a short public link.';
    if (body.trackExpiry && !body.trackBatch) return 'Track expiry requires track batch';
    if (!body.trackStock && (body.trackBatch || body.trackExpiry))
      return 'Batch/expiry require track stock';
    return null;
  }

  async function postOpeningStock(productId, qty, unitCost) {
    if (!canAdjust || !qty || qty <= 0) return { ok: true, skipped: true };
    var whPath = paths.warehouseDefault ? paths.warehouseDefault() : '/inventory/warehouses/default';
    var wh = await Gfp.get(whPath);
    if (!wh.ok || !wh.data || !wh.data.id) {
      return { ok: false, error: 'Unable to resolve stock location for opening stock. Please contact support.' };
    }
    var create = await Gfp.post(paths.adjustments(), {
      warehouseId: wh.data.id,
      reasonCode: 'opening',
      note: 'Opening stock from new product',
      lines: [{ productId: productId, qtyDelta: qty, unitCost: unitCost }]
    });
    if (!create.ok) return { ok: false, error: apiError(create) };
    var adjId = create.data && create.data.id;
    if (!adjId) return { ok: false, error: 'Opening draft created without id' };
    var posted = await Gfp.post(paths.adjustmentPost(adjId), {});
    if (!posted.ok) return { ok: false, error: apiError(posted) };
    return { ok: true };
  }

  document.getElementById('productForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!canManage) return;
    var body = readProductBody();
    var err = validateProductClient(body);
    var hint = document.getElementById('productFormHint');
    if (err) {
      hint.textContent = err;
      return;
    }
    hint.textContent = '';
    var openingQty = Number(document.getElementById('pOpeningQty').value) || 0;
    if (!editingId && openingQty > 0 && !canAdjust) {
      hint.textContent =
        'Initial qty needs inventory.adjust — save without stock, or ask a manager.';
      return;
    }
    if (!editingId && openingQty > 0 && (body.trackBatch || body.trackExpiry)) {
      hint.textContent =
        'Initial qty on create is for simple stock only. Turn off batch/expiry, or set opening in Fix quantities.';
      return;
    }
    var btn = document.getElementById('btnSaveProduct');
    btn.disabled = true;
    var r = editingId
      ? await Gfp.put(paths.product(editingId), body)
      : await Gfp.post('/inventory/products', body);
    if (!r.ok) {
      btn.disabled = false;
      hint.textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    var created = r.data;
    if (!editingId && openingQty > 0 && created && created.id) {
      var openRes = await postOpeningStock(created.id, openingQty, body.costPrice);
      btn.disabled = false;
      if (!openRes.ok) {
        toast(
          'Product saved, but opening stock failed: ' + (openRes.error || 'error'),
          'err'
        );
        closeModal('productModal');
        await loadProducts();
        return;
      }
    } else {
      btn.disabled = false;
    }
    toast(editingId ? 'Product updated' : 'Product saved', 'ok');
    closeModal('productModal');
    await loadProducts();
  });

  async function archiveProduct(id) {
    if (!canManage || !confirm('Archive this product? It will be hidden from the default list.'))
      return;
    var r = await Gfp.post(paths.productArchive(id), {});
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    toast('Product archived', 'ok');
    await loadProducts();
  }

  async function unarchiveProduct(id) {
    if (!canManage) return;
    var r = await Gfp.post(paths.productUnarchive(id), {});
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    toast('Product restored', 'ok');
    await loadProducts();
  }

  var pendingCategoryDeleteId = null;

  function openCategoryDeleteModal(id, label) {
    pendingCategoryDeleteId = id;
    var msg = document.getElementById('catDelMessage');
    if (msg) {
      msg.textContent = t(
        'Delete category "' + label + '"?',
        'حذف التصنيف «' + label + '»؟'
      );
    }
    var I18n = window.GfpI18n;
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
    openModal('categoryDeleteModal');
  }

  function closeCategoryDeleteModal() {
    pendingCategoryDeleteId = null;
    closeModal('categoryDeleteModal');
  }

  async function deleteCategoryById(id) {
    var r = await Gfp.del(paths.category(id));
    if (!r.ok) {
      toast(apiError(r) || t('Could not delete category', 'تعذر حذف التصنيف'), 'err');
      return false;
    }
    toast(t('Category deleted', 'تم حذف التصنيف'), 'ok');
    return true;
  }

  function renderCategoryList() {
    var host = document.getElementById('categoryList');
    if (!categories.length) {
      host.innerHTML =
        '<div class="empty-state" style="padding:16px">' +
        esc(t('No categories yet', 'لا توجد تصنيفات بعد')) +
        '</div>';
      return;
    }
    host.innerHTML = categories
      .map(function (c) {
        return (
          '<div class="cat-row' + (c.isActive ? '' : ' is-inactive') + '">' +
          '<div><strong>' +
          esc(c.name) +
          '</strong>' +
          (c.nameAr
            ? ' <span dir="rtl" style="color:var(--ltt)">' + esc(c.nameAr) + '</span>'
            : '') +
          '<div style="font-size:11px;color:var(--ltt)">sort ' +
          esc(c.sortOrder) +
          (c.isActive ? '' : ' · ' + esc(t('inactive', 'غير نشط'))) +
          '</div></div>' +
          (canManage
            ? '<div class="cat-row-actions">' +
              '<button type="button" class="btn-link" data-cedit="' +
              esc(c.id) +
              '">' +
              esc(t('Edit', 'تعديل')) +
              '</button>' +
              '<button type="button" class="btn-link danger" data-cdel="' +
              esc(c.id) +
              '">' +
              esc(t('Delete', 'حذف')) +
              '</button>' +
              '</div>'
            : '') +
          '</div>'
        );
      })
      .join('');
    host.querySelectorAll('[data-cedit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = categories.find(function (x) {
          return x.id === b.getAttribute('data-cedit');
        });
        if (!c) return;
        document.getElementById('cId').value = c.id;
        document.getElementById('cName').value = c.name || '';
        document.getElementById('cNameAr').value = c.nameAr || '';
        document.getElementById('cSort').value = c.sortOrder != null ? c.sortOrder : 0;
        document.getElementById('cActive').checked = !!c.isActive;
        document.getElementById('btnSaveCategory').textContent = t('Update', 'تحديث');
      });
    });
    host.querySelectorAll('[data-cdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-cdel');
        var c = categories.find(function (x) {
          return x.id === id;
        });
        openCategoryDeleteModal(id, c ? c.name : id);
      });
    });
  }

  function resetCategoryForm() {
    document.getElementById('cId').value = '';
    document.getElementById('cName').value = '';
    document.getElementById('cNameAr').value = '';
    document.getElementById('cSort').value = '0';
    document.getElementById('cActive').checked = true;
    document.getElementById('btnSaveCategory').textContent = 'Add';
  }

  document.getElementById('btnCategories').addEventListener('click', async function () {
    if (!canManage) return;
    resetCategoryForm();
    await loadCategories();
    renderCategoryList();
    openModal('categoryModal');
  });

  ['btnCatDelCancel', 'btnCatDelCancelX'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', closeCategoryDeleteModal);
  });

  document.getElementById('btnCatDelConfirm').addEventListener('click', async function () {
    var id = pendingCategoryDeleteId;
    if (!id || !canManage) return;
    var btn = document.getElementById('btnCatDelConfirm');
    if (btn) btn.disabled = true;
    try {
      var ok = await deleteCategoryById(id);
      if (!ok) return;
      closeCategoryDeleteModal();
      if (document.getElementById('cId').value === id) resetCategoryForm();
      await loadCategories();
      renderCategoryList();
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('categoryForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!canManage) return;
    var id = document.getElementById('cId').value;
    var body = {
      name: document.getElementById('cName').value.trim(),
      nameAr: document.getElementById('cNameAr').value.trim() || null,
      sortOrder: Number(document.getElementById('cSort').value) || 0,
      isActive: document.getElementById('cActive').checked
    };
    if (!body.name) {
      toast('Category name required', 'err');
      return;
    }
    var r = id
      ? await Gfp.put(paths.category(id), body)
      : await Gfp.post(paths.categories(), body);
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    toast(id ? 'Category updated' : 'Category created', 'ok');
    resetCategoryForm();
    await loadCategories();
    renderCategoryList();
  });

  document.getElementById('btnCreate').addEventListener('click', function () {
    openProductEditor(null);
  });
  document.getElementById('btnRefresh').addEventListener('click', loadProducts);
  document.getElementById('filterCategory').addEventListener('change', loadProducts);
  document.getElementById('filterArchived').addEventListener('change', loadProducts);
  document.getElementById('filterQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadProducts, 300);
  });
  document.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setViewMode(btn.getAttribute('data-view'));
    });
  });
  document.getElementById('pImage').addEventListener('input', function () {
    localPreviewUrl = null;
    updateImagePreview();
  });
  document.getElementById('pSell').addEventListener('input', updateProfit);
  document.getElementById('pCost').addEventListener('input', updateProfit);
  var btnMoreProduct = document.getElementById('btnMoreProduct');
  if (btnMoreProduct) {
    btnMoreProduct.addEventListener('click', function () {
      var more = document.getElementById('productMore');
      setProductMoreOpen(more && more.hidden);
    });
  }
  var btnChoosePhoto = document.getElementById('btnChoosePhoto');
  if (btnChoosePhoto) {
    btnChoosePhoto.addEventListener('click', function () {
      var fileInput = document.getElementById('pImageFile');
      if (fileInput) fileInput.click();
    });
  }
  document.getElementById('pImageFile').addEventListener('change', async function () {
    var file = this.files && this.files[0];
    var hint = document.getElementById('productFormHint');
    if (localPreviewUrl && String(localPreviewUrl).indexOf('blob:') === 0) {
      try {
        URL.revokeObjectURL(localPreviewUrl);
      } catch (e) { /* ignore */ }
    }
    localPreviewUrl = null;
    paintImageFileName();
    if (!file) {
      updateImagePreview();
      return;
    }
    localPreviewUrl = URL.createObjectURL(file);
    updateImagePreview();
    hint.textContent = t('Uploading photo…', 'جاري رفع الصورة…');
    var up = await uploadProductImage(file);
    if (!up.ok) {
      hint.textContent = up.error || t('Upload failed', 'الرفع فشل');
      toast(up.error || t('Upload failed', 'الرفع فشل'), 'err');
      return;
    }
    document.getElementById('pImage').value = up.imageUrl;
    localPreviewUrl = null;
    updateImagePreview();
    hint.textContent = '';
    toast(t('Photo uploaded', 'اترفعت الصورة'), 'ok');
  });
  document.getElementById('btnScanBarcode').addEventListener('click', async function () {
    var hint = document.getElementById('productFormHint');
    if (!navigator.mediaDevices || !window.BarcodeDetector) {
      hint.textContent =
        'Camera barcode scan needs Chrome/Edge with BarcodeDetector — or type the barcode.';
      document.getElementById('pBarcode').focus();
      return;
    }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      var video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.style.cssText =
        'position:fixed;inset:0;z-index:400;width:100%;height:100%;object-fit:cover;background:#000';
      var stopBtn = document.createElement('button');
      stopBtn.type = 'button';
      stopBtn.textContent = 'Close scanner';
      stopBtn.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:401;padding:12px 20px;border:none;border-radius:12px;font-weight:700;background:#7ACC00;cursor:pointer';
      document.body.appendChild(video);
      document.body.appendChild(stopBtn);
      await video.play();
      var detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e']
      });
      var alive = true;
      function cleanup() {
        alive = false;
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        video.remove();
        stopBtn.remove();
      }
      stopBtn.onclick = cleanup;
      async function tick() {
        if (!alive) return;
        try {
          var codes = await detector.detect(video);
          if (codes && codes[0] && codes[0].rawValue) {
            document.getElementById('pBarcode').value = codes[0].rawValue;
            hint.textContent = '';
            cleanup();
            return;
          }
        } catch (e) { /* keep scanning */ }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    } catch (e) {
      hint.textContent = 'Camera permission denied or unavailable.';
    }
  });
  document.querySelectorAll('.view-btn').forEach(function (b) {
    b.classList.toggle('act', b.getAttribute('data-view') === viewMode);
  });
  var closeDetail = document.getElementById('btnCloseDetail');
  if (closeDetail) {
    closeDetail.addEventListener('click', function () {
      document.getElementById('detailDrawer').hidden = true;
    });
  }
  var detailOverlay = document.getElementById('detailDrawer');
  if (detailOverlay) {
    detailOverlay.addEventListener('click', function (ev) {
      if (ev.target === detailOverlay) detailOverlay.hidden = true;
    });
  }
  var closeStock = document.getElementById('btnCloseStockDrawer');
  if (closeStock) {
    closeStock.addEventListener('click', function () {
      document.getElementById('stockDrawer').hidden = true;
    });
  }
  var stockOverlay = document.getElementById('stockDrawer');
  if (stockOverlay) {
    stockOverlay.addEventListener('click', function (ev) {
      if (ev.target === stockOverlay) stockOverlay.hidden = true;
    });
  }
  var btnStockSubmit = document.getElementById('btnStockSubmit');
  if (btnStockSubmit) btnStockSubmit.addEventListener('click', submitStockDrawer);

  var closeBuy = document.getElementById('btnCloseBuyDrawer');
  if (closeBuy) {
    closeBuy.addEventListener('click', function () {
      document.getElementById('buyDrawer').hidden = true;
    });
  }
  var buyOverlay = document.getElementById('buyDrawer');
  if (buyOverlay) {
    buyOverlay.addEventListener('click', function (ev) {
      if (ev.target === buyOverlay) buyOverlay.hidden = true;
    });
  }
  var buySupplierSel = document.getElementById('buySupplier');
  if (buySupplierSel) {
    buySupplierSel.addEventListener('change', function () {
      syncBuyNewSupplierField();
      updateBuySupplierMeta();
    });
  }
  document.addEventListener('input', function (ev) {
    var id = ev.target && ev.target.id;
    if (id === 'buyQty' || id === 'buyUnitCost' || id === 'buyPaidNow') updateBuyTotalPreview();
  });
  document.addEventListener('change', function (ev) {
    var id = ev.target && ev.target.id;
    if (id === 'buyQty' || id === 'buyUnitCost' || id === 'buyPaidNow') updateBuyTotalPreview();
  });
  var btnBuySubmit = document.getElementById('btnBuySubmit');
  if (btnBuySubmit) btnBuySubmit.addEventListener('click', submitBuyDrawer);

  document.querySelectorAll('#stockChips .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      stockAlert = chip.getAttribute('data-alert') || '';
      document.querySelectorAll('#stockChips .chip').forEach(function (b) {
        b.classList.toggle('act', (b.getAttribute('data-alert') || '') === stockAlert);
      });
      try {
        var u = new URL(window.location.href);
        if (stockAlert) u.searchParams.set('alert', stockAlert);
        else u.searchParams.delete('alert');
        window.history.replaceState({}, '', u.pathname + u.search);
      } catch (e) { /* ignore */ }
      renderProducts();
    });
  });

  async function getByBarcode(code) {
    if (!code) return { ok: false, error: 'code required' };
    return Gfp.get(paths.productByBarcode(code));
  }
  if (Inv) Inv.getByBarcode = getByBarcode;

  (async function boot() {
    applyPackagingChrome();
    await resolveStockManagementFlag();
    await loadCategories();
    await loadProducts();
    try {
      var params = new URLSearchParams(window.location.search);
      var focus = params.get('focus') || params.get('productId');
      if (focus) openProductDetail(focus);
    } catch (e) { /* ignore */ }
  })();

  window.addEventListener('gfp:locale', function () {
    fillCategorySelects();
    applyPackagingChrome();
    renderAlertBanner();
    var modal = document.getElementById('productModal');
    if (modal && !modal.hidden) {
      setCreateModeUi(!editingId);
      var more = document.getElementById('productMore');
      if (more) setProductMoreOpen(!more.hidden);
      updateImagePreview();
      paintImageFileName();
      var ds = document.getElementById('pDefaultSupplier');
      fillDefaultSupplierSelect(ds && ds.value);
    }
  });
})();
