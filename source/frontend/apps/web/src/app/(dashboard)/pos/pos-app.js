(function () {
  'use strict';

  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || ''; // REM-F3: no hardcoded remote URL
  let METHODS = ['cash', 'card_paymob', 'fawry', 'vodafone', 'instapay'];
  // Local Edition has no online payment gateways — drop them from the split-payment method list.
  if (window.GfpDeployment) {
    window.GfpDeployment.getEdition().then(function (edition) {
      if (edition === 'Local') METHODS = window.GfpDeployment.filterOnlineGatewayCodes(METHODS);
    });
  }
  function methodLabel(code) {
    const map = {
      cash: t('Cash', 'كاش'),
      card_paymob: t('Card', 'بطاقة'),
      fawry: t('Fawry', 'فوري'),
      vodafone: t('Vodafone Cash', 'فودافون كاش'),
      instapay: t('InstaPay', 'إنستا باي'),
    };
    return map[code] || code;
  }

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH(extra) {
    const t = getToken();
    const h = Object.assign(
      {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      extra || {}
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
  const canSell = perms.has('sales.sell') || /Owner|Manager/i.test(role);
  const canDiscount = perms.has('sales.discount.apply') || /Owner/i.test(role);
  const canOverride = perms.has('sales.discount.override') || /Owner/i.test(role);

  let plans = [];
  let promoPreview = null;
  let shiftOk = false;
  /** One key per sale attempt; reused on retry until success. */
  let idempotencyKey = null;
  /** Sale is retail-only — membership workflows live in Members */
  let posMode = 'retail';
  let inventoryOn = false;
  /** @type {{ productId: string, sku: string, name: string, qty: number, unitPrice: number, allowFractional: boolean }[]} */
  let retailCart = [];
  let quickCatalog = [];
  let saleCat = 'all';
  let payMethod = 'cash';

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function money(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(n));
  }
  function t(en, ar) {
    const I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }
  function pickBilingual(detail) {
    const I18n = window.GfpI18n;
    if (!detail) return '';
    if (I18n && I18n.displayBilingualText) return I18n.displayBilingualText(String(detail));
    const raw = String(detail);
    const idx = raw.indexOf(' / ');
    if (idx === -1) return raw;
    const en = raw.slice(0, idx).trim();
    const ar = raw.slice(idx + 3).trim();
    return t(en, ar);
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function problemMessage(data, status) {
    if (!data) return t('Request failed', 'فشل الطلب') + ' (' + status + ')';
    const title = data.title || '';
    const detail = data.detail || data.message || data.error || '';
    if (title === 'OPEN_SHIFT_REQUIRED')
      return t('Open a cash shift first, then complete this payment.', 'افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.');
    if (title === 'PAYMENT_INCOMPLETE')
      return t(
        'Paid amount is less than the total. Cover the full total, or turn on partial payment.',
        'المبلغ المدفوع أقل من الإجمالي. كمّل المبلغ، أو فعّل الدفع الجزئي.'
      );
    if (title === 'PROMO_RACE_LOST')
      return t(
        'That promo was just used elsewhere. Clear it, check the code again, then retry.',
        'كود الخصم اتستخدم لتوّه. امسحه، تأكد من الكود، وحاول تاني.'
      );
    if (title === 'FORBIDDEN_DISCOUNT_OVERRIDE')
      return t('You do not have permission to change this discount.', 'مش عندك صلاحية تعدّل الخصم ده.');
    if (title === 'FEATURE_DISABLED')
      return t(
        'Sales are turned off for this gym. Ask the owner to enable them.',
        'المبيعات مقفولة لهذا النادي. اطلب من المالك تفعيلها.'
      );
    if (title === 'INSUFFICIENT_STOCK')
      return (
        pickBilingual(detail) ||
        t('Not enough sellable stock for a product in the cart.', 'الرصيد القابل للبيع مش كفاية لمنتج في السلة.')
      );
    if (title === 'STOCK_UNSELLABLE_EXPIRED')
      return (
        pickBilingual(detail) ||
        t(
          'Stock on hand is expired — cannot sell. Write off expired or receive a new batch.',
          'الكمية الموجودة منتهية — مش هيتباع. اتلف المنتهي أو استلم تشغيلة جديدة.'
        )
      );
    if (title === 'INVENTORY_REQUIRED')
      return t('Inventory must be enabled before retail sales.', 'لازم المخزون يكون متفعّل قبل بيع المنتجات.');
    if (title === 'WAREHOUSE_NOT_FOUND') return t('Warehouse not found.', 'المستودع مش موجود.');
    if (title === 'PRODUCT_NOT_FOUND') return t('Product not found.', 'المنتج مش موجود.');
    if (title === 'MEMBER_REQUIRED') return t('A member is required for this sale.', 'لازم تختار عضو لهذه العملية.');
    if (detail) return pickBilingual(detail) || String(detail);
    if (title && !/^[A-Z][A-Z0-9_]+$/.test(title)) return title;
    return t('Could not complete the sale. Try again or ask a manager.', 'مش قدرنا نتمم البيع. حاول تاني أو اسأل المدير.') +
      (status ? ' (' + status + ')' : '');
  }
  function clearStockBlock() {
    const panel = document.getElementById('stockBlockPanel');
    if (panel) panel.style.display = 'none';
  }
  function showStockBlock(code, detail) {
    const panel = document.getElementById('stockBlockPanel');
    if (!panel) return;
    const expired = code === 'STOCK_UNSELLABLE_EXPIRED';
    const titleEl = document.getElementById('stockBlockTitle');
    const bodyEl = document.getElementById('stockBlockBody');
    const hintEl = document.getElementById('stockBlockHint');
    if (titleEl) {
      titleEl.textContent = expired
        ? t('Expired — cannot sell', 'منتهي — مش هيتباع')
        : t('Not enough stock', 'مفيش رصيد كفاية');
    }
    if (bodyEl) {
      bodyEl.textContent =
        pickBilingual(detail) ||
        (expired
          ? t(
              'All on-hand units are past expiry for this product.',
              'كل الكمية الموجودة للمنتج منتهية الصلاحية.'
            )
          : t('Lower the qty or pick another product.', 'قلّل الكمية أو اختار منتج تاني.'));
    }
    if (hintEl) {
      hintEl.textContent = expired
        ? t(
            'Use inventory Fix / adjustments to write off expired, then receive fresh stock.',
            'من المخزون: اعمل إتلاف للمنتهي، بعدين استلم كمية جديدة.'
          )
        : t(
            'Check the desk warehouse, or move stock from the storeroom.',
            'اتأكد من مستودع المكتب، أو حوّل من المخزن.'
          );
    }
    panel.style.display = 'flex';
    panel.className = 'banner stock-block ' + (expired ? 'warn' : 'danger');
    try {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}
  }
  function productThumbHtml(url, cls, alt) {
    const c = cls || 'retail-thumb';
    const cands = mediaCandidates(url);
    if (!cands.length) {
      return '<div class="' + c + '"><i class="ti ti-photo"></i></div>';
    }
    return (
      '<div class="' +
      c +
      '"><img src="' +
      esc(cands[0]) +
      '" alt="' +
      esc(alt || '') +
      '" loading="lazy" data-cands="' +
      esc(JSON.stringify(cands.slice(1))) +
      '" onerror="window.gfpImgFallback&&window.gfpImgFallback(this)"></div>'
    );
  }
  function apiOrigin() {
    try {
      return new URL(window.API_BASE || API_BASE || window.GFP_DEFAULT_API_BASE || '/api', window.location.origin).origin;
    } catch (e) {
      return window.location.origin;
    }
  }
  function uploadsPath(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    try {
      if (/^https?:\/\//i.test(u)) {
        const p = new URL(u).pathname;
        return p.indexOf('/uploads/') === 0 ? p : '';
      }
    } catch (e) {}
    if (u.indexOf('/uploads/') >= 0) {
      return u.slice(u.indexOf('/uploads/')).split('?')[0];
    }
    if (u.charAt(0) === '/') return u.split('?')[0];
    return '';
  }
  function mediaCandidates(url) {
    const u = String(url || '').trim();
    if (!u) return [];
    if (/^(blob:|data:)/i.test(u)) return [u];
    const list = [];
    function add(x) {
      if (x && list.indexOf(x) < 0) list.push(x);
    }
    const path = uploadsPath(u);
    if (path) {
      add(apiOrigin() + path);
    }
    if (/^https?:\/\//i.test(u)) add(u);
    else if (!path) add(apiOrigin() + (u.charAt(0) === '/' ? u : '/' + u));
    return list;
  }
  function gfpImgFallback(img) {
    if (!img) return;
    let next = [];
    try {
      next = JSON.parse(img.getAttribute('data-cands') || '[]');
    } catch (e) {
      next = [];
    }
    if (!Array.isArray(next) || !next.length) {
      const parent = img.parentNode;
      img.remove();
      if (parent) parent.innerHTML = '<i class="ti ti-photo"></i>';
      return;
    }
    img.setAttribute('data-cands', JSON.stringify(next.slice(1)));
    img.src = next[0];
  }
  window.gfpImgFallback = gfpImgFallback;
  function applyLocaleBits() {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) {
      window.GfpI18n.applyDocumentLocale();
    }
  }
  function newIdemKey() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'sale-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function ensureIdemKey() {
    if (!idempotencyKey) idempotencyKey = newIdemKey();
    const el = document.getElementById('idemKey');
    if (el) el.textContent = idempotencyKey;
    return idempotencyKey;
  }
  function clearIdemKey() {
    idempotencyKey = null;
    const el = document.getElementById('idemKey');
    if (el) el.textContent = '—';
  }

  async function api(method, path, body, headers) {
    const opts = { method, headers: getH(headers) };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (e) {
      return {
        ok: false,
        status: 0,
        data: { title: 'NETWORK_ERROR', detail: 'Network error — check API / ngrok tunnel.' }
      };
    }
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  async function apiHtml(path) {
    const headers = getH();
    delete headers['Content-Type'];
    const res = await fetch(API_BASE + path, { method: 'GET', headers: headers });
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, text: '' };
    }
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text };
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /** Poll until invoice exists (fallback when inline create was not ready). */
  async function waitForSaleInvoice(saleId) {
    for (let i = 0; i < 30; i++) {
      const res = await api('GET', '/sales/' + encodeURIComponent(saleId) + '/invoice');
      if (res.ok && res.data && res.data.invoiceId) return res.data;
      if (res.status && res.status !== 404) return null;
      await sleep(i < 8 ? 150 : 350);
    }
    return null;
  }

  function closePosPrint() {
    const ov = document.getElementById('posPrintOverlay');
    if (ov) ov.hidden = true;
    const frame = document.getElementById('posPrintFrame');
    if (frame) frame.srcdoc = '';
  }

  async function openMemberCardPrint(memberId, autoPrint) {
    const overlay = document.getElementById('posPrintOverlay');
    const frame = document.getElementById('posPrintFrame');
    const title = document.getElementById('posPrintTitle');
    if (!overlay || !frame || !memberId) {
      toast(t('Print view not available.', 'شاشة الطباعة مش متاحة.'), 'err');
      return;
    }
    if (title) title.textContent = t('Member card', 'كارنيه العضو');
    overlay.hidden = false;
    frame.srcdoc =
      '<p style="padding:16px;font-family:sans-serif;color:#666">' +
      esc(t('Loading card…', 'جاري تحميل الكارنيه…')) +
      '</p>';
    const res = await apiHtml('/members/' + encodeURIComponent(memberId) + '/access-card-html');
    if (!res.ok) {
      var detail = t('Could not load member card.', 'مش قدرنا نحمّل كارنيه العضو.');
      if (res.status === 404) {
        detail = t(
          'Card endpoint missing (404). Restart the API after Access Cards deploy.',
          'مسار الكارنيه مش موجود (404). أعد تشغيل الـ API بعد نشر Access Cards.'
        );
      } else if (res.status === 403) {
        detail = t(
          'No permission to print cards (need members.view).',
          'مفيش صلاحية طباعة الكارنيه (لازم members.view).'
        );
      } else if (res.status) {
        detail = detail + ' (HTTP ' + res.status + ')';
      }
      toast(detail, 'err');
      frame.srcdoc =
        '<p style="padding:16px;font-family:sans-serif;color:#991b1b">' +
        esc(detail) +
        '</p>';
      return;
    }
    frame.srcdoc = res.text || '';
    if (autoPrint) {
      // Wait for iframe layout so barcode bars paint before Chromium print snapshot.
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

  async function openRetailReceiptPrint(invoiceId, invoiceNumber, autoPrint) {
    const overlay = document.getElementById('posPrintOverlay');
    const frame = document.getElementById('posPrintFrame');
    const title = document.getElementById('posPrintTitle');
    if (!overlay || !frame) {
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
    const res = await apiHtml('/invoices/' + encodeURIComponent(invoiceId) + '/receipt-html');
    if (!res.ok) {
      toast(t('Could not load receipt for print.', 'مش قدرنا نحمّل الإيصال للطباعة.'), 'err');
      frame.srcdoc =
        '<p style="padding:16px;font-family:sans-serif;color:#991b1b">' +
        esc(t('Receipt failed to load.', 'فشل تحميل الإيصال.')) +
        '</p>';
      return;
    }
    frame.srcdoc = res.text || '';
    if (autoPrint) {
      setTimeout(function () {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch (_) {
          toast(t('Allow pop-ups / try Print again.', 'اسمح بالنوافذ أو اضغط طباعة تاني.'), 'err');
        }
      }, 400);
    }
  }

  function wireRetailPrintActions(sale) {
    const saleId = sale.saleId;
    const statusEl = document.getElementById('invoiceReadyLine');
    const printBtn = document.getElementById('btnPrintReceipt');
    const nextBtn = document.getElementById('btnStartNextSale');
    if (nextBtn) {
      nextBtn.onclick = function () {
        closePosPrint();
        document.getElementById('btnReset').click();
      };
    }
    if (!printBtn) return;

    function armPrint(invoiceId, invoiceNumber) {
      if (statusEl) {
        statusEl.innerHTML =
          esc(t('Invoice ready', 'الفاتورة جاهزة')) +
          (invoiceNumber ? ': <strong>' + esc(invoiceNumber) + '</strong>' : '');
        statusEl.classList.add('invoice-ready');
      }
      printBtn.disabled = false;
      printBtn.removeAttribute('aria-busy');
      printBtn.onclick = function () {
        openRetailReceiptPrint(invoiceId, invoiceNumber, true);
      };
      openRetailReceiptPrint(invoiceId, invoiceNumber, true);
      toast(
        (invoiceNumber
          ? t('Invoice', 'فاتورة') + ' ' + invoiceNumber + ' — '
          : '') + t('ready to print', 'جاهزة للطباعة'),
        'ok'
      );
    }

    // Fast path: invoice created inline with the sale (no Hangfire wait).
    const readyId = sale.invoiceId || sale.InvoiceId;
    const readyNum = sale.invoiceNumber || sale.InvoiceNumber;
    if (readyId) {
      armPrint(readyId, readyNum || '');
      return;
    }

    printBtn.disabled = true;
    printBtn.setAttribute('aria-busy', 'true');
    if (statusEl) {
      statusEl.textContent = t('Preparing invoice for print…', 'بنحضّر الفاتورة للطباعة…');
    }

    waitForSaleInvoice(saleId).then(function (inv) {
      printBtn.removeAttribute('aria-busy');
      if (!inv) {
        if (statusEl) {
          statusEl.textContent = t(
            'Invoice still preparing — tap Print to retry.',
            'الفاتورة لسه بتتحضر — اضغط طباعة للمحاولة.'
          );
        }
        printBtn.disabled = false;
        printBtn.onclick = function () {
          wireRetailPrintActions(sale);
        };
        return;
      }
      armPrint(inv.invoiceId, inv.invoiceNumber || '');
    });
  }

  function setSalesDisabledBanner(on) {
    const el = document.getElementById('featureDisabled');
    if (!el) return;
    el.classList.toggle('is-off', !on);
    el.hidden = !on;
    el.style.display = on ? 'flex' : 'none';
  }

  function setShiftGateBanner(on) {
    const gate = document.getElementById('shiftGate');
    if (!gate) return;
    gate.classList.toggle('is-off', !on);
    gate.hidden = !on;
    gate.style.display = on ? 'flex' : 'none';
  }

  async function probeSalesFeatureLocal() {
    // Same contract as GfpFeatures sales probe (GET /promo-codes).
    // Do NOT use /membership-plans — that can be FEATURE_DISABLED while retail sales still work.
    const res = await api('GET', '/promo-codes?page=1&pageSize=1');
    if (res.status === 404 && res.data && res.data.title === 'FEATURE_DISABLED') return false;
    return true; // fail-open on network / other errors
  }

  async function refreshSalesFeatureBanner() {
    try {
      const F = window.GfpFeatures;
      if (F && F.clearCache) F.clearCache();
      let ok = true;
      if (F && F.probeModuleAvailable) {
        ok = await F.probeModuleAvailable('sales');
      } else {
        ok = await probeSalesFeatureLocal();
      }
      setSalesDisabledBanner(!ok);
    } catch (_) {
      setSalesDisabledBanner(false);
    }
  }

  // ── Shift gate ────────────────────────────────────────────────
  function syncStatusShift(text, ok) {
    const chip = document.getElementById('statusShiftChip');
    const statusText = document.getElementById('statusShiftText');
    if (statusText) {
      statusText.textContent = text;
      statusText.removeAttribute('data-en');
      statusText.removeAttribute('data-ar');
    }
    if (chip) {
      chip.classList.toggle('is-ok', ok === true);
      chip.classList.toggle('is-bad', ok === false);
      chip.dataset.shiftLabel = text || '';
      chip.dataset.shiftOk = ok === true ? '1' : ok === false ? '0' : '';
    }
  }

  function setInventoryHintVisible(on) {
    const hint = document.getElementById('inventoryOffHint');
    if (!hint) return;
    if (on) {
      hint.hidden = false;
      hint.classList.remove('is-off');
      hint.style.display = 'flex';
    } else {
      hint.hidden = true;
      hint.classList.add('is-off');
      hint.style.display = 'none';
    }
  }

  function syncStatusWarehouse() {
    const sel = document.getElementById('warehouseSelect');
    const chip = document.getElementById('statusWhChip');
    const text = document.getElementById('statusWhText');
    const wrap = document.querySelector('.wh-inline');
    if (wrap) wrap.hidden = true;
    if (!sel || !chip || !text) return;
    chip.hidden = true;
  }

  async function checkShift() {
    const label = document.getElementById('shiftLabel');
    const ws = document.getElementById('posWorkspace');
    const res = await api('GET', '/shifts/current');

    // Shifts module off — do not pretend there is simply "no open shift".
    if (res.status === 404 && res.data && res.data.title === 'FEATURE_DISABLED') {
      shiftOk = false;
      setShiftGateBanner(true);
      if (ws) ws.classList.add('blocked');
      const msg = t('Shifts disabled', 'الورديات مقفولة');
      if (label) label.textContent = msg;
      syncStatusShift(msg, false);
      document.getElementById('btnSell').disabled = true;
      return;
    }

    const open = !!(res.ok && res.data && String(res.data.status).toLowerCase() === 'open');
    if (res.ok && !res.data) {
      shiftOk = false;
    } else if (res.status === 409 || res.status === 404) {
      shiftOk = false;
    } else if (res.status === 0) {
      shiftOk = false;
    } else {
      shiftOk = open;
    }

    if (!shiftOk) {
      setShiftGateBanner(true);
      if (ws) ws.classList.add('blocked');
      const msg = t('No open shift', 'مفيش وردية مفتوحة');
      if (label) label.textContent = msg;
      syncStatusShift(msg, false);
      document.getElementById('btnSell').disabled = true;
    } else {
      setShiftGateBanner(false);
      if (ws) ws.classList.remove('blocked');
      const msg =
        t('Shift open', 'وردية مفتوحة') +
        ' · ' +
        (res.data.userName || t('you', 'أنت'));
      if (label) label.textContent = t('Open', 'مفتوحة') + ' · ' + (res.data.userName || t('you', 'أنت'));
      syncStatusShift(msg, true);
      updateSellEnabled();
    }
  }

  // ── Plans ─────────────────────────────────────────────────────
  function planDurationLabel(p) {
    if (p.durationDays) return p.durationDays + ' ' + t('days', 'يوم');
    if (p.durationMonths) return p.durationMonths + ' ' + t('mo', 'شهر');
    if (p.planType) return String(p.planType);
    return '';
  }

  function renderPlanTiles() {
    const host = document.getElementById('planTiles');
    if (!host) return;
    const selectedId = document.getElementById('planSelect').value;
    if (!plans.length) {
      host.innerHTML =
        '<div class="muted">' +
        esc(t('No active plans.', 'مفيش باقات نشطة.')) +
        '</div>';
      return;
    }
    host.innerHTML = plans
      .map(function (p) {
        const act = p.id === selectedId ? ' act' : '';
        return (
          '<button type="button" class="plan-tile retail-tap' +
          act +
          '" role="option" aria-selected="' +
          (p.id === selectedId ? 'true' : 'false') +
          '" data-plan-id="' +
          esc(p.id) +
          '">' +
          '<span class="plan-tile-icon"><i class="ti ti-id-badge-2"></i></span>' +
          '<span class="plan-tile-name">' +
          esc(p.name || 'Plan') +
          '</span>' +
          (planDurationLabel(p)
            ? '<span class="plan-tile-meta">' + esc(planDurationLabel(p)) + '</span>'
            : '') +
          '<span class="plan-tile-price">' +
          esc(money(p.price)) +
          '</span></button>'
        );
      })
      .join('');
    host.querySelectorAll('[data-plan-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectPlanById(btn.getAttribute('data-plan-id'));
      });
    });
  }

  function selectPlanById(id) {
    const sel = document.getElementById('planSelect');
    if (sel) sel.value = id || '';
    promoPreview = null;
    updateEstimate();
    updateSellEnabled();
  }

  async function loadPlans() {
    // Membership plans are no longer sold from Sale — kept as no-op for legacy callers.
    plans = [];
  }

  function selectedPlan() {
    const id = document.getElementById('planSelect').value;
    return plans.find((p) => p.id === id) || null;
  }

  const planSelectEl = document.getElementById('planSelect');
  if (planSelectEl) {
    planSelectEl.addEventListener('change', () => {
      selectPlanById(document.getElementById('planSelect').value);
    });
  }

  // ── Payment legs ──────────────────────────────────────────────
  function addLeg(method, amount) {
    const wrap = document.getElementById('payLegs');
    const row = document.createElement('div');
    row.className = 'pay-leg';
    row.innerHTML =
      '<label><span data-en="Method" data-ar="طريقة الدفع">Method</span><select>' +
      METHODS.map(
        (m) =>
          '<option value="' +
          m +
          '"' +
          (m === method ? ' selected' : '') +
          '>' +
          esc(methodLabel(m)) +
          '</option>',
      ).join('') +
      '</select></label>' +
      '<label><span data-en="Amount" data-ar="المبلغ">Amount</span><input type="number" step="0.01" min="0" value="' +
      (amount != null ? amount : '') +
      '"></label>' +
      '<button type="button" class="btn ghost" title="' +
      esc(t('Remove', 'إزالة')) +
      '">✕</button>';
    row.querySelector('button').onclick = () => {
      row.remove();
      updatePaidSum();
    };
    row.querySelector('input').addEventListener('input', updatePaidSum);
    wrap.appendChild(row);
    updatePaidSum();
  }

  function readPayments() {
    return Array.from(document.querySelectorAll('#payLegs .pay-leg'))
      .map((row) => ({
        method: row.querySelector('select').value,
        amount: Number(row.querySelector('input').value),
      }))
      .filter((p) => p.amount > 0);
  }

  function updatePaidSum() {
    const sum = readPayments().reduce((a, p) => a + p.amount, 0);
    document.getElementById('paidSum').textContent = money(sum);
  }

  // ── POS layout: retail-only ───────────────────────────────────
  function syncUrlMode() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'retail');
      // Drop legacy membership mode query if present
      const next = url.pathname + url.search + url.hash;
      const cur = window.location.pathname + window.location.search + window.location.hash;
      if (next !== cur) window.history.replaceState({}, '', next);
      if (window.GfpShell && typeof window.GfpShell.renderShellNav === 'function') {
        window.GfpShell.renderShellNav();
      }
    } catch (_) { /* ignore */ }
  }

  function setPosMode(_mode, opts) {
    opts = opts || {};
    posMode = 'retail';
    const isRetail = true;

    const memb = document.getElementById('membershipPanel');
    const retail = document.getElementById('retailPanel');
    if (memb) {
      memb.hidden = true;
      memb.style.display = 'none';
      memb.setAttribute('aria-hidden', 'true');
    }
    if (retail) {
      retail.hidden = false;
      retail.style.display = '';
      retail.setAttribute('aria-hidden', 'false');
    }

    const ws = document.getElementById('posWorkspace');
    if (ws) ws.classList.add('pos-retail');
    document.body.classList.add('pos-retail');
    document.documentElement.classList.add('pos-retail');

    const payMount = document.getElementById('retailPayMount');
    const payCard = document.getElementById('paymentsCard');
    const submitCard = document.getElementById('submitCard');
    if (payCard && submitCard && payMount) {
      payMount.appendChild(payCard);
      payMount.appendChild(submitCard);
    }

    const quickPay = document.getElementById('retailQuickPay');
    if (quickPay) quickPay.hidden = false;
    const payMore = document.getElementById('payMoreDetails');
    if (payMore) payMore.open = false;

    const finishTotalRow = document.getElementById('finishTotalRow');
    if (finishTotalRow) {
      finishTotalRow.hidden = false;
      finishTotalRow.style.display = '';
    }
    const retailHint = document.getElementById('retailSubmitHint');
    if (retailHint) {
      retailHint.hidden = true;
      retailHint.style.display = 'none';
    }

    const titleEl = document.getElementById('pageTitleText');
    if (titleEl) titleEl.textContent = t('Sale', 'البيع');
    const crumb = document.getElementById('posBreadcrumb');
    if (crumb) crumb.textContent = t('Sale', 'البيع');

    const sub = document.getElementById('pageSubtitle');
    if (sub) {
      sub.textContent = t(
        'Scan or tap, take cash or card, print. Memberships stay in Members.',
        'امسح أو اضغط، خد كاش أو كارت، اطبع. الاشتراكات من الأعضاء.'
      );
    }

    const promoBtn = document.getElementById('btnPromoCodes');
    if (promoBtn) promoBtn.style.display = 'none';

    const sellBtn = document.getElementById('btnSell');
    if (sellBtn) {
      sellBtn.classList.add('retail-tap');
      updateTakeLabel();
    }

    if (!opts.skipUrl) syncUrlMode();
    else if (window.GfpShell && typeof window.GfpShell.renderShellNav === 'function') {
      window.GfpShell.renderShellNav();
    }

    if (inventoryOn) loadQuickProducts();
    updateEstimate();
    updateSellEnabled();
    applyLocaleBits();
  }

  function saleResultVisible() {
    const box = document.getElementById('saleResult');
    return !!(box && box.style.display === 'block' && (box.innerHTML || box.textContent));
  }
  function syncTicketChrome() {
    const ws = document.getElementById('posWorkspace');
    if (!ws) return;
    const hasCart = retailCart.length > 0;
    const done = saleResultVisible() && !hasCart;
    ws.classList.toggle('cart-empty', !hasCart && !done);
    ws.classList.toggle('has-cart', hasCart);
    ws.classList.toggle('sale-done', done);
    updateTakeLabel();
  }
  function updateTakeLabel() {
    const sellBtn = document.getElementById('btnSell');
    if (!sellBtn) return;
    const total = estimateTotal();
    const label =
      total != null && total > 0
        ? t('Take ', 'خد ') + money(total)
        : t('Take money', 'خد الفلوس');
    sellBtn.innerHTML = '<i class="ti ti-cash"></i> <span>' + esc(label) + '</span>';
  }
  function markPayMethod(method) {
    payMethod = method === 'card_paymob' ? 'card_paymob' : 'cash';
    const cash = document.getElementById('btnPayCash');
    const card = document.getElementById('btnPayCard');
    if (cash) cash.classList.toggle('act', payMethod === 'cash');
    if (card) card.classList.toggle('act', payMethod === 'card_paymob');
  }
  function updateCartCount() {
    const el = document.getElementById('cartCount');
    if (el) el.textContent = String(retailCart.length);
  }

  function renderRetailCart() {
    const host = document.getElementById('retailCart');
    updateCartCount();
    if (!retailCart.length) {
      host.innerHTML =
        '<div class="empty-cart"><i class="ti ti-shopping-cart"></i><strong>' +
        esc(t('Waiting for the first item', 'مستني أول صنف')) +
        '</strong><span>' +
        esc(t('Scan or tap a product. Pay appears after that.', 'امسح أو اضغط منتج. الدفع بيظهر بعد كده.')) +
        '</span></div>';
      updateEstimate();
      updateSellEnabled();
      syncTicketChrome();
      return;
    }
    host.innerHTML = retailCart
      .map(function (l, i) {
        const step = l.allowFractional ? '0.001' : '1';
        const min = l.allowFractional ? '0.001' : '1';
        return (
          '<div class="retail-line" data-idx="' +
          i +
          '">' +
          productThumbHtml(l.imageUrl) +
          '<div class="retail-line-meta">' +
          '<div class="retail-line-name">' +
          esc(l.name) +
          '</div>' +
          '<div class="retail-line-sku">' +
          esc(l.sku) +
          '</div>' +
          '</div>' +
          '<button type="button" class="rc-remove" title="' +
          esc(t('Remove', 'احذف')) +
          '"><i class="ti ti-x"></i></button>' +
          '<div class="retail-line-controls">' +
          '<div class="qty-stepper">' +
          '<button type="button" class="rc-dec" aria-label="-">−</button>' +
          '<input type="number" class="rc-qty" min="' +
          min +
          '" step="' +
          step +
          '" value="' +
          esc(l.qty) +
          '">' +
          '<button type="button" class="rc-inc" aria-label="+">+</button>' +
          '</div>' +
          '<input type="number" class="rc-price" min="0" step="0.01" value="' +
          esc(l.unitPrice) +
          '" title="' +
          esc(t('Unit price', 'سعر الوحدة')) +
          '">' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    host.querySelectorAll('.retail-line').forEach(function (row) {
      const idx = Number(row.getAttribute('data-idx'));
      function setQty(v) {
        if (!retailCart[idx].allowFractional) v = Math.max(1, Math.floor(v) || 1);
        else v = Math.max(0.001, Number(v) || 0.001);
        retailCart[idx].qty = v;
        const inp = row.querySelector('.rc-qty');
        if (inp) inp.value = String(v);
        updateEstimate();
        updateSellEnabled();
      }
      row.querySelector('.rc-qty').addEventListener('input', function (e) {
        setQty(Number(e.target.value));
      });
      row.querySelector('.rc-inc').addEventListener('click', function () {
        const step = retailCart[idx].allowFractional ? 0.001 : 1;
        setQty(Number(retailCart[idx].qty) + step);
      });
      row.querySelector('.rc-dec').addEventListener('click', function () {
        const step = retailCart[idx].allowFractional ? 0.001 : 1;
        const next = Number(retailCart[idx].qty) - step;
        if (!retailCart[idx].allowFractional && next < 1) {
          retailCart.splice(idx, 1);
          renderRetailCart();
          return;
        }
        setQty(next);
      });
      row.querySelector('.rc-price').addEventListener('input', function (e) {
        retailCart[idx].unitPrice = Number(e.target.value) || 0;
        updateEstimate();
        updateSellEnabled();
      });
      row.querySelector('.rc-remove').addEventListener('click', function () {
        retailCart.splice(idx, 1);
        renderRetailCart();
      });
    });
    updateEstimate();
    updateSellEnabled();
    syncTicketChrome();
  }

  function addProductToCart(p) {
    if (!p || !p.id) return;
    const existing = retailCart.find(function (l) {
      return l.productId === p.id;
    });
    if (existing) {
      existing.qty = Number(existing.qty) + 1;
      if (!existing.imageUrl && (p.imageUrl || p.relativeUrl)) existing.imageUrl = p.imageUrl || p.relativeUrl;
      renderRetailCart();
      return;
    }
    retailCart.push({
      productId: p.id,
      sku: p.sku || '',
      name: p.name || '',
      imageUrl: p.imageUrl || p.relativeUrl || null,
      qty: 1,
      unitPrice: Number(p.sellPrice) || 0,
      allowFractional: !!p.allowFractionalQty
    });
    renderRetailCart();
  }

  function renderCatChips() {
    const host = document.getElementById('catChips');
    if (!host) return;
    const names = [];
    quickCatalog.forEach(function (p) {
      const n = (p.categoryName || '').trim();
      if (n && names.indexOf(n) < 0) names.push(n);
    });
    const items = [['all', t('All', 'الكل')]].concat(
      names.map(function (n) {
        var label = n.charAt(0).toUpperCase() + n.slice(1);
        return [n, label];
      })
    );
    host.innerHTML = items
      .map(function (x) {
        return (
          '<button type="button" class="chip' +
          (saleCat === x[0] ? ' act' : '') +
          '" data-c="' +
          esc(x[0]) +
          '">' +
          esc(x[1]) +
          '</button>'
        );
      })
      .join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        saleCat = b.getAttribute('data-c') || 'all';
        renderQuickGrid();
      };
    });
  }
  function renderQuickGrid() {
    const host = document.getElementById('quickAddGrid');
    if (!host) return;
    const q = (document.getElementById('barcodeInput').value || '').trim().toLowerCase();
    const rows = quickCatalog.filter(function (p) {
      if (p.isActive === false || p.isArchived) return false;
      if (saleCat !== 'all' && (p.categoryName || '') !== saleCat) return false;
      if (!q) return true;
      const blob = ((p.name || '') + ' ' + (p.nameAr || '') + ' ' + (p.sku || '') + ' ' + (p.barcode || '')).toLowerCase();
      return blob.indexOf(q) !== -1;
    });
    if (!rows.length) {
      host.innerHTML =
        '<div class="muted">' +
        esc(t('No match. Scan the barcode.', 'مفيش نتيجة. امسح الباركود.')) +
        '</div>';
      return;
    }
    host.innerHTML = rows
      .slice(0, 24)
      .map(function (p) {
        return (
          '<button type="button" class="quick-tile retail-tap" data-quick-id="' +
          esc(p.id) +
          '">' +
          productThumbHtml(p.imageUrl || p.relativeUrl, 'quick-tile-photo', p.name || p.sku || '') +
          '<span class="quick-tile-name">' +
          esc(p.name || p.sku || 'Item') +
          '</span>' +
          '<span class="quick-tile-price">' +
          esc(money(p.sellPrice)) +
          '</span></button>'
        );
      })
      .join('');
    host.querySelectorAll('[data-quick-id]').forEach(function (btn) {
      const id = btn.getAttribute('data-quick-id');
      const p = quickCatalog.find(function (x) {
        return x.id === id;
      });
      btn.addEventListener('click', function () {
        if (p) {
          addProductToCart(p);
          toast(t('Added', 'تمت الإضافة') + ' ' + (p.name || p.sku || ''), 'ok');
        }
      });
    });
  }
  async function loadQuickProducts() {
    const host = document.getElementById('quickAddGrid');
    if (!host) return;
    const res = await api('GET', '/inventory/products?page=1&pageSize=48');
    if (!res.ok) {
      host.innerHTML =
        '<div class="muted">' +
        esc(t('Could not load products — try search.', 'مش قدرنا نحمّل المنتجات — جرّب البحث.')) +
        '</div>';
      return;
    }
    const items = Array.isArray(res.data)
      ? res.data
      : (res.data && (res.data.items || res.data.products)) || [];
    quickCatalog = items.filter(function (p) {
      return p && p.isActive !== false && !p.isArchived;
    });
    if (!quickCatalog.length) {
      host.innerHTML =
        '<div class="muted">' +
        esc(t('No products yet — receive stock first.', 'مفيش منتجات — استلم مخزون الأول.')) +
        '</div>';
      return;
    }
    renderCatChips();
    renderQuickGrid();
  }

  async function loadWarehouses() {
    const sel = document.getElementById('warehouseSelect');
    sel.innerHTML = '<option value="">Loading…</option>';
    const [listRes, defRes] = await Promise.all([
      api('GET', '/inventory/warehouses'),
      api('GET', '/inventory/warehouses/default')
    ]);
    if (!listRes.ok) {
      sel.innerHTML = '<option value="">Failed to load warehouses</option>';
      return;
    }
    const items = Array.isArray(listRes.data)
      ? listRes.data
      : (listRes.data && (listRes.data.items || listRes.data.warehouses)) || [];
    const active = items.filter(function (w) {
      return w.isActive !== false;
    });
    if (!active.length) {
      sel.innerHTML = '<option value="">No warehouses</option>';
      return;
    }
    const defaultId =
      defRes.ok && defRes.data && defRes.data.id
        ? defRes.data.id
        : (active.find(function (w) {
            return w.isDefault;
          }) || active[0]).id;
    sel.innerHTML = active
      .map(function (w) {
        return (
          '<option value="' +
          esc(w.id) +
          '"' +
          (w.id === defaultId ? ' selected' : '') +
          '>' +
          esc(w.code ? w.code + ' — ' + (w.name || '') : w.name || w.id) +
          '</option>'
        );
      })
      .join('');
    sel.onchange = function () {
      syncStatusWarehouse();
      updateSellEnabled();
    };
    syncStatusWarehouse();
    updateSellEnabled();
  }

  async function probeInventoryAndUi() {
    const res = await api('GET', '/inventory/categories');
    inventoryOn = !(res.status === 404 && res.data && res.data.title === 'FEATURE_DISABLED');
    // If products already answer, trust that over a flaky categories probe
    if (!inventoryOn) {
      const probe = await api('GET', '/inventory/products?page=1&pageSize=1');
      if (probe.ok) inventoryOn = true;
    }
    const ws = document.getElementById('posWorkspace');
    if (inventoryOn) {
      setInventoryHintVisible(false);
      if (ws) ws.classList.remove('inventory-off');
      await loadWarehouses();
      loadQuickProducts();
    } else {
      setInventoryHintVisible(true);
      if (ws) ws.classList.add('inventory-off');
      // Stay on retail — do not fall back to membership mode (removed from Sale)
    }
  }

  let productSearchTimer = null;
  document.getElementById('btnBarcode').addEventListener('click', async function () {
    const code = document.getElementById('barcodeInput').value.trim();
    if (!code) return;
    const res = await api('GET', '/inventory/products/by-barcode/' + encodeURIComponent(code));
    if (res.ok && res.data) {
      addProductToCart(res.data);
      document.getElementById('barcodeInput').value = '';
      renderQuickGrid();
      toast(t('Added', 'تمت الإضافة') + ' ' + (res.data.sku || res.data.name), 'ok');
      return;
    }
    const s = await api('GET', '/inventory/products?q=' + encodeURIComponent(code));
    const items = s.ok
      ? Array.isArray(s.data)
        ? s.data
        : (s.data && (s.data.items || s.data.products)) || []
      : [];
    const hit = items.find(function (p) {
      return p && p.isActive !== false && !p.isArchived;
    });
    if (hit) {
      addProductToCart(hit);
      document.getElementById('barcodeInput').value = '';
      renderQuickGrid();
      toast(t('Added', 'تمت الإضافة') + ' ' + (hit.name || hit.sku), 'ok');
      return;
    }
    toast(problemMessage(res.data, res.status) || t('No product found.', 'مفيش منتج.'), 'err');
  });
  document.getElementById('barcodeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnBarcode').click();
    }
  });

  document.getElementById('barcodeInput').addEventListener('input', function (e) {
    const q = e.target.value.trim();
    const hidden = document.getElementById('productSearch');
    if (hidden) hidden.value = q;
    renderQuickGrid();
    clearTimeout(productSearchTimer);
    const list = document.getElementById('productResults');
    if (q.length < 1) {
      list.innerHTML = '';
      list.classList.remove('show');
      return;
    }
    productSearchTimer = setTimeout(async function () {
      const res = await api(
        'GET',
        '/inventory/products?q=' + encodeURIComponent(q)
      );
      if (!res.ok) {
        list.innerHTML = '<div class="muted">' + esc(problemMessage(res.data, res.status)) + '</div>';
        list.classList.add('show');
        return;
      }
      const items = Array.isArray(res.data)
        ? res.data
        : (res.data && (res.data.items || res.data.products)) || [];
      const active = items.filter(function (p) {
        return !p.isArchived && p.isActive !== false;
      });
      if (!active.length) {
        list.innerHTML = '<div class="muted">' + esc(t('No products', 'مفيش منتجات')) + '</div>';
        list.classList.add('show');
        return;
      }
      list.innerHTML = active
        .map(function (p) {
          return (
            '<button type="button" class="prod-hit" data-pid="' +
            esc(p.id) +
            '">' +
            productThumbHtml(p.imageUrl || p.relativeUrl, 'prod-hit-thumb') +
            '<div class="prod-hit-body">' +
            '<div class="prod-hit-name">' +
            esc(p.name) +
            '</div>' +
            '<div class="prod-hit-meta">' +
            esc(p.sku || '') +
            (p.nameAr ? ' · ' + esc(p.nameAr) : '') +
            '</div>' +
            '</div>' +
            '<div class="prod-hit-price">' +
            esc(money(p.sellPrice)) +
            '</div>' +
            '</button>'
          );
        })
        .join('');
      list.classList.add('show');
      list.querySelectorAll('[data-pid]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const p = active.find(function (x) {
            return x.id === btn.getAttribute('data-pid');
          });
          if (p) {
            addProductToCart(p);
            list.innerHTML = '';
            list.classList.remove('show');
            document.getElementById('barcodeInput').value = '';
            renderQuickGrid();
          }
        });
      });
    }, 280);
  });

  function estimateTotal() {
    if (!retailCart.length) return null;
    return retailCart.reduce(function (s, l) {
      return s + Number(l.qty) * Number(l.unitPrice);
    }, 0);
  }

  function updateEstimate() {
    const total = estimateTotal();
    const text = total == null ? '—' : money(total);
    document.getElementById('estTotal').textContent = text;
    const finish = document.getElementById('finishTotal');
    if (finish) finish.textContent = text;
    // Desk default: first cash leg gets the remaining total so staff don't invent numbers.
    if (total != null && total >= 0 && !document.getElementById('partialOpt').checked) {
      const firstAmt = document.querySelector('#payLegs .pay-leg input[type="number"]');
      if (firstAmt && document.querySelectorAll('#payLegs .pay-leg').length === 1) {
        firstAmt.value = String(Number(total.toFixed(2)));
        updatePaidSum();
      }
    }
  }

  document.getElementById('btnAddLeg').onclick = () => addLeg('cash', '');
  const discAmtEl = document.getElementById('discAmount');
  if (discAmtEl) discAmtEl.addEventListener('input', updateEstimate);
  document.getElementById('partialOpt').addEventListener('change', (e) => {
    document.getElementById('dueDateWrap').style.display = e.target.checked ? 'flex' : 'none';
  });

  function updateSellEnabled() {
    const cash = document.getElementById('btnPayCash');
    const card = document.getElementById('btnPayCard');
    function setQuick(disabled) {
      if (cash) cash.disabled = disabled;
      if (card) card.disabled = disabled;
    }
    if (!canSell || !shiftOk || !inventoryOn) {
      document.getElementById('btnSell').disabled = true;
      setQuick(true);
      return;
    }
    const wh = document.getElementById('warehouseSelect');
    const cartOk =
      retailCart.length > 0 &&
      retailCart.every(function (l) {
        return l.qty > 0 && wh && wh.value;
      });
    document.getElementById('btnSell').disabled = !cartOk;
    setQuick(!cartOk);
    updateTakeLabel();
    syncTicketChrome();
  }

  function setSinglePayment(method, amount) {
    const wrap = document.getElementById('payLegs');
    wrap.innerHTML = '';
    addLeg(method, amount != null ? String(Number(amount.toFixed(2))) : '');
    document.getElementById('partialOpt').checked = false;
    document.getElementById('dueDateWrap').style.display = 'none';
    updatePaidSum();
  }

  // ── Submit retail sale ────────────────────────────────────────
  function posRefundButtonHtml() {
    var RA = window.GfpRefundAction;
    // Always show when staff can request — do not hide just because the feature cache is stale/false.
    if (!RA || typeof RA.canRequest !== 'function' || !RA.canRequest()) return '';
    return (
      '<button type="button" class="btn secondary full" id="btnRefundSale">' +
      '<i class="ti ti-receipt-refund"></i> ' +
      esc(t('Refund', 'استرداد')) +
      '</button>'
    );
  }

  function wirePosRefundAction(sale, lines) {
    var btn = document.getElementById('btnRefundSale');
    var RA = window.GfpRefundAction;
    if (!btn || !RA || !sale || !sale.saleId) return;
    btn.onclick = function () {
      RA.open({
        saleId: sale.saleId,
        saleTotal: sale.totals && sale.totals.total,
        paid: sale.totals && sale.totals.paid,
        lines: lines || []
      });
    };
  }

  async function submitSale() {
    if (!shiftOk) {
      toast(t('Open a cash shift first, then complete this payment.', 'افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.'), 'err');
      return;
    }
    if (!inventoryOn) {
      toast(t('Inventory feature required for retail.', 'ميزة المخزون مطلوبة لبيع المنتجات.'), 'err');
      return;
    }
    if (!retailCart.length) {
      toast(t('Add products to the cart.', 'ضيف منتجات للسلة.'), 'err');
      return;
    }
    const warehouseId = document.getElementById('warehouseSelect').value;
    if (!warehouseId) {
      toast(t('Select a warehouse.', 'اختار مستودع.'), 'err');
      return;
    }
    for (let i = 0; i < retailCart.length; i++) {
      const l = retailCart[i];
      if (!l.allowFractional && Math.floor(l.qty) !== Number(l.qty)) {
        toast(l.sku + ': ' + t('fractional qty not allowed', 'الكسور مش مسموحة'), 'err');
        return;
      }
    }

    let payments = readPayments();
    const partial = document.getElementById('partialOpt').checked;
    const dueDate = document.getElementById('dueDate').value;
    const total = estimateTotal();
    if (!payments.length && total != null && total > 0) {
      setSinglePayment(payMethod === 'card_paymob' ? 'card_paymob' : 'cash', total);
      payments = readPayments();
    }

    // Anonymous retail sale — no memberId / newMember from POS
    const body = {
      warehouseId: warehouseId,
      lines: retailCart.map(function (l) {
        return {
          lineType: 'retail',
          productId: l.productId,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice)
        };
      }),
      payments: payments
    };

    if (!payments.length) {
      toast(t('Add a payment amount.', 'ضيف مبلغ الدفع.'), 'err');
      return;
    }
    if (partial) {
      if (!dueDate) {
        toast(t('Due date required for partial payment.', 'تاريخ الاستحقاق مطلوب للدفع الجزئي.'), 'err');
        return;
      }
      body.partialPayment = { dueDate: dueDate };
    }

    await postSale(body);
  }

  async function postSale(body) {
    const key = ensureIdemKey();
    const box = document.getElementById('saleResult');
    box.style.display = 'block';
    box.className = 'result';
    box.textContent = t('Submitting…', 'جاري الإرسال…');

    const res = await api('POST', '/sales', body, { 'X-Idempotency-Key': key });

    if (!res.ok) {
      const title = res.data && res.data.title;
      const detail = res.data && (res.data.detail || res.data.message || res.data.error);
      if (title === 'PROMO_RACE_LOST') {
        promoPreview = null;
        document.getElementById('promoCode').value = '';
        document.getElementById('promoStatus').textContent = t(
          'Promo cleared — check the code again, then retry.',
          'اتمسح كود الخصم — تأكد من الكود وحاول تاني.'
        );
        clearIdemKey();
        ensureIdemKey();
      }
      if (title === 'OPEN_SHIFT_REQUIRED') {
        shiftOk = false;
        setShiftGateBanner(true);
        document.getElementById('posWorkspace').classList.add('blocked');
      }
      if (title === 'FEATURE_DISABLED') {
        setSalesDisabledBanner(true);
      }
      if (title === 'INSUFFICIENT_STOCK' || title === 'STOCK_UNSELLABLE_EXPIRED') {
        showStockBlock(title, detail);
      } else {
        clearStockBlock();
      }
      box.className = 'result err';
      box.textContent = problemMessage(res.data, res.status);
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }

    clearStockBlock();
    setSalesDisabledBanner(false);
    const sale = res.data;
    clearIdemKey();
    try {
      if (globalThis.GfpAnalytics && typeof globalThis.GfpAnalytics.track === 'function') {
        globalThis.GfpAnalytics.track('sale_created', {
          isReplay: !!(sale && sale.isReplay),
          hasRetail: retailCart && retailCart.length > 0
        });
        if (retailCart && retailCart.length > 0) {
          globalThis.GfpAnalytics.track('inventory_sale_completed', {
            isReplay: !!(sale && sale.isReplay)
          });
        }
      }
    } catch (_) { /* ignore */ }
    const due = sale.totals && Number(sale.totals.amountDue);
    const warnList = (sale.warnings || []).filter(Boolean);
    const refundLines = retailCart.map(function (l) {
      return {
        description: l.name || l.sku || t('Item', 'صنف'),
        lineTotal: Number(l.unitPrice || 0) * Number(l.qty || 0)
      };
    });
    box.className = 'result desk-receipt' + (warnList.length ? ' warn' : '');
    box.innerHTML =
      '<div class="receipt-ok"><i class="ti ti-circle-check"></i> <strong>' +
      esc(t('Sale complete', 'تم البيع')) +
      '</strong></div>' +
      (sale.isReplay
        ? '<div class="muted">' +
          esc(t('Already recorded — not charged twice.', 'متسجلة قبل كده — متتحسبتش مرتين.')) +
          '</div>'
        : '') +
      '<div class="receipt-money">' +
      esc(t('Total', 'الإجمالي')) +
      ' <strong>' +
      esc(money(sale.totals && sale.totals.total)) +
      '</strong><br>' +
      esc(t('Paid', 'المدفوع')) +
      ' <strong>' +
      esc(money(sale.totals && sale.totals.paid)) +
      '</strong>' +
      (due > 0
        ? '<br>' +
          esc(t('Outstanding', 'المستحق')) +
          ' <strong class="due-amt">' +
          esc(money(due)) +
          '</strong>' +
          '<div class="muted" style="margin-top:6px">' +
          esc(t(
            'This sale still has an outstanding balance. Open the member to see their unpaid sales.',
            'البيع ده لسه عليه مبلغ مستحق. افتح العضو عشان تشوف المبيعات غير المدفوعة.'
          )) +
          '</div>'
        : '') +
      '</div>' +
      (warnList.length ? '<div class="muted">' + esc(warnList.join(' · ')) + '</div>' : '') +
      '<div id="invoiceReadyLine" class="muted">' +
      esc(t('Preparing invoice for print…', 'بنحضّر الفاتورة للطباعة…')) +
      '</div>' +
      '<div class="receipt-print-row">' +
      '<button type="button" class="btn primary full" id="btnPrintReceipt" disabled>' +
      '<i class="ti ti-printer"></i> ' +
      esc(t('Print receipt', 'اطبع الإيصال')) +
      '</button>' +
      posRefundButtonHtml() +
      '<button type="button" class="btn secondary full" id="btnStartNextSale">' +
      esc(t('Next sale', 'بيع جديد')) +
      '</button></div>';

    retailCart = [];
    renderRetailCart();
    wirePosRefundAction(sale, refundLines);
    if (sale.invoiceStatus === 'skipped' || sale.invoiceStatus === 'not_applicable') {
      const statusEl = document.getElementById('invoiceReadyLine');
      const printBtn = document.getElementById('btnPrintReceipt');
      if (statusEl) {
        statusEl.textContent = t('No invoice for this sale (nothing to print).', 'مفيش فاتورة للبيع ده (مفيش طباعة).');
      }
      if (printBtn) printBtn.disabled = true;
      const nextBtn = document.getElementById('btnStartNextSale');
      if (nextBtn) {
        nextBtn.onclick = function () {
          document.getElementById('btnReset').click();
        };
      }
    } else {
      wireRetailPrintActions(sale);
    }

    toast(
      sale.isReplay
        ? t('Already recorded — not charged twice.', 'متسجلة قبل كده — متتحسبتش مرتين.')
        : t('Sale completed.', 'تم البيع.'),
      'ok'
    );
  }

  document.getElementById('btnSell').addEventListener('click', function () {
    submitSale();
  });
  const btnPayCash = document.getElementById('btnPayCash');
  if (btnPayCash) {
    btnPayCash.addEventListener('click', function () {
      const total = estimateTotal();
      if (total == null || !(total > 0)) {
        toast(t('Add products first.', 'ضيف منتجات الأول.'), 'err');
        return;
      }
      setSinglePayment('cash', total);
      markPayMethod('cash');
    });
  }
  const btnPayCard = document.getElementById('btnPayCard');
  if (btnPayCard) {
    btnPayCard.addEventListener('click', function () {
      const total = estimateTotal();
      if (total == null || !(total > 0)) {
        toast(t('Add products first.', 'ضيف منتجات الأول.'), 'err');
        return;
      }
      setSinglePayment('card_paymob', total);
      markPayMethod('card_paymob');
    });
  }

  document.getElementById('btnReset').addEventListener('click', () => {
    closePosPrint();
    clearIdemKey();
    clearStockBlock();
    promoPreview = null;
    retailCart = [];
    const promoEl = document.getElementById('promoCode');
    if (promoEl) promoEl.value = '';
    const discEl = document.getElementById('discAmount');
    if (discEl) discEl.value = '0';
    const discReason = document.getElementById('discReason');
    if (discReason) discReason.value = '';
    document.getElementById('partialOpt').checked = false;
    document.getElementById('dueDateWrap').style.display = 'none';
    document.getElementById('payLegs').innerHTML = '';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('productSearch').value = '';
    document.getElementById('productResults').innerHTML = '';
    addLeg('cash', '');
    document.getElementById('saleResult').style.display = 'none';
    ensureIdemKey();
    renderRetailCart();
    updateEstimate();
    updateSellEnabled();
  });

  const btnPosPrintClose = document.getElementById('btnPosPrintClose');
  if (btnPosPrintClose) btnPosPrintClose.onclick = closePosPrint;
  const btnPosPrintDo = document.getElementById('btnPosPrintDo');
  if (btnPosPrintDo) {
    btnPosPrintDo.onclick = function () {
      const frame = document.getElementById('posPrintFrame');
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (_) {
        toast(t('Print failed — try again.', 'فشلت الطباعة — حاول تاني.'), 'err');
      }
    };
  }
  const posPrintOverlay = document.getElementById('posPrintOverlay');
  if (posPrintOverlay) {
    posPrintOverlay.addEventListener('click', function (e) {
      if (e.target === posPrintOverlay) closePosPrint();
    });
  }

  // Debt / older-sale balance collection UI removed from Sale.
  // Backend POST /api/sales/{id}/payments remains for collecting outstanding on a sale.

  // boot — retail-only POS
  if (!canSell) {
    toast(t('You need permission to sell.', 'محتاج صلاحية البيع.'), 'err');
    document.getElementById('btnSell').disabled = true;
  }
  addLeg('cash', '');
  markPayMethod('cash');
  ensureIdemKey();
  setPosMode('retail', { skipUrl: true });
  Promise.all([checkShift(), probeInventoryAndUi(), refreshSalesFeatureBanner()])
    .then(function () {
      setPosMode('retail');
      applyLocaleBits();
      const chip = document.getElementById('statusShiftChip');
      if (chip && chip.dataset.shiftLabel) {
        syncStatusShift(
          chip.dataset.shiftLabel,
          chip.dataset.shiftOk === '1' ? true : chip.dataset.shiftOk === '0' ? false : null
        );
      }
      syncStatusWarehouse();
      syncTicketChrome();
    })
    .catch(function () {
      setPosMode('retail');
      applyLocaleBits();
    });

  window.addEventListener('gfp:locale', function () {
    applyLocaleBits();
    const chip = document.getElementById('statusShiftChip');
    if (chip && chip.dataset.shiftLabel) {
      syncStatusShift(
        chip.dataset.shiftLabel,
        chip.dataset.shiftOk === '1' ? true : chip.dataset.shiftOk === '0' ? false : null
      );
    }
    syncStatusWarehouse();
    document.querySelectorAll('#payLegs .pay-leg select').forEach(function (sel) {
      const v = sel.value;
      Array.from(sel.options).forEach(function (opt) {
        opt.textContent = methodLabel(opt.value);
      });
      sel.value = v;
    });
    renderRetailCart();
    const sellBtn = document.getElementById('btnSell');
    if (sellBtn) {
      sellBtn.innerHTML =
        '<i class="ti ti-check"></i> <span>' +
        esc(t('Complete sale', 'تمّم البيع')) +
        '</span>';
    }
  });
})();
