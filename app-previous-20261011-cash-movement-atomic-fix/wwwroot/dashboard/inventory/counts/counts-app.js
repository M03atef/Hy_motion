/**
 * Stock counts (FE-INVS-9). Requires inventory.adjust.
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

  var list = [];
  var current = null;
  var warehouses = [];

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
    draft: ['Draft', 'مسودة'],
    submitted: ['Waiting approval', 'في انتظار الموافقة'],
    approved: ['Approved', 'تمت الموافقة'],
    cancelled: ['Cancelled', 'ملغى']
  };
  function statusLabel(st) {
    var pair = STATUS_LABELS[st];
    return pair ? t(pair[0], pair[1]) : st;
  }
  function statusBadge(st) {
    var cls = 'badge-draft';
    if (st === 'submitted') cls = 'badge-submitted';
    else if (st === 'approved') cls = 'badge-approved';
    else if (st === 'cancelled') cls = 'badge-cancelled';
    return '<span class="badge ' + cls + '">' + esc(statusLabel(st)) + '</span>';
  }
  function varClass(v) {
    var n = Number(v);
    if (n > 0) return 'var-pos';
    if (n < 0) return 'var-neg';
    return '';
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

  async function loadWarehouses() {
    var r = await Gfp.get(paths.warehouses());
    warehouses = r.ok && Array.isArray(r.data) ? r.data : [];
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading…</p></div>';
    var status = document.getElementById('filterStatus').value;
    var r = await Gfp.get(paths.counts(status ? { status: status } : undefined));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    list = Array.isArray(r.data) ? r.data : [];
    renderList();
  }

  function renderList() {
    var host = document.getElementById('tableHost');
    if (!list.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No stock counts', 'لا جرد')) + '</p></div>';
      return;
    }
    host.innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('Created', 'تاريخ الإنشاء')) +
      '</th><th>' +
      esc(t('Warehouse', 'المستودع')) +
      '</th><th>' +
      esc(t('Status', 'الحالة')) +
      '</th><th>' +
      esc(t('Lines', 'البنود')) +
      '</th></tr></thead><tbody>' +
      list
        .map(function (c) {
          return (
            '<tr class="clickable" data-id="' +
            esc(c.id) +
            '"><td>' +
            esc(c.createdAtUtc ? new Date(c.createdAtUtc).toLocaleString() : '—') +
            '</td><td class="code">' +
            esc(c.warehouseCode || '—') +
            '</td><td>' +
            statusBadge(c.status) +
            '</td><td>' +
            esc((c.lines && c.lines.length) || 0) +
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

  async function loadDetail(id) {
    var host = document.getElementById('detailHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Loading…</p></div>';
    var r = await Gfp.get(paths.count(id));
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
    var c = current;
    var host = document.getElementById('detailHost');
    if (!c) {
      host.innerHTML = '<p class="muted">' + esc(t('Select a count.', 'اختار جرداً.')) + '</p>';
      return;
    }
    var draft = c.status === 'draft';
    var actions = [];
    if (draft) {
      actions.push(
        '<button type="button" class="btn-create" id="btnSaveLines">' +
          esc(t('Save counts', 'حفظ العد')) +
          '</button>'
      );
      actions.push(
        '<button type="button" class="btn-secondary" id="btnSubmit">' +
          esc(t('Submit', 'تقديم')) +
          '</button>'
      );
      actions.push(
        '<button type="button" class="btn-secondary" id="btnCancel">' +
          esc(t('Cancel', 'إلغاء')) +
          '</button>'
      );
    }
    if (c.status === 'submitted') {
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

    var lines = (c.lines || [])
      .map(function (l) {
        var countedCell = draft
          ? '<input type="number" class="count-input" data-line="' +
            esc(l.id) +
            '" step="any" value="' +
            esc(l.countedQty) +
            '">'
          : esc(l.countedQty);
        return (
          '<tr><td class="code">' +
          esc(l.productSku || '—') +
          '</td><td>' +
          esc(l.productName || '—') +
          '</td><td>' +
          esc(l.systemQty) +
          '</td><td>' +
          countedCell +
          '</td><td class="' +
          varClass(l.variance) +
          '">' +
          esc(l.variance) +
          '</td></tr>'
        );
      })
      .join('');

    host.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div><h2 style="font-family:var(--fd);font-size:18px">' +
      esc(t('Count', 'جرد')) +
      '</h2>' +
      '<div class="muted">' +
      esc(c.warehouseCode || c.warehouseName || '') +
      '</div></div>' +
      statusBadge(c.status) +
      '</div>' +
      '<div style="margin:12px 0;font-size:13px">' +
      '<div>' +
      esc(t('Warehouse', 'المستودع')) +
      ': <strong class="code">' +
      esc(c.warehouseCode || '—') +
      '</strong></div>' +
      (c.note ? '<div class="muted">' + esc(t('Note', 'ملاحظة')) + ': ' + esc(c.note) + '</div>' : '') +
      '</div>' +
      (actions.length ? '<div class="detail-actions">' + actions.join('') + '</div>' : '') +
      '<p class="form-hint" id="detailHint"></p>' +
      '<div class="table-wrap"><table class="inv"><thead><tr><th>SKU</th><th>' +
      esc(t('Name', 'الاسم')) +
      '</th><th>' +
      esc(t('System', 'النظام')) +
      '</th><th>' +
      esc(t('Counted', 'العد')) +
      '</th><th>' +
      esc(t('Variance', 'الفرق')) +
      '</th></tr></thead><tbody>' +
      (lines ||
        '<tr><td colspan="5" class="muted">' + esc(t('No lines', 'لا بنود')) + '</td></tr>') +
      '</tbody></table></div>' +
      '<p class="muted" style="margin-top:10px">' +
      esc(
        t(
          'Variance = counted − system. Zero-variance lines are fine; approve posts only nonzero differences.',
          'الفرق = المعدود − النظام. الصفر مقبول؛ الاعتماد يرحّل الفروق غير الصفر فقط.'
        )
      ) +
      '</p>';

    var btnSave = document.getElementById('btnSaveLines');
    if (btnSave) {
      btnSave.addEventListener('click', saveLines);
    }
    var btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async function () {
        var ok = await saveLines(true);
        if (!ok) return;
        await postAction(paths.countSubmit, t('Count submitted.', 'تم تقديم الجرد.'), null);
      });
    }
    var btnApprove = document.getElementById('btnApprove');
    if (btnApprove) {
      btnApprove.addEventListener('click', function () {
        postAction(
          paths.countApprove,
          t('Count approved — stock adjusted.', 'تم اعتماد الجرد — تم تعديل الرصيد.'),
          t(
            'Approve this count? If live stock drifted from the snapshot, approve will fail and you must recount.',
            'اعتماد الجرد؟ لو الرصيد الحي اختلف عن اللقطة هيفشل الاعتماد وهتحتاج إعادة جرد.'
          )
        );
      });
    }
    var btnCancel = document.getElementById('btnCancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', function () {
        postAction(
          paths.countCancel,
          t('Count cancelled.', 'تم إلغاء الجرد.'),
          t('Cancel this stock count?', 'إلغاء الجرد ده؟')
        );
      });
    }
  }

  async function saveLines(silent) {
    if (!current || current.status !== 'draft') return true;
    var lines = [];
    document.querySelectorAll('#detailHost .count-input').forEach(function (inp) {
      lines.push({
        lineId: inp.getAttribute('data-line'),
        countedQty: Number(inp.value)
      });
    });
    if (!lines.length) return true;
    var r = await Gfp.put(paths.countLines(current.id), { lines: lines });
    if (!r.ok) {
      var msg = apiError(r);
      var hint = document.getElementById('detailHint');
      if (hint) hint.textContent = msg;
      toast(msg, 'err');
      return false;
    }
    current = r.data || current;
    if (!silent) {
      toast(t('Counts saved.', 'تم حفظ العد.'), 'ok');
      renderDetail();
    } else if (r.data) {
      current = r.data;
    }
    return true;
  }

  document.getElementById('btnCreate').addEventListener('click', async function () {
    if (!warehouses.length) await loadWarehouses();
    document.getElementById('ctWarehouse').innerHTML =
      '<option value="">Select…</option>' +
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
    document.getElementById('ctNote').value = '';
    document.getElementById('ctHint').textContent = '';
    openModal('ctModal');
  });

  document.getElementById('ctForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      warehouseId: document.getElementById('ctWarehouse').value,
      note: document.getElementById('ctNote').value.trim() || null
    };
    var r = await Gfp.post(paths.counts(), body);
    if (!r.ok) {
      document.getElementById('ctHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    closeModal('ctModal');
    toast('Count created — system qty frozen.', 'ok');
    await loadList();
    if (r.data && r.data.id) await loadDetail(r.data.id);
  });

  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);

  (async function boot() {
    await loadWarehouses();
    await loadList();
  })();
})();
