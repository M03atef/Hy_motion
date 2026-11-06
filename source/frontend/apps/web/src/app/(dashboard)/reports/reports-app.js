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
  function fmtShort(s) {
    const d = parseYmd(s);
    if (!d) return s || '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
    const whole = abs % 1 === 0;
    const body = abs.toLocaleString('en-EG', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
    return (neg ? '- ' : '') + 'EGP ' + body;
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
    return Number.isNaN(d.getTime())
      ? esc(iso)
      : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

  function populateExpenseTypeOptions(categorySelect, typeSelect) {
    const catalog = expenseCatalog();
    if (!catalog || !categorySelect || !typeSelect) return;
    const types = catalog.typesFor(categorySelect.value);
    typeSelect.innerHTML = types
      .map((item) => '<option value="' + esc(item) + '">' + esc(item) + '</option>')
      .join('');
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
      categorySelect.innerHTML = catalog.categories
        .map((item) => '<option value="' + esc(item) + '">' + esc(item) + '</option>')
        .join('');
      populateExpenseTypeOptions(categorySelect, typeSelect);
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
    document.getElementById('rangeLabel').textContent = text;
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
    ['rangePop', 'staffPop', 'methodPop', 'planPop', 'productPop', 'shiftFilterPop', 'morePop'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    ['btnRange', 'btnStaff', 'btnMethod', 'btnPlan', 'btnProduct', 'btnShift', 'btnMore'].forEach((id) => {
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
    return /amount|sales|refunds|revenue|total|cash|net|gross|difference/i.test(String(h || ''));
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
    const meta = EMPTY[activeTab] || EMPTY.sales;
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
    document.getElementById('tabHint').hidden = useFilters;
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
    document.querySelectorAll('#hubTabs .hub-tab').forEach((btn) => {
      const key = btn.getAttribute('data-tab');
      btn.hidden = !canSee(key);
      btn.classList.toggle('active', key === activeTab);
    });
    if (!useFilters) document.getElementById('tabHint').textContent = tabHint(activeTab) || '';
    paintMorePop();
    syncUrl();
    setCrumb();
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
    document.getElementById('staffLabel').textContent = staffFilter ? cur && cur.name ? cur.name : staffFallback : staffFallback;
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
      : planFallback;
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
      : productFallback;
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
      : shiftFallback;
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
      : t('Payment', 'الدفع');
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

    const kpis = [
      [t('Collections', 'المقبوضات'), financialAmount(data.collections, true)],
      [t('Settled cash inflow', 'الوارد النقدي المسوّى'), financialAmount(data.settledCashInflow, data.settledCashAvailable)],
      [t('Revenue', 'الإيرادات'), financialAmount(data.revenue, true)],
      [t('Revenue adjustments', 'تسويات الإيرادات'), financialAmount(data.revenueAdjustments, true)],
      [t('Refunds', 'المرتجعات'), financialAmount(data.refunds, true)],
      [t('COGS', 'تكلفة البضاعة المباعة'), financialAmount(data.cogs, data.cogsAvailable)],
      [t('Operating expenses', 'المصروفات التشغيلية'), financialAmount(data.operatingExpenses, true)],
      [t('Payroll expense', 'مصروف الرواتب'), financialAmount(data.payrollExpense, data.payrollAvailable)],
      [t('Gross profit', 'إجمالي الربح'), financialAmount(data.grossProfit, data.cogsAvailable)],
      [t('Net profit', 'صافي الربح'), financialAmount(data.netProfit, data.netProfitAvailable)],
      [t('Profit margin', 'هامش الربح'), data.netProfitAvailable && data.profitMargin != null
        ? Number(data.profitMargin).toFixed(2) + '%'
        : t('Unavailable', 'غير متاح')],
      [t('Net cash flow', 'صافي التدفق النقدي'), financialAmount(data.netCashFlow, data.cashFlowAvailable)],
      [t('Receivables / Payables', 'المستحقات / المطلوبات'),
        financialAmount(data.accountsReceivable, true) + ' / ' + financialAmount(data.accountsPayable, true)],
    ];
    document.getElementById('profitabilityKpis').innerHTML = kpis
      .map(([label, amount]) => '<div class="kpi"><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong></div>')
      .join('');
    const issues = Array.isArray(data.dataIssues) ? data.dataIssues : [];
    document.getElementById('profitabilityIssues').innerHTML = issues.length
      ? '<div class="rpt-empty-inline"><strong>' + esc(t('Review required', 'مطلوب مراجعة')) + '</strong><p>' +
        esc(issues.join(', ')) + '</p></div>'
      : '<p class="muted">' + esc(t('All configured financial sources are available for this period.', 'كل المصادر المالية المُعدّة متاحة لهذه الفترة.')) + '</p>';
    lastKpiRows = kpis;
    lastRows = [];
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('rptToolbar').innerHTML = '';
    document.getElementById('tableWrap').hidden = true;
    document.getElementById('tablePager').hidden = true;
    document.getElementById('shiftWrap').hidden = true;
    document.getElementById('txWrap').hidden = true;
    document.getElementById('truncNote').hidden = true;
  }

  async function loadCashflow() {
    const { from, to } = dateRange();
    const data = await apiGet('/reports/cash-flow?from=' + from + '&to=' + to);
    if (!data) return;
    const cashFlowAvailable = data.cashFlowAvailable === true;
    const settledCashAvailable = data.settledCashAvailable === true;
    const kpis = [
      [t('Collections', 'المقبوضات'), financialAmount(data.collections, true)],
      [t('Settled cash inflow', 'الوارد النقدي المسوّى'), financialAmount(data.settledCashInflow, settledCashAvailable)],
      [t('Cash refunds', 'المرتجعات النقدية'), financialAmount(data.cashRefunds, cashFlowAvailable)],
      [t('Operating expenses', 'المصروفات التشغيلية'), financialAmount(data.operatingExpenseCashOutflows, cashFlowAvailable)],
      [t('Payroll paid', 'الرواتب المدفوعة'), financialAmount(data.payrollCashDisbursements, cashFlowAvailable)],
      [t('Supplier payments', 'مدفوعات الموردين'), financialAmount(data.supplierCashPayments, cashFlowAvailable)],
      [t('Cash outflows', 'المصروفات النقدية'), financialAmount(data.cashOutflows, cashFlowAvailable)],
      [t('Net cash flow', 'صافي التدفق النقدي'), financialAmount(data.netCashFlow, cashFlowAvailable)],
    ];
    document.getElementById('cashflowKpis').innerHTML = kpis
      .map(([label, amount]) => '<div class="kpi"><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong></div>')
      .join('');
    const issues = Array.isArray(data.dataIssues) ? data.dataIssues : [];
    document.getElementById('cashflowIssues').innerHTML = issues.length || !cashFlowAvailable
      ? '<div class="rpt-empty-inline"><strong>' +
        esc(cashFlowAvailable ? t('Review required', 'مطلوب مراجعة') : t('Cash flow unavailable', 'التدفق النقدي غير متاح')) +
        '</strong><p>' +
        esc(cashFlowAvailable
          ? issues.join(', ')
          : t('Settlement or supplier cash evidence is incomplete for this period.', 'أدلة التسوية أو نقدية الموردين غير مكتملة لهذه الفترة.')) +
        '</p></div>'
      : '<p class="muted">' + esc(t('Cash sources are available for this period.', 'المصادر النقدية متاحة لهذه الفترة.')) + '</p>';
    lastKpiRows = kpis;
    lastRows = [];
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
    const posted = rows.filter((row) => String(row.status || '').toLowerCase() === 'posted');
    const total = posted.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const kpis = [
      [t('Posted running costs', 'التكاليف التشغيلية المرحّلة'), money(total)],
      [t('Entries', 'القيود'), String(posted.length)],
      [t('Voided entries', 'القيود الملغاة'), String(rows.length - posted.length)],
    ];
    document.getElementById('expensesKpis').innerHTML = kpis
      .map(([label, amount]) => '<div class="kpi"><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong></div>')
      .join('');
    const expenseMethodMap = {
      cash: t('Cash', 'نقدًا'),
      card: t('Card', 'بطاقة'),
      bank_transfer: t('Bank transfer', 'تحويل بنكي'),
      wallet: t('Wallet', 'محفظة'),
      other: t('Other', 'أخرى'),
    };
    const expenseStatusMap = {
      posted: t('Posted', 'مرحّل'),
      void: t('Void', 'ملغى'),
    };
    const body = document.getElementById('expensesBody');
    body.innerHTML = rows.length
      ? rows.map((row) => {
          const status = String(row.status || '').toLowerCase();
          return '<tr>' +
            '<td>' + esc(row.expenseDate || '—') + '</td>' +
            '<td>' + esc(row.category || '—') + '</td>' +
            '<td>' + esc(row.description || row.payee || row.note || '—') + '</td>' +
            '<td>' + esc(expenseMethodMap[row.paymentMethod] || row.paymentMethod || '—') + '</td>' +
            '<td class="amt">' + esc(money(row.amount)) + '</td>' +
            '<td><span class="status ' + (status === 'posted' ? 'success' : 'muted') + '">' + esc(expenseStatusMap[status] || t('Unknown', 'غير معروف')) + '</span></td>' +
            '<td>' + (status === 'posted' && canManageExpenses
              ? '<button class="btn secondary btn-void-expense" data-expense-id="' + esc(row.id) + '">' + esc(t('Void', 'إلغاء')) + '</button>'
              : '—') + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="7" class="muted">' + esc(t('No expenses recorded for this period.', 'لا توجد مصروفات مسجّلة لهذه الفترة.')) + '</td></tr>';
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
    document.getElementById('expensesForm').hidden = !canManageExpenses;
    wireExpenseForm();
    if (!document.getElementById('expensesForm').expenseDate.value)
      document.getElementById('expensesForm').expenseDate.value = to;
    lastKpiRows = kpis;
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
      [netSalesLabel, money(data.netCashIn)],
      [transactionsLabel, String(data.transactionCount || 0)],
      [membershipSalesLabel, money(data.membershipCashIn)],
      [productSalesLabel, money(data.productCashIn)],
      [t('Gross sales', 'إجمالي المبيعات'), money(data.cashInTotal)],
      [t('Refunds', 'المرتجعات'), money(data.cashRefundsTotal)],
    ];
    document.getElementById('salesKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(netSalesLabel) + '</div><div class="v">' +
      money(data.netCashIn) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(transactionsLabel) + '</div><div class="v">' +
      String(data.transactionCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(membershipSalesLabel) + '</div><div class="v">' +
      money(data.membershipCashIn) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(productSalesLabel) + '</div><div class="v">' +
      money(data.productCashIn) +
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
          money(m.cashIn) +
          '</span></div>',
      )
      .join('');
    document.getElementById('salesBreak').innerHTML =
      '<div class="break-row"><span>' + esc(t('Gross sales', 'إجمالي المبيعات')) + '</span><span>' +
      money(data.cashInTotal) +
      '</span></div>' +
      '<div class="break-row break-neg"><span>' + esc(t('Refunds', 'المرتجعات')) + '</span><span>' +
      money(-(Number(data.cashRefundsTotal) || 0)) +
      '</span></div>' +
      '<div class="break-row"><span>' + esc(t('Discounts', 'الخصومات')) + '</span><span>' +
      money(data.discountTotal) +
      '</span></div>' +
      '<div class="break-row"><span>' + esc(netSalesLabel) + '</span><span>' +
      money(data.netCashIn) +
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
            dt(p.paidAtUtc),
            (Number(p.amount) || 0).toFixed(2),
          ]),
        )
      : [];
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
        dt(p.paidAtUtc) +
        '</td><td class="amt">' +
        money(p.amount) +
        '</td></tr>'
      );
    });
    renderTable(
      headers,
      rows,
      !(data.payments || []).length,
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
      [totalRefundsLabel, String(data.count || 0)],
      [refundAmountLabel, money(data.total)],
      [refundedTxLabel, String(data.saleCount || 0)],
      [avgRefundLabel, money(data.average)],
    ];
    document.getElementById('refundsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(totalRefundsLabel) + '</div><div class="v">' +
      String(data.count || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundAmountLabel) + '</div><div class="v">' +
      money(data.total) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundedTxLabel) + '</div><div class="v">' +
      String(data.saleCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(avgRefundLabel) + '</div><div class="v">' +
      money(data.average) +
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
            dt(r.executedAtUtc),
            (Number(r.amount) || 0).toFixed(2),
          ]),
        )
      : [];
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
        dt(r.executedAtUtc) +
        '</td><td class="amt">' +
        money(r.amount) +
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
      [newMembershipsLabel, String(data.newCount || 0)],
      [renewalsLabel, String(data.renewalCount || 0)],
      [membershipRevenueLabel, rev],
      [refundedMembershipsLabel, String(data.refundedCount || 0)],
    ];
    document.getElementById('membershipsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(newMembershipsLabel) + '</div><div class="v">' +
      String(data.newCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(renewalsLabel) + '</div><div class="v">' +
      String(data.renewalCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(membershipRevenueLabel) + '</div><div class="v">' +
      rev +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(refundedMembershipsLabel) + '</div><div class="v">' +
      String(data.refundedCount || 0) +
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
        const extra = canFinance ? ' · ' + money(p.revenue) : '';
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
          money(r.amount) +
          '</td>'
        : '';
      return (
        '<tr' +
        (href ? ' data-href="' + href + '"' : '') +
        '><td>' +
        esc(r.startDate) +
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
      [productRevenueLabel, money(data.revenue)],
      [unitsSoldLabel, String(data.unitsSold || 0)],
      [productsTxLabel, String(data.transactionCount || 0)],
      [topProductLabel, data.topProductName || '—'],
    ];
    document.getElementById('productsKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(productRevenueLabel) + '</div><div class="v">' +
      money(data.revenue) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(unitsSoldLabel) + '</div><div class="v">' +
      String(data.unitsSold || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(productsTxLabel) + '</div><div class="v">' +
      String(data.transactionCount || 0) +
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
          money(r.revenue) +
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
            dt(r.soldAtUtc),
            r.invoiceNumber || '',
            r.productName,
            r.quantity,
            r.staffName,
            methodLabel(r.payment),
            (Number(r.revenue) || 0).toFixed(2),
          ]),
        )
      : [];
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
        dt(r.soldAtUtc) +
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
        money(r.revenue) +
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
      [totalSalesLabel, money(data.sales)],
      [staffTxLabel, String(data.transactionCount || 0)],
      [staffRefundsLabel, money(data.refunds)],
      [shiftsLabel, String(data.shiftCount || 0)],
    ];
    document.getElementById('staffKpis').innerHTML =
      '<div class="sales-kpi"><div class="l">' + esc(totalSalesLabel) + '</div><div class="v">' +
      money(data.sales) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(staffTxLabel) + '</div><div class="v">' +
      String(data.transactionCount || 0) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(staffRefundsLabel) + '</div><div class="v">' +
      money(data.refunds) +
      '</div></div>' +
      '<div class="sales-kpi"><div class="l">' + esc(shiftsLabel) + '</div><div class="v">' +
      String(data.shiftCount || 0) +
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
    lastRows = [headers].concat(
      staff.map((r) => [
        r.staffName,
        (Number(r.cashIn) || 0).toFixed(2),
        r.paymentCount,
        (Number(r.refunds) || 0).toFixed(2),
        r.shiftCount,
      ]),
    );
    if (shifts.length) {
      lastRows.push([]);
      lastRows.push([t('Shift', 'الوردية'), t('Staff', 'الموظف'), t('Opened', 'الافتتاح'), t('Closed', 'الإغلاق'), t('Sales', 'المبيعات'), staffRefundsLabel, t('Status', 'الحالة')]);
      shifts.forEach((s) => {
        lastRows.push([
          shiftName(s),
          s.staffName,
          dt(s.openedAt),
          s.closedAt ? dt(s.closedAt) : openLabel,
          (Number(s.sales) || 0).toFixed(2),
          (Number(s.refunds) || 0).toFixed(2),
          s.status,
        ]);
      });
    }
    const staffRows = staff.map((r) => {
      const id = r.userId || '';
      return (
        '<tr data-staff="' +
        esc(id) +
        '"><td>' +
        esc(r.staffName) +
        '</td><td class="amt">' +
        money(r.cashIn) +
        '</td><td>' +
        esc(r.paymentCount) +
        '</td><td class="amt">' +
        money(r.refunds) +
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
          const st = s.status === 'open' ? openLabel : s.status === 'approved' ? t('Approved', 'معتمدة') : t('Closed', 'مغلقة');
          return (
            '<tr data-shift="' +
            esc(s.shiftId) +
            '"><td>' +
            esc(shiftName(s)) +
            '</td><td>' +
            esc(s.staffName) +
            '</td><td>' +
            dt(s.openedAt) +
            '</td><td>' +
            (s.closedAt ? dt(s.closedAt) : openLabel) +
            '</td><td class="amt">' +
            money(s.sales) +
            '</td><td class="amt">' +
            money(s.refunds) +
            '</td><td><span class="st">' +
            esc(st) +
            '</span></td></tr>'
          );
        })
        .join('');
      stampColLabels('#shiftWrap table');
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
            dt(tx.atUtc) +
            '</td><td>' +
            esc(kind) +
            '</td><td>' +
            (href ? '<a href="' + href + '">' + esc(invLabel) + '</a>' : esc(invLabel)) +
            '</td><td>' +
            esc(tx.staffName) +
            '</td><td><span class="st">' +
            esc(methodLabel(tx.method)) +
            '</span></td><td class="amt">' +
            money(tx.amount) +
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
      return {
        la: t('Net profit', 'صافي الربح'),
        a: netProfitAvailable && data.netProfit != null ? esc(money(data.netProfit)) : unavailable,
        lb: t('Net cash flow', 'صافي التدفق النقدي'),
        b: cashFlowAvailable && data.netCashFlow != null ? esc(money(data.netCashFlow)) : unavailable,
        activity: data.netCashFlow !== 0 || data.revenue !== 0,
        export: [t('Profitability', 'الربحية'),
          netProfitAvailable && data.netProfit != null ? money(data.netProfit) : unavailable,
          cashFlowAvailable && data.netCashFlow != null ? money(data.netCashFlow) : unavailable],
      };
    }
    if (key === 'cashflow') {
      const cashFlowAvailable = data.cashFlowAvailable === true;
      return {
        la: t('Net cash flow', 'صافي التدفق النقدي'),
        a: cashFlowAvailable && data.netCashFlow != null ? esc(money(data.netCashFlow)) : unavailable,
        lb: t('Cash outflows', 'المصروفات النقدية'),
        b: cashFlowAvailable && data.cashOutflows != null ? esc(money(data.cashOutflows)) : unavailable,
        activity: cashFlowAvailable
          && (Number(data.netCashFlow) !== 0 || Number(data.cashOutflows) !== 0),
        export: [t('Cash Flow', 'التدفق النقدي'),
          cashFlowAvailable && data.netCashFlow != null ? money(data.netCashFlow) : unavailable,
          cashFlowAvailable && data.cashOutflows != null ? money(data.cashOutflows) : unavailable],
      };
    }
    if (key === 'expenses') {
      const rows = Array.isArray(data) ? data : [];
      const posted = rows.filter((row) => String(row.status || '').toLowerCase() === 'posted');
      const total = posted.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return {
        la: t('Posted expenses', 'المصروفات المرحّلة'),
        a: esc(money(total)),
        lb: t('Entries', 'القيود'),
        b: String(posted.length),
        activity: posted.length > 0 || total !== 0,
        export: [t('Expenses', 'المصروفات'), money(total), String(posted.length)],
      };
    }
    if (key === 'sales') {
      const n = data.transactionCount != null ? data.transactionCount : paymentCount(data);
      return {
        la: t('Net sales', 'صافي المبيعات'),
        a: esc(money(data.netCashIn)),
        lb: t('Transactions', 'المعاملات'),
        b: String(n),
        activity: n > 0 || Number(data.netCashIn) !== 0 || Number(data.bookedTotal) !== 0,
        export: [t('Sales', 'المبيعات'), money(data.netCashIn), String(n)],
      };
    }
    if (key === 'refunds') {
      const n = data.count != null ? data.count : (data.items || []).length;
      return {
        la: t('Refund amount', 'قيمة المرتجعات'),
        a: esc(money(data.total)),
        lb: t('Refunds', 'المرتجعات'),
        b: data.truncated ? String(n) + '+' : String(n),
        activity: n > 0 || Number(data.total) !== 0,
        export: [t('Refunds', 'المرتجعات'), money(data.total), String(n)],
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
        a: esc(money(rev)),
        lb: t('Units sold', 'الوحدات المباعة'),
        b: String(qty),
        activity: qty > 0 || rev !== 0,
        export: [t('Products', 'المنتجات'), money(rev), String(qty)],
      };
    }
    const take = data.sales != null ? Number(data.sales) : (data.staffCashIn || []).reduce((s, r) => s + Number(r.cashIn || 0), 0);
    const shifts = data.shiftCount != null ? data.shiftCount : (data.shifts || []).length;
    return {
      la: t('Total sales', 'إجمالي المبيعات'),
      a: esc(money(take)),
      lb: t('Shifts', 'الورديات'),
      b: String(shifts),
      activity: take !== 0 || Number(data.refunds) > 0 || shifts > 0 || (data.staffCashIn || []).length > 0,
      export: [t('Staff & Shifts', 'الموظفون والورديات'), money(take), String(shifts)],
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
    setTabChrome();
    showTableSkeleton(activeTab === 'staff' ? 5 : 7);
    if (activeTab === 'sales') fillKpiSkeleton('salesKpis');
    else if (activeTab === 'refunds') fillKpiSkeleton('refundsKpis');
    else if (activeTab === 'memberships') fillKpiSkeleton('membershipsKpis');
    else if (activeTab === 'products') fillKpiSkeleton('productsKpis');
    else if (activeTab === 'profitability' || activeTab === 'cashflow') {
      document.getElementById(activeTab === 'cashflow' ? 'cashflowKpis' : 'profitabilityKpis').innerHTML = '<div class="kpi">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</div>';
    }
    else if (activeTab === 'expenses') document.getElementById('expensesKpis').innerHTML = '<div class="kpi">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</div>';
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
    rows.push([t('Staff', 'الموظف'), staffFilter ? document.getElementById('staffLabel').textContent : t('All staff', 'كل الموظفين')]);
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

  document.getElementById('btnExport').onclick = function () {
    let rows;
    if (activeTab) {
      rows = exportMeta()
        .concat([[]])
        .concat(lastKpiRows.length ? lastKpiRows.concat([[]]) : [])
        .concat(lastRows);
    } else {
      const { from, to } = dateRange();
      rows = [[t('Report', 'التقرير'), t('Reports summary', 'ملخص التقارير')], [t('From', 'من'), from], [t('To', 'إلى'), to], []].concat(hubSummary);
    }
    if (!rows.length || (activeTab && !lastKpiRows.length && !lastRows.length && !hubSummary.length)) {
      toast(t('Nothing to export', 'لا يوجد ما يمكن تصديره'), 'err');
      return;
    }
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = activeTab ? 'report-' + activeTab + '.csv' : 'reports-summary.csv';
    a.click();
    toast(t('CSV exported', 'تم تصدير ملف CSV'));
  };

  window.addEventListener('gfp:locale', function () {
    setRangeLabel();
    if (activeTab) loadDetail();
    else loadHub();
  });

  setRangeLabel();
  if (activeTab) loadDetail();
  else loadHub();
})(typeof window !== 'undefined' ? window : globalThis);
