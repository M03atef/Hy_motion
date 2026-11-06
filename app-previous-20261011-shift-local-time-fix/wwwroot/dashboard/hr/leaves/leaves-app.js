/**
 * HR Phase 4 — Leaves: requests, approve/reject/cancel, balances.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var I18n = window.GfpI18n;

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

  var canView = Authz && Authz.useCan('hr.leave.view');
  var canManage = Authz && Authz.useCan('hr.leave.manage');
  var canApprove = Authz && Authz.useCan('hr.leave.approve');
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var employees = [];
  var rows = [];
  var reviewAction = null; // 'approve' | 'reject'
  var reviewId = null;

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
    var e = (r && r.error) || {};
    return e.message || t('Request failed', 'فشل الطلب');
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
  function statusLabel(s) {
    var map = { Pending: ['Pending', 'معلق'], Approved: ['Approved', 'معتمد'], Rejected: ['Rejected', 'مرفوض'], Cancelled: ['Cancelled', 'ملغي'] };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function statusClass(s) {
    if (s === 'Approved') return 'active';
    if (s === 'Rejected' || s === 'Cancelled') return 'terminated';
    return 'suspended';
  }
  function typeLabel(s) {
    var map = {
      Annual: ['Annual', 'سنوية'], Sick: ['Sick', 'مرضية'], Emergency: ['Emergency', 'طارئة'],
      Unpaid: ['Unpaid', 'بدون أجر'], Permission: ['Permission', 'إذن']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }

  (function chrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) { return w[0]; })
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
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  async function loadEmployees() {
    var r = await Gfp.get('/hr/employees?status=Active');
    employees = r.ok && Array.isArray(r.data) ? r.data : [];
    var filterSel = document.getElementById('filterEmployee');
    var rSel = document.getElementById('rEmployee');
    var bSel = document.getElementById('balanceEmployee');
    employees.forEach(function (e) {
      var name = e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')';
      filterSel.appendChild(new Option(name, e.id));
      rSel.appendChild(new Option(name, e.id));
      bSel.appendChild(new Option(name, e.id));
    });
  }

  // ── Tabs ──
  Array.prototype.forEach.call(document.querySelectorAll('#viewTabs .tab-btn'), function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('#viewTabs .tab-btn'), function (b) { b.classList.remove('act'); });
      btn.classList.add('act');
      var view = btn.getAttribute('data-view');
      document.getElementById('requestsView').hidden = view !== 'requests';
      document.getElementById('balancesView').hidden = view !== 'balances';
    });
  });

  // ── Requests list ──
  document.getElementById('filterEmployee').addEventListener('change', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);
  document.getElementById('btnRefresh').addEventListener('click', loadList);

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var params = [];
    var employeeId = document.getElementById('filterEmployee').value;
    if (employeeId) params.push('employeeId=' + encodeURIComponent(employeeId));
    var status = document.getElementById('filterStatus').value;
    if (status) params.push('status=' + encodeURIComponent(status));

    var r = await Gfp.get('/hr/leave-requests' + (params.length ? '?' + params.join('&') : ''));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    rows = Array.isArray(r.data) ? r.data : [];
    render();
  }

  function render() {
    var host = document.getElementById('tableHost');
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No leave requests yet.', 'لا توجد طلبات إجازة بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Type', 'النوع')) + '</th>' +
      '<th>' + esc(t('From', 'من')) + '</th>' +
      '<th>' + esc(t('To', 'إلى')) + '</th>' +
      '<th>' + esc(t('Duration', 'المدة')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      '<th>' + esc(t('Requested At', 'تاريخ الطلب')) + '</th>' +
      '<th></th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (l) {
      var actions = '';
      if (l.status === 'Pending' && canApprove) {
        actions += '<button type="button" class="act-btn" data-approve="' + esc(l.id) + '" title="' + esc(t('Approve', 'اعتماد')) + '"><i class="ti ti-check"></i></button>';
        actions += '<button type="button" class="act-btn danger" data-reject="' + esc(l.id) + '" title="' + esc(t('Reject', 'رفض')) + '"><i class="ti ti-x"></i></button>';
      }
      if ((l.status === 'Pending' || l.status === 'Approved') && canManage) {
        actions += '<button type="button" class="act-btn" data-cancel="' + esc(l.id) + '" title="' + esc(t('Cancel', 'إلغاء')) + '"><i class="ti ti-ban"></i></button>';
      }
      html += '<tr>' +
        '<td class="person-name">' + esc(l.employeeName) + '<div class="person-sub">' + esc(l.employeeNumber) + '</div></td>' +
        '<td>' + esc(typeLabel(l.leaveType)) + '</td>' +
        '<td>' + esc(l.startDate) + '</td>' +
        '<td>' + esc(l.endDate) + '</td>' +
        '<td>' + esc(l.durationDays) + ' ' + esc(t('day(s)', 'يوم')) + '</td>' +
        '<td><span class="status-badge ' + statusClass(l.status) + '"><span class="dot"></span>' + esc(statusLabel(l.status)) + '</span></td>' +
        '<td>' + esc(new Date(l.requestedAtUtc).toLocaleString()) + '</td>' +
        '<td><div class="act-group">' + actions + '</div></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-approve]'), function (btn) {
      btn.addEventListener('click', function () { openReview('approve', btn.getAttribute('data-approve')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-reject]'), function (btn) {
      btn.addEventListener('click', function () { openReview('reject', btn.getAttribute('data-reject')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-cancel]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/leave-requests/' + btn.getAttribute('data-cancel') + '/cancel', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Cancelled', 'تم الإلغاء'), 'ok');
        loadList();
      });
    });
    applyLocale();
  }

  // ── Create request ──
  document.getElementById('btnCreate').addEventListener('click', function () {
    document.getElementById('requestForm').reset();
    document.getElementById('requestHint').textContent = '';
    onTypeChange();
    openModal('requestModal');
  });
  document.getElementById('rType').addEventListener('change', onTypeChange);
  function onTypeChange() {
    var isPermission = document.getElementById('rType').value === 'Permission';
    document.getElementById('rDurationRow').hidden = !isPermission;
    if (isPermission) document.getElementById('rEnd').value = document.getElementById('rStart').value;
  }
  document.getElementById('rStart').addEventListener('change', function () {
    if (document.getElementById('rType').value === 'Permission') document.getElementById('rEnd').value = this.value;
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('requestForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var employeeId = document.getElementById('rEmployee').value;
    var type = document.getElementById('rType').value;
    var body = {
      leaveType: type,
      startDate: document.getElementById('rStart').value,
      endDate: document.getElementById('rEnd').value,
      reason: document.getElementById('rReason').value.trim() || null
    };
    if (type === 'Permission') body.durationDays = Number(document.getElementById('rDuration').value);
    if (!employeeId || !body.startDate || !body.endDate) {
      document.getElementById('requestHint').textContent = t('Employee and dates are required', 'الموظف والتواريخ مطلوبة');
      return;
    }
    var btn = document.getElementById('btnSaveRequest');
    btn.disabled = true;
    var r = await Gfp.post('/hr/leave-requests?employeeId=' + encodeURIComponent(employeeId), body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('requestHint').textContent = apiError(r);
      return;
    }
    closeModal('requestModal');
    toast(t('Submitted', 'تم الإرسال'), 'ok');
    loadList();
  });

  // ── Approve/Reject ──
  function openReview(action, id) {
    reviewAction = action;
    reviewId = id;
    document.getElementById('reviewModalTitle').textContent = action === 'approve' ? t('Approve leave request', 'اعتماد طلب الإجازة') : t('Reject leave request', 'رفض طلب الإجازة');
    document.getElementById('reviewNotes').value = '';
    document.getElementById('reviewHint').textContent = '';
    openModal('reviewModal');
  }

  document.getElementById('reviewForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('btnSaveReview');
    btn.disabled = true;
    var r = await Gfp.post('/hr/leave-requests/' + reviewId + '/' + reviewAction, { notes: document.getElementById('reviewNotes').value.trim() || null });
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('reviewHint').textContent = apiError(r);
      return;
    }
    closeModal('reviewModal');
    toast(reviewAction === 'approve' ? t('Approved', 'تم الاعتماد') : t('Rejected', 'تم الرفض'), 'ok');
    loadList();
  });

  // ── Balances ──
  document.getElementById('balanceEmployee').addEventListener('change', loadBalance);
  document.getElementById('balanceYear').addEventListener('change', loadBalance);
  document.getElementById('balanceYear').value = new Date().getFullYear();

  async function loadBalance() {
    var employeeId = document.getElementById('balanceEmployee').value;
    var host = document.getElementById('balanceHost');
    if (!employeeId) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('Select an employee to view their leave balance.', 'اختر موظفاً لعرض رصيد إجازاته.')) + '</p></div>';
      return;
    }
    host.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    var year = document.getElementById('balanceYear').value;
    var r = await Gfp.get('/hr/leave-balances/' + employeeId + (year ? '?year=' + year : ''));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var balances = Array.isArray(r.data) ? r.data : [];
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Leave type', 'نوع الإجازة')) + '</th>' +
      '<th>' + esc(t('Entitled', 'المستحق')) + '</th>' +
      '<th>' + esc(t('Used', 'المستخدم')) + '</th>' +
      '<th>' + esc(t('Remaining', 'المتبقي')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    balances.forEach(function (b) {
      html += '<tr>' +
        '<td>' + esc(typeLabel(b.leaveType)) + '</td>' +
        '<td>' + esc(b.entitledDays) + '</td>' +
        '<td>' + esc(b.usedDays) + '</td>' +
        '<td>' + esc(b.remainingDays) + '</td>' +
        (canManage ? '<td><button type="button" class="act-btn" data-set-entitlement="' + esc(b.leaveType) + '" title="' + esc(t('Edit', 'تعديل')) + '"><i class="ti ti-pencil"></i></button></td>' : '') +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-set-entitlement]'), function (btn) {
      btn.addEventListener('click', async function () {
        var leaveType = btn.getAttribute('data-set-entitlement');
        var current = balances.filter(function (b) { return b.leaveType === leaveType; })[0];
        var next = window.prompt(t('New entitlement (days)', 'الاستحقاق الجديد (أيام)'), current ? current.entitledDays : '0');
        if (next == null) return;
        var r2 = await Gfp.put('/hr/leave-balances/' + employeeId + '/' + leaveType + '/' + year, { entitledDays: Number(next) });
        if (!r2.ok) { toast(apiError(r2), 'err'); return; }
        toast(t('Saved', 'تم الحفظ'), 'ok');
        loadBalance();
      });
    });
    applyLocale();
  }

  function applyInitialFiltersFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var status = params.get('status');
    if (status) document.getElementById('filterStatus').value = status;
  }

  (async function init() {
    applyInitialFiltersFromQuery();
    await loadEmployees();
    await loadList();
  })();
})();
