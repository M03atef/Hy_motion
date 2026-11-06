/**
 * Membership Plans (§3) — list + type-driven create/edit + soft-delete (409 plan-in-use).
 * Perm: plans.manage for all reads/writes. No read-only plans API for lower roles.
 */
(function () {
  const Gfp = window.GfpApi;
  const Authz = window.GfpAuthz;
  const SESSION_PACK_COUNTS = [10, 20, 50];
  const PT_SESSION_DURATIONS = [30, 45, 60, 90];
  let activityCatalog = null;
  let gymNameEn = '';
  let gymNameAr = '';

  function t(en, ar) {
    const I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return I18n && I18n.getLocale && I18n.getLocale() === 'ar' ? ar || en : en || ar;
  }

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  }

  const user = getUser();
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }

  const canManage = Authz ? Authz.useCan('plans.manage') : false;
  if (!canManage) {
    window.location.href = '/dashboard/';
    return;
  }

  const ini = (user.fullName || 'U')
    .split(' ')
    .map(function (w) {
      return w[0];
    })
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const avatarEl = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  if (avatarEl) avatarEl.textContent = ini;
  if (nameEl) nameEl.textContent = user.fullName || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Staff';
  if (Authz && Authz.useCanRole('OwnerOnly')) {
    const ns = document.getElementById('navStaff');
    if (ns) ns.style.display = 'flex';
  }
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      if (Gfp) Gfp.logout();
      else {
        ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach(function (k) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
        window.location.href = '/auth/login/';
      }
    });
  }

  function paintGymHeader() {
    const gn = document.getElementById('gymName');
    const ga = document.getElementById('gymNameAr');
    if (gn) gn.textContent = t(gymNameEn, gymNameAr) || gymNameEn || gymNameAr || '';
    if (ga) {
      ga.hidden = true;
      ga.textContent = '';
    }
  }

  (async function loadGymHeader() {
    if (!Gfp) return;
    const r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      gymNameEn = r.data.gymName || '';
      gymNameAr = r.data.gymNameAr || '';
      paintGymHeader();
    }
  })();

  const grid = document.getElementById('plansGrid');

  const PT = {
    monthly_unlimited: {
      label: 'Monthly Unlimited',
      labelAr: 'شهري غير محدود',
      icon: 'ti-calendar-repeat',
      color: 'var(--inf500)',
      accent: '#3B82F6',
      bg: 'var(--inf100)',
      short: 'Monthly',
      shortAr: 'شهري'
    },
    session_pack: {
      label: 'Session Pack',
      labelAr: 'باقة جلسات',
      icon: 'ti-bolt',
      color: 'var(--wrn500)',
      accent: '#F59E0B',
      bg: 'var(--wrn100)',
      short: 'Sessions',
      shortAr: 'جلسات'
    },
    time_limited: {
      label: 'Time Limited',
      labelAr: 'محدود بالوقت',
      icon: 'ti-clock-hour-4',
      color: 'var(--purple)',
      accent: '#8B5CF6',
      bg: 'var(--purple100)',
      short: 'Time',
      shortAr: 'وقت'
    },
    pt_credits: {
      label: 'Private Training',
      labelAr: 'برايفت',
      icon: 'ti-barbell',
      color: 'var(--t500)',
      accent: '#148F8F',
      bg: 'var(--t100)',
      short: 'Private',
      shortAr: 'برايفت'
    },
    family: {
      label: 'Family',
      labelAr: 'عائلية',
      icon: 'ti-users-group',
      color: 'var(--coral)',
      accent: '#F97316',
      bg: 'var(--coral100)',
      short: 'Family',
      shortAr: 'عائلية'
    },
    trial: {
      label: 'Trial',
      labelAr: 'تجريبي',
      icon: 'ti-flask',
      color: 'var(--inf500)',
      accent: '#06B6D4',
      bg: 'var(--inf100)',
      short: 'Trial',
      shortAr: 'تجريبي'
    },
    day_pass: {
      label: 'Day Pass',
      labelAr: 'يوم واحد',
      icon: 'ti-sun',
      color: 'var(--wrn500)',
      accent: '#EAB308',
      bg: 'var(--wrn100)',
      short: 'Day',
      shortAr: 'يوم'
    }
  };

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function errMsg(r) {
    if (!r) return t('Request failed', 'فشل الطلب');
    if (r.error && r.error.message) return r.error.message;
    if (r.data) return r.data.message || r.data.error || t('Request failed', 'فشل الطلب');
    return t('Request failed', 'فشل الطلب');
  }

  function openModal() {
    document.getElementById('modalOverlay').classList.add('show');
  }
  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  }
  function openDelete() {
    document.getElementById('deleteOverlay').classList.add('show');
  }
  function closeDelete() {
    document.getElementById('deleteOverlay').classList.remove('show');
  }

  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });
  document.getElementById('deleteOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeDelete();
  });

  /** TimeOnly → "HH:mm:ss" for JSON; HTML time inputs are HH:mm. */
  function toTimeOnly(v) {
    if (!v) return null;
    var s = String(v).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
    if (/^\d{2}:\d{2}:\d{2}\./.test(s)) return s.slice(0, 8);
    return s;
  }

  function toTimeInputValue(v) {
    if (!v) return '';
    var s = String(v);
    if (s.length >= 5) return s.slice(0, 5);
    return s;
  }

  let allPlans = [];

  async function loadPlans() {
    grid.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      t('Loading plans...', 'جارٍ تحميل الخطط...') +
      '</p></div>';
    if (!Gfp) {
      grid.innerHTML =
        '<div class="empty-state"><div class="empty-title">' +
        t('API client missing', 'عميل الـ API غير متوفر') +
        '</div></div>';
      return;
    }
    const r = await Gfp.get('/membership-plans');
    if (!r.ok) {
      grid.innerHTML =
        '<div class="empty-state"><div class="empty-icon"><i class="ti ti-alert-circle"></i></div><div class="empty-title">' +
        t('Could not load plans', 'تعذّر تحميل الخطط') +
        '</div><div class="empty-desc">' +
        esc(errMsg(r)) +
        '</div></div>';
      return;
    }
    allPlans = Array.isArray(r.data) ? r.data : [];
    // List DTO is lean — enrich active cards with detail for features + membership counts
    await enrichPlanDetails(allPlans);
    renderPlans(allPlans);
    updateStats(allPlans);
    paintTemplateBanner(allPlans);
  }

  async function enrichPlanDetails(plans) {
    if (!plans.length || !Gfp) return;
    await Promise.all(
      plans.map(async function (p) {
        try {
          const d = await Gfp.get('/membership-plans/' + p.id);
          if (d.ok && d.data) {
            Object.assign(p, {
              sessionCount: d.data.sessionCount,
              timeRestrictionStart: d.data.timeRestrictionStart,
              timeRestrictionEnd: d.data.timeRestrictionEnd,
              invitationQuota: d.data.invitationQuota,
              referralInviteQuota: d.data.referralInviteQuota,
              referralRewardType: d.data.referralRewardType,
              referralRewardValue: d.data.referralRewardValue,
              trialVisitLimit: d.data.trialVisitLimit,
              description: d.data.description,
              descriptionAr: d.data.descriptionAr,
              activeMemberships: d.data.activeMemberships,
              totalMemberships: d.data.totalMemberships
            });
          }
        } catch (e) {
          /* leave lean list item */
        }
      })
    );
  }

  function paintTemplateBanner(plans) {
    var host = document.getElementById('planTemplateBanner');
    if (!host) return;
    var PG = window.GfpPrepareGym;
    var templates = PG && PG.looksLikeSeedTemplates
      ? PG.looksLikeSeedTemplates(plans)
      : false;
    if (!templates) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.className = 'pg-template-banner';
    host.innerHTML =
      '<div><strong>' +
      t('Starting templates — not final gym pricing', 'قوالب للبداية — ليست أسعار النادي النهائية') +
      '</strong><p>' +
      t(
        'These example plans were added so you can start. Review names and prices before you sell memberships.',
        'هذه باقات مثال أُضيفت للبداية. راجع الأسماء والأسعار قبل بيع العضويات.'
      ) +
      '</p></div>' +
      '<button type="button" class="pg-btn pg-btn-primary" id="btnMarkPlansReviewed">' +
      t('I have reviewed these plans', 'راجعت هذه الباقات') +
      '</button>';
    var btn = document.getElementById('btnMarkPlansReviewed');
    if (btn && PG && PG.markPlansReviewed) {
      btn.addEventListener('click', function () {
        PG.markPlansReviewed();
        host.innerHTML =
          '<div><strong>' +
          t('Plans marked as reviewed', 'تم اعتبار الباقات مراجعة') +
          '</strong><p>' +
          t('You can still edit prices any time from this page.', 'يمكنك تعديل الأسعار في أي وقت من هذه الصفحة.') +
          '</p></div>';
      });
    }
  }

  function updateStats(plans) {
    document.getElementById('statTotal').textContent = plans.length;
    document.getElementById('statActive').textContent = plans.filter(function (p) {
      return p.isActive;
    }).length;
    document.getElementById('statInactive').textContent = plans.filter(function (p) {
      return !p.isActive;
    }).length;
  }

  function renderPlans(plans) {
    if (!plans.length) {
      grid.innerHTML =
        '<div class="empty-state"><div class="empty-icon"><i class="ti ti-package-off"></i></div><div class="empty-title">' +
        t('No membership plans yet', 'لا توجد باقات عضوية بعد') +
        '</div><div class="empty-desc">' +
        t(
          'You need at least one active plan before you can sell a membership. Create a plan with the price you actually charge.',
          'تحتاج باقة نشطة واحدة على الأقل قبل بيع عضوية. أنشئ باقة بالسعر الذي تحصّله فعلاً.'
        ) +
        '</div><button class="btn-create" id="emptyCreate"><i class="ti ti-plus"></i> ' +
        t('Create Plan', 'إنشاء خطة') +
        '</button></div>';
      const ec = document.getElementById('emptyCreate');
      if (ec) ec.addEventListener('click', function () {
        showPlanModal();
      });
      return;
    }

    grid.innerHTML = plans.map(buildCard).join('');

    grid.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const action = this.dataset.action;
        const id = this.dataset.id;
        if (action === 'edit') showPlanModal(id);
        else if (action === 'delete') showDeleteConfirm(id);
      });
    });
  }

  function buildCard(p) {
    const pt = PT[p.planType] || PT.monthly_unlimited;
    const features = buildFeatures(p);

    return (
      '<div class="plan-card ' +
      (p.isActive ? '' : 'inactive') +
      '">' +
      '<div class="card-accent" style="background:' +
      pt.accent +
      '"></div>' +
      '<div class="card-body">' +
      '<span class="type-badge type-' +
      p.planType +
      '"><i class="ti ' +
      pt.icon +
      '"></i>' +
      t(pt.label, pt.labelAr) +
      '</span>' +
      '<div class="plan-name">' +
      esc(t(p.name, p.nameAr) || p.name) +
      '</div>' +
      '<div class="plan-price">' +
      '<span class="price-currency">' +
      esc(p.currency || 'EGP') +
      '</span>' +
      '<span class="price-amount">' +
      formatPrice(p.price) +
      '</span>' +
      '</div>' +
      '<div class="plan-duration"><i class="ti ti-calendar"></i>' +
      p.durationDays +
      t(' days', ' يوم') +
      '</div>' +
      features +
      '<div class="card-stats">' +
      '<div class="card-stat"><div class="card-stat-val">' +
      (p.activeMemberships || 0) +
      '</div><div class="card-stat-lbl">' +
      t('Active', 'نشط') +
      '</div></div>' +
      '<div class="card-stat"><div class="card-stat-val">' +
      (p.totalMemberships || 0) +
      '</div><div class="card-stat-lbl">' +
      t('Total', 'الإجمالي') +
      '</div></div>' +
      '</div>' +
      '<div class="card-actions">' +
      '<button class="card-btn" data-action="edit" data-id="' +
      p.id +
      '"><i class="ti ti-edit"></i> ' +
      t('Edit', 'تعديل') +
      '</button>' +
      '<button class="card-btn del" data-action="delete" data-id="' +
      p.id +
      '"><i class="ti ti-trash"></i> ' +
      t('Soft delete', 'إلغاء التفعيل') +
      '</button>' +
      '</div></div></div>'
    );
  }

  function buildFeatures(p) {
    const items = [];
    if (p.planType === 'session_pack' && p.sessionCount) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-bolt"></i>' + p.sessionCount + t(' sessions included', ' جلسة متضمّنة') + '</div>'
      );
    }
    if (p.planType === 'pt_credits' && p.sessionCount) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-barbell"></i>' +
          p.sessionCount +
          t(' PT sessions', ' جلسة برايفت') +
          (p.ptSessionDurationMinutes ? ' · ' + p.ptSessionDurationMinutes + t(' min', ' دقيقة') : '') +
          '</div>'
      );
    }
    if (p.planType === 'time_limited' && p.timeRestrictionStart) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-clock-hour-4"></i>' +
          toTimeInputValue(p.timeRestrictionStart) +
          ' – ' +
          toTimeInputValue(p.timeRestrictionEnd) +
          '</div>'
      );
    }
    if (p.referralInviteQuota != null && p.referralInviteQuota > 0) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-user-plus"></i>' +
          p.referralInviteQuota +
          t(' invitations / membership', ' دعوة / عضوية') +
          '</div>'
      );
    }
    if (p.planType === 'trial' && p.trialVisitLimit) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-flask"></i>' +
          p.trialVisitLimit +
          t(' visit limit', ' حد الزيارات') +
          '</div>'
      );
    }
    if (p.description) {
      items.push(
        '<div class="plan-feature"><i class="ti ti-info-circle"></i>' + esc(p.description) + '</div>'
      );
    }
    return items.length ? '<div class="plan-features">' + items.join('') + '</div>' : '';
  }

  function formatPrice(v) {
    return Number(v || 0).toLocaleString('en-EG');
  }
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /** Soft-delete — always call API; distinct 409 "plan in use" UX. */
  async function showDeleteConfirm(id) {
    const plan = allPlans.find(function (p) {
      return p.id === id;
    });
    if (!plan) return;
    const dlg = document.getElementById('deleteDialog');
    const active = plan.activeMemberships || 0;

    dlg.innerHTML =
      '<div class="del-icon warn"><i class="ti ti-trash"></i></div>' +
      '<div class="del-title">' +
      t('Soft-delete &quot;' + esc(plan.name) + '&quot;?', 'إلغاء تفعيل &quot;' + esc(plan.name) + '&quot;؟') +
      '</div>' +
      '<div class="del-msg">' +
      t('This deactivates the plan (soft delete). It will no longer be assignable.', 'هذا يعطّل الخطة (إلغاء تفعيل). لن تكون قابلة للتخصيص بعد الآن.') +
      (active > 0
        ? '<br><br>' +
          t(
            '<strong>Note:</strong> This plan currently shows <strong>' +
              active +
              ' active membership' +
              (active > 1 ? 's' : '') +
              '</strong>. If still in use, the server will reject with conflict.',
            '<strong>ملاحظة:</strong> تعرض هذه الخطة حاليًا <strong>' +
              active +
              ' عضوية نشطة</strong>. إذا كانت لا تزال قيد الاستخدام، سيرفض الخادم الطلب بسبب تعارض.'
          )
        : '') +
      '</div>' +
      '<div class="del-actions">' +
      '<button class="btn-cancel" id="delCancel">' + t('Cancel', 'إلغاء') + '</button>' +
      '<button class="btn-primary" style="background:var(--dng500);box-shadow:0 2px 8px rgba(239,68,68,.3)" id="delConfirm"><i class="ti ti-trash"></i> ' + t('Soft delete', 'إلغاء التفعيل') + '</button>' +
      '</div>';
    openDelete();
    document.getElementById('delCancel').addEventListener('click', closeDelete);
    document.getElementById('delConfirm').addEventListener('click', async function () {
      const btn = document.getElementById('delConfirm');
      btn.disabled = true;
      const res = await Gfp.del('/membership-plans/' + id);
      if (res.ok || res.status === 204) {
        closeDelete();
        toast(t('Plan soft-deleted (inactive)', 'تم إلغاء تفعيل الخطة'));
        loadPlans();
        return;
      }
      if (res.status === 409) {
        const serverMsg = errMsg(res);
        dlg.innerHTML =
          '<div class="del-icon conflict"><i class="ti ti-alert-triangle"></i></div>' +
          '<div class="del-title">' + t('Plan in use', 'الخطة قيد الاستخدام') + '</div>' +
          '<div class="del-msg">' + t('This plan cannot be deleted while it has active or frozen memberships.', 'لا يمكن حذف هذه الخطة أثناء وجود عضويات نشطة أو مجمّدة عليها.') + '<br><br>' +
          esc(serverMsg) +
          '</div>' +
          '<div class="del-actions"><button class="btn-cancel" id="delClose">' + t('Understood', 'مفهوم') + '</button></div>';
        document.getElementById('delClose').addEventListener('click', closeDelete);
        return;
      }
      closeDelete();
      toast(errMsg(res), 'error');
    });
  }

  async function showPlanModal(editId) {
    const isEdit = !!editId;
    let plan = {};
    if (isEdit) {
      const r = await Gfp.get('/membership-plans/' + editId);
      if (!r.ok || !r.data) {
        toast(errMsg(r) || t('Failed to load plan', 'تعذّر تحميل الخطة'), 'error');
        return;
      }
      plan = r.data;
    }

    activityCatalog = null;
    const actRes = await Gfp.get('/activities');
    if (actRes && actRes.ok && Array.isArray(actRes.data)) {
      activityCatalog = actRes.data;
    }

    const modal = document.getElementById('modalContent');
    modal.innerHTML = buildModalHTML(plan, isEdit, activityCatalog || []);
    openModal();
    wireEntitlementControls(modal);

    const typeCards = modal.querySelectorAll('.type-card');
    typeCards.forEach(function (tc) {
      tc.addEventListener('click', function () {
        if (isEdit) return; // plan type locked on edit to avoid orphaned field mismatches
        typeCards.forEach(function (c) {
          c.classList.remove('selected');
        });
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        updateConditionalFields(this.querySelector('input').value);
        applyTrialPriceLock();
        updatePreview();
      });
    });

    modal.querySelectorAll('.session-opt').forEach(function (so) {
      so.addEventListener('click', function () {
        modal.querySelectorAll('.session-opt').forEach(function (s) {
          s.classList.remove('selected');
        });
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        const customInput = document.getElementById('sessionCustom');
        if (customInput) customInput.value = this.querySelector('input').value;
        updatePreview();
      });
    });

    updateConditionalFields(plan.planType || 'monthly_unlimited');
    applyTrialPriceLock();

    modal.querySelectorAll('input, select, textarea').forEach(function (el) {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    });
    updatePreview();

    modal.querySelector('.modal-close')?.addEventListener('click', closeModal);

    document.getElementById('planForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = this.querySelector('.btn-primary');
      const collected = collectFormData();
      if (collected.error) {
        toast(collected.error, 'error');
        return;
      }
      btn.disabled = true;
      btn.innerHTML =
        '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i> ' + t('Saving...', 'جارٍ الحفظ...');

      const res = isEdit
        ? await Gfp.put('/membership-plans/' + editId, collected.body)
        : await Gfp.post('/membership-plans', collected.body);

      if (res && res.ok) {
        toast(isEdit ? t('Plan updated', 'تم تحديث الخطة') : t('Plan created', 'تم إنشاء الخطة'));
        closeModal();
        loadPlans();
      } else {
        toast(errMsg(res) || t('Failed to save plan', 'تعذّر حفظ الخطة'), 'error');
        btn.disabled = false;
        btn.innerHTML = isEdit
          ? '<i class="ti ti-check"></i> ' + t('Update Plan', 'تحديث الخطة')
          : '<i class="ti ti-plus"></i> ' + t('Create Plan', 'إنشاء خطة');
      }
    });
  }

  function applyTrialPriceLock() {
    const f = document.getElementById('planForm');
    if (!f) return;
    const fd = new FormData(f);
    const type = fd.get('planType');
    const priceInput = f.querySelector('[name="price"]');
    if (!priceInput) return;
    if (type === 'trial') {
      priceInput.value = '0';
      priceInput.readOnly = true;
      priceInput.title = t('Trial plans must be free (price 0)', 'يجب أن تكون الخطط التجريبية مجانية (السعر 0)');
    } else {
      priceInput.readOnly = false;
      priceInput.title = '';
    }
  }

  function collectFormData() {
    const f = document.getElementById('planForm');
    const fd = new FormData(f);
    const body = {
      name: (fd.get('name') || '').trim(),
      nameAr: (fd.get('nameAr') || '').trim(),
      planType: fd.get('planType'),
      price: parseFloat(fd.get('price')) || 0,
      durationDays: parseInt(fd.get('durationDays'), 10) || 30
    };

    const desc = fd.get('description');
    const descAr = fd.get('descriptionAr');
    if (desc) body.description = desc;
    if (descAr) body.descriptionAr = descAr;

    if (body.planType === 'session_pack') {
      const sc = parseInt(fd.get('sessionCustom'), 10);
      if (SESSION_PACK_COUNTS.indexOf(sc) === -1) {
        return { error: t('Session pack count must be 10, 20, or 50', 'يجب أن يكون عدد جلسات الباقة 10 أو 20 أو 50') };
      }
      body.sessionCount = sc;
    }

    if (body.planType === 'time_limited') {
      const start = fd.get('timeStart');
      const end = fd.get('timeEnd');
      if (!start || !end) {
        return { error: t('Time-limited plans require both start and end times', 'الخطط المحدودة بالوقت تتطلب وقت بداية ونهاية') };
      }
      body.timeRestrictionStart = toTimeOnly(start);
      body.timeRestrictionEnd = toTimeOnly(end);
    }

    if (body.planType === 'pt_credits') {
      const psc = parseInt(fd.get('ptSessionCount'), 10);
      if (!psc || psc < 1) {
        return { error: t('Included sessions must be a positive number', 'عدد الجلسات المضمنة يجب أن يكون رقمًا موجبًا') };
      }
      body.sessionCount = psc;
      const psd = parseInt(fd.get('ptSessionDuration'), 10);
      body.ptSessionDurationMinutes = PT_SESSION_DURATIONS.indexOf(psd) !== -1 ? psd : 60;
    }

    // PRIVATE plans never expose Invitations — force 0 regardless of the hidden field's value.
    body.referralInviteQuota = body.planType === 'pt_credits'
      ? 0
      : parseInt(fd.get('referralInviteQuota'), 10) || 0;

    const rType = (fd.get('referralRewardType') || '').toString().trim();
    if (rType === 'credit' || rType === 'free_days') {
      body.referralRewardType = rType;
      const rv = parseFloat(fd.get('referralRewardValue'));
      if (!isNaN(rv) && rv > 0) body.referralRewardValue = rv;
    } else {
      body.referralRewardType = null;
      body.referralRewardValue = null;
    }

    if (body.planType === 'trial') {
      body.price = 0;
      const tv = fd.get('trialVisitLimit');
      if (tv !== null && tv !== '') {
        const n = parseInt(tv, 10);
        if (!isNaN(n) && n > 0) body.trialVisitLimit = n;
      }
    }

    if (activityCatalog) {
      const ents = [];
      activityCatalog.forEach(function (a) {
        const on = document.getElementById('entOn-' + a.id);
        if (!on || !on.checked) return;
        const modeEl = document.getElementById('entMode-' + a.id);
        const mode = modeEl ? modeEl.value : 'included';
        const item = { activityId: a.id, accessMode: mode };
        if (mode === 'limited') {
          const lim = parseInt((document.getElementById('entLimit-' + a.id) || {}).value, 10);
          if (!lim || lim < 1) {
            return;
          }
          item.quotaLimit = lim;
          item.quotaPeriod = ((document.getElementById('entPeriod-' + a.id) || {}).value) || 'cairo_month';
        }
        ents.push(item);
      });
      const limitedMissing = activityCatalog.some(function (a) {
        const on = document.getElementById('entOn-' + a.id);
        const modeEl = document.getElementById('entMode-' + a.id);
        return on && on.checked && modeEl && modeEl.value === 'limited' &&
          !(parseInt((document.getElementById('entLimit-' + a.id) || {}).value, 10) > 0);
      });
      if (limitedMissing) {
        return { error: t('Limited access needs a quota of at least 1', 'الوصول المحدود يحتاج إلى حصة لا تقل عن 1') };
      }
      body.entitlements = ents;
    }

    return { body: body };
  }

  function updateConditionalFields(type) {
    document.querySelectorAll('.cond-section').forEach(function (s) {
      if (s.id === 'cond-entitlements') {
        s.classList.add('visible');
        return;
      }
      // PRIVATE plans don't expose Invitations — that's a FAMILY/general-plan concept, not part
      // of a Personal Training package (per product rule; avoids inheriting FAMILY behavior).
      if (s.id === 'cond-invite-quota') {
        s.classList.toggle('visible', type !== 'pt_credits');
        return;
      }
      s.classList.remove('visible');
    });
    const sec = document.getElementById('cond-' + type);
    if (sec) sec.classList.add('visible');
  }

  function updatePreview() {
    const prev = document.getElementById('previewCard');
    if (!prev) return;
    const f = document.getElementById('planForm');
    if (!f) return;
    const fd = new FormData(f);
    const name = fd.get('name') || t('Plan Name', 'اسم الخطة');
    const nameAr = fd.get('nameAr') || '';
    const type = fd.get('planType') || 'monthly_unlimited';
    const price = type === 'trial' ? '0' : fd.get('price') || '0';
    const dur = fd.get('durationDays') || '30';
    const pt = PT[type] || PT.monthly_unlimited;

    let feats = '';
    if (type === 'session_pack') {
      const sc = fd.get('sessionCustom') || '10';
      feats =
        '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-bolt" style="color:var(--l600)"></i>' +
        sc +
        t(' sessions', ' جلسة') +
        '</div>';
    }
    if (type === 'pt_credits') {
      const psc = fd.get('ptSessionCount') || '12';
      const psd = fd.get('ptSessionDuration') || '60';
      feats =
        '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-barbell" style="color:var(--l600)"></i>' +
        psc +
        t(' PT sessions · ', ' جلسة برايفت · ') +
        psd +
        t(' min', ' دقيقة') +
        '</div>';
    }
    if (type === 'time_limited') {
      const ts = fd.get('timeStart') || '08:00';
      const te = fd.get('timeEnd') || '17:00';
      feats =
        '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-clock-hour-4" style="color:var(--l600)"></i>' +
        ts +
        ' – ' +
        te +
        '</div>';
    }
    if (type === 'family') {
      feats = '';
    }
    const iqPreview = type === 'pt_credits' ? 0 : parseInt(fd.get('referralInviteQuota'), 10) || 0;
    if (iqPreview > 0) {
      feats +=
        '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-user-plus" style="color:var(--l600)"></i>' +
        iqPreview +
        t(' invitations / membership', ' دعوة / عضوية') +
        '</div>';
    }
    if (activityCatalog) {
      const n = activityCatalog.filter(function (a) {
        const on = document.getElementById('entOn-' + a.id);
        return on && on.checked;
      }).length;
      if (n > 0) {
        feats +=
          '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-run" style="color:var(--l600)"></i>' +
          n +
          t(' included activities', ' نشاط متضمّن') +
          '</div>';
      }
    }
    if (type === 'trial') {
      const tv = fd.get('trialVisitLimit') || '';
      feats = tv
        ? '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-flask" style="color:var(--l600)"></i>' +
          tv +
          t(' visits', ' زيارة') +
          '</div>'
        : '';
      if (iqPreview > 0) {
        feats +=
          '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--lts);padding:8px 16px"><i class="ti ti-ticket" style="color:var(--l600)"></i>' +
          iqPreview +
          t(' guest invitations/month', ' دعوة ضيف/شهريًا') +
          '</div>';
      }
    }

    prev.innerHTML =
      '<div style="height:4px;background:' +
      pt.accent +
      '"></div>' +
      '<div style="padding:16px">' +
      '<span class="type-badge type-' +
      type +
      '" style="font-size:9px;padding:3px 8px"><i class="ti ' +
      pt.icon +
      '"></i>' +
      t(pt.label, pt.labelAr) +
      '</span>' +
      '<div style="font-family:var(--fd);font-size:16px;font-weight:700;margin-top:8px">' +
      esc(name) +
      '</div>' +
      (nameAr
        ? '<div style="font-family:var(--fa);font-size:11px;color:var(--ltt);direction:rtl">' +
          esc(nameAr) +
          '</div>'
        : '') +
      '<div style="margin:10px 0 4px;display:flex;align-items:baseline;gap:3px">' +
      '<span style="font-size:12px;color:var(--ltt)">EGP</span>' +
      '<span style="font-family:var(--fd);font-size:26px;font-weight:700;color:var(--l600)">' +
      formatPrice(price) +
      '</span></div>' +
      '<div style="font-size:11px;color:var(--ltt);display:flex;align-items:center;gap:4px"><i class="ti ti-calendar" style="font-size:13px"></i>' +
      dur +
      t(' days', ' يوم') +
      '</div>' +
      feats +
      '</div>';
  }

  function entitlementSectionHtml(plan, isEdit, catalog) {
    if (!catalog.length) {
      return '<div class="cond-section visible" id="cond-entitlements" style="display:block">' +
        '<div class="cond-title"><i class="ti ti-run"></i> ' + t('Includes', 'يتضمّن') + '</div>' +
        '<div class="modal-header-sub">' + t('Could not load activities. Save without changing includes, or open Catalog → Activities first.', 'تعذّر تحميل الأنشطة. احفظ دون تغيير المتضمّنات، أو افتح الكتالوج ← الأنشطة أولاً.') + '</div></div>';
    }
    const existing = (plan && Array.isArray(plan.entitlements)) ? plan.entitlements : [];
    const byId = {};
    existing.forEach(function (e) { byId[e.activityId] = e; });
    const rows = catalog.map(function (a) {
      const ent = byId[a.id];
      const onCreateFloor = !isEdit && a.systemKey === 'gym_floor';
      const checked = ent ? true : onCreateFloor;
      const mode = ent ? (ent.accessMode || 'included') : 'included';
      const limit = ent && ent.quotaLimit != null ? ent.quotaLimit : '';
      const period = ent && ent.quotaPeriod ? ent.quotaPeriod : 'cairo_month';
      const label = a.name + (a.isSystem ? ' (system)' : '') + (a.kind === 'facility' ? ' · facility' : '');
      return '<div class="ent-card' + (checked ? ' is-on' : '') + '" data-ent-activity="' + a.id + '">' +
        '<label class="ent-card-toggle">' +
        '<input type="checkbox" id="entOn-' + a.id + '" value="' + a.id + '"' +
        (checked ? ' checked' : '') + '>' +
        '<span class="ent-check"><i class="ti ti-check"></i></span>' +
        '<span class="ent-card-name"><strong>' + esc(a.name) + '</strong>' +
        '<small>' + esc(t((a.isSystem ? 'System activity' : 'Custom activity') + (a.kind === 'facility' ? ' · Facility access' : ' · Class booking'), (a.isSystem ? 'نشاط نظامي' : 'نشاط مخصّص') + (a.kind === 'facility' ? ' · وصول للمرافق' : ' · حجز حصة'))) + '</small></span>' +
        '</label>' +
        '<div class="ent-card-controls">' +
        '<label class="ent-control"><span>' + t('Access', 'الوصول') + '</span><select id="entMode-' + a.id + '">' +
        '<option value="included"' + (mode === 'included' ? ' selected' : '') + '>' + t('Included', 'متضمّن') + '</option>' +
        '<option value="unlimited"' + (mode === 'unlimited' ? ' selected' : '') + '>' + t('Unlimited', 'غير محدود') + '</option>' +
        '<option value="limited"' + (mode === 'limited' ? ' selected' : '') + '>' + t('Limited', 'محدود') + '</option>' +
        '</select></label>' +
        '<label class="ent-control ent-quota-control"><span>' + t('Quota', 'الحصة') + '</span><input type="number" id="entLimit-' + a.id + '" min="1" placeholder="' + t('e.g. 8', 'مثال: 8') + '" value="' + limit + '"></label>' +
        '<label class="ent-control ent-period-control"><span>' + t('Resets', 'يُعاد التعيين') + '</span><select id="entPeriod-' + a.id + '">' +
        '<option value="cairo_month"' + (period === 'cairo_month' || period === 'monthly' ? ' selected' : '') + '>' + t('Every Cairo month', 'كل شهر (بتوقيت القاهرة)') + '</option>' +
        '<option value="membership"' + (period === 'membership' ? ' selected' : '') + '>' + t('Per membership', 'لكل عضوية') + '</option>' +
        '<option value="one_time"' + (period === 'one_time' ? ' selected' : '') + '>' + t('One time', 'مرة واحدة') + '</option>' +
        '</select></label>' +
        '</div></div>';
    }).join('');
    return '<div class="cond-section visible" id="cond-entitlements" style="display:block">' +
      '<div class="ent-section-header"><div><div class="cond-title"><i class="ti ti-run"></i> ' + t('Activity access', 'صلاحية الأنشطة') + '</div>' +
      '<div class="modal-header-sub">' + t('Choose what members can use. Limited access consumes one credit per booking; the remaining balance is calculated from real usage.', 'اختر ما يمكن للأعضاء استخدامه. الوصول المحدود يستهلك رصيدًا واحدًا لكل حجز؛ ويُحسب الرصيد المتبقي من الاستخدام الفعلي.') + '</div></div>' +
      '<span class="ent-section-hint"><i class="ti ti-database"></i> ' + t('Live usage', 'استخدام مباشر') + '</span></div>' +
      '<div class="ent-grid">' + rows + '</div></div>';
  }

  function wireEntitlementControls(modal) {
    modal.querySelectorAll('.ent-card').forEach(function (card) {
      const on = card.querySelector('input[type="checkbox"]');
      const mode = card.querySelector('select[id^="entMode-"]');
      const quota = card.querySelector('input[id^="entLimit-"]');
      const period = card.querySelector('select[id^="entPeriod-"]');
      const quotaControl = card.querySelector('.ent-quota-control');
      const periodControl = card.querySelector('.ent-period-control');
      if (!on || !mode || !quota || !period) return;

      function sync() {
        const enabled = on.checked;
        const limited = mode.value === 'limited';
        card.classList.toggle('is-on', enabled);
        mode.disabled = !enabled;
        quota.disabled = !enabled || !limited;
        period.disabled = !enabled || !limited;
        if (quotaControl) quotaControl.hidden = !limited;
        if (periodControl) periodControl.hidden = !limited;
      }

      on.addEventListener('change', sync);
      mode.addEventListener('change', sync);
      sync();
    });
  }

  function buildModalHTML(p, isEdit, catalog) {
    const v = p || {};
    catalog = catalog || [];
    const selType = v.planType || 'monthly_unlimited';
    let sessCount = v.sessionCount || 20;
    if (SESSION_PACK_COUNTS.indexOf(sessCount) === -1) sessCount = 20;
    const ptSessionCount = v.sessionCount != null ? v.sessionCount : 12;
    const ptSessionDuration = PT_SESSION_DURATIONS.indexOf(v.ptSessionDurationMinutes) !== -1
      ? v.ptSessionDurationMinutes
      : 60;

    return (
      '<div class="modal-header">' +
      '<div><h2>' +
      (isEdit ? t('Edit Plan', 'تعديل الخطة') : t('Create New Plan', 'إنشاء خطة جديدة')) +
      '</h2>' +
      '<div class="modal-header-sub">' +
      (isEdit ? t('Update plan details', 'تحديث تفاصيل الخطة') : t('Add a new membership plan', 'إضافة خطة عضوية جديدة')) +
      '</div></div>' +
      '<button type="button" class="modal-close"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<form id="planForm">' +
      '<div class="modal-body">' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + t('Plan Name (English)', 'اسم الخطة (إنجليزي)') + ' <span class="req">*</span></label><input name="name" value="' +
      esc(v.name || '') +
      '" required placeholder="e.g. Monthly Unlimited"></div>' +
      '<div class="fg"><label>' + t('Plan Name (Arabic)', 'اسم الخطة (عربي)') + ' <span class="req">*</span></label><input name="nameAr" value="' +
      esc(v.nameAr || '') +
      '" required placeholder="مثال: شهري غير محدود" dir="rtl" style="font-family:var(--fa)"></div>' +
      '</div>' +
      '<div class="fg"><label>' + t('Plan Type', 'نوع الخطة') + ' <span class="req">*</span></label>' +
      (isEdit
        ? '<div class="modal-header-sub" style="margin-bottom:8px">' + t('Type is fixed after create', 'النوع ثابت بعد الإنشاء') + '</div>'
        : '') +
      '</div>' +
      '<div class="type-selector">' +
      Object.keys(PT)
        .filter(function (key) {
          // Trials removed from product — hide except when editing legacy plans.
          // pt_credits is the PRIVATE / Personal Training plan type (product-approved, see PRD).
          if (key === 'trial') {
            return isEdit && key === selType;
          }
          return true;
        })
        .map(function (key) {
          const cfg = PT[key];
          const locked = isEdit && key !== selType;
          return (
            '<div class="type-card ' +
            (key === selType ? 'selected' : '') +
            (locked ? ' locked' : '') +
            '"' +
            (locked ? ' style="opacity:.4;pointer-events:none"' : '') +
            '>' +
            '<input type="radio" name="planType" value="' +
            key +
            '" ' +
            (key === selType ? 'checked' : '') +
            (isEdit && key !== selType ? ' disabled' : '') +
            '>' +
            '<div class="type-card-icon" style="background:' +
            cfg.bg +
            ';color:' +
            cfg.color +
            '"><i class="ti ' +
            cfg.icon +
            '"></i></div>' +
            '<div class="type-card-name">' +
            t(cfg.short, cfg.shortAr) +
            '</div></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + t('Price (EGP)', 'السعر (جنيه)') + ' <span class="req">*</span></label><input type="number" name="price" step="0.01" min="0" value="' +
      (selType === 'trial' ? '0' : v.price != null ? v.price : '') +
      '" required placeholder="500" ' +
      (selType === 'trial' ? 'readonly' : '') +
      '></div>' +
      '<div class="fg"><label>' + t('Duration (days)', 'المدة (بالأيام)') + ' <span class="req">*</span></label><input type="number" name="durationDays" min="1" value="' +
      (v.durationDays != null ? v.durationDays : '') +
      '" required placeholder="30"></div>' +
      '</div>' +
      '<div class="cond-section" id="cond-session_pack">' +
      '<div class="cond-title"><i class="ti ti-bolt"></i> ' + t('Session Pack Options', 'خيارات باقة الجلسات') + '</div>' +
      '<label style="font-size:12px;font-weight:600;color:var(--lts);margin-bottom:8px;display:block">' + t('Number of Sessions (10 / 20 / 50)', 'عدد الجلسات (10 / 20 / 50)') + '</label>' +
      '<div class="session-options">' +
      SESSION_PACK_COUNTS.map(function (n) {
        return (
          '<div class="session-opt ' +
          (sessCount == n ? 'selected' : '') +
          '"><input type="radio" name="sessionRadio" value="' +
          n +
          '" ' +
          (sessCount == n ? 'checked' : '') +
          '><div class="session-opt-val">' +
          n +
          '</div><div class="session-opt-lbl">' + t('sessions', 'جلسة') + '</div></div>'
        );
      }).join('') +
      '</div>' +
      '<input type="hidden" name="sessionCustom" id="sessionCustom" value="' +
      sessCount +
      '">' +
      '</div>' +
      '<div class="cond-section" id="cond-time_limited">' +
      '<div class="cond-title"><i class="ti ti-clock-hour-4"></i> ' + t('Time Restriction (both required)', 'قيود الوقت (كلاهما مطلوب)') + '</div>' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + t('Start Time', 'وقت البداية') + ' <span class="req">*</span></label><input type="time" name="timeStart" value="' +
      toTimeInputValue(v.timeRestrictionStart || '08:00') +
      '"></div>' +
      '<div class="fg"><label>' + t('End Time', 'وقت النهاية') + ' <span class="req">*</span></label><input type="time" name="timeEnd" value="' +
      toTimeInputValue(v.timeRestrictionEnd || '17:00') +
      '"></div>' +
      '</div></div>' +
      '<div class="cond-section" id="cond-pt_credits">' +
      '<div class="cond-title"><i class="ti ti-barbell"></i> ' + t('Private Training Options', 'خيارات البرايفت') + '</div>' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + t('Included Sessions', 'الجلسات المضمّنة') + ' <span class="req">*</span></label><input type="number" name="ptSessionCount" min="1" value="' +
      ptSessionCount +
      '" placeholder="' + t('e.g. 12', 'مثال: 12') + '"><div class="modal-header-sub">' + t('Personal training sessions included in this package', 'عدد جلسات التدريب الشخصي المضمنة في الباقة') + '</div></div>' +
      '<div class="fg"><label>' + t('Session Duration', 'مدة الجلسة') + '</label><select name="ptSessionDuration">' +
      PT_SESSION_DURATIONS.map(function (m) {
        return '<option value="' + m + '"' + (ptSessionDuration === m ? ' selected' : '') + '>' + m + ' ' + t('minutes', 'دقيقة') + '</option>';
      }).join('') +
      '</select><div class="modal-header-sub">' + t('Length of one PT session', 'مدة الجلسة الواحدة') + '</div></div>' +
      '</div>' +
      '<div class="modal-header-sub">' + t('Trainer is assigned per session when the PT session is booked/scheduled, not on the plan itself. Gym floor access and other activities are controlled below under Activity access.', 'يتم تعيين المدرب لكل جلسة عند حجز/جدولة جلسة البرايفت، وليس على مستوى الخطة نفسها. الوصول لصالة الجيم والأنشطة الأخرى يُتحكم بها أدناه ضمن صلاحية الأنشطة.') + '</div>' +
      '</div>' +
      '<div class="cond-section" id="cond-family">' +
      '<div class="cond-title"><i class="ti ti-users-group"></i> ' + t('Family Plan Options', 'خيارات الخطة العائلية') + '</div>' +
      '<div class="modal-header-sub">' + t('Invitations for this plan are configured below.', 'يتم إعداد دعوات هذه الخطة أدناه.') + '</div></div>' +
      '<div class="cond-section visible" id="cond-invite-quota" style="display:block">' +
      '<div class="cond-title"><i class="ti ti-user-plus"></i> ' + t('Invitations', 'الدعوات') + '</div>' +
      '<div class="fg"><label>' + t('Invitations per membership', 'الدعوات لكل عضوية') + '</label><input type="number" name="referralInviteQuota" min="0" value="' +
      (v.referralInviteQuota != null ? v.referralInviteQuota : 0) +
      '" placeholder="' + t('0 = none', '0 = بدون') + '"><div class="modal-header-sub">' + t('How many friends a member on this plan may invite during this membership. Unused invitations do not carry to the next membership. Frozen, expired, or cancelled = 0.', 'عدد الأصدقاء الذين يمكن للعضو على هذه الخطة دعوتهم خلال هذه العضوية. الدعوات غير المستخدمة لا تُرحّل للعضوية التالية. عند التجميد أو الانتهاء أو الإلغاء = 0.') + '</div></div></div>' +
      entitlementSectionHtml(v, isEdit, catalog) +
      '<div class="cond-section" id="cond-trial">' +
      '<div class="cond-title"><i class="ti ti-flask"></i> ' + t('Trial Options', 'خيارات التجربة') + '</div>' +
      '<div class="fg"><label>' + t('Visit limit (optional)', 'حد الزيارات (اختياري)') + '</label><input type="number" name="trialVisitLimit" min="1" value="' +
      (v.trialVisitLimit != null ? v.trialVisitLimit : '') +
      '" placeholder="' + t('e.g. 3', 'مثال: 3') + '"><div class="modal-header-sub">' + t('Price is always 0 for trial plans', 'السعر دائمًا 0 للخطط التجريبية') + '</div></div></div>' +
      '<div class="form-row">' +
      '<div class="fg"><label>' + t('Description (English)', 'الوصف (إنجليزي)') + '</label><textarea name="description" placeholder="' + t('Optional plan description...', 'وصف اختياري للخطة...') + '">' +
      esc(v.description || '') +
      '</textarea></div>' +
      '<div class="fg"><label>' + t('Description (Arabic)', 'الوصف (عربي)') + '</label><textarea name="descriptionAr" placeholder="وصف الباقة..." dir="rtl" style="font-family:var(--fa)">' +
      esc(v.descriptionAr || '') +
      '</textarea></div></div>' +
      '<div class="preview-section">' +
      '<div class="preview-label"><i class="ti ti-eye"></i> ' + t('Live Preview', 'معاينة مباشرة') + '</div>' +
      '<div class="preview-card" id="previewCard"></div></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn-cancel" id="modalCancel">' + t('Cancel', 'إلغاء') + '</button>' +
      '<button type="submit" class="btn-primary">' +
      (isEdit
        ? '<i class="ti ti-check"></i> ' + t('Update Plan', 'تحديث الخطة')
        : '<i class="ti ti-plus"></i> ' + t('Create Plan', 'إنشاء خطة')) +
      '</button></div></form>'
    );
  }

  // Wire cancel after first paint of create button
  document.getElementById('btnCreate').addEventListener('click', function () {
    showPlanModal();
  });
  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'modalCancel') closeModal();
  });
  document.addEventListener('click', function (e) {
    if (e.target && (e.target.id === 'modalCancel' || e.target.closest('#modalCancel'))) {
      closeModal();
    }
  });

  window.addEventListener('gfp:locale', function () {
    paintGymHeader();
    if (allPlans && allPlans.length) renderPlans(allPlans);
  });

  loadPlans();
})();
