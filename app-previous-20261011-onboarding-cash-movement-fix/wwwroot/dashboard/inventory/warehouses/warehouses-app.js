/**
 * Warehouses (FE-INVS-2). Real /api/inventory/warehouses* only.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Inv = window.GfpInventoryApi;
  var paths = (Inv && Inv.paths) || {};

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
  if (!Authz || !Authz.useCan('inventory.manage')) {
    window.location.href = '/dashboard/inventory/';
    return;
  }

  var canManage = Authz.useCan('inventory.manage');
  var rows = [];
  var editingId = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (!r) return 'Request failed';
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || ('Request failed (' + r.status + ')');
  }
  function openModal() {
    document.getElementById('whModal').hidden = false;
  }
  function closeModal() {
    document.getElementById('whModal').hidden = true;
  }

  document.querySelectorAll('[data-close="whModal"]').forEach(function (b) {
    b.addEventListener('click', closeModal);
  });

  (function chrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) {
        return w[0];
      })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    var a = document.getElementById('userAvatar');
    var n = document.getElementById('userName');
    var o = document.getElementById('userRole');
    if (a) a.textContent = ini;
    if (n) n.textContent = user.fullName || 'User';
    if (o) o.textContent = user.role || 'Staff';
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
      document.getElementById('gymNameAr').textContent = r.data.gymNameAr || '';
    }
  })();

  async function refreshDefaultChip() {
    var chip = document.getElementById('defaultChip');
    var r = await Gfp.get(paths.warehouseDefault());
    if (r.ok && r.data) {
      chip.textContent = 'الافتراضي / Default: ' + r.data.name + ' (' + r.data.code + ')';
    } else if (r.status === 404) {
      chip.textContent = 'الافتراضي / Default: لا يوجد بعد';
    } else {
      chip.textContent = 'الافتراضي / Default: —';
    }
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div><p>جاري التحميل…</p></div>';
    var includeInactive = document.getElementById('filterInactive').checked;
    var r = await Gfp.get(paths.warehouses({ includeInactive: includeInactive ? 'true' : undefined }));
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    rows = Array.isArray(r.data) ? r.data : [];
    render();
    await refreshDefaultChip();
  }

  function render() {
    var host = document.getElementById('tableHost');
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state"><p>لا مستودعات بعد / No warehouses yet</p></div>';
      return;
    }
    host.innerHTML =
      '<table class="inv"><thead><tr><th>الكود / Code</th><th>الاسم / Name</th><th>الحالة / Status</th><th></th></tr></thead><tbody>' +
      rows
        .map(function (w) {
          var badges =
            (w.isDefault ? '<span class="badge badge-def">افتراضي / Default</span> ' : '') +
            (w.isActive
              ? '<span class="badge badge-ok">نشط / Active</span>'
              : '<span class="badge badge-off">متوقف / Inactive</span>');
          var actions = '';
          if (canManage) {
            actions =
              '<div class="row-actions">' +
              '<button type="button" class="btn-link" data-edit="' +
              esc(w.id) +
              '">تعديل / Edit</button>' +
              (!w.isDefault
                ? '<button type="button" class="btn-link" data-default="' +
                esc(w.id) +
                '">اجعله الافتراضي / Set default</button>'
                : '') +
              '</div>';
          }
          return (
            '<tr><td class="code">' +
            esc(w.code) +
            '</td><td>' +
            esc(w.name) +
            (w.nameAr
              ? '<div style="font-size:12px;color:var(--ltt)" dir="rtl">' + esc(w.nameAr) + '</div>'
              : '') +
            '</td><td>' +
            badges +
            '</td><td>' +
            actions +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';

    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        openEdit(b.getAttribute('data-edit'));
      });
    });
    host.querySelectorAll('[data-default]').forEach(function (b) {
      b.addEventListener('click', function () {
        setDefault(b.getAttribute('data-default'));
      });
    });
  }

  function openCreate() {
    editingId = null;
    document.getElementById('whModalTitle').textContent = 'مستودع جديد / New warehouse';
    document.getElementById('wCode').value = '';
    document.getElementById('wCode').readOnly = false;
    document.getElementById('codeHint').hidden = false;
    document.getElementById('wName').value = '';
    document.getElementById('wNameAr').value = '';
    document.getElementById('wActive').checked = true;
    document.getElementById('wDefault').checked = false;
    document.getElementById('wDefaultWrap').hidden = false;
    document.getElementById('whHint').textContent = '';
    openModal();
  }

  async function openEdit(id) {
    var r = await Gfp.get(paths.warehouse(id));
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    var w = r.data;
    editingId = w.id;
    document.getElementById('whModalTitle').textContent = 'تعديل مستودع / Edit warehouse';
    document.getElementById('wCode').value = w.code || '';
    document.getElementById('wCode').readOnly = true;
    document.getElementById('codeHint').hidden = false;
    document.getElementById('wName').value = w.name || '';
    document.getElementById('wNameAr').value = w.nameAr || '';
    document.getElementById('wActive').checked = !!w.isActive;
    document.getElementById('wDefaultWrap').hidden = true;
    document.getElementById('whHint').textContent = '';
    openModal();
  }

  async function setDefault(id) {
    if (!canManage) return;
    var r = await Gfp.post(paths.warehouseSetDefault(id), {});
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }
    toast('Default warehouse updated', 'ok');
    await loadList();
  }

  document.getElementById('whForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!canManage) return;
    var hint = document.getElementById('whHint');
    var code = document.getElementById('wCode').value.trim();
    var name = document.getElementById('wName').value.trim();
    if (!editingId && !code) {
      hint.textContent = 'Code is required';
      return;
    }
    if (!name) {
      hint.textContent = 'Name is required';
      return;
    }
    hint.textContent = '';
    var btn = document.getElementById('btnSaveWh');
    btn.disabled = true;
    var r;
    if (editingId) {
      r = await Gfp.put(paths.warehouse(editingId), {
        name: name,
        nameAr: document.getElementById('wNameAr').value.trim() || null,
        isActive: document.getElementById('wActive').checked,
        branchId: null
      });
    } else {
      r = await Gfp.post(paths.warehouses(), {
        code: code,
        name: name,
        nameAr: document.getElementById('wNameAr').value.trim() || null,
        isActive: document.getElementById('wActive').checked,
        isDefault: document.getElementById('wDefault').checked,
        branchId: null
      });
    }
    btn.disabled = false;
    if (!r.ok) {
      hint.textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    toast(editingId ? 'Warehouse updated' : 'Warehouse created', 'ok');
    closeModal();
    await loadList();
  });

  document.getElementById('btnCreate').addEventListener('click', openCreate);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterInactive').addEventListener('change', loadList);

  loadList();
})();
