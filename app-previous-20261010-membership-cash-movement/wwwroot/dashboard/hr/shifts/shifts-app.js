/**
 * HR Phase 3 — Shift Templates.
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
  var canView = canManage || (Authz && Authz.useCan('hr.view'));
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var rows = [];
  var editingId = null;

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
    // Backend returns TimeOnly as "HH:mm:ss" (or with fractional seconds) — keep only HH:mm.
    return String(timeOnly || '').slice(0, 5);
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
    try {
      if (new URLSearchParams(window.location.search).get('from') === 'schedule') {
        var back = document.getElementById('backToSchedule');
        if (back) back.hidden = false;
      }
    } catch (e) { /* ignore */ }
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  function fillForm(s) {
    document.getElementById('sName').value = (s && s.name) || '';
    document.getElementById('sStart').value = s ? hhmm(s.startTime) : '';
    document.getElementById('sEnd').value = s ? hhmm(s.endTime) : '';
    document.getElementById('sBreak').value = (s && s.breakMinutes) || 0;
    document.getElementById('sGrace').value = (s && s.graceMinutes) || 0;
    document.getElementById('sActiveRow').hidden = !s;
    if (s) document.getElementById('sActive').checked = s.isActive !== false;
    document.getElementById('shiftHint').textContent = '';
  }

  function readForm() {
    return {
      name: document.getElementById('sName').value.trim(),
      startTime: document.getElementById('sStart').value + ':00',
      endTime: document.getElementById('sEnd').value + ':00',
      breakMinutes: Number(document.getElementById('sBreak').value) || 0,
      graceMinutes: Number(document.getElementById('sGrace').value) || 0,
      isActive: document.getElementById('sActive').checked
    };
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var includeInactive = document.getElementById('filterInactive').checked;
    var r = await Gfp.get('/hr/employee-shifts' + (includeInactive ? '?includeInactive=true' : ''));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No shift templates yet.', 'لا توجد قوالب ورديات بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Name', 'الاسم')) + '</th>' +
      '<th>' + esc(t('Start', 'البدء')) + '</th>' +
      '<th>' + esc(t('End', 'الانتهاء')) + '</th>' +
      '<th>' + esc(t('Break', 'الاستراحة')) + '</th>' +
      '<th>' + esc(t('Grace', 'السماح')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    rows.forEach(function (s) {
      html += '<tr>' +
        '<td><div class="person-name">' + esc(s.name) +
        (s.crossesMidnight ? ' <span class="badge-current" title="' + esc(t('Crosses midnight', 'يمتد لما بعد منتصف الليل')) + '">' + esc(t('overnight', 'ليلي')) + '</span>' : '') +
        '</div></td>' +
        '<td>' + esc(hhmm(s.startTime)) + '</td>' +
        '<td>' + esc(hhmm(s.endTime)) + '</td>' +
        '<td>' + esc(s.breakMinutes) + ' ' + esc(t('min', 'د')) + '</td>' +
        '<td>' + esc(s.graceMinutes) + ' ' + esc(t('min', 'د')) + '</td>' +
        '<td><span class="status-badge ' + (s.isActive ? 'active' : 'terminated') + '"><span class="dot"></span>' +
        esc(s.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) + '</span></td>' +
        (canManage
          ? '<td><div class="act-group"><button type="button" class="act-btn" data-edit="' + esc(s.id) + '" title="' + esc(t('Edit', 'تعديل')) + '"><i class="ti ti-pencil"></i></button></div></td>'
          : '') +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () { openEdit(btn.getAttribute('data-edit')); });
    });
    applyLocale();
  }

  function openCreate() {
    editingId = null;
    document.getElementById('shiftModalTitle').textContent = t('New shift template', 'قالب وردية جديد');
    fillForm(null);
    openModal('shiftModal');
  }

  function openEdit(id) {
    var s = rows.filter(function (r) { return r.id === id; })[0];
    if (!s) return;
    editingId = id;
    document.getElementById('shiftModalTitle').textContent = t('Edit shift template', 'تعديل قالب الوردية');
    fillForm(s);
    openModal('shiftModal');
  }

  document.getElementById('btnCreate').addEventListener('click', openCreate);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterInactive').addEventListener('change', loadList);
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('shiftForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = readForm();
    if (!body.name || !document.getElementById('sStart').value || !document.getElementById('sEnd').value) {
      document.getElementById('shiftHint').textContent = t('Name, start and end time are required', 'الاسم ووقت البدء والانتهاء مطلوبة');
      return;
    }
    var btn = document.getElementById('btnSaveShift');
    btn.disabled = true;
    var r = editingId
      ? await Gfp.put('/hr/employee-shifts/' + editingId, body)
      : await Gfp.post('/hr/employee-shifts', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('shiftHint').textContent = apiError(r);
      return;
    }
    closeModal('shiftModal');
    toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
  });

  loadList();
})();
