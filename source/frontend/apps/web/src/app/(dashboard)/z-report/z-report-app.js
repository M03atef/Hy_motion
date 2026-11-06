(function (global) {
  'use strict';
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH(opts) {
    const t = getToken();
    const h = { 'ngrok-skip-browser-warning': 'true' };
    if (!(opts && opts.noJson)) h['Content-Type'] = 'application/json';
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
  const canView = perms.has('reports.financial.view') || /Owner|Manager/i.test(role);

  if (!user || !getToken()) {
    location.href = '/auth/login/';
    return;
  }
  document.getElementById('userAvatar').textContent = (user.fullName || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  document.getElementById('userName').textContent = user.fullName || 'User';
  document.getElementById('userRole').textContent = user.role || 'Staff';
  document.getElementById('btnLogout').onclick = function () {
    ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    location.href = '/auth/login/';
  };

  let current = null;
  const params = new URLSearchParams(location.search);
  let shiftId = params.get('shiftId') || '';
  let rangePreset = 'last7';
  const PAGE_SIZE = 25;
  let listPage = 1;
  let listRowHtmls = [];
  let lastListCsv = [];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(n));
  }
  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function cairoParts(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const parts = {};
    fmt.formatToParts(d).forEach((p) => {
      parts[p.type] = p.value;
    });
    return parts;
  }
  function dt(iso) {
    const p = cairoParts(iso);
    if (!p) return iso ? esc(iso) : '—';
    return p.day + ' ' + p.month + ' ' + p.year + ' · ' + p.hour + ':' + p.minute + ' ' + p.dayPeriod;
  }
  function windowLabel(opened, closed) {
    const a = cairoParts(opened);
    if (!a) return '—';
    const date = a.day + ' ' + a.month + ' ' + a.year;
    const start = a.hour + ':' + a.minute + ' ' + a.dayPeriod;
    if (!closed) return date + ' · ' + start + ' – ' + t('Open', 'مفتوح');
    const b = cairoParts(closed);
    if (!b) return date + ' · ' + start;
    return date + ' · ' + start + ' – ' + b.hour + ':' + b.minute + ' ' + b.dayPeriod;
  }
  function statusLabel(s) {
    if (s === 'open') return t('Open', 'مفتوح');
    if (s === 'approved') return t('Approved', 'معتمد');
    if (s === 'closed') return t('Closed', 'مغلق');
    return s || '—';
  }
  function methodLabel(m) {
    const map = {
      cash: t('Cash', 'كاش'),
      card_paymob: t('Card (Paymob)', 'بطاقة (بايموب)'),
      fawry: t('Fawry', 'فوري'),
      vodafone: t('Vodafone', 'فودافون كاش'),
      instapay: t('Instapay', 'إنستا باي'),
      account_credit: t('Credit', 'رصيد الحساب'),
    };
    return map[m] || m || '—';
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function safeError(status) {
    if (!canView || status === 403) return t("You don't have permission to view this report.", 'ليس لديك صلاحية لعرض هذا التقرير.');
    return t("We couldn't load this report.", 'تعذّر تحميل هذا التقرير.');
  }
  function parseYmd(s) {
    const p = String(s || '').split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function fmtShort(s) {
    const d = parseYmd(s);
    if (!d) return s || '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function setRangeLabel() {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    let text = fmtShort(from) + ' – ' + fmtShort(to);
    if (rangePreset === 'last7') text = t('Last 7 days', 'آخر 7 أيام');
    else if (rangePreset === 'last30') text = t('Last 30 days', 'آخر 30 يومًا');
    else if (rangePreset === 'thisMonth') text = t('This month', 'هذا الشهر');
    document.getElementById('rangeLabel').textContent = text;
    document.querySelectorAll('#rangePop .range-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === rangePreset);
    });
  }
  function applyPreset(preset) {
    rangePreset = preset;
    const cairoDates = global.GfpCairoDates;
    if (cairoDates && cairoDates.presetRange) {
      const range = cairoDates.presetRange(preset);
      document.getElementById('dateFrom').value = range.from;
      document.getElementById('dateTo').value = range.to;
    } else {
      const now = new Date();
      if (preset === 'last7') {
        const fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 6);
        document.getElementById('dateFrom').value = ymd(fromD);
        document.getElementById('dateTo').value = ymd(now);
      } else if (preset === 'last30') {
        const fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 29);
        document.getElementById('dateFrom').value = ymd(fromD);
        document.getElementById('dateTo').value = ymd(now);
      } else if (preset === 'thisMonth') {
        document.getElementById('dateFrom').value = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
        document.getElementById('dateTo').value = ymd(now);
      }
    }
    setRangeLabel();
  }
  function closePops() {
    document.getElementById('rangePop').hidden = true;
    document.getElementById('btnRange').setAttribute('aria-expanded', 'false');
  }
  function stampColLabels(sel) {
    const table = document.querySelector(sel);
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        td.setAttribute('data-col', headers[i] || '');
      });
    });
  }
  async function apiJson(method, path) {
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

  function syncUrl() {
    const url = new URL(location.href);
    if (shiftId) url.searchParams.set('shiftId', shiftId);
    else url.searchParams.delete('shiftId');
    history.replaceState({}, '', url);
  }

  function showListChrome() {
    document.getElementById('crumb').innerHTML =
      '<span>' + esc(t('Shifts', 'الورديات')) + '</span><span class="sep">/</span><span class="current">' + esc(t('Z-Reports', 'تقارير Z')) + '</span>';
    document.getElementById('pageTitle').textContent = t('Z-Reports', 'تقارير Z');
    document.getElementById('pageSub').textContent =
      t('What happened during each shift, and can the cash be reconciled?', 'إيه اللي حصل خلال كل وردية، وهل النقدية اتسوّت؟');
    document.getElementById('pageStaff').hidden = true;
    document.getElementById('pageWindow').hidden = true;
    document.getElementById('btnBack').href = '/dashboard/shifts/';
    document.getElementById('btnBack').innerHTML = '<i class="ti ti-arrow-left"></i> ' + esc(t('Shifts', 'الورديات'));
    document.getElementById('listFilters').hidden = false;
    document.getElementById('btnExport').hidden = false;
    document.getElementById('btnPrint').hidden = true;
    document.getElementById('btnPdf').hidden = true;
    document.getElementById('listError').hidden = true;
    document.getElementById('detailError').hidden = true;
    document.getElementById('viewList').hidden = false;
    document.getElementById('viewDetail').hidden = true;
  }

  function showDetailChrome(r) {
    document.getElementById('crumb').innerHTML =
      '<span>' + esc(t('Shifts', 'الورديات')) + '</span><span class="sep">/</span><a href="/dashboard/z-report/">' + esc(t('Z-Reports', 'تقارير Z')) + '</a><span class="sep">/</span><span class="current">' + esc(t('Z-Report', 'تقرير Z')) + '</span>';
    document.getElementById('pageTitle').textContent = t('Z-Report', 'تقرير Z');
    document.getElementById('pageSub').textContent = t('Shift closing', 'إغلاق الوردية');
    document.getElementById('pageStaff').hidden = false;
    document.getElementById('pageStaff').textContent = r.staffName || t('Staff', 'الموظف');
    document.getElementById('pageWindow').hidden = false;
    document.getElementById('pageWindow').textContent = windowLabel(r.openedAt, r.closedAt);
    document.getElementById('btnBack').href = '/dashboard/z-report/';
    document.getElementById('btnBack').innerHTML = '<i class="ti ti-arrow-left"></i> ' + esc(t('Z-Reports', 'تقارير Z'));
    document.getElementById('listFilters').hidden = true;
    document.getElementById('btnExport').hidden = true;
    document.getElementById('btnPrint').hidden = false;
    document.getElementById('btnPdf').hidden = false;
    document.getElementById('btnPdf').disabled = !canView;
    document.getElementById('listError').hidden = true;
    document.getElementById('detailError').hidden = true;
    document.getElementById('zDoc').hidden = false;
    document.getElementById('viewList').hidden = true;
    document.getElementById('viewDetail').hidden = false;
  }

  function kpi(label, value, extra) {
    return (
      '<div class="z-kpi' +
      (extra || '') +
      '"><div class="l">' +
      esc(label) +
      '</div><div class="v">' +
      value +
      '</div></div>'
    );
  }
  function dl(rows) {
    return rows
      .map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>')
      .join('');
  }

  function renderDetail(r) {
    current = r;
    showDetailChrome(r);
    document.getElementById('zDoc').hidden = false;
    document.getElementById('detailError').hidden = true;

    const closed = document.getElementById('closedBanner');
    const openNote = document.getElementById('openNote');
    closed.hidden = !r.isFinal;
    openNote.hidden = r.status !== 'open';
    document.getElementById('closedWhen').textContent = r.closedAt
      ? t('Closed', 'أُغلقت') + ' ' + dt(r.closedAt)
      : '';

    document.getElementById('shiftInfo').innerHTML = dl([
      [t('Shift', 'الوردية'), esc(r.staffName) + ' · ' + dt(r.openedAt)],
      [t('Staff', 'الموظف'), esc(r.staffName)],
      [t('Opened at', 'وقت الفتح'), dt(r.openedAt)],
      [t('Closed at', 'وقت الإغلاق'), r.closedAt ? dt(r.closedAt) : t('Open', 'مفتوح')],
      [t('Status', 'الحالة'), '<span class="st ' + esc(r.status) + '">' + esc(statusLabel(r.status)) + '</span>'],
    ]);

    document.getElementById('salesKpis').innerHTML =
      kpi(t('Gross sales', 'إجمالي المبيعات'), esc(money(r.grossSales))) +
      kpi(t('Discounts', 'الخصومات'), esc(money(r.discounts))) +
      kpi(t('Refunds', 'المرتجعات'), esc(money(r.refunds))) +
      kpi(t('Net sales', 'صافي المبيعات'), esc(money(r.netSales)), ' is-net') +
      kpi(t('Transactions', 'المعاملات'), String(r.transactionCount || 0));

    const methods = r.methods || [];
    document.getElementById('methodBody').innerHTML = methods.length
      ? methods
          .map(
            (m) =>
              '<tr><td>' +
              esc(methodLabel(m.method)) +
              '</td><td>' +
              esc(String(m.count)) +
              '</td><td class="amt">' +
              esc(money(m.total)) +
              '</td></tr>',
          )
          .join('')
      : '<tr><td colspan="3" class="muted">' + esc(t('No payments on this shift', 'لا توجد مدفوعات في هذه الوردية')) + '</td></tr>';

    const hero = document.getElementById('cashHero');
    if (r.revealCash) {
      const diff = Number(r.difference);
      let diffCls = '';
      if (!Number.isNaN(diff) && r.difference != null) {
        if (diff < 0) diffCls = ' is-neg';
        else if (diff > 0) diffCls = ' is-pos';
      }
      hero.innerHTML =
        '<div class="box"><div class="l">' + esc(t('Expected cash', 'النقدية المتوقعة')) + '</div><div class="v">' +
        esc(money(r.expectedCash)) +
        '</div></div>' +
        '<div class="box"><div class="l">' + esc(t('Counted cash', 'النقدية المحسوبة')) + '</div><div class="v">' +
        esc(money(r.countedCash)) +
        '</div></div>' +
        '<div class="box is-diff' +
        diffCls +
        '"><div class="l">' + esc(t('Difference', 'الفرق')) + '</div><div class="v">' +
        esc(money(r.difference)) +
        '</div></div>';
    } else {
      hero.innerHTML =
        '<div class="box"><div class="l">' + esc(t('Expected cash', 'النقدية المتوقعة')) + '</div><div class="v">' + esc(t('Hidden', 'مخفي')) + '</div></div>' +
        '<div class="box"><div class="l">' + esc(t('Counted cash', 'النقدية المحسوبة')) + '</div><div class="v">—</div></div>' +
        '<div class="box"><div class="l">' + esc(t('Difference', 'الفرق')) + '</div><div class="v">—</div></div>';
    }

    const cashRows = [
      [t('Opening cash', 'رصيد الفتح'), money(r.openingCash)],
      [t('Cash sales', 'مبيعات نقدية'), money(r.cashSales)],
      [t('Cash refunds', 'مرتجعات نقدية'), money(r.cashRefunds)],
      [t('Cash expenses', 'مصروفات نقدية'), money(r.cashExpenses)],
    ];
    if (Number(r.cashPaidIn)) cashRows.push([t('Paid in', 'وارد نقدي'), money(r.cashPaidIn)]);
    if (Number(r.floatAdjust)) cashRows.push([t('Float adjust', 'تعديل العهدة'), money(r.floatAdjust)]);
    cashRows.push([t('Expected cash', 'النقدية المتوقعة'), r.revealCash ? money(r.expectedCash) : t('Hidden', 'مخفي')]);
    cashRows.push([t('Counted cash', 'النقدية المحسوبة'), r.revealCash ? money(r.countedCash) : '—']);
    cashRows.push([t('Cash difference', 'فرق النقدية'), r.revealCash ? money(r.difference) : '—']);
    document.getElementById('cashLines').innerHTML = dl(cashRows.map(([k, v]) => [k, esc(v)]));

    const cats = [
      [t('Memberships', 'الاشتراكات'), r.membershipCount, r.memberships],
      [t('Renewals', 'التجديدات'), r.renewalCount, r.renewals],
      [t('Products', 'المنتجات'), r.productCount, r.products],
      [t('Other', 'أخرى'), r.otherCount, r.other],
    ].filter((c) => Number(c[1]) > 0 || Number(c[2]) !== 0);
    document.getElementById('breakBody').innerHTML = cats.length
      ? cats
          .map(
            ([name, n, amt]) =>
              '<tr><td>' +
              esc(name) +
              '</td><td>' +
              esc(String(n || 0)) +
              '</td><td class="amt">' +
              esc(money(amt)) +
              '</td></tr>',
          )
          .join('')
      : '<tr><td colspan="3" class="muted">' + esc(t('No sale lines on this shift', 'لا توجد بنود بيع في هذه الوردية')) + '</td></tr>';

    document.getElementById('activityDl').innerHTML = dl([
      [t('Transactions', 'المعاملات'), String(r.transactionCount || 0)],
      [t('Refunds', 'المرتجعات'), String(r.refundCount || 0)],
      [t('Discounts', 'الخصومات'), String(r.discountCount || 0)],
    ]);
    document.querySelectorAll('#viewDetail .rpt-table').forEach((table) => stampColLabelsTable(table));
  }

  function stampColLabelsTable(table) {
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        td.setAttribute('data-col', headers[i] || '');
      });
    });
  }

  function showListSkeleton() {
    document.getElementById('listEmpty').hidden = true;
    document.getElementById('listError').hidden = true;
    document.getElementById('listWrap').hidden = false;
    document.getElementById('listPager').hidden = true;
    document.getElementById('listBody').innerHTML = Array.from({ length: 6 }, () => {
      return (
        '<tr>' +
        Array.from({ length: 7 }, () => '<td><div class="sk-block"></div></td>').join('') +
        '</tr>'
      );
    }).join('');
  }

  function paintListPage() {
    const total = listRowHtmls.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    if (listPage > pages) listPage = pages;
    const start = (listPage - 1) * PAGE_SIZE;
    document.getElementById('listBody').innerHTML = listRowHtmls.slice(start, start + PAGE_SIZE).join('');
    stampColLabels('#listWrap table');
    document.querySelectorAll('#listBody tr[data-shift]').forEach((tr) => {
      tr.onclick = () => {
        shiftId = tr.getAttribute('data-shift') || '';
        syncUrl();
        loadDetail();
      };
    });
    const pager = document.getElementById('listPager');
    if (total <= PAGE_SIZE) {
      pager.hidden = true;
      pager.innerHTML = '';
      return;
    }
    pager.hidden = false;
    const from = start + 1;
    const to = Math.min(total, start + PAGE_SIZE);
    pager.innerHTML =
      '<span class="pager-meta">' +
      from +
      '–' +
      to +
      ' ' + esc(t('of', 'من')) + ' ' +
      total +
      '</span>' +
      '<button type="button" class="btn secondary" id="zPgPrev"' +
      (listPage <= 1 ? ' disabled' : '') +
      '>' + esc(t('Prev', 'السابق')) + '</button>' +
      '<button type="button" class="btn secondary" id="zPgNext"' +
      (listPage >= pages ? ' disabled' : '') +
      '>' + esc(t('Next', 'التالي')) + '</button>';
    document.getElementById('zPgPrev').onclick = () => {
      listPage -= 1;
      paintListPage();
    };
    document.getElementById('zPgNext').onclick = () => {
      listPage += 1;
      paintListPage();
    };
  }

  async function loadList() {
    showListChrome();
    showListSkeleton();
    lastListCsv = [];
    listRowHtmls = [];
    if (!canView) {
      document.getElementById('listWrap').hidden = true;
      document.getElementById('listEmpty').hidden = true;
      document.getElementById('listError').hidden = false;
      return;
    }
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    const res = await apiJson('GET', '/reports/z/shifts?from=' + from + '&to=' + to);
    if (!res.ok) {
      document.getElementById('listWrap').hidden = true;
      document.getElementById('listEmpty').hidden = true;
      document.getElementById('listError').hidden = false;
      return;
    }
    const items = (res.data && res.data.items) || [];
    if (!items.length) {
      document.getElementById('listWrap').hidden = true;
      document.getElementById('listPager').hidden = true;
      document.getElementById('listEmpty').hidden = false;
      lastListCsv = [
        [t('Report', 'التقرير'), t('Z-Reports', 'تقارير Z')],
        [t('From', 'من'), from],
        [t('To', 'إلى'), to],
        [],
        [t('Staff', 'الموظف'), t('Opened', 'الافتتاح'), t('Closed', 'الإغلاق'), t('Sales', 'المبيعات'), t('Refunds', 'المرتجعات'), t('Difference', 'الفرق'), t('Status', 'الحالة')],
      ];
      return;
    }
    lastListCsv = [
      [t('Report', 'التقرير'), t('Z-Reports', 'تقارير Z')],
      [t('From', 'من'), from],
      [t('To', 'إلى'), to],
      [],
      [t('Staff', 'الموظف'), t('Opened', 'الافتتاح'), t('Closed', 'الإغلاق'), t('Sales', 'المبيعات'), t('Refunds', 'المرتجعات'), t('Difference', 'الفرق'), t('Status', 'الحالة')],
    ].concat(
      items.map((s) => [
        s.staffName,
        dt(s.openedAt),
        s.closedAt ? dt(s.closedAt) : t('Open', 'مفتوح'),
        (Number(s.sales) || 0).toFixed(2),
        (Number(s.refunds) || 0).toFixed(2),
        s.status === 'open' || s.difference == null ? '' : Number(s.difference).toFixed(2),
        statusLabel(s.status),
      ]),
    );
    listRowHtmls = items.map((s) => {
      const diff = s.difference;
      let diffHtml = '—';
      let diffCls = '';
      if (s.status !== 'open' && diff != null) {
        diffCls = Number(diff) < 0 ? 'diff-neg' : Number(diff) > 0 ? 'diff-pos' : '';
        diffHtml = money(diff);
      }
      return (
        '<tr data-shift="' +
        esc(s.shiftId) +
        '"><td>' +
        esc(s.staffName) +
        '</td><td>' +
        dt(s.openedAt) +
        '</td><td>' +
        (s.closedAt ? dt(s.closedAt) : esc(t('Open', 'مفتوح'))) +
        '</td><td class="amt">' +
        money(s.sales) +
        '</td><td class="amt">' +
        money(s.refunds) +
        '</td><td class="amt ' +
        diffCls +
        '">' +
        diffHtml +
        '</td><td><span class="st ' +
        esc(s.status) +
        '">' +
        esc(statusLabel(s.status)) +
        '</span></td></tr>'
      );
    });
    document.getElementById('listEmpty').hidden = true;
    document.getElementById('listWrap').hidden = false;
    listPage = 1;
    paintListPage();
  }

  async function loadDetail() {
    if (!shiftId) {
      await loadList();
      return;
    }
    document.getElementById('viewList').hidden = true;
    document.getElementById('viewDetail').hidden = false;
    document.getElementById('zDoc').hidden = true;
    document.getElementById('detailError').hidden = true;
    document.getElementById('listFilters').hidden = true;
    document.getElementById('btnExport').hidden = true;
    if (!canView) {
      document.getElementById('detailError').hidden = false;
      return;
    }
    const res = await apiJson('GET', '/reports/z/shifts/' + encodeURIComponent(shiftId));
    if (!res.ok) {
      document.getElementById('zDoc').hidden = true;
      document.getElementById('detailError').hidden = false;
      document.getElementById('pageTitle').textContent = t('Z-Report', 'تقرير Z');
      document.getElementById('btnBack').href = '/dashboard/z-report/';
      document.getElementById('btnBack').innerHTML = '<i class="ti ti-arrow-left"></i> ' + esc(t('Z-Reports', 'تقارير Z'));
      document.getElementById('btnPrint').hidden = true;
      document.getElementById('btnPdf').hidden = true;
      return;
    }
    renderDetail(res.data);
  }

  async function downloadPdf() {
    if (!shiftId) return;
    const res = await fetch(API_BASE + '/reports/z/shifts/' + encodeURIComponent(shiftId) + '/pdf', {
      method: 'GET',
      headers: getH({ noJson: true }),
    });
    if (res.status === 401) {
      location.href = '/auth/login/';
      return;
    }
    if (!res.ok) {
      toast(t("We couldn't export this PDF. Try again.", 'تعذّر تصدير ملف PDF. حاول تاني.'), 'err');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'z-report-shift.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(t('PDF downloaded.', 'تم تنزيل ملف PDF.'), 'ok');
  }

  function exportListCsv() {
    if (!lastListCsv.length) {
      toast(t('Nothing to export', 'لا يوجد ما يمكن تصديره'), 'err');
      return;
    }
    const csv = lastListCsv
      .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'z-reports.csv';
    a.click();
    toast(t('CSV exported', 'تم تصدير ملف CSV'));
  }

  (function initDates() {
    applyPreset('last7');
  })();

  document.getElementById('btnRange').onclick = (ev) => {
    ev.stopPropagation();
    const pop = document.getElementById('rangePop');
    const open = pop.hidden;
    closePops();
    if (open) {
      pop.hidden = false;
      document.getElementById('btnRange').setAttribute('aria-expanded', 'true');
    }
  };
  document.querySelectorAll('#rangePop .range-opt').forEach((btn) => {
    btn.onclick = () => {
      applyPreset(btn.getAttribute('data-preset'));
      closePops();
      shiftId = '';
      syncUrl();
      loadList();
    };
  });
  document.getElementById('btnApply').onclick = () => {
    rangePreset = 'custom';
    setRangeLabel();
    closePops();
    shiftId = '';
    syncUrl();
    loadList();
  };
  document.getElementById('btnChangeDate').onclick = (ev) => {
    ev.stopPropagation();
    document.getElementById('rangePop').hidden = false;
    document.getElementById('btnRange').setAttribute('aria-expanded', 'true');
  };
  document.getElementById('btnRetryList').onclick = () => loadList();
  document.getElementById('btnRetryDetail').onclick = () => loadDetail();
  document.getElementById('btnExport').onclick = exportListCsv;
  document.getElementById('btnPrint').onclick = () => window.print();
  document.getElementById('btnPdf').onclick = downloadPdf;
  document.getElementById('btnBack').addEventListener('click', (ev) => {
    if (!shiftId) return;
    ev.preventDefault();
    shiftId = '';
    syncUrl();
    loadList();
  });
  document.getElementById('crumb').addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;
    ev.preventDefault();
    shiftId = '';
    syncUrl();
    loadList();
  });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.range-wrap')) return;
    closePops();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closePops();
  });

  window.addEventListener('gfp:locale', function () {
    if (shiftId) loadDetail();
    else loadList();
  });

  (async () => {
    try {
      const r = await fetch(API_BASE + '/settings', { headers: getH() });
      if (r.ok) {
        const s = await r.json();
        document.getElementById('gymName').textContent = s.gymName || '';
      }
    } catch (_) {}
    if (shiftId) await loadDetail();
    else await loadList();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
