// ═══════════════════════════════════════════════════════════════
//  Members Page Logic — apps/web/(dashboard)/members/
//  API: GET /api/members?search=&status=&page=1&pageSize=20
//  Member workspace list — person + current membership glance columns.
// ═══════════════════════════════════════════════════════════════
(function(){
  const Gfp = window.GfpApi;
  const Authz = window.GfpAuthz;
  function getUser(){
    if(Gfp&&Gfp.tokens) return Gfp.tokens.getUser();
    try{return JSON.parse(localStorage.getItem('gfp_user')||sessionStorage.getItem('gfp_user'));}
    catch(e){return null;}
  }

  function tLabel(en, ar) {
    if (window.GfpI18n && typeof window.GfpI18n.tLabel === 'function') {
      return window.GfpI18n.tLabel(en, ar);
    }
    try {
      return (localStorage.getItem('gfp_locale') || 'en') === 'ar' ? ar : en;
    } catch (e) {
      return en;
    }
  }

  function pickMemberName(m) {
    var en = m.fullName || '';
    var ar = m.fullNameAr || '';
    return tLabel(en, ar) || en || ar;
  }

  // ── Sidebar user ──
  const user = getUser();
  if(!user){window.location.href='/auth/login/';return;}
  const canView = Authz ? Authz.useCan('members.view') : true;
  const canCreate = Authz ? Authz.useCan('members.create') : false;
  const canEdit = Authz ? Authz.useCan('members.edit') : false;
  const isOwner = Authz ? Authz.useCanRole('OwnerOnly') : false;
  if(!canView){window.location.href='/dashboard/';return;}

  const ini=(user.fullName||'U').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent=ini;
  document.getElementById('userName').textContent=user.fullName||'User';
  document.getElementById('userRole').textContent=user.role||'Staff';
  if(Authz&&Authz.useCanRole('OwnerOnly')){const ns=document.getElementById('navStaff');if(ns) ns.style.display='flex';}
  document.getElementById('btnLogout').addEventListener('click',function(){
    if(Gfp) Gfp.logout();
    else {
      ['gfp_access_token','gfp_refresh_token','gfp_user','gfp_expires_at'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});
      window.location.href='/auth/login/';
    }
  });
  document.getElementById('mobToggle').addEventListener('click',function(){
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Permission UI — Add Member / row Edit
  const btnAdd=document.getElementById('btnAddMember');
  if(btnAdd && !canCreate) btnAdd.style.display='none';
  window.__gfpCanEditMember = canEdit;
  window.__gfpCanCreateMember = canCreate;

  // ═══════════════════════════════════════════════════════════════
  //  State
  // ═══════════════════════════════════════════════════════════════
  let search='', statusFilter='all', page=1;
  const pageSize=20;
  let membersData=[];    // Current page results from API
  let totalCount=0;      // Total matching records (for pagination)
  let searchDebounce=null;

  // ── Helpers ──
  function getInitials(n){return(n||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();}
  function daysUntil(d){
    if(!d) return null;
    const end=new Date(d); const now=new Date();
    end.setHours(0,0,0,0); now.setHours(0,0,0,0);
    return Math.round((end-now)/86400000);
  }

  /**
   * P12-R1 / R1-FE-01 / R1-FE-08 — person-primary status only (Active / Archived).
   * Membership status is computed privately for Frozen Legacy CTA eligibility — not primary chrome.
   */
  function resolveListStatus(m){
    const accountOk = m.isActive !== false;
    let mem = String(m.membershipStatus || '').toLowerCase().trim();
    if(!mem){
      if(!m.activePlan && !m.expiryDate) mem = 'none';
      else mem = 'active';
    }
    const d = daysUntil(m.expiryDate);
    if((mem === 'active' || mem === 'scheduled') && d != null && d < 0) mem = 'expired';

    // Person-primary language (P6): Active or Archived — never Expired/Frozen as person status
    const primary = accountOk ? 'active' : 'archived';

    return { accountOk: accountOk, mem: mem, primary: primary, days: d };
  }

  function personStatusMeta(){
    return {
      active:   { label: tLabel('Active', 'نشط'),     cls: 'active',    icon: 'ti-circle-check' },
      archived: { label: tLabel('Archived', 'مؤرشف'), cls: 'suspended', icon: 'ti-user-off' }
    };
  }

  // Membership-status indicator — restored per explicit request (was removed by P12-R1/R1-FE-08,
  // which only intended to stop showing Expired/Frozen as the PERSON's own status, see
  // resolveListStatus above). Shown as a light dot+label under the account-status pill, not a
  // second full badge (two equal-weight pills stacked looked "dirty"/heavy — feedback from a
  // real deploy). Reuses the .q-dot.<status> color classes already defined in members.css and
  // GfpI18n.statusLabel's existing translations.
  const MEMBERSHIP_DOT_CLASSES = ['active', 'frozen', 'expired', 'cancelled', 'pending', 'scheduled'];

  function renderPersonStatusCell(info){
    const statusMeta = personStatusMeta();
    const meta = statusMeta[info.primary] || statusMeta.archived;
    const personTitle = window.GfpI18n && window.GfpI18n.tLabel
      ? window.GfpI18n.tLabel('Person account status', 'حالة حساب الشخص')
      : 'Person account status';
    let html = '<div class="st-stack"><span class="st-badge '+meta.cls+'" title="'+personTitle+'">'
      +'<i class="ti '+meta.icon+'"></i>'+meta.label+'</span>';
    if(info.accountOk && info.mem && info.mem !== 'none'){
      const dotCls = MEMBERSHIP_DOT_CLASSES.indexOf(info.mem) !== -1 ? info.mem : 'cancelled';
      const memText = (window.GfpI18n && window.GfpI18n.statusLabel)
        ? window.GfpI18n.statusLabel(info.mem)
        : info.mem;
      const memTitle = window.GfpI18n && window.GfpI18n.tLabel
        ? window.GfpI18n.tLabel('Membership status', 'حالة العضوية')
        : 'Membership status';
      html += '<span class="st-sub" title="'+memTitle+'"><span class="q-dot '+dotCls+'"></span>'+memText+'</span>';
    }
    html += '</div>';
    return html;
  }

  function updatePeopleCount(){
    const el = document.getElementById('statPeople');
    const badge = document.getElementById('totalBadge');
    if(el) el.textContent = String(totalCount || 0);
    if(badge) badge.textContent = String(totalCount || 0);
  }

  // ═══════════════════════════════════════════════════════════════
  //  API Calls
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/members — PagedResult<MemberListItemDto>
  async function loadMembers(){
    showSkeleton();
    if(!Gfp){
      membersData=[]; totalCount=0; updatePeopleCount(); hideSkeleton();
      return;
    }
    try{
      const params = new URLSearchParams();
      if(search) params.set('search', search);
      // Person-primary filters only: all | inactive (Archived). No expired/frozen/cancelled.
      if(statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());

      const r = await Gfp.get('/members?' + params.toString());
      if(r.status === 401){ window.location.href='/auth/login/'; return; }
      if(!r.ok){
        console.error('Failed to load members:', r.status);
        membersData=[]; totalCount=0; updatePeopleCount(); hideSkeleton(); return;
      }

      const data = r.data;
      const paged = Gfp.asPaged ? Gfp.asPaged(data) : null;
      if (paged && Array.isArray(paged.items)) {
        membersData = paged.items;
        totalCount = Number(paged.totalCount) || 0;
      } else if (data && (data.items || data.Items)) {
        membersData = data.items || data.Items || [];
        totalCount = Number(
          data.totalCount != null ? data.totalCount : data.TotalCount != null ? data.TotalCount : 0
        );
      } else if (Array.isArray(data)) {
        membersData = data;
        totalCount = data.length;
      } else {
        membersData = [];
        totalCount = 0;
      }
    }catch(err){
      console.error('Network error loading members:', err);
      membersData=[]; totalCount=0;
    }
    updatePeopleCount();
    hideSkeleton();
  }

  // P12-R1: membership-status analytics KPIs removed from Members desk (R1-FE-03).
  async function loadStats(){
    updatePeopleCount();
  }

  async function loadTenant(){
    // Owner-only full settings — skip for others (shell already shows gym context)
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════════
  function render(){
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if(page > totalPages) page = totalPages;

    const tbody = document.getElementById('tblBody');
    const tblWrap = document.getElementById('tblWrap');
    const emptyEl = document.getElementById('emptyState');
    const pagiEl = document.getElementById('pagination');

    if(membersData.length === 0){
      tblWrap.style.display='none';
      pagiEl.style.display='none';
      emptyEl.style.display='flex';
      const filtered = !!(search && search.trim()) || (statusFilter && statusFilter !== 'all');
      const title = document.getElementById('emptyTitle');
      const body = document.getElementById('emptyBody');
      const cta = document.getElementById('emptyAddMember');
      if(filtered){
        if(title) title.textContent = tLabel('No members match this search','لا يوجد أعضاء مطابقون لهذا البحث');
        if(body) body.textContent = tLabel('Clear the search or change the filter to see everyone.','امسح البحث أو غيّر التصفية لعرض الجميع.');
        if(cta) cta.style.display = 'none';
      } else {
        if(title) title.textContent = tLabel('No members yet','لا يوجد أعضاء بعد');
        if(body) body.textContent = tLabel(
          'Add a person first. They can be saved without a membership, but they cannot use membership check-in until a valid plan is assigned.',
          'أضف شخصًا أولًا. يمكن حفظه بدون عضوية، لكن لا يمكنه استخدام تسجيل الحضور بالعضوية حتى تُعيَّن له باقة سارية.'
        );
        if(cta) cta.style.display = canCreate ? '' : 'none';
      }
      return;
    }
    tblWrap.style.display='';
    pagiEl.style.display='flex';
    emptyEl.style.display='none';

    tbody.innerHTML = membersData.map(m => {
      const info = resolveListStatus(m);
      const nameEn = m.fullName || '';
      const nameAr = m.fullNameAr || '';
      const displayName = pickMemberName(m);
      const phone = m.phone || '';
      const memberNum = m.memberNumber || '';

      // Person-row styling only — no Expired/Frozen/expiring membership row chrome
      let rowCls = '';
      if(!info.accountOk) rowCls = 'row-suspended';

      const detailHref = '/dashboard/members/'+encodeURIComponent(m.id)+'/';
      const planName = m.activePlan || m.planName || m.currentPlanName || '—';
      const expiry = m.expiryDate || m.endDate || null;
      const remDays = info.days;
      const sessions = m.sessionsRemaining != null ? m.sessionsRemaining : (m.remainingSessions != null ? m.remainingSessions : null);
      let remaining = '—';
      if(sessions != null) remaining = sessions + ' ' + tLabel('sess', 'حصة');
      else if(remDays != null) remaining = remDays + tLabel('d', 'ي');

      return `<tr class="${rowCls}">
        <td>
          <div class="m-cell">
            <div class="m-av ${!info.accountOk ? 'm-av-muted' : ''}">${getInitials(nameEn || nameAr)}</div>
            <div class="m-info">
              <div class="m-num">#${memberNum}</div>
              <div class="m-name">${displayName}</div>
              ${phone ? '<div class="m-name-ar" style="font-size:11px">'+phone+'</div>' : ''}
            </div>
          </div>
        </td>
        <td>
          ${renderPersonStatusCell(info)}
        </td>
        <td style="font-size:13px;font-weight:500">${planName}</td>
        <td style="font-size:12px;color:var(--lts)">${expiry ? new Date(expiry).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
        <td style="font-size:12px;font-weight:600">${remaining}</td>
        <td>
          <div class="act-btns">
            <button class="act-btn" title="${tLabel('View','عرض')}" onclick="window.location.href='${detailHref}'"><i class="ti ti-eye"></i></button>
            ${canEdit?`<button class="act-btn" title="${tLabel('Edit','تعديل')}" onclick="if(window.openEditDrawer) window.openEditDrawer('${m.id}')"><i class="ti ti-edit"></i></button>`:''}
            <button class="act-btn act-renew" title="${tLabel('Open member (renew / membership)','فتح العضو (تجديد / عضوية)')}" onclick="window.location.href='${detailHref}'"><i class="ti ti-refresh"></i></button>
            ${isOwner && info.accountOk ? `<button type="button" class="act-btn act-delete" title="${tLabel('Deactivate','إلغاء التفعيل')}" data-delete-id="${m.id}" data-delete-name="${String(displayName).replace(/"/g,'&quot;')}"><i class="ti ti-trash"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('pagiPrev').disabled = page <= 1;
    document.getElementById('pagiNext').disabled = page >= totalPages;
    document.getElementById('pagiInfo').innerHTML = 'Page <strong>' + page + '</strong> of <strong>' + totalPages + '</strong>' +
      (totalCount ? ' <span style="color:var(--ltt);font-weight:400">(' + totalCount + ')</span>' : '');
  }

  // ── Skeleton ──
  function showSkeleton(){
    document.getElementById('skeleton').style.display='block';
    document.getElementById('tblWrap').style.display='none';
    document.getElementById('pagination').style.display='none';
    document.getElementById('emptyState').style.display='none';
  }
  function hideSkeleton(){
    document.getElementById('skeleton').style.display='none';
    render();
  }

  // ═══════════════════════════════════════════════════════════════
  //  Event Listeners
  // ═══════════════════════════════════════════════════════════════

  document.getElementById('searchInput').addEventListener('input',function(){
    search = this.value;
    page = 1;
    if(searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadMembers, 300);
  });

  document.querySelectorAll('.f-chip').forEach(chip=>{
    chip.addEventListener('click',function(){
      document.querySelectorAll('.f-chip').forEach(c=>c.classList.remove('act'));
      this.classList.add('act');
      statusFilter = this.dataset.status;
      page = 1;
      loadMembers();
    });
  });

  document.getElementById('pagiPrev').addEventListener('click',function(){
    if(page > 1){ page--; loadMembers(); }
  });
  document.getElementById('pagiNext').addEventListener('click',function(){
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
    if(page < totalPages){ page++; loadMembers(); }
  });

  // ── Delete / deactivate (OwnerOnly) — type exact "Delete" to confirm ──
  const DELETE_CONFIRM_WORD = 'Delete';
  let pendingDeleteId = null;
  const deleteModal = document.getElementById('deleteMemberModal');
  const deleteTitle = document.getElementById('deleteMemberTitle');
  const deleteInput = document.getElementById('deleteMemberConfirmInput');
  const deleteConfirmBtn = document.getElementById('btnConfirmDeleteMember');

  function toast(msg, type){
    if(typeof globalThis.toastShared === 'function') return globalThis.toastShared(msg, type || 'success');
    if(typeof globalThis.toast === 'function') return globalThis.toast(msg, type || 'success');
  }

  function escHtml(s){
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function syncDeleteConfirmBtn(){
    if(!deleteConfirmBtn) return;
    const typed = (deleteInput && deleteInput.value || '').trim();
    deleteConfirmBtn.disabled = typed !== DELETE_CONFIRM_WORD;
  }

  function openDeleteConfirm(id, name){
    if(!isOwner){
      toast(tLabel('Only Owners can deactivate members','إلغاء التفعيل للمالك فقط'), 'error');
      return;
    }
    pendingDeleteId = id;
    if(deleteTitle){
      deleteTitle.innerHTML = '<i class="ti ti-trash" style="color:var(--dng500)"></i> ' +
        escHtml(tLabel('Deactivate','إلغاء تفعيل')) + ' ' + escHtml(name || tLabel('Member','العضو')) + '?';
    }
    if(deleteInput){
      deleteInput.value = '';
    }
    syncDeleteConfirmBtn();
    if(deleteModal) deleteModal.classList.add('open');
    setTimeout(function(){ if(deleteInput) deleteInput.focus(); }, 50);
  }

  function closeDeleteConfirm(){
    pendingDeleteId = null;
    if(deleteInput) deleteInput.value = '';
    syncDeleteConfirmBtn();
    if(deleteModal) deleteModal.classList.remove('open');
  }

  // Event delegation — delete buttons are re-rendered each load
  const tblBody = document.getElementById('tblBody');
  if(tblBody){
    tblBody.addEventListener('click', function(e){
      const btn = e.target.closest('[data-delete-id]');
      if(!btn) return;
      e.preventDefault();
      e.stopPropagation();
      openDeleteConfirm(btn.getAttribute('data-delete-id'), btn.getAttribute('data-delete-name') || '');
    });
  }

  if(deleteInput){
    deleteInput.addEventListener('input', syncDeleteConfirmBtn);
    deleteInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter' && deleteConfirmBtn && !deleteConfirmBtn.disabled){
        e.preventDefault();
        deleteConfirmBtn.click();
      }
    });
  }

  if(deleteConfirmBtn){
    deleteConfirmBtn.addEventListener('click', async function(){
      if(!isOwner){ toast(tLabel('Only Owners can deactivate members','إلغاء التفعيل للمالك فقط'), 'error'); return; }
      if(!pendingDeleteId || !Gfp) return;
      const typed = (deleteInput && deleteInput.value || '').trim();
      if(typed !== DELETE_CONFIRM_WORD){
        toast(tLabel('Type Delete to confirm','اكتب Delete للتأكيد'), 'error');
        syncDeleteConfirmBtn();
        if(deleteInput) deleteInput.focus();
        return;
      }
      this.disabled = true;
      const r = await Gfp.del('/members/' + pendingDeleteId);
      if(r.ok){
        closeDeleteConfirm();
        toast(tLabel('Member account deactivated (membership unchanged)','تم إلغاء تفعيل الحساب (العضوية كما هي)'));
        loadMembers();
        loadStats();
      } else {
        const msg = (r.data && (r.data.message || r.data.error || r.data.detail)) || tLabel('Failed to deactivate','فشل إلغاء التفعيل');
        toast(msg, 'error');
        syncDeleteConfirmBtn();
      }
    });
  }

  // Clear typed word when modal closes via overlay / X / Cancel
  if(deleteModal){
    deleteModal.addEventListener('click', function(e){
      if(e.target === this) closeDeleteConfirm();
    });
  }
  const btnCancelDelete = document.getElementById('btnCancelDeleteMember');
  const btnCloseDelete = document.getElementById('btnCloseDeleteMember');
  if(btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteConfirm);
  if(btnCloseDelete) btnCloseDelete.addEventListener('click', closeDeleteConfirm);

  window.loadMembers = loadMembers;
  window.loadStats = loadStats;

  window.addEventListener('gfp:locale', function () {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) {
      window.GfpI18n.applyDocumentLocale();
    }
    if (membersData && membersData.length) render();
  });

  // Deep-link support: /dashboard/members/?status=expired (etc.) — lets other pages (e.g. the
  // dashboard's "attention" widget) land on the actually-matching filtered list instead of
  // always the fully generic view (this page previously ignored its own URL entirely).
  (function applyInitialStatusFromUrl(){
    const qp = new URLSearchParams(window.location.search);
    const wanted = qp.get('status');
    const valid = ['all','active','frozen','expired','cancelled','inactive'];
    if(wanted && valid.indexOf(wanted) !== -1){
      statusFilter = wanted;
      document.querySelectorAll('.f-chip').forEach(chip=>{
        chip.classList.toggle('act', chip.dataset.status === wanted);
      });
    }
  })();

  loadTenant();
  loadStats();
  loadMembers();

})();
