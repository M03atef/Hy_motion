/**
 * HR Phase 6 — Dashboard. Every tile is a real query result from GET /hr/dashboard; no placeholders.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var I18n = window.GfpI18n;

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

  var canView = Authz && Authz.useCan('hr.view');
  if (!canView) {
    document.getElementById('ownerGuard').hidden = false;
    document.getElementById('ownerGuard').classList.add('is-on');
    document.getElementById('pageContent').hidden = true;
    return;
  }

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(n));
  }
  function applyLocale() {
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    var e = (r && r.error) || {};
    return e.message || t('Request failed', 'فشل الطلب');
  }

  (function chrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) { return w[0]; })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    document.getElementById('userAvatar').textContent = ini;
    document.getElementById('userName').textContent = user.fullName || 'User';
    document.getElementById('userRole').textContent = user.role || 'Staff';
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (Gfp) Gfp.logout();
      else window.location.href = '/auth/login/';
    });
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  function tile(labelEn, labelAr, value, opts) {
    opts = opts || {};
    var tag = opts.href ? 'a' : 'div';
    var cls = 'kpi-tile' + (opts.href ? ' clickable' : '');
    var valueCls = 'kpi-value' + (opts.warn ? ' warn' : '');
    var html = '<' + tag + (opts.href ? ' href="' + esc(opts.href) + '"' : '') + ' class="' + cls + '">' +
      '<span class="kpi-label" data-en="' + esc(labelEn) + '" data-ar="' + esc(labelAr) + '">' + esc(t(labelEn, labelAr)) + '</span>' +
      '<span class="' + valueCls + '">' + esc(value) + '</span>' +
      (opts.sub ? '<span class="kpi-sub">' + esc(opts.sub) + '</span>' : '') +
      '</' + tag + '>';
    return html;
  }

  document.getElementById('btnRefresh').addEventListener('click', load);

  async function load() {
    var host = document.getElementById('tileHost');
    host.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    var r = await Gfp.get('/hr/dashboard');
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var d = r.data;
    var html = '';
    html += tile('Employees', 'الموظفون', d.employeeCount);
    html += tile('Present Today', 'حاضر اليوم', d.presentToday, { href: '/dashboard/hr/attendance/?status=Present' });
    html += tile('Late Today', 'متأخر اليوم', d.lateToday, { warn: d.lateToday > 0, href: '/dashboard/hr/attendance/?status=Late' });
    html += tile('Absent Today', 'غائب اليوم', d.absentToday, { warn: d.absentToday > 0, href: '/dashboard/hr/attendance/?status=Absent' });
    html += tile('On Leave', 'في إجازة', d.onLeaveToday, { href: '/dashboard/hr/leaves/?status=Approved' });
    html += tile('Overtime Today', 'وقت إضافي اليوم', Math.round(d.overtimeMinutesToday / 6) / 10 + ' h');
    if (d.payrollNetThisMonth != null) {
      html += tile('Payroll This Month', 'رواتب هذا الشهر', money(d.payrollNetThisMonth), { sub: d.payrollStatusThisMonth, href: '/dashboard/hr/payroll/' });
    }
    html += tile('Pending Leave Requests', 'طلبات إجازة معلقة', d.pendingLeaveRequests, { warn: d.pendingLeaveRequests > 0, href: '/dashboard/hr/leaves/?status=Pending' });
    html += tile('Upcoming Contract Expirations', 'عقود قاربت على الانتهاء', d.upcomingContractExpirations, { warn: d.upcomingContractExpirations > 0, href: '/dashboard/hr/employees/' });
    html += tile('Expiring Documents', 'مستندات قاربت على الانتهاء', d.expiringDocuments, { warn: d.expiringDocuments > 0, href: '/dashboard/hr/documents/?expiryStatus=ExpiringSoon' });
    html += tile('Expired Documents', 'مستندات منتهية', d.expiredDocuments, { warn: d.expiredDocuments > 0, href: '/dashboard/hr/documents/?expiryStatus=Expired' });

    host.innerHTML = html;
    applyLocale();
  }

  load();
})();
