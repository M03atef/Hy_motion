// ═══════════════════════════════════════════════════════════════
//  Member Modals — Add Member, Edit Member Drawer, Assign Membership
//  API: POST /api/members, PUT /api/members/{id}, POST /api/memberships/{id}/assign
// ═══════════════════════════════════════════════════════════════
(function(){
  const Gfp = window.GfpApi;
  const Authz = window.GfpAuthz;
  // Local Edition has no online payment gateways — hide those radio options wherever they appear
  // (member onboarding, membership assign) instead of duplicating an edition check per form.
  if (window.GfpDeployment) window.GfpDeployment.hideOnlineGatewayRadios();
  function canCreate(){ return Authz ? Authz.useCan('members.create') : !!window.__gfpCanCreateMember; }
  function canEdit(){ return Authz ? Authz.useCan('members.edit') : !!window.__gfpCanEditMember; }
  function apiMsg(r, fallback){
    if(window.GfpI18n&&window.GfpI18n.displayApiError){
      const m=window.GfpI18n.displayApiError(r);
      if(m) return m;
    }
    // ASP.NET FluentValidation ProblemDetails: { errors: { Phone: ["..."], DateOfBirth: ["..."] } }
    const errs=(r&&r.data&&r.data.errors)
      ||(r&&r.error&&r.error.errors)
      ||(r&&r.error&&r.error.raw&&r.error.raw.errors);
    if(errs&&typeof errs==='object'){
      const parts=[];
      Object.keys(errs).forEach(k=>{
        const v=errs[k];
        if(Array.isArray(v)) parts.push.apply(parts,v);
        else if(v) parts.push(String(v));
      });
      if(parts.length) return parts.join(' · ');
    }
    return (r&&r.error&&r.error.message)||(r&&r.data&&r.data.title)||fallback;
  }

  function maxDobIso(){
    const d=new Date();
    d.setFullYear(d.getFullYear()-10);
    return d.toISOString().slice(0,10);
  }
  function validateDob(val){
    if(!val) return false;
    return val<=maxDobIso();
  }

  // ── Toast helper ──
  function toast(msg,type='success'){
    return globalThis.toastShared(msg, type);
  }

  // ── Phone validation (Egyptian) ──
  // UI shows local 01x…; API stores canonical +20XXXXXXXXXX (no leading 0 after +20).
  function validatePhone(val){
    const clean=val.replace(/[\s\-()]/g,'');
    // Local 01x… (11) or national without leading 0 (10) or full +20… / 20…
    return /^(010|011|012|015)\d{8}$/.test(clean)
      || /^(10|11|12|15)\d{8}$/.test(clean)
      || /^\+?20(10|11|12|15)\d{8}$/.test(clean);
  }
  function formatPhoneForApi(val){
    let clean=val.replace(/[\s\-()]/g,'');
    if(clean.startsWith('+')) clean=clean.slice(1);
    if(clean.startsWith('00')) clean=clean.slice(2);
    if(clean.startsWith('20') && clean.length===12) return '+'+clean;
    if(clean.startsWith('0') && clean.length===11) clean=clean.slice(1);
    return '+20'+clean;
  }
  /** Display phone in the +20-prefixed input (local 01x… preferred). */
  function phoneToLocalInput(apiPhone){
    let p=(apiPhone||'').replace(/[\s\-()]/g,'');
    if(p.startsWith('+20')) p=p.slice(3);
    else if(p.startsWith('20')&&p.length===12) p=p.slice(2);
    if(/^(10|11|12|15)\d{8}$/.test(p)) return '0'+p;
    return p;
  }

  // Compat for remaining non-§2 calls (assign uses memberships API)
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
  function getAuthHeaders(){
    const t=(Gfp&&Gfp.tokens?Gfp.tokens.getAccess():null)||localStorage.getItem('gfp_access_token')||sessionStorage.getItem('gfp_access_token');
    const h={'Content-Type':'application/json'};
    if(t) h['Authorization']='Bearer '+t;
    return h;
  }

  // ══════════════════════════════════════════════════════════════
  //  1. ADD MEMBER ONBOARDING (Info → Membership → Payment → Done)
  // ══════════════════════════════════════════════════════════════
  function initAddMemberModal(){
    const overlay=document.getElementById('addMemberModal');
    if(!overlay) return;
    const form={
      nameEn: overlay.querySelector('#addNameEn'),
      nameAr: overlay.querySelector('#addNameAr'),
      phone:  overlay.querySelector('#addPhone'),
      dob:    overlay.querySelector('#addDob'),
      email:  overlay.querySelector('#addEmail'),
      nationalId: overlay.querySelector('#addNationalId'),
      emergency:  overlay.querySelector('#addEmergency'),
      notes:  overlay.querySelector('#addNotes'),
      referralCode: overlay.querySelector('#addReferralCode'),
    };
    const btnCreate=overlay.querySelector('#btnCreateMember');
    const errorBanner=overlay.querySelector('#addErrorBanner');
    const phoneWrap=overlay.querySelector('#addPhoneWrap');
    let onboardStep=1;
    let createdMember=null;
    let selectedPlan=null;
    let onboardPlans=[];
    let onboardSale=null;
    let onboardInvoiceId=null;
    let onboardInvoiceNumber=null;

    function setOnboardStep(step){
      onboardStep=step;
      ['1','2','3','4'].forEach(function(s){
        const el=overlay.querySelector('#onboardStep'+s);
        if(el) el.style.display=String(step)===s?'':'none';
      });
      overlay.querySelectorAll('.ob-step').forEach(function(chip){
        const act=Number(chip.getAttribute('data-step'))===step;
        chip.style.background=act?'var(--l100)':'var(--ls2)';
        chip.style.color=act?'var(--l600)':'var(--ltt)';
      });
      const btnSkip=overlay.querySelector('#btnOnboardSkip');
      const btnView=overlay.querySelector('#btnOnboardViewMember');
      const btnCancel=overlay.querySelector('#btnOnboardCancel');
      const btnDone=overlay.querySelector('#btnOnboardDone');
      const label=btnCreate&&btnCreate.querySelector('.btn-label');
      if(btnSkip) btnSkip.style.display=(step===2)?'':'none';
      if(btnView) btnView.style.display=(step===4)?'inline-flex':'none';
      if(btnDone) btnDone.style.display=(step===4)?'':'none';
      if(btnCreate) btnCreate.style.display=(step===4)?'none':'';
      if(btnCancel) btnCancel.style.display=(step===4)?'none':'';
      if(label){
        if(step===1) label.innerHTML='<i class="ti ti-arrow-right"></i> '+window.GfpI18n.tLabel('Continue','متابعة');
        else if(step===2) label.innerHTML='<i class="ti ti-arrow-right"></i> '+window.GfpI18n.tLabel('Continue','متابعة');
        else if(step===3) label.innerHTML='<i class="ti ti-check"></i> '+window.GfpI18n.tLabel('Complete payment','إتمام الدفع');
      }
      if(btnCreate) btnCreate.disabled=step===1?!validateAddForm():(step===2?!selectedPlan:false);
    }

    function onboardApiBase(){
      return (window.API_BASE || API_BASE || '').replace(/\/$/,'');
    }
    async function onboardFetchHtml(path){
      const token=(Gfp&&Gfp.tokens?Gfp.tokens.getAccess():null)
        ||localStorage.getItem('gfp_access_token')||sessionStorage.getItem('gfp_access_token');
      const headers={ 'ngrok-skip-browser-warning':'true' };
      if(token) headers.Authorization='Bearer '+token;
      const res=await fetch(onboardApiBase()+path,{ method:'GET', headers:headers });
      if(res.status===401){ window.location.href='/auth/login/'; return { ok:false, status:401, text:'' }; }
      const text=await res.text();
      return { ok:res.ok, status:res.status, text:text };
    }
    function closeOnboardPrint(){
      const ov=document.getElementById('onboardPrintOverlay');
      if(ov) ov.hidden=true;
      const frame=document.getElementById('onboardPrintFrame');
      if(frame) frame.srcdoc='';
    }
    async function openOnboardPrintHtml(title, htmlPath, autoPrint){
      const overlay=document.getElementById('onboardPrintOverlay');
      const frame=document.getElementById('onboardPrintFrame');
      const titleEl=document.getElementById('onboardPrintTitle');
      if(!overlay||!frame){ toast(window.GfpI18n.tLabel('Print view not available','عرض الطباعة غير متاح'),'error'); return; }
      if(titleEl) titleEl.textContent=title||window.GfpI18n.tLabel('Print','طباعة');
      overlay.hidden=false;
      frame.srcdoc='<p style="padding:16px;font-family:sans-serif;color:#666">'+window.GfpI18n.tLabel('Loading…','جارٍ التحميل...')+'</p>';
      const res=await onboardFetchHtml(htmlPath);
      if(!res.ok){
        const msg=window.GfpI18n.tLabel('Could not load print view','تعذر تحميل عرض الطباعة')+(res.status?' (HTTP '+res.status+')':'');
        toast(msg,'error');
        frame.srcdoc='<p style="padding:16px;font-family:sans-serif;color:#991b1b">'+msg+'</p>';
        return;
      }
      frame.srcdoc=res.text||'';
      if(autoPrint){
        setTimeout(function(){
          try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
          catch(e){ toast(window.GfpI18n.tLabel('Allow pop-ups / try Print again','فعّل النوافذ المنبثقة أو حاول الطباعة مرة أخرى'),'error'); }
        }, 450);
      }
    }
    async function resolveOnboardInvoice(sale){
      if(!sale||!Gfp) return null;
      const readyId=sale.invoiceId||sale.InvoiceId||null;
      const readyNum=sale.invoiceNumber||sale.InvoiceNumber||null;
      if(readyId) return { invoiceId:readyId, invoiceNumber:readyNum };
      const saleId=sale.saleId||sale.id||sale.SaleId;
      if(!saleId) return null;
      for(let i=0;i<8;i++){
        const r=await Gfp.get('/sales/'+encodeURIComponent(saleId)+'/invoice');
        if(r.ok&&r.data&&(r.data.invoiceId||r.data.InvoiceId)){
          return {
            invoiceId: r.data.invoiceId||r.data.InvoiceId,
            invoiceNumber: r.data.invoiceNumber||r.data.InvoiceNumber||null
          };
        }
        await new Promise(function(resolve){ setTimeout(resolve, 500); });
      }
      return null;
    }
    async function prepareOnboardPrintStep(result){
      onboardSale=result&&result.sale?result.sale:null;
      onboardInvoiceId=null;
      onboardInvoiceNumber=null;
      const invStatus=document.getElementById('onboardInvoiceStatus');
      const btnInv=document.getElementById('btnOnboardPrintInvoice');
      const cardStatus=document.getElementById('onboardCardStatus');
      const assignRow=document.getElementById('onboardAssignCardRow');
      const assignedBox=document.getElementById('onboardCardAssigned');
      const scanInput=document.getElementById('onboardCardScanInput');
      const btnAssign=document.getElementById('btnOnboardAssignCard');
      const btnRf=document.getElementById('btnOnboardRefund');
      function showOnboardRefund(){
        const RA=window.GfpRefundAction;
        const saleId=onboardSale&&(onboardSale.saleId||onboardSale.id||onboardSale.SaleId);
        const show=!!(saleId && RA && RA.isEnabled() && RA.canRequest());
        if(!btnRf) return;
        btnRf.hidden=!show;
        if(!show) return;
        btnRf.onclick=function(){
          RA.open({
            saleId: saleId,
            saleTotal: onboardSale.totals && onboardSale.totals.total,
            paid: onboardSale.totals && onboardSale.totals.paid,
            memberName: createdMember && createdMember.fullName,
            lines: selectedPlan ? [{ description: selectedPlan.name, lineTotal: selectedPlan.price }] : []
          });
        };
      }

      if(assignedBox) assignedBox.hidden=true;
      if(scanInput) scanInput.value='';
      if(createdMember&&createdMember.id){
        if(assignRow) assignRow.style.display='flex';
        if(btnAssign) btnAssign.disabled=false;
        if(cardStatus) cardStatus.textContent=window.GfpI18n.tLabel(
          'Scan a blank Available PVC card to assign to this member.',
          'امسح كارنيه PVC متاح لتعيينه لهذا العضو.'
        );
        if(scanInput) setTimeout(function(){ try{ scanInput.focus(); }catch(e){} }, 80);
      } else {
        if(assignRow) assignRow.style.display='none';
        if(btnAssign) btnAssign.disabled=true;
        if(cardStatus) cardStatus.textContent=window.GfpI18n.tLabel(
          'Member id missing — cannot assign a card.',
          'رقم العضو غير موجود — لا يمكن تعيين كارنيه.'
        );
      }

      if(!onboardSale){
        if(invStatus) invStatus.textContent=window.GfpI18n.tLabel('No sale invoice (membership assigned without POS sale).','لا توجد فاتورة بيع (تم تفعيل العضوية بدون عملية بيع في نقطة البيع).');
        if(btnInv) btnInv.disabled=true;
        showOnboardRefund();
        return;
      }
      const skipped=onboardSale.invoiceStatus==='skipped'||onboardSale.invoiceStatus==='not_applicable';
      if(skipped){
        if(invStatus) invStatus.textContent=window.GfpI18n.tLabel('No invoice for this sale.','لا توجد فاتورة لهذه العملية.');
        if(btnInv) btnInv.disabled=true;
        showOnboardRefund();
        return;
      }
      if(invStatus) invStatus.textContent=window.GfpI18n.tLabel('Preparing invoice…','جارٍ تجهيز الفاتورة...');
      if(btnInv) btnInv.disabled=true;
      const inv=await resolveOnboardInvoice(onboardSale);
      if(inv&&inv.invoiceId){
        onboardInvoiceId=inv.invoiceId;
        onboardInvoiceNumber=inv.invoiceNumber;
        if(invStatus){
          invStatus.textContent=onboardInvoiceNumber
            ?(window.GfpI18n.tLabel('Invoice ','فاتورة ')+onboardInvoiceNumber+window.GfpI18n.tLabel(' ready to print',' جاهزة للطباعة'))
            :window.GfpI18n.tLabel('Invoice ready to print','الفاتورة جاهزة للطباعة');
        }
        if(btnInv) btnInv.disabled=false;
      } else {
        if(invStatus) invStatus.textContent=window.GfpI18n.tLabel('Invoice not ready yet — try Print again in a moment.','الفاتورة غير جاهزة بعد — حاول الطباعة مرة أخرى بعد قليل.');
        if(btnInv) btnInv.disabled=false; // allow retry via click handler re-resolve
      }
      showOnboardRefund();
    }

    function addDaysIso(iso, days){
      const d=new Date(iso+'T00:00:00');
      d.setDate(d.getDate()+days);
      return d.toISOString().slice(0,10);
    }
    function fmtObDate(iso){
      if(!iso) return '—';
      return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    }
    function todayYmdOb(){
      return (window.GfpCairoDates&&window.GfpCairoDates.todayYmd)
        ? window.GfpCairoDates.todayYmd()
        : new Date().toISOString().slice(0,10);
    }
    function updateOnboardDueHint(){
      const amtEl=overlay.querySelector('#onboardAmountPaid');
      const hint=overlay.querySelector('#onboardDueHint');
      const dueWrap=overlay.querySelector('#onboardDueDateWrap');
      const dueEl=overlay.querySelector('#onboardDueDate');
      if(!amtEl||!selectedPlan) return;
      const price=Number(selectedPlan.price)||0;
      const paid=parseFloat(amtEl.value);
      const cash=Number.isFinite(paid)?paid:0;
      const due=Math.max(0, price-cash);
      const isPartial=due>0.004;
      if(dueWrap) dueWrap.hidden=!isPartial;
      if(isPartial&&dueEl&&!dueEl.value){
        const startEl=overlay.querySelector('#onboardStartDate');
        dueEl.value=(startEl&&startEl.value)||todayYmdOb();
      }
      if(hint){
        if(isPartial){
          hint.textContent='EGP '+due.toLocaleString()+window.GfpI18n.tLabel(' stays outstanding — collect later from Member 360.',' متبقٍ — حصّله لاحقًا من صفحة العضو (Member 360).');
          hint.classList.add('has-due');
        } else {
          hint.textContent=window.GfpI18n.tLabel('Pay less than the plan price to record a partial payment.','ادفع أقل من سعر الخطة لتسجيل دفعة جزئية.');
          hint.classList.remove('has-due');
        }
      }
    }

    async function loadOnboardPlans(){
      const host=overlay.querySelector('#onboardPlanCards');
      const loading=overlay.querySelector('#onboardPlanLoading');
      if(loading) loading.style.display='block';
      if(host) host.innerHTML='';
      try{
        if(!Gfp) throw new Error(window.GfpI18n.tLabel('API missing','واجهة البرمجة (API) غير متاحة'));
        const r=await Gfp.get('/membership-plans');
        if(!r.ok) throw new Error(apiMsg(r,window.GfpI18n.tLabel('Failed to load plans','تعذر تحميل الخطط')));
        onboardPlans=(Array.isArray(r.data)?r.data:[]).filter(function(p){
          return p&&p.isActive!==false&&String(p.planType||'').toLowerCase()!=='trial';
        });
        if(!onboardPlans.length){
          if(host) host.innerHTML='<div class="mdl-error-banner show"><i class="ti ti-alert-circle"></i><div class="error-text">'+window.GfpI18n.tLabel('No active membership plans','لا توجد خطط عضوية نشطة')+'</div></div>';
        } else if(host){
          host.innerHTML=onboardPlans.map(function(p){
            return '<button type="button" class="plan-card" data-plan-id="'+p.id+'" style="text-align:left;width:100%;border:1px solid var(--ls3);background:var(--ls1);border-radius:var(--rmd);padding:12px;cursor:pointer">'
              +'<div style="display:flex;justify-content:space-between;gap:8px"><strong>'+(p.name||'')+'</strong><span>EGP '+(p.price||0).toLocaleString()+'</span></div>'
              +'<div style="font-size:12px;color:var(--ltt);margin-top:4px">'+(p.durationDays||0)+' '+window.GfpI18n.tLabel('days','يوم')
              +(p.sessionCount?' · '+p.sessionCount+' '+window.GfpI18n.tLabel('sessions','جلسة'):'')+'</div></button>';
          }).join('');
          host.querySelectorAll('[data-plan-id]').forEach(function(btn){
            btn.addEventListener('click',function(){
              host.querySelectorAll('[data-plan-id]').forEach(function(b){ b.style.borderColor='var(--ls3)'; b.style.boxShadow='none'; });
              btn.style.borderColor='var(--l500)';
              btn.style.boxShadow='0 0 0 1px var(--l500)';
              selectedPlan=onboardPlans.find(function(p){ return p.id===btn.getAttribute('data-plan-id'); })||null;
              if(btnCreate) btnCreate.disabled=!selectedPlan;
            });
          });
        }
      }catch(e){
        if(host) host.innerHTML='<div class="mdl-error-banner show"><i class="ti ti-alert-circle"></i><div class="error-text">'+(e.message||window.GfpI18n.tLabel('Cannot load plans (plans.manage may be required)','تعذر تحميل الخطط (قد تحتاج صلاحية plans.manage)'))+'</div></div>';
      }
      if(loading) loading.style.display='none';
    }

    function renderOnboardSummary(){
      const box=overlay.querySelector('#onboardSummary');
      const startEl=overlay.querySelector('#onboardStartDate');
      const amtEl=overlay.querySelector('#onboardAmountPaid');
      if(!box||!selectedPlan||!createdMember) return;
      const start=(startEl&&startEl.value)||new Date().toISOString().slice(0,10);
      const end=addDaysIso(start, Number(selectedPlan.durationDays)||0);
      box.innerHTML=
        '<div class="plan-detail-row"><span class="plan-detail-label">'+window.GfpI18n.tLabel('Member','العضو')+'</span><span class="plan-detail-val">'+(createdMember.fullName||'')+'</span></div>'+
        '<div class="plan-detail-row"><span class="plan-detail-label">'+window.GfpI18n.tLabel('Plan','الخطة')+'</span><span class="plan-detail-val">'+(selectedPlan.name||'')+'</span></div>'+
        '<div class="plan-detail-row"><span class="plan-detail-label">'+window.GfpI18n.tLabel('Start','البداية')+'</span><span class="plan-detail-val">'+fmtObDate(start)+'</span></div>'+
        '<div class="plan-detail-row"><span class="plan-detail-label">'+window.GfpI18n.tLabel('End','النهاية')+'</span><span class="plan-detail-val">'+fmtObDate(end)+'</span></div>'+
        '<div class="plan-detail-row"><span class="plan-detail-label">'+window.GfpI18n.tLabel('Price','السعر')+'</span><span class="plan-price"><span class="currency">EGP</span> '+(selectedPlan.price||0).toLocaleString()+'</span></div>';
      if(amtEl && (amtEl.value===''||amtEl.value==null)) amtEl.value=String(selectedPlan.price||0);
      updateOnboardDueHint();
    }

    async function completeOnboardPayment(){
      if(!createdMember||!selectedPlan||!Gfp) return false;
      const pay=(overlay.querySelector('input[name="onboardPayment"]:checked')||{}).value||'cash';
      const amount=Number((overlay.querySelector('#onboardAmountPaid')||{}).value)||0;
      const canSell=Authz?Authz.useCan('sales.sell'):false;
      const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;

      if(canSell){
        const map={ cash:'cash', paymob:'card_paymob', fawry:'fawry', vodafone_cash:'vodafone' };
        const method=map[pay]||'cash';
        const price=Number(selectedPlan.price)||0;
        const body={
          planId: selectedPlan.id,
          memberId: createdMember.id,
          payments:[{ method: method, amount: amount }]
        };
        if(amount<price-0.004){
          const dueEl=overlay.querySelector('#onboardDueDate');
          const startEl=overlay.querySelector('#onboardStartDate');
          const dueDate=(dueEl&&dueEl.value)||(startEl&&startEl.value)||todayYmdOb();
          if(!dueDate){
            showAddError(window.GfpI18n.tLabel('Due date required for partial payment.','التاريخ المستحق مطلوب للدفعة الجزئية.'));
            return false;
          }
          body.partialPayment={ dueDate: dueDate };
        }
        if(method==='cash'&&amount>0){
          const sh=await Gfp.get('/shifts/current');
          if(!sh.ok||!sh.data||!sh.data.id){
            if(errorBanner){
              const te=errorBanner.querySelector('.error-text');
              const arEl=errorBanner.querySelector('.error-text-ar');
              if(te) te.innerHTML=window.GfpI18n.tLabel(
                'Open a cash shift first, then complete this payment.',
                'افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.'
              )+' <a href="/dashboard/shifts/">'+window.GfpI18n.tLabel('Open shift','افتح الوردية')+'</a>';
              if(arEl) arEl.style.display='none';
              errorBanner.classList.add('show');
            }
            return false;
          }
        }
        const key=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('ob-'+Date.now());
        const r=await Gfp.post('/sales', body, { headers: { 'X-Idempotency-Key': key } });
        if(!r.ok){ showAddError(apiMsg(r,window.GfpI18n.tLabel('Sale failed','فشلت عملية البيع'))); return false; }
        return { sale:r.data, payMethod:pay, amount:amount };
      }
      if(canMgr){
        if(pay==='cash'&&amount>0){
          const sh=await Gfp.get('/shifts/current');
          if(!sh.ok||!sh.data||!sh.data.id){
            if(errorBanner){
              const te=errorBanner.querySelector('.error-text');
              const arEl=errorBanner.querySelector('.error-text-ar');
              if(te) te.innerHTML=window.GfpI18n.tLabel(
                'Open a cash shift first, then complete this payment.',
                'افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.'
              )+' <a href="/dashboard/shifts/">'+window.GfpI18n.tLabel('Open shift','افتح الوردية')+'</a>';
              if(arEl) arEl.style.display='none';
              errorBanner.classList.add('show');
            }
            return false;
          }
        }
        const r=await Gfp.post('/memberships/'+createdMember.id+'/assign',{
          planId: selectedPlan.id,
          paymentMethod: pay==='vodafone_cash'?'fawry':pay,
          amountPaid: pay==='cash'?amount:undefined
        });
        if(!(r.ok||r.status===201)){ showAddError(apiMsg(r,window.GfpI18n.tLabel('Assign failed','فشل تعيين العضوية'))); return false; }
        return { membership:r.data, payMethod:pay, amount:amount };
      }
      showAddError(window.GfpI18n.tLabel('Missing sales.sell or manager permission to complete membership payment','صلاحية sales.sell أو صلاحية مدير مطلوبة لإتمام دفع العضوية'));
      return false;
    }

    // Collapsible section
    const toggleBtn=overlay.querySelector('#addSectionToggle');
    const sectionBody=overlay.querySelector('#addSectionBody');
    if(toggleBtn&&sectionBody){
      toggleBtn.addEventListener('click',()=>{
        sectionBody.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
      });
    }

    // Real-time phone validation
    if(form.phone){
      form.phone.addEventListener('input',function(){
        const v=this.value.replace(/[\s\-()]/g,'');
        const phoneErr=overlay.querySelector('#addPhoneError');
        if(v.length>0 && v.length>=10){
          if(!validatePhone(v)){
            phoneWrap&&phoneWrap.classList.add('error');
            phoneErr&&phoneErr.classList.add('show');
            phoneErr&&(phoneErr.querySelector('.field-error-text').textContent=window.GfpI18n.tLabel('Invalid Egyptian phone format','صيغة رقم الهاتف المصري غير صحيحة'));
          } else {
            phoneWrap&&phoneWrap.classList.remove('error');
            phoneErr&&phoneErr.classList.remove('show');
          }
        } else if(v.length===0){
          phoneWrap&&phoneWrap.classList.remove('error');
          phoneErr&&phoneErr.classList.remove('show');
        }
        validateAddForm();
      });
    }

    // Cap DOB to API rule: member must be at least 10 years old
    if(form.dob){
      form.dob.max=maxDobIso();
      form.dob.addEventListener('change',function(){
        const dobErr=overlay.querySelector('#addDobError');
        if(this.value&&!validateDob(this.value)){
          this.classList.add('error');
          if(dobErr){
            dobErr.classList.add('show');
            const t=dobErr.querySelector('.field-error-text');
            if(t) t.textContent=window.GfpI18n.tLabel('Member must be at least 10 years old','يجب أن يكون عمر العضو 10 سنوات على الأقل');
          }
        } else {
          this.classList.remove('error');
          dobErr&&dobErr.classList.remove('show');
        }
        validateAddForm();
      });
    }

    // Validate required fields
    function validateAddForm(){
      const valid = form.nameEn&&form.nameEn.value.trim()
        && form.nameAr&&form.nameAr.value.trim()
        && form.phone&&validatePhone(form.phone.value.replace(/[\s\-()]/g,''))
        && form.dob&&validateDob(form.dob.value);
      if(btnCreate && onboardStep===1) btnCreate.disabled=!valid;
      return !!valid;
    }

    // Bind validation to required inputs
    ['nameEn','nameAr','dob'].forEach(k=>{
      if(form[k]) form[k].addEventListener('input',validateAddForm);
    });
    const onboardAmtEl=overlay.querySelector('#onboardAmountPaid');
    if(onboardAmtEl) onboardAmtEl.addEventListener('input',updateOnboardDueHint);

    // Show/hide field errors on blur
    ['nameEn','nameAr'].forEach(k=>{
      if(!form[k]) return;
      form[k].addEventListener('blur',function(){
        const errEl=overlay.querySelector(`#add${k.charAt(0).toUpperCase()+k.slice(1)}Error`);
        if(!this.value.trim()){
          this.classList.add('error');
          if(errEl){errEl.classList.add('show');errEl.querySelector('.field-error-text').textContent=window.GfpI18n.tLabel('This field is required','هذا الحقل مطلوب');}
        } else {
          this.classList.remove('error');
          if(errEl) errEl.classList.remove('show');
        }
      });
    });

    // Multi-step Continue / Complete
    if(btnCreate){
      btnCreate.addEventListener('click',async function(){
        errorBanner&&errorBanner.classList.remove('show');
        btnCreate.classList.add('loading');
        btnCreate.disabled=true;
        try{
          if(onboardStep===1){
            if(!validateAddForm()) return;
            if(!canCreate()){ showAddError(window.GfpI18n.tLabel('Missing members.create permission','صلاحية members.create مطلوبة')); return; }
            if(!Gfp){ showAddError(window.GfpI18n.tLabel('API client missing','عميل API غير متاح')); return; }
            const body={
              fullName: form.nameEn.value.trim(),
              fullNameAr: form.nameAr.value.trim(),
              phone: formatPhoneForApi(form.phone.value),
              dateOfBirth: form.dob.value,
            };
            if(form.email&&form.email.value.trim()) body.email=form.email.value.trim();
            if(form.nationalId&&form.nationalId.value.trim()) body.nationalId=form.nationalId.value.trim();
            if(form.emergency&&form.emergency.value.trim()) body.emergencyContact=formatPhoneForApi(form.emergency.value);
            if(form.notes&&form.notes.value.trim()) body.notes=form.notes.value.trim();
            if(form.referralCode&&form.referralCode.value.trim())
              body.referralCode=form.referralCode.value.trim().toUpperCase();
            const r=await Gfp.post('/members', body);
            if(!r.ok){ showAddError(apiMsg(r,window.GfpI18n.tLabel('Failed to create member','فشل إنشاء العضو'))); return; }
            createdMember=r.data||{};
            if(!createdMember.id&&r.data) createdMember=r.data;
            // Some APIs return only id string / nested member / PascalCase Id
            if(!createdMember.id&&createdMember.Id) createdMember.id=createdMember.Id;
            if(!createdMember.id&&typeof r.data==='string') createdMember={ id:r.data, fullName:body.fullName };
            if(!createdMember.fullName) createdMember.fullName=body.fullName||createdMember.FullName;
            toast(window.GfpI18n.tLabel('Member created — select a membership','تم إنشاء العضو — اختر عضوية'));
            const startEl=overlay.querySelector('#onboardStartDate');
            if(startEl&&!startEl.value) startEl.value=new Date().toISOString().slice(0,10);
            setOnboardStep(2);
            await loadOnboardPlans();
            if(typeof window.loadMembers==='function') window.loadMembers();
            if(typeof window.loadStats==='function') window.loadStats();
          } else if(onboardStep===2){
            if(!selectedPlan){ showAddError(window.GfpI18n.tLabel('Select a membership plan','اختر خطة عضوية')); return; }
            renderOnboardSummary();
            setOnboardStep(3);
          } else if(onboardStep===3){
            const result=await completeOnboardPayment();
            if(!result) return;
            const startEl=overlay.querySelector('#onboardStartDate');
            const start=(startEl&&startEl.value)||new Date().toISOString().slice(0,10);
            const end=addDaysIso(start, Number(selectedPlan.durationDays)||0);
            const conf=overlay.querySelector('#onboardConfirmText');
            if(conf){
              const outstanding=Math.max(0, (Number(selectedPlan.price)||0)-(result.amount||0));
              conf.innerHTML=
                '<div><strong>'+(createdMember.fullName||'')+'</strong></div>'+
                '<div>'+(selectedPlan.name||'')+'</div>'+
                '<div>'+fmtObDate(start)+' → '+fmtObDate(end)+'</div>'+
                '<div>'+window.GfpI18n.tLabel('Paid: EGP ','المدفوع: EGP ')+(result.amount||0).toLocaleString()+' ('+result.payMethod+')</div>'+
                (outstanding>0.004?('<div>'+window.GfpI18n.tLabel('Outstanding: EGP ','المستحق: EGP ')+outstanding.toLocaleString()+'</div>'):'');
            }
            const view=overlay.querySelector('#btnOnboardViewMember');
            if(view&&createdMember.id) view.href='/dashboard/members/'+encodeURIComponent(createdMember.id)+'/';
            setOnboardStep(4);
            toast(window.GfpI18n.tLabel('Onboarding complete — print invoice & assign card','تم إكمال التسجيل — اطبع الفاتورة وعيّن الكارنيه'));
            await prepareOnboardPrintStep(result);
            if(typeof window.loadMembers==='function') window.loadMembers();
          }
        }catch(e){
          console.error('[AddMember] step '+onboardStep+' failed:', e);
          showAddError(window.GfpI18n.tLabel('Network error — please try again','خطأ في الشبكة — حاول مرة أخرى'));
        } finally {
          btnCreate.classList.remove('loading');
          if(onboardStep===1) validateAddForm();
          else if(onboardStep===2) btnCreate.disabled=!selectedPlan;
          else if(onboardStep===3) btnCreate.disabled=false;
        }
      });
    }

    const btnSkip=overlay.querySelector('#btnOnboardSkip');
    if(btnSkip){
      btnSkip.addEventListener('click',function(){
        const ok=window.confirm(window.GfpI18n.tLabel(
          'This member can be saved, but they cannot use membership-based check-in until a valid membership is assigned. Continue without a membership?',
          'يمكن حفظ هذا العضو، لكن لا يمكنه استخدام تسجيل الحضور بالعضوية حتى تُعيَّن له عضوية سارية. المتابعة بدون عضوية؟'
        ));
        if(!ok) return;
        closeOverlay('addMemberModal');
        resetAddForm();
        toast(window.GfpI18n.tLabel('Member saved without membership','تم حفظ العضو بدون عضوية'));
        if(typeof window.loadMembers==='function') window.loadMembers();
      });
    }

    function showAddError(msg){
      if(!errorBanner) return;
      const textEl=errorBanner.querySelector('.error-text');
      const arEl=errorBanner.querySelector('.error-text-ar');
      // Check for known bilingual errors
      if(msg.includes('Phone number already registered')||msg.includes('phone')||msg.includes('رقم')){
        if(textEl) textEl.textContent='Phone number already registered';
        if(arEl){arEl.textContent='رقم الهاتف مسجل مسبقاً';arEl.style.display='block';}
        phoneWrap&&phoneWrap.classList.add('error');
      } else {
        if(textEl) textEl.textContent=msg;
        if(arEl) arEl.style.display='none';
      }
      errorBanner.classList.add('show');
    }

    const btnPrintInvoice=document.getElementById('btnOnboardPrintInvoice');
    if(btnPrintInvoice){
      btnPrintInvoice.addEventListener('click',async function(){
        if(!onboardInvoiceId&&onboardSale){
          const inv=await resolveOnboardInvoice(onboardSale);
          if(inv&&inv.invoiceId){
            onboardInvoiceId=inv.invoiceId;
            onboardInvoiceNumber=inv.invoiceNumber;
          }
        }
        if(!onboardInvoiceId){
          toast(window.GfpI18n.tLabel('Invoice not ready yet','الفاتورة غير جاهزة بعد'),'error');
          return;
        }
        await openOnboardPrintHtml(
          onboardInvoiceNumber?(window.GfpI18n.tLabel('Invoice ','فاتورة ')+onboardInvoiceNumber):window.GfpI18n.tLabel('Invoice','فاتورة'),
          '/invoices/'+encodeURIComponent(onboardInvoiceId)+'/receipt-html',
          true
        );
      });
    }
    async function assignOnboardCard(){
      const cardStatus=document.getElementById('onboardCardStatus');
      const scanInput=document.getElementById('onboardCardScanInput');
      const btnAssign=document.getElementById('btnOnboardAssignCard');
      const assignRow=document.getElementById('onboardAssignCardRow');
      const assignedBox=document.getElementById('onboardCardAssigned');
      const assignedCode=document.getElementById('onboardCardAssignedCode');
      if(!createdMember||!createdMember.id){
        toast(window.GfpI18n.tLabel('Member id missing','رقم العضو غير موجود'),'error');
        return;
      }
      if(!canEdit()){
        toast(window.GfpI18n.tLabel('Missing members.edit permission','صلاحية members.edit مطلوبة'),'error');
        return;
      }
      const code=String(scanInput&&scanInput.value||'').trim();
      if(!code){
        toast(window.GfpI18n.tLabel('Scan an Available card','امسح كارنيه متاح'),'error');
        if(scanInput) scanInput.focus();
        return;
      }
      if(btnAssign) btnAssign.disabled=true;
      try{
        const r=await Gfp.post('/access-cards/assign',{ memberId:createdMember.id, code:code });
        if(!r||!r.ok){
          toast(apiMsg(r, window.GfpI18n.tLabel('Card assign failed','فشل تعيين الكارنيه')),'error');
          if(btnAssign) btnAssign.disabled=false;
          return;
        }
        const assigned=(r.data&&(r.data.code||r.data.Code))||code;
        if(assignRow) assignRow.style.display='none';
        if(assignedBox) assignedBox.hidden=false;
        if(assignedCode) assignedCode.textContent=assigned;
        if(cardStatus) cardStatus.textContent=window.GfpI18n.tLabel(
          'PVC card assigned. Desk check-in uses this code.',
          'تم تعيين الكارنيه. المسح عند الاستقبال يستخدم هذا الكود.'
        );
        toast(window.GfpI18n.tLabel('Card assigned','تم تعيين الكارنيه'));
      }catch(e){
        toast(window.GfpI18n.tLabel('Card assign failed','فشل تعيين الكارنيه'),'error');
        if(btnAssign) btnAssign.disabled=false;
      }
    }
    const btnOnboardAssign=document.getElementById('btnOnboardAssignCard');
    if(btnOnboardAssign){
      btnOnboardAssign.addEventListener('click',function(){ assignOnboardCard(); });
    }
    const onboardScanInput=document.getElementById('onboardCardScanInput');
    if(onboardScanInput){
      onboardScanInput.addEventListener('keydown',function(ev){
        if(ev.key==='Enter'){ ev.preventDefault(); assignOnboardCard(); }
      });
    }
    const btnPrintDo=document.getElementById('btnOnboardPrintDo');
    if(btnPrintDo){
      btnPrintDo.addEventListener('click',function(){
        const frame=document.getElementById('onboardPrintFrame');
        try{ if(frame&&frame.contentWindow){ frame.contentWindow.focus(); frame.contentWindow.print(); } }
        catch(e){ toast(window.GfpI18n.tLabel('Allow pop-ups / try Print again','فعّل النوافذ المنبثقة أو حاول الطباعة مرة أخرى'),'error'); }
      });
    }
    const btnPrintClose=document.getElementById('btnOnboardPrintClose');
    if(btnPrintClose) btnPrintClose.addEventListener('click',closeOnboardPrint);
    const printOv=document.getElementById('onboardPrintOverlay');
    if(printOv){
      printOv.addEventListener('click',function(e){ if(e.target===printOv) closeOnboardPrint(); });
    }

    function resetAddForm(){
      createdMember=null; selectedPlan=null; onboardPlans=[];
      onboardSale=null; onboardInvoiceId=null; onboardInvoiceNumber=null;
      closeOnboardPrint();
      const invStatus=document.getElementById('onboardInvoiceStatus');
      const cardStatus=document.getElementById('onboardCardStatus');
      const btnInv=document.getElementById('btnOnboardPrintInvoice');
      const assignRow=document.getElementById('onboardAssignCardRow');
      const assignedBox=document.getElementById('onboardCardAssigned');
      const assignedCode=document.getElementById('onboardCardAssignedCode');
      const scanInput=document.getElementById('onboardCardScanInput');
      const btnAssign=document.getElementById('btnOnboardAssignCard');
      if(invStatus) invStatus.textContent=window.GfpI18n.tLabel('Preparing invoice…','جارٍ تجهيز الفاتورة...');
      if(cardStatus) cardStatus.textContent=window.GfpI18n.tLabel(
        'Scan a blank Available PVC card to assign.',
        'امسح كارنيه PVC متاح للتعيين.'
      );
      if(btnInv) btnInv.disabled=true;
      if(assignRow) assignRow.style.display='flex';
      if(assignedBox) assignedBox.hidden=true;
      if(assignedCode) assignedCode.textContent='—';
      if(scanInput) scanInput.value='';
      if(btnAssign) btnAssign.disabled=false;
      const dueEl=overlay.querySelector('#onboardDueDate');
      const dueHint=overlay.querySelector('#onboardDueHint');
      const dueWrap=overlay.querySelector('#onboardDueDateWrap');
      if(dueEl) dueEl.value='';
      if(dueHint){ dueHint.textContent=''; dueHint.classList.remove('has-due'); }
      if(dueWrap) dueWrap.hidden=true;
      setOnboardStep(1);
      Object.values(form).forEach(el=>{if(el){el.value='';el.classList.remove('error');}});
      overlay.querySelectorAll('.field-error').forEach(e=>e.classList.remove('show'));
      errorBanner&&errorBanner.classList.remove('show');
      phoneWrap&&phoneWrap.classList.remove('error');
      if(btnCreate) btnCreate.disabled=true;
      // Re-expand additional section
      sectionBody&&sectionBody.classList.remove('collapsed');
      toggleBtn&&toggleBtn.classList.remove('collapsed');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  2. EDIT MEMBER DRAWER
  // ══════════════════════════════════════════════════════════════
  let editMemberId=null;

  window.openEditDrawer=function(memberDataOrId){
    if(!canEdit()){ toast(window.GfpI18n.tLabel('Missing members.edit permission','صلاحية members.edit مطلوبة'),'error'); return; }
    const overlay=document.getElementById('editMemberDrawer');
    if(!overlay) return;
    if(typeof memberDataOrId==='string'){
      editMemberId=memberDataOrId;
      loadMemberForEdit(memberDataOrId);
    } else if(memberDataOrId&&memberDataOrId.id){
      editMemberId=memberDataOrId.id;
      populateEditForm(memberDataOrId);
    }
    overlay.classList.add('open');
  };

  async function loadMemberForEdit(id){
    const overlay=document.getElementById('editMemberDrawer');
    if(!overlay) return;
    try{
      if(!Gfp){ toast(window.GfpI18n.tLabel('API client missing','عميل API غير متاح'),'error'); return; }
      const r=await Gfp.get('/members/'+id);
      if(!r.ok) throw new Error('Not found');
      populateEditForm(r.data);
    }catch(e){
      toast(window.GfpI18n.tLabel('Failed to load member data','فشل تحميل بيانات العضو'),'error');
    }
  }

  function populateEditForm(m){
    const overlay=document.getElementById('editMemberDrawer');
    if(!overlay) return;
    const f={
      nameEn: overlay.querySelector('#editNameEn'),
      nameAr: overlay.querySelector('#editNameAr'),
      phone:  overlay.querySelector('#editPhone'),
      dob:    overlay.querySelector('#editDob'),
      email:  overlay.querySelector('#editEmail'),
      nationalId: overlay.querySelector('#editNationalId'),
      emergency:  overlay.querySelector('#editEmergency'),
      notes:  overlay.querySelector('#editNotes'),
    };
    if(f.nameEn) f.nameEn.value=m.fullName||'';
    if(f.nameAr) f.nameAr.value=m.fullNameAr||'';
    if(f.phone){
      f.phone.value=phoneToLocalInput(m.phone);
    }
    if(f.dob){
      const dobRaw=(m.dateOfBirth||'').toString();
      f.dob.value=dobRaw.length>=10?dobRaw.slice(0,10):'';
      f.dob.max=maxDobIso();
    }
    if(f.email) f.email.value=m.email||'';
    if(f.nationalId) f.nationalId.value=m.nationalId||'';
    if(f.emergency){
      f.emergency.value=phoneToLocalInput(m.emergencyContact);
    }
    if(f.notes) f.notes.value=m.notes||'';
    // Timestamp
    const ts=overlay.querySelector('#editTimestamp');
    if(ts&&m.updatedAtUtc){
      ts.textContent=window.GfpI18n.tLabel('Last updated: ','آخر تحديث: ')+new Date(m.updatedAtUtc).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      ts.style.display='flex';
    } else if(ts&&m.createdAtUtc){
      ts.textContent=window.GfpI18n.tLabel('Created: ','تاريخ الإنشاء: ')+new Date(m.createdAtUtc).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      ts.style.display='flex';
    }
    validateEditForm();
  }

  function initEditDrawer(){
    const overlay=document.getElementById('editMemberDrawer');
    if(!overlay) return;
    const form={
      nameEn: overlay.querySelector('#editNameEn'),
      nameAr: overlay.querySelector('#editNameAr'),
      phone:  overlay.querySelector('#editPhone'),
      dob:    overlay.querySelector('#editDob'),
      email:  overlay.querySelector('#editEmail'),
    };
    const btnSave=overlay.querySelector('#btnSaveEdit');
    const errorBanner=overlay.querySelector('#editErrorBanner');
    const phoneWrap=overlay.querySelector('#editPhoneWrap');

    // Real-time phone validation
    if(form.phone){
      form.phone.addEventListener('input',function(){
        const v=this.value.replace(/[\s\-()]/g,'');
        const phoneErr=overlay.querySelector('#editPhoneError');
        if(v.length>0&&v.length>=10){
          if(!validatePhone(v)){
            phoneWrap&&phoneWrap.classList.add('error');
            phoneErr&&phoneErr.classList.add('show');
          } else {
            phoneWrap&&phoneWrap.classList.remove('error');
            phoneErr&&phoneErr.classList.remove('show');
          }
        } else {
          phoneWrap&&phoneWrap.classList.remove('error');
          phoneErr&&phoneErr.classList.remove('show');
        }
        validateEditForm();
      });
    }

    // Cap DOB (same rule as create)
    if(form.dob){
      form.dob.max=maxDobIso();
      form.dob.addEventListener('change',function(){
        const dobErr=overlay.querySelector('#editDobError');
        if(this.value&&!validateDob(this.value)){
          this.classList.add('error');
          if(dobErr){ dobErr.classList.add('show'); const t=dobErr.querySelector('.field-error-text'); if(t) t.textContent=window.GfpI18n.tLabel('Member must be at least 10 years old','يجب أن يكون عمر العضو 10 سنوات على الأقل'); }
        } else {
          this.classList.remove('error');
          dobErr&&dobErr.classList.remove('show');
        }
        validateEditForm();
      });
    }

    function validateEditForm(){
      const valid=form.nameEn&&form.nameEn.value.trim()
        &&form.nameAr&&form.nameAr.value.trim()
        &&form.phone&&validatePhone(form.phone.value.replace(/[\s\-()]/g,''))
        &&form.dob&&validateDob(form.dob.value);
      if(btnSave) btnSave.disabled=!valid;
      return !!valid;
    }
    window.validateEditForm=validateEditForm;

    ['nameEn','nameAr','dob'].forEach(k=>{
      if(form[k]) form[k].addEventListener('input',validateEditForm);
    });

    // Collapsible section
    const toggleBtn=overlay.querySelector('#editSectionToggle');
    const sectionBody=overlay.querySelector('#editSectionBody');
    if(toggleBtn&&sectionBody){
      toggleBtn.addEventListener('click',()=>{
        sectionBody.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
      });
    }

    // Save
    if(btnSave){
      btnSave.addEventListener('click',async function(){
        if(!validateEditForm()||!editMemberId) return;
        btnSave.classList.add('loading');
        btnSave.disabled=true;
        errorBanner&&errorBanner.classList.remove('show');

        const body={
          fullName: form.nameEn.value.trim(),
          fullNameAr: overlay.querySelector('#editNameAr').value.trim(),
          phone: formatPhoneForApi(form.phone.value),
          dateOfBirth: form.dob.value,
        };
        const email=overlay.querySelector('#editEmail');
        const nationalId=overlay.querySelector('#editNationalId');
        const emergency=overlay.querySelector('#editEmergency');
        const notes=overlay.querySelector('#editNotes');
        if(email&&email.value.trim()) body.email=email.value.trim();
        if(nationalId&&nationalId.value.trim()) body.nationalId=nationalId.value.trim();
        if(emergency&&emergency.value.trim()) body.emergencyContact=formatPhoneForApi(emergency.value);
        if(notes) body.notes=notes.value.trim();

        try{
          if(!canEdit()){ showEditError(window.GfpI18n.tLabel('Missing members.edit permission','صلاحية members.edit مطلوبة')); return; }
          if(!Gfp){ showEditError(window.GfpI18n.tLabel('API client missing','عميل API غير متاح')); return; }
          const r=await Gfp.put('/members/'+editMemberId, body);
          if(r.ok){
            toast(window.GfpI18n.tLabel('Member updated successfully','تم تحديث العضو بنجاح'));
            closeOverlay('editMemberDrawer');
            // Re-fetch — ActivePlan/MembershipStatus are server-derived
            if(typeof window.loadMembers==='function') window.loadMembers();
            if(typeof window.loadMember==='function') window.loadMember();
          } else {
            showEditError(apiMsg(r,window.GfpI18n.tLabel('Failed to update member','فشل تحديث بيانات العضو')));
          }
        }catch(e){
          console.error('[EditMember] save failed:', e);
          showEditError(window.GfpI18n.tLabel('Network error — please try again','خطأ في الشبكة — حاول مرة أخرى'));
        }
        btnSave.classList.remove('loading');
        validateEditForm();
      });
    }

    function showEditError(msg){
      if(!errorBanner) return;
      const textEl=errorBanner.querySelector('.error-text');
      const arEl=errorBanner.querySelector('.error-text-ar');
      if(/already registered|مسجل/i.test(msg)||(/phone|Phone|رقم/.test(msg)&&/already|مسجل|duplicate|موجود/i.test(msg))){
        if(textEl) textEl.textContent='Phone number already registered';
        if(arEl){arEl.textContent='رقم الهاتف مسجل مسبقاً';arEl.style.display='block';}
      } else {
        if(textEl) textEl.textContent=msg;
        if(arEl) arEl.style.display='none';
      }
      errorBanner.classList.add('show');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  3. ASSIGN MEMBERSHIP MODAL
  // ══════════════════════════════════════════════════════════════
  let assignMemberId=null;
  let plansCache=null;

  function assignModalEl(){
    return document.getElementById('modalAssign')||document.getElementById('assignMembershipModal');
  }

  window.openAssignModal=async function(memberId){
    if(!memberId){ toast(window.GfpI18n.tLabel('Member id required','رقم العضو مطلوب'),'error'); return; }
    const canMgr=Authz?Authz.useCanRole('ManagerOrAbove'):false;
    if(!canMgr){ toast(window.GfpI18n.tLabel('Manager or above required to assign','صلاحية مدير أو أعلى مطلوبة للتعيين'),'error'); return; }
    assignMemberId=memberId;
    const overlay=assignModalEl();
    if(!overlay){ toast(window.GfpI18n.tLabel('Assign modal missing','نافذة التعيين غير متاحة'),'error'); return; }
    overlay.classList.add('open');
    const err=overlay.querySelector('#assignErrorBanner');
    if(err) err.classList.remove('show');
    const sel=overlay.querySelector('#assignPlanSelect');
    if(sel) sel.value='';
    const detail=overlay.querySelector('#planDetailCard');
    if(detail) detail.classList.remove('show');
    overlay.querySelectorAll('input[name="assignPayment"]').forEach(function(r){ r.checked=false; });
    const amtWrap=overlay.querySelector('#assignAmountWrap');
    if(amtWrap) amtWrap.hidden=true;
    const amt=overlay.querySelector('#assignAmountPaid');
    if(amt) amt.value='';
    const dueHint=overlay.querySelector('#assignDueHint');
    if(dueHint){ dueHint.textContent=''; dueHint.classList.remove('has-due'); }
    const payNote=overlay.querySelector('#assignPaymentNote');
    if(payNote) payNote.classList.remove('show');
    const btn=overlay.querySelector('#btnAssignMembership');
    if(btn) btn.disabled=true;
    await loadPlans();
  };

  async function loadPlans(){
    const overlay=assignModalEl();
    if(!overlay) return;
    const select=overlay.querySelector('#assignPlanSelect');
    const loading=overlay.querySelector('#planLoading');
    const detail=overlay.querySelector('#planDetailCard');
    if(loading) loading.style.display='flex';
    if(select) select.style.display='none';
    if(detail) detail.classList.remove('show');

    try{
      if(!plansCache){
        if(Gfp){
          const r=await Gfp.get('/membership-plans');
          if(!r.ok) throw new Error(r.error&&r.error.message||'Failed');
          plansCache=r.data;
        } else {
          const res=await fetch(API_BASE+'/membership-plans',{headers:getAuthHeaders()});
          if(!res.ok) throw new Error('Failed');
          plansCache=await res.json();
        }
      }
      if(select){
        select.innerHTML='<option value="">'+window.GfpI18n.tLabel('— Select a plan —','— اختر خطة —')+'</option>';
        (plansCache||[]).filter(p=>p&&p.isActive!==false&&String(p.planType||'').toLowerCase()!=='trial').forEach(p=>{
          const opt=document.createElement('option');
          opt.value=p.id;
          opt.textContent=`${p.name} — EGP ${p.price} (${p.durationDays} ${window.GfpI18n.tLabel('days','يوم')})`;
          opt.dataset.plan=JSON.stringify(p);
          select.appendChild(opt);
        });
        select.style.display='';
      }
    }catch(e){
      if(select){select.innerHTML='<option value="">'+window.GfpI18n.tLabel('Failed to load plans (needs plans.manage)','تعذر تحميل الخطط (يتطلب صلاحية plans.manage)')+'</option>';select.style.display='';}
    }
    if(loading) loading.style.display='none';
  }

  function initAssignModal(){
    const overlay=assignModalEl();
    if(!overlay) return;
    const select=overlay.querySelector('#assignPlanSelect');
    const detail=overlay.querySelector('#planDetailCard');
    const btnAssign=overlay.querySelector('#btnAssignMembership');
    const errorBanner=overlay.querySelector('#assignErrorBanner');
    const paymentNote=overlay.querySelector('#assignPaymentNote');

    function selectedPlanPrice(){
      if(!select||!select.value) return 0;
      try{
        const p=JSON.parse(select.options[select.selectedIndex].dataset.plan||'{}');
        return Number(p.price)||0;
      }catch(e){ return 0; }
    }
    function selectedPayMethod(){
      const el=overlay.querySelector('input[name="assignPayment"]:checked');
      return el?el.value:'';
    }
    function updateAssignDueHint(){
      const wrap=overlay.querySelector('#assignAmountWrap');
      const amtEl=overlay.querySelector('#assignAmountPaid');
      const hint=overlay.querySelector('#assignDueHint');
      const isCash=selectedPayMethod()==='cash';
      if(wrap) wrap.hidden=!isCash;
      if(!hint||!amtEl) return;
      if(!isCash){
        hint.textContent='';
        hint.classList.remove('has-due');
        return;
      }
      const price=selectedPlanPrice();
      if(amtEl.value===''&&price>0) amtEl.value=String(price);
      const paid=parseFloat(amtEl.value);
      const cash=Number.isFinite(paid)?paid:0;
      const due=Math.max(0, price-cash);
      if(due>0.004){
        hint.textContent='EGP '+due.toLocaleString()+window.GfpI18n.tLabel(' stays outstanding — Collect Payment on this member.',' متبقٍ — حصّل الدفعة من هذا العضو.');
        hint.classList.add('has-due');
      } else {
        hint.textContent=window.GfpI18n.tLabel('Leave as the plan price to pay in full. Pay less if they cannot pay everything now.','اترك المبلغ كسعر الخطة للدفع الكامل، أو ادفع أقل إذا تعذر الدفع بالكامل الآن.');
        hint.classList.remove('has-due');
      }
    }

    // Plan selection
    if(select){
      select.addEventListener('change',function(){
        if(!this.value){detail&&detail.classList.remove('show');validateAssignForm();updateAssignDueHint();return;}
        const opt=this.options[this.selectedIndex];
        try{
          const p=JSON.parse(opt.dataset.plan);
          if(detail){
            detail.querySelector('.pdc-name').textContent=p.name||'';
            detail.querySelector('.pdc-name-ar').textContent=p.nameAr||'';
            const typeEl=detail.querySelector('.pdc-type');
            if(typeEl) typeEl.textContent=(p.planType||'').replace(/_/g,' ');
            detail.querySelector('.pdc-price').innerHTML=`<span class="currency">EGP</span> ${(p.price||0).toLocaleString()}`;
            detail.querySelector('.pdc-duration').textContent=(p.durationDays||0)+' '+window.GfpI18n.tLabel('days','يوم');
            detail.classList.add('show');
          }
          const amtEl=overlay.querySelector('#assignAmountPaid');
          if(amtEl) amtEl.value=String(p.price||0);
        }catch(e){}
        validateAssignForm();
        updateAssignDueHint();
      });
    }

    // Payment radios
    overlay.querySelectorAll('input[name="assignPayment"]').forEach(radio=>{
      radio.addEventListener('change',function(){
        if(paymentNote){
          if(this.value==='cash'){
            paymentNote.innerHTML='<i class="ti ti-info-circle"></i> '+window.GfpI18n.tLabel('Cash activates the membership now. Pay less than the plan price and the rest stays Outstanding.','الدفع النقدي يفعّل العضوية فورًا. ادفع أقل من سعر الخطة ويبقى الباقي كمبلغ مستحق.');
            paymentNote.className='payment-note show';
          } else {
            paymentNote.innerHTML='<i class="ti ti-alert-triangle"></i> '+window.GfpI18n.tLabel('Membership will be created as "pending" and activated automatically when payment is confirmed via webhook.','سيتم إنشاء العضوية بحالة "قيد الانتظار" وتُفعّل تلقائيًا عند تأكيد الدفع عبر webhook.');
            paymentNote.className='payment-note warning show';
          }
        }
        validateAssignForm();
        updateAssignDueHint();
      });
    });
    const amtInput=overlay.querySelector('#assignAmountPaid');
    if(amtInput) amtInput.addEventListener('input',updateAssignDueHint);

    function validateAssignForm(){
      const planOk=select&&select.value;
      const payOk=overlay.querySelector('input[name="assignPayment"]:checked');
      if(btnAssign) btnAssign.disabled=!(planOk&&payOk);
      return !!(planOk&&payOk);
    }

    // Submit — POST /memberships/{id}/assign (ManagerOrAbove)
    if(btnAssign){
      btnAssign.addEventListener('click',async function(){
        if(!assignMemberId||!validateAssignForm()) return;
        btnAssign.classList.add('loading');
        btnAssign.disabled=true;
        errorBanner&&errorBanner.classList.remove('show');

        const payMethod=overlay.querySelector('input[name="assignPayment"]:checked').value;
        const amtEl=overlay.querySelector('#assignAmountPaid');
        const amountPaid=payMethod==='cash'?(parseFloat(amtEl&&amtEl.value)||0):undefined;
        const body={planId:select.value,paymentMethod:payMethod};
        if(amountPaid!=null) body.amountPaid=amountPaid;
        const refEl=overlay.querySelector('#assignReferralCode');
        if(refEl&&refEl.value.trim()) body.referralCode=refEl.value.trim().toUpperCase();

        try{
          if(payMethod==='cash'&&amountPaid>0&&Gfp){
            const sh=await Gfp.get('/shifts/current');
            if(!sh.ok||!sh.data||!sh.data.id){
              if(errorBanner){
                const te=errorBanner.querySelector('.error-text');
                if(te) te.innerHTML=window.GfpI18n.tLabel('Open a cash shift first, then complete this payment.','افتح وردية الصندوق أولاً، ثم أكمل هذا الدفع.') +
                  ' <a href="/dashboard/shifts/">'+window.GfpI18n.tLabel('Open shift','افتح الوردية')+'</a>';
                errorBanner.classList.add('show');
              }
              btnAssign.classList.remove('loading');
              validateAssignForm();
              return;
            }
          }
          let res;
          if(Gfp){
            res=await Gfp.post('/memberships/'+assignMemberId+'/assign',body);
          } else {
            const raw=await fetch(`${API_BASE}/memberships/${assignMemberId}/assign`,{method:'POST',headers:getAuthHeaders(),body:JSON.stringify(body)});
            const data=await raw.json().catch(()=>null);
            res={ok:raw.ok,status:raw.status,data:data};
          }
          if(res.status===201||res.ok){
            const pending=res.data&&String(res.data.status||'').toLowerCase()==='pending';
            const price=selectedPlanPrice();
            const due=payMethod==='cash'?Math.max(0,price-(amountPaid||0)):0;
            toast(
              payMethod==='cash'
                ?(due>0.004
                  ?window.GfpI18n.tLabel('Assigned. EGP ','تم التعيين. EGP ')+due.toLocaleString()+window.GfpI18n.tLabel(' outstanding — Collect Payment on this member.',' متبقٍ — حصّل الدفعة من هذا العضو.')
                  :window.GfpI18n.tLabel('Membership assigned & activated!','تم تعيين العضوية وتفعيلها!'))
                :window.GfpI18n.tLabel('Assigned — waiting for payment. Refresh the membership panel (no live push).','تم التعيين — في انتظار الدفع. حدّث لوحة العضوية (لا يوجد تحديث تلقائي).'),
              pending?'error':'success'
            );
            closeOverlay(overlay.id);
            if(typeof window.loadMember==='function') window.loadMember();
            if(typeof window.loadMembers==='function') window.loadMembers();
          } else if(res.status===409){
            const msg=(res.data&&(res.data.message||res.data.error))||window.GfpI18n.tLabel('Already has an active membership — cannot assign another.','يوجد بالفعل عضوية نشطة — لا يمكن تعيين عضوية أخرى.');
            if(errorBanner){
              const te=errorBanner.querySelector('.error-text');
              if(te) te.textContent=window.GfpI18n.tLabel('Active membership conflict: ','تعارض في العضوية النشطة: ')+msg;
              errorBanner.classList.add('show');
            }
            toast(window.GfpI18n.tLabel('Blocked: active membership exists','محظور: توجد عضوية نشطة بالفعل'),'error');
          } else {
            const msg=(res.data&&(res.data.message||res.data.error))||(res.error&&res.error.message)||window.GfpI18n.tLabel('Failed to assign membership','فشل تعيين العضوية');
            if(errorBanner){
              errorBanner.querySelector('.error-text').textContent=msg;
              errorBanner.classList.add('show');
            }
          }
        }catch(e){
          if(errorBanner){errorBanner.querySelector('.error-text').textContent=window.GfpI18n.tLabel('Network error','خطأ في الشبكة');errorBanner.classList.add('show');}
        }
        btnAssign.classList.remove('loading');
        validateAssignForm();
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  Overlay Controls
  // ══════════════════════════════════════════════════════════════
  function closeOverlay(id){
    const el=document.getElementById(id);
    if(el) el.classList.remove('open');
  }
  window.closeOverlay=closeOverlay;

  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    o.addEventListener('click',function(e){if(e.target===this) this.classList.remove('open');});
  });
  // Close buttons
  document.querySelectorAll('.mdl-close').forEach(b=>{
    b.addEventListener('click',function(){this.closest('.modal-overlay').classList.remove('open');});
  });

  // Wire "Add Member" button on members list page
  const btnAdd=document.getElementById('btnAddMember');
  function openAddMemberModal(){
    if(!canCreate()){ toast(window.GfpI18n.tLabel('Missing members.create permission','صلاحية members.create مطلوبة'),'error'); return; }
    const m=document.getElementById('addMemberModal');
    if(m) m.classList.add('open');
  }
  if(btnAdd){
    btnAdd.addEventListener('click',openAddMemberModal);
  }
  const emptyAdd=document.getElementById('emptyAddMember');
  if(emptyAdd){
    emptyAdd.addEventListener('click',openAddMemberModal);
  }
  try{
    var params=new URLSearchParams(location.search);
    if(params.get('action')==='new' && btnAdd){
      openAddMemberModal();
      params.delete('action');
      var qs=params.toString();
      history.replaceState({},'',location.pathname+(qs?'?'+qs:'')+location.hash);
    }
  }catch(e){ /* ignore */ }

  // ── Init all components ──
  initAddMemberModal();
  initEditDrawer();
  initAssignModal();

})();
