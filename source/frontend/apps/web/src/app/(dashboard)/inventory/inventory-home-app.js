/**
 * Inventory owner pulse home — summary cards + shortcuts (P0 UX).
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
  if (!Authz || !Authz.useCan('inventory.view')) {
    window.location.href = '/dashboard/';
    return;
  }

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

  function apiError(r) {
    if (I18n && I18n.displayApiError) return I18n.displayApiError(r) || t('Request failed', 'فشل الطلب');
    if (!r) return t('Request failed', 'فشل الطلب');
    var e = r.error || {};
    var d = r.data || {};
    return e.message || d.detail || d.message || e.title || t('Request failed', 'فشل الطلب') + ' (' + r.status + ')';
  }

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function applyLocaleUi() {
    if (I18n && I18n.applyDocumentLocale) I18n.applyDocumentLocale();
  }

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
  })();

  (async function loadGym() {
    var r = await Gfp.get('/settings');
    if (r.ok && r.data) {
      document.getElementById('gymName').textContent = r.data.gymName || 'HyMotion';
      var ga = document.getElementById('gymNameAr');
      if (ga) ga.textContent = r.data.gymNameAr || '';
    }
  })();

  function gateActions() {
    var canAdjust = Authz.useCan('inventory.adjust');
    var canTransfer = Authz.useCan('inventory.transfer');
    var canCatalog =
      Authz.useCan('inventory.manage') || Authz.useCan('inventory.purchase');
    var canWh = Authz.useCan('inventory.manage');

    // Sell / Buy & receive / Adjust quantity are not Overview shortcuts —
    // Sell → Front Desk; Buy/Adjust → On Hand product context.
    var count = document.getElementById('actCount');
    if (count) count.hidden = !canAdjust;
    var move = document.getElementById('actMove');
    if (move) move.hidden = !canTransfer;

    var bp = document.getElementById('browseProducts');
    if (bp) bp.hidden = !canCatalog;
    var bs = document.getElementById('browseSuppliers');
    if (bs) bs.hidden = !canCatalog;
    var bw = document.getElementById('browseWarehouses');
    if (bw) bw.hidden = !canWh;

    var setup = document.getElementById('setupBrowse');
    if (setup) {
      var anySetup = canCatalog || canWh;
      setup.hidden = !anySetup;
      var setupTitle = setup.previousElementSibling;
      if (setupTitle && setupTitle.classList.contains('section-title')) {
        setupTitle.hidden = !anySetup;
      }
    }
  }

  function pulseCard(opts) {
    var tone = opts.tone || 'info';
    var href = opts.href
      ? '<a class="pulse-link" href="' +
        esc(opts.href) +
        '">' +
        esc(opts.linkLabel) +
        ' <i class="ti ti-arrow-narrow-right"></i></a>'
      : '';
    return (
      '<div class="pulse-card tone-' +
      esc(tone) +
      '">' +
      '<div class="pulse-label">' +
      esc(opts.label) +
      '</div>' +
      '<div class="pulse-value">' +
      esc(opts.value) +
      '</div>' +
      (opts.hint ? '<div class="pulse-hint">' + esc(opts.hint) + '</div>' : '') +
      href +
      '</div>'
    );
  }

  async function loadPulse() {
    var host = document.getElementById('pulseHost');
    host.innerHTML =
      '<div class="loading-state"><div class="loader"></div><p>' +
      esc(t('Loading…', 'جاري التحميل…')) +
      '</p></div>';

    var r = await Gfp.get(paths.reportSummary());
    if (!r.ok) {
      host.innerHTML =
        '<div class="error-state"><p>' + esc(apiError(r)) + '</p></div>';
      return;
    }

    var s = r.data || {};
    var oos = s.outOfStockCount != null ? s.outOfStockCount : 0;
    var low = s.lowStockCount != null ? s.lowStockCount : 0;
    var exp = Array.isArray(s.expiringSoon) ? s.expiringSoon : [];
    var expTotal = exp.reduce(function (n, w) {
      return n + (Number(w.batchCount) || 0);
    }, 0);
    var nearest = exp.length
      ? Math.min.apply(
          null,
          exp.map(function (w) {
            return Number(w.days) || 999;
          })
        )
      : null;

    var valueCard;
    if (s.includesValuation) {
      valueCard = pulseCard({
        tone: 'lime',
        label: t('Stock value', 'قيمة المخزون'),
        value: money(s.inventoryValueEgp),
        hint: t('Cost × quantity (owner financial view)', 'التكلفة × الكمية (عرض مالي)'),
        href: '/dashboard/inventory/reports/?tab=movements',
        linkLabel: t('Full reports', 'التقارير الكاملة')
      });
    } else {
      valueCard = pulseCard({
        tone: expTotal > 0 ? 'warn' : 'info',
        label: t('Expiring soon', 'قارب على الانتهاء'),
        value: String(expTotal),
        hint:
          nearest != null && expTotal > 0
            ? t('Nearest window ≤ ' + nearest + ' days', 'أقرب نافذة ≤ ' + nearest + ' يوم')
            : t('No batches in expiry windows', 'لا دفعات في نوافذ الصلاحية'),
        href: '/dashboard/inventory/reports/?tab=summary',
        linkLabel: t('See batches', 'عرض الدفعات')
      });
    }

    host.innerHTML =
      pulseCard({
        tone: oos > 0 ? 'danger' : 'ok',
        label: t('Out of stock', 'نفد من المخزون'),
        value: String(oos),
        hint:
          oos > 0
            ? t('Shelves empty — reorder or receive goods', 'الرف فاضي — اطلب أو استلم بضاعة')
            : t('All tracked items have stock', 'كل الأصناف المتتبعة عليها رصيد'),
        href: '/dashboard/inventory/stock-management/?tab=on-hand&filter=oos',
        linkLabel: t('Review', 'راجع')
      }) +
      pulseCard({
        tone: low > 0 ? 'warn' : 'ok',
        label: t('Low stock', 'مخزون منخفض'),
        value: String(low),
        hint:
          low > 0
            ? t('At or below reorder minimum', 'عند أو تحت حد إعادة الطلب')
            : t('Above reorder levels', 'فوق حدود إعادة الطلب'),
        href: '/dashboard/inventory/stock-management/?tab=on-hand&filter=low',
        linkLabel: t('Needs order', 'يحتاج طلب')
      }) +
      valueCard +
      pulseCard({
        tone: 'lime',
        label: t("Today's retail", 'مبيعات اليوم'),
        value:
          s.todayRetailSalesEgp != null
            ? money(s.todayRetailSalesEgp)
            : String(s.todayRetailUnits != null ? s.todayRetailUnits : 0),
        hint:
          s.todayRetailSalesEgp != null
            ? t(
                (s.todayRetailUnits != null ? s.todayRetailUnits : 0) + ' units (Cairo day)',
                (s.todayRetailUnits != null ? s.todayRetailUnits : 0) + ' وحدة (يوم القاهرة)'
              )
            : t('Units sold today (Cairo)', 'وحدات مباعة اليوم (القاهرة)'),
        href: '/dashboard/inventory/reports/?tab=performance',
        linkLabel: t('Performance', 'الأداء')
      }) +
      pulseCard({
        tone: (s.pendingPoCount || 0) > 0 ? 'warn' : 'info',
        label: t('Pending POs', 'أوامر معلّقة'),
        value: String(s.pendingPoCount != null ? s.pendingPoCount : 0),
        hint: t('Draft / approved / partial receive', 'مسودة / معتمد / استلام جزئي'),
        href: '/dashboard/inventory/purchase-orders/',
        linkLabel: t('Open', 'افتح')
      }) +
      pulseCard({
        tone: (s.inTransitTransferCount || 0) > 0 ? 'warn' : 'ok',
        label: t('In transit', 'قيد النقل'),
        value: String(s.inTransitTransferCount != null ? s.inTransitTransferCount : 0),
        hint: t('Warehouse transfers not yet received', 'تحويلات لم تُستلم بعد'),
        href: '/dashboard/inventory/stock-management/?tab=move',
        linkLabel: t('Transfers', 'التحويلات')
      });

    applyLocaleUi();
    await loadReorder();
  }

  var reorderRows = [];

  async function loadReorder() {
    var section = document.getElementById('reorderSection');
    var host = document.getElementById('reorderHost');
    var btn = document.getElementById('btnDraftPo');
    if (!section || !host || !paths.reportReorderSuggestions) return;

    var r = await Gfp.get(paths.reportReorderSuggestions());
    if (!r.ok) {
      section.hidden = true;
      return;
    }
    reorderRows = Array.isArray(r.data) ? r.data : [];
    section.hidden = false;
    var canManage = Authz.useCan('inventory.manage');
    if (btn) btn.hidden = !canManage || !reorderRows.length;

    if (!reorderRows.length) {
      host.innerHTML =
        '<div class="reorder-empty">' +
        esc(t('No products need reordering right now.', 'مفيش منتجات محتاجة طلب دلوقتي.')) +
        '</div>';
      return;
    }

    host.innerHTML =
      '<table class="reorder-table"><thead><tr>' +
      (canManage ? '<th></th>' : '') +
      '<th>' +
      esc(t('Product', 'المنتج')) +
      '</th><th>' +
      esc(t('Available', 'المتاح')) +
      '</th><th>' +
      esc(t('Cover (d)', 'تغطية (يوم)')) +
      '</th><th>' +
      esc(t('Incoming', 'وارد')) +
      '</th><th>' +
      esc(t('Min', 'الحد')) +
      '</th><th>' +
      esc(t('Suggest', 'المقترح')) +
      '</th></tr></thead><tbody>' +
      reorderRows
        .map(function (row) {
          var available =
            row.available != null && row.available !== '' ? row.available : row.onHand;
          var cover =
            row.daysOfCover == null || row.daysOfCover === ''
              ? '—'
              : row.daysOfCover;
          var incoming = row.incomingOpenQty != null ? row.incomingOpenQty : 0;
          var physicalHint =
            row.onHand != null && Number(row.onHand) !== Number(available)
              ? '<div class="reorder-sku">' +
                esc(t('Physical ', 'فعلي ') + row.onHand) +
                '</div>'
              : '';
          return (
            '<tr data-pid="' +
            esc(row.productId) +
            '" data-stock-available="' +
            esc(available) +
            '" data-stock-onhand="' +
            esc(row.onHand) +
            '">' +
            (canManage
              ? '<td><input type="checkbox" class="ro-check" checked value="' +
                esc(row.productId) +
                '"></td>'
              : '') +
            '<td><div>' +
            esc(row.name) +
            '</div><div class="reorder-sku">' +
            esc(row.sku) +
            '</div>' +
            physicalHint +
            '</td><td>' +
            esc(available) +
            '</td><td>' +
            esc(cover) +
            '</td><td>' +
            esc(incoming) +
            '</td><td>' +
            esc(row.reorderMinQty) +
            '</td><td><strong>' +
            esc(row.suggestedQty) +
            '</strong></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  var pendingDraftIds = [];

  function closeDraftModal() {
    var modal = document.getElementById('draftPoModal');
    if (modal) modal.hidden = true;
    pendingDraftIds = [];
    var hint = document.getElementById('draftPoHint');
    if (hint) hint.textContent = '';
    var btn = document.getElementById('btnConfirmDraftPo');
    if (btn) btn.disabled = false;
  }

  function openDraftModal(ids) {
    pendingDraftIds = ids.slice();
    var meta = document.getElementById('draftPoMeta');
    if (meta) {
      meta.textContent = t(
        ids.length + ' product(s) selected — pick supplier & warehouse.',
        ids.length + ' منتج محدد — اختار المورد والمستودع.'
      );
    }
    var hint = document.getElementById('draftPoHint');
    if (hint) hint.textContent = '';
    document.getElementById('draftPoModal').hidden = false;
    applyLocaleUi();
  }

  async function openDraftPoPicker() {
    var checks = document.querySelectorAll('#reorderHost .ro-check:checked');
    var ids = [];
    checks.forEach(function (c) {
      ids.push(c.value);
    });
    if (!ids.length) {
      toast(t('Select at least one product.', 'اختار منتج واحد على الأقل.'), 'err');
      return;
    }

    var [supRes, whRes, defRes] = await Promise.all([
      Gfp.get(paths.suppliers()),
      Gfp.get(paths.warehouses()),
      Gfp.get(paths.warehouseDefault())
    ]);

    var suppliers = Array.isArray(supRes.data)
      ? supRes.data.filter(function (s) {
          return s.isActive !== false;
        })
      : [];
    if (!supRes.ok || !suppliers.length) {
      toast(t('Add an active supplier first.', 'أضف مورداً نشطاً أولاً.'), 'err');
      window.setTimeout(function () {
        window.location.href = '/dashboard/inventory/suppliers/';
      }, 1200);
      return;
    }

    var warehouses = Array.isArray(whRes.data)
      ? whRes.data.filter(function (w) {
          return w.isActive !== false;
        })
      : [];
    if (!whRes.ok || !warehouses.length) {
      toast(t('Create a warehouse first.', 'أنشئ مستودعاً أولاً.'), 'err');
      return;
    }

    var defaultWhId = defRes.ok && defRes.data && defRes.data.id ? defRes.data.id : null;
    var preferredWh =
      warehouses.find(function (w) {
        return w.id === defaultWhId;
      }) ||
      warehouses.find(function (w) {
        return w.isDefault;
      }) ||
      warehouses[0];

    var supSel = document.getElementById('draftSupplier');
    supSel.innerHTML = suppliers
      .map(function (s) {
        var label = s.name || s.code || 'Supplier';
        if (s.code && s.name) label = s.code + ' — ' + s.name;
        return '<option value="' + esc(s.id) + '">' + esc(label) + '</option>';
      })
      .join('');
    var whSel = document.getElementById('draftWarehouse');
    whSel.innerHTML = warehouses
      .map(function (w) {
        var label = (w.code || '') + (w.name ? ' — ' + w.name : '');
        if (w.isDefault || w.id === preferredWh.id) label += ' (' + t('default', 'افتراضي') + ')';
        return (
          '<option value="' +
          esc(w.id) +
          '"' +
          (w.id === preferredWh.id ? ' selected' : '') +
          '>' +
          esc(label.trim()) +
          '</option>'
        );
      })
      .join('');

    var notes = document.getElementById('draftNotes');
    if (notes) notes.value = '';
    openDraftModal(ids);
  }

  async function submitDraftPo(e) {
    e.preventDefault();
    var hint = document.getElementById('draftPoHint');
    var btn = document.getElementById('btnConfirmDraftPo');
    var supplierId = document.getElementById('draftSupplier').value;
    var warehouseId = document.getElementById('draftWarehouse').value;
    var notes = (document.getElementById('draftNotes').value || '').trim();
    if (!supplierId || !warehouseId || !pendingDraftIds.length) {
      if (hint) hint.textContent = t('Supplier and warehouse are required.', 'المورد والمستودع مطلوبان.');
      return;
    }
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = '';

    var body = {
      supplierId: supplierId,
      warehouseId: warehouseId,
      productIds: pendingDraftIds
    };
    if (notes) body.notes = notes;

    var r = await Gfp.post(paths.purchaseOrderFromSuggestions(), body);
    if (!r.ok) {
      if (hint) hint.textContent = apiError(r);
      if (btn) btn.disabled = false;
      return;
    }
    closeDraftModal();
    toast(t('Draft purchase order created.', 'تم إنشاء مسودة أمر الشراء.'), 'ok');
    window.location.href =
      '/dashboard/inventory/purchase-orders/?id=' + encodeURIComponent(r.data.id);
  }

  document.getElementById('btnRefresh').addEventListener('click', loadPulse);
  var draftBtn = document.getElementById('btnDraftPo');
  if (draftBtn) draftBtn.addEventListener('click', openDraftPoPicker);
  var draftForm = document.getElementById('draftPoForm');
  if (draftForm) draftForm.addEventListener('submit', submitDraftPo);
  ['btnCloseDraftPo', 'btnCancelDraftPo'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', closeDraftModal);
  });
  var draftOverlay = document.getElementById('draftPoModal');
  if (draftOverlay) {
    draftOverlay.addEventListener('click', function (ev) {
      if (ev.target === draftOverlay) closeDraftModal();
    });
  }
  window.addEventListener('gfp:locale', function () {
    loadPulse();
  });

  gateActions();
  applyLocaleUi();
  loadPulse();
})();
