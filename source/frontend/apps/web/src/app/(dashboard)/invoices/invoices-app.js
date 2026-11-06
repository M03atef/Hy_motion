(function () {
  'use strict';
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
  const PAGE_SIZE = 20;
  const TABS = {
    sell_membership: { kind: 'sell', lineType: 'membership', title: window.GfpI18n.tLabel('Memberships', 'الاشتراكات') },
    sell_products: { kind: 'sell', lineType: 'retail', title: window.GfpI18n.tLabel('Products sold', 'منتجات مباعة') },
    sell_classes: { kind: 'sell', lineType: 'drop_in', title: window.GfpI18n.tLabel('Classes & drop-ins', 'الحصص والدخول الفردي') },
    buy: { kind: 'buy', title: window.GfpI18n.tLabel('Bought from suppliers', 'مشتريات من الموردين') },
    all: { kind: 'all', title: window.GfpI18n.tLabel('All', 'الكل') },
  };

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH(extra) {
    const t = getToken();
    const h = Object.assign(
      {
        'Content-Type': 'application/json',
        // Free ngrok blocks browser GETs without this — fetch then throws and list stays on Loading…
        'ngrok-skip-browser-warning': 'true',
      },
      extra || {},
    );
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
  const canViewSell =
    perms.has('reports.financial.view') || /Owner|Manager/i.test(role);
  const canViewBuy =
    perms.has('inventory.view') ||
    perms.has('inventory.purchase') ||
    perms.has('inventory.manage') ||
    /Owner|Manager/i.test(role);
  const canVoid = perms.has('payments.refund.approve') || /Owner/i.test(role);
  const canResend = perms.has('sales.sell') || /Owner|Manager|Receptionist/i.test(role);
  const canReceipt = canResend;
  const canRefundRequest =
    perms.has('payments.refund.request') || /Owner|Manager/i.test(role);

  function refundsFeatureOn() {
    const F = window.GfpFeatures;
    if (!F || typeof F.isModuleAvailable !== 'function') return true;
    const reg = F.readCache && F.readCache();
    return F.isModuleAvailable('refunds', reg);
  }

  const params = new URLSearchParams(location.search);
  let activeTab = params.get('tab') || 'sell_membership';
  if (!TABS[activeTab]) activeTab = 'sell_membership';
  if (params.get('tab') && TABS[activeTab]) {
    document.querySelectorAll('.hub-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === activeTab);
    });
  }
  if (params.get('grnId')) activeTab = 'buy';
  const qMember = params.get('memberId');
  if (qMember) {
    const f = document.getElementById('fMemberId');
    if (f) f.value = qMember;
  }

  let page = 1;
  let selectedId = null;
  let selectedKind = null; // sell | buy
  let selectedInvoice = null;
  let buyRows = [];
  let voidTargetId = null;
  let receiptInvoiceId = null;
  let receiptFormat = 'thermal';
  let pendingInvoiceId = params.get('invoiceId') || null;
  let pendingGrnId = params.get('grnId') || params.get('id') || null;
  let productById = {};
  let productsLoaded = false;
  let suppliersLoaded = false;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n, currency) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const cur = currency || 'EGP';
    try {
      return new Intl.NumberFormat('en-EG', { style: 'currency', currency: cur }).format(Number(n));
    } catch (_) {
      return cur + ' ' + Number(n).toFixed(2);
    }
  }
  function displayTotal(inv) {
    const amt = money(inv.total, inv.currency);
    if (inv.type === 'credit_note') {
      return amt + ' <span class="net-hint">(credit note — nets against invoices)</span>';
    }
    return amt;
  }
  function dt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? esc(iso)
      : d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
  function friendlyType(type) {
    if (type === 'credit_note') return window.GfpI18n.tLabel('Credit note', 'إشعار دائن');
    if (type === 'invoice') return window.GfpI18n.tLabel('Invoice', 'فاتورة');
    return type || '—';
  }
  function friendlyStatus(st) {
    if (st === 'issued') return window.GfpI18n.tLabel('Issued', 'صادرة');
    if (st === 'voided') return window.GfpI18n.tLabel('Voided', 'ملغاة');
    if (st === 'received') return window.GfpI18n.tLabel('Received', 'مستلمة');
    return st || '—';
  }
  function productRecord(id) {
    if (!id) return null;
    return productById[id] || productById[String(id)] || null;
  }
  function productLabel(id) {
    const p = productRecord(id);
    return (p && (p.name || p.sku)) || window.GfpI18n.tLabel('Product', 'منتج');
  }
  function mediaUrl(url) {
    if (!url) return '';
    const u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    let origin = String(window.API_BASE || window.GFP_DEFAULT_API_BASE || '').replace(/\/api\/?$/i, '');
    if (!origin && typeof window !== 'undefined' && window.location && window.location.origin) {
      origin = window.location.origin;
    }
    return origin + (u.charAt(0) === '/' ? u : '/' + u);
  }
  function productCellHtml(id, fallbackName) {
    const p = productRecord(id);
    const name = (fallbackName && String(fallbackName).trim()) || (p && (p.name || p.sku)) || window.GfpI18n.tLabel('Product', 'منتج');
    const src = mediaUrl(p && p.imageUrl);
    const thumb = src
      ? '<img class="thumb" src="' +
        esc(src) +
        '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.hidden=false)">' +
        '<span class="thumb-ph" hidden><i class="ti ti-photo"></i></span>'
      : '<span class="thumb-ph"><i class="ti ti-photo"></i></span>';
    return '<div class="prod-cell">' + thumb + '<span>' + esc(name) + '</span></div>';
  }
  function productCellFromSellLine(ln) {
    if (ln && ln.productId) return productCellHtml(ln.productId, ln.description);
    const desc = ln && ln.description ? String(ln.description).trim().toLowerCase() : '';
    if (desc) {
      const ids = Object.keys(productById);
      for (let i = 0; i < ids.length; i++) {
        const p = productById[ids[i]];
        if (p && String(p.name || '').trim().toLowerCase() === desc) {
          return productCellHtml(ids[i], ln.description);
        }
      }
    }
    return productCellHtml(null, ln && ln.description);
  }
  function openDetailDrawer(title) {
    const t = document.getElementById('detailTitle');
    if (t) t.textContent = title || window.GfpI18n.tLabel('Details', 'التفاصيل');
    const d = document.getElementById('detailDrawer');
    if (d) d.hidden = false;
  }
  function closeDetailDrawer() {
    const d = document.getElementById('detailDrawer');
    if (d) d.hidden = true;
  }
  async function ensureBuyLookups() {
    if (!suppliersLoaded) {
      const res = await api('GET', '/inventory/suppliers');
      const rows = res.ok && Array.isArray(res.data) ? res.data : res.ok && res.data && res.data.items ? res.data.items : [];
      const sel = document.getElementById('fSupplierId');
      if (sel) {
        const keep = sel.value;
        sel.innerHTML =
          '<option value="">' + window.GfpI18n.tLabel('All suppliers', 'كل الموردين') + '</option>' +
          rows
            .filter((s) => s.isActive !== false)
            .map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>')
            .join('');
        if (keep) sel.value = keep;
      }
      suppliersLoaded = true;
    }
    if (!productsLoaded) {
      const res = await api('GET', '/inventory/products');
      const rows = res.ok && Array.isArray(res.data) ? res.data : res.ok && res.data && res.data.items ? res.data.items : [];
      rows.forEach((p) => {
        if (p && p.id) {
          productById[p.id] = {
            name: p.name || p.sku || '',
            sku: p.sku || '',
            imageUrl: p.imageUrl || p.relativeUrl || null,
          };
        }
      });
      productsLoaded = true;
    }
  }
  function toast(msg, type, htmlExtra) {
    return globalThis.toastShared(msg, type, htmlExtra);
  }
  function problemMessage(data, status) {
    if (!data) return window.GfpI18n.tLabel('Request failed (' + status + ')', 'فشل الطلب (' + status + ')');
    const title = data.title || '';
    const detail = data.detail || data.message || data.error || '';
    const map = {
      INVOICE_NOT_FOUND: window.GfpI18n.tLabel('Invoice not found.', 'الفاتورة غير موجودة.'),
      ALREADY_VOIDED: window.GfpI18n.tLabel('Invoice is already voided.', 'الفاتورة ملغاة بالفعل.'),
      FEATURE_DISABLED: window.GfpI18n.tLabel('Feature disabled for this tenant.', 'هذه الميزة غير مفعّلة لهذا الحساب.'),
      FORBIDDEN: window.GfpI18n.tLabel('You do not have permission for this action.', 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'),
    };
    if (map[title]) return map[title];
    if (detail && detail.indexOf(' / ') !== -1) return detail.split(' / ')[0].trim();
    return detail || title || window.GfpI18n.tLabel('Request failed (' + status + ')', 'فشل الطلب (' + status + ')');
  }

  async function api(method, path, body, opts) {
    const headers = getH(opts && opts.headers);
    if (opts && opts.acceptHtml) delete headers['Content-Type'];
    const fetchOpts = { method, headers };
    if (body !== undefined) fetchOpts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(API_BASE + path, fetchOpts);
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: {
          message: window.GfpI18n.tLabel(
            'Network error talking to API (' + (API_BASE || '') + '). ' + (err && err.message ? err.message : 'Failed to fetch'),
            'خطأ في الاتصال بالخادم (' + (API_BASE || '') + '). ' + (err && err.message ? err.message : 'فشل الاتصال'),
          ),
        },
        text: null,
      };
    }
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null, text: null };
    }
    if (opts && opts.acceptHtml) {
      const text = await res.text();
      return { ok: res.ok, status: res.status, data: null, text };
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(() => null);
    else if (!res.ok) {
      const text = await res.text().catch(() => '');
      data = { message: text ? text.slice(0, 180) : window.GfpI18n.tLabel('Request failed (' + res.status + ')', 'فشل الطلب (' + res.status + ')') };
    }
    return { ok: res.ok, status: res.status, data, text: null };
  }

  function syncTabUi() {
    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === activeTab);
    });
    const meta = TABS[activeTab];
    document.getElementById('listTitle').textContent = meta.title;
    const isBuy = meta.kind === 'buy';
    document.getElementById('sellFilters').style.display = isBuy ? 'none' : '';
    document.getElementById('buyFilters').style.display = isBuy ? '' : 'none';
    document.getElementById('theadSell').style.display = isBuy ? 'none' : '';
    document.getElementById('theadBuy').style.display = isBuy ? '' : 'none';
    const url = new URL(location.href);
    url.searchParams.set('tab', activeTab);
    if (pendingGrnId && activeTab === 'buy') url.searchParams.set('grnId', pendingGrnId);
    else url.searchParams.delete('grnId');
    history.replaceState(null, '', url.pathname + url.search);
  }

  function pdfCell(inv) {
    if (inv.pdfUrl) {
      return (
        '<span class="pdf-ready"><a href="' +
        esc(inv.pdfUrl) +
        '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' +
        window.GfpI18n.tLabel('Open PDF', 'فتح PDF') +
        '</a></span>'
      );
    }
    return (
      '<span class="pdf-pending" title="' +
      esc(window.GfpI18n.tLabel('PDF still generating', 'جاري إنشاء PDF')) +
      '">' +
      window.GfpI18n.tLabel('Not ready yet', 'غير جاهز بعد') +
      '</span>'
    );
  }

  function renderPager(totalPages, totalCount, onPage) {
    const pageInfo = window.GfpI18n.tLabel(
      'Page ' + page + ' / ' + Math.max(1, totalPages || 1) + ' · ' + String(totalCount || 0) + ' total',
      'صفحة ' + page + ' / ' + Math.max(1, totalPages || 1) + ' · ' + String(totalCount || 0) + ' إجمالي',
    );
    const mk =
      '<button type="button" class="btn secondary js-prev"' +
      (page <= 1 ? ' disabled' : '') +
      '>' +
      window.GfpI18n.tLabel('Prev', 'السابق') +
      '</button>' +
      '<span>' +
      esc(pageInfo) +
      '</span>' +
      '<button type="button" class="btn secondary js-next"' +
      (page >= (totalPages || 1) ? ' disabled' : '') +
      '>' +
      window.GfpI18n.tLabel('Next', 'التالي') +
      '</button>';
    ['pagerTop', 'pagerBottom'].forEach((id) => {
      const el = document.getElementById(id);
      el.innerHTML = mk;
      const prev = el.querySelector('.js-prev');
      const next = el.querySelector('.js-next');
      if (prev)
        prev.onclick = () => {
          if (page > 1) {
            page -= 1;
            onPage();
          }
        };
      if (next)
        next.onclick = () => {
          if (page < (totalPages || 1)) {
            page += 1;
            onPage();
          }
        };
    });
  }

  function renderSellRows(items) {
    const tbody = document.getElementById('tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">' + window.GfpI18n.tLabel('No invoices', 'لا توجد فواتير') + '</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map((inv) => {
        const sel =
          selectedKind === 'sell' && selectedId && String(inv.id) === String(selectedId)
            ? ' sel'
            : '';
        return (
          '<tr class="' +
          sel +
          '" data-kind="sell" data-id="' +
          esc(inv.id) +
          '">' +
          '<td><code>' +
          esc(inv.invoiceNumber) +
          '</code></td>' +
          '<td>' +
          esc(friendlyType(inv.type)) +
          '</td>' +
          '<td>' +
          esc(inv.memberNameSnapshot || '—') +
          '<div class="muted">' +
          esc(inv.memberPhoneSnapshot || '') +
          '</div></td>' +
          '<td>' +
          esc(dt(inv.issuedAt)) +
          '</td>' +
          '<td>' +
          esc(money(inv.total, inv.currency)) +
          (inv.type === 'credit_note' ? ' <span class="muted">CN</span>' : '') +
          '</td>' +
          '<td><span class="st ' +
          esc(inv.status) +
          '">' +
          esc(friendlyStatus(inv.status)) +
          '</span></td>' +
          '<td>' +
          pdfCell(inv) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    bindRowClicks();
  }

  function renderBuyRows(items) {
    buyRows = items || [];
    const tbody = document.getElementById('tbody');
    if (!buyRows.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="muted">' + window.GfpI18n.tLabel('No purchases yet', 'لا توجد مشتريات بعد') + '</td></tr>';
      return;
    }
    tbody.innerHTML = buyRows
      .map((row) => {
        const sel =
          selectedKind === 'buy' && selectedId && String(row.id) === String(selectedId)
            ? ' sel'
            : '';
        return (
          '<tr class="' +
          sel +
          '" data-kind="buy" data-id="' +
          esc(row.id) +
          '">' +
          '<td>' +
          esc(dt(row.receivedAtUtc)) +
          '</td>' +
          '<td>' +
          esc(row.supplierName || '—') +
          '</td>' +
          '<td>' +
          esc(money(row.totalAmount)) +
          '</td>' +
          '<td><span class="st received">' + window.GfpI18n.tLabel('Received', 'مستلمة') + '</span></td>' +
          '</tr>'
        );
      })
      .join('');
    bindRowClicks();
  }

  function bindRowClicks() {
    document.querySelectorAll('#tbody tr[data-id]').forEach((tr) => {
      tr.onclick = () => {
        const kind = tr.getAttribute('data-kind');
        const id = tr.getAttribute('data-id');
        if (kind === 'buy') selectBuy(id);
        else selectInvoice(id);
      };
    });
  }

  async function loadSellList(lineType) {
    if (!canViewSell) {
      document.getElementById('tbody').innerHTML =
        '<tr><td colspan="7" class="muted">' +
        window.GfpI18n.tLabel('Need reports.financial.view', 'يتطلب صلاحية reports.financial.view') +
        '</td></tr>';
      renderPager(1, 0, loadList);
      return;
    }
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('pageSize', String(PAGE_SIZE));
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const memberId = document.getElementById('fMemberId').value.trim();
    const status = document.getElementById('fStatus').value;
    const type = document.getElementById('fType').value;
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (memberId) q.set('memberId', memberId);
    if (status) q.set('status', status);
    if (type) q.set('type', type);
    if (lineType) q.set('lineType', lineType);

    const res = await api('GET', '/invoices?' + q.toString());
    const tbody = document.getElementById('tbody');
    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="muted">' + esc(problemMessage(res.data, res.status)) + '</td></tr>';
      renderPager(1, 0, loadList);
      return;
    }
    const data = res.data || {};
    const items = Array.isArray(data) ? data : data.items || [];
    const totalPages = data.totalPages != null ? data.totalPages : 1;
    const totalCount = data.totalCount != null ? data.totalCount : items.length;
    renderPager(totalPages, totalCount, loadList);
    renderSellRows(items);
  }

  async function loadBuyList() {
    await ensureBuyLookups();
    if (!canViewBuy) {
      document.getElementById('tbody').innerHTML =
        '<tr><td colspan="4" class="muted">' +
        window.GfpI18n.tLabel('Need inventory.view', 'يتطلب صلاحية inventory.view') +
        '</td></tr>';
      renderPager(1, 0, loadList);
      return;
    }
    const q = new URLSearchParams();
    const from = document.getElementById('fBuyFrom').value;
    const to = document.getElementById('fBuyTo').value;
    const supplierId = document.getElementById('fSupplierId').value.trim();
    if (from) q.set('fromUtc', new Date(from + 'T00:00:00').toISOString());
    if (to) q.set('toUtc', new Date(to + 'T23:59:59').toISOString());
    if (supplierId) q.set('supplierId', supplierId);

    const res = await api('GET', '/inventory/goods-receipts' + (q.toString() ? '?' + q : ''));
    if (!res.ok) {
      document.getElementById('tbody').innerHTML =
        '<tr><td colspan="4" class="muted">' + esc(problemMessage(res.data, res.status)) + '</td></tr>';
      renderPager(1, 0, loadList);
      return;
    }
    const items = Array.isArray(res.data) ? res.data : (res.data && res.data.items) || [];
    renderPager(1, items.length, loadList);
    renderBuyRows(items);

    if (pendingGrnId) {
      const id = pendingGrnId;
      pendingGrnId = null;
      await selectBuy(id);
    }
  }

  async function loadAllList() {
    // Sell page + Buy capped list merged client-side for the hub overview.
    page = 1;
    document.getElementById('theadSell').style.display = '';
    document.getElementById('theadBuy').style.display = 'none';
    document.getElementById('sellFilters').style.display = '';
    document.getElementById('buyFilters').style.display = 'none';

    const sellPromise = canViewSell
      ? api('GET', '/invoices?page=1&pageSize=50')
      : Promise.resolve({ ok: true, data: { items: [] } });
    const buyPromise = canViewBuy
      ? api('GET', '/inventory/goods-receipts')
      : Promise.resolve({ ok: true, data: [] });

    const [sellRes, buyRes] = await Promise.all([sellPromise, buyPromise]);
    const sellItems = sellRes.ok
      ? Array.isArray(sellRes.data)
        ? sellRes.data
        : (sellRes.data && sellRes.data.items) || []
      : [];
    const buyItems = buyRes.ok
      ? Array.isArray(buyRes.data)
        ? buyRes.data
        : (buyRes.data && buyRes.data.items) || []
      : [];

    const merged = [];
    sellItems.forEach((inv) => {
      merged.push({
        sortAt: inv.issuedAt,
        kind: 'sell',
        id: inv.id,
        html:
          '<tr data-kind="sell" data-id="' +
          esc(inv.id) +
          '"><td><code>' +
          esc(inv.invoiceNumber) +
          '</code></td><td>' +
          esc(friendlyType(inv.type)) +
          '</td><td>' +
          esc(inv.memberNameSnapshot || '—') +
          '</td><td>' +
          esc(dt(inv.issuedAt)) +
          '</td><td>' +
          esc(money(inv.total, inv.currency)) +
          '</td><td><span class="st ' +
          esc(inv.status) +
          '">' +
          esc(friendlyStatus(inv.status)) +
          '</span></td><td>' +
          pdfCell(inv) +
          '</td></tr>',
      });
    });
    buyItems.forEach((row) => {
      const purchaseLabel = esc(window.GfpI18n.tLabel('Purchase', 'مشترى'));
      merged.push({
        sortAt: row.receivedAtUtc,
        kind: 'buy',
        id: row.id,
        html:
          '<tr data-kind="buy" data-id="' +
          esc(row.id) +
          '"><td>' +
          purchaseLabel +
          '</td><td>' +
          purchaseLabel +
          '</td><td>' +
          esc(row.supplierName || '—') +
          '</td><td>' +
          esc(dt(row.receivedAtUtc)) +
          '</td><td>' +
          esc(money(row.totalAmount)) +
          '</td><td><span class="st received">' +
          window.GfpI18n.tLabel('Received', 'مستلمة') +
          '</span></td><td>—</td></tr>',
      });
    });
    merged.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));
    buyRows = buyItems;
    const tbody = document.getElementById('tbody');
    if (!merged.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">' + window.GfpI18n.tLabel('No documents', 'لا توجد مستندات') + '</td></tr>';
    } else {
      tbody.innerHTML = merged.map((m) => m.html).join('');
      bindRowClicks();
    }
    renderPager(1, merged.length, loadList);
  }

  async function loadList() {
    syncTabUi();
    const meta = TABS[activeTab];
    if (meta.kind === 'buy') return loadBuyList();
    if (meta.kind === 'all') return loadAllList();
    return loadSellList(meta.lineType);
  }

  async function selectInvoice(id) {
    selectedId = id;
    selectedKind = 'sell';
    document.querySelectorAll('#tbody tr').forEach((tr) => {
      tr.classList.toggle('sel', tr.getAttribute('data-id') === id && tr.getAttribute('data-kind') === 'sell');
    });
    const res = await api('GET', '/invoices/' + id);
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    selectedInvoice = res.data;
    await ensureBuyLookups();
    renderDetail(res.data);
  }

  async function selectBuy(id) {
    selectedId = id;
    selectedKind = 'buy';
    await ensureBuyLookups();
    document.querySelectorAll('#tbody tr').forEach((tr) => {
      tr.classList.toggle('sel', tr.getAttribute('data-id') === id && tr.getAttribute('data-kind') === 'buy');
    });
    const cached = buyRows.find((r) => String(r.id) === String(id));
    const res = await api('GET', '/inventory/goods-receipts/' + id);
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    renderBuyDetail(Object.assign({}, cached || {}, res.data));
  }

  function renderBuyDetail(doc) {
    const body = document.getElementById('detailBody');
    const lines = Array.isArray(doc.lines) ? doc.lines : [];
    const linesHtml = lines.length
      ? '<table class="lines-tbl"><thead><tr><th>' +
        window.GfpI18n.tLabel('Product', 'المنتج') +
        '</th><th>' +
        window.GfpI18n.tLabel('Qty', 'الكمية') +
        '</th><th>' +
        window.GfpI18n.tLabel('Cost each', 'تكلفة الوحدة') +
        '</th><th>' +
        window.GfpI18n.tLabel('Line', 'السطر') +
        '</th></tr></thead><tbody>' +
        lines
          .map((ln) => {
            const lineTotal =
              ln.unitCost != null && ln.qty != null ? Number(ln.qty) * Number(ln.unitCost) : null;
            return (
              '<tr><td>' +
              productCellHtml(ln.productId, ln.productName) +
              '</td><td>' +
              esc(String(ln.qty)) +
              '</td><td>' +
              esc(money(ln.unitCost)) +
              '</td><td>' +
              esc(money(lineTotal)) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '<p class="muted">' + window.GfpI18n.tLabel('No items on this purchase', 'لا توجد أصناف في هذا المشترى') + '</p>';

    body.innerHTML =
      '<div class="detail-hero">' +
      '<div class="who">' +
      esc(doc.supplierName || window.GfpI18n.tLabel('Supplier', 'المورد')) +
      '</div>' +
      '<div class="when">' +
      esc(dt(doc.receivedAtUtc)) +
      '</div>' +
      '<div class="amt">' +
      esc(money(doc.totalAmount)) +
      '</div>' +
      '</div>' +
      '<div class="detail-meta">' +
      '<div class="row"><span>' +
      window.GfpI18n.tLabel('Status', 'الحالة') +
      '</span><span class="st received">' +
      window.GfpI18n.tLabel('Received', 'مستلمة') +
      '</span></div>' +
      '</div>' +
      '<h3 style="font-family:var(--fd);font-size:14px;margin-bottom:6px">' +
      window.GfpI18n.tLabel('Items', 'الأصناف') +
      '</h3>' +
      linesHtml +
      '<div class="actions">' +
      (doc.purchaseOrderId
        ? '<a class="btn secondary" href="/dashboard/inventory/purchase-orders/?id=' +
          esc(doc.purchaseOrderId) +
          '">' + window.GfpI18n.tLabel('Open purchase', 'فتح أمر الشراء') + '</a>'
        : '') +
      (doc.supplierId
        ? '<a class="btn secondary" href="/dashboard/inventory/suppliers/?id=' +
          esc(doc.supplierId) +
          '">' + window.GfpI18n.tLabel('Supplier account', 'حساب المورد') + '</a>'
        : '') +
      '</div>';
    openDetailDrawer(window.GfpI18n.tLabel('Purchase', 'مشترى'));
  }

  function renderDetail(inv) {
    const body = document.getElementById('detailBody');

    const lines = Array.isArray(inv.lines) ? inv.lines : [];
    const linesHtml = lines.length
      ? '<table class="lines-tbl"><thead><tr><th>' +
        window.GfpI18n.tLabel('Description', 'الوصف') +
        '</th><th>' +
        window.GfpI18n.tLabel('Qty', 'الكمية') +
        '</th><th>' +
        window.GfpI18n.tLabel('Unit', 'الوحدة') +
        '</th><th>' +
        window.GfpI18n.tLabel('Line', 'السطر') +
        '</th></tr></thead><tbody>' +
        lines
          .map(
            (ln) =>
              '<tr><td>' +
              productCellFromSellLine(ln) +
              (ln.descriptionAr
                ? '<div class="muted" dir="rtl">' + esc(ln.descriptionAr) + '</div>'
                : '') +
              '</td><td>' +
              esc(String(ln.qty != null ? ln.qty : 1)) +
              '</td><td>' +
              esc(money(ln.unitPrice, inv.currency)) +
              '</td><td>' +
              esc(money(ln.lineTotal, inv.currency)) +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table>'
      : '<p class="muted">' + window.GfpI18n.tLabel('No items', 'لا توجد أصناف') + '</p>';

    const pdfBlock = inv.pdfUrl
      ? '<a class="btn secondary" href="' +
        esc(inv.pdfUrl) +
        '" target="_blank" rel="noopener"><i class="ti ti-file-type-pdf"></i> ' +
        window.GfpI18n.tLabel('PDF', 'PDF') +
        '</a>'
      : '<span class="pdf-pending">' + window.GfpI18n.tLabel('PDF not ready yet', 'ملف PDF غير جاهز بعد') + '</span>';

    const actions = [];
    if (canReceipt && inv.status === 'issued') {
      actions.push(
        '<button type="button" class="btn primary" id="btnPrintA4"><i class="ti ti-printer"></i> ' +
          window.GfpI18n.tLabel('Print invoice', 'طباعة الفاتورة') +
          '</button>',
        '<button type="button" class="btn secondary" id="btnReceipt"><i class="ti ti-receipt"></i> ' +
          window.GfpI18n.tLabel('80mm receipt', 'إيصال 80مم') +
          '</button>',
      );
    }
    if (canResend && inv.status === 'issued') {
      actions.push(
        '<button type="button" class="btn secondary" id="btnResend"><i class="ti ti-send"></i> ' +
          window.GfpI18n.tLabel('Resend', 'إعادة إرسال') +
          '</button>',
      );
    }
    if (canVoid && inv.status === 'issued') {
      actions.push(
        '<button type="button" class="btn danger" id="btnVoid"><i class="ti ti-ban"></i> ' +
          window.GfpI18n.tLabel('Void', 'إلغاء') +
          '</button>',
      );
    }
    if (
      inv.saleId &&
      inv.type !== 'credit_note' &&
      inv.status === 'issued' &&
      refundsFeatureOn() &&
      (window.GfpRefundAction ? window.GfpRefundAction.canRequest() : canRefundRequest)
    ) {
      actions.push(
        '<button type="button" class="btn primary" id="btnRefundSale"><i class="ti ti-receipt-refund"></i> ' +
          window.GfpI18n.tLabel('Refund', 'استرداد') +
          '</button>',
      );
    }

    const vatRateStr = String(inv.vatRate != null ? inv.vatRate : '');
    body.innerHTML =
      '<div class="detail-hero">' +
      '<div class="who">' +
      esc(inv.memberNameSnapshot || inv.invoiceNumber || window.GfpI18n.tLabel('Invoice', 'فاتورة')) +
      '</div>' +
      '<div class="when">' +
      esc(inv.invoiceNumber) +
      ' · ' +
      esc(dt(inv.issuedAt)) +
      '</div>' +
      '<div class="amt">' +
      displayTotal(inv) +
      '</div>' +
      '</div>' +
      '<div class="detail-meta">' +
      '<div class="row"><span>' +
      window.GfpI18n.tLabel('Type', 'النوع') +
      '</span><span>' +
      esc(friendlyType(inv.type)) +
      '</span></div>' +
      '<div class="row"><span>' +
      window.GfpI18n.tLabel('Status', 'الحالة') +
      '</span><span class="st ' +
      esc(inv.status) +
      '">' +
      esc(friendlyStatus(inv.status)) +
      '</span></div>' +
      (inv.memberPhoneSnapshot
        ? '<div class="row"><span>' + window.GfpI18n.tLabel('Phone', 'الهاتف') + '</span><span>' + esc(inv.memberPhoneSnapshot) + '</span></div>'
        : '') +
      (inv.voidReason
        ? '<div class="row"><span>' + window.GfpI18n.tLabel('Void reason', 'سبب الإلغاء') + '</span><span>' + esc(inv.voidReason) + '</span></div>'
        : '') +
      '</div>' +
      '<h3 style="font-family:var(--fd);font-size:14px;margin-bottom:6px">' +
      window.GfpI18n.tLabel('Items', 'الأصناف') +
      '</h3>' +
      linesHtml +
      '<div class="totals">' +
      '<div>' +
      esc(window.GfpI18n.tLabel(
        'Subtotal: ' + money(inv.subtotal, inv.currency),
        'الإجمالي الفرعي: ' + money(inv.subtotal, inv.currency),
      )) +
      '</div>' +
      '<div>' +
      esc(window.GfpI18n.tLabel(
        'Discount: ' + money(inv.discountAmount, inv.currency),
        'الخصم: ' + money(inv.discountAmount, inv.currency),
      )) +
      '</div>' +
      '<div>' +
      esc(window.GfpI18n.tLabel(
        'VAT (' + vatRateStr + '%): ' + money(inv.vatAmount, inv.currency),
        'ضريبة القيمة المضافة (' + vatRateStr + '%): ' + money(inv.vatAmount, inv.currency),
      )) +
      '</div>' +
      '<div class="grand">' +
      window.GfpI18n.tLabel('Total: ', 'الإجمالي: ') +
      displayTotal(inv) +
      '</div>' +
      '</div>' +
      '<div class="actions">' +
      pdfBlock +
      actions.join('') +
      '</div>';

    openDetailDrawer(inv.type === 'credit_note' ? window.GfpI18n.tLabel('Credit note', 'إشعار دائن') : window.GfpI18n.tLabel('Invoice', 'فاتورة'));

    const btnReceipt = document.getElementById('btnReceipt');
    if (btnReceipt) btnReceipt.onclick = () => openReceiptModal(inv.id, 'thermal');
    const btnPrintA4 = document.getElementById('btnPrintA4');
    if (btnPrintA4) btnPrintA4.onclick = () => openReceiptModal(inv.id, 'a4');
    const btnResend = document.getElementById('btnResend');
    if (btnResend) btnResend.onclick = () => resendInvoice(inv.id);
    const btnVoid = document.getElementById('btnVoid');
    if (btnVoid) {
      btnVoid.onclick = () => {
        voidTargetId = inv.id;
        document.getElementById('voidReason').value = '';
        document.getElementById('voidModal').classList.add('show');
      };
    }
    const btnRefund = document.getElementById('btnRefundSale');
    if (btnRefund) {
      btnRefund.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        openSaleRefund(inv);
      };
    }
  }

  function openSaleRefund(inv) {
    if (!inv || !inv.saleId) {
      toast(window.GfpI18n.tLabel('This invoice is not linked to a sale.', 'هذه الفاتورة غير مرتبطة بعملية بيع.'), 'err');
      return;
    }
    if (!window.GfpRefundAction || typeof window.GfpRefundAction.open !== 'function') {
      toast(window.GfpI18n.tLabel('Refund is still loading. Refresh the page.', 'ميزة الاسترداد لا تزال قيد التحميل. أعد تحميل الصفحة.'), 'err');
      return;
    }
    window.GfpRefundAction.open({
      saleId: inv.saleId,
      saleTotal: inv.total,
      memberName: inv.memberNameSnapshot || '',
      invoiceNumber: inv.invoiceNumber || '',
      lines: Array.isArray(inv.lines) ? inv.lines : [],
    });
  }

  async function resendInvoice(id) {
    const res = await api('POST', '/invoices/' + id + '/resend');
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    toast(window.GfpI18n.tLabel('Invoice resend queued.', 'تم جدولة إعادة إرسال الفاتورة.'), 'ok');
  }

  document.getElementById('btnVoidCancel').onclick = () => {
    document.getElementById('voidModal').classList.remove('show');
    voidTargetId = null;
  };
  document.getElementById('btnVoidConfirm').onclick = async () => {
    const reason = document.getElementById('voidReason').value.trim();
    if (!reason || !voidTargetId) {
      toast(window.GfpI18n.tLabel('Void reason required.', 'سبب الإلغاء مطلوب.'), 'err');
      return;
    }
    const res = await api('POST', '/invoices/' + voidTargetId + '/void', { reason });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    document.getElementById('voidModal').classList.remove('show');
    toast(window.GfpI18n.tLabel('Invoice voided.', 'تم إلغاء الفاتورة.'), 'ok');
    const id = voidTargetId;
    voidTargetId = null;
    await loadList();
    await selectInvoice(id);
  };

  async function openReceiptModal(id, format) {
    receiptInvoiceId = id;
    receiptFormat = format === 'a4' ? 'a4' : 'thermal';
    var isA4 = receiptFormat === 'a4';
    var box = document.getElementById('printBox');
    if (box) box.classList.toggle('is-a4', isA4);
    document.getElementById('printModalTitle').textContent = isA4
      ? window.GfpI18n.tLabel('Print invoice', 'طباعة الفاتورة')
      : window.GfpI18n.tLabel('80mm receipt', 'إيصال 80مم');
    document.getElementById('printModalHint').textContent = isA4
      ? window.GfpI18n.tLabel('A4 invoice with this gym’s name, logo, and brand color.', 'فاتورة A4 باسم النادي وشعاره ولونه المميز.')
      : window.GfpI18n.tLabel('Compact receipt for the 80mm printer. Same invoice number and totals.', 'إيصال مختصر لطابعة الـ80مم. بنفس رقم الفاتورة والإجماليات.');
    document.getElementById('receiptPaymentId').value = '';
    document.getElementById('receiptFrame').srcdoc =
      '<p style="padding:16px;font-family:sans-serif;color:#666">' +
      window.GfpI18n.tLabel('Loading…', 'جاري التحميل…') +
      '</p>';
    document.getElementById('printModal').classList.add('show');
    await loadReceiptHtml();
  }

  async function loadReceiptHtml() {
    if (!receiptInvoiceId) return;
    const paymentId = document.getElementById('receiptPaymentId').value.trim();
    let path = '/invoices/' + receiptInvoiceId + '/receipt-html?format=' + encodeURIComponent(receiptFormat);
    if (paymentId) path += '&paymentId=' + encodeURIComponent(paymentId);
    const res = await api('GET', path, undefined, { acceptHtml: true });
    if (!res.ok) {
      let msg = window.GfpI18n.tLabel('Failed to load invoice (' + res.status + ')', 'فشل تحميل الفاتورة (' + res.status + ')');
      try {
        const parsed = JSON.parse(res.text || '{}');
        msg = problemMessage(parsed, res.status);
      } catch (_) {}
      toast(msg, 'err');
      return;
    }
    document.getElementById('receiptFrame').srcdoc = res.text || '';
  }

  document.getElementById('btnPrintCancel').onclick = () => {
    document.getElementById('printModal').classList.remove('show');
    receiptInvoiceId = null;
  };

  document.getElementById('btnPrintReceipt').onclick = () => {
    const frame = document.getElementById('receiptFrame');
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      toast(window.GfpI18n.tLabel('Print failed — wait for the invoice to load.', 'فشلت الطباعة — انتظر تحميل الفاتورة.'), 'err');
    }
  };

  document.getElementById('btnFilter').onclick = () => {
    page = 1;
    loadList();
  };
  document.getElementById('btnBuyFilter').onclick = () => {
    page = 1;
    loadList();
  };

  const btnCloseDetail = document.getElementById('btnCloseDetail');
  if (btnCloseDetail) btnCloseDetail.onclick = closeDetailDrawer;
  const detailDrawer = document.getElementById('detailDrawer');
  if (detailDrawer) {
    detailDrawer.addEventListener('click', (e) => {
      if (e.target === detailDrawer) closeDetailDrawer();
    });
  }
  const detailBody = document.getElementById('detailBody');
  if (detailBody) {
    detailBody.addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('#btnRefundSale') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      openSaleRefund(selectedInvoice);
    });
  }

  document.querySelectorAll('.hub-tab').forEach((btn) => {
    btn.onclick = () => {
      activeTab = btn.getAttribute('data-tab');
      page = 1;
      selectedId = null;
      selectedKind = null;
      closeDetailDrawer();
      loadList().catch((err) => {
        document.getElementById('tbody').innerHTML =
          '<tr><td colspan="7" class="muted">' +
          esc(err && err.message ? err.message : window.GfpI18n.tLabel('Failed to load', 'فشل التحميل')) +
          '</td></tr>';
      });
    };
  });

  loadList()
    .then(async () => {
      if (pendingInvoiceId) {
        const id = pendingInvoiceId;
        pendingInvoiceId = null;
        await selectInvoice(id);
      }
    })
    .catch((err) => {
    document.getElementById('tbody').innerHTML =
      '<tr><td colspan="7" class="muted">' +
      esc(err && err.message ? err.message : window.GfpI18n.tLabel('Failed to load', 'فشل التحميل')) +
      '</td></tr>';
  });
})();
