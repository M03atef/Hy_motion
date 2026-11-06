// ── Detail Panel + Modals (§4 assign / renew / history) ──

function renderDetail() {
  const empty = document.getElementById('detailEmpty'),
    content = document.getElementById('detailContent');
  if (!state.selectedId) {
    empty.style.display = 'flex';
    content.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  content.style.display = 'block';
  if (!selMember) {
    content.innerHTML = skeleton(6);
    return;
  }
  const m = selMember,
    ms = selMs,
    isAct = m.isActive !== false;
  const canMgr = canManageMemberships();
  const canFreeze = typeof canFreezeMemberships === 'function' ? canFreezeMemberships() : false;
  let html =
    '<div class="dh">' +
    avatar(m.fullName, 44) +
    '<div class="dh-info"><div class="dh-name">' +
    (m.fullName || '') +
    '</div>' +
    (m.fullNameAr ? '<div class="dh-name-ar">' + m.fullNameAr + '</div>' : '') +
    '<div class="dh-num">' +
    (m.memberNumber || '') +
    '</div></div>' +
    '<div class="dh-dot" style="background:' +
    (isAct ? 'var(--suc500)' : 'var(--dng500)') +
    '"></div></div><div class="divider"></div>';

  if (ms) {
    const st = (ms.status || '').toLowerCase();
    const td = totalDays(ms.startDate, ms.endDate);
    const dr = ms.daysRemaining != null ? ms.daysRemaining : daysUntil(ms.endDate);
    const pct = td > 0 ? Math.max(0, Math.min(100, (dr / td) * 100)).toFixed(1) : 0;
    const sc =
      {
        active: 'var(--suc500)',
        scheduled: 'var(--wrn500)',
        frozen: 'var(--frz500)',
        expired: 'var(--dng500)',
        pending: 'var(--wrn500)'
      }[st] || 'var(--suc500)';

    html += '<div class="plan-sec"><div class="plan-hdr">' + planBadge(ms.planType) + statusBadge(ms.status) + '</div>';
    html += '<div class="plan-name">' + (ms.planName || '') + '</div>';
    if (ms.planNameAr) html += '<div class="plan-name-ar">' + ms.planNameAr + '</div>';

    // Non-null current may be last *expired* membership — label clearly
    if (st === 'expired') {
      html +=
        '<div class="info-banner" style="background:var(--dng100,#FEE2E2);color:var(--dng500)"><i class="ti ti-info-circle"></i>' +
        t(
          'Showing last expired membership (no active plan)',
          'يُعرض آخر اشتراك منتهٍ (لا يوجد اشتراك نشط)'
        ) +
        '</div>';
    } else if (st === 'scheduled') {
      html +=
        '<div class="info-banner" style="background:var(--wrn100,#FEF3C7);color:var(--wrn600,#B45309)"><i class="ti ti-calendar-event"></i>' +
        t(
          'Membership starts on ' + formatDate(ms.startDate) + ' — check-in not available yet',
          'الاشتراك يبدأ في ' + formatDate(ms.startDate) + ' — تسجيل الدخول غير متاح بعد'
        ) +
        '</div>';
    }

    html +=
      '<div class="date-row"><i class="ti ti-calendar"></i>' +
      formatDate(ms.startDate) +
      ' → ' +
      formatDate(ms.endDate) +
      '</div>';

    if (st !== 'pending' && st !== 'expired') {
      html +=
        '<div class="gauge-wrap"><div class="gauge" style="background:conic-gradient(' +
        sc +
        ' ' +
        pct +
        '%,var(--ls3) 0)"><div class="gauge-inner"><div class="gauge-val">' +
        Math.max(0, dr) +
        '</div><div class="gauge-lbl">' +
        t('days', 'يوم') +
        '</div></div></div></div>';
    }

    if (ms.sessionsRemaining != null) {
      const tot = ms.sessionCount || ms.sessionsRemaining;
      let dots = '';
      for (let i = 0; i < Math.min(ms.sessionsRemaining, 20); i++)
        dots += '<div class="sess-dot" style="background:var(--inf500)"></div>';
      for (let i = 0; i < Math.max(0, Math.min(tot, 20) - ms.sessionsRemaining); i++)
        dots += '<div class="sess-dot" style="background:var(--ls3)"></div>';
      html +=
        '<div class="sess-row"><div class="sess-lbl">' +
        t('Sessions remaining', 'جلسات متبقية') +
        '</div><div class="sess-val">' +
        ms.sessionsRemaining +
        '</div><div class="sess-dots">' +
        dots +
        '</div></div>';
    }

    html +=
      '<div class="pay-row"><i class="ti ti-cash" style="color:var(--ltt)"></i>' +
      payChip(ms.paymentMethod) +
      '<span style="font-weight:700">EGP ' +
      (ms.amountPaid || 0).toLocaleString() +
      '</span></div>';
    if (ms.frozenFromDate)
      html +=
        '<div class="freeze-banner"><i class="ti ti-snowflake"></i>' +
        t('Frozen', 'مجمد') +
        ': ' +
        formatDate(ms.frozenFromDate) +
        ' → ' +
        formatDate(ms.frozenUntilDate) +
        '</div>';

    // §23 — gateway pending: no SignalR push — explicit wait + refresh
    if (st === 'pending') {
      html +=
        '<div class="info-banner" style="background:var(--wrn100);color:var(--wrn500);flex-direction:column;align-items:stretch;gap:10px">' +
        '<div><i class="ti ti-clock"></i> <strong>' +
        t('Waiting for payment', 'بانتظار الدفع') +
        '</strong><br><span style="font-size:12px;opacity:.9">' +
        t(
          'Gateway payment — membership stays pending until the webhook confirms. There is no live push; refresh to check status.',
          'دفع عبر البوابة — يبقى الاشتراك معلقاً حتى يؤكد الويبهوك. لا يوجد إشعار فوري؛ حدّث للتحقق.'
        ) +
        '</span></div>' +
        '<button class="btn btn-outline" style="align-self:flex-start" onclick="refreshCurrentMembership(\'' +
        m.id +
        '\')"><i class="ti ti-refresh"></i> ' +
        t('Refresh status', 'تحديث الحالة') +
        '</button></div>';
    }

    if (canMgr || canFreeze) {
      if (st === 'active') {
        let row = '<div class="action-row">';
        if (canFreeze)
          row +=
            '<button class="btn btn-outline" onclick="openFreezeModal(\'' +
            m.id +
            '\')"><i class="ti ti-snowflake"></i>' +
            t('Freeze', 'تجميد') +
            '</button>';
        if (canMgr)
          row +=
            '<button class="btn btn-outline" onclick="openRenewModal(\'' +
            m.id +
            '\')"><i class="ti ti-refresh"></i>' +
            t('Renew', 'تجديد') +
            '</button>';
        row +=
          '<button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
          m.id +
          '\')"><i class="ti ti-barcode"></i>' +
          t('Reprint card', 'إعادة طباعة الكارنيه') +
          '</button>';
        row += '</div>';
        html += row;
      } else if (st === 'scheduled' && canMgr) {
        html +=
          '<div class="action-row"><button class="btn btn-outline" onclick="openRenewModal(\'' +
          m.id +
          '\')"><i class="ti ti-refresh"></i>' +
          t('Renew', 'تجديد') +
          '</button>' +
          '<button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
          m.id +
          '\')"><i class="ti ti-barcode"></i>' +
          t('Reprint card', 'إعادة طباعة الكارنيه') +
          '</button></div>';
      } else if (st === 'frozen' && canFreeze)
        html +=
          '<div class="action-row"><button class="btn btn-outline" onclick="openUnfreezeModal(\'' +
          m.id +
          '\')"><i class="ti ti-sun"></i>' +
          t('Unfreeze', 'فك التجميد') +
          '</button>' +
          '<button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
          m.id +
          '\')"><i class="ti ti-barcode"></i>' +
          t('Reprint card', 'إعادة طباعة الكارنيه') +
          '</button></div>';
      else if (canMgr && (st === 'expired' || st === 'cancelled'))
        html +=
          '<div class="action-row"><button class="btn btn-primary" onclick="openAssignModal(\'' +
          m.id +
          '\')"><i class="ti ti-plus"></i>' +
          t('Assign', 'تعيين') +
          '</button><button class="btn btn-outline" onclick="openRenewModal(\'' +
          m.id +
          '\')"><i class="ti ti-refresh"></i>' +
          t('Renew', 'تجديد') +
          '</button>' +
          '<button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
          m.id +
          '\')"><i class="ti ti-barcode"></i>' +
          t('Reprint card', 'إعادة طباعة الكارنيه') +
          '</button></div>';
      else {
        html +=
          '<div class="action-row"><button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
          m.id +
          '\')"><i class="ti ti-barcode"></i>' +
          t('Reprint card', 'إعادة طباعة الكارنيه') +
          '</button></div>';
      }
    } else {
      html +=
        '<div class="action-row"><button class="btn btn-outline" onclick="printMemberAccessCard(\'' +
        m.id +
        '\')"><i class="ti ti-barcode"></i>' +
        t('Reprint card', 'إعادة طباعة الكارنيه') +
        '</button></div>';
    }
    html += '</div>';
  } else {
    html +=
      '<div class="plan-sec" style="text-align:center;padding:30px"><i class="ti ti-id-badge-off" style="font-size:32px;color:var(--ls4);display:block;margin-bottom:8px"></i><p style="color:var(--ltt);font-size:13px;margin-bottom:14px">' +
      t('No membership on file', 'لا يوجد اشتراك مسجل') +
      '</p>' +
      (canMgr
        ? '<button class="btn btn-primary" onclick="openAssignModal(\'' +
          m.id +
          '\')"><i class="ti ti-plus"></i>' +
          t('Assign plan', 'تعيين خطة') +
          '</button>'
        : '') +
      '<button class="btn btn-outline" style="margin-top:8px" onclick="printMemberAccessCard(\'' +
      m.id +
      '\')"><i class="ti ti-barcode"></i>' +
      t('Reprint card', 'إعادة طباعة الكارنيه') +
      '</button>' +
      '</div>';
  }

  html += '<div class="divider"></div>';
  html +=
    '<div class="hist-hdr' +
    (histLoaded ? ' open' : '') +
    '" id="histToggle"><div style="display:flex;align-items:center;gap:8px"><i class="ti ti-history" style="font-size:16px;color:var(--ltt)"></i><span style="font-size:13px;font-weight:600">' +
    t('History', 'السجل') +
    '</span></div><i class="ti ti-chevron-down" style="font-size:14px;color:var(--ltt)"></i></div>';
  html +=
    '<div class="hist-body' +
    (histLoaded ? ' open' : '') +
    '" id="histBody">' +
    (histLoaded ? renderHist() : '') +
    '</div>';
  content.innerHTML = html;
  document.getElementById('histToggle')?.addEventListener('click', function () {
    toggleHist(m.id);
  });
}

function renderHist() {
  if (!histData.length)
    return (
      '<div style="text-align:center;padding:16px;color:var(--ltt);font-size:12px">' +
      t('No history', 'لا يوجد سجل') +
      '</div>'
    );
  let h =
    histData
      .map(function (item) {
        const dc =
          {
            active: 'var(--suc500)',
            frozen: 'var(--frz500)',
            expired: 'var(--dng500)',
            pending: 'var(--wrn500)',
            cancelled: 'var(--ltt)'
          }[(item.status || '').toLowerCase()] || 'var(--ltt)';
        return (
          '<div class="tl-item"><div class="tl-line"></div><div class="tl-dot" style="background:' +
          dc +
          '"></div><div class="tl-content"><div style="font-weight:600">' +
          (item.planName || '') +
          ' ' +
          statusBadge(item.status) +
          '</div><div style="color:var(--ltt)">' +
          formatDate(item.startDate) +
          ' → ' +
          formatDate(item.endDate) +
          '</div><div style="margin-top:4px">EGP ' +
          (item.amountPaid || 0).toLocaleString() +
          ' ' +
          payChip(item.paymentMethod) +
          '</div></div></div>'
        );
      })
      .join('');
  if (histHasNext) {
    h +=
      '<button class="btn btn-outline" style="width:100%;margin-top:8px" id="histMore"><i class="ti ti-chevron-down"></i> ' +
      t('Load more', 'المزيد') +
      '</button>';
  }
  return h;
}

async function toggleHist(id) {
  if (histLoaded) {
    histLoaded = false;
    renderDetail();
    return;
  }
  histLoaded = true;
  histPage = 1;
  histData = [];
  await loadHistPage(id, 1, false);
  renderDetail();
  document.getElementById('histMore')?.addEventListener('click', function () {
    loadMoreHist(id);
  });
}

async function loadHistPage(id, page, append) {
  try {
    const d = await apiGet('/memberships/' + id + '/history?page=' + page + '&pageSize=20');
    const paged = asPaged(d);
    histData = append ? histData.concat(paged.items) : paged.items;
    histPage = paged.page || page;
    histHasNext =
      paged.hasNext ||
      histData.length < (paged.totalCount || 0) ||
      paged.items.length >= (paged.pageSize || 20);
  } catch (e) {
    if (!append) histData = [];
    histHasNext = false;
  }
}

async function loadMoreHist(id) {
  await loadHistPage(id, histPage + 1, true);
  renderDetail();
  document.getElementById('histMore')?.addEventListener('click', function () {
    loadMoreHist(id);
  });
}

function showModal(html, width) {
  const ov = document.getElementById('modalOverlay'),
    mc = document.getElementById('modalContent');
  mc.style.maxWidth = (width || 420) + 'px';
  mc.innerHTML = html;
  ov.style.display = 'flex';
}
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

function modalErr(err, errEl, btn, orig) {
  const status = err && err.status;
  const msg =
    (err && err.data && (err.data.message || err.data.error)) ||
    (err && err.error && err.error.message) ||
    t('Unexpected error', 'خطأ غير متوقع');
  if (status === 400) {
    const m = err.data?.errors
      ? Object.values(err.data.errors).flat().join(' ')
      : msg || 'Validation error';
    if (errEl) errEl.textContent = m;
  } else if (status === 409) {
    toast(msg || t('Conflict', 'تعارض'), 'error');
    if (errEl) errEl.textContent = msg;
  } else if (status === 404) toast(t('Not found', 'غير موجود'), 'error');
  else toast(msg, 'error');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function openFreezeModal(id) {
  if (!canFreezeMemberships()) {
    toast(t('memberships.freeze permission required', 'صلاحية تجميد الاشتراك مطلوبة'), 'error');
    return;
  }
  const m = state.members.find(function (x) {
    return x.id === id;
  }) || selMember || {};
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const max = new Date();
  max.setDate(max.getDate() + 90);
  showModal(
    '<div class="modal-hdr"><h3><i class="ti ti-snowflake"></i>' +
      t('Freeze Membership', 'تجميد الاشتراك') +
      '</h3><button class="modal-close" onclick="closeModal()">×</button></div>' +
      '<div class="modal-body"><div class="modal-member">' +
      avatar(m.fullName || '', 28) +
      '<div class="m-name">' +
      (m.fullName || '') +
      '</div></div>' +
      '<div class="fg"><label>' +
      t('Freeze until', 'تجميد حتى') +
      '</label><input type="date" id="fDate" min="' +
      tmrw.toISOString().split('T')[0] +
      '" max="' +
      max.toISOString().split('T')[0] +
      '"><div id="fCalc" class="hint"></div><div id="fErr" class="err"></div></div>' +
      '<div class="fg"><label>' +
      t('Reason (optional)', 'السبب') +
      '</label><textarea id="fReason" rows="2" placeholder="' +
      t('Travel, injury…', 'سفر، إصابة…') +
      '"></textarea></div></div>' +
      '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">' +
      t('Cancel', 'إلغاء') +
      '</button><button class="btn btn-primary" id="fBtn" onclick="doFreeze(\'' +
      id +
      '\')"><i class="ti ti-snowflake"></i>' +
      t('Freeze', 'تجميد') +
      '</button></div>'
  );
  document.getElementById('fDate').addEventListener('change', function () {
    const d = Math.ceil((new Date(this.value) - new Date()) / 86400000);
    document.getElementById('fCalc').innerHTML =
      t('Duration:', 'المدة:') + ' ' + d + ' ' + t('days', 'يوم');
  });
}
async function doFreeze(id) {
  const btn = document.getElementById('fBtn'),
    err = document.getElementById('fErr'),
    dv = document.getElementById('fDate').value;
  if (!dv) {
    document.getElementById('fDate').classList.add('invalid');
    err.textContent = t('Select a date', 'اختر تاريخاً');
    return;
  }
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  const res = await apiPost('/members/' + id + '/freeze', {
    frozenUntil: dv + 'T00:00:00',
    reason: document.getElementById('fReason').value || null
  });
  if (res.ok) {
    closeModal();
    toast(t('Membership frozen', 'تم التجميد'));
    refreshAfter(id);
  } else modalErr(res, err, btn, orig);
}

function openUnfreezeModal(id) {
  if (!canFreezeMemberships()) {
    toast(t('memberships.freeze permission required', 'صلاحية تجميد الاشتراك مطلوبة'), 'error');
    return;
  }
  showModal(
    '<div class="modal-body" style="text-align:center;padding:32px"><i class="ti ti-sun" style="font-size:32px;color:var(--wrn500);display:block;margin-bottom:12px"></i>' +
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">' +
      t('Unfreeze membership?', 'فك تجميد الاشتراك؟') +
      '</div>' +
      '<div style="font-size:13px;color:var(--ltt);margin-bottom:20px">' +
      t('Membership returns to active.', 'سيعود الاشتراك للحالة النشطة.') +
      '</div>' +
      '<div id="uErr" class="err"></div>' +
      '<div style="display:flex;gap:8px;justify-content:center"><button class="btn btn-outline" onclick="closeModal()">' +
      t('Cancel', 'إلغاء') +
      '</button><button class="btn btn-primary" id="uBtn" onclick="doUnfreeze(\'' +
      id +
      '\')"><i class="ti ti-sun"></i>' +
      t('Unfreeze', 'فك التجميد') +
      '</button></div></div>',
    360
  );
}
async function doUnfreeze(id) {
  const btn = document.getElementById('uBtn'),
    orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  const res = await apiPost('/members/' + id + '/unfreeze');
  if (res.ok) {
    closeModal();
    toast(t('Unfrozen', 'تم فك التجميد'));
    refreshAfter(id);
  } else modalErr(res, document.getElementById('uErr'), btn, orig);
}

// ── Renew Modal — transitionMode: cancel_and_switch | queue_next | manual_rollover ──
let _rPlans = [],
  _rPay = 'cash',
  _rPlanId = null,
  _rTransition = 'cancel_and_switch',
  _rRollover = false;

function membershipCoversToday(ms) {
  if (!ms) return false;
  const st = String(ms.status || '').toLowerCase();
  if (st !== 'active' && st !== 'frozen') return false;
  return daysUntil(ms.endDate) >= 0;
}

function parseIsoDateOnly(d) {
  if (!d) return null;
  const s = String(d).slice(0, 10);
  const p = s.split('-');
  if (p.length !== 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function addDaysDate(date, days) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function fmtLocalDate(date) {
  return new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(date);
}

function resolveRenewDurationDays() {
  if (window._rMode === 'diff' && _rPlanId) {
    const p = _rPlans.find(function (x) {
      return x.id === _rPlanId;
    });
    if (p && p.durationDays != null) return Number(p.durationDays) || 0;
  }
  if (selMs?.planId) {
    const same = _rPlans.find(function (x) {
      return x.id === selMs.planId;
    });
    if (same && same.durationDays != null) return Number(same.durationDays) || 0;
  }
  const s = parseIsoDateOnly(selMs?.startDate);
  const e = parseIsoDateOnly(selMs?.endDate);
  if (s && e) {
    const days = Math.round((e - s) / 86400000);
    if (days > 0) return days;
  }
  return 30;
}

function getRenewTransitionMode() {
  if (!membershipCoversToday(selMs)) return 'cancel_and_switch';
  if (_rRollover) return 'manual_rollover';
  return _rTransition === 'queue_next' ? 'queue_next' : 'cancel_and_switch';
}

function updateRenewTransitionPreview() {
  const banner = document.getElementById('rModeBanner');
  const preview = document.getElementById('rPreview');
  if (!banner || !preview) return;

  if (!membershipCoversToday(selMs)) {
    banner.innerHTML =
      '<i class="ti ti-calendar"></i>' +
      t(
        'No covering membership — new plan starts today for a full duration.',
        'لا يوجد اشتراك ساري — الخطة الجديدة تبدأ اليوم لمدة كاملة.'
      );
    preview.textContent = '';
    return;
  }

  const mode = getRenewTransitionMode();
  const duration = resolveRenewDurationDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const priorEnd = parseIsoDateOnly(selMs.endDate) || today;
  let start = today;
  let end = addDaysDate(today, duration);
  let copyEn = '';
  let copyAr = '';

  if (mode === 'queue_next') {
    start = addDaysDate(priorEnd, 1);
    end = addDaysDate(start, duration);
    copyEn = 'Queue next plan — current stays active until it ends; new plan starts after.';
    copyAr = 'طابور الخطة التالية — الحالي يبقى نشطاً حتى نهايته؛ الجديدة تبدأ بعده.';
  } else if (mode === 'manual_rollover') {
    end = addDaysDate(priorEnd, duration);
    copyEn = 'Add remaining days onto the new plan (legacy rollover).';
    copyAr = 'أضف الأيام المتبقية إلى الخطة الجديدة (الترحيل القديم).';
  } else {
    copyEn = 'Cancel & switch — current ends today; new plan starts today.';
    copyAr = 'إلغاء والتبديل — الحالي ينتهي اليوم؛ الجديدة تبدأ اليوم.';
  }

  banner.innerHTML = '<i class="ti ti-info-circle"></i>' + t(copyEn, copyAr);
  preview.textContent = t(
    'Estimated: ' + fmtLocalDate(start) + ' → ' + fmtLocalDate(end) + ' (server confirms).',
    'تقديري: ' + fmtLocalDate(start) + ' → ' + fmtLocalDate(end) + ' (الخادم يعتمد).'
  );
}

function setRTransition(mode, el) {
  _rRollover = false;
  _rTransition = mode;
  const wrap = document.getElementById('rTransitionPills');
  if (wrap) {
    wrap.querySelectorAll('.rpill').forEach(function (b) {
      b.classList.remove('act');
    });
  }
  if (el) el.classList.add('act');
  const cb = document.getElementById('rRollover');
  if (cb) cb.checked = false;
  updateRenewTransitionPreview();
}

function setRRollover(checked) {
  _rRollover = !!checked;
  const wrap = document.getElementById('rTransitionPills');
  if (wrap) {
    wrap.querySelectorAll('.rpill').forEach(function (b) {
      if (_rRollover) b.classList.remove('act');
      else b.classList.toggle('act', b.getAttribute('data-mode') === _rTransition);
    });
  }
  updateRenewTransitionPreview();
}

function openRenewModal(id) {
  if (!canManageMemberships()) {
    toast(t('Manager or above required', 'يتطلب مدير أو أعلى'), 'error');
    return;
  }
  const m =
    state.members.find(function (x) {
      return x.id === id;
    }) ||
    selMember ||
    {};
  _rPay = 'cash';
  _rPlanId = null;
  _rTransition = 'cancel_and_switch';
  _rRollover = false;
  window._rMode = 'same';
  const covering = membershipCoversToday(selMs);
  const transitionBlock = covering
    ? '<div class="fg"><label>' +
      t('When current plan still covers today', 'عند سريان الخطة الحالية اليوم') +
      '</label><div class="rpills" id="rTransitionPills" style="margin-bottom:8px">' +
      '<button type="button" class="rpill act" data-mode="cancel_and_switch" onclick="setRTransition(\'cancel_and_switch\',this)">' +
      t('Cancel & switch (starts today)', 'إلغاء والتبديل (تبدأ اليوم)') +
      '</button><button type="button" class="rpill" data-mode="queue_next" onclick="setRTransition(\'queue_next\',this)">' +
      t('Queue next plan (after current ends)', 'طابور الخطة التالية (بعد انتهاء الحالي)') +
      '</button></div>' +
      '<details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:12px;color:var(--ltt)">' +
      t('Advanced', 'متقدم') +
      '</summary><label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:8px">' +
      '<input type="checkbox" id="rRollover" onchange="setRRollover(this.checked)">' +
      '<span>' +
      t(
        'Add remaining days onto new plan (manual rollover)',
        'أضف الأيام المتبقية إلى الخطة الجديدة (ترحيل يدوي)'
      ) +
      '</span></label></details></div>'
    : '';

  showModal(
    '<div class="modal-hdr"><h3><i class="ti ti-refresh"></i>' +
      t('Renew Membership', 'تجديد الاشتراك') +
      '</h3><button class="modal-close" onclick="closeModal()">×</button></div>' +
      '<div class="modal-body"><div class="modal-member">' +
      avatar(m.fullName || '', 28) +
      '<div><div class="m-name">' +
      (m.fullName || '') +
      '</div><div style="font-size:11px;color:var(--ltt)">' +
      (selMs?.planName || m.activePlan || '') +
      '</div></div></div>' +
      '<div class="info-banner" id="rModeBanner" style="background:var(--inf100);color:var(--inf500)"></div>' +
      '<div id="rPreview" class="hint" style="margin-bottom:10px"></div>' +
      transitionBlock +
      '<div class="fg"><label>' +
      t('Plan', 'الخطة') +
      '</label><div class="rpills" style="margin-bottom:8px"><button type="button" class="rpill act" onclick="setRMode(\'same\',this)">' +
      t('Same plan', 'نفس الخطة') +
      '</button><button type="button" class="rpill" onclick="setRMode(\'diff\',this)">' +
      t('Different', 'أخرى') +
      '</button></div><div id="rPlanSel" style="display:none"></div></div>' +
      '<div class="fg"><label>' +
      t('Amount (EGP)', 'المبلغ') +
      '</label><input type="number" id="rAmt" min="0" step="0.01" value="' +
      (selMs?.amountPaid || 0) +
      '"></div>' +
      '<div class="fg"><label>' +
      t('Payment', 'الدفع') +
      '</label><div class="rpills" id="rPayPills">' +
      RENEW_PAY_METHODS.map(function (pm, i) {
        const labels = { cash: 'Cash', paymob: 'Paymob', fawry: 'Fawry', vodafone_cash: 'Vodafone' };
        return (
          '<button type="button" class="rpill' +
          (i === 0 ? ' act' : '') +
          '" onclick="setRPay(this,\'' +
          pm +
          '\')">' +
          labels[pm] +
          '</button>'
        );
      }).join('') +
      '</div><div id="rPayNote" class="hint" style="margin-top:8px"></div></div>' +
      '<div id="rErr" class="err"></div></div>' +
      '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">' +
      t('Cancel', 'إلغاء') +
      '</button><button class="btn btn-primary" id="rBtn" onclick="doRenew(\'' +
      id +
      '\')"><i class="ti ti-refresh"></i>' +
      t('Renew', 'تجديد') +
      '</button></div>',
    520
  );
  updateRPayNote();
  updateRenewTransitionPreview();
  loadRPlans();
}
async function loadRPlans() {
  try {
    _rPlans = ((await apiGet('/membership-plans')) || []).filter(function (p) {
      return p && p.isActive !== false;
    });
    const s = document.getElementById('rPlanSel');
    if (s)
      s.innerHTML =
        '<select id="rPlanDD" onchange="onRPlanChange(this)"><option value="">' +
        t('Select', 'اختر') +
        '</option>' +
        _rPlans
          .map(function (p) {
            return (
              '<option value="' +
              p.id +
              '">' +
              p.name +
              ' — EGP ' +
              (p.price || 0) +
              ' / ' +
              (p.durationDays || 0) +
              'd</option>'
            );
          })
          .join('') +
        '</select>';
    updateRenewTransitionPreview();
  } catch (e) {
    const s = document.getElementById('rPlanSel');
    if (s)
      s.innerHTML =
        '<div class="err">' +
        t(
          'Cannot load plans (needs plans.manage). Renew same plan without picking another.',
          'تعذّر تحميل الخطط (يتطلب plans.manage). جدّد نفس الخطة دون اختيار أخرى.'
        ) +
        '</div>';
  }
}
function setRMode(mode, el) {
  el.parentElement.querySelectorAll('.rpill').forEach(function (b) {
    b.classList.remove('act');
  });
  el.classList.add('act');
  document.getElementById('rPlanSel').style.display = mode === 'diff' ? 'block' : 'none';
  window._rMode = mode;
  updateRenewTransitionPreview();
}
function onRPlanChange(sel) {
  const p = _rPlans.find(function (x) {
    return x.id === sel.value;
  });
  if (p) {
    document.getElementById('rAmt').value = p.price || 0;
    _rPlanId = p.id;
  }
  updateRenewTransitionPreview();
}
function setRPay(el, m) {
  el.parentElement.querySelectorAll('.rpill').forEach(function (b) {
    b.classList.remove('act');
  });
  el.classList.add('act');
  _rPay = m;
  updateRPayNote();
}
function updateRPayNote() {
  const n = document.getElementById('rPayNote');
  if (!n) return;
  if (_rPay === 'cash') {
    n.textContent = t(
      'Cash activates immediately and posts to your open shift. Open a shift first.',
      'النقد يفعّل فوراً ويُسجَّل في ورديتك المفتوحة. افتح وردية أولاً.'
    );
  } else {
    n.textContent = t(
      'Gateway: membership will be pending until payment webhook — refresh status after paying (no live push).',
      'البوابة: الاشتراك معلّق حتى ويبهوك الدفع — حدّث الحالة بعد الدفع (لا إشعار فوري).'
    );
  }
}
async function doRenew(id) {
  const btn = document.getElementById('rBtn'),
    orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  const body = {
    planId: window._rMode === 'diff' ? _rPlanId : null,
    paymentMethod: _rPay,
    amountPaid: parseFloat(document.getElementById('rAmt').value) || 0,
    transitionMode: getRenewTransitionMode()
  };
  if (window._rMode === 'diff' && !_rPlanId) {
    document.getElementById('rErr').textContent = t('Select a plan', 'اختر خطة');
    btn.disabled = false;
    btn.innerHTML = orig;
    return;
  }
  if (_rPay === 'cash' && body.amountPaid > 0) {
    try {
      const sh = await apiGet('/shifts/current');
      if (!sh || !sh.id) {
        document.getElementById('rErr').textContent = t(
          'Open a shift before accepting cash renewal.',
          'افتح وردية قبل قبول تجديد نقدي.'
        );
        btn.disabled = false;
        btn.innerHTML = orig;
        return;
      }
    } catch (e) {
      document.getElementById('rErr').textContent = t(
        'Open a shift before accepting cash renewal.',
        'افتح وردية قبل قبول تجديد نقدي.'
      );
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }
  }
  const res = await apiPost('/memberships/' + id + '/renew', body);
  if (res.ok) {
    closeModal();
    const ms = res.data;
    if (ms && (ms.status || '').toLowerCase() === 'pending') {
      toast(
        t('Renewed — waiting for payment. Use Refresh status.', 'تم التجديد — بانتظار الدفع. استخدم تحديث الحالة.'),
        'success'
      );
      refreshAfter(id, ms);
    } else {
      toast(t('Renewed', 'تم التجديد'));
      refreshAfter(id, ms);
    }
  } else modalErr(res, document.getElementById('rErr'), btn, orig);
}

// ── Assign Modal — cash|paymob|fawry only; 409 if already active ──
let _aPlanId = null,
  _aPay = 'cash';
function openAssignModal(id) {
  if (!canManageMemberships()) {
    toast(t('Manager or above required', 'يتطلب مدير أو أعلى'), 'error');
    return;
  }
  const st = (selMs?.status || '').toLowerCase();
  if (st === 'active' || st === 'scheduled' || st === 'frozen' || st === 'pending') {
    toast(
      t(
        'Already has a ' + st + ' membership — use Renew, not Assign.',
        'لديه اشتراك ' + st + ' — استخدم التجديد وليس التعيين.'
      ),
      'error'
    );
    return;
  }
  const m =
    state.members.find(function (x) {
      return x.id === id;
    }) ||
    selMember ||
    {};
  _aPlanId = null;
  _aPay = 'cash';
  showModal(
    '<div class="modal-hdr"><h3><i class="ti ti-plus"></i>' +
      t('Assign Membership', 'تعيين اشتراك') +
      '</h3><button class="modal-close" onclick="closeModal()">×</button></div>' +
      '<div class="modal-body"><div class="modal-member">' +
      avatar(m.fullName || '', 28) +
      '<div class="m-name">' +
      (m.fullName || '') +
      '</div></div>' +
      '<div id="aPlanCards" class="plan-cards">' +
      skeleton(2) +
      '</div>' +
      '<div class="fg"><label>' +
      t('Payment', 'الدفع') +
      '</label><div class="rpills">' +
      ASSIGN_PAY_METHODS.map(function (pm, i) {
        const labels = { cash: 'Cash', paymob: 'Paymob', fawry: 'Fawry' };
        return (
          '<button type="button" class="rpill' +
          (i === 0 ? ' act' : '') +
          '" onclick="setAPay(this,\'' +
          pm +
          '\')">' +
          labels[pm] +
          '</button>'
        );
      }).join('') +
      '</div><div id="aPayNote" class="hint" style="margin-top:8px"></div></div>' +
      '<div id="aErr" class="err"></div></div>' +
      '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">' +
      t('Cancel', 'إلغاء') +
      '</button><button class="btn btn-primary" id="aBtn" onclick="doAssign(\'' +
      id +
      '\')" disabled><i class="ti ti-plus"></i>' +
      t('Assign', 'تعيين') +
      '</button></div>',
    500
  );
  updateAPayNote();
  loadAPlans();
}
async function loadAPlans() {
  try {
    const plans = ((await apiGet('/membership-plans')) || []).filter(function (p) {
      return p && p.isActive !== false;
    });
    const el = document.getElementById('aPlanCards');
    if (!el) return;
    if (!plans.length) {
      el.innerHTML =
        '<div class="err">' + t('No active plans', 'لا توجد خطط نشطة') + '</div>';
      return;
    }
    el.innerHTML = plans
      .map(function (p) {
        return (
          '<div class="plan-card" onclick="selAPlan(this,\'' +
          p.id +
          '\')"><div class="plan-card-top"><div>' +
          planBadge(p.planType || '') +
          ' <span style="font-size:13px;font-weight:600;margin-left:4px">' +
          (p.name || '') +
          '</span></div><div class="plan-card-price">EGP ' +
          (p.price || 0).toLocaleString() +
          '</div></div><div class="plan-card-dur">' +
          (p.durationDays || 0) +
          ' ' +
          t('days', 'يوم') +
          (p.sessionCount ? ' · ' + p.sessionCount + ' ' + t('sessions', 'جلسة') : '') +
          '</div></div>'
        );
      })
      .join('');
  } catch (e) {
    const el = document.getElementById('aPlanCards');
    if (el)
      el.innerHTML =
        '<div class="err">' +
        t(
          'Cannot load plans — reading plans requires plans.manage (no read-only API).',
          'تعذّر تحميل الخطط — القراءة تتطلب plans.manage (لا يوجد API للقراءة فقط).'
        ) +
        '</div>';
  }
}
function selAPlan(el, id) {
  document.querySelectorAll('#aPlanCards .plan-card').forEach(function (c) {
    c.classList.remove('sel');
  });
  el.classList.add('sel');
  _aPlanId = id;
  document.getElementById('aBtn').disabled = false;
}
function setAPay(el, m) {
  el.parentElement.querySelectorAll('.rpill').forEach(function (b) {
    b.classList.remove('act');
  });
  el.classList.add('act');
  _aPay = m;
  updateAPayNote();
}
function updateAPayNote() {
  const n = document.getElementById('aPayNote');
  if (!n) return;
  if (_aPay === 'cash') {
    n.textContent = t('Cash activates immediately.', 'النقد يفعّل فوراً.');
  } else {
    n.textContent = t(
      'Gateway: creates a pending membership — refresh after payment (no live push).',
      'البوابة: ينشئ اشتراكاً معلقاً — حدّث بعد الدفع (لا إشعار فوري).'
    );
  }
}
async function doAssign(id) {
  if (!_aPlanId) return;
  const btn = document.getElementById('aBtn'),
    orig = btn.innerHTML,
    errEl = document.getElementById('aErr');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  const res = await apiPost('/memberships/' + id + '/assign', {
    planId: _aPlanId,
    paymentMethod: _aPay
  });
  if (res.ok || res.status === 201) {
    closeModal();
    const ms = res.data;
    if (ms && (ms.status || '').toLowerCase() === 'pending') {
      toast(
        t(
          'Assigned — waiting for payment. Use Refresh status on the panel.',
          'تم التعيين — بانتظار الدفع. استخدم تحديث الحالة في اللوحة.'
        ),
        'success'
      );
      refreshAfter(id, ms);
    } else {
      toast(t('Assigned & activated', 'تم التعيين والتفعيل'));
      refreshAfter(id, ms);
      printMemberAccessCard(id, true);
    }
    return;
  }
  // Distinct 409: already has active membership
  if (res.status === 409) {
    const msg =
      (res.data && (res.data.message || res.data.error)) ||
      t(
        'Already has an active membership — cannot assign another.',
        'لديه اشتراك نشط بالفعل — لا يمكن تعيين آخر.'
      );
    if (errEl) {
      errEl.innerHTML =
        '<strong>' +
        t('Active membership conflict', 'تعارض اشتراك نشط') +
        '</strong><br>' +
        msg;
    }
    toast(t('Blocked: active membership exists', 'مرفوض: يوجد اشتراك نشط'), 'error');
    btn.disabled = false;
    btn.innerHTML = orig;
    return;
  }
  modalErr(res, errEl, btn, orig);
}

// ── Init ──
fetchKPIs();
fetchMembers();
