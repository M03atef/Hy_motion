/**
 * HyMotion — Member Orders (staff fulfillment) path helpers.
 * Backend owns status transitions; FE must not invent stock/payment math.
 */
(function (global) {
  'use strict';

  var paths = {
    list: function (q) {
      var qs = new URLSearchParams();
      if (q) {
        Object.keys(q).forEach(function (k) {
          if (q[k] != null && q[k] !== '') qs.set(k, String(q[k]));
        });
      }
      var s = qs.toString();
      return '/member-orders' + (s ? '?' + s : '');
    },
    detail: function (id) {
      return '/member-orders/' + encodeURIComponent(id);
    },
    accept: function (id) {
      return '/member-orders/' + encodeURIComponent(id) + '/accept';
    },
    reject: function (id) {
      return '/member-orders/' + encodeURIComponent(id) + '/reject';
    },
    ready: function (id) {
      return '/member-orders/' + encodeURIComponent(id) + '/ready';
    },
    complete: function (id) {
      return '/member-orders/' + encodeURIComponent(id) + '/complete';
    },
    memberOrders: function (memberId, q) {
      var qs = new URLSearchParams();
      if (q) {
        Object.keys(q).forEach(function (k) {
          if (q[k] != null && q[k] !== '') qs.set(k, String(q[k]));
        });
      }
      var s = qs.toString();
      return (
        '/members/' +
        encodeURIComponent(memberId) +
        '/orders' +
        (s ? '?' + s : '')
      );
    }
  };

  /** Normalize status for filters / badges (backend may send any casing). */
  function normalizeStatus(s) {
    if (s == null || s === '') return '';
    var t = String(s).trim().toLowerCase();
    if (t === 'pending') return 'Pending';
    if (t === 'accepted') return 'Accepted';
    if (t === 'ready') return 'Ready';
    if (t === 'completed' || t === 'complete') return 'Completed';
    if (t === 'rejected' || t === 'reject') return 'Rejected';
    // Preserve unknown backend statuses as-is (title-case first letter)
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
  }

  function pick(obj, keys, fallback) {
    if (!obj) return fallback;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] != null && obj[k] !== '') return obj[k];
    }
    return fallback;
  }

  /** Map heterogeneous DTO shapes into a stable view model. */
  function normalizeOrder(raw) {
    if (!raw) return null;
    var lines = raw.lines || raw.items || raw.orderLines || [];
    if (!Array.isArray(lines)) lines = [];
    return {
      id: pick(raw, ['id', 'orderId'], null),
      orderNumber: pick(raw, ['orderNumber', 'number', 'orderNo', 'displayNumber'], null),
      memberId: pick(raw, ['memberId', 'memberID'], null),
      memberName: pick(raw, ['memberName', 'fullName', 'memberFullName'], '—'),
      memberNumber: pick(raw, ['memberNumber', 'memberNo', 'membershipNumber'], '—'),
      status: normalizeStatus(pick(raw, ['status', 'orderStatus'], '')),
      total: pick(raw, ['total', 'totalAmount', 'grandTotal', 'amount'], null),
      currency: pick(raw, ['currency', 'currencyCode'], 'EGP'),
      createdAt: pick(raw, ['createdAtUtc', 'createdAt', 'orderedAtUtc', 'created'], null),
      note: pick(raw, ['note', 'notes', 'rejectReason', 'rejectionReason'], null),
      saleId: pick(raw, ['saleId', 'SaleId'], null),
      invoiceId: pick(raw, ['invoiceId', 'InvoiceId'], null),
      invoiceNumber: pick(raw, ['invoiceNumber', 'InvoiceNumber'], null),
      lines: lines.map(function (l) {
        return {
          productId: pick(l, ['productId', 'id'], null),
          name: pick(l, ['productName', 'name', 'skuName'], 'Item'),
          sku: pick(l, ['sku', 'productSku'], ''),
          qty: Number(pick(l, ['qty', 'quantity', 'qtyOrdered'], 0)),
          unitPrice: pick(l, ['unitPrice', 'price', 'sellPrice'], null),
          lineTotal: pick(l, ['lineTotal', 'total', 'amount'], null),
          imageUrl: pick(l, ['imageUrl', 'productImageUrl', 'photoUrl', 'relativeUrl'], null)
        };
      }),
      raw: raw
    };
  }

  function extractPaged(data) {
    if (Array.isArray(data)) {
      return { items: data, page: 1, pageSize: data.length, totalCount: data.length, totalPages: 1 };
    }
    var d = data || {};
    var items = d.items || d.orders || d.data || [];
    if (!Array.isArray(items)) items = [];
    return {
      items: items,
      page: d.page != null ? d.page : 1,
      pageSize: d.pageSize != null ? d.pageSize : items.length,
      totalCount: d.totalCount != null ? d.totalCount : items.length,
      totalPages: d.totalPages != null ? d.totalPages : 1
    };
  }

  global.GfpMemberOrdersApi = {
    paths: paths,
    normalizeStatus: normalizeStatus,
    normalizeOrder: normalizeOrder,
    extractPaged: extractPaged
  };
})(typeof window !== 'undefined' ? window : globalThis);
