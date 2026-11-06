(function () {
  var R = window.GfpStaffRules;

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
    Manager: 'التشغيل، بدون الإعدادات',
    Receptionist: 'مكتب الاستقبال',
    Trainer: 'تسجيل الحضور'
  };
  var DEPT_LABEL_AR = {
    'Front Desk': 'مكتب الاستقبال',
    'Sales': 'المبيعات',
    'Training': 'التدريب',
    'Management': 'الإدارة',
    'Operations': 'العمليات',
    'Other': 'أخرى'
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

  function roleLabelText(key) {
    var m = R.ROLE_META[key];
    var label = m ? m.label : key;
    return t(label, ROLE_LABEL_AR[key] || label);
  }
  function roleDescText(key) {
    var en = key === 'Manager' ? 'Ops, not settings' : key === 'Receptionist' ? 'Front desk' : 'Check-in';
    return t(en, ROLE_DESC_AR[key] || en);
  }
  function deptLabelText(dept) {
    if (!dept) return '';
    return t(dept, DEPT_LABEL_AR[dept] || dept);
  }
  function permLabelText(key) {
    var en = (R.PERMISSION_LABELS && R.PERMISSION_LABELS[key]) || key;
    return t(en, PERMISSION_LABELS_AR[key] || en);
  }
  function groupLabelText(group) {
    var en = group.label || group.id;
    return t(en, GROUP_LABEL_AR[group.id] || en);
  }

  /** Backend-generated placeholder for staff with no real email on file (Identity requires a unique email). Display-only check — never sent to the API. */
  function isPlaceholderEmail(email) {
    return !!email && /@(employee|member)\.[^.@]+\.local$/i.test(String(email).trim());
  }
  function emailDisplay(email) {
    if (isPlaceholderEmail(email)) return t('No email on file', 'لا يوجد بريد إلكتروني مسجل');
    return email || '';
  }
  var role = user && user.role;
  if (window.GfpAuthz && typeof window.GfpAuthz.getUserRole === 'function') {
    role = window.GfpAuthz.getUserRole() || role;
  }
  var isOwner = R && R.isOwnerRole(role);
  var guard = document.getElementById('ownerGuard');
  var content = document.getElementById('staffContent');
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

  var tbody = document.getElementById('staffBody');
  var allStaff = [];
  /** @type {string} ApplicationUser.Id — Identity / JWT sub, not AppUser.Id */
  var openStaffId = null;

  var avColors = {
    Owner: { bg: 'rgba(217,119,6,.12)', fg: '#D97706' },
    Manager: { bg: 'rgba(59,130,246,.12)', fg: '#3B82F6' },
    Trainer: { bg: 'rgba(13,148,136,.12)', fg: '#0D9488' },
    Receptionist: { bg: 'rgba(139,92,246,.12)', fg: '#7C3AED' }
  };

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function initials(name) {
    return (name || '?').split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  }
  function fmtDate(d) {
    if (!d) return '—';
    var I18n = window.GfpI18n;
    if (I18n && I18n.formatDate) return I18n.formatDate(d);
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function loginDisplay(login) {
    if (!login) return { text: '', cls: 'never' };
    if (login.days === -1) return { text: t('Never logged in', 'لم يسجل الدخول بعد'), cls: login.cls };
    if (login.days === 1) return { text: t('Yesterday', 'أمس'), cls: login.cls };
    if (login.days === 0) {
      var m = /^Today at (.+)$/.exec(login.text);
      var time = m ? m[1] : '';
      return { text: t(login.text, time ? 'اليوم الساعة ' + time : 'اليوم'), cls: login.cls };
    }
    var n = login.days;
    var ar = n === 2 ? 'منذ يومين' : 'منذ ' + n + (n >= 3 && n <= 10 ? ' أيام' : ' يومًا');
    return { text: t(login.text, ar), cls: login.cls };
  }
  function staffId(s) { return s.id; }
  function roleKey(s) { return R.canonicalRole(s.role); }
  function roleMeta(s) { return R.ROLE_META[roleKey(s)] || R.ROLE_META.Trainer; }
  function colors(s) { return avColors[roleKey(s)] || avColors.Trainer; }

  function deptOptions(selected) {
    var cur = selected || '';
    return '<option value="">—</option>' + (R.DEPARTMENTS || []).map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === cur ? ' selected' : '') + '>' + esc(deptLabelText(d)) + '</option>';
    }).join('');
  }

  function kv(label, value) {
    if (value == null || value === '') return '';
    return '<div class="kv"><span>' + esc(label) + '</span><b>' + esc(String(value)) + '</b></div>';
  }

  function hireInputValue(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  }

  function workFieldsHtml(s) {
    s = s || {};
    return '' +
      '<div class="fg"><label>' + esc(t('Phone', 'الهاتف')) + '</label><input name="phoneNumber" value="' + esc(s.phoneNumber || '') + '" placeholder="01xxxxxxxxx" maxlength="20"></div>' +
      '<div class="fg"><label>' + esc(t('Job title', 'المسمى الوظيفي')) + '</label><input name="jobTitle" value="' + esc(s.jobTitle || '') + '" placeholder="' + esc(t('e.g. Front Desk Supervisor', 'مثال: مشرف الاستقبال')) + '" maxlength="80"></div>' +
      '<div class="fg"><label>' + esc(t('Department', 'القسم')) + '</label><select name="department">' + deptOptions(s.department) + '</select></div>' +
      '<div class="fg"><label>' + esc(t('Hire date', 'تاريخ التعيين')) + '</label><input type="date" name="hireDate" value="' + esc(hireInputValue(s.hireDate)) + '"></div>' +
      '<div class="fg"><label>' + esc(t('Notes', 'ملاحظات')) + '</label><textarea name="notes" rows="3" maxlength="2000" placeholder="' + esc(t('Ops notes for the owner', 'ملاحظات تشغيلية لصاحب الصالة')) + '">' + esc(s.notes || '') + '</textarea></div>';
  }

  function collectWork(fd) {
    var hire = String(fd.get('hireDate') || '').trim();
    var work = {
      phoneNumber: String(fd.get('phoneNumber') || '').trim(),
      jobTitle: String(fd.get('jobTitle') || '').trim(),
      department: String(fd.get('department') || '').trim(),
      notes: String(fd.get('notes') || '').trim()
    };
    if (hire) work.hireDate = hire;
    return work;
  }

  function apiErr(res, fallback) {
    var d = res && res.data;
    if (!d) return fallback;
    if (d.message || d.error) return d.message || d.error;
    if (d.detail) return d.detail;
    if (d.errors) {
      var key = Object.keys(d.errors)[0];
      var first = key ? d.errors[key] : null;
      if (Array.isArray(first) && first[0]) return first[0];
    }
    return fallback;
  }

  function roleCardsHtml(selected) {
    var sel = R.isCreatableRole(selected) ? R.canonicalRole(selected) : 'Trainer';
    return R.CREATABLE_ROLES.map(function (w) {
      var m = R.ROLE_META[w];
      var ac = avColors[w];
      var on = sel === w;
      return '<div class="role-card ' + (on ? 'selected' : '') + '" data-role="' + w + '">' +
        '<input type="radio" name="role" value="' + w + '" ' + (on ? 'checked' : '') + '>' +
        '<div class="role-card-icon" style="background:' + ac.bg + ';color:' + ac.fg + '"><i class="ti ' + m.icon + '"></i></div>' +
        '<div class="role-card-name">' + esc(roleLabelText(w)) + '</div>' +
        '<div class="role-card-desc">' + esc(roleDescText(w)) + '</div>' +
        '</div>';
    }).join('');
  }

  var roleCatalog = null;

  function roleTasksHtml(role) {
    var key = R.isCreatableRole(role) ? R.canonicalRole(role) : 'Trainer';
    var keys = R.permissionsFromCatalog(key, roleCatalog);
    var groups = R.groupsForKeys(keys, true);
    var n = keys.length;
    var customized = false;
    if (roleCatalog && roleCatalog.roles) {
      var hit = roleCatalog.roles.filter(function (r) { return r.id === key; })[0];
      customized = !!(hit && hit.isCustomized);
    }
    var body = groups.map(function (g) {
      var items = g.items.filter(function (i) { return i.allowed; }).map(function (i) {
        return '<li>' + esc(permLabelText(i.key)) + '</li>';
      }).join('');
      return '<div class="job-tasks-grp"><div class="job-tasks-grp-name">' + esc(groupLabelText(g)) + '</div><ul>' + items + '</ul></div>';
    }).join('');
    var suffix = customized ? t(' · custom for this gym', ' · مخصص لهذه الصالة') : t(' · gym default', ' · افتراضي الصالة');
    return '<div class="job-tasks" id="jobTasks">' +
      '<div class="job-tasks-hd">' + esc(t('This job can', 'هذه الوظيفة تسمح بـ')) + ' <span>' + n + ' ' + esc(t('tasks', 'مهمة')) + esc(suffix) + '</span></div>' +
      body +
      '<p class="hint">' + esc(t('Change this person’s job here. Change the job’s tasks on', 'غيّر وظيفة هذا الشخص من هنا. لتغيير مهام الوظيفة اذهب إلى')) + ' <a href="/dashboard/roles/">' + esc(t('Roles', 'الأدوار')) + '</a>.</p>' +
    '</div>';
  }

  function paintJobTasks(root) {
    var radio = root.querySelector('.role-card.selected input, input[name="role"]:checked');
    var role = radio ? radio.value : 'Trainer';
    var box = root.querySelector('#jobTasks');
    var html = roleTasksHtml(role);
    if (!box) {
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var selector = root.querySelector('.role-selector');
      if (selector && selector.parentNode) selector.parentNode.insertBefore(wrap.firstChild, selector.nextSibling);
      return;
    }
    var next = document.createElement('div');
    next.innerHTML = html;
    box.replaceWith(next.firstChild);
  }

  function bindRoleCards(root) {
    root.querySelectorAll('.role-card').forEach(function (card) {
      card.addEventListener('click', function () {
        root.querySelectorAll('.role-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        card.querySelector('input').checked = true;
        paintJobTasks(root);
      });
    });
    paintJobTasks(root);
  }

  function passwordChecklistHtml(idPrefix) {
    return '<div class="pw-checklist" id="' + idPrefix + 'Checklist">' +
      '<div class="pw-req" data-req="length"><i class="ti ti-circle"></i> ' + esc(t('6+ characters', '6 أحرف أو أكثر')) + '</div>' +
      '<div class="pw-req" data-req="upper"><i class="ti ti-circle"></i> ' + esc(t('Uppercase letter', 'حرف كبير')) + '</div>' +
      '<div class="pw-req" data-req="lower"><i class="ti ti-circle"></i> ' + esc(t('Lowercase letter', 'حرف صغير')) + '</div>' +
      '<div class="pw-req" data-req="number"><i class="ti ti-circle"></i> ' + esc(t('Number', 'رقم')) + '</div>' +
      '</div>' +
      '<div class="hint">' + esc(t('A special character is optional. Backend does not require one.', 'الرمز الخاص اختياري وغير مطلوب من النظام.')) + '</div>';
  }

  function paintPassword(pw, fillId, labelId, checklistSel) {
    var checks = R.checkPassword(pw);
    var met = ['length', 'upper', 'lower', 'number'].filter(function (k) { return checks[k]; }).length;
    var levels = ['', 'weak', 'fair', 'strong', 'very-strong'];
    var labels = ['', t('Weak', 'ضعيفة'), t('Fair', 'متوسطة'), t('Strong', 'قوية'), t('Very strong', 'قوية جدًا')];
    var fill = document.getElementById(fillId);
    var lbl = document.getElementById(labelId);
    fill.className = 'pw-fill ' + (levels[met] || '');
    lbl.className = 'pw-label ' + (levels[met] || '');
    lbl.textContent = pw.length > 0 ? (labels[met] || '') : '';
    document.querySelectorAll(checklistSel + ' .pw-req').forEach(function (el) {
      var req = el.dataset.req;
      if (checks[req]) {
        el.classList.add('met');
        el.querySelector('i').className = 'ti ti-circle-check-filled';
      } else {
        el.classList.remove('met');
        el.querySelector('i').className = 'ti ti-circle';
      }
    });
  }

  function openOverlay(id) { document.getElementById(id).classList.add('show'); }
  function closeOverlay(id) { document.getElementById(id).classList.remove('show'); }

  ['addModalOverlay', 'resetModalOverlay', 'deactOverlay', 'drawerOverlay'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function (e) {
      if (e.target === this) closeOverlay(id);
    });
  });

  function filteredStaff() {
    var q = (document.getElementById('staffSearch').value || '').trim().toLowerCase();
    var role = document.getElementById('staffRoleFilter').value;
    var status = document.getElementById('staffStatusFilter').value;
    return allStaff.filter(function (s) {
      if (role && roleKey(s) !== role) return false;
      var dept = document.getElementById('staffDeptFilter');
      var deptVal = dept ? dept.value : '';
      if (deptVal && (s.department || '') !== deptVal) return false;
      if (status === 'active' && s.isActive === false) return false;
      if (status === 'inactive' && s.isActive !== false) return false;
      if (!q) return true;
      var name = (s.fullName || '').toLowerCase();
      var email = (s.email || '').toLowerCase();
      var num = (s.staffNumber || '').toLowerCase();
      var phone = (s.phoneNumber || '').toLowerCase();
      return name.indexOf(q) !== -1 || email.indexOf(q) !== -1 || num.indexOf(q) !== -1 || phone.indexOf(q) !== -1;
    });
  }

  async function loadStaff() {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell"><div class="loader"></div>' + esc(t('Loading staff…', 'جاري تحميل الموظفين…')) + '</td></tr>';
    var data = null;
    try {
      data = await apiGet('/admin/staff');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">' + esc(t('Could not load staff. Refresh and try again.', 'تعذر تحميل الموظفين. حدّث الصفحة وحاول مرة أخرى.')) + '</td></tr>';
      return;
    }
    if (data == null) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">' + esc(t('Could not load staff. Refresh and try again.', 'تعذر تحميل الموظفين. حدّث الصفحة وحاول مرة أخرى.')) + '</td></tr>';
      return;
    }
    allStaff = Array.isArray(data) ? data : [];
    renderTable();
  }

  function paintStaffPrepareHint() {
    var host = document.getElementById('staffPrepareHint');
    if (!host) return;
    var PG = window.GfpPrepareGym;
    var missing = PG && PG.hasFrontDeskStaff ? !PG.hasFrontDeskStaff(allStaff) : false;
    if (!missing) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML =
      '<div><strong>' + esc(t('Add a receptionist', 'أضف موظف استقبال')) + '</strong>' +
      '<p>' + esc(t(
        'The owner account can run the gym, but a front-desk login is what you need for daily check-in and cash sales.',
        'حساب المالك يمكنه تشغيل النادي، لكن تحتاج حساب استقبال لتسجيل الحضور اليومي واستلام النقد.'
      )) + '</p></div>';
  }

  function renderTable() {
    paintStaffPrepareHint();
    var staff = filteredStaff();
    if (!staff.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell"><i class="ti ti-users-group" style="font-size:36px;display:block;margin-bottom:8px;color:var(--ls4)"></i>' +
        (allStaff.length
          ? esc(t('No staff match this search.', 'لا يوجد موظفون مطابقون لهذا البحث.'))
          : ('<strong>' + esc(t('No front-desk staff yet', 'لا يوجد موظف استقبال بعد')) + '</strong><div style="margin-top:6px;font-size:13px;color:var(--ltt)">' +
            esc(t('Add a receptionist so someone besides the owner can register members, take cash, and check people in.', 'أضف موظف استقبال حتى يتمكن غير المالك من تسجيل الأعضاء واستلام النقد وتسجيل الحضور.')) +
            '</div><button type="button" class="btn-add-staff" id="emptyAddStaff" style="margin-top:10px"><i class="ti ti-user-plus"></i> ' +
            esc(t('Add receptionist', 'إضافة موظف استقبال')) + '</button>')) +
        '</td></tr>';
      var emptyAdd = document.getElementById('emptyAddStaff');
      var addBtn = document.getElementById('btnAddStaff');
      if (emptyAdd && addBtn) emptyAdd.addEventListener('click', function () { addBtn.click(); });
      return;
    }
    tbody.innerHTML = staff.map(function (s) {
      var role = roleMeta(s);
      var roleLabel = roleLabelText(roleKey(s));
      var ac = colors(s);
      var login = loginDisplay(R.formatLastLogin(s.lastLoginAt));
      var owner = R.isOwnerRole(s.role);
      var isActive = s.isActive !== false;
      var name = s.fullName || '';
      var photo = s.profilePhotoUrl
        ? '<img class="staff-av-img" src="' + esc(s.profilePhotoUrl) + '" alt="">'
        : '<div class="staff-av" style="background:' + ac.bg + ';color:' + ac.fg + '">' + initials(name) + '</div>';
      return '<tr data-id="' + esc(staffId(s)) + '">' +
        '<td><div class="staff-cell">' + photo + '<div><div class="staff-name">' + esc(name) + '</div>' +
          (s.email ? '<div class="muted" style="font-size:12px">' + esc(emailDisplay(s.email)) + '</div>' : '') +
        '</div></div></td>' +
        '<td class="mono-cell">' + esc(s.staffNumber || '—') + '</td>' +
        '<td>' + esc(s.jobTitle || '—') + '</td>' +
        '<td><span class="role-badge ' + role.cls + '"><i class="ti ' + role.icon + '"></i>' + esc(roleLabel) + '</span></td>' +
        '<td>' + esc(deptLabelText(s.department) || '—') + '</td>' +
        '<td><span class="status-badge ' + (isActive ? 'active' : 'inactive') + '"><span class="dot"></span>' + esc(isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) + '</span></td>' +
        '<td><div class="login-info ' + login.cls + '"><i class="ti ' + (login.cls === 'never' ? 'ti-clock-x' : 'ti-clock') + '"></i>' + esc(login.text) + '</div></td>' +
        '<td><div class="act-group">' +
          '<button class="act-btn" title="' + esc(t('View', 'عرض')) + '" data-action="view" data-id="' + esc(staffId(s)) + '"><i class="ti ti-eye"></i></button>' +
          '<button class="act-btn ' + (owner ? 'disabled' : '') + '" title="' + esc(t('Edit', 'تعديل')) + '" data-action="edit" data-id="' + esc(staffId(s)) + '" ' + (owner ? 'disabled' : '') + '><i class="ti ti-edit"></i></button>' +
          '<button class="act-btn key ' + (owner ? 'disabled' : '') + '" title="' + esc(t('Reset password', 'إعادة تعيين كلمة المرور')) + '" data-action="reset" data-id="' + esc(staffId(s)) + '" data-name="' + esc(name) + '" ' + (owner ? 'disabled' : '') + '><i class="ti ti-key"></i></button>' +
          '<button class="act-btn deact ' + (owner ? 'disabled' : '') + '" title="' + esc(isActive ? t('Deactivate', 'إيقاف') : t('Reactivate', 'إعادة تفعيل')) + '" data-action="deact" data-id="' + esc(staffId(s)) + '" data-name="' + esc(name) + '" data-active="' + isActive + '" ' + (owner ? 'disabled' : '') + '><i class="ti ' + (isActive ? 'ti-user-off' : 'ti-user-check') + '"></i></button>' +
        '</div></td></tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.act-btn')) return;
        open360(row.getAttribute('data-id'));
      });
    });
    tbody.querySelectorAll('.act-btn:not(.disabled)').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = this.dataset.action;
        var id = this.dataset.id;
        if (action === 'view') open360(id);
        else if (action === 'edit') openEditDrawer(id);
        else if (action === 'reset') showResetModal(id, this.dataset.name);
        else if (action === 'deact') showDeactConfirm(id, this.dataset.name, this.dataset.active === 'true');
      });
    });
  }

  async function open360(id) {
    openStaffId = id;
    var s = allStaff.find(function (x) { return staffId(x) === id; }) || {};
    var detail = await apiGet('/admin/staff/' + id);
    if (!detail) { toast(t('Could not load staff', 'تعذر تحميل بيانات الموظف'), 'error'); return; }
    s = detail;
    var owner = R.isOwnerRole(s.role);
    var isActive = s.isActive !== false;
    var ac = colors(s);
    var role = roleMeta(s);
    var roleLabel = roleLabelText(roleKey(s));
    var login = loginDisplay(R.formatLastLogin(s.lastLoginAt));
    var perms = R.permissionsFromCatalog(s.role, roleCatalog);
    var photo = s.profilePhotoUrl
      ? '<img class="staff-av-img lg" src="' + esc(s.profilePhotoUrl) + '" alt="">'
      : '<div class="staff-av" style="width:64px;height:64px;font-size:20px;background:' + ac.bg + ';color:' + ac.fg + ';margin:0 auto">' + initials(s.fullName) + '</div>';

    var drawer = document.getElementById('drawerContent');
    drawer.className = 'drawer drawer-360';
    drawer.innerHTML =
      '<div class="drawer-hdr"><div><h2>' + esc(t('Staff 360', 'ملف الموظف الكامل')) + '</h2><div class="modal-hdr-sub">' + esc(s.staffNumber || t('Identity account', 'حساب دخول')) + '</div></div>' +
      '<button class="modal-close" id="drawerClose"><i class="ti ti-x"></i></button></div>' +
      '<div class="drawer-body">' +
        '<div class="staff360-hero">' + photo +
        '<div class="staff-name" style="font-size:18px;margin-top:8px">' + esc(s.fullName) + '</div>' +
        '<div class="muted">' + esc(emailDisplay(s.email)) + '</div></div>' +
        '<div class="staff360-sec"><h3>' + esc(t('Profile', 'الملف الشخصي')) + '</h3>' +
          kv(t('Staff number', 'رقم الموظف'), s.staffNumber) +
          kv(t('Full name', 'الاسم الكامل'), s.fullName) +
          kv(t('Phone', 'الهاتف'), s.phoneNumber) +
          kv(t('Email', 'البريد الإلكتروني'), emailDisplay(s.email)) +
          kv(t('Job title', 'المسمى الوظيفي'), s.jobTitle) +
          kv(t('Department', 'القسم'), deptLabelText(s.department)) +
          kv(t('Hire date', 'تاريخ التعيين'), s.hireDate ? fmtDate(s.hireDate) : '') +
          (s.notes ? '<div class="staff360-notes">' + esc(s.notes) + '</div>' : '') +
        '</div>' +
        '<div class="staff360-sec"><h3>' + esc(t('Account', 'الحساب')) + '</h3>' +
          '<div class="kv"><span>' + esc(t('Status', 'الحالة')) + '</span><span class="status-badge ' + (isActive ? 'active' : 'inactive') + '"><span class="dot"></span>' + esc(isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط')) + '</span></div>' +
          kv(t('Created', 'تاريخ الإنشاء'), fmtDate(s.createdAtUtc)) +
          '<div class="kv"><span>' + esc(t('Last login', 'آخر تسجيل دخول')) + '</span><b>' + esc(login.text) + '</b></div>' +
          (isActive ? '' : '<p class="hint">' + esc(t('This account cannot log in or refresh its session. Existing access tokens may remain valid until their normal expiry.', 'لا يمكن لهذا الحساب تسجيل الدخول أو تجديد الجلسة. قد تبقى رموز الدخول الحالية صالحة حتى انتهاء مدتها الطبيعية.')) + '</p>') +
        '</div>' +
        '<div class="staff360-sec"><h3>' + esc(t('Access', 'الصلاحيات')) + '</h3>' +
          '<div class="kv"><span>' + esc(t('Role', 'الدور')) + '</span><span class="role-badge ' + role.cls + '"><i class="ti ' + role.icon + '"></i>' + esc(roleLabel) + '</span></div>' +
          '<div class="kv"><span>' + esc(t('Tasks', 'المهام')) + '</span><b>' + perms.length + '</b></div>' +
          '<p class="hint">' + esc(t('Tasks come with the job for this gym. Change them on', 'المهام مرتبطة بالوظيفة في هذه الصالة. لتغييرها اذهب إلى')) + ' <a href="/dashboard/roles/">' + esc(t('Roles', 'الأدوار')) + '</a>.</p>' +
          perms.map(function (p) {
            return '<div class="perm-row"><i class="ti ti-check"></i>' + esc(permLabelText(p)) + '</div>';
          }).join('') +
        '</div>' +
        '<div class="staff360-sec" id="staffActivity"><h3>' + esc(t('Activity', 'النشاط')) + '</h3><p class="hint">' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>' +
      '</div>' +
      '<div class="drawer-footer">' +
        (owner
          ? '<span class="hint">' + esc(t('Owner is view-only in Staff Management.', 'حساب المالك للعرض فقط في إدارة الموظفين.')) + '</span>'
          : '<button class="btn-cancel" id="from360Edit">' + esc(t('Edit', 'تعديل')) + '</button>' +
            '<button class="btn-cancel" id="from360Reset">' + esc(t('Reset password', 'إعادة تعيين كلمة المرور')) + '</button>' +
            '<button class="' + (isActive ? 'btn-danger' : 'btn-primary') + '" id="from360Deact">' + esc(isActive ? t('Deactivate', 'إيقاف') : t('Reactivate', 'إعادة تفعيل')) + '</button>') +
      '</div>';

    openOverlay('drawerOverlay');
    document.getElementById('drawerClose').addEventListener('click', function () { closeOverlay('drawerOverlay'); });
    if (!owner) {
      document.getElementById('from360Edit').addEventListener('click', function () { closeOverlay('drawerOverlay'); openEditDrawer(id); });
      document.getElementById('from360Reset').addEventListener('click', function () { closeOverlay('drawerOverlay'); showResetModal(id, s.fullName); });
      document.getElementById('from360Deact').addEventListener('click', function () { closeOverlay('drawerOverlay'); showDeactConfirm(id, s.fullName, isActive); });
    }
    loadActivity(id);
  }

  async function loadActivity(identityUserId) {
    var box = document.getElementById('staffActivity');
    if (!box) return;
    var items = await apiGet('/admin/staff/' + encodeURIComponent(identityUserId) + '/activity');
    if (!Array.isArray(items) || !items.length) {
      box.innerHTML = '<h3>' + esc(t('Activity', 'النشاط')) + '</h3><p class="hint">' + esc(t('No activity recorded yet.', 'لا يوجد نشاط مسجل بعد.')) + '</p>';
      return;
    }
    box.innerHTML = '<h3>' + esc(t('Activity', 'النشاط')) + '</h3>' + items.map(function (ev) {
      return '<div class="activity-row"><span>' + esc(ev.label || ev.action) + '</span><span class="muted">' + fmtDate(ev.createdAtUtc) + '</span></div>';
    }).join('');
  }

  document.getElementById('btnAddStaff').addEventListener('click', showAddModal);

  function showAddModal() {
    var modal = document.getElementById('addModalContent');
    modal.innerHTML =
      '<div class="modal-hdr"><div><h2><i class="ti ti-user-plus"></i> ' + esc(t('Add staff', 'إضافة موظف')) + '</h2>' +
      '<div class="modal-hdr-sub">' + esc(t('Owner and Member cannot be created here.', 'لا يمكن إنشاء حساب مالك أو عضو من هنا.')) + '</div></div>' +
      '<button class="modal-close" id="addClose"><i class="ti ti-x"></i></button></div>' +
      '<form id="addForm" class="modal-form"><div class="modal-body">' +
        '<div class="fg"><label>' + esc(t('Full name', 'الاسم الكامل')) + ' <span class="req">*</span></label><input name="fullName" required placeholder="' + esc(t('e.g. Sara Ahmed', 'مثال: سارة أحمد')) + '"></div>' +
        '<div class="fg" id="emailGroup"><label>' + esc(t('Email', 'البريد الإلكتروني')) + ' <span class="req">*</span></label>' +
          '<input type="email" name="email" id="addEmail" required placeholder="sara@hymotion.test">' +
          '<div class="error-text" id="emailError">' + esc(t('Email is already registered', 'البريد الإلكتروني مسجل بالفعل')) + '</div>' +
          '<div class="hint">' + esc(t('Must be unique across HyMotion, not only this gym.', 'يجب أن يكون فريدًا على مستوى HyMotion، وليس فقط في هذه الصالة.')) + '</div></div>' +
        '<div class="fg"><label>' + esc(t('Password', 'كلمة المرور')) + ' <span class="req">*</span></label>' +
          '<input type="password" name="password" id="addPassword" required placeholder="' + esc(t('6+ characters, upper, lower, digit', '6 أحرف فأكثر، حرف كبير وصغير ورقم')) + '">' +
          '<div class="pw-strength"><div class="pw-bar"><div class="pw-fill" id="pwFill"></div></div><div class="pw-label" id="pwLabel"></div></div>' +
          passwordChecklistHtml('pw') +
        '</div>' +
        '<div class="fg"><label>' + esc(t('Role', 'الدور')) + ' <span class="req">*</span></label></div>' +
        '<div class="role-selector">' + roleCardsHtml('Trainer') + '</div>' +
        roleTasksHtml('Trainer') +
        workFieldsHtml({}) +
      '</div>' +
      '<div class="modal-footer">' +
        '<button type="button" class="btn-cancel" id="addCancel">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
        '<button type="submit" class="btn-primary" id="addSubmit"><i class="ti ti-user-plus"></i> ' + esc(t('Create account', 'إنشاء الحساب')) + '</button>' +
      '</div></form>';

    openOverlay('addModalOverlay');
    document.getElementById('addClose').addEventListener('click', function () { closeOverlay('addModalOverlay'); });
    document.getElementById('addCancel').addEventListener('click', function () { closeOverlay('addModalOverlay'); });
    bindRoleCards(modal);
    document.getElementById('addPassword').addEventListener('input', function () {
      paintPassword(this.value, 'pwFill', 'pwLabel', '#pwChecklist');
    });
    document.getElementById('addForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = document.getElementById('addPassword').value;
      if (!R.passwordMeetsPolicy(pw)) {
        toast(t('Password must be 6+ characters with upper, lower, and a number', 'كلمة المرور يجب أن تكون 6 أحرف فأكثر وتحتوي على حرف كبير وصغير ورقم'), 'error');
        return;
      }
      var btn = document.getElementById('addSubmit');
      btn.disabled = true;
      document.getElementById('emailGroup').classList.remove('has-error');
      var fd = new FormData(this);
      var body = {
        fullName: fd.get('fullName'),
        email: fd.get('email'),
        password: fd.get('password'),
        role: R.canonicalRole(fd.get('role'))
      };
      Object.assign(body, collectWork(fd));
      var res = await apiPost('/admin/staff', body);
      if (res && res.ok) {
        toast(t('Staff member created', 'تم إنشاء حساب الموظف'));
        closeOverlay('addModalOverlay');
        loadStaff();
      } else if (res && res.status === 402) {
        toast((res.data && (res.data.detail || res.data.title)) || t('Staff seat limit reached', 'تم الوصول للحد الأقصى لعدد الموظفين'), 'error');
      } else if (res && res.status === 400 && String((res.data && (res.data.message || res.data.error)) || '').toLowerCase().indexOf('email') !== -1) {
        document.getElementById('emailGroup').classList.add('has-error');
        document.getElementById('emailError').textContent = (res.data && (res.data.message || res.data.error)) || t('Email is already registered', 'البريد الإلكتروني مسجل بالفعل');
        document.getElementById('emailError').style.display = 'block';
      } else {
        toast(apiErr(res, t('Failed to create staff', 'فشل إنشاء الموظف')), 'error');
      }
      btn.disabled = false;
    });
  }

  async function openEditDrawer(id) {
    var s = allStaff.find(function (x) { return staffId(x) === id; });
    if (!s || R.isOwnerRole(s.role)) return;
    var detail = await apiGet('/admin/staff/' + id);
    if (detail) s = detail;
    var ac = colors(s);
    var isActive = s.isActive !== false;
    var photo = s.profilePhotoUrl
      ? '<img class="staff-av-img lg" src="' + esc(s.profilePhotoUrl) + '" alt="">'
      : '<div class="staff-av" style="width:56px;height:56px;font-size:18px;background:' + ac.bg + ';color:' + ac.fg + ';margin:0 auto 8px">' + initials(s.fullName) + '</div>';
    var drawer = document.getElementById('drawerContent');
    drawer.className = 'drawer';
    drawer.innerHTML =
      '<div class="drawer-hdr"><h2><i class="ti ti-edit"></i> ' + esc(t('Edit staff', 'تعديل بيانات الموظف')) + '</h2>' +
      '<button class="modal-close" id="drawerClose"><i class="ti ti-x"></i></button></div>' +
      '<div class="drawer-body">' +
        '<div style="text-align:center;margin-bottom:24px">' + photo +
          '<div style="font-family:var(--fd);font-size:16px;font-weight:700;margin-top:8px">' + esc(s.fullName) + '</div>' +
          '<div style="font-size:12px;color:var(--ltt)">' + esc(s.staffNumber || emailDisplay(s.email)) + '</div>' +
          '<label class="photo-upload">' + esc(t('Change photo', 'تغيير الصورة')) + '<input type="file" id="staffPhoto" accept="image/jpeg,image/png,image/webp,image/gif"></label>' +
        '</div>' +
        '<form id="editForm">' +
          '<div class="fg"><label>' + esc(t('Full name', 'الاسم الكامل')) + '</label><input name="fullName" value="' + esc(s.fullName) + '" required></div>' +
          workFieldsHtml(s) +
          '<div class="fg"><label>' + esc(t('Role', 'الدور')) + '</label></div>' +
          '<div class="role-selector">' + roleCardsHtml(roleKey(s)) + '</div>' +
          roleTasksHtml(roleKey(s)) +
          '<div class="toggle-row">' +
            '<div><div class="toggle-label">' + esc(t('Account status', 'حالة الحساب')) + '</div>' +
            '<div class="toggle-sub">' + esc(isActive
              ? t('Inactive accounts cannot log in or refresh. Open access tokens may last ~15 minutes.', 'الحسابات الموقوفة لا يمكنها تسجيل الدخول أو تجديد الجلسة. قد تبقى رموز الدخول المفتوحة صالحة لمدة 15 دقيقة تقريبًا.')
              : t('This account cannot log in or refresh its session.', 'لا يمكن لهذا الحساب تسجيل الدخول أو تجديد الجلسة.')) + '</div></div>' +
            '<label class="toggle"><input type="checkbox" name="isActive" ' + (isActive ? 'checked' : '') + '>' +
            '<span class="toggle-track"></span><span class="toggle-knob"></span></label>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div class="drawer-footer">' +
        '<button class="btn-cancel" id="editCancel">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
        '<button class="btn-primary" id="editSave"><i class="ti ti-check"></i> ' + esc(t('Save changes', 'حفظ التغييرات')) + '</button>' +
      '</div>';

    openOverlay('drawerOverlay');
    document.getElementById('drawerClose').addEventListener('click', function () { closeOverlay('drawerOverlay'); });
    document.getElementById('editCancel').addEventListener('click', function () { closeOverlay('drawerOverlay'); });
    bindRoleCards(drawer);
    var photoInput = document.getElementById('staffPhoto');
    if (photoInput) {
      photoInput.addEventListener('change', async function () {
        var file = this.files && this.files[0];
        if (!file) return;
        var res = await apiUpload('/admin/staff/' + id + '/photo', file);
        if (res && res.ok) { toast(t('Photo updated', 'تم تحديث الصورة')); loadStaff(); }
        else toast((res && res.data && (res.data.error || res.data.message)) || t('Could not upload photo', 'تعذر رفع الصورة'), 'error');
      });
    }
    document.getElementById('editSave').addEventListener('click', async function () {
      this.disabled = true;
      var form = document.getElementById('editForm');
      var fd = new FormData(form);
      var body = {
        fullName: fd.get('fullName'),
        role: R.canonicalRole(fd.get('role')),
        isActive: form.querySelector('[name=isActive]').checked
      };
      Object.assign(body, collectWork(fd));
      var res = await apiPut('/admin/staff/' + id, body);
      if (res && res.ok) { toast(t('Staff updated', 'تم تحديث بيانات الموظف')); closeOverlay('drawerOverlay'); loadStaff(); }
      else if (res && res.status === 403) toast((res.data && res.data.detail) || t('Owner accounts cannot be changed this way', 'لا يمكن تعديل حساب المالك بهذه الطريقة'), 'error');
      else toast((res && res.data && (res.data.message || res.data.error)) || t('Failed to update', 'فشل التحديث'), 'error');
      this.disabled = false;
    });
  }

  function showResetModal(id, name) {
    var s = allStaff.find(function (x) { return staffId(x) === id; });
    if (s && R.isOwnerRole(s.role)) return;
    var modal = document.getElementById('resetModalContent');
    modal.innerHTML =
      '<div class="modal-hdr"><div><h2><i class="ti ti-key"></i> ' + esc(t('Reset password', 'إعادة تعيين كلمة المرور')) + '</h2>' +
      '<div class="modal-hdr-sub">' + esc(t('Set a new password for', 'تعيين كلمة مرور جديدة لـ')) + ' ' + esc(name) + '</div></div>' +
      '<button class="modal-close" id="resetClose"><i class="ti ti-x"></i></button></div>' +
      '<form id="resetForm"><div class="modal-body">' +
        '<div class="fg"><label>' + esc(t('New password', 'كلمة المرور الجديدة')) + ' <span class="req">*</span></label>' +
          '<input type="password" id="newPw" required placeholder="' + esc(t('6+ characters, upper, lower, digit', '6 أحرف فأكثر، حرف كبير وصغير ورقم')) + '">' +
          '<div class="pw-strength"><div class="pw-bar"><div class="pw-fill" id="rpwFill"></div></div><div class="pw-label" id="rpwLabel"></div></div>' +
          passwordChecklistHtml('rpw') +
        '</div>' +
        '<div class="fg" id="confirmGroup"><label>' + esc(t('Confirm password', 'تأكيد كلمة المرور')) + ' <span class="req">*</span></label>' +
          '<input type="password" id="confirmPw" required placeholder="' + esc(t('Re-enter password', 'أعد إدخال كلمة المرور')) + '">' +
          '<div class="error-text" id="confirmError">' + esc(t('Passwords do not match', 'كلمتا المرور غير متطابقتين')) + '</div></div>' +
        '<p class="hint">' + esc(t('After reset, existing refresh sessions are revoked. Current access tokens expire on their own (~15 min).', 'بعد إعادة التعيين، سيتم إلغاء جلسات التجديد الحالية. رموز الدخول الحالية تنتهي تلقائيًا (~15 دقيقة).')) + '</p>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button type="button" class="btn-cancel" id="resetCancel">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
        '<button type="submit" class="btn-primary" id="resetSubmit"><i class="ti ti-key"></i> ' + esc(t('Reset password', 'إعادة تعيين كلمة المرور')) + '</button>' +
      '</div></form>';

    openOverlay('resetModalOverlay');
    document.getElementById('resetClose').addEventListener('click', function () { closeOverlay('resetModalOverlay'); });
    document.getElementById('resetCancel').addEventListener('click', function () { closeOverlay('resetModalOverlay'); });
    document.getElementById('newPw').addEventListener('input', function () {
      paintPassword(this.value, 'rpwFill', 'rpwLabel', '#rpwChecklist');
    });
    document.getElementById('resetForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = document.getElementById('newPw').value;
      var cpw = document.getElementById('confirmPw').value;
      if (pw !== cpw) {
        document.getElementById('confirmGroup').classList.add('has-error');
        return;
      }
      if (!R.passwordMeetsPolicy(pw)) {
        toast(t('Password must be 6+ characters with upper, lower, and a number', 'كلمة المرور يجب أن تكون 6 أحرف فأكثر وتحتوي على حرف كبير وصغير ورقم'), 'error');
        return;
      }
      document.getElementById('confirmGroup').classList.remove('has-error');
      var btn = document.getElementById('resetSubmit');
      btn.disabled = true;
      var res = await apiPost('/admin/staff/' + id + '/reset-password', { newPassword: pw });
      if (res && res.ok) { toast(t('Password reset successfully', 'تم إعادة تعيين كلمة المرور بنجاح')); closeOverlay('resetModalOverlay'); }
      else if (res && res.status === 403) toast((res.data && res.data.detail) || t('Not allowed', 'غير مسموح'), 'error');
      else toast((res && res.data && (res.data.message || res.data.error)) || t('Failed to reset password', 'فشل إعادة تعيين كلمة المرور'), 'error');
      btn.disabled = false;
    });
  }

  function showDeactConfirm(id, name, isActive) {
    var s = allStaff.find(function (x) { return staffId(x) === id; });
    if (s && R.isOwnerRole(s.role)) return;
    var dlg = document.getElementById('deactDialog');
    var action = isActive ? t('Deactivate', 'إيقاف') : t('Reactivate', 'إعادة تفعيل');
    dlg.innerHTML =
      '<div class="confirm-icon ' + (isActive ? 'danger' : 'warn') + '"><i class="ti ' + (isActive ? 'ti-user-off' : 'ti-user-check') + '"></i></div>' +
      '<div class="confirm-title">' + esc(action) + ' ' + esc(name) + '?</div>' +
      '<div class="confirm-msg">' + esc(isActive
        ? t('This account cannot log in or refresh its session. Existing access tokens may remain valid until their normal expiry. History stays in place. This is not a delete.', 'لن يتمكن هذا الحساب من تسجيل الدخول أو تجديد الجلسة. قد تبقى رموز الدخول الحالية صالحة حتى انتهاء مدتها الطبيعية. يبقى السجل التاريخي كما هو — هذا ليس حذفًا.')
        : t('This will restore sign-in access for this staff member.', 'سيؤدي هذا إلى استعادة إمكانية تسجيل الدخول لهذا الموظف.')) + '</div>' +
      '<div class="confirm-actions">' +
        '<button class="btn-cancel" id="deactCancel">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
        '<button class="' + (isActive ? 'btn-danger' : 'btn-primary') + '" id="deactConfirm"><i class="ti ' + (isActive ? 'ti-user-off' : 'ti-user-check') + '"></i> ' + esc(action) + '</button>' +
      '</div>';

    openOverlay('deactOverlay');
    document.getElementById('deactCancel').addEventListener('click', function () { closeOverlay('deactOverlay'); });
    document.getElementById('deactConfirm').addEventListener('click', async function () {
      this.disabled = true;
      var body = {
        fullName: (s && s.fullName) || name,
        role: R.canonicalRole((s && s.role) || 'Trainer'),
        isActive: !isActive
      };
      var res = await apiPut('/admin/staff/' + id, body);
      closeOverlay('deactOverlay');
      if (res && res.ok) { toast(isActive ? t('Staff deactivated', 'تم إيقاف الموظف') : t('Staff reactivated', 'تم إعادة تفعيل الموظف')); loadStaff(); }
      else if (res && res.status === 403) toast((res.data && res.data.detail) || t('Owner accounts cannot be changed this way', 'لا يمكن تعديل حساب المالك بهذه الطريقة'), 'error');
      else toast((res && res.data && (res.data.message || res.data.error)) || t('Failed', 'فشلت العملية'), 'error');
    });
  }

  document.getElementById('staffSearch').addEventListener('input', renderTable);
  document.getElementById('staffRoleFilter').addEventListener('change', renderTable);
  document.getElementById('staffStatusFilter').addEventListener('change', renderTable);
  var deptFilter = document.getElementById('staffDeptFilter');
  if (deptFilter) deptFilter.addEventListener('change', renderTable);

  window.addEventListener('gfp:locale', function () {
    renderTable();
    var drawerOv = document.getElementById('drawerOverlay');
    var drawerEl = document.getElementById('drawerContent');
    if (drawerOv && drawerOv.classList.contains('show') && openStaffId && drawerEl && drawerEl.classList.contains('drawer-360')) {
      open360(openStaffId);
    }
  });

  (async function boot() {
    try {
      var cat = await apiGet('/admin/roles');
      if (cat && Array.isArray(cat.roles)) roleCatalog = cat;
    } catch (e) {
      roleCatalog = null;
    }
    loadStaff();
  })();
})();
