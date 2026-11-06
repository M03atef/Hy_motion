(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var page = 1;
  var pageSize = 25;
  var totalPages = 1;

  function t(en, ar) {
    if (window.GfpI18n && window.GfpI18n.t) return window.GfpI18n.t(en, ar);
    var loc = (window.GfpI18n && window.GfpI18n.getLocale && window.GfpI18n.getLocale()) || 'en';
    return loc === 'ar' ? ar : en;
  }

  function toast(msg, type) {
    if (globalThis.toastShared) return globalThis.toastShared(msg, type || 'success');
  }

  function apiErr(r) {
    if (window.GfpI18n && window.GfpI18n.displayApiError) return window.GfpI18n.displayApiError(r) || 'Request failed';
    return (r && r.error && r.error.message) || 'Request failed';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (_) {
      return null;
    }
  }

  var user = getUser();
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }
  if (Authz && !Authz.useCan('members.view')) {
    window.location.href = '/dashboard/';
    return;
  }

  var canCreate = Authz ? Authz.useCan('members.create') : false;
  document.getElementById('userAvatar').textContent = (user.fullName || 'U')
    .split(' ')
    .map(function (w) { return w[0]; })
    .join('')
    .substring(0, 2)
    .toUpperCase();
  document.getElementById('userName').textContent = user.fullName || 'User';
  document.getElementById('userRole').textContent = user.role || 'Staff';
  document.getElementById('btnLogout').addEventListener('click', function () {
    if (Gfp) Gfp.logout();
    else window.location.href = '/auth/login/';
  });

  var btnBulk = document.getElementById('btnBulkCreate');
  if (btnBulk && canCreate) btnBulk.hidden = false;

  async function loadInventory() {
    if (!Gfp) return;
    var r = await Gfp.get('/access-cards/inventory');
    if (!r || !r.ok) return;
    var d = r.data || {};
    document.getElementById('stTotal').textContent = d.total != null ? d.total : '—';
    document.getElementById('stAvailable').textContent = d.available != null ? d.available : '—';
    document.getElementById('stAssigned').textContent = d.assigned != null ? d.assigned : '—';
    document.getElementById('stLost').textContent = d.lost != null ? d.lost : '—';
    document.getElementById('stDamaged').textContent = d.damaged != null ? d.damaged : '—';
    document.getElementById('stBlocked').textContent = d.blocked != null ? d.blocked : '—';
    document.getElementById('acLowStock').hidden = !d.lowStock;
  }

  async function loadList() {
    if (!Gfp) return;
    var status = document.getElementById('filterStatus').value;
    var search = document.getElementById('searchQ').value.trim();
    var qs = '?page=' + page + '&pageSize=' + pageSize;
    if (status) qs += '&status=' + encodeURIComponent(status);
    if (search) qs += '&search=' + encodeURIComponent(search);
    var r = await Gfp.get('/access-cards' + qs);
    var body = document.getElementById('acBody');
    if (!r || !r.ok) {
      body.innerHTML = '<tr><td colspan="5" class="ac-empty">' + esc(apiErr(r)) + '</td></tr>';
      return;
    }
    var data = r.data || {};
    var items = data.items || data.Items || [];
    totalPages = Math.max(1, Math.ceil((data.totalCount || data.TotalCount || 0) / pageSize));
    document.getElementById('acPager').hidden = totalPages <= 1;
    document.getElementById('acPageLabel').textContent = page + ' / ' + totalPages;
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" class="ac-empty">' +
        t('No cards', 'لا توجد كارنيهات') + '</td></tr>';
      return;
    }
    body.innerHTML = items.map(function (c) {
      var member = c.memberNumber
        ? ('#' + esc(c.memberNumber) + (c.memberName ? ' · ' + esc(c.memberName) : ''))
        : '—';
      var assigned = c.assignedAtUtc
        ? new Date(c.assignedAtUtc).toLocaleDateString()
        : '—';
      return '<tr>' +
        '<td><code>' + esc(c.code) + '</code></td>' +
        '<td><span class="ac-pill ' + esc(c.status) + '">' + esc(c.status) + '</span></td>' +
        '<td>' + member + '</td>' +
        '<td>' + assigned + '</td>' +
        '<td>' + (c.batchId ? esc(String(c.batchId).slice(0, 8)) : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  async function refresh() {
    await loadInventory();
    await loadList();
  }

  document.getElementById('btnRefresh').addEventListener('click', refresh);
  document.getElementById('filterStatus').addEventListener('change', function () {
    page = 1;
    loadList();
  });
  var searchTimer = null;
  document.getElementById('searchQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      page = 1;
      loadList();
    }, 280);
  });
  document.getElementById('btnPrev').addEventListener('click', function () {
    if (page > 1) { page--; loadList(); }
  });
  document.getElementById('btnNext').addEventListener('click', function () {
    if (page < totalPages) { page++; loadList(); }
  });

  var modal = document.getElementById('bulkModal');
  function openBulk() { if (modal) modal.hidden = false; }
  function closeBulk() { if (modal) modal.hidden = true; }
  if (btnBulk) btnBulk.addEventListener('click', openBulk);
  document.getElementById('btnBulkClose').addEventListener('click', closeBulk);
  document.getElementById('btnBulkCancel').addEventListener('click', closeBulk);
  document.getElementById('btnBulkSave').addEventListener('click', async function () {
    if (!Gfp) return;
    var prefix = document.getElementById('bulkPrefix').value.trim() || 'CARD';
    var start = parseInt(document.getElementById('bulkStart').value, 10) || 1;
    var qty = parseInt(document.getElementById('bulkQty').value, 10) || 0;
    var r = await Gfp.post('/access-cards/bulk', {
      prefix: prefix,
      startNumber: start,
      quantity: qty
    });
    if (!r || !r.ok) {
      toast(apiErr(r) || t('Create failed', 'فشل الإنشاء'), 'error');
      return;
    }
    toast(t('Created ' + (r.data && r.data.created) + ' cards', 'تم إنشاء ' + (r.data && r.data.created) + ' كارنيه'));
    closeBulk();
    page = 1;
    await refresh();
    var batchId = r.data && (r.data.batchId || r.data.BatchId);
    if (batchId && confirm(t(
      'Open gym-branded print preview for this batch?',
      'فتح معاينة الطباعة بهوية الصالة لهذه الدفعة؟'
    ))) {
      openPrintPreview({ batchId: batchId, status: 'Available', limit: qty || 100 });
    }
  });

  var printModal = document.getElementById('printModal');
  function openPrintModal() {
    if (printModal) printModal.hidden = false;
  }
  function closePrintModal() {
    if (printModal) printModal.hidden = true;
  }
  document.getElementById('btnPrintBatch').addEventListener('click', openPrintModal);
  document.getElementById('btnPrintClose').addEventListener('click', closePrintModal);
  document.getElementById('btnPrintCancel').addEventListener('click', closePrintModal);

  function accessApiBase() {
    if (Gfp && typeof Gfp.apiBase === 'function') return String(Gfp.apiBase()).replace(/\/$/, '');
    return String(window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
  }

  function openPrintPreview(opts) {
    opts = opts || {};
    var batchId = opts.batchId != null ? opts.batchId : (document.getElementById('printBatchId').value || '').trim();
    var status = opts.status != null ? opts.status : document.getElementById('printStatus').value;
    var limit = opts.limit != null ? opts.limit : (parseInt(document.getElementById('printLimit').value, 10) || 100);
    var qs = '?limit=' + encodeURIComponent(limit);
    if (batchId) qs += '&batchId=' + encodeURIComponent(batchId);
    if (status) qs += '&status=' + encodeURIComponent(status);
    var url = accessApiBase() + '/access-cards/print-html' + qs;
    var token = localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
    // fetch HTML with auth then open blob window (print preview)
    fetch(url, {
      headers: {
        Authorization: token ? ('Bearer ' + token) : '',
        Accept: 'text/html',
        'ngrok-skip-browser-warning': 'true'
      }
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/auth/login/';
        return null;
      }
      return res.text().then(function (text) {
        return { ok: res.ok, status: res.status, text: text };
      });
    }).then(function (r) {
      if (!r) return;
      if (!r.ok) {
        toast(r.text || t('Could not load print preview', 'تعذر تحميل معاينة الطباعة'), 'error');
        return;
      }
      var w = window.open('', '_blank');
      if (!w) {
        toast(t('Allow pop-ups to preview cards', 'اسمح بالنوافذ المنبثقة لمعاينة الكارنيهات'), 'error');
        return;
      }
      w.document.open();
      w.document.write(r.text);
      w.document.close();
      closePrintModal();
    }).catch(function () {
      toast(t('Network error', 'خطأ شبكة'), 'error');
    });
  }

  document.getElementById('btnPrintOpen').addEventListener('click', function () {
    openPrintPreview();
  });

  refresh();
})();
