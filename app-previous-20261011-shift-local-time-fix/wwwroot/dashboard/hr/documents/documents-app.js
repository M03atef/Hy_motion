/**
 * HR Phase 6 — Documents. Upload is multipart (no shared upload helper in api-client.js, so this
 * uses a raw fetch with the bearer token, same pattern as the older staff-app.js apiUpload).
 * Downloads go through the protected /file endpoint (never a public FileUrl) as an authenticated
 * blob fetch, not a plain <a href> link.
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

  var canView = Authz && Authz.useCan('hr.documents.view');
  var canManage = Authz && Authz.useCan('hr.documents.manage');
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var employees = [];
  var rows = [];

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
  function typeLabel(s) {
    var map = {
      NationalId: ['National ID', 'الرقم القومي'], Contract: ['Contract', 'عقد'],
      Certificate: ['Certificate', 'شهادة'], TrainingCertificate: ['Training Certificate', 'شهادة تدريب'], Other: ['Other', 'أخرى']
    };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function expiryLabel(s) {
    var map = { Valid: ['Valid', 'سليم'], ExpiringSoon: ['Expiring soon', 'قارب على الانتهاء'], Expired: ['Expired', 'منتهي'] };
    var p = map[s] || [s, s];
    return t(p[0], p[1]);
  }
  function expiryClass(s) {
    if (s === 'Expired') return 'terminated';
    if (s === 'ExpiringSoon') return 'suspended';
    return 'active';
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
    var sel = document.getElementById('uEmployee');
    employees.forEach(function (e) { sel.appendChild(new Option(e.firstName + ' ' + e.lastName + ' (' + e.employeeNumber + ')', e.id)); });
  }

  function initialExpiryFilterFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var expiryStatus = params.get('expiryStatus');
    if (expiryStatus) document.getElementById('filterExpiry').value = expiryStatus;
  }

  document.getElementById('filterExpiry').addEventListener('change', loadList);
  document.getElementById('btnRefresh').addEventListener('click', loadList);

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var expiryStatus = document.getElementById('filterExpiry').value;
    var r = await Gfp.get('/hr/employee-documents' + (expiryStatus ? '?expiryStatus=' + encodeURIComponent(expiryStatus) : ''));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No documents yet.', 'لا توجد مستندات بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Employee', 'الموظف')) + '</th>' +
      '<th>' + esc(t('Type', 'النوع')) + '</th>' +
      '<th>' + esc(t('File', 'الملف')) + '</th>' +
      '<th>' + esc(t('Expiry', 'الانتهاء')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      '<th></th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (d) {
      html += '<tr>' +
        '<td class="person-name">' + esc(d.employeeName) + '</td>' +
        '<td>' + esc(typeLabel(d.documentType)) + '</td>' +
        '<td>' + esc(d.fileName) + '</td>' +
        '<td>' + esc(d.expiryDate || '—') + '</td>' +
        '<td><span class="status-badge ' + expiryClass(d.expiryStatus) + '"><span class="dot"></span>' + esc(expiryLabel(d.expiryStatus)) + '</span></td>' +
        '<td><div class="act-group">' +
          '<button type="button" class="act-btn" data-download="' + esc(d.id) + '" data-filename="' + esc(d.fileName) + '" title="' + esc(t('Download', 'تنزيل')) + '"><i class="ti ti-download"></i></button>' +
          (canManage ? '<button type="button" class="act-btn danger" data-delete="' + esc(d.id) + '" title="' + esc(t('Delete', 'حذف')) + '"><i class="ti ti-trash"></i></button>' : '') +
        '</div></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;

    Array.prototype.forEach.call(host.querySelectorAll('[data-download]'), function (btn) {
      btn.addEventListener('click', function () { downloadDocument(btn.getAttribute('data-download'), btn.getAttribute('data-filename')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-delete]'), function (btn) {
      btn.addEventListener('click', async function () {
        var r = await Gfp.del('/hr/employee-documents/' + btn.getAttribute('data-delete'));
        if (!r.ok) { toast(apiError(r), 'err'); return; }
        toast(t('Deleted', 'تم الحذف'), 'ok');
        loadList();
      });
    });
    applyLocale();
  }

  async function downloadDocument(id, fileName) {
    try {
      var resp = await fetch(API_BASE + '/hr/employee-documents/' + id + '/file', {
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

  // ── Upload ──
  document.getElementById('btnUpload').addEventListener('click', function () {
    document.getElementById('uploadForm').reset();
    document.getElementById('uploadHint').textContent = '';
    openModal('uploadModal');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var employeeId = document.getElementById('uEmployee').value;
    var fileInput = document.getElementById('uFile');
    if (!employeeId || !fileInput.files.length) {
      document.getElementById('uploadHint').textContent = t('Employee and file are required', 'الموظف والملف مطلوبان');
      return;
    }

    var fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('documentType', document.getElementById('uType').value);
    if (document.getElementById('uIssue').value) fd.append('issueDate', document.getElementById('uIssue').value);
    if (document.getElementById('uExpiry').value) fd.append('expiryDate', document.getElementById('uExpiry').value);
    var notes = document.getElementById('uNotes').value.trim();
    if (notes) fd.append('notes', notes);

    var btn = document.getElementById('btnSaveUpload');
    btn.disabled = true;
    try {
      var resp = await fetch(API_BASE + '/hr/employees/' + employeeId + '/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken(), 'ngrok-skip-browser-warning': 'true' },
        body: fd
      });
      var data = await resp.json().catch(function () { return null; });
      btn.disabled = false;
      if (!resp.ok) {
        document.getElementById('uploadHint').textContent = (data && data.error) || t('Upload failed', 'فشل الرفع');
        return;
      }
      closeModal('uploadModal');
      toast(t('Uploaded', 'تم الرفع'), 'ok');
      loadList();
    } catch (err) {
      btn.disabled = false;
      document.getElementById('uploadHint').textContent = t('Upload failed', 'فشل الرفع');
    }
  });

  (async function init() {
    initialExpiryFilterFromQuery();
    await loadEmployees();
    await loadList();
  })();
})();
