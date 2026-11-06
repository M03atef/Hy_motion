/**
 * Stock board (browse on-hand) + detail drawer (FE-INVS-3 + board).
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Inv = window.GfpInventoryApi;
  var I18n = window.GfpI18n;
  var paths = (Inv && Inv.paths) || {};

  var REASON_LABELS = {
    opening: 'رصيد افتتاحي / Opening',
    purchase_receipt: 'استلام شراء / Purchase',
    purchase_return: 'مرتجع شراء / Return',
    sale: 'بيع / Sale',
    sale_refund: 'مرتجع بيع / Refund',
    adjustment: 'تسوية / Adjustment',
    transfer_out: 'تحويل صادر / Transfer out',
    transfer_in: 'تحويل وارد / Transfer in',
    count: 'جرد / Count'
  };

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
  if (!Authz || !Authz.useCan('inventory.view')) {
    window.location.href = '/dashboard/';
    return;
  }

  var boardRows = [];
  var stockFilter = 'all';
  var searchTimer = null;
  var selectedProductId = null;

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || 'Request failed';
    if (!r) return 'Request failed';
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || 'Request failed (' + r.status + ')';
  }
  function qtyFmt(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  function dt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? esc(iso)
      : d.toLocaleString('ar-EG', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
  }
  function reasonLabel(r) {
    return REASON_LABELS[r] || r || '—';
  }
  function sellableQty(row) {
    if (row.available != null && !Number.isNaN(Number(row.available))) return Number(row.available);
    return Number(row.onHand) || 0;
  }
  function physicalQty(row) {
    return Number(row.onHand) || 0;
  }
  function rowTone(row) {
    var q = sellableQty(row);
    var min = Number(row.reorderMinQty) || 0;
    var physical = physicalQty(row);
    if (q <= 0 && physical > 0) return 'expired';
    if (q <= 0) return 'oos';
    if (min > 0 && q <= min) return 'low';
    return 'ok';
  }
  function stockBadge(row) {
    var tone = rowTone(row);
    var avail = sellableQty(row);
    var physical = physicalQty(row);
    var cls =
      tone === 'oos' || tone === 'expired'
        ? 'stock-out'
        : tone === 'low'
          ? 'stock-low'
          : 'stock-ok';
    var label =
      tone === 'expired'
        ? t('Expired / unsellable', 'منتهي — مش هيتباع')
        : t('Sellable', 'قابل للبيع');
    var extra =
      physical !== avail
        ? '<span class="stock-physical" data-stock-onhand="' +
          esc(String(physical)) +
          '">' +
          esc(t('On shelf', 'على الرف') + ' ' + qtyFmt(physical)) +
          '</span>'
        : '';
    return (
      '<span class="stock-badge-wrap">' +
      '<span class="stock-badge ' +
      cls +
      '" data-stock-available="' +
      esc(String(avail)) +
      '" data-stock-onhand="' +
      esc(String(physical)) +
      '" title="' +
      esc(label) +
      '">' +
      esc(qtyFmt(avail)) +
      '</span>' +
      extra +
      '</span>'
    );
  }
  function thumb(url) {
    if (url) {
      return (
        '<div class="board-thumb"><img src="' +
        esc(url) +
        '" alt="" loading="lazy" onerror="this.remove()"></div>'
      );
    }
    return '<div class="board-thumb"><i class="ti ti-box"></i></div>';
  }

  (function chrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) {
        return w[0];
      })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    document.getElementById('userAvatar').textContent = ini;
    document.getElementById('userName').textContent = user.fullName || 'User';
    document.getElementById('userRole').textContent = user.role || 'Staff';
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (Gfp) Gfp.logout();
      else window.location.href = '/auth/login/';
    });
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  async function loadWarehouses() {
    var sel = document.getElementById('boardWarehouse');
    var r = await Gfp.get(paths.warehouses());
    sel.innerHTML =
      '<option value="">' + esc(t('All warehouses', 'كل المستودعات')) + '</option>';
    if (!r.ok || !Array.isArray(r.data)) {
      toast(apiError(r), 'err');
      return;
    }
    r.data.forEach(function (w) {
      if (w.isActive === false) return;
      var label = w.name + (w.isDefault ? ' ★' : '') + ' — ' + w.code;
      sel.appendChild(new Option(label, w.id));
    });
  }

  function visibleRows() {
    return boardRows.filter(function (row) {
      var tone = rowTone(row);
      if (stockFilter === 'all') return true;
      if (stockFilter === 'oos') return sellableQty(row) <= 0;
      if (stockFilter === 'expired') return tone === 'expired';
      return tone === stockFilter;
    });
  }

  function renderBoard() {
    var host = document.getElementById('boardHost');
    var rows = visibleRows();
    var all = boardRows;
    var oos = all.filter(function (r) {
      return sellableQty(r) <= 0;
    }).length;
    var expired = all.filter(function (r) {
      return rowTone(r) === 'expired';
    }).length;
    var low = all.filter(function (r) {
      return rowTone(r) === 'low';
    }).length;
    var ok = all.filter(function (r) {
      return rowTone(r) === 'ok';
    }).length;
    document.getElementById('boardStats').innerHTML =
      '<div class="stat-pill">' +
      esc(String(all.length)) +
      ' ' +
      esc(t('products', 'منتج')) +
      '</div>' +
      '<div class="stat-pill danger">' +
      esc(String(oos)) +
      ' ' +
      esc(t("can't sell", 'مش بيتباع')) +
      (expired ? ' · ' + expired + ' ' + esc(t('expired', 'منتهي')) : '') +
      '</div>' +
      '<div class="stat-pill warn">' +
      esc(String(low)) +
      ' ' +
      esc(t('low', 'منخفض')) +
      '</div>' +
      '<div class="stat-pill ok">' +
      esc(String(ok)) +
      ' ' +
      esc(t('ok', 'تمام')) +
      '</div>';

    if (!all.length) {
      host.innerHTML =
        '<div class="empty-state">' +
        esc(t('No tracked products yet.', 'مفيش أصناف متتبعة بعد.')) +
        '</div>';
      return;
    }
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state">' +
        esc(t('No products in this filter.', 'مفيش منتجات في الفلتر ده.')) +
        '</div>';
      return;
    }

    host.innerHTML =
      '<table class="inv board-table"><thead><tr>' +
      '<th></th><th>' +
      esc(t('Product', 'المنتج')) +
      '</th><th>' +
      esc(t('Sellable', 'قابل للبيع')) +
      '</th><th>' +
      esc(t('Min', 'الحد')) +
      '</th><th></th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          var tone = rowTone(row);
          var toneClass = tone === 'expired' ? 'oos' : tone;
          return (
            '<tr class="board-row tone-' +
            toneClass +
            (selectedProductId === row.productId ? ' sel' : '') +
            '" data-pid="' +
            esc(row.productId) +
            '">' +
            '<td>' +
            thumb(row.imageUrl) +
            '</td><td><div class="board-name">' +
            esc(row.name) +
            '</div><div class="board-sku">' +
            esc(row.sku) +
            '</div></td><td>' +
            stockBadge(row) +
            '</td><td>' +
            esc(qtyFmt(row.reorderMinQty)) +
            '</td><td><button type="button" class="btn-link" data-open="' +
            esc(row.productId) +
            '">' +
            esc(t('Open', 'فتح')) +
            '</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';

    host.querySelectorAll('[data-pid]').forEach(function (tr) {
      tr.addEventListener('click', function (ev) {
        if (ev.target.closest('button')) return;
        openDetail(tr.getAttribute('data-pid'));
      });
    });
    host.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openDetail(b.getAttribute('data-open'));
      });
    });
  }

  async function loadBoard() {
    var host = document.getElementById('boardHost');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';
    var params = { q: document.getElementById('boardQ').value.trim() || undefined };
    var wh = document.getElementById('boardWarehouse').value;
    if (wh) params.warehouseId = wh;
    var r = await Gfp.get(paths.stockBoard(params));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    boardRows = Array.isArray(r.data) ? r.data : [];
    renderBoard();
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }

  function syncContextualActionLinks(productId, warehouseId) {
    var buy = document.getElementById('linkBuyReceive');
    var fix = document.getElementById('linkFixQty');
    var q = 'from=on-hand';
    if (productId) q += '&productId=' + encodeURIComponent(productId);
    if (warehouseId) q += '&warehouseId=' + encodeURIComponent(warehouseId);
    if (buy) buy.href = '/dashboard/inventory/purchase-orders/?' + q;
    if (fix) fix.href = '/dashboard/inventory/adjustments/?' + q;
  }

  function setStockBreadcrumb(productLabel) {
    var crumb = document.getElementById('stockBreadcrumb');
    if (!crumb) return;
    if (productLabel) {
      crumb.innerHTML =
        '<span data-en="Inventory" data-ar="المخزون">Inventory</span><span class="sep">/</span>' +
        '<a href="/dashboard/inventory/stock/" data-en="On Hand" data-ar="الرصيد">On Hand</a>' +
        '<span class="sep">/</span><span class="current" id="bcCurrent">' +
        esc(productLabel) +
        '</span>';
    } else {
      crumb.innerHTML =
        '<span data-en="Inventory" data-ar="المخزون">Inventory</span><span class="sep">/</span>' +
        '<span class="current" id="bcCurrent" data-en="On Hand" data-ar="الرصيد">On Hand</span>';
    }
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }

  async function openDetail(productId) {
    selectedProductId = productId;
    renderBoard();
    var panel = document.getElementById('detailPanel');
    panel.hidden = false;
    document.getElementById('detailTitle').textContent = t('Details', 'التفاصيل');
    document.getElementById('breakdownHost').innerHTML =
      '<div class="empty-state">' + esc(t('Loading…', 'جاري التحميل…')) + '</div>';
    document.getElementById('movementsHost').innerHTML = '';
    document.getElementById('qtyValue').textContent = '…';
    syncContextualActionLinks(productId, document.getElementById('boardWarehouse').value || '');

    var br = await Gfp.get(paths.productStock(productId));
    if (!br.ok) {
      document.getElementById('breakdownHost').innerHTML =
        '<div class="error-state"><p>' + esc(apiError(br)) + '</p></div>';
      return;
    }
    var data = br.data || {};
    var productLabel = data.name || data.sku || t('Product', 'منتج');
    setStockBreadcrumb(productLabel);
    document.getElementById('detailTitle').textContent =
      (data.name || data.sku || '') +
      ' · ' +
      t('Sellable', 'قابل للبيع') +
      ' ' +
      qtyFmt(data.totalAvailable != null ? data.totalAvailable : data.totalOnHand);
    var warehouses = data.warehouses || [];
    if (!warehouses.length) {
      document.getElementById('breakdownHost').innerHTML =
        '<div class="empty-state">' +
        esc(t('No warehouse balances yet.', 'لا أرصدة في المستودعات بعد.')) +
        '</div>';
    } else {
      document.getElementById('breakdownHost').innerHTML =
        '<table class="inv"><thead><tr><th>' +
        esc(t('Warehouse', 'المستودع')) +
        '</th><th>' +
        esc(t('Sellable', 'قابل للبيع')) +
        '</th><th>' +
        esc(t('On shelf', 'على الرف')) +
        '</th></tr></thead><tbody>' +
        warehouses
          .map(function (w) {
            var avail = w.qtyAvailable != null ? w.qtyAvailable : w.qtyOnHand;
            return (
              '<tr><td>' +
              esc(w.warehouseName || w.warehouseCode || '') +
              '</td><td data-stock-available="' +
              esc(String(avail)) +
              '">' +
              qtyFmt(avail) +
              '</td><td data-stock-onhand="' +
              esc(String(w.qtyOnHand)) +
              '">' +
              qtyFmt(w.qtyOnHand) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    }

    var warehouseId =
      document.getElementById('boardWarehouse').value ||
      (warehouses[0] && warehouses[0].warehouseId) ||
      '';
    syncContextualActionLinks(productId, warehouseId);
    if (!warehouseId) {
      document.getElementById('qtyValue').textContent = qtyFmt(
        data.totalAvailable != null ? data.totalAvailable : data.totalOnHand
      );
      document.getElementById('qtyMeta').textContent = t(
        'All warehouses · sellable',
        'كل المستودعات · قابل للبيع'
      );
      document.getElementById('movementsHost').innerHTML =
        '<div class="empty-state">' +
        esc(t('Pick a warehouse filter to load movement history.', 'اختار مستودع لعرض الحركة.')) +
        '</div>';
      return;
    }

    var sr = await Gfp.get(
      paths.stock({
        productId: productId,
        warehouseId: warehouseId,
        includeMovements: 'true',
        movementTake: 50
      })
    );
    if (!sr.ok) {
      document.getElementById('qtyValue').textContent = '—';
      document.getElementById('movementsHost').innerHTML =
        '<div class="error-state"><p>' + esc(apiError(sr)) + '</p></div>';
      return;
    }
    var s = sr.data || {};
    var sellable = s.qtyAvailable != null ? s.qtyAvailable : s.qtyOnHand;
    document.getElementById('qtyValue').textContent = qtyFmt(sellable);
    document.getElementById('qtyValue').setAttribute('data-stock-available', String(sellable));
    document.getElementById('qtyValue').setAttribute('data-stock-onhand', String(s.qtyOnHand));
    document.getElementById('qtyMeta').textContent =
      (data.name || data.sku || '') +
      (warehouses.find(function (w) {
        return w.warehouseId === warehouseId;
      })
        ? ' @ ' +
          (warehouses.find(function (w) {
            return w.warehouseId === warehouseId;
          }).warehouseCode || '')
        : '') +
      (s.qtyOnHand != null && Number(s.qtyOnHand) !== Number(sellable)
        ? ' · ' + t('On shelf', 'على الرف') + ' ' + qtyFmt(s.qtyOnHand)
        : '');

    var moves = s.movements || [];
    if (!moves.length) {
      document.getElementById('movementsHost').innerHTML =
        '<div class="empty-state">' +
        esc(t('No activity yet for this product/warehouse.', 'لا حركات لهذا المنتج في هذا المستودع.')) +
        '</div>';
      return;
    }
    document.getElementById('movementsHost').innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('When', 'متى')) +
      '</th><th>' +
      esc(t('Type', 'النوع')) +
      '</th><th>' +
      esc(t('Qty', 'الكمية')) +
      '</th><th>' +
      esc(t('Note', 'ملاحظة')) +
      '</th></tr></thead><tbody>' +
      moves
        .map(function (m) {
          var delta = Number(m.qtyDelta);
          var cls = delta < 0 ? 'neg' : 'pos';
          return (
            '<tr><td>' +
            dt(m.occurredAtUtc) +
            '</td><td>' +
            esc(reasonLabel(m.reason)) +
            '</td><td class="' +
            cls +
            '">' +
            qtyFmt(m.qtyDelta) +
            '</td><td>' +
            esc(m.note || '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  document.getElementById('btnRefresh').addEventListener('click', loadBoard);
  document.getElementById('boardWarehouse').addEventListener('change', async function () {
    await loadBoard();
    if (selectedProductId) {
      syncContextualActionLinks(
        selectedProductId,
        document.getElementById('boardWarehouse').value || ''
      );
      openDetail(selectedProductId);
    }
  });
  document.getElementById('boardQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadBoard, 280);
  });
  document.querySelectorAll('.filter-chips .chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      stockFilter = btn.getAttribute('data-filter') || 'all';
      document.querySelectorAll('.filter-chips .chip').forEach(function (b) {
        b.classList.toggle('act', b === btn);
      });
      renderBoard();
    });
  });
  document.getElementById('btnCloseDetail').addEventListener('click', function () {
    document.getElementById('detailPanel').hidden = true;
    selectedProductId = null;
    setStockBreadcrumb(null);
    syncContextualActionLinks('', document.getElementById('boardWarehouse').value || '');
    renderBoard();
  });
  window.addEventListener('gfp:locale', function () {
    renderBoard();
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  });

  (async function boot() {
    await loadWarehouses();
    var params = new URLSearchParams(window.location.search);
    var filterQ = params.get('filter');
    if (filterQ && ['all', 'low', 'oos', 'expired', 'ok'].indexOf(filterQ) >= 0) {
      stockFilter = filterQ;
      document.querySelectorAll('.filter-chips .chip').forEach(function (b) {
        b.classList.toggle('act', (b.getAttribute('data-filter') || '') === stockFilter);
      });
    }
    await loadBoard();
    var pid = params.get('productId');
    if (pid) openDetail(pid);
    var fix = document.getElementById('linkFixQty');
    if (fix && Authz && Authz.useCan('inventory.adjust')) fix.hidden = false;
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  })();
})();
