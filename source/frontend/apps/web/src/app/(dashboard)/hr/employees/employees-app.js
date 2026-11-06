/**
 * HR Foundation — Employees.
 * Employee hub (tabbed drawer) + stepped onboarding.
 * Employee is decoupled from login accounts (AppUserId nullable).
 * System Access links/unlinks existing Staff — create Staff only for Owners during onboard.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var I18n = window.GfpI18n;
  var API_BASE = window.API_BASE || 'https://localhost:5001/api';

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
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

  var canManage = Authz && Authz.useCan('hr.manage');
  var canView = canManage || (Authz && Authz.useCan('hr.view'));
  var canLeave = Authz && Authz.useCan('hr.leave.view');
  var canPayroll = Authz && Authz.useCan('hr.payroll.view');
  var canDocuments = Authz && Authz.useCan('hr.documents.view');
  var canDocumentsManage = Authz && Authz.useCan('hr.documents.manage');
  var canAttendance = Authz && Authz.useCan('hr.attendance.view');
  var canAttendanceManage = Authz && Authz.useCan('hr.attendance.manage');
  var canScheduleManage = Authz && Authz.useCan('hr.shifts.manage');
  var canPayrollManage = Authz && Authz.useCan('hr.payroll.manage');
  var canLeaveManage = Authz && Authz.useCan('hr.leave.manage');
  var canLeaveApprove = Authz && Authz.useCan('hr.leave.approve');
  var isOwner = Authz && Authz.useCanRole('OwnerOnly');
  var shiftTemplates = [];

  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var rows = [];
  var departments = [];
  var positions = [];
  var editingId = null;
  /** Preserve Staff link on PUT — backend Update sets AppUserId from body (null clears). */
  var editingAppUserId = null;
  var editingIsTerminated = false;
  var drawerEmployeeId = null;
  var drawerEmployee = null;
  var drawerContracts = [];
  var drawerTab = 'overview';
  var drawerCurrentContract = null;
  var searchDebounce = null;
  var linkStaffEmployeeId = null;
  var availableStaff = [];
  var selectedAppUserId = null;
  var unlinkStaffEmployeeId = null;
  var docUploadEmployeeId = null;

  // Onboarding state
  var ONBOARD_STEPS = ['personal', 'employment', 'compensation', 'schedule', 'systemAccess', 'review'];
  var onboardStep = 0;
  var onboardData = null;
  var onboardStaffList = [];
  var onboardCreating = false;

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
  function initials(first, last) {
    return ((first || '')[0] || '').concat((last || '')[0] || '').toUpperCase() || 'E';
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
    var map = { Active: ['Active', 'نشط'], Suspended: ['Suspended', 'موقوف'], Terminated: ['Terminated', 'منتهي الخدمة'] };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function statusClass(s) {
    return s === 'Active' ? 'active' : (s === 'Suspended' ? 'suspended' : 'terminated');
  }
  function staffAccountStatusLabel(s) {
    if (s === 'Active') return t('Active', 'نشط');
    if (s === 'Disabled') return t('Disabled', 'معطّل');
    if (s === 'Missing') return t('Missing', 'غير موجود');
    return s || '—';
  }
  function isStaffLinked(e) {
    var sa = e && e.staffAccount;
    if (sa && typeof sa.linked === 'boolean') return sa.linked;
    return !!(e && (e.hasLogin || e.appUserId));
  }
  function cairoDateIso(d) {
    d = d || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch (e) {
      return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    }
  }
  function addDays(isoStr, days) {
    var parts = isoStr.split('-').map(Number);
    var utc = Date.UTC(parts[0], parts[1] - 1, parts[2] + days);
    return new Date(utc).toISOString().slice(0, 10);
  }
  function parseApiUtc(iso) {
    if (iso == null || iso === '') return null;
    if (iso instanceof Date) return isNaN(iso.getTime()) ? null : iso;
    var s = String(iso).trim();
    if (!s) return null;
    if (/[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s)) {
      var withTz = new Date(s);
      return isNaN(withTz.getTime()) ? null : withTz;
    }
    s = s.replace(' ', 'T');
    var asUtc = new Date(/[Tt]/.test(s) ? s + 'Z' : s + 'T00:00:00Z');
    return isNaN(asUtc.getTime()) ? null : asUtc;
  }
  function fmtTime(utcIso) {
    if (!utcIso) return '—';
    var d = parseApiUtc(utcIso);
    if (!d) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function fmtMinutes(n) {
    if (n == null || n === '') return '—';
    var mins = Number(n);
    if (Number.isNaN(mins)) return '—';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h <= 0 && m === 0) return '0m';
    return (h > 0 ? h + 'h ' : '') + m + 'm';
  }
  function hhmm(timeOnly) {
    return String(timeOnly || '').slice(0, 5);
  }
  async function loadShiftTemplates() {
    if (shiftTemplates.length) return shiftTemplates;
    var r = await Gfp.get('/hr/employee-shifts');
    shiftTemplates = r.ok && Array.isArray(r.data) ? r.data : [];
    return shiftTemplates;
  }
  function shiftOptionsHtml(selectedId) {
    return (shiftTemplates || []).map(function (s) {
      var label = s.name + ' (' + hhmm(s.startTime) + '–' + hhmm(s.endTime) + ')';
      return '<option value="' + esc(s.id) + '"' + (String(selectedId) === String(s.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }
  function attStatusLabel(s) {
    var map = {
      Present: ['Present', 'حاضر'], Late: ['Late', 'متأخر'], Absent: ['Absent', 'غائب'],
      HalfDay: ['Half day', 'نصف يوم'], OnLeave: ['On leave', 'إجازة']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function attStatusClass(s) {
    if (s === 'Present') return 'active';
    if (s === 'Absent') return 'terminated';
    return 'suspended';
  }
  function leaveTypeLabel(s) {
    var map = {
      Annual: ['Annual', 'سنوية'], Sick: ['Sick', 'مرضية'], Unpaid: ['Unpaid', 'بدون أجر'],
      Permission: ['Permission', 'إذن'], Maternity: ['Maternity', 'أمومة'], Paternity: ['Paternity', 'أبوة'],
      Emergency: ['Emergency', 'طارئة'], Other: ['Other', 'أخرى']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function leaveStatusLabel(s) {
    var map = { Pending: ['Pending', 'قيد الانتظار'], Approved: ['Approved', 'معتمد'], Rejected: ['Rejected', 'مرفوض'], Cancelled: ['Cancelled', 'ملغى'] };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function leaveStatusClass(s) {
    if (s === 'Approved') return 'active';
    if (s === 'Rejected' || s === 'Cancelled') return 'terminated';
    return 'suspended';
  }
  function docTypeLabel(s) {
    var map = {
      NationalId: ['National ID', 'الرقم القومي'], Contract: ['Contract', 'عقد'],
      Certificate: ['Certificate', 'شهادة'], TrainingCertificate: ['Training Certificate', 'شهادة تدريب'], Other: ['Other', 'أخرى']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function deptName(id) {
    if (!id) return '—';
    var d = departments.filter(function (x) { return String(x.id) === String(id); })[0];
    return d ? d.name : '—';
  }
  function posName(id) {
    if (!id) return '—';
    var p = positions.filter(function (x) { return String(x.id) === String(id); })[0];
    return p ? p.name : '—';
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

  async function loadReferenceData() {
    var dr = await Gfp.get('/hr/departments');
    departments = dr.ok && Array.isArray(dr.data) ? dr.data : [];
    var pr = await Gfp.get('/hr/positions');
    positions = pr.ok && Array.isArray(pr.data) ? pr.data : [];

    var filterDept = document.getElementById('filterDept');
    var formDept = document.getElementById('eDepartment');
    departments.forEach(function (d) {
      filterDept.appendChild(new Option(d.name, d.id));
      formDept.appendChild(new Option(d.name, d.id));
    });
    var formPos = document.getElementById('ePosition');
    positions.forEach(function (p) {
      formPos.appendChild(new Option(p.name, p.id));
    });
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var params = [];
    var status = document.getElementById('filterStatus').value;
    var dept = document.getElementById('filterDept').value;
    var search = document.getElementById('search').value.trim();
    if (status) params.push('status=' + encodeURIComponent(status));
    if (dept) params.push('departmentId=' + encodeURIComponent(dept));
    if (search) params.push('search=' + encodeURIComponent(search));
    var r = await Gfp.get('/hr/employees' + (params.length ? '?' + params.join('&') : ''));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No employees yet.', 'لا يوجد موظفون بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Department', 'القسم')) + '</th>' +
      '<th>' + esc(t('Position', 'المسمى الوظيفي')) + '</th>' +
      '<th>' + esc(t('Login', 'الدخول')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (e) {
      html += '<tr class="row-click" data-open="' + esc(e.id) + '">' +
        '<td><div class="person-cell">' +
        (e.photoUrl
          ? '<img class="person-av" style="object-fit:cover" src="' + esc(e.photoUrl) + '">'
          : '<div class="person-av">' + esc(initials(e.firstName, e.lastName)) + '</div>') +
        '<div><div class="person-name">' + esc(e.firstName) + ' ' + esc(e.lastName) + '</div>' +
        '<div class="person-sub">' + esc(e.employeeNumber) + '</div></div>' +
        '</div></td>' +
        '<td>' + esc(e.departmentName || '—') + '</td>' +
        '<td>' + esc(e.positionName || '—') + '</td>' +
        '<td><span class="login-badge ' + (e.hasLogin ? 'has' : '') + '"><i class="ti ' + (e.hasLogin ? 'ti-lock-open' : 'ti-lock') + '"></i> ' +
        esc(e.hasLogin ? t('Has login', 'لديه حساب') : t('No login', 'بدون حساب')) + '</span></td>' +
        '<td><span class="status-badge ' + statusClass(e.status) + '"><span class="dot"></span>' + esc(statusLabel(e.status)) + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-open]'), function (tr) {
      tr.addEventListener('click', function () { openDrawer(tr.getAttribute('data-open')); });
    });
    applyLocale();
  }

  function fillForm(e) {
    document.getElementById('eFirstName').value = (e && e.firstName) || '';
    document.getElementById('eLastName').value = (e && e.lastName) || '';
    document.getElementById('ePhone').value = (e && e.phone) || '';
    document.getElementById('eEmail').value = (e && e.email) || '';
    document.getElementById('eNationalId').value = (e && e.nationalId) || '';
    document.getElementById('eDob').value = (e && e.dateOfBirth) || '';
    document.getElementById('eHireDate').value = (e && e.hireDate) || '';
    document.getElementById('eDepartment').value = (e && e.departmentId) || '';
    document.getElementById('ePosition').value = (e && e.positionId) || '';
    document.getElementById('eAddress').value = (e && e.address) || '';
    document.getElementById('eHireDate').disabled = !!e;

    var statusRow = document.getElementById('eStatusRow');
    var statusSelect = document.getElementById('eStatus');
    var statusReadonly = document.getElementById('eStatusReadonly');
    var saveBtn = document.getElementById('btnSaveEmp');
    statusRow.hidden = !e;
    editingIsTerminated = !!(e && e.status === 'Terminated');
    editingAppUserId = e && (e.appUserId || (e.staffAccount && e.staffAccount.appUserId)) || null;

    if (e && editingIsTerminated) {
      statusSelect.hidden = true;
      statusReadonly.hidden = false;
      statusReadonly.textContent = statusLabel('Terminated');
      statusReadonly.className = 'status-readonly';
      saveBtn.disabled = true;
      document.getElementById('empHint').textContent = t(
        'Terminated employees cannot be edited here. Status is Terminated; reinstatement is not available from this form (backend Update only accepts Active or Suspended).',
        'لا يمكن تعديل الموظف منتهي الخدمة من هنا. الحالة منتهي الخدمة؛ إعادة التفعيل غير متاحة من هذا النموذج.'
      );
    } else {
      statusSelect.hidden = false;
      statusReadonly.hidden = true;
      saveBtn.disabled = false;
      if (e) {
        statusSelect.value = e.status === 'Suspended' ? 'Suspended' : 'Active';
      }
      document.getElementById('empHint').textContent = '';
    }
  }

  function readForm() {
    return {
      firstName: document.getElementById('eFirstName').value.trim(),
      lastName: document.getElementById('eLastName').value.trim(),
      phone: document.getElementById('ePhone').value.trim() || null,
      email: document.getElementById('eEmail').value.trim() || null,
      nationalId: document.getElementById('eNationalId').value.trim() || null,
      dateOfBirth: document.getElementById('eDob').value || null,
      hireDate: document.getElementById('eHireDate').value || null,
      departmentId: document.getElementById('eDepartment').value || null,
      positionId: document.getElementById('ePosition').value || null,
      address: document.getElementById('eAddress').value.trim() || null,
      status: document.getElementById('eStatus').value,
      appUserId: editingAppUserId || null
    };
  }

  function openEditFromDrawer(e) {
    editingId = e.id;
    document.getElementById('empModalTitle').textContent = t('Edit employee', 'تعديل بيانات الموظف');
    fillForm(e);
    openModal('empModal');
  }

  document.getElementById('btnCreate').addEventListener('click', openOnboard);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);
  document.getElementById('filterDept').addEventListener('change', loadList);
  document.getElementById('search').addEventListener('input', function () {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadList, 300);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('empForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (editingIsTerminated) {
      document.getElementById('empHint').textContent = t(
        'Terminated employees cannot be updated from this form.',
        'لا يمكن تحديث الموظف منتهي الخدمة من هذا النموذج.'
      );
      return;
    }
    var body = readForm();
    if (!body.firstName || !body.lastName) {
      document.getElementById('empHint').textContent = t('First and last name are required', 'الاسم الأول والأخير مطلوبان');
      return;
    }
    if (!editingId) return;
    var btn = document.getElementById('btnSaveEmp');
    btn.disabled = true;
    var r = await Gfp.put('/hr/employees/' + editingId, body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('empHint').textContent = apiError(r);
      return;
    }
    closeModal('empModal');
    toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
    if (drawerEmployeeId === editingId) openDrawer(drawerEmployeeId);
  });

  // ── Detail drawer (hub) ──
  function visibleTabs() {
    var tabs = [
      { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
      { id: 'employment', en: 'Employment', ar: 'التوظيف' },
      { id: 'schedule', en: 'Schedule', ar: 'الجدول' },
      { id: 'attendance', en: 'Attendance', ar: 'الحضور' }
    ];
    if (canLeave) tabs.push({ id: 'leave', en: 'Leave', ar: 'الإجازات' });
    if (canPayroll) tabs.push({ id: 'payroll', en: 'Payroll', ar: 'الرواتب' });
    if (canDocuments) tabs.push({ id: 'documents', en: 'Documents', ar: 'المستندات' });
    tabs.push({ id: 'systemAccess', en: 'System Access', ar: 'صلاحية الدخول' });
    return tabs;
  }

  function ensureValidTab() {
    var ids = visibleTabs().map(function (x) { return x.id; });
    if (ids.indexOf(drawerTab) === -1) drawerTab = 'overview';
  }

  async function openDrawer(id) {
    drawerEmployeeId = id;
    document.getElementById('drawerOverlay').hidden = false;
    var host = document.getElementById('drawerContent');
    host.className = 'drawer wide';
    renderDrawerShell(null, true);
    var er = await Gfp.get('/hr/employees/' + id);
    if (!er.ok) {
      renderDrawerShell(null, false, apiError(er));
      return;
    }
    var cr = await Gfp.get('/hr/employees/' + id + '/contracts');
    drawerEmployee = er.data;
    drawerContracts = cr.ok && Array.isArray(cr.data) ? cr.data : [];
    ensureValidTab();
    renderDrawerShell(drawerEmployee, false);
    await renderTabPanel();
  }

  function closeDrawer() {
    document.getElementById('drawerOverlay').hidden = true;
    drawerEmployeeId = null;
    drawerEmployee = null;
    drawerContracts = [];
  }

  function renderSystemAccessHtml(e) {
    var linked = isStaffLinked(e);
    var sa = e.staffAccount || {};
    var stateClass = linked ? 'linked' : 'none';
    var stateText = linked ? t('Linked', 'مرتبط') : t('None', 'بدون');

    var body;
    if (!linked) {
      body = '<div class="sys-access-empty">' + esc(t('No Staff login linked.', 'لا يوجد حساب دخول مرتبط.')) + '</div>';
    } else {
      body =
        '<div class="sys-access-card">' +
        '<div class="name">' + esc(sa.fullName || t('Staff account', 'حساب الدخول')) + '</div>' +
        (sa.email ? '<div class="meta">' + esc(sa.email) + '</div>' : '') +
        '<div class="role-line">' +
        (sa.role ? '<span class="staff-tag">' + esc(sa.role) + '</span>' : '') +
        '<span class="staff-tag ' + (sa.status === 'Active' ? 'active' : 'inactive') + '">' +
        esc(staffAccountStatusLabel(sa.status)) +
        '</span>' +
        '</div>' +
        '</div>';
    }

    var actions = '';
    if (canManage) {
      if (!linked) {
        actions =
          '<div class="sys-access-actions">' +
          '<button type="button" class="btn-link-staff" id="btnLinkStaff">' +
          '<i class="ti ti-link"></i> ' + esc(t('Link Staff Account', 'ربط حساب الدخول')) +
          '</button>' +
          '</div>';
      } else {
        actions =
          '<div class="sys-access-actions">' +
          '<button type="button" class="btn-unlink-staff" id="btnUnlinkStaff">' +
          '<i class="ti ti-unlink"></i> ' + esc(t('Unlink Staff Account', 'فك ربط حساب الدخول')) +
          '</button>' +
          '</div>';
      }
    }

    var staffCard =
      '<div class="sys-access">' +
      '<div class="sys-access-hdr">' +
      '<span class="label">' + esc(t('Staff Desk Login', 'حساب مكتب الموظفين')) + '</span>' +
      '<span class="sys-access-state ' + stateClass + '">' +
      '<i class="ti ' + (linked ? 'ti-lock-open' : 'ti-lock') + '"></i> ' + esc(stateText) +
      '</span>' +
      '</div>' +
      body +
      actions +
      '</div>';

    var appActions = '';
    if (canManage && e.status === 'Active') {
      appActions =
        '<button type="button" class="emp-app-btn" id="btnGenEmpAppCode">' +
        '<i class="ti ti-key"></i> <span id="btnGenEmpAppCodeLabel">' +
        esc(t('Generate Employee App code', 'إنشاء كود تطبيق الموظف')) +
        '</span></button>';
    } else {
      appActions =
        '<p class="emp-app-muted">' +
        esc(e.status === 'Active'
          ? t('You need HR manage permission to issue a code.', 'تحتاج صلاحية إدارة الموارد البشرية لإصدار كود.')
          : t('Only Active employees can receive a code.', 'الموظفون النشطون فقط يمكنهم الحصول على كود.')) +
        '</p>';
    }

    var empAppCard =
      '<div class="emp-app-card" style="margin-top:14px">' +
      '<div class="emp-app-hdr">' +
      '<i class="ti ti-device-mobile"></i>' +
      '<div>' +
      '<div class="emp-app-title">' + esc(t('Employee App', 'تطبيق الموظف')) + '</div>' +
      '<div class="emp-app-sub">' +
      esc(t(
        'One-time code for Gym Code + Activation Code login (no Staff account required).',
        'كود لمرة واحدة — كود الصالة + كود التفعيل (بدون حاجة لحساب مكتب).'
      )) +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="empAppCodeReveal" class="emp-app-reveal" hidden>' +
      '<div class="emp-app-code-row">' +
      '<code class="emp-app-code" id="empAppCodeValue"></code>' +
      '<button type="button" class="emp-app-copy" id="btnCopyEmpAppCode" title="' +
      esc(t('Copy', 'نسخ')) + '"><i class="ti ti-copy"></i></button>' +
      '</div>' +
      '<div class="emp-app-expiry" id="empAppCodeExpiry"></div>' +
      '<div class="emp-app-warn">' +
      esc(t('Show once to the employee — not stored again.', 'يظهر مرة واحدة فقط — لا يُحفظ مرة أخرى.')) +
      '</div>' +
      '</div>' +
      appActions +
      '</div>';

    return staffCard + empAppCard;
  }

  function bindEmployeeAppCodeActions(e) {
    var genBtn = document.getElementById('btnGenEmpAppCode');
    if (genBtn) {
      genBtn.addEventListener('click', async function () {
        genBtn.disabled = true;
        var r = await Gfp.post('/hr/employees/' + e.id + '/app-activation-code', {});
        genBtn.disabled = false;
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        var d = r.data || {};
        var reveal = document.getElementById('empAppCodeReveal');
        var val = document.getElementById('empAppCodeValue');
        var exp = document.getElementById('empAppCodeExpiry');
        var label = document.getElementById('btnGenEmpAppCodeLabel');
        if (val) val.textContent = d.activationCode || '—';
        if (exp) {
          if (d.expiresAtUtc) {
            var when = new Date(d.expiresAtUtc);
            exp.textContent = t('Expires ', 'ينتهي ') + when.toLocaleString(undefined, {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
          } else if (d.expiresInMinutes != null) {
            var h = Math.round(Number(d.expiresInMinutes) / 60);
            exp.textContent = h >= 1
              ? t('Expires in ', 'ينتهي خلال ') + h + t(' hours', ' ساعة')
              : t('Expires in ', 'ينتهي خلال ') + d.expiresInMinutes + t(' minutes', ' دقيقة');
          } else {
            exp.textContent = '';
          }
        }
        if (reveal) reveal.hidden = false;
        if (label) label.textContent = t('Generate new code', 'إنشاء كود جديد');
        genBtn.classList.add('secondary');
        toast(t('Activation code generated', 'تم إنشاء كود التفعيل'), 'ok');
      });
    }
    var copyBtn = document.getElementById('btnCopyEmpAppCode');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var val = document.getElementById('empAppCodeValue');
        var text = val ? val.textContent : '';
        if (!text || text === '—') return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast(t('Copied', 'تم النسخ'), 'ok');
          }).catch(function () { toast(t('Copy failed', 'فشل النسخ'), 'err'); });
        }
      });
    }
  }

  function renderDrawerShell(e, loading, error) {
    var host = document.getElementById('drawerContent');
    host.className = 'drawer wide';
    if (loading) {
      host.innerHTML = '<div class="drawer-body"><div class="loading-state"><div class="loader"></div></div></div>';
      return;
    }
    if (error || !e) {
      host.innerHTML = '<div class="drawer-hdr"><h2>' + esc(t('Employee', 'الموظف')) + '</h2>' +
        '<button type="button" class="modal-close" id="btnDrawerClose"><i class="ti ti-x"></i></button></div>' +
        '<div class="drawer-body"><p class="form-hint">' + esc(error || t('Not found', 'غير موجود')) + '</p></div>';
      document.getElementById('btnDrawerClose').addEventListener('click', closeDrawer);
      return;
    }

    var tabs = visibleTabs();
    var tabsHtml = '<div class="emp-tabs">' + tabs.map(function (tab) {
      return '<button type="button" class="emp-tab' + (drawerTab === tab.id ? ' act' : '') + '" data-tab="' + esc(tab.id) + '">' +
        esc(t(tab.en, tab.ar)) + '</button>';
    }).join('') + '</div>';

    host.innerHTML =
      '<div class="drawer-hdr"><h2><i class="ti ti-id-badge-2"></i> ' + esc(e.firstName) + ' ' + esc(e.lastName) + '</h2>' +
      '<button type="button" class="modal-close" id="btnDrawerClose"><i class="ti ti-x"></i></button></div>' +
      tabsHtml +
      '<div class="drawer-body"><div id="empTabPanel" class="emp-tab-panel"><div class="loading-state"><div class="loader"></div></div></div></div>' +
      (canManage
        ? '<div class="drawer-footer">' +
        (e.status !== 'Terminated'
          ? '<button type="button" class="btn-danger" id="btnTerminate">' + esc(t('Terminate', 'إنهاء الخدمة')) + '</button>'
          : '') +
        '<button type="button" class="btn-primary" id="btnEditEmp">' + esc(t('Edit', 'تعديل')) + '</button>' +
        '</div>'
        : '');

    document.getElementById('btnDrawerClose').addEventListener('click', closeDrawer);
    Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (btn) {
      btn.addEventListener('click', async function () {
        drawerTab = btn.getAttribute('data-tab');
        Array.prototype.forEach.call(host.querySelectorAll('.emp-tab'), function (el) {
          el.classList.toggle('act', el.getAttribute('data-tab') === drawerTab);
        });
        await renderTabPanel();
      });
    });

    var editBtn = document.getElementById('btnEditEmp');
    if (editBtn) editBtn.addEventListener('click', function () { openEditFromDrawer(e); });
    var termBtn = document.getElementById('btnTerminate');
    if (termBtn) termBtn.addEventListener('click', function () { openTerminate(e.id); });
    applyLocale();
  }

  async function renderTabPanel() {
    var panel = document.getElementById('empTabPanel');
    if (!panel || !drawerEmployee) return;
    var e = drawerEmployee;
    var id = e.id;

    if (drawerTab === 'overview') {
      panel.innerHTML =
        '<div class="drawer-sec">' +
        '<div class="kv"><span>' + esc(t('Employee #', 'رقم الموظف')) + '</span><span>' + esc(e.employeeNumber) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Status', 'الحالة')) + '</span><span class="status-badge ' + statusClass(e.status) + '"><span class="dot"></span>' + esc(statusLabel(e.status)) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Department', 'القسم')) + '</span><span>' + esc(e.departmentName || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Position', 'المسمى الوظيفي')) + '</span><span>' + esc(e.positionName || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Phone', 'الهاتف')) + '</span><span>' + esc(e.phone || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Email', 'البريد')) + '</span><span>' + esc(e.email || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Hire date', 'تاريخ التعيين')) + '</span><span>' + esc(e.hireDate) + '</span></div>' +
        (e.terminationDate ? '<div class="kv"><span>' + esc(t('Termination date', 'تاريخ إنهاء الخدمة')) + '</span><span>' + esc(e.terminationDate) + '</span></div>' : '') +
        '</div>';
      return;
    }

    if (drawerTab === 'employment') {
      var contracts = drawerContracts || [];
      var contractsHtml = contracts.length
        ? contracts.map(function (c) {
          return '<div class="contract-row ' + (c.isCurrent ? 'current' : '') + '">' +
            '<div><div class="num">' + esc(c.contractNumber) + (c.isCurrent ? '<span class="badge-current">' + esc(t('Current', 'حالي')) + '</span>' : '') + '</div>' +
            '<div class="meta">' + esc(c.startDate) + ' → ' + esc(c.endDate || t('Ongoing', 'مستمر')) + ' · ' + esc(c.employmentType) + '</div></div>' +
            '<div class="salary">' + esc(money(c.basicSalary)) + '</div>' +
            '</div>';
        }).join('')
        : '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No contracts yet.', 'لا توجد عقود بعد.')) + '</p>';
      panel.innerHTML =
        '<div class="drawer-sec">' +
        '<h3>' + esc(t('Employment history', 'سجل التوظيف')) +
        (canManage && e.status !== 'Terminated'
          ? '<button type="button" class="btn-secondary" id="btnAddContract" style="width:auto;height:28px;padding:0 10px;font-size:11px;gap:4px" title="' + esc(t('Add contract', 'إضافة عقد')) + '"><i class="ti ti-plus"></i></button>'
          : '') +
        '</h3>' +
        contractsHtml +
        '</div>';
      var addContractBtn = document.getElementById('btnAddContract');
      if (addContractBtn) addContractBtn.addEventListener('click', function () { openAddContract(e.id); });
      return;
    }

    if (drawerTab === 'systemAccess') {
      panel.innerHTML = '<div class="drawer-sec"><h3>' + esc(t('System Access', 'صلاحية الدخول')) + '</h3>' + renderSystemAccessHtml(e) + '</div>';
      var linkBtn = document.getElementById('btnLinkStaff');
      if (linkBtn) linkBtn.addEventListener('click', function () { openLinkStaff(e.id); });
      var unlinkBtn = document.getElementById('btnUnlinkStaff');
      if (unlinkBtn) unlinkBtn.addEventListener('click', function () { openUnlinkStaff(e.id); });
      bindEmployeeAppCodeActions(e);
      return;
    }

    if (drawerTab === 'schedule') {
      panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
      await loadShiftTemplates();
      var today = cairoDateIso();
      var to = addDays(today, 6);
      var r = await Gfp.get('/hr/employee-schedules?from=' + encodeURIComponent(today) + '&to=' + encodeURIComponent(to) + '&employeeId=' + encodeURIComponent(id));
      if (!r.ok) {
        panel.innerHTML = '<p class="form-hint">' + esc(apiError(r)) + '</p>' +
          '<button type="button" class="btn-secondary" id="btnHubRetryTab" style="margin-top:10px;height:34px">' + esc(t('Retry', 'إعادة المحاولة')) + '</button>';
        var retry = document.getElementById('btnHubRetryTab');
        if (retry) retry.addEventListener('click', function () { renderTabPanel(); });
        return;
      }
      var sched = Array.isArray(r.data) ? r.data : [];
      var assignHtml = '';
      if (canScheduleManage) {
        if (shiftTemplates.length) {
          assignHtml =
            '<div class="drawer-sec emp-inline-ops">' +
            '<h3 class="emp-inline-title">' + esc(t('Assign shift', 'تعيين وردية')) + '</h3>' +
            '<div class="form-grid">' +
            '<label class="fg"><span>' + esc(t('Shift template', 'قالب الوردية')) + '</span>' +
            '<select id="hubAssignShift"><option value="">' + esc(t('Select…', 'اختر…')) + '</option>' + shiftOptionsHtml('') + '</select></label>' +
            '<label class="fg"><span>' + esc(t('Date', 'التاريخ')) + '</span><input id="hubAssignDate" type="date" value="' + esc(today) + '"></label>' +
            '<label class="fg span2"><span>' + esc(t('Notes', 'ملاحظات')) + '</span><input id="hubAssignNotes" maxlength="500" placeholder="' + esc(t('Optional', 'اختياري')) + '"></label>' +
            '</div>' +
            '<div class="inline-act-row">' +
            '<button type="button" class="btn-primary" id="btnHubAssignShift"><i class="ti ti-calendar-plus"></i> ' + esc(t('Assign day', 'تعيين يوم')) + '</button>' +
            '<button type="button" class="btn-secondary" id="btnHubAssignWeek"><i class="ti ti-calendar-week"></i> ' + esc(t('Assign next 7 days', 'تعيين 7 أيام')) + '</button>' +
            '</div>' +
            '<p class="form-hint" id="hubAssignHint"></p>' +
            '</div>';
        } else {
          assignHtml = '<p class="form-hint" style="color:var(--ltt);margin-bottom:12px">' +
            esc(t('No shift templates yet. Create templates from HR → Schedule (Shift templates).', 'لا توجد قوالب ورديات بعد. أنشئ القوالب من الموارد البشرية → الجدول.')) + '</p>';
        }
      }
      var listHtml;
      if (!sched.length) {
        listHtml = '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No shifts assigned in the next 7 days.', 'لا توجد ورديات معينة خلال الأيام السبعة القادمة.')) + '</p>';
      } else {
        listHtml = '<h3 class="emp-inline-title">' + esc(t('Next 7 days', 'الأيام السبعة القادمة')) + '</h3>' +
          '<table><thead><tr><th>' + esc(t('Date', 'التاريخ')) + '</th><th>' + esc(t('Shift', 'الوردية')) + '</th><th>' + esc(t('Notes', 'ملاحظات')) + '</th>' +
          (canScheduleManage ? '<th></th>' : '') + '</tr></thead><tbody>' +
          sched.map(function (a) {
            return '<tr><td>' + esc(a.date) + '</td><td>' + esc(a.employeeShiftName || '—') + '</td><td>' + esc(a.notes || '—') + '</td>' +
              (canScheduleManage
                ? '<td><button type="button" class="act-btn danger" data-hub-rm="' + esc(a.date) + '" title="' + esc(t('Remove', 'إزالة')) + '"><i class="ti ti-trash"></i></button></td>'
                : '') +
              '</tr>';
          }).join('') + '</tbody></table>';
      }
      panel.innerHTML = assignHtml + listHtml;

      var hubHint = document.getElementById('hubAssignHint');
      async function hubAssignOne() {
        var shiftId = document.getElementById('hubAssignShift').value;
        var date = document.getElementById('hubAssignDate').value;
        var notes = document.getElementById('hubAssignNotes').value.trim() || null;
        if (!shiftId || !date) {
          if (hubHint) hubHint.textContent = t('Shift and date are required', 'الوردية والتاريخ مطلوبان');
          return;
        }
        if (hubHint) hubHint.textContent = '';
        var ar = await Gfp.post('/hr/employee-schedules', { employeeId: id, employeeShiftId: shiftId, date: date, notes: notes });
        if (!ar.ok) {
          if (hubHint) hubHint.textContent = apiError(ar);
          return;
        }
        toast(t('Shift assigned', 'تم تعيين الوردية'), 'ok');
        await renderTabPanel();
      }
      async function hubAssignWeek() {
        var shiftId = document.getElementById('hubAssignShift').value;
        var date = document.getElementById('hubAssignDate').value || today;
        if (!shiftId) {
          if (hubHint) hubHint.textContent = t('Select a shift template', 'اختر قالب وردية');
          return;
        }
        if (hubHint) hubHint.textContent = '';
        var br = await Gfp.post('/hr/employee-schedules/bulk', {
          employeeIds: [id],
          employeeShiftId: shiftId,
          dateFrom: date,
          dateTo: addDays(date, 6)
        });
        if (!br.ok) {
          if (hubHint) hubHint.textContent = apiError(br);
          return;
        }
        toast(t('Week assigned', 'تم تعيين الأسبوع'), 'ok');
        await renderTabPanel();
      }
      var btnDay = document.getElementById('btnHubAssignShift');
      if (btnDay) btnDay.addEventListener('click', hubAssignOne);
      var btnWeek = document.getElementById('btnHubAssignWeek');
      if (btnWeek) btnWeek.addEventListener('click', hubAssignWeek);
      Array.prototype.forEach.call(panel.querySelectorAll('[data-hub-rm]'), function (btn) {
        btn.addEventListener('click', async function () {
          var date = btn.getAttribute('data-hub-rm');
          var dr = await Gfp.del('/hr/employee-schedules/' + encodeURIComponent(id) + '/' + encodeURIComponent(date));
          if (!dr.ok) { toast(apiError(dr), 'err'); return; }
          toast(t('Shift removed', 'تمت إزالة الوردية'), 'ok');
          await renderTabPanel();
        });
      });
      return;
    }

    if (drawerTab === 'attendance') {
      panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
      var attTo = cairoDateIso();
      var attFrom = addDays(attTo, -13);
      var ar = await Gfp.get('/hr/employee-attendance?from=' + encodeURIComponent(attFrom) + '&to=' + encodeURIComponent(attTo) + '&employeeId=' + encodeURIComponent(id));
      if (!ar.ok) {
        panel.innerHTML = '<p class="form-hint">' + esc(apiError(ar)) + '</p>' +
          '<button type="button" class="btn-secondary" id="btnHubRetryTab" style="margin-top:10px;height:34px">' + esc(t('Retry', 'إعادة المحاولة')) + '</button>';
        var retryA = document.getElementById('btnHubRetryTab');
        if (retryA) retryA.addEventListener('click', function () { renderTabPanel(); });
        return;
      }
      var att = Array.isArray(ar.data) ? ar.data : [];
      var todayIso = cairoDateIso();
      var todayRow = att.filter(function (a) { return a.attendanceDate === todayIso; })[0] || null;
      var openVisit = todayRow && todayRow.checkInAtUtc && !todayRow.checkOutAtUtc;
      var opsHtml = '';
      if (canAttendanceManage && e.status === 'Active') {
        opsHtml =
          '<div class="drawer-sec emp-inline-ops">' +
          '<h3 class="emp-inline-title">' + esc(t('Today', 'اليوم')) + ' · ' + esc(todayIso) + '</h3>' +
          '<div class="inline-act-row">' +
          (!openVisit
            ? '<button type="button" class="btn-primary" id="btnHubCheckIn"><i class="ti ti-login-2"></i> ' + esc(t('Check in', 'تسجيل حضور')) + '</button>'
            : '<button type="button" class="btn-primary" id="btnHubCheckOut"><i class="ti ti-logout"></i> ' + esc(t('Check out', 'تسجيل انصراف')) + '</button>') +
          '</div>' +
          '<p class="form-hint" id="hubAttHint"></p>' +
          '</div>';
      }
      var ahtml;
      if (!att.length) {
        ahtml = '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No attendance in the last 14 days.', 'لا يوجد حضور خلال آخر 14 يوماً.')) + '</p>';
      } else {
        ahtml = '<h3 class="emp-inline-title">' + esc(t('Last 14 days', 'آخر 14 يوماً')) + '</h3>' +
          '<table><thead><tr><th>' + esc(t('Date', 'التاريخ')) + '</th><th>' + esc(t('In', 'حضور')) + '</th><th>' + esc(t('Out', 'انصراف')) + '</th><th>' + esc(t('Worked', 'عمل')) + '</th><th>' + esc(t('Status', 'الحالة')) + '</th></tr></thead><tbody>' +
          att.map(function (a) {
            return '<tr><td>' + esc(a.attendanceDate) + '</td><td>' + esc(fmtTime(a.checkInAtUtc)) + '</td><td>' + esc(fmtTime(a.checkOutAtUtc)) + '</td><td>' + esc(fmtMinutes(a.workedMinutes)) + '</td>' +
              '<td><span class="status-badge ' + attStatusClass(a.status) + '"><span class="dot"></span>' + esc(attStatusLabel(a.status)) + '</span></td></tr>';
          }).join('') + '</tbody></table>';
      }
      panel.innerHTML = opsHtml + ahtml;
      var attHint = document.getElementById('hubAttHint');
      var ci = document.getElementById('btnHubCheckIn');
      if (ci) {
        ci.addEventListener('click', async function () {
          ci.disabled = true;
          var cr = await Gfp.post('/hr/employee-attendance/check-in', { employeeId: id });
          ci.disabled = false;
          if (!cr.ok) {
            if (attHint) attHint.textContent = apiError(cr);
            else toast(apiError(cr), 'err');
            return;
          }
          toast(t('Checked in', 'تم تسجيل الحضور'), 'ok');
          await renderTabPanel();
        });
      }
      var co = document.getElementById('btnHubCheckOut');
      if (co) {
        co.addEventListener('click', async function () {
          co.disabled = true;
          var cr = await Gfp.post('/hr/employee-attendance/check-out', { employeeId: id });
          co.disabled = false;
          if (!cr.ok) {
            if (attHint) attHint.textContent = apiError(cr);
            else toast(apiError(cr), 'err');
            return;
          }
          toast(t('Checked out', 'تم تسجيل الانصراف'), 'ok');
          await renderTabPanel();
        });
      }
      return;
    }

    if (drawerTab === 'leave') {
      if (!canLeave) {
        panel.innerHTML = '<p class="form-hint">' + esc(t('You do not have leave view permission.', 'ليس لديك صلاحية عرض الإجازات.')) + '</p>';
        return;
      }
      panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
      var year = new Date().getFullYear();
      var br = await Gfp.get('/hr/leave-balances/' + encodeURIComponent(id) + '?year=' + year);
      var lr = await Gfp.get('/hr/leave-requests?employeeId=' + encodeURIComponent(id));
      if (!lr.ok) {
        panel.innerHTML = '<p class="form-hint">' + esc(apiError(lr)) + '</p>';
        return;
      }
      var balances = br.ok && Array.isArray(br.data) ? br.data : [];
      var leaves = Array.isArray(lr.data) ? lr.data : [];
      leaves = leaves.slice(0, 30);

      var balHtml = '';
      if (balances.length) {
        balHtml = '<div class="emp-balance-grid">' + balances.map(function (b) {
          return '<div class="emp-balance-chip"><div class="lbl">' + esc(leaveTypeLabel(b.leaveType)) + '</div>' +
            '<div class="val">' + esc(String(b.remainingDays)) + ' / ' + esc(String(b.entitledDays)) + '</div>' +
            '<div class="sub">' + esc(t('remaining', 'متبقي')) + '</div></div>';
        }).join('') + '</div>';
      }

      var formHtml = '';
      if (canLeaveManage && e.status === 'Active') {
        formHtml =
          '<div class="drawer-sec emp-inline-ops">' +
          '<h3 class="emp-inline-title">' + esc(t('New leave request', 'طلب إجازة جديد')) + '</h3>' +
          '<div class="form-grid">' +
          '<label class="fg"><span>' + esc(t('Type', 'النوع')) + '</span><select id="hubLeaveType">' +
          ['Annual', 'Sick', 'Unpaid', 'Permission', 'Emergency', 'Maternity', 'Paternity'].map(function (v) {
            return '<option value="' + v + '">' + esc(leaveTypeLabel(v)) + '</option>';
          }).join('') +
          '</select></label>' +
          '<label class="fg"><span>' + esc(t('From', 'من')) + '</span><input id="hubLeaveFrom" type="date" value="' + esc(cairoDateIso()) + '"></label>' +
          '<label class="fg"><span>' + esc(t('To', 'إلى')) + '</span><input id="hubLeaveTo" type="date" value="' + esc(cairoDateIso()) + '"></label>' +
          '<label class="fg"><span>' + esc(t('Duration (Permission only)', 'المدة (إذن فقط)')) + '</span><input id="hubLeaveDur" type="number" min="0.25" max="1" step="0.25" placeholder="0.25"></label>' +
          '<label class="fg span2"><span>' + esc(t('Reason', 'السبب')) + '</span><input id="hubLeaveReason" maxlength="500"></label>' +
          '</div>' +
          '<div class="inline-act-row"><button type="button" class="btn-primary" id="btnHubLeaveSubmit"><i class="ti ti-send"></i> ' + esc(t('Submit request', 'إرسال الطلب')) + '</button></div>' +
          '<p class="form-hint" id="hubLeaveHint"></p>' +
          '</div>';
      }

      var lhtml;
      if (!leaves.length) {
        lhtml = '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No leave requests yet.', 'لا توجد طلبات إجازة بعد.')) + '</p>';
      } else {
        lhtml = '<h3 class="emp-inline-title">' + esc(t('Requests', 'الطلبات')) + '</h3>' +
          '<table><thead><tr><th>' + esc(t('Type', 'النوع')) + '</th><th>' + esc(t('From', 'من')) + '</th><th>' + esc(t('To', 'إلى')) + '</th><th>' + esc(t('Status', 'الحالة')) + '</th><th></th></tr></thead><tbody>' +
          leaves.map(function (l) {
            var acts = '';
            if (String(l.status) === 'Pending') {
              if (canLeaveApprove) {
                acts += '<button type="button" class="act-btn" data-leave-approve="' + esc(l.id) + '" title="' + esc(t('Approve', 'اعتماد')) + '"><i class="ti ti-check"></i></button>';
                acts += '<button type="button" class="act-btn danger" data-leave-reject="' + esc(l.id) + '" title="' + esc(t('Reject', 'رفض')) + '"><i class="ti ti-x"></i></button>';
              }
              if (canLeaveManage) {
                acts += '<button type="button" class="act-btn danger" data-leave-cancel="' + esc(l.id) + '" title="' + esc(t('Cancel', 'إلغاء')) + '"><i class="ti ti-ban"></i></button>';
              }
            }
            return '<tr><td>' + esc(leaveTypeLabel(l.leaveType)) + '</td><td>' + esc(l.startDate) + '</td><td>' + esc(l.endDate) + '</td>' +
              '<td><span class="status-badge ' + leaveStatusClass(l.status) + '"><span class="dot"></span>' + esc(leaveStatusLabel(l.status)) + '</span></td>' +
              '<td class="inline-act-row" style="margin:0;gap:4px">' + acts + '</td></tr>';
          }).join('') + '</tbody></table>';
      }

      panel.innerHTML = balHtml + formHtml + lhtml;

      var leaveHint = document.getElementById('hubLeaveHint');
      var submitBtn = document.getElementById('btnHubLeaveSubmit');
      if (submitBtn) {
        submitBtn.addEventListener('click', async function () {
          var body = {
            leaveType: document.getElementById('hubLeaveType').value,
            startDate: document.getElementById('hubLeaveFrom').value,
            endDate: document.getElementById('hubLeaveTo').value,
            reason: document.getElementById('hubLeaveReason').value.trim() || null
          };
          var dur = document.getElementById('hubLeaveDur').value;
          if (body.leaveType === 'Permission' && dur) body.durationDays = Number(dur);
          if (!body.startDate || !body.endDate) {
            if (leaveHint) leaveHint.textContent = t('From and To dates are required', 'تاريخا البداية والنهاية مطلوبان');
            return;
          }
          submitBtn.disabled = true;
          var sr = await Gfp.post('/hr/leave-requests?employeeId=' + encodeURIComponent(id), body);
          submitBtn.disabled = false;
          if (!sr.ok) {
            if (leaveHint) leaveHint.textContent = apiError(sr);
            return;
          }
          toast(t('Leave request submitted', 'تم إرسال طلب الإجازة'), 'ok');
          await renderTabPanel();
        });
      }
      Array.prototype.forEach.call(panel.querySelectorAll('[data-leave-approve]'), function (btn) {
        btn.addEventListener('click', async function () {
          var rr = await Gfp.post('/hr/leave-requests/' + btn.getAttribute('data-leave-approve') + '/approve', {});
          if (!rr.ok) { toast(apiError(rr), 'err'); return; }
          toast(t('Approved', 'تم الاعتماد'), 'ok');
          await renderTabPanel();
        });
      });
      Array.prototype.forEach.call(panel.querySelectorAll('[data-leave-reject]'), function (btn) {
        btn.addEventListener('click', async function () {
          var rr = await Gfp.post('/hr/leave-requests/' + btn.getAttribute('data-leave-reject') + '/reject', {});
          if (!rr.ok) { toast(apiError(rr), 'err'); return; }
          toast(t('Rejected', 'تم الرفض'), 'ok');
          await renderTabPanel();
        });
      });
      Array.prototype.forEach.call(panel.querySelectorAll('[data-leave-cancel]'), function (btn) {
        btn.addEventListener('click', async function () {
          var rr = await Gfp.post('/hr/leave-requests/' + btn.getAttribute('data-leave-cancel') + '/cancel', {});
          if (!rr.ok) { toast(apiError(rr), 'err'); return; }
          toast(t('Cancelled', 'تم الإلغاء'), 'ok');
          await renderTabPanel();
        });
      });
      return;
    }

    if (drawerTab === 'payroll') {
      if (!canPayroll) {
        panel.innerHTML = '<p class="form-hint">' + esc(t('You do not have payroll view permission.', 'ليس لديك صلاحية عرض الرواتب.')) + '</p>';
        return;
      }
      panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
      var current = (drawerContracts || []).filter(function (c) { return c.isCurrent; })[0] || null;
      drawerCurrentContract = current;
      var contractHtml =
        '<div class="drawer-sec emp-inline-ops">' +
        '<h3 class="emp-inline-title">' + esc(t('Contract salary', 'راتب العقد')) + '</h3>' +
        (current
          ? '<div class="kv"><span>' + esc(t('Basic salary', 'الراتب الأساسي')) + '</span><span><strong>' + esc(money(current.basicSalary)) + '</strong></span></div>' +
          '<div class="kv"><span>' + esc(t('Type', 'النوع')) + '</span><span>' + esc(current.employmentType) + '</span></div>'
          : '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No current contract. Add one from Employment.', 'لا يوجد عقد حالي. أضفه من التوظيف.')) + '</p>') +
        '<p class="form-hint">' + esc(t('Add adjustments below, then Calculate so they appear in net pay.', 'أضف التعديلات أدناه، ثم احسب الفترة لتظهر في الصافي.')) + '</p>' +
        '</div>';

      var pr = await Gfp.get('/hr/payroll-periods');
      if (!pr.ok) {
        panel.innerHTML = contractHtml + '<p class="form-hint">' + esc(apiError(pr)) + '</p>';
        return;
      }
      var periods = Array.isArray(pr.data) ? pr.data : [];
      if (!periods.length) {
        panel.innerHTML = contractHtml + '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No payroll periods yet.', 'لا توجد فترات رواتب بعد.')) + '</p>';
        return;
      }
      var latest = periods[0];
      var periodStatus = String(latest.status || '');
      var periodEditable = periodStatus === 'Draft' || periodStatus === 'Calculated';

      var adjR = await Gfp.get('/hr/payroll-periods/' + latest.id + '/adjustments?employeeId=' + encodeURIComponent(id));
      var adjustments = adjR.ok && Array.isArray(adjR.data) ? adjR.data : [];

      function adjTypeLabel(s) {
        var map = {
          Bonus: ['Bonus', 'مكافأة'],
          Allowance: ['Allowance', 'بدل'],
          Overtime: ['Overtime', 'إضافي'],
          Deduction: ['Deduction', 'خصم']
        };
        var p = map[s] || [s, s];
        return t(p[0], p[1]);
      }

      var adjHtml =
        '<div class="drawer-sec emp-inline-ops">' +
        '<h3 class="emp-inline-title">' + esc(t('Adjustments', 'التعديلات')) + ' · ' + esc(latest.month + '/' + latest.year) + '</h3>';

      if (canPayrollManage && periodEditable) {
        adjHtml +=
          '<div class="form-grid">' +
          '<label class="fg"><span>' + esc(t('Type', 'النوع')) + '</span><select id="hubAdjType">' +
          ['Bonus', 'Allowance', 'Overtime', 'Deduction'].map(function (v) {
            return '<option value="' + v + '">' + esc(adjTypeLabel(v)) + '</option>';
          }).join('') +
          '</select></label>' +
          '<label class="fg"><span>' + esc(t('Amount (EGP)', 'المبلغ (جنيه)')) + '</span><input id="hubAdjAmount" type="number" min="0.01" step="0.01"></label>' +
          '<label class="fg span2"><span>' + esc(t('Reason', 'السبب')) + '</span><input id="hubAdjReason" maxlength="500" placeholder="' + esc(t('Optional', 'اختياري')) + '"></label>' +
          '</div>' +
          '<div class="inline-act-row">' +
          '<button type="button" class="btn-primary" id="btnHubAddAdj"><i class="ti ti-plus"></i> ' + esc(t('Add adjustment', 'إضافة تعديل')) + '</button>' +
          '</div>' +
          '<p class="form-hint" id="hubAdjHint"></p>';
      } else if (!periodEditable) {
        adjHtml += '<p class="form-hint" style="color:var(--ltt)">' +
          esc(t('Period is Approved/Closed — adjustments are locked.', 'الفترة معتمدة/مغلقة — التعديلات مقفلة.')) + '</p>';
      }

      if (!adjustments.length) {
        adjHtml += '<p class="form-hint" style="color:var(--ltt);margin-top:10px">' +
          esc(t('No adjustments for this employee in this period.', 'لا توجد تعديلات لهذا الموظف في هذه الفترة.')) + '</p>';
      } else {
        adjHtml += '<table style="margin-top:10px"><thead><tr><th>' + esc(t('Type', 'النوع')) + '</th><th>' + esc(t('Amount', 'المبلغ')) + '</th><th>' + esc(t('Reason', 'السبب')) + '</th></tr></thead><tbody>' +
          adjustments.map(function (a) {
            return '<tr><td>' + esc(adjTypeLabel(a.type)) + '</td><td>' + esc(money(a.amount)) + '</td><td>' + esc(a.reason || '—') + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      adjHtml += '</div>';

      var linesR = await Gfp.get('/hr/payroll-periods/' + latest.id + '/lines?employeeId=' + encodeURIComponent(id));
      var line = linesR.ok && Array.isArray(linesR.data) && linesR.data.length ? linesR.data[0] : null;
      var phtml =
        '<h3 class="emp-inline-title">' + esc(t('Latest period', 'آخر فترة')) + ' · ' + esc(latest.month + '/' + latest.year) + ' · ' + esc(latest.status) + '</h3>';
      if (!line) {
        if (e.status === 'Terminated' || e.status === 'Suspended') {
          phtml += '<p class="form-hint" style="color:var(--ltt)">' +
            esc(t(
              'No payroll line yet. Add an adjustment if needed, then Calculate — terminated/suspended staff with adjustments are included.',
              'لا يوجد بند راتب بعد. أضف تعديلاً إن لزم ثم احسب — الموظفون المنتهون/الموقوفون ذوو التعديلات يُدرجون.'
            )) + '</p>';
        } else {
          phtml += '<p class="form-hint" style="color:var(--ltt)">' +
            esc(t('No payroll line yet for this employee in this period.', 'لا يوجد بند راتب لهذا الموظف في هذه الفترة بعد.')) + '</p>';
        }
      } else {
        phtml +=
          '<div class="kv"><span>' + esc(t('Basic salary', 'الراتب الأساسي')) + '</span><span>' + esc(money(line.basicSalary)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Overtime', 'إضافي')) + '</span><span>' + esc(money(line.overtimeAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Bonus', 'مكافأة')) + '</span><span>' + esc(money(line.bonusAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Allowance', 'بدل')) + '</span><span>' + esc(money(line.allowanceAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Deduction', 'خصم')) + '</span><span>' + esc(money(line.deductionAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Net salary', 'صافي الراتب')) + '</span><span><strong>' + esc(money(line.netSalary)) + '</strong></span></div>';
      }
      if (canPayrollManage && periodEditable) {
        phtml +=
          '<div class="inline-act-row" style="margin-top:12px">' +
          '<button type="button" class="btn-primary" id="btnHubCalcPayroll" data-period="' + esc(latest.id) + '"><i class="ti ti-calculator"></i> ' +
          esc(t('Calculate payroll for this period', 'حساب رواتب هذه الفترة')) + '</button>' +
          '</div><p class="form-hint" id="hubPayHint"></p>';
      }
      panel.innerHTML = contractHtml + adjHtml + phtml;

      var addAdjBtn = document.getElementById('btnHubAddAdj');
      if (addAdjBtn) {
        addAdjBtn.addEventListener('click', async function () {
          var hint = document.getElementById('hubAdjHint');
          var type = document.getElementById('hubAdjType').value;
          var amount = Number(document.getElementById('hubAdjAmount').value);
          var reason = document.getElementById('hubAdjReason').value.trim() || null;
          if (!type || !(amount > 0)) {
            if (hint) hint.textContent = t('Type and amount greater than zero are required', 'النوع ومبلغ أكبر من صفر مطلوبان');
            return;
          }
          if (hint) hint.textContent = '';
          addAdjBtn.disabled = true;
          var cr = await Gfp.post('/hr/payroll-periods/' + latest.id + '/adjustments', {
            employeeId: id,
            type: type,
            amount: amount,
            reason: reason
          });
          addAdjBtn.disabled = false;
          if (!cr.ok) {
            if (hint) hint.textContent = apiError(cr);
            else toast(apiError(cr), 'err');
            return;
          }
          toast(t('Adjustment added — Calculate to apply to net pay', 'تمت إضافة التعديل — احسب الفترة لتطبيقه على الصافي'), 'ok');
          await renderTabPanel();
        });
      }

      var calcBtn = document.getElementById('btnHubCalcPayroll');
      if (calcBtn) {
        calcBtn.addEventListener('click', async function () {
          var hint = document.getElementById('hubPayHint');
          calcBtn.disabled = true;
          if (hint) hint.textContent = t('Calculating…', 'جاري الحساب…');
          var cr = await Gfp.post('/hr/payroll-periods/' + calcBtn.getAttribute('data-period') + '/calculate', {});
          calcBtn.disabled = false;
          if (!cr.ok) {
            if (hint) hint.textContent = apiError(cr);
            else toast(apiError(cr), 'err');
            return;
          }
          toast(t('Payroll calculated', 'تم حساب الرواتب'), 'ok');
          await renderTabPanel();
        });
      }
      return;
    }

    if (drawerTab === 'documents') {
      if (!canDocuments) {
        panel.innerHTML = '<p class="form-hint">' + esc(t('You do not have documents view permission.', 'ليس لديك صلاحية عرض المستندات.')) + '</p>';
        return;
      }
      panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
      var dr = await Gfp.get('/hr/employees/' + id + '/documents');
      if (!dr.ok) {
        panel.innerHTML = '<p class="form-hint">' + esc(apiError(dr)) + '</p>';
        return;
      }
      var docs = Array.isArray(dr.data) ? dr.data : [];
      var dhtml = '';
      if (canDocumentsManage) {
        dhtml += '<div class="inline-act-row" style="margin-bottom:12px"><button type="button" class="btn-primary" id="btnHubUploadDoc" style="height:34px;padding:0 14px;font-size:12px"><i class="ti ti-upload"></i> ' +
          esc(t('Upload document', 'رفع مستند')) + '</button></div>';
      }
      if (!docs.length) {
        dhtml += '<p class="form-hint" style="color:var(--ltt)">' + esc(t('No documents yet.', 'لا توجد مستندات بعد.')) + '</p>';
      } else {
        dhtml += '<table><thead><tr><th>' + esc(t('Name', 'الاسم')) + '</th><th>' + esc(t('Type', 'النوع')) + '</th><th>' + esc(t('Expiry', 'الانتهاء')) + '</th><th></th></tr></thead><tbody>' +
          docs.map(function (d) {
            return '<tr><td>' + esc(d.fileName || '—') + '</td><td>' + esc(docTypeLabel(d.documentType)) + '</td><td>' + esc(d.expiryDate || '—') + '</td>' +
              '<td><button type="button" class="act-btn" data-doc-dl="' + esc(d.id) + '" data-filename="' + esc(d.fileName || 'document') + '" title="' + esc(t('Download', 'تنزيل')) + '"><i class="ti ti-download"></i></button></td></tr>';
          }).join('') + '</tbody></table>';
      }
      panel.innerHTML = dhtml;
      var upBtn = document.getElementById('btnHubUploadDoc');
      if (upBtn) upBtn.addEventListener('click', function () { openDocUpload(id); });
      Array.prototype.forEach.call(panel.querySelectorAll('[data-doc-dl]'), function (btn) {
        btn.addEventListener('click', function () {
          downloadDocument(btn.getAttribute('data-doc-dl'), btn.getAttribute('data-filename'));
        });
      });
    }
  }

  async function downloadDocument(docId, fileName) {
    try {
      var resp = await fetch(API_BASE + '/hr/employee-documents/' + docId + '/file', {
        headers: { Authorization: 'Bearer ' + getToken(), 'ngrok-skip-browser-warning': 'true' }
      });
      if (!resp.ok) { toast(t('Could not download file', 'تعذر تنزيل الملف'), 'err'); return; }
      var blob = await resp.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) {
      toast(t('Could not download file', 'تعذر تنزيل الملف'), 'err');
    }
  }

  function openDocUpload(employeeId) {
    docUploadEmployeeId = employeeId;
    document.getElementById('docUploadForm').reset();
    document.getElementById('docUploadHint').textContent = '';
    openModal('docUploadModal');
  }

  document.getElementById('docUploadForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!docUploadEmployeeId) return;
    var fileInput = document.getElementById('docFile');
    if (!fileInput.files.length) {
      document.getElementById('docUploadHint').textContent = t('File is required', 'الملف مطلوب');
      return;
    }
    var fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('documentType', document.getElementById('docType').value);
    if (document.getElementById('docIssue').value) fd.append('issueDate', document.getElementById('docIssue').value);
    if (document.getElementById('docExpiry').value) fd.append('expiryDate', document.getElementById('docExpiry').value);
    var notes = document.getElementById('docNotes').value.trim();
    if (notes) fd.append('notes', notes);

    var btn = document.getElementById('btnSaveDocUpload');
    btn.disabled = true;
    try {
      var resp = await fetch(API_BASE + '/hr/employees/' + docUploadEmployeeId + '/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken(), 'ngrok-skip-browser-warning': 'true' },
        body: fd
      });
      var data = await resp.json().catch(function () { return null; });
      btn.disabled = false;
      if (!resp.ok) {
        document.getElementById('docUploadHint').textContent =
          (data && (data.message || (data.error && data.error.message) || data.error)) || t('Upload failed', 'فشل الرفع');
        return;
      }
      closeModal('docUploadModal');
      toast(t('Uploaded', 'تم الرفع'), 'ok');
      if (drawerEmployeeId === docUploadEmployeeId && drawerTab === 'documents') renderTabPanel();
    } catch (err) {
      btn.disabled = false;
      document.getElementById('docUploadHint').textContent = t('Upload failed', 'فشل الرفع');
    }
  });

  // ── Link Staff ──
  async function openLinkStaff(employeeId) {
    linkStaffEmployeeId = employeeId;
    selectedAppUserId = null;
    availableStaff = [];
    document.getElementById('linkStaffSearch').value = '';
    document.getElementById('linkStaffHint').textContent = '';
    document.getElementById('btnConfirmLinkStaff').disabled = true;
    document.getElementById('linkStaffList').innerHTML =
      '<div class="staff-pick-empty"><div class="loader"></div></div>';
    openModal('linkStaffModal');

    var r = await Gfp.get('/hr/employees/' + employeeId + '/available-staff');
    if (!r.ok) {
      document.getElementById('linkStaffList').innerHTML =
        '<div class="staff-pick-empty">' + esc(apiError(r)) + '</div>';
      return;
    }
    availableStaff = Array.isArray(r.data) ? r.data : [];
    renderStaffPicker();
  }

  function filteredStaff() {
    var q = (document.getElementById('linkStaffSearch').value || '').trim().toLowerCase();
    if (!q) return availableStaff;
    return availableStaff.filter(function (s) {
      var hay = [s.fullName, s.email, s.role, s.staffNumber].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function renderStaffPicker() {
    var list = filteredStaff();
    var host = document.getElementById('linkStaffList');
    if (!availableStaff.length) {
      host.innerHTML = '<div class="staff-pick-empty">' +
        esc(t('No eligible Staff accounts. Create Staff under Admin → Staff first.', 'لا توجد حسابات مؤهلة. أنشئ الحساب من الإدارة ← الموظفين أولاً.')) +
        '</div>';
      return;
    }
    if (!list.length) {
      host.innerHTML = '<div class="staff-pick-empty">' + esc(t('No matches.', 'لا نتائج.')) + '</div>';
      return;
    }
    host.innerHTML = list.map(function (s) {
      var sid = String(s.appUserId);
      var selected = selectedAppUserId === sid;
      return '<label class="staff-pick-row' + (selected ? ' selected' : '') + '">' +
        '<input type="radio" name="linkStaffPick" value="' + esc(sid) + '"' + (selected ? ' checked' : '') + '>' +
        '<div class="staff-pick-body">' +
        '<div class="name">' + esc(s.fullName || '—') + '</div>' +
        '<div class="email">' + esc(s.email || '') + '</div>' +
        '<div class="tags">' +
        (s.role ? '<span class="staff-tag">' + esc(s.role) + '</span>' : '') +
        '<span class="staff-tag ' + (s.isActive ? 'active' : 'inactive') + '">' +
        esc(s.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) +
        '</span>' +
        (s.staffNumber ? '<span class="staff-tag">' + esc(s.staffNumber) + '</span>' : '') +
        '</div>' +
        '</div>' +
        '</label>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('input[name="linkStaffPick"]'), function (inp) {
      inp.addEventListener('change', function () {
        selectedAppUserId = inp.value;
        document.getElementById('btnConfirmLinkStaff').disabled = !selectedAppUserId;
        renderStaffPicker();
      });
    });
  }

  document.getElementById('linkStaffSearch').addEventListener('input', function () {
    renderStaffPicker();
  });

  document.getElementById('btnConfirmLinkStaff').addEventListener('click', async function () {
    if (!linkStaffEmployeeId || !selectedAppUserId) return;
    var hint = document.getElementById('linkStaffHint');
    var btn = document.getElementById('btnConfirmLinkStaff');
    hint.textContent = '';
    btn.disabled = true;
    var r = await Gfp.post('/hr/employees/' + linkStaffEmployeeId + '/link-staff', {
      appUserId: selectedAppUserId
    });
    if (!r.ok) {
      hint.textContent = apiError(r);
      btn.disabled = false;
      return;
    }
    closeModal('linkStaffModal');
    toast(t('Staff account linked', 'تم ربط حساب الدخول'), 'ok');
    loadList();
    if (drawerEmployeeId === linkStaffEmployeeId) openDrawer(linkStaffEmployeeId);
  });

  // ── Unlink Staff ──
  function openUnlinkStaff(employeeId) {
    unlinkStaffEmployeeId = employeeId;
    document.getElementById('unlinkStaffHint').textContent = '';
    openModal('unlinkStaffModal');
  }

  document.getElementById('btnConfirmUnlinkStaff').addEventListener('click', async function () {
    if (!unlinkStaffEmployeeId) return;
    var hint = document.getElementById('unlinkStaffHint');
    var btn = document.getElementById('btnConfirmUnlinkStaff');
    hint.textContent = '';
    btn.disabled = true;
    var r = await Gfp.post('/hr/employees/' + unlinkStaffEmployeeId + '/unlink-staff');
    btn.disabled = false;
    if (!r.ok) {
      hint.textContent = apiError(r);
      return;
    }
    closeModal('unlinkStaffModal');
    toast(t('Staff account unlinked', 'تم فك ربط حساب الدخول'), 'ok');
    loadList();
    if (drawerEmployeeId === unlinkStaffEmployeeId) openDrawer(unlinkStaffEmployeeId);
  });

  // ── Add contract ──
  var contractEmployeeId = null;
  function openAddContract(employeeId) {
    contractEmployeeId = employeeId;
    document.getElementById('contractForm').reset();
    document.getElementById('contractHint').textContent = '';
    openModal('contractModal');
  }

  document.getElementById('contractForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var body = {
      employmentType: document.getElementById('cType').value,
      basicSalary: Number(document.getElementById('cSalary').value),
      startDate: document.getElementById('cStart').value,
      endDate: document.getElementById('cEnd').value || null,
      workingHoursPerDay: document.getElementById('cHours').value ? Number(document.getElementById('cHours').value) : null,
      workingDaysPerWeek: document.getElementById('cDays').value ? Number(document.getElementById('cDays').value) : null,
      notes: document.getElementById('cNotes').value.trim() || null
    };
    if (!body.startDate || !(body.basicSalary >= 0)) {
      document.getElementById('contractHint').textContent = t('Start date and basic salary are required', 'تاريخ البدء والراتب الأساسي مطلوبان');
      return;
    }
    var btn = document.getElementById('btnSaveContract');
    btn.disabled = true;
    var r = await Gfp.post('/hr/employees/' + contractEmployeeId + '/contracts', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('contractHint').textContent = apiError(r);
      return;
    }
    closeModal('contractModal');
    toast(t('Contract added', 'تم إضافة العقد'), 'ok');
    if (drawerEmployeeId === contractEmployeeId) openDrawer(contractEmployeeId);
  });

  // ── Terminate ──
  var terminateEmployeeId = null;
  function openTerminate(employeeId) {
    terminateEmployeeId = employeeId;
    document.getElementById('termForm').reset();
    document.getElementById('termHint').textContent = '';
    openModal('termModal');
  }

  document.getElementById('termForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var body = {
      terminationDate: document.getElementById('tDate').value,
      notes: document.getElementById('tNotes').value.trim() || null
    };
    if (!body.terminationDate) {
      document.getElementById('termHint').textContent = t('Termination date is required', 'تاريخ إنهاء الخدمة مطلوب');
      return;
    }
    var btn = document.getElementById('btnConfirmTerm');
    btn.disabled = true;
    var r = await Gfp.post('/hr/employees/' + terminateEmployeeId + '/terminate', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('termHint').textContent = apiError(r);
      return;
    }
    closeModal('termModal');
    toast(t('Employee terminated', 'تم إنهاء خدمة الموظف'), 'ok');
    loadList();
    if (drawerEmployeeId === terminateEmployeeId) openDrawer(terminateEmployeeId);
  });

  // ══════════════════════════════════════════════
  // Onboarding wizard
  // ══════════════════════════════════════════════
  function defaultOnboardData() {
    return {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      nationalId: '',
      dateOfBirth: '',
      address: '',
      hireDate: cairoDateIso(),
      departmentId: '',
      positionId: '',
      status: 'Active',
      includeContract: false,
      employmentType: 'FullTime',
      basicSalary: '',
      contractStartDate: '',
      scheduleShiftId: '',
      scheduleFrom: '',
      scheduleTo: '',
      scheduleNote: '',
      needAccess: null, // true | false | null
      linkAppUserId: null,
      linkStaffLabel: '',
      createStaff: false,
      staffEmail: '',
      staffPassword: '',
      staffRole: 'Receptionist'
    };
  }

  function openOnboard() {
    onboardStep = 0;
    onboardData = defaultOnboardData();
    onboardStaffList = [];
    onboardCreating = false;
    document.getElementById('onboardHint').textContent = '';
    openModal('onboardModal');
    renderOnboard();
    prefetchStaffForOnboard();
  }

  async function prefetchStaffForOnboard() {
    var r = await Gfp.get('/admin/staff');
    if (r.ok && Array.isArray(r.data)) {
      onboardStaffList = r.data;
    } else {
      onboardStaffList = [];
    }
  }

  function stepMeta(i) {
    var names = [
      ['Personal', 'البيانات الشخصية'],
      ['Employment', 'التوظيف'],
      ['Compensation', 'التعويضات'],
      ['Schedule', 'الجدول'],
      ['System Access', 'صلاحية الدخول'],
      ['Review', 'مراجعة']
    ];
    return names[i];
  }

  function renderOnboard() {
    var stepsHost = document.getElementById('onboardSteps');
    stepsHost.innerHTML = ONBOARD_STEPS.map(function (_, i) {
      var meta = stepMeta(i);
      var cls = 'onboard-step';
      if (i === onboardStep) cls += ' act';
      else if (i < onboardStep) cls += ' done';
      return '<span class="' + cls + '">' + (i + 1) + '. ' + esc(t(meta[0], meta[1])) + '</span>';
    }).join('');

    var panel = document.getElementById('onboardPanel');
    var d = onboardData;
    var key = ONBOARD_STEPS[onboardStep];
    document.getElementById('onboardHint').textContent = '';

    if (key === 'personal') {
      panel.innerHTML =
        '<div class="form-grid">' +
        '<label class="fg"><span>' + esc(t('First name *', 'الاسم الأول *')) + '</span><input id="obFirstName" maxlength="100" value="' + esc(d.firstName) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Last name *', 'اسم العائلة *')) + '</span><input id="obLastName" maxlength="100" value="' + esc(d.lastName) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Phone', 'الهاتف')) + '</span><input id="obPhone" maxlength="20" dir="ltr" value="' + esc(d.phone) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Email', 'البريد')) + '</span><input id="obEmail" type="email" maxlength="256" dir="ltr" value="' + esc(d.email) + '"></label>' +
        '<label class="fg"><span>' + esc(t('National ID', 'الرقم القومي')) + '</span><input id="obNationalId" maxlength="30" dir="ltr" value="' + esc(d.nationalId) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Date of birth', 'تاريخ الميلاد')) + '</span><input id="obDob" type="date" value="' + esc(d.dateOfBirth) + '"></label>' +
        '</div>' +
        '<label class="fg" style="margin-top:12px"><span>' + esc(t('Address', 'العنوان')) + '</span><input id="obAddress" maxlength="300" value="' + esc(d.address) + '"></label>';
    } else if (key === 'employment') {
      var deptOpts = '<option value="">' + esc(t('None', 'بدون')) + '</option>' + departments.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (String(d.departmentId) === String(x.id) ? ' selected' : '') + '>' + esc(x.name) + '</option>';
      }).join('');
      var posOpts = '<option value="">' + esc(t('None', 'بدون')) + '</option>' + positions.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (String(d.positionId) === String(x.id) ? ' selected' : '') + '>' + esc(x.name) + '</option>';
      }).join('');
      panel.innerHTML =
        '<div class="form-grid">' +
        '<label class="fg"><span>' + esc(t('Hire date *', 'تاريخ التعيين *')) + '</span><input id="obHireDate" type="date" value="' + esc(d.hireDate) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Status', 'الحالة')) + '</span><input value="' + esc(t('Active', 'نشط')) + '" disabled></label>' +
        '<label class="fg"><span>' + esc(t('Department', 'القسم')) + '</span><select id="obDepartment">' + deptOpts + '</select></label>' +
        '<label class="fg"><span>' + esc(t('Position', 'المسمى الوظيفي')) + '</span><select id="obPosition">' + posOpts + '</select></label>' +
        '</div>' +
        '<p class="form-hint" style="margin-top:10px">' +
        '<a href="/dashboard/hr/settings/?tab=departments" target="_self">' +
        esc(t('Add or edit departments & positions', 'إضافة أو تعديل الأقسام والمسميات')) +
        '</a>' +
        '</p>';
    } else if (key === 'compensation') {
      panel.innerHTML =
        '<p class="page-subtitle" style="margin-bottom:12px">' + esc(t('Optional first contract. You can skip and add later.', 'عقد أول اختياري. يمكنك التخطي والإضافة لاحقاً.')) + '</p>' +
        '<div class="form-grid">' +
        '<label class="fg"><span>' + esc(t('Employment type', 'نوع التوظيف')) + '</span>' +
        '<select id="obEmpType">' +
        ['FullTime', 'PartTime', 'Temporary', 'Contract'].map(function (v) {
          return '<option value="' + v + '"' + (d.employmentType === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join('') +
        '</select></label>' +
        '<label class="fg"><span>' + esc(t('Basic salary (EGP)', 'الراتب الأساسي (جنيه)')) + '</span><input id="obSalary" type="number" min="0" step="0.01" value="' + esc(d.basicSalary) + '"></label>' +
        '<label class="fg"><span>' + esc(t('Start date', 'تاريخ البدء')) + '</span><input id="obContractStart" type="date" value="' + esc(d.contractStartDate || d.hireDate) + '"></label>' +
        '</div>';
    } else if (key === 'schedule') {
      renderOnboardScheduleStep(panel, d);
    } else if (key === 'systemAccess') {
      renderOnboardSystemAccess(panel);
    } else if (key === 'review') {
      panel.innerHTML =
        '<div class="drawer-sec">' +
        '<div class="kv"><span>' + esc(t('Name', 'الاسم')) + '</span><span>' + esc(d.firstName + ' ' + d.lastName) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Phone', 'الهاتف')) + '</span><span>' + esc(d.phone || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Email', 'البريد')) + '</span><span>' + esc(d.email || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Hire date', 'تاريخ التعيين')) + '</span><span>' + esc(d.hireDate) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Department', 'القسم')) + '</span><span>' + esc(deptName(d.departmentId)) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Position', 'المسمى الوظيفي')) + '</span><span>' + esc(posName(d.positionId)) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('First contract', 'العقد الأول')) + '</span><span>' +
        esc(d.includeContract ? (d.employmentType + ' · ' + money(d.basicSalary)) : t('Skipped', 'تم التخطي')) + '</span></div>' +
        '<div class="kv"><span>' + esc(t('System access', 'صلاحية الدخول')) + '</span><span>' +
        esc(d.needAccess === false
          ? t('No login (later)', 'بدون دخول (لاحقاً)')
          : (d.createStaff
            ? t('Create Staff', 'إنشاء حساب') + ' · ' + (d.staffEmail || '')
            : (d.linkAppUserId
              ? t('Link', 'ربط') + ' · ' + (d.linkStaffLabel || d.linkAppUserId)
              : t('Yes — choose later', 'نعم — اختيار لاحقاً')))) +
        '</span></div>' +
        '</div>';
    }

    var back = document.getElementById('btnOnboardBack');
    var skip = document.getElementById('btnOnboardSkip');
    var next = document.getElementById('btnOnboardNext');
    var create = document.getElementById('btnOnboardCreate');
    back.hidden = onboardStep === 0;
    var skippable = key === 'compensation' || key === 'schedule' || key === 'systemAccess';
    skip.hidden = !skippable;
    next.hidden = key === 'review';
    create.hidden = key !== 'review';
    applyLocale();
  }

  function matchStaffCandidates(d) {
    if (!onboardStaffList.length) return [];
    var email = (d.email || '').trim().toLowerCase();
    var phone = (d.phone || '').trim().replace(/\s+/g, '');
    var name = ((d.firstName || '') + ' ' + (d.lastName || '')).trim().toLowerCase();
    var scored = [];
    onboardStaffList.forEach(function (s) {
      if (s.linkedEmployee && s.linkedEmployee.linked) return;
      var score = 0;
      var semail = (s.email || '').toLowerCase();
      var sphone = (s.phoneNumber || '').replace(/\s+/g, '');
      var sname = (s.fullName || '').toLowerCase();
      if (email && semail && email === semail) score += 100;
      if (phone && sphone && phone === sphone) score += 80;
      if (name && sname && (sname.indexOf(name) !== -1 || name.indexOf(sname) !== -1)) score += 40;
      if (score > 0 && s.appUserId) scored.push({ staff: s, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 5).map(function (x) { return x.staff; });
  }

  function renderOnboardScheduleStep(panel, d) {
    panel.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    Gfp.get('/hr/employee-shifts').then(function (r) {
      var templates = r.ok && Array.isArray(r.data) ? r.data : [];
      var from = d.scheduleFrom || d.hireDate || cairoDateIso();
      var to = d.scheduleTo || addDays(from, 6);
      var shiftOpts = '<option value="">' + esc(t('Skip — assign later in employee drawer', 'تخطَّ — عيّن لاحقاً من بطاقة الموظف')) + '</option>' +
        templates.map(function (s) {
          var label = s.name + ' (' + hhmm(s.startTime) + '–' + hhmm(s.endTime) + ')';
          return '<option value="' + esc(s.id) + '"' + (String(d.scheduleShiftId) === String(s.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join('');
      panel.innerHTML =
        '<p class="page-subtitle" style="margin-bottom:12px">' +
        esc(t('Assign the first week here — saved when you create the employee. Stay on this wizard.', 'عيّن أول أسبوع هنا — يُحفظ عند إنشاء الموظف. ابقَ في هذا المعالج.')) +
        '</p>' +
        (templates.length
          ? '<div class="form-grid">' +
          '<label class="fg"><span>' + esc(t('Shift template', 'قالب الوردية')) + '</span><select id="obScheduleShift">' + shiftOpts + '</select></label>' +
          '<label class="fg"><span>' + esc(t('From date', 'من تاريخ')) + '</span><input id="obScheduleFrom" type="date" value="' + esc(from) + '"></label>' +
          '<label class="fg"><span>' + esc(t('To date', 'إلى تاريخ')) + '</span><input id="obScheduleTo" type="date" value="' + esc(to) + '"></label>' +
          '<label class="fg span2"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><textarea id="obScheduleNote" rows="2" maxlength="500">' + esc(d.scheduleNote) + '</textarea></label>' +
          '</div>'
          : '<p class="form-hint" style="color:var(--ltt)">' +
          esc(t('No shift templates yet — skip this step.', 'لا توجد قوالب ورديات — تخطَّ هذه الخطوة.')) +
          '</p><label class="fg"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><textarea id="obScheduleNote" rows="2" maxlength="500">' + esc(d.scheduleNote) + '</textarea></label>');
    });
  }

  function renderOnboardSystemAccess(panel) {
    var d = onboardData;
    var matches = matchStaffCandidates(d);
    var html =
      '<p class="page-subtitle">' + esc(t('Does this employee need HyMotion access?', 'هل يحتاج هذا الموظف إلى صلاحية دخول HyMotion؟')) + '</p>' +
      '<div class="choice-row">' +
      '<div class="choice-card' + (d.needAccess === true ? ' act' : '') + '" data-ob-access="yes"><strong>' + esc(t('Yes', 'نعم')) + '</strong><span>' + esc(t('Link or create a Staff login', 'ربط أو إنشاء حساب دخول')) + '</span></div>' +
      '<div class="choice-card' + (d.needAccess === false ? ' act' : '') + '" data-ob-access="no"><strong>' + esc(t('No, later', 'لا، لاحقاً')) + '</strong><span>' + esc(t('AppUserId stays empty', 'يبقى بدون حساب دخول')) + '</span></div>' +
      '</div>';

    if (d.needAccess === true) {
      if (matches.length) {
        html += '<h3 style="font-size:12px;text-transform:uppercase;color:var(--ltt);margin:14px 0 8px">' + esc(t('Staff account found', 'تم العثور على حساب')) + '</h3>';
        html += '<div class="staff-pick-list">' + matches.map(function (s) {
          var aid = String(s.appUserId);
          var selected = String(d.linkAppUserId) === aid && !d.createStaff;
          return '<label class="staff-pick-row' + (selected ? ' selected' : '') + '">' +
            '<input type="radio" name="obStaffPick" value="' + esc(aid) + '"' + (selected ? ' checked' : '') + '>' +
            '<div class="staff-pick-body"><div class="name">' + esc(s.fullName || '—') + '</div><div class="email">' + esc(s.email || '') + '</div>' +
            '<div class="tags">' + (s.role ? '<span class="staff-tag">' + esc(s.role) + '</span>' : '') + '</div></div></label>';
        }).join('') + '</div>';
      } else if (!onboardStaffList.length) {
        html += '<p class="form-hint" style="color:var(--ltt);margin-top:12px">' +
          esc(t('Could not load Staff list (Owner-only) or no matches. You can link after create from System Access.', 'تعذر تحميل قائمة الحسابات أو لا توجد مطابقات. يمكنك الربط بعد الإنشاء من صلاحية الدخول.')) +
          '</p>';
      } else {
        html += '<p class="form-hint" style="color:var(--ltt);margin-top:12px">' +
          esc(t('No matching Staff found by email/phone/name.', 'لا يوجد حساب مطابق بالبريد/الهاتف/الاسم.')) +
          '</p>';
      }

      if (isOwner) {
        html +=
          '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--ls3)">' +
          '<label class="chk"><input type="checkbox" id="obCreateStaff"' + (d.createStaff ? ' checked' : '') + '> ' +
          esc(t('Create new Staff account (Owner)', 'إنشاء حساب دخول جديد (للمالك)')) + '</label>' +
          '<div id="obCreateStaffFields" ' + (d.createStaff ? '' : 'hidden') + ' style="margin-top:10px">' +
          '<div class="form-grid">' +
          '<label class="fg"><span>' + esc(t('Staff email *', 'بريد الحساب *')) + '</span><input id="obStaffEmail" type="email" dir="ltr" value="' + esc(d.staffEmail || d.email) + '"></label>' +
          '<label class="fg"><span>' + esc(t('Password *', 'كلمة المرور *')) + '</span><input id="obStaffPassword" type="password" value="' + esc(d.staffPassword) + '"></label>' +
          '<label class="fg"><span>' + esc(t('Role *', 'الدور *')) + '</span>' +
          '<select id="obStaffRole">' +
          ['Manager', 'Trainer', 'Receptionist'].map(function (r) {
            return '<option value="' + r + '"' + (d.staffRole === r ? ' selected' : '') + '>' + esc(r) + '</option>';
          }).join('') +
          '</select></label>' +
          '</div>' +
          '</div>' +
          '</div>';
      } else {
        html += '<p class="form-hint" style="color:var(--ltt);margin-top:12px">' +
          esc(t('Managers can link an existing Staff account or skip. Creating Staff requires Owner.', 'المديرون يمكنهم ربط حساب موجود أو التخطي. إنشاء الحساب يتطلب المالك.')) +
          '</p>';
      }
    }

    panel.innerHTML = html;

    Array.prototype.forEach.call(panel.querySelectorAll('[data-ob-access]'), function (card) {
      card.addEventListener('click', function () {
        collectOnboardStep();
        onboardData.needAccess = card.getAttribute('data-ob-access') === 'yes';
        if (!onboardData.needAccess) {
          onboardData.linkAppUserId = null;
          onboardData.createStaff = false;
        }
        renderOnboard();
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll('input[name="obStaffPick"]'), function (inp) {
      inp.addEventListener('change', function () {
        onboardData.createStaff = false;
        onboardData.linkAppUserId = inp.value;
        var match = matches.filter(function (s) { return String(s.appUserId) === inp.value; })[0];
        onboardData.linkStaffLabel = match ? (match.fullName || match.email) : inp.value;
        var cb = document.getElementById('obCreateStaff');
        if (cb) cb.checked = false;
        renderOnboard();
      });
    });
    var createCb = document.getElementById('obCreateStaff');
    if (createCb) {
      createCb.addEventListener('change', function () {
        onboardData.createStaff = createCb.checked;
        if (onboardData.createStaff) onboardData.linkAppUserId = null;
        renderOnboard();
      });
    }
  }

  function collectOnboardStep() {
    var key = ONBOARD_STEPS[onboardStep];
    var d = onboardData;
    if (key === 'personal') {
      var fn = document.getElementById('obFirstName');
      if (!fn) return;
      d.firstName = fn.value.trim();
      d.lastName = document.getElementById('obLastName').value.trim();
      d.phone = document.getElementById('obPhone').value.trim();
      d.email = document.getElementById('obEmail').value.trim();
      d.nationalId = document.getElementById('obNationalId').value.trim();
      d.dateOfBirth = document.getElementById('obDob').value;
      d.address = document.getElementById('obAddress').value.trim();
    } else if (key === 'employment') {
      var hd = document.getElementById('obHireDate');
      if (!hd) return;
      d.hireDate = hd.value;
      d.departmentId = document.getElementById('obDepartment').value;
      d.positionId = document.getElementById('obPosition').value;
      if (!d.contractStartDate) d.contractStartDate = d.hireDate;
    } else if (key === 'compensation') {
      var sal = document.getElementById('obSalary');
      if (!sal) return;
      d.employmentType = document.getElementById('obEmpType').value;
      d.basicSalary = sal.value;
      d.contractStartDate = document.getElementById('obContractStart').value || d.hireDate;
      d.includeContract = d.basicSalary !== '' && Number(d.basicSalary) >= 0 && !!d.contractStartDate;
    } else if (key === 'schedule') {
      var shiftSel = document.getElementById('obScheduleShift');
      if (shiftSel) {
        d.scheduleShiftId = shiftSel.value;
        var fromEl = document.getElementById('obScheduleFrom');
        var toEl = document.getElementById('obScheduleTo');
        if (fromEl) d.scheduleFrom = fromEl.value;
        if (toEl) d.scheduleTo = toEl.value;
      }
      var note = document.getElementById('obScheduleNote');
      if (note) d.scheduleNote = note.value.trim();
    } else if (key === 'systemAccess') {
      if (document.getElementById('obStaffEmail')) {
        d.staffEmail = document.getElementById('obStaffEmail').value.trim();
        d.staffPassword = document.getElementById('obStaffPassword').value;
        d.staffRole = document.getElementById('obStaffRole').value;
      }
    }
  }

  function validateOnboardStep() {
    var key = ONBOARD_STEPS[onboardStep];
    var d = onboardData;
    var hint = document.getElementById('onboardHint');
    if (key === 'personal') {
      if (!d.firstName || !d.lastName) {
        hint.textContent = t('First and last name are required', 'الاسم الأول والأخير مطلوبان');
        return false;
      }
    } else if (key === 'employment') {
      if (!d.hireDate) {
        hint.textContent = t('Hire date is required', 'تاريخ التعيين مطلوب');
        return false;
      }
    } else if (key === 'compensation') {
      if (d.basicSalary !== '' && !(Number(d.basicSalary) >= 0)) {
        hint.textContent = t('Basic salary must be zero or greater', 'الراتب الأساسي يجب أن يكون صفراً أو أكثر');
        return false;
      }
      if (d.basicSalary !== '' && !d.contractStartDate) {
        hint.textContent = t('Contract start date is required when salary is set', 'تاريخ بدء العقد مطلوب عند تحديد الراتب');
        return false;
      }
      d.includeContract = d.basicSalary !== '' && Number(d.basicSalary) >= 0 && !!d.contractStartDate;
    } else if (key === 'systemAccess') {
      if (d.needAccess === true && d.createStaff) {
        if (!d.staffEmail || !d.staffPassword) {
          hint.textContent = t('Staff email and password are required', 'بريد الحساب وكلمة المرور مطلوبان');
          return false;
        }
        if (d.staffPassword.length < 6) {
          hint.textContent = t('Password must be at least 6 characters', 'كلمة المرور 6 أحرف على الأقل');
          return false;
        }
      }
    }
    return true;
  }

  document.getElementById('btnOnboardBack').addEventListener('click', function () {
    collectOnboardStep();
    if (onboardStep > 0) {
      onboardStep -= 1;
      renderOnboard();
    }
  });

  document.getElementById('btnOnboardSkip').addEventListener('click', function () {
    collectOnboardStep();
    var key = ONBOARD_STEPS[onboardStep];
    if (key === 'compensation') {
      onboardData.includeContract = false;
      onboardData.basicSalary = '';
    }
    if (key === 'systemAccess') {
      onboardData.needAccess = false;
      onboardData.linkAppUserId = null;
      onboardData.createStaff = false;
    }
    if (onboardStep < ONBOARD_STEPS.length - 1) {
      onboardStep += 1;
      renderOnboard();
    }
  });

  document.getElementById('btnOnboardNext').addEventListener('click', function () {
    collectOnboardStep();
    if (!validateOnboardStep()) return;
    if (onboardStep < ONBOARD_STEPS.length - 1) {
      onboardStep += 1;
      renderOnboard();
    }
  });

  document.getElementById('btnOnboardCreate').addEventListener('click', async function () {
    collectOnboardStep();
    if (onboardCreating) return;
    var d = onboardData;
    if (!d.firstName || !d.lastName || !d.hireDate) {
      document.getElementById('onboardHint').textContent = t('Personal name and hire date are required', 'الاسم وتاريخ التعيين مطلوبان');
      return;
    }
    onboardCreating = true;
    var btn = document.getElementById('btnOnboardCreate');
    btn.disabled = true;
    document.getElementById('onboardHint').textContent = '';

    var body = {
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone || null,
      email: d.email || null,
      nationalId: d.nationalId || null,
      dateOfBirth: d.dateOfBirth || null,
      hireDate: d.hireDate,
      departmentId: d.departmentId || null,
      positionId: d.positionId || null,
      address: d.address || null
    };

    var r = await Gfp.post('/hr/employees', body);
    if (!r.ok) {
      document.getElementById('onboardHint').textContent = apiError(r);
      onboardCreating = false;
      btn.disabled = false;
      return;
    }
    var empId = r.data && r.data.id;
    if (!empId) {
      document.getElementById('onboardHint').textContent = t('Employee created but id missing', 'تم الإنشاء لكن المعرّف مفقود');
      onboardCreating = false;
      btn.disabled = false;
      return;
    }

    if (d.scheduleShiftId && d.scheduleFrom && d.scheduleTo) {
      var sbr = await Gfp.post('/hr/employee-schedules/bulk', {
        employeeIds: [empId],
        employeeShiftId: d.scheduleShiftId,
        dateFrom: d.scheduleFrom,
        dateTo: d.scheduleTo
      });
      if (!sbr.ok) {
        toast(t('Employee created, but schedule assign failed: ', 'تم إنشاء الموظف لكن فشل تعيين الجدول: ') + apiError(sbr), 'err');
      } else {
        drawerTab = 'schedule';
      }
    }

    if (d.includeContract) {
      var cr = await Gfp.post('/hr/employees/' + empId + '/contracts', {
        employmentType: d.employmentType || 'FullTime',
        basicSalary: Number(d.basicSalary),
        startDate: d.contractStartDate || d.hireDate,
        endDate: null,
        notes: null
      });
      if (!cr.ok) {
        toast(t('Employee created, but contract failed: ', 'تم إنشاء الموظف لكن فشل العقد: ') + apiError(cr), 'err');
      }
    }

    var appUserIdToLink = d.linkAppUserId || null;
    if (d.needAccess && d.createStaff && isOwner) {
      var fullName = (d.firstName + ' ' + d.lastName).trim();
      var sr = await Gfp.post('/admin/staff', {
        fullName: fullName,
        email: d.staffEmail,
        password: d.staffPassword,
        role: d.staffRole || 'Receptionist',
        phoneNumber: d.phone || null,
        hireDate: d.hireDate || null
      });
      if (!sr.ok) {
        toast(t('Employee created, but Staff create failed: ', 'تم إنشاء الموظف لكن فشل إنشاء الحساب: ') + apiError(sr), 'err');
      } else if (sr.data && sr.data.appUserId) {
        appUserIdToLink = sr.data.appUserId;
      } else if (sr.data && sr.data.id) {
        // Fallback: fetch detail for appUserId
        var detail = await Gfp.get('/admin/staff/' + sr.data.id);
        if (detail.ok && detail.data && detail.data.appUserId) {
          appUserIdToLink = detail.data.appUserId;
        }
      }
    }

    if (appUserIdToLink) {
      var lr = await Gfp.post('/hr/employees/' + empId + '/link-staff', { appUserId: appUserIdToLink });
      if (!lr.ok) {
        toast(t('Employee created, but Staff link failed: ', 'تم إنشاء الموظف لكن فشل الربط: ') + apiError(lr), 'err');
      }
    }

    closeModal('onboardModal');
    toast(t('Employee created', 'تم إنشاء الموظف'), 'ok');
    onboardCreating = false;
    btn.disabled = false;
    await loadList();
    openDrawer(empId);
  });

  (async function init() {
    await loadReferenceData();
    await loadList();
    try {
      var openId = new URLSearchParams(window.location.search).get('id') ||
        new URLSearchParams(window.location.search).get('employeeId');
      if (openId) await openDrawer(openId);
    } catch (e) { /* ignore */ }
  })();
})();
