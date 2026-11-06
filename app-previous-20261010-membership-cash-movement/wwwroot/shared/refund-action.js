/**
 * Sale-centered refund UI. Domain APIs stay POST/GET /refunds.
 * Never ask staff to type a Sale GUID as the primary flow.
 *
 * Partial-Refund COGS design: every new desk refund returns selected products (per-line
 * quantity + condition). The server owns every financial figure and derives the goods value
 * from the sale's immutable snapshots at request time.
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
    var v = Number(n); var s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)); return '⁨' + (v < 0 ? '-EGP ' : 'EGP ') + s + '⁩';
  }

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
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
      STOCK_RESTORE_FAILED: t('Refund money path failed while restoring retail stock.', 'فشل إرجاع مخزون التجزئة مع الاسترداد.'),
      REFUND_LINES_INVALID: t('The returned products or quantities are not valid for this sale.', 'المنتجات أو الكميات المرتجعة غير صالحة لهذا البيع.'),
      REFUND_AMOUNT_MISMATCH: t('The refund amount does not match the returned products.', 'مبلغ الاسترداد لا يطابق المنتجات المرتجعة.'),
      REFUND_SOURCE_INVALID: t('The selected payment is not a valid source for this refund.', 'الدفعة المحددة ليست مصدرًا صالحًا للاسترداد.'),
      REFUND_SOURCE_MISSING: t('No trusted payment evidence matches the refund method.', 'لا توجد وثيقة دفع موثوقة تطابق طريقة الاسترداد.'),
      REFUND_SOURCE_REQUIRED: t('Select the exact payment leg for this split sale.', 'حدد الدفعة المقصودة لهذا البيع المقسوم.'),
      IDEMPOTENCY_CONFLICT: t('This refund was already submitted with different details.', 'تم إرسال هذا الاسترداد مسبقًا بتفاصيل مختلفة.'),
      IDEMPOTENCY_IN_PROGRESS: t('A request with this key is still being processed.', 'طلب بنفس المفتاح لا يزال قيد المعالجة.')
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

  // Owners (and any future role explicitly granted both permissions) should not have to create
  // a request, find it again, then approve it. The API still records those two auditable steps;
  // the desk simply performs them together as one intentional "refund now" action.
  function canExecuteDirectly() {
    return canRequest() && canApprove();
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
    remainder: 0,
    refundable: null
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

  function refundableLines() {
    var rb = state.refundable;
    if (!rb || !rb.hasRetailLines || !Array.isArray(rb.lines)) return [];
    return rb.lines;
  }

  function returnableLines() {
    return refundableLines().filter(function (ln) {
      return Number(ln.remainingQty) > 0;
    });
  }

  // Display-only estimate of the goods amount — the server re-derives the authoritative
  // figure at request time from the sale's immutable snapshots (never trusted from here).
  function estimateGoodsAmount(qtys) {
    var rb = state.refundable;
    if (!rb) return 0;
    var net = 0;
    refundableLines().forEach(function (ln, i) {
      var unitNet = Number(ln.unitNet || 0);
      var prior = Number(ln.returnedQty || 0);
      var qty = i >= 0 && qtys ? Number(qtys[i] || 0) : 0;
      net += round2((prior + qty) * unitNet) - round2(prior * unitNet);
    });
    var taxAmount = Number(rb.taxAmount || 0);
    var netSubtotal = Number(rb.netSubtotal || 0);
    var tax = 0;
    if (taxAmount > 0 && netSubtotal > 0 && net > 0) {
      tax = round2((taxAmount * net) / netSubtotal);
    }
    return round2(net + tax);
  }

  function stockHint() {
    return (
      '<p class="gfp-refund-hint">' +
      esc(
        t(
          'Choose the returned quantities. Resellable items return to stock automatically; damaged items are recorded without increasing stock.',
          'حدد كميات المنتجات المرتجعة. الأصناف القابلة للبيع بترجع للمخزون تلقائيًا، والتالف يُسجل بدون زيادة في المخزون.'
        )
      ) +
      '</p>'
    );
  }

  function productRowsHtml() {
    var rb = state.refundable;
    var rows = returnableLines();
    if (!rb || !rows.length) return '';
    var head =
      '<div class="gfp-refund-pline gfp-refund-pline-head"><span>' +
      esc(t('Product', 'المنتج')) +
      '</span><span>' +
      esc(t('Sold / returned', 'مباع / مرتجع')) +
      '</span><span>' +
      esc(t('Return qty', 'كمية الإرجاع')) +
      '</span><span>' +
      esc(t('Condition', 'الحالة')) +
      '</span></div>';
    var body = rows
      .map(function (ln, i) {
        return (
          '<div class="gfp-refund-pline"><span>' +
          esc(ln.description || t('Item', 'صنف')) +
          '</span><span class="muted">' +
          esc(String(ln.qty) + ' / ' + String(ln.returnedQty || 0)) +
          '</span><span><input type="number" class="gfp-rf-qty" data-idx="' +
          i +
          '" step="1" min="0" max="' +
          esc(String(ln.remainingQty)) +
          '" value="0"></span><span><select class="gfp-rf-disp" data-idx="' +
          i +
          '"><option value="resellable">' +
          esc(t('Resellable', 'قابل للبيع')) +
          '</option><option value="not_resellable">' +
          esc(t('Damaged / not resellable', 'تالف / غير قابل للبيع')) +
          '</option></select></span></div>'
        );
      })
      .join('');
    return (
      '<div class="gfp-refund-products-title"><i class="ti ti-package"></i> ' +
      esc(t('Products to return', 'المنتجات المراد إرجاعها')) +
      '</div><div class="gfp-refund-plines">' +
      head +
      body +
      '<div class="gfp-refund-estimate muted"><span>' +
      esc(t('Estimated goods refund', 'التقدير المبدئي للمرتجع')) +
      '</span><strong id="gfpRfGoodsEstimate">' +
      esc(money(0)) +
      '</strong></div>' +
      '</div>'
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
    var pool = state.refundable && state.refundable.refundablePool != null
      ? Number(state.refundable.refundablePool)
      : Math.max(0, Number(state.saleTotal || 0) - already);
    state.remainder = pool;
    var canReq = canRequest() && state.remainder > 0;
    var canDirect = canExecuteDirectly();
    var formHtml = '';
    if (canReq) {
      var hasProducts = returnableLines().length > 0;
      if (!hasProducts) {
        formHtml =
          '<p class="gfp-refund-off">' +
          esc(t('There are no products left to return for this sale.', 'لا توجد منتجات متبقية قابلة للإرجاع في هذا البيع.')) +
          '</p>';
      } else {
        formHtml =
          '<form id="gfpRefundForm" class="gfp-refund-form">' +
          productRowsHtml() +
          '<label>' +
          esc(t('Refund method', 'طريقة الاسترداد')) +
          '<select id="gfpRfMethod">' +
          '<option value="cash" selected>' +
          esc(t('Cash', 'كاش')) +
          '</option><option value="card_pos">Card / POS</option>' +
          '<option value="credit">' +
          esc(t('Account credit', 'رصيد الحساب')) +
          '</option>' +
          '</select></label>' +
          '<label>' +
          esc(t('Note (optional)', 'ملاحظة (اختيارية)')) +
          '<textarea id="gfpRfReason" rows="2"></textarea></label>' +
          '<div id="gfpRfStockHint">' +
          stockHint() +
          '</div>' +
          '<div class="gfp-refund-actions">' +
          '<button type="submit" class="btn primary">' +
          esc(canDirect ? t('Refund now', 'استرد واعتمد الآن') : t('Send for approval', 'إرسال للاعتماد')) +
          '</button>' +
          '<button type="button" class="btn secondary" id="gfpRfCancel">' +
          esc(t('Cancel', 'إلغاء')) +
          '</button>' +
          '</div></form>';
      }
    } else if (canRequest() && state.remainder <= 0) {
      formHtml =
        '<p class="muted">' +
        esc(t('This sale is fully refunded.', 'البيع ده استُرد بالكامل.')) +
        '</p>';
    }

    var hist = '';
    if (canApprove()) {
      var items = state.refunds || [];
      if (items.length) {
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
              var linesDetail = '';
              if (Array.isArray(r.lines) && r.lines.length) {
                linesDetail =
                  '<div class="muted gfp-refund-rlines">' +
                  r.lines
                    .map(function (l) {
                      return (
                        esc(String(l.qty) + '× ' + (l.description || t('Item', 'صنف'))) +
                        ' · ' +
                        esc(
                          l.disposition === 'resellable'
                            ? t('resellable', 'قابل للبيع')
                            : t('not resellable', 'غير قابل للبيع')
                        )
                      );
                    })
                    .join(' · ') +
                  '</div>';
              } else if (r.noReturn) {
                linesDetail =
                  '<div class="muted gfp-refund-rlines">' +
                  esc(t('Money only — no goods returned', 'نقدي فقط — بدون إرجاع منتجات')) +
                  '</div>';
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
                linesDetail +
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
      '<div class="gfp-refund-kpis gfp-refund-kpis-simple"><div><span>' +
      esc(t('Available to refund now', 'المتاح للاسترداد الآن')) +
      '</span><strong>' +
      esc(money(state.remainder)) +
      '</strong></div></div>' +
      '</div>' +
      formHtml +
      (hist
        ? '<h4>' + esc(t('Refund record', 'سجل الاسترداد')) + '</h4>' + hist
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
      var refreshEstimate = function () {
        var qtys = [];
        body.querySelectorAll('.gfp-rf-qty').forEach(function (inp) {
          qtys[Number(inp.getAttribute('data-idx'))] = Number(inp.value || 0);
        });
        var el = document.getElementById('gfpRfGoodsEstimate');
        if (el) el.textContent = money(estimateGoodsAmount(qtys));
      };
      body.querySelectorAll('.gfp-rf-qty').forEach(function (inp) {
        inp.addEventListener('input', refreshEstimate);
      });
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

  async function loadRefundable() {
    if (!state.saleId || !canRequest()) {
      state.refundable = null;
      return;
    }
    var res = await api('GET', '/refunds/refundable?saleId=' + encodeURIComponent(state.saleId));
    if (!res.ok) {
      state.refundable = null;
      return;
    }
    state.refundable = res.data || null;
  }

  async function submitRequest(e) {
    e.preventDefault();
    var method = document.getElementById('gfpRfMethod').value;
    var reason = document.getElementById('gfpRfReason').value.trim();
    if (method === 'gateway') {
      toast(problemMessage({ title: 'GATEWAY_REFUND_UNSUPPORTED' }, 409), 'err');
      return;
    }

    var rows = returnableLines();
    var linesPayload = [];
    rows.forEach(function (ln, i) {
      var qtyEl = document.querySelector('.gfp-rf-qty[data-idx="' + i + '"]');
      var dispEl = document.querySelector('.gfp-rf-disp[data-idx="' + i + '"]');
      var qty = qtyEl ? Number(qtyEl.value || 0) : 0;
      if (qty > 0) {
        linesPayload.push({
          saleLineId: ln.saleLineId,
          qty: qty,
          disposition: dispEl ? dispEl.value : 'resellable'
        });
      }
    });
    if (!linesPayload.length) {
      toast(t('Choose at least one returned product.', 'حدد منتجًا واحدًا على الأقل للإرجاع.'), 'err');
      return;
    }
    var payload = {
      saleId: state.saleId,
      amount: 0,
      method: method,
      reason: reason,
      lines: linesPayload
    };

    var res = await api('POST', '/refunds', payload);
    if (!res.ok) {
      toast(problemMessage(res.data, res.status, res.error), 'err');
      return;
    }
    var created = res.data || {};
    if (canExecuteDirectly() && created.id) {
      var approval = await api('POST', '/refunds/' + encodeURIComponent(created.id) + '/approve');
      if (!approval.ok) {
        toast(
          t('Refund request was saved, but needs approval: ', 'تم حفظ طلب الاسترداد لكنه يحتاج اعتمادًا: ') +
            problemMessage(approval.data, approval.status, approval.error),
          'err'
        );
        await Promise.all([loadRefunds(), loadRefundable()]);
        render();
        return;
      }
      var executed = approval.data || created;
      toast(
        executed.stockRestored
          ? t('Refund completed and stock was restored.', 'تم الاسترداد وإرجاع المخزون.')
          : t('Refund completed.', 'تم الاسترداد والاعتماد.'),
        'ok'
      );
    } else {
      toast(
        t('Refund request sent: ', 'تم إرسال طلب الاسترداد بمقدار: ') + money(created.amount),
        'ok'
      );
    }
    await Promise.all([loadRefunds(), loadRefundable()]);
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
    await Promise.all([loadRefunds(), loadRefundable()]);
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
    await Promise.all([loadRefunds(), loadRefundable()]);
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
    state.refundable = null;
    rejectId = null;
    document.getElementById('gfpRefundOverlay').hidden = false;
    render();
    await Promise.all([loadRefunds(), loadRefundable()]);
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
