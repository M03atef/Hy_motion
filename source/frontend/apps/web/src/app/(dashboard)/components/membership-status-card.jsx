const { useState } = React;

// ── Mock Data ──
const MOCK_MEMBERSHIPS = {
  active: {
    id:'m1', memberId:'u1', status:'Active', planName:'Monthly Unlimited',
    planType:'monthly_unlimited', startDate:'2026-05-01T00:00:00Z',
    endDate:'2026-05-31T00:00:00Z', daysRemaining:22, totalDays:30,
    sessionsUsed:null, totalSessions:null, isActive:true
  },
  active_sessions: {
    id:'m1b', memberId:'u1b', status:'Active', planName:'20-Session Pack',
    planType:'session_pack', startDate:'2026-04-15T00:00:00Z',
    endDate:'2026-07-15T00:00:00Z', daysRemaining:60, totalDays:90,
    sessionsUsed:2, totalSessions:20, isActive:true
  },
  frozen: {
    id:'m2', memberId:'u2', status:'Frozen', planName:'Premium Quarterly',
    planType:'monthly_unlimited', startDate:'2026-04-01T00:00:00Z',
    endDate:'2026-07-01T00:00:00Z', freezeEndDate:'2026-05-20T00:00:00Z',
    originalEndDate:'2026-06-20T00:00:00Z', daysRemaining:null,
    totalDays:90, isActive:false
  },
  expired: {
    id:'m3', memberId:'u3', status:'Expired', planName:'Monthly Basic',
    planType:'monthly_unlimited', startDate:'2026-04-01T00:00:00Z',
    endDate:'2026-05-01T00:00:00Z', daysRemaining:0, totalDays:30,
    daysSinceExpiry:5, isActive:false
  },
  pending: {
    id:'m4', memberId:'u4', status:'Pending', planName:'Annual VIP',
    planType:'monthly_unlimited', startDate:null, endDate:null,
    paymentMethod:'Paymob', isActive:false
  },
  cancelled: {
    id:'m5', memberId:'u5', status:'Cancelled', planName:'Family Plan',
    planType:'family', startDate:'2026-03-01T00:00:00Z',
    endDate:'2026-06-01T00:00:00Z', cancelledDate:'2026-05-10T00:00:00Z',
    isActive:false
  }
};

// ── Plan Type Config ──
const PLAN_TYPES = {
  monthly_unlimited: { icon:'ti-calendar', label:'Monthly', color:'#3B82F6' },
  session_pack: { icon:'ti-bolt', label:'Sessions', color:'#F59E0B' },
  time_limited: { icon:'ti-clock', label:'Time-Limited', color:'#8B5CF6' },
  pt_credits: { icon:'ti-barbell', label:'PT Credits', color:'#0D9488' },
  family: { icon:'ti-users', label:'Family', color:'#F97316' }
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

// ── MembershipStatusCard (Full) ──
function MembershipStatusCard({ membership }) {
  if (!membership) {
    return (
      <div className="msc" style={{padding:32,textAlign:'center',color:'var(--ltt)'}}>
        <i className="ti ti-id-badge-off" style={{fontSize:32,display:'block',marginBottom:8,color:'var(--ls4)'}}/>
        <div style={{fontSize:13}}>No active membership</div>
      </div>
    );
  }

  const s = membership.status?.toLowerCase() || 'active';
  const pt = PLAN_TYPES[membership.planType] || PLAN_TYPES.monthly_unlimited;
  const pct = membership.totalDays > 0
    ? Math.round(((membership.daysRemaining||0) / membership.totalDays) * 100) : 0;
  const sessPct = membership.totalSessions > 0
    ? Math.round((1 - (membership.sessionsUsed||0) / membership.totalSessions) * 100) : 0;

  const statusConfig = {
    active:    { icon:'ti-circle-check-filled', label:'Active' },
    frozen:    { icon:'ti-snowflake', label:'Frozen' },
    expired:   { icon:'ti-clock-x', label:'Expired' },
    pending:   { icon:'ti-clock-pause', label:'Pending' },
    cancelled: { icon:'ti-circle-x', label:'Cancelled' }
  }[s] || { icon:'ti-help', label:s };

  return (
    <div className={`msc ${s}`}>
      <div className="msc-top">
        <span className="msc-status">
          {s === 'pending' ? <span className="msc-spinner"/> : <i className={`ti ${statusConfig.icon}`}/>}
          {statusConfig.label}
        </span>
        <span className="msc-type"><i className={`ti ${pt.icon}`}/>{pt.label}</span>
      </div>
      <div className="msc-body">
        <div className={`msc-title ${s==='cancelled'?'msc-strike':''}`}>{membership.planName}</div>

        {/* Active: progress + sessions */}
        {s === 'active' && (
          <>
            <div className="msc-progress">
              <div className="msc-pbar"><div className="msc-pfill" style={{width:pct+'%'}}/></div>
              <div className="msc-pinfo">
                <span><strong>{membership.daysRemaining}</strong> / {membership.totalDays} days</span>
                <span>Expires {fmtDate(membership.endDate)}</span>
              </div>
            </div>
            {membership.totalSessions && (
              <div className="msc-sessions">
                <div className="msc-sessions-count">{membership.totalSessions - (membership.sessionsUsed||0)}</div>
                <div><div style={{fontSize:12,fontWeight:600}}>sessions left</div>
                  <div className="msc-sessions-label">{membership.sessionsUsed||0}/{membership.totalSessions} used</div>
                </div>
                <div className="msc-sessions-bar"><div className="msc-sessions-fill" style={{width:sessPct+'%'}}/></div>
              </div>
            )}
            <div className="msc-details">
              <div className="msc-row"><i className="ti ti-calendar-event"/> Started {fmtDate(membership.startDate)}</div>
            </div>
          </>
        )}

        {/* Frozen */}
        {s === 'frozen' && (
          <>
            <div className="msc-details">
              <div className="msc-row"><i className="ti ti-snowflake" style={{color:'var(--ice)'}}/> Frozen until <strong style={{marginLeft:4}}>{fmtDate(membership.freezeEndDate)}</strong></div>
              <div className="msc-row"><i className="ti ti-calendar-plus"/> Expiry extended to {fmtDate(membership.endDate)}</div>
            </div>
            <div className="msc-action"><button className="msc-btn ice"><i className="ti ti-flame"/> Unfreeze</button></div>
          </>
        )}

        {/* Expired */}
        {s === 'expired' && (
          <>
            <div className="msc-details">
              <div className="msc-row" style={{color:'var(--dng500)',fontWeight:600}}>
                <i className="ti ti-clock-x"/> Expired {membership.daysSinceExpiry} days ago
              </div>
              <div className="msc-row"><i className="ti ti-calendar-x"/> Ended {fmtDate(membership.endDate)}</div>
            </div>
            <div className="msc-action"><button className="msc-btn red"><i className="ti ti-refresh"/> Renew Now</button></div>
          </>
        )}

        {/* Pending */}
        {s === 'pending' && (
          <>
            <div className="msc-details">
              <div className="msc-row" style={{color:'var(--wrn500)'}}><i className="ti ti-hourglass"/> Awaiting payment confirmation</div>
              {membership.paymentMethod && (
                <div className="msc-row"><i className="ti ti-credit-card"/> via <strong style={{marginLeft:4}}>{membership.paymentMethod}</strong></div>
              )}
            </div>
            <div className="msc-note"><i className="ti ti-info-circle"/> Payment usually confirms within 24 hours</div>
          </>
        )}

        {/* Cancelled */}
        {s === 'cancelled' && (
          <>
            <div className="msc-details">
              <div className="msc-row"><i className="ti ti-calendar-minus"/> Cancelled on {fmtDate(membership.cancelledDate)}</div>
              <div className="msc-row"><i className="ti ti-calendar"/> Was valid until {fmtDate(membership.endDate)}</div>
            </div>
            <div className="msc-note"><i className="ti ti-info-circle"/> Contact gym to reactivate</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compact Variant ──
function MembershipStatusCardCompact({ membership }) {
  if (!membership) {
    return (
      <div className="msc-compact" style={{opacity:.5}}>
        <div className="mcc-status" style={{background:'var(--ls4)'}}/>
        <span className="mcc-plan" style={{color:'var(--ltt)'}}>No membership</span>
        <span className="mcc-badge cancelled">None</span>
      </div>
    );
  }
  const s = membership.status?.toLowerCase() || 'active';
  const pct = membership.totalDays > 0
    ? Math.round(((membership.daysRemaining||0)/membership.totalDays)*100) : 0;
  const barColor = { active:'var(--suc500)', frozen:'var(--ice)', expired:'var(--dng500)',
    pending:'var(--wrn500)', cancelled:'var(--ls4)' }[s] || 'var(--ls4)';

  const infoText = {
    active:  `${membership.daysRemaining}d left`,
    frozen:  `Until ${fmtDate(membership.freezeEndDate)}`,
    expired: `${membership.daysSinceExpiry||0}d ago`,
    pending: membership.paymentMethod || 'Pending',
    cancelled: fmtDate(membership.cancelledDate)
  }[s] || '';

  const infoIcon = {
    active:'ti-clock', frozen:'ti-snowflake', expired:'ti-clock-x',
    pending:'ti-hourglass', cancelled:'ti-calendar-x'
  }[s] || 'ti-clock';

  return (
    <div className="msc-compact">
      <div className={`mcc-status ${s}`}/>
      <span className={`mcc-plan ${s==='cancelled'?'msc-strike':''}`}>{membership.planName}</span>
      {s === 'active' && (
        <div className="mcc-bar"><div className="mcc-bar-fill" style={{width:pct+'%',background:barColor}}/></div>
      )}
      <span className="mcc-info"><i className={`ti ${infoIcon}`}/> {infoText}</span>
      <span className={`mcc-badge ${s}`}>{membership.status}</span>
    </div>
  );
}

// ── Demo App ──
function App() {
  const [compact, setCompact] = useState(false);
  const [activeStatus, setActiveStatus] = useState('all');
  const statuses = ['active', 'active_sessions', 'frozen', 'expired', 'pending', 'cancelled'];
  const filtered = activeStatus === 'all' ? statuses : statuses.filter(s => s.startsWith(activeStatus));

  return (
    <div>
      <div className="controls">
        <span className="ctrl-label">View:</span>
        <button className={`ctrl-btn ${!compact?'active':''}`} onClick={()=>setCompact(false)}>Full Cards</button>
        <button className={`ctrl-btn ${compact?'active':''}`} onClick={()=>setCompact(true)}>Compact</button>
        <div className="ctrl-sep"/>
        <span className="ctrl-label">Filter:</span>
        {['all','active','frozen','expired','pending','cancelled'].map(s=>(
          <button key={s} className={`ctrl-btn ${activeStatus===s?'active':''}`}
            onClick={()=>setActiveStatus(s)}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
        ))}
      </div>

      {!compact ? (
        <>
          <div className="section-title"><i className="ti ti-layout-grid"/> Full Card Variants</div>
          <div className="cards-grid">
            {filtered.map(key=>(
              <MembershipStatusCard key={key} membership={MOCK_MEMBERSHIPS[key]}/>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="section-title"><i className="ti ti-list"/> Compact Variants (Table Row)</div>
          <div className="compact-grid">
            {filtered.map(key=>(
              <MembershipStatusCardCompact key={key} membership={MOCK_MEMBERSHIPS[key]}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
