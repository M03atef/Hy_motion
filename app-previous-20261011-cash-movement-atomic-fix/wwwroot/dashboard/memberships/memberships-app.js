// Memberships standalone screen removed from IA — lifecycle lives in Members / Member 360.
(function () {
  var q = new URLSearchParams(window.location.search || '');
  var mid = q.get('member');
  window.location.replace(
    mid
      ? '/dashboard/members/' + encodeURIComponent(mid) + '/'
      : '/dashboard/members/'
  );
})();
/* legacy below kept inert after redirect */
let state = { filter: 'all', search: '', page: 1, pageSize: 20, members: [], totalCount: 0, loading: true, selectedId: null };
let selMember = null,
  selMs = null,
  histLoaded = false,
  histData = [],
  histPage = 1,
  histHasNext = false;
let debTimer = null;

document.getElementById('langToggle').addEventListener('click', function () {
  lang = lang === 'en' ? 'ar' : 'en';
  document.dir = lang === 'ar' ? 'rtl' : 'ltr';
  this.textContent = lang === 'en' ? 'AR عربي' : 'EN English';
  document.querySelectorAll('[data-en]').forEach(function (el) {
    el.textContent = el.dataset[lang === 'ar' ? 'ar' : 'en'];
  });
  renderTable();
  renderDetail();
});

(async function () {
  try {
    const s = await apiGet('/settings');
    if (s) document.getElementById('gymChip').textContent = s.gymName || '';
  } catch (e) {
    /* settings OwnerOnly — ignore for Managers */
  }
})();

async function fetchKPIs() {
  try {
    const st = await apiGet('/analytics/members-status').catch(function () {
      return null;
    });
    if (st) {
      document.getElementById('kpiActive').textContent = (st.active || 0).toLocaleString();
      document.getElementById('kpiFrozen').textContent = (st.frozen || 0).toLocaleString();
      document.getElementById('kpiExpired').textContent = (st.expired || 0).toLocaleString();
    }
  } catch (e) {}
}

document.getElementById('filterBar').addEventListener('click', function (e) {
  const btn = e.target.closest('.ftab');
  if (!btn) return;
  this.querySelectorAll('.ftab').forEach(function (b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  state.filter = btn.dataset.f;
  state.page = 1;
  fetchMembers();
});

document.getElementById('searchInput').addEventListener('input', function () {
  state.search = this.value;
  document.getElementById('searchClear').style.display = this.value ? 'block' : 'none';
  clearTimeout(debTimer);
  debTimer = setTimeout(function () {
    state.page = 1;
    fetchMembers();
  }, 350);
});
document.getElementById('searchClear').addEventListener('click', function () {
  document.getElementById('searchInput').value = '';
  state.search = '';
  this.style.display = 'none';
  state.page = 1;
  fetchMembers();
});

async function fetchMembers() {
  state.loading = true;
  renderTable();
  try {
    const sp = state.filter === 'all' ? '' : String(state.filter || '').toLowerCase();
    const data = await apiGet(
      '/members?status=' +
        encodeURIComponent(sp) +
        '&search=' +
        encodeURIComponent(state.search) +
        '&page=' +
        state.page +
        '&pageSize=' +
        state.pageSize
    );
    const paged = asPaged(data);
    state.members = paged.items;
    state.totalCount = paged.totalCount;
  } catch (e) {
    state.members = [];
    state.totalCount = 0;
    toast(t('Failed to load', 'فشل التحميل'), 'error');
  }
  state.loading = false;
  renderTable();
}

function renderTable() {
  const tb = document.getElementById('tableBody');
  if (state.loading) {
    tb.innerHTML = '';
    for (let i = 0; i < 5; i++)
      tb.innerHTML += '<tr><td colspan="6"><div class="sk" style="height:36px"></div></td></tr>';
    return;
  }
  const list = state.members;
  if (!list.length) {
    tb.innerHTML =
      '<tr><td colspan="6"><div class="tbl-empty"><i class="ti ti-id-badge"></i>' +
      t('No memberships found', 'لا توجد اشتراكات') +
      '</div></td></tr>';
    renderPag();
    return;
  }
  tb.innerHTML = list
    .map(function (m) {
      const d = m.expiryDate ? daysUntil(m.expiryDate) : 0;
      let st = (m.membershipStatus || '').toLowerCase();
      // Guard: never show ACTIVE with a past expiry (stale API / clock skew).
      if ((st === 'active' || st === 'scheduled') && m.expiryDate && d < 0) st = 'expired';
      const sel = state.selectedId === m.id ? ' sel' : '';
      const daysOrSess =
        st === 'active'
          ? m.planType === 'session_pack' && m.sessionsRemaining != null
            ? '<span class="days-chip">' +
              m.sessionsRemaining +
              ' ' +
              t('sess', 'جلسة') +
              '</span>'
            : daysChip(d)
          : st === 'scheduled'
            ? '<span class="dl amber">' + (d > 0 ? d + 'd' : '—') + '</span>'
            : statusBadge(st);
      return (
        '<tr class="' +
        sel +
        '" data-id="' +
        m.id +
        '"><td><div class="m-cell">' +
        avatar(m.fullName, 30) +
        '<div><div class="m-name">' +
        (m.fullName || '') +
        '</div>' +
        (m.fullNameAr ? '<div class="m-name-ar">' + m.fullNameAr + '</div>' : '') +
        '<div class="m-num">' +
        (m.memberNumber || '') +
        '</div></div></div></td><td>' +
        (m.activePlan || '<span style="color:var(--ltt);font-size:11px">—</span>') +
        (m.planType ? '<br>' + planBadge(m.planType) : '') +
        '</td><td>' +
        statusBadge(st) +
        '</td><td style="font-size:12px">' +
        (m.expiryDate ? formatDate(m.expiryDate) : '—') +
        '</td><td>' +
        daysOrSess +
        '</td><td><button class="act-btn dd-trigger" data-id="' +
        m.id +
        '" data-st="' +
        st +
        '"><i class="ti ti-dots-vertical"></i></button></td></tr>'
      );
    })
    .join('');
  renderPag();
  tb.querySelectorAll('tr[data-id]').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('.dd-trigger')) return;
      selectMember(this.dataset.id);
    });
  });
  tb.querySelectorAll('.dd-trigger').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDD(this, this.dataset.id, this.dataset.st);
    });
  });
}

function renderPag() {
  const maxPage = Math.max(1, Math.ceil((state.totalCount || 0) / state.pageSize) || 1);
  const hasNext =
    state.page < maxPage || (state.totalCount === 0 && state.members.length >= state.pageSize);
  document.getElementById('pagination').innerHTML =
    '<button class="pag-btn" id="pgPrev" ' +
    (state.page <= 1 ? 'disabled' : '') +
    '>← ' +
    t('Previous', 'السابق') +
    '</button><span class="pag-info">' +
    t('Page', 'صفحة') +
    ' ' +
    state.page +
    (state.totalCount ? ' · ' + state.totalCount : '') +
    '</span><button class="pag-btn" id="pgNext" ' +
    (hasNext ? '' : 'disabled') +
    '>' +
    t('Next', 'التالي') +
    ' →</button>';
  document.getElementById('pgPrev')?.addEventListener('click', function () {
    if (state.page > 1) {
      state.page--;
      fetchMembers();
    }
  });
  document.getElementById('pgNext')?.addEventListener('click', function () {
    state.page++;
    fetchMembers();
  });
}

function toggleDD(btn, id, st) {
  const ex = btn.querySelector('.dropdown');
  if (ex) {
    ex.remove();
    return;
  }
  document.querySelectorAll('.dropdown').forEach(function (d) {
    d.remove();
  });
  const canMgr = canManageMemberships();
  const canFreeze = canFreezeMemberships();
  let items = '';
  if (canFreeze && st === 'active')
    items += '<a data-act="freeze"><i class="ti ti-snowflake"></i>' + t('Freeze', 'تجميد') + '</a>';
  if (canFreeze && st === 'frozen')
    items += '<a data-act="unfreeze"><i class="ti ti-sun"></i>' + t('Unfreeze', 'فك التجميد') + '</a>';
  if (canMgr)
    items += '<a data-act="renew"><i class="ti ti-refresh"></i>' + t('Renew', 'تجديد') + '</a>';
  if (canMgr)
    items +=
      '<a data-act="assign"><i class="ti ti-plus"></i>' + t('Assign plan', 'تعيين خطة') + '</a>';
  items += '<a data-act="view"><i class="ti ti-eye"></i>' + t('View profile', 'عرض') + '</a>';
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.innerHTML = items;
  btn.appendChild(dd);
  dd.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.stopPropagation();
      dd.remove();
      const act = this.dataset.act;
      if (act === 'freeze') openFreezeModal(id);
      else if (act === 'unfreeze') openUnfreezeModal(id);
      else if (act === 'renew') openRenewModal(id);
      else if (act === 'assign') openAssignModal(id);
      else if (act === 'view') selectMember(id);
    });
  });
  setTimeout(function () {
    document.addEventListener(
      'click',
      function cl(e) {
        if (!btn.contains(e.target)) {
          dd.remove();
          document.removeEventListener('click', cl);
        }
      },
      true
    );
  }, 0);
}

async function selectMember(id) {
  state.selectedId = id;
  histLoaded = false;
  histData = [];
  histPage = 1;
  histHasNext = false;
  selMember = null;
  selMs = null;
  renderDetail();
  renderTable();
  try {
    const member = await apiGet('/members/' + id);
    let ms = null;
    try {
      ms = await apiGet('/memberships/' + id + '/current');
    } catch (e) {
      ms = null; // 404 = no membership at all
    }
    selMember = member;
    selMs = ms;
    renderDetail();
  } catch (e) {
    toast(t('Error loading member', 'خطأ في التحميل'), 'error');
  }
}

async function refreshAfter(id, preferMs) {
  try {
    const m = await apiGet('/members/' + id);
    let ms = preferMs || null;
    if (!ms) {
      try {
        ms = await apiGet('/memberships/' + id + '/current');
      } catch (e) {
        ms = null;
      }
    }
    selMember = m;
    selMs = ms;
    histLoaded = false;
    histData = [];
    histPage = 1;
    await fetchMembers();
    renderDetail();
  } catch (e) {}
}

async function refreshCurrentMembership(id) {
  try {
    const ms = await apiGet('/memberships/' + id + '/current');
    selMs = ms;
    toast(
      (ms && (ms.status || '').toLowerCase() === 'pending'
        ? t('Still waiting for payment', 'ما زال بانتظار الدفع')
        : t('Membership updated', 'تم تحديث الاشتراك')),
      (ms && (ms.status || '').toLowerCase() === 'pending') ? 'error' : 'success'
    );
    renderDetail();
    fetchMembers();
  } catch (e) {
    selMs = null;
    toast(apiErrMsg(e) || t('No membership', 'لا يوجد اشتراك'), 'error');
    renderDetail();
  }
}
window.refreshCurrentMembership = refreshCurrentMembership;
