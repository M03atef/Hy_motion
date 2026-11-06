/**
 * Roles desk — Option B tenant overlay.
 * Owner is locked. Manager / Receptionist / Trainer save via PUT /api/admin/roles/{role}.
 * Defaults remain DefaultPermissionProvider (GfpStaffRules). Per-user override column is unused.
 */
(function () {
  'use strict';

  var R = window.GfpStaffRules;
  var guard = document.getElementById('ownerGuard');
  var content = document.getElementById('rolesContent');
  var tbody = document.getElementById('rolesBody');

  if (!R || typeof R.isOwnerRole !== 'function') {
    if (guard) {
      guard.hidden = true;
      guard.classList.remove('is-on');
    }
    if (content) content.style.removeProperty('display');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell" role="alert">' +
        ((window.GfpI18n && window.GfpI18n.tLabel)
          ? window.GfpI18n.tLabel('Could not load role access. Refresh and try again.', 'تعذّر تحميل صلاحيات الأدوار. أعد تحميل الصفحة وحاول مرة أخرى.')
          : 'Could not load role access. Refresh and try again.') +
        '</td></tr>';
    }
    return;
  }

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  var ROLE_LABEL_AR = {
    Owner: 'المالك',
    Manager: 'المدير',
    Trainer: 'المدرب',
    Receptionist: 'موظف الاستقبال'
  };
  var ROLE_DESC_AR = {
    Owner: 'صلاحية كاملة. دور نظامي — لا يمكن تعديله أو تعيينه من صفحة الموظفين.',
    Manager: 'كل شيء ما عدا الباقات وإعدادات الصالة.',
    Receptionist: 'مكتب الاستقبال: الأعضاء والبيع والورديات وطلبات التطبيق.',
    Trainer: 'تسجيل حضور يدوي.'
  };
  var PERMISSION_LABELS_AR = {
    'members.view': 'عرض الأعضاء',
    'members.create': 'إضافة أعضاء',
    'members.edit': 'تعديل بيانات الأعضاء',
    'checkin.manual': 'تسجيل حضور يدوي',
    'classes.view': 'عرض الحصص',
    'attendance.view': 'عرض الحضور',
    'sales.sell': 'البيع',
    'sales.discount.apply': 'تطبيق خصم على البيع',
    'sales.discount.override': 'تجاوز حد الخصم',
    'payments.cash.accept': 'قبول الدفع النقدي',
    'payments.refund.request': 'طلب استرداد',
    'payments.refund.approve': 'اعتماد الاسترداد',
    'shift.open': 'فتح الوردية',
    'shift.close': 'إغلاق الوردية',
    'shift.reconcile.approve': 'اعتماد تسوية الوردية',
    'memberships.freeze': 'تجميد الاشتراكات',
    'memberships.assign': 'إسناد / تجديد الاشتراكات',
    'plans.manage': 'إدارة الباقات',
    'reports.financial.view': 'عرض التقارير المالية',
    'reports.expenses.view': 'عرض المصروفات',
    'reports.expenses.manage': 'إدارة المصروفات',
    'settings.manage': 'إدارة إعدادات الصالة',
    'inventory.view': 'عرض المخزون',
    'inventory.manage': 'إدارة المخزون',
    'inventory.adjust': 'تعديل المخزون',
    'inventory.purchase': 'شراء المخزون',
    'inventory.transfer': 'نقل المخزون',
    'member_orders.view': 'عرض طلبات تطبيق الأعضاء',
    'member_orders.manage': 'إدارة طلبات تطبيق الأعضاء',
    'hr.view': 'عرض دليل الموظفين',
    'hr.manage': 'إدارة دليل الموظفين',
    'hr.shifts.manage': 'إدارة قوالب الورديات والجداول',
    'hr.attendance.manage': 'إدارة حضور الموظفين',
    'hr.attendance.view': 'عرض حضور الموظفين',
    'hr.leave.view': 'عرض إجازات الموظفين',
    'hr.leave.manage': 'إدارة إجازات الموظفين',
    'hr.leave.approve': 'اعتماد إجازات الموظفين',
    'hr.payroll.view': 'عرض الرواتب',
    'hr.payroll.manage': 'إدارة الرواتب',
    'hr.payroll.approve': 'اعتماد الرواتب',
    'hr.documents.view': 'عرض مستندات الموظفين',
    'hr.documents.manage': 'إدارة مستندات الموظفين'
  };
  var GROUP_LABEL_AR = {
    members: 'الأعضاء',
    attendance: 'الحضور',
    sales: 'المبيعات',
    payments: 'المدفوعات',
    shifts: 'الورديات',
    memberships: 'الاشتراكات',
    plans: 'الباقات',
    reports: 'التقارير',
    settings: 'الإعدادات',
    inventory: 'المخزون',
    'member-orders': 'طلبات تطبيق الأعضاء',
    hr: 'الموارد البشرية'
  };
  function roleLabelText(id, fallback) {
    return t(fallback, ROLE_LABEL_AR[id] || fallback);
  }
  function roleDescText(id, en) {
    return t(en, ROLE_DESC_AR[id] || en);
  }
  function permLabelText(key, en) {
    return t(en, PERMISSION_LABELS_AR[key] || en);
  }
  function groupLabelText(id, en) {
    return t(en, GROUP_LABEL_AR[id] || en);
  }

  var role = user && user.role;
  if (window.GfpAuthz && typeof window.GfpAuthz.getUserRole === 'function') {
    role = window.GfpAuthz.getUserRole() || role;
  }
  var isOwner = R.isOwnerRole(role);
  if (!isOwner) {
    if (content) content.style.display = 'none';
    if (guard) {
      guard.hidden = false;
      guard.classList.add('is-on');
    }
    return;
  }
  if (guard) {
    guard.hidden = true;
    guard.classList.remove('is-on');
  }
  if (content) content.style.removeProperty('display');

  var overlay = document.getElementById('drawerOverlay');
  var drawer = document.getElementById('drawerContent');
  var catalog = null;
  var staffCounts = null;
  var lastFocus = null;
  var openRoleId = null;
  var saving = false;

  var avColors = {
    Owner: { bg: 'rgba(217,119,6,.12)', fg: '#D97706' },
    Manager: { bg: 'rgba(59,130,246,.12)', fg: '#3B82F6' },
    Trainer: { bg: 'rgba(13,148,136,.12)', fg: '#0D9488' },
    Receptionist: { bg: 'rgba(139,92,246,.12)', fg: '#7C3AED' }
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function universe() {
    if (catalog && catalog.universe && catalog.universe.length)
      return catalog.universe.length;
    return R.permissionUniverseCount();
  }

  function roleRow(id) {
    if (!catalog || !catalog.roles) return null;
    var i;
    for (i = 0; i < catalog.roles.length; i++) {
      if (catalog.roles[i].id === id) return catalog.roles[i];
    }
    return null;
  }

  function usedByText(id) {
    if (!staffCounts || !Object.prototype.hasOwnProperty.call(staffCounts, id)) return '';
    return '<span class="roles-used">' + esc(t('Used by', 'يُستخدم من قِبل')) + ' ' + staffCounts[id] + ' ' + esc(t('staff', 'موظف')) + '</span>';
  }

  function renderError(msg) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell" role="alert">' + esc(msg) + '</td></tr>';
  }

  function renderList() {
    var ids = (catalog && catalog.roles) ? catalog.roles.map(function (r) { return r.id; }) : (R.STAFF_ROLES || []);
    if (!ids.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">' + esc(t('No roles to show', 'لا توجد أدوار لعرضها')) + '</td></tr>';
      return;
    }
    tbody.innerHTML = ids.map(function (id) {
      var meta = R.ROLE_META[id] || { icon: 'ti-user', cls: '', label: id };
      var ac = avColors[id] || avColors.Trainer;
      var row = roleRow(id);
      var n = row ? row.permissions.length : R.permissionCount(id);
      var editable = row ? row.editable : id !== 'Owner';
      var customized = !!(row && row.isCustomized);
      var desc = roleDescText(id, R.roleDescription(id));
      var type = id === 'Owner' ? t('Locked', 'ثابت') : (customized ? t('Custom', 'مخصص') : t('Default', 'افتراضي'));
      var action = editable ? t('Edit tasks', 'تعديل المهام') : t('View', 'عرض');
      return '<tr data-role="' + esc(id) + '" tabindex="0">' +
        '<td><div class="staff-cell">' +
          '<div class="staff-av" style="background:' + ac.bg + ';color:' + ac.fg + '" aria-hidden="true"><i class="ti ' + esc(meta.icon) + '"></i></div>' +
          '<div><div class="staff-name">' + esc(roleLabelText(id, meta.label || id)) + '</div>' +
          '<div class="roles-sys">' + (id === 'Owner' ? esc(t('System role', 'دور نظامي')) : esc(t('This gym', 'هذه الصالة'))) + '</div>' +
          usedByText(id) +
        '</div></div></td>' +
        '<td class="role-desc">' + esc(desc) + '</td>' +
        '<td class="perm-count">' + n + ' ' + esc(t('of', 'من')) + ' ' + universe() + '</td>' +
        '<td class="type-cell">' + esc(type) + '</td>' +
        '<td><button type="button" class="roles-view-btn" data-role="' + esc(id) + '" aria-label="' + esc(action + ' ' + roleLabelText(id, meta.label || id)) + '">' + esc(action) + '</button></td>' +
      '</tr>';
    }).join('');
  }

  function closeDrawer() {
    if (!overlay) return;
    overlay.classList.remove('show');
    openRoleId = null;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function collectedKeys() {
    return Array.prototype.map.call(
      drawer.querySelectorAll('input[name="perm"]:checked'),
      function (el) { return el.value; }
    );
  }

  function openDrawer(id) {
    var row = roleRow(id);
    if (!row && !R.isStaffRole(id)) return;
    var meta = R.ROLE_META[id] || { icon: 'ti-user', label: id };
    var keys = row ? row.permissions : R.permissionsForRole(id);
    var editable = row ? row.editable : false;
    var n = keys.length;
    var groups = R.groupsForKeys(keys, !editable);
    var notes = (catalog && catalog.notes) || [];
    var effect = (catalog && catalog.effectCopy) || 'Takes effect on next login, or within about 15 minutes.';
    var effectAr = (catalog && catalog.effectCopy) ? effect : 'يسري عند تسجيل الدخول التالي، أو خلال 15 دقيقة تقريبًا.';
    var warn = id === 'Owner'
      ? t('Locked. Owner always has full access.', 'ثابت. المالك لديه دائمًا صلاحية كاملة.')
      : t(effect, effectAr);
    var groupsHtml = groups.map(function (g) {
      var rows = g.items.map(function (item) {
        var label = permLabelText(item.key, item.label);
        if (!editable) {
          return '<div class="roles-perm">' +
            '<span class="roles-perm-label">' + esc(label) + '</span>' +
            '<span class="roles-perm-state ' + (item.allowed ? 'is-yes' : 'is-no') + '">' +
              esc(item.allowed ? t('Allowed', 'مسموح') : t('Not included', 'غير مشمول')) +
            '</span></div>';
        }
        return '<label class="roles-check">' +
          '<input type="checkbox" name="perm" value="' + esc(item.key) + '"' + (item.allowed ? ' checked' : '') + '>' +
          '<span>' + esc(label) + '</span>' +
        '</label>';
      }).join('');
      return '<div class="roles-grp"><h3>' + esc(groupLabelText(g.id, g.label)) + '</h3>' + rows + '</div>';
    }).join('');
    var notesHtml = notes.length
      ? '<ul class="roles-notes">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
      : '';
    var footer = editable
      ? '<div class="drawer-footer">' +
          ((row && row.isCustomized)
            ? '<button type="button" class="btn-cancel" id="btnResetRole">' + esc(t('Reset to default', 'إعادة للوضع الافتراضي')) + '</button>'
            : '') +
          '<button type="button" class="btn-primary" id="btnSaveRole"><i class="ti ti-check"></i> ' + esc(t('Save tasks', 'حفظ المهام')) + '</button>' +
        '</div>'
      : '';
    drawer.innerHTML =
      '<div class="drawer-hdr">' +
        '<div>' +
          '<button type="button" class="roles-drawer-back" id="btnBackRoles"><i class="ti ti-arrow-left" aria-hidden="true"></i> ' + esc(t('Back to Roles', 'العودة للأدوار')) + '</button>' +
          '<h2 id="drawerTitle"><i class="ti ' + esc(meta.icon) + '" aria-hidden="true"></i> ' + esc(roleLabelText(id, meta.label || id)) + '</h2>' +
          '<div class="roles-sys">' + esc(editable ? (row && row.isCustomized ? t('Custom for this gym', 'مخصص لهذه الصالة') : t('Gym default', 'الافتراضي لهذه الصالة')) : t('System Role', 'دور نظامي')) + '</div>' +
          (id === 'Owner' ? '<div class="roles-full">' + esc(t('Full Access', 'صلاحية كاملة')) + '</div>' : '') +
          '<div class="muted">' + n + ' ' + esc(t('of', 'من')) + ' ' + universe() + ' ' + esc(t('permissions', 'صلاحية')) + '</div>' +
        '</div>' +
        '<button type="button" class="modal-close" id="btnCloseDrawer" aria-label="' + esc(t('Close', 'إغلاق')) + '"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="drawer-body">' +
        '<div class="roles-warn">' + esc(warn) + '</div>' +
        groupsHtml +
        notesHtml +
      '</div>' + footer;
    overlay.classList.add('show');
    openRoleId = id;
    var closeBtn = document.getElementById('btnCloseDrawer');
    if (closeBtn) closeBtn.focus();
  }

  function onRowActivate(id, fromEl) {
    lastFocus = fromEl || document.activeElement;
    openDrawer(id);
  }

  async function saveOpenRole() {
    if (saving || !openRoleId) return;
    saving = true;
    var btn = document.getElementById('btnSaveRole');
    if (btn) btn.disabled = true;
    var res = await apiPut('/admin/roles/' + encodeURIComponent(openRoleId), { permissions: collectedKeys() });
    saving = false;
    if (btn) btn.disabled = false;
    if (res && res.ok && res.data) {
      var i;
      for (i = 0; i < catalog.roles.length; i++) {
        if (catalog.roles[i].id === openRoleId) {
          catalog.roles[i] = res.data;
          break;
        }
      }
      toast(t('Tasks saved. Staff pick them up on next login or within about 15 minutes.', 'تم حفظ المهام. سيحصل عليها الموظفون عند تسجيل الدخول التالي أو خلال 15 دقيقة تقريبًا.'));
      renderList();
      openDrawer(openRoleId);
      return;
    }
    toast((res && res.data && (res.data.detail || res.data.error || res.data.message)) || t('Could not save', 'تعذّر الحفظ'), 'error');
  }

  async function resetOpenRole() {
    if (saving || !openRoleId) return;
    saving = true;
    var res = await apiPost('/admin/roles/' + encodeURIComponent(openRoleId) + '/reset');
    saving = false;
    if (res && res.ok && res.data) {
      var i;
      for (i = 0; i < catalog.roles.length; i++) {
        if (catalog.roles[i].id === openRoleId) {
          catalog.roles[i] = res.data;
          break;
        }
      }
      toast(t('Restored gym default for this job.', 'تمت إعادة الوضع الافتراضي لهذا الدور.'));
      renderList();
      openDrawer(openRoleId);
      return;
    }
    toast((res && res.data && (res.data.detail || res.data.error)) || t('Could not reset', 'تعذّرت إعادة الضبط'), 'error');
  }

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('.roles-view-btn');
    var tr = e.target.closest('tr[data-role]');
    var id = (btn && btn.getAttribute('data-role')) || (tr && tr.getAttribute('data-role'));
    if (!id) return;
    onRowActivate(id, btn || tr);
  });

  tbody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr[data-role]');
    if (!tr) return;
    e.preventDefault();
    onRowActivate(tr.getAttribute('data-role'), tr);
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeDrawer();
    if (e.target.closest('#btnCloseDrawer') || e.target.closest('#btnBackRoles')) closeDrawer();
    if (e.target.closest('#btnSaveRole')) saveOpenRole();
    if (e.target.closest('#btnResetRole')) resetOpenRole();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      e.preventDefault();
      closeDrawer();
    }
  });

  window.addEventListener('gfp:locale', function () {
    if (catalog) renderList();
    if (openRoleId) openDrawer(openRoleId);
  });

  (async function boot() {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell"><div class="loader"></div>' + esc(t('Loading roles…', 'جارٍ تحميل الأدوار…')) + '</td></tr>';
    try {
      catalog = await apiGet('/admin/roles');
    } catch (err) {
      catalog = null;
    }
    if (!catalog || !Array.isArray(catalog.roles)) {
      renderError(t('Could not load roles. Refresh and try again.', 'تعذّر تحميل الأدوار. أعد تحميل الصفحة وحاول مرة أخرى.'));
      return;
    }
    renderList();
    try {
      var data = await apiGet('/admin/staff');
      staffCounts = R.countStaffByRole(Array.isArray(data) ? data : null);
      if (staffCounts) renderList();
    } catch (err) {
      staffCounts = null;
    }
  })();
})();
