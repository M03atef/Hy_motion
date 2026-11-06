import fs from 'fs';

const jsPath = 'D:/GMS/GMS/Frontend/apps/web/src/app/(dashboard)/hr/employees/employees-app.js';
const cssPath = 'D:/GMS/GMS/Frontend/apps/web/src/app/(dashboard)/hr/employees/employees.css';
const htmlPath = 'D:/GMS/GMS/Frontend/apps/web/src/app/(dashboard)/hr/employees/index.html';

let js = fs.readFileSync(jsPath, 'utf8').replace(/\r\n/g, '\n');

function rep(a, b, label) {
  const needle = a.replace(/\r\n/g, '\n');
  if (!js.includes(needle)) {
    console.error('MISS:', label);
    process.exit(1);
  }
  js = js.replace(needle, b);
  console.log('OK:', label);
}

rep(
  `  var canAttendance = Authz && Authz.useCan('hr.attendance.view');
  var isOwner = Authz && Authz.useCanRole('OwnerOnly');`,
  `  var canAttendance = Authz && Authz.useCan('hr.attendance.view');
  var canAttendanceManage = Authz && Authz.useCan('hr.attendance.manage');
  var canScheduleManage = Authz && Authz.useCan('hr.shifts.manage');
  var canPayrollManage = Authz && Authz.useCan('hr.payroll.manage');
  var canLeaveManage = Authz && Authz.useCan('hr.leave.manage');
  var canLeaveApprove = Authz && Authz.useCan('hr.leave.approve');
  var isOwner = Authz && Authz.useCanRole('OwnerOnly');
  var shiftTemplates = [];`,
  'permissions'
);

rep(
  `  var drawerContracts = [];
  var drawerTab = 'overview';`,
  `  var drawerContracts = [];
  var drawerTab = 'overview';
  var drawerCurrentContract = null;`,
  'drawerCurrentContract'
);

rep(
  `  function fmtMinutes(n) {
    if (n == null || n === '') return '—';
    var mins = Number(n);
    if (Number.isNaN(mins)) return '—';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h <= 0 && m === 0) return '0m';
    return (h > 0 ? h + 'h ' : '') + m + 'm';
  }`,
  `  function fmtMinutes(n) {
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
  }`,
  'helpers'
);

rep(
  `      Annual: ['Annual', 'سنوية'], Sick: ['Sick', 'مرضية'], Unpaid: ['Unpaid', 'بدون أجر'],
      Permission: ['Permission', 'إذن'], Other: ['Other', 'أخرى']`,
  `      Annual: ['Annual', 'سنوية'], Sick: ['Sick', 'مرضية'], Unpaid: ['Unpaid', 'بدون أجر'],
      Permission: ['Permission', 'إذن'], Maternity: ['Maternity', 'أمومة'], Paternity: ['Paternity', 'أبوة'],
      Emergency: ['Emergency', 'طارئة'], Other: ['Other', 'أخرى']`,
  'leave types'
);

const startMark = `    if (drawerTab === 'schedule') {`;
const endMark = `  async function downloadDocument(docId, fileName) {`;
const startIdx = js.indexOf(startMark);
const endIdx = js.indexOf(endMark);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('MISS: schedule..documents block', startIdx, endIdx);
  process.exit(1);
}

const newTabs = `    if (drawerTab === 'schedule') {
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
          '<p class="form-hint">' + esc(t('Period net pay appears after Calculate for a payroll period.', 'صافي الفترة يظهر بعد حساب فترة الرواتب.')) + '</p>' +
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
      var linesR = await Gfp.get('/hr/payroll-periods/' + latest.id + '/lines?employeeId=' + encodeURIComponent(id));
      var line = linesR.ok && Array.isArray(linesR.data) && linesR.data.length ? linesR.data[0] : null;
      var phtml =
        '<h3 class="emp-inline-title">' + esc(t('Latest period', 'آخر فترة')) + ' · ' + esc(latest.month + '/' + latest.year) + ' · ' + esc(latest.status) + '</h3>';
      if (!line) {
        phtml += '<p class="form-hint" style="color:var(--ltt)">' +
          esc(t('No payroll line yet for this employee in this period.', 'لا يوجد بند راتب لهذا الموظف في هذه الفترة بعد.')) + '</p>';
      } else {
        phtml +=
          '<div class="kv"><span>' + esc(t('Basic salary', 'الراتب الأساسي')) + '</span><span>' + esc(money(line.basicSalary)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Overtime', 'إضافي')) + '</span><span>' + esc(money(line.overtimeAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Bonus', 'مكافأة')) + '</span><span>' + esc(money(line.bonusAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Allowance', 'بدل')) + '</span><span>' + esc(money(line.allowanceAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Deduction', 'خصم')) + '</span><span>' + esc(money(line.deductionAmount)) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Net salary', 'صافي الراتب')) + '</span><span><strong>' + esc(money(line.netSalary)) + '</strong></span></div>';
      }
      if (canPayrollManage && String(latest.status).toLowerCase() !== 'closed' && String(latest.status).toLowerCase() !== 'approved') {
        phtml +=
          '<div class="inline-act-row" style="margin-top:12px">' +
            '<button type="button" class="btn-primary" id="btnHubCalcPayroll" data-period="' + esc(latest.id) + '"><i class="ti ti-calculator"></i> ' +
            esc(t('Calculate payroll for this period', 'حساب رواتب هذه الفترة')) + '</button>' +
          '</div><p class="form-hint" id="hubPayHint"></p>';
      }
      panel.innerHTML = contractHtml + phtml;
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

`;

js = js.slice(0, startIdx) + newTabs + js.slice(endIdx);
console.log('OK: replaced schedule..documents tabs');

// Onboarding schedule: inline assign, no redirect
rep(
  `    } else if (key === 'schedule') {
      panel.innerHTML =
        '<p class="page-subtitle">' + esc(t('Assign shifts later from Schedule. No schedule API call in this step.', 'عيّن الورديات لاحقاً من صفحة الجدول. لا يوجد استدعاء API في هذه الخطوة.')) + '</p>' +
        '<p style="margin:12px 0"><a class="emp-deep-link" href="/dashboard/hr/schedule/" target="_blank" rel="noopener"><i class="ti ti-calendar"></i> ' +
          esc(t('Assign shifts later from Schedule', 'تعيين الورديات لاحقاً من الجدول')) + '</a></p>' +
        '<label class="fg"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><textarea id="obScheduleNote" rows="2" maxlength="500">' + esc(d.scheduleNote) + '</textarea></label>';
    }`,
  `    } else if (key === 'schedule') {
      renderOnboardScheduleStep(panel, d);
    }`,
  'onboard schedule call'
);

if (!js.includes('function renderOnboardScheduleStep')) {
  rep(
    `  function renderOnboardSystemAccess(panel) {`,
    `  function renderOnboardScheduleStep(panel, d) {
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

  function renderOnboardSystemAccess(panel) {`,
    'renderOnboardScheduleStep'
  );
}

if (js.includes(`    } else if (key === 'schedule') {
      var note = document.getElementById('obScheduleNote');
      if (note) d.scheduleNote = note.value.trim();`)) {
  rep(
    `    } else if (key === 'schedule') {
      var note = document.getElementById('obScheduleNote');
      if (note) d.scheduleNote = note.value.trim();`,
    `    } else if (key === 'schedule') {
      var shiftSel = document.getElementById('obScheduleShift');
      if (shiftSel) {
        d.scheduleShiftId = shiftSel.value;
        var fromEl = document.getElementById('obScheduleFrom');
        var toEl = document.getElementById('obScheduleTo');
        if (fromEl) d.scheduleFrom = fromEl.value;
        if (toEl) d.scheduleTo = toEl.value;
      }
      var note = document.getElementById('obScheduleNote');
      if (note) d.scheduleNote = note.value.trim();`,
    'collect onboard schedule'
  );
}

if (!js.includes('scheduleShiftId')) {
  rep(
    `      scheduleNote: '',
      needAccess: null, // true | false | null`,
    `      scheduleShiftId: '',
      scheduleFrom: '',
      scheduleTo: '',
      scheduleNote: '',
      needAccess: null, // true | false | null`,
    'onboard fields'
  );
}

if (js.includes(`    if (d.includeContract) {
      var cr = await Gfp.post('/hr/employees/' + empId + '/contracts', {`) &&
    !js.includes(`employee-schedules/bulk`)) {
  rep(
    `    if (d.includeContract) {
      var cr = await Gfp.post('/hr/employees/' + empId + '/contracts', {`,
    `    if (d.scheduleShiftId && d.scheduleFrom && d.scheduleTo) {
      var sbr = await Gfp.post('/hr/employee-schedules/bulk', {
        employeeIds: [empId],
        employeeShiftId: d.scheduleShiftId,
        dateFrom: d.scheduleFrom,
        dateTo: d.scheduleTo
      });
      if (!sbr.ok) {
        toast(t('Employee created, but schedule assign failed: ', 'تم إنشاء الموظف لكن فشل تعيين الجدول: ') + apiError(sbr), 'err');
      }
    }

    if (d.includeContract) {
      var cr = await Gfp.post('/hr/employees/' + empId + '/contracts', {`,
    'post-create bulk schedule'
  );
}

fs.writeFileSync(jsPath, js, 'utf8');
console.log('Wrote JS', js.length);

let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.emp-inline-ops')) {
  css += `
.emp-inline-ops { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--ls3); }
.emp-inline-title { font-size: 12px; text-transform: uppercase; color: var(--ltt); margin: 0 0 10px; letter-spacing: 0.04em; }
.inline-act-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
.inline-act-row .btn-primary,
.inline-act-row .btn-secondary { height: 34px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; width: auto; }
.form-grid .fg.span2 { grid-column: 1 / -1; }
.emp-balance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-bottom: 14px; }
.emp-balance-chip { border: 1px solid var(--ls3); border-radius: var(--rmd); padding: 10px; background: var(--ls2); }
.emp-balance-chip .lbl { font-size: 11px; color: var(--ltt); font-weight: 600; }
.emp-balance-chip .val { font-family: var(--fd); font-size: 16px; font-weight: 700; margin-top: 4px; }
.emp-balance-chip .sub { font-size: 10px; color: var(--ltt); }
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('OK: css');
}

let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/employees\.css\?v=\d+/, 'employees.css?v=10').replace(/employees-app\.js\?v=\d+/, 'employees-app.js?v=10');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('OK: cache v=10');

if (js.includes('Open Schedule') || js.includes('Open Leave') || js.includes('Open Payroll') || js.includes('Open Attendance') || js.includes('Open Documents')) {
  console.warn('WARN: some Open * strings still present');
  const re = /Open (Schedule|Leave|Payroll|Attendance|Documents)/g;
  let m;
  while ((m = re.exec(js))) console.warn(' still:', m[0], 'at', m.index);
} else {
  console.log('OK: no Open * redirects left in JS');
}
