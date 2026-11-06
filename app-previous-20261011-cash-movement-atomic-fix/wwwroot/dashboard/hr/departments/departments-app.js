/**
 * HR Foundation — Departments (Phase 2).
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

  var canManage = Authz && Authz.useCan('hr.manage');
  var canView = canManage || (Authz && Authz.useCan('hr.view'));
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  var rows = [];
  var editingId = null;
  var pendingDeleteId = null;

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
    if (I18n && I18n.displayApiError) {
      var shown = I18n.displayApiError(r);
      if (shown && shown !== 'Request failed') return shown;
    }
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = (r && r.error) || {};
    var d = (r && r.data) || {};
    var detail = e.message || d.error || d.message || d.detail || '';
    if (typeof detail === 'object' && detail) detail = detail.message || detail.error || '';
    if (detail && String(detail).indexOf(' / ') !== -1) detail = String(detail).split(' / ')[0].trim();
    if (detail && detail !== 'Request failed') return String(detail);
    if (r.status === 404 || r.status === 405) {
      return t(
        'Delete is not available on this API yet — restart the API and try again.',
        'الحذف غير متاح على الـ API الحالي — أعد تشغيل الـ API وجرب تاني.'
      );
    }
    return t('Request failed', 'فشل الطلب') + (r.status ? ' (' + r.status + ')' : '');
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

  function openDeleteModal(id) {
    var d = rows.filter(function (r) { return r.id === id; })[0];
    if (!d) return;
    pendingDeleteId = id;
    var msg = document.getElementById('deptDelMessage');
    if (msg) {
      msg.textContent = t(
        'Delete department "' + (d.name || '') + '"?',
        'حذف القسم «' + (d.name || '') + '»؟'
      );
    }
    openModal('deptDeleteModal');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    closeModal('deptDeleteModal');
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

  function fillForm(d) {
    document.getElementById('dName').value = (d && d.name) || '';
    document.getElementById('dNameAr').value = (d && d.nameAr) || '';
    document.getElementById('dActive').checked = !d || d.isActive !== false;
    document.getElementById('deptHint').textContent = '';
  }

  function readForm() {
    return {
      name: document.getElementById('dName').value.trim(),
      nameAr: document.getElementById('dNameAr').value.trim() || null,
      isActive: document.getElementById('dActive').checked
    };
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var includeInactive = document.getElementById('filterInactive').checked;
    var r = await Gfp.get('/hr/departments' + (includeInactive ? '?includeInactive=true' : ''));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No departments yet.', 'لا توجد أقسام بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Name', 'الاسم')) + '</th>' +
      '<th>' + esc(t('Employees', 'الموظفون')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    rows.forEach(function (d) {
      html += '<tr>' +
        '<td><div class="person-name">' + esc(d.name) + '</div>' + (d.nameAr ? '<div class="person-sub">' + esc(d.nameAr) + '</div>' : '') + '</td>' +
        '<td>' + esc(d.employeeCount) + '</td>' +
        '<td><span class="status-badge ' + (d.isActive ? 'active' : 'terminated') + '"><span class="dot"></span>' +
        esc(d.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) + '</span></td>' +
        (canManage
          ? '<td><div class="act-group">' +
          '<button type="button" class="act-btn" data-edit="' + esc(d.id) + '" title="' + esc(t('Edit', 'تعديل')) + '"><i class="ti ti-pencil"></i></button>' +
          '<button type="button" class="act-btn danger" data-del="' + esc(d.id) + '" title="' + esc(t('Delete', 'حذف')) + '"><i class="ti ti-trash"></i></button>' +
          '</div></td>'
          : '') +
        '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    Array.prototype.forEach.call(host.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () {
        openEdit(btn.getAttribute('data-edit'));
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-del]'), function (btn) {
      btn.addEventListener('click', function () {
        openDeleteModal(btn.getAttribute('data-del'));
      });
    });
    applyLocale();
  }

  function openCreate() {
    editingId = null;
    document.getElementById('deptModalTitle').textContent = t('New department', 'قسم جديد');
    fillForm(null);
    openModal('deptModal');
  }

  function openEdit(id) {
    var d = rows.filter(function (r) { return r.id === id; })[0];
    if (!d) return;
    editingId = id;
    document.getElementById('deptModalTitle').textContent = t('Edit department', 'تعديل القسم');
    fillForm(d);
    openModal('deptModal');
  }

  document.getElementById('btnCreate').addEventListener('click', openCreate);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterInactive').addEventListener('change', loadList);
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  document.getElementById('deptForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = readForm();
    if (!body.name) {
      document.getElementById('deptHint').textContent = t('Name is required', 'الاسم مطلوب');
      return;
    }
    var btn = document.getElementById('btnSaveDept');
    btn.disabled = true;
    var r = editingId
      ? await Gfp.put('/hr/departments/' + editingId, body)
      : await Gfp.post('/hr/departments', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('deptHint').textContent = apiError(r);
      return;
    }
    closeModal('deptModal');
    toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
  });

  ['btnDeptDelCancel', 'btnDeptDelCancelX'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', closeDeleteModal);
  });

  document.getElementById('btnDeptDelConfirm').addEventListener('click', async function () {
    var id = pendingDeleteId;
    if (!id || !canManage) return;
    var btn = document.getElementById('btnDeptDelConfirm');
    btn.disabled = true;
    try {
      var r = await Gfp.del('/hr/departments/' + id);
      if (!r.ok) {
        toast(apiError(r) || t('Could not delete department', 'تعذر حذف القسم'), 'err');
        return;
      }
      closeDeleteModal();
      toast(t('Department deleted', 'تم حذف القسم'), 'ok');
      if (editingId === id) {
        editingId = null;
        closeModal('deptModal');
      }
      loadList();
    } finally {
      btn.disabled = false;
    }
  });

  loadList();
})();
