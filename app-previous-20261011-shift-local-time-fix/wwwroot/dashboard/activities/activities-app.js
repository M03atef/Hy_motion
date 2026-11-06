/**
 * Activities management (Catalog → Activities).
 * CRUD for activities (classes + facilities) + schedule management.
 * Perm: plans.manage.
 */
(function () {
  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_SHORT_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try { return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user')); }
    catch (e) { return null; }
  }

  var user = getUser();
  if (!user) { window.location.href = '/auth/login/'; return; }
  var canManage = Authz ? Authz.useCan('plans.manage') : false;
  if (!canManage) { window.location.href = '/dashboard/'; return; }

  // Populate user info
  var ini = (user.fullName || t('U', 'م')).split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  var avatarEl = document.getElementById('userAvatar');
  var nameEl = document.getElementById('userName');
  var roleEl = document.getElementById('userRole');
  if (avatarEl) avatarEl.textContent = ini;
  if (nameEl) nameEl.textContent = user.fullName || t('User', 'مستخدم');
  if (roleEl) roleEl.textContent = user.role || t('Staff', 'الموظف');

  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', function () {
    if (Gfp) Gfp.logout(); else window.location.href = '/auth/login/';
  });

  var gymNameEn = '';
  var gymNameAr = '';

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return (I18n && I18n.getLocale && I18n.getLocale() === 'ar') ? (ar || en) : (en || ar);
  }

  function dayShortLabel(i) { return t(DAYS_SHORT[i], DAYS_SHORT_AR[i]); }

  function paintGymHeader() {
    var gn = document.getElementById('gymName');
    var ga = document.getElementById('gymNameAr');
    if (gn) gn.textContent = t(gymNameEn, gymNameAr) || gymNameEn || gymNameAr || '';
    if (ga) {
      ga.hidden = true;
      ga.textContent = '';
    }
  }

  (async function loadGymHeader() {
    if (!Gfp) return;
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      gymNameEn = r.data.gymName || '';
      gymNameAr = r.data.gymNameAr || '';
      paintGymHeader();
    }
  })();

  var grid = document.getElementById('actGrid');
  var allActivities = [];
  var currentKind = 'all';
  var staffList = null;

  // ── Helpers ──
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function errMsg(r) {
    if (!r) return t('Request failed', 'فشل الطلب');
    if (r.error && r.error.message) return r.error.message;
    if (r.data) return r.data.message || r.data.error || t('Request failed', 'فشل الطلب');
    return t('Request failed', 'فشل الطلب');
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function openOverlay(id) { document.getElementById(id).classList.add('show'); }
  function closeOverlay(id) { document.getElementById(id).classList.remove('show'); }

  // ── Kind Tabs ──
  document.getElementById('kindTabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.kind-tab');
    if (!tab) return;
    currentKind = tab.dataset.kind;
    document.querySelectorAll('.kind-tab').forEach(function (t) { t.classList.remove('act'); });
    tab.classList.add('act');
    renderActivities();
  });

  // ── Load Activities ──
  async function loadActivities() {
    grid.innerHTML = '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading activities...', 'جاري تحميل الأنشطة...')) + '</p></div>';
    if (!Gfp) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-title">' + esc(t('API client missing', 'واجهة البرمجة غير متاحة')) + '</div></div>';
      return;
    }
    var r = await Gfp.get('/activities');
    if (!r.ok) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ti ti-alert-circle"></i></div><div class="empty-title">' + esc(t('Could not load activities', 'تعذر تحميل الأنشطة')) + '</div><div class="empty-desc">' + esc(errMsg(r)) + '</div></div>';
      return;
    }
    allActivities = Array.isArray(r.data) ? r.data : [];

    // Enrich with schedules
    await Promise.all(allActivities.map(async function (a) {
      if (a.kind === 'class' || a.kind === 'facility') {
        try {
          var sr = await Gfp.get('/activities/' + a.id + '/schedules');
          if (sr.ok && Array.isArray(sr.data)) a._schedules = sr.data;
        } catch (e) { /* skip */ }
      }
    }));

    renderActivities();
    updateStats();
  }

  function getFiltered() {
    if (currentKind === 'all') return allActivities;
    return allActivities.filter(function (a) { return a.kind === currentKind; });
  }

  function updateStats() {
    var list = getFiltered();
    document.getElementById('statTotal').textContent = list.length;
    document.getElementById('statActive').textContent = list.filter(function (a) { return a.isActive !== false; }).length;
    document.getElementById('statInactive').textContent = list.filter(function (a) { return a.isActive === false; }).length;
  }

  function renderActivities() {
    var list = getFiltered();
    updateStats();
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ti ti-run"></i></div><div class="empty-title">' + esc(t('No Activities Yet', 'مفيش أنشطة لسه')) + '</div><div class="empty-desc">' + esc(t('Create your first activity or facility to get started.', 'أنشئ أول نشاط أو مرفق عشان تبدأ.')) + '</div><button class="btn-create" id="emptyCreate"><i class="ti ti-plus"></i> ' + esc(t('New Activity', 'نشاط جديد')) + '</button></div>';
      var ec = document.getElementById('emptyCreate');
      if (ec) ec.addEventListener('click', function () { showActivityModal(); });
      return;
    }
    grid.innerHTML = list.map(buildCard).join('');
    grid.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.dataset.action;
        var id = this.dataset.id;
        if (action === 'edit') showActivityModal(id);
        else if (action === 'delete') showDeleteConfirm(id);
        else if (action === 'schedule') showScheduleModal(id);
      });
    });
  }

  function buildCard(a) {
    var isClass = a.kind === 'class';
    var isFacility = a.kind === 'facility';
    var kindClass = a.isSystem ? 'kind-system' : (isClass ? 'kind-class' : 'kind-facility');
    var kindLabel = a.isSystem ? t('System', 'نظام') : (isClass ? t('Class', 'حصة') : t('Facility', 'مرفق'));
    var kindIcon = a.isSystem ? 'ti-lock' : (isClass ? 'ti-run' : 'ti-pool');
    var accent = a.isSystem ? '#8C8C8C' : (isClass ? '#3B82F6' : '#8B5CF6');
    var features = buildFeatures(a);
    var schedHtml = buildSchedulePills(a);

    var actions = '';
    if (!a.isSystem) {
      actions =
        '<button class="card-btn" data-action="edit" data-id="' + a.id + '"><i class="ti ti-edit"></i> ' + esc(t('Edit', 'تعديل')) + '</button>';
    }
    if (isClass || (isFacility && a.bookingRequired)) {
      actions += '<button class="card-btn sched" data-action="schedule" data-id="' + a.id + '"><i class="ti ti-calendar-event"></i> ' + esc(t('Schedule', 'الجدول')) + '</button>';
    }
    if (!a.isSystem) {
      actions += '<button class="card-btn del" data-action="delete" data-id="' + a.id + '"><i class="ti ti-trash"></i></button>';
    }

    return '<div class="act-card ' + (a.isActive === false ? 'inactive' : '') + '">' +
      '<div class="card-accent" style="background:' + accent + '"></div>' +
      '<div class="card-body">' +
      '<span class="kind-badge ' + kindClass + '"><i class="ti ' + kindIcon + '"></i>' + kindLabel + '</span>' +
      '<div class="act-name">' + esc(t(a.name, a.nameAr) || a.name) + '</div>' +
      features +
      schedHtml +
      '<div class="card-actions">' + actions + '</div>' +
      '</div></div>';
  }

  function buildFeatures(a) {
    var items = [];
    if (a.defaultCapacity) items.push('<div class="act-feat"><i class="ti ti-users"></i>' + esc(t('Capacity', 'السعة')) + ': ' + a.defaultCapacity + '</div>');
    if (a.defaultDurationMinutes) items.push('<div class="act-feat"><i class="ti ti-clock"></i>' + a.defaultDurationMinutes + ' ' + esc(t('min', 'د')) + '</div>');
    if (a.bookingRequired) items.push('<div class="act-feat"><i class="ti ti-calendar-check"></i>' + esc(t('Booking required', 'يتطلب حجز')) + '</div>');
    else items.push('<div class="act-feat"><i class="ti ti-door-enter"></i>' + esc(t('No booking needed', 'مفيش حجز مطلوب')) + '</div>');
    if (a.dropInPrice > 0) items.push('<div class="act-feat"><i class="ti ti-coin"></i>' + esc(t('Drop-in', 'زيارة')) + ': ' + esc(t(a.dropInPrice + ' EGP', a.dropInPrice + ' جنيه')) + '</div>');
    if (a.visibleToMembers === false) items.push('<div class="act-feat"><i class="ti ti-eye-off"></i>' + esc(t('Hidden from members', 'مخفي عن الأعضاء')) + '</div>');
    return items.length ? '<div class="act-features">' + items.join('') + '</div>' : '';
  }

  function buildSchedulePills(a) {
    var scheds = a._schedules;
    if (!scheds || !scheds.length) return '';
    var pills = scheds.map(function (s) {
      var days = parseDays(s.daysOfWeek);
      var dayStr = days.map(function (d) { return dayShortLabel(d); }).join(', ');
      var time = fmtTime(s.startTime) + ' – ' + fmtTime(s.endTime);
      return '<div class="sched-pill"><i class="ti ti-clock"></i>' + esc(dayStr) + ' ' + time + '</div>';
    }).join('');
    return '<div class="sched-section"><div class="sched-section-title"><i class="ti ti-calendar-event"></i> ' + esc(t('Schedule', 'الجدول')) + '</div><div class="sched-pills">' + pills + '</div></div>';
  }

  function parseDays(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val.split(',').map(Number); }
    }
    return [];
  }

  function fmtTime(t) {
    if (!t) return '';
    var s = String(t);
    if (s.length >= 5) return s.slice(0, 5);
    return s;
  }

  // ── Create/Edit Modal ──
  async function showActivityModal(editId) {
    var isEdit = !!editId;
    var act = {};

    if (isEdit) {
      var r = await Gfp.get('/activities/' + editId);
      if (!r.ok || !r.data) { toast(errMsg(r), 'error'); return; }
      act = r.data;
    }

    if (!staffList) {
      try {
        var sr = await Gfp.get('/admin/staff');
        if (sr.ok && Array.isArray(sr.data)) staffList = sr.data;
        else staffList = [];
      } catch (e) { staffList = []; }
    }

    var modal = document.getElementById('modalContent');
    modal.innerHTML = buildModalHTML(act, isEdit);
    openOverlay('modalOverlay');

    // Kind selector
    var kindCards = modal.querySelectorAll('.kind-card');
    kindCards.forEach(function (kc) {
      kc.addEventListener('click', function () {
        if (isEdit) return;
        kindCards.forEach(function (c) { c.classList.remove('selected'); });
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        updateCondFields(this.querySelector('input').value);
      });
    });

    updateCondFields(act.kind || 'class');

    // Toggle wiring
    modal.querySelectorAll('.toggle input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var knob = this.parentElement.querySelector('.toggle-knob');
        if (knob) knob.style.left = this.checked ? '20px' : '2px';
      });
    });

    modal.querySelector('.modal-close').addEventListener('click', function () { closeOverlay('modalOverlay'); });

    document.getElementById('actForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = this.querySelector('.btn-primary');
      var body = collectFormData();
      if (!body) return;
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i> ' + esc(t('Saving...', 'جاري الحفظ...'));

      var res = isEdit
        ? await Gfp.put('/activities/' + editId, body)
        : await Gfp.post('/activities', body);

      if (res && res.ok) {
        toast(isEdit ? t('Activity updated', 'تم تحديث النشاط') : t('Activity created', 'تم إنشاء النشاط'));
        closeOverlay('modalOverlay');
        loadActivities();
      } else {
        toast(errMsg(res), 'error');
        btn.disabled = false;
        btn.innerHTML = isEdit ? '<i class="ti ti-check"></i> ' + esc(t('Update', 'تحديث')) : '<i class="ti ti-plus"></i> ' + esc(t('Create', 'إنشاء'));
      }
    });
  }

  function updateCondFields(kind) {
    var classFields = document.getElementById('cond-class');
    var facilityFields = document.getElementById('cond-facility');
    if (classFields) classFields.classList.toggle('visible', kind === 'class');
    if (facilityFields) facilityFields.classList.toggle('visible', kind === 'facility');
  }

  function collectFormData() {
    var f = document.getElementById('actForm');
    var fd = new FormData(f);
    var body = {
      name: (fd.get('name') || '').trim(),
      nameAr: (fd.get('nameAr') || '').trim(),
      kind: fd.get('kind') || 'class',
      defaultCapacity: parseInt(fd.get('defaultCapacity'), 10) || null,
      bookingRequired: !!f.querySelector('[name="bookingRequired"]').checked,
      visibleToMembers: !!f.querySelector('[name="visibleToMembers"]').checked
    };
    if (!body.name) { toast(t('Name is required', 'الاسم مطلوب'), 'error'); return null; }

    var desc = fd.get('description');
    if (desc) body.description = desc;
    var descAr = fd.get('descriptionAr');
    if (descAr) body.descriptionAr = descAr;

    if (body.kind === 'class') {
      body.defaultDurationMinutes = parseInt(fd.get('defaultDurationMinutes'), 10) || null;
      var price = parseFloat(fd.get('dropInPrice'));
      if (!isNaN(price) && price > 0) body.dropInPrice = price;
    }
    return body;
  }

  function buildModalHTML(a, isEdit) {
    var v = a || {};
    var selKind = v.kind || 'class';
    var bookReq = v.bookingRequired != null ? v.bookingRequired : true;
    var visible = v.visibleToMembers != null ? v.visibleToMembers : true;

    return '<div class="modal-header">' +
      '<div><h2>' + esc(isEdit ? t('Edit Activity', 'تعديل النشاط') : t('New Activity', 'نشاط جديد')) + '</h2>' +
      '<div class="modal-header-sub">' + esc(isEdit ? t('Update activity details', 'تحديث بيانات النشاط') : t('Add a new class or facility', 'إضافة حصة أو مرفق جديد')) + '</div></div>' +
      '<button type="button" class="modal-close"><i class="ti ti-x"></i></button></div>' +
      '<form id="actForm"><div class="modal-body">' +

      '<div class="fg"><label>' + esc(t('Type', 'النوع')) + ' <span class="req">*</span></label>' +
      (isEdit ? '<div class="modal-header-sub" style="margin-bottom:8px">' + esc(t('Type is fixed after creation', 'النوع ثابت بعد الإنشاء')) + '</div>' : '') +
      '</div>' +
      '<div class="kind-selector">' +
      '<div class="kind-card ' + (selKind === 'class' ? 'selected' : '') + (isEdit && selKind !== 'class' ? '" style="opacity:.4;pointer-events:none' : '') + '">' +
      '<input type="radio" name="kind" value="class" ' + (selKind === 'class' ? 'checked' : '') + (isEdit && selKind !== 'class' ? ' disabled' : '') + '>' +
      '<div class="kind-card-icon" style="background:var(--inf100);color:var(--inf500)"><i class="ti ti-run"></i></div>' +
      '<div class="kind-card-name">' + esc(t('Class', 'حصة')) + '</div>' +
      '<div class="kind-card-desc">' + esc(t('CrossFit, Yoga, Boxing...', 'كروس فت، يوجا، ملاكمة...')) + '</div></div>' +
      '<div class="kind-card ' + (selKind === 'facility' ? 'selected' : '') + (isEdit && selKind !== 'facility' ? '" style="opacity:.4;pointer-events:none' : '') + '">' +
      '<input type="radio" name="kind" value="facility" ' + (selKind === 'facility' ? 'checked' : '') + (isEdit && selKind !== 'facility' ? ' disabled' : '') + '>' +
      '<div class="kind-card-icon" style="background:var(--purple100);color:var(--purple)"><i class="ti ti-pool"></i></div>' +
      '<div class="kind-card-name">' + esc(t('Facility', 'مرفق')) + '</div>' +
      '<div class="kind-card-desc">' + esc(t('Sauna, Pool, Steam Room...', 'ساونا، حمام سباحة، غرفة بخار...')) + '</div></div></div>' +

      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Name (English)', 'الاسم (إنجليزي)')) + ' <span class="req">*</span></label><input name="name" value="' + esc(v.name || '') + '" required placeholder="' + esc(t('e.g. CrossFit', 'مثال: كروس فت')) + '"></div>' +
      '<div class="fg"><label>' + esc(t('Name (Arabic)', 'الاسم (عربي)')) + '</label><input name="nameAr" value="' + esc(v.nameAr || '') + '" placeholder="مثال: كروس فت" dir="rtl" style="font-family:var(--fa)"></div></div>' +

      '<div class="fg"><label>' + esc(t('Capacity', 'السعة')) + '</label><input type="number" name="defaultCapacity" min="1" value="' + (v.defaultCapacity || '') + '" placeholder="' + esc(t('e.g. 15', 'مثال: 15')) + '"></div>' +

      '<div class="cond-section" id="cond-class">' +
      '<div class="cond-title"><i class="ti ti-run"></i> ' + esc(t('Class Options', 'خيارات الحصة')) + '</div>' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Duration (minutes)', 'المدة (بالدقائق)')) + '</label><input type="number" name="defaultDurationMinutes" min="1" value="' + (v.defaultDurationMinutes || '') + '" placeholder="' + esc(t('e.g. 60', 'مثال: 60')) + '"></div>' +
      '<div class="fg"><label>' + esc(t('Drop-in Price (EGP)', 'سعر الحضور الفردي (جنيه)')) + '</label><input type="number" name="dropInPrice" step="0.01" min="0" value="' + (v.dropInPrice || '') + '" placeholder="' + esc(t('0 = free / included only', '0 = مجاني / ضمن الاشتراك فقط')) + '"></div></div></div>' +

      '<div class="cond-section" id="cond-facility">' +
      '<div class="cond-title"><i class="ti ti-pool"></i> ' + esc(t('Facility Notes', 'ملاحظات المرفق')) + '</div>' +
      '<div class="modal-header-sub">' + esc(t('Facilities can be included in membership plans via entitlements. Toggle "Booking Required" below if members must book a slot.', 'يمكن تضمين المرافق في خطط العضوية عبر الاستحقاقات. فعّل خيار "يتطلب حجز" أدناه إذا كان على الأعضاء حجز ميعاد.')) + '</div></div>' +

      '<div class="toggle-row"><span class="toggle-label">' + esc(t('Booking Required', 'يتطلب حجز')) + '</span>' +
      '<label class="toggle"><input type="checkbox" name="bookingRequired" ' + (bookReq ? 'checked' : '') + '>' +
      '<div class="toggle-track"></div><div class="toggle-knob" style="left:' + (bookReq ? '20px' : '2px') + '"></div></label></div>' +

      '<div class="toggle-row"><span class="toggle-label">' + esc(t('Visible to Members (App)', 'ظاهر للأعضاء (التطبيق)')) + '</span>' +
      '<label class="toggle"><input type="checkbox" name="visibleToMembers" ' + (visible ? 'checked' : '') + '>' +
      '<div class="toggle-track"></div><div class="toggle-knob" style="left:' + (visible ? '20px' : '2px') + '"></div></label></div>' +

      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Description (English)', 'الوصف (إنجليزي)')) + '</label><textarea name="description" placeholder="' + esc(t('Optional...', 'اختياري...')) + '">' + esc(v.description || '') + '</textarea></div>' +
      '<div class="fg"><label>' + esc(t('Description (Arabic)', 'الوصف (عربي)')) + '</label><textarea name="descriptionAr" placeholder="وصف..." dir="rtl" style="font-family:var(--fa)">' + esc(v.descriptionAr || '') + '</textarea></div></div>' +

      '</div><div class="modal-footer">' +
      '<button type="button" class="btn-cancel" onclick="document.getElementById(\'modalOverlay\').classList.remove(\'show\')">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
      '<button type="submit" class="btn-primary">' + (isEdit ? '<i class="ti ti-check"></i> ' + esc(t('Update', 'تحديث')) : '<i class="ti ti-plus"></i> ' + esc(t('Create', 'إنشاء'))) + '</button></div></form>';
  }

  // ── Delete ──
  async function showDeleteConfirm(id) {
    var act = allActivities.find(function (a) { return a.id === id; });
    if (!act) return;
    var dlg = document.getElementById('deleteDialog');
    dlg.innerHTML =
      '<div class="del-icon warn"><i class="ti ti-trash"></i></div>' +
      '<div class="del-title">' + esc(t('Delete "' + act.name + '"?', 'حذف "' + act.name + '"؟')) + '</div>' +
      '<div class="del-msg">' + esc(t('This will deactivate the activity. It will no longer be available for scheduling or booking.', 'سيتم إلغاء تفعيل هذا النشاط. لن يكون متاحًا بعد ذلك للجدولة أو الحجز.')) + '</div>' +
      '<div class="del-actions">' +
      '<button class="btn-cancel" id="delCancel">' + esc(t('Cancel', 'إلغاء')) + '</button>' +
      '<button class="btn-primary" style="background:var(--dng500);box-shadow:0 2px 8px rgba(239,68,68,.3)" id="delConfirm"><i class="ti ti-trash"></i> ' + esc(t('Delete', 'حذف')) + '</button></div>';
    openOverlay('deleteOverlay');
    document.getElementById('delCancel').addEventListener('click', function () { closeOverlay('deleteOverlay'); });
    document.getElementById('delConfirm').addEventListener('click', async function () {
      this.disabled = true;
      var res = await Gfp.del('/activities/' + id);
      if (res.ok || res.status === 204) {
        closeOverlay('deleteOverlay');
        toast(t('Activity deleted', 'تم حذف النشاط'));
        loadActivities();
      } else {
        closeOverlay('deleteOverlay');
        toast(errMsg(res), 'error');
      }
    });
  }

  // ── Schedule Modal ──
  async function showScheduleModal(actId) {
    var act = allActivities.find(function (a) { return a.id === actId; });
    if (!act) return;

    if (!staffList) {
      try {
        var sr = await Gfp.get('/admin/staff');
        if (sr.ok && Array.isArray(sr.data)) staffList = sr.data;
        else staffList = [];
      } catch (e) { staffList = []; }
    }

    var schedR = await Gfp.get('/activities/' + actId + '/schedules');
    var schedules = (schedR.ok && Array.isArray(schedR.data)) ? schedR.data : (act._schedules || []);

    var modal = document.getElementById('scheduleContent');
    modal.innerHTML = buildScheduleModalHTML(act, schedules);
    openOverlay('scheduleOverlay');

    modal.querySelector('.modal-close').addEventListener('click', function () { closeOverlay('scheduleOverlay'); });

    // Day check toggles
    modal.querySelectorAll('.day-check').forEach(function (dc) {
      dc.addEventListener('click', function () {
        var inp = this.querySelector('input');
        inp.checked = !inp.checked;
        this.classList.toggle('checked', inp.checked);
      });
    });

    // Add schedule form
    document.getElementById('schedForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var days = [];
      this.querySelectorAll('.day-check input:checked').forEach(function (inp) { days.push(parseInt(inp.value, 10)); });
      if (!days.length) { toast(t('Select at least one day', 'اختر يومًا واحدًا على الأقل'), 'error'); return; }
      var startTime = fd.get('startTime');
      var endTime = fd.get('endTime');
      if (!startTime || !endTime) { toast(t('Start and end time required', 'وقت البداية والنهاية مطلوبان'), 'error'); return; }

      var body = {
        daysOfWeek: days,
        startTime: startTime + ':00',
        endTime: endTime + ':00'
      };
      var cap = parseInt(fd.get('capacity'), 10);
      if (cap > 0) body.capacity = cap;
      var coachId = fd.get('coachUserId');
      if (coachId) body.coachUserId = coachId;
      var effFrom = fd.get('effectiveFrom');
      if (effFrom) body.effectiveFrom = effFrom;
      var effUntil = fd.get('effectiveUntil');
      if (effUntil) body.effectiveUntil = effUntil;

      var btn = this.querySelector('.btn-primary');
      btn.disabled = true;
      var res = await Gfp.post('/activities/' + actId + '/schedules', body);
      if (res && res.ok) {
        toast(t('Schedule added', 'تمت إضافة الجدول'));
        closeOverlay('scheduleOverlay');
        loadActivities();
      } else {
        toast(errMsg(res), 'error');
        btn.disabled = false;
      }
    });

    // Delete schedule buttons
    modal.querySelectorAll('[data-sched-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var sid = this.dataset.schedDel;
        this.disabled = true;
        var res = await Gfp.del('/activity-schedules/' + sid);
        if (res.ok || res.status === 204) {
          toast(t('Schedule removed', 'تم حذف الجدول'));
          closeOverlay('scheduleOverlay');
          loadActivities();
        } else {
          toast(errMsg(res), 'error');
          this.disabled = false;
        }
      });
    });
  }

  function buildScheduleModalHTML(act, schedules) {
    var coachOptions = '<option value="">' + esc(t('— No coach —', '— بدون مدرب —')) + '</option>';
    if (staffList && staffList.length) {
      coachOptions += staffList.map(function (s) {
        var name = s.fullName || s.name || (s.firstName + ' ' + s.lastName) || s.email || t('Staff', 'الموظف');
        return '<option value="' + s.id + '">' + esc(name) + '</option>';
      }).join('');
    }

    var schedList = '';
    if (schedules.length) {
      schedList = '<div class="sched-list">' + schedules.map(function (s) {
        var days = parseDays(s.daysOfWeek);
        var dayStr = days.map(function (d) { return dayShortLabel(d) || d; }).join(', ');
        var coach = s.coachName || '';
        var cap = s.capacity ? t('Cap: ' + s.capacity, 'السعة: ' + s.capacity) : '';
        var sub = [coach, cap].filter(Boolean).join(' · ');
        var time = fmtTime(s.startTime) + ' – ' + fmtTime(s.endTime);
        return '<div class="sched-row">' +
          '<div class="sched-row-info"><strong>' + esc(dayStr) + '</strong> ' + time +
          (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
          '<div class="sched-row-actions">' +
          '<button class="sched-row-btn del" data-sched-del="' + s.id + '" title="' + esc(t('Remove', 'إزالة')) + '"><i class="ti ti-trash"></i></button></div></div>';
      }).join('') + '</div>';
    }

    return '<div class="modal-header"><div><h2>' + esc(t('Schedule — ' + act.name, 'الجدول — ' + act.name)) + '</h2>' +
      '<div class="modal-header-sub">' + esc(t('Recurring schedule. Sessions are generated from these rules — bookings consume the member’s plan quota for this activity.', 'جدول متكرر. الجلسات تُنشأ من هذه القواعد — والحجز يستهلك حصة العضوية لهذا النشاط.')) + '</div></div>' +
      '<button type="button" class="modal-close"><i class="ti ti-x"></i></button></div>' +
      '<div class="modal-body">' +

      (schedList || '<div class="modal-header-sub" style="margin-bottom:16px">' + esc(t('No schedules yet. Add one below.', 'لا توجد جداول بعد. أضف واحدًا أدناه.')) + '</div>') +

      '<div style="margin-top:20px;padding-top:16px;border-top:2px dashed var(--ls3)">' +
      '<div class="cond-title"><i class="ti ti-plus"></i> ' + esc(t('Add Schedule', 'إضافة جدول')) + '</div>' +
      '<form id="schedForm">' +
      '<div class="fg"><label>' + esc(t('Days of Week', 'أيام الأسبوع')) + ' <span class="req">*</span></label>' +
      '<div class="day-checks">' +
      DAYS.map(function (d, i) {
        return '<div class="day-check"><input type="checkbox" value="' + i + '"><span>' + esc(dayShortLabel(i)) + '</span></div>';
      }).join('') + '</div></div>' +

      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Start Time', 'وقت البداية')) + ' <span class="req">*</span></label><input type="time" name="startTime" required></div>' +
      '<div class="fg"><label>' + esc(t('End Time', 'وقت النهاية')) + ' <span class="req">*</span></label><input type="time" name="endTime" required></div></div>' +

      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Capacity (override)', 'السعة (تجاوز)')) + '</label><input type="number" name="capacity" min="1" placeholder="' + esc(t('Default: ' + (act.defaultCapacity || 'none'), 'الافتراضي: ' + (act.defaultCapacity || 'بدون'))) + '"></div>' +
      '<div class="fg"><label>' + esc(t('Coach', 'المدرب')) + '</label><select name="coachUserId">' + coachOptions + '</select></div></div>' +

      '<div class="form-row">' +
      '<div class="fg"><label>' + esc(t('Effective From', 'ساري من')) + '</label><input type="date" name="effectiveFrom"></div>' +
      '<div class="fg"><label>' + esc(t('Effective Until', 'ساري حتى')) + '</label><input type="date" name="effectiveUntil"></div></div>' +

      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">' +
      '<button type="button" class="btn-cancel" onclick="document.getElementById(\'scheduleOverlay\').classList.remove(\'show\')">' + esc(t('Close', 'إغلاق')) + '</button>' +
      '<button type="submit" class="btn-primary"><i class="ti ti-plus"></i> ' + esc(t('Add Schedule', 'إضافة جدول')) + '</button></div>' +
      '</form></div></div>';
  }

  // ── Overlay click-to-close ──
  ['modalOverlay', 'deleteOverlay', 'scheduleOverlay'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function (e) {
      if (e.target === this) closeOverlay(id);
    });
  });

  // ── Init ──
  document.getElementById('btnCreate').addEventListener('click', function () { showActivityModal(); });
  window.addEventListener('gfp:locale', function () {
    paintGymHeader();
    renderActivities();
  });
  loadActivities();
})();
