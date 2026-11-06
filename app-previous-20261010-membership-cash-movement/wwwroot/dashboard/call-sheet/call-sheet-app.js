(function () {
  'use strict';
  var Gfp = window.GfpApi;
  if (!Gfp) return;

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  var dateChip = 'today';
  var filters = { status: '', reason: '', priority: '', assignee: '' };
  var items = [];
  var summary = {};
  var selectedId = null;
  var addMember = null;
  var outFollow = null;
  var outPick = 'reached';
  var nextPick = 'call_tomorrow';
  var searchTimer = null;
  var memberTimer = null;

  var OUTCOMES = [
    ['reached', 'Reached', 'تم الرد'],
    ['no_answer', 'No answer', 'لا يوجد رد'],
    ['busy', 'Busy', 'مشغول'],
    ['wrong_number', 'Wrong number', 'رقم خطأ'],
    ['not_interested', 'Not interested', 'غير مهتم'],
    ['will_visit', 'Will visit', 'هيزور النادي'],
    ['renewed', 'Renewed', 'جدد الاشتراك'],
    ['needs_follow_up', 'Needs follow-up', 'يحتاج متابعة']
  ];
  var NEXT = [
    ['call_tomorrow', 'Call tomorrow', 'اتصال بكرة'],
    ['call_in_3_days', 'Call in 3 days', 'اتصال خلال 3 أيام'],
    ['member_will_visit', 'Member will visit', 'العضو هيزور النادي'],
    ['member_renewed', 'Member renewed', 'العضو جدد الاشتراك'],
    ['not_interested', 'Not interested', 'غير مهتم'],
    ['wrong_number', 'Wrong number', 'رقم خطأ'],
    ['no_answer', 'No answer', 'لا يوجد رد'],
    ['completed', 'Completed', 'مكتمل'],
    ['custom', 'Custom', 'مخصص']
  ];
  var REASON_EN = {
    renewal: 'Renewal', trial: 'Trial', payment: 'Payment', welcome: 'Welcome',
    inactive: 'Inactive', offer: 'Offer', custom: 'Custom'
  };
  var REASON_AR = {
    renewal: 'تجديد', trial: 'تجربة', payment: 'دفع', welcome: 'ترحيب',
    inactive: 'غير نشط', offer: 'عرض', custom: 'مخصص'
  };
  var PRI_EN = { high: 'High', medium: 'Medium', low: 'Low' };
  var PRI_AR = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

  function reasonLabel(code) {
    return t(REASON_EN[code] || code, REASON_AR[code] || code);
  }
  function priLabel(code) {
    return t(PRI_EN[code] || code, PRI_AR[code] || code);
  }
  function outcomeLabel(code) {
    var o = OUTCOMES.filter(function (x) { return x[0] === code; })[0];
    return o ? t(o[1], o[2]) : code;
  }
  function nextActionLabel(code) {
    var o = NEXT.filter(function (x) { return x[0] === code; })[0];
    return o ? t(o[1], o[2]) : code;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg) {
    return globalThis.toastShared(msg);
  }
  function err(r) {
    var d = r && r.data;
    return (d && (d.detail || d.message || d.title)) || t('Could not load Call Sheet', 'تعذر تحميل ورقة المتابعة');
  }
  function isOpen(st) {
    return st === 'pending' || st === 'in_progress' || st === 'contacted' || st === 'no_answer';
  }
  function cairoDay(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  }
  function todayCairo() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  }
  function relContact(iso) {
    if (!iso) return t('Never', 'أبداً');
    var tms = new Date(iso).getTime();
    if (isNaN(tms)) return '—';
    var days = Math.round((Date.now() - tms) / 86400000);
    if (days <= 0) return t('Today', 'اليوم');
    if (days === 1) return t('Yesterday', 'أمس');
    return t(days + ' days ago', 'قبل ' + days + ' يوم');
  }
  function nextLabel(row) {
    if (row.nextAction) {
      var nl = NEXT.filter(function (x) { return x[0] === row.nextAction; })[0];
      if (nl) return t(nl[1], nl[2]);
    }
    var due = cairoDay(row.dueAtUtc);
    var td = todayCairo();
    if (due && due < td && isOpen(row.status)) return t('Overdue', 'متأخرة');
    if (due === td) return t('Call today', 'اتصال اليوم');
    return due || '—';
  }
  function waHref(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = '20' + d.slice(1);
    if (d.length < 10) return '';
    return 'https://wa.me/' + d;
  }
  function telHref(phone) {
    var d = String(phone || '').replace(/\s/g, '');
    return d ? 'tel:' + d : '';
  }
  function activeFilterCount() {
    var n = 0;
    if (filters.status) n += 1;
    if (filters.reason) n += 1;
    if (filters.priority) n += 1;
    if (filters.assignee) n += 1;
    return n;
  }
  function qs() {
    var p = new URLSearchParams();
    p.set('date', dateChip);
    if (filters.status) p.set('status', filters.status);
    if (filters.reason) p.set('reason', filters.reason);
    if (filters.priority) p.set('priority', filters.priority);
    if (filters.assignee) p.set('assignee', filters.assignee);
    var q = (document.getElementById('searchQ').value || '').trim();
    if (q) p.set('q', q);
    return p.toString();
  }

  async function load() {
    var r = await Gfp.get('/call-sheet?' + qs());
    var root = document.getElementById('queue');
    if (!r.ok) {
      root.innerHTML = '<div class="empty"><p>' + esc(err(r)) + '</p></div>';
      return;
    }
    var data = r.data || {};
    items = Array.isArray(data.items) ? data.items : [];
    summary = data.summary || {};
    renderKpis();
    renderOverdue();
    renderQueue();
  }

  function renderKpis() {
    var el = document.getElementById('kpis');
    var cells = [
      [summary.toCallToday || 0, t('To call today', 'للاتصال اليوم'), false],
      [summary.highPriority || 0, t('High priority', 'أولوية عالية'), true],
      [summary.pending || 0, t('Pending', 'قيد الانتظار'), false],
      [summary.contactedToday || 0, t('Contacted', 'تم التواصل'), false],
      [summary.noAnswerToday || 0, t('No answer', 'لا يوجد رد'), false]
    ];
    el.innerHTML = cells.map(function (c) {
      return '<div class="kpi' + (c[2] ? ' urg' : '') + '"><div class="n">' + c[0] + '</div><div class="l">' + c[1] + '</div></div>';
    }).join('');
  }

  function renderOverdue() {
    var bar = document.getElementById('overdueBar');
    var n = summary.overdue || 0;
    if (n > 0 && dateChip !== 'overdue') {
      bar.hidden = false;
      document.getElementById('overdueCopy').textContent =
        t(n + ' overdue follow-up' + (n === 1 ? '' : 's') + ' — they stay above today until completed.',
          n + ' متابعة متأخرة — هتفضل فوق النهاردة لحد ما تتنفّذ.');
    } else {
      bar.hidden = true;
    }
  }

  function rowHtml(r, extraCls) {
    var pri = r.priority || 'medium';
    var cls = extraCls || '';
    if (pri === 'high' && isOpen(r.status)) cls += ' hi';
    if (cairoDay(r.dueAtUtc) < todayCairo() && isOpen(r.status)) cls += ' od';
    if (r.status === 'completed') cls += ' done';
    var tel = telHref(r.phoneNumber);
    var wa = waHref(r.phoneNumber);
    return (
      '<div class="row' + cls + '" data-open="' + esc(r.id) + '">' +
        '<div class="who"><div class="nm">' + esc(r.fullName) + '</div>' +
        '<div class="why">' + esc(r.why || reasonLabel(r.reason)) + '</div>' +
        '<div class="id">' + esc(r.memberNumber || '') + '</div></div>' +
        '<div class="tags"><span class="tag">' + esc(reasonLabel(r.reason)) + '</span>' +
        '<span class="tag' + (pri === 'high' ? ' hi' : pri === 'low' ? ' lo' : '') + '">' + esc(priLabel(pri)) + '</span></div>' +
        '<div class="meta-cell"><b>' + esc(t('Last contact', 'آخر تواصل')) + '</b>' + esc(relContact(r.lastContactAtUtc)) + '</div>' +
        '<div class="meta-cell"><b>' + esc(t('Next action', 'الإجراء التالي')) + '</b>' + esc(nextLabel(r)) + '</div>' +
        '<div class="acts">' +
          (tel ? '<a class="btn sm" href="' + esc(tel) + '" data-call="' + esc(r.id) + '"><i class="ti ti-phone"></i> ' + esc(t('Call', 'اتصال')) + '</a>' : '') +
          (wa ? '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(wa) + '"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('WhatsApp', 'واتساب')) + '</a>' : '') +
          (isOpen(r.status) ? '<button type="button" class="btn sm" data-done="' + esc(r.id) + '">' + esc(t('Done', 'تم')) + '</button>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function section(title, rows, extraCls) {
    if (!rows.length) return '';
    return (
      '<section class="sec"><div class="sec-h"><h2>' + esc(title) + '</h2><span class="meta">' + rows.length + '</span></div>' +
      '<div class="queue">' + rows.map(function (r) { return rowHtml(r, extraCls); }).join('') + '</div></section>'
    );
  }

  function renderQueue() {
    var root = document.getElementById('queue');
    if (!items.length) {
      root.innerHTML =
        '<div class="empty"><i class="ti ti-circle-check"></i><h3>' + esc(t("You're all caught up", 'تمام، مفيش متابعات متأخرة')) + '</h3>' +
        '<p>' + esc(t('No follow-ups require your attention today.', 'مفيش متابعات محتاجة انتباهك النهاردة.')) + '</p>' +
        '<button type="button" class="btn primary" id="btnEmptyAdd"><i class="ti ti-plus"></i> ' + esc(t('Add Follow-up', 'إضافة متابعة')) + '</button></div>';
      var b = document.getElementById('btnEmptyAdd');
      if (b) b.onclick = openAdd;
      return;
    }
    var td = todayCairo();
    var overdue = items.filter(function (i) { return isOpen(i.status) && cairoDay(i.dueAtUtc) < td; });
    var high = items.filter(function (i) {
      return isOpen(i.status) && i.priority === 'high' && cairoDay(i.dueAtUtc) >= td;
    });
    var todayOpen = items.filter(function (i) {
      return isOpen(i.status) && cairoDay(i.dueAtUtc) === td && i.priority !== 'high';
    });
    var done = items.filter(function (i) { return i.status === 'completed'; });
    var rest = items.filter(function (i) {
      return overdue.indexOf(i) < 0 && high.indexOf(i) < 0 && todayOpen.indexOf(i) < 0 && done.indexOf(i) < 0;
    });
    root.innerHTML =
      section(t('Overdue', 'متأخرة'), overdue) +
      section(t('High priority', 'أولوية عالية'), high) +
      section(dateChip === 'today' ? t('Today', 'اليوم') : t('Queue', 'قائمة الانتظار'), todayOpen.concat(rest)) +
      section(t('Completed today', 'مكتملة اليوم'), done, ' done');
  }

  function choiceHtml(list, selected, attr) {
    return list.map(function (p) {
      return '<button type="button" class="' + (selected === p[0] ? 'act' : '') + '" data-' + attr + '="' + p[0] + '">' + esc(t(p[1], p[2])) + '</button>';
    }).join('');
  }

  async function openPanel(id) {
    selectedId = id;
    var ov = document.getElementById('drawerOv');
    ov.hidden = false;
    document.getElementById('drawerBody').innerHTML = '<p class="muted">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</p>';
    var r = await Gfp.get('/call-sheet/' + encodeURIComponent(id));
    if (!r.ok) {
      document.getElementById('drawerBody').innerHTML = '<p class="muted">' + esc(err(r)) + '</p>';
      return;
    }
    var f = r.data || {};
    var memberR = await Gfp.get('/members/' + encodeURIComponent(f.memberId));
    var member = memberR.ok ? (memberR.data || {}) : {};
    var debtR = await Gfp.get('/debtors?memberId=' + encodeURIComponent(f.memberId) + '&pageSize=5');
    var due = 0;
    if (debtR.ok && debtR.data) {
      var list = debtR.data.items || debtR.data || [];
      if (Array.isArray(list) && list[0]) due = Number(list[0].totalDue || list[0].amountDue || 0);
    }
    var ms = member.currentMembership || {};
    var att = Array.isArray(member.recentAttendance) ? member.recentAttendance : [];
    var lastAtt = att[0] ? att[0].checkInAtUtc : null;
    var photo = member.profilePhotoUrl || f.profilePhotoUrl;
    var initials = String(f.fullName || 'M').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    document.getElementById('drawerTitle').textContent = f.fullName || t('Member', 'عضو');
    document.getElementById('drawerMeta').textContent = (f.memberNumber || '') + (f.phoneNumber ? ' · ' + f.phoneNumber : '');
    var msStatus = (window.GfpI18n && window.GfpI18n.statusLabel) ? window.GfpI18n.statusLabel(ms.status) : (ms.status || '—');
    document.getElementById('drawerBody').innerHTML =
      '<div class="phead"><div class="av">' + (photo ? '<img src="' + esc(photo) + '" alt="">' : esc(initials)) + '</div>' +
      '<div><div class="nm">' + esc(f.fullName) + '</div><div class="drawer-id">' + esc(reasonLabel(f.reason)) + ' · ' + esc(priLabel(f.priority)) + '</div></div></div>' +
      '<div class="block"><h3>' + esc(t('Membership', 'الاشتراك')) + '</h3>' +
        '<div class="kv"><span>' + esc(t('Plan', 'الخطة')) + '</span><b>' + esc(ms.planName || '—') + '</b></div>' +
        '<div class="kv"><span>' + esc(t('Start', 'البداية')) + '</span><span>' + esc(ms.startDate || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('End', 'النهاية')) + '</span><span>' + esc(ms.endDate || '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Status', 'الحالة')) + '</span><span>' + esc(msStatus || '—') + '</span></div>' +
        (ms.sessionsRemaining != null ? '<div class="kv"><span>' + esc(t('Sessions left', 'الحصص المتبقية')) + '</span><span>' + esc(ms.sessionsRemaining) + '</span></div>' : '') +
        '<p class="fine">' + esc(t('Read from covering membership. Call Sheet does not own this status.', 'بتتقرأ من الاشتراك الحالي. ورقة المتابعة مش مسؤولة عن الحالة دي.')) + '</p></div>' +
      '<div class="block"><h3>' + esc(t('Financial', 'الوضع المالي')) + '</h3>' +
        '<div class="kv"><span>' + esc(t('Outstanding', 'المستحق')) + '</span><b>EGP ' + due.toFixed(2) + '</b></div>' +
        '<p class="fine">' + esc(t('Outstanding = Sale.AmountDue. Collect Payment stays on Member 360.', 'المستحق = المبلغ المطلوب من الفاتورة. تحصيل الدفع من صفحة العضو 360.')) + '</p></div>' +
      '<div class="block"><h3>' + esc(t('Attendance', 'الحضور')) + '</h3>' +
        '<div class="kv"><span>' + esc(t('Last visit', 'آخر زيارة')) + '</span><span>' + esc(lastAtt ? new Date(lastAtt).toLocaleString() : '—') + '</span></div>' +
        '<div class="kv"><span>' + esc(t('Recent', 'الأخيرة')) + '</span><span>' + esc(t(att.length + ' in last records', att.length + ' من آخر السجلات')) + '</span></div></div>' +
      '<div class="block"><h3>' + esc(t('Follow-up history', 'سجل المتابعات')) + '</h3>' + historyHtml(f.history) + '</div>';
    var tel = telHref(f.phoneNumber);
    var wa = waHref(f.phoneNumber);
    document.getElementById('drawerFt').innerHTML =
      (tel ? '<a class="btn sm primary" href="' + esc(tel) + '" data-call="' + esc(f.id) + '"><i class="ti ti-phone"></i> ' + esc(t('Call', 'اتصال')) + '</a>' : '') +
      (wa ? '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(wa) + '"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('WhatsApp', 'واتساب')) + '</a>' : '') +
      (isOpen(f.status) ? '<button type="button" class="btn sm" data-done="' + esc(f.id) + '">' + esc(t('Done', 'تم')) + '</button>' : '') +
      '<a class="btn sm ghost" href="/dashboard/members/' + encodeURIComponent(f.memberId) + '/">' + esc(t('Member 360', 'ملف العضو 360')) + '</a>';
  }

  function historyHtml(list) {
    if (!list || !list.length) return '<p class="muted">' + esc(t('No calls logged yet.', 'لسه مفيش مكالمات مسجلة.')) + '</p>';
    return list.map(function (h) {
      var when = h.atUtc ? new Date(h.atUtc).toLocaleString() : '';
      var bits = [outcomeLabel(h.outcome)];
      if (h.nextAction) bits.push(t('Next', 'التالي') + ': ' + nextActionLabel(h.nextAction));
      if (h.note) bits.push(h.note);
      return '<div class="tl-item"><div class="tl-t">' + esc(when) + (h.staffName ? ' · ' + esc(h.staffName) : '') + '</div><div class="tl-m">' + esc(bits.join('. ')) + '</div></div>';
    }).join('');
  }

  function closePanel() {
    document.getElementById('drawerOv').hidden = true;
    selectedId = null;
  }

  function openAdd() {
    addMember = null;
    document.getElementById('addMemberQ').value = '';
    document.getElementById('addMemberResults').hidden = true;
    document.getElementById('addMemberSelected').hidden = true;
    document.getElementById('addNote').value = '';
    var due = document.getElementById('addDue');
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    due.value = d.toISOString().slice(0, 16);
    document.getElementById('addOv').hidden = false;
    document.getElementById('addMemberQ').focus();
  }
  function closeAdd() { document.getElementById('addOv').hidden = true; }

  async function searchMembers(q) {
    var box = document.getElementById('addMemberResults');
    if (!q || q.length < 2) { box.hidden = true; return; }
    var r = await Gfp.get('/members?search=' + encodeURIComponent(q) + '&pageSize=8');
    var list = (r.ok && r.data && (r.data.items || r.data)) || [];
    if (!Array.isArray(list) || !list.length) {
      box.innerHTML = '<button type="button" disabled>' + esc(t('No members found', 'لا يوجد أعضاء')) + '</button>';
      box.hidden = false;
      return;
    }
    box.innerHTML = list.map(function (m) {
      return '<button type="button" data-pick="' + esc(m.id) + '" data-name="' + esc(m.fullName) + '" data-phone="' + esc(m.phone || m.phoneNumber || '') + '" data-no="' + esc(m.memberNumber || '') + '">' +
        esc(m.fullName) + ' · ' + esc(m.memberNumber || '') + '</button>';
    }).join('');
    box.hidden = false;
  }

  function openOutcome(id) {
    outFollow = items.filter(function (x) { return x.id === id; })[0] || { id: id };
    outPick = 'reached';
    nextPick = 'call_tomorrow';
    document.getElementById('outTitle').textContent = t('Log call', 'تسجيل مكالمة') + (outFollow.fullName ? ' — ' + outFollow.fullName : '');
    document.getElementById('outHint').textContent = outFollow.why || '';
    document.getElementById('outNote').value = '';
    document.getElementById('outChoices').innerHTML = choiceHtml(OUTCOMES, outPick, 'out');
    document.getElementById('nextChoices').innerHTML = choiceHtml(NEXT, nextPick, 'next');
    var d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('outNextAt').value = d.toISOString().slice(0, 16);
    document.getElementById('outOv').hidden = false;
  }
  function closeOut() { document.getElementById('outOv').hidden = true; outFollow = null; }

  async function saveOutcome() {
    if (!outFollow) return;
    var nextAt = document.getElementById('outNextAt').value;
    var body = {
      outcome: outPick,
      note: (document.getElementById('outNote').value || '').trim() || null,
      nextAction: nextPick,
      nextActionAtUtc: nextAt ? new Date(nextAt).toISOString() : null
    };
    var r = await Gfp.post('/call-sheet/' + encodeURIComponent(outFollow.id) + '/outcome', body);
    if (!r.ok) { toast(err(r)); return; }
    closeOut();
    toast(t('Outcome recorded', 'تم تسجيل النتيجة'));
    await load();
    if (selectedId) openPanel(selectedId);
  }

  async function markDone(id) {
    var r = await Gfp.post('/call-sheet/' + encodeURIComponent(id) + '/complete', {});
    if (!r.ok) { toast(err(r)); return; }
    toast(t('Follow-up completed', 'تمت المتابعة'));
    await load();
    if (selectedId === id) openPanel(id);
  }

  async function saveAdd() {
    if (!addMember) { toast(t('Select a member', 'اختار عضو')); return; }
    var due = document.getElementById('addDue').value;
    var r = await Gfp.post('/call-sheet', {
      memberId: addMember.id,
      reason: document.getElementById('addReason').value,
      priority: document.getElementById('addPriority').value,
      dueAtUtc: due ? new Date(due).toISOString() : null,
      notes: (document.getElementById('addNote').value || '').trim() || null
    });
    if (!r.ok) { toast(err(r)); return; }
    closeAdd();
    toast(t('Follow-up added', 'تمت إضافة المتابعة'));
    await load();
  }

  function syncFilterCount() {
    var n = activeFilterCount();
    var el = document.getElementById('filterCount');
    el.hidden = n === 0;
    el.textContent = String(n);
  }

  document.getElementById('dateChips').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-date]');
    if (!btn) return;
    dateChip = btn.getAttribute('data-date');
    document.querySelectorAll('#dateChips .chip').forEach(function (c) {
      c.classList.toggle('act', c.getAttribute('data-date') === dateChip);
    });
    load();
  });
  document.getElementById('searchQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 250);
  });
  document.getElementById('btnFilters').addEventListener('click', function () {
    var pop = document.getElementById('filterPop');
    pop.hidden = !pop.hidden;
  });
  document.getElementById('btnFilterApply').addEventListener('click', function () {
    filters.status = document.getElementById('fltStatus').value;
    filters.reason = document.getElementById('fltReason').value;
    filters.priority = document.getElementById('fltPriority').value;
    filters.assignee = document.getElementById('fltAssignee').value;
    document.getElementById('filterPop').hidden = true;
    syncFilterCount();
    load();
  });
  document.getElementById('btnFilterClear').addEventListener('click', function () {
    filters = { status: '', reason: '', priority: '', assignee: '' };
    document.getElementById('fltStatus').value = '';
    document.getElementById('fltReason').value = '';
    document.getElementById('fltPriority').value = '';
    document.getElementById('fltAssignee').value = '';
    document.getElementById('filterPop').hidden = true;
    syncFilterCount();
    load();
  });
  document.getElementById('btnAdd').addEventListener('click', openAdd);
  document.getElementById('btnAddCancel').addEventListener('click', closeAdd);
  document.getElementById('btnAddSave').addEventListener('click', saveAdd);
  document.getElementById('addOv').addEventListener('click', function (e) { if (e.target.id === 'addOv') closeAdd(); });
  document.getElementById('addMemberQ').addEventListener('input', function () {
    clearTimeout(memberTimer);
    var q = this.value.trim();
    memberTimer = setTimeout(function () { searchMembers(q); }, 250);
  });
  document.getElementById('addMemberResults').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pick]');
    if (!btn) return;
    addMember = { id: btn.getAttribute('data-pick'), name: btn.getAttribute('data-name') };
    document.getElementById('addMemberSelected').hidden = false;
    document.getElementById('addMemberSelected').textContent = btn.getAttribute('data-name') + ' · ' + (btn.getAttribute('data-no') || '');
    document.getElementById('addMemberResults').hidden = true;
  });
  document.getElementById('btnDrawerClose').addEventListener('click', closePanel);
  document.getElementById('drawerOv').addEventListener('click', function (e) { if (e.target.id === 'drawerOv') closePanel(); });
  document.getElementById('queue').addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    if (done) { e.preventDefault(); e.stopPropagation(); markDone(done.getAttribute('data-done')); return; }
    var call = e.target.closest('[data-call]');
    if (call) { e.stopPropagation(); openOutcome(call.getAttribute('data-call')); return; }
    var row = e.target.closest('[data-open]');
    if (row) openPanel(row.getAttribute('data-open'));
  });
  document.getElementById('drawerFt').addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    if (done) { e.preventDefault(); markDone(done.getAttribute('data-done')); return; }
    var call = e.target.closest('[data-call]');
    if (call) { openOutcome(call.getAttribute('data-call')); }
  });
  document.getElementById('outChoices').addEventListener('click', function (e) {
    var b = e.target.closest('[data-out]');
    if (!b) return;
    outPick = b.getAttribute('data-out');
    document.getElementById('outChoices').innerHTML = choiceHtml(OUTCOMES, outPick, 'out');
  });
  document.getElementById('nextChoices').addEventListener('click', function (e) {
    var b = e.target.closest('[data-next]');
    if (!b) return;
    nextPick = b.getAttribute('data-next');
    document.getElementById('nextChoices').innerHTML = choiceHtml(NEXT, nextPick, 'next');
  });
  document.getElementById('btnOutCancel').addEventListener('click', closeOut);
  document.getElementById('btnOutSave').addEventListener('click', saveOutcome);
  document.getElementById('outOv').addEventListener('click', function (e) { if (e.target.id === 'outOv') closeOut(); });

  window.addEventListener('gfp:locale', function () {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) window.GfpI18n.applyDocumentLocale();
    renderKpis();
    renderOverdue();
    renderQueue();
    if (selectedId) openPanel(selectedId);
    if (outFollow) {
      document.getElementById('outTitle').textContent = t('Log call', 'تسجيل مكالمة') + (outFollow.fullName ? ' — ' + outFollow.fullName : '');
      document.getElementById('outChoices').innerHTML = choiceHtml(OUTCOMES, outPick, 'out');
      document.getElementById('nextChoices').innerHTML = choiceHtml(NEXT, nextPick, 'next');
    }
  });

  // Deep-link support: /dashboard/call-sheet/?reason=inactive&date=open — dashboard attention
  // cards land on the matching open queue (default "today" hid later-scheduled rows).
  (function applyInitialFiltersFromUrl() {
    var qp = new URLSearchParams(window.location.search);
    var reason = qp.get('reason');
    var status = qp.get('status');
    var priority = qp.get('priority');
    var date = qp.get('date');
    if (reason) { filters.reason = reason; document.getElementById('fltReason').value = reason; }
    if (status) { filters.status = status; document.getElementById('fltStatus').value = status; }
    if (priority) { filters.priority = priority; document.getElementById('fltPriority').value = priority; }
    if (date) {
      dateChip = date;
      document.querySelectorAll('#dateChips .chip').forEach(function (c) {
        c.classList.toggle('act', c.getAttribute('data-date') === dateChip);
      });
    }
    if (reason || status || priority) syncFilterCount();
  })();

  load();
})();
