/**
 * Inventory reports — summary, top sellers, dead stock, movements (FE-INVS-10 + owner analytics).
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Inv = window.GfpInventoryApi;
  var I18n = window.GfpI18n;
  var paths = (Inv && Inv.paths) || {};

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
  if (!Authz || !Authz.useCan('inventory.view')) {
    window.location.href = '/dashboard/';
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
  function qtyFmt(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || 'Request failed';
    if (!r) return 'Request failed';
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || 'Request failed (' + r.status + ')';
  }
  function productCell(row) {
    var name = row.nameAr && document.documentElement.dir === 'rtl' ? row.nameAr : row.name || row.nameAr || '—';
    var thumb = row.imageUrl
      ? '<img src="' + esc(row.imageUrl) + '" alt="">'
      : '<i class="ti ti-package"></i>';
    return (
      '<div class="prod-cell"><div class="prod-thumb">' +
      thumb +
      '</div><div><div class="prod-name">' +
      esc(name) +
      '</div><div class="prod-sku">' +
      esc(row.sku || '') +
      '</div></div></div>'
    );
  }
  function dt(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, { timeZone: 'Africa/Cairo' });
    } catch (e) {
      return new Date(iso).toLocaleString();
    }
  }

  /* —— Cairo calendar helpers —— */
  function cairoTodayYmd() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function addDaysYmd(ymd, delta) {
    var p = ymd.split('-').map(Number);
    var u = Date.UTC(p[0], p[1] - 1, p[2] + delta);
    var d = new Date(u);
    return d.toISOString().slice(0, 10);
  }
  function formatInCairo(ms) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(ms))
      .forEach(function (x) {
        if (x.type !== 'literal') parts[x.type] = x.value;
      });
    return parts;
  }
  /** UTC Date at Cairo local midnight for ymd (YYYY-MM-DD). */
  function cairoStartUtc(ymd) {
    var bits = ymd.split('-').map(Number);
    var y = bits[0];
    var m = bits[1];
    var d = bits[2];
    var guess = Date.UTC(y, m - 1, d, 0, 0, 0) - 3 * 3600 * 1000;
    for (var i = 0; i < 6; i++) {
      var p = formatInCairo(guess);
      var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      var desired = Date.UTC(y, m - 1, d, 0, 0, 0);
      guess += desired - asUtc;
    }
    return new Date(guess);
  }
  function cairoEndUtc(ymd) {
    var next = addDaysYmd(ymd, 1);
    return new Date(cairoStartUtc(next).getTime() - 1);
  }
  function setRangeInputs(fromId, toId, days) {
    var to = cairoTodayYmd();
    var from = addDaysYmd(to, -(days - 1));
    document.getElementById(fromId).value = from;
    document.getElementById(toId).value = to;
  }
  /** @param {'inclusive'|'exclusive'} endMode movements API is inclusive; product-performance is &lt; toUtc */
  function rangeParams(fromId, toId, endMode) {
    var from = document.getElementById(fromId).value;
    var to = document.getElementById(toId).value;
    if (!from || !to) return { error: t('From and To dates are required.', 'تاريخ البداية والنهاية مطلوبان.') };
    var fromD = cairoStartUtc(from);
    var toInclusive = cairoEndUtc(to);
    if (toInclusive < fromD) return { error: t('To must be on or after From.', 'تاريخ النهاية يجب أن يكون بعد البداية.') };
    var days = (toInclusive - fromD) / 86400000;
    if (days > 366) return { error: t('Date range cannot exceed 366 days.', 'لا يمكن أن يتجاوز النطاق ٣٦٦ يوماً.') };
    var toUtc =
      endMode === 'exclusive'
        ? cairoStartUtc(addDaysYmd(to, 1)).toISOString()
        : toInclusive.toISOString();
    return { fromUtc: fromD.toISOString(), toUtc: toUtc };
  }

  (function chrome() {
    var ini = String(user.fullName || 'U')
      .split(/\s+/)
      .map(function (w) {
        return w[0];
      })
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

  function switchTab(name) {
    document.querySelectorAll('.rtab').forEach(function (b) {
      b.classList.toggle('act', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.rtab-panel').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
    if (name === 'performance' && !document.getElementById('perfHost').dataset.loaded) loadPerformance();
    if (name === 'dead' && !document.getElementById('deadHost').dataset.loaded) loadDeadStock();
    if (name === 'movements' && !document.getElementById('movHost').dataset.loaded) loadMovements();
  }

  document.querySelectorAll('.rtab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  function wirePresets(groupId, fromId, toId, onApply) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[data-days]');
      if (!b) return;
      group.querySelectorAll('.chip').forEach(function (c) {
        c.classList.toggle('act', c === b);
      });
      setRangeInputs(fromId, toId, Number(b.getAttribute('data-days')));
      if (onApply) onApply();
    });
  }

  setRangeInputs('fromDate', 'toDate', 30);
  setRangeInputs('perfFrom', 'perfTo', 7);
  wirePresets('movPresets', 'fromDate', 'toDate', null);
  wirePresets('perfPresets', 'perfFrom', 'perfTo', null);

  async function loadWarehouses() {
    var r = await Gfp.get(paths.warehouses());
    var sel = document.getElementById('fWarehouse');
    if (!r.ok || !Array.isArray(r.data)) {
      sel.innerHTML = '<option value="">' + esc(t('All', 'الكل')) + '</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">' +
      esc(t('All', 'الكل')) +
      '</option>' +
      r.data
        .map(function (w) {
          return '<option value="' + esc(w.id) + '">' + esc(w.code + ' — ' + w.name) + '</option>';
        })
        .join('');
  }

  async function loadSummary() {
    var host = document.getElementById('summaryCards');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var r = await Gfp.get(paths.reportSummary());
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var s = r.data || {};
    var exp = Array.isArray(s.expiringSoon) ? s.expiringSoon : [];
    var expHtml = exp.length
      ? exp
          .map(function (w) {
            return (
              '<div class="stat-card"><div class="label">' +
              esc(t('Expiring ≤', 'تنتهي ≤') + ' ' + w.days + 'd') +
              '</div><div class="value">' +
              esc(w.batchCount) +
              '</div></div>'
            );
          })
          .join('')
      : '<div class="stat-card"><div class="label">' +
        esc(t('Expiring soon', 'قريبة الانتهاء')) +
        '</div><div class="value">0</div><div class="sub">' +
        esc(t('None due', 'لا يوجد')) +
        '</div></div>';

    var valCard = s.includesValuation
      ? '<div class="stat-card"><div class="label">' +
        esc(t('Inventory value', 'قيمة المخزون')) +
        '</div><div class="value sm">' +
        esc(money(s.inventoryValueEgp)) +
        '</div></div>'
      : '<div class="stat-card"><div class="label">' +
        esc(t('Inventory value', 'قيمة المخزون')) +
        '</div><div class="value xs">' +
        esc(t('Financial permission required', 'صلاحية مالية مطلوبة')) +
        '</div><div class="sub">reports.financial.view</div></div>';

    var retail =
      '<div class="stat-card"><div class="label">' +
      esc(t('Retail today (Cairo)', 'تجزئة اليوم (القاهرة)')) +
      '</div><div class="value">' +
      esc(s.todayRetailUnits != null ? s.todayRetailUnits : 0) +
      '</div><div class="sub">' +
      (s.todayRetailSalesEgp != null
        ? esc(money(s.todayRetailSalesEgp))
        : esc(t('Units', 'وحدة'))) +
      '</div></div>';

    host.innerHTML =
      '<div class="stat-card"><div class="label">' +
      esc(t('Out of stock', 'نفد')) +
      '</div><div class="value">' +
      esc(s.outOfStockCount != null ? s.outOfStockCount : 0) +
      '</div></div>' +
      '<div class="stat-card"><div class="label">' +
      esc(t('Low stock', 'منخفض')) +
      '</div><div class="value">' +
      esc(s.lowStockCount != null ? s.lowStockCount : 0) +
      '</div></div>' +
      retail +
      '<div class="stat-card"><div class="label">' +
      esc(t('Pending POs', 'أوامر شراء معلّقة')) +
      '</div><div class="value">' +
      esc(s.pendingPoCount != null ? s.pendingPoCount : 0) +
      '</div></div>' +
      '<div class="stat-card"><div class="label">' +
      esc(t('In-transit transfers', 'تحويلات في الطريق')) +
      '</div><div class="value">' +
      esc(s.inTransitTransferCount != null ? s.inTransitTransferCount : 0) +
      '</div></div>' +
      valCard +
      expHtml;
  }

  async function loadPerformance() {
    var hint = document.getElementById('perfHint');
    var host = document.getElementById('perfHost');
    hint.textContent = '';
    var rng = rangeParams('perfFrom', 'perfTo', 'exclusive');
    if (rng.error) {
      hint.textContent = rng.error;
      return;
    }
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var r = await Gfp.get(
      paths.reportProductPerformance({
        fromUtc: rng.fromUtc,
        toUtc: rng.toUtc,
        take: 50
      })
    );
    host.dataset.loaded = '1';
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var rows = Array.isArray(r.data) ? r.data : [];
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No retail sales in range', 'لا مبيعات تجزئة في الفترة')) + '</p></div>';
      return;
    }
    var showMargin = rows.some(function (x) {
      return x.estMarginEgp != null;
    });
    host.innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('Product', 'الصنف')) +
      '</th><th>' +
      esc(t('Qty sold', 'الكمية')) +
      '</th><th>' +
      esc(t('Revenue', 'الإيراد')) +
      '</th>' +
      (showMargin ? '<th>' + esc(t('Est. margin', 'هامش تقديري')) + '</th>' : '') +
      '<th>' +
      esc(t('Last sale', 'آخر بيع')) +
      '</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            '<tr><td>' +
            productCell(row) +
            '</td><td>' +
            esc(qtyFmt(row.qtySold)) +
            '</td><td>' +
            esc(money(row.revenueEgp)) +
            '</td>' +
            (showMargin ? '<td>' + esc(money(row.estMarginEgp)) + '</td>' : '') +
            '<td class="muted">' +
            esc(dt(row.lastSoldAtUtc)) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  async function loadDeadStock() {
    var hint = document.getElementById('deadHint');
    var host = document.getElementById('deadHost');
    hint.textContent = '';
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var days = Number(document.getElementById('deadDays').value) || 30;
    var r = await Gfp.get(paths.reportDeadStock({ daysIdle: days }));
    host.dataset.loaded = '1';
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var rows = Array.isArray(r.data) ? r.data : [];
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' +
        esc(t('No idle stock for this window', 'لا رصيد راكد لهذه الفترة')) +
        '</p></div>';
      return;
    }
    var showCost = rows.some(function (x) {
      return x.costPrice != null;
    });
    host.innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('Product', 'الصنف')) +
      '</th><th>' +
      esc(t('On hand', 'الرصيد')) +
      '</th><th>' +
      esc(t('Days idle', 'أيام راكدة')) +
      '</th><th>' +
      esc(t('Last sale', 'آخر بيع')) +
      '</th>' +
      (showCost ? '<th>' + esc(t('Cost', 'التكلفة')) + '</th>' : '') +
      '</tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            '<tr><td>' +
            productCell(row) +
            '</td><td>' +
            esc(qtyFmt(row.onHand)) +
            '</td><td><span class="idle-badge">' +
            esc(row.daysIdle) +
            '</span></td><td class="muted">' +
            esc(row.lastSoldAtUtc ? dt(row.lastSoldAtUtc) : t('Never', 'أبداً')) +
            '</td>' +
            (showCost ? '<td>' + esc(money(row.costPrice)) + '</td>' : '') +
            '</tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  async function loadMovements() {
    var hint = document.getElementById('movHint');
    var host = document.getElementById('movHost');
    hint.textContent = '';
    var rng = rangeParams('fromDate', 'toDate', 'inclusive');
    if (rng.error) {
      hint.textContent = rng.error;
      return;
    }
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' + esc(t('Loading…', 'جاري التحميل…')) + '</p></div>';
    var params = {
      fromUtc: rng.fromUtc,
      toUtc: rng.toUtc,
      take: 200
    };
    var wh = document.getElementById('fWarehouse').value;
    var reason = document.getElementById('fReason').value;
    if (wh) params.warehouseId = wh;
    if (reason) params.reason = reason;

    var r = await Gfp.get(paths.reportMovements(params));
    host.dataset.loaded = '1';
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    var rows = Array.isArray(r.data) ? r.data : [];
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No movements in range', 'لا حركات في الفترة')) + '</p></div>';
      return;
    }
    host.innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('When (Cairo)', 'الوقت (القاهرة)')) +
      '</th><th>' +
      esc(t('SKU', 'SKU')) +
      '</th><th>' +
      esc(t('Warehouse', 'المستودع')) +
      '</th><th>' +
      esc(t('Reason', 'السبب')) +
      '</th><th>' +
      esc(t('Qty Δ', 'الكمية')) +
      '</th><th>' +
      esc(t('Note', 'ملاحظة')) +
      '</th></tr></thead><tbody>' +
      rows
        .map(function (m) {
          var q = Number(m.qtyDelta);
          var qc = q < 0 ? 'qty-neg' : q > 0 ? 'qty-pos' : '';
          return (
            '<tr><td>' +
            esc(dt(m.occurredAtUtc)) +
            '</td><td class="code">' +
            esc(m.productSku || '—') +
            '</td><td class="code">' +
            esc(m.warehouseCode || '—') +
            '</td><td>' +
            esc(m.reason) +
            '</td><td class="' +
            qc +
            '">' +
            esc(m.qtyDelta) +
            '</td><td class="muted">' +
            esc(m.note || '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  document.getElementById('btnRefresh').addEventListener('click', function () {
    var act = document.querySelector('.rtab.act');
    var tab = act ? act.getAttribute('data-tab') : 'summary';
    if (tab === 'summary') loadSummary();
    else if (tab === 'performance') loadPerformance();
    else if (tab === 'dead') loadDeadStock();
    else loadMovements();
  });
  document.getElementById('btnLoadMov').addEventListener('click', loadMovements);
  document.getElementById('btnLoadPerf').addEventListener('click', loadPerformance);
  document.getElementById('btnLoadDead').addEventListener('click', loadDeadStock);

  (async function boot() {
    await loadWarehouses();
    await loadSummary();
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
    try {
      var tabQ = new URLSearchParams(window.location.search).get('tab');
      if (tabQ && tabQ !== 'summary' && document.querySelector('.rtab[data-tab="' + tabQ + '"]')) {
        switchTab(tabQ);
      }
    } catch (e) {
      /* ignore */
    }
  })();
})();
