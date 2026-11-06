/* Batch Cards workspace — card grid + flip card visual + unassign.
   Replaces the flat table; same endpoints + /batches + /{id}/unassign. */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;

  var state = {
    filter: '',
    batchId: '',
    search: '',
    page: 1,
    pageSize: 48,
    totalCount: 0,
    items: [],
    selected: null,
    branding: null,
    batches: [],
    flip: false
  };

  function t(en, ar) {
    if (window.GfpI18n && window.GfpI18n.t) return window.GfpI18n.t(en, ar);
    var loc = (window.GfpI18n && window.GfpI18n.getLocale && window.GfpI18n.getLocale()) || 'en';
    return loc === 'ar' ? ar : en;
  }

  function toast(msg, type) {
    if (globalThis.toastShared) return globalThis.toastShared(msg, type || 'success');
  }

  function apiErr(r) {
    if (window.GfpI18n && window.GfpI18n.displayApiError) return window.GfpI18n.displayApiError(r) || 'Request failed';
    return (r && r.error && r.error.message) || 'Request failed';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (_) {
      return null;
    }
  }

  var user = getUser();
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }
  if (Authz && !Authz.useCan('members.view')) {
    window.location.href = '/dashboard/';
    return;
  }

  var canCreate = Authz ? Authz.useCan('members.create') : false;
  var canEdit = Authz ? Authz.useCan('members.edit') : false;

  document.getElementById('userAvatar').textContent = (user.fullName || 'U')
    .split(' ')
    .map(function (w) { return w[0]; })
    .join('')
    .substring(0, 2)
    .toUpperCase();
  document.getElementById('userName').textContent = user.fullName || 'User';
  document.getElementById('userRole').textContent = user.role || 'Staff';
  document.getElementById('btnLogout').addEventListener('click', function () {
    if (Gfp) Gfp.logout();
    else window.location.href = '/auth/login/';
  });

  var btnBulk = document.getElementById('btnBulkCreate');
  if (btnBulk && canCreate) btnBulk.hidden = false;

  /* ============ Code128-B (screen SVG) ============ */
  var C128 = [ /* 0-106 */
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];

  function code128Svg(text, heightPx, color) {
    var codes = [104];
    var sum = 104;
    for (var i = 0; i < text.length; i++) {
      var v = text.charCodeAt(i) - 32;
      if (v < 0 || v > 94) v = 0;
      codes.push(v);
      sum += v * (i + 1);
    }
    codes.push(sum % 103);
    codes.push(106);
    var pat = codes.map(function (c) { return C128[c]; }).join('');
    var x = 0;
    var bar = true;
    var rects = '';
    for (var j = 0; j < pat.length; j++) {
      var w = +pat.charAt(j);
      if (bar) rects += '<rect x="' + x + '" y="0" width="' + w + '" height="10" fill="' + (color || '#141414') + '"/>';
      x += w;
      bar = !bar;
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + x + ' 10" ' +
      'preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:' +
      heightPx + 'px;display:block">' + rects + '</svg>';
  }

  /* ============ brand ink (auto contrast) ============ */
  function brandInk(hex) {
    var m = /^#?([0-9A-Fa-f]{6})$/.exec(hex || '');
    if (!m) return '#FFFFFF';
    var n = parseInt(m[1], 16);
    function lin(c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return lum > 0.45 ? '#141414' : '#FFFFFF';
  }

  function brand() {
    return state.branding || {};
  }

  function brandColor() {
    var b = brand();
    var c = (b.cardPrimaryColor || b.CardPrimaryColor || b.primaryColor || '#7ACC00');
    return (/^#?[0-9A-Fa-f]{6}$/.test(c) ? (c.charAt(0) === '#' ? c : '#' + c) : '#7ACC00');
  }

  function brandLogo() {
    var b = brand();
    if (b.showGymLogoOnCard === false || b.ShowGymLogoOnCard === false) return '';
    return b.logoUrl || b.LogoUrl || '';
  }

  function gymEn() {
    var b = brand();
    return b.gymName || b.GymName || (user && user.gymName) || 'GYM';
  }

  function gymAr() {
    var b = brand();
    var ar = b.gymNameAr || b.GymNameAr || '';
    return ar && ar !== gymEn() ? ar : '';
  }

  /* ============ data ============ */
  async function loadBranding() {
    if (!Gfp) return;
    var r = await Gfp.get('/settings/branding');
    if (r && r.ok) {
      state.branding = r.data || {};
      var gym = (gymEn() || 'GYM').toUpperCase();
      var el = document.getElementById('bcGym');
      if (el) el.textContent = gym;
    }
  }

  async function loadInventory() {
    if (!Gfp) return;
    var r = await Gfp.get('/access-cards/inventory');
    if (!r || !r.ok) return;
    var d = r.data || {};
    document.getElementById('kpiTotal').textContent = d.total != null ? d.total : '—';
    document.getElementById('kpiAvailable').textContent = d.available != null ? d.available : '—';
    document.getElementById('kpiAssigned').textContent = d.assigned != null ? d.assigned : '—';
  }

  async function loadBatches() {
    if (!Gfp) return;
    var r = await Gfp.get('/access-cards/batches');
    state.batches = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
    var wrap = document.getElementById('bcBatches');
    if (!wrap) return;
    var html = '<button type="button" class="bc-batch-chip' + (state.batchId === '' ? ' on' : '') +
      '" data-batch="">' + esc(t('ALL CARDS', 'كل الكروت')) + '</button>';
    html += state.batches.map(function (b) {
      var label = batchLabel(b);
      return '<button type="button" class="bc-batch-chip' + (state.batchId === b.batchId ? ' on' : '') +
        '" data-batch="' + esc(b.batchId) + '">' + esc(label) + '</button>';
    }).join('');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.bc-batch-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.batchId = chip.getAttribute('data-batch') || '';
        state.page = 1;
        renderBatchChips();
        loadList(true);
      });
    });
  }

  function renderBatchChips() {
    var wrap = document.getElementById('bcBatches');
    if (!wrap) return;
    wrap.querySelectorAll('.bc-batch-chip').forEach(function (chip) {
      chip.classList.toggle('on', (chip.getAttribute('data-batch') || '') === state.batchId);
    });
  }

  function batchLabel(b) {
    var first = b.firstCode || '';
    var last = b.lastCode || '';
    if (first && last && first !== last) {
      var tail = String(last).split('-').pop();
      return first + '…' + tail;
    }
    return first || String(b.batchId || '').slice(0, 8);
  }

  async function loadList(reset) {
    if (!Gfp) return;
    if (reset) state.page = 1;
    var qs = '?page=' + state.page + '&pageSize=' + state.pageSize;
    if (state.filter) qs += '&status=' + encodeURIComponent(state.filter);
    if (state.batchId) qs += '&batchId=' + encodeURIComponent(state.batchId);
    if (state.search) qs += '&search=' + encodeURIComponent(state.search);
    var r = await Gfp.get('/access-cards' + qs);
    var grid = document.getElementById('bcGrid');
    if (!r || !r.ok) {
      grid.innerHTML = '<div class="bc-empty">' + esc(apiErr(r)) + '</div>';
      return;
    }
    var data = r.data || {};
    var items = data.items || data.Items || [];
    state.totalCount = data.totalCount || data.TotalCount || 0;
    state.items = reset ? items : state.items.concat(items);
    renderGrid();
    document.getElementById('btnMore').hidden =
      state.items.length >= state.totalCount;
  }

  function statusDot(cls) {
    return '<span class="bc-d-status ' + cls + '"><i></i>' + esc(statusLabel(cls.replace('st-', ''))) + '</span>';
  }

  function statusLabel(st) {
    var map = {
      Available: t('UNASSIGNED', 'غير معيَّن'),
      Assigned: t('ASSIGNED', 'معيَّن'),
      Lost: t('LOST', 'مفقود'),
      Damaged: t('DAMAGED', 'تالف'),
      Blocked: t('BLOCKED', 'محظور')
    };
    return map[st] || st;
  }

  function renderGrid() {
    var grid = document.getElementById('bcGrid');
    if (!state.items.length) {
      grid.innerHTML = '<div class="bc-empty">' + esc(t('No cards match', 'لا توجد كروت مطابقة')) + '</div>';
      return;
    }
    grid.innerHTML = state.items.map(function (c) {
      var on = state.selected && state.selected.id === c.id ? ' on' : '';
      var lost = (c.status !== 'Available' && c.status !== 'Assigned');
      return '<button type="button" class="bc-item' + on + '" data-id="' + esc(c.id) + '"' +
        (lost ? ' title="' + esc(c.status) + '"' : '') + '>' +
        '<span class="bc-plate">' + code128Svg(c.code, 26) + '</span>' +
        '<span class="bc-item-code">' + esc(c.code) + '</span>' +
        '</button>';
    }).join('');
    grid.querySelectorAll('.bc-item').forEach(function (el) {
      el.addEventListener('click', function () {
        selectCard(el.getAttribute('data-id'));
      });
    });
  }

  async function selectCard(id) {
    var found = null;
    state.items.forEach(function (c) { if (c.id === id) found = c; });
    state.selected = found;
    state.flip = false;
    renderGrid();
    if (!found) return;
    // refresh from server (member info, status)
    if (Gfp) {
      var r = await Gfp.get('/access-cards/' + encodeURIComponent(id));
      if (r && r.ok && r.data) {
        state.selected = r.data;
        state.items = state.items.map(function (c) { return c.id === id ? r.data : c; });
        renderGrid();
      }
    }
    renderDetail();
  }

  function apiBase() {
    if (Gfp && typeof Gfp.apiBase === 'function') return String(Gfp.apiBase()).replace(/\/$/, '');
    return String(window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
  }

  function assetBase() {
    return apiBase().replace(/\/api$/, '');
  }

  function chipHtml() {
    var logo = brandLogo();
    if (logo) {
      var src = /^https?:/i.test(logo) ? logo : assetBase() + (logo.charAt(0) === '/' ? logo : '/' + logo);
      return '<img src="' + esc(src) + '" alt="">';
    }
    return '<span class="ccf-dot"></span>';
  }

  function renderDetail() {
    var panel = document.getElementById('bcDetail');
    var c = state.selected;
    if (!c) {
      panel.innerHTML =
        '<div class="bc-detail-empty"><i class="ti ti-id"></i>' +
        '<p>' + esc(t('Select a card from the grid', 'اختار كارت من الشبكة')) + '</p></div>';
      return;
    }
    var color = brandColor();
    var ink = brandInk(color);
    var logo = brandLogo();
    var ar = gymAr();
    var member = c.memberNumber
      ? '<div class="bc-d-member"><b>#' + esc(c.memberNumber) + '</b>' +
        (c.memberName ? ' · ' + esc(c.memberName) : '') + '</div>'
      : '';

    panel.innerHTML =
      '<div class="bc-d-head"><span class="bc-d-code">' + esc(c.code) + '</span>' +
      statusDot('st-' + esc(c.status)) + '</div>' +
      member +
      '<div class="cc-wrap"><div class="cc' + (state.flip ? ' flipped' : '') + '" id="ccCard" dir="ltr" title="' +
      esc(t('Tap to flip', 'اضغط للقلب')) + '">' +
      /* front */
      '<div class="cc-face cc-front">' +
      '<div class="ccf-block"><div class="ccf-brand">' +
      '<span class="ccf-chip">' + chipHtml() + '</span>' +
      '<span class="ccf-names"><b>' + esc(gymEn()) + '</b>' +
      (ar ? '<i>' + esc(ar) + '</i>' : '') + '</span>' +
      '</div>' +
      '<div class="ccf-labelrow"><span class="ccf-label-en">ACCESS CARD</span>' +
      '<span class="ccf-label-ar">كارنيه دخول</span></div>' +
      '</div>' +
      '<div class="ccf-white"><div class="ccf-bc">' + code128Svg(c.code, 34) + '</div>' +
      '<div class="ccf-code">' + esc(c.code) + '</div></div>' +
      '</div>' +
      /* back */
      '<div class="cc-face cc-back">' +
      '<div class="ccb-body">' +
      '<span class="ccb-chip">' + chipHtml() + '</span>' +
      '<span class="ccb-name">' + esc(gymEn()) + '</span>' +
      (ar ? '<span class="ccb-name-ar">' + esc(ar) + '</span>' : '') +
      '</div>' +
      '<div class="ccb-strip"><span class="pby">Powered by <b>HyMotion</b></span></div>' +
      '</div>' +
      '</div></div>' +
      '<div class="bc-d-hint" data-en="TAP CARD TO FLIP" data-ar="اضغط الكارت للقلب">TAP CARD TO FLIP</div>' +
      '<button type="button" class="bc-unassign" id="btnUnassign"' +
      ((c.status === 'Assigned' && canEdit) ? '' : ' hidden') + '>' +
      esc(t('UNASSIGN', 'إلغاء التعيين')) + '</button>';

    panel.style.setProperty('--card-brand', color);
    panel.style.setProperty('--card-ink', ink);

    var cc = document.getElementById('ccCard');
    cc.addEventListener('click', function () {
      state.flip = !state.flip;
      cc.classList.toggle('flipped', state.flip);
    });
    var btnUn = document.getElementById('btnUnassign');
    if (btnUn && !btnUn.hidden) {
      btnUn.addEventListener('click', unassignSelected);
    }
  }

  async function unassignSelected() {
    var c = state.selected;
    if (!c || !Gfp) return;
    if (!window.confirm(t(
      'Unassign ' + c.code + ' from its member?',
      'إلغاء تعيين ' + c.code + ' من العضو؟'))) return;
    var r = await Gfp.post('/access-cards/' + encodeURIComponent(c.id) + '/unassign', {});
    if (!r || !r.ok) {
      toast(apiErr(r) || t('Unassign failed', 'فشل إلغاء التعيين'), 'error');
      return;
    }
    state.selected = r.data || c;
    toast(t('Card unassigned', 'تم إلغاء التعيين'));
    await Promise.all([loadInventory(), loadBatches()]);
    state.items = state.items.map(function (x) {
      return x.id === state.selected.id ? state.selected : x;
    });
    renderGrid();
    renderDetail();
  }

  async function refresh() {
    await Promise.all([loadBranding(), loadInventory(), loadBatches()]);
    await loadList(true);
  }

  /* ============ events ============ */
  document.getElementById('btnRefresh').addEventListener('click', refresh);
  document.querySelectorAll('.bc-seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.bc-seg-btn').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      state.filter = btn.getAttribute('data-filter') || '';
      loadList(true);
    });
  });
  var searchTimer = null;
  document.getElementById('searchQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.search = document.getElementById('searchQ').value.trim();
      loadList(true);
    }, 280);
  });
  document.getElementById('btnMore').addEventListener('click', function () {
    state.page += 1;
    loadList(false);
  });

  /* add batch modal */
  var modal = document.getElementById('bulkModal');
  function openBulk() { if (modal) modal.hidden = false; }
  function closeBulk() { if (modal) modal.hidden = true; }
  if (btnBulk) btnBulk.addEventListener('click', openBulk);
  document.getElementById('btnBulkClose').addEventListener('click', closeBulk);
  document.getElementById('btnBulkCancel').addEventListener('click', closeBulk);
  document.getElementById('btnBulkSave').addEventListener('click', async function () {
    if (!Gfp) return;
    var prefix = document.getElementById('bulkPrefix').value.trim() || 'CARD';
    var start = parseInt(document.getElementById('bulkStart').value, 10) || 1;
    var qty = parseInt(document.getElementById('bulkQty').value, 10) || 0;
    var r = await Gfp.post('/access-cards/bulk', {
      prefix: prefix,
      startNumber: start,
      quantity: qty
    });
    if (!r || !r.ok) {
      toast(apiErr(r) || t('Create failed', 'فشل الإنشاء'), 'error');
      return;
    }
    toast(t('Created ' + (r.data && r.data.created) + ' cards', 'تم إنشاء ' + (r.data && r.data.created) + ' كارنيه'));
    closeBulk();
    var batchId = r.data && (r.data.batchId || r.data.BatchId);
    if (batchId) {
      state.batchId = String(batchId);
      state.filter = '';
      document.querySelectorAll('.bc-seg-btn').forEach(function (b) {
        b.classList.toggle('on', !(b.getAttribute('data-filter') || ''));
      });
    }
    await refresh();
    if (batchId && window.confirm(t(
      'Open gym-branded print preview for this batch?',
      'فتح معاينة الطباعة بهوية الصالة لهذه الدفعة؟'))) {
      openPrintPreview({ batchId: batchId, status: 'Available', limit: qty || 100 });
    }
  });

  /* print modal */
  var printModal = document.getElementById('printModal');
  function openPrintModal() { if (printModal) printModal.hidden = false; }
  function closePrintModal() { if (printModal) printModal.hidden = true; }
  document.getElementById('btnPrintBatch').addEventListener('click', function () {
    var input = document.getElementById('printBatchId');
    if (input && state.batchId) input.value = state.batchId;
    openPrintModal();
  });
  document.getElementById('btnPrintClose').addEventListener('click', closePrintModal);
  document.getElementById('btnPrintCancel').addEventListener('click', closePrintModal);

  function openPrintPreview(opts) {
    opts = opts || {};
    var batchId = opts.batchId != null ? opts.batchId : (document.getElementById('printBatchId').value || '').trim();
    var status = opts.status != null ? opts.status : document.getElementById('printStatus').value;
    var limit = opts.limit != null ? opts.limit : (parseInt(document.getElementById('printLimit').value, 10) || 100);
    var qs = '?limit=' + encodeURIComponent(limit);
    if (batchId) qs += '&batchId=' + encodeURIComponent(batchId);
    if (status) qs += '&status=' + encodeURIComponent(status);
    var url = apiBase() + '/access-cards/print-html' + qs;
    var token = localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
    fetch(url, {
      headers: {
        Authorization: token ? ('Bearer ' + token) : '',
        Accept: 'text/html',
        'ngrok-skip-browser-warning': 'true'
      }
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/auth/login/';
        return null;
      }
      return res.text().then(function (text) {
        return { ok: res.ok, status: res.status, text: text };
      });
    }).then(function (r) {
      if (!r) return;
      if (!r.ok) {
        toast(r.text || t('Could not load print preview', 'تعذر تحميل معاينة الطباعة'), 'error');
        return;
      }
      var w = window.open('', '_blank');
      if (!w) {
        toast(t('Allow pop-ups to preview cards', 'اسمح بالنوافذ المنبثقة لمعاينة الكارنيهات'), 'error');
        return;
      }
      w.document.open();
      w.document.write(r.text);
      w.document.close();
      closePrintModal();
    }).catch(function () {
      toast(t('Network error', 'خطأ شبكة'), 'error');
    });
  }

  document.getElementById('btnPrintOpen').addEventListener('click', function () {
    openPrintPreview();
  });

  refresh();
})();
