/**
 * Dashboard Overview — operational control center.
 *
 * Hierarchy: Executive financial overview (Owner) → Today → Quick Actions → Business → Operations → Needs attention.
 * Real APIs only. Per-widget permission gates.
 *
 * Primary data source:
 *   GET /dashboard/overview?period=... — one Cairo-day, role-filtered contract.
 * Secondary sources remain limited to inventory/order widgets below the fold.
 *   GET /inventory/reports/summary   inventory.view
 *   GET/PUT /settings/quick-actions  AnyStaff read / ManagerOrAbove write (tenant shortcut keys)
 */
(function (global) {
  'use strict';

  var CACHE_TTL_MS = 45000;
  var CACHE_PREFIX = 'gfp_dash_v2:';

  var state = {
    dashboardOverview: null,
    membersStatus: null,
    checkinsToday: null,
    occupancy: null,
    attendanceWeek: null,
    debtorsSummary: null,
    expiring: null,
    inventory: null,
    ordersPending: null,
    ordersReady: null,
    shift: null,
    revenueChart: null,
    revenueMonths: 6,
    sessionsToday: null,
    sessionDetails: Object.create(null),
    membershipsPeriod: null,
    financialPeriod: null,
    chartsReady: { attendance: false, revenue: false },
    quickActionKeys: null,
    quickSaving: false
  };

  var charts = { attendance: null, revenue: null };
  var chartHostObserver = null;

  function ensureDashLayoutCss() {
    if (!global.document || !global.document.head) return;
    if (global.document.getElementById('gfp-dash-layout-css')) return;
    if (global.document.querySelector('link[href*="dashboard-layout.css"]')) return;
    var link = global.document.createElement('link');
    link.id = 'gfp-dash-layout-css';
    link.rel = 'stylesheet';
    link.href = '/shared/dashboard-layout.css?v=1';
    global.document.head.appendChild(link);
  }

  function resizeDashboardCharts() {
    if (charts.attendance) charts.attendance.resize();
    if (charts.revenue) charts.revenue.resize();
  }

  function watchChartHost(el) {
    if (!el || typeof global.ResizeObserver === 'undefined') return;
    if (!chartHostObserver) {
      chartHostObserver = new global.ResizeObserver(function () {
        resizeDashboardCharts();
      });
    }
    chartHostObserver.observe(el);
  }

  function cssVar(name, fallback) {
    try {
      var v = global.getComputedStyle(global.document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function chartTheme() {
    return {
      text: cssVar('--ltt', '#8C8C8C'),
      grid: cssVar('--ls3', '#E8E8E8'),
      brand: cssVar('--l500', '#7ACC00'),
      fill: 'rgba(122,204,0,.18)'
    };
  }

  function applyChartTheme() {
    var t = chartTheme();
    function paint(ch, kind) {
      if (!ch || !ch.options || !ch.options.scales) return;
      var x = ch.options.scales.x || {};
      var y = ch.options.scales.y || {};
      x.ticks = x.ticks || {};
      y.ticks = y.ticks || {};
      y.grid = y.grid || {};
      x.grid = x.grid || {};
      x.ticks.color = t.text;
      y.ticks.color = t.text;
      y.grid.color = t.grid;
      x.grid.color = t.grid;
      if (ch.data && ch.data.datasets && ch.data.datasets[0]) {
        if (kind === 'bar') ch.data.datasets[0].backgroundColor = 'rgba(122,204,0,.45)';
        if (kind === 'line') {
          ch.data.datasets[0].borderColor = t.brand;
          ch.data.datasets[0].backgroundColor = t.fill;
        }
      }
      ch.update('none');
    }
    paint(charts.attendance, 'bar');
    paint(charts.revenue, 'line');
  }

  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('gfp-theme-change', applyChartTheme);
  }
  var chartJsLoading = null;

  function can(access) {
    return global.GfpAuthz && global.GfpAuthz.useCan(access);
  }

  function t(en, ar) {
    return global.GfpI18n && global.GfpI18n.tLabel ? global.GfpI18n.tLabel(en, ar) : en;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0
    }).format(Number(n) || 0);
  }

  function num(n) {
    return Number(n || 0).toLocaleString();
  }

  function fmtDateOnly(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function periodRange(period) {
    var now = new Date();
    var from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var to = new Date(from);
    if (period === 'today') {
      // same day
    } else if (period === 'week') {
      var day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
    } else if (period === 'last_month') {
      from = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    } else if (period === 'year') {
      from = new Date(from.getFullYear(), 0, 1);
    } else if (period === 'last_year') {
      from = new Date(from.getFullYear() - 1, 0, 1);
      to = new Date(from.getFullYear(), 11, 31);
    } else {
      // Full calendar month (matches API) so Closed payroll can appear.
      from = new Date(from.getFullYear(), from.getMonth(), 1);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    }
    return { from: fmtDateOnly(from), to: fmtDateOnly(to) };
  }

  function daysUntil(iso) {
    if (!iso) return null;
    var end = new Date(iso);
    if (Number.isNaN(end.getTime())) {
      // DateOnly YYYY-MM-DD
      var p = String(iso).split('-');
      if (p.length === 3) end = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    if (Number.isNaN(end.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.round((end - today) / 86400000);
  }

  function unwrapList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function pagedTotal(data) {
    if (!data) return 0;
    if (typeof data.totalCount === 'number') return data.totalCount;
    return unwrapList(data).length;
  }

  function cacheScope() {
    try {
      var user = global.GfpApi && global.GfpApi.tokens ? global.GfpApi.tokens.getUser() : null;
      var tenant = user && (user.tenantId || user.TenantId);
      var id = user && (user.id || user.userId || user.Id || user.UserId);
      return String(tenant || 'tenant-unknown') + ':' + String(id || 'user-unknown');
    } catch (e) {
      return 'tenant-unknown:user-unknown';
    }
  }

  function cacheGet(key) {
    try {
      var raw = global.sessionStorage.getItem(CACHE_PREFIX + cacheScope() + ':' + key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.at == null) return null;
      if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      global.sessionStorage.setItem(
        CACHE_PREFIX + cacheScope() + ':' + key,
        JSON.stringify({ at: Date.now(), data: data })
      );
    } catch (e) { /* ignore quota */ }
  }

  /**
   * Root fix for Nora-style duplicates at ingest (not render):
   * GET /call-sheet/expiring must be unique by membershipId.
   * Same membershipId repeated = backend join bug → collapse here + warn.
   * Same memberId / different membershipIds = legitimate multi-plan → keep.
   */
  function normalizeExpiringEntries(raw) {
    var list = unwrapList(raw);
    var byId = Object.create(null);
    var collapsed = 0;
    list.forEach(function (e) {
      if (!e) return;
      var key =
        e.membershipId != null && String(e.membershipId)
          ? String(e.membershipId)
          : [e.memberId, e.endDate, e.planName].join('|');
      if (byId[key]) {
        collapsed += 1;
        return;
      }
      byId[key] = e;
    });
    if (collapsed > 0 && global.console && console.warn) {
      console.warn(
        '[dashboard] Collapsed ' +
        collapsed +
        ' duplicate membershipId row(s) from GET /call-sheet/expiring. ' +
        'Backend CallSheetService should DISTINCT/GroupBy Membership.Id (likely join to payments/invoices/outcomes).'
      );
    }
    var out = Object.keys(byId).map(function (k) {
      return byId[k];
    });
    out.sort(function (a, b) {
      return String(a.endDate || '').localeCompare(String(b.endDate || ''));
    });
    return out;
  }

  function fmtShortDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      var p = String(iso).split('-');
      if (p.length === 3) d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function phoneHint(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 4) return '';
    return '··' + digits.slice(-4);
  }

  function expiryPhrase(iso) {
    var dLeft = daysUntil(iso);
    var dateStr = fmtShortDate(iso);
    if (dLeft == null) return dateStr || '—';
    if (dLeft < 0) {
      return t('Expired', 'منتهي') + (dateStr ? ' · ' + dateStr : '');
    }
    if (dLeft === 0) {
      return t('Ends today', 'تنتهي اليوم') + (dateStr ? ' · ' + dateStr : '');
    }
    if (dLeft === 1) {
      return t('Ends tomorrow', 'تنتهي بكرة') + (dateStr ? ' · ' + dateStr : '');
    }
    return (
      t('In', 'خلال') +
      ' ' +
      dLeft +
      ' ' +
      t('days', 'أيام') +
      (dateStr ? ' · ' + dateStr : '')
    );
  }

  async function apiGet(path) {
    if (!global.GfpApi) return { ok: false, status: 0, data: null };
    var r = await global.GfpApi.get(path);
    if (
      r.status === 401 &&
      !(r.headers && String(r.headers.get('Token-Expired') || '').toLowerCase() === 'true')
    ) {
      // Must clear the stored session before leaving, not just redirect - login/index.html's own
      // "already logged in" check only looks at whether gfp_access_token/gfp_expires_at are still
      // present and not yet past their self-reported expiry (it never re-validates against the
      // server). A raw location.href here leaves both in place, so login immediately bounces back
      // to /dashboard/, which 401s again and bounces back to login again - an infinite loop that
      // makes every click/page load in the app look like it "doesn't open". GfpApi.logout() clears
      // storage first, exactly like the sidebar logout button already does two functions below.
      if (global.GfpApi.logout) global.GfpApi.logout();
      else global.location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    return r;
  }

  async function apiGetCached(cacheKey, path) {
    var hit = cacheGet(cacheKey);
    if (hit !== null) return { ok: true, status: 200, data: hit, cached: true };
    var r = await apiGet(path);
    if (r.ok) cacheSet(cacheKey, r.data);
    return r;
  }

  async function apiPost(path, body) {
    if (!global.GfpApi) return { ok: false, status: 0, data: null };
    var r = await global.GfpApi.post(path, body);
    if (
      r.status === 401 &&
      !(r.headers && String(r.headers.get('Token-Expired') || '').toLowerCase() === 'true')
    ) {
      // See apiGet's comment above - must clear the session, not just redirect.
      if (global.GfpApi.logout) global.GfpApi.logout();
      else global.location.href = '/auth/login/';
    }
    return r;
  }

  function ensureChartJs() {
    if (global.Chart) return Promise.resolve(true);
    if (chartJsLoading) return chartJsLoading;
    chartJsLoading = new Promise(function (resolve) {
      var s = global.document.createElement('script');
      s.src = '/shared/vendor/chartjs/chart.umd.min.js';
      s.async = true;
      s.onload = function () {
        resolve(!!global.Chart);
      };
      s.onerror = function () {
        chartJsLoading = null;
        resolve(false);
      };
      global.document.head.appendChild(s);
    });
    return chartJsLoading;
  }

  function chartSkeleton() {
    return (
      '<div class="dash-chart-skel" aria-busy="true" aria-label="' +
      esc(t('Loading chart…', 'جاري تحميل المخطط…')) +
      '">' +
      '<div class="dash-skel-bar" style="height:70%"></div>' +
      '<div class="dash-skel-bar" style="height:45%"></div>' +
      '<div class="dash-skel-bar" style="height:85%"></div>' +
      '<div class="dash-skel-bar" style="height:55%"></div>' +
      '<div class="dash-skel-bar" style="height:65%"></div>' +
      '</div>'
    );
  }

  function widgetShell(opts) {
    var span = opts.span || 6;
    return (
      '<article class="dash-widget span-' +
      span +
      '" data-widget="' +
      esc(opts.id) +
      '">' +
      '<header class="dash-widget-hdr">' +
      '<div>' +
      '<h2 class="dash-widget-title"><i class="ti ' +
      esc(opts.icon) +
      '"></i> ' +
      esc(opts.title) +
      '</h2>' +
      (opts.sub ? '<p class="dash-widget-sub">' + opts.sub + '</p>' : '') +
      '</div>' +
      (opts.badge || '') +
      '</header>' +
      '<div class="dash-widget-body" id="' +
      esc(opts.bodyId) +
      '">' +
      (opts.body || '<div class="dash-muted">' + esc(t('Loading…', 'جاري التحميل…')) + '</div>') +
      '</div></article>'
    );
  }

  function errBox(msg, retryAttr) {
    return (
      '<div class="dash-local-err">' +
      '<p>' +
      esc(msg || t('Unable to load this information.', 'مش قادرين نحمّل المعلومات دي.')) +
      '</p>' +
      (retryAttr
        ? '<button type="button" class="dash-btn" data-retry="' +
        esc(retryAttr) +
        '">' +
        esc(t('Retry', 'إعادة المحاولة')) +
        '</button>'
        : '') +
      '</div>'
    );
  }

  function linkRow(href, label) {
    return (
      '<a class="dash-link" href="' + esc(href) + '">' + esc(label) + ' →</a>'
    );
  }

  // ── Permission helpers ─────────────────────────────────────────
  var canMembers = function () {
    return can('members.view');
  };
  var canClasses = function () {
    return canMembers() || can('classes.view');
  };
  var canAttendance = function () {
    return canMembers() || can('attendance.view') || can('checkin.manual');
  };
  var canBusiness = function () {
    var role = global.GfpAuthz && global.GfpAuthz.getUserRole
      ? String(global.GfpAuthz.getUserRole() || '').toLowerCase()
      : '';
    return canMembers() && (role === 'owner' || role === 'manager');
  };
  var isTrainer = function () {
    return global.GfpAuthz && global.GfpAuthz.getUserRole &&
      String(global.GfpAuthz.getUserRole() || '').toLowerCase() === 'trainer';
  };
  var canFinance = function () {
    return can('reports.financial.view');
  };
  var canSales = function () {
    return can('sales.sell');
  };
  var canInventory = function () {
    return can('inventory.view');
  };
  var canShift = function () {
    return can('shift.open');
  };
  var canOrders = function () {
    return (
      canSales() ||
      can('orders.view') ||
      can('orders.fulfill') ||
      can('memberorders.view') ||
      can('memberorders.manage')
    );
  };

  // ── Data loaders (short-lived cache on summary GETs) ───────────
  function cairoDateFromIso(value) {
    if (!value) return '';
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date(value)).reduce(function (result, part) {
        result[part.type] = part.value;
        return result;
      }, {});
      return parts.year + '-' + parts.month + '-' + parts.day;
    } catch (e) {
      return String(value).slice(0, 10);
    }
  }

  function applyDashboardOverview(data) {
    state.dashboardOverview = data || null;
    if (!data) return;
    var today = data.today || {};
    var business = data.business || null;
    var operations = data.operations || {};
    var financial = data.financial || null;

    state.membersStatus = business
      ? { active: business.activeMembers, expired: business.expired, inactive: business.inactive }
      : null;
    state.membershipsPeriod = business
      ? { newCount: business.newMembers, renewalCount: business.renewals }
      : null;
    state.checkinsToday = today.checkinsToday == null
      ? { __err: true }
      : { count: today.checkinsToday };
    state.debtorsSummary = financial
      ? { debtorCount: financial.accountsReceivableCount || 0 }
      : null;
    state.occupancy = operations.maxCapacity == null && operations.currentlyInside == null
      ? { __err: true }
      : {
        maxCapacity: operations.maxCapacity,
        currentlyInside: operations.currentlyInside,
        available: operations.availableCapacity,
        occupancyPercent: operations.occupancyPercent
      };
    state.attendanceWeek = Array.isArray(operations.attendanceTrend)
      ? operations.attendanceTrend.map(function (point) {
        return { date: point.date, checkinCount: point.value };
      })
      : [];
    var sessions = Array.isArray(operations.sessions) ? operations.sessions : [];
    var cairoToday = cairoDateFromIso(new Date().toISOString());
    state.sessionsToday = sessions.filter(function (session) {
      return cairoDateFromIso(session.startsAtUtc) === cairoToday;
    });
    state.sessionDetails = Object.create(null);
    state.sessionsToday.forEach(function (session) {
      if (!Array.isArray(session.bookings)) return;
      state.sessionDetails[session.id] = {
        bookings: session.bookings.map(function (booking) {
          return {
            memberId: booking.memberId,
            memberName: booking.name,
            memberPhone: booking.phone,
            status: booking.status,
            checkedInAtUtc: booking.checkedIn ? new Date().toISOString() : null
          };
        })
      };
    });
    state.financialPeriod = financial
      ? {
        period: data.period && data.period.key ? data.period.key : 'month',
        from: data.period && data.period.from,
        to: data.period && data.period.to,
        dashboard: financial
      }
      : null;
    if (Array.isArray(data.quickActions)) {
      state.quickActionKeys = data.quickActions.map(function (action) {
        return action.key;
      }).filter(Boolean);
    }
    var trend = financial && Array.isArray(financial.revenueTrend) ? financial.revenueTrend : [];
    state.revenueChart = {
      labels: trend.map(function (point) { return String(point.date || '').slice(5); }),
      values: trend.map(function (point) { return Number(point.value) || 0; })
    };
    var attention = {};
    (data.attention && Array.isArray(data.attention.items) ? data.attention.items : [])
      .forEach(function (item) { attention[item.key] = item; });
    state.expiring = attention.renewals_due
      ? new Array(Number(attention.renewals_due.count) || 0).fill({})
      : [];
  }

  async function loadDashboardOverview(period, from, to, force) {
    var selected = period || 'month';
    var path = '/dashboard/overview?period=' + encodeURIComponent(selected);
    if (selected === 'custom' && from && to) {
      path += '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    }
    var r = force
      ? await apiGet(path)
      : await apiGetCached('overview:' + path, path);
    if (!r.ok || !r.data) {
      state.dashboardOverview = { __err: true };
      state.membersStatus = { __err: true };
      state.checkinsToday = { __err: true };
      state.occupancy = { __err: true };
      state.sessionsToday = { __err: true };
      state.debtorsSummary = { __err: true };
      state.financialPeriod = { __err: true };
      return;
    }
    applyDashboardOverview(r.data);
  }

  async function loadMembersStatus() {
    if (!canMembers()) return;
    var r = await apiGetCached('members-status', '/analytics/members-status');
    state.membersStatus = r.ok ? r.data : { __err: true };
  }

  async function loadCheckinsToday() {
    if (!canAttendance()) return;
    var r = await apiGet('/attendance/today?filter=all');
    if (!r.ok) {
      state.checkinsToday = { __err: true };
      return;
    }
    state.checkinsToday = { count: unwrapList(r.data).length };
  }

  async function loadOccupancy() {
    if (!canAttendance()) return;
    var r = await apiGet('/attendance/occupancy');
    state.occupancy = r.ok && r.data ? r.data : { __err: true };
  }

  async function loadAttendanceWeek() {
    if (!canAttendance()) return;
    var to = new Date();
    var from = new Date();
    from.setDate(from.getDate() - 6);
    var path =
      '/reports/attendance-summary?from=' + fmtDateOnly(from) + '&to=' + fmtDateOnly(to);
    var r = await apiGetCached('att-week:' + fmtDateOnly(from), path);
    state.attendanceWeek = r.ok ? unwrapList(r.data) : { __err: true };
  }

  async function loadSessionsToday() {
    if (!canClasses()) return;
    var date = cairoDateFromIso(new Date().toISOString());
    var r = await apiGetCached('sessions:' + date, '/activity-sessions?date=' + date);
    state.sessionsToday = r.ok ? unwrapList(r.data) : { __err: true };
  }

  async function loadSessionDetails() {
    var role = global.GfpAuthz && global.GfpAuthz.getUserRole
      ? String(global.GfpAuthz.getUserRole() || '').toLowerCase()
      : '';
    if (!canClasses() || role !== 'trainer' || !Array.isArray(state.sessionsToday)) return;
    var sessions = state.sessionsToday.slice(0, 6);
    var results = await Promise.all(sessions.map(function (session) {
      var id = session.id || session.Id;
      return id
        ? apiGet('/activity-sessions/' + encodeURIComponent(id)).catch(function () { return { ok: false }; })
        : Promise.resolve({ ok: false });
    }));
    state.sessionDetails = Object.create(null);
    results.forEach(function (result, index) {
      if (result.ok && result.data) {
        var id = sessions[index].id || sessions[index].Id;
        state.sessionDetails[id] = result.data;
      }
    });
  }

  async function loadFinancialPeriod(period) {
    if (!canFinance()) return;
    await loadDashboardOverview(period || 'month');
  }

  async function loadExpiring() {
    if (!canSales()) return;
    var r = await apiGetCached('expiring-7', '/call-sheet/expiring?days=7');
    if (!r.ok) {
      state.expiring = { __err: true };
      return;
    }
    // Replace (never append). Normalize at ingest — root of Nora duplicates when API repeats membershipId.
    state.expiring = normalizeExpiringEntries(r.data);
  }

  async function loadInventory() {
    if (!canInventory()) return;
    var r = await apiGetCached('inv-summary', '/inventory/reports/summary');
    state.inventory = r.ok ? r.data : { __err: true };
  }

  async function loadOrders() {
    if (!canOrders()) return;
    var Mo = global.GfpMemberOrdersApi;
    async function countStatus(status) {
      var path =
        Mo && Mo.paths
          ? Mo.paths.list({ page: 1, pageSize: 1, status: status })
          : '/member-orders?page=1&pageSize=1&status=' + encodeURIComponent(status);
      var r = await apiGet(path);
      if (!r.ok) return { __err: true };
      return { count: pagedTotal(r.data) };
    }
    var pending = await countStatus('Pending');
    var ready = await countStatus('Ready');
    state.ordersPending = pending;
    state.ordersReady = ready;
  }

  async function loadShift() {
    if (!canShift()) return;
    var r = await apiGet('/shifts/current');
    if (r.ok) state.shift = r.data || null;
    else state.shift = { __err: true };
  }

  // ── Derived KPI values ─────────────────────────────────────────
  function activeMembersValue() {
    if (state.membersStatus && !state.membersStatus.__err && state.membersStatus.active != null)
      return Number(state.membersStatus.active);
    return null;
  }

  function checkinsTodayValue() {
    if (state.checkinsToday && !state.checkinsToday.__err) return state.checkinsToday.count;
    return null;
  }

  // ── Render: role-aware Today KPI row ────────────────────────────
  function renderKpis(el) {
    if (!el) return;
    var data = state.dashboardOverview && !state.dashboardOverview.__err
      ? state.dashboardOverview
      : null;
    if (!data) {
      el.innerHTML = errBox(
        t('Unable to load dashboard data.', 'مش قادرين نحمّل بيانات لوحة التحكم.'),
        'overview'
      );
      return;
    }
    var today = data && data.today ? data.today : {};
    var role = global.GfpAuthz && global.GfpAuthz.getUserRole
      ? String(global.GfpAuthz.getUserRole() || '').toLowerCase()
      : '';
    var cards;
    if (role === 'owner') {
      cards = [
        kpiCard(t('Revenue today', 'إيراد اليوم'), today.revenueToday == null ? '—' : money(today.revenueToday), t('Accrual revenue (sales)', 'إيراد مجمّع (مبيعات)')),
        kpiCard(t('Outstanding', 'المستحقات'), today.outstanding == null ? '—' : money(today.outstanding), ''),
        kpiCard(t('Active members', 'الأعضاء النشطون'), today.activeMembers == null ? '—' : num(today.activeMembers), ''),
        kpiCard(t('Renewals due soon', 'تجديدات قريبة'), today.renewalsDueSoon == null ? '—' : num(today.renewalsDueSoon), '')
      ];
    } else if (role === 'manager') {
      cards = [
        kpiCard(t('Revenue today', 'إيراد اليوم'), today.revenueToday == null ? '—' : money(today.revenueToday), t('Accrual revenue (sales)', 'إيراد مجمّع (مبيعات)')),
        kpiCard(t('Outstanding', 'المستحقات'), today.outstanding == null ? '—' : money(today.outstanding), ''),
        kpiCard(t('Active members', 'الأعضاء النشطون'), today.activeMembers == null ? '—' : num(today.activeMembers), ''),
        kpiCard(t("Today's check-ins", 'حضور اليوم'), today.checkinsToday == null ? '—' : num(today.checkinsToday), '')
      ];
    } else if (role === 'receptionist') {
      cards = [
        kpiCard(t("Today's check-ins", 'حضور اليوم'), today.checkinsToday == null ? '—' : num(today.checkinsToday), ''),
        kpiCard(t('Active memberships', 'العضويات النشطة'), today.activeMembers == null ? '—' : num(today.activeMembers), ''),
        kpiCard(t("Today's classes", 'حصص اليوم'), today.todayClasses == null ? '—' : num(today.todayClasses), ''),
        kpiCard(t('Upcoming bookings', 'الحجوزات القادمة'), today.upcomingBookings == null ? '—' : num(today.upcomingBookings), '')
      ];
    } else {
      cards = [
        kpiCard(t("Today's classes", 'حصص اليوم'), today.todayClasses == null ? '—' : num(today.todayClasses), ''),
        kpiCard(t('My upcoming classes', 'حصصي القادمة'), today.myUpcomingClasses == null ? '—' : num(today.myUpcomingClasses), ''),
        kpiCard(t("Today's attendance", 'حضور اليوم'), today.todayAttendance == null ? '—' : num(today.todayAttendance), ''),
        kpiCard(
          t('Class capacity', 'سعة الحصة'),
          today.classCapacityBooked == null || today.classCapacityTotal == null
            ? '—'
            : num(today.classCapacityBooked) + ' / ' + num(today.classCapacityTotal),
          ''
        )
      ];
    }
    el.innerHTML = '<div class="dash-kpi-row">' + cards.join('') + '</div>';
  }

  /** Display-only KPI tile — never a link/button. */
  function kpiCard(label, value, sub) {
    return (
      '<div class="dash-kpi">' +
      '<span class="lbl">' +
      esc(label) +
      '</span>' +
      '<strong>' +
      esc(value) +
      '</strong>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') +
      '</div>'
    );
  }

  function userRoleLower() {
    return global.GfpAuthz && global.GfpAuthz.getUserRole
      ? String(global.GfpAuthz.getUserRole() || '').toLowerCase()
      : '';
  }

  function isOwnerFinance() {
    return canFinance() && userRoleLower() === 'owner';
  }

  function financialTrustState(financial, key) {
    if (!financial || !financial.trustStates) return '';
    return String(financial.trustStates[key] || '').toUpperCase();
  }

  function periodLabelFor(key) {
    if (key === 'today') return t('today', 'اليوم');
    if (key === 'week') return t('this week', 'هذا الأسبوع');
    if (key === 'last_month') return t('last month', 'الشهر الماضي');
    if (key === 'year') return t('this year', 'هذه السنة');
    if (key === 'custom') return t('custom range', 'فترة مخصصة');
    return t('this month', 'هذا الشهر');
  }

  function parseYmdDash(ymd) {
    var parts = String(ymd || '').split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isFullCalendarMonth(from, to) {
    if (!from || !to || from === to) return false;
    var start = parseYmdDash(from);
    var end = parseYmdDash(to);
    if (!start || !end) return false;
    if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) return false;
    if (start.getDate() !== 1) return false;
    var lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return end.getDate() === lastDay;
  }

  function ownerPeriodDisplayLabel(financial, selectedPeriod) {
    var from = financial && financial.from;
    var to = financial && financial.to;
    if (from && to) {
      var fromD = parseYmdDash(from);
      var toD = parseYmdDash(to);
      if (fromD && toD) {
        var fmt = function (d) {
          return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        };
        if (from === to) return fmt(fromD) + ' ' + t('so far', 'حتى الآن');
        if (!isFullCalendarMonth(from, to)) {
          return fmt(fromD) + ' – ' + fmt(toD) + ' ' + t('so far', 'حتى الآن');
        }
      }
    }
    return periodLabelFor(selectedPeriod);
  }

  function shouldShowPayrollPeriodWarning(financial, payrollAvailable, payrollExpense) {
    if (!payrollAvailable || payrollExpense == null || payrollExpense <= 0) return false;
    var from = financial && financial.from;
    var to = financial && financial.to;
    if (!from || !to) return false;
    return !isFullCalendarMonth(from, to);
  }

  function costToRunCard(opts) {
    var running = opts.runningCosts == null ? null : Number(opts.runningCosts);
    var runningDisplay = running == null
      ? '—'
      : running === 0
        ? t('None posted', 'لا يوجد مسجّل')
        : money(running);
    var payrollLine;
    if (opts.payrollAvailable && opts.payroll != null) {
      payrollLine = money(opts.payroll);
    } else if (opts.payrollCoverageStatus === 'PAYROLL_PERIOD_NOT_FULLY_COVERED') {
      payrollLine = t(
        'Select full month',
        'اختر الشهر كاملاً'
      );
    } else if (opts.payrollCoverageStatus === 'NO_PAYROLL_PERIOD') {
      payrollLine = t('No closed period', 'لا توجد فترة مغلقة');
    } else {
      payrollLine = t('Unavailable', 'غير متاح');
    }
    var totalDisplay = opts.total != null ? money(opts.total) : '—';
    var addLink = running === 0 && opts.canManage
      ? '<a class="dash-link" href="/dashboard/reports/?tab=expenses">' +
      esc(t('+ Add running cost', '+ إضافة مصروف تشغيل')) + '</a>'
      : '';
    return (
      '<div class="dash-exec-kpi dash-exec-kpi-cost">' +
      '<span class="lbl">' + esc(global.GfpI18n && global.GfpI18n.t ? global.GfpI18n.t('dashboard.costToRun') : t('Cost to run', 'تكلفة التشغيل')) + '</span>' +
      '<div class="val">' + esc(totalDisplay) + '</div>' +
      '<span class="sub">' + esc(t('Running costs', 'مصروفات تشغيل') + ': ' + runningDisplay) + '</span>' +
      '<span class="sub">' + esc(t('Payroll', 'رواتب') + ': ' + payrollLine) + '</span>' +
      (opts.periodLabel ? '<span class="sub">' + esc(opts.periodLabel) + '</span>' : '') +
      (addLink ? '<span class="hint">' + addLink + '</span>' : '') +
      '</div>'
    );
  }

  function profitabilityBridgeRow(label, amount, opts) {
    opts = opts || {};
    var value = amount == null
      ? '—'
      : money(opts.negative ? -Number(amount) : Number(amount));
    return (
      '<div class="dash-profit-row' + (opts.emphasis ? ' is-total' : '') + '">' +
      '<span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>'
    );
  }

  function profitabilityBridgeHtml(params) {
    return (
      '<div class="dash-profit-bridge">' +
      profitabilityBridgeRow(t('Revenue', 'الإيراد'), params.revenue) +
      profitabilityBridgeRow(t('COGS', 'تكلفة المبيعات'), params.cogs, { negative: true }) +
      profitabilityBridgeRow(t('Gross profit', 'إجمالي الربح'), params.gross, { emphasis: true }) +
      profitabilityBridgeRow(t('Running costs', 'مصروفات تشغيل'), params.running, { negative: true }) +
      profitabilityBridgeRow(
        t('Payroll', 'رواتب'),
        params.payrollAvailable ? params.payroll : null,
        { negative: true }
      ) +
      profitabilityBridgeRow(
        t('Net profit', 'صافي الربح'),
        params.netAvailable ? params.net : null,
        { emphasis: true }
      ) +
      '</div>'
    );
  }

  function ownerAttentionFromIssues(financial, issues) {
    var items = [];
    var codes = {};
    (issues || []).forEach(function (code) { codes[String(code || '').toLowerCase()] = true; });
    if (!financial || financial.settledCashAvailable !== true) {
      items.push({
        title: t('Settlement evidence unavailable', 'دليل التسوية غير متاح'),
        body: t(
          'Some historical payment records cannot currently be verified as settled cash.',
          'بعض سجلات الدفع التاريخية لا يمكن التحقق من تسويتها النقدية حالياً.'
        ),
        href: '/dashboard/reports/?tab=cashflow',
        cta: t('Review', 'مراجعة')
      });
    }
    if (!financial || financial.netProfitAvailable !== true) {
      if (codes.no_payroll_period || codes.payroll_data_incomplete || codes.payroll_period_not_fully_covered) {
        items.push({
          title: t('Payroll unavailable', 'الرواتب غير متاحة'),
          body: t(
            'Net Profit includes salaries when the selected range fully covers an approved/closed payroll month. Use the Month filter (full calendar month). Day or week views exclude payroll (not prorated).',
            'صافي الربح يشمل الرواتب عندما يغطي النطاق المحدد شهر رواتب معتمد/مغلق بالكامل. استخدم فلتر الشهر (شهر تقويمي كامل). عروض اليوم أو الأسبوع تستبعد الرواتب (بدون تقسيم يومي).'
          ),
          href: '/dashboard/reports/?tab=profitability',
          cta: t('Review Payroll', 'مراجعة الرواتب')
        });
      }
    }
    if (codes.cogs_unavailable || codes.retail_refund_cogs_unavailable) {
      items.push({
        title: t('Product costs need review', 'تكاليف المنتجات تحتاج مراجعة'),
        body: t(
          'Gross profit may be incomplete until product cost coverage is complete.',
          'قد يكون إجمالي الربح غير مكتمل حتى تكتمل تغطية تكلفة المنتجات.'
        ),
        href: '/dashboard/reports/?tab=profitability',
        cta: t('Review', 'مراجعة')
      });
    }
    if (codes.payment_allocation_mismatch || codes.supplier_cash_evidence_unavailable) {
      items.push({
        title: t('Financial reconciliation required', 'مطلوب تسوية مالية'),
        body: t(
          'Some financial data requires reconciliation before it can be treated as fully reliable.',
          'بعض البيانات المالية تحتاج تسوية قبل أن تُعامل على أنها موثوقة بالكامل.'
        ),
        href: '/dashboard/reports/?tab=profitability',
        cta: t('Review Financial Reports', 'مراجعة التقارير المالية')
      });
    }
    if (!financial || financial.cashFlowAvailable !== true) {
      var hasCashIssue = items.some(function (item) {
        return item.title === t('Settlement evidence unavailable', 'دليل التسوية غير متاح');
      });
      if (!hasCashIssue) {
        items.push({
          title: t('Cash flow unavailable', 'التدفق النقدي غير متاح'),
          body: t(
            'Cash settlement or supplier payment evidence is incomplete.',
            'دليل التسوية النقدية أو مدفوعات الموردين غير مكتمل.'
          ),
          href: '/dashboard/reports/?tab=cashflow',
          cta: t('Review', 'مراجعة')
        });
      }
    }
    return items;
  }

  function revenueBreakdownHint(breakdown) {
    var labels = {
      memberships: t('Memberships', 'العضويات'),
      renewals: t('Renewals', 'التجديدات'),
      products: t('Products', 'المنتجات'),
      classes: t('Classes', 'الحصص')
    };
    var order = ['memberships', 'renewals', 'products', 'classes'];
    var byKey = {};
    (breakdown || []).forEach(function (item) {
      if (!item || !item.key) return;
      byKey[String(item.key).toLowerCase()] = item;
    });
    var parts = order
      .map(function (key) {
        var item = byKey[key];
        if (!item || Number(item.amount) <= 0) return '';
        return (labels[key] || key) + ' = ' + money(item.amount);
      })
      .filter(Boolean);
    return parts.join(' · ');
  }

  function executiveKpiCard(opts) {
    var trust = String(opts.trust || '').toUpperCase();
    var unavailable = opts.unavailable === true || trust === 'UNAVAILABLE';
    var warn = trust === 'CONDITIONALLY_TRUSTWORTHY' || trust === 'REQUIRES_RECONCILIATION' || opts.warn === true;
    var valueHtml = unavailable
      ? '<div class="val unavailable">' + esc(t('Unavailable', 'غير متاح')) + '</div>'
      : '<div class="val">' + esc(opts.value) + '</div>';
    var statusHtml = '';
    if (unavailable && opts.unavailableNote) {
      statusHtml = '<span class="status unavailable">' + esc(opts.unavailableNote) + '</span>';
    } else if (warn && opts.warnNote) {
      statusHtml = '<span class="status warn">' + esc(opts.warnNote) + '</span>';
    }
    return (
      '<div class="dash-exec-kpi' + (warn ? ' is-warn' : '') + (unavailable ? ' is-muted' : '') + '">' +
      '<span class="lbl">' + esc(opts.label) + '</span>' +
      valueHtml +
      (opts.sub ? '<span class="sub">' + esc(opts.sub) + '</span>' : '') +
      (opts.hint ? '<span class="hint">' + esc(opts.hint) + '</span>' : '') +
      statusHtml +
      '</div>'
    );
  }

  function financePeriodControls(selectedPeriod, financial) {
    var ownerPeriods = ['today', 'week', 'month', 'last_month', 'year', 'custom'];
    var periods = isOwnerFinance() ? ownerPeriods : ['today', 'week', 'month', 'last_month', 'year', 'last_year', 'custom'];
    return (
      '<div class="dash-exec-period">' +
      '<span class="dash-exec-period-label">' +
      esc(t('Showing', 'عرض') + ' ' + periodLabelFor(selectedPeriod)) +
      '</span>' +
      '<div class="dash-seg" id="financePeriodSeg">' +
      periods.map(function (period) {
        var label = period === 'today'
          ? t('Today', 'اليوم')
          : period === 'week'
            ? t('Week', 'أسبوع')
            : period === 'month'
              ? t('Month', 'شهر')
              : period === 'last_month'
                ? t('Last month', 'الشهر الماضي')
                : period === 'year'
                  ? t('Year', 'سنة')
                  : period === 'last_year'
                    ? t('Last year', 'السنة الماضية')
                    : t('Custom', 'مخصص');
        return '<button type="button" class="dash-seg-btn' +
          (selectedPeriod === period ? ' act' : '') +
          '" data-finance-period="' + period + '">' + esc(label) + '</button>';
      }).join('') +
      '</div>' +
      '</div>' +
      '<div class="dash-custom-range" id="dashCustomRange" ' +
      (selectedPeriod === 'custom' ? '' : 'hidden') + '>' +
      '<input type="date" id="dashFromDate" value="' + esc(financial && financial.from || '') + '">' +
      '<input type="date" id="dashToDate" value="' + esc(financial && financial.to || '') + '">' +
      '<button type="button" class="dash-btn" data-finance-custom>' +
      esc(t('Apply', 'تطبيق')) + '</button></div>'
    );
  }

  function wireFinancePeriodControls(el) {
    var periodSeg = el.querySelector('#financePeriodSeg');
    if (periodSeg) {
      periodSeg.querySelectorAll('[data-finance-period]').forEach(function (btn) {
        btn.onclick = async function () {
          var period = btn.getAttribute('data-finance-period') || 'month';
          var custom = el.querySelector('#dashCustomRange');
          if (period === 'custom') {
            if (custom) custom.hidden = false;
            return;
          }
          if (custom) custom.hidden = true;
          var host = global.document.getElementById('dashRevChartHost');
          if (host) host.innerHTML = chartSkeleton();
          await loadFinancialPeriod(period);
          renderFinance(el);
          renderBusiness(global.document.getElementById('wBusiness'));
        };
      });
    }
    var customApply = el.querySelector('[data-finance-custom]');
    if (customApply) {
      customApply.onclick = async function () {
        var from = (el.querySelector('#dashFromDate') || {}).value;
        var to = (el.querySelector('#dashToDate') || {}).value;
        if (!from || !to || from > to) {
          qaToast(t('Choose a valid date range.', 'اختار فترة زمنية صحيحة.'), 'err');
          return;
        }
        await loadDashboardOverview('custom', from, to, true);
        renderFinance(el);
        renderKpis(global.document.getElementById('wKpis'));
        renderBusiness(global.document.getElementById('wBusiness'));
      };
    }
  }

  function renderFinanceExecutive(el, financial, dashboardFinancial, selectedPeriod) {
    var periodLabel = ownerPeriodDisplayLabel(financial, selectedPeriod);
    var revenue = dashboardFinancial && dashboardFinancial.revenue != null
      ? Number(dashboardFinancial.revenue) : null;
    var operatingExpenses = dashboardFinancial && dashboardFinancial.operatingExpenses != null
      ? Number(dashboardFinancial.operatingExpenses)
      : dashboardFinancial && dashboardFinancial.expenses != null
        ? Number(dashboardFinancial.expenses)
        : null;
    var grossProfit = dashboardFinancial ? dashboardFinancial.grossProfit : null;
    var cogsAvailable = dashboardFinancial && dashboardFinancial.cogsAvailable === true;
    var profit = dashboardFinancial ? dashboardFinancial.netProfit : null;
    var netProfitAvailable = dashboardFinancial && dashboardFinancial.netProfitAvailable === true;
    var collections = dashboardFinancial && dashboardFinancial.collections != null
      ? Number(dashboardFinancial.collections) : null;
    var settledCashAvailable = dashboardFinancial && dashboardFinancial.settledCashAvailable === true;
    var ar = dashboardFinancial ? dashboardFinancial.accountsReceivable : null;
    var ap = dashboardFinancial ? dashboardFinancial.accountsPayable : null;
    var payrollExpense = dashboardFinancial && dashboardFinancial.payrollExpense != null
      ? Number(dashboardFinancial.payrollExpense) : null;
    var payrollAvailable = dashboardFinancial
      && dashboardFinancial.payrollAvailable === true
      && dashboardFinancial.payrollCoverageStatus === 'COMPLETE';
    var cogs = dashboardFinancial && dashboardFinancial.cogs != null
      ? Number(dashboardFinancial.cogs) : null;
    var grossMargin = revenue > 0 && grossProfit != null && cogsAvailable
      ? Number(grossProfit) / Number(revenue) * 100
      : null;
    var runningCosts = operatingExpenses != null ? operatingExpenses : 0;
    var costToRunTotal = payrollAvailable && payrollExpense != null
      ? runningCosts + payrollExpense
      : (operatingExpenses != null ? operatingExpenses : null);
    var payrollWarning = shouldShowPayrollPeriodWarning(financial, payrollAvailable, payrollExpense);
    var canManageExpenses = can('reports.expenses.manage');

    var breakdown = dashboardFinancial && Array.isArray(dashboardFinancial.breakdown)
      ? dashboardFinancial.breakdown
      : [];
    var revenueFromHint = revenueBreakdownHint(breakdown);

    var heroKpis = [
      executiveKpiCard({
        label: t('Revenue', 'الإيراد'),
        value: revenue != null ? money(revenue) : '—',
        sub: periodLabel,
        hint: revenueFromHint || t(
          'Recognized from sales in this period — not the same as cash collected',
          'مُثبت من المبيعات في هذه الفترة — ليس نفس المبلغ المحصّل نقداً'
        ),
        trust: financialTrustState(dashboardFinancial, 'Revenue')
      }),
      executiveKpiCard({
        label: t('Gross profit', 'إجمالي الربح'),
        value: grossProfit == null || !cogsAvailable ? '—' : money(grossProfit),
        sub: grossMargin != null
          ? grossMargin.toFixed(1) + '% ' + t('margin', 'هامش')
          : t('After product cost', 'بعد تكلفة المنتج'),
        hint: cogsAvailable && cogs != null
          ? t('Revenue minus product cost (COGS ', 'الإيراد ناقص تكلفة المنتج (') + money(cogs) + ')'
          : t('Revenue minus product cost (COGS)', 'الإيراد ناقص تكلفة المنتج'),
        trust: financialTrustState(dashboardFinancial, 'GrossProfit'),
        unavailable: grossProfit == null || !cogsAvailable,
        unavailableNote: t('Product cost data is incomplete', 'بيانات تكلفة المنتج غير مكتملة')
      }),
      costToRunCard({
        runningCosts: runningCosts,
        payroll: payrollExpense,
        payrollAvailable: payrollAvailable,
        payrollCoverageStatus: dashboardFinancial
          ? dashboardFinancial.payrollCoverageStatus
          : null,
        total: costToRunTotal,
        periodLabel: periodLabel,
        canManage: canManageExpenses
      }),
      executiveKpiCard({
        label: t('Unpaid supplier stock', 'مخزون مورد غير مدفوع'),
        value: ap == null ? '—' : money(ap),
        sub: t('Inventory purchased but not yet paid', 'مخزون مشترى ولم يُسدد بعد'),
        hint: t(
          'Accounts payable — not rent, payroll, or running costs',
          'ذمم دائنة للموردين — ليست إيجار أو رواتب أو مصروفات تشغيل'
        ),
        trust: financialTrustState(dashboardFinancial, 'AccountsPayable')
      })
    ].join('');

    var profitabilityHtml = profitabilityBridgeHtml({
      revenue: revenue,
      cogs: cogsAvailable ? cogs : null,
      gross: grossProfit != null && cogsAvailable ? grossProfit : null,
      running: operatingExpenses,
      payroll: payrollExpense,
      payrollAvailable: payrollAvailable,
      net: profit,
      netAvailable: netProfitAvailable
    });

    var payrollWarningHtml = payrollWarning
      ? '<p class="dash-exec-callout">' +
      esc(t(
        'Salaries are recognized only for full payroll months in this range. Not prorated.',
        'تُحسب الرواتب فقط لأشهر الرواتب الكاملة ضمن هذا النطاق. غير مقسّمة يومياً.'
      )) +
      '</p>'
      : '';

    var cashSection =
      '<div class="dash-exec-owed">' +
      executiveKpiCard({
        label: t('Collected', 'المحصّل'),
        value: collections != null ? money(collections) : '—',
        sub: t('Successful payment collections', 'تحصيلات الدفع الناجحة'),
        hint: t(
          'Money collected from payments — timing may differ from revenue',
          'أموال محصّلة من الدفعات — قد يختلف توقيتها عن الإيراد'
        ),
        trust: financialTrustState(dashboardFinancial, 'Collections'),
        warn: !settledCashAvailable,
        warnNote: t('Settlement evidence unavailable', 'دليل التسوية غير متاح')
      }) +
      '</div>';

    var owedCards =
      '<div class="dash-exec-owed">' +
      '<div>' +
      executiveKpiCard({
        label: t('Accounts receivable', 'ذمم مدينة'),
        value: ar == null ? '—' : money(ar),
        sub: t('Customers who still owe the gym', 'عملاء ما زالوا مدينين للنادي'),
        hint: t(
          'Current balance owed by members — not this period\'s revenue',
          'الرصيد الحالي المستحق من الأعضاء — ليس إيراد هذه الفترة'
        ),
        trust: financialTrustState(dashboardFinancial, 'AccountsReceivable')
      }) +
      linkRow('/dashboard/call-sheet/', t('View receivables', 'عرض الذمم المدينة')) +
      '</div>' +
      '<div>' +
      executiveKpiCard({
        label: t('Unpaid supplier stock', 'مخزون مورد غير مدفوع'),
        value: ap == null ? '—' : money(ap),
        sub: t('Inventory purchased but not yet paid', 'مخزون مشترى ولم يُسدد بعد'),
        hint: t(
          'Accounts payable — not operating expenses',
          'ذمم دائنة — ليست مصروفات تشغيل'
        ),
        trust: financialTrustState(dashboardFinancial, 'AccountsPayable')
      }) +
      linkRow('/dashboard/inventory/suppliers/', t('View payables', 'عرض الذمم الدائنة')) +
      '</div>' +
      '</div>';

    var attention = ownerAttentionFromIssues(
      dashboardFinancial,
      dashboardFinancial && dashboardFinancial.financialDataIssues
    );

    var attentionHtml = attention.length
      ? '<div class="dash-exec-attn">' + attention.map(function (item) {
        return '<div class="dash-exec-attn-item"><div><strong>' + esc(item.title) +
          '</strong><p>' + esc(item.body) + '</p></div>' +
          '<a class="dash-btn secondary" href="' + esc(item.href) + '">' + esc(item.cta) + '</a></div>';
      }).join('') + '</div>'
      : '<p class="dash-muted">' +
      esc(t('No financial issues need your attention right now.', 'لا توجد مشاكل مالية تحتاج انتباهك الآن.')) +
      '</p>';

    var chartNote = t('Daily line shows revenue only', 'الخط اليومي يعرض الإيراد فقط');

    var glossaryHtml =
      '<details class="dash-exec-glossary">' +
      '<summary>' + esc(t('Financial glossary', 'مسرد مالي')) + '</summary>' +
      '<dl class="dash-exec-glossary-list">' +
      [
        [
          t('Revenue', 'الإيراد'),
          t(
            'Recognized from sales in the selected period (financial-v1). Not the same as cash collected that day.',
            'مُثبت من المبيعات في الفترة المختارة (financial-v1). ليس نفس النقد المحصّل في ذلك اليوم.'
          )
        ],
        [
          t('Collected / Cash', 'المحصّل / النقد'),
          t(
            'Successful payment collections. Timing can differ from revenue recognition.',
            'تحصيلات الدفع الناجحة. قد يختلف التوقيت عن إثبات الإيراد.'
          )
        ],
        [
          t('Cost to run', 'تكلفة التشغيل'),
          t(
            'Running costs (OpEx from the catalog) plus salaries when a COMPLETE payroll period covers the month. Payroll is never posted as OpEx.',
            'مصروفات التشغيل من الكتالوج + الرواتب عندما تكون فترة الرواتب COMPLETE. الرواتب لا تُسجَّل كمصروف تشغيل.'
          )
        ],
        [
          t('Unpaid supplier stock (AP)', 'مخزون مورد غير مدفوع'),
          t(
            'Accounts payable for inventory purchased but not yet paid — not rent, payroll, or running costs.',
            'ذمم دائنة لمخزون مشترى ولم يُسدد — ليست إيجار أو رواتب أو مصروفات تشغيل.'
          )
        ],
        [
          t('Payroll warning', 'تحذير الرواتب'),
          t(
            'Salaries enter Net Profit when Month (full calendar month) or another range fully covers an approved/closed payroll period. Day or week views exclude payroll (never prorated).',
            'تدخل الرواتب صافي الربح عندما يغطي «الشهر» (شهر تقويمي كامل) أو نطاق آخر فترة رواتب معتمدة/مغلقة بالكامل. عروض اليوم أو الأسبوع تستبعد الرواتب (بدون تقسيم يومي).'
          )
        ],
        [
          t('Net profit gate', 'بوابة صافي الربح'),
          t(
            'Net profit stays unavailable until fully covered payroll months are COMPLETE and required finance data is present.',
            'صافي الربح يبقى غير متاح حتى تكتمل أشهر الرواتب المغطاة بالكامل وتتوافر بيانات المالية المطلوبة.'
          )
        ]
      ].map(function (row) {
        return '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>';
      }).join('') +
      '</dl>' +
      '<p class="dash-muted dash-exec-glossary-foot">' +
      esc(t('Aligned to financial-v1. Open Running costs in Reports to post OpEx.', 'متوافق مع financial-v1. افتح مصروفات التشغيل في التقارير لتسجيل OpEx.')) +
      '</p></details>';

    el.innerHTML =
      financePeriodControls(selectedPeriod, financial) +
      '<div class="dash-exec-kpis dash-exec-kpis-hero">' + heroKpis + '</div>' +
      glossaryHtml +
      '<div class="dash-exec-section"><h3>' + esc(t('Profitability', 'الربحية')) + '</h3>' +
      profitabilityHtml + payrollWarningHtml + '</div>' +
      '<div class="dash-exec-section"><h3>' + esc(t('Cash', 'النقد')) + '</h3>' + cashSection + '</div>' +
      '<div class="dash-exec-section"><h3>' + esc(t('Money owed', 'الأموال المستحقة')) + '</h3>' + owedCards + '</div>' +
      '<div class="dash-exec-section"><h3>' + esc(t('Revenue trend', 'اتجاه الإيراد')) + '</h3>' +
      '<div class="dash-chart-wrap" id="dashRevChartHost">' + chartSkeleton() + '</div>' +
      '<p class="dash-chart-note">' + esc(chartNote) + '</p></div>' +
      '<div class="dash-exec-section"><h3>' + esc(t('Financial attention', 'تنبيهات مالية')) + '</h3>' + attentionHtml + '</div>' +
      '<div class="dash-exec-links">' +
      [
        ['/dashboard/reports/?tab=profitability', t('Profitability', 'الربحية')],
        ['/dashboard/reports/?tab=cashflow', t('Cash flow', 'التدفق النقدي')],
        ['/dashboard/reports/?tab=expenses', t('Running costs', 'مصروفات التشغيل')],
        ['/dashboard/reports/?tab=profitability', t('Financial reconciliation', 'التسوية المالية')]
      ].map(function (link) {
        return '<a href="' + esc(link[0]) + '">' + esc(link[1]) + '</a>';
      }).join('') +
      '</div>';

    wireFinancePeriodControls(el);
    paintRevenueChart();
  }

  // ── Quick Actions ──────────────────────────────────────────────
  function qaApi() {
    return global.GfpQuickActions || null;
  }

  function qaCanEdit() {
    if (global.GfpAuthz && global.GfpAuthz.useCanRole) {
      return global.GfpAuthz.useCanRole('ManagerOrAbove');
    }
    var qa = qaApi();
    return qa ? qa.canEdit() : false;
  }

  function qaFallbackDefs() {
    return [
      {
        key: 'new_member',
        en: 'New Member',
        ar: 'عضو جديد',
        icon: 'ti-user-plus',
        accent: 'qa-member',
        href: '/dashboard/members/?action=new'
      },
      {
        key: 'checkin',
        en: 'Check-in',
        ar: 'تسجيل حضور',
        icon: 'ti-door-enter',
        accent: 'qa-checkin',
        href: '/dashboard/attendance/'
      },
      {
        key: 'new_sale',
        en: 'New Sale',
        ar: 'بيع جديد',
        icon: 'ti-shopping-cart',
        accent: 'qa-sale',
        href: '/dashboard/pos/?mode=retail'
      },
      {
        key: 'collect_payment',
        en: 'Collect Payment',
        ar: 'تحصيل',
        icon: 'ti-cash',
        accent: 'qa-collect',
        href: '/dashboard/members/'
      }
    ];
  }

  function configuredKeys() {
    var qa = qaApi();
    if (Array.isArray(state.quickActionKeys) && state.quickActionKeys.length) {
      return state.quickActionKeys.slice();
    }
    return qa ? qa.defaultKeys() : ['new_member', 'checkin', 'new_sale', 'collect_payment'];
  }

  function visibleActionDefs() {
    var qa = qaApi();
    var fallback = qaFallbackDefs();
    var keys = configuredKeys();
    var out = [];
    keys.forEach(function (key) {
      var def = qa && qa.byKey ? qa.byKey(key) : null;
      if (!def) {
        for (var i = 0; i < fallback.length; i++) {
          if (fallback[i].key === key) {
            def = fallback[i];
            break;
          }
        }
      }
      if (!def) return;
      if (qa && qa.isAvailable && !qa.isAvailable(def)) return;
      if (qa && qa.isTenantEnabled && !qa.isTenantEnabled(def)) return;
      out.push(def);
    });
    if (!out.length) {
      return fallback.filter(function (def) {
        if (qa && qa.isAvailable && !qa.isAvailable(def)) return false;
        if (qa && qa.isTenantEnabled && !qa.isTenantEnabled(def)) return false;
        return true;
      }).slice(0, qaMax());
    }
    return out.slice(0, qaMax());
  }

  function qaMax() {
    var qa = qaApi();
    return qa && qa.MAX_TILES ? qa.MAX_TILES : 6;
  }

  function qaToast(msg, type) {
    var el = global.document.getElementById('dashToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'dash-toast show ' + (type === 'err' ? 'err' : 'ok');
    global.clearTimeout(qaToast._t);
    qaToast._t = global.setTimeout(function () {
      el.classList.remove('show');
    }, 3500);
  }

  function pickerCandidates() {
    var qa = qaApi();
    if (!qa) return [];
    var have = Object.create(null);
    configuredKeys().forEach(function (k) {
      have[k] = true;
    });
    return qa.WHITELIST.filter(function (def) {
      if (have[def.key]) return false;
      return qa.isTenantEnabled(def);
    });
  }

  function renderQuickActions(el) {
    if (!el) return;
    var edit = qaCanEdit();
    var defs = visibleActionDefs();
    var keys = configuredKeys();
    var atCap = keys.length >= qaMax();
    var busy = !!state.quickSaving;

    var tiles = defs
      .map(function (a) {
        var remove =
          edit && !busy
            ? '<button type="button" class="dash-qa-remove" data-qa-remove="' +
            esc(a.key) +
            '" aria-label="' +
            esc(t('Remove', 'إزالة')) +
            '"><i class="ti ti-x"></i></button>'
            : '';
        return (
          '<div class="dash-qa-tile">' +
          '<a class="dash-quick-item ' +
          esc(a.accent) +
          '" href="' +
          esc(a.href) +
          '"><span class="dash-quick-ico"><i class="ti ' +
          esc(a.icon) +
          '"></i></span><span>' +
          esc(t(a.en, a.ar)) +
          '</span></a>' +
          remove +
          '</div>'
        );
      })
      .join('');

    if (edit && !atCap) {
      tiles +=
        '<button type="button" class="dash-quick-item qa-add" data-qa-add>' +
        '<span class="dash-quick-ico"><i class="ti ti-plus"></i></span>' +
        '<span>' +
        esc(t('Add', 'إضافة')) +
        '</span></button>';
    }

    if (!defs.length && !edit) {
      el.innerHTML =
        '<p class="dash-muted">' +
        esc(t('No quick actions for this account.', 'مفيش إجراءات سريعة للحساب ده.')) +
        '</p>';
      return;
    }

    var manage =
      edit && atCap
        ? '<button type="button" class="dash-qa-manage-link dash-qa-manage-below" data-qa-manage>' +
        esc(t('Manage quick actions', 'إدارة الإجراءات السريعة')) +
        '</button>'
        : '';

    el.innerHTML =
      '<div class="dash-quick' +
      (busy ? ' is-saving' : '') +
      '" aria-busy="' +
      (busy ? 'true' : 'false') +
      '">' +
      tiles +
      '</div>' +
      manage;
  }

  function refreshQuickHeader() {
    var article = global.document.querySelector('[data-widget="quick-actions"]');
    if (!article) return;
    var hdr = article.querySelector('.dash-widget-hdr');
    if (!hdr) return;
    var existing = hdr.querySelector('[data-qa-manage]');
    if (existing) existing.remove();
    if (!qaCanEdit()) return;
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'dash-qa-manage-link';
    btn.setAttribute('data-qa-manage', '');
    btn.textContent = t('Manage', 'إدارة');
    hdr.appendChild(btn);
  }

  function ensureQaModals() {
    if (global.document.getElementById('dashQaPicker')) return;
    var wrap = global.document.createElement('div');
    wrap.innerHTML =
      '<div class="dash-modal-overlay" id="dashQaPicker" hidden>' +
      '<div class="dash-modal" role="dialog" aria-modal="true" aria-labelledby="dashQaPickerTitle">' +
      '<header class="dash-modal-hdr">' +
      '<h3 id="dashQaPickerTitle"></h3>' +
      '<button type="button" class="dash-modal-close" data-qa-close aria-label="Close"><i class="ti ti-x"></i></button>' +
      '</header>' +
      '<div class="dash-modal-body" id="dashQaPickerBody"></div>' +
      '</div></div>' +
      '<div class="dash-modal-overlay" id="dashQaManage" hidden>' +
      '<div class="dash-modal dash-modal-wide" role="dialog" aria-modal="true" aria-labelledby="dashQaManageTitle">' +
      '<header class="dash-modal-hdr">' +
      '<h3 id="dashQaManageTitle"></h3>' +
      '<button type="button" class="dash-modal-close" data-qa-close aria-label="Close"><i class="ti ti-x"></i></button>' +
      '</header>' +
      '<div class="dash-modal-body" id="dashQaManageBody"></div>' +
      '</div></div>' +
      '<div class="dash-toast" id="dashToast" role="status"></div>';
    while (wrap.firstChild) global.document.body.appendChild(wrap.firstChild);
  }

  function closeQaModals() {
    ['dashQaPicker', 'dashQaManage'].forEach(function (id) {
      var el = global.document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function openQaPicker() {
    ensureQaModals();
    var overlay = global.document.getElementById('dashQaPicker');
    var title = global.document.getElementById('dashQaPickerTitle');
    var body = global.document.getElementById('dashQaPickerBody');
    if (!overlay || !body) return;
    if (title) title.textContent = t('Add quick action', 'إضافة إجراء سريع');
    var candidates = pickerCandidates();
    if (!candidates.length) {
      body.innerHTML =
        '<p class="dash-muted">' +
        esc(t('All available actions are already added.', 'كل الإجراءات المتاحة متضافة بالفعل.')) +
        '</p>';
    } else {
      body.innerHTML =
        '<div class="dash-qa-pick-list">' +
        candidates
          .map(function (a) {
            return (
              '<button type="button" class="dash-qa-pick" data-qa-pick="' +
              esc(a.key) +
              '"><span class="dash-quick-ico ' +
              esc(a.accent) +
              '"><i class="ti ' +
              esc(a.icon) +
              '"></i></span><span>' +
              esc(t(a.en, a.ar)) +
              '</span></button>'
            );
          })
          .join('') +
        '</div>';
    }
    overlay.hidden = false;
  }

  function openQaManage() {
    ensureQaModals();
    var overlay = global.document.getElementById('dashQaManage');
    var title = global.document.getElementById('dashQaManageTitle');
    var body = global.document.getElementById('dashQaManageBody');
    if (!overlay || !body) return;
    if (title) title.textContent = t('Manage quick actions', 'إدارة الإجراءات السريعة');
    var qa = qaApi();
    var keys = configuredKeys();
    var atCap = keys.length >= qaMax();
    var rows = keys
      .map(function (key, i) {
        var def = qa && qa.byKey(key);
        if (!def) return '';
        return (
          '<li class="dash-qa-row">' +
          '<span class="dash-quick-ico ' +
          esc(def.accent) +
          '"><i class="ti ' +
          esc(def.icon) +
          '"></i></span>' +
          '<span class="dash-qa-row-label">' +
          esc(t(def.en, def.ar)) +
          '</span>' +
          '<span class="dash-qa-row-actions">' +
          '<button type="button" class="dash-btn" data-qa-up="' +
          i +
          '" ' +
          (i === 0 ? 'disabled' : '') +
          ' aria-label="' +
          esc(t('Move up', 'تحريك لأعلى')) +
          '"><i class="ti ti-arrow-up"></i></button>' +
          '<button type="button" class="dash-btn" data-qa-down="' +
          i +
          '" ' +
          (i === keys.length - 1 ? 'disabled' : '') +
          ' aria-label="' +
          esc(t('Move down', 'تحريك لأسفل')) +
          '"><i class="ti ti-arrow-down"></i></button>' +
          '<button type="button" class="dash-btn" data-qa-remove="' +
          esc(key) +
          '" aria-label="' +
          esc(t('Remove', 'إزالة')) +
          '"><i class="ti ti-x"></i></button>' +
          '</span></li>'
        );
      })
      .join('');

    var addSection = '';
    if (atCap) {
      addSection =
        '<p class="dash-muted">' +
        esc(
          t(
            'Maximum shortcuts reached. Remove one to add another.',
            'وصلت للحد الأقصى. شيل واحد عشان تضيف غيره.'
          )
        ) +
        '</p>';
    } else {
      var candidates = pickerCandidates();
      addSection =
        '<h4 class="dash-qa-section">' +
        esc(t('Add from list', 'أضف من القائمة')) +
        '</h4>' +
        (candidates.length
          ? '<div class="dash-qa-pick-list">' +
          candidates
            .map(function (a) {
              return (
                '<button type="button" class="dash-qa-pick" data-qa-pick="' +
                esc(a.key) +
                '"><span class="dash-quick-ico ' +
                esc(a.accent) +
                '"><i class="ti ' +
                esc(a.icon) +
                '"></i></span><span>' +
                esc(t(a.en, a.ar)) +
                '</span></button>'
              );
            })
            .join('') +
          '</div>'
          : '<p class="dash-muted">' +
          esc(
            t('All available actions are already added.', 'كل الإجراءات المتاحة متضافة بالفعل.')
          ) +
          '</p>');
    }

    body.innerHTML =
      '<h4 class="dash-qa-section">' +
      esc(t('Current shortcuts', 'الاختصارات الحالية')) +
      '</h4>' +
      (rows
        ? '<ol class="dash-qa-rows">' + rows + '</ol>'
        : '<p class="dash-muted">' +
        esc(t('No shortcuts yet. Add one below.', 'مفيش اختصارات. ضيف من تحت.')) +
        '</p>') +
      addSection;
    overlay.hidden = false;
  }

  function paintQuickActions() {
    renderQuickActions(global.document.getElementById('wQuick'));
    refreshQuickHeader();
    var manage = global.document.getElementById('dashQaManage');
    if (manage && !manage.hidden) openQaManage();
    var picker = global.document.getElementById('dashQaPicker');
    if (picker && !picker.hidden) openQaPicker();
  }

  async function persistQuickKeys(nextKeys) {
    var qa = qaApi();
    if (!qa || !qaCanEdit()) return;
    var prev = configuredKeys();
    var next = qa.normalizeKeys(nextKeys).slice(0, qaMax());
    state.quickActionKeys = next;
    state.quickSaving = true;
    paintQuickActions();
    var r = await qa.save(next);
    state.quickSaving = false;
    if (!r.ok) {
      state.quickActionKeys = prev;
      paintQuickActions();
      qaToast(
        r.missingEndpoint
          ? t(
            'Cannot save yet — PUT /api/settings/quick-actions is not on the server.',
            'الحفظ مش متاح دلوقتي — الـ API لسه مش موجود على السيرفر.'
          )
          : r.error || t('Could not save quick actions.', 'مش قادرين نحفظ الإجراءات السريعة.'),
        'err'
      );
      return;
    }
    var picker = global.document.getElementById('dashQaPicker');
    if (picker) picker.hidden = true;
    paintQuickActions();
  }

  async function loadQuickActions() {
    var qa = qaApi();
    if (!qa) {
      state.quickActionKeys = ['new_member', 'checkin', 'new_sale', 'collect_payment'];
      paintQuickActions();
      return;
    }
    state.quickActionKeys = await qa.load();
    paintQuickActions();
  }

  function moveQuickKey(index, delta) {
    var keys = configuredKeys();
    var j = index + delta;
    if (j < 0 || j >= keys.length) return;
    var tmp = keys[index];
    keys[index] = keys[j];
    keys[j] = tmp;
    persistQuickKeys(keys);
  }

  function wireQuickActions() {
    if (wireQuickActions._done) return;
    wireQuickActions._done = true;
    ensureQaModals();
    global.document.addEventListener('click', function (ev) {
      var tEl = ev.target;
      if (!tEl || !tEl.closest) return;
      var addBtn = tEl.closest('[data-qa-add]');
      if (addBtn) {
        ev.preventDefault();
        openQaPicker();
        return;
      }
      var manageBtn = tEl.closest('[data-qa-manage]');
      if (manageBtn) {
        ev.preventDefault();
        openQaManage();
        return;
      }
      var pickBtn = tEl.closest('[data-qa-pick]');
      if (pickBtn) {
        ev.preventDefault();
        persistQuickKeys(configuredKeys().concat([pickBtn.getAttribute('data-qa-pick')]));
        return;
      }
      var removeBtn = tEl.closest('[data-qa-remove]');
      if (removeBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        var rm = removeBtn.getAttribute('data-qa-remove');
        persistQuickKeys(
          configuredKeys().filter(function (k) {
            return k !== rm;
          })
        );
        return;
      }
      var upBtn = tEl.closest('[data-qa-up]');
      if (upBtn) {
        ev.preventDefault();
        moveQuickKey(Number(upBtn.getAttribute('data-qa-up')), -1);
        return;
      }
      var downBtn = tEl.closest('[data-qa-down]');
      if (downBtn) {
        ev.preventDefault();
        moveQuickKey(Number(downBtn.getAttribute('data-qa-down')), 1);
        return;
      }
      var closeBtn = tEl.closest('[data-qa-close]');
      if (closeBtn) {
        ev.preventDefault();
        closeQaModals();
        return;
      }
      if (tEl.classList && tEl.classList.contains('dash-modal-overlay')) {
        closeQaModals();
      }
    });
    global.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeQaModals();
    });
  }

  // ── Attendance widget ──────────────────────────────────────────
  function renderAttendance(el) {
    if (!el) return;
    if (!canAttendance()) {
      el.innerHTML = '';
      return;
    }
    if (isTrainer() && state.dashboardOverview && !state.dashboardOverview.__err) {
      var sessions = state.dashboardOverview.operations &&
        Array.isArray(state.dashboardOverview.operations.sessions)
        ? state.dashboardOverview.operations.sessions
        : [];
      var own = sessions.find(function (session) {
        return session.isMine && cairoDateFromIso(session.startsAtUtc) ===
          cairoDateFromIso(new Date().toISOString());
      });
      el.innerHTML =
        '<div class="dash-kpi-row compact">' +
        '<div class="dash-kpi"><span class="lbl">' +
        esc(t('Booked members', 'الأعضاء المحجوزون')) + '</span><strong>' +
        esc(own ? num(own.bookedCount) : '—') + '</strong></div>' +
        '<div class="dash-kpi"><span class="lbl">' +
        esc(t('Checked in', 'سجلوا حضورهم')) + '</span><strong>' +
        esc(own ? num(own.checkedInCount) : '—') + '</strong></div></div>' +
        linkRow('/dashboard/classes/', t('Open my classes', 'فتح حصصي'));
      return;
    }
    if (
      (state.checkinsToday && state.checkinsToday.__err) &&
      (!state.membersStatus || state.membersStatus.__err)
    ) {
      el.innerHTML = errBox(null, 'attendance');
      return;
    }
    var ci = checkinsTodayValue();
    var am = activeMembersValue();
    var ratio =
      ci != null && am != null && am > 0
        ? '<span class="dash-muted">' + esc(num(ci) + ' / ' + num(am)) + '</span>'
        : '';

    el.innerHTML =
      '<div class="dash-kpi-row compact">' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t("Today's check-ins", 'حضور اليوم')) +
      '</span><strong>' +
      esc(ci != null ? num(ci) : '—') +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Active members', 'الأعضاء النشطون')) +
      '</span><strong>' +
      esc(am != null ? num(am) : '—') +
      '</strong>' +
      (ratio ? '<span class="sub">' + ratio + '</span>' : '') +
      '</div>' +
      '</div>' +
      '<div class="dash-chart-hdr"><span>' +
      esc(t('Last 7 days', 'آخر 7 أيام')) +
      '</span></div>' +
      '<div class="dash-chart-wrap" id="dashAttChartHost">' +
      chartSkeleton() +
      '</div>' +
      linkRow('/dashboard/attendance/', t('View attendance', 'عرض الحضور'));

    paintAttendanceChart();
  }

  function occupancyTone(max, inside, gymActive) {
    if (gymActive === false) return 'inactive';
    if (max == null || max === '') return 'unset';
    var n = Number(inside);
    if (!Number.isFinite(n)) return 'nodata';
    if (n === 0) return 'empty';
    var pct = (n / Number(max)) * 100;
    if (n > Number(max)) return 'over';
    if (pct >= 100) return 'full';
    if (pct >= 80) return 'busy';
    return 'available';
  }

  function occupancyCopy(tone) {
    if (tone === 'inactive' || tone === 'nodata')
      return { cls: 'mute', title: t('Occupancy temporarily unavailable', 'الإشغال غير متاح مؤقتاً') };
    if (tone === 'unset') return { cls: 'mute', title: t('Capacity not configured', 'السعة غير مضبوطة') };
    if (tone === 'empty') return { cls: 'ok', title: t('Gym is Empty', 'الجيم فاضي') };
    if (tone === 'available') return { cls: 'ok', title: t('Gym is Available', 'الجيم متاح') };
    if (tone === 'busy') return { cls: 'busy', title: t('Gym is Getting Busy', 'الجيم بيزحم') };
    if (tone === 'full') return { cls: 'full', title: t('Gym is Full', 'الجيم ممتلئ') };
    return { cls: 'over', title: t('Capacity Exceeded', 'السعة اتجاوزت') };
  }

  function occupancyRing(cls, pct) {
    var C = 301.593;
    var shown = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    var offset = C - (shown / 100) * C;
    var center =
      pct == null
        ? '<div class="occ-pct">—</div><div class="occ-pct-lbl">' + esc(t('No data', 'لا بيانات')) + '</div>'
        : '<div class="occ-pct">' + pct + '<small>%</small></div><div class="occ-pct-lbl">' + esc(t('Occupied', 'مشغول')) + '</div>';
    return (
      '<div class="occ-gauge ' +
      cls +
      '"><svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="track" cx="60" cy="60" r="48"></circle>' +
      '<circle class="fill" cx="60" cy="60" r="48" style="stroke-dashoffset:' +
      offset +
      '"></circle></svg>' +
      '<div class="occ-center">' +
      center +
      '</div></div>'
    );
  }

  function renderOccupancy(el) {
    if (!el) return;
    if (!canAttendance()) {
      el.innerHTML = '';
      return;
    }
    if (!state.occupancy || state.occupancy.__err) {
      el.innerHTML =
        '<div class="occ-row">' +
        occupancyRing('mute', null) +
        '<div class="occ-copy"><div class="occ-status"><span class="occ-dot mute"></span><strong>' +
        esc(t('Occupancy temporarily unavailable', 'الإشغال غير متاح مؤقتاً')) +
        '</strong></div>' +
        '<p class="dash-muted">' +
        esc(t('Attendance did not load. Do not invent a percentage.', 'الحضور ما تحملش. منغير أرقام وهمية.')) +
        '</p></div></div>';
      return;
    }
    var d = state.occupancy;
    var max = d.maxCapacity != null ? d.maxCapacity : d.MaxCapacity;
    var inside = d.currentlyInside != null ? d.currentlyInside : d.CurrentlyInside;
    var avail = d.available != null ? d.available : d.Available;
    var pct = d.occupancyPercent != null ? d.occupancyPercent : d.OccupancyPercent;
    var gymActive = d.gymActive != null ? d.gymActive : d.GymActive;
    var gymName = d.gymName || d.GymName || '';
    var tone = occupancyTone(max, inside, gymActive);
    var copy = occupancyCopy(tone);
    var gCls = copy.cls === 'ok' ? 'ok' : copy.cls;
    var barCls = tone === 'busy' ? 'busy' : tone === 'full' || tone === 'over' ? tone : '';
    var width = pct == null ? 0 : Math.min(100, Number(pct));

    if (tone === 'unset') {
      var canConfigureCapacity =
        global.GfpAuthz &&
        global.GfpAuthz.useCanRole &&
        global.GfpAuthz.useCanRole('ManagerOrAbove');
      el.innerHTML =
        '<div class="occ-row">' +
        occupancyRing('mute', null) +
        '<div class="occ-copy"><div class="occ-status"><span class="occ-dot mute"></span><strong>' +
        esc(copy.title) +
        '</strong></div>' +
        '<p class="dash-muted">' +
        esc(t('Set the maximum people inside so the desk and the Member App can show how full you are.', 'حدد أقصى عدد جوه عشان الديسك والتطبيق يبينوا الزحمة.')) +
        '</p>' +
        (canConfigureCapacity ? linkRow('/dashboard/settings/', t('Configure capacity', 'ضبط السعة')) : '') +
        '</div></div>';
      return;
    }
    if (tone === 'inactive' || tone === 'nodata') {
      el.innerHTML =
        '<div class="occ-row">' +
        occupancyRing('mute', null) +
        '<div class="occ-copy"><div class="occ-status"><span class="occ-dot mute"></span><strong>' +
        esc(copy.title) +
        '</strong></div></div></div>';
      return;
    }

    var meta =
      tone === 'over'
        ? t('Over by', 'زيادة') + ' ' + (Number(inside) - Number(max))
        : avail + ' ' + t('spots available', 'أماكن فاضية');
    el.innerHTML =
      '<div class="occ-row">' +
      occupancyRing(gCls, Number(pct)) +
      '<div class="occ-copy"><div class="occ-status"><span class="occ-dot ' +
      gCls +
      '"></span><strong>' +
      esc(copy.title) +
      '</strong></div>' +
      '<p class="dash-muted">' +
      esc(String(inside)) +
      ' / ' +
      esc(String(max)) +
      ' ' +
      esc(t('currently inside', 'جوه دلوقتي')) +
      (gymName ? ' · ' + esc(gymName) : '') +
      '<br>' +
      esc(String(meta)) +
      '</p>' +
      '<div class="occ-bar ' +
      barCls +
      '"><i style="width:' +
      width +
      '%"></i></div></div></div>';
  }

  async function paintAttendanceChart() {
    var host = global.document.getElementById('dashAttChartHost');
    if (!host) return;

    if (state.attendanceWeek && state.attendanceWeek.__err) {
      host.innerHTML = errBox(null, 'attendance');
      return;
    }

    if (!Array.isArray(state.attendanceWeek)) {
      host.innerHTML = chartSkeleton();
      return;
    }

    if (!state.attendanceWeek.length) {
      host.innerHTML =
        '<p class="dash-muted dash-chart-empty">' +
        esc(t('No check-ins recorded in the last 7 days.', 'مفيش حضور مسجّل في آخر 7 أيام.')) +
        '</p>';
      return;
    }

    host.innerHTML = '<canvas id="dashAttChart" height="120"></canvas>';
    var canvas = global.document.getElementById('dashAttChart');
    if (!canvas) return;

    var ok = await ensureChartJs();
    if (!ok || !global.Chart) {
      host.innerHTML =
        '<p class="dash-muted">' +
        esc(t('Chart library failed to load.', 'مكتبة المخططات فشلت في التحميل.')) +
        '</p>';
      return;
    }
    var labels = state.attendanceWeek.map(function (r) {
      return r.date ? String(r.date).slice(5) : '';
    });
    var values = state.attendanceWeek.map(function (r) {
      return Number(r.checkinCount) || 0;
    });
    if (charts.attendance) charts.attendance.destroy();
    charts.attendance = new global.Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: 'rgba(122,204,0,.45)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 }, color: chartTheme().text },
            grid: { color: chartTheme().grid }
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, color: chartTheme().text },
            grid: { display: false }
          }
        }
      }
    });
    watchChartHost(host);
  }

  // ── Finance widget (money metrics — not duplicated in Today KPIs) ─
  function renderFinance(el) {
    if (!el) return;
    if (!canFinance()) {
      el.innerHTML = '';
      return;
    }
    var financial = state.financialPeriod;
    if (!financial || state.dashboardOverview && state.dashboardOverview.__err) {
      el.innerHTML = errBox(
        t('Unable to load financial data.', 'مش قادرين نحمّل البيانات المالية.'),
        'finance'
      );
      return;
    }
    if (financial && financial.__err) {
      el.innerHTML = errBox(
        t('Unable to load financial data.', 'مش قادرين نحمّل البيانات المالية.'),
        'finance'
      );
      return;
    }
    var dashboardFinancial = financial && financial.dashboard ? financial.dashboard : null;
    var selectedPeriod = financial ? financial.period : 'month';
    if (isOwnerFinance()) {
      renderFinanceExecutive(el, financial, dashboardFinancial, selectedPeriod);
      return;
    }
    renderFinanceDetailed(el, financial, dashboardFinancial, selectedPeriod);
  }

  function renderFinanceDetailed(el, financial, dashboardFinancial, selectedPeriod) {
    var periodLabel = periodLabelFor(selectedPeriod);
    var collections = dashboardFinancial && dashboardFinancial.collections != null
      ? Number(dashboardFinancial.collections) : null;
    var settledCashAvailable = dashboardFinancial && dashboardFinancial.settledCashAvailable === true;
    var settledCash = settledCashAvailable
      ? Number(dashboardFinancial.settledCashInflow) : null;
    var revenue = dashboardFinancial && dashboardFinancial.revenue != null
      ? Number(dashboardFinancial.revenue) : null;
    var ref = dashboardFinancial && dashboardFinancial.refunds != null
      ? Number(dashboardFinancial.refunds) : null;
    var revenueAdjustments = dashboardFinancial && dashboardFinancial.revenueAdjustments != null
      ? Number(dashboardFinancial.revenueAdjustments) : null;
    var expenses = dashboardFinancial ? dashboardFinancial.expenses : null;
    var cogs = dashboardFinancial ? dashboardFinancial.cogs : null;
    var grossProfit = dashboardFinancial ? dashboardFinancial.grossProfit : null;
    var profit = dashboardFinancial ? dashboardFinancial.netProfit : null;
    var margin = dashboardFinancial ? dashboardFinancial.profitMargin : null;
    var netProfitAvailable = dashboardFinancial && dashboardFinancial.netProfitAvailable === true;
    var netCashFlow = dashboardFinancial ? dashboardFinancial.netCashFlow : null;
    var cashFlowAvailable = dashboardFinancial && dashboardFinancial.cashFlowAvailable === true;
    var payrollAvailable = dashboardFinancial
      && dashboardFinancial.payrollAvailable === true
      && dashboardFinancial.payrollCoverageStatus === 'COMPLETE';
    var ar = dashboardFinancial ? dashboardFinancial.accountsReceivable : null;
    var ap = dashboardFinancial ? dashboardFinancial.accountsPayable : null;
    var financialIssues = dashboardFinancial && Array.isArray(dashboardFinancial.financialDataIssues)
      ? dashboardFinancial.financialDataIssues : [];
    var dout = dashboardFinancial && dashboardFinancial.accountsReceivable != null
      ? Number(dashboardFinancial.accountsReceivable) : null;
    var showOutstanding = false;
    var preview =
      state.debtorsPreview && !state.debtorsPreview.__err
        ? state.debtorsPreview.items || []
        : [];
    var outstandingList = '';
    if (showOutstanding && preview.length) {
      outstandingList =
        '<ul class="dash-list" style="margin-top:10px">' +
        preview
          .slice(0, 5)
          .map(function (d) {
            var id = d.memberId || '';
            var name = d.fullName || t('Member', 'عضو');
            return (
              '<li><a class="dash-list-main" href="/dashboard/members/' +
              encodeURIComponent(id) +
              '/">' +
              esc(name) +
              '</a><span class="dash-list-meta">' +
              esc(money(d.totalDue)) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul>';
    }
    var breakdown = dashboardFinancial && Array.isArray(dashboardFinancial.breakdown)
      ? dashboardFinancial.breakdown
      : [];
    var breakdownHtml = breakdown.length
      ? '<div class="dash-breakdown">' + breakdown.map(function (item) {
        var labels = {
          memberships: t('Memberships', 'العضويات'),
          renewals: t('Renewals', 'التجديدات'),
          products: t('POS / products', 'المنتجات'),
          classes: t('Classes / drop-ins', 'الحصص والدخول اليومي')
        };
        return '<div><span>' + esc(labels[item.key] || item.key) + '</span><strong>' +
          esc(money(item.amount)) + '</strong></div>';
      }).join('') + '</div>'
      : '';

    el.innerHTML =
      '<div class="dash-kpi-row compact">' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Collections', 'إجمالي التحصيلات') + ' · ' + periodLabel + ' (EGP)') +
      '</span><strong>' +
      esc(collections != null ? money(collections) : '—') +
      '</strong><span class="sub">' + esc(t('Successful payment events', 'عمليات الدفع الناجحة')) + '</span></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Settled cash inflow', 'التدفق النقدي المسوّى') + ' · ' + periodLabel + ' (EGP)') +
      '</span><strong>' +
      esc(settledCash != null ? money(settledCash) : t('Unavailable', 'غير متاح')) +
      '</strong><span class="sub">' +
      esc(settledCashAvailable
        ? t('Supported by trusted settlement evidence', 'مدعوم بدليل تسوية موثوق')
        : t('Settlement evidence is incomplete', 'دليل التسوية غير مكتمل')) +
      '</span></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Revenue', 'الإيراد') + ' · ' + periodLabel + ' (EGP)') +
      '</span><strong>' +
      esc(revenue != null ? money(revenue) : '—') +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Refunds', 'المرتجعات') + ' · ' + periodLabel + ' (EGP)') +
      '</span><strong>' +
      esc(ref != null ? money(ref) : '—') +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Revenue adjustments', 'تعديلات الإيراد') + ' · ' + periodLabel + ' (EGP)') +
      '</span><strong>' +
      esc(revenueAdjustments != null ? money(revenueAdjustments) : '—') +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Expenses', 'المصروفات')) +
      '</span><strong>' +
      esc(expenses == null ? t('Not available', 'غير متاح') : money(expenses)) +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Payroll', 'الرواتب')) +
      '</span><strong>' +
      esc(payrollAvailable && dashboardFinancial.payrollExpense != null
        ? money(dashboardFinancial.payrollExpense)
        : t('Unavailable', 'غير متاح')) +
      '</strong><span class="sub">' +
      esc(payrollAvailable
        ? t('Approved/closed payroll period', 'فترة رواتب معتمدة/مغلقة')
        : t('No complete payroll coverage for this period', 'لا توجد تغطية رواتب مكتملة للفترة')) +
      '</span></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('COGS', 'تكلفة المبيعات')) +
      '</span><strong>' +
      esc(cogs == null ? t('Unavailable', 'غير متاح') : money(cogs)) +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Gross profit', 'إجمالي الربح')) +
      '</span><strong>' +
      esc(grossProfit == null ? t('Unavailable', 'غير متاح') : money(grossProfit)) +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Net profit', 'صافي الربح') + ' · ' + periodLabel) +
      '</span><strong>' +
      esc(!netProfitAvailable || profit == null
        ? t('Unavailable', 'غير متاح')
        : money(profit)) +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Net cash flow', 'صافي التدفق النقدي') + ' · ' + periodLabel) +
      '</span><strong>' +
      esc(!cashFlowAvailable || netCashFlow == null
        ? t('Unavailable', 'غير متاح')
        : money(netCashFlow)) +
      '</strong><span class="sub">' +
      esc(cashFlowAvailable
        ? t('Verified cash movements', 'حركات نقدية موثقة')
        : t('Settlement or supplier evidence is incomplete', 'دليل التسوية أو المورد غير مكتمل')) +
      '</span></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Profit margin', 'هامش الربح')) +
      '</span><strong>' +
      esc(!netProfitAvailable || margin == null
        ? t('Unavailable', 'غير متاح')
        : Number(margin).toFixed(2) + '%') +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Receivables / Payables', 'الذمم المدينة / الدائنة')) +
      '</span><strong>' +
      esc(ar == null ? '—' : money(ar) + ' / ' + (ap == null ? '—' : money(ap))) +
      '</strong></div>' +
      (showOutstanding
        ? '<div class="dash-kpi"><span class="lbl">' +
        esc(t('Outstanding (EGP)', 'مستحقات (ج.م)')) +
        '</span><strong>' +
        esc(money(dout)) +
        '</strong></div>'
        : '') +
      '</div>' +
      outstandingList +
      (financialIssues.length
        ? '<p class="dash-muted" style="margin-top:8px;font-size:11px">' +
        esc(t('Financial data requires review: ', 'البيانات المالية تحتاج مراجعة: ') + financialIssues.join(', ')) +
        '</p>'
        : '') +
      breakdownHtml +
      financePeriodControls(selectedPeriod, financial) +
      '<div class="dash-chart-hdr">' +
      '<span>' +
      esc(t('Revenue trend', 'اتجاه الإيراد')) +
      '</span></div>' +
      '<div class="dash-chart-wrap" id="dashRevChartHost">' +
      chartSkeleton() +
      '</div>' +
      '<p class="dash-muted" style="margin-top:6px;font-size:11px">' +
      esc(t('Daily revenue from canonical sales activity.', 'الإيراد اليومي من نشاط المبيعات المعتمد.')) +
      '</p>' +
      linkRow('/dashboard/reports/', t('View reports', 'عرض التقارير'));

    wireFinancePeriodControls(el);
    paintRevenueChart();
  }

  async function paintRevenueChart() {
    var host = global.document.getElementById('dashRevChartHost');
    if (!host) return;

    if (!state.revenueChart) {
      host.innerHTML = chartSkeleton();
      return;
    }

    if (state.revenueChart.__err) {
      host.innerHTML = errBox(
        t('Unable to load revenue chart.', 'مش قادرين نحمّل مخطط الإيراد.'),
        'revenue-chart'
      );
      return;
    }

    var labels = state.revenueChart.labels || [];
    var values = state.revenueChart.values || [];
    if (!labels.length) {
      host.innerHTML =
        '<p class="dash-muted dash-chart-empty">' +
        esc(t('No revenue recorded for this period yet.', 'مفيش إيراد مسجّل للفترة دي لسه.')) +
        '</p>';
      return;
    }

    host.innerHTML = '<canvas id="dashRevChart" height="140"></canvas>';
    var canvas = global.document.getElementById('dashRevChart');
    if (!canvas) return;

    var ok = await ensureChartJs();
    if (!ok || !global.Chart) {
      host.innerHTML =
        '<p class="dash-muted">' +
        esc(t('Chart library failed to load.', 'مكتبة المخططات فشلت في التحميل.')) +
        '</p>';
      return;
    }
    if (charts.revenue) charts.revenue.destroy();
    var ct = chartTheme();
    charts.revenue = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            borderColor: ct.brand,
            backgroundColor: ct.fill,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 }, color: ct.text },
            grid: { color: ct.grid }
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, color: ct.text },
            grid: { color: ct.grid }
          }
        }
      }
    });
    watchChartHost(host);
  }

  // ── Expiring memberships ───────────────────────────────────────
  function renderExpiring(el) {
    if (!el) return;
    if (!canSales()) {
      el.innerHTML = '';
      return;
    }
    if (state.expiring && state.expiring.__err) {
      el.innerHTML = errBox(null, 'expiring');
      return;
    }
    var rows = Array.isArray(state.expiring) ? state.expiring : [];
    if (!rows.length) {
      el.innerHTML =
        '<p class="dash-muted">' +
        esc(t('No memberships expiring soon.', 'مفيش عضويات قاربت تنتهي.')) +
        '</p>' +
        linkRow('/dashboard/call-sheet/', t('View call sheet', 'عرض ورقة المتابعة'));
      return;
    }
    el.innerHTML =
      '<ul class="dash-list">' +
      rows
        .slice(0, 5)
        .map(function (e) {
          var memberHref = e.memberId
            ? '/dashboard/members/' + encodeURIComponent(e.memberId) + '/'
            : '/dashboard/call-sheet/';
          var hintParts = [];
          if (e.planName) hintParts.push(e.planName);
          var ph = phoneHint(e.phoneNumber);
          if (ph) hintParts.push(ph);
          return (
            '<li class="dash-exp-row">' +
            '<div class="dash-exp-main">' +
            '<span class="dash-list-main">' +
            esc(e.fullName || t('Member', 'عضو')) +
            '</span>' +
            (hintParts.length
              ? '<span class="dash-exp-sub">' + esc(hintParts.join(' · ')) + '</span>'
              : '') +
            '</div>' +
            '<span class="dash-list-meta">' +
            esc(expiryPhrase(e.endDate)) +
            '</span>' +
            '<div class="dash-exp-actions">' +
            '<a class="dash-btn primary" href="' +
            esc(memberHref) +
            '">' +
            esc(t('Renew', 'تجديد')) +
            '</a>' +
            '<a class="dash-btn secondary" href="' +
            esc(memberHref) +
            '">' +
            esc(t('View', 'عرض')) +
            '</a>' +
            '</div>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>' +
      linkRow('/dashboard/call-sheet/', t('View all', 'عرض الكل'));
  }

  // ── Member Orders summary ──────────────────────────────────────
  function renderOrders(el) {
    if (!el) return;
    if (!canOrders()) {
      el.innerHTML = '';
      return;
    }
    if (
      (state.ordersPending && state.ordersPending.__err) ||
      (state.ordersReady && state.ordersReady.__err)
    ) {
      el.innerHTML = errBox(null, 'orders');
      return;
    }
    var p = state.ordersPending ? Number(state.ordersPending.count || 0) : 0;
    var r = state.ordersReady ? Number(state.ordersReady.count || 0) : 0;
    if (!p && !r) {
      el.innerHTML =
        '<p class="dash-muted">' +
        esc(t('No pending member orders.', 'مفيش طلبات أعضاء معلّقة.')) +
        '</p>' +
        linkRow('/dashboard/member-orders/', t('Open orders', 'فتح الطلبات'));
      return;
    }
    el.innerHTML =
      '<div class="dash-kpi-row compact">' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Pending', 'معلّق')) +
      '</span><strong>' +
      p +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Ready', 'جاهز')) +
      '</span><strong>' +
      r +
      '</strong></div>' +
      '</div>' +
      linkRow('/dashboard/member-orders/', t('Open orders', 'فتح الطلبات'));
  }

  // ── Inventory alerts ───────────────────────────────────────────
  function renderInventory(el) {
    if (!el) return;
    if (!canInventory()) {
      el.innerHTML = '';
      return;
    }
    if (state.inventory && state.inventory.__err) {
      el.innerHTML = errBox(null, 'inventory');
      return;
    }
    var inv = state.inventory || {};
    var low = Number(inv.lowStockCount || 0);
    var out = Number(inv.outOfStockCount || 0);
    var expN = 0;
    if (Array.isArray(inv.expiringSoon)) {
      expN = inv.expiringSoon.reduce(function (a, w) {
        return a + (Number(w.batchCount) || 0);
      }, 0);
    }
    if (!low && !out && !expN) {
      el.innerHTML =
        '<p class="dash-muted">' +
        esc(t('Inventory looks good.', 'المخزون تمام.')) +
        '</p>' +
        linkRow('/dashboard/inventory/', t('View inventory', 'عرض المخزون'));
      return;
    }
    el.innerHTML =
      '<div class="dash-kpi-row compact">' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Low stock', 'مخزون منخفض')) +
      '</span><strong>' +
      low +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Out of stock', 'نفد المخزون')) +
      '</span><strong>' +
      out +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Expiring soon', 'قارب ينتهي')) +
      '</span><strong>' +
      expN +
      '</strong></div>' +
      '</div>' +
      linkRow('/dashboard/inventory/', t('View inventory', 'عرض المخزون'));
  }

  // ── Shift (compact, keep — operational) ────────────────────────
  function renderShift(el) {
    if (!el) return;
    if (!canShift()) {
      el.innerHTML = '';
      return;
    }
    if (state.shift && state.shift.__err) {
      el.innerHTML = errBox(null, 'shift');
      return;
    }
    var shift = state.shift;
    if (!shift || shift.status !== 'open') {
      el.innerHTML =
        '<p class="dash-muted">' +
        esc(t('No open shift.', 'مفيش وردية مفتوحة.')) +
        '</p>' +
        '<div class="dash-actions">' +
        '<button type="button" class="dash-btn primary" data-shift-open>' +
        esc(t('Open shift', 'فتح وردية')) +
        '</button>' +
        '<a class="dash-btn ghost" href="/dashboard/shifts/">' +
        esc(t('Shift desk', 'شاشة الورديات')) +
        '</a></div>';
      var btn = el.querySelector('[data-shift-open]');
      if (btn) {
        btn.onclick = async function () {
          var raw = global.prompt(t('Opening float (EGP)', 'عهدة الافتتاح (ج.م)'), '0');
          if (raw == null) return;
          var openingFloat = Number(raw);
          if (Number.isNaN(openingFloat) || openingFloat < 0) {
            global.alert(t('Enter a non-negative amount.', 'ادخل مبلغ غير سالب.'));
            return;
          }
          btn.disabled = true;
          var res = await apiPost('/shifts/open', { openingFloat: openingFloat });
          if (!res.ok) {
            global.alert((res.data && (res.data.title || res.data.detail)) || t('Could not open shift', 'مش قادرين نفتح الوردية'));
            btn.disabled = false;
            return;
          }
          state.shift = res.data;
          renderShift(el);
        };
      }
      return;
    }
    el.innerHTML =
      '<div class="dash-kpi-row compact">' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Status', 'الحالة')) +
      '</span><strong class="ok">' +
      esc(t('Open', 'مفتوحة')) +
      '</strong></div>' +
      '<div class="dash-kpi"><span class="lbl">' +
      esc(t('Opening float', 'عهدة الافتتاح')) +
      '</span><strong>' +
      esc(money(shift.openingFloat)) +
      '</strong></div>' +
      '</div>' +
      '<div class="dash-actions">' +
      (can('shift.close')
        ? '<a class="dash-btn primary" href="/dashboard/shifts/">' +
        esc(t('Close shift', 'قفل الوردية')) +
        '</a>'
        : '') +
      '<a class="dash-btn ghost" href="/dashboard/shifts/">' +
      esc(t('Manage', 'إدارة')) +
      '</a></div>';
  }

  // ── Role-aware business, classes, and attention summaries ──────
  function renderBusiness(el) {
    if (!el || !canBusiness()) return;
    var status = state.membersStatus;
    var memberships = state.membershipsPeriod;
    if ((status && status.__err) || (memberships && memberships.__err)) {
      el.innerHTML = errBox(null, 'business');
      return;
    }
    var active = status && status.active != null ? num(status.active) : '—';
    var expired = status && status.expired != null ? num(status.expired) : '—';
    var inactive = status && status.inactive != null ? num(status.inactive) : '—';
    var newCount = memberships && memberships.newCount != null ? num(memberships.newCount) : '—';
    var renewals = memberships && memberships.renewalCount != null ? num(memberships.renewalCount) : '—';
    el.innerHTML =
      '<div class="dash-glance">' +
      '<span class="dash-glance-chip">' + esc(t('Active memberships', 'عضويات نشطة')) + ': <strong>' + esc(active) + '</strong></span>' +
      '<span class="dash-glance-chip">' + esc(t('New members this month', 'أعضاء جدد هذا الشهر')) + ': <strong>' + esc(newCount) + '</strong></span>' +
      '<span class="dash-glance-chip">' + esc(t('Renewals this month', 'تجديدات هذا الشهر')) + ': <strong>' + esc(renewals) + '</strong></span>' +
      '<span class="dash-glance-chip">' + esc(t('Expired memberships', 'عضويات منتهية')) + ': <strong>' + esc(expired) + '</strong></span>' +
      '<span class="dash-glance-chip">' + esc(t('Inactive members', 'أعضاء غير نشطين')) + ': <strong>' + esc(inactive) + '</strong></span>' +
      '</div>' +
      linkRow('/dashboard/members/', t('View members', 'عرض الأعضاء'));
  }

  function renderClasses(el) {
    if (!el || !canClasses()) return;
    if (state.sessionsToday && state.sessionsToday.__err) {
      el.innerHTML = errBox(null, 'classes');
      return;
    }
    var sessions = Array.isArray(state.sessionsToday) ? state.sessionsToday : [];
    if (!sessions.length) {
      el.innerHTML =
        '<p class="dash-muted">' + esc(t('No classes scheduled today.', 'مفيش حصص النهارده.')) + '</p>' +
        linkRow('/dashboard/classes/', t('Open classes', 'فتح الحصص'));
      return;
    }
    el.innerHTML =
      '<ul class="dash-list">' +
      sessions.slice(0, 8).map(function (s) {
        var start = s.startsAtUtc || s.StartsAtUtc;
        var d = start ? new Date(start) : null;
        var time = d && !Number.isNaN(d.getTime())
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—';
        var booked = s.bookedCount != null ? s.bookedCount : s.BookedCount;
        var capacity = s.capacity != null ? s.capacity : s.Capacity;
        var remaining = s.remainingCapacity != null ? s.remainingCapacity : s.RemainingCapacity;
        var sessionId = s.id || s.Id;
        var detail = sessionId ? state.sessionDetails[sessionId] : null;
        var bookingRows = detail && (detail.bookings || detail.Bookings);
        var names = Array.isArray(bookingRows)
          ? bookingRows
            .filter(function (b) { return String(b.status || b.Status || '').toLowerCase() !== 'cancelled'; })
            .slice(0, 3)
            .map(function (b) {
              return b.memberName || b.MemberName || b.guestName || b.GuestName || t('Guest', 'زائر');
            })
          : [];
        return '<li>' +
          '<span class="dash-list-meta">' + esc(time) + '</span>' +
          '<span class="dash-list-main">' + esc(s.activityName || s.ActivityName || t('Class', 'حصة')) + '</span>' +
          '<span class="dash-list-meta">' + esc(String(booked == null ? '—' : booked) + ' / ' + String(capacity == null ? '—' : capacity)) + '</span>' +
          '<span class="dash-exp-sub">' + esc(String(remaining == null ? '—' : remaining) + ' ' + t('spots left', 'أماكن متاحة')) + '</span>' +
          (names.length ? '<span class="dash-exp-sub dash-class-members">' + esc(t('Booked: ', 'محجوز: ') + names.join(', ')) + '</span>' : '') +
          '</li>';
      }).join('') +
      '</ul>' +
      linkRow('/dashboard/classes/', t('View all classes', 'عرض كل الحصص'));
  }

  function renderAttention(el) {
    if (!el) return;
    if (state.dashboardOverview && state.dashboardOverview.__err) {
      el.innerHTML = errBox(
        t('Unable to load attention items.', 'مش قادرين نحمّل عناصر المتابعة.'),
        'attention'
      );
      return;
    }
    if (state.dashboardOverview && !state.dashboardOverview.__err) {
      var liveItems = state.dashboardOverview.attention &&
        Array.isArray(state.dashboardOverview.attention.items)
        ? state.dashboardOverview.attention.items
        : [];
      if (!liveItems.length) {
        el.innerHTML =
          '<div class="dash-empty"><i class="ti ti-circle-check"></i><strong>' +
          esc(t('Nothing needs attention right now.', 'مفيش حاجة محتاجة متابعة دلوقتي.')) +
          '</strong></div>';
        return;
      }
      var labels = {
        renewals_due: t('Renewals to follow up', 'تجديدات للمتابعة'),
        outstanding_payments: t('Outstanding payments', 'مدفوعات مستحقة'),
        inactive_members: t('Inactive members', 'أعضاء غير نشطين'),
        trials_ending_soon: t('Trials ending soon', 'تجارب تنتهي قريباً'),
        classes_near_full: t('Classes nearly full', 'حصص اقتربت من الامتلاء')
      };
      var icons = {
        renewals_due: 'ti-calendar-event',
        outstanding_payments: 'ti-receipt',
        inactive_members: 'ti-user-off',
        trials_ending_soon: 'ti-hourglass',
        classes_near_full: 'ti-users-group'
      };
      // Deep-link to Call Sheet with the matching reason + date=open so the queue shows every
      // open follow-up for that reason (default "today" hid items scheduled for later).
      var CALL_SHEET_REASON = { renewals_due: 'renewal', outstanding_payments: 'payment', inactive_members: 'inactive' };
      el.innerHTML = '<div class="dash-attention-grid">' + liveItems.map(function (item) {
        var key = item.key || '';
        var amount = item.amount == null ? '' : ' · ' + money(item.amount);
        var target = CALL_SHEET_REASON[key]
          ? 'call-sheet/?reason=' + CALL_SHEET_REASON[key] + '&date=open'
          : key === 'classes_near_full'
            ? 'classes/'
            : key === 'trials_ending_soon'
              ? 'call-sheet/?reason=trial&date=open'
              : 'call-sheet/?date=open';
        return '<a class="dash-attention-item" href="/dashboard/' +
          target +
          '"><i class="ti ' + esc(icons[key] || 'ti-alert-circle') + '"></i><span>' +
          esc(labels[key] || key) + '</span><strong>' + esc(num(item.count)) +
          esc(amount) + '</strong></a>';
      }).join('') + '</div>';
      return;
    }
    var items = [];
    var attentionError = canSales() && state.expiring && state.expiring.__err;
    if (canSales() && Array.isArray(state.expiring) && state.expiring.length) {
      items.push({
        icon: 'ti-calendar-event',
        label: t('Renewals to follow up', 'تجديدات للمتابعة'),
        value: state.expiring.length,
        href: '/dashboard/call-sheet/?reason=renewal&date=open'
      });
    }
    if (canFinance() && state.debtorsSummary
      && Number(state.debtorsSummary.debtorCount) > 0) {
      items.push({
        icon: 'ti-receipt',
        label: t('Outstanding payments', 'مدفوعات مستحقة'),
        value: state.debtorsSummary.debtorCount,
        href: '/dashboard/call-sheet/?reason=payment&date=open'
      });
    }
    if (canMembers() && state.membersStatus && !state.membersStatus.__err && Number(state.membersStatus.expired) > 0) {
      items.push({
        icon: 'ti-user-off',
        label: t('Expired memberships', 'عضويات منتهية'),
        value: state.membersStatus.expired,
        href: '/dashboard/members/?status=expired'
      });
    }
    if (canMembers() && Array.isArray(state.sessionsToday)) {
      var full = state.sessionsToday.filter(function (s) {
        var capacity = Number(s.capacity != null ? s.capacity : s.Capacity);
        var booked = Number(s.bookedCount != null ? s.bookedCount : s.BookedCount);
        return capacity > 0 && booked >= capacity;
      }).length;
      if (full) {
        items.push({
          icon: 'ti-users-group',
          label: t('Classes at capacity', 'حصص مكتملة'),
          value: full,
          href: '/dashboard/classes/'
        });
      }
    }
    if (!items.length) {
      if (attentionError) {
        el.innerHTML = errBox(
          t('Some attention items could not be loaded.', 'تعذر تحميل بعض عناصر المتابعة.'),
          'attention'
        );
        return;
      }
      el.innerHTML =
        '<p class="dash-muted">' + esc(t('Nothing requires attention right now.', 'مفيش حاجة محتاجة متابعة دلوقتي.')) + '</p>';
      return;
    }
    el.innerHTML =
      '<div class="dash-alert-list">' +
      items.map(function (item) {
        return '<a class="dash-alert" href="' + esc(item.href) + '">' +
          '<i class="ti ' + esc(item.icon) + '"></i>' +
          '<span class="dash-alert-body"><strong>' + esc(item.label) + '</strong><span>' + esc(t('Action required', 'مطلوب إجراء')) + '</span></span>' +
          '<strong>' + esc(num(item.value)) + '</strong><i class="ti ti-chevron-right dash-alert-chev"></i>' +
          '</a>';
      }).join('') +
      '</div>';
  }

  // ── Shell / boot ───────────────────────────────────────────────
  function buildLayout(host) {
    var parts = [];

    if (canFinance()) {
      parts.push(
        widgetShell({
          id: 'finance',
          icon: 'ti-currency-dollar',
          title: isOwnerFinance()
            ? t('How is your gym doing?', 'كيف أداء صالتك؟')
            : t('Financial overview', 'نظرة مالية'),
          sub: isOwnerFinance()
            ? t('Executive financial overview', 'نظرة مالية تنفيذية')
            : t('Cash collected, refunds, and outstanding balances', 'المتحصلات والمرتجعات والمستحقات'),
          bodyId: 'wFinance',
          span: 12
        })
      );
    }

    parts.push(
      widgetShell({
        id: 'kpis',
        icon: 'ti-layout-dashboard',
        title: t('Today', 'اليوم'),
        sub: t('What is happening in the gym right now', 'إيه اللي بيحصل في الجيم دلوقتي'),
        bodyId: 'wKpis',
        span: 12
      })
    );

    parts.push(
      widgetShell({
        id: 'quick-actions',
        icon: 'ti-bolt',
        title: t('Quick Actions', 'إجراءات سريعة'),
        sub: t('Common daily operations', 'عمليات يومية شائعة'),
        bodyId: 'wQuick',
        span: 12
      })
    );

    if (canBusiness()) {
      parts.push(
        widgetShell({
          id: 'business',
          icon: 'ti-chart-dots-3',
          title: t('Business overview', 'نظرة على النشاط'),
          sub: t('Membership activity from operational data', 'نشاط العضويات من بيانات التشغيل'),
          bodyId: 'wBusiness',
          span: 12
        })
      );
    }

    if (canAttendance() || canClasses()) {
      parts.push(
        '<div class="dash-section-label"><span>' +
        esc(t('Operations', 'التشغيل')) +
        '</span><small>' +
        esc(t('Attendance, capacity, and scheduled classes', 'الحضور والسعة والحصص المجدولة')) +
        '</small></div>'
      );
    }

    if (canAttendance() && !isTrainer()) {
      parts.push(
        widgetShell({
          id: 'occupancy',
          icon: 'ti-users-group',
          title: t('Gym capacity', 'سعة الجيم'),
          sub: t('Live from Attendance In Gym', 'مباشر من حضور الجيم'),
          bodyId: 'wOccupancy',
          span: 6
        })
      );
      parts.push(
        widgetShell({
          id: 'attendance',
          icon: 'ti-door-enter',
          title: t("Today's Attendance", 'حضور اليوم'),
          bodyId: 'wAttendance',
          span: 6
        })
      );
    }

    if (canClasses()) {
      parts.push(
        widgetShell({
          id: 'classes',
          icon: 'ti-calendar-event',
          title: isTrainer() ? t('My upcoming classes', 'حصصي القادمة') : t("Today's classes", 'حصص اليوم'),
          sub: t('Bookings and capacity from the sessions service', 'الحجوزات والسعة من خدمة الحصص'),
          bodyId: 'wClasses',
          span: 12
        })
      );
    }

    parts.push(
      widgetShell({
        id: 'attention',
        icon: 'ti-alert-triangle',
        title: t('Needs attention', 'يحتاج متابعة'),
        sub: t('Only actionable items appear here', 'هنا بنعرض الحاجات اللي محتاجة إجراء'),
        bodyId: 'wAttention',
        span: 12
      })
    );

    host.innerHTML = parts.join('');
  }

  function wireRetries(host) {
    host.addEventListener('click', async function (ev) {
      var btn = ev.target.closest('[data-retry]');
      if (!btn) return;
      var key = btn.getAttribute('data-retry');
      btn.disabled = true;
      if (key === 'attendance' || key === 'occupancy' || key === 'classes' ||
        key === 'business' || key === 'revenue-chart' || key === 'finance' ||
        key === 'attention') {
        try {
          var cachePrefix = CACHE_PREFIX + cacheScope() + ':overview:';
          for (var cacheIndex = global.sessionStorage.length - 1; cacheIndex >= 0; cacheIndex -= 1) {
            var cacheKey = global.sessionStorage.key(cacheIndex);
            if (cacheKey && cacheKey.indexOf(cachePrefix) === 0)
              global.sessionStorage.removeItem(cacheKey);
          }
        } catch (e) { /* ignore */ }
        await loadDashboardOverview(
          (state.financialPeriod && state.financialPeriod.period) || 'month',
          null,
          null,
          true
        );
        renderFinance(global.document.getElementById('wFinance'));
        renderKpis(global.document.getElementById('wKpis'));
        renderAttendance(global.document.getElementById('wAttendance'));
        renderOccupancy(global.document.getElementById('wOccupancy'));
        renderBusiness(global.document.getElementById('wBusiness'));
        renderClasses(global.document.getElementById('wClasses'));
        renderAttention(global.document.getElementById('wAttention'));
      } else if (key === 'inventory') {
        try {
          global.sessionStorage.removeItem(CACHE_PREFIX + 'inv-summary');
        } catch (e) { /* ignore */ }
        await loadInventory();
        renderInventory(global.document.getElementById('wInventory'));
        renderKpis(global.document.getElementById('wKpis'));
      }
      btn.disabled = false;
    });
  }

  function whenIdle(fn) {
    if (typeof global.requestIdleCallback === 'function') {
      global.requestIdleCallback(function () {
        fn();
      }, { timeout: 1200 });
    } else {
      global.setTimeout(fn, 200);
    }
  }

  async function bootWidgets() {
    var host = global.document.getElementById('widgetGrid');
    if (!host) return;

    buildLayout(host);
    wireRetries(host);
    wireQuickActions();
    paintQuickActions();

    // The overview endpoint is the only source for dashboard KPIs. This keeps
    // Cairo boundaries, role filtering, and business calculations server-owned.
    await loadDashboardOverview('month').catch(function () {
      state.dashboardOverview = { __err: true };
    });
    paintQuickActions();
    renderFinance(global.document.getElementById('wFinance'));
    renderKpis(global.document.getElementById('wKpis'));
    renderAttendance(global.document.getElementById('wAttendance'));
    renderOccupancy(global.document.getElementById('wOccupancy'));
    renderBusiness(global.document.getElementById('wBusiness'));
    renderClasses(global.document.getElementById('wClasses'));
    renderAttention(global.document.getElementById('wAttention'));

  }

  function mountPrepareGym() {
    var host = global.document.getElementById('prepareGymHost');
    var PG = global.GfpPrepareGym;
    if (!host || !PG || !PG.mount) return;
    function go(edition) {
      PG.mount(host, edition ? { edition: edition } : {});
    }
    if (PG.isLocalEdition()) {
      go();
      return;
    }
    var attr = global.document.documentElement && global.document.documentElement.getAttribute('data-gfp-edition');
    if (attr) {
      go(attr === 'local' ? 'Local' : 'SaaS');
      return;
    }
    if (global.GfpDeployment && global.GfpDeployment.getEdition) {
      global.GfpDeployment.getEdition().then(go);
      return;
    }
    if (global.document.addEventListener) {
      global.document.addEventListener('gfp:edition', function onEd(ev) {
        global.document.removeEventListener('gfp:edition', onEd);
        go(ev.detail && ev.detail.local ? 'Local' : 'SaaS');
      });
    }
  }

  function paintUserChrome() {
    var user = (global.GfpApi && global.GfpApi.tokens.getUser()) || null;
    if (!user) {
      // Clear via GfpApi.logout() (not a raw redirect) in case gfp_access_token/gfp_expires_at
      // are still present even though gfp_user is missing - login's own session check only looks
      // at the former two, so leaving them behind here would bounce straight back to /dashboard/.
      if (global.GfpApi && global.GfpApi.logout) global.GfpApi.logout();
      else global.location.href = '/auth/login/';
      return false;
    }
    var av = global.document.getElementById('userAvatar');
    var nm = global.document.getElementById('userName');
    var rl = global.document.getElementById('userRole');
    if (av) {
      av.textContent = (user.fullName || 'U')
        .split(/\s+/)
        .map(function (w) {
          return w[0];
        })
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    if (nm) nm.textContent = user.fullName || 'User';
    if (rl) rl.textContent = user.role || 'Staff';
    var headline = global.document.getElementById('dashboardHeadline');
    var subtitle = global.document.getElementById('dashboardSubtitle');
    var role = String(user.role || '').toLowerCase();
    var context = role === 'owner'
      ? [t('Owner dashboard', 'لوحة تحكم المالك'), t('The most important numbers for the whole gym', 'أهم الأرقام للصالة كلها')]
      : role === 'manager'
        ? [t('Manager dashboard', 'لوحة تحكم المدير'), t('Business and operations within your permissions', 'الأعمال والتشغيل حسب صلاحياتك')]
        : role === 'receptionist'
          ? [t('Reception dashboard', 'لوحة تحكم الاستقبال'), t('The next actions at the front desk', 'الخطوات التالية في الاستقبال')]
          : [t('Trainer dashboard', 'لوحة تحكم المدرب'), t('Your classes, attendance, and members today', 'حصصك والحضور والأعضاء اليوم')];
    if (headline) headline.textContent = context[0];
    if (subtitle) subtitle.textContent = context[1];
    return true;
  }

  async function loadGymName() {
    var gn = global.document.getElementById('gymName');
    var ga = global.document.getElementById('gymNameAr');
    // Prefer staff-readable branding (any auth) — Owner-only /settings fails for Receptionist.
    var r = await apiGet('/settings/branding');
    if (r.ok && r.data) {
      if (gn) gn.textContent = r.data.gymName || '';
      if (ga) ga.textContent = r.data.gymNameAr || '';
      if (global.GfpBranding && typeof global.GfpBranding.apply === 'function') {
        try {
          await global.GfpBranding.apply(r.data);
        } catch (e) { /* ignore */ }
      }
      return;
    }
    r = await apiGet('/settings');
    if (r.ok && r.data) {
      if (gn) gn.textContent = r.data.gymName || '';
      if (ga) ga.textContent = r.data.gymNameAr || '';
      return;
    }
    r = await apiGet('/settings/gym-code');
    if (r.ok && r.data && gn) gn.textContent = r.data.gymCode || gn.textContent;
  }

  function wireChrome() {
    var btn = global.document.getElementById('btnLogout');
    if (btn) {
      btn.addEventListener('click', function () {
        if (global.GfpApi) global.GfpApi.logout();
        else global.location.href = '/auth/login/';
      });
    }
    var mob = global.document.getElementById('mobToggle');
    var sidebar = global.document.getElementById('sidebar');
    if (mob && sidebar) {
      mob.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });
    }
  }

  async function init() {
    ensureDashLayoutCss();
    if (!paintUserChrome()) return;
    wireChrome();
    loadGymName();
    if (global.GfpI18n && global.GfpI18n.applyDocumentLocale) {
      global.GfpI18n.applyDocumentLocale();
    }
    mountPrepareGym();
    await bootWidgets();
    global.addEventListener('resize', resizeDashboardCharts);
    global.addEventListener('gfp:locale', function () {
      paintUserChrome();
      if (global.GfpI18n && global.GfpI18n.applyDocumentLocale) {
        global.GfpI18n.applyDocumentLocale();
      }
      mountPrepareGym();
      bootWidgets();
    });
    if (global.document && global.document.addEventListener) {
      global.document.addEventListener('gfp:edition', function () {
        mountPrepareGym();
      });
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GfpDashboardHome = { refresh: bootWidgets };
})(typeof window !== 'undefined' ? window : globalThis);
