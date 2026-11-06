/**
 * Sale-centered refund UI. Domain APIs stay POST/GET /refunds.
 * Never ask staff to type a Sale GUID as the primary flow.
 */
(function (global) {
  'use strict';

  function t(en, ar) {
    if (global.GfpI18n && typeof global.GfpI18n.tLabel === 'function') {
      return global.GfpI18n.tLabel(en, ar);
    }
    try {
      return (localStorage.getItem('gfp_locale') || 'en') === 'ar' ? ar : en;
    } catch (e) {
      return en;
    }
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

  function dt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? String(iso)
      : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function problemMessage(data, status, error) {
    if (error && error.code && mapCode(error.code)) return mapCode(error.code);
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { /* keep */ }
    }
    if (!data || typeof data !== 'object') {
      if (error && error.message && !/^Request failed/i.test(error.message)) return error.message;
      return 'Request failed (' + status + ')';
    }
    var title = data.title || data.Title || (error && error.code) || '';
    var detail = data.detail || data.Detail || data.message || '';
    var mapped = mapCode(title);
    if (mapped) return mapped;
    if (detail && detail.indexOf(' / ') !== -1) return detail.split(' / ')[0].trim();
    return detail || title || (error && error.message) || ('Request failed (' + status + ')');
  }

  function mapCode(title) {
    var map = {
      GATEWAY_REFUND_UNSUPPORTED: t('Gateway refunds are not supported. Use cash or account credit.', 'الاسترداد عبر البوابة غير مدعوم. استخدم كاش أو رصيد الحساب.'),
      OPEN_SHIFT_REQUIRED: t('Open a cash-drawer shift before cash refunds.', 'افتح وردية الصندوق قبل استرداد كاش.'),
      NOT_AWAITING_APPROVAL: t('This refund is not awaiting approval.', 'طلب الاسترداد هذا ليس بانتظار الموافقة.'),
      SALE_FULLY_REFUNDED: t('This sale is already fully refunded.', 'تم استرداد قيمة هذا البيع بالكامل.'),
      SALE_NOT_FOUND: t('Sale not found.', 'عملية البيع غير موجودة.'),
      REFUND_NOT_FOUND: t('Refund not found.', 'طلب الاسترداد غير موجود.'),
      FEATURE_DISABLED: t('Refunds are not included in this gym plan. Upgrade to Growth or ask platform support to enable refunds.', 'الاسترداد غير مفعّل في باقة هذا النادي. رقّي إلى Growth أو اطلب تفعيل الاسترداد من المنصة.'),
      REFUND_EXCEEDS_REMAINDER: t('Amount exceeds the refundable remainder.', 'المبلغ يتجاوز القابل للاسترداد.'),
      INSUFFICIENT_CREDIT: t('Insufficient account credit.', 'رصيد الحساب غير كافٍ.'),
      ORIGINAL_SALE_MOVEMENT_MISSING: t('Cannot restore stock — original sale stock movement is missing.', 'مش قادرين نرجّع المخزون — حركة البيع الأصلية ناقصة.'),
      STOCK_RESTORE_FAILED: t('Refund money path failed while restoring retail stock.', 'فشل إرجاع مخزون التجزئة مع الاسترداد.')
    };
    return title ? map[title] || null : null;
  }

  function refundsEnabled() {
    var F = global.GfpFeatures;
    if (!F || typeof F.isModuleAvailable !== 'function') return true;
    var reg = F.readCache && F.readCache();
    // No cache yet → show Refund UI; API still enforces FEATURE_DISABLED.
    if (!reg || reg.refunds === undefined) return true;
    return !!reg.refunds;
  }

  function canRequest() {
    var A = global.GfpAuthz;
    if (!A) return false;
    return A.useCan('payments.refund.request') || A.useCanRole('ManagerOrAbove');
  }

  function canApprove() {
    var A = global.GfpAuthz;
    if (!A) return false;
    return A.useCan('payments.refund.approve') || A.useCanRole('OwnerOnly');
  }

  function isOwner() {
    var A = global.GfpAuthz;
    return !!(A && A.useCanRole('OwnerOnly'));
  }

  function myUserId() {
    try {
      var u = JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || 'null');
      return (u && (u.id || u.userId)) || '';
    } catch (e) {
      return '';
    }
  }

  async function api(method, path, body) {
    if (global.GfpApi) {
      if (method === 'GET') return global.GfpApi.get(path);
      if (method === 'POST') return global.GfpApi.post(path, body);
    }
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    var tok = localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
    if (tok) opts.headers.Authorization = 'Bearer ' + tok;
    if (body !== undefined) opts.body = JSON.stringify(body);
    var base = global.API_BASE || '/api';
    var res = await fetch(base + path, opts);
    if (res.status === 401) {
      // Clear the stale session before redirecting - login/index.html's "already logged in" check
      // only looks at whether gfp_access_token/gfp_expires_at are still present, not whether the
      // server still accepts them, so leaving them in place bounces straight back here and loops.
      try {
        ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach(function (k) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
      } catch (e) { /* ignore */ }
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('json') !== -1) data = await res.json().catch(function () { return null; });
    return { ok: res.ok, status: res.status, data: data };
  }

  var state = {
    saleId: '',
    saleTotal: 0,
    paid: null,
    memberName: '',
    invoiceNumber: '',
    lines: [],
    refunds: [],
    remainder: 0
  };

  function ensureDom() {
    if (document.getElementById('gfpRefundOverlay')) return;
    var wrap = document.createElement('div');
    wrap.id = 'gfpRefundOverlay';
    wrap.className = 'gfp-refund-overlay';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="gfp-refund-box" role="dialog" aria-labelledby="gfpRefundTitle">' +
      '<div class="gfp-refund-hdr">' +
      '<h3 id="gfpRefundTitle"></h3>' +
      '<button type="button" class="gfp-refund-x" id="gfpRefundClose" aria-label="Close"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="gfp-refund-body" id="gfpRefundBody"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) close();
    });
    document.getElementById('gfpRefundClose').onclick = close;
  }

  function close() {
    var el = document.getElementById('gfpRefundOverlay');
    if (el) el.hidden = true;
  }

  function executedSum(items) {
    return (items || []).reduce(function (acc, r) {
      var st = String(r.status || '').toLowerCase();
      if (st === 'executed') return acc + Number(r.amount || 0);
      return acc;
    }, 0);
  }

  function stockHint(amount, remainder) {
    var amt = Number(amount);
    var rem = Number(remainder);
    if (!(rem > 0)) return '';
    if (amt >= rem - 0.009) {
      return (
        '<p class="gfp-refund-hint">' +
        esc(t(
          'A full refund restores retail stock if this sale included products, and cancels any membership bought on this sale.',
          'الاسترداد الكامل يرجّع مخزون المنتجات لو البيع فيه منتجات، ويلغي أي اشتراك اتشترى في البيع ده.'
        )) +
        '</p>'
      );
    }
    return (
      '<p class="gfp-refund-hint">' +
      esc(t(
        'Partial refunds do not restore retail stock.',
        'الاسترداد الجزئي لا يرجّع مخزون التجزئة.'
      )) +
      '</p>'
    );
  }

  function render() {
    var body = document.getElementById('gfpRefundBody');
    var title = document.getElementById('gfpRefundTitle');
    if (!body || !title) return;
    title.textContent = t('Refund sale', 'استرداد بيع');

    if (!refundsEnabled()) {
      body.innerHTML =
        '<div class="gfp-refund-off">' +
        '<strong>' +
        esc(t('Refunds unavailable', 'الاسترداد غير متاح')) +
        '</strong><p>' +
        esc(t('Refund processing is currently disabled for this gym.', 'معالجة الاسترداد مقفولة لهذا النادي.')) +
        '</p></div>';
      return;
    }

    var lines = state.lines || [];
    var linesHtml = '';
    if (lines.length) {
      linesHtml =
        '<ul class="gfp-refund-lines">' +
        lines
          .map(function (ln) {
            return (
              '<li><span>' +
              esc(ln.description || ln.productName || t('Item', 'صنف')) +
              '</span><span>' +
              esc(money(ln.lineTotal != null ? ln.lineTotal : ln.unitPrice)) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul>';
    }

    var already = executedSum(state.refunds);
    state.remainder = Math.max(0, Number(state.saleTotal || 0) - already);
    var canReq = canRequest() && state.remainder > 0;
    var formHtml = '';
    if (canReq) {
      formHtml =
        '<form id="gfpRefundForm" class="gfp-refund-form">' +
        '<label>' +
        esc(t('Refund amount', 'مبلغ الاسترداد')) +
        '<input type="number" id="gfpRfAmount" step="0.01" min="0.01" required value="' +
        esc(String(state.remainder.toFixed(2))) +
        '"></label>' +
        '<label>' +
        esc(t('Method', 'الطريقة')) +
        '<select id="gfpRfMethod">' +
        '<option value="cash">' +
        esc(t('Cash', 'كاش')) +
        '</option>' +
        '<option value="credit">' +
        esc(t('Account credit', 'رصيد الحساب')) +
        '</option>' +
        '</select></label>' +
        '<label class="gfp-refund-span">' +
        esc(t('Reason', 'السبب')) +
        '<textarea id="gfpRfReason" rows="2" required></textarea></label>' +
        '<div class="gfp-refund-span" id="gfpRfStockHint">' +
        stockHint(state.remainder, state.remainder) +
        '</div>' +
        '<div class="gfp-refund-span gfp-refund-actions">' +
        '<button type="submit" class="btn primary">' +
        esc(t('Submit refund request', 'إرسال طلب الاسترداد')) +
        '</button>' +
        '<button type="button" class="btn secondary" id="gfpRfCancel">' +
        esc(t('Cancel', 'إلغاء')) +
        '</button>' +
        '</div></form>';
    } else if (canRequest() && state.remainder <= 0) {
      formHtml =
        '<p class="muted">' +
        esc(t('This sale is fully refunded.', 'البيع ده استُرد بالكامل.')) +
        '</p>';
    }

    var hist = '';
    if (canApprove()) {
      var items = state.refunds || [];
      if (!items.length) {
        hist =
          '<p class="muted">' +
          esc(t('No refund history on this sale.', 'مفيش سجل استرداد على البيع ده.')) +
          '</p>';
      } else {
        hist =
          '<ul class="gfp-refund-hist">' +
          items
            .map(function (r) {
              var actions = '';
              if (String(r.status).toLowerCase() === 'requested') {
                var selfReq = r.requestedByUserId && myUserId() && String(r.requestedByUserId) === String(myUserId());
                if (selfReq && !isOwner()) {
                  actions =
                    '<span class="muted">' +
                    esc(t('Ask another approver', 'اطلب معتمد تاني')) +
                    '</span>';
                } else {
                  actions =
                    '<button type="button" class="btn secondary" data-approve="' +
                    esc(r.id) +
                    '">' +
                    esc(t('Approve', 'اعتماد')) +
                    '</button> <button type="button" class="btn ghost" data-reject="' +
                    esc(r.id) +
                    '">' +
                    esc(t('Reject', 'رفض')) +
                    '</button>';
                }
              }
              return (
                '<li><div><strong>' +
                esc(money(r.amount)) +
                '</strong> · ' +
                esc(r.method) +
                ' · <span class="st ' +
                esc(r.status) +
                '">' +
                esc(r.status) +
                '</span>' +
                (r.stockRestored
                  ? ' <span class="badge-stock">' + esc(t('Stock restored', 'تم إرجاع المخزون')) + '</span>'
                  : '') +
                '<div class="muted">' +
                esc(dt(r.createdAtUtc)) +
                (r.reason ? ' · ' + esc(r.reason) : '') +
                (r.rejectionNote ? ' · ' + esc(r.rejectionNote) : '') +
                '</div></div><div>' +
                actions +
                '</div></li>'
              );
            })
            .join('') +
          '</ul>';
      }
    }

    body.innerHTML =
      '<div class="gfp-refund-who">' +
      esc(state.memberName || t('Sale', 'بيع')) +
      (state.invoiceNumber ? '<span class="muted"> · ' + esc(state.invoiceNumber) + '</span>' : '') +
      '</div>' +
      linesHtml +
      '<div class="gfp-refund-kpis">' +
      '<div><span>' +
      esc(t('Original sale', 'البيع الأصلي')) +
      '</span><strong>' +
      esc(money(state.saleTotal)) +
      '</strong></div>' +
      (state.paid != null
        ? '<div><span>' +
          esc(t('Paid', 'المدفوع')) +
          '</span><strong>' +
          esc(money(state.paid)) +
          '</strong></div>'
        : '') +
      '<div><span>' +
      esc(t('Already refunded', 'تم استرداده')) +
      '</span><strong>' +
      esc(money(already)) +
      '</strong></div>' +
      '<div><span>' +
      esc(t('Refundable', 'قابل للاسترداد')) +
      '</span><strong>' +
      esc(money(state.remainder)) +
      '</strong></div>' +
      '</div>' +
      formHtml +
      (hist
        ? '<h4>' + esc(t('Refund history', 'سجل الاسترداد')) + '</h4>' + hist
        : '') +
      (rejectId
        ? '<div class="gfp-refund-off" id="gfpRfRejectBox"><label>' +
          esc(t('Rejection note', 'ملاحظة الرفض')) +
          '<input id="gfpRfRejectNote" required></label>' +
          '<div class="gfp-refund-actions" style="margin-top:8px">' +
          '<button type="button" class="btn danger" id="gfpRfRejectGo">' +
          esc(t('Reject', 'رفض')) +
          '</button>' +
          '<button type="button" class="btn secondary" id="gfpRfRejectNo">' +
          esc(t('Cancel', 'إلغاء')) +
          '</button></div></div>'
        : '');

    var form = document.getElementById('gfpRefundForm');
    if (form) {
      var amt = document.getElementById('gfpRfAmount');
      var hint = document.getElementById('gfpRfStockHint');
      if (amt && hint) {
        amt.addEventListener('input', function () {
          hint.innerHTML = stockHint(amt.value, state.remainder);
        });
      }
      form.onsubmit = submitRequest;
      var cancel = document.getElementById('gfpRfCancel');
      if (cancel) cancel.onclick = close;
    }
    body.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.onclick = function () {
        approveRefund(btn.getAttribute('data-approve'));
      };
    });
    body.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.onclick = function () {
        rejectRefund(btn.getAttribute('data-reject'));
      };
    });
    var rjGo = document.getElementById('gfpRfRejectGo');
    var rjNo = document.getElementById('gfpRfRejectNo');
    if (rjGo) rjGo.onclick = confirmReject;
    if (rjNo)
      rjNo.onclick = function () {
        rejectId = null;
        render();
      };
  }

  async function loadRefunds() {
    if (!canApprove() || !state.saleId) {
      state.refunds = [];
      return;
    }
    var res = await api('GET', '/refunds?saleId=' + encodeURIComponent(state.saleId));
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') state.refunds = [];
      else state.refunds = [];
      return;
    }
    var d = res.data;
    state.refunds = Array.isArray(d) ? d : (d && d.items) || [];
  }

  async function submitRequest(e) {
    e.preventDefault();
    var amount = Number(document.getElementById('gfpRfAmount').value);
    var method = document.getElementById('gfpRfMethod').value;
    var reason = document.getElementById('gfpRfReason').value.trim();
    if (method === 'gateway') {
      toast(problemMessage({ title: 'GATEWAY_REFUND_UNSUPPORTED' }, 409), 'err');
      return;
    }
    var res = await api('POST', '/refunds', {
      saleId: state.saleId,
      amount: amount,
      method: method,
      reason: reason
    });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status, res.error), 'err');
      return;
    }
    toast(t('Refund requested.', 'تم طلب الاسترداد.'), 'ok');
    await loadRefunds();
    render();
  }

  async function approveRefund(id) {
    var res = await api('POST', '/refunds/' + id + '/approve');
    if (!res.ok) {
      toast(problemMessage(res.data, res.status, res.error), 'err');
      return;
    }
    var refund = res.data || {};
    toast(
      refund.stockRestored
        ? t('Retail stock restored.', 'تم إرجاع مخزون التجزئة.')
        : t('Refund approved.', 'تم اعتماد الاسترداد.'),
      'ok'
    );
    await loadRefunds();
    render();
  }

  var rejectId = null;

  async function rejectRefund(id) {
    rejectId = id;
    render();
  }

  async function confirmReject() {
    var noteEl = document.getElementById('gfpRfRejectNote');
    var note = noteEl ? noteEl.value.trim() : '';
    if (!note || !rejectId) {
      toast(t('Rejection note required.', 'ملاحظة الرفض مطلوبة.'), 'err');
      return;
    }
    var res = await api('POST', '/refunds/' + rejectId + '/reject', { note: note });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status, res.error), 'err');
      return;
    }
    rejectId = null;
    toast(t('Refund rejected.', 'تم رفض الاسترداد.'), 'ok');
    await loadRefunds();
    render();
  }

  async function open(opts) {
    opts = opts || {};
    if (!opts.saleId) {
      toast(t('This document is not linked to a sale.', 'المستند ده مش مربوط ببيع.'), 'err');
      return;
    }
    if (!refundsEnabled()) {
      toast(
        t(
          'Refunds are not enabled for this gym plan yet. Restart the API after the latest update, or enable Refunds in Platform Console.',
          'الاسترداد غير مفعّل لباقة هذا النادي. أعد تشغيل الـ API بعد التحديث، أو فعّل Refunds من Platform Console.'
        ),
        'err'
      );
      return;
    }
    ensureDom();
    state.saleId = String(opts.saleId);
    state.saleTotal = Number(opts.saleTotal || 0);
    state.paid = opts.paid != null ? Number(opts.paid) : null;
    state.memberName = opts.memberName || '';
    state.invoiceNumber = opts.invoiceNumber || '';
    state.lines = Array.isArray(opts.lines) ? opts.lines : [];
    state.refunds = [];
    rejectId = null;
    document.getElementById('gfpRefundOverlay').hidden = false;
    render();
    await loadRefunds();
    render();
  }

  global.GfpRefundAction = {
    open: open,
    close: close,
    isEnabled: refundsEnabled,
    canRequest: canRequest,
    canApprove: canApprove
  };
})(typeof window !== 'undefined' ? window : globalThis);
