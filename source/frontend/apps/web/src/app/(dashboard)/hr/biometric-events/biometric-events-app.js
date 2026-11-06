/**
 * HR — Biometric attendance event review.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var I18n = window.GfpI18n;

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try { return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user')); }
    catch (e) { return null; }
  }

  var user = getUser();
  if (!user) { window.location.href = '/auth/login/'; return; }

  var canManage = Authz && Authz.useCan('hr.attendance.manage');
  var canView = canManage || (Authz && Authz.useCan('hr.attendance.view'));
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var rows = [];
  var selectedId = null;

  function t(en, ar) { return I18n && I18n.tLabel ? I18n.tLabel(en, ar) : en; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function toast(msg, type) { return globalThis.toastShared(msg, type); }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    return (r && r.error && r.error.message) || t('Request failed', 'فشل الطلب');
  }
  function applyLocale() { if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale(); }
  function fmt(iso) {
    if (!iso) return '—';
    var d = new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z');
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  function statusLabel(s) {
    var map = {
      Applied: ['Applied', 'مطبّق'], NeedsReview: ['Needs review', 'بانتظار المراجعة'],
      Duplicate: ['Duplicate', 'مكرر'], Rejected: ['Rejected', 'مرفوض'], Pending: ['Pending', 'معلّق']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }

  (function chrome() {
    var ini = String(user.fullName || 'U').split(/\s+/).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = ini;
    document.getElementById('userName').textContent = user.fullName || 'User';
    document.getElementById('userRole').textContent = user.role || 'Staff';
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (Gfp) Gfp.logout(); else window.location.href = '/auth/login/';
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

  document.getElementById('filterStatus').addEventListener('change', loadList);
  document.getElementById('btnRefresh').addEventListener('click', loadList);

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var status = document.getElementById('filterStatus').value;
    var q = status ? ('?status=' + encodeURIComponent(status)) : '';
    var r = await Gfp.get('/hr/biometric-events' + q);
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No events match.', 'لا توجد أحداث مطابقة.')) + '</p></div>';
      renderDetail(null);
      applyLocale();
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Device time', 'وقت الجهاز')) + '</th>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Device', 'الجهاز')) + '</th>' +
      '<th>' + esc(t('Direction', 'الاتجاه')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th></tr></thead><tbody>';
    rows.forEach(function (e) {
      html += '<tr class="row-click' + (e.id === selectedId ? ' row-on' : '') + '" data-id="' + esc(e.id) + '">' +
        '<td class="ltr">' + esc(fmt(e.deviceTimestampUtc)) + '</td>' +
        '<td>' + esc(e.resolvedEmployeeName || '—') + '<div class="person-sub ltr">' + esc(e.deviceUserId) + '</div></td>' +
        '<td>' + esc(e.deviceName) + '</td>' +
        '<td>' + esc(e.punchDirection) + '</td>' +
        '<td>' + esc(statusLabel(e.processingStatus)) + '</td></tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-id]'), function (tr) {
      tr.addEventListener('click', function () {
        selectedId = tr.getAttribute('data-id');
        render();
      });
    });
    var sel = rows.filter(function (r) { return r.id === selectedId; })[0] || rows[0];
    selectedId = sel.id;
    renderDetail(sel);
    applyLocale();
  }

  function renderDetail(e) {
    var host = document.getElementById('detailHost');
    if (!e) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('Select an event', 'اختر حدثاً')) + '</p></div>';
      return;
    }
    var raw = {
      vendorEventId: e.vendorEventId,
      deviceUserId: e.deviceUserId,
      deviceTimestampUtc: e.deviceTimestampUtc,
      originalDeviceTimeText: e.originalDeviceTimeText,
      receivedAtUtc: e.receivedAtUtc,
      acceptedTimestampUtc: e.acceptedTimestampUtc,
      clockSkewSeconds: e.clockSkewSeconds,
      validationResult: e.validationResult,
      reviewReason: e.reviewReason,
      safePayloadJson: e.safePayloadJson
    };
    var html = '<h3 style="margin:0 0 8px;font-size:14px">' + esc(t('Raw evidence', 'الدليل الخام')) + '</h3>' +
      '<div class="raw-box">' + esc(JSON.stringify(raw, null, 2)) + '</div>' +
      '<h3 style="margin:14px 0 8px;font-size:14px">' + esc(t('Attendance link', 'ربط الحضور')) + '</h3>' +
      '<p style="margin:0;font-size:13px">' +
      (e.resultingAttendanceId
        ? esc(t('Linked attendance', 'سجل الحضور المرتبط')) + ': <span class="ltr">' + esc(e.resultingAttendanceId) + '</span>'
        : esc(t('No attendance row yet', 'لا يوجد سجل حضور بعد'))) +
      '</p>';
    if (canManage && e.processingStatus === 'NeedsReview') {
      html += '<button type="button" class="btn-create" style="margin-top:14px" id="btnReprocess"><i class="ti ti-refresh"></i> ' +
        esc(t('Reprocess', 'إعادة المعالجة')) + '</button>';
    }
    host.innerHTML = html;
    var btn = document.getElementById('btnReprocess');
    if (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.post('/hr/biometric-events/' + e.id + '/reprocess', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Reprocessed', 'تمت إعادة المعالجة'), 'ok');
        loadList();
      });
    }
  }

  loadList();
  document.addEventListener('gfp:locale', function () { render(); });
})();
