/**
 * Cash Drawer / Shifts — Part 2 data layer (pagination, lazy tabs, partial refresh).
 * Blind-count invariant: never invent expectedCash client-side while status === 'open'.
 * Financial actions: wait for server confirmation — no optimistic UI updates.
 */
(function () {
  'use strict';

  var API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || ''; // REM-F3

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  var SHIFT_409 = {
    SHIFT_ALREADY_OPEN: [
      'A shift is already open for this staff member. Close it before opening another.',
      'فيه وردية مفتوحة للموظف ده بالفعل. اقفلها الأول قبل ما تفتح واحدة جديدة.'
    ],
    NO_OPEN_SHIFT: [
      'Open a cash shift first, then complete this payment.',
      'افتح وردية الكاش الأول، وبعدين كمّل الدفعة دي.'
    ],
    NOT_AWAITING_APPROVAL: [
      'This shift is not awaiting approval (wrong status for approve).',
      'الوردية دي مش في انتظار اعتماد (حالة غلط للاعتماد).'
    ],
    SHIFT_NOT_OPEN: [
      'This shift is not open. Force-close / movement actions require an open shift.',
      'الوردية مش مفتوحة. الإغلاق القسري والحركات محتاجين وردية مفتوحة.'
    ]
  };
  function shift409Text(code) {
    var pair = SHIFT_409[code] || SHIFT_409.NO_OPEN_SHIFT;
    return t(pair[0], pair[1]);
  }
  // Never render raw server status values — Arabic-primary staff get mapped labels.
  function shiftStatusLabel(status) {
    var s = String(status || '').toLowerCase();
    var map = {
      open: ['Open', 'مفتوحة'],
      closed: ['Closed', 'مقفولة'],
      awaiting_approval: ['Awaiting approval', 'في انتظار الاعتماد'],
      approved: ['Approved', 'معتمدة'],
      none: ['No shift open', 'مفيش وردية مفتوحة']
    };
    var pair = map[s];
    return pair ? t(pair[0], pair[1]) : String(status || '—');
  }

  var RECENT_PAGE_SIZE = 8;
  var FULL_MOV_PAGE_SIZE = 20;
  var HIST_PAGE_SIZE = 20;

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH() {
    var t = getToken();
    var h = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
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

  function decodeJwtPayload(token) {
    try {
      var part = token.split('.')[1];
      var json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function getPerms() {
    var payload = decodeJwtPayload(getToken() || '');
    if (!payload) return new Set();
    var raw = payload.perm;
    if (Array.isArray(raw)) return new Set(raw.map(String));
    if (typeof raw === 'string') return new Set([raw]);
    var set = new Set();
    Object.keys(payload).forEach(function (k) {
      if (k === 'perm' || k === 'http://schemas.microsoft.com/ws/2008/06/identity/claims/perm') {
        var v = payload[k];
        if (Array.isArray(v)) v.forEach(function (x) { set.add(String(x)); });
        else if (v) set.add(String(v));
      }
    });
    return set;
  }

  var Authz = window.GfpAuthz;
  var user = getUser();
  var perms = getPerms();
  var role = (user && user.role) || '';
  var isManagerPlus = Authz
    ? Authz.useCanRole('ManagerOrAbove')
    : /^(Owner|Manager)$/i.test(role);
  // TODO: Receptionist maps to restricted front-desk view (My Shift only).
  var canOpen = perms.has('shift.open') || isManagerPlus || /Owner/i.test(role);
  var canClose = perms.has('shift.close') || isManagerPlus || /Owner/i.test(role);
  var canApprove = perms.has('shift.reconcile.approve') || /Owner/i.test(role);
  var canFinancial = perms.has('reports.financial.view') || /Owner/i.test(role);
  var canSeeMgrTabs = isManagerPlus;
  var zLink = document.getElementById('linkZReports');
  if (zLink && (canFinancial || isManagerPlus)) zLink.hidden = false;

  var currentShift = null;
  /** Embedded movements only used when GET /movements paging is unavailable (degraded). */
  var movementsFallback = null;
  var movementsServerOk = null; // null unknown, true/false after probe
  var movementTotalCount = 0;
  var histPage = 1;
  var movPage = 1;
  var showFullMovements = false;
  var forceCloseId = null;
  var staffOptions = {};
  var countedDebounceTimer = null;
  var activeTab = 'my';
  var drawersLoaded = false;
  var historyLoaded = false;

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    var v = Number(n);
    // Leading minus + LTR isolate (FSI…PDI): en-EG currency style trails the minus
    // ("EGP 3,000.00-") which scrambles in RTL — one convention: -EGP 3,000.00.
    var s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
    return '\u2068' + (v < 0 ? '-EGP ' : 'EGP ') + s + '\u2069';
  }

  function dt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function timeOnly(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDateOnly(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function variancePhrase(v) {
    if (v == null || Number.isNaN(Number(v))) {
      return { text: '—', cls: '', amount: '—' };
    }
    var n = Number(v);
    if (n === 0) return { text: t('Balanced', 'مطابق'), cls: 'balanced', amount: money(0) };
    if (n < 0) {
      return { text: t('Short by', 'ناقص') + ' ' + money(Math.abs(n)), cls: 'short', amount: money(n) };
    }
    return { text: t('Over by', 'زيادة') + ' ' + money(n), cls: 'over', amount: money(n) };
  }

  function varianceHtml(v) {
    var p = variancePhrase(v);
    if (p.text === '—') return '—';
    return (
      '<span class="var-text ' +
      p.cls +
      '">' +
      esc(p.text) +
      '</span>' +
      '<div class="muted" style="font-size:11px">' +
      esc(p.amount) +
      '</div>'
    );
  }

  function movBadge(type, amount) {
    var movementType = String(type || '').toLowerCase();
    var label = movementType.replace(/_/g, ' ').toUpperCase();
    var cls = movementType;
    if (movementType === 'float_adjust') {
      cls = Number(amount) < 0 ? 'float_adjust_neg' : 'float_adjust_pos';
    }
    var arMap = {
      sale: ['Sale', 'بيع'],
      paid_in: ['Paid in', 'إيداع'],
      paid_out: ['Paid out', 'صرف'],
      refund: ['Refund', 'مرتجع'],
      float_adjust: ['Float adj.', 'تسوية رصيد']
    };
    var pair = arMap[movementType];
    var shown = pair ? t(pair[0], pair[1]) : label;
    return '<span class="mov-badge ' + esc(cls) + '">' + esc(shown) + '</span>';
  }

  function signedMoney(type, amount) {
    var n = Number(amount);
    if (Number.isNaN(n)) return { html: '—', cls: '' };
    var t = String(type || '').toLowerCase();
    var showMinus = t === 'paid_out' || t === 'refund' || n < 0;
    var showPlus = t === 'paid_in' || (t === 'float_adjust' && n > 0) || t === 'sale';
    var abs = money(Math.abs(n));
    var prefix = showMinus ? '−' : showPlus ? '+' : '';
    var display = prefix ? prefix + abs.replace(/^-/, '') : abs;
    return { html: esc(display), cls: showMinus ? 'neg' : showPlus ? 'pos' : '' };
  }

  function problemMessage(data, status) {
    if (!data) return t('Request failed', 'فشل الطلب') + ' (' + status + ')';
    var title = data.title || data.code || '';
    if (status === 409 && SHIFT_409[title]) return shift409Text(title);
    if (status === 403 && title === 'MANAGER_APPROVAL_REQUIRED') {
      return t(
        'Manager approval is required for this paid-out amount (threshold).',
        'صرف المبلغ ده محتاج موافقة مدير (حسب الحد المسموح).'
      );
    }
    if (status === 404 && title === 'FEATURE_DISABLED') {
      return t('Shifts feature is disabled for this tenant.', 'وحدة الورديات مقفولة لهذا النادي.');
    }
    var detail = data.detail || data.message || data.error || '';
    if (detail && String(detail).indexOf(' / ') !== -1) {
      return String(detail).split(' / ')[0].trim();
    }
    return detail || title || t('Request failed', 'فشل الطلب') + ' (' + status + ')';
  }

  async function api(method, path, body) {
    // Cash movements are operational data.  A browser cache hit here can make a
    // just-recorded sale appear to be missing until the next navigation, which
    // is unacceptable while a drawer is open.  Always revalidate GET requests.
    var opts = {
      method: method,
      headers: getH(),
      cache: method === 'GET' ? 'no-store' : 'default'
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    var res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (e) {
      return {
        ok: false,
        status: 0,
        data: { title: 'NETWORK_ERROR', detail: 'Network error — check API / ngrok tunnel.' }
      };
    }
    if (res.status === 401) {
      window.location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('json') !== -1) {
      data = await res.json().catch(function () { return null; });
    } else if (res.status !== 204) {
      var text = await res.text().catch(function () { return ''; });
      data = text ? { detail: text } : null;
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  function setBusy(btn, busy, idleHtml) {
    if (!btn) return;
    if (busy) {
      if (!btn.getAttribute('data-idle-html')) {
        btn.setAttribute('data-idle-html', btn.innerHTML);
      }
      btn.disabled = true;
      btn.innerHTML = '<span class="loader"></span> Working…';
    } else {
      btn.disabled = false;
      btn.innerHTML = idleHtml || btn.getAttribute('data-idle-html') || btn.innerHTML;
      btn.removeAttribute('data-idle-html');
    }
  }

  function skeletonBlocks(n) {
    var html = '<div class="sk-stack">';
    for (var i = 0; i < n; i++) {
      html += '<div class="sk-block' + (i === 0 ? ' lg' : '') + '"></div>';
    }
    return html + '</div>';
  }

  function skeletonTableRows(cols, rows) {
    var html = '';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) {
        html += '<td><div class="sk-block"></div></td>';
      }
      html += '</tr>';
    }
    return html;
  }

  function setShiftsDisabledBanner(on) {
    var banner = document.getElementById('featureDisabled');
    if (!banner) return;
    banner.classList.toggle('is-off', !on);
    banner.hidden = !on;
    banner.style.display = on ? 'flex' : 'none';
  }

  function markShiftsFeatureDisabled() {
    setShiftsDisabledBanner(true);
    var body = document.getElementById('currentBody');
    if (body) {
      body.innerHTML =
        '<p class="muted">Module unavailable — enable the <code>shifts</code> feature flag for this tenant on the backend.</p>';
    }
    var actions = document.getElementById('actionsBody');
    if (actions) actions.innerHTML = '<p class="muted">Shifts are disabled for this gym.</p>';
    var summary = document.getElementById('summaryBody');
    if (summary) summary.innerHTML = '<p class="muted">Shifts feature is disabled for this tenant.</p>';
    var summaryTotal = document.getElementById('summaryTotal');
    if (summaryTotal) summaryTotal.textContent = '—';
    var movCard = document.getElementById('movementsCard');
    if (movCard) movCard.hidden = true;
    currentShift = null;
    movementsFallback = null;
    if (window.GfpFeatures && window.GfpFeatures.clearCache) window.GfpFeatures.clearCache();
  }

  function clearShiftsDisabledBanner() {
    setShiftsDisabledBanner(false);
  }

  // ── Tabs (lazy secondary data) ─────────────────────────────────
  function setupTabs() {
    var tabDrawers = document.getElementById('tabDrawers');
    var tabHistory = document.getElementById('tabHistory');
    if (canSeeMgrTabs) {
      tabDrawers.hidden = false;
      tabHistory.hidden = false;
    }

    document.querySelectorAll('.shift-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.hidden) return;
        var key = btn.getAttribute('data-tab');
        activeTab = key;
        var map = { my: 'panelMy', drawers: 'panelDrawers', history: 'panelHistory' };
        document.querySelectorAll('.shift-tab').forEach(function (b) {
          b.classList.toggle('act', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          var on = p.id === map[key];
          p.classList.toggle('act', on);
          p.hidden = !on;
        });
        if (key === 'drawers') {
          loadOpenSummary();
        }
        if (key === 'history') {
          // Auto-load with default 7-day range on first visit (no Load click required)
          loadHistory();
        }
      });
    });
  }

  // ── Modals ─────────────────────────────────────────────────────
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = false;
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.getAttribute('data-close'));
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.hidden = true;
    });
  });

  function patchMovementCount(n) {
    movementTotalCount = n == null ? 0 : Number(n) || 0;
    var el = document.getElementById('movCountVal');
    if (el) el.textContent = String(movementTotalCount);
  }

  // ── Current shift ──────────────────────────────────────────────
  async function loadCurrent() {
    var body = document.getElementById('currentBody');
    var actions = document.getElementById('actionsBody');
    var movCard = document.getElementById('movementsCard');
    body.innerHTML = '<div class="loader"></div> Loading…';

    var res = await api('GET', '/shifts/current');

    if (res.status === 404 && res.data && res.data.title === 'FEATURE_DISABLED') {
      markShiftsFeatureDisabled();
      return;
    }

    if (res.status === 404 || res.status === 409 || (res.ok && !res.data)) {
      clearShiftsDisabledBanner();
      var code = (res.data && res.data.title) || 'NO_OPEN_SHIFT';
      currentShift = null;
      movementsFallback = null;
      movementTotalCount = 0;
      document.getElementById('shiftStatus').textContent = shiftStatusLabel('none');
      document.getElementById('shiftStatus').className = 'status-pill';
      document.getElementById('currentCard').classList.add('shift-none');
      body.innerHTML =
        '<div class="shift-none-note"><i class="ti ti-moon"></i>' +
        esc(shift409Text(code)) +
        '</div>';
      movCard.hidden = true;
      renderOpenForm(actions);
      return;
    }

    if (!res.ok) {
      body.innerHTML = '<p class="muted">' + esc(problemMessage(res.data, res.status)) + '</p>';
      actions.innerHTML = '';
      return;
    }

    clearShiftsDisabledBanner();
    document.getElementById('currentCard').classList.remove('shift-none');
    applyCurrentShift(res.data);
    renderOpenActions(actions, currentShift);
    movCard.hidden = currentShift.status !== 'open';
    if (currentShift.status === 'open') {
      document.getElementById('btnOpenRecord').hidden = !canOpen;
      await loadRecentMovements();
      if (showFullMovements) await loadFullMovements();
    }
  }

  function applyCurrentShift(s) {
    var embedded = Array.isArray(s.movements) ? s.movements.slice() : [];
    movementsFallback = embedded.length ? embedded : null;
    currentShift = Object.assign({}, s, { movements: [] });
    // Provisional count until paged movements API returns totalCount
    if (typeof s.movementCount === 'number') {
      movementTotalCount = s.movementCount;
    } else if (embedded.length) {
      movementTotalCount = embedded.length;
    }
    renderCurrent(currentShift);
  }

  /**
   * Blind-count rule: while status === 'open', expectedCash from API is null.
   * Never sum movements client-side to invent an expected total.
   */
  function renderCurrent(s) {
    var st = document.getElementById('shiftStatus');
    st.textContent = shiftStatusLabel(s.status);
    st.className = 'status-pill ' + (s.status || '');

    var expectedCell =
      s.status === 'open'
        ? '<strong class="muted">' + esc(t('Hidden (blind)', 'مخفي (تعمية)')) + '</strong>'
        : '<strong class="stat-val">' + esc(money(s.expectedCash)) + '</strong>';

    var html =
      '<div class="kv">' +
      '<div class="kv-row"><span class="stat-lbl">' + esc(t('Staff', 'الموظف')) + '</span><strong>' +
      esc(s.userName || s.userId) +
      '</strong></div>' +
      '<div class="kv-row"><span class="stat-lbl">' + esc(t('Opened', 'وقت الفتح')) + '</span><strong>' +
      esc(dt(s.openedAt)) +
      '</strong></div>' +
      '<div class="kv-row"><span class="stat-lbl">' + esc(t('Opening float', 'رصيد الفتح')) + '</span><strong class="stat-val">' +
      esc(money(s.openingFloat)) +
      '</strong></div>' +
      '<div class="kv-row"><span class="stat-lbl">' + esc(t('Expected cash', 'النقدية المتوقعة')) + '</span>' +
      expectedCell +
      '</div>';

    if (s.status !== 'open') {
      html +=
        '<div class="kv-row"><span class="stat-lbl">' + esc(t('Counted', 'المحسوب')) + '</span><strong class="stat-val">' +
        esc(money(s.countedCash)) +
        '</strong></div>' +
        '<div class="kv-row"><span class="stat-lbl">' + esc(t('Variance', 'الفرق')) + '</span><div>' +
        varianceHtml(s.variance) +
        '</div></div>';
    }

    html +=
      '<div class="kv-row"><span class="stat-lbl">' + esc(t('Movements', 'الحركات')) + '</span><strong class="stat-val" style="font-size:18px" id="movCountVal">' +
      esc(String(movementTotalCount)) +
      '</strong></div></div>';

    if (s.status === 'open') {
      html +=
        '<div class="blind-note"><i class="ti ti-eye-off"></i> ' + esc(t('Blind count active — expected cash is null until you submit the physical count. Do not calculate it from the movements list.', 'التعمية شغالة — النقدية المتوقعة هتفضل فاضية لحد ما تدخل الجرد الفعلي. متحسبهاش من قايمة الحركات.')) + '</div>';
    } else if (canFinancial && s.id) {
      html +=
        '<p class="hint" style="margin-top:12px"><a href="/dashboard/z-report/?shiftId=' +
        encodeURIComponent(s.id) +
        '">' + esc(t('View Z-Report', 'عرض تقرير Z')) + '</a></p>';
    }

    document.getElementById('currentBody').innerHTML = html;
  }

  function renderOpenForm(el) {
    if (!canOpen) {
      el.innerHTML =
        '<p class="muted">' +
        esc(t('You need', 'محتاج صلاحية')) +
        ' <code>shift.open</code> ' +
        esc(t('to open a drawer.', 'عشان تفتح درج.')) +
        '</p>';
      return;
    }
    // Guided empty state: one card that explains why + quick float chips + one CTA.
    el.innerHTML =
      '<div class="open-shift-grid">' +
      '<div class="open-shift-main">' +
      '<div class="open-shift-ic"><i class="ti ti-cash-banknote"></i></div>' +
      '<h3 class="open-shift-title">' +
      esc(t('Open the cash drawer', 'افتح وردية الكاش')) +
      '</h3>' +
      '<p class="open-shift-why">' +
      esc(t(
        'An open shift records every cash payment and tracks the drawer balance until you close it with a physical count.',
        'الوردية المفتوحة بتسجّل كل المقبوضات النقدية وبتتتبع رصيد الدرج لحد ما تقفلها بجرد فعلي.'
      )) +
      '</p>' +
      '<form class="form-stack open-shift-form" id="openForm">' +
      '<label class="open-float-lbl">' +
      esc(t('Opening float — the cash you are putting in the drawer', 'رصيد بداية الوردية — الكاش اللي هتحطه في الدرج')) +
      '<span class="float-input-wrap"><input type="number" id="openingFloat" step="0.01" min="0" required placeholder="0.00" dir="ltr"><span class="float-suffix">EGP</span></span>' +
      '</label>' +
      '<div class="float-chips" id="floatChips">' +
      '<button type="button" class="float-chip" data-v="200">200</button>' +
      '<button type="button" class="float-chip" data-v="500">500</button>' +
      '<button type="button" class="float-chip" data-v="1000">1000</button>' +
      '<button type="button" class="float-chip" data-v="2000">2000</button>' +
      '</div>' +
      '<button class="btn primary open-shift-btn" type="submit" id="btnOpenShift"><i class="ti ti-lock-open"></i> ' +
      esc(t('Open shift', 'فتح الوردية')) +
      '</button>' +
      '</form>' +
      '</div>' +
      '<div class="open-shift-side" id="lastShiftSide" hidden></div>' +
      '</div>';
    document.querySelectorAll('#floatChips .float-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var input = document.getElementById('openingFloat');
        if (input) input.value = chip.getAttribute('data-v');
      });
    });
    document.getElementById('openForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var openingFloat = Number(document.getElementById('openingFloat').value);
      if (Number.isNaN(openingFloat) || openingFloat < 0) {
        toast(t('Enter a valid opening float.', 'اكتب رصيد بداية صحيح.'), 'err');
        return;
      }
      var btn = document.getElementById('btnOpenShift');
      setBusy(btn, true);
      var res = await api('POST', '/shifts/open', { openingFloat: openingFloat });
      setBusy(btn, false);
      if (!res.ok) {
        toast(problemMessage(res.data, res.status), 'err');
        return;
      }
      toast(t('Shift opened.', 'اتفتحت الوردية.'), 'ok');
      // Targeted: current shift (+ recent activity) only — do not touch History / Open Drawers
      await loadCurrent();
    });
    loadLastShiftSide();
  }

  /** Reassurance context beside the open form: the last closed shift's reconciliation. */
  async function loadLastShiftSide() {
    var side = document.getElementById('lastShiftSide');
    if (!side || !canFinancial) return;
    try {
      var to = new Date();
      var from = new Date();
      from.setDate(from.getDate() - 14);
      function donly(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
      var q = new URLSearchParams({ from: donly(from), to: donly(to), page: '1', pageSize: '1' });
      var res = await api('GET', '/shifts?' + q.toString());
      if (!res.ok) return;
      var payload = res.data;
      var items = Array.isArray(payload) ? payload : (payload && (payload.items || payload.data)) || [];
      if (!items.length) return;
      var s = items[0];
      if (!s || s.status === 'open') return;
      var vp = variancePhrase(s.variance);
      side.hidden = false;
      side.innerHTML =
        '<div class="stat-lbl">' +
        esc(t('Last closed shift', 'آخر وردية مقفولة')) +
        '</div>' +
        '<div class="ls-big">' +
        esc(money(s.countedCash)) +
        '</div>' +
        '<div class="ls-when">' +
        esc(dt(s.closedAt || s.openedAt)) +
        (s.userName ? ' · ' + esc(s.userName) : '') +
        '</div>' +
        '<div class="ls-row"><span>' +
        esc(t('Counted', 'المحسوب')) +
        '</span><strong>' +
        esc(money(s.countedCash)) +
        '</strong></div>' +
        '<div class="ls-row"><span>' +
        esc(t('Variance', 'الفرق')) +
        '</span><strong class="' +
        (vp.cls || '') +
        '">' +
        esc(vp.text === '—' ? '—' : vp.text) +
        '</strong></div>';
    } catch (e) {
      /* side panel is best-effort only */
    }
  }

  function renderOpenActions(el, s) {
    if (s.status !== 'open') {
      el.innerHTML =
        '<p class="muted">' +
        esc(t('Current shift is', 'الوردية الحالية')) +
        ' <strong>' +
        esc(shiftStatusLabel(s.status)) +
        '</strong>.</p>';
      return;
    }
    var html = '<p class="muted">' + esc(t('Close with a physical count. Variance appears only after submit.', 'اقفل الوردية بجرد فعلي. الفرق هيظهر بعد التسليم بس.')) + '</p>';
    if (canClose) {
      html +=
        '<form class="form-stack" id="closeForm">' +
        '<label>' + esc(t('Counted cash (EGP)', 'النقدية المحسوبة (جنيه)')) + '<input type="number" id="countedCash" step="0.01" min="0" required></label>' +
        '<div class="count-hint" id="countedHint"></div>' +
        '<label>' + esc(t('Variance note (optional)', 'ملاحظة الفرق (اختياري)')) + '<textarea id="varianceNote" rows="2" placeholder="' + esc(t('Required by policy if variance is large', 'مطلوبة لو الفرق كبير')) + '"></textarea></label>' +
        '<button class="btn primary" type="submit" id="btnCloseShift"><i class="ti ti-lock"></i> ' + esc(t('Close shift (blind count)', 'قفل الوردية (تعمية)')) + '</button>' +
        '</form>';
    } else {
      html += '<p class="muted">' + esc(t('Missing', 'ناقص')) + ' <code>shift.close</code>.</p>';
    }
    el.innerHTML = html;

    var counted = document.getElementById('countedCash');
    var hint = document.getElementById('countedHint');
    if (counted && hint) {
      counted.addEventListener('input', function () {
        clearTimeout(countedDebounceTimer);
        countedDebounceTimer = setTimeout(function () {
          var v = Number(counted.value);
          if (counted.value === '' || Number.isNaN(v)) {
            hint.textContent = '';
            return;
          }
          if (v < 0) {
            hint.textContent = t('Counted cash must be ≥ 0.', 'النقدية المحسوبة لازم تكون ≥ 0.');
            return;
          }
          hint.textContent = t('Ready to submit physical count:', 'جاهز لتسليم الجرد الفعلي:') + ' ' + money(v);
        }, 350);
      });
    }

    var form = document.getElementById('closeForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var countedCash = Number(document.getElementById('countedCash').value);
      var varianceNote = document.getElementById('varianceNote').value.trim() || null;
      if (Number.isNaN(countedCash) || countedCash < 0) {
        toast('Enter counted cash.', 'err');
        return;
      }
      var btn = document.getElementById('btnCloseShift');
      setBusy(btn, true);
      var res = await api('POST', '/shifts/current/close', {
        countedCash: countedCash,
        varianceNote: varianceNote
      });
      setBusy(btn, false);
      if (!res.ok) {
        toast(problemMessage(res.data, res.status), 'err');
        return;
      }
      var vp = variancePhrase(res.data && res.data.variance);
      toast(
        'Shift closed. Expected ' +
          money(res.data && res.data.expectedCash) +
          ' · ' +
          vp.text,
        'ok'
      );
      // Partial refresh: Current Shift card only (+ Open Drawers if that tab is visible)
      if (res.data) {
        applyCurrentShift(res.data);
        document.getElementById('movementsCard').hidden = true;
        renderOpenActions(el, currentShift);
      } else {
        await loadCurrent();
      }
      if (activeTab === 'drawers' && canSeeMgrTabs) {
        await loadOpenSummary({ force: true });
      } else {
        drawersLoaded = false; // stale until next visit
      }
    });
  }

  function sortedMovements(list) {
    var out = (list || []).slice();
    out.sort(function (a, b) {
      return new Date(b.createdAtUtc) - new Date(a.createdAtUtc);
    });
    return out;
  }

  function normalizePaged(data, page, pageSize) {
    if (!data) return null;
    if (Array.isArray(data.items)) {
      return {
        items: data.items,
        page: data.page != null ? data.page : page,
        pageSize: data.pageSize != null ? data.pageSize : pageSize,
        totalCount: data.totalCount != null ? data.totalCount : data.items.length,
        totalPages: data.totalPages,
        hasNext: !!data.hasNext,
        hasPrevious: !!data.hasPrevious
      };
    }
    return null;
  }

  /**
   * Server-side movements page. Falls back to embedded ShiftDto.movements only if
   * GET list endpoints are not yet deployed (degraded).
   */
  async function fetchMovementsPaged(page, pageSize) {
    if (!currentShift || !currentShift.id) return null;
    var q = 'page=' + page + '&pageSize=' + pageSize;
    var res = await api('GET', '/shifts/current/movements?' + q);
    var paged = res.ok ? normalizePaged(res.data, page, pageSize) : null;
    if (paged) {
      movementsServerOk = true;
      return paged;
    }
    // Older controllers may only expose the shift-id route.
    if (res.status === 404 || res.status === 405 || res.status === 501 || !res.ok) {
      res = await api('GET', '/shifts/' + encodeURIComponent(currentShift.id) + '/movements?' + q);
      paged = res.ok ? normalizePaged(res.data, page, pageSize) : null;
      if (paged) {
        movementsServerOk = true;
        return paged;
      }
    }
    movementsServerOk = false;
    return null;
  }

  function fallbackPage(page, pageSize) {
    var list = sortedMovements(movementsFallback || []);
    var total = list.length;
    var start = (page - 1) * pageSize;
    var items = list.slice(start, start + pageSize);
    var totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    return {
      items: items,
      page: page,
      pageSize: pageSize,
      totalCount: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      degraded: true
    };
  }

  async function loadRecentMovements() {
    var ul = document.getElementById('activityList');
    var viewAll = document.getElementById('btnViewAllMov');
    if (!ul) return;
    ul.innerHTML = '<li class="muted"><span class="loader"></span> Loading…</li>';

    var page = await fetchMovementsPaged(1, RECENT_PAGE_SIZE);
    var embeddedPage = movementsFallback ? fallbackPage(1, RECENT_PAGE_SIZE) : null;

    // GET /current already comes with the exact open shift and its movements.
    // If the separate paged route ever responds with an empty/incomplete list
    // (for example during a refresh race), do not hide a movement we have just
    // received with that same shift.  The embedded response is the safe
    // fallback; the next refresh will retry the paged list normally.
    if (
      page &&
      embeddedPage &&
      embeddedPage.totalCount > page.totalCount
    ) {
      page = embeddedPage;
    }
    if (!page && movementsFallback == null && movementsServerOk === false) {
      // Do not turn a failed request into the false statement "no movements".
      // The operator must know to retry rather than trusting an empty drawer.
      ul.innerHTML =
        '<li class="muted">' +
        esc(t(
          'Could not load cash movements. Press Refresh to try again.',
          'تعذر تحميل الحركات النقدية. اضغط تحديث للمحاولة مرة أخرى.'
        )) +
        '</li>';
      patchMovementCount(null);
      if (viewAll) viewAll.hidden = true;
      return;
    }
    if (!page) page = fallbackPage(1, RECENT_PAGE_SIZE);

    patchMovementCount(page.totalCount);
    renderActivityFromList(page.items, page.totalCount);
    var wrap = document.getElementById('fullMovWrap');
    var pager = document.getElementById('movPager');
    if (wrap) wrap.hidden = !showFullMovements;
    if (pager) pager.hidden = !showFullMovements;
    if (viewAll) {
      viewAll.hidden = page.totalCount === 0;
      viewAll.textContent = showFullMovements ? 'Hide full table ↑' : 'View all →';
    }
  }

  function renderActivityFromList(items, totalCount) {
    var ul = document.getElementById('activityList');
    var viewAll = document.getElementById('btnViewAllMov');
    if (!items || !items.length) {
      ul.innerHTML = '<li class="muted">No movements yet today.</li>';
      if (viewAll) viewAll.hidden = true;
      return;
    }
    ul.innerHTML = items
      .map(function (m) {
        var sm = signedMoney(m.type, m.amount);
        return (
          '<li>' +
          movBadge(m.type, m.amount) +
          '<span class="activity-time">' +
          esc(timeOnly(m.createdAtUtc)) +
          '</span>' +
          '<span class="activity-amt ' +
          sm.cls +
          '">' +
          sm.html +
          '</span>' +
          '</li>'
        );
      })
      .join('');
    if (viewAll) {
      viewAll.hidden = !totalCount;
      viewAll.textContent = showFullMovements ? 'Hide full table ↑' : 'View all →';
    }
  }

  async function loadFullMovements() {
    var tbody = document.getElementById('movBody');
    var pager = document.getElementById('movPager');
    if (!tbody) return;
    tbody.innerHTML = skeletonTableRows(4, 4);

    var page = await fetchMovementsPaged(movPage, FULL_MOV_PAGE_SIZE);
    if (!page) page = fallbackPage(movPage, FULL_MOV_PAGE_SIZE);

    if (!page.items.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">No movements yet.</td></tr>';
    } else {
      tbody.innerHTML = page.items
        .map(function (m) {
          var sm = signedMoney(m.type, m.amount);
          return (
            '<tr><td>' +
            esc(dt(m.createdAtUtc)) +
            '</td><td>' +
            movBadge(m.type, m.amount) +
            '</td><td class="activity-amt ' +
            sm.cls +
            '">' +
            sm.html +
            '</td><td>' +
            esc(m.reason || '—') +
            '</td></tr>'
          );
        })
        .join('');
    }

    renderPager(pager, page, function (nextPage) {
      movPage = nextPage;
      loadFullMovements();
    });
    if (pager) pager.hidden = !showFullMovements;
  }

  function renderPager(el, page, onPage) {
    if (!el) return;
    el.innerHTML = '';
    if (!page || (!page.hasPrevious && !page.hasNext && (page.totalPages || 1) <= 1)) {
      if (page && page.totalCount > 0) {
        var metaOnly = document.createElement('span');
        metaOnly.className = 'pager-meta';
        metaOnly.textContent =
          'Page ' +
          (page.page || 1) +
          (page.totalPages ? ' of ' + page.totalPages : '') +
          ' · ' +
          page.totalCount +
          ' total' +
          (page.degraded ? ' (local)' : '');
        el.appendChild(metaOnly);
      }
      return;
    }
    var meta = document.createElement('span');
    meta.className = 'pager-meta';
    var totalPages =
      page.totalPages ||
      Math.max(1, Math.ceil((page.totalCount || 0) / (page.pageSize || HIST_PAGE_SIZE)) || 1);
    meta.textContent =
      'Page ' +
      (page.page || 1) +
      ' of ' +
      totalPages +
      ' · ' +
      (page.totalCount != null ? page.totalCount : '—') +
      ' total' +
      (page.degraded ? ' (local)' : '');
    el.appendChild(meta);

    var prev = document.createElement('button');
    prev.className = 'btn secondary';
    prev.type = 'button';
    prev.textContent = 'Previous';
    prev.disabled = !page.hasPrevious && (page.page || 1) <= 1;
    prev.onclick = function () {
      if ((page.page || 1) <= 1) return;
      onPage(Math.max(1, (page.page || 1) - 1));
    };
    el.appendChild(prev);

    var next = document.createElement('button');
    next.className = 'btn secondary';
    next.type = 'button';
    next.textContent = 'Next';
    next.disabled = !page.hasNext && (page.page || 1) >= totalPages;
    next.onclick = function () {
      onPage((page.page || 1) + 1);
    };
    el.appendChild(next);
  }

  document.getElementById('btnViewAllMov').addEventListener('click', async function () {
    showFullMovements = !showFullMovements;
    document.getElementById('fullMovWrap').hidden = !showFullMovements;
    document.getElementById('movPager').hidden = !showFullMovements;
    document.getElementById('btnViewAllMov').textContent = showFullMovements
      ? 'Hide full table ↑'
      : 'View all →';
    if (showFullMovements) {
      movPage = 1;
      await loadFullMovements();
    }
  });

  document.getElementById('btnOpenRecord').addEventListener('click', function () {
    openModal('recordModal');
  });

  document.getElementById('movForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!canOpen) {
      toast('Missing shift.open permission.', 'err');
      return;
    }
    var type = document.getElementById('movType').value;
    var amount = Number(document.getElementById('movAmount').value);
    var reason = document.getElementById('movReason').value.trim() || null;
    if (Number.isNaN(amount) || amount === 0) {
      toast('Enter a non-zero amount.', 'err');
      return;
    }
    if (type === 'paid_in' || type === 'paid_out') amount = Math.abs(amount);

    var btn = document.getElementById('btnAddMov');
    setBusy(btn, true);
    var res = await api('POST', '/shifts/current/movements', {
      type: type,
      amount: amount,
      reason: reason
    });
    setBusy(btn, false);
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }

    toast('Movement recorded.', 'ok');
    document.getElementById('movAmount').value = '';
    document.getElementById('movReason').value = '';
    closeModal('recordModal');

    // Partial refresh after confirmed success: Recent Activity + movement count only
    // (and full movements page if expanded). Do not refetch History / Open Drawers.
    if (res.data && res.data.status && res.data.id) {
      // Response is ShiftDto
      applyCurrentShift(res.data);
    } else if (res.data && res.data.type && movementsFallback) {
      movementsFallback.unshift(res.data);
    }
    await loadRecentMovements();
    if (showFullMovements) await loadFullMovements();
  });

  // ── Open summary (lazy) ────────────────────────────────────────
  async function loadOpenSummary(opts) {
    opts = opts || {};
    if (!canSeeMgrTabs) return;
    if (!opts.force && drawersLoaded) return;

    if (!canFinancial) {
      document.getElementById('summaryTotal').textContent = '—';
      document.getElementById('summaryBody').innerHTML =
        '<p class="muted">Requires <code>reports.financial.view</code> to load drawer totals.</p>';
      drawersLoaded = true;
      return;
    }

    document.getElementById('summaryBody').innerHTML = skeletonBlocks(4);

    var res = await api('GET', '/shifts/open-summary');
    if (res.status === 404 && res.data && res.data.title === 'FEATURE_DISABLED') {
      document.getElementById('summaryBody').textContent = problemMessage(res.data, res.status);
      return;
    }
    if (!res.ok) {
      document.getElementById('summaryBody').textContent = problemMessage(res.data, res.status);
      return;
    }
    clearShiftsDisabledBanner();
    drawersLoaded = true;
    var data = res.data || {};
    document.getElementById('summaryTotal').textContent = money(data.totalCashInDrawers);
    var opens = data.openShifts || [];
    if (!opens.length) {
      document.getElementById('summaryBody').innerHTML =
        '<p class="muted">' + esc(t(
          'No cash shift is open. Open a shift before taking cash payments.',
          'لا توجد وردية صندوق مفتوحة. افتح وردية قبل استلام الدفع النقدي.'
        )) + ' <a href="/dashboard/shifts/">' + esc(t('Open shift', 'افتح الوردية')) + '</a></p>';
      return;
    }
    document.getElementById('summaryBody').innerHTML =
      '<div class="table-wrap"><table><thead><tr><th>Staff</th><th>Opened</th><th>Float</th><th>Status</th></tr></thead><tbody>' +
      opens
        .map(function (s) {
          return (
            '<tr><td>' +
            esc(s.userName || s.userId) +
            '</td><td>' +
            esc(dt(s.openedAt)) +
            '</td><td class="hist-money">' +
            esc(money(s.openingFloat)) +
            '</td><td><span class="status-pill ' +
            esc(s.status) +
            '">' +
            esc(s.status) +
            '</span></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  // ── History (lazy, server-side page + filters) ──────────────────
  function ensureDefaultDates() {
    var fromEl = document.getElementById('histFrom');
    var toEl = document.getElementById('histTo');
    if (!fromEl.value && !toEl.value) {
      var to = new Date();
      var from = new Date();
      from.setDate(from.getDate() - 6);
      fromEl.value = fmtDateOnly(from);
      toEl.value = fmtDateOnly(to);
    }
  }

  function refreshStaffFilter(items) {
    var sel = document.getElementById('histStaff');
    var prev = sel.value;
    (items || []).forEach(function (s) {
      if (s.userId) staffOptions[s.userId] = s.userName || s.userId;
    });
    var opts = '<option value="">All staff</option>';
    Object.keys(staffOptions)
      .sort(function (a, b) {
        return String(staffOptions[a]).localeCompare(String(staffOptions[b]));
      })
      .forEach(function (id) {
        opts +=
          '<option value="' +
          esc(id) +
          '"' +
          (prev === id ? ' selected' : '') +
          '>' +
          esc(staffOptions[id]) +
          '</option>';
      });
    sel.innerHTML = opts;
  }

  function historyRowHtml(s) {
    var actions = [];
    if (canFinancial) {
      actions.push(
        '<a class="btn secondary" href="/dashboard/z-report/?shiftId=' +
          encodeURIComponent(s.id) +
          '">' +
          esc(t('Z-Report', 'تقرير Z')) +
          '</a>'
      );
    }
    if (s.status === 'closed' && canApprove) {
      actions.push(
        '<button class="btn secondary" type="button" data-approve="' +
          esc(s.id) +
          '">' +
          esc(t('Approve', 'اعتماد')) +
          '</button>'
      );
    }
    if (s.status === 'open' && isManagerPlus) {
      actions.push(
        '<button class="btn danger" type="button" data-force="' +
          esc(s.id) +
          '" data-force-name="' +
          esc(s.userName || s.userId) +
          '">' +
          esc(t('Force close', 'قفل قسري')) +
          '</button>'
      );
    }
    return (
      '<tr data-shift-id="' +
      esc(s.id) +
      '">' +
      '<td>' +
      esc(s.userName || s.userId) +
      '</td>' +
      '<td>' +
      esc(dt(s.openedAt)) +
      '</td>' +
      '<td data-col="closed">' +
      esc(dt(s.closedAt)) +
      '</td>' +
      '<td class="hist-money">' +
      esc(money(s.openingFloat)) +
      '</td>' +
      '<td class="hist-money" data-col="expected">' +
      esc(s.status === 'open' ? t('Hidden', 'مخفي') : money(s.expectedCash)) +
      '</td>' +
      '<td class="hist-money" data-col="counted">' +
      esc(money(s.countedCash)) +
      '</td>' +
      '<td data-col="variance">' +
      (s.status === 'open' ? '—' : varianceHtml(s.variance)) +
      '</td>' +
      '<td data-col="status"><span class="status-pill ' +
      esc(s.status) +
      '">' +
      esc(shiftStatusLabel(s.status)) +
      '</span></td>' +
      '<td class="action-gap" data-col="actions">' +
      actions.join('') +
      '</td>' +
      '</tr>'
    );
  }

  function rowByShiftId(id) {
    return document.querySelector('tr[data-shift-id="' + String(id).replace(/"/g, '') + '"]');
  }

  function bindHistoryRowActions(scope) {
    (scope || document).querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-approve');
        setBusy(btn, true);
        var res2 = await api('POST', '/shifts/' + encodeURIComponent(id) + '/approve', {
          note: null
        });
        if (!res2.ok) {
          setBusy(btn, false);
          toast(problemMessage(res2.data, res2.status), 'err');
          return;
        }
        toast('Shift approved.', 'ok');
        // Partial: update this row only after confirmed success (no optimistic change)
        if (res2.data && res2.data.status && res2.data.id) {
          if (!patchHistoryRowFromShift(res2.data)) {
            await loadHistory({ force: true });
          }
          return;
        }
        var row = rowByShiftId(id);
        if (!row) {
          await loadHistory({ force: true });
          return;
        }
        var statusCell = row.querySelector('[data-col="status"]');
        var actionsCell = row.querySelector('[data-col="actions"]');
        if (statusCell) {
          statusCell.innerHTML = '<span class="status-pill approved">approved</span>';
        }
        if (actionsCell) actionsCell.innerHTML = '';
      });
    });

    (scope || document).querySelectorAll('[data-force]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        forceCloseId = btn.getAttribute('data-force');
        var name = btn.getAttribute('data-force-name') || '';
        document.getElementById('forceCloseTarget').textContent = name
          ? 'Staff: ' + name
          : '';
        openModal('forceCloseModal');
      });
    });
  }

  function patchHistoryRowFromShift(s) {
    if (!s || !s.id) return false;
    var row = rowByShiftId(s.id);
    if (!row) return false;
    row.outerHTML = historyRowHtml(s);
    var next = rowByShiftId(s.id);
    if (next) bindHistoryRowActions(next);
    return true;
  }

  async function loadHistory(opts) {
    opts = opts || {};
    if (!canSeeMgrTabs) return;
    if (!opts.force && historyLoaded) return;

    ensureDefaultDates();
    var from = document.getElementById('histFrom').value;
    var to = document.getElementById('histTo').value;
    var staffId = document.getElementById('histStaff').value;
    var q = new URLSearchParams({ page: String(histPage), pageSize: String(HIST_PAGE_SIZE) });
    // Contracted names + Part 2 aliases (backend accepts either)
    if (from) {
      q.set('from', from);
      q.set('startDate', from);
    }
    if (to) {
      q.set('to', to);
      q.set('endDate', to);
    }
    if (staffId) {
      q.set('userId', staffId);
      q.set('staffId', staffId);
    }

    var tbody = document.getElementById('histBody');
    tbody.innerHTML = skeletonTableRows(9, 5);
    document.getElementById('histPager').innerHTML = '';

    var res = await api('GET', '/shifts?' + q.toString());
    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="muted">' +
        esc(problemMessage(res.data, res.status)) +
        '</td></tr>';
      return;
    }

    historyLoaded = true;
    var page = normalizePaged(res.data, histPage, HIST_PAGE_SIZE) || {
      items: (res.data && res.data.items) || [],
      page: histPage,
      pageSize: HIST_PAGE_SIZE,
      totalCount: 0,
      hasNext: false,
      hasPrevious: false
    };
    var items = page.items || [];
    refreshStaffFilter(items);
    // No client-side staff filter — server applies userId/staffId under RLS

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="muted">No shifts in range.</td></tr>';
    } else {
      tbody.innerHTML = items.map(historyRowHtml).join('');
      bindHistoryRowActions(tbody);
    }

    // Derive hasNext/hasPrevious if API omitted flags but sent totalCount
    if (page.totalCount != null && page.hasNext == null) {
      var tp = Math.max(1, Math.ceil(page.totalCount / (page.pageSize || HIST_PAGE_SIZE)) || 1);
      page.totalPages = page.totalPages || tp;
      page.hasNext = histPage < tp;
      page.hasPrevious = histPage > 1;
      page.page = histPage;
    } else {
      page.page = page.page || histPage;
      if (page.hasPrevious == null) page.hasPrevious = histPage > 1;
    }

    renderPager(document.getElementById('histPager'), page, function (nextPage) {
      histPage = nextPage;
      loadHistory({ force: true });
    });
  }

  document.getElementById('btnConfirmForce').addEventListener('click', async function () {
    if (!forceCloseId) return;
    var btn = document.getElementById('btnConfirmForce');
    var closedId = forceCloseId;
    setBusy(btn, true);
    var res2 = await api('POST', '/shifts/' + encodeURIComponent(closedId) + '/force-close');
    setBusy(btn, false);
    if (!res2.ok) {
      toast(problemMessage(res2.data, res2.status), 'err');
      return;
    }
    toast('Shift force-closed.', 'ok');
    forceCloseId = null;
    closeModal('forceCloseModal');

    // Partial: History row + Open Drawers Summary (no full page reload)
    if (res2.data && res2.data.id && res2.data.status) {
      if (historyLoaded && !patchHistoryRowFromShift(res2.data)) {
        await loadHistory({ force: true });
      }
    } else if (historyLoaded) {
      var row = rowByShiftId(closedId);
      if (row) {
        var closedCell = row.querySelector('[data-col="closed"]');
        var statusCell = row.querySelector('[data-col="status"]');
        var actionsCell = row.querySelector('[data-col="actions"]');
        var expectedCell = row.querySelector('[data-col="expected"]');
        if (closedCell) closedCell.textContent = dt(new Date().toISOString());
        if (statusCell) {
          statusCell.innerHTML = '<span class="status-pill closed">closed</span>';
        }
        if (expectedCell) expectedCell.textContent = '—';
        if (actionsCell) actionsCell.innerHTML = '';
      } else {
        await loadHistory({ force: true });
      }
    }
    await loadOpenSummary({ force: true });
    // If the force-closed shift was mine, refresh Current Shift only
    if (currentShift && String(currentShift.id) === String(closedId)) {
      await loadCurrent();
    }
  });

  document.getElementById('btnHistLoad').addEventListener('click', function () {
    histPage = 1;
    loadHistory({ force: true });
  });

  // Re-query when filters change (still server-side; no full page reload)
  ['histFrom', 'histTo', 'histStaff'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      if (!historyLoaded && activeTab !== 'history') return;
      histPage = 1;
      loadHistory({ force: true });
    });
  });

  document.getElementById('btnRefresh').addEventListener('click', async function () {
    // Refresh only the active tab’s section(s)
    if (activeTab === 'my') {
      await loadCurrent();
    } else if (activeTab === 'drawers') {
      await loadOpenSummary({ force: true });
    } else if (activeTab === 'history') {
      await loadHistory({ force: true });
    }
  });

  // Live Refresh: keep the open shift's cash view in sync with other desks (no-op if hub is down)
  if (window.GfpLive && window.GfpLive.on) {
    GfpLive.on(['shifts', 'sales', 'payments', 'refunds'], GfpLive.debounce(function () {
      loadCurrent();
      loadRecentMovements();
    }, 500));
  }

  // boot — Current Shift first; manager tabs lazy on activation
  setupTabs();
  ensureDefaultDates();
  loadCurrent();
  if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) {
    window.GfpI18n.applyDocumentLocale();
  }
})();
