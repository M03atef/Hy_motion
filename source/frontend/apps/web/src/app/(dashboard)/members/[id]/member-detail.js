// ═══════════════════════════════════════════════════════════════
//  Member Detail Page — /members/[id]/
//  API: GET /api/members/{id} → MemberDetailDto
// ═══════════════════════════════════════════════════════════════
(function(){
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || ''; // REM-F3: no hardcoded remote URL

  function t(en, ar){
    if(window.GfpI18n && typeof window.GfpI18n.tLabel === 'function'){
      return window.GfpI18n.tLabel(en, ar);
    }
    try{
      const loc = localStorage.getItem('gfp_locale') || 'en';
      return loc === 'ar' ? ar : en;
    }catch(e){ return en; }
  }
  function applyLocaleBits(root){
    if(window.GfpI18n && window.GfpI18n.applyDocumentLocale){
      window.GfpI18n.applyDocumentLocale();
      return;
    }
    const loc = (function(){ try{ return localStorage.getItem('gfp_locale')||'en'; }catch(e){ return 'en'; } })();
    (root || document).querySelectorAll('[data-en]').forEach(function(el){
      el.textContent = loc === 'ar' ? (el.getAttribute('data-ar') || el.getAttribute('data-en')) : el.getAttribute('data-en');
    });
  }

  function getAuthHeaders(){
    const t=localStorage.getItem('gfp_access_token')||sessionStorage.getItem('gfp_access_token');
    const h={'Content-Type':'application/json'};
    if(t) h['Authorization']='Bearer '+t;
    return h;
  }
  function getUser(){
    try{return JSON.parse(localStorage.getItem('gfp_user')||sessionStorage.getItem('gfp_user'));}
    catch(e){return null;}
  }

  // ── Sidebar user ──
  const user=getUser();
  if(!user){window.location.href='/auth/login/';return;}
  const Gfp=window.GfpApi;
  const Authz=window.GfpAuthz;
  const canView=Authz?Authz.useCan('members.view'):true;
  const canEdit=Authz?Authz.useCan('members.edit'):false;
  const canFreeze=Authz?Authz.useCan('memberships.freeze'):false;
  const canSell=Authz?Authz.useCan('sales.sell'):false;
  const canFinance=Authz?Authz.useCan('reports.financial.view'):false;
  const isOwner=Authz?Authz.useCanRole('OwnerOnly'):(user.role==='Owner'||user.role==='owner');
  if(!canView){window.location.href='/dashboard/';return;}
  const ini=(user.fullName||'U').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent=ini;
  document.getElementById('userName').textContent=user.fullName||'User';
  document.getElementById('userRole').textContent=user.role||'Staff';
  if(isOwner){const ns=document.getElementById('navStaff');if(ns) ns.style.display='flex';}
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

  function apiErr(r){
    if(window.GfpI18n&&window.GfpI18n.displayApiError) return window.GfpI18n.displayApiError(r)||'Request failed';
    return (r&&r.error&&r.error.message)||'Request failed';
  }

  // ── Get member ID from URL ──
  // URL pattern: /members/[id]/  or  ?id=xxx
  function getMemberId(){
    const parts=window.location.pathname.split('/').filter(Boolean);
    const mi=parts.indexOf('members');
    if(mi>=0 && parts[mi+1] && parts[mi+1]!=='[id]') return parts[mi+1];
    const params=new URLSearchParams(window.location.search);
    return params.get('id') || 'DEMO';
  }
  const memberId=getMemberId();

  // ── Helpers ──
  function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmtDate(d){
    if(!d) return '—';
    var loc = (window.GfpI18n && window.GfpI18n.getLocale && window.GfpI18n.getLocale() === 'ar') ? 'ar-EG' : 'en-GB';
    return new Date(d).toLocaleDateString(loc,{day:'2-digit',month:'short',year:'numeric'});
  }
  function fmtTime(d){
    if(!d) return '—';
    var loc = (window.GfpI18n && window.GfpI18n.getLocale && window.GfpI18n.getLocale() === 'ar') ? 'ar-EG' : 'en-GB';
    const dt=new Date(d);
    return dt.toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'});
  }
  function entryMethodLabel(m){
    var k=String(m||'').toLowerCase();
    if(k==='qr') return t('QR','QR');
    if(k==='barcode'||k==='card') return t('Card','كارنيه');
    if(k==='manual') return t('Manual','يدوي');
    return m||'—';
  }
  function calcAge(dob){if(!dob) return '';const d=new Date(dob),now=new Date();let a=now.getFullYear()-d.getFullYear();if(now<new Date(now.getFullYear(),d.getMonth(),d.getDate())) a--;return a;}
  function daysRemaining(end){if(!end) return 0;return Math.max(0,Math.ceil((new Date(end)-new Date())/(1000*60*60*24)));}
  function totalDays(start,end){if(!start||!end) return 30;return Math.max(1,Math.ceil((new Date(end)-new Date(start))/(1000*60*60*24)));}
  function toast(msg,type='success'){
    return globalThis.toastShared(msg, type);
  }
  function fmtEGP(v){return 'EGP '+(v||0).toLocaleString();}
  function fmtPayMethod(m){
    if(!m) return '—';
    return String(m).replace(/_/g,' ').replace(/\b\w/g,function(c){ return c.toUpperCase(); });
  }
  function membershipStatusLabel(st){
    return ({
      pending:t('Waiting for payment','بانتظار الدفع'),
      active:t('Active','نشط'),
      frozen:t('Frozen','مجمّد'),
      expired:t('Expired','منتهٍ'),
      cancelled:t('Cancelled','ملغى'),
      scheduled:t('Scheduled','مجدول')
    })[st]||st||'—';
  }
  let inviteQuotaSnap={ remaining:null, total:null, planName:'' };
  function inviteFactText(st){
    if(st==='pending') return '0 · '+t('starts when paid','تبدأ عند الدفع');
    if(inviteQuotaSnap.remaining==null && inviteQuotaSnap.total==null) return '—';
    return (inviteQuotaSnap.remaining!=null?inviteQuotaSnap.remaining:0)+' '+t('of','من')+' '+(inviteQuotaSnap.total!=null?inviteQuotaSnap.total:0);
  }
  function applyInviteQuota(quota){
    quota=quota||{};
    inviteQuotaSnap={
      remaining:quota.remaining!=null?quota.remaining:0,
      total:quota.total!=null?quota.total:0,
      planName:quota.planName||''
    };
    const pq=document.getElementById('profileQuota');
    if(pq) pq.textContent=inviteQuotaSnap.remaining;
    const el=document.getElementById('msInviteVal');
    const ms=memberData&&memberData.currentMembership;
    if(el) el.textContent=inviteFactText(ms&&String(ms.status||'').toLowerCase());
  }
  async function refreshInviteQuota(){
    if(!Gfp||!memberId||memberId==='DEMO') return;
    try{
      const r=await Gfp.get('/invitation/members/'+encodeURIComponent(memberId));
      if(!r.ok) return;
      const payload=r&&r.data&&r.data.quota?r.data:(r&&r.data&&r.data.data)||r.data||{};
      applyInviteQuota(payload.quota||{});
    }catch(e){ /* leave — until Invitations tab loads */ }
  }
  function calcDuration(cin,cout){
    if(!cin||!cout) return '—';
    const m=Math.round((new Date(cout)-new Date(cin))/60000);
    return m>=60?Math.floor(m/60)+'h '+(m%60)+'m':m+'m';
  }

  // ── Modal helpers ──
  function openModal(id){document.getElementById(id).classList.add('open');}
  function closeModal(id){
    document.getElementById(id).classList.remove('open');
    if(id==='modalDeactivate'){
      const inp=document.getElementById('deactivateConfirmInput');
      const btn=document.getElementById('btnConfirmDeactivate');
      if(inp) inp.value='';
      if(btn) btn.disabled=true;
    }
  }
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    o.addEventListener('click',function(e){
      if(e.target!==this) return;
      if(this.id) closeModal(this.id);
      else this.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-close').forEach(b=>{
    b.addEventListener('click',function(){
      const overlay=this.closest('.modal-overlay');
      if(overlay&&overlay.id) closeModal(overlay.id);
      else if(overlay) overlay.classList.remove('open');
    });
  });

  // ── Tab switching ──
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('act'));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('act'));
      this.classList.add('act');
      document.getElementById(this.dataset.tab).classList.add('act');
      // Lazy load attendance/history on first open
      if(this.dataset.tab==='tabInv' && !window._invLoaded){loadInvitations360();window._invLoaded=true;}
      if(this.dataset.tab==='tabAtt' && !window._attLoaded){loadAttendance();window._attLoaded=true;}
      if(this.dataset.tab==='tabOrders' && !window._ordersLoaded){loadMemberOrders();window._ordersLoaded=true;}
      if(this.dataset.tab==='tabHist' && !window._histLoaded){loadHistory();window._histLoaded=true;}
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Load Member Detail — GET /api/members/{id}
  //  currentMembership: null is valid; recentAttendance = last 5
  // ═══════════════════════════════════════════════════════════════
  let memberData=null;

  function showMemberLoadError(msg){
    const host=document.querySelector('.content')||document.querySelector('.main');
    if(!host) return;
    host.innerHTML='<div class="no-data" style="padding:48px;text-align:center"><i class="ti ti-user-off" style="font-size:40px;display:block;margin-bottom:12px"></i><p style="margin-bottom:16px">'+msg+'</p><a href="/dashboard/members/">Back to list</a></div>';
  }

  async function loadMember(){
    if(memberId==='DEMO'||memberId==='[id]'){
      showMemberLoadError('Invalid member id');
      return;
    }
    if(!Gfp){
      toast('API client missing — hard-refresh','error');
      return;
    }
    try{
      const r=await Gfp.get('/members/'+memberId);
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(r.status===404){
        showMemberLoadError('Member not found');
        return;
      }
      if(!r.ok){
        toast(apiErr(r),'error');
        document.getElementById('skeletonProfile').style.display='none';
        document.getElementById('skeletonTabs').innerHTML='<div class="no-data"><i class="ti ti-alert-circle"></i><p>'+apiErr(r)+'</p></div>';
        document.getElementById('skeletonTabs').style.display='';
        return;
      }
      renderMember(r.data);
    }catch(e){
      console.error(e);
      toast('Unable to load member','error');
    }
  }

  function renderMember(m){
    memberData=m;
    document.getElementById('breadcrumbName').textContent = (window.GfpI18n && window.GfpI18n.tLabel)
      ? window.GfpI18n.tLabel(m.fullName, m.fullNameAr || m.fullName)
      : m.fullName;
    document.title='HyMotion — '+document.getElementById('breadcrumbName').textContent;

    document.getElementById('profileAv').textContent=(m.fullName||m.fullNameAr||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    if(m.profilePhotoUrl){
      document.getElementById('profileAv').innerHTML=`<img src="${m.profilePhotoUrl}" alt="${m.fullName||m.fullNameAr||''}">`;
    }
    document.getElementById('profileMemberNum').textContent='#'+m.memberNumber;
    renderAccessCardPanel(m);
    var loc = (window.GfpI18n && window.GfpI18n.getLocale) ? window.GfpI18n.getLocale() : 'en';
    var primaryName = loc === 'ar' ? (m.fullNameAr || m.fullName || '') : (m.fullName || m.fullNameAr || '');
    var secondaryName = loc === 'ar' ? (m.fullName && m.fullNameAr && m.fullName !== m.fullNameAr ? m.fullName : '') : (m.fullNameAr && m.fullNameAr !== m.fullName ? m.fullNameAr : '');
    document.getElementById('profileNameEn').textContent=primaryName;
    document.getElementById('profileNameAr').textContent=secondaryName;
    document.getElementById('profileNameAr').style.display = secondaryName ? '' : 'none';
    document.getElementById('profilePhone').href='tel:'+m.phone;
    document.getElementById('profilePhone').textContent=m.phone;
    document.getElementById('profileEmail').textContent=m.email||'—';
    if(m.email) document.getElementById('profileEmail').href='mailto:'+m.email;
    const age=calcAge(m.dateOfBirth);
    document.getElementById('profileDob').textContent=m.dateOfBirth?fmtDate(m.dateOfBirth)+' ('+age+' '+t('yrs','سنة')+')':'—';
    var joinEl=document.getElementById('profileJoin');
    if(joinEl){
      var joinDate=fmtDate(m.createdAtUtc);
      joinEl.innerHTML=t('Joined','انضم')+' <span dir="ltr">'+joinDate+'</span>';
    }
    document.getElementById('profileQuota').textContent=m.invitationQuotaRemaining||0;
    const toggle=document.getElementById('statusToggle');
    toggle.checked=!!m.isActive;
    document.getElementById('statusLabel').textContent=m.isActive?t('Active','نشط'):t('Archived','مؤرشف');
    document.getElementById('statusLabel').style.color=m.isActive?'var(--suc500)':'var(--dng500)';
    document.getElementById('profileStatusDot').className='status-dot '+(m.isActive?'active':'inactive');

    // Deactivate — OwnerOnly role policy (not members.*). Managers must not attempt DELETE.
    const btnDeact=document.getElementById('btnDeactivate');
    const statusWrap=toggle.closest('.status-toggle')||toggle.parentElement;
    if(!isOwner){
      if(btnDeact) btnDeact.style.display='none';
      if(statusWrap) statusWrap.style.display='none';
      toggle.disabled=true;
    } else {
      if(btnDeact) btnDeact.style.display='';
      if(statusWrap) statusWrap.style.display='';
      toggle.disabled=false;
      // Account flag ≠ membership status — label the action correctly.
      if(m.isActive){
        btnDeact.innerHTML='<i class="ti ti-user-off"></i> '+t('Deactivate','إلغاء التفعيل');
        btnDeact.classList.add('danger');
        btnDeact.classList.remove('primary');
      } else {
        btnDeact.innerHTML='<i class="ti ti-user-check"></i> '+t('Activate account','تفعيل الحساب');
        btnDeact.classList.remove('danger');
        btnDeact.classList.add('primary');
      }
    }

    // Account archived banner when IsActive=false (P12-R1 Keep Own wording)
    let accountBanner=document.getElementById('accountInactiveBanner');
    if(!accountBanner){
      accountBanner=document.createElement('div');
      accountBanner.id='accountInactiveBanner';
      const profileContent=document.getElementById('profileContent')||document.getElementById('profileCard');
      if(profileContent) profileContent.insertBefore(accountBanner, profileContent.firstChild);
    }
    const msSt=String((m.currentMembership&&m.currentMembership.status)||'').toLowerCase();
    const hasUsablePlan=['active','scheduled','frozen','pending'].includes(msSt);
    if(!m.isActive){
      accountBanner.style.display='block';
      accountBanner.className='info-banner';
      accountBanner.style.cssText='margin:0 0 12px;padding:12px;border-radius:8px;background:var(--dng100);color:var(--dng500);font-size:12px';
      accountBanner.innerHTML=hasUsablePlan
        ?'<i class="ti ti-alert-circle"></i> <strong>Account archived</strong> — person account is inactive. Reactivate the account to restore desk use. Membership plans are unchanged by archive.'
        :'<i class="ti ti-alert-circle"></i> <strong>Account archived</strong> — person account is inactive. Reactivate the account when this person should be active again.';
    } else {
      accountBanner.style.display='none';
      accountBanner.innerHTML='';
    }

    // Edit — members.edit
    ['btnEdit','btnEdit2'].forEach(function(id){
      const el=document.getElementById(id);
      if(el) el.style.display=canEdit?'':'none';
    });

    // currentMembership on member detail may be active-only; §4 current endpoint
    // returns frozen / pending / last expired — reconcile for the panel.
    renderMembership(m.currentMembership||null);
    renderRecentAttendance(Array.isArray(m.recentAttendance)?m.recentAttendance:[]);
    renderMemberApp(m);
    loadFinancial();
    reconcileCurrentMembership();

    window._invLoaded=false;
    var invPane=document.getElementById('tabInv');
    if(invPane&&invPane.classList.contains('act')){
      loadInvitations360();
      window._invLoaded=true;
    }

    document.getElementById('skeletonProfile').style.display='none';
    document.getElementById('skeletonTabs').style.display='none';
    document.getElementById('profileContent').style.display='';
    document.getElementById('tabsContent').style.display='';
    applyLocaleBits(document.getElementById('memberAppCard'));
    applyLocaleBits(document.getElementById('fin360'));
  }

  async function loadFinancial(){
    const card=document.getElementById('fin360');
    if(!card) return;
    if(!canSell && !canFinance){
      card.hidden=true;
      return;
    }
    card.hidden=false;
    const val=document.getElementById('fin360Outstanding');
    const inv=document.getElementById('fin360Invoices');
    if(inv){
      inv.style.display=canFinance?'flex':'none';
      if(memberId && memberId!=='DEMO'){
        inv.href='/dashboard/invoices/?memberId='+encodeURIComponent(memberId);
      }
    }
    if(!Gfp || !canSell || !memberId || memberId==='DEMO'){
      if(val) val.textContent='—';
      card.classList.remove('has-due');
      showCollectBtn(0);
      loadRefundHistory();
      return;
    }
    try{
      const r=await Gfp.get('/debtors?page=1&pageSize=1&memberId='+encodeURIComponent(memberId));
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(!r.ok){
        if(val) val.textContent='—';
        card.classList.remove('has-due');
        showCollectBtn(0);
        return;
      }
      const d=r.data;
      const items=Array.isArray(d)?d:(d&&d.items)||[];
      const due=items[0]?Number(items[0].totalDue||0):0;
      if(val) val.textContent=fmtEGP(due);
      card.classList.toggle('has-due', due>0);
      showCollectBtn(due);
    }catch(e){
      if(val) val.textContent='—';
      card.classList.remove('has-due');
      showCollectBtn(0);
    }
    loadRefundHistory();
  }

  function showCollectBtn(due){
    const btn=document.getElementById('btnCollectPayment');
    if(!btn) return;
    btn.hidden=!(canSell && Number(due)>0);
  }

  let collectSales=[];
  let collectSelected=null;

  function collectErr(msg){
    const banner=document.getElementById('collectErrorBanner');
    if(!banner) return;
    banner.classList.toggle('show', !!msg);
    const t=banner.querySelector('.error-text');
    if(t) t.textContent=msg||'';
  }

  function syncTakePaymentEnabled(){
    const btn=document.getElementById('btnTakePayment');
    if(!btn) return;
    const sale=selectedCollectSale();
    const amtEl=document.getElementById('collectAmount');
    const amount=amtEl?parseFloat(amtEl.value):NaN;
    const ok=!!(sale && amount>0 && amount<=Number(sale.amountDue)+1e-9);
    btn.disabled=!ok;
  }

  function fmtDueOnly(d){
    if(!d) return '';
    const s=String(d).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const p=s.split('-');
      return new Date(Number(p[0]), Number(p[1])-1, Number(p[2])).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    }
    return fmtDate(d);
  }

  function selectedCollectSale(){
    if(!collectSelected) return null;
    for(let i=0;i<collectSales.length;i++){
      if(String(collectSales[i].saleId)===String(collectSelected)) return collectSales[i];
    }
    return null;
  }

  function selectCollectSale(saleId){
    collectSelected=saleId;
    const sale=selectedCollectSale();
    document.querySelectorAll('.collect-choice').forEach(function(el){
      el.classList.toggle('on', el.getAttribute('data-id')===String(saleId));
    });
    const amt=document.getElementById('collectAmount');
    const hint=document.getElementById('collectAmountHint');
    if(sale && amt){
      amt.max=sale.amountDue;
      amt.value=sale.amountDue;
    }
    if(hint){
      hint.textContent=sale
        ? t('Remaining on this sale: ','المتبقي على هذا البيع: ')+fmtEGP(sale.amountDue)
        : '';
    }
    syncTakePaymentEnabled();
  }

  function renderCollectSales(){
    const wrap=document.getElementById('collectSaleChoices');
    if(!wrap) return;
    if(!collectSales.length){
      wrap.innerHTML='<div class="collect-hint">'+escHtml(t('Nothing outstanding.','لا يوجد مستحق.'))+'</div>';
      return;
    }
    wrap.innerHTML=collectSales.map(function(s){
      const due=fmtDueOnly(s.dueDate);
      const paid=Number(s.paid||0);
      const total=Number(s.total||0);
      return '<div class="collect-choice'+(String(s.saleId)===String(collectSelected)?' on':'')+'" data-id="'+escHtml(s.saleId)+'" role="button" tabindex="0">'
        +'<div><b>'+escHtml(s.description||t('Sale','بيع'))+'</b>'
        +'<small>'+escHtml(t('Paid ','مدفوع ')+fmtEGP(paid)+t(' of ',' من ')+fmtEGP(total)+(due?t(' · Due ',' · الاستحقاق ')+due:''))+'</small></div>'
        +'<div class="due">'+escHtml(fmtEGP(s.amountDue))+'</div></div>';
    }).join('');
    wrap.querySelectorAll('.collect-choice').forEach(function(el){
      el.addEventListener('click',function(){ selectCollectSale(el.getAttribute('data-id')); });
    });
  }

  async function openCollectDrawer(){
    if(!canSell || !Gfp || !memberId || memberId==='DEMO') return;
    collectErr('');
    collectSales=[];
    collectSelected=null;
    const overlay=document.getElementById('collectPaymentDrawer');
    if(overlay) overlay.classList.add('open');
    applyLocaleBits(overlay);
    try{
      const r=await Gfp.get('/debtors/'+encodeURIComponent(memberId)+'/sales');
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(!r.ok){
        collectErr(apiErr(r)||t('Could not load outstanding sales.','تعذر تحميل المبيعات المستحقة.'));
        return;
      }
      const d=r.data&&r.data.data?r.data.data:r.data;
      collectSales=Array.isArray(d&&d.sales)?d.sales:[];
      const saleHint=document.getElementById('collectSaleHint');
      if(saleHint){
        saleHint.textContent=collectSales.length>1
          ? t('Select one sale. Remaining total is collected next.','اختر بيعاً واحداً. المتبقي يُحصَّل في الدفعة التالية.')
          : '';
      }
      if(collectSales.length) collectSelected=collectSales[0].saleId;
      renderCollectSales();
      if(collectSelected) selectCollectSale(collectSelected);
      else syncTakePaymentEnabled();
      if(!collectSales.length){
        collectErr(t('Nothing outstanding.','لا يوجد مستحق.'));
        showCollectBtn(0);
      }
    }catch(e){
      collectErr(t('Network error','خطأ في الشبكة'));
    }
  }

  const btnCollectPayment=document.getElementById('btnCollectPayment');
  if(btnCollectPayment) btnCollectPayment.addEventListener('click', function(){ openCollectDrawer(); });

  function updateCollectMethodHint(){
    const pay=document.getElementById('collectMethod');
    const hint=document.getElementById('collectMethodHint');
    if(!pay||!hint) return;
    hint.textContent=pay.value==='cash'
      ? t('Cash requires an open shift.','النقد يتطلب وردية مفتوحة.')
      : t('Recorded against this sale.','تُسجَّل على هذا البيع.');
  }
  const collectMethodEl=document.getElementById('collectMethod');
  if(collectMethodEl) collectMethodEl.addEventListener('change', updateCollectMethodHint);
  updateCollectMethodHint();

  const collectAmountEl=document.getElementById('collectAmount');
  if(collectAmountEl){
    collectAmountEl.addEventListener('input', function(){
      const sale=selectedCollectSale();
      const n=parseFloat(collectAmountEl.value);
      if(sale && n>Number(sale.amountDue)) collectAmountEl.value=sale.amountDue;
      syncTakePaymentEnabled();
    });
  }

  const btnTakePayment=document.getElementById('btnTakePayment');
  if(btnTakePayment){
    btnTakePayment.addEventListener('click', async function(){
      collectErr('');
      const sale=selectedCollectSale();
      if(!sale){ collectErr(t('Select an outstanding sale.','اختر بيعاً مستحقاً.')); return; }
      const amtEl=document.getElementById('collectAmount');
      const methodEl=document.getElementById('collectMethod');
      const amount=amtEl?parseFloat(amtEl.value):NaN;
      const method=methodEl?methodEl.value:'cash';
      if(!(amount>0)){ collectErr(t('Enter an amount.','أدخل مبلغاً.')); return; }
      if(amount>Number(sale.amountDue)){ collectErr(t('Amount cannot exceed remaining.','المبلغ لا يتجاوز المتبقي.')); return; }
      btnTakePayment.disabled=true;
      try{
        if(method==='cash'){
          const sh=await Gfp.get('/shifts/current');
          if(!sh.ok||!sh.data||!sh.data.id){
            collectErr(t('Open a cash shift first, then complete this payment.','افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.') + ' ');
            const banner=document.getElementById('collectErrorBanner');
            const te=banner&&banner.querySelector('.error-text');
            if(te){
              te.innerHTML=t('Open a cash shift first, then complete this payment.','افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.') +
                ' <a href="/dashboard/shifts/">'+t('Open shift','افتح الوردية')+'</a>';
            }
            btnTakePayment.disabled=false;
            return;
          }
        }
        const r=await Gfp.post('/sales/'+encodeURIComponent(sale.saleId)+'/payments', { method: method, amount: amount });
        if(r.ok){
          closeOverlay('collectPaymentDrawer');
          toast(t('Payment recorded','تم تسجيل الدفعة'));
          loadFinancial();
        } else {
          collectErr(apiErr(r)||t('Payment failed','فشل تسجيل الدفعة'));
          toast(apiErr(r)||t('Payment failed','فشل تسجيل الدفعة'),'error');
        }
      }catch(e){
        collectErr(t('Network error','خطأ في الشبكة'));
      }
      btnTakePayment.disabled=false;
    });
  }

  function refundsFeatureOn(){
    const F=window.GfpFeatures;
    if(!F||typeof F.isModuleAvailable!=='function') return true;
    return F.isModuleAvailable('refunds', F.readCache&&F.readCache());
  }

  async function loadRefundHistory(){
    const row=document.getElementById('fin360RefundRow');
    const list=document.getElementById('fin360RefundList');
    const val=document.getElementById('fin360Refunds');
    if(!row||!list) return;
    const canApproveRf=Authz&&(Authz.useCan('payments.refund.approve')||Authz.useCanRole('OwnerOnly'));
    if(!refundsFeatureOn()||!canApproveRf||!Gfp||!memberId||memberId==='DEMO'){
      row.hidden=true;
      list.hidden=true;
      return;
    }
    row.hidden=false;
    try{
      const r=await Gfp.get('/refunds?memberId='+encodeURIComponent(memberId));
      if(!r.ok){
        row.hidden=true;
        list.hidden=true;
        return;
      }
      const items=Array.isArray(r.data)?r.data:(r.data&&r.data.items)||[];
      const executed=items.filter(function(x){ return String(x.status||'').toLowerCase()==='executed'; });
      const sum=executed.reduce(function(acc,x){ return acc+Number(x.amount||0); },0);
      if(val) val.textContent=items.length? (fmtEGP(sum)+' · '+items.length) : t('None','لا يوجد');
      if(!items.length){
        list.hidden=true;
        list.innerHTML='';
        return;
      }
      list.hidden=false;
      list.innerHTML=items.slice(0,8).map(function(rf){
        return '<li><span>'+escHtml(fmtEGP(rf.amount))+' · '+escHtml(rf.status||'')+'</span><span class="muted">'+escHtml(rf.method||'')+'</span></li>';
      }).join('');
    }catch(e){
      row.hidden=true;
      list.hidden=true;
    }
  }

  function escHtml(s){
    const d=document.createElement('div');
    d.textContent=s==null?'':String(s);
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Access card inventory panel (Assigned AccessCard.Code, else MemberNumber)
  //  GET /api/members/{id}/access-card-html  (members.view)
  //  POST /api/access-cards/assign|replace|{id}/lost  (members.edit)
  // ═══════════════════════════════════════════════════════════════
  var _cardScanMode = null; // 'assign' | 'replace' | null

  function renderAccessBarcode(code){
    const svg=document.getElementById('accessBarcodeSvg');
    const numEl=document.getElementById('accessBarcodeNum');
    const payload=String(code||'').trim();
    if(numEl) numEl.textContent=payload?('#'+payload):'—';
    if(!svg) return;
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    if(!payload){
      svg.setAttribute('width','0');
      svg.setAttribute('height','0');
      return;
    }
    if(typeof JsBarcode!=='function'){
      const tnode=document.createElementNS('http://www.w3.org/2000/svg','text');
      tnode.setAttribute('x','10'); tnode.setAttribute('y','28');
      tnode.setAttribute('font-size','12'); tnode.textContent=payload;
      svg.appendChild(tnode);
      return;
    }
    try{
      JsBarcode(svg, payload, {
        format:'CODE128',
        displayValue:false,
        margin:8,
        height:48,
        width:2,
        background:'#ffffff',
        lineColor:'#0D0D0D'
      });
    }catch(e){
      if(numEl) numEl.textContent=payload+' (barcode unavailable)';
    }
  }

  function canEditCards(){
    return !!canEdit || !!isOwner;
  }

  function renderAccessCardPanel(m){
    const card=m && m.accessCard ? m.accessCard : null;
    const assigned=!!(card && card.code && String(card.status||'')==='Assigned');
    const code=assigned ? card.code : '';
    renderAccessBarcode(code);

    const statusRow=document.getElementById('accessCardStatusRow');
    const pill=document.getElementById('accessCardStatusPill');
    const sub=document.getElementById('accessCardSub');
    const barcodeWrap=document.getElementById('accessBarcodeWrap');
    const emptyEl=document.getElementById('accessCardEmpty');
    const btnAssign=document.getElementById('btnAssignCard');
    const btnReplace=document.getElementById('btnReplaceCard');
    const btnLost=document.getElementById('btnMarkCardLost');
    const btnReprint=document.getElementById('btnReprintCard2');
    const btnReprintTop=document.getElementById('btnReprintCard');
    const edit=canEditCards();

    if(btnReprint) btnReprint.hidden=true;
    if(btnReprintTop) btnReprintTop.hidden=true;

    if(assigned){
      if(barcodeWrap) barcodeWrap.hidden=false;
      if(emptyEl) emptyEl.hidden=true;
      if(statusRow) statusRow.hidden=false;
      if(pill){
        pill.textContent=t(card.status, card.status);
        pill.className='access-card-status-pill';
      }
      if(sub){
        sub.setAttribute('data-en','Assigned PVC card — desk scan uses this code');
        sub.setAttribute('data-ar','كارنيه معيَّن — المسح يستخدم هذا الكود');
        sub.textContent=t('Assigned PVC card — desk scan uses this code','كارنيه معيَّن — المسح يستخدم هذا الكود');
      }
      if(btnAssign) btnAssign.hidden=true;
      if(btnReplace) btnReplace.hidden=!edit;
      if(btnLost) btnLost.hidden=!edit;
    }else if(card){
      // Non-Assigned inventory state (Lost / Damaged / Blocked) — need replace
      if(barcodeWrap) barcodeWrap.hidden=true;
      if(emptyEl){
        emptyEl.hidden=false;
        emptyEl.innerHTML='<span>'+t('No active PVC card. Assign or replace from stock.','لا يوجد كارنيه نشط. عيّن أو استبدل من المخزون.')+'</span>';
      }
      if(statusRow) statusRow.hidden=false;
      if(pill){
        pill.textContent=t(card.status, card.status);
        pill.className='access-card-status-pill warn';
      }
      if(sub){
        sub.setAttribute('data-en','Previous card is not active for check-in');
        sub.setAttribute('data-ar','الكارنيه السابق غير نشط للدخول');
        sub.textContent=t('Previous card is not active for check-in','الكارنيه السابق غير نشط للدخول');
      }
      if(btnAssign) btnAssign.hidden=!edit;
      if(btnReplace) btnReplace.hidden=!edit;
      if(btnLost) btnLost.hidden=true;
    }else{
      if(barcodeWrap) barcodeWrap.hidden=true;
      if(emptyEl){
        emptyEl.hidden=false;
        emptyEl.innerHTML='<span data-en="No PVC card assigned yet." data-ar="لا يوجد كارنيه معيَّن بعد.">'+
          t('No PVC card assigned yet.','لا يوجد كارنيه معيَّن بعد.')+'</span>';
      }
      if(statusRow) statusRow.hidden=true;
      if(sub){
        sub.setAttribute('data-en','Assign a blank PVC card from stock');
        sub.setAttribute('data-ar','عيّن كارنيه PVC من المخزون');
        sub.textContent=t('Assign a blank PVC card from stock','عيّن كارنيه PVC من المخزون');
      }
      if(btnAssign){
        btnAssign.hidden=!edit;
        btnAssign.className='btn-ms primary';
      }
      if(btnReplace) btnReplace.hidden=true;
      if(btnLost) btnLost.hidden=true;
    }
    hideCardScanRow();
  }

  function hideCardScanRow(){
    _cardScanMode=null;
    const row=document.getElementById('accessCardScanRow');
    const input=document.getElementById('accessCardScanInput');
    if(row) row.hidden=true;
    if(input) input.value='';
  }

  function showCardScanRow(mode){
    _cardScanMode=mode;
    const row=document.getElementById('accessCardScanRow');
    const input=document.getElementById('accessCardScanInput');
    if(row) row.hidden=false;
    if(input){ input.value=''; input.focus(); }
  }

  async function confirmCardScan(){
    const input=document.getElementById('accessCardScanInput');
    const code=String(input && input.value || '').trim();
    if(!code){
      toast(t('Scan an Available card','امسح كارنيه متاح'),'error');
      return;
    }
    if(!memberId || !Gfp) return;
    try{
      var r;
      if(_cardScanMode==='assign'){
        r=await Gfp.post('/access-cards/assign',{ memberId:memberId, code:code });
      }else if(_cardScanMode==='replace'){
        r=await Gfp.post('/access-cards/replace',{ memberId:memberId, newCode:code, oldStatus:'Lost' });
      }else{
        return;
      }
      if(!r || !r.ok){
        toast(apiErr(r)||t('Card action failed','فشل إجراء الكارنيه'),'error');
        return;
      }
      toast(_cardScanMode==='replace'
        ? t('Card replaced','تم استبدال الكارنيه')
        : t('Card assigned','تم تعيين الكارنيه'));
      hideCardScanRow();
      await loadMember();
    }catch(e){
      toast(t('Card action failed','فشل إجراء الكارنيه'),'error');
    }
  }

  async function markCurrentCardLost(){
    const card=memberData && memberData.accessCard;
    if(!card || !card.id || !Gfp) return;
    if(!confirm(t('Mark this card as lost? It will no longer check in.','تبليغ الكارنيه مفقود؟ لن يعمل للدخول.'))) return;
    try{
      const r=await Gfp.post('/access-cards/'+encodeURIComponent(card.id)+'/lost',{
        reason:'Marked lost from member 360'
      });
      if(!r || !r.ok){
        toast(apiErr(r)||t('Could not mark lost','تعذر التبليغ مفقود'),'error');
        return;
      }
      toast(t('Card marked lost','تم تبليغ الكارنيه مفقود'));
      await loadMember();
    }catch(e){
      toast(t('Could not mark lost','تعذر التبليغ مفقود'),'error');
    }
  }

  function wireAccessCardActions(){
    const btnAssign=document.getElementById('btnAssignCard');
    const btnReplace=document.getElementById('btnReplaceCard');
    const btnLost=document.getElementById('btnMarkCardLost');
    const btnConfirm=document.getElementById('btnConfirmCardScan');
    const btnCancel=document.getElementById('btnCancelCardScan');
    const input=document.getElementById('accessCardScanInput');
    if(btnAssign) btnAssign.addEventListener('click',function(){ showCardScanRow('assign'); });
    if(btnReplace) btnReplace.addEventListener('click',function(){ showCardScanRow('replace'); });
    if(btnLost) btnLost.addEventListener('click',function(){ markCurrentCardLost(); });
    if(btnConfirm) btnConfirm.addEventListener('click',confirmCardScan);
    if(btnCancel) btnCancel.addEventListener('click',hideCardScanRow);
    if(input) input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); confirmCardScan(); }
    });
  }
  wireAccessCardActions();

  function closeAccessPrint(){
    const ov=document.getElementById('accessPrintOverlay');
    if(ov) ov.hidden=true;
    const frame=document.getElementById('accessPrintFrame');
    if(frame) frame.srcdoc='';
  }

  function accessApiBase(){
    if(window.GfpApi && typeof window.GfpApi.apiBase==='function'){
      return String(window.GfpApi.apiBase()).replace(/\/$/,'');
    }
    return String(window.API_BASE || API_BASE || window.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/,'');
  }

  async function fetchAccessCardHtml(){
    if(!memberId) return { ok:false, status:0, text:'', error:'Missing member id' };
    const path='/members/'+encodeURIComponent(memberId)+'/access-card-html';
    const url=accessApiBase()+path;
    const headers={};
    const token=localStorage.getItem('gfp_access_token')||sessionStorage.getItem('gfp_access_token');
    if(token) headers['Authorization']='Bearer '+token;
    // ngrok free interstitial otherwise can hang / return HTML warning page
    headers['ngrok-skip-browser-warning']='true';
    headers['Accept']='text/html';

    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctrl?setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, 15000):null;
    try{
      const res=await fetch(url,{ method:'GET', headers:headers, signal:ctrl?ctrl.signal:undefined });
      if(timer) clearTimeout(timer);
      if(res.status===401){ window.location.href='/auth/login/'; return { ok:false, status:401, text:'' }; }
      const text=await res.text();
      return { ok:res.ok, status:res.status, text:text, url:url };
    }catch(e){
      if(timer) clearTimeout(timer);
      const aborted=e && (e.name==='AbortError' || String(e.message||'').indexOf('abort')>=0);
      return {
        ok:false,
        status:0,
        text:'',
        url:url,
        error: aborted
          ? t('Request timed out — check API / ngrok','انتهت المهلة — تأكد من الـ API / ngrok')
          : t('Network error — check API / ngrok tunnel','خطأ شبكة — تأكد من الـ API / ngrok')
      };
    }
  }

  async function openAccessCardPrint(autoPrint){
    const overlay=document.getElementById('accessPrintOverlay');
    const frame=document.getElementById('accessPrintFrame');
    const titleEl=document.getElementById('accessPrintTitle');
    if(!overlay||!frame){ toast(t('Print view not available','عرض الطباعة غير متاح'),'error'); return; }
    if(titleEl){
      titleEl.setAttribute('data-en','Barcode card');
      titleEl.setAttribute('data-ar','كارنيه الباركود');
      titleEl.textContent=t('Barcode card','كارنيه الباركود');
    }
    overlay.hidden=false;
    frame.srcdoc='<p style="padding:16px;font-family:sans-serif;color:#666">'+t('Loading card…','جاري تحميل الكارنيه…')+'</p>';
    let res;
    try{
      res=await fetchAccessCardHtml();
    }catch(e){
      res={ ok:false, status:0, error:String(e&&e.message||e) };
    }
    if(!res || !res.ok){
      let msg=res && res.error
        ? res.error
        : t('Could not load barcode card','تعذر تحميل كارنيه الباركود');
      if(res && res.status===404){
        msg=t(
          'Card endpoint missing (404). Restart the API after Access Cards deploy.',
          'مسار الكارنيه مش موجود (404). أعد تشغيل الـ API.'
        );
      } else if(res && res.status){
        msg+=' (HTTP '+res.status+')';
      }
      toast(msg,'error');
      frame.srcdoc='<p style="padding:16px;font-family:sans-serif;color:#991b1b">'+msg+
        (res&&res.url?'<br><small style="color:#666">'+String(res.url).replace(/</g,'')+'</small>':'')+
        '</p>';
      return;
    }
    if(!res.text || !String(res.text).trim()){
      const msg=t('Card returned empty HTML','الكارنيه رجع فاضي');
      toast(msg,'error');
      frame.srcdoc='<p style="padding:16px;font-family:sans-serif;color:#991b1b">'+msg+'</p>';
      return;
    }
    frame.srcdoc=res.text;
    if(autoPrint){
      setTimeout(function(){
        try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch(e){ toast(t('Allow pop-ups / try Print again','اسمح بالنوافذ المنبثقة أو اضغط طباعة'),'error'); }
      }, 450);
    }
  }

  function wireAccessCardButtons(){
    const reprint=function(){ openAccessCardPrint(true); };
    const b1=document.getElementById('btnReprintCard');
    const b2=document.getElementById('btnReprintCard2');
    if(b1) b1.addEventListener('click', reprint);
    if(b2) b2.addEventListener('click', reprint);
    const close1=document.getElementById('btnAccessPrintClose');
    const close2=document.getElementById('btnAccessPrintClose2');
    if(close1) close1.addEventListener('click', closeAccessPrint);
    if(close2) close2.addEventListener('click', closeAccessPrint);
    const doPrint=document.getElementById('btnAccessPrintDo');
    if(doPrint){
      doPrint.addEventListener('click', function(){
        const frame=document.getElementById('accessPrintFrame');
        try{ if(frame&&frame.contentWindow){ frame.contentWindow.focus(); frame.contentWindow.print(); } }
        catch(e){ toast(t('Allow pop-ups / try Print again','اسمح بالنوافذ المنبثقة أو اضغط طباعة'),'error'); }
      });
    }
    const ov=document.getElementById('accessPrintOverlay');
    if(ov) ov.addEventListener('click', function(e){ if(e.target===ov) closeAccessPrint(); });
  }
  wireAccessCardButtons();

  // ═══════════════════════════════════════════════════════════════
  //  Member App — activation code (staff generates; shown once)
  //  POST /api/members/{id}/app-activation-code  (members.edit)
  // ═══════════════════════════════════════════════════════════════
  function renderMemberApp(m){
    const statusEl=document.getElementById('memberAppStatus');
    const btn=document.getElementById('btnGenAppCode');
    const labelEl=btn&&btn.querySelector('.btn-label');
    const reveal=document.getElementById('memberAppReveal');
    if(!statusEl||!btn) return;

    // GET never returns plaintext — clear any previous on-screen code on status refresh
    if(reveal && !window.__gfpKeepAppCodeReveal){
      reveal.hidden=true;
      const codeEl=document.getElementById('memberAppCode');
      if(codeEl) codeEl.textContent='';
    }

    const app=m&&m.memberApp?m.memberApp:{};
    const st=String(app.status||'not_activated').toLowerCase();
    let statusText=t('Status: Not Activated','الحالة: غير مفعّل');
    if(st==='pending_code'){
      const exp=app.pendingCodeExpiresAtUtc?fmtDate(app.pendingCodeExpiresAtUtc):'—';
      statusText=t('Status: Code pending · expires ','الحالة: كود معلّق · ينتهي ')+exp;
    } else if(st==='activated'){
      const when=app.activatedAtUtc?fmtDate(app.activatedAtUtc):'';
      statusText=when
        ? t('Status: Activated · ','الحالة: مفعّل · ')+when
        : t('Status: Activated','الحالة: مفعّل');
    }
    statusEl.textContent=statusText;

    const canGen=!!canEdit && !!(m&&m.isActive);
    btn.hidden=!canGen;
    btn.disabled=!canGen;
    if(labelEl){
      if(st==='pending_code'){
        labelEl.setAttribute('data-en','Regenerate Code');
        labelEl.setAttribute('data-ar','إعادة إنشاء الكود');
        labelEl.textContent=t('Regenerate Code','إعادة إنشاء الكود');
      } else if(st==='activated'){
        labelEl.setAttribute('data-en','Generate New Code');
        labelEl.setAttribute('data-ar','إنشاء كود جديد');
        labelEl.textContent=t('Generate New Code','إنشاء كود جديد');
      } else {
        labelEl.setAttribute('data-en','Generate Activation Code');
        labelEl.setAttribute('data-ar','إنشاء كود التفعيل');
        labelEl.textContent=t('Generate Activation Code','إنشاء كود التفعيل');
      }
    }
  }

  function showActivationCodeReveal(payload){
    const reveal=document.getElementById('memberAppReveal');
    const codeEl=document.getElementById('memberAppCode');
    const expEl=document.getElementById('memberAppExpiry');
    if(!reveal||!codeEl||!expEl) return;
    const code=payload&&payload.activationCode?String(payload.activationCode):'';
    codeEl.textContent=code;
    const mins=payload&&payload.expiresInMinutes!=null?Number(payload.expiresInMinutes):null;
    const expUtc=payload&&payload.expiresAtUtc?fmtDate(payload.expiresAtUtc)+' '+fmtTime(payload.expiresAtUtc):'—';
    expEl.textContent=mins!=null&&!Number.isNaN(mins)
      ? t('Expires ','ينتهي ')+expUtc+' ('+mins+' '+t('min','دقيقة')+')'
      : t('Expires ','ينتهي ')+expUtc;
    reveal.hidden=false;
    applyLocaleBits(reveal);
  }

  function setGenAppCodeLoading(on){
    const btn=document.getElementById('btnGenAppCode');
    if(!btn) return;
    btn.classList.toggle('loading',!!on);
    btn.disabled=!!on || !(canEdit && memberData && memberData.isActive);
    const spin=btn.querySelector('.btn-spinner');
    if(spin) spin.style.display=on?'inline-block':'none';
  }

  async function generateMemberAppCode(){
    if(!canEdit){ toast(t('Missing members.edit permission','صلاحية members.edit مطلوبة'),'error'); return; }
    if(!memberData||!memberData.isActive){
      toast(t('Archived members cannot receive an activation code','لا يمكن إنشاء كود لحساب مؤرشف'),'error');
      return;
    }
    if(!Gfp||!memberId){ toast(t('API client missing','عميل الـ API غير موجود'),'error'); return; }

    setGenAppCodeLoading(true);
    try{
      const r=await Gfp.post('/members/'+memberId+'/app-activation-code',{});
      if(r.status===401){ window.location.href='/auth/login/'; return; }
      if(r.status===403){
        toast(t('Missing members.edit permission','صلاحية members.edit مطلوبة'),'error');
        return;
      }
      if(r.status===404){
        toast(t('Member not found','العضو غير موجود'),'error');
        return;
      }
      if(!r.ok){
        toast(apiErr(r)||t('Could not generate code','مش قادرين ننشئ الكود'),'error');
        return;
      }
      const payload=r.data||{};
      toast(t('Activation code generated','تم إنشاء كود التفعيل'));
      // Refresh status from GET (never re-fetch plaintext code)
      window.__gfpKeepAppCodeReveal=true;
      try{
        await loadMember();
      }finally{
        window.__gfpKeepAppCodeReveal=false;
      }
      showActivationCodeReveal(payload);
    }catch(e){
      toast(t('Could not generate code','مش قادرين ننشئ الكود'),'error');
    }finally{
      setGenAppCodeLoading(false);
    }
  }

  const btnGenAppCode=document.getElementById('btnGenAppCode');
  if(btnGenAppCode){
    btnGenAppCode.addEventListener('click',function(e){
      e.preventDefault();
      generateMemberAppCode();
    });
  }
  const btnCopyAppCode=document.getElementById('btnCopyAppCode');
  if(btnCopyAppCode){
    btnCopyAppCode.addEventListener('click',async function(){
      const codeEl=document.getElementById('memberAppCode');
      const code=codeEl&&codeEl.textContent?codeEl.textContent.trim():'';
      if(!code) return;
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText){
          await navigator.clipboard.writeText(code);
        } else {
          const ta=document.createElement('textarea');
          ta.value=code; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        toast(t('Copied','تم النسخ'));
      }catch(e){
        toast(t('Could not copy','تعذّر النسخ'),'error');
      }
    });
  }
  window.addEventListener('gfp:locale',function(){
    if(memberData) renderMember(memberData);
    applyLocaleBits(document);
  });

  async function reconcileCurrentMembership(){
    if(!Gfp||!memberId) return;
    try{
      const r=await Gfp.get('/memberships/'+memberId+'/current');
      if(r.ok&&r.data){
        if(memberData) memberData.currentMembership=r.data;
        renderMembership(r.data);
      } else if(r.status===404){
        if(memberData) memberData.currentMembership=null;
        renderMembership(null);
      }
    }catch(e){ /* keep embedded snapshot */ }
  }

  function renderRecentAttendance(rows){
    const wrap=document.getElementById('recentAttWrap');
    const list=document.getElementById('recentAttList');
    if(!wrap||!list) return;
    const items=(rows||[]).slice(0,5);
    if(!items.length){
      wrap.style.display='none';
      list.innerHTML='';
      return;
    }
    wrap.style.display='block';
    list.innerHTML='<table class="att-tbl" style="width:100%"><thead><tr>'+
      '<th data-en="Date" data-ar="التاريخ">'+t('Date','التاريخ')+'</th>'+
      '<th data-en="In" data-ar="دخول">'+t('In','دخول')+'</th>'+
      '<th data-en="Out" data-ar="خروج">'+t('Out','خروج')+'</th>'+
      '<th data-en="Method" data-ar="الطريقة">'+t('Method','الطريقة')+'</th>'+
      '</tr></thead><tbody>'+
      items.map(function(a){
        return '<tr><td dir="ltr">'+fmtDate(a.checkInAtUtc)+'</td><td dir="ltr">'+fmtTime(a.checkInAtUtc)+'</td><td dir="ltr">'+
          (a.checkOutAtUtc?fmtTime(a.checkOutAtUtc):'—')+'</td><td>'+entryMethodLabel(a.entryMethod)+'</td></tr>';
      }).join('')+'</tbody></table>';
  }

  function renderMembership(ms){
    const container=document.getElementById('membershipContent');
    const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;
    if(!ms){
      container.innerHTML=`
        <div class="no-data">
          <i class="ti ti-id-off"></i>
          <p style="margin-bottom:16px">${t('No membership on file','لا توجد عضوية مسجّلة')}</p>
          ${canMgr?`<button type="button" class="btn-ms primary" onclick="window.openAssignModal&&window.openAssignModal('${memberId}')"><i class="ti ti-plus"></i> ${t('Assign Membership','تعيين عضوية')}</button>`:''}
        </div>`;
      return;
    }
    const st=String(ms.status||'').toLowerCase();
    const days=st==='expired'?0:daysRemaining(ms.endDate);
    const tot=totalDays(ms.startDate,ms.endDate);
    const used=Math.min(tot, Math.max(0, tot-days));
    const usedPct=tot>0?Math.min(100,Math.round((used/tot)*100)):0;
    const isPending=st==='pending';
    const isExpired=st==='expired';
    const isFrozen=st==='frozen';
    const isCancelled=st==='cancelled';
    const isScheduled=st==='scheduled';
    const canRenew=canMgr&&(st==='active'||st==='scheduled'||st==='expired'||st==='frozen'||st==='pending'||st==='cancelled');
    const canAssign=canMgr&&(st==='expired'||st==='cancelled'||!st);
    const pay=fmtPayMethod(ms.paymentMethod);
    const showPeriod=!isPending && !isCancelled && !isScheduled;

    const pendingBanner=isPending?`
      <div class="ms-warn">
        <strong>Waiting for ${escHtml(pay==='—' ? 'payment' : pay)}</strong>
        Check-in and invitations stay closed until this payment confirms. No live push — refresh after the member pays.
      </div>
      <div class="ms-reserved">Reserved period ${fmtDate(ms.startDate)} – ${fmtDate(ms.endDate)}</div>`:'';

    const expiredNote=isExpired?`
      <div class="ms-note danger">
        <i class="ti ti-info-circle"></i> Showing last expired membership (no active plan). Use Assign or Renew below.
      </div>`:'';

    const cancelledNote=isCancelled?`
      <div class="ms-note danger">
        <i class="ti ti-info-circle"></i> This membership was refunded and is historical. Renew or Assign to start a new current membership — invitations use the new period.
      </div>`:'';

    const scheduledNote=isScheduled?`
      <div class="ms-note warn">
        <i class="ti ti-calendar-event"></i> Membership starts ${fmtDate(ms.startDate)} — check-in not available yet.
      </div>`:'';

    const accountOff=memberData&&memberData.isActive===false;
    const accountNote=accountOff&&!isExpired?`
      <div class="ms-note warn">
        <i class="ti ti-user-off"></i> Account is archived — use <strong>Activate account</strong> here. Membership actions remain available below.
      </div>`:'';

    let sessionsFact='';
    if(ms.sessionsRemaining!=null){
      sessionsFact=ms.sessionCount!=null
        ? (ms.sessionsRemaining+' of '+ms.sessionCount)
        : String(ms.sessionsRemaining);
    }

    const activityQuotas=Array.isArray(ms.activityQuotas)?ms.activityQuotas
      :(Array.isArray(ms.ActivityQuotas)?ms.ActivityQuotas:[]);
    const isAr=(document.documentElement.lang||'').toLowerCase()==='ar';
    function quotaPeriodLabel(period){
      const p=String(period||'').toLowerCase();
      if(p==='cairo_month'||p==='monthly') return isAr?'كل شهر (القاهرة)':'Every Cairo month';
      if(p==='one_time') return isAr?'مرة واحدة':'One time';
      return isAr?'لكل عضوية':'Per membership';
    }
    function activityAccessLabel(mode){
      if(mode==='unlimited') return isAr?'غير محدود':'Unlimited';
      if(mode==='included') return isAr?'مشمول':'Included';
      if(mode==='limited') return isAr?'محدود':'Limited';
      return isAr?'غير متاح':'Not available';
    }
    function activityQuotaRow(q){
      const mode=String(q.accessMode||q.AccessMode||'').toLowerCase();
      const name=q.activityName||q.ActivityName||'Activity';
      const nameAr=q.activityNameAr||q.ActivityNameAr||'';
      const label=isAr&&nameAr?nameAr:name;
      const kind=String(q.activityKind||q.ActivityKind||'').toLowerCase();
      const kindLabel=kind==='facility'?(isAr?'مرفق':'Facility'):(isAr?'فصل':'Class');
      const lim=q.quotaLimit!=null?Number(q.quotaLimit):null;
      const used=q.quotaUsed!=null?Number(q.quotaUsed):0;
      const rem=q.quotaRemaining!=null?Number(q.quotaRemaining):null;
      if(mode!=='limited'||lim==null){
        return '<div class="activity-access-row '+escHtml(mode)+'">'+
          '<div class="activity-access-main"><span class="activity-access-icon"><i class="ti ti-'+(kind==='facility'?'building-store':'run')+'"></i></span>'+
          '<span><strong>'+escHtml(label)+'</strong><small>'+escHtml(kindLabel)+'</small></span></div>'+
          '<span class="activity-access-badge '+escHtml(mode)+'">'+escHtml(activityAccessLabel(mode))+'</span></div>';
      }
      const remaining=Math.max(0,rem==null?lim-used:rem);
      const pct=Math.min(100,Math.max(0,Math.round((used/lim)*100)));
      return '<div class="activity-access-row limited">'+
        '<div class="activity-access-top"><div class="activity-access-main"><span class="activity-access-icon"><i class="ti ti-'+(kind==='facility'?'building-store':'run')+'"></i></span>'+
        '<span><strong>'+escHtml(label)+'</strong><small>'+escHtml(kindLabel)+'</small></span></div>'+
        '<div class="activity-access-remaining"><strong>'+remaining+'</strong><span>'+escHtml(isAr?'متبقي':'left')+'</span></div></div>'+
        '<div class="activity-access-progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+lim+'" aria-valuenow="'+used+'"><span style="width:'+pct+'%"></span></div>'+
        '<div class="activity-access-meta"><span>'+used+' '+escHtml(isAr?'مستخدم من':'used of')+' '+lim+'</span><span>'+escHtml(quotaPeriodLabel(q.quotaPeriod||q.QuotaPeriod))+'</span></div></div>';
    }
    const activityAccessHtml='<div class="activity-access-panel">'+
      '<div class="activity-access-header"><div><div class="activity-access-title"><i class="ti ti-chart-donut"></i>'+
      escHtml(isAr?'استخدام الأنشطة':'Activity access')+'</div><div class="activity-access-sub">'+
      escHtml(isAr?'الرصيد محسوب من الحجوزات الفعلية':'Live balance from actual bookings')+'</div></div>'+
      '<span class="activity-access-live"><i class="ti ti-database"></i> Live</span></div>'+
      (activityQuotas.length
        ? '<div class="activity-access-list">'+activityQuotas.map(activityQuotaRow).join('')+'</div>'
        : '<div class="activity-access-empty"><i class="ti ti-info-circle"></i>'+
          escHtml(isAr?'لا توجد أنشطة مضافة لهذه العضوية':'No activity access configured for this membership')+'</div>')+
      '</div>';

    const periodBody=showPeriod?`
      <div class="ms-hero-num">${days} ${t('days left','يوم متبقٍ')}</div>
      <div class="ms-hero-lbl">${t('Ends','تنتهي')} <span dir="ltr">${fmtDate(ms.endDate)}</span></div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${usedPct}%"></div></div>
        <div class="progress-label"><span>${t('Used','مستخدم')} ${used} ${t('of','من')} ${tot} ${t('days','أيام')}</span><span dir="ltr">${fmtDate(ms.startDate)}</span></div>
      </div>`:'';

    const primary=isPending
      ? `<button type="button" class="btn-ms primary" onclick="refreshMembershipStatus()"><i class="ti ti-refresh"></i> ${t('Refresh status','تحديث الحالة')}</button>`
      : (canRenew?`<button type="button" class="btn-ms primary" onclick="openModal('modalRenew')"><i class="ti ti-refresh"></i> ${t('Renew','تجديد')}</button>`:'');
    const renewAnyway=isPending&&canRenew
      ? `<button type="button" class="btn-ms" onclick="openModal('modalRenew')"><i class="ti ti-refresh"></i> ${t('Renew','تجديد')}</button>`:'';
    const assignBtn=canAssign
      ? `<button type="button" class="btn-ms${isPending||canRenew?'':' primary'}" onclick="window.openAssignModal&&window.openAssignModal('${memberId}')"><i class="ti ti-plus"></i> ${t('Assign','تعيين')}</button>`:'';
    const freezeBtn=canFreeze&&!isFrozen&&(st==='active'||st==='scheduled')
      ? `<button type="button" class="btn-ms" onclick="openModal('modalFreeze')"><i class="ti ti-snowflake"></i> ${t('Freeze','تجميد')}</button>`:'';
    const unfreezeBtn=canFreeze&&isFrozen
      ? `<button type="button" class="btn-ms" onclick="unfreeze()"><i class="ti ti-sun"></i> ${t('Unfreeze','إلغاء التجميد')}</button>`:'';
    const canCancel=canMgr&&(st==='active'||st==='frozen'||st==='scheduled'||st==='pending');
    const cancelBtn=canCancel
      ? `<button type="button" class="btn-ms danger" onclick="openCancelMembership()"><i class="ti ti-ban"></i> ${t('Cancel','إلغاء')}</button>`:'';

    container.innerHTML=`
      <div class="ms-hero ${st}">
        <div class="ms-top">
          <div>
            <div class="ms-plan">${escHtml(ms.planName||'')}</div>
            <div class="ms-type">${escHtml((ms.planType||'').replace(/_/g,' '))}</div>
          </div>
          <span class="ms-st-badge ${st}">${membershipStatusLabel(st)}</span>
        </div>
        ${expiredNote}${cancelledNote}${scheduledNote}${accountNote}${pendingBanner}
        ${periodBody}
        <div class="ms-facts">
          <div class="ms-fact">${t('Invitations','الدعوات')}<b id="msInviteVal">${inviteFactText(st)}</b></div>
          <div class="ms-fact">${t('Paid','مدفوع')}<b>${escHtml(fmtEGP(ms.amountPaid)+' · '+pay)}</b></div>
          ${sessionsFact?`<div class="ms-fact">${t('Sessions','الحصص')}<b>${escHtml(sessionsFact)}</b></div>`:''}
          ${ms.frozenUntilDate?`<div class="ms-fact">${t('Hold','إيقاف')}<b dir="ltr">${escHtml(fmtDate(ms.frozenUntilDate))}</b></div>`:''}
        </div>
        <div class="ms-actions">
          ${primary}${renewAnyway}${assignBtn}${freezeBtn}${unfreezeBtn}${cancelBtn}
        </div>
      </div>
      ${activityAccessHtml}`;

    refreshInviteQuota();
  }

  window.refreshMembershipStatus=async function(){
    if(!Gfp||!memberId) return;
    try{
      const r=await Gfp.get('/memberships/'+memberId+'/current');
      if(!r.ok){
        toast(apiErr(r)||'No membership','error');
        return;
      }
      if(memberData) memberData.currentMembership=r.data;
      renderMembership(r.data);
      const pending=r.data&&String(r.data.status||'').toLowerCase()==='pending';
      toast(pending?'Still waiting for payment':'Membership updated', 'success');
      loadHistory();
    }catch(e){ toast('Failed to refresh','error'); }
  };

  function invEsc(s){
    const d=document.createElement('div');
    d.textContent=s==null?'':String(s);
    return d.innerHTML;
  }
  function invStatusLabel(s){
    const map={new:'New',contacted:'Contacted',interested:'Interested',not_interested:'Not Interested',converted:'Converted'};
    return map[String(s||'').toLowerCase()]||s||'—';
  }

  async function loadInvitations360(){
    const tbody=document.getElementById('inv360Tbody');
    const empty=document.getElementById('inv360Empty');
    if(!tbody||!Gfp) return;
    tbody.innerHTML='<tr><td colspan="3" style="color:var(--ltt)">Loading…</td></tr>';
    try{
      const r=await Gfp.get('/invitation/members/'+encodeURIComponent(memberId));
      if(!r.ok){
        tbody.innerHTML='<tr><td colspan="3">Could not load invitations</td></tr>';
        return;
      }
      const payload=r&&r.data&&r.data.quota?r.data:(r&&r.data&&r.data.data)||r.data||{};
      const items=Array.isArray(payload.items)?payload.items:[];
      const set=function(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; };
      set('inv360Total', payload.total||0);
      set('inv360New', payload.new||0);
      set('inv360Contacted', payload.contacted||0);
      set('inv360Interested', payload.interested||0);
      set('inv360Converted', payload.converted||0);
      const quota=payload.quota||{};
      applyInviteQuota(quota);
      const hint=document.getElementById('inv360QuotaHint');
      if(hint){
        const remaining=quota.remaining!=null?quota.remaining:0;
        const total=quota.total!=null?quota.total:0;
        const plan=quota.planName||'';
        hint.textContent=remaining+' of '+total+' invitations left'+(plan?' on '+plan:'')+'.';
      }
      if(!items.length){
        tbody.innerHTML='';
        if(empty) empty.style.display='block';
        return;
      }
      if(empty) empty.style.display='none';
      tbody.innerHTML=items.map(function(row){
        const st=String(row.status||'new').toLowerCase();
        return '<tr><td>'+invEsc(row.name||row.guestName)+'</td><td>'+invEsc(row.phoneNumber||row.guestPhoneNumber)+'</td><td>'+invEsc(invStatusLabel(st))+'</td></tr>';
      }).join('');
    }catch(e){
      tbody.innerHTML='<tr><td colspan="3">Could not load invitations</td></tr>';
    }
  }

  const inv360Form=document.getElementById('inv360Form');
  if(inv360Form){
    inv360Form.addEventListener('submit', async function(e){
      e.preventDefault();
      if(!Gfp){ toast('API client missing — hard-refresh','error'); return; }
      const name=(document.getElementById('inv360Name').value||'').trim();
      const phone=(document.getElementById('inv360Phone').value||'').trim();
      const nid=(document.getElementById('inv360Nid').value||'').trim();
      const notes=(document.getElementById('inv360Notes').value||'').trim();
      if(!name){ toast('Friend’s name is required','error'); return; }
      if(!phone){ toast('Phone is required','error'); return; }
      if(nid && nid.length!==14){ toast('National ID must be 14 digits','error'); return; }
      const btn=document.getElementById('btnInv360Create');
      if(btn) btn.disabled=true;
      try{
        const r=await Gfp.post('/invitation/members/'+encodeURIComponent(memberId),{
          name:name,
          phoneNumber:phone,
          nationalId:nid||null,
          notes:notes||null
        });
        if(!r.ok){
          toast(apiErr(r)||'Could not create invitation','error');
          return;
        }
        const data=r.data||{};
        toast(data.alreadyExisted?'Invitation already exists':'Invitation created','success');
        document.getElementById('inv360Name').value='';
        document.getElementById('inv360Phone').value='';
        document.getElementById('inv360Nid').value='';
        document.getElementById('inv360Notes').value='';
        window._invLoaded=true;
        await loadInvitations360();
      }finally{
        if(btn) btn.disabled=false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Member Orders — GET /api/members/{id}/orders (fallback: /member-orders?memberId=)
  // ═══════════════════════════════════════════════════════════════
  async function loadMemberOrders(){
    const tbody=document.getElementById('ordersTbody');
    const empty=document.getElementById('ordersEmpty');
    const table=tbody&&tbody.closest('table');
    if(!tbody) return;
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--ltt)">Loading…</td></tr>';
    if(empty) empty.style.display='none';
    if(table) table.style.display='';
    if(!Gfp){
      tbody.innerHTML='';
      if(table) table.style.display='none';
      if(empty){ empty.style.display='flex'; empty.querySelector('p').textContent='Unable to load member orders'; }
      return;
    }
    const Mo=window.GfpMemberOrdersApi;
    try{
      let r=null;
      if(Mo&&Mo.paths&&Mo.paths.memberOrders){
        r=await Gfp.get(Mo.paths.memberOrders(memberId,{page:1,pageSize:20}));
      }
      if(!r||r.status===404){
        r=await Gfp.get('/member-orders?memberId='+encodeURIComponent(memberId)+'&page=1&pageSize=20');
      }
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(!r.ok){
        tbody.innerHTML='';
        if(table) table.style.display='none';
        if(empty){
          empty.style.display='flex';
          empty.querySelector('p').textContent=apiErr(r)||'Unable to load member orders';
        }
        return;
      }
      const paged=Mo&&Mo.extractPaged?Mo.extractPaged(r.data):{items:(r.data&&r.data.items)||(Array.isArray(r.data)?r.data:[])};
      // Defense-in-depth: only show this member's orders (API should already filter by memberId).
      const mid=String(memberId||'');
      const items=(paged.items||[]).map(function(raw){ return Mo&&Mo.normalizeOrder?Mo.normalizeOrder(raw):raw; }).filter(function(o){
        if(!o) return false;
        if(!mid) return true;
        const oid=o.memberId!=null?String(o.memberId):(o.MemberId!=null?String(o.MemberId):'');
        return !oid||oid===mid;
      });
      if(!items.length){
        tbody.innerHTML='';
        if(table) table.style.display='none';
        if(empty){ empty.style.display='flex'; empty.querySelector('p').textContent=t('No member orders yet','لا توجد طلبات بعد'); }
        return;
      }
      if(table) table.style.display='';
      if(empty) empty.style.display='none';
      tbody.innerHTML=items.map(function(o){
        const num=o.orderNumber!=null?('#'+o.orderNumber):(o.id||'').slice(0,8);
        const loc=(window.GfpI18n&&window.GfpI18n.getLocale&&window.GfpI18n.getLocale()==='ar')?'ar-EG':'en-EG';
        const total=o.total!=null?Number(o.total).toLocaleString(loc,{style:'currency',currency:o.currency||'EGP'}):'—';
        const st=o.status||'—';
        return '<tr>'+
          '<td dir="ltr"><strong>'+escHtml(num)+'</strong></td>'+
          '<td dir="ltr"><strong>'+escHtml(total)+'</strong></td>'+
          '<td>'+escHtml(st)+'</td>'+
          '<td dir="ltr">'+escHtml(o.createdAt?fmtDate(o.createdAt):'—')+'</td>'+
          '<td><a class="btn secondary" style="height:30px;padding:0 8px;font-size:12px" href="/dashboard/member-orders/?orderId='+encodeURIComponent(o.id||'')+'">'+t('View','عرض')+'</a></td>'+
          '</tr>';
      }).join('');
    }catch(e){
      tbody.innerHTML='';
      if(table) table.style.display='none';
      if(empty){ empty.style.display='flex'; empty.querySelector('p').textContent=t('Unable to load member orders','تعذّر تحميل الطلبات'); }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Attendance — GET /api/members/{id}/attendance
  // ═══════════════════════════════════════════════════════════════
  async function loadAttendance(){
    // Prefer embedded recentAttendance from detail until full page loads
    if(memberData&&Array.isArray(memberData.recentAttendance)&&memberData.recentAttendance.length&&!window._attFull){
      renderAttendance(memberData.recentAttendance.slice(0,5));
    }
    if(!Gfp){renderAttendance([]);return;}
    try{
      const r=await Gfp.get('/members/'+memberId+'/attendance?page=1&pageSize=20');
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(!r.ok){
        if(!(memberData&&memberData.recentAttendance&&memberData.recentAttendance.length)){
          renderAttendance([]);
          toast(apiErr(r),'error');
        }
        return;
      }
      window._attFull=true;
      const d=r.data;
      const items=Array.isArray(d)?d:(d&&d.items)||[];
      renderAttendance(items);
    }catch(e){
      if(!(memberData&&memberData.recentAttendance&&memberData.recentAttendance.length)) renderAttendance([]);
    }
  }

  function renderAttendance(data){
    renderHeatmap(data);
    const tbody=document.getElementById('attTbody');
    const table=tbody&&tbody.closest('table');
    const empty=document.getElementById('attEmpty');
    if(!data.length){
      if(table) table.style.display='none';
      if(empty) empty.style.display='flex';
      return;
    }
    if(table) table.style.display='';
    if(empty) empty.style.display='none';
    tbody.innerHTML=data.map(a=>{
      const method=(a.entryMethod||'').toLowerCase();
      const icon=method==='qr'?'qrcode':(method==='barcode'||method==='card')?'barcode':'user-check';
      return `
      <tr>
        <td dir="ltr">${fmtDate(a.checkInAtUtc)}</td>
        <td dir="ltr">${fmtTime(a.checkInAtUtc)}</td>
        <td dir="ltr">${a.checkOutAtUtc?fmtTime(a.checkOutAtUtc):'<span style="color:var(--ltt)">—</span>'}</td>
        <td><span class="method-badge ${escHtml(method)}"><i class="ti ti-${icon}"></i>${entryMethodLabel(a.entryMethod)}</span></td>
        <td dir="ltr">${calcDuration(a.checkInAtUtc,a.checkOutAtUtc)}</td>
      </tr>`;
    }).join('');
  }

  function renderHeatmap(data){
    const attDays=new Set(data.map(a=>new Date(a.checkInAtUtc).toDateString()));
    const wrap=document.getElementById('heatmap');
    wrap.innerHTML='';
    const today=new Date();
    // 12 weeks = 84 days back
    const start=new Date(today);
    start.setDate(start.getDate()-83);
    // Align to Sunday
    start.setDate(start.getDate()-start.getDay());
    let cur=new Date(start);
    for(let w=0;w<12;w++){
      const col=document.createElement('div');
      col.className='hm-week';
      for(let d=0;d<7;d++){
        const cell=document.createElement('div');
        const present=attDays.has(cur.toDateString());
        cell.className='hm-day'+(present?' l3':'');
        cell.title=cur.toDateString()+(present?' — Present':'');
        col.appendChild(cell);
        cur.setDate(cur.getDate()+1);
      }
      wrap.appendChild(col);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Membership History — GET /api/memberships/{memberId}/history
  // ═══════════════════════════════════════════════════════════════
  let histPage=1;
  let histHasNext=false;
  let histItems=[];

  async function loadHistory(append){
    if(!Gfp){renderHistory([]);return;}
    if(!append){ histPage=1; histItems=[]; }
    try{
      const r=await Gfp.get('/memberships/'+memberId+'/history?page='+histPage+'&pageSize=20');
      if(r.status===401){window.location.href='/auth/login/';return;}
      if(!r.ok){ if(!append) renderHistory([]); return; }
      const d=r.data;
      const items=Array.isArray(d)?d:(d&&d.items)||[];
      histHasNext=!!(d&&(d.hasNext||(d.page!=null&&d.totalPages!=null&&d.page<d.totalPages)));
      if(append) histItems=histItems.concat(items);
      else histItems=items;
      renderHistory(histItems);
    }catch(e){ if(!append) renderHistory([]); }
  }

  function renderHistory(data){
    const wrap=document.getElementById('histTimeline');
    if(!data.length){wrap.innerHTML='<div class="no-data"><i class="ti ti-history"></i><p>No membership history</p></div>';return;}
    wrap.innerHTML=data.map((h,i)=>`
      <div class="tl-item">
        <div class="tl-line">
          <div class="tl-dot ${h.status}"></div>
          ${i<data.length-1?'<div class="tl-connector"></div>':''}
        </div>
        <div class="tl-body">
          <div class="tl-plan">${h.planName}</div>
          <div class="tl-dates">${fmtDate(h.startDate)} → ${fmtDate(h.endDate)}</div>
          <div class="tl-meta">
            <span class="tl-badge ${h.status}">${h.status}</span>
            <span class="tl-amount">${fmtEGP(h.amountPaid)} · ${h.paymentMethod||''}</span>
          </div>
        </div>
      </div>`).join('')+(histHasNext
        ?`<div style="text-align:center;margin-top:12px"><button class="btn-ms" type="button" id="btnHistMore">Load more</button></div>`
        :'');
    const more=document.getElementById('btnHistMore');
    if(more) more.addEventListener('click',function(){ histPage++; loadHistory(true); });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Actions — Renew / Freeze / Unfreeze / Assign (Member 360)
  // ═══════════════════════════════════════════════════════════════
  window.openModal=openModal;
  window.closeModal=closeModal;

  window.openCancelMembership=function(){
    const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;
    if(!canMgr){ toast('Manager or above required','error'); return; }
    const ms=memberData&&memberData.currentMembership;
    const st=String(ms&&ms.status||'').toLowerCase();
    if(!ms||!(st==='active'||st==='frozen'||st==='scheduled'||st==='pending')){
      toast('Nothing to cancel','error');
      return;
    }
    const nameEl=document.getElementById('cancelMsPlan');
    if(nameEl) nameEl.textContent=ms.planName||'This plan';
    const err=document.getElementById('cancelMsError');
    if(err) err.classList.remove('show');
    openModal('modalCancelMs');
  };

  const btnConfirmCancelMs=document.getElementById('btnConfirmCancelMs');
  if(btnConfirmCancelMs){
    btnConfirmCancelMs.addEventListener('click',async function(e){
      e.preventDefault();
      const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;
      if(!canMgr){ toast('Manager or above required','error'); return; }
      if(!Gfp||!memberId) return;
      const err=document.getElementById('cancelMsError');
      if(err) err.classList.remove('show');
      btnConfirmCancelMs.disabled=true;
      try{
        const r=await Gfp.post('/memberships/'+memberId+'/cancel',{});
        if(r.ok){
          closeModal('modalCancelMs');
          toast('Membership cancelled');
          loadMember();
          loadHistory();
          return;
        }
        const msg=apiErr(r)||'Could not cancel membership';
        if(err){
          const te=err.querySelector('.error-text');
          if(te) te.textContent=msg;
          err.classList.add('show');
        }
        toast(msg,'error');
      }finally{
        btnConfirmCancelMs.disabled=false;
      }
    });
  }

  window.unfreeze=async function(){
    if(!canFreeze){ toast('memberships.freeze permission required','error'); return; }
    if(!Gfp||!memberId) return;
    if(!confirm('Unfreeze membership?')) return;
    const r=await Gfp.post('/members/'+memberId+'/unfreeze',{});
    if(r.ok){ toast('Unfrozen'); loadMember(); loadHistory(); }
    else toast(apiErr(r)||'Failed to unfreeze','error');
  };

  const btnFreezeEl=document.getElementById('btnFreeze');
  if(btnFreezeEl){
    btnFreezeEl.addEventListener('click',async function(e){
      e.preventDefault();
      if(!canFreeze){ toast('memberships.freeze permission required','error'); return; }
      const until=document.getElementById('freezeUntil');
      const reason=document.getElementById('freezeReason');
      if(!until||!until.value){ toast('Select freeze until date','error'); return; }
      const r=await Gfp.post('/members/'+memberId+'/freeze',{
        frozenUntil: until.value+'T00:00:00',
        reason:(reason&&reason.value)||null
      });
      if(r.ok){ closeModal('modalFreeze'); toast('Membership frozen'); loadMember(); loadHistory(); }
      else toast(apiErr(r)||'Failed to freeze','error');
    });
  }

  // Deactivate confirm — must type exact "Delete" before confirm is enabled
  const DEACTIVATE_CONFIRM_WORD='Delete';
  const deactivateConfirmInput=document.getElementById('deactivateConfirmInput');
  const btnConfirmDeactivate=document.getElementById('btnConfirmDeactivate');

  function syncDeactivateConfirmBtn(){
    if(!btnConfirmDeactivate) return;
    const typed=(deactivateConfirmInput&&deactivateConfirmInput.value||'').trim();
    btnConfirmDeactivate.disabled=typed!==DEACTIVATE_CONFIRM_WORD;
  }

  function openDeactivateConfirmModal(){
    const name=(memberData&&memberData.fullName)||t('Member','العضو');
    document.getElementById('deactivateModalTitle').textContent=t('Deactivate','إلغاء تفعيل')+' '+name+'?';
    if(deactivateConfirmInput){
      deactivateConfirmInput.value='';
      deactivateConfirmInput.focus();
    }
    syncDeactivateConfirmBtn();
    openModal('modalDeactivate');
    // Focus after open so the field is usable immediately
    setTimeout(function(){ if(deactivateConfirmInput) deactivateConfirmInput.focus(); }, 50);
  }

  if(deactivateConfirmInput){
    deactivateConfirmInput.addEventListener('input',syncDeactivateConfirmBtn);
    deactivateConfirmInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&btnConfirmDeactivate&&!btnConfirmDeactivate.disabled){
        e.preventDefault();
        btnConfirmDeactivate.click();
      }
    });
  }

  // Status toggle — account IsActive only (OwnerOnly). Independent of membership plan.
  document.getElementById('statusToggle').addEventListener('change',async function(){
    if(!isOwner){
      this.checked=!!(memberData&&memberData.isActive);
      toast('Only Owners can change account active status','error');
      return;
    }
    const wantActive=this.checked;
    if(!wantActive){
      this.checked=true; // revert until confirm
      openDeactivateConfirmModal();
      return;
    }
    // Reactivate account — never requires assigning a new plan.
    this.checked=false;
    if(!Gfp||!memberData) return;
    const r=await Gfp.post('/members/'+memberData.id+'/reactivate',{});
    if(r.ok){
      toast('Account reactivated');
      loadMember();
      if(typeof window.loadMembers==='function') window.loadMembers();
    } else {
      toast(apiErr(r)||'Failed to reactivate','error');
    }
  });

  btnConfirmDeactivate.addEventListener('click',async function(){
    if(!isOwner){toast('Only Owners can deactivate members','error');return;}
    if(!Gfp||!memberData) return;
    const typed=(deactivateConfirmInput&&deactivateConfirmInput.value||'').trim();
    if(typed!==DEACTIVATE_CONFIRM_WORD){
      toast(t('Type Delete to confirm','اكتب Delete للتأكيد'),'error');
      syncDeactivateConfirmBtn();
      if(deactivateConfirmInput) deactivateConfirmInput.focus();
      return;
    }
    this.disabled=true;
    const r=await Gfp.del('/members/'+memberData.id);
    if(r.ok){
      closeModal('modalDeactivate');
      if(deactivateConfirmInput) deactivateConfirmInput.value='';
      syncDeactivateConfirmBtn();
      toast('Member account deactivated (membership unchanged)');
      loadMember();
      if(typeof window.loadMembers==='function') window.loadMembers();
      if(typeof window.loadStats==='function') window.loadStats();
    } else {
      toast(apiErr(r)||'Failed to deactivate','error');
      syncDeactivateConfirmBtn();
    }
  });

  document.getElementById('btnDeactivate').addEventListener('click',async function(){
    if(!isOwner){toast('Only Owners can change account status','error');return;}
    if(!memberData) return;
    if(memberData.isActive){
      openDeactivateConfirmModal();
      return;
    }
    if(!Gfp) return;
    const r=await Gfp.post('/members/'+memberData.id+'/reactivate',{});
    if(r.ok){
      toast('Account reactivated');
      loadMember();
      if(typeof window.loadMembers==='function') window.loadMembers();
    } else toast(apiErr(r)||'Failed to reactivate','error');
  });

  // Send Notification
  document.getElementById('btnNotify').addEventListener('click',function(){
    if(!memberData) return;
    document.getElementById('notifMemberName').textContent=memberData.fullName;
    openModal('modalNotify');
  });

  document.getElementById('btnSendNotif').addEventListener('click',async function(){
    const title=document.getElementById('notifTitle').value;
    const body=document.getElementById('notifBody').value;
    if(!title||!body){toast('Please fill in title and message','error');return;}
    try{
      const res=await fetch(`${API_BASE}/notifications/send-bulk`,{
        method:'POST',headers:getAuthHeaders(),
        body:JSON.stringify({memberIds:[memberData.id],title,body})
      });
      if(res.ok){closeModal('modalNotify');toast('Notification sent successfully');}
      else toast('Failed to send notification','error');
    }catch(e){toast('Failed to send notification','error');}
  });

  // Edit button — members.edit
  document.getElementById('btnEdit').addEventListener('click',function(){
    if(!canEdit){toast('Missing members.edit permission','error');return;}
    if(memberData && window.openEditDrawer) window.openEditDrawer(memberData);
  });
  const btnEdit2=document.getElementById('btnEdit2');
  if(btnEdit2){
    btnEdit2.addEventListener('click',function(){
      if(!canEdit){toast('Missing members.edit permission','error');return;}
      if(memberData && window.openEditDrawer) window.openEditDrawer(memberData);
    });
  }

  // Renew — POST /api/memberships/{id}/renew (ManagerOrAbove; transitionMode)
  let renewMode='same';
  let renewTransition='cancel_and_switch';
  let renewRollover=false;
  let renewPlansCache=[];

  function membershipCoversToday(ms){
    if(!ms) return false;
    const st=String(ms.status||'').toLowerCase();
    if(st!=='active'&&st!=='frozen') return false;
    const end=String(ms.endDate||'').slice(0,10);
    if(!end) return false;
    const now=new Date();
    const t=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    return end>=t;
  }

  function parseDateOnly(d){
    const s=String(d||'').slice(0,10).split('-');
    if(s.length!==3) return null;
    return new Date(Number(s[0]),Number(s[1])-1,Number(s[2]));
  }

  function addDaysLocal(date,days){
    const x=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    x.setDate(x.getDate()+days);
    return x;
  }

  function getRenewTransitionMode(){
    const ms=memberData&&memberData.currentMembership;
    if(!membershipCoversToday(ms)) return 'cancel_and_switch';
    if(renewRollover) return 'manual_rollover';
    return renewTransition==='queue_next'?'queue_next':'cancel_and_switch';
  }

  function resolveRenewDuration(){
    if(renewMode==='diff'){
      const sel=document.getElementById('renewPlanSelect');
      const id=sel&&sel.value;
      const p=renewPlansCache.find(function(x){return x.id===id;});
      if(p&&p.durationDays!=null) return Number(p.durationDays)||0;
    }
    const ms=memberData&&memberData.currentMembership;
    const s=parseDateOnly(ms&&ms.startDate);
    const e=parseDateOnly(ms&&ms.endDate);
    if(s&&e){
      const days=Math.round((e-s)/86400000);
      if(days>0) return days;
    }
    return 30;
  }

  function updateRenewTransitionUi(){
    const ms=memberData&&memberData.currentMembership;
    const wrap=document.getElementById('renewTransitionWrap');
    const banner=document.getElementById('renewModeBanner');
    const preview=document.getElementById('renewPreview');
    const covering=membershipCoversToday(ms);
    if(wrap) wrap.style.display=covering?'block':'none';
    if(!banner||!preview) return;
    if(!covering){
      banner.textContent=t('No covering membership — new plan starts today for a full duration.','مفيش عضوية سارية — الخطة الجديدة تبدأ النهاردة لمدة كاملة.');
      preview.textContent='';
      return;
    }
    const mode=getRenewTransitionMode();
    const duration=resolveRenewDuration();
    const today=new Date(); today.setHours(0,0,0,0);
    const priorEnd=parseDateOnly(ms.endDate)||today;
    let start=today, end=addDaysLocal(today,duration), copy='';
    if(mode==='queue_next'){
      start=addDaysLocal(priorEnd,1);
      end=addDaysLocal(start,duration);
      copy=t('Queue next plan — current stays active until it ends; new plan starts after.','حجز الخطة الجاية — الخطة الحالية تفضل شغالة لحد ما تنتهي؛ الخطة الجديدة تبدأ بعدها.');
    } else if(mode==='manual_rollover'){
      end=addDaysLocal(priorEnd,duration);
      copy=t('Add remaining days onto the new plan (legacy rollover).','إضافة الأيام المتبقية على الخطة الجديدة (ترحيل قديم).');
    } else {
      copy=t('Cancel & switch — current ends today; new plan starts today.','إلغاء والتبديل — الخطة الحالية تنتهي النهاردة؛ الخطة الجديدة تبدأ النهاردة.');
    }
    banner.textContent=copy;
    preview.innerHTML=t('Estimated: ','التقدير: ')+'<span dir="ltr">'+escHtml(fmtDate(start))+'</span> → <span dir="ltr">'+escHtml(fmtDate(end))+'</span> '+t('(server confirms).','(السيرفر يؤكد).');

    const cancelBtn=document.getElementById('renewTransCancel');
    const queueBtn=document.getElementById('renewTransQueue');
    if(cancelBtn) cancelBtn.className=!renewRollover&&renewTransition==='cancel_and_switch'?'btn-ms primary':'btn-ms';
    if(queueBtn) queueBtn.className=!renewRollover&&renewTransition==='queue_next'?'btn-ms primary':'btn-ms';
  }

  function setRenewMode(mode){
    renewMode=mode;
    const same=document.getElementById('renewModeSame');
    const diff=document.getElementById('renewModeDiff');
    const sel=document.getElementById('renewPlanSelect');
    if(same) same.className=mode==='same'?'btn-ms primary':'btn-ms';
    if(diff) diff.className=mode==='diff'?'btn-ms primary':'btn-ms';
    if(sel) sel.style.display=mode==='diff'?'block':'none';
    updateRenewTransitionUi();
  }
  async function loadRenewPlans(){
    const sel=document.getElementById('renewPlanSelect');
    if(!sel||!Gfp) return;
    try{
      const r=await Gfp.get('/membership-plans');
      if(!r.ok){ sel.innerHTML='<option value="">'+escHtml(t('Cannot load plans (needs plans.manage)','تعذّر تحميل الباقات (يلزم plans.manage)'))+'</option>'; return; }
      renewPlansCache=(Array.isArray(r.data)?r.data:[]).filter(p=>p&&p.isActive!==false);
      sel.innerHTML='<option value="" data-en="— Select a plan —" data-ar="— اختر خطة —">'+escHtml(t('— Select a plan —','— اختر خطة —'))+'</option>'+renewPlansCache.map(p=>
        `<option value="${p.id}">${escHtml(p.name)} — EGP ${p.price||0} (${p.durationDays||0}${t('d','ي')})</option>`
      ).join('');
    }catch(e){
      sel.innerHTML='<option value="">'+escHtml(t('Failed to load plans','فشل تحميل الباقات'))+'</option>';
    }
  }
  const renewModeSame=document.getElementById('renewModeSame');
  const renewModeDiff=document.getElementById('renewModeDiff');
  if(renewModeSame) renewModeSame.addEventListener('click',function(){ setRenewMode('same'); });
  if(renewModeDiff) renewModeDiff.addEventListener('click',function(){ setRenewMode('diff'); loadRenewPlans(); });
  setRenewMode('same');

  const renewTransCancel=document.getElementById('renewTransCancel');
  const renewTransQueue=document.getElementById('renewTransQueue');
  const renewRolloverEl=document.getElementById('renewRollover');
  if(renewTransCancel) renewTransCancel.addEventListener('click',function(){
    renewRollover=false;
    if(renewRolloverEl) renewRolloverEl.checked=false;
    renewTransition='cancel_and_switch';
    updateRenewTransitionUi();
  });
  if(renewTransQueue) renewTransQueue.addEventListener('click',function(){
    renewRollover=false;
    if(renewRolloverEl) renewRolloverEl.checked=false;
    renewTransition='queue_next';
    updateRenewTransitionUi();
  });
  if(renewRolloverEl) renewRolloverEl.addEventListener('change',function(){
    renewRollover=!!renewRolloverEl.checked;
    updateRenewTransitionUi();
  });
  const renewPlanSel=document.getElementById('renewPlanSelect');
  if(renewPlanSel) renewPlanSel.addEventListener('change',updateRenewTransitionUi);

  function updateRenewHint(){
    const pay=document.getElementById('renewPayment');
    const hint=document.getElementById('renewPayHint');
    if(!pay||!hint) return;
    hint.textContent=pay.value==='cash'
      ?t('Cash activates immediately and posts to your open shift.','النقد بيتفعّل فورًا وبيتسجّل على الوردية المفتوحة.')
      :t('Gateway: membership stays pending until webhook — refresh status after payment (no live push).','بوابة الدفع: العضوية تفضل قيد الانتظار لحد التأكيد — حدّث الحالة بعد الدفع (مفيش تحديث لحظي).');
  }
  const renewPayEl=document.getElementById('renewPayment');
  if(renewPayEl) renewPayEl.addEventListener('change',updateRenewHint);
  updateRenewHint();

  const btnDoRenew=document.getElementById('btnDoRenew');
  if(btnDoRenew){
    btnDoRenew.addEventListener('click',async function(e){
      e.preventDefault();
      const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;
      if(!canMgr){ toast(t('Manager or above required','يلزم مدير أو أعلى'),'error'); return; }
      if(!Gfp||!memberId) return;
      const payEl=document.getElementById('renewPayment');
      const amtEl=document.getElementById('renewAmount');
      const errBanner=document.getElementById('renewErrorBanner');
      const payMethod=payEl?payEl.value:'cash';
      const amountPaid=amtEl?parseFloat(amtEl.value)||0:0;
      const body={
        planId: renewMode==='diff'?(document.getElementById('renewPlanSelect')||{}).value||null:null,
        paymentMethod: payMethod,
        amountPaid: amountPaid,
        transitionMode: getRenewTransitionMode()
      };
      if(renewMode==='diff'&&!body.planId){
        if(errBanner){ errBanner.style.display='flex'; errBanner.querySelector('.error-text').textContent=t('Select a plan','اختر خطة'); }
        return;
      }
      btnDoRenew.disabled=true;
      try{
        if(payMethod==='cash'&&amountPaid>0){
          const sh=await Gfp.get('/shifts/current');
          if(!sh.ok||!sh.data||!sh.data.id){
            if(errBanner){
              errBanner.style.display='flex';
              errBanner.querySelector('.error-text').innerHTML=t('Open a cash shift first, then complete this payment.','افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.') +
                ' <a href="/dashboard/shifts/">'+t('Open shift','افتح الوردية')+'</a>';
            }
            btnDoRenew.disabled=false;
            return;
          }
        }
        const r=await Gfp.post('/memberships/'+memberId+'/renew', body);
        if(r.ok){
          closeModal('modalRenew');
          const pending=r.data&&String(r.data.status||'').toLowerCase()==='pending';
          toast(pending?t('Renewed — waiting for payment. Use Refresh status.','تم التجديد — في انتظار الدفع. استخدم تحديث الحالة.'):t('Renewed','تم التجديد'));
          loadMember();
          loadHistory();
        } else {
          if(errBanner){ errBanner.style.display='flex'; errBanner.querySelector('.error-text').textContent=apiErr(r)||t('Renew failed','فشل التجديد'); }
          toast(apiErr(r)||t('Renew failed','فشل التجديد'),'error');
        }
      }catch(err){
        toast(t('Network error','خطأ في الشبكة'),'error');
      }
      btnDoRenew.disabled=false;
    });
  }

  // Refresh renew chrome when opening / locale switches
  (function wireRenewOpenLocale(){
    const prev=window.openModal;
    window.openModal=function(id){
      if(typeof prev==='function') prev(id);
      else {
        const el=document.getElementById(id);
        if(el) el.classList.add('open');
      }
      if(id==='modalRenew'){
        updateRenewTransitionUi();
        updateRenewHint();
        applyLocaleBits(document.getElementById('modalRenew'));
      }
    };
  })();

  window.addEventListener('gfp:locale',function(){
    updateRenewTransitionUi();
    updateRenewHint();
    applyLocaleBits(document.getElementById('modalRenew'));
    if(renewMode==='diff' && renewPlansCache.length){
      const sel=document.getElementById('renewPlanSelect');
      const cur=sel&&sel.value;
      if(sel){
        sel.innerHTML='<option value="" data-en="— Select a plan —" data-ar="— اختر خطة —">'+escHtml(t('— Select a plan —','— اختر خطة —'))+'</option>'+renewPlansCache.map(p=>
          `<option value="${p.id}">${escHtml(p.name)} — EGP ${p.price||0} (${p.durationDays||0}${t('d','ي')})</option>`
        ).join('');
        if(cur) sel.value=cur;
      }
    }
  });

  // ── Init ──
  window.loadMember = loadMember;
  loadMember();

  // Gym names — any-auth gym-code preferred over OwnerOnly settings
  async function loadTenant(){
    if(!Gfp) return;
    try{
      const r=await Gfp.get('/settings/gym-code');
      // Keep existing gym labels if Owner settings already loaded elsewhere
      if(r.ok&&r.data&&r.data.gymCode){
        /* gym code available for context; names still from token/user if needed */
      }
    }catch(e){}
  }
  loadTenant();
})();
