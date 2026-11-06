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
  let lastSellItems = [];
  let lastMerged = [];
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
      var v = Number(n); var s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)); return '⁨' + (v < 0 ? '-' + cur + ' ' : cur + ' ') + s + '⁩';
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
    lastSellItems = items || [];
    const tbody = document.getElementById('tbody');
    const query = invSearchQuery();
    const rows = query
      ? lastSellItems.filter((inv) =>
          [inv.invoiceNumber, inv.memberNameSnapshot, inv.memberPhoneSnapshot].some(
            (v) => String(v || '').toLowerCase().indexOf(query) >= 0,
          ),
        )
      : lastSellItems;
    setInvCount(lastSellItems.length, rows.length, query);
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="muted">' +
        esc(query
          ? window.GfpI18n.tLabel('No invoices match the search.', 'لا توجد فواتير مطابقة للبحث.')
          : window.GfpI18n.tLabel('No invoices', 'لا توجد فواتير')) +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((inv, index) => {
        const sel =
          selectedKind === 'sell' && selectedId && String(inv.id) === String(selectedId)
            ? ' sel'
            : '';
        const voided = String(inv.status || '').toLowerCase() === 'voided';
        const when = String(dt(inv.issuedAt)).split(', ');
        return (
          '<tr class="' +
          sel +
          (voided ? ' voided' : '') +
          '" data-kind="sell" data-id="' +
          esc(inv.id) +
          '">' +
          '<td class="c inv-idx" data-col="#">' +
          (index + 1) +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Number', 'الرقم')) + '"><span class="inv-no">' +
          esc(inv.invoiceNumber || '—') +
          '</span></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Type', 'النوع')) + '"><span class="tp ' +
          esc(inv.type || 'invoice') +
          '">' +
          esc(friendlyType(inv.type)) +
          '</span></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Client', 'العميل')) + '"><div class="inv-client"><b>' +
          esc(inv.memberNameSnapshot || '—') +
          '</b>' +
          (inv.memberPhoneSnapshot ? '<small dir="ltr">' + esc(inv.memberPhoneSnapshot) + '</small>' : '') +
          '</div></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Issued', 'التاريخ')) + '"><div class="inv-when"><b>' +
          esc(when[0] || '—') +
          '</b>' +
          (when[1] ? '<small>' + esc(when[1]) + '</small>' : '') +
          '</div></td>' +
          '<td class="amt" data-col="' + esc(window.GfpI18n.tLabel('Total', 'الإجمالي')) + '">' +
          esc(money(inv.total, inv.currency)) +
          (inv.type === 'credit_note' ? ' <span class="muted">CN</span>' : '') +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Status', 'الحالة')) + '"><span class="st ' +
          esc(inv.status) +
          '"><i class="dot"></i>' +
          esc(friendlyStatus(inv.status)) +
          '</span></td>' +
          '<td class="c" data-col="' + esc(window.GfpI18n.tLabel('Actions', 'إجراءات')) + '"><span class="row-actions">' +
          invoiceRowActions(inv) +
          '</span></td>' +
          '</tr>'
        );
      })
      .join('');
    bindRowClicks();
  }

  function invoiceRowActions(inv) {
    const acts = [];
    acts.push(
      '<button type="button" class="inv-act" data-act="view" data-id="' +
        esc(inv.id) +
        '" title="' +
        esc(window.GfpI18n.tLabel('View', 'عرض')) +
        '"><i class="ti ti-eye"></i></button>',
    );
    if (inv.pdfUrl) {
      acts.push(
        '<button type="button" class="inv-act" data-act="pdf" data-id="' +
          esc(inv.id) +
          '" title="' +
          esc(window.GfpI18n.tLabel('PDF', 'PDF')) +
          '"><i class="ti ti-file-type-pdf"></i></button>',
      );
    }
    if (canReceipt && String(inv.status || '').toLowerCase() === 'issued') {
      acts.push(
        '<button type="button" class="inv-act" data-act="print" data-id="' +
          esc(inv.id) +
          '" title="' +
          esc(window.GfpI18n.tLabel('Print invoice', 'طباعة الفاتورة')) +
          '"><i class="ti ti-printer"></i></button>',
      );
    }
    return acts.join('') || '—';
  }

  async function openInvoicePdf(inv) {
    if (!inv || !inv.pdfUrl) {
      toast(window.GfpI18n.tLabel('PDF not ready yet', 'ملف PDF غير جاهز بعد'), 'err');
      return;
    }
    try {
      const res = await fetch(inv.pdfUrl, { headers: getH() });
      if (!res.ok) {
        toast(
          window.GfpI18n.tLabel('PDF file not found — it may still be rendering.', 'ملف الـ PDF مش موجود — يمكن لسه بيتولّد.'),
          'err',
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast(window.GfpI18n.tLabel('Failed to open the PDF.', 'تعذر فتح ملف الـ PDF.'), 'err');
    }
  }

  function renderBuyRows(items) {
    buyRows = items || [];
    const tbody = document.getElementById('tbody');
    const query = invSearchQuery();
    const rows = query
      ? buyRows.filter((row) =>
          [row.supplierName].some((v) => String(v || '').toLowerCase().indexOf(query) >= 0),
        )
      : buyRows;
    setInvCount(buyRows.length, rows.length, query);
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="muted">' +
        esc(query
          ? window.GfpI18n.tLabel('No purchases match the search.', 'لا توجد مشتريات مطابقة للبحث.')
          : window.GfpI18n.tLabel('No purchases yet', 'لا توجد مشتريات بعد')) +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((row, index) => {
        const sel =
          selectedKind === 'buy' && selectedId && String(row.id) === String(selectedId)
            ? ' sel'
            : '';
        const when = String(dt(row.receivedAtUtc)).split(', ');
        return (
          '<tr class="' +
          sel +
          '" data-kind="buy" data-id="' +
          esc(row.id) +
          '">' +
          '<td class="c inv-idx" data-col="#">' +
          (index + 1) +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Date', 'التاريخ')) + '"><div class="inv-when"><b>' +
          esc(when[0] || '—') +
          '</b>' +
          (when[1] ? '<small>' + esc(when[1]) + '</small>' : '') +
          '</div></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Supplier', 'المورد')) + '"><div class="inv-client"><b>' +
          esc(row.supplierName || '—') +
          '</b></div></td>' +
          '<td class="amt" data-col="' + esc(window.GfpI18n.tLabel('Total', 'الإجمالي')) + '">' +
          esc(money(row.totalAmount)) +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Status', 'الحالة')) + '"><span class="st received"><i class="dot"></i>' +
          esc(window.GfpI18n.tLabel('Received', 'مستلمة')) +
          '</span></td>' +
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
        '<tr><td colspan="8" class="muted">' +
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
        '<tr><td colspan="8" class="muted">' + esc(problemMessage(res.data, res.status)) + '</td></tr>';
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
        '<tr><td colspan="5" class="muted">' +
        window.GfpI18n.tLabel('Need inventory.view', 'يتطلب صلاحية inventory.view') +
        '</td></tr>';
      renderPager(1, 0, loadList);
      return;
    }
    const q = new URLSearchParams();
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const supplierId = document.getElementById('fSupplierId').value.trim();
    if (from) q.set('fromUtc', new Date(from + 'T00:00:00').toISOString());
    if (to) q.set('toUtc', new Date(to + 'T23:59:59').toISOString());
    if (supplierId) q.set('supplierId', supplierId);

    const res = await api('GET', '/inventory/goods-receipts' + (q.toString() ? '?' + q : ''));
    if (!res.ok) {
      document.getElementById('tbody').innerHTML =
        '<tr><td colspan="5" class="muted">' + esc(problemMessage(res.data, res.status)) + '</td></tr>';
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
      merged.push({ sortAt: inv.issuedAt, kind: 'sell', id: inv.id, inv: inv });
    });
    buyItems.forEach((row) => {
      merged.push({ sortAt: row.receivedAtUtc, kind: 'buy', id: row.id, buy: row });
    });
    merged.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));
    lastMerged = merged;
    buyRows = buyItems;
    renderAllRows();
    renderPager(1, merged.length, loadList);
  }

  function renderAllRows() {
    const tbody = document.getElementById('tbody');
    const query = invSearchQuery();
    const rows = query
      ? lastMerged.filter((m) => {
          const inv = m.inv || {};
          const buy = m.buy || {};
          return [
            inv.invoiceNumber,
            inv.memberNameSnapshot,
            inv.memberPhoneSnapshot,
            buy.supplierName,
          ].some((v) => String(v || '').toLowerCase().indexOf(query) >= 0);
        })
      : lastMerged;
    setInvCount(lastMerged.length, rows.length, query);
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="muted">' +
        esc(query
          ? window.GfpI18n.tLabel('No documents match the search.', 'لا توجد مستندات مطابقة للبحث.')
          : window.GfpI18n.tLabel('No documents', 'لا توجد مستندات')) +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((m, index) => {
        const sel =
          selectedKind === m.kind && selectedId && String(m.id) === String(selectedId) ? ' sel' : '';
        if (m.kind === 'buy') {
          const when = String(dt(m.buy.receivedAtUtc)).split(', ');
          return (
            '<tr class="' +
            sel +
            '" data-kind="buy" data-id="' +
            esc(m.id) +
            '">' +
            '<td class="c inv-idx" data-col="#">' +
            (index + 1) +
            '</td>' +
            '<td data-col="' + esc(window.GfpI18n.tLabel('Number', 'الرقم')) + '"><span class="muted">—</span></td>' +
            '<td data-col="' + esc(window.GfpI18n.tLabel('Type', 'النوع')) + '"><span class="tp purchase_doc">' +
            esc(window.GfpI18n.tLabel('Purchase', 'مشترى')) +
            '</span></td>' +
            '<td data-col="' + esc(window.GfpI18n.tLabel('Client', 'العميل')) + '"><div class="inv-client"><b>' +
            esc(m.buy.supplierName || '—') +
            '</b></div></td>' +
            '<td data-col="' + esc(window.GfpI18n.tLabel('Issued', 'التاريخ')) + '"><div class="inv-when"><b>' +
            esc(when[0] || '—') +
            '</b>' +
            (when[1] ? '<small>' + esc(when[1]) + '</small>' : '') +
            '</div></td>' +
            '<td class="amt" data-col="' + esc(window.GfpI18n.tLabel('Total', 'الإجمالي')) + '">' +
            esc(money(m.buy.totalAmount)) +
            '</td>' +
            '<td data-col="' + esc(window.GfpI18n.tLabel('Status', 'الحالة')) + '"><span class="st received"><i class="dot"></i>' +
            esc(window.GfpI18n.tLabel('Received', 'مستلمة')) +
            '</span></td>' +
            '<td class="c" data-col="' + esc(window.GfpI18n.tLabel('Actions', 'إجراءات')) + '"><span class="muted">—</span></td>' +
            '</tr>'
          );
        }
        const inv = m.inv || {};
        const voided = String(inv.status || '').toLowerCase() === 'voided';
        const when = String(dt(inv.issuedAt)).split(', ');
        return (
          '<tr class="' +
          sel +
          (voided ? ' voided' : '') +
          '" data-kind="sell" data-id="' +
          esc(m.id) +
          '">' +
          '<td class="c inv-idx" data-col="#">' +
          (index + 1) +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Number', 'الرقم')) + '"><span class="inv-no">' +
          esc(inv.invoiceNumber || '—') +
          '</span></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Type', 'النوع')) + '"><span class="tp ' +
          esc(inv.type || 'invoice') +
          '">' +
          esc(friendlyType(inv.type)) +
          '</span></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Client', 'العميل')) + '"><div class="inv-client"><b>' +
          esc(inv.memberNameSnapshot || '—') +
          '</b>' +
          (inv.memberPhoneSnapshot ? '<small dir="ltr">' + esc(inv.memberPhoneSnapshot) + '</small>' : '') +
          '</div></td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Issued', 'التاريخ')) + '"><div class="inv-when"><b>' +
          esc(when[0] || '—') +
          '</b>' +
          (when[1] ? '<small>' + esc(when[1]) + '</small>' : '') +
          '</div></td>' +
          '<td class="amt" data-col="' + esc(window.GfpI18n.tLabel('Total', 'الإجمالي')) + '">' +
          esc(money(inv.total, inv.currency)) +
          '</td>' +
          '<td data-col="' + esc(window.GfpI18n.tLabel('Status', 'الحالة')) + '"><span class="st ' +
          esc(inv.status) +
          '"><i class="dot"></i>' +
          esc(friendlyStatus(inv.status)) +
          '</span></td>' +
          '<td class="c" data-col="' + esc(window.GfpI18n.tLabel('Actions', 'إجراءات')) + '"><span class="row-actions">' +
          invoiceRowActions(inv) +
          '</span></td>' +
          '</tr>'
        );
      })
      .join('');
    bindRowClicks();
  }

  async function loadList() {
    syncTabUi();
    const meta = TABS[activeTab];
    if (meta.kind === 'buy') {
      await loadBuyList();
    } else if (meta.kind === 'all') {
      await loadAllList();
    } else {
      await loadSellList(meta.lineType);
    }
    renderInvKpis(meta.kind, null, buyRows);
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
      '<div class="inv-hero">' +
      '<div class="who-row">' +
      '<div class="inv-avatar"><i class="ti ti-building-store"></i></div>' +
      '<div class="who"><b>' +
      esc(doc.supplierName || window.GfpI18n.tLabel('Supplier', 'المورد')) +
      '</b><small>' +
      esc(dt(doc.receivedAtUtc)) +
      '</small></div>' +
      '<span class="st received"><i class="dot"></i>' +
      esc(window.GfpI18n.tLabel('Received', 'مستلمة')) +
      '</span>' +
      '</div>' +
      '<div class="amt">' +
      esc(money(doc.totalAmount)) +
      '</div>' +
      '</div>' +
      '<div class="inv-sec-title">' +
      esc(window.GfpI18n.tLabel('Items', 'الأصناف')) +
      '</div>' +
      linesHtml;

    const detailFooter = document.getElementById('detailFooter');
    if (detailFooter) {
      detailFooter.innerHTML =
        (doc.purchaseOrderId
          ? '<a class="btn secondary" href="/dashboard/inventory/purchase-orders/?id=' +
            esc(doc.purchaseOrderId) +
            '">' + window.GfpI18n.tLabel('Open purchase', 'فتح أمر الشراء') + '</a>'
          : '') +
        (doc.supplierId
          ? '<a class="btn secondary" href="/dashboard/inventory/suppliers/?id=' +
            esc(doc.supplierId) +
            '">' + window.GfpI18n.tLabel('Supplier account', 'حساب المورد') + '</a>'
          : '');
    }
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

    const footer = [];
    if (canVoid && inv.status === 'issued') {
      footer.push(
        '<button type="button" class="btn-danger-ghost" id="btnVoid"><i class="ti ti-ban"></i> ' +
          window.GfpI18n.tLabel('Void', 'إلغاء') +
          '</button>',
      );
    }
    if (canReceipt && inv.status === 'issued') {
      footer.push(
        '<button type="button" class="btn secondary" id="btnPrintA4"><i class="ti ti-printer"></i> ' +
          window.GfpI18n.tLabel('Print invoice', 'طباعة الفاتورة') +
          '</button>',
      );
    }
    if (inv.pdfUrl) {
      footer.push(
        '<button type="button" class="inv-primary-btn" id="btnPdf"><i class="ti ti-file-type-pdf"></i> ' +
          window.GfpI18n.tLabel('PDF', 'PDF') +
          '</button>',
      );
    } else {
      footer.push(
        '<span class="pdf-pending" style="margin-inline-start:auto;align-self:center">' +
          window.GfpI18n.tLabel('PDF not ready yet', 'ملف PDF غير جاهز بعد') +
          '</span>',
      );
    }

    const sub = [];
    if (canReceipt && inv.status === 'issued') {
      sub.push(
        '<button type="button" class="btn ghost" id="btnReceipt"><i class="ti ti-receipt"></i> ' +
          window.GfpI18n.tLabel('80mm receipt', 'إيصال 80مم') +
          '</button>',
      );
    }
    if (canResend && inv.status === 'issued') {
      sub.push(
        '<button type="button" class="btn ghost" id="btnResend"><i class="ti ti-send"></i> ' +
          window.GfpI18n.tLabel('Resend', 'إعادة إرسال') +
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
      sub.push(
        '<button type="button" class="btn ghost" id="btnRefundSale"><i class="ti ti-receipt-refund"></i> ' +
          window.GfpI18n.tLabel('Refund', 'استرداد') +
          '</button>',
      );
    }

    const vatRateStr = String(inv.vatRate != null ? inv.vatRate : '');
    const heroInitials = String(
      inv.memberNameSnapshot || inv.invoiceNumber || window.GfpI18n.tLabel('Invoice', 'فاتورة'),
    )
      .trim()
      .slice(0, 2);
    body.innerHTML =
      '<div class="inv-hero">' +
      '<div class="who-row">' +
      '<div class="inv-avatar">' +
      esc(heroInitials) +
      '</div>' +
      '<div class="who"><b>' +
      esc(inv.memberNameSnapshot || window.GfpI18n.tLabel('Walk-in client', 'عميل نقدي')) +
      '</b></div>' +
      '<span class="st ' +
      esc(inv.status) +
      '"><i class="dot"></i>' +
      esc(friendlyStatus(inv.status)) +
      '</span>' +
      '</div>' +
      '<div class="amt">' +
      displayTotal(inv) +
      '</div>' +
      '</div>' +
      '<div class="inv-meta-grid">' +
      '<div class="m"><div class="k">' + esc(window.GfpI18n.tLabel('Number', 'الرقم')) + '</div><div class="v num">' + esc(inv.invoiceNumber || '—') + '</div></div>' +
      '<div class="m"><div class="k">' + esc(window.GfpI18n.tLabel('Type', 'النوع')) + '</div><div class="v">' + esc(friendlyType(inv.type)) + '</div></div>' +
      '<div class="m"><div class="k">' + esc(window.GfpI18n.tLabel('Issued', 'التاريخ')) + '</div><div class="v num">' + esc(dt(inv.issuedAt)) + '</div></div>' +
      '<div class="m"><div class="k">' + esc(window.GfpI18n.tLabel('Phone', 'الهاتف')) + '</div><div class="v num">' + esc(inv.memberPhoneSnapshot || '—') + '</div></div>' +
      (inv.voidReason
        ? '<div class="m" style="grid-column:1/-1"><div class="k">' + esc(window.GfpI18n.tLabel('Void reason', 'سبب الإلغاء')) + '</div><div class="v">' + esc(inv.voidReason) + '</div></div>'
        : '') +
      '</div>' +
      '<div class="inv-sec-title">' +
      esc(window.GfpI18n.tLabel('Items', 'الأصناف')) +
      '</div>' +
      linesHtml +
      '<div class="totals">' +
      '<div class="row"><span>' + esc(window.GfpI18n.tLabel('Subtotal', 'الإجمالي الفرعي')) + '</span><span>' + esc(money(inv.subtotal, inv.currency)) + '</span></div>' +
      '<div class="row"><span>' + esc(window.GfpI18n.tLabel('Discount', 'الخصم')) + '</span><span>' + esc(money(inv.discountAmount, inv.currency)) + '</span></div>' +
      '<div class="row"><span>' + esc(window.GfpI18n.tLabel('VAT (@r%)', 'الضريبة (@r%)').replace('@r', vatRateStr)) + '</span><span>' + esc(money(inv.vatAmount, inv.currency)) + '</span></div>' +
      '<div class="grand"><span>' + esc(window.GfpI18n.tLabel('Total', 'الإجمالي')) + '</span><span>' + displayTotal(inv) + '</span></div>' +
      '</div>' +
      (sub.length ? '<div class="inv-sub-row">' + sub.join('') + '</div>' : '');

    const detailFooter = document.getElementById('detailFooter');
    if (detailFooter) detailFooter.innerHTML = footer.join('');

    const btnPdf = document.getElementById('btnPdf');
    if (btnPdf) btnPdf.onclick = () => openInvoicePdf(inv);

    openDetailDrawer(inv.invoiceNumber || window.GfpI18n.tLabel('Invoice', 'فاتورة'));

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

  ['fFrom', 'fTo', 'fStatus', 'fType'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onchange = () => {
      page = 1;
      loadList();
    };
  });
  const btnFilter = document.getElementById('btnFilter');
  if (btnFilter) btnFilter.onclick = () => {
    page = 1;
    loadList();
  };
  const btnBuyFilter = document.getElementById('btnBuyFilter');
  if (btnBuyFilter) btnBuyFilter.onclick = () => {
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
          '<tr><td colspan="8" class="muted">' +
          esc(err && err.message ? err.message : window.GfpI18n.tLabel('Failed to load', 'فشل التحميل')) +
          '</td></tr>';
      });
    };
  });

  // ===== Workspace v2: quick search, KPI strip, chips, CSV export =====
  function invSearchQuery() {
    const el = document.getElementById('fSearch');
    return el ? String(el.value || '').trim().toLowerCase() : '';
  }
  function setInvCount(total, shown, query) {
    const chip = document.getElementById('invCountChip');
    if (chip) chip.textContent = String(total);
    const note = document.getElementById('invShownNote');
    if (note) {
      note.textContent = query
        ? window.GfpI18n.tLabel('Showing @shown of @total', 'عرض @shown من @total')
            .replace('@shown', String(shown))
            .replace('@total', String(total))
        : '';
    }
  }
  function kpiCard(icon, label, value, foot) {
    return (
      '<div class="inv-kpi">' +
      '<div class="k-top"><i class="ti ' +
      icon +
      '"></i><span>' +
      esc(label) +
      '</span></div>' +
      '<div class="k-val">' +
      value +
      '</div>' +
      (foot ? '<div class="k-foot">' + esc(foot) + '</div>' : '') +
      '</div>'
    );
  }
  async function renderInvKpis(kind, sellOverride, buyOverride) {
    const box = document.getElementById('invKpis');
    if (!box) return;
    try {
      if (kind === 'buy') {
        if (!canViewBuy) {
          box.hidden = true;
          return;
        }
        const rows = buyOverride || [];
        const total = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        const suppliers = new Set(
          rows.map((r) => String(r.supplierName || '').trim()).filter(Boolean),
        );
        box.hidden = false;
        box.innerHTML = [
          kpiCard('ti-building-store', window.GfpI18n.tLabel('Purchases total', 'إجمالي المشتريات'), esc(money(total)), ''),
          kpiCard('ti-package', window.GfpI18n.tLabel('Receipts', 'عدد الاستلامات'), String(rows.length), ''),
          kpiCard('ti-calculator', window.GfpI18n.tLabel('Average purchase', 'متوسط أمر الشراء'), esc(money(rows.length ? total / rows.length : 0)), ''),
          kpiCard('ti-users-group', window.GfpI18n.tLabel('Suppliers', 'عدد الموردين'), String(suppliers.size), ''),
        ].join('');
        return;
      }
      if (!canViewSell) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.innerHTML = '<div class="inv-kpi"></div>'.repeat(4);
      const q = new URLSearchParams();
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
      if (kind !== 'all') {
        const meta = TABS[activeTab];
        if (meta && meta.lineType) q.set('lineType', meta.lineType);
      }
      q.set('page', '1');
      q.set('pageSize', '500');
      const res = await api('GET', '/invoices?' + q.toString());
      if (!res.ok) {
        box.hidden = true;
        return;
      }
      const data = res.data || {};
      const items = Array.isArray(data) ? data : data.items || [];
      const issued = items.filter((i) => String(i.status || '').toLowerCase() === 'issued');
      const issuedInvoices = issued.filter((i) => i.type !== 'credit_note');
      const creditNotes = issued.filter((i) => i.type === 'credit_note');
      const voidedCount = items.length - issued.length;
      const issuedTotal = invoicesIssued(issuedInvoices);
      const cnTotal = creditNotes.reduce((s, i) => s + Number(i.total || 0), 0);
      const avg = issuedInvoices.length ? issuedTotal / issuedInvoices.length : 0;
      if (kind === 'all') {
        const buyRowsAll = buyOverride || [];
        const buyTotal = buyRowsAll.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        box.innerHTML = [
          kpiCard('ti-receipt', window.GfpI18n.tLabel('Issued invoices', 'إجمالي الفواتير الصادرة'), esc(money(issuedTotal)), ''),
          kpiCard('ti-building-store', window.GfpI18n.tLabel('Purchases', 'إجمالي المشتريات'), esc(money(buyTotal)), ''),
          kpiCard('ti-file-minus', window.GfpI18n.tLabel('Credit notes', 'إجمالي الإشعارات الدائنة'), esc(money(cnTotal)), String(creditNotes.length)),
          kpiCard('ti-list-details', window.GfpI18n.tLabel('Documents', 'عدد المستندات'), String(items.length + buyRowsAll.length), ''),
        ].join('');
        return;
      }
      box.innerHTML = [
        kpiCard(
          'ti-receipt',
          window.GfpI18n.tLabel('Issued invoices', 'إجمالي الفواتير الصادرة'),
          esc(money(issuedTotal)),
          window.GfpI18n.tLabel('For the selected period', 'خلال الفترة المحددة'),
        ),
        kpiCard(
          'ti-list-details',
          window.GfpI18n.tLabel('Invoices', 'عدد الفواتير'),
          String(issuedInvoices.length),
          window.GfpI18n.tLabel('@cn credit notes · @v voided', 'منها @cn إشعار دائن · @v ملغاة')
            .replace('@cn', String(creditNotes.length))
            .replace('@v', String(voidedCount)),
        ),
        kpiCard(
          'ti-chart-line',
          window.GfpI18n.tLabel('Average invoice', 'متوسط قيمة الفاتورة'),
          esc(money(avg)),
          window.GfpI18n.tLabel('Over @n invoices', 'على @n فاتورة').replace('@n', String(invoicesIssued.length)),
        ),
        kpiCard(
          'ti-file-minus',
          window.GfpI18n.tLabel('Credit notes total', 'إجمالي الإشعارات الدائنة'),
          esc(money(cnTotal)),
          '',
        ),
      ].join('');
    } catch (e) {
      box.hidden = true;
    }
  }
  function invoicesIssued(list) {
    return list.reduce((s, i) => s + Number(i.total || 0), 0);
  }

  const fSearchEl = document.getElementById('fSearch');
  if (fSearchEl) {
    let searchTimer = null;
    fSearchEl.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const meta = TABS[activeTab];
        if (meta.kind === 'buy') renderBuyRows(buyRows);
        else if (meta.kind === 'all') renderAllRows();
        else renderSellRows(lastSellItems);
      }, 160);
    };
  }

  const btnClearFilters = document.getElementById('btnClearFilters');
  if (btnClearFilters) {
    btnClearFilters.onclick = () => {
      ['fFrom', 'fTo', 'fStatus', 'fType', 'fSupplierId', 'fMemberId'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (fSearchEl) fSearchEl.value = '';
      const chip = document.getElementById('memberChip');
      if (chip) chip.hidden = true;
      page = 1;
      loadList();
    };
  }

  const fMemberEl = document.getElementById('fMemberId');
  if (fMemberEl) {
    fMemberEl.onchange = () => {
      const chip = document.getElementById('memberChip');
      const text = document.getElementById('memberChipText');
      if (chip && text) {
        const v = String(fMemberEl.value || '').trim();
        chip.hidden = !v;
        text.textContent = v;
      }
      page = 1;
      loadList();
    };
    if (String(fMemberEl.value || '').trim()) {
      const chip = document.getElementById('memberChip');
      const text = document.getElementById('memberChipText');
      if (chip && text) {
        chip.hidden = false;
        text.textContent = String(fMemberEl.value).trim();
      }
    }
  }
  const btnClearMember = document.getElementById('btnClearMember');
  if (btnClearMember) {
    btnClearMember.onclick = (e) => {
      e.stopPropagation();
      if (fMemberEl) fMemberEl.value = '';
      const chip = document.getElementById('memberChip');
      if (chip) chip.hidden = true;
      page = 1;
      loadList();
    };
  }

  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) {
    btnExportCsv.onclick = () => {
      const meta = TABS[activeTab];
      let rows;
      if (meta.kind === 'buy') {
        rows = [
          ['#', window.GfpI18n.tLabel('Date', 'التاريخ'), window.GfpI18n.tLabel('Supplier', 'المورد'), window.GfpI18n.tLabel('Total', 'الإجمالي'), window.GfpI18n.tLabel('Status', 'الحالة')],
        ].concat(
          buyRows.map((r, i) => [
            i + 1,
            r.receivedAtUtc || '',
            r.supplierName || '',
            Number(r.totalAmount || 0).toFixed(2),
            'received',
          ]),
        );
      } else {
        const items =
          meta.kind === 'all'
            ? lastMerged.map((m) =>
                m.kind === 'sell'
                  ? m.inv
                  : {
                      invoiceNumber: '',
                      type: 'purchase',
                      memberNameSnapshot: m.buy.supplierName,
                      memberPhoneSnapshot: '',
                      issuedAt: m.buy.receivedAtUtc,
                      total: m.buy.totalAmount,
                      currency: 'EGP',
                      status: 'received',
                    },
              )
            : lastSellItems;
        rows = [
          ['#', window.GfpI18n.tLabel('Number', 'الرقم'), window.GfpI18n.tLabel('Type', 'النوع'), window.GfpI18n.tLabel('Client', 'العميل'), window.GfpI18n.tLabel('Phone', 'الهاتف'), window.GfpI18n.tLabel('Issued', 'التاريخ'), window.GfpI18n.tLabel('Total', 'الإجمالي'), window.GfpI18n.tLabel('Status', 'الحالة')],
        ].concat(
          items.map((inv, i) => [
            i + 1,
            inv.invoiceNumber || '',
            friendlyType(inv.type),
            inv.memberNameSnapshot || '',
            inv.memberPhoneSnapshot || '',
            inv.issuedAt || '',
            Number(inv.total || 0).toFixed(2),
            inv.status || '',
          ]),
        );
      }
      if (!rows || rows.length <= 1) {
        toast(window.GfpI18n.tLabel('Nothing to export', 'لا يوجد ما يمكن تصديره'), 'err');
        return;
      }
      const csv =
        '\uFEFF' +
        rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'invoices-' + activeTab + '.csv';
      a.click();
      toast(window.GfpI18n.tLabel('CSV exported', 'تم تصدير ملف CSV'));
    };
  }

  const tbodyEl = document.getElementById('tbody');
  if (tbodyEl) {
    tbodyEl.addEventListener('click', (e) => {
      const act = e.target.closest('.inv-act[data-act]');
      if (!act) return;
      e.preventDefault();
      e.stopPropagation();
      const id = act.getAttribute('data-id');
      if (act.getAttribute('data-act') === 'print') openReceiptModal(id, 'a4');
      else if (act.getAttribute('data-act') === 'pdf') {
        const inv = lastSellItems.find((x) => String(x.id) === String(id));
        if (inv) openInvoicePdf(inv);
      } else selectInvoice(id);
    });
  }

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
      '<tr><td colspan="8" class="muted">' +
      esc(err && err.message ? err.message : window.GfpI18n.tLabel('Failed to load', 'فشل التحميل')) +
      '</td></tr>';
  });

  // Live Refresh: refetch the active list when another PC changes invoices/payments/refunds
  if (window.GfpLive && window.GfpLive.on) {
    GfpLive.on(['invoices', 'payments', 'refunds'], GfpLive.debounce(loadList, 500));
  }
})();
