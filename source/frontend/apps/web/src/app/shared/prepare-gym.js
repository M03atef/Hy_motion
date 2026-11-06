/**
 * HyMotion Local — first-hour "Prepare Your Gym" checklist.
 * Completion is derived from real desk APIs. Skip/resume is gym-scoped localStorage only.
 * Does not invent endpoints. Does not duplicate Plans / Staff / Shift / Members screens.
 */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'gfp_prepare_gym:';
  var SEED_TEMPLATES = [
    { name: 'Monthly Unlimited', price: 500 },
    { name: 'Session Pack 20', price: 800 },
    { name: 'Morning Pass', price: 300 }
  ];

  var STEPS = [
    {
      id: 'plans',
      href: '/dashboard/plans/?prepare=1',
      ownerOnly: false,
      needs: 'plans.manage',
      labelEn: 'Review membership plans',
      labelAr: 'راجع باقات العضوية',
      whyEn: 'Starting templates are examples. Confirm names and prices before you sell.',
      whyAr: 'القوالب أمثلة للبداية. أكّد الأسماء والأسعار قبل البيع.'
    },
    {
      id: 'staff',
      href: '/dashboard/staff/?prepare=1',
      ownerOnly: true,
      labelEn: 'Add your front-desk staff',
      labelAr: 'أضف موظف الاستقبال',
      whyEn: 'A receptionist can register members, take cash, and check people in.',
      whyAr: 'موظف الاستقبال يسجّل الأعضاء ويقبض النقد ويسجّل الحضور.'
    },
    {
      id: 'shift',
      href: '/dashboard/shifts/',
      ownerOnly: false,
      needs: 'shift.open',
      labelEn: 'Open your first shift',
      labelAr: 'افتح أول وردية',
      whyEn: 'Cash membership payments need an open cash shift.',
      whyAr: 'دفع العضوية نقدًا يحتاج وردية صندوق مفتوحة.'
    },
    {
      id: 'member',
      href: '/dashboard/members/?prepare=1',
      ownerOnly: false,
      needs: 'members.create',
      labelEn: 'Add your first member',
      labelAr: 'أضف أول عضو',
      whyEn: 'A member record is the person. Membership is sold in the next step.',
      whyAr: 'سجل العضو هو الشخص. بيع العضوية في الخطوة التالية.'
    },
    {
      id: 'sale',
      href: '/dashboard/members/?prepare=1',
      ownerOnly: false,
      needs: 'sales.sell',
      labelEn: 'Complete your first membership sale',
      labelAr: 'أكمل أول بيع عضوية',
      whyEn: 'Assign a plan and take payment (open a shift first if paying cash).',
      whyAr: 'عيّن باقة واستلم الدفع (افتح وردية أولاً إذا كان الدفع نقدًا).'
    },
    {
      id: 'checkin',
      href: '/dashboard/attendance/',
      ownerOnly: false,
      needs: ['checkin.manual', 'members.view'],
      labelEn: 'Check in your first member',
      labelAr: 'سجّل حضور أول عضو',
      whyEn: 'The member must have a valid covering membership.',
      whyAr: 'يجب أن تكون للعضو عضوية سارية تغطي الدخول.'
    }
  ];

  var SECONDARY = [
    { href: '/dashboard/settings/', labelEn: 'Configure gym profile', labelAr: 'ضبط هوية النادي', access: { kind: 'policy', value: 'OwnerOnly' } },
    { href: '/dashboard/inventory/products/', labelEn: 'Add products', labelAr: 'إضافة منتجات', access: { kind: 'permission', value: ['inventory.manage', 'inventory.purchase'] } },
    { href: '/dashboard/activities/', labelEn: 'Create activities', labelAr: 'إنشاء أنشطة', access: { kind: 'permission', value: 'plans.manage' } },
    { href: '/dashboard/access-cards/', labelEn: 'Add access cards', labelAr: 'إضافة كارنيهات', access: { kind: 'permission', value: 'members.view' } },
    { href: '/dashboard/hr/employees/', labelEn: 'Configure HR', labelAr: 'ضبط الموارد البشرية', access: { kind: 'permission', value: 'hr.view' } },
    { href: '/dashboard/backup/', labelEn: 'Backup', labelAr: 'نسخة احتياطية', access: { kind: 'policy', value: 'OwnerOnly' } },
    { href: '/dashboard/reports/', labelEn: 'Explore reports', labelAr: 'استكشف التقارير', access: { kind: 'permission', value: ['reports.financial.view', 'members.view'] } }
  ];

  function t(en, ar) {
    if (global.GfpI18n && global.GfpI18n.tLabel) return global.GfpI18n.tLabel(en, ar);
    try {
      return (global.localStorage && global.localStorage.getItem('gfp_locale')) === 'ar' ? ar : en;
    } catch (e) {
      return en;
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUser(opts) {
    opts = opts || {};
    if (opts.user) return opts.user;
    if (global.GfpApi && global.GfpApi.tokens && global.GfpApi.tokens.getUser) {
      return global.GfpApi.tokens.getUser();
    }
    try {
      var raw = (global.localStorage && global.localStorage.getItem('gfp_user')) ||
        (global.sessionStorage && global.sessionStorage.getItem('gfp_user'));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function gymStorageKey(opts) {
    var user = getUser(opts);
    var id = (user && (user.tenantId || user.TenantId)) || 'default';
    return STORAGE_PREFIX + id;
  }

  function defaultPrefs() {
    return {
      plansReviewed: false,
      dismissed: false,
      checkinObserved: false,
      readyDismissed: false
    };
  }

  function loadPrefs(opts) {
    var out = defaultPrefs();
    try {
      var raw = global.localStorage && global.localStorage.getItem(gymStorageKey(opts));
      if (!raw) return out;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return out;
      out.plansReviewed = !!parsed.plansReviewed;
      out.dismissed = !!parsed.dismissed;
      out.checkinObserved = !!parsed.checkinObserved;
      out.readyDismissed = !!parsed.readyDismissed;
      return out;
    } catch (e) {
      return out;
    }
  }

  function savePrefs(prefs, opts) {
    var next = Object.assign(defaultPrefs(), prefs || {});
    try {
      if (global.localStorage) {
        global.localStorage.setItem(gymStorageKey(opts), JSON.stringify(next));
      }
    } catch (e) { /* ignore quota */ }
    return next;
  }

  function patchPrefs(partial, opts) {
    return savePrefs(Object.assign(loadPrefs(opts), partial || {}), opts);
  }

  function asItems(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.Items)) return data.Items;
    return [];
  }

  function roundMoney(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function looksLikeSeedTemplates(plans) {
    var active = (plans || []).filter(function (p) { return p && p.isActive !== false; });
    if (!active.length) return false;
    return active.every(function (p) {
      var name = String(p.name || '').trim();
      var price = roundMoney(p.price);
      return SEED_TEMPLATES.some(function (seed) {
        return seed.name === name && roundMoney(seed.price) === price;
      });
    });
  }

  function hasUsablePlan(plans) {
    return (plans || []).some(function (p) { return p && p.isActive !== false; });
  }

  function hasFrontDeskStaff(staff) {
    return (staff || []).some(function (s) {
      if (!s || s.isActive === false) return false;
      var role = String(s.role || '').toLowerCase();
      return role === 'receptionist' || role === 'manager';
    });
  }

  function hasOpenedShift(current, list) {
    if (current && current.id) return true;
    return asItems(list).length > 0;
  }

  function hasMember(members) {
    return asItems(members).some(function (m) { return m && (m.id || m.Id); });
  }

  function membershipSoldOnMember(m) {
    var status = String(m.membershipStatus || m.MembershipStatus || '').toLowerCase();
    if (!status || status === 'none' || status === 'inactive') return false;
    if (m.activePlan || m.ActivePlan) return true;
    return status === 'active' || status === 'frozen' || status === 'pending' ||
      status === 'expired' || status === 'cancelled';
  }

  function hasMembershipSale(members, invoices) {
    if (asItems(invoices).length > 0) return true;
    return asItems(members).some(membershipSoldOnMember);
  }

  function hasCheckin(today, storedObserved) {
    if (asItems(today).length > 0) return true;
    return !!storedObserved;
  }

  function canAccess(access, opts) {
    opts = opts || {};
    var Authz = opts.Authz || global.GfpAuthz;
    if (!Authz) return false;
    if (!access) return true;
    if (access.kind === 'permission') {
      return Authz.canPermission
        ? Authz.canPermission(opts.accessToken || Authz.getAccessToken(), access.value)
        : Authz.useCan(access.value);
    }
    if (access.kind === 'policy') {
      return Authz.useCanRole(access.value);
    }
    return true;
  }

  function stepVisible(step, opts) {
    var user = getUser(opts);
    var role = String((user && user.role) || '').toLowerCase();
    if (step.ownerOnly && role !== 'owner') return false;
    if (step.needs) {
      var Authz = (opts && opts.Authz) || global.GfpAuthz;
      if (Authz && Authz.useCan && !Authz.useCan(step.needs)) return false;
    }
    return true;
  }

  function deriveChecklist(input) {
    input = input || {};
    var prefs = Object.assign(defaultPrefs(), input.prefs || {});
    var plans = input.plans || [];
    var staff = input.staff || [];
    var members = input.members;
    var invoices = input.invoices;
    var steps = STEPS.filter(function (step) {
      return stepVisible(step, input);
    }).map(function (step) {
      var complete = false;
      if (step.id === 'plans') {
        complete = hasUsablePlan(plans) && (!looksLikeSeedTemplates(plans) || !!prefs.plansReviewed);
      } else if (step.id === 'staff') {
        complete = hasFrontDeskStaff(staff);
      } else if (step.id === 'shift') {
        complete = hasOpenedShift(input.currentShift, input.shifts);
      } else if (step.id === 'member') {
        complete = hasMember(members);
      } else if (step.id === 'sale') {
        complete = hasMembershipSale(members, invoices);
      } else if (step.id === 'checkin') {
        complete = hasCheckin(input.todayAttendance, prefs.checkinObserved);
      }
      return {
        id: step.id,
        href: step.href,
        labelEn: step.labelEn,
        labelAr: step.labelAr,
        whyEn: step.whyEn,
        whyAr: step.whyAr,
        complete: !!complete
      };
    });

    var done = steps.filter(function (s) { return s.complete; }).length;
    var next = null;
    for (var i = 0; i < steps.length; i++) {
      if (!steps[i].complete) {
        next = steps[i];
        break;
      }
    }
    return {
      steps: steps,
      done: done,
      total: steps.length,
      complete: steps.length > 0 && done === steps.length,
      next: next,
      templates: looksLikeSeedTemplates(plans),
      hasPlan: hasUsablePlan(plans)
    };
  }

  function isLocalEdition(opts) {
    opts = opts || {};
    if (opts.edition) return String(opts.edition).toLowerCase() === 'local';
    try {
      var attr = global.document && global.document.documentElement &&
        global.document.documentElement.getAttribute('data-gfp-edition');
      if (attr) return attr === 'local';
    } catch (e) { /* ignore */ }
    return false;
  }

  function shouldShow(opts) {
    opts = opts || {};
    if (!isLocalEdition(opts)) return false;
    var user = getUser(opts);
    var role = String((user && user.role) || '').toLowerCase();
    return role === 'owner' || role === 'manager';
  }

  async function apiGet(path) {
    var Gfp = global.GfpApi;
    if (!Gfp || !Gfp.get) return { ok: false, data: null, status: 0 };
    return Gfp.get(path);
  }

  async function loadSnapshot(opts) {
    opts = opts || {};
    var Authz = opts.Authz || global.GfpAuthz;
    var snap = {
      plans: [],
      staff: [],
      currentShift: null,
      shifts: [],
      members: [],
      invoices: [],
      todayAttendance: []
    };

    function allow(perm) {
      if (!Authz || !Authz.useCan) return true;
      return Authz.useCan(perm);
    }

    var jobs = [];

    if (allow('memberships.assign') || allow('plans.manage')) {
      jobs.push(apiGet('/membership-plans').then(function (r) {
        if (r.ok) snap.plans = asItems(r.data).length ? asItems(r.data) : (Array.isArray(r.data) ? r.data : []);
      }).catch(function () {}));
    }
    if (Authz && Authz.useCanRole && Authz.useCanRole('OwnerOnly')) {
      jobs.push(apiGet('/admin/staff').then(function (r) {
        if (r.ok) snap.staff = Array.isArray(r.data) ? r.data : asItems(r.data);
      }).catch(function () {}));
    }
    if (allow('shift.open') || allow('shift.close')) {
      jobs.push(apiGet('/shifts/current').then(function (r) {
        if (r.ok) snap.currentShift = r.data || null;
      }).catch(function () {}));
    }
    if (Authz && Authz.useCanRole && Authz.useCanRole('ManagerOrAbove')) {
      jobs.push(apiGet('/shifts?page=1&pageSize=5').then(function (r) {
        if (r.ok) snap.shifts = r.data;
      }).catch(function () {}));
    }
    if (allow('members.view')) {
      jobs.push(apiGet('/members?page=1&pageSize=20').then(function (r) {
        if (r.ok) snap.members = r.data;
      }).catch(function () {}));
    }
    if (allow('reports.financial.view')) {
      jobs.push(apiGet('/invoices?lineType=membership&page=1&pageSize=1').then(function (r) {
        if (r.ok) snap.invoices = r.data;
      }).catch(function () {}));
    }
    if (allow('members.view') || allow('attendance.view') || allow('checkin.manual')) {
      jobs.push(apiGet('/attendance/today').then(function (r) {
        if (r.ok) snap.todayAttendance = Array.isArray(r.data) ? r.data : asItems(r.data);
      }).catch(function () {}));
    }

    await Promise.all(jobs);
    return snap;
  }

  function secondaryVisible(opts) {
    return SECONDARY.filter(function (item) {
      return canAccess(item.access, opts);
    });
  }

  function resolveHost(host) {
    if (!host) return null;
    if (typeof host === 'string') {
      if (global.document) {
        if (global.document.getElementById) {
          var el = global.document.getElementById(host);
          if (el) return el;
        }
        if (global.document.querySelector) {
          var elQs = global.document.querySelector(host);
          if (elQs) return elQs;
        }
      }
      return null;
    }
    if (typeof host === 'object' && host && ('innerHTML' in host || host.nodeType === 1)) {
      return host;
    }
    return null;
  }

  function paint(hostInput, model, opts) {
    var host = resolveHost(hostInput);
    if (!host) return;
    opts = opts || {};
    var prefs = loadPrefs(opts);
    var forceOpen = !!(opts.forceOpen);
    if (model.complete && prefs.readyDismissed && !forceOpen) {
      host.innerHTML = compactReady(model);
      bind(host, model, opts);
      return;
    }
    if (prefs.dismissed && !forceOpen && !model.complete) {
      host.innerHTML = compactBar(model);
      bind(host, model, opts);
      return;
    }
    host.innerHTML = model.complete ? readyCard(model, opts) : openCard(model);
    bind(host, model, opts);
  }

  function openCard(model) {
    var next = model.next;
    var rows = model.steps.map(function (step, idx) {
      var done = step.complete;
      return (
        '<li class="pg-step' + (done ? ' is-done' : '') + (next && next.id === step.id ? ' is-next' : '') + '">' +
        '<span class="pg-mark" aria-hidden="true">' +
        (done ? '<i class="ti ti-check"></i>' : String(idx + 1)) +
        '</span>' +
        '<div class="pg-step-body">' +
        '<a class="pg-step-link" href="' + esc(step.href) + '">' + esc(t(step.labelEn, step.labelAr)) + '</a>' +
        (!done ? '<p>' + esc(t(step.whyEn, step.whyAr)) + '</p>' : '') +
        '</div></li>'
      );
    }).join('');
    return (
      '<section class="pg-card" data-prepare-gym="open">' +
      '<div class="pg-card-hd">' +
      '<div>' +
      '<p class="pg-kicker">' + esc(t('Prepare your gym', 'جهّز صالتك')) + '</p>' +
      '<h2>' + esc(t('What to do before you start operating', 'ماذا تفعل قبل بدء التشغيل')) + '</h2>' +
      '</div>' +
      '<span class="pg-count">' + model.done + '/' + model.total + ' ' + esc(t('completed', 'مكتمل')) + '</span>' +
      '</div>' +
      '<ol class="pg-steps">' + rows + '</ol>' +
      '<div class="pg-actions">' +
      (next
        ? '<a class="pg-btn pg-btn-primary" href="' + esc(next.href) + '">' + esc(t('Continue', 'متابعة')) + '</a>'
        : '') +
      '<button type="button" class="pg-btn pg-btn-ghost" data-pg="skip">' + esc(t('Skip for now', 'تخطي الآن')) + '</button>' +
      '</div></section>'
    );
  }

  function readyCard(model, opts) {
    var extras = secondaryVisible(opts).map(function (item) {
      return '<a class="pg-chip" href="' + esc(item.href) + '">' + esc(t(item.labelEn, item.labelAr)) + '</a>';
    }).join('');
    return (
      '<section class="pg-card is-ready" data-prepare-gym="ready">' +
      '<div class="pg-card-hd">' +
      '<div>' +
      '<p class="pg-kicker">' + esc(t('You\'re ready', 'أنت جاهز')) + '</p>' +
      '<h2>' + esc(t('You\'re ready to run HyMotion.', 'أنت جاهز لتشغيل HyMotion.')) + '</h2>' +
      '<p class="pg-sub">' + esc(t('Use these when you need them — not before.', 'استخدم هذه عند الحاجة — وليس قبل ذلك.')) + '</p>' +
      '</div>' +
      '<span class="pg-count">' + model.done + '/' + model.total + '</span>' +
      '</div>' +
      (extras ? '<div class="pg-secondary">' + extras + '</div>' : '') +
      '<div class="pg-actions">' +
      '<button type="button" class="pg-btn pg-btn-ghost" data-pg="hide-ready">' + esc(t('Hide', 'إخفاء')) + '</button>' +
      '</div></section>'
    );
  }

  function compactBar(model) {
    var next = model.next;
    return (
      '<section class="pg-compact" data-prepare-gym="compact">' +
      '<span>' + esc(t('Prepare your gym', 'جهّز صالتك')) +
      ' · ' + model.done + '/' + model.total + '</span>' +
      (next ? '<a class="pg-btn pg-btn-primary" href="' + esc(next.href) + '">' + esc(t('Continue', 'متابعة')) + '</a>' : '') +
      '<button type="button" class="pg-btn pg-btn-ghost" data-pg="resume">' + esc(t('Resume', 'متابعة القائمة')) + '</button>' +
      '</section>'
    );
  }

  function compactReady(model) {
    return (
      '<section class="pg-compact is-ready" data-prepare-gym="compact-ready">' +
      '<span>' + esc(t('You\'re ready to run HyMotion.', 'أنت جاهز لتشغيل HyMotion.')) + '</span>' +
      '<button type="button" class="pg-btn pg-btn-ghost" data-pg="resume">' + esc(t('Show next steps', 'عرض الخطوات التالية')) + '</button>' +
      '</section>'
    );
  }

  function bind(hostInput, model, opts) {
    var host = resolveHost(hostInput);
    if (!host) return;
    host.querySelectorAll('[data-pg="skip"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        patchPrefs({ dismissed: true }, opts);
        paint(host, model, opts);
      });
    });
    host.querySelectorAll('[data-pg="resume"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        patchPrefs({ dismissed: false, readyDismissed: false }, opts);
        paint(host, model, Object.assign({}, opts, { forceOpen: true }));
      });
    });
    host.querySelectorAll('[data-pg="hide-ready"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        patchPrefs({ readyDismissed: true, dismissed: true }, opts);
        paint(host, model, opts);
      });
    });
  }

  async function mount(hostInput, opts) {
    opts = opts || {};
    var host = resolveHost(hostInput);
    if (!host) return null;
    if (!shouldShow(opts)) {
      host.innerHTML = '';
      return null;
    }
    var prefs = loadPrefs(opts);
    var snap = opts.snapshot || await loadSnapshot(opts);
    if (asItems(snap.todayAttendance).length > 0 && !prefs.checkinObserved) {
      prefs = patchPrefs({ checkinObserved: true }, opts);
    }
    var model = deriveChecklist({
      plans: snap.plans,
      staff: snap.staff,
      currentShift: snap.currentShift,
      shifts: snap.shifts,
      members: snap.members,
      invoices: snap.invoices,
      todayAttendance: snap.todayAttendance,
      prefs: prefs,
      user: getUser(opts),
      Authz: opts.Authz || global.GfpAuthz
    });
    var force = opts.forceOpen;
    try {
      if (global.location && /[?&]prepare=1(?:&|$)/.test(global.location.search)) force = true;
    } catch (e) { /* ignore */ }
    paint(host, model, Object.assign({}, opts, { forceOpen: force }));
    return model;
  }

  global.GfpPrepareGym = {
    STEPS: STEPS,
    SEED_TEMPLATES: SEED_TEMPLATES,
    looksLikeSeedTemplates: looksLikeSeedTemplates,
    hasUsablePlan: hasUsablePlan,
    hasFrontDeskStaff: hasFrontDeskStaff,
    hasOpenedShift: hasOpenedShift,
    hasMember: hasMember,
    hasMembershipSale: hasMembershipSale,
    hasCheckin: hasCheckin,
    deriveChecklist: deriveChecklist,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs,
    patchPrefs: patchPrefs,
    markPlansReviewed: function (opts) { return patchPrefs({ plansReviewed: true }, opts); },
    shouldShow: shouldShow,
    isLocalEdition: isLocalEdition,
    mount: mount,
    loadSnapshot: loadSnapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
