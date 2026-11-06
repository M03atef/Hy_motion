/**
 * Fix quantities (FE-INVS-4 + G4). Ops reasons first; cost hidden unless manage/purchase/financial.
 * Batch picker from product stock breakdown for tracked SKUs.
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
  if (!Authz || !Authz.useCan('inventory.adjust')) {
    window.location.href = '/dashboard/';
    return;
  }

  var canSeeCost =
    Authz.useCan('inventory.manage') ||
    Authz.useCan('inventory.purchase') ||
    Authz.useCan('reports.financial.view');

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  var products = [];
  var current = null;
  var batchCache = {};

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (!r) return 'Request failed';
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || ('Request failed (' + r.status + ')');
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

  var REASON_LABELS = {
    opening: { en: 'Opening stock', ar: 'رصيد افتتاحي' },
    damage: { en: 'Damage', ar: 'تالف' },
    lost: { en: 'Lost / theft', ar: 'فاقد / سرقة' },
    expired: { en: 'Expired write-off', ar: 'شطب منتهي' },
    manual_count: { en: 'Count correction', ar: 'تصحيح جرد' },
    internal_use: { en: 'Internal use', ar: 'استخدام داخلي' },
    employee: { en: 'Employee use', ar: 'استخدام موظف' },
    supplier_correction: { en: 'Supplier correction', ar: 'تصحيح مورد' },
    other: { en: 'Other (note required)', ar: 'أخرى (ملاحظة مطلوبة)' }
  };
  var STATUS_LABELS = {
    draft: 'مسودة / Draft',
    posted: 'مؤكد / Posted',
    cancelled: 'ملغي / Cancelled'
  };
  var DECREASE_REASONS = {
    damage: 1,
    lost: 1,
    expired: 1,
    internal_use: 1,
    employee: 1
  };

  function reasonLabel(code) {
    var r = REASON_LABELS[code];
    if (!r) return code || '';
    return t(r.en, r.ar);
  }

  function formatWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function loadRecent() {
    var host = document.getElementById('recentHost');
    host.innerHTML = '<div style="font-size:13px;color:var(--ltt)">' + esc(t('Loading…', 'جاري التحميل…')) + '</div>';
    var r = await Gfp.get(paths.adjustments({ take: 30 }));
    if (!r.ok) {
      host.innerHTML = '<div style="font-size:13px;color:var(--dng500)">' + esc(apiError(r)) + '</div>';
      return;
    }
    var arr = Array.isArray(r.data) ? r.data : [];
    if (!arr.length) {
      host.innerHTML =
        '<div style="font-size:13px;color:var(--ltt)">' +
        esc(t('No adjustments yet — create a draft on the left.', 'لا توجد تسويات بعد — أنشئ مسودة من اليسار.')) +
        '</div>';
      return;
    }
    host.innerHTML = arr
      .map(function (item) {
        var title = reasonLabel(item.reasonCode);
        var status = STATUS_LABELS[item.status] || item.status || '';
        var wh = item.warehouseName || item.warehouseCode || '';
        var impact =
          canSeeCost && item.estimatedValueImpactEgp != null
            ? ' · ' + Number(item.estimatedValueImpactEgp).toFixed(2) + ' EGP'
            : '';
        var meta = [status, wh, formatWhen(item.postedAtUtc || item.createdAtUtc)]
          .filter(Boolean)
          .join(' · ');
        return (
          '<div class="recent-item">' +
          '<div class="recent-item-main">' +
          '<div class="recent-item-title">' +
          esc(title) +
          impact +
          '</div>' +
          (meta ? '<div class="recent-item-meta">' + esc(meta) + '</div>' : '') +
          '</div>' +
          '<button type="button" class="btn-link" data-rid="' +
          esc(item.id) +
          '">' +
          esc(t('Open', 'فتح')) +
          '</button></div>'
        );
      })
      .join('');
    host.querySelectorAll('[data-rid]').forEach(function (b) {
      b.addEventListener('click', function () {
        loadDetail(b.getAttribute('data-rid'));
      });
    });
  }

  function productOptionsHtml() {
    return (
      '<option value="">' +
      esc(t('Product…', 'اختر منتج…')) +
      '</option>' +
      products
        .map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.name + ' (' + p.sku + ')') + '</option>';
        })
        .join('')
    );
  }

  async function ensureBatches(productId) {
    if (!productId) return [];
    if (batchCache[productId]) return batchCache[productId];
    var r = await Gfp.get(paths.productStock(productId));
    var list = r.ok && r.data && Array.isArray(r.data.batches) ? r.data.batches : [];
    batchCache[productId] = list;
    return list;
  }

  function fillBatchSelect(row, batches, warehouseId, preferExpired) {
    var sel = row.querySelector('.ln-batch');
    if (!sel) return;
    var filtered = (batches || []).filter(function (b) {
      return !warehouseId || b.warehouseId === warehouseId;
    });
    if (preferExpired) {
      filtered = filtered.filter(function (b) {
        return b.isExpired && b.batchId;
      });
    } else {
      filtered = filtered.filter(function (b) {
        return b.batchId && Number(b.qtyOnHand) > 0;
      });
    }
    sel.innerHTML =
      '<option value="">' +
      esc(t('Batch (optional/required)', 'التشغيلة')) +
      '</option>' +
      filtered
        .map(function (b) {
          var label =
            (b.batchNumber || String(b.batchId).slice(0, 8)) +
            ' · ' +
            b.qtyOnHand +
            (b.expiresOn ? ' · ' + b.expiresOn : '') +
            (b.isExpired ? ' · EXP' : '');
          return '<option value="' + esc(b.batchId) + '">' + esc(label) + '</option>';
        })
        .join('');
  }

  function bindLineRow(row) {
    var prod = row.querySelector('.ln-product');
    prod.addEventListener('change', async function () {
      var p = products.find(function (x) {
        return x.id === prod.value;
      });
      var needBatch = p && (p.trackBatch || p.trackExpiry);
      var batchWrap = row.querySelector('.ln-batch-wrap');
      if (batchWrap) batchWrap.hidden = !needBatch;
      if (!needBatch) return;
      var reason = document.getElementById('aReason').value;
      var batches = await ensureBatches(prod.value);
      fillBatchSelect(
        row,
        batches,
        document.getElementById('aWarehouse').value,
        reason === 'expired'
      );
    });
  }

  function addLineRow(prefill) {
    prefill = prefill || {};
    var host = document.getElementById('linesHost');
    var row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML =
      '<select class="ln-product">' +
      productOptionsHtml() +
      '</select>' +
      '<input class="ln-qty" type="number" step="0.001" placeholder="' +
      esc(t('Qty ±', 'الكمية ±')) +
      '" value="' +
      (prefill.qtyDelta != null ? esc(prefill.qtyDelta) : '') +
      '">' +
      '<span class="ln-batch-wrap" hidden><select class="ln-batch"></select></span>' +
      (canSeeCost
        ? '<input class="ln-cost" type="number" step="0.01" min="0" placeholder="' +
          esc(t('Cost EGP', 'تكلفة')) +
          '">'
        : '') +
      '<button type="button" class="btn-icon" title="' +
      esc(t('Remove', 'حذف')) +
      '"><i class="ti ti-x"></i></button>';
    if (prefill.productId) row.querySelector('.ln-product').value = prefill.productId;
    if (canSeeCost && prefill.unitCost != null) row.querySelector('.ln-cost').value = prefill.unitCost;
    row.querySelector('.btn-icon').addEventListener('click', function () {
      row.remove();
    });
    bindLineRow(row);
    host.appendChild(row);
    if (prefill.productId) row.querySelector('.ln-product').dispatchEvent(new Event('change'));
  }

  async function bootLookups() {
    var [wr, pr] = await Promise.all([Gfp.get(paths.warehouses()), Gfp.get(paths.products())]);
    var wh = document.getElementById('aWarehouse');
    wh.innerHTML = '';
    if (wr.ok && Array.isArray(wr.data)) {
      wr.data.forEach(function (w) {
        wh.appendChild(
          new Option(w.name + (w.isDefault ? ' ★' : '') + ' — ' + w.code, w.id)
        );
      });
      var def = wr.data.find(function (w) {
        return w.isDefault;
      });
      if (def) wh.value = def.id;
    }
    products = pr.ok && Array.isArray(pr.data)
      ? pr.data.filter(function (p) {
          return p.trackStock && !p.isArchived;
        })
      : [];
    document.getElementById('linesHost').innerHTML = '';
    var params = new URLSearchParams(window.location.search);
    var prefillPid = params.get('productId') || '';
    var prefillWh = params.get('warehouseId') || '';
    var fromOnHand = params.get('from') === 'on-hand';
    if (fromOnHand) {
      var back =
        '/dashboard/inventory/stock/' +
        (prefillPid ? '?productId=' + encodeURIComponent(prefillPid) : '');
      var bar = document.getElementById('adjContextBar');
      var backLink = document.getElementById('adjBackOnHand');
      var crumb = document.getElementById('adjBreadcrumb');
      if (bar) bar.hidden = false;
      if (backLink) backLink.href = back;
      if (crumb) {
        crumb.innerHTML =
          '<span data-en="Inventory" data-ar="المخزون">Inventory</span><span class="sep">/</span>' +
          '<a href="' +
          back.replace(/"/g, '&quot;') +
          '" data-en="On Hand" data-ar="الرصيد">On Hand</a>' +
          '<span class="sep">/</span>' +
          '<span class="current" data-en="Adjust quantity" data-ar="تعديل الكمية">Adjust quantity</span>';
      }
      window.__gfpAdjReturnTo = back;
    }
    if (prefillWh) {
      var whEl = document.getElementById('aWarehouse');
      if (whEl) whEl.value = prefillWh;
    }
    if (prefillPid) addLineRow({ productId: prefillPid });
    else addLineRow();
    loadRecent();

    var qid = params.get('id');
    if (qid) loadDetail(qid);
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }

  document.getElementById('btnAddLine').addEventListener('click', function () {
    addLineRow();
  });
  document.getElementById('aWarehouse').addEventListener('change', function () {
    document.querySelectorAll('#linesHost .line-row .ln-product').forEach(function (sel) {
      if (sel.value) sel.dispatchEvent(new Event('change'));
    });
  });
  document.getElementById('aReason').addEventListener('change', function () {
    document.querySelectorAll('#linesHost .line-row .ln-product').forEach(function (sel) {
      if (sel.value) sel.dispatchEvent(new Event('change'));
    });
  });

  document.getElementById('createForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var hint = document.getElementById('createHint');
    var reason = document.getElementById('aReason').value;
    var note = document.getElementById('aNote').value.trim();
    if (reason === 'other' && !note) {
      hint.textContent = t('Note is required for Other.', 'الملاحظة مطلوبة لسبب أخرى.');
      return;
    }
    var lines = [];
    var bad = null;
    document.querySelectorAll('#linesHost .line-row').forEach(function (row) {
      var productId = row.querySelector('.ln-product').value;
      var qty = Number(row.querySelector('.ln-qty').value);
      var costEl = row.querySelector('.ln-cost');
      var costRaw = costEl ? costEl.value.trim() : '';
      var batchEl = row.querySelector('.ln-batch');
      var batchId = batchEl && batchEl.value ? batchEl.value : null;
      var p = products.find(function (x) {
        return x.id === productId;
      });
      if (!productId) {
        bad = t('Each line needs a product.', 'كل سطر يحتاج منتج.');
        return;
      }
      if (Number.isNaN(qty) || qty === 0) {
        bad = t('Qty cannot be zero.', 'الكمية لا تكون صفر.');
        return;
      }
      if (reason === 'opening' && qty <= 0) {
        bad = t('Opening qty must be positive.', 'الرصيد الافتتاحي لازم كمية موجبة.');
        return;
      }
      if (DECREASE_REASONS[reason] && qty > 0) {
        bad = t('This reason needs a negative qty (write-off).', 'هذا السبب يحتاج كمية سالبة.');
        return;
      }
      if ((reason === 'expired' || ((p.trackBatch || p.trackExpiry) && qty < 0)) && !batchId) {
        bad = t('Select a batch for this line.', 'اختار تشغيلة لهذا السطر.');
        return;
      }
      var line = { productId: productId, qtyDelta: qty };
      if (costRaw !== '') line.unitCost = Number(costRaw);
      if (batchId) line.batchId = batchId;
      lines.push(line);
    });
    if (bad) {
      hint.textContent = bad;
      return;
    }
    if (!lines.length) {
      hint.textContent = t('Add at least one item.', 'أضف صنفاً واحداً على الأقل.');
      return;
    }
    hint.textContent = '';
    var body = {
      warehouseId: document.getElementById('aWarehouse').value,
      reasonCode: reason,
      note: note || null,
      lines: lines
    };
    var btn = document.getElementById('btnCreate');
    btn.disabled = true;
    var r = await Gfp.post(paths.adjustments(), body);
    btn.disabled = false;
    if (!r.ok) {
      hint.textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    toast(t('Draft saved', 'تم حفظ المسودة'), 'ok');
    await loadRecent();
    await loadDetail(r.data.id);
  });

  async function loadDetail(id) {
    if (!id) return;
    document.getElementById('openId').value = id;
    var host = document.getElementById('detailHost');
    host.hidden = false;
    host.innerHTML = '<p style="color:var(--ltt)">' + esc(t('Loading…', 'جاري التحميل…')) + '</p>';
    var r = await Gfp.get(paths.adjustment(id));
    if (!r.ok) {
      host.innerHTML = '<p class="form-hint">' + esc(apiError(r)) + '</p>';
      toast(apiError(r), 'err');
      return;
    }
    current = r.data;
    renderDetail();
  }

  function statusBadge(s) {
    var cls =
      s === 'posted' ? 'badge-posted' : s === 'cancelled' ? 'badge-cancelled' : 'badge-draft';
    return '<span class="badge ' + cls + '">' + esc(STATUS_LABELS[s] || s) + '</span>';
  }

  function renderDetail() {
    var a = current;
    var host = document.getElementById('detailHost');
    if (!a) {
      host.hidden = true;
      return;
    }
    var lines = (a.lines || [])
      .map(function (l) {
        var batch =
          l.batchNumber || l.batchId
            ? esc(l.batchNumber || String(l.batchId).slice(0, 8)) +
              (l.expiresOn ? ' · ' + esc(l.expiresOn) : '')
            : '—';
        return (
          '<tr><td>' +
          esc(l.productSku || l.productId) +
          '</td><td>' +
          esc(l.productName || '') +
          '</td><td>' +
          esc(l.qtyDelta) +
          '</td><td>' +
          batch +
          '</td><td>' +
          (canSeeCost && l.unitCost != null ? esc(l.unitCost) + ' EGP' : '—') +
          '</td></tr>'
        );
      })
      .join('');

    var impact =
      canSeeCost && a.estimatedValueImpactEgp != null
        ? '<p class="form-hint">' +
          esc(t('Estimated value impact', 'أثر القيمة التقديري')) +
          ': <strong>' +
          esc(Number(a.estimatedValueImpactEgp).toFixed(2)) +
          ' EGP</strong></p>'
        : '';

    var actions = '';
    if (a.status === 'draft') {
      actions =
        '<div class="detail-actions">' +
        '<button type="button" class="btn-create" id="btnPost">' +
        esc(t('Confirm & post', 'تأكيد وترحيل')) +
        '</button>' +
        '<button type="button" class="btn-secondary" id="btnCancelAdj">' +
        esc(t('Cancel draft', 'إلغاء المسودة')) +
        '</button>' +
        '</div>';
    }

    host.innerHTML =
      '<div><strong>' +
      esc(a.warehouseName || a.warehouseCode || a.warehouseId) +
      '</strong> · ' +
      statusBadge(a.status) +
      ' · ' +
      esc(reasonLabel(a.reasonCode)) +
      '</div>' +
      (a.note ? '<p style="font-size:13px;color:var(--lts);margin-top:6px">' + esc(a.note) + '</p>' : '') +
      impact +
      '<table class="inv"><thead><tr><th>SKU</th><th>' +
      esc(t('Name', 'الاسم')) +
      '</th><th>' +
      esc(t('Qty', 'الكمية')) +
      '</th><th>' +
      esc(t('Batch', 'التشغيلة')) +
      '</th><th>' +
      esc(t('Cost', 'التكلفة')) +
      '</th></tr></thead><tbody>' +
      lines +
      '</tbody></table>' +
      actions;

    var postBtn = document.getElementById('btnPost');
    if (postBtn) {
      postBtn.addEventListener('click', async function () {
        var msg =
          t(
            'Post this adjustment to the stock ledger? This cannot be undone from the UI.',
            'ترحيل التسوية لدفتر المخزون؟ مش هينفع ترجعها من الشاشة.'
          ) +
          (canSeeCost && a.estimatedValueImpactEgp != null
            ? '\n\n' + t('Value impact', 'أثر القيمة') + ': ' + Number(a.estimatedValueImpactEgp).toFixed(2) + ' EGP'
            : '');
        if (!confirm(msg)) return;
        postBtn.disabled = true;
        var r = await Gfp.post(paths.adjustmentPost(a.id), {});
        postBtn.disabled = false;
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Posted', 'تم التأكيد'), 'ok');
        current = r.data;
        renderDetail();
        loadRecent();
        if (window.__gfpAdjReturnTo) {
          setTimeout(function () {
            location.href = window.__gfpAdjReturnTo;
          }, 600);
        }
      });
    }
    var cancelBtn = document.getElementById('btnCancelAdj');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async function () {
        if (!confirm(t('Cancel this draft?', 'إلغاء هذه المسودة؟'))) return;
        var r = await Gfp.post(paths.adjustmentCancel(a.id), {});
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Cancelled', 'تم الإلغاء'), 'ok');
        current = r.data;
        renderDetail();
        loadRecent();
      });
    }
  }

  document.getElementById('btnOpen').addEventListener('click', function () {
    loadDetail(document.getElementById('openId').value.trim());
  });

  bootLookups();
})();
