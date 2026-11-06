/**
 * Suppliers (FE-INVS-5 + PAP-P0 AP-1). Ledger money is server-owned only.
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
  if (!Authz || !(Authz.useCan('inventory.manage') || Authz.useCan('inventory.purchase'))) {
    window.location.href = '/dashboard/inventory/';
    return;
  }

  var canManage = Authz.useCan('inventory.manage');
  var canPurchase = Authz.useCan('inventory.purchase');
  var canSeeMoney =
    canManage || canPurchase || Authz.useCan('reports.financial.view');
  var rows = [];
  var editingId = null;
  var paySupplierId = null;
  var settlementKind = null;
  var stmtSupplierId = null;
  var stmtEntries = [];
  var productById = {};
  var openedDeepLink = false;
  var searchNeedle = '';
  var outsideClickBound = false;

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
    var v = Number(n);
    // Leading minus + LTR isolate (FSI…PDI): the en-EG currency pattern ("EGP 3,000.00-")
    // trails the minus and scrambles in RTL cells — one convention: -EGP 3,000.00.
    var s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
    return '\u2068' + (v < 0 ? '-EGP ' : 'EGP ') + s + '\u2069';
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = r.error || {};
    var d = r.data || {};
    var detail = e.message || d.detail || d.error || d.message || e.title || d.title || '';
    if (detail && detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    return detail || t('Request failed', 'فشل الطلب') + ' (' + r.status + ')';
  }
  function applyLocale() {
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }
  function openModal(id) {
    document.getElementById(id).hidden = false;
    applyLocale();
  }
  function closeModal(id) {
    document.getElementById(id).hidden = true;
    if (id === 'stmtModal') showStmtList();
  }
  function setModalTitle(en, ar) {
    var el = document.getElementById('supModalTitle');
    el.setAttribute('data-en', en);
    el.setAttribute('data-ar', ar);
    el.textContent = t(en, ar);
  }
  function reasonLabel(r) {
    var map = {
      purchase: ['Purchase', 'شراء'],
      payment: ['Payment', 'دفعة'],
      collection: ['Collection', 'تحصيل'],
      opening: ['Opening', 'افتتاحي'],
      return_credit: ['Return credit', 'مرتجع']
    };
    var p = map[r];
    return p ? t(p[0], p[1]) : r;
  }
  function methodLabel(m) {
    var map = {
      cash: ['Cash', 'نقدي'],
      card: ['Card', 'بطاقة'],
      transfer: ['Transfer', 'تحويل'],
      other: ['Other', 'أخرى']
    };
    var p = map[String(m || '').toLowerCase()];
    return p ? t(p[0], p[1]) : m || '—';
  }
  function parsePayNote(note) {
    var method = null;
    var rest = [];
    String(note || '')
      .split(';')
      .forEach(function (part) {
        part = String(part || '').trim();
        if (!part) return;
        var m = part.match(/^method=(.+)$/i);
        if (m) {
          method = m[1].trim();
          return;
        }
        if (/^(paidAt|collectedAt)=/i.test(part)) return;
        rest.push(part);
      });
    return { method: method, note: rest.join('; ') };
  }
  function ledgerEntries(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }
  function mediaUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    var origin = String(window.API_BASE || '').replace(/\/api\/?$/i, '');
    if (!origin) {
      try {
        origin = new URL(window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api', window.location.origin).origin;
      } catch (e) {
        origin = window.location.origin;
      }
    }
    return origin + (u.charAt(0) === '/' ? u : '/' + u);
  }
  async function ensureProducts() {
    if (Object.keys(productById).length) return;
    var r = await Gfp.get(paths.products());
    if (!r.ok) return;
    var list = Array.isArray(r.data) ? r.data : ledgerEntries(r.data);
    list.forEach(function (p) {
      if (p && p.id) productById[p.id] = p;
    });
  }
  function productCellHtml(line) {
    var p = (line && line.productId && productById[line.productId]) || {};
    var name = (line && (line.productName || line.productSku)) || p.name || p.sku || t('Product', 'منتج');
    var src = mediaUrl(p.imageUrl || p.relativeUrl);
    var thumb = src
      ? '<img class="thumb" src="' +
      esc(src) +
      '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.hidden=false)">' +
      '<span class="thumb-ph" hidden><i class="ti ti-photo"></i></span>'
      : '<span class="thumb-ph"><i class="ti ti-photo"></i></span>';
    return '<div class="prod-cell">' + thumb + '<span>' + esc(name) + '</span></div>';
  }
  function showStmtList() {
    var list = document.getElementById('stmtListPane');
    var detail = document.getElementById('stmtDetailPane');
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
  }
  function showStmtDetail() {
    var list = document.getElementById('stmtListPane');
    var detail = document.getElementById('stmtDetailPane');
    if (list) list.hidden = true;
    if (detail) detail.hidden = false;
    applyLocale();
  }

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      closeModal(b.getAttribute('data-close'));
    });
  });

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
    if (canManage) document.getElementById('manageActions').hidden = false;
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  function obSignValue() {
    var checked = document.querySelector('input[name="obSign"]:checked');
    return checked ? checked.value : '1';
  }
  function setObSign(value) {
    var v = value === '0' || value === 0 ? '0' : '1';
    var radio = document.querySelector('input[name="obSign"][value="' + v + '"]');
    if (radio) radio.checked = true;
    syncObRadios();
    renderObPreview();
  }
  function syncObRadios() {
    document.querySelectorAll('.ob-radio').forEach(function (card) {
      var input = card.querySelector('input');
      card.classList.toggle('sel', !!(input && input.checked));
    });
  }
  function renderObPreview() {
    var host = document.getElementById('obPreview');
    if (!host) return;
    var amt = Number(document.getElementById('sOpeningAmt').value) || 0;
    if (!(amt > 0)) {
      host.textContent = '';
      return;
    }
    var owed = obSignValue() === '1';
    host.innerHTML =
      esc(t('Will be recorded as:', 'هيتسجل كـ:')) +
      ' <strong>' +
      esc(owed ? t('we owe them', 'إحنا اللي مديونين له') : t('they owe us', 'هو اللي مديون لنا')) +
      ' — ' +
      esc(money(amt)) +
      '</strong>';
  }

  function fillForm(s) {
    document.getElementById('sName').value = (s && s.name) || '';
    document.getElementById('sNameAr').value = (s && s.nameAr) || '';
    document.getElementById('sPhone').value = (s && s.phone) || '';
    document.getElementById('sEmail').value = (s && s.email) || '';
    document.getElementById('sTerms').value = (s && s.paymentTerms) || '';
    document.getElementById('sAddress').value = (s && s.address) || '';
    document.getElementById('sNotes').value = (s && s.notes) || '';
    document.getElementById('sActive').checked = !s || s.isActive !== false;
    document.getElementById('sOpeningAmt').value = '0';
    setObSign('1');
    document.getElementById('supHint').textContent = '';
    var showOpening = !s && canPurchase;
    document.getElementById('openingBlock').hidden = !showOpening;
  }

  function readForm() {
    var body = {
      name: document.getElementById('sName').value.trim(),
      nameAr: document.getElementById('sNameAr').value.trim() || null,
      phone: document.getElementById('sPhone').value.trim() || null,
      email: document.getElementById('sEmail').value.trim() || null,
      paymentTerms: document.getElementById('sTerms').value.trim() || null,
      address: document.getElementById('sAddress').value.trim() || null,
      notes: document.getElementById('sNotes').value.trim() || null,
      isActive: document.getElementById('sActive').checked
    };
    if (!editingId && canPurchase) {
      var amt = Number(document.getElementById('sOpeningAmt').value) || 0;
      if (amt > 0) {
        body.openingAmount = amt;
        body.openingOwedToSupplier = obSignValue() === '1';
      }
    }
    return body;
  }

  function renderKpis() {
    var host = document.getElementById('kpiHost');
    if (!canSeeMoney) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    var total = rows.length;
    var active = rows.filter(function (s) {
      return s.isActive !== false;
    }).length;
    // Ledger convention: a positive balance means the gym owes that supplier.
    // Supplier credit (a negative balance) must not reduce the amount currently payable.
    var payable = rows.reduce(function (sum, s) {
      return sum + Math.max(0, s.dueTotal != null ? Number(s.dueTotal) || 0 : 0);
    }, 0);
    host.hidden = false;
    host.innerHTML =
      '<div class="kpi-card"><div class="label">' +
      esc(t('Total suppliers', 'إجمالي الموردين')) +
      '</div><div class="value">' +
      esc(total) +
      '</div></div>' +
      '<div class="kpi-card"><div class="label">' +
      esc(t('Active', 'نشط')) +
      '</div><div class="value">' +
      esc(active) +
      '</div></div>' +
      '<div class="kpi-card"><div class="label">' +
      esc(t('We owe suppliers', 'إجمالي علينا للموردين')) +
      '</div><div class="value due">' +
      esc(money(payable)) +
      '</div></div>';
  }

  async function loadList() {
    var host = document.getElementById('tableHost');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';
    var includeInactive = document.getElementById('filterInactive').checked;
    var r = await Gfp.get(
      paths.suppliers({ includeInactive: includeInactive ? 'true' : undefined })
    );
    if (!r.ok) {
      host.innerHTML = '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }
    rows = Array.isArray(r.data) ? r.data : [];
    render();
    var deep = new URLSearchParams(window.location.search).get('id');
    if (!openedDeepLink && deep && canSeeMoney && rows.some(function (s) { return s.id === deep; })) {
      openedDeepLink = true;
      openStatement(deep);
    }
  }

  function render() {
    renderKpis();
    var host = document.getElementById('tableHost');
    var q = (searchNeedle || '').toLowerCase();
    var visible = q
      ? rows.filter(function (s) {
          return (
            String(s.name || '').toLowerCase().indexOf(q) !== -1 ||
            String(s.nameAr || '').toLowerCase().indexOf(q) !== -1 ||
            String(s.phone || '').toLowerCase().indexOf(q) !== -1
          );
        })
      : rows;
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No suppliers yet.', 'لا يوجد موردون بعد.')) + '</p></div>';
      return;
    }
    if (!visible.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No supplier matches this search.', 'مفيش مورد مطابق للبحث ده.')) + '</p></div>';
      return;
    }
    host.innerHTML =
      '<table class="inv"><thead><tr>' +
      '<th>' +
      esc(t('Supplier', 'المورد')) +
      '</th>' +
      (canSeeMoney
        ? '<th>' +
        esc(t('Purchases', 'المشتريات')) +
        '</th><th>' +
        esc(t('Paid', 'مدفوع')) +
        '</th><th>' +
        esc(t('Balance', 'الرصيد')) +
        '</th>'
        : '') +
      '<th></th></tr></thead><tbody>' +
      visible
        .map(function (s) {
          var due = Number(s.dueTotal) || 0;
          var menuItems = '';
          if (canSeeMoney) {
            menuItems +=
              '<button type="button" class="menu-item" data-stmt="' +
              esc(s.id) +
              '"><i class="ti ti-eye"></i>' +
              esc(t('Statement', 'كشف الحساب')) +
              '</button>';
          }
          if (canPurchase && due >= 0) {
            menuItems +=
              '<button type="button" class="menu-item pay" data-pay="' +
              esc(s.id) +
              '"><i class="ti ti-cash-banknote"></i>' +
              esc(t('Record payment', 'تسجيل دفعة')) +
              '</button>';
          }
          if (canPurchase && due < 0) {
            menuItems +=
              '<button type="button" class="menu-item collect" data-collect="' +
              esc(s.id) +
              '"><i class="ti ti-cash-banknote"></i>' +
              esc(t('Record collection', 'تسجيل تحصيل')) +
              '</button>';
          }
          if (canManage) {
            menuItems +=
              '<button type="button" class="menu-item" data-edit="' +
              esc(s.id) +
              '"><i class="ti ti-pencil"></i>' +
              esc(t('Edit', 'تعديل')) +
              '</button>';
          }
          // Ledger convention: positive = the gym owes the supplier; negative = the supplier
          // owes the gym. Keep the direction in words so a signed number can never be misread.
          var dirChip = '';
          if (canSeeMoney && due !== 0) {
            dirChip =
              '<span class="due-dir ' +
              (due > 0 ? 'payable' : 'receivable') +
              '">' +
              esc(due > 0 ? t('we owe them', 'علينا للمورد') : t('they owe us', 'لنا عند المورد')) +
              '</span>';
          }
          return (
            '<tr>' +
            '<td>' +
            (canSeeMoney
              ? '<button type="button" class="name-link" data-stmt="' +
                esc(s.id) +
                '">' +
                esc(s.name) +
                '</button>'
              : esc(s.name)) +
            (s.phone
              ? '<span class="sup-phone" dir="ltr">\u2068' + esc(s.phone) + '\u2069</span>'
              : '') +
            '</td>' +
            (canSeeMoney
              ? '<td>' +
              esc(money(s.purchasesTotal)) +
              '</td><td>' +
              esc(money(s.paidTotal)) +
              '</td><td>' +
              '<button type="button" class="due-link' +
              (due > 0 ? ' money-due' : '') +
              '" data-stmt="' +
              esc(s.id) +
              '">' +
              esc(money(Math.abs(due))) +
              '</button>' +
              dirChip +
              '</td>'
              : '') +
            '<td class="act-cell"><button type="button" class="act-menu-btn" title="' +
            esc(t('Actions', 'إجراءات')) +
            '" aria-haspopup="true"><i class="ti ti-dots"></i></button>' +
            '<div class="act-menu" hidden>' +
            menuItems +
            '</div></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';

    function closeMenus() {
      host.querySelectorAll('.act-menu').forEach(function (m) {
        m.hidden = true;
      });
      host.querySelectorAll('.act-menu-btn').forEach(function (b) {
        b.classList.remove('open');
      });
    }
    host.querySelectorAll('.act-menu-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = btn.parentElement.querySelector('.act-menu');
        var wasOpen = !menu.hidden;
        closeMenus();
        menu.hidden = wasOpen;
        if (!wasOpen) {
          // Keep the last row's menu inside the card instead of letting it be cut off below it.
          var cell = btn.parentElement.getBoundingClientRect();
          menu.classList.toggle('open-up', window.innerHeight - cell.bottom < 180);
        } else {
          menu.classList.remove('open-up');
        }
        btn.classList.toggle('open', !wasOpen);
      });
    });
    // One global outside-click closer (bound once) — menus are re-rendered per load.
    if (!outsideClickBound) {
      outsideClickBound = true;
      document.addEventListener('click', function () {
        document.querySelectorAll('#tableHost .act-menu:not([hidden])').forEach(function (m) {
          m.hidden = true;
        });
        document.querySelectorAll('#tableHost .act-menu-btn.open').forEach(function (b) {
          b.classList.remove('open');
        });
      });
    }
    var supSearch = document.getElementById('supSearch');
    if (supSearch && !supSearch.dataset.bound) {
      supSearch.dataset.bound = '1';
      supSearch.addEventListener('input', function () {
        searchNeedle = supSearch.value.trim();
        render();
      });
    }
    host.querySelectorAll('[data-edit]').forEach(function (btn) {
      if (btn.classList.contains('menu-item')) {
        btn.addEventListener('click', function () {
          closeMenus();
          var id = btn.getAttribute('data-edit');
          var s = rows.find(function (x) {
            return x.id === id;
          });
          if (!s) return;
          editingId = id;
          setModalTitle('Edit supplier', 'تعديل مورد');
          fillForm(s);
          openModal('supModal');
        });
        return;
      }
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        var s = rows.find(function (x) {
          return x.id === id;
        });
        if (!s) return;
        editingId = id;
        setModalTitle('Edit supplier', 'تعديل مورد');
        fillForm(s);
        openModal('supModal');
      });
    });
    host.querySelectorAll('[data-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeMenus();
        openPay(btn.getAttribute('data-pay'));
      });
    });
    host.querySelectorAll('[data-collect]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeMenus();
        openCollection(btn.getAttribute('data-collect'));
      });
    });
    host.querySelectorAll('[data-stmt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeMenus();
        openStatement(btn.getAttribute('data-stmt'));
      });
    });
  }

  function openPay(id) {
    openSettlement(id, 'payment');
  }

  function openCollection(id) {
    openSettlement(id, 'collection');
  }

  function setSettlementText(id, en, ar) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-ar', ar);
    el.textContent = t(en, ar);
  }

  function openSettlement(id, kind) {
    var s = rows.find(function (x) {
      return x.id === id;
    });
    if (!s || !canPurchase) return;
    var due = Number(s.dueTotal) || 0;
    if ((kind === 'collection' && due >= 0) || (kind === 'payment' && due < 0)) return;
    paySupplierId = id;
    settlementKind = kind;
    var isCollection = kind === 'collection';
    document.getElementById('paySupplierName').textContent = s.name;
    setSettlementText(
      'settlementTitle',
      isCollection ? 'Record collection' : 'Record payment',
      isCollection ? 'تسجيل تحصيل' : 'تسجيل دفعة'
    );
    setSettlementText(
      'settlementMethodLabel',
      isCollection ? 'Collection method' : 'Payment method',
      isCollection ? 'طريقة التحصيل' : 'طريقة الدفع'
    );
    setSettlementText(
      'settlementSubmit',
      isCollection ? 'Post collection' : 'Post payment',
      isCollection ? 'تسجيل التحصيل' : 'تسجيل الدفعة'
    );
    document.getElementById('settlementDescription').textContent = isCollection
      ? t('This amount is owed to the gym. Record what you received to settle the balance.', 'هذا مبلغ لنا عند المورد. سجّل ما تم تحصيله لتصفير الرصيد.')
      : t('Record the amount paid to the supplier.', 'سجّل المبلغ المدفوع للمورد.');
    document.getElementById('payAmt').value = isCollection ? Math.abs(due).toFixed(2) : '';
    document.getElementById('payAmt').max = isCollection ? Math.abs(due).toFixed(2) : '';
    document.getElementById('payMethod').value = 'cash';
    document.getElementById('payNote').value = '';
    document.getElementById('payHint').textContent = '';
    openModal('payModal');
  }

  async function openStatement(id) {
    var s = rows.find(function (x) {
      return x.id === id;
    });
    if (!s || !canSeeMoney) return;
    stmtSupplierId = id;
    showStmtList();
    document.getElementById('stmtSupplierName').textContent = s.name;
    document.getElementById('stmtBal').textContent = t('Loading…', 'جاري التحميل…');
    document.getElementById('stmtHost').innerHTML = '';
    openModal('stmtModal');
    var bal = await Gfp.get(paths.supplierBalance(id));
    var led = await Gfp.get(paths.supplierLedger(id));
    if (bal.ok && bal.data) {
      document.getElementById('stmtBal').textContent =
        t('Due', 'المستحق') +
        ': ' +
        money(bal.data.dueTotal) +
        ' · ' +
        t('Purchases', 'المشتريات') +
        ': ' +
        money(bal.data.purchasesTotal) +
        ' · ' +
        t('Paid', 'المدفوع') +
        ': ' +
        money(bal.data.paidTotal);
    } else {
      document.getElementById('stmtBal').textContent = apiError(bal);
    }
    if (!led.ok) {
      document.getElementById('stmtHost').innerHTML =
        '<div class="error-state"><p>' + esc(apiError(led)) + '</p></div>';
      return;
    }
    var entries = ledgerEntries(led.data);
    stmtEntries = entries;
    if (!entries.length) {
      document.getElementById('stmtHost').innerHTML =
        '<div class="empty-state"><p>' + esc(t('No ledger entries', 'لا قيود')) + '</p></div>';
      return;
    }
    document.getElementById('stmtHost').innerHTML =
      '<table class="inv"><thead><tr><th>' +
      esc(t('Date', 'التاريخ')) +
      '</th><th>' +
      esc(t('Reason', 'السبب')) +
      '</th><th>' +
      esc(t('Amount', 'المبلغ')) +
      '</th><th>' +
      esc(t('Note', 'ملاحظة')) +
      '</th></tr></thead><tbody>' +
      entries
        .map(function (e, i) {
          return (
            '<tr class="stmt-row" tabindex="0" data-idx="' +
            i +
            '"><td>' +
            esc(e.createdAtUtc ? new Date(e.createdAtUtc).toLocaleString() : '—') +
            '</td><td>' +
            esc(reasonLabel(e.reason)) +
            '</td><td class="' +
            (Number(e.amount) > 0 ? 'money-due' : 'money-ok') +
            '">' +
            esc(money(e.amount)) +
            '</td><td>' +
            esc(e.note || '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
    document.getElementById('stmtHost').querySelectorAll('.stmt-row').forEach(function (tr) {
      function open() {
        var idx = Number(tr.getAttribute('data-idx'));
        openStmtEntry(stmtEntries[idx]);
      }
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  function metaRow(label, value) {
    return (
      '<div class="row"><span>' +
      esc(label) +
      '</span><span>' +
      value +
      '</span></div>'
    );
  }

  function renderStmtLedgerDetail(entry) {
    var parsed = parsePayNote(entry.note);
    var bits = [
      metaRow(t('Date', 'التاريخ'), esc(entry.createdAtUtc ? new Date(entry.createdAtUtc).toLocaleString() : '—')),
      metaRow(t('Type', 'النوع'), esc(reasonLabel(entry.reason))),
      metaRow(t('Amount', 'المبلغ'), esc(money(entry.amount)))
    ];
    if (parsed.method) bits.push(metaRow(t('Method', 'طريقة الدفع'), esc(methodLabel(parsed.method))));
    if (parsed.note) bits.push(metaRow(t('Note', 'ملاحظة'), esc(parsed.note)));
    document.getElementById('stmtDetailHost').innerHTML = '<div class="stmt-meta">' + bits.join('') + '</div>';
  }

  async function openStmtEntry(entry) {
    if (!entry) return;
    var title = document.getElementById('stmtDetailTitle');
    var reason = String(entry.reason || '').toLowerCase();
    var en = reason === 'purchase' ? 'Purchase' : reason === 'payment' ? 'Payment' : reason === 'collection' ? 'Collection' : reason === 'opening' ? 'Opening' : 'Details';
    var ar = reason === 'purchase' ? 'شراء' : reason === 'payment' ? 'دفعة' : reason === 'collection' ? 'تحصيل' : reason === 'opening' ? 'افتتاحي' : 'التفاصيل';
    title.setAttribute('data-en', en);
    title.setAttribute('data-ar', ar);
    title.textContent = t(en, ar);
    document.getElementById('stmtDetailHost').innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';
    showStmtDetail();
    var refId = entry.referenceId;
    if (String(entry.reason || '').toLowerCase() === 'purchase' && refId) {
      await ensureProducts();
      var r = await Gfp.get(paths.goodsReceipt(refId));
      if (!r.ok) {
        renderStmtLedgerDetail(entry);
        var host = document.getElementById('stmtDetailHost');
        host.innerHTML +=
          '<p class="muted">' + esc(t('Could not load purchase items.', 'تعذر تحميل أصناف الشراء.')) + '</p>';
        return;
      }
      renderStmtPurchaseDetail(entry, r.data);
      return;
    }
    renderStmtLedgerDetail(entry);
  }

  function renderStmtPurchaseDetail(entry, doc) {
    var lines = (doc && Array.isArray(doc.lines) ? doc.lines : []) || [];
    var linesHtml = lines.length
      ? '<table class="inv"><thead><tr><th>' +
      esc(t('Product', 'المنتج')) +
      '</th><th>' +
      esc(t('Qty', 'الكمية')) +
      '</th><th>' +
      esc(t('Cost each', 'التكلفة')) +
      '</th><th>' +
      esc(t('Line', 'الإجمالي')) +
      '</th></tr></thead><tbody>' +
      lines
        .map(function (ln) {
          var lineTotal =
            ln.unitCost != null && ln.qty != null ? Number(ln.qty) * Number(ln.unitCost) : null;
          return (
            '<tr><td>' +
            productCellHtml(ln) +
            '</td><td>' +
            esc(String(ln.qty != null ? ln.qty : '—')) +
            '</td><td>' +
            esc(money(ln.unitCost)) +
            '</td><td>' +
            esc(money(lineTotal)) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
      : '<p class="muted">' + esc(t('No items on this purchase', 'لا أصناف في هذا الشراء')) + '</p>';
    var when = (doc && doc.receivedAtUtc) || entry.createdAtUtc;
    document.getElementById('stmtDetailHost').innerHTML =
      '<div class="stmt-meta">' +
      metaRow(t('Date', 'التاريخ'), esc(when ? new Date(when).toLocaleString() : '—')) +
      metaRow(t('Amount', 'المبلغ'), esc(money(doc && doc.totalAmount != null ? doc.totalAmount : entry.amount))) +
      '</div>' +
      '<div class="section-label">' +
      esc(t('Items', 'الأصناف')) +
      '</div>' +
      linesHtml +
      (doc && doc.purchaseOrderId
        ? '<div class="modal-actions" style="justify-content:flex-start;margin-top:14px"><a class="btn-secondary" href="/dashboard/inventory/purchase-orders/?id=' +
        encodeURIComponent(doc.purchaseOrderId) +
        '">' +
        esc(t('Open purchase', 'فتح المشترى')) +
        '</a></div>'
        : '');
  }

  document.getElementById('btnCreate').addEventListener('click', function () {
    editingId = null;
    setModalTitle('New supplier', 'مورد جديد');
    fillForm(null);
    openModal('supModal');
  });

  // Opening-balance radio cards + live preview
  document.querySelectorAll('input[name="obSign"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      syncObRadios();
      renderObPreview();
    });
  });
  var sOpeningAmt = document.getElementById('sOpeningAmt');
  if (sOpeningAmt) sOpeningAmt.addEventListener('input', renderObPreview);

  document.getElementById('supForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!canManage) return;
    var body = readForm();
    if (!body.name) {
      document.getElementById('supHint').textContent = t('Name is required.', 'الاسم مطلوب.');
      return;
    }
    var r;
    if (editingId) {
      r = await Gfp.put(paths.supplier(editingId), body);
    } else {
      r = await Gfp.post(paths.suppliers(), body);
    }
    if (!r.ok) {
      document.getElementById('supHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    toast(
      editingId
        ? t('Supplier updated.', 'تم تحديث المورد.')
        : t('Supplier created.', 'تم إنشاء المورد.'),
      'ok'
    );
    closeModal('supModal');
    await loadList();
  });

  document.getElementById('payForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!canPurchase || !paySupplierId || !settlementKind) return;
    var amount = Number(document.getElementById('payAmt').value);
    if (!(amount > 0)) {
      document.getElementById('payHint').textContent = t('Enter amount > 0.', 'أدخل مبلغاً أكبر من صفر.');
      return;
    }
    var r = await Gfp.post(settlementKind === 'collection' ? paths.supplierCollections(paySupplierId) : paths.supplierPayments(paySupplierId), {
      amount: amount,
      method: document.getElementById('payMethod').value,
      note: document.getElementById('payNote').value.trim() || null
    });
    if (!r.ok) {
      document.getElementById('payHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    toast(
      settlementKind === 'collection'
        ? t('Collection recorded.', 'تم تسجيل التحصيل.')
        : t('Payment recorded.', 'تم تسجيل الدفعة.'),
      'ok'
    );
    var settledSupplierId = paySupplierId;
    closeModal('payModal');
    await loadList();
    if (stmtSupplierId === settledSupplierId && !document.getElementById('stmtModal').hidden) {
      await openStatement(settledSupplierId);
    }
    settlementKind = null;
  });

  document.getElementById('btnStmtBack').addEventListener('click', showStmtList);
  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterInactive').addEventListener('change', loadList);
  window.addEventListener('gfp:locale', function () {
    applyLocale();
    render();
  });
  applyLocale();
  loadList();
})();
