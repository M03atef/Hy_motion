(function () {
  'use strict';

  function t(en, ar) {
    var lang = (document.documentElement.lang || 'en').toLowerCase();
    return lang === 'ar' ? ar : en;
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function timeAgo(d) {
    if (!d) return '';
    var now = new Date(), dt = new Date(d);
    var diff = Math.floor((now - dt) / 60000);
    if (diff < 1) return t('Just now', 'الآن');
    if (diff < 60) return diff + t('m ago', ' د');
    var h = Math.floor(diff / 60);
    if (h < 24) return h + t('h ago', ' س');
    var days = Math.floor(h / 24);
    if (days === 1) return t('Yesterday', 'أمس');
    if (days < 7) return days + t('d ago', ' ي');
    return dt.toLocaleDateString();
  }
  function isAr() {
    return (document.documentElement.lang || '').toLowerCase() === 'ar';
  }
  function priorityClass(p) {
    if (p === 'Critical') return 'prio-critical';
    if (p === 'ActionRequired') return 'prio-action';
    return 'prio-info';
  }
  function categoryIcon(c) {
    var map = {
      Members: 'ti-users', Memberships: 'ti-id', Leads: 'ti-phone-call', Payments: 'ti-cash',
      Classes: 'ti-run', Bookings: 'ti-calendar', Attendance: 'ti-door-enter', POS: 'ti-shopping-cart',
      Inventory: 'ti-package', Purchasing: 'ti-truck', Staff: 'ti-user-shield', Shifts: 'ti-clock',
      Security: 'ti-shield-lock', System: 'ti-settings'
    };
    return map[c] || 'ti-bell';
  }
  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function pick(obj, camel, pascal) {
    if (!obj) return null;
    if (obj[camel] != null && obj[camel] !== '') return obj[camel];
    if (obj[pascal] != null && obj[pascal] !== '') return obj[pascal];
    return obj[camel] != null ? obj[camel] : obj[pascal];
  }
  function withQuery(base, key, value) {
    if (!value) return base;
    var sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base + sep + encodeURIComponent(key) + '=' + encodeURIComponent(String(value));
  }
  /** Build / enrich deep link so a click opens the related screen. */
  function resolveActionUrl(n) {
    var raw = pick(n, 'actionUrl', 'ActionUrl');
    var entityType = String(pick(n, 'entityType', 'EntityType') || '');
    var entityId = pick(n, 'entityId', 'EntityId');
    var id = entityId != null && entityId !== '' ? String(entityId) : '';
    var url = raw ? String(raw).trim() : '';

    if (url && id && url.indexOf(id) < 0) {
      if (/\/hr\/employees\/?$/i.test(url) || (entityType === 'Employee' && /\/hr\/employees\/?/i.test(url) && url.indexOf('id=') < 0))
        url = withQuery(url.split('?')[0].replace(/\/?$/, '/'), 'id', id);
      else if (/\/purchase-orders\/?$/i.test(url) || (entityType === 'PurchaseOrder' && /purchase-orders/i.test(url) && url.indexOf('id=') < 0))
        url = withQuery(url.split('?')[0].replace(/\/?$/, '/'), 'id', id);
      else if (entityType === 'ActivitySession' && /\/classes\/?/i.test(url) && url.indexOf('sessionId=') < 0)
        url = withQuery(url.split('?')[0].replace(/\/?$/, '/'), 'sessionId', id);
      else if (entityType === 'Product' && /\/inventory\/products\/?/i.test(url) && url.indexOf('focus=') < 0)
        url = withQuery(url.split('?')[0].replace(/\/?$/, '/'), 'focus', id);
      else if (entityType === 'Shift' && (/\/shifts\/?/i.test(url) || /\/z-report\/?/i.test(url)) && url.indexOf('shiftId=') < 0)
        url = '/dashboard/z-report/?shiftId=' + encodeURIComponent(id);
      else if (entityType === 'GymMember' && !/\/members\/[^/?]+/i.test(url))
        url = '/dashboard/members/' + encodeURIComponent(id) + '/';
      // Membership: ActionUrl already points at the member — never swap in membership EntityId
    }

    if (url) return url;

    switch (entityType) {
      case 'Employee':
        return id ? '/dashboard/hr/employees/?id=' + encodeURIComponent(id) : '/dashboard/hr/employees/';
      case 'PurchaseOrder':
        return id ? '/dashboard/inventory/purchase-orders/?id=' + encodeURIComponent(id) : '/dashboard/inventory/purchase-orders/';
      case 'ActivitySession':
        return id ? '/dashboard/classes/?sessionId=' + encodeURIComponent(id) : '/dashboard/classes/';
      case 'ActivityBooking':
        return '/dashboard/classes/';
      case 'Product':
        return id ? '/dashboard/inventory/products/?focus=' + encodeURIComponent(id) : '/dashboard/inventory/products/';
      case 'Shift':
        return id ? '/dashboard/z-report/?shiftId=' + encodeURIComponent(id) : '/dashboard/shifts/';
      case 'GymMember':
        return id ? '/dashboard/members/' + encodeURIComponent(id) + '/' : '/dashboard/members/';
      case 'Membership':
        // Reminder publishers store member id in ActionUrl; EntityId is membership — open members list as fallback
        return '/dashboard/members/';
      case 'MemberFollowUp':
        return '/dashboard/call-sheet/';
      case 'Refund':
        return '/dashboard/';
      default:
        return '';
    }
  }

  var Authz = window.GfpAuthz;
  var Gfp = window.GfpApi;
  var canCompose = !!(Authz && Authz.useCanRole && Authz.useCanRole('ManagerOrAbove'));
  if (!canCompose) {
    try {
      var u = JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || 'null');
      if (u && /^(Owner|Manager)$/i.test(u.role || '')) canCompose = true;
    } catch (e) { /* ignore */ }
  }

  var unreadOnly = false;
  var page = 1;
  var pageSize = 20;

  // Tabs
  var tabInbox = document.getElementById('tabInbox');
  var tabCompose = document.getElementById('tabCompose');
  if (canCompose && tabCompose) tabCompose.hidden = false;

  function showTab(name) {
    document.getElementById('inboxView').hidden = name !== 'inbox';
    document.getElementById('composeView').hidden = name !== 'compose';
    tabInbox.classList.toggle('act', name === 'inbox');
    if (tabCompose) tabCompose.classList.toggle('act', name === 'compose');
    if (name === 'compose') loadHistory();
  }
  tabInbox.addEventListener('click', function () { showTab('inbox'); });
  if (tabCompose) tabCompose.addEventListener('click', function () { showTab('compose'); });

  document.getElementById('filterAll').addEventListener('click', function () {
    unreadOnly = false;
    this.classList.add('act');
    document.getElementById('filterUnread').classList.remove('act');
    page = 1;
    loadInbox();
  });
  document.getElementById('filterUnread').addEventListener('click', function () {
    unreadOnly = true;
    this.classList.add('act');
    document.getElementById('filterAll').classList.remove('act');
    page = 1;
    loadInbox();
  });

  document.getElementById('btnMarkAllRead').addEventListener('click', async function () {
    if (!Gfp) return;
    var r = await Gfp.post('/staff-notifications/read-all', {});
    if (!r.ok) {
      toast((r.data && r.data.error) || t('Failed', 'فشل'), 'error');
      return;
    }
    toast(t('All marked as read', 'تم تعليم الكل كمقروء'));
    loadInbox();
    if (window.GfpStaffNotifications) window.GfpStaffNotifications.refresh();
  });

  async function loadInbox() {
    var list = document.getElementById('inboxList');
    if (!Gfp) {
      list.innerHTML = '<div class="empty-state"><i class="ti ti-alert-circle"></i>' + esc(t('API client missing', 'عميل الواجهة غير موجود')) + '</div>';
      return;
    }
    list.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    var q = '/staff-notifications?page=' + page + '&pageSize=' + pageSize + '&unreadOnly=' + (unreadOnly ? 'true' : 'false');
    var r = await Gfp.get(q);
    if (!r.ok) {
      list.innerHTML = '<div class="empty-state"><i class="ti ti-alert-circle"></i>' + esc((r.data && r.data.error) || t('Failed to load', 'فشل التحميل')) + '</div>';
      return;
    }
    var data = r.data || {};
    var items = Array.isArray(data.items) ? data.items : (Array.isArray(data.Items) ? data.Items : []);
    var total = data.totalCount != null ? data.totalCount : (data.TotalCount || 0);

    var countR = await Gfp.get('/staff-notifications/unread-count');
    var unread = countR.ok && countR.data ? (countR.data.count || 0) : 0;
    var pill = document.getElementById('inboxUnreadPill');
    if (unread > 0) {
      pill.hidden = false;
      pill.textContent = String(unread);
    } else {
      pill.hidden = true;
    }
    if (window.GfpStaffNotifications) window.GfpStaffNotifications.refresh();

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><i class="ti ti-bell-off"></i>' +
        esc(unreadOnly ? t('No unread notifications', 'لا توجد إشعارات غير مقروءة') : t('No notifications yet', 'لا توجد إشعارات بعد')) +
        '</div>';
      document.getElementById('inboxPager').hidden = true;
      return;
    }

    var todayStart = startOfToday();
    var todayItems = [];
    var earlierItems = [];
    items.forEach(function (n) {
      var when = new Date(pick(n, 'sentAtUtc', 'SentAtUtc') || pick(n, 'createdAtUtc', 'CreatedAtUtc') || pick(n, 'sentAt', 'SentAt'));
      if (when >= todayStart) todayItems.push(n);
      else earlierItems.push(n);
    });

    function renderGroup(title, rows) {
      if (!rows.length) return '';
      return '<div class="inbox-group"><div class="inbox-group-title">' + esc(title) + '</div>' +
        rows.map(renderRow).join('') + '</div>';
    }

    function renderRow(n) {
      var title = isAr()
        ? (pick(n, 'titleAr', 'TitleAr') || pick(n, 'title', 'Title'))
        : (pick(n, 'title', 'Title') || pick(n, 'titleAr', 'TitleAr'));
      var body = isAr()
        ? (pick(n, 'bodyAr', 'BodyAr') || pick(n, 'body', 'Body'))
        : (pick(n, 'body', 'Body') || pick(n, 'bodyAr', 'BodyAr'));
      var id = pick(n, 'id', 'Id');
      var priority = pick(n, 'priority', 'Priority') || 'Info';
      var category = pick(n, 'category', 'Category');
      var sent = pick(n, 'sentAtUtc', 'SentAtUtc') || pick(n, 'createdAtUtc', 'CreatedAtUtc') || pick(n, 'sentAt', 'SentAt');
      var isRead = !!(pick(n, 'isRead', 'IsRead') || pick(n, 'readAtUtc', 'ReadAtUtc'));
      var url = resolveActionUrl(n);
      var readCls = isRead ? 'read' : 'unread';
      var cta = url
        ? '<a class="inbox-cta" href="' + esc(url) + '">' + esc(t('Open related', 'فتح المرتبط')) + '</a>'
        : '';
      return '<article class="inbox-item ' + readCls + ' ' + priorityClass(priority) + (url ? ' has-link' : '') + '" data-id="' + esc(id) + '" data-url="' + esc(url || '') + '" role="link" tabindex="0">' +
        '<div class="inbox-icon"><i class="ti ' + categoryIcon(category) + '"></i></div>' +
        '<div class="inbox-body">' +
          '<div class="inbox-title-row"><strong>' + esc(title) + '</strong>' +
            '<span class="inbox-prio">' + esc(priority) + '</span></div>' +
          '<p class="inbox-msg">' + esc(body) + '</p>' +
          '<div class="inbox-meta"><span>' + esc(timeAgo(sent)) + '</span>' +
            (category ? '<span class="inbox-cat">' + esc(category) + '</span>' : '') + cta + '</div>' +
        '</div></article>';
    }

    list.innerHTML =
      renderGroup(t('Today', 'اليوم'), todayItems) +
      renderGroup(t('Earlier', 'سابقاً'), earlierItems);

    list.querySelectorAll('.inbox-item').forEach(function (el) {
      async function openRelated(ev) {
        if (ev && ev.target && ev.target.closest && ev.target.closest('.inbox-cta')) {
          // Let the anchor navigate; still mark read first.
          ev.preventDefault();
          var href = ev.target.closest('.inbox-cta').getAttribute('href');
          await markRead(el.getAttribute('data-id'));
          if (href) window.location.href = href;
          return;
        }
        var id = el.getAttribute('data-id');
        var url = el.getAttribute('data-url');
        await markRead(id);
        if (url) window.location.href = url;
        else loadInbox();
      }
      el.addEventListener('click', openRelated);
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openRelated(ev);
        }
      });
    });

    var pager = document.getElementById('inboxPager');
    var pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages > 1) {
      pager.hidden = false;
      pager.innerHTML =
        '<button type="button" class="btn-secondary" id="btnPrev"' + (page <= 1 ? ' disabled' : '') + '>' + esc(t('Previous', 'السابق')) + '</button>' +
        '<span>' + page + ' / ' + pages + '</span>' +
        '<button type="button" class="btn-secondary" id="btnNext"' + (page >= pages ? ' disabled' : '') + '>' + esc(t('Next', 'التالي')) + '</button>';
      var prev = document.getElementById('btnPrev');
      var next = document.getElementById('btnNext');
      if (prev) prev.addEventListener('click', function () { page--; loadInbox(); });
      if (next) next.addEventListener('click', function () { page++; loadInbox(); });
    } else {
      pager.hidden = true;
    }
  }

  async function markRead(id) {
    if (!id || !Gfp) return;
    await Gfp.post('/staff-notifications/' + id + '/read', {});
    if (window.GfpStaffNotifications) window.GfpStaffNotifications.refresh();
  }

  // ── Compose (Manager+) ──
  var selectedMembers = [];
  var debounceTimer = null;

  document.querySelectorAll('.target-radio').forEach(function (radio) {
    radio.addEventListener('click', function () {
      document.querySelectorAll('.target-radio').forEach(function (r) { r.classList.remove('selected'); });
      this.classList.add('selected');
      this.querySelector('input').checked = true;
      var isSpecific = this.querySelector('input').value === 'specific';
      document.getElementById('memberSearchSection').style.display = isSpecific ? 'block' : 'none';
    });
  });

  document.querySelectorAll('.channel-card').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.channel-card').forEach(function (c) { c.classList.remove('selected'); });
      this.classList.add('selected');
      this.querySelector('input').checked = true;
    });
  });

  ['titleEn', 'titleAr', 'bodyEn', 'bodyAr'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var counter = document.getElementById(id + 'Count');
    el.addEventListener('input', function () {
      if (counter) counter.textContent = String(this.value.length);
    });
  });

  var searchInput = document.getElementById('memberSearch');
  var resultsDiv = document.getElementById('searchResults');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var q = this.value.trim();
      if (q.length < 2) { resultsDiv.classList.remove('show'); return; }
      debounceTimer = setTimeout(function () { searchMembers(q); }, 300);
    });
  }

  async function searchMembers(q) {
    if (!Gfp) return;
    var r = await Gfp.get('/attendance/search-members?query=' + encodeURIComponent(q));
    var members = r.ok && Array.isArray(r.data) ? r.data : [];
    if (!members.length) {
      resultsDiv.innerHTML = '<div style="padding:12px;text-align:center;color:var(--ltt);font-size:12px">' + esc(t('No members found', 'لا يوجد أعضاء')) + '</div>';
      resultsDiv.classList.add('show');
      return;
    }
    resultsDiv.innerHTML = members.map(function (m) {
      var name = m.fullName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
      var already = selectedMembers.some(function (s) { return s.id === m.memberId; });
      return '<div class="sr-item ' + (already ? 'disabled' : '') + '" data-id="' + esc(m.memberId) + '" data-name="' + esc(name) + '">' +
        '<span class="sr-name">' + esc(name) + '</span></div>';
    }).join('');
    resultsDiv.classList.add('show');
    resultsDiv.querySelectorAll('.sr-item:not(.disabled)').forEach(function (item) {
      item.addEventListener('click', function () {
        if (selectedMembers.length >= 50) { toast(t('Maximum 50 members', 'الحد 50 عضواً'), 'error'); return; }
        selectedMembers.push({ id: this.dataset.id, name: this.dataset.name });
        renderChips();
      });
    });
  }

  function renderChips() {
    var container = document.getElementById('selectedChips');
    if (!container) return;
    container.innerHTML = selectedMembers.map(function (m, i) {
      return '<span class="sel-chip">' + esc(m.name) + '<button class="sel-chip-x" data-idx="' + i + '" type="button">&times;</button></span>';
    }).join('');
    document.getElementById('chipCount').textContent = selectedMembers.length + ' / 50';
    container.querySelectorAll('.sel-chip-x').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedMembers.splice(parseInt(this.dataset.idx, 10), 1);
        renderChips();
      });
    });
  }

  var btnSend = document.getElementById('btnSend');
  if (btnSend) {
    btnSend.addEventListener('click', async function () {
      var title = document.getElementById('titleEn').value.trim();
      var titleAr = document.getElementById('titleAr').value.trim();
      var body = document.getElementById('bodyEn').value.trim();
      var bodyAr = document.getElementById('bodyAr').value.trim();
      if (!title || !titleAr || !body || !bodyAr) {
        toast(t('Please fill all required fields', 'املأ كل الحقول المطلوبة'), 'error');
        return;
      }
      var target = document.querySelector('input[name=target]:checked').value;
      if (target === 'specific' && !selectedMembers.length) {
        toast(t('Select at least one member', 'اختر عضواً واحداً على الأقل'), 'error');
        return;
      }
      var channel = document.querySelector('input[name=channel]:checked').value;
      this.disabled = true;
      var payload = {
        title: title,
        titleAr: titleAr,
        body: body,
        bodyAr: bodyAr,
        channel: channel,
        allMembers: target === 'all',
        memberIds: target === 'specific' ? selectedMembers.map(function (m) { return m.id; }) : []
      };
      var res = await Gfp.post('/notifications/send-bulk', payload);
      this.disabled = false;
      if (res && res.ok) {
        toast(t('Notification sent', 'تم إرسال الإشعار'));
        selectedMembers = [];
        renderChips();
        loadHistory();
      } else {
        toast((res && res.data && (res.data.error || res.data.message)) || t('Failed to send', 'فشل الإرسال'), 'error');
      }
    });
  }

  async function loadHistory() {
    var list = document.getElementById('historyList');
    if (!list || !Gfp) return;
    list.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    var r = await Gfp.get('/notifications?page=1&pageSize=20');
    // Member history endpoint may 401 for staff — show hint
    if (!r.ok) {
      list.innerHTML = '<div class="empty-state"><i class="ti ti-info-circle"></i>' +
        esc(t('Sent history uses member notifications; compose still works.', 'سجل الإرسال يعتمد على إشعارات الأعضاء؛ الإرسال يعمل.')) + '</div>';
      return;
    }
    var data = r.data || {};
    var items = Array.isArray(data.items) ? data.items : [];
    document.getElementById('historyCount').textContent = String(data.totalCount || items.length);
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><i class="ti ti-bell-off"></i>' + esc(t('No notifications sent yet', 'لم يُرسل شيء بعد')) + '</div>';
      return;
    }
    list.innerHTML = items.map(function (n) {
      return '<div class="hist-item"><div class="hist-title">' + esc(n.title) + '</div><div class="hist-date">' + esc(timeAgo(n.sentAt)) + '</div></div>';
    }).join('');
  }

  window.addEventListener('gfp:staff-notifications-count', function () {
    /* badge handled globally */
  });

  loadInbox();
})();
