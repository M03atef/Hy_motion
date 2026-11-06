/**
 * Member Orders — staff packing desk.
 * Complete creates a paid retail sale + invoice (open shift required for cash).
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var Mo = window.GfpMemberOrdersApi;
  var I18n = window.GfpI18n;
  var PAGE_SIZE = 20;

  function t(en, ar) {
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n, currency) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    try {
      return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency: currency || 'EGP'
      }).format(Number(n));
    } catch (e) {
      return Number(n).toFixed(2) + ' ' + (currency || 'EGP');
    }
  }
  function dt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function apiError(r) {
    if (!r) return t('Unable to load member orders.', 'مش قدرنا نحمّل طلبات الأعضاء.');
    var d = r.data || r.error || {};
    var title = d.title || (d.error && d.error.code) || '';
    if (title === 'FEATURE_DISABLED') {
      return t('Member Orders are turned off for this gym.', 'طلبات الأعضاء مقفولة لهذا النادي.');
    }
    if (title === 'FORBIDDEN' || r.status === 403) {
      return t('You do not have permission for this action.', 'مش عندك صلاحية لهذا الإجراء.');
    }
    var detail = d.detail || d.message || d.error || (d.error && d.error.message) || '';
    if (typeof detail === 'object' && detail.message) detail = detail.message;
    detail = String(detail || '');
    if (detail.indexOf('OPEN_SHIFT_REQUIRED') !== -1) {
      return t(
        'Open a shift first to complete and take cash.',
        'افتح وردية أولاً لإتمام الطلب وقبض النقد.'
      );
    }
    // "CODE|English / Arabic" → prefer English segment before slash
    if (detail.indexOf('|') !== -1) detail = detail.split('|').slice(1).join('|').trim();
    if (detail.indexOf(' / ') !== -1) detail = detail.split(' / ')[0].trim();
    if (detail && !/^[A-Z][A-Z0-9_]+$/.test(detail)) return detail;
    if (r.status === 0) return t('Network error — try again.', 'مشكلة شبكة — حاول تاني.');
    return t('Unable to update this order. Please try again.', 'مش قدرنا نحدّث الطلب. حاول تاني.');
  }

  function statusLabel(st) {
    var n = Mo ? Mo.normalizeStatus(st) : st;
    if (n === 'Pending') return t('New', 'جديد');
    if (n === 'Accepted') return t('Preparing', 'بنجهّز');
    if (n === 'Ready') return t('Ready', 'جاهز');
    if (n === 'Completed') return t('Done', 'تمام');
    if (n === 'Rejected') return t("Couldn't", 'مش قادرين');
    return n || '—';
  }

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  }

  var user = getUser();
  if (!user || !(Gfp && Gfp.tokens && Gfp.tokens.getAccess())) {
    location.href = '/auth/login/';
    return;
  }

  var role = (user && user.role) || '';
  var canView =
    (Authz &&
      (Authz.useCan('sales.sell') ||
        Authz.useCan('orders.view') ||
        Authz.useCan('orders.fulfill') ||
        Authz.useCan('memberorders.view') ||
        Authz.useCan('memberorders.manage'))) ||
    /Owner|Manager|Receptionist/i.test(role);
  var canAct =
    (Authz &&
      (Authz.useCan('sales.sell') ||
        Authz.useCan('orders.fulfill') ||
        Authz.useCan('memberorders.manage'))) ||
    /Owner|Manager|Receptionist/i.test(role);

  document.getElementById('userAvatar').textContent = (user.fullName || 'U')
    .split(' ')
    .map(function (w) {
      return w[0];
    })
    .join('')
    .slice(0, 2)
    .toUpperCase();
  document.getElementById('userName').textContent = user.fullName || 'User';
  document.getElementById('userRole').textContent = role || 'Staff';
  document.getElementById('btnLogout').onclick = function () {
    if (Gfp && Gfp.tokens) Gfp.tokens.clear();
    location.href = '/auth/login/';
  };

  var page = 1;
  var statusFilter = '';
  var selectedId = null;
  var selectedOrder = null;
  var actionBusy = false;
  var pollTimer = null;
  var hubConnection = null;
  var productById = {};
  var linesByOrderId = {};
  var hydrating = false;

  function mediaUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    var origin = String(window.API_BASE || (Gfp && Gfp.apiBase && Gfp.apiBase()) || '').replace(
      /\/api\/?$/i,
      ''
    );
    if (!origin && Gfp && typeof Gfp.apiBase === 'function') {
      origin = String(Gfp.apiBase()).replace(/\/api\/?$/i, '');
    }
    if (!origin) {
      try {
        origin = new URL(window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api', window.location.origin).origin;
      } catch (e) {
        origin = window.location.origin;
      }
    }
    return origin + (u.charAt(0) === '/' ? u : '/' + u);
  }

  function productRecord(id) {
    if (!id) return null;
    return productById[id] || productById[String(id)] || null;
  }

  function linePhoto(line) {
    var p = productRecord(line && line.productId);
    return (line && line.imageUrl) || (p && (p.imageUrl || p.relativeUrl)) || '';
  }

  function thumbHtml(url, cls) {
    var src = mediaUrl(url);
    var klass = cls || 'thumb';
    if (!src) return '<span class="thumb-ph" aria-hidden="true"><i class="ti ti-photo"></i></span>';
    return (
      '<img class="' +
      klass +
      '" src="' +
      esc(src) +
      '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;thumb-ph&quot; aria-hidden=&quot;true&quot;><i class=&quot;ti ti-photo&quot;></i></span>\'">'
    );
  }

  function rememberLines(o) {
    if (o && o.id && o.lines && o.lines.length) linesByOrderId[o.id] = o.lines;
  }

  function linesFor(o) {
    if (o && o.lines && o.lines.length) return o.lines;
    if (o && o.id && linesByOrderId[o.id]) return linesByOrderId[o.id];
    return [];
  }

  function whatSummary(o) {
    var lines = linesFor(o);
    if (!lines.length) {
      return '<span class="what muted">' + esc(t('Tap to see', 'اضغط للعرض')) + '</span>';
    }
    var first = lines[0];
    var extra = lines.length > 1 ? ' +' + (lines.length - 1) : '';
    return (
      '<span class="what">' +
      thumbHtml(linePhoto(first)) +
      '<span>' +
      esc(first.name || t('Item', 'صنف')) +
      extra +
      '</span></span>'
    );
  }

  async function loadProducts() {
    if (!Gfp) return;
    try {
      var r = await Gfp.get('/inventory/products');
      if (!r.ok) return;
      var rows = Array.isArray(r.data) ? r.data : (r.data && r.data.items) || [];
      rows.forEach(function (p) {
        if (p && p.id) {
          productById[p.id] = {
            name: p.name || p.sku || '',
            sku: p.sku || '',
            imageUrl: p.imageUrl || p.relativeUrl || null
          };
        }
      });
    } catch (e) {}
  }

  function showFeatureBanner(msg) {
    var el = document.getElementById('featureDisabled');
    var body = document.getElementById('featureDisabledBody');
    if (body && msg) body.textContent = msg;
    if (!el) return;
    el.hidden = false;
    el.classList.remove('is-off');
    el.style.display = 'flex';
  }
  function hideFeatureBanner() {
    var el = document.getElementById('featureDisabled');
    if (!el) return;
    el.hidden = true;
    el.classList.add('is-off');
    el.style.display = '';
  }

  function drawerOpen() {
    var d = document.getElementById('detailDrawer');
    return d && !d.hidden;
  }

  function openDrawer() {
    var d = document.getElementById('detailDrawer');
    if (d) d.hidden = false;
  }

  function closeDrawer() {
    var d = document.getElementById('detailDrawer');
    if (d) d.hidden = true;
    document.querySelectorAll('#tbody tr[data-id]').forEach(function (tr) {
      tr.classList.remove('row-sel');
    });
  }

  async function loadList() {
    var tbody = document.getElementById('tbody');
    if (!canView) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="mo-error">' +
        esc(t('You do not have permission to view member orders.', 'مش عندك صلاحية تشوف طلبات الأعضاء.')) +
        '</td></tr>';
      showFeatureBanner(
        t('You do not have permission to view member orders.', 'مش عندك صلاحية تشوف طلبات الأعضاء.')
      );
      return;
    }
    if (!Gfp || !Mo) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="mo-error">' +
        esc(t('Unable to load member orders.', 'مش قدرنا نحمّل طلبات الأعضاء.')) +
        '</td></tr>';
      return;
    }
    tbody.innerHTML =
      '<tr><td colspan="5" class="mo-loading">' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</td></tr>';

    var q = { page: page, pageSize: PAGE_SIZE };
    if (statusFilter) q.status = statusFilter;
    var r = await Gfp.get(Mo.paths.list(q));
    if (r.status === 401) {
      location.href = '/auth/login/';
      return;
    }
    if (!r.ok) {
      if (r.data && r.data.title === 'FEATURE_DISABLED') showFeatureBanner(apiError(r));
      tbody.innerHTML =
        '<tr><td colspan="5" class="mo-error">' +
        esc(apiError(r)) +
        ' <button type="button" class="btn secondary" id="btnRetryList">' +
        esc(t('Try again', 'حاول تاني')) +
        '</button></td></tr>';
      var retry = document.getElementById('btnRetryList');
      if (retry) retry.onclick = loadList;
      renderPager(1, 0);
      return;
    }

    var paged = Mo.extractPaged(r.data);
    var items = (paged.items || []).map(Mo.normalizeOrder).filter(Boolean);
    hideFeatureBanner();
    items.forEach(rememberLines);
    renderPager(paged.totalPages, paged.totalCount);
    renderRows(items);
    hydrateMissing(items);
  }

  function renderRows(items) {
    var tbody = document.getElementById('tbody');
    if (!items.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="mo-empty">' +
        esc(t('No orders from the app yet.', 'مفيش طلبات من التطبيق لسه.')) +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map(function (o) {
        var sel = o.id === selectedId && drawerOpen() ? ' row-sel' : '';
        return (
          '<tr class="' +
          sel +
          '" data-id="' +
          esc(o.id) +
          '">' +
          '<td class="who">' +
          esc(o.memberName) +
          '</td>' +
          '<td>' +
          whatSummary(o) +
          '</td>' +
          '<td class="amt">' +
          esc(money(o.total, o.currency)) +
          '</td>' +
          '<td>' +
          esc(dt(o.createdAt)) +
          '</td>' +
          '<td><span class="mo-status ' +
          esc(o.status) +
          '">' +
          esc(statusLabel(o.status)) +
          '</span></td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function (tr) {
      tr.onclick = function () {
        openDetail(tr.getAttribute('data-id'));
      };
    });
  }

  async function hydrateMissing(items) {
    if (hydrating || !Gfp || !Mo) return;
    var missing = items.filter(function (o) {
      return o && o.id && !linesFor(o).length;
    });
    if (!missing.length) return;
    hydrating = true;
    try {
      await Promise.all(
        missing.slice(0, PAGE_SIZE).map(function (o) {
          return Gfp.get(Mo.paths.detail(o.id)).then(function (r) {
            if (r && r.ok) rememberLines(Mo.normalizeOrder(r.data));
          });
        })
      );
      items.forEach(function (o) {
        if (o && o.id && linesByOrderId[o.id] && !(o.lines && o.lines.length)) {
          o.lines = linesByOrderId[o.id];
        }
      });
      renderRows(items);
    } catch (e) {
    } finally {
      hydrating = false;
    }
  }

  function renderPager(totalPages, totalCount) {
    var el = document.getElementById('pager');
    if (!el) return;
    var tp = Math.max(1, totalPages || 1);
    el.innerHTML =
      '<button type="button" class="btn secondary js-prev"' +
      (page <= 1 ? ' disabled' : '') +
      '>' +
      esc(t('Prev', 'السابق')) +
      '</button>' +
      '<span>' +
      esc(t('Page', 'صفحة')) +
      ' ' +
      page +
      ' / ' +
      tp +
      ' · ' +
      esc(String(totalCount || 0)) +
      '</span>' +
      '<button type="button" class="btn secondary js-next"' +
      (page >= tp ? ' disabled' : '') +
      '>' +
      esc(t('Next', 'التالي')) +
      '</button>';
    el.querySelector('.js-prev').onclick = function () {
      if (page > 1) {
        page -= 1;
        loadList();
      }
    };
    el.querySelector('.js-next').onclick = function () {
      if (page < tp) {
        page += 1;
        loadList();
      }
    };
  }

  async function openDetail(id) {
    if (!id || !Gfp || !Mo) return;
    selectedId = id;
    document.querySelectorAll('#tbody tr[data-id]').forEach(function (tr) {
      tr.classList.toggle('row-sel', tr.getAttribute('data-id') === id);
    });
    openDrawer();
    document.getElementById('detailLoading').hidden = false;
    document.getElementById('detailBody').hidden = true;
    document.getElementById('dName').textContent = '…';
    document.getElementById('rejectBox').classList.remove('show');

    var r = await Gfp.get(Mo.paths.detail(id));
    if (r.status === 401) {
      location.href = '/auth/login/';
      return;
    }
    if (!r.ok) {
      toast(apiError(r), 'err');
      document.getElementById('dName').textContent = '—';
      document.getElementById('detailLoading').hidden = true;
      document.getElementById('detailBody').hidden = false;
      return;
    }
    selectedOrder = Mo.normalizeOrder(r.data);
    rememberLines(selectedOrder);
    renderDetail(selectedOrder);
  }

  function linePrice(l, currency) {
    if (l.lineTotal != null) return money(l.lineTotal, currency);
    if (l.unitPrice != null) return money(Number(l.unitPrice) * Number(l.qty), currency);
    return '';
  }

  function renderDetail(o) {
    if (!o) return;
    document.getElementById('detailLoading').hidden = true;
    document.getElementById('detailBody').hidden = false;
    document.getElementById('dName').textContent = o.memberName || '—';
    document.getElementById('dMeta').textContent = dt(o.createdAt) + ' · ' + statusLabel(o.status);
    document.getElementById('dTotal').textContent = money(o.total, o.currency);

    var lines = document.getElementById('dLines');
    var rows = linesFor(o);
    if (!rows.length) {
      lines.innerHTML = '<div class="muted">' + esc(t('No items.', 'مفيش أصناف.')) + '</div>';
    } else {
      lines.innerHTML = rows
        .map(function (l) {
          return (
            '<div class="mo-line">' +
            thumbHtml(linePhoto(l)) +
            '<div><div class="nm">' +
            esc(l.name) +
            '</div><div class="qty">× ' +
            esc(String(l.qty)) +
            '</div></div>' +
            '<div class="px">' +
            esc(linePrice(l, o.currency)) +
            '</div></div>'
          );
        })
        .join('');
    }

    var note = document.getElementById('dNote');
    if (o.note) {
      note.hidden = false;
      note.textContent = o.note;
    } else {
      note.hidden = true;
      note.textContent = '';
    }

    var st = Mo.normalizeStatus(o.status);
    var hint = document.getElementById('dHint');
    if (st === 'Pending') {
      hint.textContent = t(
        'They asked from the Member App. Pack it, then tap I’ll pack this.',
        'طلبوا من التطبيق. جهّز الطلب، وبعدين اضغط هجهّزه.'
      );
    } else if (st === 'Accepted') {
      hint.textContent = t(
        'You’re packing this. When the bag is ready, tap It’s ready.',
        'بتجهّز الطلب. لما الشنطة تبقى جاهزة، اضغط جاهز.'
      );
    } else if (st === 'Ready') {
      hint.textContent = t(
        'Waiting at the desk. When they take it, tap They collected it.',
        'مستني عند المكتب. لما ياخدوا الطلب، اضغط استلموه.'
      );
    } else if (st === 'Completed') {
      hint.textContent = t(
        'Done. Invoice ready — print if needed.',
        'تمام. الفاتورة جاهزة — اطبع لو محتاج.'
      );
    } else if (st === 'Rejected') {
      hint.textContent = t("Couldn't fulfill this order.", 'مش قدرنا نجهّز الطلب.');
    } else {
      hint.textContent = '';
    }

    var linkWrap = document.getElementById('dMemberLinkWrap');
    linkWrap.innerHTML = o.memberId
      ? '<a class="btn secondary" href="/dashboard/members/' +
        encodeURIComponent(o.memberId) +
        '/"><i class="ti ti-user"></i> ' +
        esc(t('Open member', 'افتح العضو')) +
        '</a>'
      : '';

    renderActions(o);
  }

  function renderActions(o) {
    var host = document.getElementById('dActions');
    host.innerHTML = '';
    document.getElementById('rejectBox').classList.remove('show');
    if (!o) return;
    var st = Mo.normalizeStatus(o.status);

    function addBtn(id, labelEn, labelAr, cls) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (cls || 'primary');
      b.id = id;
      b.textContent = t(labelEn, labelAr);
      host.appendChild(b);
      return b;
    }

    if (canAct) {
      if (st === 'Pending') {
        addBtn('btnAccept', 'I’ll pack this', 'هجهّزه', 'primary').onclick = function () {
          runAction('accept');
        };
        addBtn('btnReject', "Can't fulfill", 'مش قادرين', 'secondary').onclick = function () {
          document.getElementById('rejectBox').classList.add('show');
        };
      } else if (st === 'Accepted') {
        addBtn('btnReady', 'It’s ready', 'جاهز', 'primary').onclick = function () {
          runAction('ready');
        };
      } else if (st === 'Ready') {
        addBtn('btnComplete', 'They collected it', 'استلموه', 'primary').onclick = function () {
          runAction('complete');
        };
      }
    }

    if (st === 'Completed' && (o.invoiceId || o.saleId)) {
      addBtn('btnPrintInvoice', 'Print invoice', 'اطبع الفاتورة', 'secondary').onclick = function () {
        printOrderInvoice(o, true);
      };
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function waitForSaleInvoice(saleId) {
    if (!Gfp || !saleId) return null;
    for (var i = 0; i < 30; i++) {
      var res = await Gfp.get('/sales/' + encodeURIComponent(saleId) + '/invoice');
      if (res.ok && res.data && (res.data.invoiceId || res.data.InvoiceId)) {
        return {
          invoiceId: res.data.invoiceId || res.data.InvoiceId,
          invoiceNumber: res.data.invoiceNumber || res.data.InvoiceNumber || ''
        };
      }
      if (res.status && res.status !== 404) return null;
      await sleep(i < 8 ? 150 : 350);
    }
    return null;
  }

  function closeMoPrint() {
    var ov = document.getElementById('moPrintOverlay');
    if (ov) ov.hidden = true;
    var frame = document.getElementById('moPrintFrame');
    if (frame) frame.srcdoc = '';
  }

  async function openOrderReceiptPrint(invoiceId, invoiceNumber, autoPrint) {
    var overlay = document.getElementById('moPrintOverlay');
    var frame = document.getElementById('moPrintFrame');
    var title = document.getElementById('moPrintTitle');
    if (!overlay || !frame || !invoiceId) {
      toast(t('Print view not available.', 'شاشة الطباعة مش متاحة.'), 'err');
      return;
    }
    if (title) {
      title.textContent = invoiceNumber
        ? t('Invoice', 'فاتورة') + ' ' + invoiceNumber
        : t('Receipt', 'إيصال');
    }
    overlay.hidden = false;
    frame.srcdoc =
      '<p style="padding:16px;font-family:sans-serif;color:#666">' +
      esc(t('Loading receipt…', 'جاري تحميل الإيصال…')) +
      '</p>';

    var htmlRes = Gfp
      ? await Gfp.get('/invoices/' + encodeURIComponent(invoiceId) + '/receipt-html')
      : { ok: false };
    if (htmlRes.status === 401) {
      location.href = '/auth/login/';
      return;
    }
    var text = typeof htmlRes.data === 'string' ? htmlRes.data : '';
    if (!htmlRes.ok || !text) {
      var detail = t('Could not load receipt.', 'مش قدرنا نحمّل الإيصال.');
      toast(detail, 'err');
      frame.srcdoc =
        '<p style="padding:16px;font-family:sans-serif;color:#991b1b">' + esc(detail) + '</p>';
      return;
    }
    frame.srcdoc = text;
    if (autoPrint) {
      setTimeout(function () {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch (e) {
          toast(t('Allow pop-ups / try Print again.', 'اسمح بالنوافذ أو اضغط طباعة تاني.'), 'err');
        }
      }, 450);
    }
  }

  async function printOrderInvoice(o, autoPrint) {
    if (!o) return;
    var invoiceId = o.invoiceId;
    var invoiceNumber = o.invoiceNumber || '';
    if (!invoiceId && o.saleId) {
      toast(t('Preparing invoice…', 'جاري تجهيز الفاتورة…'), 'ok');
      var inv = await waitForSaleInvoice(o.saleId);
      if (inv) {
        invoiceId = inv.invoiceId;
        invoiceNumber = inv.invoiceNumber || invoiceNumber;
        o.invoiceId = invoiceId;
        o.invoiceNumber = invoiceNumber;
      }
    }
    if (!invoiceId) {
      toast(
        t('Invoice still preparing — try Print again.', 'الفاتورة لسه بت تجهز — حاول اطبع تاني.'),
        'err'
      );
      return;
    }
    await openOrderReceiptPrint(invoiceId, invoiceNumber, !!autoPrint);
  }

  async function runAction(kind) {
    if (!selectedId || actionBusy || !Gfp || !Mo) return;
    actionBusy = true;
    var buttons = document.querySelectorAll('#dActions .btn, #btnRejectConfirm');
    buttons.forEach(function (b) {
      b.disabled = true;
    });

    var path =
      kind === 'accept'
        ? Mo.paths.accept(selectedId)
        : kind === 'reject'
          ? Mo.paths.reject(selectedId)
          : kind === 'ready'
            ? Mo.paths.ready(selectedId)
            : Mo.paths.complete(selectedId);

    var body = {};
    if (kind === 'reject') {
      var reason = (document.getElementById('rejectReason').value || '').trim();
      if (reason) body.reason = reason;
    }

    var r = await Gfp.post(path, body);
    actionBusy = false;
    buttons.forEach(function (b) {
      b.disabled = false;
    });

    if (r.status === 401) {
      location.href = '/auth/login/';
      return;
    }
    if (!r.ok) {
      toast(apiError(r), 'err');
      return;
    }

    toast(t('Order updated.', 'تم تحديث الطلب.'), 'ok');
    document.getElementById('rejectBox').classList.remove('show');
    document.getElementById('rejectReason').value = '';
    if (r.data) {
      selectedOrder = Mo.normalizeOrder(r.data);
      rememberLines(selectedOrder);
      renderDetail(selectedOrder);
      if (kind === 'complete' && (selectedOrder.invoiceId || selectedOrder.saleId)) {
        printOrderInvoice(selectedOrder, true);
      }
    } else {
      await openDetail(selectedId);
    }
    await loadList();
    try {
      window._ordersLoaded = false;
    } catch (e) {}
  }

  document.getElementById('btnRejectConfirm').onclick = function () {
    runAction('reject');
  };
  document.getElementById('btnRefresh').onclick = function () {
    loadList();
    if (selectedId && drawerOpen()) openDetail(selectedId);
  };
  document.getElementById('btnCloseDetail').onclick = closeDrawer;
  document.getElementById('detailDrawer').addEventListener('click', function (e) {
    if (e.target === this) closeDrawer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('moPrintOverlay');
      if (ov && !ov.hidden) {
        closeMoPrint();
        return;
      }
      if (drawerOpen()) closeDrawer();
    }
  });

  var moPrintOverlay = document.getElementById('moPrintOverlay');
  if (moPrintOverlay) {
    moPrintOverlay.addEventListener('click', function (e) {
      if (e.target === moPrintOverlay) closeMoPrint();
    });
  }
  var btnMoPrintClose = document.getElementById('btnMoPrintClose');
  if (btnMoPrintClose) btnMoPrintClose.onclick = closeMoPrint;
  var btnMoPrintDo = document.getElementById('btnMoPrintDo');
  if (btnMoPrintDo) {
    btnMoPrintDo.onclick = function () {
      var frame = document.getElementById('moPrintFrame');
      try {
        if (frame && frame.contentWindow) {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        }
      } catch (e) {
        toast(t('Allow pop-ups / try Print again.', 'اسمح بالنوافذ أو اضغط طباعة تاني.'), 'err');
      }
    };
  }

  document.querySelectorAll('#statusFilters .chip').forEach(function (chip) {
    chip.onclick = function () {
      document.querySelectorAll('#statusFilters .chip').forEach(function (c) {
        c.classList.remove('act');
      });
      chip.classList.add('act');
      statusFilter = chip.getAttribute('data-status') || '';
      page = 1;
      loadList();
    };
  });

  function startPolling(ms) {
    stopPolling();
    pollTimer = setInterval(function () {
      loadList();
      if (selectedId && drawerOpen()) openDetail(selectedId);
    }, ms || 20000);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * Reuse the same SignalR client as Attendance.
   * Known hubs today: /hubs/attendance (check-in only).
   * Try member-order hubs if backend ships them; otherwise poll every 20s.
   */
  async function trySignalR() {
    if (!window.signalR || !window.signalR.HubConnectionBuilder || !Gfp) {
      startPolling(20000);
      return;
    }
    var candidates = ['/hubs/member-orders', '/hubs/orders'];
    var api = window.API_BASE || '';
    var base = api.replace(/\/api\/?$/, '');
    for (var i = 0; i < candidates.length; i++) {
      try {
        if (hubConnection) {
          try {
            await hubConnection.stop();
          } catch (e) {}
          hubConnection = null;
        }
        hubConnection = new signalR.HubConnectionBuilder()
          .withUrl(base + candidates[i], {
            accessTokenFactory: function () {
              return Gfp.tokens.getAccess() || '';
            }
          })
          .withAutomaticReconnect()
          .build();

        ['MemberOrderCreated', 'MemberOrderStatusChanged', 'MemberOrderUpdated', 'OrderUpdated'].forEach(
          function (evt) {
            hubConnection.on(evt, function () {
              loadList();
              if (selectedId && drawerOpen()) openDetail(selectedId);
            });
          }
        );

        await hubConnection.start();
        stopPolling();
        pollTimer = setInterval(function () {
          loadList();
        }, 60000);
        return;
      } catch (e) {
        hubConnection = null;
      }
    }
    startPolling(20000);
  }

  (async function boot() {
    try {
      var r = await Gfp.get('/settings');
      if (r.ok && r.data) document.getElementById('gymName').textContent = r.data.gymName || 'Gym';
    } catch (e) {}
    await loadProducts();
    await loadList();
    var deepId = new URLSearchParams(location.search).get('orderId');
    if (deepId) await openDetail(deepId);
    trySignalR();
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  })();
})();
