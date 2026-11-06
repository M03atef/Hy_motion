(function (global) {
  'use strict';

  function t(en, ar) {
    var I18n = global.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
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

  const user = JSON.parse(
    localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || '{}',
  );
  if (!user || !user.role) {
    location.href = '/auth/login/';
    return;
  }
  const authz = global.GfpAuthz;
  const canFinance = authz
    ? authz.useCan('reports.financial.view')
    : getPerms().has('reports.financial.view');
  const canViewExpenses = authz
    ? authz.useCan('reports.expenses.view')
    : getPerms().has('reports.expenses.view');
  const canManageExpenses = authz
    ? authz.useCan('reports.expenses.manage')
    : getPerms().has('reports.expenses.manage');

  const TABS = {
    sales: {
      finance: true,
      titleEn: 'Sales', titleAr: 'المبيعات',
      pageTitleEn: 'Sales Report', pageTitleAr: 'تقرير المبيعات',
      hintEn: 'Track sales and revenue performance.', hintAr: 'تابع أداء المبيعات والإيرادات.',
    },
    refunds: {
      finance: true,
      titleEn: 'Refunds', titleAr: 'المرتجعات',
      pageTitleEn: 'Refunds', pageTitleAr: 'المرتجعات',
      hintEn: 'Review refunded transactions and their impact.', hintAr: 'راجع عمليات الاسترجاع وتأثيرها.',
    },
    profitability: {
      finance: true,
      titleEn: 'Profitability', titleAr: 'الربحية',
      pageTitleEn: 'Profitability & Cash Flow', pageTitleAr: 'الربحية والتدفق النقدي',
      hintEn: 'Separate revenue, costs, operating expenses, profit, and cash flow.', hintAr: 'الإيرادات والتكاليف والمصروفات التشغيلية والربح والتدفق النقدي كل على حدة.',
    },
    cashflow: {
      finance: true,
      titleEn: 'Cash Flow', titleAr: 'التدفق النقدي',
      pageTitleEn: 'Cash Flow Report', pageTitleAr: 'تقرير التدفق النقدي',
      hintEn: 'See settled inflows and actual cash, payroll, supplier, and expense outflows.', hintAr: 'اطّلع على المقبوضات المسواة والمصروفات النقدية الفعلية للرواتب والموردين والمصاريف.',
    },
    expenses: {
      finance: true,
      titleEn: 'Running costs', titleAr: 'التكاليف التشغيلية',
      pageTitleEn: 'Running Costs', pageTitleAr: 'التكاليف التشغيلية',
      hintEn: 'Add posted running costs (utilities, rent, operations). Payroll and supplier purchases stay separate.', hintAr: 'أضف التكاليف التشغيلية المرحّلة (مرافق، إيجار، تشغيل). الرواتب ومشتريات الموردين تبقى منفصلة.',
    },
    memberships: {
      finance: false,
      titleEn: 'Memberships', titleAr: 'العضويات',
      pageTitleEn: 'Memberships', pageTitleAr: 'العضويات',
      hintEn: 'Track new memberships and renewals.', hintAr: 'تابع العضويات الجديدة والتجديدات.',
    },
    products: {
      finance: true,
      titleEn: 'Products', titleAr: 'المنتجات',
      pageTitleEn: 'Products', pageTitleAr: 'المنتجات',
      hintEn: 'See which products are selling and generating revenue.', hintAr: 'اطّلع على المنتجات الأكثر مبيعًا وإيرادًا.',
    },
    staff: {
      finance: true,
      titleEn: 'Staff & Shifts', titleAr: 'الموظفون والورديات',
      pageTitleEn: 'Staff & Shifts', pageTitleAr: 'الموظفون والورديات',
      hintEn: 'Review sales and shift activity by staff.', hintAr: 'راجع المبيعات ونشاط الورديات لكل موظف.',
    },
  };

  function tabTitle(key) {
    const m = TABS[key];
    return m ? t(m.titleEn, m.titleAr) : '';
  }
  function tabPageTitle(key) {
    const m = TABS[key];
    return m ? t(m.pageTitleEn || m.titleEn, m.pageTitleAr || m.titleAr) : '';
  }
  function tabHint(key) {
    const m = TABS[key];
    return m ? t(m.hintEn, m.hintAr) : '';
  }

  const CARDS = [
    {
      key: 'sales',
      icon: 'ti-receipt',
      titleEn: 'Sales', titleAr: 'المبيعات',
      descEn: 'Money taken in this period, after cash refunds.', descAr: 'الأموال المحصّلة في هذه الفترة، بعد المرتجعات النقدية.',
    },
    {
      key: 'refunds',
      icon: 'ti-arrow-back-up',
      titleEn: 'Refunds', titleAr: 'المرتجعات',
      descEn: 'Executed cash and credit refunds. Cancel membership is not a refund.', descAr: 'المرتجعات النقدية والائتمانية المنفّذة. إلغاء العضوية ليس مرتجعًا.',
    },
    {
      key: 'profitability',
      icon: 'ti-chart-donut',
      titleEn: 'Profitability', titleAr: 'الربحية',
      descEn: 'Reconciled profitability and cash-flow metrics with coverage warnings.', descAr: 'مؤشرات الربحية والتدفق النقدي المطابَقة مع تنبيهات التغطية.',
    },
    {
      key: 'expenses',
      icon: 'ti-wallet',
      titleEn: 'Expenses', titleAr: 'المصروفات',
      descEn: 'Posted and voided operating expenses with structured audit metadata.', descAr: 'المصروفات التشغيلية المرحّلة والملغاة مع بيانات تدقيق منظمة.',
    },
    {
      key: 'cashflow',
      icon: 'ti-arrows-exchange',
      titleEn: 'Cash Flow', titleAr: 'التدفق النقدي',
      descEn: 'Settled inflows and actual outflows, kept separate from profit.', descAr: 'المقبوضات المسواة والمصروفات الفعلية، منفصلة عن الربح.',
    },
    {
      key: 'memberships',
      icon: 'ti-id',
      titleEn: 'Memberships', titleAr: 'العضويات',
      descEn: 'New memberships and renewals that started in this period.', descAr: 'العضويات الجديدة والتجديدات التي بدأت في هذه الفترة.',
    },
    {
      key: 'products',
      icon: 'ti-shopping-bag',
      titleEn: 'Products', titleAr: 'المنتجات',
      descEn: 'See which products are selling and generating revenue.', descAr: 'اطّلع على المنتجات الأكثر مبيعًا وإيرادًا.',
    },
    {
      key: 'staff',
      icon: 'ti-users',
      titleEn: 'Staff & Shifts', titleAr: 'الموظفون والورديات',
      descEn: 'Who handled the sales and shifts.', descAr: 'من تولّى المبيعات والورديات.',
    },
  ];

  const params = new URLSearchParams(location.search);
  let activeTab = params.get('tab') || '';
  if (activeTab && !TABS[activeTab]) activeTab = '';
  if (activeTab && TABS[activeTab].finance
      && (activeTab === 'expenses' ? !canViewExpenses : !canFinance))
    activeTab = '';

  let methodFilter = params.get('method') || '';
  let staffFilter = params.get('staffId') || '';
  let typeFilter = params.get('type') || '';
  let buyerFilter = params.get('buyer') || '';
  let planFilter = params.get('planId') || '';
  let productFilter = params.get('productId') || '';
  let shiftFilter = params.get('shiftId') || '';
  let catalogMethods = [];
  let lastRows = [];
  let lastKpiRows = [];
  let lastDetailMeta = { count: 0, truncated: false };
  let emptyOverride = null;
  let lastPlanOpts = [];
  let lastProductOpts = [];
  let lastShiftOpts = [];
  let hubSummary = [];
  let rangePreset = 'last7';
  const PAGE_SIZE = 25;
  let tablePage = 1;
  let tableRowHtmls = [];
  let tableHeaders = [];

  const EMPTY = {
    sales: {
      titleEn: 'No sales for this period', titleAr: 'لا توجد مبيعات لهذه الفترة',
      bodyEn: 'No successful payments in this date range. Try another period or take a sale.',
      bodyAr: 'لا توجد مدفوعات ناجحة في هذا النطاق الزمني. جرّب فترة أخرى أو سجّل عملية بيع.',
      href: '/dashboard/pos/',
      ctaEn: 'Open Sale', ctaAr: 'فتح نقطة البيع',
    },
    refunds: {
      titleEn: 'No refunds for this period', titleAr: 'لا توجد مرتجعات لهذه الفترة',
      bodyEn: 'No executed refunds in this date range. Try another period.',
      bodyAr: 'لا توجد مرتجعات منفّذة في هذا النطاق الزمني. جرّب فترة أخرى.',
      href: '',
      ctaEn: '', ctaAr: '',
    },
    memberships: {
      titleEn: 'No membership activity', titleAr: 'لا يوجد نشاط عضويات',
      bodyEn: 'No memberships started in this period. Try another period or open a member.',
      bodyAr: 'لم تبدأ أي عضوية في هذه الفترة. جرّب فترة أخرى أو افتح ملف عضو.',
      href: '/dashboard/members/',
      ctaEn: 'Open Members', ctaAr: 'فتح الأعضاء',
    },
    products: {
      titleEn: 'No product sales', titleAr: 'لا توجد مبيعات منتجات',
      bodyEn: 'No retail products sold in this period. Try another period or take a sale.',
      bodyAr: 'لم تُباع منتجات تجزئة في هذه الفترة. جرّب فترة أخرى أو سجّل عملية بيع.',
      href: '/dashboard/pos/',
      ctaEn: 'Open Sale', ctaAr: 'فتح نقطة البيع',
    },
    staff: {
      titleEn: 'No staff activity', titleAr: 'لا يوجد نشاط للموظفين',
      bodyEn: 'No payments, refunds, or shifts opened in this period. Open Current Shift to start a drawer.',
      bodyAr: 'لا توجد مدفوعات أو مرتجعات أو ورديات مفتوحة في هذه الفترة. افتح الوردية الحالية لبدء الدرج.',
      href: '/dashboard/shifts/',
      ctaEn: 'Current Shift', ctaAr: 'الوردية الحالية',
    },
    expenses: {
      titleEn: 'No expenses for this period', titleAr: 'لا توجد مصروفات لهذه الفترة',
      bodyEn: 'No recorded operating expenses in this period.', bodyAr: 'لا توجد مصروفات تشغيلية مسجّلة في هذه الفترة.',
      href: '',
      ctaEn: '', ctaAr: '',
    },
  };

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function parseYmd(s) {
    const p = String(s || '').split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function isAr() {
    return (global.GfpI18n && typeof global.GfpI18n.getLocale === 'function')
      ? global.GfpI18n.getLocale() === 'ar'
      : (document.documentElement.getAttribute('dir') === 'rtl');
  }
  function two(n) { return String(n).padStart(2, '0'); }
  function fmtShort(s) {
    const d = parseYmd(s);
    if (!d) return s || '';
    const months = isAr() ? MONTHS_AR : MONTHS_EN;
    return d.getDate() + ' ' + months[d.getMonth()];
  }
  function fmtDate(s) {
    const d = typeof s === 'string' ? parseYmd(s) : s;
    if (!d || Number.isNaN(d.getTime())) return esc(s || '');
    const months = isAr() ? MONTHS_AR : MONTHS_EN;
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  // Machine format for exports — Excel parses it as a real datetime (sortable/filterable).
  function dtIso(iso) {
    if (!iso) return '';
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }
  // Bidi-safe inline token: LTR isolate so amounts/dates never scramble inside RTL sentences.
  function num(html) {
    return '<span class="num">' + html + '</span>';
  }
  function hasArabic(s) {
    return /[\u0600-\u06FF]/.test(String(s));
  }
  // Isolate only Latin/digit tokens; Arabic month names already flow correctly in RTL
  // and would read backwards inside an LTR isolate.
  function txt(s) {
    s = String(s == null ? '' : s);
    return hasArabic(s) ? esc(s) : num(esc(s));
  }

  const cairoDates = global.GfpCairoDates;
  const todayYmd = cairoDates && cairoDates.todayYmd
    ? cairoDates.todayYmd()
    : ymd(new Date());
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  if (params.get('from') && params.get('to')) {
    fromEl.value = params.get('from');
    toEl.value = params.get('to');
    rangePreset = 'custom';
  } else if (cairoDates && cairoDates.presetRange) {
    const initial = cairoDates.presetRange('last7');
    fromEl.value = initial.from;
    toEl.value = initial.to;
  } else {
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - 6);
    toEl.value = ymd(new Date());
    fromEl.value = ymd(fromD);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(n) {
    const x = Number(n) || 0;
    const neg = x < 0;
    const abs = Math.abs(x);
    const body = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (neg ? '-EGP ' : 'EGP ') + body;
  }
  function moneyHtml(n) {
    return '<span class="num money' + (Number(n) < 0 ? ' is-negative' : '') + '">' + esc(money(n)) + '</span>';
  }
  function typeLabel(type) {
    return {
      membership: t('Membership', 'عضوية'),
      product: t('Product', 'منتج'),
      mixed: t('Mixed', 'مختلط'),
      other: t('Other', 'أخرى'),
      unknown: '—',
    }[type] || type || '—';
  }
  function dt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    const months = isAr() ? MONTHS_AR : MONTHS_EN;
    return two(d.getDate()) + ' ' + months[d.getMonth()] + (isAr() ? '، ' : ', ') + two(d.getHours()) + ':' + two(d.getMinutes());
  }
  function dtHtml(iso) {
    return txt(dt(iso));
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function dateRange() {
    return { from: fromEl.value, to: toEl.value };
  }
  function canSee(key) {
    const meta = TABS[key];
    if (!meta) return false;
    if (key === 'expenses') return canViewExpenses;
    if (key === 'memberships') return canFinance;
    return meta.finance ? canFinance : false;
  }

  function financialAmount(amount, available) {
    if (available === false) return t('Unavailable', 'غير متاح');
    if (amount == null) return t('Unavailable', 'غير متاح');
    return money(amount);
  }

  // Human language for backend data-coverage codes (ProfitabilityService.DataIssues).
  var ISSUE_I18N = {
    cogs_unavailable: {
      en: ['Some sold products have no recorded cost, so gross profit cannot be computed for this period.', 'Action: enter product costs, or run the COGS backfill.'],
      ar: ['بعض المنتجات المبيعة ليس لها تكلفة مسجّلة، لذا لا يمكن حساب مجمل الربح لهذه الفترة.', 'الإجراء: أدخل تكلفة المنتجات، أو شغّل «إعادة حساب التكلفة».'],
    },
    refund_cogs_unallocated: {
      en: ['A refund in this period is missing item-level goods evidence, so product costs cannot be allocated.', 'This should not normally happen — reopen the refund request or contact support.'],
      ar: ['يوجد استرداد في هذه الفترة بلا تفاصيل أصناف مرتجعة، فلا يمكن توزيع تكلفة المنتجات.', 'هذا غير متوقع — أعد فتح طلب الاسترداد أو تواصل مع الدعم.'],
    },
    no_payroll_period: {
      en: ['No payroll period covers this date range.', 'Action: open a payroll period from the Staff section.'],
      ar: ['لا توجد فترة رواتب مفتوحة تغطي هذه الفترة.', 'الإجراء: افتح فترة الرواتب من قسم الموظفين ← الرواتب.'],
    },
    payroll_period_not_fully_covered: {
      en: ['The payroll period does not fully cover the selected range.', 'Action: extend the payroll period to cover the whole range.'],
      ar: ['فترة الرواتب لا تغطي كامل الفترة المحددة.', 'الإجراء: وسّع فترة الرواتب لتغطي كامل الفترة.'],
    },
    payroll_data_incomplete: {
      en: ['Payroll data is incomplete for this period.', 'Action: complete payroll data, then reload the report.'],
      ar: ['بيانات الرواتب غير مكتملة لهذه الفترة.', 'الإجراء: أكمل بيانات الرواتب ثم أعد تحميل التقرير.'],
    },
    settlement_data_incomplete: {
      en: ['Payment settlement evidence is incomplete.', 'Action: review payment settlements (Paymob/Fawry) for this period.'],
      ar: ['بيانات تسوية المدفوعات غير مكتملة.', 'الإجراء: راجع تسويات المدفوعات (بايموب/فوري) لهذه الفترة.'],
    },
    payment_allocation_mismatch: {
      en: ['Payments and their invoice allocations do not fully match.', 'Action: review payment allocations on invoices.'],
      ar: ['هناك فرق بين المدفوعات وتخصيصها على الفواتير.', 'الإجراء: راجع تخصيص المدفوعات على الفواتير.'],
    },
    supplier_cash_evidence_unavailable: {
      en: ['No cash evidence for supplier payments.', 'Action: record supplier cash payments.'],
      ar: ['لا توجد أدلة نقدية لمدفوعات الموردين.', 'الإجراء: سجّل مدفوعات الموردين النقدية.'],
    },
    no_retail_lines: {
      en: ['No retail product sales in this period.', ''],
      ar: ['لا توجد مبيعات منتجات في هذه الفترة.', ''],
    },
  };

  function coverageBlock(issues, allGoodText) {
    const list = Array.isArray(issues) ? issues : [];
    if (!list.length) {
      return '<div class="cov"><div class="cov-ok"><span class="st approved" style="padding:1px 8px">✓</span>'
        + esc(allGoodText || t('All configured financial sources are available for this period.', 'كل المصادر المالية المُعدّة متاحة لهذه الفترة.'))
        + '</div></div>';
    }
    const items = list.map(function (code) {
      const def = ISSUE_I18N[code];
      const txt = def ? (isAr() ? def.ar[0] : def.en[0]) : code;
      const fix = def ? (isAr() ? def.ar[1] : def.en[1]) : '';
      return '<div class="cov-item"><i>◈</i><span>' + esc(txt)
        + (fix ? '<span class="fix">' + esc(fix) + '</span>' : '')
        + '</span></div>';
    }).join('');
    return '<div class="cov"><h4><i style="font-style:normal;color:var(--wrnTxt,#F59E0B)">◈</i>'
      + esc(t('Data coverage', 'تغطية البيانات المالية'))
      + '</h4>' + items + '</div>';
  }

  function shiftStatusLabel(s) {
    if (s.status === 'open') return t('Open', 'مفتوحة');
    if (s.status === 'approved') return t('Approved', 'معتمدة');
    return t('Closed', 'مغلقة');
  }
  function shiftStatusBadge(s) {
    const cls = s.status === 'open' ? 'open' : s.status === 'approved' ? 'approved' : 'closed';
    const dot = s.status === 'open' ? '<span class="dot"></span>' : '';
    return '<span class="st ' + cls + '">' + dot + esc(shiftStatusLabel(s)) + '</span>';
  }
  function shiftDurationText(s) {
    if (!s.openedAt) return '—';
    const a = new Date(s.openedAt);
    if (Number.isNaN(a.getTime())) return '—';
    if (!s.closedAt) return t('Ongoing', 'جارية');
    const b = new Date(s.closedAt);
    if (Number.isNaN(b.getTime())) return '—';
    const mins = Math.max(0, Math.round((b - a) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (isAr()) return h + ' س ' + m + ' د';
    return h + 'h ' + m + 'm';
  }

  async function resolveOpenShiftId() {
    try {
      const shift = await apiGet('/shifts/current');
      if (shift && String(shift.status || '').toLowerCase() === 'open' && shift.id) {
        return shift.id;
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function expenseApiMessage(result) {
    const fallback = t('Unable to record running cost', 'تعذّر تسجيل التكلفة التشغيلية');
    if (!result) return fallback;
    var msg = '';
    if (result.error && result.error.message) msg = String(result.error.message);
    else if (result.data && result.data.error) msg = String(result.data.error);
    else if (result.data && result.data.message) msg = String(result.data.message);
    else return fallback;
    if (/^\s*</.test(msg) || /Exception|stack trace| at /i.test(msg)) return fallback;
    if (msg.length > 180) msg = msg.slice(0, 177) + '…';
    return msg;
  }

  let expenseFormWired = false;

  function expenseCatalog() {
    return global.GfpCashExpenseCatalog || null;
  }

  // --- Expenses workspace (v2): display labels, filters, ledger, drawer ---
  var EXPENSE_CATEGORY_AR = {
    'Utilities': 'المرافق والخدمات',
    'Rent & Property': 'الإيجار والعقارات',
    'Software & Technology': 'البرمجيات والتقنية',
    'Operations': 'التشغيل والصيانة',
    'Marketing': 'التسويق',
    'Banking & Payment': 'البنوك والمدفوعات',
    'Other': 'أخرى',
  };
  var EXPENSE_TYPE_AR = {
    'Electricity': 'كهرباء', 'Water': 'مياه', 'Gas': 'غاز', 'Internet': 'إنترنت', 'Telephone': 'هاتف',
    'Rent': 'إيجار', 'Property services': 'خدمات عقارية', 'Maintenance': 'صيانة',
    'Gym management software': 'برمجية إدارة الجيم',
    'POS / software subscriptions': 'اشتراكات نقاط البيع والبرمجيات',
    'Other SaaS subscriptions': 'اشتراكات SaaS أخرى',
    'Cleaning': 'تنظيف', 'Security': 'أمن وحراسة', 'Repairs': 'إصلاحات', 'Supplies': 'مستلزمات',
    'Equipment maintenance': 'صيانة معدات',
    'Advertising': 'إعلانات', 'Social media': 'سوشيال ميديا', 'Printing': 'مطبوعات', 'Promotions': 'عروض ترويجية',
    'Bank fees': 'رسوم بنكية', 'Payment gateway fees': 'رسوم بوابة الدفع', 'Miscellaneous': 'متنوع',
  };
  var EXPENSE_CATEGORY_ICON = {
    'Utilities': 'ti-bolt',
    'Rent & Property': 'ti-building',
    'Software & Technology': 'ti-cloud',
    'Operations': 'ti-tool',
    'Marketing': 'ti-speakerphone',
    'Banking & Payment': 'ti-building-bank',
    'Other': 'ti-tag',
  };

  function expenseCategoryLabel(value) {
    value = String(value || '');
    return value ? t(value, EXPENSE_CATEGORY_AR[value] || value) : '—';
  }
  function expenseTypeLabel(value) {
    value = String(value || '');
    return value ? t(value, EXPENSE_TYPE_AR[value] || value) : '—';
  }
  function expenseMethodLabel(method) {
    return {
      cash: t('Cash', 'نقدًا'),
      card: t('Card', 'بطاقة'),
      bank_transfer: t('Bank transfer', 'تحويل بنكي'),
      wallet: t('Wallet', 'محفظة'),
      other: t('Other', 'أخرى'),
    }[method] || method || '—';
  }
  function expenseMethodIcon(method) {
    return {
      cash: 'ti-cash', card: 'ti-credit-card', bank_transfer: 'ti-building-bank',
      wallet: 'ti-wallet', other: 'ti-dots',
    }[method] || 'ti-wallet';
  }
  function expenseDateText(iso) {
    if (!iso) return '—';
    return fmtDate(iso);
  }

  var expenseRowsCache = [];
  var expenseFilters = { q: '', category: '', method: '', vendor: '' };

  function expenseDayCount() {
    const { from, to } = dateRange();
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  function expenseRowText(row) {
    return [
      row.payee, row.description, row.note, row.sourceReference, row.category,
      expenseCategoryLabel(row.category), expenseTypeLabel(row.description), expenseMethodLabel(row.paymentMethod),
    ].map((x) => String(x || '')).join(' ').toLowerCase();
  }

  function filteredExpenseRows() {
    const f = expenseFilters;
    return expenseRowsCache.filter((row) => {
      if (f.category && String(row.category || '').toLowerCase() !== f.category.toLowerCase()) return false;
      if (f.method && String(row.paymentMethod || '').toLowerCase() !== f.method) return false;
      if (f.vendor && String(row.payee || '').trim() !== f.vendor) return false;
      if (f.q && expenseRowText(row).indexOf(f.q.toLowerCase()) < 0) return false;
      return true;
    });
  }

  function renderExpenseKpis(rows) {
    const posted = rows.filter((row) => String(row.status || '').toLowerCase() === 'posted');
    const voided = rows.length - posted.length;
    const total = posted.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const days = expenseDayCount();
    const avg = posted.length ? total / days : 0;
    const byCategory = {};
    posted.forEach((row) => {
      const key = String(row.category || '—');
      byCategory[key] = (byCategory[key] || 0) + Number(row.amount || 0);
    });
    let topCategory = '';
    let topAmount = 0;
    Object.keys(byCategory).forEach((key) => {
      if (byCategory[key] > topAmount) { topAmount = byCategory[key]; topCategory = key; }
    });
    const share = total > 0 && topCategory ? Math.round((topAmount / total) * 100) : 0;
    const totalFoot = t('For the selected period', 'خلال الفترة المحددة');
    const countFoot = voided > 0
      ? t('@n voided entries excluded', 'مستبعد منها @n قيد ملغى').replace('@n', String(voided))
      : t('No voided entries', 'بلا قيود ملغاة');
    const avgFoot = t('Over @n days', 'على مدار @n يومًا').replace('@n', String(days));
    const cards = [
      '<div class="exp-kpi"><div class="exp-kpi-top"><i class="ti ti-receipt"></i><span>' + esc(t('Posted expenses', 'إجمالي المصروفات المرحّلة')) + '</span></div>' +
        '<div class="exp-kpi-val">' + moneyHtml(total) + '</div><div class="exp-kpi-foot">' + esc(totalFoot) + '</div></div>',
      '<div class="exp-kpi"><div class="exp-kpi-top"><i class="ti ti-list-details"></i><span>' + esc(t('Entries', 'عدد المصروفات')) + '</span></div>' +
        '<div class="exp-kpi-val">' + cnt(posted.length) + '</div><div class="exp-kpi-foot">' + esc(countFoot) + '</div></div>',
      '<div class="exp-kpi"><div class="exp-kpi-top"><i class="ti ti-chart-line"></i><span>' + esc(t('Daily average', 'متوسط المصروف اليومي')) + '</span></div>' +
        '<div class="exp-kpi-val">' + moneyHtml(avg) + '</div><div class="exp-kpi-foot">' + esc(avgFoot) + '</div></div>',
      '<div class="exp-kpi"><div class="exp-kpi-top"><i class="ti ti-tag"></i><span>' + esc(t('Top category', 'أعلى تصنيف مصروف')) + '</span></div>' +
        (topCategory
          ? '<div class="exp-kpi-val cat">' + esc(expenseCategoryLabel(topCategory)) + '</div>' +
            '<div class="exp-kpi-foot"><b>' + moneyHtml(topAmount) + '</b> · ' + esc(share + '% ' + t('of total', 'من الإجمالي')) + '</div>' +
            '<div class="exp-bar"><i style="width:' + Math.min(100, share) + '%"></i></div>'
          : '<div class="exp-kpi-val">—</div>') +
        '</div>',
    ];
    document.getElementById('expensesKpis').innerHTML = cards.join('');
    lastKpiRows = [
      [t('Posted running costs', 'التكاليف التشغيلية المرحّلة'), Number(total.toFixed(2))],
      [t('Entries', 'القيود'), posted.length, 'count'],
      [t('Voided entries', 'القيود الملغاة'), voided, 'count'],
      [t('Daily average', 'المتوسط اليومي'), Number(avg.toFixed(2))],
      [t('Top category', 'أعلى تصنيف'), topCategory ? expenseCategoryLabel(topCategory) + ' (' + money(topAmount) + ')' : '—', 'text'],
    ];
  }

  function renderExpensesTable() {
    const body = document.getElementById('expensesBody');
    if (!body) return;
    const allRows = expenseRowsCache;
    const rows = filteredExpenseRows();
    const chip = document.getElementById('expensesCountChip');
    if (chip) chip.textContent = String(allRows.length);
    const shownNote = document.getElementById('expensesShownNote');
    if (shownNote) {
      shownNote.textContent = rows.length === allRows.length
        ? t('Showing all recorded expenses', 'عرض كل المصروفات المسجّلة')
        : t('Showing @shown of @total expenses', 'عرض @shown من @total مصروفات')
            .replace('@shown', String(rows.length)).replace('@total', String(allRows.length));
    }
    const periodNote = document.getElementById('expensesPeriodNote');
    if (periodNote) {
      const { from, to } = dateRange();
      periodNote.innerHTML = txt(fmtShort(from) + ' – ' + fmtShort(to));
    }
    body.innerHTML = rows.length
      ? rows.map((row, index) => {
          const status = String(row.status || '').toLowerCase();
          const isPosted = status === 'posted';
          const categoryRaw = String(row.category || '');
          const description = row.description
            ? esc(expenseTypeLabel(row.description))
            : (esc(row.payee || '') || '—');
          const note = String(row.note || '').trim();
          const vendor = String(row.payee || '').trim();
          return '<tr' + (isPosted ? '' : ' class="exp-row-void"') + '>' +
            '<td class="exp-idx" data-col="#">' + (index + 1) + '</td>' +
            '<td class="exp-date" data-col="' + esc(t('Date', 'التاريخ')) + '"><span>' + txt(expenseDateText(row.expenseDate)) + '</span></td>' +
            '<td data-col="' + esc(t('Category', 'التصنيف')) + '">' +
              (categoryRaw
                ? '<span class="exp-cat"><i class="ti ' + (EXPENSE_CATEGORY_ICON[categoryRaw] || 'ti-tag') + '"></i>' + esc(expenseCategoryLabel(categoryRaw)) + '</span>'
                : '—') + '</td>' +
            '<td data-col="' + esc(t('Description', 'البيان')) + '"><div class="exp-desc"><b>' + description + '</b>' +
              (isPosted ? '' : '<span class="exp-chip-void">' + esc(t('Void', 'ملغى')) + '</span>') +
              (note ? '<small>' + esc(note) + '</small>' : '') + '</div></td>' +
            '<td class="amt exp-amt" data-col="' + esc(t('Amount', 'المبلغ')) + '">' + moneyHtml(row.amount) + '</td>' +
            '<td data-col="' + esc(t('Method', 'طريقة الدفع')) + '"><span class="exp-pay"><i class="ti ' + expenseMethodIcon(row.paymentMethod) + '"></i>' + esc(expenseMethodLabel(row.paymentMethod)) + '</span></td>' +
            '<td class="exp-vendor" data-col="' + esc(t('Vendor / payee', 'المورد / المستفيد')) + '">' + esc(vendor || '—') + '</td>' +
            '<td data-col="' + esc(t('Reference', 'المرجع')) + '">' +
              (row.sourceReference
                ? '<span class="exp-ref">' + esc(row.sourceReference) + '</span>'
                : '<span class="exp-ref-none">—</span>') + '</td>' +
            '<td data-col="' + esc(t('Actions', 'الإجراءات')) + '">' +
              (isPosted && canManageExpenses
                ? '<button class="exp-act btn-void-expense" data-expense-id="' + esc(row.id) + '"><i class="ti ti-ban"></i>' + esc(t('Void', 'إلغاء')) + '</button>'
                : '—') + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="9" class="exp-empty">' +
        esc(allRows.length
          ? t('No expenses match the current filters.', 'لا توجد نتائج مطابقة للفلاتر الحالية.')
          : t('No expenses recorded for this period.', 'لا توجد مصروفات مسجّلة لهذه الفترة.')) +
        '</td></tr>';
    body.querySelectorAll('.btn-void-expense').forEach((button) => {
      button.onclick = async () => {
        if (!window.confirm(t('Void this expense? This preserves the entry and removes it from posted totals.', 'إلغاء هذا المصروف؟ سيبقى القيد لكنه سيُستبعد من الإجماليات المرحّلة.'))) return;
        const result = await apiWrite('/expenses/' + encodeURIComponent(button.dataset.expenseId), 'PATCH', { status: 'void' });
        if (result && result.ok) {
          toast(t('Expense voided', 'تم إلغاء المصروف'));
          loadExpenses();
        } else {
          toast(t('Unable to void expense', 'تعذّر إلغاء المصروف'), 'err');
        }
      };
    });
  }

  function paintExpenseFilterOptions(rows) {
    const catSel = document.getElementById('expenseFilterCategory');
    const methodSel = document.getElementById('expenseFilterMethod');
    const vendorSel = document.getElementById('expenseFilterVendor');
    if (!catSel || !methodSel || !vendorSel) return;
    const catalog = expenseCatalog();
    const categories = (catalog ? catalog.categories : []).slice();
    catSel.innerHTML = '<option value="">' + esc(t('All categories', 'كل التصنيفات')) + '</option>' +
      categories
        .map((c) => '<option value="' + esc(c) + '">' + esc(expenseCategoryLabel(c)) + '</option>')
        .join('');
    catSel.value = expenseFilters.category;
    if (catSel.value !== expenseFilters.category) expenseFilters.category = '';
    const methods = [
      ['', t('All payment methods', 'كل طرق الدفع')],
      ['cash', expenseMethodLabel('cash')],
      ['card', expenseMethodLabel('card')],
      ['bank_transfer', expenseMethodLabel('bank_transfer')],
      ['wallet', expenseMethodLabel('wallet')],
      ['other', expenseMethodLabel('other')],
    ];
    methodSel.innerHTML = methods
      .map((m) => '<option value="' + m[0] + '">' + esc(m[1]) + '</option>')
      .join('');
    methodSel.value = expenseFilters.method;
    if (methodSel.value !== expenseFilters.method) expenseFilters.method = '';
    const vendors = Array.from(new Set(
      rows.map((row) => String(row.payee || '').trim()).filter(Boolean),
    )).sort();
    vendorSel.innerHTML = '<option value="">' + esc(t('All vendors', 'كل الموردين')) + '</option>' +
      vendors
        .map((v) => '<option value="' + esc(v) + '">' + esc(v) + '</option>')
        .join('');
    vendorSel.value = expenseFilters.vendor;
    if (vendorSel.value !== expenseFilters.vendor) expenseFilters.vendor = '';
  }

  var expenseToolbarWired = false;
  function wireExpenseFilters() {
    if (expenseToolbarWired) return;
    const search = document.getElementById('expenseSearch');
    const catSel = document.getElementById('expenseFilterCategory');
    const methodSel = document.getElementById('expenseFilterMethod');
    const vendorSel = document.getElementById('expenseFilterVendor');
    const reset = document.getElementById('expenseFilterReset');
    if (!search || !catSel || !methodSel || !vendorSel) return;
    expenseToolbarWired = true;
    let debounced = null;
    search.oninput = () => {
      clearTimeout(debounced);
      debounced = setTimeout(() => {
        expenseFilters.q = search.value.trim();
        renderExpensesTable();
      }, 160);
    };
    catSel.onchange = () => { expenseFilters.category = catSel.value; renderExpensesTable(); };
    methodSel.onchange = () => { expenseFilters.method = methodSel.value; renderExpensesTable(); };
    vendorSel.onchange = () => { expenseFilters.vendor = vendorSel.value; renderExpensesTable(); };
    if (reset) {
      reset.onclick = () => {
        expenseFilters = { q: '', category: '', method: '', vendor: '' };
        search.value = '';
        catSel.value = '';
        methodSel.value = '';
        vendorSel.value = '';
        renderExpensesTable();
      };
    }
  }

  function wireLedgerCsv() {
    const btn = document.getElementById('btnExpensesCsv');
    if (!btn) return;
    btn.onclick = () => {
      const rows = filteredExpenseRows();
      if (!rows.length) {
        toast(t('Nothing to export', 'لا يوجد ما يمكن تصديره'), 'err');
        return;
      }
      const { from, to } = dateRange();
      const gym = gymName();
      const head = [
        '#',
        t('Date', 'التاريخ'),
        t('Category', 'التصنيف'),
        t('Type', 'النوع'),
        t('Description', 'البيان'),
        t('Amount (EGP)', 'المبلغ (ج.م)'),
        t('Method', 'طريقة الدفع'),
        t('Vendor / payee', 'المورد / المستفيد'),
        t('Reference', 'المرجع'),
        t('Status', 'الحالة'),
      ];
      const meta = [
        [t('Expense ledger', 'سجل المصروفات') + ' — HyMotion' + (gym ? ' (' + gym + ')' : ''), ''],
        [t('Period', 'الفترة'), from + ' → ' + to],
        [t('Detail rows', 'عدد سجلات التفصيل'), String(rows.length)],
      ];
      const body = rows.map((row, index) => {
        const status = String(row.status || '').toLowerCase();
        return [
          index + 1,
          row.expenseDate || '',
          expenseCategoryLabel(row.category),
          expenseTypeLabel(row.description),
          row.note || '',
          Number(row.amount || 0).toFixed(2),
          expenseMethodLabel(row.paymentMethod),
          row.payee || '',
          row.sourceReference || '',
          status === 'posted' ? t('Posted', 'مرحّل') : status === 'void' ? t('Void', 'ملغى') : String(row.status || ''),
        ];
      });
      const csv = buildCsv([meta, [head].concat(body)]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const name = exportBaseName() + '.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      toast('\u200E' + name + ' — ' + t('CSV exported', 'تم تصدير ملف CSV'));
    };
  }

  function expenseDrawerEls() {
    return {
      drawer: document.getElementById('expenseDrawer'),
      backdrop: document.getElementById('expenseDrawerBackdrop'),
      openBtn: document.getElementById('btnAddExpense'),
      closeBtn: document.getElementById('expenseDrawerClose'),
    };
  }
  function openExpenseDrawer() {
    const drawer = expenseDrawerEls().drawer;
    if (!drawer) return;
    drawer.classList.add('open');
    const backdrop = document.getElementById('expenseDrawerBackdrop');
    if (backdrop) backdrop.classList.add('open');
    document.body.classList.add('exp-noscroll');
    const first = drawer.querySelector('select[name="category"]');
    if (first) first.focus();
  }
  function closeExpenseDrawer() {
    const drawer = expenseDrawerEls().drawer;
    if (!drawer) return;
    drawer.classList.remove('open');
    const backdrop = document.getElementById('expenseDrawerBackdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('exp-noscroll');
  }
  var expenseDrawerWired = false;
  function wireExpenseDrawer() {
    if (expenseDrawerWired) return;
    const els = expenseDrawerEls();
    if (!els.drawer || !els.openBtn) return;
    expenseDrawerWired = true;
    els.openBtn.onclick = openExpenseDrawer;
    if (els.closeBtn) els.closeBtn.onclick = closeExpenseDrawer;
    if (els.backdrop) els.backdrop.onclick = closeExpenseDrawer;
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && els.drawer.classList.contains('open')) closeExpenseDrawer();
    });
  }

  function populateExpenseTypeOptions(categorySelect, typeSelect) {
    const catalog = expenseCatalog();
    if (!catalog || !categorySelect || !typeSelect) return;
    const types = catalog.typesFor(categorySelect.value);
    typeSelect.innerHTML = types
      .map((item) => '<option value="' + esc(item) + '">' + esc(expenseTypeLabel(item)) + '</option>')
      .join('');
  }

  function refreshExpenseCatalogOptions() {
    const categorySelect = document.getElementById('expenseCategory');
    const typeSelect = document.getElementById('expenseType');
    const catalog = expenseCatalog();
    if (!catalog || !categorySelect || !typeSelect) return;
    const prevCategory = categorySelect.value;
    categorySelect.innerHTML = catalog.categories
      .map((item) => '<option value="' + esc(item) + '">' + esc(expenseCategoryLabel(item)) + '</option>')
      .join('');
    if (prevCategory && catalog.categories.some((c) => c.toLowerCase() === prevCategory.toLowerCase())) {
      categorySelect.value = prevCategory;
    }
    populateExpenseTypeOptions(categorySelect, typeSelect);
  }

  function wireExpenseForm() {
    if (expenseFormWired) return;
    const form = document.getElementById('expensesForm');
    const categorySelect = document.getElementById('expenseCategory');
    const typeSelect = document.getElementById('expenseType');
    const methodSelect = document.getElementById('expensePaymentMethod');
    const shiftWrap = document.getElementById('expenseShiftWrap');
    const shiftSelect = document.getElementById('expenseShiftSelect');
    const cancelBtn = document.getElementById('expenseFormCancel');
    if (!form || !categorySelect || !typeSelect) return;
    expenseFormWired = true;
    const catalog = expenseCatalog();
    if (catalog) {
      refreshExpenseCatalogOptions();
      categorySelect.onchange = () => populateExpenseTypeOptions(categorySelect, typeSelect);
    }
    async function refreshShiftOptions() {
      if (!shiftSelect) return;
      shiftSelect.innerHTML = '<option value="">' + esc(t('Auto (open shift)', 'تلقائي (الوردية المفتوحة)')) + '</option>';
      const shift = await apiGet('/shifts/current');
      if (shift && shift.id && String(shift.status || '').toLowerCase() === 'open') {
        shiftSelect.innerHTML +=
          '<option value="' + esc(shift.id) + '">' + esc(t('Open shift', 'الوردية المفتوحة')) + '</option>';
      }
    }
    function toggleShiftField() {
      if (!shiftWrap || !methodSelect) return;
      const isCash = methodSelect.value === 'cash';
      shiftWrap.hidden = !isCash;
      if (isCash) refreshShiftOptions();
    }
    if (methodSelect) {
      methodSelect.onchange = toggleShiftField;
      toggleShiftField();
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        form.reset();
        if (catalog) populateExpenseTypeOptions(categorySelect, typeSelect);
        toggleShiftField();
        closeExpenseDrawer();
      };
    }
    form.onsubmit = async (event) => {
      event.preventDefault();
      const payload = {
        expenseDate: form.expenseDate.value,
        category: categorySelect.value,
        amount: Number(form.amount.value),
        paymentMethod: methodSelect ? methodSelect.value : 'cash',
        payee: (form.payee && form.payee.value.trim()) || null,
        description: typeSelect.value,
        note: (form.note && form.note.value.trim()) || null,
        sourceReference: (form.sourceReference && form.sourceReference.value.trim()) || null,
      };
      if (payload.paymentMethod === 'cash') {
        const manualShift = shiftSelect && shiftSelect.value;
        const shiftId = manualShift || await resolveOpenShiftId();
        if (!shiftId) {
          toast(t('Open a shift before recording a cash running cost', 'افتح وردية قبل تسجيل تكلفة تشغيلية نقدية'), 'err');
          return;
        }
        payload.shiftId = shiftId;
      }
      const result = await apiWrite('/expenses', 'POST', payload);
      if (result && result.ok) {
        form.reset();
        if (catalog) populateExpenseTypeOptions(categorySelect, typeSelect);
        toggleShiftField();
        closeExpenseDrawer();
        toast(t('Running cost recorded', 'تم تسجيل التكلفة التشغيلية'));
        loadExpenses();
      } else {
        toast(expenseApiMessage(result), 'err');
      }
    };
  }

  async function apiGet(path) {
    if (window.GfpApi && window.GfpApi.get) {
      const r = await window.GfpApi.get(path);
      if (r.status === 401) {
        location.href = '/auth/login/';
        return null;
      }
      if (!r.ok) throw { status: r.status, data: r.data };
      return r.data;
    }
    const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
    const t = getToken();
    const r = await fetch(API_BASE + path, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(t ? { Authorization: 'Bearer ' + t } : {}),
      },
    });
    if (r.status === 401) {
      location.href = '/auth/login/';
      return null;
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw { status: r.status, data: e };
    }
    return r.json();
  }

  async function apiWrite(path, method, body) {
    if (window.GfpApi && window.GfpApi[method.toLowerCase()]) {
      const r = await window.GfpApi[method.toLowerCase()](path, body);
      if (r.status === 401) {
        location.href = '/auth/login/';
        return null;
      }
      return r;
    }
    const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
    const t = getToken();
    const response = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(t ? { Authorization: 'Bearer ' + t } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401) {
      location.href = '/auth/login/';
      return null;
    }
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
  }

  function setRangeLabel() {
    const { from, to } = dateRange();
    let text = fmtShort(from) + ' – ' + fmtShort(to);
    if (rangePreset === 'last7') text = t('Last 7 days', 'آخر 7 أيام');
    else if (rangePreset === 'last30') text = t('Last 30 days', 'آخر 30 يومًا');
    else if (rangePreset === 'thisMonth') text = t('This month', 'هذا الشهر');
    // Custom ranges carry digits → isolate them so RTL never scrambles the order.
    document.getElementById('rangeLabel').innerHTML = rangePreset === 'custom' ? txt(text) : esc(text);
    document.querySelectorAll('#rangePop .range-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === rangePreset);
    });
  }

  function applyPreset(preset) {
    rangePreset = preset;
    if (cairoDates && cairoDates.presetRange) {
      const range = cairoDates.presetRange(preset);
      fromEl.value = range.from;
      toEl.value = range.to;
    } else {
      const now = new Date();
      if (preset === 'last7') {
        const fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 6);
        fromEl.value = ymd(fromD);
        toEl.value = ymd(now);
      } else if (preset === 'last30') {
        const fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 29);
        fromEl.value = ymd(fromD);
        toEl.value = ymd(now);
      } else if (preset === 'thisMonth') {
        fromEl.value = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
        toEl.value = ymd(now);
      }
    }
    setRangeLabel();
  }

  function syncUrl() {
    const url = new URL(location.href);
    const { from, to } = dateRange();
    if (activeTab) url.searchParams.set('tab', activeTab);
    else url.searchParams.delete('tab');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    if (activeTab === 'sales' && ['membership', 'product', 'mixed'].indexOf(typeFilter) >= 0)
      url.searchParams.set('type', typeFilter);
    else if (activeTab === 'memberships' && ['new', 'renewal'].indexOf(typeFilter) >= 0)
      url.searchParams.set('type', typeFilter);
    else url.searchParams.delete('type');
    if (activeTab === 'refunds' && buyerFilter) url.searchParams.set('buyer', buyerFilter);
    else url.searchParams.delete('buyer');
    if (activeTab === 'sales' || activeTab === 'refunds' || activeTab === 'memberships' || activeTab === 'products' || activeTab === 'staff') {
      if (staffFilter) url.searchParams.set('staffId', staffFilter);
      else url.searchParams.delete('staffId');
    } else {
      url.searchParams.delete('staffId');
    }
    if (activeTab === 'sales' || activeTab === 'refunds' || activeTab === 'products') {
      if (methodFilter) url.searchParams.set('method', methodFilter);
      else url.searchParams.delete('method');
    } else {
      url.searchParams.delete('method');
    }
    if (activeTab === 'memberships' && planFilter) url.searchParams.set('planId', planFilter);
    else url.searchParams.delete('planId');
    if (activeTab === 'products' && productFilter) url.searchParams.set('productId', productFilter);
    else url.searchParams.delete('productId');
    if (activeTab === 'staff' && shiftFilter) url.searchParams.set('shiftId', shiftFilter);
    else url.searchParams.delete('shiftId');
    history.replaceState({}, '', url);
  }

  function setCrumb() {
    const crumb = document.getElementById('crumb');
    const sub = document.getElementById('pageSub');
    const title = document.querySelector('.page-title');
    if (!activeTab) {
      crumb.innerHTML = '<span>' + esc(t('Money', 'الأموال')) + '</span><span class="sep">/</span><span class="current">' + esc(t('Reports', 'التقارير')) + '</span>';
      title.textContent = t('Reports', 'التقارير');
      sub.textContent = t('Understand sales, members, products and staff activity.', 'افهم المبيعات والأعضاء والمنتجات ونشاط الموظفين.');
      return;
    }
    crumb.innerHTML =
      '<span>' + esc(t('Money', 'الأموال')) + '</span><span class="sep">/</span><a href="/dashboard/reports/">' + esc(t('Reports', 'التقارير')) + '</a><span class="sep">/</span><span class="current">' +
      esc(tabTitle(activeTab)) +
      '</span>';
    title.textContent = tabPageTitle(activeTab);
    sub.textContent = tabHint(activeTab);
  }

  function closePops() {
    ['rangePop', 'staffPop', 'methodPop', 'planPop', 'productPop', 'shiftFilterPop', 'morePop', 'exportPop'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    ['btnRange', 'btnStaff', 'btnMethod', 'btnPlan', 'btnProduct', 'btnShift', 'btnMore', 'btnExport'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('aria-expanded', 'false');
    });
  }

  function setRangeOpen(open) {
    if (open) {
      closePops();
      document.getElementById('rangePop').hidden = false;
      document.getElementById('btnRange').setAttribute('aria-expanded', 'true');
    } else {
      closePops();
    }
  }

  function togglePop(btnId, popId) {
    const pop = document.getElementById(popId);
    const willOpen = pop.hidden;
    closePops();
    if (willOpen) {
      pop.hidden = false;
      document.getElementById(btnId).setAttribute('aria-expanded', 'true');
    }
  }

  function kpi(label, value) {
    return '<div class="kpi"><div class="v">' + value + '</div><div class="l">' + esc(label) + '</div></div>';
  }

  function isMoneyHeader(h) {
    const s = String(h || '');
    return /amount|sales|refunds|revenue|total|cash|net|gross|difference/i.test(s)
      || /المبلغ|المبيعات|المرتجعات|الإيراد|القيمة|الصافي|الإجمالي|المصروفات|الرواتب/.test(s);
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

  function showDetailError(show) {
    const box = document.getElementById('detailError');
    if (!box) return;
    box.hidden = !show;
    if (show) {
      document.getElementById('detailEmpty').hidden = true;
      document.getElementById('tableWrap').hidden = true;
      document.getElementById('tablePager').hidden = true;
    }
  }

  function showDetailEmpty(show) {
    const box = document.getElementById('detailEmpty');
    box.hidden = !show;
    document.getElementById('tableWrap').hidden = !!show;
    document.getElementById('tablePager').hidden = true;
    if (!show) return;
    const meta = emptyOverride || EMPTY[activeTab] || EMPTY.sales;
    document.getElementById('emptyTitle').textContent = t(meta.titleEn, meta.titleAr);
    document.getElementById('emptyBody').textContent = t(meta.bodyEn, meta.bodyAr);
    const cta = document.getElementById('emptyCta');
    if (meta.href) {
      cta.hidden = false;
      cta.href = meta.href;
      cta.textContent = t(meta.ctaEn, meta.ctaAr);
    } else {
      cta.hidden = true;
    }
  }

  function showTableSkeleton(cols) {
    showDetailError(false);
    document.getElementById('detailEmpty').hidden = true;
    document.getElementById('tableWrap').hidden = false;
    document.getElementById('tablePager').hidden = true;
    const n = cols || 6;
    document.getElementById('thead').innerHTML =
      '<tr>' + Array.from({ length: n }, () => '<th><div class="sk-block"></div></th>').join('') + '</tr>';
    document.getElementById('tbody').innerHTML = Array.from({ length: 6 }, () => {
      return '<tr>' + Array.from({ length: n }, () => '<td><div class="sk-block"></div></td>').join('') + '</tr>';
    }).join('');
  }

  function fillKpiSkeleton(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = [0, 1, 2, 3]
      .map(
        () =>
          '<div class="sales-kpi"><div class="l"><div class="sk-block"></div></div><div class="v"><div class="sk-block lg"></div></div></div>',
      )
      .join('');
  }

  function bindRowClicks() {
    document.querySelectorAll('#tbody tr[data-href]').forEach((tr) => {
      tr.onclick = () => {
        location.href = tr.getAttribute('data-href');
      };
    });
    document.querySelectorAll('#tbody a[href]').forEach((a) => {
      a.addEventListener('click', (ev) => ev.stopPropagation());
    });
    document.querySelectorAll('#tbody tr[data-staff]').forEach((tr) => {
      tr.onclick = () => {
        const id = tr.getAttribute('data-staff') || '';
        staffFilter = staffFilter === id ? '' : id;
        closePops();
        loadDetail();
      };
    });
    document.querySelectorAll('#tbody tr[data-shift]').forEach((tr) => {
      tr.onclick = () => {
        const id = tr.getAttribute('data-shift') || '';
        shiftFilter = shiftFilter === id ? '' : id;
        closePops();
        loadDetail();
      };
    });
  }

  function paintPager(total) {
    const el = document.getElementById('tablePager');
    if (!el) return;
    if (total <= PAGE_SIZE) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const pages = Math.ceil(total / PAGE_SIZE);
    const from = (tablePage - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, tablePage * PAGE_SIZE);
    el.innerHTML =
      '<span class="pager-meta">' +
      from +
      '–' +
      to +
      ' ' + esc(t('of', 'من')) + ' ' +
      total +
      '</span>' +
      '<button type="button" class="btn secondary" id="pgPrev"' +
      (tablePage <= 1 ? ' disabled' : '') +
      '>' + esc(t('Prev', 'السابق')) + '</button>' +
      '<button type="button" class="btn secondary" id="pgNext"' +
      (tablePage >= pages ? ' disabled' : '') +
      '>' + esc(t('Next', 'التالي')) + '</button>';
    document.getElementById('pgPrev').onclick = () => {
      tablePage -= 1;
      paintTablePage();
    };
    document.getElementById('pgNext').onclick = () => {
      tablePage += 1;
      paintTablePage();
    };
  }

  function paintTablePage() {
    document.getElementById('thead').innerHTML =
      '<tr>' +
      tableHeaders
        .map((h) => '<th' + (isMoneyHeader(h) ? ' class="amt"' : '') + '>' + esc(h) + '</th>')
        .join('') +
      '</tr>';
    const total = tableRowHtmls.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    if (tablePage > pages) tablePage = pages;
    const start = (tablePage - 1) * PAGE_SIZE;
    document.getElementById('tbody').innerHTML = tableRowHtmls.slice(start, start + PAGE_SIZE).join('');
    stampColLabels('#tableWrap table');
    bindRowClicks();
    paintPager(total);
  }

  function renderTable(headers, rowsHtml, empty) {
    showDetailError(false);
    tableHeaders = headers || [];
    tableRowHtmls = Array.isArray(rowsHtml) ? rowsHtml : rowsHtml ? [rowsHtml] : [];
    tablePage = 1;
    if (empty) {
      showDetailEmpty(true);
      return;
    }
    showDetailEmpty(false);
    paintTablePage();
  }

  function moreFilterCount() {
    let n = 0;
    if (activeTab === 'sales' && typeFilter) n += 1;
    if (activeTab === 'refunds' && buyerFilter) n += 1;
    if (activeTab === 'memberships') {
      if (typeFilter) n += 1;
      if (planFilter) n += 1;
    }
    if (activeTab === 'products' && productFilter) n += 1;
    if (activeTab === 'staff' && shiftFilter) n += 1;
    return n;
  }

  function paintMoreLabel() {
    const n = moreFilterCount();
    const label = t('More Filters', 'المزيد من الفلاتر');
    document.getElementById('btnMore').innerHTML =
      (n ? label + ' · ' + n : label) + ' <i class="ti ti-chevron-down"></i>';
  }

  function methodLabel(m) {
    const map = {
      cash: t('Cash', 'كاش'),
      card_paymob: t('Card (Paymob)', 'بطاقة (بايموب)'),
      fawry: t('Fawry', 'فوري'),
      vodafone: t('Vodafone', 'فودافون كاش'),
      instapay: t('Instapay', 'إنستا باي'),
      account_credit: t('Credit', 'رصيد الحساب'),
      credit: t('Credit', 'رصيد الحساب'),
      gateway: t('Gateway', 'بوابة الدفع'),
    };
    return map[m] || m || '—';
  }

  function paymentCount(data) {
    const methods = data.methods || [];
    if (methods.length) return methods.reduce((s, m) => s + Number(m.count || 0), 0);
    return (data.payments || []).length;
  }

  function setTabChrome() {
    const isSales = activeTab === 'sales';
    const isRefunds = activeTab === 'refunds';
    const isMemberships = activeTab === 'memberships';
    const isProducts = activeTab === 'products';
    const isStaff = activeTab === 'staff';
    const isProfitability = activeTab === 'profitability';
    const isCashflow = activeTab === 'cashflow';
    const isExpenses = activeTab === 'expenses';
    const useFilters = isSales || isRefunds || isMemberships || isProducts || isStaff;
    if (isSales && typeFilter && ['membership', 'product', 'mixed'].indexOf(typeFilter) < 0) typeFilter = '';
    if (isMemberships && typeFilter && ['new', 'renewal'].indexOf(typeFilter) < 0) typeFilter = '';
    document.getElementById('hubTabs').hidden = useFilters;
    document.getElementById('salesFilters').hidden = !useFilters;
    document.getElementById('methodWrap').hidden = !isSales && !isRefunds && !isProducts;
    document.getElementById('planWrap').hidden = true;
    document.getElementById('productWrap').hidden = true;
    document.getElementById('shiftFilterWrap').hidden = true;
    document.getElementById('moreWrap').hidden = !useFilters;
    document.getElementById('salesBoard').hidden = !isSales;
    document.getElementById('refundsBoard').hidden = !isRefunds;
    document.getElementById('membershipsBoard').hidden = !isMemberships;
    document.getElementById('productsBoard').hidden = !isProducts;
    document.getElementById('staffBoard').hidden = !isStaff;
    document.getElementById('profitabilityBoard').hidden = !isProfitability;
    document.getElementById('cashflowBoard').hidden = !isCashflow;
    document.getElementById('expensesBoard').hidden = !isExpenses;
    document.getElementById('kpiRow').hidden = useFilters;
    document.querySelector('.page-header').hidden = isExpenses;
    const rangeWrapEl = document.getElementById('rangeWrap');
    const expRangeSlotEl = document.getElementById('expRangeSlot');
    const hdrActionsEl = document.getElementById('hdrActions');
    const salesFiltersEl = document.getElementById('salesFilters');
    if (rangeWrapEl && expRangeSlotEl && hdrActionsEl && salesFiltersEl) {
      if (isExpenses) expRangeSlotEl.appendChild(rangeWrapEl);
      else if (useFilters) salesFiltersEl.insertBefore(rangeWrapEl, salesFiltersEl.firstChild);
      else hdrActionsEl.insertBefore(rangeWrapEl, hdrActionsEl.firstChild);
    }
    document.querySelectorAll('#hubTabs .hub-tab').forEach((btn) => {
      const key = btn.getAttribute('data-tab');
      btn.hidden = !canSee(key);
      btn.classList.toggle('active', key === activeTab);
    });
    paintToolbarState();
    paintMorePop();
    syncUrl();
    setCrumb();
  }

  const FILTER_TABS = ['sales', 'refunds', 'memberships', 'products', 'staff'];
  function filtersActiveCount() {
    let n = moreFilterCount();
    if (FILTER_TABS.indexOf(activeTab) >= 0 && staffFilter) n += 1;
    if (['sales', 'refunds', 'products'].indexOf(activeTab) >= 0 && methodFilter) n += 1;
    return n;
  }
  function paintToolbarState() {
    const useFilters = FILTER_TABS.indexOf(activeTab) >= 0;
    const chip = document.getElementById('resultChip');
    if (chip) {
      chip.hidden = !useFilters;
      if (!useFilters) chip.innerHTML = '';
    }
    const clear = document.getElementById('btnClearFilters');
    if (clear) clear.hidden = !useFilters || filtersActiveCount() === 0;
  }
  // Per-tab live summary of what the current filters produced — shown at the toolbar end.
  function setResultChip(html) {
    const el = document.getElementById('resultChip');
    if (!el) return;
    el.hidden = !html;
    el.innerHTML = html || '';
  }
  function cnt(n) {
    return num(esc(String(n == null ? 0 : n)));
  }

  function paintStaffPop(staff) {
    const pop = document.getElementById('staffPop');
    const allStaffLabel = t('All staff', 'كل الموظفين');
    const unassignedLabel = t('Unassigned', 'غير معيّن');
    const staffFallback = t('Staff', 'الموظف');
    const items = [{ userId: '', name: allStaffLabel }].concat(
      (staff || []).filter((s) => s.userId),
    );
    pop.innerHTML = items
      .map((s) => {
        const id = s.userId || '';
        const act = id === staffFilter ? ' active' : '';
        return (
          '<button type="button" class="range-opt' +
          act +
          '" data-staff="' +
          esc(id) +
          '">' +
          esc(s.name || unassignedLabel) +
          '</button>'
        );
      })
      .join('');
    pop.querySelectorAll('[data-staff]').forEach((btn) => {
      btn.onclick = () => {
        staffFilter = btn.getAttribute('data-staff') || '';
        closePops();
        loadDetail();
      };
    });
    const cur = items.find((s) => (s.userId || '') === staffFilter);
    document.getElementById('staffLabel').textContent = staffFilter ? cur && cur.name ? cur.name : staffFallback : t('All', 'الكل');
  }

  function paintPlanPop(plans) {
    lastPlanOpts = plans || [];
    const pop = document.getElementById('planPop');
    const planFallback = t('Plan', 'الخطة');
    const items = [{ planId: '', name: t('All plans', 'كل الخطط') }].concat(plans || []);
    pop.innerHTML = items
      .map((p) => {
        const id = p.planId || '';
        const act = id === planFilter ? ' active' : '';
        return (
          '<button type="button" class="range-opt' +
          act +
          '" data-plan="' +
          esc(id) +
          '">' +
          esc(p.name || planFallback) +
          '</button>'
        );
      })
      .join('');
    pop.querySelectorAll('[data-plan]').forEach((btn) => {
      btn.onclick = () => {
        planFilter = btn.getAttribute('data-plan') || '';
        closePops();
        loadDetail();
      };
    });
    const cur = items.find((p) => (p.planId || '') === planFilter);
    document.getElementById('planLabel').textContent = planFilter
      ? cur && cur.name
        ? cur.name
        : planFallback
      : t('All', 'الكل');
  }

  function paintProductPop(products) {
    lastProductOpts = products || [];
    const pop = document.getElementById('productPop');
    const productFallback = t('Product', 'المنتج');
    const items = [{ productId: '', name: t('All products', 'كل المنتجات') }].concat(products || []);
    pop.innerHTML = items
      .map((p) => {
        const id = p.productId || '';
        const act = id === productFilter ? ' active' : '';
        return (
          '<button type="button" class="range-opt' +
          act +
          '" data-product="' +
          esc(id) +
          '">' +
          esc(p.name || productFallback) +
          '</button>'
        );
      })
      .join('');
    pop.querySelectorAll('[data-product]').forEach((btn) => {
      btn.onclick = () => {
        productFilter = btn.getAttribute('data-product') || '';
        closePops();
        loadDetail();
      };
    });
    const cur = items.find((p) => (p.productId || '') === productFilter);
    document.getElementById('productLabel').textContent = productFilter
      ? cur && cur.name
        ? cur.name
        : productFallback
      : t('All', 'الكل');
  }

  function paintShiftPop(shifts) {
    lastShiftOpts = shifts || [];
    const pop = document.getElementById('shiftFilterPop');
    const shiftFallback = t('Shift', 'الوردية');
    const items = [{ shiftId: '', name: t('All shifts', 'كل الورديات') }].concat(shifts || []);
    pop.innerHTML = items
      .map((s) => {
        const id = s.shiftId || '';
        const act = id === shiftFilter ? ' active' : '';
        return (
          '<button type="button" class="range-opt' +
          act +
          '" data-shift="' +
          esc(id) +
          '">' +
          esc(s.name || shiftFallback) +
          '</button>'
        );
      })
      .join('');
    pop.querySelectorAll('[data-shift]').forEach((btn) => {
      btn.onclick = () => {
        shiftFilter = btn.getAttribute('data-shift') || '';
        closePops();
        loadDetail();
      };
    });
    const cur = items.find((s) => (s.shiftId || '') === shiftFilter);
    document.getElementById('shiftLabel').textContent = shiftFilter
      ? cur && cur.name
        ? cur.name
        : shiftFallback
      : t('All', 'الكل');
  }

  function paintMethodPop(methods, methodOptions) {
    const pop = document.getElementById('methodPop');
    const used = (methodOptions && methodOptions.length
      ? methodOptions
      : (methods || []).map((m) => m.method)
    ).filter(Boolean);
    if (methodFilter && used.indexOf(methodFilter) < 0) used.unshift(methodFilter);
    const keys = [''].concat(used);
    const allMethodsLabel = t('All methods', 'كل طرق الدفع');
    pop.innerHTML = keys
      .map((m) => {
        const act = m === methodFilter ? ' active' : '';
        return (
          '<button type="button" class="range-opt' +
          act +
          '" data-m="' +
          esc(m) +
          '">' +
          esc(m ? methodLabel(m) : allMethodsLabel) +
          '</button>'
        );
      })
      .join('');
    pop.querySelectorAll('[data-m]').forEach((btn) => {
      btn.onclick = () => {
        methodFilter = btn.getAttribute('data-m') || '';
        closePops();
        loadDetail();
      };
    });
    document.getElementById('methodLabel').textContent = methodFilter
      ? methodLabel(methodFilter)
      : t('All', 'الكل');
  }

  function paintMorePop() {
    const pop = document.getElementById('morePop');
    if (activeTab === 'sales') {
      const opts = [
        ['', t('All types', 'كل الأنواع')],
        ['membership', t('Membership', 'عضوية')],
        ['product', t('Product', 'منتج')],
        ['mixed', t('Mixed', 'مختلط')],
      ];
      pop.innerHTML =
        '<p class="range-pop-label">' + esc(t('Type', 'النوع')) + '</p>' +
        opts
          .map(
            ([v, label]) =>
              '<button type="button" class="range-opt' +
              (v === typeFilter ? ' active' : '') +
              '" data-type="' +
              v +
              '">' +
              esc(label) +
              '</button>',
          )
          .join('');
      pop.querySelectorAll('[data-type]').forEach((btn) => {
        btn.onclick = () => {
          typeFilter = btn.getAttribute('data-type') || '';
          closePops();
          loadDetail();
        };
      });
      paintMoreLabel();
      return;
    }
    if (activeTab === 'refunds') {
      const opts = [
        ['', t('Everyone', 'الجميع')],
        ['member', t('Members', 'الأعضاء')],
        ['walkin', t('Walk-in', 'زائر')],
      ];
      pop.innerHTML =
        '<p class="range-pop-label">' + esc(t('Who', 'من')) + '</p>' +
        opts
          .map(
            ([v, label]) =>
              '<button type="button" class="range-opt' +
              (v === buyerFilter ? ' active' : '') +
              '" data-buyer="' +
              v +
              '">' +
              esc(label) +
              '</button>',
          )
          .join('');
      pop.querySelectorAll('[data-buyer]').forEach((btn) => {
        btn.onclick = () => {
          buyerFilter = btn.getAttribute('data-buyer') || '';
          closePops();
          loadDetail();
        };
      });
      paintMoreLabel();
      return;
    }
    if (activeTab === 'memberships') {
      const opts = [
        ['', t('All types', 'كل الأنواع')],
        ['new', t('New', 'جديدة')],
        ['renewal', t('Renewals', 'تجديدات')],
      ];
      const planFallback = t('Plan', 'الخطة');
      const plans = [{ planId: '', name: t('All plans', 'كل الخطط') }].concat(lastPlanOpts);
      pop.innerHTML =
        '<p class="range-pop-label">' + esc(t('Type', 'النوع')) + '</p>' +
        opts
          .map(
            ([v, label]) =>
              '<button type="button" class="range-opt' +
              (v === typeFilter ? ' active' : '') +
              '" data-type="' +
              v +
              '">' +
              esc(label) +
              '</button>',
          )
          .join('') +
        '<p class="range-pop-label">' + esc(t('Plan', 'الخطة')) + '</p>' +
        plans
          .map((p) => {
            const id = p.planId || '';
            return (
              '<button type="button" class="range-opt' +
              (id === planFilter ? ' active' : '') +
              '" data-plan="' +
              esc(id) +
              '">' +
              esc(p.name || planFallback) +
              '</button>'
            );
          })
          .join('');
      pop.querySelectorAll('[data-type]').forEach((btn) => {
        btn.onclick = () => {
          typeFilter = btn.getAttribute('data-type') || '';
          closePops();
          loadDetail();
        };
      });
      pop.querySelectorAll('[data-plan]').forEach((btn) => {
        btn.onclick = () => {
          planFilter = btn.getAttribute('data-plan') || '';
          closePops();
          loadDetail();
        };
      });
      paintMoreLabel();
      return;
    }
    if (activeTab === 'products') {
      const productFallback = t('Product', 'المنتج');
      const items = [{ productId: '', name: t('All products', 'كل المنتجات') }].concat(lastProductOpts);
      pop.innerHTML =
        '<p class="range-pop-label">' + esc(t('Product', 'المنتج')) + '</p>' +
        items
          .map((p) => {
            const id = p.productId || '';
            return (
              '<button type="button" class="range-opt' +
              (id === productFilter ? ' active' : '') +
              '" data-product="' +
              esc(id) +
              '">' +
              esc(p.name || productFallback) +
              '</button>'
            );
          })
          .join('');
      pop.querySelectorAll('[data-product]').forEach((btn) => {
        btn.onclick = () => {
          productFilter = btn.getAttribute('data-product') || '';
          closePops();
          loadDetail();
        };
      });
      paintMoreLabel();
      return;
    }
    if (activeTab === 'staff') {
      const shiftFallback = t('Shift', 'الوردية');
      const items = [{ shiftId: '', name: t('All shifts', 'كل الورديات') }].concat(lastShiftOpts);
      pop.innerHTML =
        '<p class="range-pop-label">' + esc(t('Shift', 'الوردية')) + '</p>' +
        items
          .map((s) => {
            const id = s.shiftId || '';
            return (
              '<button type="button" class="range-opt' +
              (id === shiftFilter ? ' active' : '') +
              '" data-shift="' +
              esc(id) +
              '">' +
              esc(s.name || shiftFallback) +
              '</button>'
            );
          })
          .join('');
      pop.querySelectorAll('[data-shift]').forEach((btn) => {
        btn.onclick = () => {
          shiftFilter = btn.getAttribute('data-shift') || '';
          closePops();
          loadDetail();
        };
      });
      paintMoreLabel();
      return;
    }
    pop.innerHTML = '';
    paintMoreLabel();
  }

  function paintMoreActive() {
    paintMorePop();
  }

  async function loadProfitability() {
    const { from, to } = dateRange();
    const data = await apiGet('/reports/profitability?from=' + from + '&to=' + to);
    if (!data) return;

    const na = t('Unavailable', 'غير متاح');
    function val(amount, available) {
      if (available === false || amount == null) return '<span class="v na">' + esc(na) + '</span>';
      const neg = Number(amount) < 0;
      return '<span class="v' + (neg ? ' negv' : '') + '">' + moneyHtml(amount) + '</span>';
    }
    function moneyOrNa(amount, available) {
      if (available === false || amount == null) return na;
      return Number(amount);
    }
    function line(label, valueHtml, cls) {
      return '<div class="pl-line' + (cls ? ' ' + cls : '') + '"><span class="l">' + label + '</span>' + valueHtml + '</div>';
    }

    const revLabel = {
      memberships: t('New memberships', 'عضويات جديدة'),
      renewals: t('Renewals', 'التجديدات'),
      products: t('Products', 'المنتجات'),
      classes: t('Classes', 'الحصص'),
    };
    let revLines = '';
    const revExport = [];
    (data.revenueBreakdown || []).forEach((r) => {
      const lbl = revLabel[r.key] || r.key;
      revLines += line('<span class="ind">•</span> ' + esc(lbl), val(r.amount, true));
      revExport.push([lbl, Number(r.amount) || 0]);
    });

    const cogsAvailable = data.cogsAvailable === true;
    const payrollAvailable = data.payrollAvailable === true;
    const netProfitAvailable = data.netProfitAvailable === true;

    let cashRows = '';
    const cashExport = [];
    function cashRow(label, amount, available, invert) {
      const isNa = available === false || amount == null;
      const shown = isNa ? '<span class="cv na">' + esc(na) + '</span>'
        : '<span class="cv' + ((invert ? -Number(amount) : Number(amount)) < 0 ? ' negv' : '') + '">'
          + moneyHtml(invert ? -Number(amount) : amount) + '</span>';
      cashRows += '<div class="cashline"><span class="cl">' + esc(label) + '</span>' + shown + '</div>';
      cashExport.push([label, isNa ? na : (invert ? -Number(amount) : Number(amount))]);
    }
    cashRow(t('Collections', 'المقبوضات'), data.collections, true, false);
    cashRow(t('Settled cash inflow', 'الوارد النقدي المسوّى'), data.settledCashInflow, data.settledCashAvailable === true, false);
    cashRow(t('Cash refunds', 'المرتجعات النقدية'), data.cashRefunds, data.cashFlowAvailable === true, true);
    cashRow(t('Operating expenses', 'المصروفات التشغيلية'), data.operatingExpenses, data.cashFlowAvailable === true, true);
    cashRow(t('Payroll paid', 'الرواتب المدفوعة'), data.payrollCashDisbursements, data.cashFlowAvailable === true, true);
    cashRow(t('Supplier payments', 'مدفوعات الموردين'), data.supplierCashPayments, data.cashFlowAvailable === true, true);
    cashRow(t('Cash outflows', 'إجمالي المصروفات النقدية'), data.cashOutflows, data.cashFlowAvailable === true, true);

    // Largest single posted running cost in the period — the usual explanation for a big outflow.
    let topOut = null;
    try {
      const exp = await apiGet('/expenses?from=' + from + '&to=' + to);
      (Array.isArray(exp) ? exp : []).forEach((row) => {
        if (String(row.status || '').toLowerCase() !== 'posted') return;
        if (!topOut || Number(row.amount || 0) > Number(topOut.amount || 0)) topOut = row;
      });
    } catch (_) { /* coverage note is enough without it */ }

    let outflowHint = '';
    if (topOut) {
      const label = expenseCategoryLabel(topOut.category) + (topOut.description ? ' · ' + expenseTypeLabel(topOut.description) : '');
      outflowHint = '<p class="brk-note">' + esc(t('Largest outflow', 'أكبر بند خارج')) + ': <b>' + esc(label)
        + '</b> ' + moneyHtml(topOut.amount) + ' · ' + txt(fmtDate(topOut.expenseDate))
        + ' · <a href="#" id="plOutflowLink">' + esc(t('Open expense ledger', 'فتح سجل المصروفات')) + '</a></p>';
    }

    const plHtml =
      '<div class="pl-wrap">'
      + '<section class="pl">'
      +   '<h3>' + esc(t('Profitability', 'الربحية')) + '<span class="pl-period">' + txt(fmtShort(from) + ' – ' + fmtShort(to)) + '</span></h3>'
      +   '<p class="psub">' + esc(t('Accrual view — separate from cash movement.', 'القيد المحاسبي — منفصل عن حركة الخزنة.')) + '</p>'
      +   '<div class="pl-group">' + revLines
      +     line('<span class="ind">•</span> ' + esc(t('Revenue adjustments', 'تسويات الإيرادات')), val(data.revenueAdjustments, true))
      +     line('<span class="ind">•</span> ' + esc(t('Refunds', 'المرتجعات')), val(-(Number(data.refunds) || 0), true))
      +     line(esc(t('Total revenue', 'إجمالي الإيراد')), val(data.revenue, true), 'strong')
      +   '</div>'
      +   '<div class="pl-group">'
      +     line(esc(t('Cost of goods sold', 'تكلفة البضاعة المباعة')), val(data.cogs, cogsAvailable))
      +     line(esc(t('Gross profit', 'مجمل الربح')), val(data.grossProfit, cogsAvailable))
      +   '</div>'
      +   '<div class="pl-group">'
      +     line(esc(t('Operating expenses', 'المصروفات التشغيلية')), val(data.operatingExpenses, true))
      +     line(esc(t('Payroll expense', 'مصروف الرواتب')), val(data.payrollExpense, payrollAvailable))
      +     line(esc(t('Net profit', 'صافي الربح')),
              netProfitAvailable ? val(data.netProfit, true) : '<span class="v na">' + esc(t('Needs cost & payroll data', 'يحتاج بيانات التكلفة والرواتب')) + '</span>',
              'strong')
      +   '</div>'
      + '</section>'
      + '<div class="pl-side">'
      +   '<section class="pl">'
      +     '<h3>' + esc(t('Cash flow', 'التدفق النقدي')) + '</h3>'
      +     '<p class="psub">' + esc(t('Actual drawer movement — separate from profit.', 'حركة الخزنة الفعلية — منفصلة عن الربح.')) + '</p>'
      +     cashRows
      +     '<div class="pl-line total"><span class="l">' + esc(t('Net cash flow', 'صافي التدفق النقدي')) + '</span>'
      +       '<span class="v strong' + (Number(data.netCashFlow) < 0 ? ' negv' : '') + '">'
      +       (data.cashFlowAvailable === true ? moneyHtml(data.netCashFlow) : esc(financialAmount(data.netCashFlow, data.cashFlowAvailable)))
      +       '</span></div>'
      +     outflowHint
      +   '</section>'
      +   '<section class="pl" style="margin-top:12px">'
      +     '<h3>' + esc(t('Receivables & payables', 'المستحقات والمطلوبات')) + '</h3>'
      +     '<div class="cashline"><span class="cl">' + esc(t('Receivables (members owe)', 'لنا (أعضاء)')) + '</span>'
      +       '<span class="cv">' + moneyHtml(data.accountsReceivable == null ? 0 : data.accountsReceivable) + '</span></div>'
      +     '<div class="cashline"><span class="cl">' + esc(t('Payables (we owe)', 'علينا (موردون)')) + '</span>'
      +       '<span class="cv">' + moneyHtml(data.accountsPayable == null ? 0 : data.accountsPayable) + '</span></div>'
      +   '</section>'
      + '</div>'
      + '</div>';

    document.getElementById('profitabilityKpis').innerHTML = plHtml;

    const issues = Array.isArray(data.dataIssues) ? data.dataIssues : [];
    document.getElementById('profitabilityIssues').innerHTML = coverageBlock(issues);

    lastKpiRows = revExport
      .concat([
        [t('Total revenue', 'إجمالي الإيراد'), moneyOrNa(data.revenue, true)],
        [t('Cost of goods sold', 'تكلفة البضاعة المباعة'), moneyOrNa(data.cogs, cogsAvailable)],
        [t('Gross profit', 'مجمل الربح'), moneyOrNa(data.grossProfit, cogsAvailable)],
        [t('Operating expenses', 'المصروفات التشغيلية'), moneyOrNa(data.operatingExpenses, true)],
        [t('Payroll expense', 'مصروف الرواتب'), moneyOrNa(data.payrollExpense, payrollAvailable)],
        [t('Net profit', 'صافي الربح'), moneyOrNa(data.netProfit, netProfitAvailable)],
      ])
      .concat(cashExport)
      .concat([
        [t('Net cash flow', 'صافي التدفق النقدي'), moneyOrNa(data.netCashFlow, data.cashFlowAvailable === true)],
        [t('Receivables', 'المستحقات'), moneyOrNa(data.accountsReceivable, true)],
        [t('Payables', 'المطلوبات'), moneyOrNa(data.accountsPayable, true)],
      ]);
    lastRows = [];
    lastDetailMeta = { count: 0, truncated: false };
    setResultChip('');
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('tableWrap').hidden = true;
    document.getElementById('tablePager').hidden = true;
    document.getElementById('shiftWrap').hidden = true;
    document.getElementById('txWrap').hidden = true;
    document.getElementById('truncNote').hidden = true;
    const outLink = document.getElementById('plOutflowLink');
    if (outLink) {
      outLink.onclick = function (ev) {
        ev.preventDefault();
        openReport('expenses');
      };
    }
  }

  async function loadCashflow() {
    const { from, to } = dateRange();
    const data = await apiGet('/reports/cash-flow?from=' + from + '&to=' + to);
    if (!data) return;
    const cashFlowAvailable = data.cashFlowAvailable === true;
    const settledCashAvailable = data.settledCashAvailable === true;
    const na = t('Unavailable', 'غير متاح');

    let cashRows = '';
    const cashExport = [];
    function cashRow(label, amount, available, invert) {
      const isNa = available === false || amount == null;
      const shown = isNa ? '<span class="cv na">' + esc(na) + '</span>'
        : '<span class="cv' + ((invert ? -Number(amount) : Number(amount)) < 0 ? ' negv' : '') + '">'
          + moneyHtml(invert ? -Number(amount) : amount) + '</span>';
      cashRows += '<div class="cashline"><span class="cl">' + esc(label) + '</span>' + shown + '</div>';
      cashExport.push([label, isNa ? na : (invert ? -Number(amount) : Number(amount))]);
    }
    cashRow(t('Collections', 'المقبوضات'), data.collections, true, false);
    cashRow(t('Settled cash inflow', 'الوارد النقدي المسوّى'), data.settledCashInflow, settledCashAvailable, false);
    cashRow(t('Cash refunds', 'المرتجعات النقدية'), data.cashRefunds, cashFlowAvailable, true);
    cashRow(t('Operating expenses', 'المصروفات التشغيلية'), data.operatingExpenseCashOutflows, cashFlowAvailable, true);
    cashRow(t('Payroll paid', 'الرواتب المدفوعة'), data.payrollCashDisbursements, cashFlowAvailable, true);
    cashRow(t('Supplier payments', 'مدفوعات الموردين'), data.supplierCashPayments, cashFlowAvailable, true);
    cashRow(t('Cash outflows', 'إجمالي المصروفات النقدية'), data.cashOutflows, cashFlowAvailable, true);

    document.getElementById('cashflowKpis').innerHTML =
      '<div class="pl-wrap"><section class="pl">'
      + '<h3>' + esc(t('Cash flow', 'التدفق النقدي')) + '<span class="pl-period">' + txt(fmtShort(from) + ' – ' + fmtShort(to)) + '</span></h3>'
      + '<p class="psub">' + esc(t('Actual drawer movement — separate from profit.', 'حركة الخزنة الفعلية — منفصلة عن الربح.')) + '</p>'
      + cashRows
      + '<div class="pl-line total"><span class="l">' + esc(t('Net cash flow', 'صافي التدفق النقدي')) + '</span>'
      + '<span class="v strong' + (cashFlowAvailable && Number(data.netCashFlow) < 0 ? ' negv' : '') + '">'
      + esc(financialAmount(data.netCashFlow, data.cashFlowAvailable))
      + '</span></div>'
      + '</section></div>';

    const issues = Array.isArray(data.dataIssues) ? data.dataIssues : [];
    document.getElementById('cashflowIssues').innerHTML = (!cashFlowAvailable)
      ? '<div class="cov"><h4><i style="font-style:normal;color:var(--wrnTxt,#F59E0B)">◈</i>'
        + esc(t('Cash flow unavailable', 'التدفق النقدي غير متاح')) + '</h4>'
        + '<div class="cov-item"><i>◈</i><span>'
        + esc(t('Settlement or supplier cash evidence is incomplete for this period.', 'أدلة التسوية أو نقدية الموردين غير مكتملة لهذه الفترة.'))
        + '</span></div>'
        + (issues.length ? coverageBlock(issues) : '')
        + '</div>'
      : coverageBlock(issues, t('Cash sources are available for this period.', 'المصادر النقدية متاحة لهذه الفترة.'));

    lastKpiRows = cashExport.concat([
      [t('Net cash flow', 'صافي التدفق النقدي'), cashFlowAvailable ? Number(data.netCashFlow) : na],
    ]);
    lastRows = [];
    lastDetailMeta = { count: 0, truncated: false };
    setResultChip('');
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('tableWrap').hidden = true;
    document.getElementById('tablePager').hidden = true;
    document.getElementById('shiftWrap').hidden = true;
    document.getElementById('txWrap').hidden = true;
    document.getElementById('truncNote').hidden = true;
  }

  async function loadExpenses() {
    const { from, to } = dateRange();
    const data = await apiGet('/expenses?from=' + from + '&to=' + to);
    if (!data) return;
    const rows = Array.isArray(data) ? data : [];
    expenseRowsCache = rows;
    renderExpenseKpis(rows);
    paintExpenseFilterOptions(rows);
    wireExpenseFilters();
    renderExpensesTable();
    wireLedgerCsv();
    const expensesFormEl = document.getElementById('expensesForm');
    expensesFormEl.hidden = !canManageExpenses;
    const addExpenseBtn = document.getElementById('btnAddExpense');
    if (addExpenseBtn) addExpenseBtn.hidden = !canManageExpenses;
    wireExpenseForm();
    wireExpenseDrawer();
    const expenseDrawerEl = document.getElementById('expenseDrawer');
    if (!expenseDrawerEl || !expenseDrawerEl.classList.contains('open')) refreshExpenseCatalogOptions();
    if (!expensesFormEl.expenseDate.value) expensesFormEl.expenseDate.value = to;
    lastRows = rows.map((row) => [row.expenseDate, row.category, row.payee || row.description || row.note || '', row.paymentMethod, row.amount, row.status]);
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('tableWrap').hidden = true;
    document.getElementById('tablePager').hidden = true;
    document.getElementById('shiftWrap').hidden = true;
    document.getElementById('txWrap').hidden = true;
    document.getElementById('truncNote').hidden = true;
  }

  async function loadSales() {
    const { from, to } = dateRange();
    let q = '/reports/sales?from=' + from + '&to=' + to;
    if (methodFilter) q += '&method=' + encodeURIComponent(methodFilter);
    if (staffFilter) q += '&staffId=' + encodeURIComponent(staffFilter);
    if (typeFilter) q += '&type=' + encodeURIComponent(typeFilter);
    const data = await apiGet(q);
    if (!data) return;

    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('kpiRow').innerHTML = '';
    const netSalesLabel = t('Net sales', 'صافي المبيعات');
    const transactionsLabel = t('Transactions', 'المعاملات');
    const membershipSalesLabel = t('Membership sales', 'مبيعات العضويات');
    const productSalesLabel = t('Product sales', 'مبيعات المنتجات');
    lastKpiRows = [
      [netSalesLabel, Number(data.netCashIn) || 0],
      [transactionsLabel, Number(data.transactionCount || 0), 'count'],
      [membershipSalesLabel, Number(data.membershipCashIn) || 0],
      [productSalesLabel, Number(data.productCashIn) || 0],
      [t('Gross sales', 'إجمالي المبيعات'), Number(data.cashInTotal) || 0],
      [t('Refunds', 'المرتجعات'), Number(data.cashRefundsTotal) || 0],
    ];
    setResultChip(
      t('Net', 'الصافي') + ' ' + moneyHtml(data.netCashIn)
      + ' <span class="tsep-v">·</span> ' + cnt(data.transactionCount || 0) + ' ' + t('transactions', 'معاملات'),
    );
    document.getElementById('salesKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(netSalesLabel) + '</div><div class="v">' +
      moneyHtml(data.netCashIn) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(transactionsLabel) + '</div><div class="v">' +
      cnt(data.transactionCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(membershipSalesLabel) + '</div><div class="v">' +
      moneyHtml(data.membershipCashIn) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(productSalesLabel) + '</div><div class="v">' +
      moneyHtml(data.productCashIn) +
      '</div></div>';

    const days = data.days || [];
    const max = Math.max.apply(null, days.map((d) => Number(d.cashIn) || 0).concat([0]));
    document.getElementById('salesTrend').innerHTML = days.length
      ? days
          .map((d) => {
            const v = Number(d.cashIn) || 0;
            const h = max > 0 ? Math.max(4, Math.round((v / max) * 116)) : 4;
            return (
              '<div class="sales-bar' +
              (v > 0 ? ' has' : '') +
              '" style="height:' +
              h +
              'px" title="' +
              esc(d.date) +
              ' · ' +
              money(v) +
              '"></div>'
            );
          })
          .join('')
      : '<p class="muted">' + esc(t('No days in this range', 'لا توجد أيام في هذا النطاق')) + '</p>';

    const methodsHtml = (data.methods || [])
      .map(
        (m) =>
          '<div class="break-row"><span>' +
          esc(methodLabel(m.method)) +
          '</span><span>' +
          moneyHtml(m.cashIn) +
          '</span></div>',
      )
      .join('');
    document.getElementById('salesBreak').innerHTML =
      '<div class="break-row"><span>' + esc(t('Gross sales', 'إجمالي المبيعات')) + '</span><span>' +
      moneyHtml(data.cashInTotal) +
      '</span></div>' +
      '<div class="break-row break-neg"><span>' + esc(t('Refunds', 'المرتجعات')) + '</span><span>' +
      moneyHtml(-(Number(data.cashRefundsTotal) || 0)) +
      '</span></div>' +
      '<div class="break-row"><span>' + esc(t('Discounts', 'الخصومات')) + '</span><span>' +
      moneyHtml(data.discountTotal) +
      '</span></div>' +
      '<div class="break-row"><span>' + esc(netSalesLabel) + '</span><span>' +
      moneyHtml(data.netCashIn) +
      '</span></div>' +
      '<p class="break-note">' + esc(t('Net = taken in − executed cash refunds. Discounts are already in the amount taken in.', 'الصافي = المحصّل − المرتجعات النقدية المنفّذة. الخصومات مُدرجة بالفعل في المبلغ المحصّل.')) + '</p>' +
      (methodsHtml ? '<div class="break-methods">' + methodsHtml + '</div>' : '');

    paintStaffPop(data.staff);
    paintMethodPop(data.methods, data.methodOptions);
    paintMoreActive();

    const headers = [t('Invoice', 'الفاتورة'), t('Member', 'العضو'), t('Type', 'النوع'), t('Staff', 'الموظف'), t('Payment', 'الدفع'), t('Date', 'التاريخ'), t('Amount', 'المبلغ')];
    const pays = data.payments || [];
    lastRows = pays.length
      ? [headers].concat(
          pays.map((p) => [
            p.invoiceNumber || '',
            p.memberName,
            typeLabel(p.type),
            p.staffName,
            methodLabel(p.method),
            dtIso(p.paidAtUtc),
            (Number(p.amount) || 0).toFixed(2),
          ]),
        )
      : [];
    lastDetailMeta = { count: pays.length, truncated: data.paymentsTruncated === true };
    const invoiceFallback = t('Invoice', 'الفاتورة');
    const rows = (data.payments || []).map((p) => {
      const href = p.invoiceId ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(p.invoiceId) : '';
      return (
        '<tr' +
        (href ? ' data-href="' + href + '"' : '') +
        '><td>' +
        esc(p.invoiceNumber || (href ? invoiceFallback : '—')) +
        '</td><td>' +
        esc(p.memberName) +
        '</td><td>' +
        esc(typeLabel(p.type)) +
        '</td><td>' +
        esc(p.staffName) +
        '</td><td><span class="st">' +
        esc(methodLabel(p.method)) +
        '</span></td><td>' +
        dtHtml(p.paidAtUtc) +
        '</td><td class="amt">' +
        moneyHtml(p.amount) +
        '</td></tr>'
      );
    });
    if (!pays.length && (Number(data.cashRefundsTotal) || 0) > 0) {
      // Refunds exist but the (type-filtered) sales list is empty — explain instead of a bare "no sales".
      emptyOverride = {
        titleEn: 'No sales match the current filters',
        titleAr: 'لا مبيعات مطابقة للفلاتر الحالية',
        bodyEn: 'Cash refunds of ' + money(data.cashRefundsTotal) + ' were executed in this period outside the filtered sale type. Try "All types".',
        bodyAr: 'توجد مرتجعات نقدية ' + money(data.cashRefundsTotal) + ' منفّذة في هذه الفترة خارج نوع البيع المفلتر. جرّب «كل الأنواع».',
        href: '',
        ctaEn: '',
        ctaAr: '',
      };
    }
    renderTable(
      headers,
      rows,
      !pays.length,
    );
    document.getElementById('truncNote').hidden = !data.paymentsTruncated;
    document.getElementById('truncNote').textContent = data.paymentsTruncated
      ? t('Showing the latest 500 payments. Totals include the full filtered set. Narrow the dates.', 'يعرض أحدث 500 عملية دفع. الإجماليات تشمل المجموعة الكاملة المفلترة. ضيّق نطاق التواريخ.')
      : '';
  }

  async function loadRefunds() {
    const { from, to } = dateRange();
    let q = '/reports/refunds?from=' + from + '&to=' + to;
    if (methodFilter) q += '&method=' + encodeURIComponent(methodFilter);
    if (staffFilter) q += '&staffId=' + encodeURIComponent(staffFilter);
    if (buyerFilter) q += '&buyer=' + encodeURIComponent(buyerFilter);
    const data = await apiGet(q);
    if (!data) return;

    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('kpiRow').innerHTML = '';
    const totalRefundsLabel = t('Total refunds', 'إجمالي المرتجعات');
    const refundAmountLabel = t('Refund amount', 'قيمة المرتجعات');
    const refundedTxLabel = t('Refunded transactions', 'المعاملات المسترجعة');
    const avgRefundLabel = t('Average refund', 'متوسط المرتجع');
    lastKpiRows = [
      [totalRefundsLabel, Number(data.count || 0), 'count'],
      [refundAmountLabel, Number(data.total) || 0],
      [refundedTxLabel, Number(data.saleCount || 0), 'count'],
      [avgRefundLabel, Number(data.average) || 0],
    ];
    setResultChip(
      cnt(data.count || 0) + ' ' + t('refunds', 'مرتجع')
      + ' <span class="tsep-v">·</span> ' + moneyHtml(data.total),
    );
    document.getElementById('refundsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(totalRefundsLabel) + '</div><div class="v">' +
      cnt(data.count || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundAmountLabel) + '</div><div class="v">' +
      moneyHtml(data.total) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundedTxLabel) + '</div><div class="v">' +
      cnt(data.saleCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(avgRefundLabel) + '</div><div class="v">' +
      moneyHtml(data.average) +
      '</div></div>';

    paintStaffPop(data.staff);
    paintMethodPop(null, data.methodOptions);
    paintMorePop();

    const headers = [t('Refund', 'المرتجع'), t('Original Invoice', 'الفاتورة الأصلية'), t('Member', 'العضو'), t('Reason', 'السبب'), t('Staff', 'الموظف'), t('Payment', 'الدفع'), t('Date', 'التاريخ'), t('Amount', 'المبلغ')];
    const items = data.items || [];
    lastRows = items.length
      ? [headers].concat(
          items.map((r) => [
            r.creditNoteNumber || r.id,
            r.originalInvoiceNumber || '',
            r.memberName,
            r.reason || '',
            r.staffName,
            methodLabel(r.method),
            dtIso(r.executedAtUtc),
            (Number(r.amount) || 0).toFixed(2),
          ]),
        )
      : [];
    lastDetailMeta = { count: items.length, truncated: data.truncated === true };
    const refundInvoiceFallback = t('Invoice', 'الفاتورة');
    const rows = items.map((r) => {
      const origHref = r.originalInvoiceId
        ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(r.originalInvoiceId)
        : '';
      const cnHref = r.creditNoteId
        ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(r.creditNoteId)
        : origHref;
      const memHref = r.memberId ? '/dashboard/members/' + r.memberId + '/' : '';
      const refundLabel = r.creditNoteNumber || String(r.id || '').slice(0, 8);
      const invLabel = r.originalInvoiceNumber || (origHref ? refundInvoiceFallback : '—');
      return (
        '<tr' +
        (origHref
          ? ' data-href="' + origHref + '"'
          : cnHref
            ? ' data-href="' + cnHref + '"'
            : memHref
              ? ' data-href="' + memHref + '"'
              : '') +
        '><td>' +
        (cnHref ? '<a href="' + cnHref + '">' + esc(refundLabel) + '</a>' : esc(refundLabel)) +
        '</td><td>' +
        (origHref ? '<a href="' + origHref + '">' + esc(invLabel) + '</a>' : esc(invLabel)) +
        '</td><td>' +
        (memHref ? '<a href="' + memHref + '">' + esc(r.memberName) + '</a>' : esc(r.memberName)) +
        '</td><td>' +
        esc(r.reason || '—') +
        '</td><td>' +
        esc(r.staffName) +
        '</td><td><span class="st">' +
        esc(methodLabel(r.method)) +
        '</span></td><td>' +
        dtHtml(r.executedAtUtc) +
        '</td><td class="amt">' +
        moneyHtml(r.amount) +
        '</td></tr>'
      );
    });
    renderTable(
      headers,
      rows,
      !items.length,
    );
    document.getElementById('truncNote').hidden = !data.truncated;
    document.getElementById('truncNote').textContent = data.truncated
      ? t('Showing the latest 500 refunds. Totals include the full filtered set. Narrow the dates.', 'يعرض أحدث 500 مرتجع. الإجماليات تشمل المجموعة الكاملة المفلترة. ضيّق نطاق التواريخ.')
      : '';
  }

  function membershipTypeLabel(type) {
    return type === 'renewal' ? t('Renewal', 'تجديد') : type === 'new' ? t('New', 'جديدة') : type || '—';
  }
  function membershipStatusLabel(s) {
    const map = {
      active: t('Active', 'نشطة'),
      pending: t('Pending', 'قيد الانتظار'),
      cancelled: t('Cancelled', 'ملغاة'),
      expired: t('Expired', 'منتهية'),
      frozen: t('Frozen', 'مجمّدة'),
      scheduled: t('Scheduled', 'مجدولة'),
      refunded: t('Refunded', 'مسترجعة'),
    };
    return map[s] || s || '—';
  }

  async function loadMemberships() {
    const { from, to } = dateRange();
    let q = '/reports/memberships?from=' + from + '&to=' + to;
    if (planFilter) q += '&planId=' + encodeURIComponent(planFilter);
    if (staffFilter) q += '&staffId=' + encodeURIComponent(staffFilter);
    if (typeFilter) q += '&type=' + encodeURIComponent(typeFilter);
    const data = await apiGet(q);
    if (!data) return;

    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('kpiRow').innerHTML = '';
    const rev = canFinance ? money(data.revenue) : '—';
    const newMembershipsLabel = t('New Memberships', 'العضويات الجديدة');
    const renewalsLabel = t('Renewals', 'التجديدات');
    const membershipRevenueLabel = t('Membership Revenue', 'إيرادات العضويات');
    const refundedMembershipsLabel = t('Refunded Memberships', 'العضويات المسترجعة');
    lastKpiRows = [
      [newMembershipsLabel, Number(data.newCount || 0), 'count'],
      [renewalsLabel, Number(data.renewalCount || 0), 'count'],
      [membershipRevenueLabel, canFinance ? Number(data.revenue) || 0 : '—'],
      [refundedMembershipsLabel, Number(data.refundedCount || 0), 'count'],
    ];
    setResultChip(
      cnt(data.newCount || 0) + ' ' + t('new', 'جديدة')
      + ' <span class="tsep-v">·</span> ' + cnt(data.renewalCount || 0) + ' ' + t('renewals', 'تجديد')
      + (canFinance ? ' <span class="tsep-v">·</span> ' + moneyHtml(data.revenue) : ''),
    );
    document.getElementById('membershipsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(newMembershipsLabel) + '</div><div class="v">' +
      cnt(data.newCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(renewalsLabel) + '</div><div class="v">' +
      cnt(data.renewalCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(membershipRevenueLabel) + '</div><div class="v">' +
      (canFinance ? moneyHtml(data.revenue) : '—') +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundedMembershipsLabel) + '</div><div class="v">' +
      cnt(data.refundedCount || 0) +
      '</div></div>';

    document.getElementById('membershipsBreak').innerHTML =
      '<div class="break-row"><span>' + esc(t('New', 'جديدة')) + '</span><span>' +
      String(data.newCount || 0) +
      '</span></div>' +
      '<div class="break-row"><span>' + esc(renewalsLabel) + '</span><span>' +
      String(data.renewalCount || 0) +
      '</span></div>';

    const byPlan = data.byPlan || [];
    document.getElementById('membershipsPlanPanel').hidden = !byPlan.length;
    const newWordLabel = t('new', 'جديدة');
    const renewalsWordLabel = t('renewals', 'تجديد');
    document.getElementById('membershipsByPlan').innerHTML = byPlan
      .map((p) => {
        const n = Number(p.newCount || 0);
        const r = Number(p.renewalCount || 0);
        const extra = canFinance ? ' ' + moneyHtml(p.revenue) : '';
        return (
          '<div class="break-row"><span>' +
          esc(p.planName) +
          '</span><span>' +
          n +
          ' ' + newWordLabel + ' · ' +
          r +
          ' ' + renewalsWordLabel +
          extra +
          '</span></div>'
        );
      })
      .join('');

    paintStaffPop(data.staff);
    paintPlanPop(data.plans);
    paintMoreActive();

    const items = data.startedRows || [];
    const headers = canFinance
      ? [t('Date', 'التاريخ'), t('Member', 'العضو'), t('Plan', 'الخطة'), t('Type', 'النوع'), t('Staff', 'الموظف'), t('Invoice', 'الفاتورة'), t('Amount', 'المبلغ'), t('Status', 'الحالة')]
      : [t('Date', 'التاريخ'), t('Member', 'العضو'), t('Plan', 'الخطة'), t('Type', 'النوع'), t('Staff', 'الموظف'), t('Status', 'الحالة')];
    lastRows = items.length
      ? [headers].concat(
          items.map((r) =>
            canFinance
              ? [
                  r.startDate,
                  r.memberName,
                  r.planName,
                  membershipTypeLabel(r.type),
                  r.staffName,
                  r.invoiceNumber || '',
                  (Number(r.amount) || 0).toFixed(2),
                  membershipStatusLabel(r.status),
                ]
              : [
                  r.startDate,
                  r.memberName,
                  r.planName,
                  membershipTypeLabel(r.type),
                  r.staffName,
                  membershipStatusLabel(r.status),
                ],
          ),
        )
      : [];
    lastDetailMeta = { count: items.length, truncated: data.truncated === true };
    const rows = items.map((r) => {
      const memHref = r.memberId ? '/dashboard/members/' + r.memberId + '/' : '';
      const invHref = r.invoiceId
        ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(r.invoiceId)
        : '';
      const href = invHref || memHref;
      const invLabel = r.invoiceNumber || (invHref ? t('Invoice', 'الفاتورة') : '—');
      const moneyCell = canFinance
        ? '<td>' +
          (invHref ? '<a href="' + invHref + '">' + esc(invLabel) + '</a>' : esc(invLabel)) +
          '</td><td class="amt">' +
          moneyHtml(r.amount) +
          '</td>'
        : '';
      return (
        '<tr' +
        (href ? ' data-href="' + href + '"' : '') +
        '><td>' +
        txt(fmtDate(r.startDate)) +
        '</td><td>' +
        (memHref ? '<a href="' + memHref + '">' + esc(r.memberName) + '</a>' : esc(r.memberName)) +
        '</td><td>' +
        esc(r.planName) +
        '</td><td>' +
        esc(membershipTypeLabel(r.type)) +
        '</td><td>' +
        esc(r.staffName) +
        '</td>' +
        moneyCell +
        '<td><span class="st">' +
        esc(membershipStatusLabel(r.status)) +
        '</span></td></tr>'
      );
    });
    renderTable(headers, rows, !items.length);
    document.getElementById('truncNote').hidden = !data.truncated;
    document.getElementById('truncNote').textContent = data.truncated
      ? t('Showing the latest 500 memberships. Totals include the full filtered set. Narrow the dates.', 'يعرض أحدث 500 عضوية. الإجماليات تشمل المجموعة الكاملة المفلترة. ضيّق نطاق التواريخ.')
      : '';
  }

  async function loadProducts() {
    const { from, to } = dateRange();
    let q = '/reports/products?from=' + from + '&to=' + to;
    if (productFilter) q += '&productId=' + encodeURIComponent(productFilter);
    if (staffFilter) q += '&staffId=' + encodeURIComponent(staffFilter);
    if (methodFilter) q += '&method=' + encodeURIComponent(methodFilter);
    const data = await apiGet(q);
    if (!data) return;

    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('kpiRow').innerHTML = '';
    catalogMethods = data.methodOptions || [];
    const productRevenueLabel = t('Product Revenue', 'إيرادات المنتجات');
    const unitsSoldLabel = t('Units Sold', 'الوحدات المباعة');
    const productsTxLabel = t('Transactions', 'المعاملات');
    const topProductLabel = t('Top Product', 'أفضل منتج');
    lastKpiRows = [
      [productRevenueLabel, Number(data.revenue) || 0],
      [unitsSoldLabel, Number(data.unitsSold || 0), 'count'],
      [productsTxLabel, Number(data.transactionCount || 0), 'count'],
      [topProductLabel, data.topProductName || '—', 'text'],
    ];
    setResultChip(
      cnt(data.unitsSold || 0) + ' ' + t('units', 'وحدة')
      + ' <span class="tsep-v">·</span> ' + moneyHtml(data.revenue),
    );
    document.getElementById('productsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(productRevenueLabel) + '</div><div class="v">' +
      moneyHtml(data.revenue) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(unitsSoldLabel) + '</div><div class="v">' +
      cnt(data.unitsSold || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(productsTxLabel) + '</div><div class="v">' +
      cnt(data.transactionCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(topProductLabel) + '</div><div class="v">' +
      esc(data.topProductName || '—') +
      '</div></div>';

    const ranked = data.topProducts || [];
    document.getElementById('productsRankPanel').hidden = !ranked.length;
    document.getElementById('productsRankBody').innerHTML = ranked
      .map(
        (r) =>
          '<tr><td>' +
          esc(r.name) +
          '</td><td>' +
          esc(r.unitsSold) +
          '</td><td class="amt">' +
          moneyHtml(r.revenue) +
          '</td></tr>',
      )
      .join('');
    stampColLabels('#productsRankPanel table');

    paintStaffPop(data.staff);
    paintProductPop(data.products);
    paintMethodPop(null, data.methodOptions);
    paintMoreActive();

    const items = data.lines || [];
    const headers = [t('Date', 'التاريخ'), t('Invoice', 'الفاتورة'), t('Product', 'المنتج'), t('Quantity', 'الكمية'), t('Staff', 'الموظف'), t('Payment', 'الدفع'), t('Revenue', 'الإيرادات')];
    lastRows = items.length
      ? [headers].concat(
          items.map((r) => [
            dtIso(r.soldAtUtc),
            r.invoiceNumber || '',
            r.productName,
            r.quantity,
            r.staffName,
            methodLabel(r.payment),
            (Number(r.revenue) || 0).toFixed(2),
          ]),
        )
      : [];
    lastDetailMeta = { count: items.length, truncated: data.truncated === true };
    const productInvoiceFallback = t('Invoice', 'الفاتورة');
    const rows = items.map((r) => {
      const href = r.invoiceId
        ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(r.invoiceId)
        : '';
      const invLabel = r.invoiceNumber || (href ? productInvoiceFallback : '—');
      return (
        '<tr' +
        (href ? ' data-href="' + href + '"' : '') +
        '><td>' +
        dtHtml(r.soldAtUtc) +
        '</td><td>' +
        (href ? '<a href="' + href + '">' + esc(invLabel) + '</a>' : esc(invLabel)) +
        '</td><td>' +
        esc(r.productName) +
        '</td><td>' +
        esc(r.quantity) +
        '</td><td>' +
        esc(r.staffName) +
        '</td><td><span class="st">' +
        esc(methodLabel(r.payment)) +
        '</span></td><td class="amt">' +
        moneyHtml(r.revenue) +
        '</td></tr>'
      );
    });
    renderTable(headers, rows, !items.length);
    document.getElementById('truncNote').hidden = !data.truncated;
    document.getElementById('truncNote').textContent = data.truncated
      ? t('Showing the latest 500 product lines. Totals include the full filtered set. Narrow the dates.', 'يعرض أحدث 500 سطر منتج. الإجماليات تشمل المجموعة الكاملة المفلترة. ضيّق نطاق التواريخ.')
      : '';
  }

  async function loadStaff() {
    const { from, to } = dateRange();
    let q = '/reports/staff-shifts?from=' + from + '&to=' + to;
    if (staffFilter) q += '&staffId=' + encodeURIComponent(staffFilter);
    if (shiftFilter) q += '&shiftId=' + encodeURIComponent(shiftFilter);
    const data = await apiGet(q);
    if (!data) return;

    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('kpiRow').innerHTML = '';
    const totalSalesLabel = t('Total Sales', 'إجمالي المبيعات');
    const staffTxLabel = t('Transactions', 'المعاملات');
    const staffRefundsLabel = t('Refunds', 'المرتجعات');
    const shiftsLabel = t('Shifts', 'الورديات');
    lastKpiRows = [
      [totalSalesLabel, Number(data.sales) || 0],
      [staffTxLabel, Number(data.transactionCount || 0), 'count'],
      [staffRefundsLabel, Number(data.refunds) || 0],
      [shiftsLabel, Number(data.shiftCount || 0), 'count'],
    ];
    setResultChip(
      t('Sales', 'المبيعات') + ' ' + moneyHtml(data.sales)
      + ' <span class="tsep-v">·</span> ' + cnt(data.transactionCount || 0) + ' ' + t('transactions', 'معاملات'),
    );
    document.getElementById('staffKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(totalSalesLabel) + '</div><div class="v">' +
      moneyHtml(data.sales) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(staffTxLabel) + '</div><div class="v">' +
      cnt(data.transactionCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(staffRefundsLabel) + '</div><div class="v">' +
      moneyHtml(data.refunds) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(shiftsLabel) + '</div><div class="v">' +
      cnt(data.shiftCount || 0) +
      '</div></div>';

    paintStaffPop(data.staffOptions);
    paintShiftPop(data.shiftOptions);
    paintMoreActive();

    const staff = data.staffCashIn || [];
    const shifts = data.shifts || [];
    const txs = data.transactions || [];
    const shiftOpts = data.shiftOptions || [];
    const openLabel = t('Open', 'مفتوحة');
    function shiftName(s) {
      const opt = shiftOpts.find((o) => (o.shiftId || '') === (s.shiftId || ''));
      return (opt && opt.name) || dt(s.openedAt);
    }
    const headers = [t('Staff', 'الموظف'), t('Sales', 'المبيعات'), staffTxLabel, staffRefundsLabel, shiftsLabel];
    const txHeaders = [t('Date', 'التاريخ'), t('Type', 'النوع'), t('Invoice', 'الفاتورة'), t('Staff', 'الموظف'), t('Payment', 'الدفع'), t('Amount', 'المبلغ')];
    // One table per exported file: the drill-down (shift transactions) wins when a shift is selected,
    // otherwise the staff summary is the exported table.
    if (shiftFilter && txs.length) {
      lastRows = [txHeaders].concat(
        txs.map((tx) => [
          dtIso(tx.atUtc),
          tx.type === 'refund' ? t('Refund', 'مرتجع') : t('Sale', 'بيع'),
          tx.invoiceNumber || '',
          tx.staffName,
          methodLabel(tx.method),
          (Number(tx.amount) || 0).toFixed(2),
        ]),
      );
      lastDetailMeta = { count: txs.length, truncated: data.truncated === true };
    } else {
      lastRows = [headers].concat(
        staff.map((r) => [
          r.staffName,
          (Number(r.cashIn) || 0).toFixed(2),
          Number(r.paymentCount) || 0,
          (Number(r.refunds) || 0).toFixed(2),
          Number(r.shiftCount) || 0,
        ]),
      );
      lastDetailMeta = { count: staff.length, truncated: data.truncated === true };
    }
    const staffRows = staff.map((r) => {
      const id = r.userId || '';
      return (
        '<tr data-staff="' +
        esc(id) +
        '"><td>' +
        esc(r.staffName) +
        '</td><td class="amt">' +
        moneyHtml(r.cashIn) +
        '</td><td>' +
        esc(r.paymentCount) +
        '</td><td class="amt">' +
        moneyHtml(r.refunds) +
        '</td><td>' +
        esc(r.shiftCount) +
        '</td></tr>'
      );
    });
    const empty = !staff.length && !shifts.length;
    renderTable(headers, staffRows, empty);

    const wrap = document.getElementById('shiftWrap');
    wrap.hidden = empty || !shifts.length;
    if (!wrap.hidden) {
      document.getElementById('shiftBody').innerHTML = shifts
        .map((s) => {
          return (
            '<tr data-shift="' +
            esc(s.shiftId) +
            '"><td>' +
            esc(shiftName(s)) +
            '</td><td>' +
            esc(s.staffName) +
            '</td><td>' +
            dtHtml(s.openedAt) +
            '</td><td>' +
            (s.closedAt ? dtHtml(s.closedAt) : '<span style="color:var(--ltt)">—</span>') +
            '</td><td>' +
            txt(shiftDurationText(s)) +
            '</td><td class="amt">' +
            moneyHtml(s.sales) +
            '</td><td class="amt">' +
            moneyHtml(s.refunds) +
            '</td><td>' +
            shiftStatusBadge(s) +
            '</td></tr>'
          );
        })
        .join('');
      stampColLabels('#shiftWrap table');
      const note = document.getElementById('shiftNote');
      if (note) {
        note.hidden = false;
        note.textContent = t(
          'A shift belongs to the Cairo day it opened on — a shift opened late at night may close the next morning.',
          'الوردية تُنسب ليوم افتتاحها (توقيت القاهرة) — الوردية التي تُفتح ليلًا قد تُغلق صباح اليوم التالي.',
        );
      }
      document.querySelectorAll('#shiftBody tr[data-shift]').forEach((tr) => {
        tr.onclick = () => {
          const id = tr.getAttribute('data-shift') || '';
          shiftFilter = shiftFilter === id ? '' : id;
          closePops();
          loadDetail();
        };
      });
    }

    const txWrap = document.getElementById('txWrap');
    const showTx = !empty && (staffFilter || shiftFilter) && txs.length;
    txWrap.hidden = !showTx;
    if (showTx) {
      const txInvoiceFallback = t('Invoice', 'الفاتورة');
      document.getElementById('txBody').innerHTML = txs
        .map((tx) => {
          const href = tx.invoiceId
            ? '/dashboard/invoices/?invoiceId=' + encodeURIComponent(tx.invoiceId)
            : '';
          const invLabel = tx.invoiceNumber || (href ? txInvoiceFallback : '—');
          const kind = tx.type === 'refund' ? t('Refund', 'مرتجع') : t('Sale', 'بيع');
          return (
            '<tr' +
            (href ? ' data-href="' + href + '"' : '') +
            '><td>' +
            dtHtml(tx.atUtc) +
            '</td><td>' +
            esc(kind) +
            '</td><td>' +
            (href ? '<a href="' + href + '">' + esc(invLabel) + '</a>' : esc(invLabel)) +
            '</td><td>' +
            esc(tx.staffName) +
            '</td><td><span class="st">' +
            esc(methodLabel(tx.method)) +
            '</span></td><td class="amt">' +
            moneyHtml(tx.amount) +
            '</td></tr>'
          );
        })
        .join('');
      stampColLabels('#txWrap table');
      document.querySelectorAll('#txBody tr[data-href]').forEach((tr) => {
        tr.onclick = () => {
          location.href = tr.getAttribute('data-href');
        };
      });
      document.querySelectorAll('#txBody a[href]').forEach((a) => {
        a.addEventListener('click', (ev) => ev.stopPropagation());
      });
    }
    document.getElementById('truncNote').hidden = !data.truncated;
    document.getElementById('truncNote').textContent = data.truncated
      ? t('Showing the latest 500 transactions. Totals include the full filtered set.', 'يعرض أحدث 500 معاملة. الإجماليات تشمل المجموعة الكاملة المفلترة.')
      : '';
  }

  function errText() {
    // i18n-ignore-next-line — fallback if catalog not injected
    if (global.GfpI18n && typeof global.GfpI18n.t === 'function') {
      return global.GfpI18n.t('reports.loadError');
    }
    return t("We couldn't load this report.", 'تعذّر تحميل هذا التقرير.');
  }

  function cardHtml(def, state) {
    const loading = state.cls === 'is-load';
    const a = loading ? '<div class="sk-block"></div>' : state.a || '—';
    const b = loading ? '<div class="sk-block"></div>' : state.b || '—';
    return (
      '<button type="button" class="rpt-card' +
      (state.cls ? ' ' + state.cls : '') +
      '" data-tab="' +
      def.key +
      '">' +
      '<div class="rpt-card-ico"><i class="ti ' +
      def.icon +
      '"></i></div>' +
      '<h2>' +
      esc(t(def.titleEn, def.titleAr)) +
      '</h2>' +
      '<dl><div><dt>' +
      esc(state.la) +
      '</dt><dd>' +
      a +
      '</dd></div><div><dt>' +
      esc(state.lb) +
      '</dt><dd>' +
      b +
      '</dd></div></dl>' +
      '<p class="rpt-card-desc">' +
      esc(state.desc || t(def.descEn, def.descAr)) +
      '</p>' +
      '<span class="rpt-card-go">' + esc(t('View Report', 'عرض التقرير')) + ' →</span>' +
      '</button>'
    );
  }

  function bindCards() {
    document.querySelectorAll('#cardGrid .rpt-card').forEach((btn) => {
      btn.onclick = () => openReport(btn.getAttribute('data-tab'));
    });
  }

  function paintCards(states) {
    const html = CARDS.filter((c) => canSee(c.key))
      .map((c) => cardHtml(c, states[c.key] || { la: '…', lb: '…', cls: 'is-load' }))
      .join('');
    document.getElementById('cardGrid').innerHTML = html;
    bindCards();
  }

  function summarizeCard(key, data) {
    const unavailable = t('Unavailable', 'غير متاح');
    if (key === 'profitability') {
      const netProfitAvailable = data.netProfitAvailable === true;
      const cashFlowAvailable = data.cashFlowAvailable === true;
      const needsData = !netProfitAvailable || data.netProfit == null;
      return {
        la: t('Net profit', 'صافي الربح'),
        a: netProfitAvailable && data.netProfit != null ? moneyHtml(data.netProfit) : unavailable,
        lb: t('Net cash flow', 'صافي التدفق النقدي'),
        b: cashFlowAvailable && data.netCashFlow != null ? moneyHtml(data.netCashFlow) : unavailable,
        activity: data.netCashFlow !== 0 || data.revenue !== 0,
        desc: needsData
          ? t('Net profit needs product costs and a payroll period — open the report for the details.', 'صافي الربح يحتاج تكلفة المنتجات وفترة رواتب — افتح التقرير للتفاصيل.')
          : undefined,
        export: [t('Profitability', 'الربحية'),
          netProfitAvailable && data.netProfit != null ? Number(data.netProfit) : unavailable,
          cashFlowAvailable && data.netCashFlow != null ? Number(data.netCashFlow) : unavailable],
      };
    }
    if (key === 'cashflow') {
      const cashFlowAvailable = data.cashFlowAvailable === true;
      return {
        la: t('Net cash flow', 'صافي التدفق النقدي'),
        a: cashFlowAvailable && data.netCashFlow != null ? moneyHtml(data.netCashFlow) : unavailable,
        lb: t('Cash outflows', 'المصروفات النقدية'),
        b: cashFlowAvailable && data.cashOutflows != null ? moneyHtml(data.cashOutflows) : unavailable,
        activity: cashFlowAvailable
          && (Number(data.netCashFlow) !== 0 || Number(data.cashOutflows) !== 0),
        export: [t('Cash Flow', 'التدفق النقدي'),
          cashFlowAvailable && data.netCashFlow != null ? Number(data.netCashFlow) : unavailable,
          cashFlowAvailable && data.cashOutflows != null ? Number(data.cashOutflows) : unavailable],
      };
    }
    if (key === 'expenses') {
      const rows = Array.isArray(data) ? data : [];
      const posted = rows.filter((row) => String(row.status || '').toLowerCase() === 'posted');
      const total = posted.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return {
        la: t('Posted expenses', 'المصروفات المرحّلة'),
        a: moneyHtml(total),
        lb: t('Entries', 'القيود'),
        b: String(posted.length),
        activity: posted.length > 0 || total !== 0,
        export: [t('Expenses', 'المصروفات'), Number(total.toFixed(2)), String(posted.length)],
      };
    }
    if (key === 'sales') {
      const n = data.transactionCount != null ? data.transactionCount : paymentCount(data);
      return {
        la: t('Net sales', 'صافي المبيعات'),
        a: moneyHtml(data.netCashIn),
        lb: t('Transactions', 'المعاملات'),
        b: String(n),
        activity: n > 0 || Number(data.netCashIn) !== 0 || Number(data.bookedTotal) !== 0,
        export: [t('Sales', 'المبيعات'), Number(data.netCashIn) || 0, String(n)],
      };
    }
    if (key === 'refunds') {
      const n = data.count != null ? data.count : (data.items || []).length;
      return {
        la: t('Refund amount', 'قيمة المرتجعات'),
        a: moneyHtml(data.total),
        lb: t('Refunds', 'المرتجعات'),
        b: data.truncated ? String(n) + '+' : String(n),
        activity: n > 0 || Number(data.total) !== 0,
        export: [t('Refunds', 'المرتجعات'), Number(data.total) || 0, String(n)],
      };
    }
    if (key === 'memberships') {
      return {
        la: t('New', 'جديدة'),
        a: String(data.newCount != null ? data.newCount : data.started || 0),
        lb: t('Renewals', 'التجديدات'),
        b: String(data.renewalCount || 0),
        activity: Number(data.newCount || data.started) > 0 || Number(data.renewalCount) > 0,
        export: [t('Memberships', 'العضويات'), String(data.newCount || 0), String(data.renewalCount || 0)],
      };
    }
    if (key === 'products') {
      const qty = data.unitsSold != null ? Number(data.unitsSold) : 0;
      const rev = Number(data.revenue) || 0;
      return {
        la: t('Product revenue', 'إيرادات المنتجات'),
        a: moneyHtml(rev),
        lb: t('Units sold', 'الوحدات المباعة'),
        b: String(qty),
        activity: qty > 0 || rev !== 0,
        export: [t('Products', 'المنتجات'), Number(rev.toFixed(2)), String(qty)],
      };
    }
    const take = data.sales != null ? Number(data.sales) : (data.staffCashIn || []).reduce((s, r) => s + Number(r.cashIn || 0), 0);
    const shifts = data.shiftCount != null ? data.shiftCount : (data.shifts || []).length;
    return {
      la: t('Total sales', 'إجمالي المبيعات'),
      a: moneyHtml(take),
      lb: t('Shifts', 'الورديات'),
      b: String(shifts),
      activity: take !== 0 || Number(data.refunds) > 0 || shifts > 0 || (data.staffCashIn || []).length > 0,
      export: [t('Staff & Shifts', 'الموظفون والورديات'), Number(take.toFixed(2)), String(shifts)],
    };
  }

  async function loadHub() {
    document.getElementById('viewHub').hidden = false;
    document.getElementById('viewDetail').hidden = true;
    document.getElementById('emptyState').hidden = true;
    document.getElementById('cardGrid').hidden = false;
    document.getElementById('salesFilters').hidden = true;
    document.getElementById('salesBoard').hidden = true;
    document.getElementById('refundsBoard').hidden = true;
    document.getElementById('membershipsBoard').hidden = true;
    document.getElementById('productsBoard').hidden = true;
    document.getElementById('staffBoard').hidden = true;
    document.getElementById('profitabilityBoard').hidden = true;
    document.getElementById('cashflowBoard').hidden = true;
    document.getElementById('expensesBoard').hidden = true;
    document.getElementById('txWrap').hidden = true;
    lastRows = [];
    lastKpiRows = [];
    lastDetailMeta = { count: 0, truncated: false };
    emptyOverride = null;
    setResultChip('');
    hubSummary = [];
    setCrumb();
    syncUrl();
    const visible = CARDS.filter((c) => canSee(c.key));
    const loading = {};
    visible.forEach((c) => {
      loading[c.key] = {
        la: c.key === 'sales' ? t('Net sales', 'صافي المبيعات') : c.key === 'refunds' ? t('Refund amount', 'قيمة المرتجعات') : c.key === 'memberships' ? t('New', 'جديدة') : c.key === 'products' ? t('Product revenue', 'إيرادات المنتجات') : c.key === 'profitability' ? t('Net profit', 'صافي الربح') : c.key === 'cashflow' ? t('Net cash flow', 'صافي التدفق النقدي') : c.key === 'expenses' ? t('Posted expenses', 'المصروفات المرحّلة') : t('Total sales', 'إجمالي المبيعات'),
        lb: c.key === 'sales' ? t('Transactions', 'المعاملات') : c.key === 'refunds' ? t('Refunds', 'المرتجعات') : c.key === 'memberships' ? t('Renewals', 'التجديدات') : c.key === 'products' ? t('Units sold', 'الوحدات المباعة') : c.key === 'profitability' ? t('Net cash flow', 'صافي التدفق النقدي') : c.key === 'cashflow' ? t('Cash outflows', 'المصروفات النقدية') : c.key === 'expenses' ? t('Entries', 'القيود') : t('Shifts', 'الورديات'),
        a: '…',
        b: '…',
        cls: 'is-load',
      };
    });
    paintCards(loading);

    const { from, to } = dateRange();
    const q = '?from=' + from + '&to=' + to;
    const paths = {
      sales: '/reports/sales' + q,
      refunds: '/reports/refunds' + q,
      memberships: '/reports/memberships' + q,
      products: '/reports/products' + q,
      staff: '/reports/staff-shifts' + q,
      profitability: '/reports/profitability' + q,
      cashflow: '/reports/cash-flow' + q,
      expenses: '/expenses' + q,
    };
    const states = { ...loading };
    let anyActivity = false;
    let anyOk = false;
    await Promise.all(
      visible.map(async (c) => {
        try {
          const data = await apiGet(paths[c.key]);
          if (!data) return;
          const s = summarizeCard(c.key, data);
          states[c.key] = s;
          if (s.activity) anyActivity = true;
          anyOk = true;
          if (s.export) hubSummary.push(s.export);
        } catch (e) {
          states[c.key] = {
            la: loading[c.key].la,
            lb: loading[c.key].lb,
            a: '—',
            b: '—',
            cls: 'is-err',
            desc: errText(e),
          };
        }
      }),
    );
    paintCards(states);
    const showEmpty = anyOk && !anyActivity;
    document.getElementById('emptyState').hidden = !showEmpty;
    document.getElementById('cardGrid').hidden = showEmpty;
  }

  async function loadDetail() {
    if (!activeTab || !canSee(activeTab)) {
      activeTab = '';
      await loadHub();
      return;
    }
    document.getElementById('viewHub').hidden = true;
    document.getElementById('viewDetail').hidden = false;
    document.getElementById('shiftWrap').hidden = true;
    document.getElementById('txWrap').hidden = true;
    document.getElementById('detailEmpty').hidden = true;
    document.getElementById('detailError').hidden = true;
    document.getElementById('tableWrap').hidden = false;
    lastRows = [];
    lastKpiRows = [];
    lastDetailMeta = { count: 0, truncated: false };
    emptyOverride = null;
    setTabChrome();
    showTableSkeleton(activeTab === 'staff' ? 5 : 7);
    if (activeTab === 'sales') fillKpiSkeleton('salesKpis');
    else if (activeTab === 'refunds') fillKpiSkeleton('refundsKpis');
    else if (activeTab === 'memberships') fillKpiSkeleton('membershipsKpis');
    else if (activeTab === 'products') fillKpiSkeleton('productsKpis');
    else if (activeTab === 'profitability' || activeTab === 'cashflow') {
      document.getElementById(activeTab === 'cashflow' ? 'cashflowKpis' : 'profitabilityKpis').innerHTML =
        '<div class="pl"><div class="sk-block" style="width:38%"></div><div class="sk-block lg" style="width:70%;margin-top:12px"></div><div class="sk-block" style="width:55%"></div></div>';
      document.getElementById(activeTab === 'cashflow' ? 'cashflowIssues' : 'profitabilityIssues').innerHTML = '';
    }
    else if (activeTab === 'expenses') document.getElementById('expensesKpis').innerHTML = '<div class="exp-kpi exp-sk"></div><div class="exp-kpi exp-sk"></div><div class="exp-kpi exp-sk"></div><div class="exp-kpi exp-sk"></div>';
    else fillKpiSkeleton('staffKpis');
    try {
      if (activeTab === 'sales') await loadSales();
      else if (activeTab === 'refunds') await loadRefunds();
      else if (activeTab === 'memberships') await loadMemberships();
      else if (activeTab === 'products') await loadProducts();
      else if (activeTab === 'profitability') await loadProfitability();
      else if (activeTab === 'cashflow') await loadCashflow();
      else if (activeTab === 'expenses') await loadExpenses();
      else await loadStaff();
    } catch (e) {
      document.getElementById('kpiRow').innerHTML = '';
      document.getElementById('rptToolbar').innerHTML = '';
      showDetailError(true);
    }
  }

  function openReport(key) {
    if (!canSee(key)) return;
    activeTab = key;
    loadDetail();
  }

  function goHub() {
    activeTab = '';
    loadHub();
  }

  document.querySelectorAll('#hubTabs .hub-tab').forEach((btn) => {
    btn.onclick = () => openReport(btn.getAttribute('data-tab'));
  });
  document.getElementById('btnBack').onclick = goHub;
  document.getElementById('crumb').addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;
    ev.preventDefault();
    goHub();
  });

  document.getElementById('btnRange').onclick = () => {
    setRangeOpen(document.getElementById('rangePop').hidden);
  };
  document.querySelectorAll('#rangePop .range-opt').forEach((btn) => {
    btn.onclick = () => {
      applyPreset(btn.getAttribute('data-preset'));
      setRangeOpen(false);
      if (activeTab) loadDetail();
      else loadHub();
    };
  });
  document.getElementById('btnStaff').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnStaff', 'staffPop');
  };
  document.getElementById('btnMethod').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnMethod', 'methodPop');
  };
  document.getElementById('btnPlan').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnPlan', 'planPop');
  };
  document.getElementById('btnProduct').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnProduct', 'productPop');
  };
  document.getElementById('btnShift').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnShift', 'shiftFilterPop');
  };
  document.getElementById('btnMore').onclick = (ev) => {
    ev.stopPropagation();
    togglePop('btnMore', 'morePop');
  };
  document.getElementById('btnApply').onclick = () => {
    rangePreset = 'custom';
    setRangeLabel();
    setRangeOpen(false);
    if (activeTab) loadDetail();
    else loadHub();
  };
  const clearFiltersBtn = document.getElementById('btnClearFilters');
  if (clearFiltersBtn) {
    clearFiltersBtn.onclick = () => {
      staffFilter = '';
      methodFilter = '';
      typeFilter = '';
      buyerFilter = '';
      planFilter = '';
      productFilter = '';
      shiftFilter = '';
      closePops();
      loadDetail();
    };
  }
  function openRange(ev) {
    if (ev) ev.stopPropagation();
    setRangeOpen(true);
  }
  document.getElementById('btnChangeDate').onclick = openRange;
  document.getElementById('btnChangeDateDetail').onclick = openRange;
  document.getElementById('btnRetry').onclick = () => {
    if (activeTab) loadDetail();
  };
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.range-wrap')) return;
    closePops();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closePops();
  });

  function exportMeta() {
    const { from, to } = dateRange();
    const reportLabel = t('Report', 'التقرير');
    const rows = [
      [reportLabel, activeTab ? tabPageTitle(activeTab) : t('Reports summary', 'ملخص التقارير')],
      [t('From', 'من'), from],
      [t('To', 'إلى'), to],
    ];
    if (!activeTab) return rows;
    if (['sales', 'refunds', 'memberships', 'products', 'staff'].indexOf(activeTab) >= 0) {
      rows.push([t('Staff', 'الموظف'), staffFilter ? document.getElementById('staffLabel').textContent : t('All staff', 'كل الموظفين')]);
    }
    if (activeTab === 'sales' || activeTab === 'refunds' || activeTab === 'products') {
      rows.push([t('Payment', 'الدفع'), methodFilter ? methodLabel(methodFilter) : t('All methods', 'كل طرق الدفع')]);
    }
    if (activeTab === 'sales' && typeFilter) rows.push([t('Type', 'النوع'), typeLabel(typeFilter)]);
    if (activeTab === 'refunds' && buyerFilter)
      rows.push([t('Buyer', 'المشتري'), buyerFilter === 'walkin' ? t('Walk-in', 'زائر') : t('Members', 'الأعضاء')]);
    if (activeTab === 'memberships') {
      if (typeFilter) rows.push([t('Type', 'النوع'), typeFilter === 'renewal' ? t('Renewals', 'التجديدات') : t('New', 'جديدة')]);
      if (planFilter) rows.push([t('Plan', 'الخطة'), document.getElementById('planLabel').textContent]);
    }
    if (activeTab === 'products' && productFilter)
      rows.push([t('Product', 'المنتج'), document.getElementById('productLabel').textContent]);
    if (activeTab === 'staff' && shiftFilter)
      rows.push([t('Shift', 'الوردية'), document.getElementById('shiftLabel').textContent]);
    return rows;
  }

  // ---------- CSV v3: BOM, machine values, one table per file, named file ----------
  function gymName() {
    try {
      const id = JSON.parse(localStorage.getItem('gfp_gym_identity') || 'null');
      if (id && id.gymName) return String(id.gymName);
    } catch (_) { /* ignore */ }
    try {
      const u = JSON.parse(localStorage.getItem('gfp_user') || 'null');
      if (u && u.gymCode) return String(u.gymCode);
    } catch (_) { /* ignore */ }
    return '';
  }
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    // Formula-injection guard for text cells; plain numbers ("-100.00") stay numeric.
    if (s.length > 0 && (/^[=+@]/.test(s) || (s.charAt(0) === '-' && !/^-[0-9(]/.test(s)))) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function buildCsv(blocks) {
    return '\uFEFF' + blocks
      .filter((b) => b && b.length)
      .map((rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n'))
      .join('\r\n\r\n');
  }
  function kpiValueCell(k) {
    const kind = k[2] || (typeof k[1] === 'number' ? 'money' : 'text');
    const v = k[1];
    if (kind === 'count') return typeof v === 'number' ? String(Math.round(v)) : String(v);
    if (kind === 'money') return typeof v === 'number' ? v.toFixed(2) : String(v);
    return String(v);
  }
  function kpiExportBlock() {
    if (!lastKpiRows.length) return [];
    return [[t('Indicator', 'المؤشر'), t('Value (EGP)', 'القيمة (ج.م)')]]
      .concat(lastKpiRows.map((k) => [k[0], kpiValueCell(k)]));
  }
  function detailExportBlock() {
    if (lastRows.length < 2) return [];
    const head = lastRows[0];
    const dataRows = lastRows.slice(1).filter((r) => r && r.length);
    const out = [head].concat(dataRows);
    const moneyCols = [];
    head.forEach((h, i) => { if (isMoneyHeader(h)) moneyCols.push(i); });
    if (moneyCols.length) {
      const totals = head.map(() => '');
      totals[0] = t('Total', 'الإجمالي');
      moneyCols.forEach((i) => {
        let sum = 0;
        dataRows.forEach((r) => {
          const x = parseFloat(String(r[i]).replace(/,/g, ''));
          if (!Number.isNaN(x)) sum += x;
        });
        totals[i] = sum.toFixed(2);
      });
      out.push(totals);
    }
    return out;
  }
  function filtersSummaryText() {
    return exportMeta()
      .slice(3)
      .map((r) => r[0] + ': ' + r[1])
      .join(' · ');
  }
  function rangeLabelText() {
    const el = document.getElementById('rangeLabel');
    return el ? el.textContent : '';
  }
  function exportBaseName() {
    const gym = gymName().replace(/[^0-9A-Za-z\-_]+/g, '-').replace(/^-+|-+$/g, '');
    const { from, to } = dateRange();
    const slug = activeTab || 'reports-summary';
    return 'hymotion-' + slug + (gym ? '_' + gym : '') + '_' + from + '_' + to;
  }
  function doExport() {
    if (activeTab && !lastKpiRows.length && !lastRows.length && !hubSummary.length) {
      toast(t('Nothing to export', 'لا يوجد ما يمكن تصديره'), 'err');
      return;
    }
    const meta = exportMeta();
    const gym = gymName();
    const metaRows = [
      [(activeTab ? tabPageTitle(activeTab) : t('Reports summary', 'ملخص التقارير')) + ' — HyMotion' + (gym ? ' (' + gym + ')' : ''), ''],
      [t('Period', 'الفترة'), meta[1][1] + ' → ' + meta[2][1]],
      [t('Filters', 'الفلاتر'), filtersSummaryText() || t('None', 'بلا فلاتر إضافية')],
      [t('Exported at', 'تاريخ التصدير'), dtIso(new Date())],
    ];
    if (activeTab) {
      const count = lastDetailMeta && lastDetailMeta.truncated
        ? '500 (' + t('capped — totals cover the full period', 'بحد أقصى — الإجماليات تشمل كامل الفترة') + ')'
        : String(Math.max(0, lastRows.length - 1));
      metaRows.push([t('Detail rows', 'عدد سجلات التفصيل'), count]);
    }
    const blocks = [metaRows];
    if (activeTab) {
      const kpiBlock = kpiExportBlock();
      if (kpiBlock.length) blocks.push(kpiBlock);
      const detailBlock = detailExportBlock();
      if (detailBlock.length) blocks.push(detailBlock);
    } else if (hubSummary.length) {
      blocks.push(hubSummary);
    }
    const csv = buildCsv(blocks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const name = exportBaseName() + '.csv';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    toast('\u200E' + name + ' — ' + t('CSV exported', 'تم تصدير ملف CSV'));
  }
  function openExportPop() {
    closePops();
    const pop = document.getElementById('exportPop');
    if (!pop) { doExport(); return; }
    document.getElementById('exportPopTitle').textContent =
      t('Export', 'تصدير') + ' — ' + (activeTab ? tabPageTitle(activeTab) : t('Reports summary', 'ملخص التقارير'));
    const filters = filtersSummaryText();
    const lines = [
      t('Period', 'الفترة') + ': ' + rangeLabelText(),
      t('Filters', 'الفلاتر') + ': ' + (filters || t('None', 'بلا فلاتر إضافية')),
    ];
    if (activeTab) {
      const n = Math.max(0, lastRows.length - 1);
      lines.push(t('Will export', 'سيُصدَّر') + ': '
        + (lastKpiRows.length ? t('KPIs', 'المؤشرات') + (n ? ' + ' : '') : '')
        + (n ? n + ' ' + t('detail rows', 'سجل تفصيل') : ''));
    }
    document.getElementById('exportScope').innerHTML = lines
      .map((l) => esc(l))
      .join('<br>');
    document.getElementById('exportCap').textContent = lastDetailMeta && lastDetailMeta.truncated
      ? t('Details are capped at the latest 500 rows — totals always cover the whole period. Narrow the dates to export everything.', 'التفاصيل محدودة بأحدث 500 سجل — الإجماليات تشمل كامل الفترة دائمًا. ضيّق الفترة لتصدير كل السجلات.')
      : t('Up to 500 detail rows per export — totals always cover the whole period.', 'حتى 500 سجل تفصيلي في كل تصدير — الإجماليات تشمل كامل الفترة دائمًا.');
    pop.hidden = false;
    document.getElementById('btnExport').setAttribute('aria-expanded', 'true');
  }

  document.getElementById('btnExport').onclick = function (ev) {
    ev.stopPropagation();
    const pop = document.getElementById('exportPop');
    const willOpen = pop && pop.hidden;
    if (willOpen) openExportPop();
    else closePops();
  };
  const exportConfirmBtn = document.getElementById('btnExportConfirm');
  if (exportConfirmBtn) {
    exportConfirmBtn.onclick = function () {
      closePops();
      doExport();
    };
  }

  window.addEventListener('gfp:locale', function () {
    setRangeLabel();
    if (activeTab) loadDetail();
    else loadHub();
  });

  setRangeLabel();
  if (activeTab) loadDetail();
  else loadHub();
})(typeof window !== 'undefined' ? window : globalThis);
