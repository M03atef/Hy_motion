(function () {
  'use strict';
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
  const PAGE_SIZE = 20;

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  // Friendly labels for the raw backend entity-type codes stored on each event.
  // Keep this in sync with the "EntityType" values passed to IAuditService.LogAsync
  // across GMS.Application/Services/*.cs — new codes should get an entry here.
  const ENTITY_LABELS = {
    GymMember: ['Member', 'العضو'],
    GymAttendance: ['Check-in', 'الحضور'],
    Membership: ['Membership', 'العضوية'],
    MemberFollowUp: ['Follow-up', 'المتابعة'],
    MemberInvitation: ['Invitation', 'الدعوة'],
    MemberOrder: ['Member order', 'طلب العضو'],
    Staff: ['Staff account', 'حساب الموظف'],
    Employee: ['Employee', 'الموظف'],
    EmployeeAttendance: ['Employee attendance', 'حضور الموظف'],
    EmployeeContract: ['Employee contract', 'عقد الموظف'],
    EmployeeDocument: ['Employee document', 'مستند الموظف'],
    EmployeeShift: ['Shift template', 'قالب الوردية'],
    EmployeeScheduleAssignment: ['Employee schedule', 'جدول الموظف'],
    Department: ['Department', 'القسم'],
    Position: ['Position', 'الوظيفة'],
    LeaveRequest: ['Leave request', 'طلب إجازة'],
    LeaveBalance: ['Leave balance', 'رصيد الإجازة'],
    PayrollPeriod: ['Payroll period', 'فترة الرواتب'],
    PayrollAdjustment: ['Payroll adjustment', 'تعديل راتب'],
    Shift: ['Shift', 'الوردية'],
    ZReport: ['Shift closing report', 'تقرير إغلاق الوردية'],
    Sale: ['Sale', 'عملية بيع'],
    SaleAdjustment: ['Sale adjustment', 'تسوية بيع'],
    SaleLine: ['Sale item', 'عنصر البيع'],
    Refund: ['Refund', 'استرجاع'],
    Invoice: ['Invoice', 'فاتورة'],
    Product: ['Product', 'المنتج'],
    ProductCategory: ['Product category', 'فئة المنتج'],
    PurchaseOrder: ['Purchase order', 'أمر شراء'],
    GoodsReceipt: ['Stock received', 'استلام بضاعة'],
    StockAdjustment: ['Stock adjustment', 'تسوية مخزون'],
    StockCount: ['Stock count', 'جرد مخزون'],
    StockTransfer: ['Stock transfer', 'نقل مخزون'],
    Supplier: ['Supplier', 'المورد'],
    Warehouse: ['Warehouse', 'المخزن'],
    CashExpense: ['Running cost', 'مصروف تشغيلي'],
    ImportBatch: ['Import', 'الاستيراد'],
    ReferralReward: ['Referral reward', 'مكافأة الإحالة'],
    Role: ['Role permissions', 'صلاحيات الدور'],
    Tenant: ['Gym settings', 'إعدادات النادي'],
    ActivitySession: ['Class session', 'الحصة'],
    ActivityBooking: ['Class booking', 'حجز الحصة'],
  };

  // Friendly phrases for the raw backend "action" codes. Keep in sync with the
  // action strings passed as the first LogAsync() argument across GMS.Application.
  const ACTION_LABELS = {
    'staff.create': ['Staff account created', 'تم إنشاء حساب موظف'],
    'staff.update': ['Staff details updated', 'تم تحديث بيانات الموظف'],
    'staff.role_change': ['Staff role changed', 'تم تغيير دور الموظف'],
    'staff.deactivate': ['Staff account deactivated', 'تم إيقاف حساب الموظف'],
    'staff.reactivate': ['Staff account reactivated', 'تم إعادة تفعيل حساب الموظف'],
    'staff.password_reset': ['Staff password reset', 'تم إعادة تعيين كلمة مرور الموظف'],
    'checkin.manual': ['Manual check-in', 'تسجيل حضور يدوي'],
    'checkin.barcode': ['Check-in by card', 'تسجيل حضور بالبطاقة'],
    'membership.renew': ['Membership renewed', 'تم تجديد العضوية'],
    'membership.cancel': ['Membership cancelled', 'تم إلغاء العضوية'],
    'membership.consume_pt_session': ['Personal training session used', 'تم استخدام حصة تدريب شخصي'],
    'member_app.activation_code.generate': ['Member app code generated', 'تم إنشاء رمز تفعيل تطبيق العضو'],
    'member_app.activation_code.consume': ['Member app activated', 'تم تفعيل تطبيق العضو'],
    'member_order.create': ['Member order placed', 'تم إنشاء طلب للعضو'],
    'sale.discount.override': ['Discount override on a sale', 'تجاوز خصم على عملية بيع'],
    'sale.adjustment.posted': ['Sale balance adjusted', 'تم تعديل رصيد عملية بيع'],
    'sale.balance.reconciled': ['Sale balance reconciled', 'تمت تسوية رصيد عملية بيع'],
    'refund.approved': ['Refund approved', 'تمت الموافقة على الاسترجاع'],
    'refund.executed': ['Refund completed', 'تم تنفيذ الاسترجاع'],
    'refund.rejected': ['Refund rejected', 'تم رفض الاسترجاع'],
    'invoice.void': ['Invoice voided', 'تم إلغاء الفاتورة'],
    'shift.variance.approve': ['Cash difference approved', 'تمت الموافقة على فرق النقدية'],
    'shift.force_close': ['Shift force-closed', 'تم إغلاق الوردية إجباريًا'],
    'zreport.regenerate': ['Shift report regenerated', 'تمت إعادة إنشاء تقرير الوردية'],
    'cash_expense.posted': ['Running cost recorded', 'تم تسجيل مصروف تشغيلي'],
    'cash_expense.updated': ['Running cost updated', 'تم تحديث مصروف تشغيلي'],
    'product.create': ['Product added', 'تمت إضافة منتج'],
    'product.update': ['Product updated', 'تم تحديث المنتج'],
    'product.archive': ['Product archived', 'تمت أرشفة المنتج'],
    'product.unarchive': ['Product restored', 'تم استرجاع المنتج'],
    'product_category.create': ['Product category added', 'تمت إضافة فئة منتج'],
    'product_category.update': ['Product category updated', 'تم تحديث فئة المنتج'],
    'purchase_order.create': ['Purchase order created', 'تم إنشاء أمر شراء'],
    'purchase_order.approve': ['Purchase order approved', 'تمت الموافقة على أمر الشراء'],
    'purchase_order.cancel': ['Purchase order cancelled', 'تم إلغاء أمر الشراء'],
    'purchase_order.receive': ['Stock received', 'تم استلام البضاعة'],
    'stock_adjustment.create': ['Stock adjustment created', 'تم إنشاء تسوية مخزون'],
    'stock_adjustment.post': ['Stock adjustment posted', 'تم ترحيل تسوية المخزون'],
    'stock_adjustment.cancel': ['Stock adjustment cancelled', 'تم إلغاء تسوية المخزون'],
    'stock_count.create': ['Stock count started', 'تم بدء جرد المخزون'],
    'stock_count.update_lines': ['Stock count updated', 'تم تحديث جرد المخزون'],
    'stock_count.submit': ['Stock count submitted', 'تم إرسال جرد المخزون'],
    'stock_count.approve': ['Stock count approved', 'تمت الموافقة على جرد المخزون'],
    'stock_count.cancel': ['Stock count cancelled', 'تم إلغاء جرد المخزون'],
    'stock_transfer.create': ['Stock transfer created', 'تم إنشاء نقل مخزون'],
    'stock_transfer.cancel': ['Stock transfer cancelled', 'تم إلغاء نقل المخزون'],
    'stock_transfer.reject': ['Stock transfer rejected', 'تم رفض نقل المخزون'],
    'supplier.create': ['Supplier added', 'تمت إضافة مورد'],
    'supplier.update': ['Supplier updated', 'تم تحديث بيانات المورد'],
    'supplier.opening': ['Supplier opening balance set', 'تم تحديد رصيد افتتاحي للمورد'],
    'supplier.payment': ['Supplier payment recorded', 'تم تسجيل دفعة للمورد'],
    'warehouse.create': ['Warehouse added', 'تمت إضافة مخزن'],
    'warehouse.update': ['Warehouse updated', 'تم تحديث المخزن'],
    'warehouse.set_default': ['Default warehouse changed', 'تم تغيير المخزن الافتراضي'],
    'department.create': ['Department added', 'تمت إضافة قسم'],
    'department.update': ['Department updated', 'تم تحديث القسم'],
    'position.create': ['Position added', 'تمت إضافة وظيفة'],
    'position.update': ['Position updated', 'تم تحديث الوظيفة'],
    'employee.create': ['Employee added', 'تمت إضافة موظف'],
    'employee.update': ['Employee updated', 'تم تحديث بيانات الموظف'],
    'employee.terminate': ['Employee terminated', 'تم إنهاء تعاقد الموظف'],
    'employee.photo.update': ['Employee photo updated', 'تم تحديث صورة الموظف'],
    'employee.contract.create': ['Employee contract created', 'تم إنشاء عقد للموظف'],
    'employee.link_staff': ['Employee linked to login', 'تم ربط الموظف بحساب دخول'],
    'employee.unlink_staff': ['Employee unlinked from login', 'تم فك ربط الموظف بحساب الدخول'],
    'employee.app_activation_code.generated': ['Employee app code generated', 'تم إنشاء رمز تفعيل تطبيق الموظف'],
    'employee.app_activation.completed': ['Employee app activated', 'تم تفعيل تطبيق الموظف'],
    'employee_attendance.check_in': ['Employee checked in', 'تسجيل حضور الموظف'],
    'employee_attendance.check_out': ['Employee checked out', 'تسجيل انصراف الموظف'],
    'employee_attendance.correct': ['Employee attendance corrected', 'تم تصحيح حضور الموظف'],
    'employee_document.upload': ['Employee document uploaded', 'تم رفع مستند الموظف'],
    'employee_document.delete': ['Employee document deleted', 'تم حذف مستند الموظف'],
    'employee_schedule.assign': ['Employee scheduled', 'تمت جدولة الموظف'],
    'employee_schedule.remove': ['Employee schedule removed', 'تم إلغاء جدولة الموظف'],
    'employee_shift.create': ['Shift template created', 'تم إنشاء قالب وردية'],
    'employee_shift.update': ['Shift template updated', 'تم تحديث قالب الوردية'],
    'leave_request.create': ['Leave request submitted', 'تم تقديم طلب إجازة'],
    'leave_request.approve': ['Leave request approved', 'تمت الموافقة على طلب الإجازة'],
    'leave_request.reject': ['Leave request rejected', 'تم رفض طلب الإجازة'],
    'leave_request.cancel': ['Leave request cancelled', 'تم إلغاء طلب الإجازة'],
    'leave_balance.set_entitlement': ['Leave balance updated', 'تم تحديث رصيد الإجازة'],
    'payroll_adjustment.create': ['Payroll adjustment added', 'تمت إضافة تعديل راتب'],
    'payroll_period.create': ['Payroll period created', 'تم إنشاء فترة رواتب'],
    'payroll_period.calculate': ['Payroll calculated', 'تم احتساب الرواتب'],
    'payroll_period.approve': ['Payroll approved', 'تمت الموافقة على الرواتب'],
    'payroll_period.close': ['Payroll period closed', 'تم إغلاق فترة الرواتب'],
    'import.rollback': ['Import undone', 'تم التراجع عن الاستيراد'],
    'invitation.create': ['Invitation created', 'تم إنشاء دعوة'],
    'invitation.status': ['Invitation status updated', 'تم تحديث حالة الدعوة'],
    'invitation.convert': ['Invitation converted to member', 'تحوّلت الدعوة إلى عضو'],
    'referral_reward.forfeited': ['Referral reward forfeited', 'تم إسقاط مكافأة الإحالة'],
    'referral_reward.granted': ['Referral reward granted', 'تم منح مكافأة إحالة'],
    'referral_reward.free_days': ['Free days granted', 'تم منح أيام مجانية'],
    'referral_reward.free_days_reversed': ['Free days reversed', 'تم التراجع عن الأيام المجانية'],
    'referral_reward.reversed': ['Referral reward reversed', 'تم التراجع عن مكافأة الإحالة'],
    'roles.update': ['Role permissions updated', 'تم تحديث صلاحيات الدور'],
    'roles.reset': ['Role permissions reset', 'تمت إعادة ضبط صلاحيات الدور'],
    'settings.quick_actions.update': ['Quick actions updated', 'تم تحديث الإجراءات السريعة'],
    'tenant.tax_settings.update': ['Tax settings updated', 'تم تحديث إعدادات الضريبة'],
    'tenant.inventory_alert_settings.update': ['Inventory alerts updated', 'تم تحديث تنبيهات المخزون'],
    'financial.cogs_backfill': ['Cost data recalculated', 'تمت إعادة احتساب بيانات التكلفة'],
  };

  function humanizeCode(code) {
    // Fallback for any action/entity code without a curated label above:
    // "some_thing.happened" / "SomeEntityType" -> "Some thing happened" / "Some Entity Type"
    var s = String(code)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._]+/g, ' ')
      .trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Friendly labels for the raw backend before/after field names shown in the "Changes" list
  // (buildDiffRows keys come straight from BeforeJson/AfterJson property names - camelCase C#
  // DTO fields, not something a gym owner should have to read raw).
  const FIELD_LABELS = {
    role: ['Role', 'الدور'],
    isCustomized: ['Customized', 'مخصّص'],
    permissions: ['Permissions', 'الصلاحيات'],
    name: ['Name', 'الاسم'],
    nameAr: ['Name (Arabic)', 'الاسم (عربي)'],
    firstName: ['First name', 'الاسم الأول'],
    lastName: ['Last name', 'اسم العائلة'],
    email: ['Email', 'البريد الإلكتروني'],
    phoneNumber: ['Phone number', 'رقم الهاتف'],
    status: ['Status', 'الحالة'],
    isActive: ['Active', 'مفعّل'],
    price: ['Price', 'السعر'],
    quantity: ['Quantity', 'الكمية'],
  };

  function fieldLabel(key) {
    var lastSegment = key.indexOf('.') >= 0 ? key.slice(key.lastIndexOf('.') + 1) : key;
    var pair = FIELD_LABELS[lastSegment];
    if (pair) return t(pair[0], pair[1]);
    return humanizeCode(lastSegment);
  }

  // Some diff values are JSON-stringified arrays of raw permission-style dotted codes
  // (e.g. '["shift.open","shift.close"]') - show them as a readable list instead of the raw
  // code array so a non-technical owner can actually read what changed.
  function formatDiffValue(val) {
    if (val === undefined || val === null) return undefined;
    var s = String(val);
    if (s.charAt(0) === '[') {
      try {
        var arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(humanizeCode).join(', ') || t('None', 'لا شيء');
      } catch (e) { /* not valid JSON, fall through to raw string */ }
    }
    return s;
  }

  function entityTypeLabel(type) {
    if (!type) return '';
    var pair = ENTITY_LABELS[type];
    if (pair) return t(pair[0], pair[1]);
    var words = humanizeCode(type);
    return t(words, words);
  }

  function actionLabel(action) {
    if (!action) return '';
    var pair = ACTION_LABELS[action];
    if (pair) return t(pair[0], pair[1]);
    var words = humanizeCode(action);
    return t(words, words);
  }

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH() {
    const t = getToken();
    const h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (_) {
      return null;
    }
  }
  function decodeJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {
      return null;
    }
  }
  function getPerms() {
    const p = decodeJwt(getToken() || '');
    const set = new Set();
    if (!p) return set;
    const raw = p.perm;
    if (Array.isArray(raw)) raw.forEach((x) => set.add(String(x)));
    else if (raw) set.add(String(raw));
    return set;
  }

  const user = getUser();
  const perms = getPerms();
  const role = (user && user.role) || '';
  const canAudit = perms.has('settings.manage') || /Owner/i.test(role);

  let page = 1;
  let cache = {};

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function dt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? esc(iso)
      : d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function problemMessage(data, status) {
    const fallback = t('We couldn\'t load this. Try again.', 'تعذّر التحميل. حاول مرة أخرى.') + ' (' + status + ')';
    if (!data) return fallback;
    return data.detail || data.message || data.title || fallback;
  }

  async function api(method, path) {
    const res = await fetch(API_BASE + path, { method, headers: getH() });
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  /** Parse raw JSON string from API; never assume already-parsed objects. */
  function parseJsonField(raw) {
    if (raw == null || raw === '') return { ok: true, value: null, pretty: 'null' };
    if (typeof raw === 'object') {
      return { ok: true, value: raw, pretty: JSON.stringify(raw, null, 2) };
    }
    try {
      const value = JSON.parse(raw);
      return { ok: true, value, pretty: JSON.stringify(value, null, 2) };
    } catch (e) {
      return { ok: false, value: null, pretty: String(raw) };
    }
  }

  function flatten(obj, prefix, out) {
    out = out || {};
    if (obj === null || obj === undefined) {
      out[prefix || '(root)'] = obj;
      return out;
    }
    if (typeof obj !== 'object') {
      out[prefix || '(root)'] = obj;
      return out;
    }
    if (Array.isArray(obj)) {
      out[prefix || '(root)'] = JSON.stringify(obj);
      return out;
    }
    const keys = Object.keys(obj);
    if (!keys.length) {
      out[prefix || '(root)'] = '{}';
      return out;
    }
    keys.forEach((k) => {
      const path = prefix ? prefix + '.' + k : k;
      const v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
      else out[path] = Array.isArray(v) ? JSON.stringify(v) : v;
    });
    return out;
  }

  function buildDiffRows(beforeVal, afterVal) {
    const b = flatten(beforeVal);
    const a = flatten(afterVal);
    const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
    return keys.map((k) => {
      const bv = Object.prototype.hasOwnProperty.call(b, k) ? b[k] : undefined;
      const av = Object.prototype.hasOwnProperty.call(a, k) ? a[k] : undefined;
      let cls = '';
      if (bv === undefined && av !== undefined) cls = 'added';
      else if (av === undefined && bv !== undefined) cls = 'removed';
      else if (String(bv) !== String(av)) cls = 'changed';
      return { k, bv, av, cls };
    });
  }

  function actorCell(actorUserId, actorName) {
    if (actorUserId == null || actorUserId === '') {
      const sysLabel = t('System', 'النظام');
      const sysTitle = t('Done automatically, not by a staff member', 'تم تلقائيًا وليس بواسطة أحد الموظفين');
      return '<span class="actor-sys" title="' + esc(sysTitle) + '"><i class="ti ti-robot"></i> ' + esc(sysLabel) + '</span>';
    }
    if (actorName) {
      return '<span title="' + esc(actorUserId) + '">' + esc(actorName) + '</span>';
    }
    const unknownLabel = t('Former staff member', 'موظف سابق');
    return '<span class="muted" title="' + esc(actorUserId) + '">' + esc(unknownLabel) + '</span>';
  }

  function renderPager(totalPages, totalCount) {
    const el = document.getElementById('pager');
    const pageLabel =
      t('Page', 'صفحة') + ' ' + page + ' / ' + Math.max(1, totalPages || 1) + ' · ' + esc(String(totalCount || 0));
    el.innerHTML =
      '<button type="button" class="btn secondary js-prev"' +
      (page <= 1 ? ' disabled' : '') +
      '>' +
      esc(t('Prev', 'السابق')) +
      '</button>' +
      '<span>' +
      pageLabel +
      '</span>' +
      '<button type="button" class="btn secondary js-next"' +
      (page >= (totalPages || 1) ? ' disabled' : '') +
      '>' +
      esc(t('Next', 'التالي')) +
      '</button>';
    el.querySelector('.js-prev').onclick = () => {
      if (page > 1) {
        page -= 1;
        loadList();
      }
    };
    el.querySelector('.js-next').onclick = () => {
      if (page < (totalPages || 1)) {
        page += 1;
        loadList();
      }
    };
  }

  let currentDiffId = null;

  function openDiff(ev) {
    cache[ev.id] = ev;
    currentDiffId = ev.id;
    const before = parseJsonField(ev.beforeJson);
    const after = parseJsonField(ev.afterJson);
    const diffMetaEl = document.getElementById('diffMeta');
    diffMetaEl.textContent =
      actionLabel(ev.action) +
      (ev.entityType ? ' · ' + entityTypeLabel(ev.entityType) : '') +
      ' · ' +
      dt(ev.createdAtUtc);
    // Internal record id stays available on hover for support/debugging, not as visible page
    // copy - a gym owner reading this page shouldn't have to look at a raw backend GUID.
    if (ev.entityId) diffMetaEl.title = ev.entityId;
    else diffMetaEl.removeAttribute('title');
    document.getElementById('diffBefore').textContent = before.pretty;
    document.getElementById('diffAfter').textContent = after.pretty;

    const keysEl = document.getElementById('diffKeys');
    const rawDetails = document.getElementById('diffRawDetails');
    if (before.ok && after.ok && (before.value !== null || after.value !== null)) {
      const rows = buildDiffRows(before.value, after.value);
      const changed = rows.filter((r) => r.cls);
      keysEl.innerHTML =
        '<h4>' +
        esc(t('Changes', 'التغييرات')) +
        ' (' +
        changed.length +
        ')</h4>' +
        (rows.length
          ? rows
              .map(
                (r) =>
                  '<div class="diff-row ' +
                  r.cls +
                  '" title="' +
                  esc(r.k) +
                  '"><div class="diff-k">' +
                  esc(fieldLabel(r.k)) +
                  '</div><div>' +
                  esc(formatDiffValue(r.bv) ?? '—') +
                  '</div><div>' +
                  esc(formatDiffValue(r.av) ?? '—') +
                  '</div></div>',
              )
              .join('')
          : '<p class="muted">' + esc(t('No changes recorded', 'لا توجد تغييرات مسجلة')) + '</p>');
      if (rawDetails) rawDetails.open = false;
    } else {
      keysEl.innerHTML =
        '<p class="muted">' +
        esc(t('A detailed breakdown isn\'t available for this entry.', 'لا يتوفر تفصيل للتغييرات في هذا السجل.')) +
        (!before.ok || !after.ok
          ? ' ' + esc(t('Some of the stored data could not be read.', 'تعذّرت قراءة بعض البيانات المخزّنة.'))
          : '') +
        '</p>';
      if (rawDetails) rawDetails.open = true;
    }
    document.getElementById('diffModal').classList.add('show');
  }

  async function loadList() {
    if (!canAudit) {
      document.getElementById('tbody').innerHTML =
        '<tr><td colspan="6" class="muted">' +
        esc(t('You need Owner access to view this page.', 'تحتاج صلاحية المالك لعرض هذه الصفحة.')) +
        '</td></tr>';
      return;
    }
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('pageSize', String(PAGE_SIZE));
    const entityType = document.getElementById('fEntityType').value.trim();
    const entityId = document.getElementById('fEntityId').value.trim();
    const action = document.getElementById('fAction').value.trim();
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    if (entityType) q.set('entityType', entityType);
    if (entityId) q.set('entityId', entityId);
    if (action) q.set('action', action);
    if (from) q.set('from', from);
    if (to) q.set('to', to);

    const res = await api('GET', '/audit?' + q.toString());
    const tbody = document.getElementById('tbody');
    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="muted">' + esc(problemMessage(res.data, res.status)) + '</td></tr>';
      renderPager(1, 0);
      return;
    }
    const data = res.data || {};
    const items = Array.isArray(data) ? data : data.items || [];
    renderPager(data.totalPages != null ? data.totalPages : 1, data.totalCount != null ? data.totalCount : items.length);
    if (!items.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="muted">' + esc(t('No activity yet', 'لا يوجد نشاط بعد')) + '</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map((ev) => {
        cache[ev.id] = ev;
        const hasDiff = ev.beforeJson != null || ev.afterJson != null;
        return (
          '<tr>' +
          '<td>' +
          esc(dt(ev.createdAtUtc)) +
          '</td>' +
          '<td>' +
          actorCell(ev.actorUserId, ev.actorName) +
          '</td>' +
          '<td><strong title="' +
          esc(ev.action || '') +
          '">' +
          esc(actionLabel(ev.action)) +
          '</strong></td>' +
          '<td>' +
          '<span title="' +
          esc(ev.entityType || '') + (ev.entityId ? ' · ' + esc(ev.entityId) : '') +
          '">' +
          esc(ev.entityType ? entityTypeLabel(ev.entityType) : '—') +
          '</span>' +
          '</td>' +
          '<td>' +
          esc(ev.ipAddress || '—') +
          '</td>' +
          '<td>' +
          (hasDiff
            ? '<button type="button" class="btn secondary" data-diff="' +
              esc(ev.id) +
              '">' +
              esc(t('View changes', 'عرض التغييرات')) +
              '</button>'
            : '<span class="muted">—</span>') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.onclick = () => {
        const ev = cache[btn.getAttribute('data-diff')];
        if (ev) openDiff(ev);
      };
    });
  }

  document.getElementById('btnFilter').onclick = () => {
    page = 1;
    loadList();
  };
  document.getElementById('btnDiffClose').onclick = () => {
    document.getElementById('diffModal').classList.remove('show');
    currentDiffId = null;
  };
  document.getElementById('diffModal').addEventListener('click', (e) => {
    if (e.target.id === 'diffModal') {
      e.target.classList.remove('show');
      currentDiffId = null;
    }
  });

  // Re-render already-loaded content (table rows + open diff modal) in the new
  // language without a page reload — static chrome is handled by GfpI18n itself.
  window.addEventListener('gfp:locale', () => {
    loadList();
    if (currentDiffId != null && cache[currentDiffId]) {
      openDiff(cache[currentDiffId]);
    }
  });

  loadList();
})();
