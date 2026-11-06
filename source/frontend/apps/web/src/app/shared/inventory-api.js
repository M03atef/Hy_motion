/**
 * Inventory API path helpers (INVS / FE-INVS-0).
 * Thin constants mirroring FRONTEND_API_CONTRACTS.ts §22b — no mocks.
 * Prefer GfpApi.get/post/put with these paths.
 */
(function (global) {
  'use strict';

  var MOVEMENT_REASONS = [
    'opening',
    'purchase_receipt',
    'purchase_return',
    'sale',
    'sale_refund',
    'adjustment',
    'transfer_out',
    'transfer_in',
    'count'
  ];

  var ADJUSTMENT_REASON_CODES = [
    'opening',
    'damage',
    'lost',
    'expired',
    'manual_count',
    'internal_use',
    'employee',
    'supplier_correction',
    'other'
  ];

  function q(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  var paths = {
    categories: function () {
      return '/inventory/categories';
    },
    category: function (id) {
      return '/inventory/categories/' + encodeURIComponent(id);
    },
    products: function (params) {
      return '/inventory/products' + q(params);
    },
    product: function (id) {
      return '/inventory/products/' + encodeURIComponent(id);
    },
    productByBarcode: function (code) {
      return '/inventory/products/by-barcode/' + encodeURIComponent(code);
    },
    productArchive: function (id) {
      return '/inventory/products/' + encodeURIComponent(id) + '/archive';
    },
    productUnarchive: function (id) {
      return '/inventory/products/' + encodeURIComponent(id) + '/unarchive';
    },
    productImageUpload: function () {
      return '/inventory/products/image';
    },
    productStock: function (id) {
      return '/inventory/products/' + encodeURIComponent(id) + '/stock';
    },
    warehouses: function (params) {
      return '/inventory/warehouses' + q(params);
    },
    warehouseDefault: function () {
      return '/inventory/warehouses/default';
    },
    warehouse: function (id) {
      return '/inventory/warehouses/' + encodeURIComponent(id);
    },
    warehouseSetDefault: function (id) {
      return '/inventory/warehouses/' + encodeURIComponent(id) + '/set-default';
    },
    stock: function (params) {
      return '/inventory/stock' + q(params);
    },
    stockBoard: function (params) {
      return '/inventory/stock/board' + q(params);
    },
    adjustments: function (params) {
      return '/inventory/adjustments' + q(params);
    },
    adjustment: function (id) {
      return '/inventory/adjustments/' + encodeURIComponent(id);
    },
    adjustmentPost: function (id) {
      return '/inventory/adjustments/' + encodeURIComponent(id) + '/post';
    },
    adjustmentCancel: function (id) {
      return '/inventory/adjustments/' + encodeURIComponent(id) + '/cancel';
    },
    suppliers: function (params) {
      return '/inventory/suppliers' + q(params);
    },
    supplier: function (id) {
      return '/inventory/suppliers/' + encodeURIComponent(id);
    },
    supplierBalance: function (id) {
      return '/inventory/suppliers/' + encodeURIComponent(id) + '/balance';
    },
    supplierLedger: function (id, params) {
      return '/inventory/suppliers/' + encodeURIComponent(id) + '/ledger' + q(params);
    },
    supplierOpening: function (id) {
      return '/inventory/suppliers/' + encodeURIComponent(id) + '/opening';
    },
    supplierPayments: function (id) {
      return '/inventory/suppliers/' + encodeURIComponent(id) + '/payments';
    },
    purchaseOrders: function (params) {
      return '/inventory/purchase-orders' + q(params);
    },
    purchaseOrder: function (id) {
      return '/inventory/purchase-orders/' + encodeURIComponent(id);
    },
    purchaseOrderFromSuggestions: function () {
      return '/inventory/purchase-orders/from-suggestions';
    },
    purchaseOrderApprove: function (id) {
      return '/inventory/purchase-orders/' + encodeURIComponent(id) + '/approve';
    },
    purchaseOrderCancel: function (id) {
      return '/inventory/purchase-orders/' + encodeURIComponent(id) + '/cancel';
    },
    purchaseOrderReceive: function (id) {
      return '/inventory/purchase-orders/' + encodeURIComponent(id) + '/receipts';
    },
    goodsReceipts: function (params) {
      return '/inventory/goods-receipts' + q(params);
    },
    goodsReceipt: function (id) {
      return '/inventory/goods-receipts/' + encodeURIComponent(id);
    },
    transfers: function (params) {
      return '/inventory/transfers' + q(params);
    },
    transfer: function (id) {
      return '/inventory/transfers/' + encodeURIComponent(id);
    },
    transferSubmit: function (id) {
      return '/inventory/transfers/' + encodeURIComponent(id) + '/submit';
    },
    transferReceive: function (id) {
      return '/inventory/transfers/' + encodeURIComponent(id) + '/receive';
    },
    transferCancel: function (id) {
      return '/inventory/transfers/' + encodeURIComponent(id) + '/cancel';
    },
    transferReject: function (id) {
      return '/inventory/transfers/' + encodeURIComponent(id) + '/reject';
    },
    counts: function (params) {
      return '/inventory/counts' + q(params);
    },
    count: function (id) {
      return '/inventory/counts/' + encodeURIComponent(id);
    },
    countLines: function (id) {
      return '/inventory/counts/' + encodeURIComponent(id) + '/lines';
    },
    countSubmit: function (id) {
      return '/inventory/counts/' + encodeURIComponent(id) + '/submit';
    },
    countApprove: function (id) {
      return '/inventory/counts/' + encodeURIComponent(id) + '/approve';
    },
    countCancel: function (id) {
      return '/inventory/counts/' + encodeURIComponent(id) + '/cancel';
    },
    reportSummary: function () {
      return '/inventory/reports/summary';
    },
    reportMovements: function (params) {
      return '/inventory/reports/movements' + q(params);
    },
    reportReorderSuggestions: function () {
      return '/inventory/reports/reorder-suggestions';
    },
    reportDeadStock: function (params) {
      return '/inventory/reports/dead-stock' + q(params);
    },
    reportProductPerformance: function (params) {
      return '/inventory/reports/product-performance' + q(params);
    }
  };

  global.GfpInventoryApi = {
    paths: paths,
    MOVEMENT_REASONS: MOVEMENT_REASONS,
    ADJUSTMENT_REASON_CODES: ADJUSTMENT_REASON_CODES,
    query: q
  };
})(typeof window !== 'undefined' ? window : globalThis);
