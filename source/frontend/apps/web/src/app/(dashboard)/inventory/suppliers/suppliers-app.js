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
  var stmtSupplierId = null;
  var stmtEntries = [];
  var productById = {};
  var openedDeepLink = false;

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
        if (/^paidAt=/i.test(part)) return;
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
    document.getElementById('sOpeningSign').value = '1';
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
        body.openingOwedToSupplier = document.getElementById('sOpeningSign').value === '1';
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
    var due = rows.reduce(function (sum, s) {
      return sum + (s.dueTotal != null ? Number(s.dueTotal) : 0);
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
      esc(t('Total dues', 'إجمالي المستحقات')) +
      '</div><div class="value due">' +
      esc(money(due)) +
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
    if (!rows.length) {
      host.innerHTML =
        '<div class="empty-state"><p>' + esc(t('No suppliers yet.', 'لا يوجد موردون بعد.')) + '</p></div>';
      return;
    }
    host.innerHTML =
      '<table class="inv"><thead><tr>' +
      '<th>' +
      esc(t('Name', 'الاسم')) +
      '</th><th>' +
      esc(t('Phone', 'الهاتف')) +
      '</th>' +
      (canSeeMoney
        ? '<th>' +
        esc(t('Purchases', 'المشتريات')) +
        '</th><th>' +
        esc(t('Paid', 'مدفوع')) +
        '</th><th>' +
        esc(t('Due', 'المستحق')) +
        '</th>'
        : '') +
      '<th></th></tr></thead><tbody>' +
      rows
        .map(function (s) {
          var due = Number(s.dueTotal) || 0;
          var actions = '<div class="row-actions">';
          if (canManage) {
            actions +=
              '<button type="button" class="btn-link" data-edit="' +
              esc(s.id) +
              '">' +
              esc(t('Edit', 'تعديل')) +
              '</button>';
          }
          if (canSeeMoney) {
            actions +=
              '<button type="button" class="btn-link" data-stmt="' +
              esc(s.id) +
              '">' +
              esc(t('Statement', 'كشف حساب')) +
              '</button>';
          }
          if (canPurchase) {
            actions +=
              '<button type="button" class="btn-link" data-pay="' +
              esc(s.id) +
              '">' +
              esc(t('Pay', 'دفعة')) +
              '</button>';
          }
          actions += '</div>';
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
            '</td><td>' +
            esc(s.phone || '—') +
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
              esc(money(s.dueTotal)) +
              '</button>' +
              '</td>'
              : '') +
            '<td>' +
            actions +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';

    host.querySelectorAll('[data-edit]').forEach(function (btn) {
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
        openPay(btn.getAttribute('data-pay'));
      });
    });
    host.querySelectorAll('[data-stmt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openStatement(btn.getAttribute('data-stmt'));
      });
    });
  }

  function openPay(id) {
    var s = rows.find(function (x) {
      return x.id === id;
    });
    if (!s || !canPurchase) return;
    paySupplierId = id;
    document.getElementById('paySupplierName').textContent = s.name;
    document.getElementById('payAmt').value = '';
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
    var en = reason === 'purchase' ? 'Purchase' : reason === 'payment' ? 'Payment' : reason === 'opening' ? 'Opening' : 'Details';
    var ar = reason === 'purchase' ? 'شراء' : reason === 'payment' ? 'دفعة' : reason === 'opening' ? 'افتتاحي' : 'التفاصيل';
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
    if (!canPurchase || !paySupplierId) return;
    var amount = Number(document.getElementById('payAmt').value);
    if (!(amount > 0)) {
      document.getElementById('payHint').textContent = t('Enter amount > 0.', 'أدخل مبلغاً أكبر من صفر.');
      return;
    }
    var r = await Gfp.post(paths.supplierPayments(paySupplierId), {
      amount: amount,
      method: document.getElementById('payMethod').value,
      note: document.getElementById('payNote').value.trim() || null
    });
    if (!r.ok) {
      document.getElementById('payHint').textContent = apiError(r);
      toast(apiError(r), 'err');
      return;
    }
    toast(t('Payment recorded.', 'تم تسجيل الدفعة.'), 'ok');
    closeModal('payModal');
    await loadList();
    if (stmtSupplierId === paySupplierId && !document.getElementById('stmtModal').hidden) {
      await openStatement(paySupplierId);
    }
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
