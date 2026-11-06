(function () {
  'use strict';
  // Trials removed from HyMotion product IA
  window.location.replace('/dashboard/');
  return;
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';

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
  const canSell = perms.has('sales.sell') || /Owner|Manager|Receptionist/i.test(role);

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function problemMessage(data, status) {
    if (!data) return 'Request failed (' + status + ')';
    const title = data.title || '';
    const detail = data.detail || data.message || '';
    const map = {
      TRIAL_ALREADY_USED: 'This phone already used a free trial.',
      PLAN_NOT_FOUND: 'Plan not found.',
      PLAN_NOT_TRIAL: 'Selected plan is not a trial plan.',
      OTP_INVALID: 'Invalid or expired OTP.',
      PENDING_TRIAL_NOT_FOUND: 'No pending trial for this phone — initiate again.',
      FEATURE_DISABLED: 'Trials feature is disabled for this tenant.',
      STAFF_USER_NOT_FOUND: 'Staff user not found.',
    };
    if (map[title]) return map[title];
    return detail || title || 'Request failed (' + status + ')';
  }

  async function api(method, path, body) {
    const opts = { method, headers: getH() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function unlockConfirm(phone) {
    const card = document.getElementById('stepConfirm');
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
    document.getElementById('confirmPhone').value = phone;
    document.getElementById('otpHint').textContent = 'OTP sent to ' + phone + '. Enter code to create the trial member.';
  }

  function seedProfile(payload) {
    const member = payload.member || {};
    const ms = payload.membership || {};
    sessionStorage.setItem(
      'gfp_trial_seed',
      JSON.stringify({ member: member, membership: ms, at: Date.now() }),
    );

    const card = document.getElementById('seedCard');
    card.style.display = 'block';
    document.getElementById('openProfile').href =
      '/dashboard/members/' + encodeURIComponent(member.id || '') + '/';

    document.getElementById('seedBody').innerHTML =
      '<div class="seed-grid">' +
      '<div>' +
      '<div class="row"><span>Name</span><strong>' +
      esc(member.fullName) +
      '</strong></div>' +
      '<div class="row"><span>Name AR</span><span dir="rtl">' +
      esc(member.fullNameAr || '—') +
      '</span></div>' +
      '<div class="row"><span>Phone</span><span dir="ltr">' +
      esc(member.phone) +
      '</span></div>' +
      '<div class="row"><span>Member #</span><code>' +
      esc(member.memberNumber) +
      '</code></div>' +
      '<div class="row"><span>Member id</span><code>' +
      esc(member.id) +
      '</code></div>' +
      '</div><div>' +
      '<div class="row"><span>Plan</span><strong>' +
      esc(ms.planName || '—') +
      '</strong></div>' +
      '<div class="row"><span>Type</span><span>' +
      esc(ms.planType || '—') +
      '</span></div>' +
      '<div class="row"><span>Status</span><span class="ms-chip">' +
      esc(ms.status || '—') +
      '</span></div>' +
      '<div class="row"><span>Dates</span><span>' +
      esc(ms.startDate || '—') +
      ' → ' +
      esc(ms.endDate || '—') +
      '</span></div>' +
      '<div class="row"><span>Sessions left</span><span>' +
      esc(ms.sessionsRemaining != null ? String(ms.sessionsRemaining) : '—') +
      '</span></div>' +
      '</div></div>';
  }

  async function loadTrialPlans() {
    const sel = document.getElementById('planId');
    if (!canSell) {
      sel.innerHTML = '<option value="">Need sales.sell</option>';
      return;
    }
    const res = await api('GET', '/membership-plans');
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      sel.innerHTML = '<option value="">Could not load plans</option>';
      return;
    }
    const items = Array.isArray(res.data) ? res.data : res.data.items || [];
    const trials = items.filter((p) => String(p.planType || '').toLowerCase() === 'trial');
    if (!trials.length) {
      sel.innerHTML = '<option value="">No trial plans — create one under Plans</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">Select trial plan</option>' +
      trials
        .map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name || p.nameEn || p.id) + '</option>')
        .join('');
  }

  document.getElementById('initForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSell) {
      toast('Need sales.sell', 'err');
      return;
    }
    const body = {
      fullName: document.getElementById('fullName').value.trim(),
      fullNameAr: document.getElementById('fullNameAr').value.trim() || null,
      phoneNumber: document.getElementById('phone').value.trim(),
      planId: document.getElementById('planId').value,
    };
    const res = await api('POST', '/trials/initiate', body);
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    const d = res.data || {};
    unlockConfirm(body.phoneNumber);
    toast(
      d.otpSent
        ? 'OTP sent (expires in ' + (d.expiresInSeconds || '?') + 's).'
        : 'Initiate OK.',
      'ok',
    );
  });

  document.getElementById('confirmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      phoneNumber: document.getElementById('confirmPhone').value.trim(),
      otp: document.getElementById('otp').value.trim(),
    };
    const res = await api('POST', '/trials/confirm', body);
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    toast('Trial confirmed — profile seeded from response.', 'ok');
    seedProfile(res.data || {});
    document.getElementById('otp').value = '';
  });

  loadTrialPlans();
})();
