/**
 * Purchase orders (FE-INVS-5). Real /api/inventory/purchase-orders* + suppliers/warehouses/products.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Inv = window.GfpInventoryApi;
  var I18n = window.GfpI18n;
  var paths = (Inv && Inv.paths) || {};

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

  var canManage = Authz.useCan('inventory.manage');
  var canPurchase = Authz.useCan('inventory.purchase');
  var canSeeCost =
    canManage || canPurchase || Authz.useCan('reports.financial.view');
  var list = [];
  var allList = [];
  var current = null;
  var suppliers = [];
  var warehouses = [];
  /** @type {Record<string, any>} */
  var productById = {};
  var listTruncated = false;
  var listTake = '200';

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function mediaUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    var origin = String(window.API_BASE || (Gfp && Gfp.apiBase && Gfp.apiBase()) || '').replace(
      /\/api\/?$/i,
      ''
    );
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
  function productCellHtml(line) {
    var p = (line && line.productId && productById[line.productId]) || {};
    var name = (line && (line.productName || line.productSku)) || p.name || p.sku || '—';
    var src = mediaUrl(p.imageUrl || p.relativeUrl);
    var thumb = src
      ? '<img class="thumb" src="' +
        esc(src) +
        '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.hidden=false)">' +
        '<span class="thumb-ph" hidden><i class="ti ti-photo"></i></span>'
      : '<span class="thumb-ph"><i class="ti ti-photo"></i></span>';
    return '<div class="prod-cell">' + thumb + '<span>' + esc(name) + '</span></div>';
  }
  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(n));
  }
  function toast(msg, type, htmlExtra) {
    return globalThis.toastShared(msg, type, htmlExtra);
  }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || t('Request failed', 'فشل الطلب') + ' (' + r.status + ')';
  }
  function applyLocale() {
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }
  function openModal(id) {
    document.getElementById(id).hidden = false;
    applyLocale();
  }
  function closeModal(id) {
    document.getElementById(id).hidden = true;
  }
  var STATUS_LABELS = {
    draft: ['Draft', 'مسودة'],
    approved: ['To receive', 'بانتظار الاستلام'],
    partially_received: ['Partially received', 'استلام جزئي'],
    received: ['Received', 'مستلم'],
    cancelled: ['Cancelled', 'ملغى']
  };
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  }
  function defaultWarehouseId() {
    var ws = document.getElementById('poWarehouse');
    if (ws && ws.value) return ws.value;
    var def = warehouses.find(function (w) {
      return w.isDefault && w.isActive !== false;
    });
    if (!def) {
      def = warehouses.find(function (w) {
        return w.isActive !== false;
      });
    }
    return def ? def.id : '';
  }
  function hideWarehouseUi() {
    var wrap = document.getElementById('poWarehouseWrap');
    if (wrap) wrap.hidden = true;
    var field = document.getElementById('poWarehouseField');
    if (field) field.hidden = true;
  }
  function updatePoTotalPreview() {
    var el = document.getElementById('poTotalPreview');
    var row = document.getElementById('poTotalRow');
    if (!el) return;
    if (!canSeeCost) {
      if (row) row.hidden = true;
      return;
    }
    if (row) row.hidden = false;
    var total = 0;
    var ok = false;
    document.querySelectorAll('#poLines .line-row').forEach(function (r) {
      var qty = Number(r.querySelector('.pl-qty').value);
      var cost = Number(r.querySelector('.pl-cost').value);
      if (Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost >= 0) {
        total += qty * cost;
        ok = true;
      }
    });
    el.textContent = ok ? money(total) : money(0);
  }
  function statusLabel(st) {
    var pair = STATUS_LABELS[st];
    return pair ? t(pair[0], pair[1]) : st;
  }
  function statusBadge(st) {
    var cls = 'badge-draft';
    if (st === 'approved') cls = 'badge-approved';
    else if (st === 'partially_received') cls = 'badge-partial';
    else if (st === 'received') cls = 'badge-received';
    else if (st === 'cancelled') cls = 'badge-cancelled';
    return '<span class="badge ' + cls + '">' + esc(statusLabel(st)) + '</span>';
  }

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      closeModal(b.getAttribute('data-close'));
    });
  });

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
    if (canManage) document.getElementById('manageActions').hidden = false;
    var closeDet = document.getElementById('btnCloseDetail');
    if (closeDet) {
      closeDet.addEventListener('click', closeDetailDrawer);
    }
    var detOv = document.getElementById('detailDrawer');
    if (detOv) {
      detOv.addEventListener('click', function (ev) {
        if (ev.target === detOv) closeDetailDrawer();
      });
    }
    document.querySelectorAll('#statusChips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#statusChips .chip').forEach(function (c) {
          c.classList.toggle('act', c === chip);
        });
        document.getElementById('filterStatus').value = chip.getAttribute('data-status') || '';
        loadList();
      });
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

  async function loadLookups() {
    var results = await Promise.all([
      Gfp.get(paths.suppliers()),
      Gfp.get(paths.warehouses()),
      Gfp.get(paths.products())
    ]);
    suppliers = results[0].ok && Array.isArray(results[0].data) ? results[0].data : [];
    warehouses = results[1].ok && Array.isArray(results[1].data) ? results[1].data : [];
    var products = results[2].ok && Array.isArray(results[2].data) ? results[2].data : [];
    productById = {};
    products.forEach(function (p) {
      productById[p.id] = p;
    });
  }

  function purchasableOptionsHtml() {
    var opts = Object.keys(productById)
      .map(function (id) {
        return productById[id];
      })
      .filter(function (p) {
        return !p.isArchived && p.isActive !== false && p.trackStock !== false;
      })
      .map(function (p) {
        var usual = '';
        var sid = (document.getElementById('poSupplier') || {}).value;
        if (sid && p.defaultSupplierId === sid) {
          usual = ' · ' + t('usual', 'المعتاد');
        }
        return (
          '<option value="' +
          esc(p.id) +
          '">' +
          esc(p.sku) +
          ' — ' +
          esc(p.name) +
          usual +
          '</option>'
        );
      })
      .join('');
    return (
      '<option value="">' +
      esc(t('Select product', 'اختار منتج')) +
      '</option>' +
      opts
    );
  }

  function addPoLineRow(pre) {
    var wrap = document.getElementById('poLines');
    var row = document.createElement('div');
    row.className = 'po-item line-row';
    row.innerHTML =
      '<label class="ef-field"><span class="lh">' +
      esc(t('Product', 'المنتج')) +
      '</span><select class="pl-product" required>' +
      purchasableOptionsHtml() +
      '</select></label>' +
      '<label class="ef-field"><span class="lh">' +
      esc(t('Qty', 'الكمية')) +
      '</span><input type="number" class="pl-qty" min="0.001" step="any" required value="' +
      esc((pre && pre.qtyOrdered) || 1) +
      '"></label>' +
      '<label class="ef-field"><span class="lh">' +
      esc(t('Cost', 'التكلفة')) +
      '</span><input type="number" class="pl-cost" min="0" step="0.01" required value="' +
      esc((pre && pre.unitCost) != null ? pre.unitCost : 0) +
      '"></label>' +
      '<button type="button" class="pl-remove" title="' +
      esc(t('Remove', 'حذف')) +
      '"><i class="ti ti-trash"></i></button>';
    if (pre && pre.productId) row.querySelector('.pl-product').value = pre.productId;
    row.querySelector('.pl-remove').addEventListener('click', function () {
      row.remove();
      updatePoTotalPreview();
    });
    row.querySelector('.pl-qty').addEventListener('input', updatePoTotalPreview);
    row.querySelector('.pl-cost').addEventListener('input', updatePoTotalPreview);
    wrap.appendChild(row);
    updatePoTotalPreview();
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';
    var status = document.getElementById('filterStatus').value;
    var r = await Gfp.get(paths.purchaseOrders());
    if (!r.ok) {
      document.getElementById('kpiHost').hidden = true;
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    allList = Array.isArray(r.data) ? r.data : [];
    list = status
      ? allList.filter(function (po) {
          return po.status === status;
        })
      : allList;
    listTruncated =
      !!(
        r.headers &&
        String(r.headers.get('X-Gfp-Truncated') || r.headers.get('x-gfp-truncated') || '').toLowerCase() ===
          'true'
      );
    listTake = (r.headers && (r.headers.get('X-Gfp-Take') || r.headers.get('x-gfp-take'))) || '200';
    renderKpis();
    renderList(listTruncated, listTake);
  }

  function poReceivedSpend(po) {
    return (po.lines || []).reduce(function (sum, ln) {
      return sum + Number(ln.qtyReceived || 0) * Number(ln.unitCost || 0);
    }, 0);
  }

  function isThisMonth(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function renderKpis() {
    var host = document.getElementById('kpiHost');
    if (!host) return;
    var rows = allList || [];
    var received = 0;
    var toReceive = 0;
    var drafts = 0;
    var monthSpend = 0;
    rows.forEach(function (po) {
      var st = po.status;
      if (st === 'received' || st === 'partially_received') received += 1;
      if (st === 'approved' || st === 'partially_received') toReceive += 1;
      if (st === 'draft') drafts += 1;
      if (canSeeCost && (st === 'received' || st === 'partially_received') && isThisMonth(po.orderedAtUtc)) {
        monthSpend += poReceivedSpend(po);
      }
    });
    var thirdLabel = canSeeCost
      ? t('This month', 'هذا الشهر')
      : t('Drafts', 'مسودات');
    var thirdValue = canSeeCost ? money(monthSpend) : String(drafts);
    host.hidden = false;
    host.innerHTML =
      '<div class="kpi-card"><div class="label">' +
      esc(t('Purchases', 'المشتريات')) +
      '</div><div class="value">' +
      esc(String(received)) +
      '</div></div>' +
      '<div class="kpi-card"><div class="label">' +
      esc(t('To receive', 'بانتظار الاستلام')) +
      '</div><div class="value' +
      (toReceive > 0 ? ' wait' : '') +
      '">' +
      esc(String(toReceive)) +
      '</div></div>' +
      '<div class="kpi-card"><div class="label">' +
      esc(thirdLabel) +
      '</div><div class="value">' +
      esc(thirdValue) +
      '</div></div>';
  }

  function renderList(truncated, take) {
    var host = document.getElementById('tableHost');
    var banner = truncated
      ? '<div class="trunc-banner">' +
        esc(
          t(
            'Showing first ' + take + ' purchase orders. Refine by status if you need older ones.',
            'عرض أول ' + take + ' أمر شراء. صفّي بالحالة لو محتاج أقدم.'
          )
        ) +
        '</div>'
      : '';
    if (!list.length) {
      host.innerHTML =
        banner +
        '<div class="empty-state"><i class="ti ti-shopping-bag" style="font-size:32px"></i><p><strong>' +
        esc(t('No purchases yet.', 'لا توجد مشتريات بعد.')) +
        '</strong></p><p style="font-size:13px;margin-top:6px">' +
        esc(t('Record what you bought from a supplier.', 'سجّل اللي اشتريته من المورد.')) +
        '</p></div>';
      return;
    }
    host.innerHTML =
      banner +
      '<table class="inv"><thead><tr><th>' +
      esc(t('Date', 'التاريخ')) +
      '</th><th>' +
      esc(t('Supplier', 'المورد')) +
      '</th><th>' +
      esc(t('Status', 'الحالة')) +
      '</th></tr></thead><tbody>' +
      list
        .map(function (po) {
          return (
            '<tr class="clickable" data-id="' +
            esc(po.id) +
            '"><td>' +
            esc(fmtDate(po.orderedAtUtc)) +
            '</td><td><button type="button" class="prod-link">' +
            esc(po.supplierName || '—') +
            '</button></td><td>' +
            statusBadge(po.status) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
    host.querySelectorAll('[data-id]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        loadDetail(tr.getAttribute('data-id'));
      });
    });
  }

  function openDetailDrawer() {
    var d = document.getElementById('detailDrawer');
    if (d) d.hidden = false;
  }
  function closeDetailDrawer() {
    var d = document.getElementById('detailDrawer');
    if (d) d.hidden = true;
  }

  async function loadDetail(id) {
    openDetailDrawer();
    var host = document.getElementById('detailHost');
    var title = document.getElementById('detailTitle');
    if (title) title.textContent = t('Purchase', 'شراء');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';
    var r = await Gfp.get(paths.purchaseOrder(id));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    current = r.data;
    renderDetail();
  }

  function renderDetail() {
    var po = current;
    var host = document.getElementById('detailHost');
    if (!po) {
      closeDetailDrawer();
      return;
    }
    var title = document.getElementById('detailTitle');
    if (title) title.textContent = po.supplierName || t('Purchase', 'شراء');
    var actions = [];
    if (canPurchase && po.status === 'draft') {
      actions.push(
        '<button type="button" class="btn-create" id="btnApprove">' +
          esc(t('Approve', 'اعتماد')) +
          '</button>'
      );
      actions.push(
        '<button type="button" class="btn-secondary" id="btnCancel">' +
          esc(t('Cancel', 'إلغاء')) +
          '</button>'
      );
    }
    if (canPurchase && (po.status === 'approved' || po.status === 'partially_received')) {
      actions.push(
        '<button type="button" class="btn-create" id="btnReceive">' +
          esc(t('Receive', 'استلام')) +
          '</button>'
      );
      if (po.status === 'approved') {
        actions.push(
          '<button type="button" class="btn-secondary" id="btnCancel">' +
            esc(t('Cancel', 'إلغاء')) +
            '</button>'
        );
      }
    }

    host.innerHTML =
      '<div class="qty-hero">' +
      '<div class="qty-hero-l">' +
      esc(t('Supplier', 'المورد')) +
      '</div>' +
      '<div class="qty-hero-v" style="font-size:22px">' +
      esc(po.supplierName || '—') +
      '</div>' +
      '<div class="qty-hero-h">' +
      esc(fmtDate(po.orderedAtUtc)) +
      ' · ' +
      esc(statusLabel(po.status)) +
      '</div></div>' +
      '<div class="detail-kv">' +
      '<div class="kv"><div class="k">' +
      esc(t('Status', 'الحالة')) +
      '</div><div class="v">' +
      statusBadge(po.status) +
      '</div></div>' +
      '<div class="kv"><div class="k">' +
      esc(t('Date', 'التاريخ')) +
      '</div><div class="v">' +
      esc(fmtDate(po.orderedAtUtc)) +
      '</div></div></div>' +
      (po.notes
        ? '<p class="muted" style="margin:12px 0 0">' + esc(po.notes) + '</p>'
        : '') +
      (actions.length ? '<div class="detail-actions">' + actions.join('') + '</div>' : '') +
      '<div class="table-wrap" style="margin-top:16px"><table class="inv"><thead><tr><th>' +
      esc(t('Product', 'المنتج')) +
      '</th><th>' +
      esc(t('Qty', 'الكمية')) +
      '</th><th>' +
      esc(t('Received', 'مستلم')) +
      '</th><th>' +
      esc(t('Unit cost', 'تكلفة الوحدة')) +
      '</th></tr></thead><tbody>' +
      ((po.lines || [])
        .map(function (l) {
          return (
            '<tr><td>' +
            productCellHtml(l) +
            '</td><td>' +
            esc(l.qtyOrdered) +
            '</td><td>' +
            esc(l.qtyReceived) +
            '</td><td>' +
            esc(canSeeCost ? money(l.unitCost) : '—') +
            '</td></tr>'
          );
        })
        .join('') ||
        '<tr><td colspan="4" class="muted">' + esc(t('No products', 'لا منتجات')) + '</td></tr>') +
      '</tbody></table></div>' +
      '<p class="muted" style="margin-top:14px">' +
      '<a class="stock-link" href="/dashboard/inventory/products/">' +
      esc(t('Open Products', 'فتح المنتجات')) +
      '</a></p>';

    var btnApprove = document.getElementById('btnApprove');
    if (btnApprove) {
      btnApprove.addEventListener('click', async function () {
        var r = await Gfp.post(paths.purchaseOrderApprove(po.id), {});
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Ready to receive.', 'جاهز للاستلام.'), 'ok');
        current = r.data || current;
        await loadList();
        await loadDetail(po.id);
      });
    }
    var btnCancel = document.getElementById('btnCancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', async function () {
        if (!window.confirm(t('Cancel this purchase?', 'إلغاء عملية الشراء دي؟'))) return;
        var r = await Gfp.post(paths.purchaseOrderCancel(po.id), {});
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Purchase cancelled.', 'تم إلغاء الشراء.'), 'ok');
        await loadList();
        await loadDetail(po.id);
      });
    }
    var btnReceive = document.getElementById('btnReceive');
    if (btnReceive) {
      btnReceive.addEventListener('click', openReceiveModal);
    }
  }

  function openReceiveModal() {
    var po = current;
    if (!po) return;
    var host = document.getElementById('recvLines');
    host.innerHTML = '';
    document.getElementById('recvHint').textContent = '';
    (po.lines || [])
      .filter(function (l) {
        return Number(l.qtyRemaining) > 0;
      })
      .forEach(function (l) {
        var p = productById[l.productId] || {};
        var needBatch = !!p.trackBatch;
        var needExpiry = !!p.trackExpiry;
        var div = document.createElement('div');
        div.className = 'recv-line';
        div.setAttribute('data-line-id', l.id);
        div.setAttribute('data-remaining', String(l.qtyRemaining));
        var reqParts = [];
        if (needBatch) reqParts.push(t('batch', 'تشغيلة'));
        if (needExpiry) reqParts.push(t('expiry', 'صلاحية'));
        var reqHint =
          needBatch || needExpiry
            ? t('Product requires: ', 'المنتج يتطلب: ') + reqParts.join(t(' + ', ' + '))
            : t('No batch/expiry required', 'لا يلزم تشغيلة/صلاحية');
        div.innerHTML =
          '<h4>' +
          esc(l.productSku || '') +
          ' — ' +
          esc(l.productName || '') +
          ' <span class="muted">(' +
          esc(t('remaining', 'متبقي')) +
          ' ' +
          esc(l.qtyRemaining) +
          ')</span></h4>' +
          '<label>' +
          esc(t('Qty to receive', 'الكمية المستلمة')) +
          '<input type="number" class="rv-qty" min="0" step="any" max="' +
          esc(l.qtyRemaining) +
          '" value="0"></label>' +
          '<label>' +
          esc(t('Unit cost', 'تكلفة الوحدة')) +
          '<input type="number" class="rv-cost" min="0" step="0.01" value="' +
          esc(l.unitCost) +
          '"></label>' +
          (needBatch
            ? '<label>' +
              esc(t('Batch #', 'رقم التشغيلة')) +
              '<input class="rv-batch" required maxlength="80"></label>'
            : '<input type="hidden" class="rv-batch">') +
          (needExpiry
            ? '<label>' +
              esc(t('Expires on', 'تاريخ الصلاحية')) +
              '<input type="date" class="rv-exp" required></label>'
            : '<input type="hidden" class="rv-exp">') +
          '<div class="muted" style="grid-column:1/-1">' +
          esc(reqHint) +
          '</div>';
        host.appendChild(div);
      });
    if (!host.children.length) {
      toast(t('Nothing left to receive.', 'لا يوجد ما يُستلم.'), 'err');
      return;
    }
    openModal('recvModal');
  }

  document.getElementById('recvForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!current || !canPurchase) return;
    var lines = [];
    var err = '';
    document.querySelectorAll('#recvLines .recv-line').forEach(function (row) {
      var qty = Number(row.querySelector('.rv-qty').value) || 0;
      if (!(qty > 0)) return;
      var remaining = Number(row.getAttribute('data-remaining'));
      if (qty > remaining) {
        err = t('Qty exceeds remaining for a line.', 'الكمية أكبر من المتبقي لبند.');
        return;
      }
      var batchEl = row.querySelector('.rv-batch');
      var expEl = row.querySelector('.rv-exp');
      var batchNumber = batchEl && batchEl.type !== 'hidden' ? batchEl.value.trim() : null;
      var expiresOn = expEl && expEl.type !== 'hidden' ? expEl.value || null : null;
      var lineId = row.getAttribute('data-line-id');
      var poLine = (current.lines || []).find(function (x) {
        return x.id === lineId;
      });
      var p = poLine ? productById[poLine.productId] : null;
      if (p && p.trackBatch && !batchNumber) {
        err =
          t('Batch number required for ', 'رقم التشغيلة مطلوب لـ ') + (p.sku || t('product', 'منتج'));
        return;
      }
      if (p && p.trackExpiry && !expiresOn) {
        err =
          t('Expiry date required for ', 'تاريخ الصلاحية مطلوب لـ ') + (p.sku || t('product', 'منتج'));
        return;
      }
      var unitCost = Number(row.querySelector('.rv-cost').value);
      lines.push({
        purchaseOrderLineId: lineId,
        qty: qty,
        unitCost: Number.isFinite(unitCost) ? unitCost : null,
        batchNumber: batchNumber,
        expiresOn: expiresOn
      });
    });
    if (err) {
      document.getElementById('recvHint').textContent = err;
      return;
    }
    if (!lines.length) {
      document.getElementById('recvHint').textContent = t(
        'Enter qty > 0 on at least one line.',
        'أدخل كمية أكبر من صفر في بند واحد على الأقل.'
      );
      return;
    }
    var r = await Gfp.post(paths.purchaseOrderReceive(current.id), { lines: lines });
    if (!r.ok) {
      document.getElementById('recvHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    closeModal('recvModal');
    var grnId = r.data && r.data.id;
    var cta =
      grnId
        ? ' <a href="/dashboard/invoices/?tab=buy&grnId=' +
          encodeURIComponent(grnId) +
          '">' +
          t('Open purchase invoice', 'فتح فاتورة الشراء') +
          '</a>'
        : '';
    if (globalThis.GfpToast && typeof globalThis.GfpToast.show === 'function') {
      globalThis.GfpToast.show(
        t('Quantity updated on the products.', 'تم تحديث كمية المنتجات.'),
        'success',
        { html: cta, duration: 6000 }
      );
    } else {
      toast(t('Quantity updated on the products.', 'تم تحديث كمية المنتجات.'), 'success', cta);
    }
    await loadList();
    await loadDetail(current.id);
  });

  async function openCreatePoModal(prefill) {
    prefill = prefill || {};
    if (!canManage) return;
    if (!suppliers.length || !warehouses.length) await loadLookups();
    var ss = document.getElementById('poSupplier');
    var ws = document.getElementById('poWarehouse');
    var supplierPh = esc(t('Select supplier', 'اختار مورد'));
    var warehousePh = esc(t('Select warehouse', 'اختار مخزن'));
    ss.innerHTML =
      '<option value="">' +
      supplierPh +
      '</option>' +
      suppliers
        .filter(function (s) {
          return s.isActive !== false;
        })
        .map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
        })
        .join('');
    ws.innerHTML =
      '<option value="">' +
      warehousePh +
      '</option>' +
      warehouses
        .filter(function (w) {
          return w.isActive !== false;
        })
        .map(function (w) {
          return (
            '<option value="' +
            esc(w.id) +
            '"' +
            (w.isDefault ? ' selected' : '') +
            '>' +
            esc(w.code + ' — ' + w.name) +
            '</option>'
          );
        })
        .join('');
    if (prefill.warehouseId) ws.value = prefill.warehouseId;
    if (!ws.value) {
      var def = warehouses.find(function (w) {
        return w.isDefault && w.isActive !== false;
      });
      if (!def) {
        def = warehouses.find(function (w) {
          return w.isActive !== false;
        });
      }
      if (def) ws.value = def.id;
    }
    if (prefill.supplierId) {
      ss.value = prefill.supplierId;
    } else if (prefill.productId) {
      var prod = productById[prefill.productId];
      if (prod && prod.defaultSupplierId) {
        var match = Array.prototype.some.call(ss.options, function (opt) {
          return opt.value === prod.defaultSupplierId;
        });
        if (match) ss.value = prod.defaultSupplierId;
      }
    }
    document.getElementById('poNotes').value = '';
    document.getElementById('poHint').textContent = '';
    document.getElementById('poLines').innerHTML = '';
    hideWarehouseUi();
    addPoLineRow(prefill.productId ? { productId: prefill.productId, qtyOrdered: 1 } : undefined);
    updatePoTotalPreview();
    openModal('poModal');
  }

  document.getElementById('btnCreate').addEventListener('click', function () {
    openCreatePoModal();
  });

  document.getElementById('poSupplier').addEventListener('change', function () {
    document.querySelectorAll('#poLines .pl-product').forEach(function (sel) {
      var cur = sel.value;
      sel.innerHTML = purchasableOptionsHtml();
      if (cur) sel.value = cur;
    });
  });

  document.getElementById('btnAddLine').addEventListener('click', function () {
    addPoLineRow();
  });

  document.getElementById('poForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!canManage) return;
    var hint = document.getElementById('poHint');
    var btn = document.getElementById('btnPoSubmit');
    var lines = [];
    document.querySelectorAll('#poLines .line-row').forEach(function (row) {
      var productId = row.querySelector('.pl-product').value;
      var qtyOrdered = Number(row.querySelector('.pl-qty').value);
      var unitCost = Number(row.querySelector('.pl-cost').value);
      if (!productId || !(qtyOrdered > 0)) return;
      lines.push({ productId: productId, qtyOrdered: qtyOrdered, unitCost: unitCost });
    });
    if (!lines.length) {
      hint.textContent = t('Add at least one product.', 'ضيف منتج واحد على الأقل.');
      return;
    }
    var warehouseId = defaultWarehouseId();
    if (!warehouseId) {
      hint.textContent = t(
        'No default stock location is set yet.',
        'مفيش مكان تخزين افتراضي متظبط.'
      );
      return;
    }
    var body = {
      supplierId: document.getElementById('poSupplier').value,
      warehouseId: warehouseId,
      notes: document.getElementById('poNotes').value.trim() || null,
      lines: lines
    };
    if (btn) btn.disabled = true;
    hint.textContent = t('Saving…', 'جاري الحفظ…');
    var r = await Gfp.post(paths.purchaseOrders(), body);
    if (!r.ok || !r.data || !r.data.id) {
      if (btn) btn.disabled = false;
      hint.textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    var poId = r.data.id;
    var approved = await Gfp.post(paths.purchaseOrderApprove(poId), {});
    if (!approved.ok) {
      if (btn) btn.disabled = false;
      closeModal('poModal');
      toast(
        t('Saved as draft — approve failed: ', 'اتحفظ كمسودة — الاعتماد فشل: ') + apiError(approved),
        'err'
      );
      await loadList();
      await loadDetail(poId);
      return;
    }
    var needsExtra = lines.some(function (ln) {
      var p = productById[ln.productId];
      return p && (p.trackBatch || p.trackExpiry);
    });
    if (needsExtra) {
      if (btn) btn.disabled = false;
      closeModal('poModal');
      toast(t('Saved. Add batch/expiry, then receive.', 'اتحفظ. ضيف التشغيلة/الصلاحية وبعدين استلم.'), 'ok');
      await loadList();
      await loadDetail(poId);
      openReceiveModal();
      return;
    }
    var detail = await Gfp.get(paths.purchaseOrder(poId));
    var poLines = detail.ok && detail.data && detail.data.lines ? detail.data.lines : [];
    var recvLines = poLines
      .filter(function (l) {
        return Number(l.qtyRemaining) > 0;
      })
      .map(function (l) {
        return {
          purchaseOrderLineId: l.id,
          qty: Number(l.qtyRemaining),
          unitCost: l.unitCost
        };
      });
    if (recvLines.length) {
      var received = await Gfp.post(paths.purchaseOrderReceive(poId), { lines: recvLines });
      if (!received.ok) {
        if (btn) btn.disabled = false;
        closeModal('poModal');
        toast(
          t('Saved, but receive failed: ', 'اتحفظ، بس الاستلام فشل: ') + apiError(received),
          'err'
        );
        await loadList();
        await loadDetail(poId);
        return;
      }
    }
    if (btn) btn.disabled = false;
    closeModal('poModal');
    toast(t('Purchase saved — product quantity updated.', 'اتحفظ الشراء — كمية المنتج اتحدثت.'), 'ok');
    await loadList();
    await loadDetail(poId);
  });

  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);

  function applyBuyDeepLinkContext() {
    try {
      var params = new URLSearchParams(window.location.search);
      var from = params.get('from') || '';
      if (from !== 'on-hand' && from !== 'products') return { openCreate: false };
      var productId = params.get('productId') || '';
      var warehouseId = params.get('warehouseId') || '';
      var back =
        from === 'products'
          ? '/dashboard/inventory/products/' +
            (productId ? '?focus=' + encodeURIComponent(productId) : '')
          : '/dashboard/inventory/stock/' +
            (productId ? '?productId=' + encodeURIComponent(productId) : '');
      var backLabelEn = from === 'products' ? 'Back to Products' : 'Back to On Hand';
      var backLabelAr = from === 'products' ? 'رجوع للمنتجات' : 'رجوع للرصيد';
      var bar = document.getElementById('poContextBar');
      var backLink = document.getElementById('poBackOnHand');
      var crumb = document.getElementById('poBreadcrumb');
      if (bar) bar.hidden = false;
      if (backLink) {
        backLink.href = back;
        backLink.innerHTML =
          '<i class="ti ti-arrow-left"></i> <span data-en="' +
          backLabelEn +
          '" data-ar="' +
          backLabelAr +
          '">' +
          backLabelEn +
          '</span>';
      }
      if (crumb) {
        if (from === 'products') {
          crumb.innerHTML =
            '<span data-en="Catalog" data-ar="الكتالوج">Catalog</span><span class="sep">/</span>' +
            '<a href="' +
            back.replace(/"/g, '&quot;') +
            '" data-en="Products" data-ar="المنتجات">Products</a>' +
            '<span class="sep">/</span>' +
            '<span class="current" data-en="Buy" data-ar="شراء">Buy</span>';
        } else {
          crumb.innerHTML =
            '<span data-en="Inventory" data-ar="المخزون">Inventory</span><span class="sep">/</span>' +
            '<a href="' +
            back.replace(/"/g, '&quot;') +
            '" data-en="On Hand" data-ar="الرصيد">On Hand</a>' +
            '<span class="sep">/</span>' +
            '<span class="current" data-en="Buy" data-ar="شراء">Buy</span>';
        }
      }
      return {
        openCreate: !!productId,
        productId: productId,
        warehouseId: warehouseId,
        back: back
      };
    } catch (e) {
      return { openCreate: false };
    }
  }

  window.addEventListener('gfp:locale', function () {
    applyLocale();
    renderKpis();
    renderList(listTruncated, listTake);
    if (current) renderDetail();
  });

  (async function boot() {
    var ctx = applyBuyDeepLinkContext();
    await loadLookups();
    hideWarehouseUi();
    await loadList();
    applyLocale();
    try {
      var params = new URLSearchParams(window.location.search);
      var openId = params.get('id');
      if (openId) await loadDetail(openId);
      else if (ctx.openCreate && ctx.productId && canManage) {
        await openCreatePoModal({
          productId: ctx.productId,
          warehouseId: ctx.warehouseId
        });
      }
    } catch (e) {
      /* ignore */
    }
  })();
})();
