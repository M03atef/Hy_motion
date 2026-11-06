/**
 * HR Phase 5 — Payroll Lite: periods, calculation, adjustments, approve/close.
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

  var canView = Authz && Authz.useCan('hr.payroll.view');
  var canManage = Authz && Authz.useCan('hr.payroll.manage');
  var canApprove = Authz && Authz.useCan('hr.payroll.approve');
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var periods = [];
  var employees = [];
  var drawerPeriodId = null;
  var adjustPeriodId = null;

  var MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(n));
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
    var map = { Draft: ['Draft', 'مسودة'], Calculated: ['Calculated', 'محسوب'], Approved: ['Approved', 'معتمد'], Closed: ['Closed', 'مغلق'] };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function statusClass(s) {
    if (s === 'Closed') return 'terminated';
    if (s === 'Approved') return 'active';
    if (s === 'Calculated') return 'suspended';
    return 'suspended';
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
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var r = await Gfp.get('/hr/payroll-periods');
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    periods = Array.isArray(r.data) ? r.data : [];
    render();
  }

  function render() {
    var host = document.getElementById('tableHost');
    if (!periods.length) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No payroll periods yet.', 'لا توجد فترات رواتب بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Period', 'الفترة')) + '</th>' +
      '<th>' + esc(t('Employees', 'الموظفون')) + '</th>' +
      '<th>' + esc(t('Gross', 'الإجمالي')) + '</th>' +
      '<th>' + esc(t('Deductions', 'الخصومات')) + '</th>' +
      '<th>' + esc(t('Net', 'الصافي')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      '<th></th>' +
      '</tr></thead><tbody>';
    periods.forEach(function (p) {
      var actions = '<button type="button" class="act-btn" data-view="' + esc(p.id) + '" title="' + esc(t('View', 'عرض')) + '"><i class="ti ti-eye"></i></button>';
      if ((p.status === 'Draft' || p.status === 'Calculated') && canManage)
        actions += '<button type="button" class="act-btn" data-calc="' + esc(p.id) + '" title="' + esc(t('Calculate', 'حساب')) + '"><i class="ti ti-calculator"></i></button>';
      if (p.status === 'Calculated' && canApprove)
        actions += '<button type="button" class="act-btn" data-approve="' + esc(p.id) + '" title="' + esc(t('Approve', 'اعتماد')) + '"><i class="ti ti-check"></i></button>';
      if (p.status === 'Approved' && canApprove)
        actions += '<button type="button" class="act-btn" data-close="' + esc(p.id) + '" title="' + esc(t('Close', 'إغلاق')) + '"><i class="ti ti-lock"></i></button>';

      html += '<tr>' +
        '<td class="person-name">' + esc(t(MONTH_NAMES[p.month], MONTH_NAMES[p.month])) + ' ' + esc(p.year) + '</td>' +
        '<td>' + esc(p.employeeCount) + '</td>' +
        '<td>' + esc(money(p.grossTotal)) + '</td>' +
        '<td>' + esc(money(p.deductionsTotal)) + '</td>' +
        '<td><strong>' + esc(money(p.netTotal)) + '</strong></td>' +
        '<td><span class="status-badge ' + statusClass(p.status) + '"><span class="dot"></span>' + esc(statusLabel(p.status)) + '</span></td>' +
        '<td><div class="act-group">' + actions + '</div></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;

    Array.prototype.forEach.call(host.querySelectorAll('[data-view]'), function (btn) {
      btn.addEventListener('click', function () { openDrawer(btn.getAttribute('data-view')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-calc]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/payroll-periods/' + btn.getAttribute('data-calc') + '/calculate', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Calculated', 'تم الحساب'), 'ok');
        loadList();
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-approve]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/payroll-periods/' + btn.getAttribute('data-approve') + '/approve', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Approved', 'تم الاعتماد'), 'ok');
        loadList();
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-close]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/payroll-periods/' + btn.getAttribute('data-close') + '/close', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Closed', 'تم الإغلاق'), 'ok');
        loadList();
      });
    });
    applyLocale();
  }

  // ── Create period ──
  document.getElementById('btnCreate').addEventListener('click', function () {
    document.getElementById('periodForm').reset();
    document.getElementById('pYear').value = new Date().getFullYear();
    document.getElementById('periodHint').textContent = '';
    openModal('periodModal');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });
  document.getElementById('periodForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = { year: Number(document.getElementById('pYear').value), month: Number(document.getElementById('pMonth').value) };
    var btn = document.getElementById('btnSavePeriod');
    btn.disabled = true;
    var r = await Gfp.post('/hr/payroll-periods', body);
    btn.disabled = false;
    if (!r.ok) { document.getElementById('periodHint').textContent = apiError(r); return; }
    closeModal('periodModal');
    toast(t('Created', 'تم الإنشاء'), 'ok');
    loadList();
  });

  // ── Drawer: lines + adjustments ──
  async function openDrawer(periodId) {
    drawerPeriodId = periodId;
    document.getElementById('drawerOverlay').hidden = false;
    document.getElementById('drawerContent').innerHTML = '<div class="drawer-body"><div class="loading-state"><div class="loader"></div></div></div>';

    var period = periods.filter(function (p) { return p.id === periodId; })[0];
    var linesR = await Gfp.get('/hr/payroll-periods/' + periodId + '/lines');
    var adjR = await Gfp.get('/hr/payroll-periods/' + periodId + '/adjustments');
    renderDrawer(period, linesR.ok ? linesR.data : [], adjR.ok ? adjR.data : []);
  }

  function renderDrawer(period, lines, adjustments) {
    var canEditPeriod = canManage && period && (period.status === 'Draft' || period.status === 'Calculated');
    var linesHtml = lines.length
      ? '<div style="overflow-x:auto"><table><thead><tr><th>' + esc(t('Employee', 'الموظف')) + '</th><th>' + esc(t('Basic', 'الأساسي')) + '</th><th>' + esc(t('Overtime', 'إضافي')) + '</th><th>' + esc(t('Bonus', 'مكافأة')) + '</th><th>' + esc(t('Allowance', 'بدل')) + '</th><th>' + esc(t('Deduction', 'خصم')) + '</th><th>' + esc(t('Net', 'الصافي')) + '</th></tr></thead><tbody>' +
      lines.map(function (l) {
        return '<tr><td class="person-name">' + esc(l.employeeName) + '<div class="person-sub">' + esc(l.employeeNumber) + '</div></td>' +
          '<td>' + esc(money(l.basicSalary)) + '</td><td>' + esc(money(l.overtimeAmount)) + '</td><td>' + esc(money(l.bonusAmount)) + '</td>' +
          '<td>' + esc(money(l.allowanceAmount)) + '</td><td>' + esc(money(l.deductionAmount)) + '</td><td><strong>' + esc(money(l.netSalary)) + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="form-hint" style="color:var(--ltt)">' + esc(t('Not calculated yet.', 'لم يتم الحساب بعد.')) + '</p>';

    var adjHtml = adjustments.length
      ? adjustments.map(function (a) {
        var emp = employees.filter(function (e) { return e.id === a.employeeId; })[0];
        return '<div class="contract-row"><div><div class="num">' + esc(a.type) + '</div><div class="meta">' + esc(emp ? emp.firstName + ' ' + emp.lastName : a.employeeId) + (a.reason ? ' — ' + esc(a.reason) : '') + '</div></div><div class="salary">' + esc(money(a.amount)) + '</div></div>';
      }).join('')
      : '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No adjustments yet.', 'لا توجد تعديلات بعد.')) + '</p>';

    document.getElementById('drawerContent').innerHTML =
      '<div class="drawer-hdr"><h2><i class="ti ti-cash-banknote"></i> ' + esc(t(MONTH_NAMES[period.month], MONTH_NAMES[period.month])) + ' ' + esc(period.year) + '</h2>' +
      '<button type="button" class="modal-close" id="btnDrawerClose"><i class="ti ti-x"></i></button></div>' +
      '<div class="drawer-body">' +
      '<div class="drawer-sec"><h3>' + esc(t('Payroll lines', 'بنود الرواتب')) + '</h3>' + linesHtml + '</div>' +
      '<div class="drawer-sec"><h3>' + esc(t('Adjustments', 'التعديلات')) +
      (canEditPeriod ? '<button type="button" class="btn-secondary" id="btnAddAdjustment" style="width:auto;height:28px;padding:0 10px;font-size:11px;gap:4px"><i class="ti ti-plus"></i></button>' : '') +
      '</h3>' + adjHtml + '</div>' +
      '</div>';

    document.getElementById('btnDrawerClose').addEventListener('click', function () { document.getElementById('drawerOverlay').hidden = true; });
    var addBtn = document.getElementById('btnAddAdjustment');
    if (addBtn) addBtn.addEventListener('click', function () { openAdjustModal(period.id); });
    applyLocale();
  }

  function openAdjustModal(periodId) {
    adjustPeriodId = periodId;
    var sel = document.getElementById('aEmployee');
    sel.innerHTML = '';
    employees.forEach(function (e) { sel.appendChild(new Option(e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')', e.id)); });
    document.getElementById('adjustForm').reset();
    document.getElementById('adjustHint').textContent = '';
    openModal('adjustModal');
  }

  document.getElementById('adjustForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      employeeId: document.getElementById('aEmployee').value,
      type: document.getElementById('aType').value,
      amount: Number(document.getElementById('aAmount').value),
      reason: document.getElementById('aReason').value.trim() || null
    };
    var btn = document.getElementById('btnSaveAdjust');
    btn.disabled = true;
    var r = await Gfp.post('/hr/payroll-periods/' + adjustPeriodId + '/adjustments', body);
    btn.disabled = false;
    if (!r.ok) { document.getElementById('adjustHint').textContent = apiError(r); return; }
    closeModal('adjustModal');
    toast(t('Added — recalculate to apply it', 'تمت الإضافة — أعد الحساب لتطبيقها'), 'ok');
    openDrawer(adjustPeriodId);
  });

  (async function init() {
    await loadEmployees();
    await loadList();
  })();
})();
