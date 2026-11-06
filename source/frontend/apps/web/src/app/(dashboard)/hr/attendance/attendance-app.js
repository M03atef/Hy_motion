/**
 * HR Phase 3 — Attendance: check-in/check-out and history. Separate from member gym
 * check-in (Attendance page under Members) — this tracks staff working hours.
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

  var canManage = Authz && Authz.useCan('hr.attendance.manage');
  var canView = canManage || (Authz && Authz.useCan('hr.attendance.view'));
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var employees = [];
  var rows = [];
  var dateMode = 'today';
  var correctingId = null;

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
  /** Calendar date in Africa/Cairo (matches backend attendance date grain). */
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
  /**
   * API stores UTC (CheckInAtUtc) but JSON often omits trailing Z.
   * Without Z, browsers treat the value as local wall-clock — 3h off in Egypt.
   */
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
    if (!n) return '—';
    var h = Math.floor(n / 60), m = n % 60;
    return (h > 0 ? h + 'h ' : '') + m + 'm';
  }
  function toLocalInputValue(utcIso) {
    if (!utcIso) return '';
    var d = parseApiUtc(utcIso);
    if (!d) return '';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInputValue(value) {
    return value ? new Date(value).toISOString() : null;
  }
  function statusLabel(s) {
    var map = {
      Present: ['Present', 'حاضر'], Late: ['Late', 'متأخر'], Absent: ['Absent', 'غائب'],
      HalfDay: ['Half day', 'نصف يوم'], OnLeave: ['On leave', 'إجازة']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function statusClass(s) {
    if (s === 'Present') return 'active';
    if (s === 'Absent') return 'terminated';
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
    var filterSel = document.getElementById('filterEmployee');
    var ciSel = document.getElementById('ciEmployee');
    employees.forEach(function (e) {
      var name = e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')';
      filterSel.appendChild(new Option(name, e.id));
      if (ciSel) ciSel.appendChild(new Option(name, e.id));
    });
  }

  function currentRange() {
    var today = cairoDateIso(new Date());
    if (dateMode === 'today') return { from: today, to: today };
    if (dateMode === 'week') return { from: today, to: addDays(today, 6) };
    var from = document.getElementById('customFrom').value || today;
    var to = document.getElementById('customTo').value || from;
    return { from: from, to: to };
  }

  function setDateMode(mode) {
    dateMode = mode;
    Array.prototype.forEach.call(document.querySelectorAll('.date-chip'), function (c) {
      c.classList.toggle('act', c.getAttribute('data-mode') === mode);
    });
    var isCustom = mode === 'custom';
    document.getElementById('customFrom').hidden = !isCustom;
    document.getElementById('customSep').hidden = !isCustom;
    document.getElementById('customTo').hidden = !isCustom;
    if (isCustom && !document.getElementById('customFrom').value) {
      var today = cairoDateIso(new Date());
      document.getElementById('customFrom').value = today;
      document.getElementById('customTo').value = today;
    }
    loadList();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.date-chip'), function (chip) {
    chip.addEventListener('click', function () { setDateMode(chip.getAttribute('data-mode')); });
  });
  document.getElementById('customFrom').addEventListener('change', loadList);
  document.getElementById('customTo').addEventListener('change', loadList);
  document.getElementById('filterEmployee').addEventListener('change', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);
  document.getElementById('btnRefresh').addEventListener('click', loadList);

  if (document.getElementById('btnCheckIn')) {
    document.getElementById('btnCheckIn').addEventListener('click', async function () {
      var employeeId = document.getElementById('ciEmployee').value;
      if (!employeeId) {
        toast(t('Select an employee first', 'اختر موظفاً أولاً'), 'err');
        return;
      }
      var r = await Gfp.post('/hr/employee-attendance/check-in', { employeeId: employeeId });
      if (!r.ok) {
        toast(apiError(r), 'err');
        return;
      }
      toast(t('Checked in', 'تم تسجيل الحضور'), 'ok');
      loadList();
    });
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var range = currentRange();
    var params = ['from=' + range.from, 'to=' + range.to];
    var employeeId = document.getElementById('filterEmployee').value;
    if (employeeId) params.push('employeeId=' + encodeURIComponent(employeeId));
    var status = document.getElementById('filterStatus').value;
    if (status) params.push('status=' + encodeURIComponent(status));

    var r = await Gfp.get('/hr/employee-attendance?' + params.join('&'));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No attendance records in this range.', 'لا توجد سجلات حضور في هذا النطاق.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Date', 'التاريخ')) + '</th>' +
      '<th>' + esc(t('Check In', 'الحضور')) + '</th>' +
      '<th>' + esc(t('Check Out', 'الانصراف')) + '</th>' +
      '<th>' + esc(t('Worked', 'ساعات العمل')) + '</th>' +
      '<th>' + esc(t('Late', 'التأخير')) + '</th>' +
      '<th>' + esc(t('Overtime', 'الوقت الإضافي')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    rows.forEach(function (a) {
      var canCheckOut = canManage && a.checkInAtUtc && !a.checkOutAtUtc;
      html += '<tr>' +
        '<td><div class="person-name">' + esc(a.employeeName) + '</div><div class="person-sub">' + esc(a.employeeNumber) + '</div></td>' +
        '<td>' + esc(a.attendanceDate) + '</td>' +
        '<td>' + esc(fmtTime(a.checkInAtUtc)) + '</td>' +
        '<td>' + esc(fmtTime(a.checkOutAtUtc)) + '</td>' +
        '<td>' + esc(fmtMinutes(a.workedMinutes)) + '</td>' +
        '<td>' + (a.lateMinutes ? '<span class="minutes-late">' + esc(fmtMinutes(a.lateMinutes)) + '</span>' : '—') + '</td>' +
        '<td>' + (a.overtimeMinutes ? '<span class="minutes-ot">' + esc(fmtMinutes(a.overtimeMinutes)) + '</span>' : '—') + '</td>' +
        '<td><span class="status-badge ' + statusClass(a.status) + '"><span class="dot"></span>' + esc(statusLabel(a.status)) + '</span></td>' +
        (canManage
          ? '<td><div class="act-group">' +
              (canCheckOut ? '<button type="button" class="act-btn" data-checkout="' + esc(a.employeeId) + '" title="' + esc(t('Check Out', 'تسجيل انصراف')) + '"><i class="ti ti-login"></i></button>' : '') +
              '<button type="button" class="act-btn" data-correct="' + esc(a.id) + '" title="' + esc(t('Correct', 'تصحيح')) + '"><i class="ti ti-edit"></i></button>' +
            '</div></td>'
          : '') +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-checkout]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/employee-attendance/check-out', { employeeId: btn.getAttribute('data-checkout') });
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Checked out', 'تم تسجيل الانصراف'), 'ok');
        loadList();
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-correct]'), function (btn) {
      btn.addEventListener('click', function () { openCorrect(btn.getAttribute('data-correct')); });
    });
    applyLocale();
  }

  function openCorrect(id) {
    var row = rows.filter(function (r) { return r.id === id; })[0];
    if (!row) return;
    correctingId = id;
    document.getElementById('corStatus').value = row.status;
    document.getElementById('corCheckIn').value = toLocalInputValue(row.checkInAtUtc);
    document.getElementById('corCheckOut').value = toLocalInputValue(row.checkOutAtUtc);
    document.getElementById('corNotes').value = row.notes || '';
    document.getElementById('correctHint').textContent = '';
    openModal('correctModal');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('correctForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      status: document.getElementById('corStatus').value,
      checkInAtUtc: fromLocalInputValue(document.getElementById('corCheckIn').value),
      checkOutAtUtc: fromLocalInputValue(document.getElementById('corCheckOut').value),
      notes: document.getElementById('corNotes').value.trim() || null
    };
    var btn = document.getElementById('btnSaveCorrect');
    btn.disabled = true;
    var r = await Gfp.put('/hr/employee-attendance/' + correctingId, body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('correctHint').textContent = apiError(r);
      return;
    }
    closeModal('correctModal');
    toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
  });

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
