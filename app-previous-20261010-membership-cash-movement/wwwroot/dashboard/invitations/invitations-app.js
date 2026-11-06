(function () {
  'use strict';
  var Gfp = window.GfpApi;
  var rows = [];
  var selected = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function toast(msg) {
    return globalThis.toastShared(msg);
  }

  function t(en, ar) {
    if (window.GfpI18n && typeof window.GfpI18n.tLabel === 'function') {
      return window.GfpI18n.tLabel(en, ar);
    }
    try {
      return (localStorage.getItem('gfp_locale') || 'en') === 'ar' ? ar : en;
    } catch (e) {
      return en;
    }
  }

  function statusLabel(s) {
    var map = {
      new: t('New', 'جديد'),
      contacted: t('Contacted', 'تم التواصل'),
      interested: t('Interested', 'مهتم'),
      not_interested: t('Not Interested', 'غير مهتم'),
      converted: t('Converted', 'تم التحويل')
    };
    return map[String(s || '').toLowerCase()] || s || '—';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var loc = (window.GfpI18n && window.GfpI18n.getLocale && window.GfpI18n.getLocale() === 'ar') ? 'ar-EG' : 'en-GB';
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  }

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  async function loadList() {
    var q = (document.getElementById('searchQ').value || '').trim();
    var status = document.getElementById('filterStatus').value || '';
    var path = '/invitation';
    var qs = [];
    if (status) qs.push('status=' + encodeURIComponent(status));
    if (q.length >= 2) qs.push('q=' + encodeURIComponent(q));
    if (qs.length) path += '?' + qs.join('&');

    var r = await Gfp.get(path);
    var tbody = document.getElementById('invTbody');
    if (!r.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">' + esc(t('Could not load invitations', 'تعذّر تحميل الدعوات')) + '</td></tr>';
      return;
    }
    rows = unwrap(r.data);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">' + esc(t('No invitations yet', 'لا توجد دعوات بعد')) + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row) {
      var st = String(row.status || 'new').toLowerCase();
      return (
        '<tr data-id="' + esc(row.id) + '">' +
        '<td>' + esc(row.name || row.guestName) + '</td>' +
        '<td dir="ltr">' + esc(row.phoneNumber || row.guestPhoneNumber) + '</td>' +
        '<td>' + esc(row.invitedByName) + '</td>' +
        '<td dir="ltr">' + fmtDate(row.createdAtUtc || row.sentAtUtc) + '</td>' +
        '<td><span class="st ' + esc(st) + '">' + esc(statusLabel(st)) + '</span></td>' +
        '<td dir="ltr">' + fmtDate(row.contactedAtUtc) + '</td>' +
        '<td><button type="button" class="btn" data-view="' + esc(row.id) + '">' + esc(t('View', 'عرض')) + '</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  function apiErr(r) {
    if (window.GfpI18n && window.GfpI18n.displayApiError) {
      return window.GfpI18n.displayApiError(r) || 'Request failed';
    }
    if (!r) return 'Request failed';
    if (typeof r.error === 'string') return r.error;
    return (r.error && (r.error.message || r.error.error)) || 'Request failed';
  }

  function openModal(id) {
    selected = rows.find(function (r) { return String(r.id) === String(id); }) || null;
    if (!selected) return;
    var phone = selected.phoneNumber || selected.guestPhoneNumber || '';
    document.getElementById('invModalTitle').textContent = selected.name || selected.guestName || t('Invitation', 'دعوة');
    document.getElementById('invModalMeta').innerHTML =
      '<span dir="ltr">' + esc(phone) + '</span> · ' + esc(t('Invited by', 'مدعو بواسطة')) + ' ' + esc(selected.invitedByName || '—') + ' · <span dir="ltr">' + esc(fmtDate(selected.createdAtUtc || selected.sentAtUtc)) + '</span>';
    var nid = selected.nationalId
      ? t('National ID', 'الرقم القومي') + ' ' + selected.nationalId
      : t('National ID not provided', 'لم يُذكر الرقم القومي');
    var notes = selected.notes ? t('Notes', 'ملاحظات') + ': ' + selected.notes : '';
    document.getElementById('invModalNotes').textContent = [nid, notes].filter(Boolean).join(' · ');
    document.getElementById('invModalStatus').value = String(selected.status || 'new').toLowerCase();
    document.getElementById('btnCall').href = phone ? 'tel:' + phone : '#';
    document.getElementById('invModal').classList.add('show');
    document.getElementById('invModal').hidden = false;
  }

  function closeModal() {
    document.getElementById('invModal').classList.remove('show');
    document.getElementById('invModal').hidden = true;
    selected = null;
  }

  async function saveStatus() {
    if (!selected) return;
    var status = document.getElementById('invModalStatus').value;
    var r = await Gfp.request('PATCH', '/invitation/' + encodeURIComponent(selected.id) + '/status', {
      body: { status: status }
    });
    if (!r.ok) {
      toast(apiErr(r) || 'Could not update status');
      return;
    }
    toast(t('Status saved', 'تم حفظ الحالة'));
    closeModal();
    loadList();
  }

  var createMember = null;
  var memberSearchTimer = null;
  var searchGen = 0;

  function openCreateModal() {
    createMember = null;
    document.getElementById('createMemberQ').value = '';
    document.getElementById('createMemberQ').hidden = false;
    document.getElementById('createMemberResults').hidden = true;
    document.getElementById('createMemberResults').innerHTML = '';
    document.getElementById('createMemberSelected').hidden = true;
    document.getElementById('createMemberSelected').innerHTML = '';
    document.getElementById('createQuotaHint').textContent = '';
    document.getElementById('createName').value = '';
    document.getElementById('createPhone').value = '';
    document.getElementById('createNid').value = '';
    document.getElementById('createNotes').value = '';
    document.getElementById('createModal').classList.add('show');
    document.getElementById('createModal').hidden = false;
    document.getElementById('createMemberQ').focus();
  }

  function closeCreateModal() {
    document.getElementById('createModal').classList.remove('show');
    document.getElementById('createModal').hidden = true;
    createMember = null;
  }

  function renderSelectedMember() {
    var box = document.getElementById('createMemberSelected');
    var q = document.getElementById('createMemberQ');
    if (!createMember) {
      box.hidden = true;
      box.innerHTML = '';
      q.hidden = false;
      return;
    }
    q.hidden = true;
    document.getElementById('createMemberResults').hidden = true;
    box.hidden = false;
    box.innerHTML =
      '<span>' + esc(createMember.fullName || createMember.name) +
      (createMember.phone ? ' · ' + esc(createMember.phone) : '') +
      '</span><button type="button" id="btnClearMember">Change</button>';
  }

  function quotaFrom360(r) {
    if (!r || !r.ok || !r.data) return null;
    var payload = r.data.quota ? r.data : (r.data.data || r.data);
    return payload.quota || payload;
  }

  async function loadMemberQuota(memberId) {
    var hint = document.getElementById('createQuotaHint');
    hint.textContent = 'Checking invitations left…';
    var r = await Gfp.get('/invitation/members/' + encodeURIComponent(memberId));
    if (!r.ok) {
      hint.textContent = apiErr(r) || 'Could not load this member’s quota';
      return;
    }
    var quota = quotaFrom360(r) || {};
    var remaining = quota.remaining != null ? quota.remaining : 0;
    var total = quota.total != null ? quota.total : 0;
    var plan = quota.planName || '';
    hint.textContent = remaining + ' of ' + total + ' invitations left' + (plan ? ' on ' + plan : '') + '.';
  }

  function extractMembers(r) {
    if (!r || !r.ok || r.data == null) return null;
    var d = r.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.data)) return d.data;
    if (d.data && Array.isArray(d.data.items)) return d.data.items;
    if (d.data && Array.isArray(d.data.Items)) return d.data.Items;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.Items)) return d.Items;
    return [];
  }

  async function searchMembers(q) {
    var box = document.getElementById('createMemberResults');
    if (!box) return;
    if (!Gfp || q.length < 2) {
      searchGen++;
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '<div class="muted" style="padding:12px">Searching…</div>';
    var gen = ++searchGen;

    var r = await Gfp.get('/attendance/search-members?query=' + encodeURIComponent(q));
    var items = extractMembers(r);
    if (gen !== searchGen) return;
    if (!items || !items.length) {
      var r2 = await Gfp.get('/members?search=' + encodeURIComponent(q) + '&page=1&pageSize=20');
      var extra = extractMembers(r2);
      if (extra && extra.length) {
        items = extra;
        r = r2;
      } else if (!r.ok && !r2.ok) {
        box.innerHTML = '<div class="muted" style="padding:12px">' + esc(apiErr(r2) || apiErr(r) || 'Could not search members') + '</div>';
        return;
      } else {
        items = extra || items || [];
      }
    }

    if (gen !== searchGen) return;
    if (!items.length) {
      box.innerHTML = '<div class="muted" style="padding:12px">No members found</div>';
      return;
    }
    box.innerHTML = items.map(function (m) {
      var id = m.id || m.memberId || '';
      var name = m.fullName || m.name || '';
      var phone = m.phone || m.phoneNumber || '';
      var plan = m.planName || m.activePlan || '';
      return (
        '<button type="button" data-pick="' + esc(id) + '" data-name="' + esc(name) + '" data-phone="' + esc(phone) + '">' +
        esc(name) +
        '<span class="meta">' + esc([phone, plan].filter(Boolean).join(' · ')) + '</span>' +
        '</button>'
      );
    }).join('');
    decorateSearchQuotaFlags(items, gen);
  }

  async function decorateSearchQuotaFlags(items, gen) {
    var box = document.getElementById('createMemberResults');
    if (!box || !items || !items.length) return;
    await Promise.all(items.map(async function (m) {
      var id = m.id || m.memberId;
      if (!id) return;
      var r = await Gfp.get('/invitation/members/' + encodeURIComponent(id));
      if (gen !== searchGen) return;
      var quota = quotaFrom360(r);
      if (!quota) return;
      var remaining = quota.remaining != null ? Number(quota.remaining) : 0;
      if (remaining > 0) return;
      var btn = box.querySelector('[data-pick="' + id + '"]');
      if (!btn || btn.querySelector('.inv-name-flag')) return;
      var total = quota.total != null ? Number(quota.total) : 0;
      var flag = document.createElement('span');
      flag.className = 'inv-name-flag';
      flag.textContent = total > 0 ? 'No invitations left' : 'No invitations on plan';
      btn.appendChild(flag);
    }));
  }

  async function createInvitation() {
    if (!createMember || !createMember.id) {
      toast('Select the member who is inviting');
      return;
    }
    var name = (document.getElementById('createName').value || '').trim();
    var phone = (document.getElementById('createPhone').value || '').trim();
    var nid = (document.getElementById('createNid').value || '').trim();
    var notes = (document.getElementById('createNotes').value || '').trim();
    if (!name) { toast('Friend’s name is required'); return; }
    if (!phone) { toast('Phone is required'); return; }
    if (nid && nid.length !== 14) { toast('National ID must be 14 digits'); return; }

    var btn = document.getElementById('btnCreateSave');
    btn.disabled = true;
    var r = await Gfp.post('/invitation/members/' + encodeURIComponent(createMember.id), {
      name: name,
      phoneNumber: phone,
      nationalId: nid || null,
      notes: notes || null
    });
    btn.disabled = false;
    if (!r.ok) {
      toast(apiErr(r) || 'Could not create invitation');
      return;
    }
    var data = r.data || {};
    toast(data.alreadyExisted ? 'Invitation already exists' : 'Invitation created');
    closeCreateModal();
    loadList();
  }

  document.getElementById('btnRefresh').addEventListener('click', loadList);
  document.getElementById('filterStatus').addEventListener('change', loadList);
  var searchTimer = null;
  document.getElementById('searchQ').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadList, 250);
  });
  document.getElementById('invTbody').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]');
    if (btn) openModal(btn.getAttribute('data-view'));
  });
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnSaveStatus').addEventListener('click', saveStatus);
  document.getElementById('invModal').addEventListener('click', function (e) {
    if (e.target.id === 'invModal') closeModal();
  });

  document.getElementById('btnNewInvite').addEventListener('click', openCreateModal);
  document.getElementById('btnCreateCancel').addEventListener('click', closeCreateModal);
  document.getElementById('btnCreateSave').addEventListener('click', createInvitation);
  document.getElementById('createModal').addEventListener('click', function (e) {
    if (e.target.id === 'createModal') closeCreateModal();
  });
  window.addEventListener('gfp:locale', function () {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) window.GfpI18n.applyDocumentLocale();
    loadList();
  });
  document.getElementById('createMemberQ').addEventListener('input', function () {
    clearTimeout(memberSearchTimer);
    var q = (this.value || '').trim();
    memberSearchTimer = setTimeout(function () { searchMembers(q); }, 250);
  });
  document.getElementById('createMemberResults').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pick]');
    if (!btn) return;
    createMember = {
      id: btn.getAttribute('data-pick'),
      fullName: btn.getAttribute('data-name'),
      phone: btn.getAttribute('data-phone')
    };
    renderSelectedMember();
    loadMemberQuota(createMember.id);
  });
  document.getElementById('createMemberSelected').addEventListener('click', function (e) {
    if (e.target.id !== 'btnClearMember') return;
    createMember = null;
    renderSelectedMember();
    document.getElementById('createQuotaHint').textContent = '';
    document.getElementById('createMemberQ').value = '';
    document.getElementById('createMemberQ').focus();
  });

  loadList();
})();
