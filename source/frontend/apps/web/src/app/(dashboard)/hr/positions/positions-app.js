/**
 * HR Foundation — Positions (Phase 2).
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
  var departments = [];
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

  async function loadDepartments() {
    var r = await Gfp.get('/hr/departments');
    departments = r.ok && Array.isArray(r.data) ? r.data : [];
    var filterSel = document.getElementById('filterDept');
    var formSel = document.getElementById('pDepartment');
    departments.forEach(function (d) {
      var o1 = document.createElement('option');
      o1.value = d.id; o1.textContent = d.name;
      filterSel.appendChild(o1);
      var o2 = document.createElement('option');
      o2.value = d.id; o2.textContent = d.name;
      formSel.appendChild(o2);
    });
  }

  function fillForm(p) {
    document.getElementById('pName').value = (p && p.name) || '';
    document.getElementById('pNameAr').value = (p && p.nameAr) || '';
    document.getElementById('pDepartment').value = (p && p.departmentId) || '';
    document.getElementById('pSalary').value = (p && p.defaultBasicSalary != null) ? p.defaultBasicSalary : '';
    document.getElementById('pDescription').value = (p && p.description) || '';
    document.getElementById('pActive').checked = !p || p.isActive !== false;
    document.getElementById('posHint').textContent = '';
  }

  function readForm() {
    var salaryRaw = document.getElementById('pSalary').value;
    return {
      name: document.getElementById('pName').value.trim(),
      nameAr: document.getElementById('pNameAr').value.trim() || null,
      departmentId: document.getElementById('pDepartment').value || null,
      defaultBasicSalary: salaryRaw === '' ? null : Number(salaryRaw),
      description: document.getElementById('pDescription').value.trim() || null,
      isActive: document.getElementById('pActive').checked
    };
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var params = [];
    if (document.getElementById('filterInactive').checked) params.push('includeInactive=true');
    var deptFilter = document.getElementById('filterDept').value;
    if (deptFilter) params.push('departmentId=' + encodeURIComponent(deptFilter));
    var r = await Gfp.get('/hr/positions' + (params.length ? '?' + params.join('&') : ''));
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
      host.innerHTML = '<div class="empty-state"><p>' + esc(t('No positions yet.', 'لا توجد مسميات وظيفية بعد.')) + '</p></div>';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>' + esc(t('Name', 'الاسم')) + '</th>' +
      '<th>' + esc(t('Department', 'القسم')) + '</th>' +
      '<th>' + esc(t('Default salary', 'الراتب الافتراضي')) + '</th>' +
      '<th>' + esc(t('Employees', 'الموظفون')) + '</th>' +
      '<th>' + esc(t('Status', 'الحالة')) + '</th>' +
      (canManage ? '<th></th>' : '') +
      '</tr></thead><tbody>';
    rows.forEach(function (p) {
      html += '<tr>' +
        '<td><div class="person-name">' + esc(p.name) + '</div>' + (p.nameAr ? '<div class="person-sub">' + esc(p.nameAr) + '</div>' : '') + '</td>' +
        '<td>' + esc(p.departmentName || '—') + '</td>' +
        '<td>' + esc(money(p.defaultBasicSalary)) + '</td>' +
        '<td>' + esc(p.employeeCount) + '</td>' +
        '<td><span class="status-badge ' + (p.isActive ? 'active' : 'terminated') + '"><span class="dot"></span>' +
        esc(p.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) + '</span></td>' +
        (canManage
          ? '<td><div class="act-group"><button type="button" class="act-btn" data-edit="' + esc(p.id) + '" title="' + esc(t('Edit', 'تعديل')) + '"><i class="ti ti-pencil"></i></button></div></td>'
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
    document.getElementById('posModalTitle').textContent = t('New position', 'مسمى وظيفي جديد');
    fillForm(null);
    openModal('posModal');
  }

  function openEdit(id) {
    var p = rows.filter(function (r) { return r.id === id; })[0];
    if (!p) return;
    editingId = id;
    document.getElementById('posModalTitle').textContent = t('Edit position', 'تعديل المسمى الوظيفي');
    fillForm(p);
    openModal('posModal');
  }

  document.getElementById('btnCreate').addEventListener('click', openCreate);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterInactive').addEventListener('change', loadList);
  document.getElementById('filterDept').addEventListener('change', loadList);
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
  });

  document.getElementById('posForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = readForm();
    if (!body.name) {
      document.getElementById('posHint').textContent = t('Name is required', 'الاسم مطلوب');
      return;
    }
    var btn = document.getElementById('btnSavePos');
    btn.disabled = true;
    var r = editingId
      ? await Gfp.put('/hr/positions/' + editingId, body)
      : await Gfp.post('/hr/positions', body);
    btn.disabled = false;
    if (!r.ok) {
      document.getElementById('posHint').textContent = apiError(r);
      return;
    }
    closeModal('posModal');
    toast(t('Saved', 'تم الحفظ'), 'ok');
    loadList();
  });

  (async function init() {
    await loadDepartments();
    await loadList();
  })();
})();
