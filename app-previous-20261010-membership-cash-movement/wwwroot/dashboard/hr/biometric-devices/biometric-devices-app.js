/**
 * HR — Biometric devices & employee mappings (generic foundation).
 * No hardware commands. API key plaintext shown only on create/rotate.
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

  var devices = [];
  var employees = [];
  var activeDeviceId = null;

  function t(en, ar) { return I18n && I18n.tLabel ? I18n.tLabel(en, ar) : en; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function toast(msg, type) { return globalThis.toastShared(msg, type); }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    return (r && r.error && r.error.message) || t('Request failed', 'فشل الطلب');
  }
  function applyLocale() { if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale(); }
  function openModal(id) { document.getElementById(id).hidden = false; applyLocale(); }
  function closeModal(id) { document.getElementById(id).hidden = true; }

  function healthLabel(s) {
    var map = {
      AwaitingEvents: ['Awaiting events', 'بانتظار الأحداث'],
      Receiving: ['Receiving pushes', 'يستقبل أحداثاً'],
      Disabled: ['Disabled', 'معطّل'],
      Error: ['Error', 'خطأ']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function healthClass(s) {
    if (s === 'Receiving') return 'health-receiving';
    if (s === 'Disabled') return 'health-disabled';
    if (s === 'Error') return 'health-error';
    return 'health-awaiting';
  }
  function fmtSync(iso) {
    if (!iso) return '—';
    var d = new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z');
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  (function chrome() {
    var ini = String(user.fullName || 'U').split(/\s+/).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = ini;
    document.getElementById('userName').textContent = user.fullName || 'User';
    document.getElementById('userRole').textContent = user.role || 'Staff';
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (Gfp) Gfp.logout(); else window.location.href = '/auth/login/';
    });
    if (canManage) document.getElementById('btnAdd').hidden = false;
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var r = await Gfp.get('/hr/biometric-devices');
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    devices = Array.isArray(r.data) ? r.data : [];
    render();
  }

  function render() {
    var host = document.getElementById('tableHost');
    if (!devices.length) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No biometric devices yet. Add a push-to-local device to begin.', 'لا توجد أجهزة بصمة بعد. أضف جهاز دفع محلي للبدء.')) + '</p></div>';
      applyLocale();
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Device', 'الجهاز')) + '</th>' +
      '<th>' + esc(t('Vendor / model', 'المورّد / الطراز')) + '</th>' +
      '<th>' + esc(t('Integration', 'التكامل')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      '<th>' + esc(t('Last push', 'آخر دفع')) + '</th>' +
      '<th>' + esc(t('Location', 'الموقع')) + '</th>' +
      '<th>' + esc(t('Mapped', 'مربوطون')) + '</th>' +
      '<th></th></tr></thead><tbody>';
    devices.forEach(function (d) {
      html += '<tr>' +
        '<td><div class="person-name">' + esc(d.displayName) + '</div><div class="person-sub ltr">' + esc(d.deviceCode) + ' · key ' + esc(d.apiKeyPrefix) + '…</div></td>' +
        '<td>' + esc(d.vendor || '—') + '<div class="person-sub">' + esc(d.model || '') + '</div></td>' +
        '<td>' + esc(d.integrationType) + '</td>' +
        '<td><span class="status-badge ' + healthClass(d.healthStatus) + '">' + esc(healthLabel(d.healthStatus)) + '</span>' +
        (d.isEnabled ? '' : ' <span class="person-sub">' + esc(t('Disabled', 'معطّل')) + '</span>') +
        (d.lastError ? '<div class="person-sub" style="color:var(--dng500)">' + esc(d.lastError) + '</div>' : '') + '</td>' +
        '<td class="ltr">' + esc(fmtSync(d.lastSuccessfulSyncAtUtc)) + '</td>' +
        '<td>' + esc(d.locationLabel || '—') + '</td>' +
        '<td>' + esc(String(d.mappedEmployeeCount || 0)) + '</td>' +
        '<td><div class="act-group">' +
        '<button type="button" class="act-btn" data-map="' + esc(d.id) + '" title="' + esc(t('Mappings', 'الربط')) + '"><i class="ti ti-users"></i></button>' +
        (canManage ? '<button type="button" class="act-btn" data-edit="' + esc(d.id) + '" title="' + esc(t('Edit', 'تعديل')) + '"><i class="ti ti-edit"></i></button>' : '') +
        (canManage ? '<button type="button" class="act-btn" data-rotate="' + esc(d.id) + '" title="' + esc(t('Rotate API key', 'تدوير مفتاح API')) + '"><i class="ti ti-key"></i></button>' : '') +
        '</div></td></tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;

    Array.prototype.forEach.call(host.querySelectorAll('[data-map]'), function (btn) {
      btn.addEventListener('click', function () { openMappings(btn.getAttribute('data-map')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () { openEdit(btn.getAttribute('data-edit')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-rotate]'), function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm(t('Rotate API key? The old key stops working immediately.', 'تدوير مفتاح API؟ المفتاح القديم يتوقف فوراً.'))) return;
        var r = await Gfp.post('/hr/biometric-devices/' + btn.getAttribute('data-rotate') + '/rotate-api-key', {});
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        showKey(r.data);
        loadList();
      });
    });
    applyLocale();
  }

  function showKey(data) {
    document.getElementById('keyPlain').textContent = data.apiKeyPlaintext || '';
    document.getElementById('keyMeta').textContent = t(
      'Device ' + data.deviceCode + ' · use headers X-HyMotion-Device-Id + X-HyMotion-Device-Key on POST /api/local/biometric/events',
      'الجهاز ' + data.deviceCode + ' · استخدم الترويسات X-HyMotion-Device-Id + X-HyMotion-Device-Key مع POST /api/local/biometric/events'
    );
    openModal('keyModal');
  }

  document.getElementById('btnAdd').addEventListener('click', function () {
    document.getElementById('editDeviceId').value = '';
    document.getElementById('deviceModalTitle').textContent = t('Add device', 'إضافة جهاز');
    document.getElementById('devCode').disabled = false;
    document.getElementById('devCode').value = '';
    document.getElementById('devName').value = '';
    document.getElementById('devVendor').value = '';
    document.getElementById('devModel').value = '';
    document.getElementById('devIntegration').value = 'PushToLocal';
    document.getElementById('devLocation').value = '';
    document.getElementById('enabledRow').hidden = true;
    openModal('deviceModal');
  });

  function openEdit(id) {
    var d = devices.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    document.getElementById('editDeviceId').value = id;
    document.getElementById('deviceModalTitle').textContent = t('Edit device', 'تعديل الجهاز');
    document.getElementById('devCode').value = d.deviceCode;
    document.getElementById('devCode').disabled = true;
    document.getElementById('devName').value = d.displayName;
    document.getElementById('devVendor').value = d.vendor || '';
    document.getElementById('devModel').value = d.model || '';
    document.getElementById('devIntegration').value = d.integrationType || 'PushToLocal';
    document.getElementById('devLocation').value = d.locationLabel || '';
    document.getElementById('enabledRow').hidden = false;
    document.getElementById('devEnabled').value = d.isEnabled ? 'true' : 'false';
    openModal('deviceModal');
  }

  document.getElementById('deviceForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = document.getElementById('editDeviceId').value;
    var body = {
      displayName: document.getElementById('devName').value.trim(),
      vendor: document.getElementById('devVendor').value.trim() || null,
      model: document.getElementById('devModel').value.trim() || null,
      integrationType: document.getElementById('devIntegration').value,
      locationLabel: document.getElementById('devLocation').value.trim() || null
    };
    var r;
    if (id) {
      body.isEnabled = document.getElementById('devEnabled').value === 'true';
      r = await Gfp.put('/hr/biometric-devices/' + id, body);
    } else {
      body.deviceCode = document.getElementById('devCode').value.trim();
      r = await Gfp.post('/hr/biometric-devices', body);
    }
    if (!r.ok) { toast(apiError(r), 'err'); return; }
    closeModal('deviceModal');
    if (!id && r.data && r.data.apiKeyPlaintext) showKey(r.data);
    else toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
  });

  async function ensureEmployees() {
    if (employees.length) return;
    var r = await Gfp.get('/hr/employees');
    employees = r.ok && Array.isArray(r.data) ? r.data : [];
  }

  async function openMappings(deviceId) {
    activeDeviceId = deviceId;
    var d = devices.filter(function (x) { return x.id === deviceId; })[0];
    document.getElementById('mapModalTitle').textContent = t('Mappings', 'الربط') + (d ? ' — ' + d.displayName : '');
    document.getElementById('mapForm').hidden = !canManage;
    await ensureEmployees();
    var sel = document.getElementById('mapEmployee');
    sel.innerHTML = '<option value="">' + esc(t('Select employee…', 'اختر موظفاً…')) + '</option>';
    employees.forEach(function (e) {
      sel.appendChild(new Option(e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')', e.id));
    });
    await loadMappings();
    openModal('mapModal');
  }

  async function loadMappings() {
    var host = document.getElementById('mapTableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    var r = await Gfp.get('/hr/biometric-mappings?deviceId=' + encodeURIComponent(activeDeviceId));
    if (!r.ok) { host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>'; return; }
    var rows = Array.isArray(r.data) ? r.data : [];
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No mappings yet.', 'لا يوجد ربط بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr><th>' + esc(t('Employee', 'الموظف')) + '</th><th>' + esc(t('Device user ID', 'معرّف مستخدم الجهاز')) + '</th><th>' + esc(t('Status', 'الحالة')) + '</th><th></th></tr></thead><tbody>';
    rows.forEach(function (m) {
      html += '<tr><td>' + esc(m.employeeName) + '<div class="person-sub">' + esc(m.employeeNumber) + ' · ' + esc(m.employeeStatus) + '</div></td>' +
        '<td class="ltr">' + esc(m.deviceUserId) + '</td>' +
        '<td>' + (m.isEnabled ? esc(t('Enabled', 'مفعّل')) : esc(t('Disabled', 'معطّل'))) +
        (m.disabledReason ? '<div class="person-sub">' + esc(m.disabledReason) + '</div>' : '') +
        '<div class="person-sub">' + esc(t('Remote disable', 'تعطيل عن بُعد')) + ': ' + esc(m.remoteDisableStatus) + '</div></td>' +
        '<td>' + (canManage && m.isEnabled ? '<button type="button" class="act-btn" data-disable-map="' + esc(m.id) + '"><i class="ti ti-ban"></i></button>' : '') + '</td></tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-disable-map]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r2 = await Gfp.post('/hr/biometric-mappings/' + btn.getAttribute('data-disable-map') + '/disable', { reason: 'Manual disable from UI' });
        if (!r2.ok) { toast(apiError(r2), 'err'); return; }
        toast(t('Mapping disabled locally (remote device not confirmed)', 'تم تعطيل الربط محلياً (الجهاز عن بُعد غير مؤكد)'), 'ok');
        loadMappings();
        loadList();
      });
    });
  }

  document.getElementById('mapForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      biometricDeviceId: activeDeviceId,
      employeeId: document.getElementById('mapEmployee').value,
      deviceUserId: document.getElementById('mapDeviceUserId').value.trim()
    };
    if (!body.employeeId || !body.deviceUserId) {
      toast(t('Employee and device user ID are required', 'الموظف ومعرّف مستخدم الجهاز مطلوبان'), 'err');
      return;
    }
    var r = await Gfp.post('/hr/biometric-mappings', body);
    if (!r.ok) { toast(apiError(r), 'err'); return; }
    document.getElementById('mapDeviceUserId').value = '';
    toast(t('Mapping saved', 'تم حفظ الربط'), 'ok');
    loadMappings();
    loadList();
  });

  loadList();
  document.addEventListener('gfp:locale', function () { render(); applyLocale(); });
})();
