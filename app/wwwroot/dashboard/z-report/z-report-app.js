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
    var v = Number(n);
    var s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)); return '⁨' + (v < 0 ? '-EGP ' : 'EGP ') + s + '⁩';
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
    document.getElementById('pageAvatar').hidden = true;
    document.getElementById('pageStatus').hidden = true;
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
    document.getElementById('pageWindow').innerHTML =
      '<span class="num">' + esc(windowLabel(r.openedAt, r.closedAt)) + '</span>';
    const avatar = document.getElementById('pageAvatar');
    avatar.hidden = false;
    avatar.textContent = (r.staffName || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const chip = document.getElementById('pageStatus');
    if (r.status === 'open') {
      chip.className = 'z-stchip warn';
      chip.textContent = t('Shift open', 'وردية مفتوحة');
    } else if (r.status === 'approved') {
      chip.className = 'z-stchip ok';
      chip.textContent = t('Approved', 'معتمدة');
    } else {
      chip.className = 'z-stchip ok';
      chip.textContent = t('Shift closed', 'وردية مقفولة');
    }
    chip.hidden = false;
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

  function kpi(icon, label, value, foot, extra) {
    return (
      '<div class="z-kpi' +
      (extra || '') +
      '"><div class="top"><i class="ti ' +
      icon +
      '"></i><span class="l">' +
      esc(label) +
      '</span></div><div class="v num">' +
      value +
      '</div>' +
      (foot ? '<div class="foot">' + foot + '</div>' : '') +
      '</div>'
    );
  }
  function moneyTxt(n) {
    return '<span class="num">' + esc(money(n)) + '</span>';
  }
  function badge(icon, label, cls) {
    return '<span class="z-badge ' + cls + '"><span class="pi"><i class="ti ' + icon + '"></i></span>' + esc(label) + '</span>';
  }
  function shareBar(pct) {
    return '<div class="z-share"><span class="bar"><i style="width:' + pct + '%"></i></span><span class="num">' + pct + '%</span></div>';
  }
  function methodIcon(m) {
    if (m === 'cash') return 'ti-cash';
    if (m === 'card_paymob') return 'ti-credit-card';
    return 'ti-wallet';
  }
  function methodBadgeCls(m) {
    if (m === 'cash') return 'is-cash';
    if (m === 'card_paymob' || m === 'fawry' || m === 'vodafone' || m === 'instapay') return 'is-digital';
    return 'is-credit';
  }
  function lrow(op, label, sub, value, cls) {
    const glyph = op === 'add' ? '+' : op === 'sub' ? '−' : op === 'res' ? '=' : '·';
    return (
      '<div class="z-lrow' + (cls || '') + '">' +
      '<span class="z-op ' + op + '">' + glyph + '</span>' +
      '<span class="ll">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<span class="lv num">' + esc(value) + '</span></div>'
    );
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
    document.getElementById('closedWhen').textContent = r.closedAt ? dt(r.closedAt) : '';

    // ── ملخص المبيعات ──
    const refundFoot = Number(r.cashRefunds)
      ? t('of which cash', 'منها نقدي') + ' ' + moneyTxt(r.cashRefunds)
      : t('none', 'لا يوجد');
    const discountFoot = Number(r.discountCount)
      ? '<b class="num">' + esc(String(r.discountCount)) + '</b> ' + esc(t('applied', 'خصم مطبق'))
      : t('none', 'لا يوجد');
    const txFoot = Number(r.refundCount)
      ? t('incl.', 'منها') + ' <b class="num">' + esc(String(r.refundCount)) + '</b> ' + esc(t('refund', 'مرتجع'))
      : t('all sales', 'كلها مبيعات');
    document.getElementById('salesKpis').innerHTML =
      kpi('ti-receipt', t('Gross sales', 'إجمالي المبيعات'), esc(money(r.grossSales)), t('before discounts & refunds', 'قبل الخصومات والمرتجعات')) +
      kpi('ti-discount-2', t('Discounts', 'الخصومات'), esc(money(r.discounts)), discountFoot) +
      kpi('ti-arrow-back-up', t('Refunds', 'المرتجعات'), esc(money(r.refunds)), refundFoot) +
      kpi('ti-coins', t('Net sales', 'صافي المبيعات'), esc(money(r.netSales)), t('gross − discounts − refunds', 'إجمالي − خصومات − مرتجعات'), ' is-net') +
      kpi('ti-list-details', t('Transactions', 'المعاملات'), esc(String(r.transactionCount || 0)), txFoot);

    // ── تفصيل طرق الدفع ──
    const methods = r.methods || [];
    const methodSum = methods.reduce((s, m) => s + Number(m.total || 0), 0);
    const methodChip = document.getElementById('methodCount');
    methodChip.hidden = !methods.length;
    methodChip.textContent = String(methods.length) + ' ' + t('transactions', 'عمليات');
    document.getElementById('methodTotal').textContent = money(methodSum);
    document.getElementById('methodBody').innerHTML = methods.length
      ? methods
          .map((m) => {
            const pct = methodSum > 0 ? Math.round((Number(m.total) / methodSum) * 100) : 0;
            return (
              '<tr><td>' +
              badge(methodIcon(m.method), methodLabel(m.method), methodBadgeCls(m.method)) +
              '</td><td><span class="z-cnt num">' +
              esc(String(m.count)) +
              '</span></td><td>' +
              shareBar(pct) +
              '</td><td class="amt">' +
              moneyTxt(m.total) +
              '</td></tr>'
            );
          })
          .join('')
      : '<tr><td colspan="4" class="muted">' + esc(t('No payments on this shift', 'لا توجد مدفوعات في هذه الوردية')) + '</td></tr>';

    // ── تسوية النقدية: دفتر + لوحة الحكم ──
    const reveal = !!r.revealCash;
    const hasDiff = reveal && r.difference != null && !Number.isNaN(Number(r.difference));
    const diff = hasDiff ? Number(r.difference) : null;
    const state = !reveal ? 'lock' : diff === 0 ? 'ok' : diff > 0 ? 'over' : 'bad';
    const stateIcon = state === 'ok' ? 'ti-circle-check' : state === 'bad' ? 'ti-alert-triangle' : state === 'over' ? 'ti-arrow-up-right' : 'ti-lock';

    const chipEl = document.getElementById('cashVerdictChip');
    chipEl.hidden = false;
    chipEl.className = 'z-verdict-chip ' + state;
    chipEl.innerHTML =
      '<i class="ti ' + stateIcon + '"></i>' +
      esc(
        state === 'ok' ? t('Matched', 'متطابقة')
          : state === 'bad' ? t('Cash short', 'عجز نقدي')
          : state === 'over' ? t('Cash over', 'زيادة نقدي')
          : t('Not settled yet', 'لسه متسوّتش'),
      );

    const ledger = [];
    ledger.push(lrow('blank', t('Opening cash', 'رصيد الفتح'), t('what was in the drawer before the shift', 'اللي كان في الدرج قبل الوردية'), money(r.openingCash)));
    ledger.push(lrow('add', t('Cash sales', 'مبيعات نقدية'), null, money(r.cashSales)));
    ledger.push(lrow('sub', t('Cash refunds', 'مرتجعات نقدية'), null, money(r.cashRefunds)));
    ledger.push(lrow('sub', t('Cash expenses', 'مصروفات نقدية'), null, money(r.cashExpenses)));
    if (Number(r.cashPaidIn)) ledger.push(lrow('add', t('Paid in', 'وارد نقدي'), null, money(r.cashPaidIn)));
    if (Number(r.floatAdjust)) ledger.push(lrow(Number(r.floatAdjust) > 0 ? 'add' : 'sub', t('Float adjust', 'تعديل العهدة'), null, money(r.floatAdjust)));
    ledger.push(lrow('res', t('Expected cash', 'النقدية المتوقعة'), reveal ? null : t('settled when the drawer closes', 'بتتحدد لما الدرج يتقفل'), reveal ? money(r.expectedCash) : '••••', reveal ? ' is-result' : ' is-result masked'));
    ledger.push(lrow('blank', t('Counted cash', 'النقدية المعدودة'), t('actually counted in the drawer', 'اللي اتعدّد في الدرج فعليًا'), reveal && r.countedCash != null ? money(r.countedCash) : reveal ? '—' : '••••', reveal ? '' : ' masked'));
    document.getElementById('cashLedger').innerHTML = ledger.join('');

    const verdict = document.getElementById('cashVerdict');
    verdict.hidden = false;
    verdict.className = 'z-verdict ' + state;
    let vWord;
    let vAmount;
    let vWhy;
    if (state === 'ok') {
      vWord = t('Drawer matched', 'الدرج متطابق');
      vAmount = '<span class="num">' + esc(money(0)) + '</span>';
      vWhy = t('Counted cash matched expected — the shift is ready to approve.', 'النقدية المعدودة طابقت المتوقعة — الوردية جاهزة للاعتماد.');
    } else if (state === 'bad') {
      vWord = t('Drawer short', 'عجز في الدرج');
      vAmount = '<span class="num">' + esc(money(r.difference)) + '</span>';
      vWhy = t('Cash is missing vs expected — review cash refunds and expenses before approving.', 'في نقدية ناقصة عن المتوقع — راجع المرتجعات النقدية والمصروفات قبل الاعتماد.');
    } else if (state === 'over') {
      vWord = t('Drawer over', 'زيادة في الدرج');
      vAmount = '<span class="num">' + esc(money(r.difference)) + '</span>';
      vWhy = t('Extra cash vs expected — review shift movements before approving.', 'في نقدية زيادة عن المتوقع — راجع حركات الوردية قبل الاعتماد.');
    } else {
      vWord = t('Waiting for drawer close', 'بتستنى إغلاق الدرج');
      vAmount = '<span style="font-size:15px;color:var(--ltt)">' + esc(t('Hidden until close', 'مخفي لحين الإغلاق')) + '</span>';
      vWhy = t('Close the drawer on Current Shift to count cash and reveal the difference.', 'اقفل الدرج من «الوردية الحالية» عشان يتعدّ النقد ويظهر الفرق.');
    }
    verdict.innerHTML =
      '<div class="icon"><i class="ti ' + stateIcon + '"></i></div>' +
      '<div class="word">' + esc(vWord) + '</div>' +
      '<div class="amount">' + vAmount + '</div>' +
      '<div class="why">' + esc(vWhy) + '</div>' +
      '<div class="formula">' + esc(t('Difference = counted − expected', 'الفرق = المعدودة − المتوقعة')) + '</div>';

    // ── تفصيل المبيعات ──
    const cats = [
      [t('Memberships', 'الاشتراكات'), 'ti-tag', 'is-cash', r.membershipCount, r.memberships],
      [t('Renewals', 'التجديدات'), 'ti-refresh', 'is-cash', r.renewalCount, r.renewals],
      [t('Products', 'المنتجات'), 'ti-package', 'is-digital', r.productCount, r.products],
      [t('Other', 'أخرى'), 'ti-dots', 'is-other', r.otherCount, r.other],
    ].filter((c) => Number(c[3]) > 0 || Number(c[4]) !== 0);
    const catSum = cats.reduce((s, c) => s + Number(c[4] || 0), 0);
    const breakChip = document.getElementById('breakCount');
    breakChip.hidden = !cats.length;
    breakChip.textContent = String(cats.length) + ' ' + t('categories', 'فئات');
    document.getElementById('breakTotal').textContent = money(catSum);
    document.getElementById('breakBody').innerHTML = cats.length
      ? cats
          .map((c) => {
            const pct = catSum > 0 ? Math.round((Number(c[4]) / catSum) * 100) : 0;
            return (
              '<tr><td>' +
              badge(c[1], c[0], c[2]) +
              '</td><td><span class="z-cnt num">' +
              esc(String(c[3] || 0)) +
              '</span></td><td>' +
              shareBar(pct) +
              '</td><td class="amt">' +
              moneyTxt(c[4]) +
              '</td></tr>'
            );
          })
          .join('')
      : '<tr><td colspan="4" class="muted">' + esc(t('No sale lines on this shift', 'لا توجد بنود بيع في هذه الوردية')) + '</td></tr>';

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
