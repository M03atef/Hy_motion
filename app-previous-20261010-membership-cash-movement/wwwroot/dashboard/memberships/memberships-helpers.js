// ── Shared helpers for memberships page (§4) ──
let lang = 'en';
function t(en, ar) {
  return lang === 'ar' ? ar : en;
}
function formatDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium' }).format(new Date(d));
}
function daysUntil(d) {
  if (!d) return 0;
  const end = new Date(d);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}
function totalDays(s, e) {
  return Math.ceil((new Date(e) - new Date(s)) / 86400000);
}
const ACOL = ['#7ACC00', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#0D9488'];
function avatar(name, sz) {
  sz = sz || 32;
  const p = (name || '?').split(' ').filter(Boolean);
  const i = (p[0]?.[0] || '') + (p[1]?.[0] || '');
  const bg = ACOL[(name || '').charCodeAt(0) % 7];
  return (
    '<div class="av" style="width:' +
    sz +
    'px;height:' +
    sz +
    'px;font-size:' +
    Math.round(sz * 0.35) +
    'px;background:' +
    bg +
    '">' +
    i.toUpperCase() +
    '</div>'
  );
}
function statusBadge(s) {
  const m = {
    active: ['b-active', 'Active', 'نشط'],
    scheduled: ['b-pending', 'Starts soon', 'يبدأ قريباً'],
    frozen: ['b-frozen', 'Frozen', 'مجمد'],
    expired: ['b-expired', 'Expired', 'منتهي'],
    pending: ['b-pending', 'Pending', 'معلق'],
    cancelled: ['b-cancelled', 'Cancelled', 'ملغي']
  };
  const v = m[(s || '').toLowerCase()] || m.expired;
  return '<span class="badge ' + v[0] + '">' + t(v[1], v[2]) + '</span>';
}
function planBadge(pt) {
  const m = {
    monthly_unlimited: ['b-monthly', 'ti-calendar', 'Monthly'],
    session_pack: ['b-sessions', 'ti-bolt', 'Sessions'],
    time_limited: ['b-time', 'ti-clock', 'Time'],
    pt_credits: ['b-pt', 'ti-barbell', 'PT'],
    family: ['b-family', 'ti-users', 'Family'],
    trial: ['b-monthly', 'ti-flask', 'Trial'],
    day_pass: ['b-sessions', 'ti-sun', 'Day']
  };
  const v = m[pt];
  if (!v) return '';
  return '<span class="badge ' + v[0] + '"><i class="ti ' + v[1] + '"></i>' + v[2] + '</span>';
}
function payChip(m) {
  const map = {
    cash: ['pay-cash', 'ti-cash', 'Cash'],
    paymob: ['pay-card', 'ti-credit-card', 'Paymob'],
    fawry: ['pay-fawry', 'ti-device-mobile', 'Fawry'],
    vodafone_cash: ['pay-voda', 'ti-phone', 'Vodafone']
  };
  const v = map[(m || '').toLowerCase()] || map.cash;
  return '<span class="pay-chip ' + v[0] + '"><i class="ti ' + v[1] + '"></i>' + v[2] + '</span>';
}
function daysChip(d) {
  if (d <= 0) return '<span class="dl red">' + t('Expired', 'منتهي') + '</span>';
  if (d <= 7) return '<span class="dl red">' + d + 'd</span>';
  if (d <= 14) return '<span class="dl amber">' + d + 'd</span>';
  return '<span class="dl green">' + d + 'd</span>';
}
function toast(msg, type) {
  return globalThis.toastShared(msg, type);
}
function skeleton(n) {
  let h = '';
  for (let i = 0; i < (n || 3); i++)
    h +=
      '<div class="sk" style="height:14px;margin-bottom:8px;width:' +
      (60 + Math.random() * 30) +
      '%"></div>';
  return h;
}

/** Dual-shape / GfpApi error text */
function apiErrMsg(r) {
  if (!r) return t('Request failed', 'فشل الطلب');
  if (r.error && r.error.message) return r.error.message;
  if (r.data) return r.data.message || r.data.error || t('Request failed', 'فشل الطلب');
  return t('Request failed', 'فشل الطلب');
}

/**
 * Thin GfpApi wrappers kept for page-local call sites.
 * GET returns data or null; mutating helpers return { ok, status, data, error }.
 */
async function apiGet(path) {
  const Gfp = window.GfpApi;
  if (!Gfp) throw { status: 0, data: { message: 'GfpApi missing' } };
  const r = await Gfp.get(path);
  if (r.status === 401) {
    Gfp.logout();
    return null;
  }
  if (!r.ok) throw { status: r.status, data: r.data || {}, error: r.error };
  if (r.status === 204) return null;
  return r.data;
}

async function apiPost(path, body) {
  const Gfp = window.GfpApi;
  if (!Gfp) return { ok: false, status: 0, data: { message: 'GfpApi missing' } };
  const r = await Gfp.post(path, body);
  if (r.status === 401) {
    Gfp.logout();
    return { ok: false, status: 401, data: null };
  }
  return { ok: r.ok, status: r.status, data: r.data, error: r.error };
}

/** GET text/html (access card). */
async function apiHtml(path) {
  const Gfp = window.GfpApi;
  const base = (window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
  const token =
    localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  const url = base + (path.charAt(0) === '/' ? path : '/' + path);
  const res = await fetch(url, { method: 'GET', headers: headers });
  if (res.status === 401 && Gfp) {
    Gfp.logout();
    return { ok: false, status: 401, text: '' };
  }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text: text };
}

function closeAccessCardPrint() {
  const ov = document.getElementById('accessCardPrintOverlay');
  if (ov) ov.hidden = true;
  const frame = document.getElementById('accessCardPrintFrame');
  if (frame) frame.srcdoc = '';
}

async function printMemberAccessCard(memberId, autoPrint) {
  const overlay = document.getElementById('accessCardPrintOverlay');
  const frame = document.getElementById('accessCardPrintFrame');
  const title = document.getElementById('accessCardPrintTitle');
  if (!overlay || !frame || !memberId) {
    toast(t('Print view not available.', 'شاشة الطباعة مش متاحة.'), 'error');
    return;
  }
  if (title) title.textContent = t('Member card', 'كارنيه العضو');
  overlay.hidden = false;
  frame.srcdoc =
    '<p style="padding:16px;font-family:sans-serif;color:#666">' +
    t('Loading card…', 'جاري تحميل الكارنيه…') +
    '</p>';
  const res = await apiHtml('/members/' + encodeURIComponent(memberId) + '/access-card-html');
  if (!res.ok) {
    var detail = t('Could not load member card.', 'مش قدرنا نحمّل كارنيه العضو.');
    if (res.status === 404) {
      detail = t(
        'Card endpoint missing (404). Restart the API after Access Cards deploy.',
        'مسار الكارنيه مش موجود (404). أعد تشغيل الـ API بعد نشر Access Cards.'
      );
    } else if (res.status === 403) {
      detail = t(
        'No permission to print cards (need members.view).',
        'مفيش صلاحية طباعة الكارنيه (لازم members.view).'
      );
    } else if (res.status) {
      detail = detail + ' (HTTP ' + res.status + ')';
    }
    toast(detail, 'error');
    frame.srcdoc =
      '<p style="padding:16px;font-family:sans-serif;color:#991b1b">' +
      detail +
      '</p>';
    return;
  }
  frame.srcdoc = res.text || '';
  if (autoPrint) {
    // Wait for iframe layout so barcode bars paint before Chromium print snapshot.
    setTimeout(function () {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        toast(t('Allow pop-ups / try Print again.', 'اسمح بالنوافذ أو اضغط طباعة تاني.'), 'error');
      }
    }, 450);
  }
}

function asPaged(data) {
  if (window.GfpApi && window.GfpApi.asPaged) return window.GfpApi.asPaged(data);
  if (!data) return { items: [], totalCount: 0, page: 1, pageSize: 20, hasNext: false };
  if (Array.isArray(data)) return { items: data, totalCount: data.length, page: 1, pageSize: data.length, hasNext: false };
  return {
    items: data.items || data.Items || [],
    totalCount: data.totalCount || data.TotalCount || 0,
    page: data.page || data.Page || 1,
    pageSize: data.pageSize || data.PageSize || 20,
    hasNext: !!(data.hasNext || data.HasNext)
  };
}

function canManageMemberships() {
  const Authz = window.GfpAuthz;
  if (Authz && Authz.useCanRole) return Authz.useCanRole('ManagerOrAbove');
  const u = (window.GfpApi && window.GfpApi.tokens && window.GfpApi.tokens.getUser()) || null;
  const role = ((u && u.role) || '').toLowerCase();
  return role === 'owner' || role === 'manager';
}

/** Freeze/unfreeze is permission-gated — not ManagerOrAbove alone. */
function canFreezeMemberships() {
  const Authz = window.GfpAuthz;
  if (Authz && Authz.useCan) return Authz.useCan('memberships.freeze');
  return false;
}

/** Assign payment methods (no vodafone_cash). Renew adds vodafone_cash. */
let ASSIGN_PAY_METHODS = ['cash', 'paymob', 'fawry'];
let RENEW_PAY_METHODS = ['cash', 'paymob', 'fawry', 'vodafone_cash'];
// Local Edition has no online payment gateways — drop them from both lists (renew/assign modals
// in memberships-detail.js read these at render time, well after this resolves).
if (window.GfpDeployment) {
  window.GfpDeployment.getEdition().then(function (edition) {
    if (edition === 'Local') {
      ASSIGN_PAY_METHODS = window.GfpDeployment.filterOnlineGatewayCodes(ASSIGN_PAY_METHODS);
      RENEW_PAY_METHODS = window.GfpDeployment.filterOnlineGatewayCodes(RENEW_PAY_METHODS);
    }
  });
}
