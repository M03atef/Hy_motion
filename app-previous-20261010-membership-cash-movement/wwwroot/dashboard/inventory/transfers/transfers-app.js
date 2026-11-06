/**
 * Warehouse transfers (FE-INVS-8). All endpoints require inventory.transfer.
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
  if (!Authz || !Authz.useCan('inventory.transfer')) {
    window.location.href = '/dashboard/';
    return;
  }

  var list = [];
  var current = null;
  var warehouses = [];
  var products = [];

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
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || t('Request failed', 'فشل الطلب') + ' (' + r.status + ')';
  }
  function openModal(id) {
    document.getElementById(id).hidden = false;
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }
  function closeModal(id) {
    document.getElementById(id).hidden = true;
  }
  var STATUS_LABELS = {
    pending: ['Pending', 'معلّق'],
    in_transit: ['On the way', 'في الطريق'],
    completed: ['Done', 'تم'],
    cancelled: ['Cancelled', 'ملغى']
  };
  function statusLabel(st) {
    var pair = STATUS_LABELS[st];
    return pair ? t(pair[0], pair[1]) : st;
  }
  function statusBadge(st) {
    var cls = 'badge-pending';
    if (st === 'in_transit') cls = 'badge-transit';
    else if (st === 'completed') cls = 'badge-completed';
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
    var results = await Promise.all([Gfp.get(paths.warehouses()), Gfp.get(paths.products())]);
    warehouses = results[0].ok && Array.isArray(results[0].data) ? results[0].data : [];
    products = results[1].ok && Array.isArray(results[1].data) ? results[1].data : [];
  }

  function productOptionsHtml() {
    return (
      '<option value="">Product…</option>' +
      products
        .filter(function (p) {
          return !p.isArchived && p.isActive !== false && p.trackStock !== false;
        })
        .map(function (p) {
          return (
            '<option value="' +
            esc(p.id) +
            '">' +
            esc(p.sku) +
            ' — ' +
            esc(p.name) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function addLineRow() {
    var wrap = document.getElementById('trLines');
    var row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML =
      '<label>Product<select class="tl-product" required>' +
      productOptionsHtml() +
      '</select></label>' +
      '<label>Qty<input type="number" class="tl-qty" min="0.001" step="any" required value="1"></label>' +
      '<button type="button" class="btn-link tl-remove">Remove</button>';
    row.querySelector('.tl-remove').addEventListener('click', function () {
      row.remove();
    });
    wrap.appendChild(row);
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading…</p></div>';
    var status = document.getElementById('filterStatus').value;
    var r = await Gfp.get(paths.transfers(status ? { status: status } : undefined));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    list = Array.isArray(r.data) ? r.data : [];
    var trunc =
      r.headers &&
      String(r.headers.get('X-Gfp-Truncated') || r.headers.get('x-gfp-truncated') || '').toLowerCase() ===
        'true';
    var takeHdr = (r.headers && (r.headers.get('X-Gfp-Take') || r.headers.get('x-gfp-take'))) || '200';
    renderList(trunc, takeHdr);
  }

  function renderList(truncated, take) {
    var host = document.getElementById('tableHost');
    var banner = truncated
      ? '<div class="trunc-banner">' +
        esc(
          t(
            'Showing first ' + take + ' transfers. Refine by status if you need older ones.',
            'عرض أول ' + take + ' تحويل. صفّي بالحالة لو محتاج أقدم.'
          )
        ) +
        '</div>'
      : '';
    if (!list.length) {
      host.innerHTML =
        banner +
        '<div class="empty-state"><p>' +
        esc(t('No transfers', 'لا تحويلات')) +
        '</p></div>';
      return;
    }
    host.innerHTML =
      banner +
      '<table class="inv"><thead><tr><th>' +
      esc(t('Created', 'تاريخ الإنشاء')) +
      '</th><th>' +
      esc(t('From', 'من')) +
      '</th><th>' +
      esc(t('To', 'إلى')) +
      '</th><th>' +
      esc(t('Status', 'الحالة')) +
      '</th></tr></thead><tbody>' +
      list
        .map(function (row) {
          return (
            '<tr class="clickable" data-id="' +
            esc(row.id) +
            '"><td>' +
            esc(row.createdAtUtc ? new Date(row.createdAtUtc).toLocaleString() : '—') +
            '</td><td class="code">' +
            esc(row.fromWarehouseCode || '—') +
            '</td><td class="code">' +
            esc(row.toWarehouseCode || '—') +
            '</td><td>' +
            statusBadge(row.status) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
    host.querySelectorAll('[data-id]').forEach(function (trEl) {
      trEl.addEventListener('click', function () {
        loadDetail(trEl.getAttribute('data-id'));
      });
    });
  }

  async function loadDetail(id) {
    var host = document.getElementById('detailHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading…</p></div>';
    var r = await Gfp.get(paths.transfer(id));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    current = r.data;
    renderDetail();
  }

  async function postAction(pathFn, okMsg, confirmMsg) {
    if (!current) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    var r = await Gfp.post(pathFn(current.id), {});
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    toast(okMsg, 'ok');
    await loadList();
    await loadDetail(current.id);
  }

  function renderDetail() {
    var tr = current;
    var host = document.getElementById('detailHost');
    if (!tr) {
      host.innerHTML = '<p class="muted">' + esc(t('Select a transfer.', 'اختار تحويلاً.')) + '</p>';
      return;
    }
    var actions = [];
    if (tr.status === 'pending') {
      actions.push(
        '<button type="button" class="btn-create" id="btnSubmit">' +
          esc(t('Submit', 'إرسال')) +
          '</button>'
      );
      actions.push(
        '<button type="button" class="btn-secondary" id="btnCancel">' +
          esc(t('Cancel', 'إلغاء')) +
          '</button>'
      );
    }
    if (tr.status === 'in_transit') {
      actions.push(
        '<button type="button" class="btn-create" id="btnReceive">' +
          esc(t('Receive', 'استلام')) +
          '</button>'
      );
      actions.push(
        '<button type="button" class="btn-secondary" id="btnReject">' +
          esc(t('Reject', 'رفض')) +
          '</button>'
      );
    }
    var lines = (tr.lines || [])
      .map(function (l) {
        return (
          '<tr><td class="code">' +
          esc(l.productSku || '—') +
          '</td><td>' +
          esc(l.productName || '—') +
          '</td><td>' +
          esc(l.qty) +
          '</td></tr>'
        );
      })
      .join('');

    host.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div><h2 style="font-family:var(--fd);font-size:18px">' +
      esc(t('Transfer', 'تحويل')) +
      '</h2>' +
      '<div class="muted">' +
      esc((tr.fromWarehouseCode || '—') + ' → ' + (tr.toWarehouseCode || '—')) +
      '</div></div>' +
      statusBadge(tr.status) +
      '</div>' +
      '<div style="margin:12px 0;font-size:13px">' +
      '<div>' +
      esc(t('From', 'من')) +
      ': <strong class="code">' +
      esc(tr.fromWarehouseCode || '—') +
      '</strong></div>' +
      '<div>' +
      esc(t('To', 'إلى')) +
      ': <strong class="code">' +
      esc(tr.toWarehouseCode || '—') +
      '</strong></div>' +
      (tr.note ? '<div class="muted">' + esc(t('Note', 'ملاحظة')) + ': ' + esc(tr.note) + '</div>' : '') +
      '</div>' +
      (actions.length ? '<div class="detail-actions">' + actions.join('') + '</div>' : '') +
      '<div class="table-wrap"><table class="inv"><thead><tr><th>SKU</th><th>' +
      esc(t('Name', 'الاسم')) +
      '</th><th>' +
      esc(t('Qty', 'الكمية')) +
      '</th></tr></thead><tbody>' +
      (lines || '<tr><td colspan="3" class="muted">' + esc(t('No lines', 'لا بنود')) + '</td></tr>') +
      '</tbody></table></div>';

    var btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', function () {
        postAction(
          paths.transferSubmit,
          t('Submitted — in transit.', 'تم الإرسال — في الطريق.'),
          t('Submit transfer and remove stock from source?', 'إرسال التحويل وخصم الرصيد من المصدر؟')
        );
      });
    }
    var btnCancel = document.getElementById('btnCancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', function () {
        postAction(
          paths.transferCancel,
          t('Transfer cancelled.', 'تم إلغاء التحويل.'),
          t('Cancel this pending transfer?', 'إلغاء التحويل المعلّق؟')
        );
      });
    }
    var btnReceive = document.getElementById('btnReceive');
    if (btnReceive) {
      btnReceive.addEventListener('click', function () {
        postAction(
          paths.transferReceive,
          t('Received into destination.', 'تم الاستلام في الوجهة.'),
          t('Receive into destination warehouse?', 'استلام في مستودع الوجهة؟')
        );
      });
    }
    var btnReject = document.getElementById('btnReject');
    if (btnReject) {
      btnReject.addEventListener('click', function () {
        postAction(
          paths.transferReject,
          t('Rejected — returned to source.', 'مرفوض — رجع للمصدر.'),
          t('Reject and return stock to source?', 'رفض وإرجاع الرصيد للمصدر؟')
        );
      });
    }
  }

  document.getElementById('btnCreate').addEventListener('click', async function () {
    if (!warehouses.length) await loadLookups();
    var opts =
      '<option value="">' +
      esc(t('Select…', 'اختار…')) +
      '</option>' +
      warehouses
        .filter(function (w) {
          return w.isActive !== false;
        })
        .map(function (w) {
          return (
            '<option value="' + esc(w.id) + '">' + esc(w.code + ' — ' + w.name) + '</option>'
          );
        })
        .join('');
    document.getElementById('trFrom').innerHTML = opts;
    document.getElementById('trTo').innerHTML = opts;
    document.getElementById('trNote').value = '';
    document.getElementById('trHint').textContent = '';
    document.getElementById('trLines').innerHTML = '';
    addLineRow();
    openModal('trModal');
  });

  document.getElementById('btnAddLine').addEventListener('click', addLineRow);

  document.getElementById('trForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fromId = document.getElementById('trFrom').value;
    var toId = document.getElementById('trTo').value;
    if (!fromId || !toId) return;
    if (fromId === toId) {
      document.getElementById('trHint').textContent = 'From and To warehouses must differ.';
      return;
    }
    var lines = [];
    document.querySelectorAll('#trLines .line-row').forEach(function (row) {
      var productId = row.querySelector('.tl-product').value;
      var qty = Number(row.querySelector('.tl-qty').value);
      if (!productId || !(qty > 0)) return;
      lines.push({ productId: productId, qty: qty, batchId: null });
    });
    if (!lines.length) {
      document.getElementById('trHint').textContent = 'Add at least one valid line.';
      return;
    }
    var body = {
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      note: document.getElementById('trNote').value.trim() || null,
      lines: lines
    };
    var r = await Gfp.post(paths.transfers(), body);
    if (!r.ok) {
      document.getElementById('trHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    closeModal('trModal');
    toast('Transfer created (pending).', 'ok');
    await loadList();
    if (r.data && r.data.id) await loadDetail(r.data.id);
  });

  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);

  (async function boot() {
    await loadLookups();
    await loadList();
  })();
})();
