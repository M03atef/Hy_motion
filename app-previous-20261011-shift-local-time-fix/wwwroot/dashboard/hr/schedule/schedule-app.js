/**
 * HR Phase 3 — Schedule (employee -> shift template -> date assignment).
 * Simple table + date-range chips, not a calendar grid (no reusable grid widget exists in this app).
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

  var canManage = Authz && Authz.useCan('hr.shifts.manage');
  var canView = canManage || (Authz && Authz.useCan('hr.attendance.view'));
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var employees = [];
  var shifts = [];
  var dateMode = 'today';

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
  function hhmm(timeOnly) {
    return String(timeOnly || '').slice(0, 5);
  }
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(isoStr, days) {
    var d = new Date(isoStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return isoDate(d);
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

  function openTemplatesPage() {
    window.location.href = '/dashboard/hr/shifts/?from=schedule';
  }

  Array.prototype.forEach.call(document.querySelectorAll('.js-open-templates'), function (el) {
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      closeModal('assignModal');
      closeModal('bulkModal');
      openTemplatesPage();
    });
  });
  // Old ?tab=templates bookmarks → real templates page (no nested iframe).
  try {
    if (new URLSearchParams(window.location.search).get('tab') === 'templates') {
      openTemplatesPage();
      return;
    }
  } catch (e) { /* ignore */ }

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  async function loadReferenceData() {
    var er = await Gfp.get('/hr/employees');
    employees = er.ok && Array.isArray(er.data) ? er.data : [];
    var filterSel = document.getElementById('filterEmployee');
    var aSel = document.getElementById('aEmployee');
    var bSel = document.getElementById('bEmployees');
    employees.forEach(function (e) {
      var name = e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')';
      filterSel.appendChild(new Option(name, e.id));
      aSel.appendChild(new Option(name, e.id));
      bSel.appendChild(new Option(name, e.id));
    });

    var sr = await Gfp.get('/hr/employee-shifts');
    shifts = sr.ok && Array.isArray(sr.data) ? sr.data : [];
    var aShiftSel = document.getElementById('aShift');
    var bShiftSel = document.getElementById('bShift');
    shifts.forEach(function (s) {
      var label = s.name + ' (' + hhmm(s.startTime) + '–' + hhmm(s.endTime) + ')';
      aShiftSel.appendChild(new Option(label, s.id));
      bShiftSel.appendChild(new Option(label, s.id));
    });
  }

  function currentRange() {
    var today = isoDate(new Date());
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
      var today = isoDate(new Date());
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
  document.getElementById('btnRefresh').addEventListener('click', loadList);

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var range = currentRange();
    var params = ['from=' + range.from, 'to=' + range.to];
    var employeeId = document.getElementById('filterEmployee').value;
    if (employeeId) params.push('employeeId=' + encodeURIComponent(employeeId));

    var r = await Gfp.get('/hr/employee-schedules?' + params.join('&'));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    render(Array.isArray(r.data) ? r.data : []);
  }

  function render(rows) {
    var host = document.getElementById('tableHost');
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No shifts assigned in this range.', 'لا توجد ورديات معينة في هذا النطاق.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Date', 'التاريخ')) + '</th>' +
      '<th>' + esc(t('Shift', 'الوردية')) + '</th>' +
      '<th>' + esc(t('Notes', 'ملاحظات')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    rows.forEach(function (a) {
      html += '<tr>' +
        '<td class="person-name">' + esc(a.employeeName) + '</td>' +
        '<td>' + esc(a.date) + '</td>' +
        '<td>' + esc(a.employeeShiftName) + ' <span class="person-sub">(' + esc(hhmm(a.shiftStartTime)) + '–' + esc(hhmm(a.shiftEndTime)) + ')</span></td>' +
        '<td>' + esc(a.notes || '—') + '</td>' +
        (canManage
          ? '<td><div class="act-group"><button type="button" class="act-btn danger" data-remove="' + esc(a.employeeId) + '|' + esc(a.date) + '" title="' + esc(t('Remove', 'إزالة')) + '"><i class="ti ti-trash"></i></button></div></td>'
          : '') +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-remove]'), function (btn) {
      btn.addEventListener('click', async function () {
        var parts = btn.getAttribute('data-remove').split('|');
        var r = await Gfp.del('/hr/employee-schedules/' + parts[0] + '/' + parts[1]);
        if (!r.ok) {
          toast(apiError(r), 'err');
          return;
        }
        toast(t('Removed', 'تمت الإزالة'), 'ok');
        loadList();
      });
    });
    applyLocale();
  }

  document.getElementById('btnCreate').addEventListener('click', function () {
    document.getElementById('assignForm').reset();
    document.getElementById('assignHint').textContent = '';
    openModal('assignModal');
  });
  document.getElementById('btnBulk').addEventListener('click', function () {
    document.getElementById('bulkForm').reset();
    document.getElementById('bulkHint').textContent = '';
    openModal('bulkModal');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('assignForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      employeeId: document.getElementById('aEmployee').value,
      employeeShiftId: document.getElementById('aShift').value,
      date: document.getElementById('aDate').value,
      notes: document.getElementById('aNotes').value.trim() || null
    };
    if (!body.employeeId || !body.employeeShiftId || !body.date) {
      document.getElementById('assignHint').textContent = t('Employee, shift and date are required', 'الموظف والوردية والتاريخ مطلوبة');
      return;
    }
    var btn = document.getElementById('btnSaveAssign');
    btn.disabled = true;
    var r = await Gfp.post('/hr/employee-schedules', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('assignHint').textContent = apiError(r);
      return;
    }
    closeModal('assignModal');
    toast(t('Assigned', 'تم التعيين'), 'ok');
    loadList();
  });

  document.getElementById('bulkForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var selected = Array.prototype.map.call(document.getElementById('bEmployees').selectedOptions, function (o) { return o.value; });
    var body = {
      employeeIds: selected,
      employeeShiftId: document.getElementById('bShift').value,
      dateFrom: document.getElementById('bFrom').value,
      dateTo: document.getElementById('bTo').value
    };
    if (!selected.length || !body.employeeShiftId || !body.dateFrom || !body.dateTo) {
      document.getElementById('bulkHint').textContent = t('Select employees, a shift, and a date range', 'اختر الموظفين والوردية ونطاق التاريخ');
      return;
    }
    var btn = document.getElementById('btnSaveBulk');
    btn.disabled = true;
    var r = await Gfp.post('/hr/employee-schedules/bulk', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('bulkHint').textContent = apiError(r);
      return;
    }
    closeModal('bulkModal');
    toast(t('Assigned', 'تم التعيين') + ': ' + r.data.assignedCount + ' / ' + t('Skipped', 'تم التخطي') + ': ' + r.data.skippedCount, 'ok');
    loadList();
  });

  (async function init() {
    await loadReferenceData();
    await loadList();
  })();
})();
