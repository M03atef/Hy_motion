/**
 * Offers & Promotions — desk UI.
 * Offer model is persisted via GET/POST/PUT /api/offers.
 * Promo-code redemption is synced on the server when publishing.
 */
(function () {
  'use strict';

  var Gfp = window.GfpApi;
  var Authz = window.GfpAuthz;
  var STORE_PREFIX = 'gfp_offers_v1:';

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    if (Gfp && Gfp.tokens && typeof Gfp.tokens.getAccessToken === 'function') {
      return Gfp.tokens.getAccessToken();
    }
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }

  var user = getUser();
  if (!user || !getToken()) {
    location.href = '/auth/login/';
    return;
  }

  var tenantId = user.tenantId || user.TenantId || 'default';
  var storeKey = STORE_PREFIX + tenantId;
  var canManage =
    (Authz && Authz.useCan && Authz.useCan('plans.manage')) ||
    /^Owner$/i.test(user.role || '');

  var plansCatalog = [];
  var productsCatalog = [];

  var state = {
    view: 'list',
    tab: 'all',
    step: 1,
    editingId: null,
    offers: [],
    selectedId: null,
    pendingEndId: null,
    form: blankForm(),
  };

  function blankForm() {
    return {
      name: '',
      short: '',
      desc: '',
      start: '',
      end: '',
      applies: 'memberships',
      planIds: {},
      productIds: {},
      discountType: 'percentage',
      value: '20',
      maxDiscount: '',
      buy: '2',
      get: '1',
      allMembers: true,
      newOnly: false,
      minPurchase: '',
      usageLimit: '100',
      perMember: '1',
      showApp: true,
      featured: false,
      banner: true,
      order: '1',
      redemption: 'auto',
      code: '',
      promoCodeId: null,
      usesCount: 0,
      isDraft: false,
    };
  }

  function fromApi(d) {
    var planIds = {};
    (d.planIds || []).forEach(function (id) {
      planIds[id] = true;
    });
    var productIds = {};
    (d.productIds || []).forEach(function (id) {
      productIds[id] = true;
    });
    return {
      id: d.id,
      name: d.name || '',
      short: d.shortDescription || '',
      desc: d.description || '',
      start: (d.start || '').toString().slice(0, 10),
      end: (d.end || '').toString().slice(0, 10),
      applies: d.appliesTo || 'memberships',
      planIds: planIds,
      productIds: productIds,
      discountType: d.discountType || 'percentage',
      value: d.value == null ? '' : String(d.value),
      maxDiscount: d.maxDiscount == null ? '' : String(d.maxDiscount),
      buy: d.buyQty == null ? '2' : String(d.buyQty),
      get: d.getQty == null ? '1' : String(d.getQty),
      allMembers: d.allMembers !== false,
      newOnly: !!d.newMembersOnly,
      minPurchase: d.minPurchase == null ? '' : String(d.minPurchase),
      usageLimit: d.usageLimit == null ? '' : String(d.usageLimit),
      perMember: d.perMemberLimit == null ? '' : String(d.perMemberLimit),
      showApp: !!d.showOnMemberApp,
      featured: !!d.featured,
      banner: !!d.showBanner,
      order: String(d.displayOrder || 1),
      redemption: d.redemption === 'promoCode' ? 'code' : 'auto',
      code: d.promoCode || '',
      promoCodeId: d.promoCodeId || null,
      usesCount: d.usesCount || 0,
      isDraft: !!d.isDraft,
      status: d.status || null,
      createdAt: d.createdAtUtc,
      membershipLabels: d.membershipLabels || [],
      productLabels: d.productLabels || [],
    };
  }

  function toApi(f, asDraft) {
    function numOrNull(v) {
      if (v === '' || v == null) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    }
    var planIds = Object.keys(f.planIds || {}).filter(function (k) {
      return f.planIds[k];
    });
    var productIds = Object.keys(f.productIds || {}).filter(function (k) {
      return f.productIds[k];
    });
    var memLabels = [];
    planIds.forEach(function (id) {
      var p = plansCatalog.find(function (x) {
        return x.id === id;
      });
      if (p && p.name) memLabels.push(p.name);
    });
    var prodLabels = [];
    productIds.forEach(function (id) {
      var p = productsCatalog.find(function (x) {
        return x.id === id;
      });
      if (p && p.name) prodLabels.push(p.name);
    });
    return {
      name: String(f.name || '').trim(),
      shortDescription: f.short || '',
      description: f.desc || null,
      start: f.start,
      end: f.end,
      appliesTo: f.applies || 'memberships',
      planIds: planIds,
      productIds: productIds,
      membershipLabels: memLabels,
      productLabels: prodLabels,
      discountType: f.discountType || 'percentage',
      value: numOrNull(f.value),
      maxDiscount: numOrNull(f.maxDiscount),
      buyQty: f.discountType === 'bxgy' ? Number(f.buy || 2) : null,
      getQty: f.discountType === 'bxgy' ? Number(f.get || 1) : null,
      allMembers: !!f.allMembers,
      newMembersOnly: !!f.newOnly,
      minPurchase: numOrNull(f.minPurchase),
      usageLimit: numOrNull(f.usageLimit),
      perMemberLimit: numOrNull(f.perMember),
      showOnMemberApp: !!f.showApp,
      featured: !!f.featured,
      showBanner: !!f.banner,
      displayOrder: Number(f.order || 1) || 1,
      redemption: f.redemption === 'code' ? 'promoCode' : 'automatic',
      promoCode: f.code ? String(f.code).toUpperCase() : null,
      isDraft: !!asDraft,
    };
  }

  function loadLocalOffers() {
    try {
      var raw = localStorage.getItem(storeKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  async function loadOffers() {
    if (!Gfp) {
      state.offers = loadLocalOffers();
      return;
    }
    var res = await Gfp.get('/offers');
    if (!res.ok) {
      toast('Could not load offers (' + (res.status || '?') + ')', 'err');
      state.offers = loadLocalOffers();
      return;
    }
    var items = Array.isArray(res.data) ? res.data : [];
    if (items.length === 0) {
      var local = loadLocalOffers().filter(function (o) {
        return o && o.name && String(o.id || '').indexOf('off_') === 0;
      });
      if (local.length) {
        for (var i = 0; i < local.length; i++) {
          var migrated = await Gfp.post('/offers', toApi(local[i], !!local[i].isDraft));
          if (migrated.ok && migrated.data) items.push(migrated.data);
        }
        localStorage.removeItem(storeKey);
        toast('Moved browser offers into the gym');
      }
    }
    state.offers = items.map(fromApi);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function computeStatus(o) {
    if (o.isDraft) return 'draft';
    var t = todayStr();
    if (o.end && o.end < t) return 'expired';
    if (o.start && o.start > t) return 'scheduled';
    if (o.status === 'expired' || o.status === 'scheduled' || o.status === 'draft') return o.status;
    var left = daysUntil(o.end);
    if (left != null && left <= 7) return 'ending';
    return 'active';
  }

  function tabStatus(st) {
    return st === 'ending' ? 'active' : st;
  }

  function daysUntil(end) {
    if (!end) return null;
    try {
      var e = new Date(end + 'T12:00:00');
      var t = new Date(todayStr() + 'T12:00:00');
      return Math.round((e - t) / 86400000);
    } catch (err) {
      return null;
    }
  }

  function discountLabel(o) {
    if (o.discountType === 'bxgy') return 'Buy ' + (o.buy || '2') + ' Get ' + (o.get || '1');
    if (o.discountType === 'fixed') return 'EGP ' + (o.value || '0') + ' OFF';
    return (o.value || '0') + '% OFF';
  }

  function typeLabel(t) {
    if (t === 'fixed') return 'Fixed amount';
    if (t === 'bxgy') return 'Buy X Get Y';
    return 'Percentage';
  }

  function appliesShort(o) {
    if (o.applies === 'products') return 'Products';
    if (o.applies === 'both') return 'Both';
    return 'Memberships';
  }

  function appliesLabel(o) {
    var parts = [];
    if (o.applies === 'memberships' || o.applies === 'both') {
      var planNames = Object.keys(o.planIds || {})
        .filter(function (k) {
          return o.planIds[k];
        })
        .map(function (id) {
          var p = plansCatalog.find(function (x) {
            return x.id === id;
          });
          return p ? p.name : null;
        })
        .filter(Boolean);
      if (o.membershipLabels && o.membershipLabels.length) planNames = o.membershipLabels.slice();
      parts.push(planNames.length ? 'Memberships · ' + planNames.slice(0, 2).join(', ') : 'Memberships');
    }
    if (o.applies === 'products' || o.applies === 'both') {
      var prodNames = Object.keys(o.productIds || {})
        .filter(function (k) {
          return o.productIds[k];
        })
        .map(function (id) {
          var p = productsCatalog.find(function (x) {
            return x.id === id;
          });
          return p ? p.name : null;
        })
        .filter(Boolean);
      if (o.productLabels && o.productLabels.length) prodNames = o.productLabels.slice();
      parts.push(prodNames.length ? 'Products · ' + prodNames.slice(0, 2).join(', ') : 'Products');
    }
    return parts.join(' + ') || '—';
  }

  function formatRange(start, end) {
    if (!start && !end) return '—';
    function fmt(s) {
      if (!s) return '…';
      try {
        var d = new Date(s + 'T12:00:00');
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      } catch (e) {
        return s;
      }
    }
    return fmt(start) + ' – ' + fmt(end);
  }

  function isUsageTracked(o) {
    return o.redemption === 'code' && o.discountType !== 'bxgy';
  }

  function isPosShape(o) {
    return o.redemption === 'code' && o.discountType !== 'bxgy' && o.applies !== 'products';
  }

  function usageHtml(o) {
    if (!isUsageTracked(o)) {
      return '<div class="offer-use">—<span class="hint">Not tracked</span></div>';
    }
    var used = o.usesCount || 0;
    if (o.usageLimit === '' || o.usageLimit == null) {
      return '<div class="offer-use">' + used + '<span class="hint">No cap</span></div>';
    }
    return '<div class="offer-use">' + used + ' of ' + esc(String(o.usageLimit)) + '</div>';
  }

  function dateHtml(o) {
    var st = computeStatus(o);
    var left = daysUntil(o.end);
    var sub =
      st === 'expired'
        ? 'Ended'
        : st === 'scheduled'
          ? 'Starts in ' + daysUntil(o.start) + ' days'
          : left === 0
            ? 'Ends today'
            : left != null
              ? left + ' days left'
              : '';
    var cls = st === 'expired' ? ' mute' : st === 'ending' ? ' warn' : '';
    return (
      '<div class="offer-dates' +
      cls +
      '">' +
      esc(formatRange(o.start, o.end)) +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') +
      '</div>'
    );
  }

  function metaLine(o) {
    var bits = [];
    if (o.redemption === 'code' && o.code) bits.push('<b>' + esc(o.code) + '</b>');
    var st = computeStatus(o);
    if (isPosShape(o) && st !== 'expired' && st !== 'draft') bits.push('POS');
    else if (!o.isDraft) bits.push('App only');
    if (o.showApp && o.featured) bits.push('Featured');
    if (!o.showApp) bits.push('Hidden');
    return bits.length ? '<div class="offer-meta-line">' + bits.join(' · ') + '</div>' : '';
  }

  function statusBadge(s) {
    var map = {
      active: ['on', 'Active'],
      ending: ['end', 'Ending'],
      scheduled: ['sched', 'Scheduled'],
      expired: ['exp', 'Expired'],
      draft: ['draft', 'Draft']
    };
    var m = map[s] || map.draft;
    return '<span class="offer-st ' + m[0] + '"><span class="dot"></span>' + m[1] + '</span>';
  }

  function filteredOffers() {
    var q = (document.getElementById('searchQ').value || '').toLowerCase();
    var type = document.getElementById('filterType').value;
    var applies = document.getElementById('filterApplies').value;
    var status = state.tab === 'all' ? '' : state.tab;
    return state.offers.filter(function (o) {
      var st = computeStatus(o);
      var hay = (o.name + ' ' + (o.short || '') + ' ' + discountLabel(o) + ' ' + (o.code || '')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return false;
      if (type && o.discountType !== type) return false;
      if (applies && o.applies !== applies) return false;
      if (status && tabStatus(st) !== status) return false;
      return true;
    });
  }

  function updateTabCounts() {
    var all = state.offers;
    document.getElementById('nAll').textContent = String(all.length);
    document.getElementById('nActive').textContent = String(
      all.filter(function (o) {
        return tabStatus(computeStatus(o)) === 'active';
      }).length,
    );
    document.getElementById('nScheduled').textContent = String(
      all.filter(function (o) {
        return computeStatus(o) === 'scheduled';
      }).length,
    );
    var nDraft = document.getElementById('nDraft');
    if (nDraft) {
      nDraft.textContent = String(
        all.filter(function (o) {
          return computeStatus(o) === 'draft';
        }).length,
      );
    }
    document.getElementById('nExpired').textContent = String(
      all.filter(function (o) {
        return computeStatus(o) === 'expired';
      }).length,
    );
  }

  function renderList() {
    updateTabCounts();
    closeMenu();
    var rows = filteredOffers();
    var body = document.getElementById('offersBody');
    var empty = document.getElementById('offersEmpty');
    var hint = document.getElementById('offersEmptyHint');
    if (!rows.length) {
      body.innerHTML = '';
      empty.hidden = false;
      var filtered =
        (document.getElementById('searchQ').value || '') ||
        document.getElementById('filterType').value ||
        document.getElementById('filterApplies').value ||
        state.tab !== 'all';
      if (hint) {
        hint.textContent = filtered ? 'Clear search or filters.' : 'Create an offer for memberships or products.';
      }
      var title = empty.querySelector('.offers-empty-title');
      if (title) title.textContent = filtered ? 'No offers match' : 'No offers yet';
      return;
    }
    empty.hidden = true;
    body.innerHTML = rows
      .map(function (o) {
        var st = computeStatus(o);
        var kebab = canManage
          ? '<button type="button" class="offer-kebab" data-menu="' +
            esc(o.id) +
            '" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>'
          : '';
        return (
          '<tr data-id="' +
          esc(o.id) +
          '"' +
          (state.selectedId === o.id ? ' class="sel"' : '') +
          '>' +
          '<td><div class="offer-name">' +
          esc(o.name) +
          '</div><div class="offer-desc">' +
          esc(o.short || '') +
          '</div>' +
          metaLine(o) +
          '</td>' +
          '<td><div class="offer-disc" dir="ltr">' +
          esc(discountLabel(o)) +
          '</div></td>' +
          '<td class="col-for"><span class="offer-pill">' +
          esc(appliesShort(o)) +
          '</span></td>' +
          '<td class="col-dates">' +
          dateHtml(o) +
          '</td>' +
          '<td class="col-use">' +
          usageHtml(o) +
          '</td>' +
          '<td>' +
          statusBadge(st) +
          '</td>' +
          '<td>' +
          kebab +
          '</td></tr>'
        );
      })
      .join('');
  }

  function closeMenu() {
    var menu = document.getElementById('offerMenu');
    if (menu) {
      menu.hidden = true;
      menu.innerHTML = '';
    }
  }

  function closeDrawer() {
    state.selectedId = null;
    var ov = document.getElementById('offerDrawerOv');
    if (ov) {
      ov.hidden = true;
      ov.innerHTML = '';
    }
    document.querySelectorAll('#offersBody tr').forEach(function (tr) {
      tr.classList.remove('sel');
    });
  }

  function drawerRow(k, v) {
    return '<div class="row"><span>' + esc(k) + '</span><strong>' + v + '</strong></div>';
  }

  function openDrawer(o) {
    closeMenu();
    state.selectedId = o.id;
    document.querySelectorAll('#offersBody tr').forEach(function (tr) {
      tr.classList.toggle('sel', tr.getAttribute('data-id') === o.id);
    });
    var st = computeStatus(o);
    var use = !isUsageTracked(o)
      ? 'Not tracked (no linked promo consume)'
      : o.usageLimit === '' || o.usageLimit == null
        ? (o.usesCount || 0) + ' redemptions · no cap'
        : (o.usesCount || 0) + ' of ' + o.usageLimit + ' redemptions';
    var posNote = isPosShape(o)
      ? ''
      : '<div class="offer-note">POS will not apply this offer. Automatic, product, and BXGY are Member App / catalog only. Sale still needs a membership promo code or a manual discount.</div>';
    var ft = '';
    if (canManage) {
      if (st !== 'expired' && !o.isDraft) {
        ft += '<button type="button" class="btn secondary" data-expire="' + esc(o.id) + '">End</button>';
      }
      ft +=
        '<button type="button" class="btn secondary" data-dup="' +
        esc(o.id) +
        '">Duplicate</button>' +
        '<button type="button" class="btn primary" data-edit="' +
        esc(o.id) +
        '">Edit</button>';
    }
    var ov = document.getElementById('offerDrawerOv');
    ov.innerHTML =
      '<div class="offer-drawer">' +
      '<div class="offer-drawer-hdr"><div><h2>' +
      esc(o.name) +
      '</h2><div style="margin-top:8px">' +
      statusBadge(st) +
      '</div></div>' +
      '<button type="button" class="btn secondary" id="closeOfferDrawer" aria-label="Close">✕</button></div>' +
      '<div class="offer-drawer-body">' +
      '<div class="offer-hero-disc" dir="ltr">' +
      esc(discountLabel(o)) +
      '</div>' +
      '<div class="offer-desc">' +
      esc(o.short || '') +
      '</div>' +
      metaLine(o) +
      '<div class="offer-dmeta">' +
      drawerRow('Applies to', esc(appliesLabel(o))) +
      drawerRow('Valid', esc(formatRange(o.start, o.end))) +
      drawerRow(
        'Redemption',
        esc(o.redemption === 'code' ? 'Promo code · ' + (o.code || '—') : 'Automatic (not applied at Sale)'),
      ) +
      drawerRow('Eligibility', esc(o.newOnly ? 'New members only (Member App filter)' : 'All members')) +
      drawerRow('Usage', esc(use)) +
      drawerRow('Member App', esc(!o.showApp ? 'Hidden' : o.featured ? 'Shown · Featured' : 'Shown')) +
      '</div>' +
      posNote +
      '</div>' +
      (ft ? '<div class="offer-drawer-ft">' + ft + '</div>' : '') +
      '</div>';
    ov.hidden = false;
    document.getElementById('closeOfferDrawer').onclick = closeDrawer;
    ov.onclick = function (e) {
      if (e.target === ov) closeDrawer();
    };
    ov.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        var found = state.offers.find(function (x) {
          return x.id === b.getAttribute('data-edit');
        });
        if (found) {
          closeDrawer();
          openCreate(found);
        }
      };
    });
    ov.querySelectorAll('[data-dup]').forEach(function (b) {
      b.onclick = function () {
        duplicateOfferById(b.getAttribute('data-dup'));
      };
    });
    ov.querySelectorAll('[data-expire]').forEach(function (b) {
      b.onclick = function () {
        askEndOffer(b.getAttribute('data-expire'));
      };
    });
  }

  function openMenu(id, btn) {
    var o = state.offers.find(function (x) {
      return x.id === id;
    });
    if (!o || !canManage) return;
    var st = computeStatus(o);
    var menu = document.getElementById('offerMenu');
    menu.innerHTML =
      '<button type="button" data-a="view">View</button>' +
      '<button type="button" data-a="edit">Edit</button>' +
      '<button type="button" data-a="dup">Duplicate</button>' +
      (st !== 'expired' && !o.isDraft ? '<button type="button" class="danger" data-a="end">End…</button>' : '');
    var r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 4 + 'px';
    menu.style.left = Math.max(8, r.right - 168) + 'px';
    menu.hidden = false;
    menu.onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      closeMenu();
      if (a === 'view') openDrawer(o);
      if (a === 'edit') openCreate(o);
      if (a === 'dup') duplicateOfferById(id);
      if (a === 'end') askEndOffer(id);
    };
  }

  async function duplicateOfferById(id) {
    var src = state.offers.find(function (x) {
      return x.id === id;
    });
    if (!src || !Gfp || !canManage) return;
    var copy = JSON.parse(JSON.stringify(src));
    copy.name = src.name + ' (copy)';
    copy.code = src.code ? String(src.code).replace(/COPY$/, '') + 'COPY' : '';
    copy.promoCodeId = null;
    var dupRes = await Gfp.post('/offers', toApi(copy, true));
    if (!dupRes.ok) {
      toast('Duplicate failed', 'err');
      return;
    }
    toast('Duplicated as draft');
    await loadOffers();
    renderList();
  }

  function askEndOffer(id) {
    var off = state.offers.find(function (x) {
      return x.id === id;
    });
    if (!off || !canManage) return;
    state.pendingEndId = id;
    document.getElementById('offerEndCopy').textContent =
      off.name + ' will expire immediately. A linked promo code is deactivated.';
    document.getElementById('offerEndOv').hidden = false;
  }

  async function confirmEndOffer() {
    var id = state.pendingEndId;
    document.getElementById('offerEndOv').hidden = true;
    state.pendingEndId = null;
    if (!id || !Gfp) return;
    var endRes = await Gfp.post('/offers/' + id + '/end');
    if (!endRes.ok) {
      toast('Could not end offer', 'err');
      return;
    }
    toast('Offer ended');
    closeDrawer();
    await loadOffers();
    renderList();
  }

  function setView(view) {
    closeDrawer();
    closeMenu();
    state.view = view;
    document.getElementById('viewList').hidden = view !== 'list';
    document.getElementById('viewCreate').hidden = view !== 'create';
    document.getElementById('viewMember').hidden = view !== 'member';
    document.getElementById('crumbCur').textContent =
      view === 'create' ? 'Create Offer' : view === 'member' ? 'Member App' : 'Offers & Promotions';
    if (view === 'list') renderList();
    if (view === 'create') renderWizard();
    if (view === 'member') renderMemberFrames();
  }

  function openCreate(editOffer) {
    if (!canManage) {
      toast('Creating offers needs plans.manage', 'err');
      return;
    }
    if (editOffer) {
      state.editingId = editOffer.id;
      state.form = Object.assign(blankForm(), JSON.parse(JSON.stringify(editOffer)));
      document.getElementById('wizTitle').innerHTML = '<i class="ti ti-pencil"></i> Edit Offer';
    } else {
      state.editingId = null;
      state.form = blankForm();
      var t = todayStr();
      state.form.start = t;
      state.form.end = t;
      document.getElementById('wizTitle').innerHTML = '<i class="ti ti-plus"></i> Create Offer';
    }
    state.step = 1;
    setView('create');
  }

  function field(key, label, val, isHalf, type) {
    return (
      '<div class="field' +
      (isHalf ? '' : ' span2') +
      '" data-field="' +
      esc(key) +
      '"><label>' +
      esc(label) +
      '</label><input type="' +
      (type || 'text') +
      '" data-k="' +
      esc(key) +
      '" value="' +
      esc(val == null ? '' : val) +
      '"><div class="err">Required</div></div>'
    );
  }

  function segBtn(val, label, cur) {
    return (
      '<button type="button" class="' +
      (cur === val ? 'act' : '') +
      '" data-seg="' +
      esc(val) +
      '">' +
      esc(label) +
      '</button>'
    );
  }

  function switchBtn(key, on) {
    return '<button type="button" class="switch' + (on ? ' on' : '') + '" data-sw="' + esc(key) + '" aria-pressed="' + (on ? 'true' : 'false') + '"></button>';
  }

  function checkItem(mapKey, id, label, checked) {
    return (
      '<label class="check' +
      (checked ? ' on' : '') +
      '"><input type="checkbox" data-map="' +
      esc(mapKey) +
      '" data-id="' +
      esc(id) +
      '"' +
      (checked ? ' checked' : '') +
      '> ' +
      esc(label) +
      '</label>'
    );
  }

  function updateLivePhone() {
    var f = state.form;
    var title = discountLabel(f);
    var el = document.getElementById('livePhone');
    if (!f.showApp) {
      el.innerHTML =
        '<div style="padding:24px 8px;text-align:center;color:var(--ltt);font-size:12px;line-height:1.5"><i class="ti ti-eye-off" style="font-size:28px;color:var(--l300);display:block;margin-bottom:8px"></i>Hidden from Member App.<br>Offer can still redeem automatically or via code at desk/POS.</div>';
      return;
    }
    el.innerHTML =
      '<div class="app-offer-card">' +
      '<div class="fire">' +
      (f.featured ? '🔥 FEATURED OFFER' : 'SPECIAL OFFER') +
      '</div>' +
      '<h4>' +
      esc(title) +
      '</h4>' +
      '<p>' +
      esc(f.short || f.name || 'Your offer copy appears here.') +
      '</p>' +
      '<span class="cta">View Offer</span>' +
      '</div>' +
      (f.banner
        ? '<div style="margin-top:8px;padding:10px;border-radius:12px;background:#fff;border:1px dashed #c5d4b8;font-size:11px;color:var(--lts)">Banner slot · display order #' +
          esc(f.order || '1') +
          '</div>'
        : '');
  }

  function validateStep(step) {
    var f = state.form;
    if (step === 1) {
      if (!String(f.name || '').trim()) {
        toast('Offer name is required', 'err');
        return false;
      }
      if (!f.start || !f.end) {
        toast('Start and end dates are required', 'err');
        return false;
      }
      if (f.end < f.start) {
        toast('End date must be on or after start date', 'err');
        return false;
      }
    }
    if (step === 3) {
      if (f.discountType === 'bxgy') {
        if (!f.buy || !f.get || Number(f.buy) < 1 || Number(f.get) < 1) {
          toast('Buy and Get must be at least 1', 'err');
          return false;
        }
      } else if (!f.value || Number(f.value) <= 0) {
        toast('Discount value must be greater than 0', 'err');
        return false;
      }
    }
    if (step === 6 && f.redemption === 'code') {
      var code = String(f.code || '')
        .trim()
        .toUpperCase();
      if (!code) {
        toast('Promo code is required for code redemption', 'err');
        return false;
      }
      f.code = code;
    }
    return true;
  }

  function renderWizard() {
    var f = state.form;
    var step = state.step;
    document.querySelectorAll('#wizNav .wiz-step').forEach(function (el) {
      var s = Number(el.getAttribute('data-step'));
      el.classList.toggle('act', s === step);
      el.classList.toggle('done', s < step);
    });

    var html = '';
    if (step === 1) {
      html =
        '<h2>Offer details</h2><p class="hint">Name and schedule gym owners will recognize at a glance.</p>' +
        '<div class="form-grid">' +
        field('name', 'Offer Name', f.name, true) +
        field('short', 'Short Description', f.short, true) +
        '<div class="field span2"><label>Description</label><textarea data-k="desc">' +
        esc(f.desc) +
        '</textarea></div>' +
        '<div class="field span2"><label>Offer image / banner</label><div class="drop-mock">Image upload is not available yet. You can still turn on Show Banner in Member App.</div></div>' +
        field('start', 'Start Date', f.start, true, 'date') +
        field('end', 'End Date', f.end, true, 'date') +
        '</div>';
    } else if (step === 2) {
      var planChecks =
        plansCatalog.length > 0
          ? plansCatalog
              .slice(0, 12)
              .map(function (p) {
                return checkItem('planIds', p.id, p.name, !!(f.planIds && f.planIds[p.id]));
              })
              .join('')
          : '<div class="offer-desc">No plans loaded — select Applies To; items can be chosen after plans API is available.</div>';
      var prodChecks =
        productsCatalog.length > 0
          ? productsCatalog
              .slice(0, 12)
              .map(function (p) {
                return checkItem('productIds', p.id, p.name, !!(f.productIds && f.productIds[p.id]));
              })
              .join('')
          : '<div class="offer-desc">No products loaded (inventory may be off). Product targeting still stores your selection when available.</div>';
      html =
        '<h2>Applies to</h2><p class="hint">Memberships, products, or both — one offer model.</p>' +
        '<div class="seg" data-seg-group="applies">' +
        segBtn('memberships', 'Memberships', f.applies) +
        segBtn('products', 'Products', f.applies) +
        segBtn('both', 'Both', f.applies) +
        '</div>' +
        (f.applies === 'memberships' || f.applies === 'both'
          ? '<h3 style="margin:18px 0 8px;font-family:var(--fd);font-size:14px">Memberships</h3><div class="check-list">' +
            planChecks +
            '</div>'
          : '') +
        (f.applies === 'products' || f.applies === 'both'
          ? '<h3 style="margin:18px 0 8px;font-family:var(--fd);font-size:14px">Products</h3><div class="check-list">' +
            prodChecks +
            '</div>'
          : '');
    } else if (step === 3) {
      html =
        '<h2>Discount configuration</h2><p class="hint">Percentage and fixed membership codes apply at Sale. Buy X Get Y is listed and shown in the Member App — POS does not calculate it yet.</p>' +
        '<div class="seg" data-seg-group="discountType">' +
        segBtn('percentage', 'Percentage', f.discountType) +
        segBtn('fixed', 'Fixed Amount', f.discountType) +
        segBtn('bxgy', 'Buy X Get Y', f.discountType) +
        '</div>' +
        '<div class="form-grid" style="margin-top:16px">' +
        (f.discountType === 'bxgy'
          ? field('buy', 'Buy', f.buy, true, 'number') + field('get', 'Get', f.get, true, 'number')
          : field('value', f.discountType === 'fixed' ? 'Amount (EGP)' : 'Value (%)', f.value, true, 'number') +
            field('maxDiscount', 'Maximum Discount (optional)', f.maxDiscount, true, 'number')) +
        '</div>';
    } else if (step === 4) {
      html =
        '<h2>Eligibility &amp; rules</h2><p class="hint">Plain language for gym owners.</p>' +
        '<div class="toggle-row"><div><strong>Available to all members</strong><div style="font-size:12px;color:var(--ltt)">Everyone with an active account</div></div>' +
        switchBtn('allMembers', f.allMembers) +
        '</div>' +
        '<div class="toggle-row"><div><strong>New members only</strong><div style="font-size:12px;color:var(--ltt)">First membership purchase</div></div>' +
        switchBtn('newOnly', f.newOnly) +
        '</div>' +
        '<div class="form-grid" style="margin-top:14px">' +
        field('minPurchase', 'Minimum purchase (optional EGP)', f.minPurchase, true, 'number') +
        field('usageLimit', 'Usage limit (total redemptions)', f.usageLimit, true, 'number') +
        field('perMember', 'Per member limit', f.perMember, true, 'number') +
        '</div>';
    } else if (step === 5) {
      html =
        '<h2>Member App visibility</h2><p class="hint">Control whether members discover this offer in the app.</p>' +
        '<div class="toggle-row"><div><strong>Show on Member App</strong></div>' +
        switchBtn('showApp', f.showApp) +
        '</div>' +
        '<div class="toggle-row"><div><strong>Display as Featured Offer</strong></div>' +
        switchBtn('featured', f.featured) +
        '</div>' +
        '<div class="toggle-row"><div><strong>Show Banner</strong></div>' +
        switchBtn('banner', f.banner) +
        '</div>' +
        '<div class="form-grid" style="margin-top:12px">' +
        field('order', 'Display Order', f.order, true, 'number') +
        '</div>';
    } else if (step === 6) {
      html =
        '<h2>Redemption</h2><p class="hint">Promo Code is only one way to redeem an Offer — not a separate module.</p>' +
        '<div class="seg" data-seg-group="redemption">' +
        segBtn('auto', 'Automatic', f.redemption) +
        segBtn('code', 'Promo Code', f.redemption) +
        '</div>' +
        (f.redemption === 'code'
          ? '<div class="form-grid" style="margin-top:16px">' +
            field('code', 'Promo Code', f.code, true) +
            field('usageLimit', 'Usage Limit', f.usageLimit, true, 'number') +
            field('perMember', 'Per Member', f.perMember, true, 'number') +
            '</div><p class="hint" style="margin-top:12px">Publishing will sync this code to live Promo Codes for POS when you have plans.manage.</p>'
          : '<p class="hint" style="margin-top:14px">Automatic — members can see this in the app. Sale does not apply it automatically. Use a promo code or a manual discount at POS.</p>');
    } else {
      html =
        '<h2>Review &amp; publish</h2><p class="hint">Confirm before saving. Save Draft keeps Member App / POS inactive until you publish.</p>' +
        '<div class="summary-box">' +
        '<div class="k">Offer</div><div class="v">' +
        esc(f.name || '—') +
        '</div>' +
        '<div class="k">Discount</div><div class="v">' +
        esc(discountLabel(f)) +
        '</div>' +
        '<div class="k">Applies to</div><div class="v">' +
        esc(appliesLabel(f)) +
        '</div>' +
        '<div class="k">Valid</div><div class="v">' +
        esc(formatRange(f.start, f.end)) +
        '</div>' +
        '<div class="k">Eligibility</div><div class="v">' +
        esc(f.newOnly ? 'New members only' : f.allMembers ? 'All members' : 'Custom') +
        '</div>' +
        '<div class="k">Redemption</div><div class="v">' +
        esc(f.redemption === 'code' ? 'Promo Code · ' + (f.code || '—') : 'Automatic') +
        '</div>' +
        '<div class="k">Member App</div><div class="v">' +
        esc(!f.showApp ? 'Hidden' : f.featured ? 'Featured' : 'Shown') +
        '</div>' +
        '<div class="k">Usage</div><div class="v">' +
        esc((f.usageLimit || '∞') + ' total · ' + (f.perMember || '—') + ' per member') +
        '</div>' +
        '</div>';
    }

    html +=
      '<div class="wiz-actions">' +
      '<button type="button" class="btn secondary" id="wizBack"' +
      (step === 1 ? ' disabled' : '') +
      '>Back</button>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      (step === 7
        ? '<button type="button" class="btn secondary" id="wizDraft">Save Draft</button><button type="button" class="btn primary" id="wizPublish">Create Offer</button>'
        : '<button type="button" class="btn primary" id="wizNext">Continue</button>') +
      '</div></div>';

    document.getElementById('wizPanel').innerHTML = html;
    updateLivePhone();
    bindWizardPanel();
  }

  function bindWizardPanel() {
    var panel = document.getElementById('wizPanel');
    panel.querySelectorAll('[data-k]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-k');
        state.form[k] = inp.value;
        if (k === 'code') state.form.code = String(inp.value || '').toUpperCase();
        updateLivePhone();
      });
    });
    panel.querySelectorAll('[data-seg-group] button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.parentElement.getAttribute('data-seg-group');
        var val = btn.getAttribute('data-seg');
        state.form[group] = val;
        if (group === 'applies' || group === 'discountType' || group === 'redemption') renderWizard();
        else updateLivePhone();
      });
    });
    panel.querySelectorAll('[data-sw]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-sw');
        state.form[k] = !state.form[k];
        if (k === 'newOnly' && state.form.newOnly) state.form.allMembers = false;
        if (k === 'allMembers' && state.form.allMembers) state.form.newOnly = false;
        renderWizard();
      });
    });
    panel.querySelectorAll('input[data-map]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var map = cb.getAttribute('data-map');
        var id = cb.getAttribute('data-id');
        if (!state.form[map]) state.form[map] = {};
        state.form[map][id] = cb.checked;
        cb.closest('.check').classList.toggle('on', cb.checked);
      });
    });
    var back = document.getElementById('wizBack');
    var next = document.getElementById('wizNext');
    var draft = document.getElementById('wizDraft');
    var pub = document.getElementById('wizPublish');
    if (back)
      back.onclick = function () {
        if (state.step > 1) {
          state.step--;
          renderWizard();
        }
      };
    if (next)
      next.onclick = function () {
        if (!validateStep(state.step)) return;
        state.step++;
        renderWizard();
      };
    if (draft)
      draft.onclick = function () {
        persistOffer(true);
      };
    if (pub)
      pub.onclick = function () {
        if (!validateStep(1) || !validateStep(3) || !validateStep(6)) {
          toast('Fix required fields before publishing', 'err');
          return;
        }
        persistOffer(false);
      };
  }

  async function persistOffer(asDraft) {
    var f = Object.assign({}, state.form);
    f.name = String(f.name || '').trim();
    if (!f.name) {
      toast('Offer name is required', 'err');
      return;
    }
    if (!Gfp) {
      toast('API client missing', 'err');
      return;
    }

    var body = toApi(f, asDraft);
    var res;
    if (state.editingId && String(state.editingId).indexOf('off_') !== 0) {
      res = await Gfp.put('/offers/' + state.editingId, body);
    } else {
      res = await Gfp.post('/offers', body);
    }
    if (!res.ok) {
      var err =
        (res.data && (res.data.error || res.data.detail || res.data.title)) ||
        'Save failed (' + (res.status || '?') + ')';
      toast(String(err), 'err');
      return;
    }
    toast(asDraft ? 'Draft saved' : 'Offer published');
    await loadOffers();
    setView('list');
  }

  function renderMemberFrames() {
    var visible = state.offers
      .filter(function (o) {
        return o.showApp && computeStatus(o) !== 'draft';
      })
      .sort(function (a, b) {
        return Number(a.order || 99) - Number(b.order || 99);
      });
    var featured = visible.find(function (o) {
      return o.featured;
    }) || visible[0];
    var productOffer = visible.find(function (o) {
      return o.applies === 'products' || o.applies === 'both';
    });
    var memOffer = visible.find(function (o) {
      return (o.applies === 'memberships' || o.applies === 'both') && o.discountType !== 'bxgy';
    });

    var listCards =
      visible.length === 0
        ? '<div class="m-card"><p>No offers are visible in the Member App yet. Turn on “Show on Member App” when creating an offer.</p></div>'
        : visible
            .slice(0, 4)
            .map(function (o) {
              return (
                '<div class="m-card' +
                (o.featured ? ' featured' : '') +
                '">' +
                '<div class="tag">' +
                (o.featured ? '🔥 FEATURED' : o.applies === 'products' ? 'PRODUCTS' : 'MEMBERSHIP') +
                '</div>' +
                '<h4>' +
                esc(o.name) +
                '</h4>' +
                '<p>' +
                esc(discountLabel(o)) +
                ' · ' +
                esc(o.short || '') +
                '</p>' +
                '<button type="button" class="btn-m">' +
                (o.applies === 'products' ? 'Add to Cart' : 'View Offer') +
                '</button></div>'
              );
            })
            .join('');

    var memHtml =
      '<div class="special">🔥 Special Offer' +
      (memOffer ? ' · ' + esc(discountLabel(memOffer)) : '') +
      '</div>' +
      '<div class="m-card">' +
      '<div class="price-row"><span>Original</span><strong class="strike">EGP 1,500</strong></div>' +
      '<div class="price-row"><span>Offer</span><strong>' +
      esc(memOffer ? discountLabel(memOffer) : '—') +
      '</strong></div>' +
      '<div class="price-row save"><span>You save</span><strong>EGP 300</strong></div>' +
      '<div class="price-row" style="border-top:1px solid var(--ls3);padding-top:10px;margin-top:8px"><span>Final price</span><strong style="font-size:20px;color:#3f6212">EGP 1,200</strong></div>' +
      '<button type="button" class="btn-m" style="width:100%">Continue</button></div>' +
      '<p style="font-size:11px;color:var(--ltt);line-height:1.4;margin-top:8px">Visual demo — numbers are static.</p>';

    var cartHtml =
      '<div class="m-card">' +
      '<div class="special">' +
      esc(productOffer ? discountLabel(productOffer) : 'Buy 2 Get 1') +
      '</div>' +
      '<h4 style="font-family:var(--fd);font-size:15px">Protein Bar</h4>' +
      '<p style="font-size:12px;color:var(--ltt)">EGP 80 each</p>' +
      '<div class="cart-line"><span>Protein Bar × 3</span><strong>EGP 240</strong></div>' +
      '<div class="cart-promo">Promotion · ' +
      esc(productOffer ? discountLabel(productOffer) : 'Buy 2 Get 1') +
      '<br>− EGP 80</div>' +
      '<div class="cart-total"><span>Total</span><span>EGP 160</span></div>' +
      '<button type="button" class="btn-m" style="width:100%;margin-top:12px">Checkout</button></div>';

    document.getElementById('memberFrames').innerHTML =
      '<div class="device-col"><h3>1 · Special Offers</h3><div class="device"><div class="bar"></div><div class="screen"><div class="screen-hdr">Special Offers</div><div class="screen-body">' +
      listCards +
      '</div></div></div></div>' +
      '<div class="device-col"><h3>2 · Membership detail</h3><div class="device"><div class="bar"></div><div class="screen"><div class="screen-hdr">3-Month Membership</div><div class="screen-body">' +
      memHtml +
      '</div></div></div></div>' +
      '<div class="device-col"><h3>3 · Product &amp; cart</h3><div class="device"><div class="bar"></div><div class="screen"><div class="screen-hdr">Cart</div><div class="screen-body">' +
      cartHtml +
      '</div></div></div></div>';
  }

  function bootChrome() {
    var ini = (user.fullName || 'U')
      .split(' ')
      .map(function (w) {
        return w[0];
      })
      .join('')
      .slice(0, 2)
      .toUpperCase();
    document.getElementById('userAvatar').textContent = ini;
    document.getElementById('userName').textContent = user.fullName || 'User';
    document.getElementById('userRole').textContent = user.role || 'Staff';
    document.getElementById('btnLogout').onclick = function () {
      if (Gfp && Gfp.logout) Gfp.logout();
      else {
        ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach(function (k) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
        location.href = '/auth/login/';
      }
    };
    if (!canManage) {
      document.getElementById('btnCreateOffer').style.display = 'none';
    }
  }

  async function loadCatalogs() {
    if (!Gfp) return;
    try {
      var plansRes = await Gfp.get('/membership-plans');
      if (plansRes.ok && Array.isArray(plansRes.data)) {
        plansCatalog = plansRes.data.map(function (p) {
          return { id: p.id, name: p.name || p.nameEn || 'Plan' };
        });
      }
    } catch (e) { /* ignore */ }
    try {
      var prodRes = await Gfp.get('/inventory/products?page=1&pageSize=50');
      var items = (prodRes.data && (prodRes.data.items || prodRes.data)) || [];
      if (prodRes.ok && Array.isArray(items)) {
        productsCatalog = items.map(function (p) {
          return { id: p.id, name: p.name || p.sku || 'Product' };
        });
      }
    } catch (e) { /* ignore */ }
    try {
      var s = await Gfp.get('/settings');
      if (s.ok && s.data) {
        document.getElementById('gymName').textContent = s.data.gymName || 'Gym';
      }
    } catch (e) { /* ignore */ }
  }

  function bindGlobal() {
    document.getElementById('btnCreateOffer').onclick = function () {
      openCreate(null);
    };
    var memberBtn = document.getElementById('btnMemberApp');
    if (memberBtn) {
      memberBtn.onclick = function () {
        setView('member');
      };
    }
    document.getElementById('btnBackList').onclick = function () {
      setView('list');
    };
    var backMember = document.getElementById('btnBackMember');
    if (backMember) {
      backMember.onclick = function () {
        setView('list');
      };
    }
    ['searchQ', 'filterType', 'filterApplies'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', renderList);
      document.getElementById(id).addEventListener('change', renderList);
    });
    document.getElementById('statusTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      state.tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#statusTabs .tab').forEach(function (t) {
        t.classList.toggle('act', t === btn);
      });
      renderList();
    });
    document.getElementById('offersBody').addEventListener('click', function (e) {
      var menuBtn = e.target.closest('[data-menu]');
      if (menuBtn) {
        e.stopPropagation();
        openMenu(menuBtn.getAttribute('data-menu'), menuBtn);
        return;
      }
      var tr = e.target.closest('tr[data-id]');
      if (tr) {
        var o = state.offers.find(function (x) {
          return x.id === tr.getAttribute('data-id');
        });
        if (o) openDrawer(o);
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#offerMenu') && !e.target.closest('[data-menu]')) closeMenu();
    });
    document.getElementById('offerEndNo').onclick = function () {
      state.pendingEndId = null;
      document.getElementById('offerEndOv').hidden = true;
    };
    document.getElementById('offerEndYes').onclick = confirmEndOffer;
    document.getElementById('wizNav').addEventListener('click', function (e) {
      var stepBtn = e.target.closest('[data-step]');
      if (!stepBtn) return;
      var s = Number(stepBtn.getAttribute('data-step'));
      if (s < state.step || s === state.step) {
        state.step = s;
        renderWizard();
      } else if (validateStep(state.step)) {
        state.step = s;
        renderWizard();
      }
    });
  }

  // boot
  bootChrome();
  bindGlobal();
  loadCatalogs()
    .then(function () {
      return loadOffers();
    })
    .then(function () {
      renderList();
    });
  setView('list');
})();
