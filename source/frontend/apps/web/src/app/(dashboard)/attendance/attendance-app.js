/**
 * Attendance (§5 + §0.9) — barcode scan (MAC-P0) + manual check-in + today's dashboard + SignalR.
 *
 * Routes:
 *   POST /attendance/barcode-checkin — checkin.manual ; body { code } exact MemberNumber
 *   POST /attendance/manual-checkin  — checkin.manual ; reason numeric 1–4
 *   GET  /attendance/search-members  — checkin.manual
 *   GET  /attendance/today?filter=    — members.view (all|qr|manual|barcode)
 *   GET  /invitation/pending?q=       — checkin.manual (guest_pass desk redeem)
 *   POST /invitation/{id}/redeem-visit — checkin.manual (marks visited; no GymAttendance)
 * Hub: /hubs/attendance (JWT); server joins tenant-{tenantId}. Push is best-effort only.
 */
(function () {
  const Gfp = window.GfpApi;
  const Authz = window.GfpAuthz;

  function getUser() {
    if (Gfp && Gfp.tokens) return Gfp.tokens.getUser();
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  }

  const user = getUser();
  if (!user) {
    window.location.href = '/auth/login/';
    return;
  }

  const canViewToday = Authz ? Authz.useCan('members.view') : true;
  const canManual = Authz ? Authz.useCan('checkin.manual') : false;

  function markPrepareCheckin() {
    try {
      if (window.GfpPrepareGym && window.GfpPrepareGym.patchPrefs) {
        window.GfpPrepareGym.patchPrefs({ checkinObserved: true });
      }
    } catch (e) { /* ignore */ }
  }

  if (!canViewToday && !canManual) {
    window.location.href = '/dashboard/';
    return;
  }

  const ini = (user.fullName || 'U')
    .split(' ')
    .map(function (w) {
      return w[0];
    })
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const avatarEl = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  if (avatarEl) avatarEl.textContent = ini;
  if (nameEl) nameEl.textContent = user.fullName || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Staff';
  if (Authz && Authz.useCanRole('OwnerOnly')) {
    const ns = document.getElementById('navStaff');
    if (ns) ns.style.display = 'flex';
  }
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      stopSignalR();
      if (Gfp) Gfp.logout();
      else {
        ['gfp_access_token', 'gfp_refresh_token', 'gfp_user', 'gfp_expires_at'].forEach(function (k) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
        window.location.href = '/auth/login/';
      }
    });
  }

  // Gate check-in desk (barcode + manual share checkin.manual)
  const deskPanel = document.getElementById('deskPanel');
  if (!canManual && deskPanel) {
    const body = document.getElementById('deskBody');
    if (body) {
      body.innerHTML =
        '<div class="desk-locked">' +
        'Requires <code>checkin.manual</code> permission.<br>' +
        '<span style="font-family:var(--fa);direction:rtl;display:block;margin-top:6px">يتطلب صلاحية التسجيل اليدوي</span></div>';
    }
  }

  let currentFilter = 'all';
  let allRecords = [];
  let selectedMemberId = null;
  let selectedMemberData = null;
  let hubConnection = null;
  let reconcileTimer = null;

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
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

  function entryMethodLabel(m) {
    var k = String(m || '').toLowerCase();
    if (k === 'qr') return t('QR', 'QR');
    if (k === 'barcode' || k === 'card') return t('Card', 'كارنيه');
    if (k === 'manual') return t('Manual', 'يدوي');
    return m || '—';
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      d.getHours().toString().padStart(2, '0') +
      ':' +
      d.getMinutes().toString().padStart(2, '0')
    );
  }

  function initials(name) {
    return (name || '?')
      .split(' ')
      .map(function (w) {
        return w[0];
      })
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  const colors = [
    '#7ACC00',
    '#3B82F6',
    '#8B5CF6',
    '#F59E0B',
    '#EF4444',
    '#22D3EE',
    '#F97316',
    '#148F8F',
    '#EC4899'
  ];
  function avColor(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  /** Dual-shape + raw 429 string (bilingual "EN / AR") + { error } contract */
  function errMsg(r) {
    if (!r) return 'Request failed / فشل الطلب';
    if (r.status === 429) {
      const raw = r.data;
      if (typeof raw === 'string' && raw.trim()) {
        const parts = raw.split(/\s\/\s/);
        return (parts[0] || raw).trim() || 'Too many requests — slow down';
      }
      if (r.error && r.error.message) return r.error.message;
      return 'Too many requests — slow down / طلبات كثيرة جدًا';
    }
    if (r.error && typeof r.error === 'string') return r.error;
    if (r.error && r.error.message) return r.error.message;
    if (r.data) {
      if (typeof r.data === 'string') return r.data;
      if (typeof r.data.error === 'string') return r.data.error;
      return r.data.message || r.data.title || 'Request failed / فشل الطلب';
    }
    if (r.status === 401) return 'Unauthorized — please log in / غير مصرح';
    if (r.status === 403) return 'Not allowed / غير مسموح';
    return 'Request failed / فشل الطلب';
  }

  function focusBarcode() {
    const el = document.getElementById('barcodeScanInput');
    if (!el || el.disabled) return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  function setScanProcessing(on) {
    const el = document.getElementById('scanProcessing');
    if (el) el.hidden = !on;
  }

  /**
   * Prominent desk result from authoritative API fields only.
   * scannedCode is the value submitted (exact MemberNumber), not a forged API field.
   */
  function renderCheckinResult(opts) {
    const box = document.getElementById('checkinResult');
    if (!box) return;
    const ok = !!opts.ok;
    const data = opts.data || {};
    const method = (opts.method || '').toLowerCase();
    box.hidden = false;
    box.className = 'checkin-result ' + (ok ? 'ok' : 'err');

    if (!ok) {
      box.innerHTML =
        '<div class="checkin-result-top">' +
        '<div class="checkin-result-ico"><i class="ti ti-x"></i></div>' +
        '<div>' +
        '<div class="checkin-result-label">Check-in rejected · مرفوض</div>' +
        '<div class="checkin-result-msg">' +
        esc(opts.errorMsg || 'Check-in failed') +
        '</div>' +
        (opts.scannedCode
          ? '<div class="checkin-result-meta"><span>Code <strong dir="ltr">' +
            esc(opts.scannedCode) +
            '</strong></span></div>'
          : '') +
        '</div></div>';
      return;
    }

    const name = data.memberName || '';
    const nameAr = data.memberNameAr || '';
    const plan = data.planName || '';
    const planAr = data.planNameAr || '';
    const time = data.checkInAtUtc ? fmtTime(data.checkInAtUtc) : '—';
    const sessions =
      data.sessionsRemaining != null && data.sessionsRemaining !== ''
        ? data.sessionsRemaining
        : null;

    let meta =
      '<div class="checkin-result-meta">' +
      (opts.scannedCode
        ? '<span>No. <strong dir="ltr">' + esc(opts.scannedCode) + '</strong></span>'
        : '') +
      (opts.memberNumber && opts.memberNumber !== opts.scannedCode
        ? '<span>No. <strong dir="ltr">' + esc(opts.memberNumber) + '</strong></span>'
        : '') +
      '<span>Time <strong>' +
      esc(time) +
      '</strong></span>' +
      '<span>Method <strong>' +
      esc(method.toUpperCase() || '—') +
      '</strong></span>' +
      (plan ? '<span>Plan <strong>' + esc(plan) + '</strong></span>' : '') +
      '</div>';
    if (planAr) {
      meta +=
        '<div class="checkin-result-name-ar" style="font-size:12px;margin-top:6px">' +
        esc(planAr) +
        '</div>';
    }

    box.innerHTML =
      '<div class="checkin-result-top">' +
      '<div class="checkin-result-ico"><i class="ti ti-check"></i></div>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="checkin-result-label">Successful check-in · تم التسجيل</div>' +
      '<div class="checkin-result-name">' +
      esc(name) +
      '</div>' +
      (nameAr ? '<div class="checkin-result-name-ar">' + esc(nameAr) + '</div>' : '') +
      meta +
      (sessions != null
        ? '<div class="checkin-result-sessions">' +
          'Sessions remaining: <span dir="ltr">' +
          esc(String(sessions)) +
          '</span>' +
          ' · <span dir="rtl">الجلسات المتبقية: ' +
          esc(String(sessions)) +
          '</span></div>'
        : '') +
      (data.message
        ? '<div class="checkin-result-msg">' + esc(data.message) + '</div>'
        : '') +
      (data.messageAr
        ? '<div class="checkin-result-msg-ar">' + esc(data.messageAr) + '</div>'
        : '') +
      '</div></div>';
  }

  function clearCheckinResult() {
    const box = document.getElementById('checkinResult');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
      box.className = 'checkin-result';
    }
  }

  function hubBase() {
    const api = (window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api').replace(/\/$/, '');
    // Hub is sibling of /api → https://host/hubs/attendance
    if (/\/api$/i.test(api)) return api.replace(/\/api$/i, '') + '/hubs/attendance';
    try {
      return new URL(api, window.location.origin).origin + '/hubs/attendance';
    } catch (e) {
      return window.location.origin + '/hubs/attendance';
    }
  }

  function setSignalStatus(state) {
    const el = document.getElementById('signalStatus');
    if (!el) return;
    const map = {
      connected: ['online', 'Live'],
      reconnecting: ['warn', 'Reconnecting'],
      offline: ['offline', 'Offline'],
      unavailable: ['offline', 'No SignalR']
    };
    const v = map[state] || map.offline;
    el.innerHTML = '<span class="signal-dot ' + v[0] + '"></span>' + v[1];
    el.title =
      'Best-effort push only — dashboard reconciles via periodic GET /attendance/today';
  }

  // ── Today's attendance (source of truth) ──
  async function loadAttendance() {
    if (!canViewToday) {
      const tbody = document.getElementById('attBody');
      if (tbody)
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-msg">Needs members.view to load today\'s attendance</td></tr>';
      return;
    }
    if (!Gfp) return;
    const r = await Gfp.get('/attendance/today?filter=' + encodeURIComponent(currentFilter));
    if (!r.ok) {
      if (r.status === 429) toast(errMsg(r), 'error');
      // Keep optimistic rows on transient failure
      return;
    }
    allRecords = Array.isArray(r.data) ? r.data : [];
    renderTable(allRecords);
    updateLiveBar(allRecords);
  }

  function updateLiveBar(records) {
    const total = records.length;
    const inGym = records.filter(function (r) {
      return !r.checkOutAtUtc;
    }).length;
    const qr = records.filter(function (r) {
      return (r.entryMethod || '').toLowerCase() === 'qr';
    }).length;
    const manual = records.filter(function (r) {
      return (r.entryMethod || '').toLowerCase() === 'manual';
    }).length;
    const barcode = records.filter(function (r) {
      return (r.entryMethod || '').toLowerCase() === 'barcode';
    }).length;

    document.getElementById('liveCount').textContent = total;
    document.getElementById('qrCount').textContent = qr;
    document.getElementById('manualCount').textContent = manual;
    const barcodeEl = document.getElementById('barcodeCount');
    if (barcodeEl) barcodeEl.textContent = barcode;
    document.getElementById('currentlyIn').textContent = inGym;
    document.getElementById('recordCount').textContent =
      total === 1
        ? t('1 record', 'سجل واحد')
        : t('{n} records', '{n} سجل').replace('{n}', String(total));

    const hours = {};
    records.forEach(function (r) {
      if (r.checkInAtUtc) {
        const h = new Date(r.checkInAtUtc).getHours();
        hours[h] = (hours[h] || 0) + 1;
      }
    });
    let peakH = -1,
      peakV = 0;
    Object.keys(hours).forEach(function (h) {
      if (hours[h] > peakV) {
        peakH = parseInt(h, 10);
        peakV = hours[h];
      }
    });
    const peakInfo = document.getElementById('peakInfo');
    if (peakH >= 0) {
      const end = (peakH + 1) % 24;
      peakInfo.innerHTML =
        '<i class="ti ti-chart-arrows-vertical"></i>' +
        esc(t('Peak', 'الذروة')) +
        ': <strong dir="ltr">' +
        peakH.toString().padStart(2, '0') +
        ':00–' +
        end.toString().padStart(2, '0') +
        ':00</strong>';
    } else {
      peakInfo.innerHTML =
        '<i class="ti ti-chart-arrows-vertical"></i>' +
        esc(t('Peak', 'الذروة')) +
        ': <strong dir="ltr">—</strong>';
    }
  }

  function renderTable(records) {
    const tbody = document.getElementById('attBody');
    if (!records.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-msg"><i class="ti ti-mood-empty" style="font-size:32px;display:block;margin-bottom:8px;color:var(--ls4)"></i>' +
        '<strong>' + esc(t('No check-ins today', 'لا يوجد حضور اليوم')) + '</strong>' +
        '<div style="margin-top:6px;font-size:12px;color:var(--ltt);font-weight:400">' +
        esc(t(
          'A member with a valid covering membership can be checked in here. Cash sales need an open shift first.',
          'يمكن تسجيل حضور عضو لديه عضوية سارية من هنا. البيع النقدي يحتاج وردية مفتوحة أولاً.'
        )) +
        ' <a href="/dashboard/members/">' + esc(t('Open members', 'فتح الأعضاء')) + '</a></div>' +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = records
      .map(function (r, i) {
        const method = (r.entryMethod || 'qr').toLowerCase();
        const isIn = !r.checkOutAtUtc;
        const bg = avColor(r.memberName);
        return (
          '<tr class="' +
          (i === 0 ? 'new-row' : '') +
          '">' +
          '<td><div class="member-cell">' +
          '<div class="member-av" style="background:' +
          bg +
          '20;color:' +
          bg +
          '">' +
          initials(r.memberName) +
          '</div>' +
          '<div><div class="member-name">' +
          esc(r.memberName) +
          '</div><div class="member-num">' +
          esc(r.memberNumber || '') +
          '</div></div>' +
          '</div></td>' +
          '<td><span class="time-cell" dir="ltr">' +
          fmtTime(r.checkInAtUtc) +
          '</span></td>' +
          '<td><span class="method-badge ' +
          method +
          '"><i class="ti ' +
          (method === 'qr'
            ? 'ti-qrcode'
            : method === 'barcode'
              ? 'ti-barcode'
              : 'ti-hand-stop') +
          '"></i>' +
          esc(entryMethodLabel(method)) +
          '</span></td>' +
          '<td><span class="plan-cell">' +
          esc(r.planName || '—') +
          '</span></td>' +
          '<td>' +
          (isIn
            ? '<span class="status-in"><i class="ti ti-login"></i>' + esc(t('IN', 'داخل')) + '</span>'
            : '<span class="status-out"><i class="ti ti-logout"></i><span dir="ltr">' +
              fmtTime(r.checkOutAtUtc) +
              '</span></span>') +
          '</td></tr>'
        );
      })
      .join('');
  }

  document.querySelectorAll('.filter-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach(function (t) {
        t.classList.remove('active');
      });
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      loadAttendance();
    });
  });

  // ── Optimistic merge from SignalR (best-effort) ──
  function mergeCheckedInEvent(evt) {
    if (!evt) return;
    const checkInAtUtc = evt.checkInAtUtc || evt.checkInTime || new Date().toISOString();
    const memberId = evt.memberId;
    const attendanceId = evt.attendanceId || null;
    const entryMethod = (evt.entryMethod || 'qr').toLowerCase();

    // Respect active filter
    if (currentFilter !== 'all' && currentFilter !== entryMethod) return;

    const already = allRecords.some(function (r) {
      if (attendanceId && r.id === attendanceId) return true;
      if (!memberId) return false;
      if (String(r.memberId) !== String(memberId)) return false;
      if (r.checkOutAtUtc) return false;
      const a = new Date(r.checkInAtUtc).getTime();
      const b = new Date(checkInAtUtc).getTime();
      return Math.abs(a - b) < 120000; // 2 min window
    });
    if (already) return;

    allRecords.unshift({
      id: attendanceId || 'live-' + memberId + '-' + Date.now(),
      memberId: memberId,
      memberNumber: evt.memberNumber || '',
      memberName: evt.memberName || 'Member',
      memberNameAr: evt.memberNameAr || '',
      checkInAtUtc: checkInAtUtc,
      checkOutAtUtc: null,
      entryMethod: entryMethod,
      planName: evt.planName || null
    });
    renderTable(allRecords);
    updateLiveBar(allRecords);
  }

  function stopSignalR() {
    if (hubConnection) {
      try {
        hubConnection.stop();
      } catch (e) {}
      hubConnection = null;
    }
  }

  async function startSignalR() {
    if (!window.signalR || !window.signalR.HubConnectionBuilder) {
      setSignalStatus('unavailable');
      return;
    }
    const token = Gfp && Gfp.tokens ? Gfp.tokens.getAccess() : null;
    if (!token) {
      setSignalStatus('offline');
      return;
    }

    stopSignalR();
    hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubBase(), {
        accessTokenFactory: function () {
          return (Gfp && Gfp.tokens && Gfp.tokens.getAccess()) || token;
        }
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hubConnection.on('MemberCheckedIn', function (payload) {
      mergeCheckedInEvent(payload);
    });

    hubConnection.onreconnecting(function () {
      setSignalStatus('reconnecting');
    });
    hubConnection.onreconnected(function () {
      setSignalStatus('connected');
      // Reconcile after reconnect — push may have been missed
      loadAttendance();
    });
    hubConnection.onclose(function () {
      setSignalStatus('offline');
    });

    try {
      await hubConnection.start();
      setSignalStatus('connected');
    } catch (e) {
      console.warn('SignalR connect failed (dashboard still uses polling)', e);
      setSignalStatus('offline');
    }
  }

  // ── Manual check-in search ──
  if (canManual) {
    const searchInput = document.getElementById('memberSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        const q = this.value.trim();
        if (q.length < 2) {
          searchResults.classList.remove('show');
          return;
        }
        searchTimeout = setTimeout(function () {
          searchMembers(q);
        }, 300);
      });
    }

    async function searchMembers(query) {
      if (!Gfp) return;
      const r = await Gfp.get(
        '/attendance/search-members?query=' + encodeURIComponent(query)
      );
      if (!r.ok) {
        searchResults.innerHTML =
          '<div style="padding:16px;text-align:center;color:var(--dng500);font-size:12px">' +
          esc(errMsg(r)) +
          '</div>';
        searchResults.classList.add('show');
        return;
      }
      const members = Array.isArray(r.data) ? r.data : [];
      if (!members.length) {
        searchResults.innerHTML =
          '<div style="padding:16px;text-align:center;color:var(--ltt);font-size:12px">No members found</div>';
        searchResults.classList.add('show');
        return;
      }
      searchResults.innerHTML = members
        .map(function (m) {
          const sel = m.isSelectable !== false;
          const bg = avColor(m.fullName);
          const status = m.membershipStatus || '';
          const statusClass = status.toLowerCase().includes('active')
            ? 'active'
            : status.toLowerCase().includes('frozen')
              ? 'frozen'
              : status.toLowerCase().includes('scheduled')
                ? 'frozen'
                : 'expired';
          const statusLabel = status
            ? status.toLowerCase() === 'scheduled'
              ? 'SCHEDULED'
              : status.toUpperCase()
            : '';
          const reasonEn = m.unselectableReason || 'Not eligible';
          const reasonAr = m.unselectableReasonAr || '';
          const reasonHtml = !sel
            ? '<div class="sr-reason">' +
              esc(reasonEn) +
              (reasonAr
                ? '<div class="sr-reason-ar" style="font-family:var(--fa);direction:rtl;margin-top:2px">' +
                  esc(reasonAr) +
                  '</div>'
                : '') +
              '</div>'
            : '';
          return (
            '<div class="sr-item ' +
            (sel ? '' : 'disabled') +
            '" data-id="' +
            m.id +
            '" data-name="' +
            esc(m.fullName || '') +
            '" data-plan="' +
            esc(m.planName || '') +
            '" data-status="' +
            esc(status) +
            '" data-number="' +
            esc(m.memberNumber || '') +
            '" data-plan-type="' +
            esc(m.planType || '') +
            '" data-sessions="' +
            (m.sessionsRemaining != null ? m.sessionsRemaining : '') +
            '" data-selectable="' +
            sel +
            '" data-reason="' +
            esc(reasonEn) +
            '" data-reason-ar="' +
            esc(reasonAr) +
            '">' +
            '<div class="sr-av" style="background:' +
            bg +
            '20;color:' +
            bg +
            '">' +
            initials(m.fullName) +
            '</div>' +
            '<div class="sr-info">' +
            '<div class="sr-name">' +
            esc(m.fullName) +
            '</div>' +
            '<div class="sr-meta">' +
            esc(m.memberNumber || '') +
            (m.planName ? ' · ' + esc(m.planName) : '') +
            (m.planType === 'session_pack' && m.sessionsRemaining != null
              ? ' · ' + m.sessionsRemaining + ' left'
              : '') +
            '</div>' +
            reasonHtml +
            '</div>' +
            (statusLabel
              ? '<span class="sr-status ' + statusClass + '">' + esc(statusLabel) + '</span>'
              : '') +
            '</div>'
          );
        })
        .join('');
      searchResults.classList.add('show');

      searchResults.querySelectorAll('.sr-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (this.dataset.selectable === 'false') {
            const en = this.dataset.reason || 'Member not eligible';
            const ar = this.dataset.reasonAr || '';
            toast(ar ? en + ' / ' + ar : en, 'error');
            return;
          }
          selectMember({
            id: this.dataset.id,
            name: this.dataset.name,
            plan: this.dataset.plan,
            status: this.dataset.status,
            number: this.dataset.number,
            planType: this.dataset.planType || '',
            sessionsRemaining:
              this.dataset.sessions !== '' && this.dataset.sessions != null
                ? parseInt(this.dataset.sessions, 10)
                : null
          });
        });
      });
    }

    function selectMember(m) {
      selectedMemberId = m.id;
      selectedMemberData = m;
      searchResults.classList.remove('show');
      searchInput.value = '';

      const bg = avColor(m.name);
      const sess =
        m.planType === 'session_pack' && m.sessionsRemaining != null
          ? ' · ' + m.sessionsRemaining + ' sessions left'
          : '';
      document.getElementById('selectedMember').style.display = 'flex';
      document.getElementById('selectedMember').innerHTML =
        '<div class="sel-av" style="background:' +
        bg +
        ';color:#fff">' +
        initials(m.name) +
        '</div>' +
        '<div class="sel-info"><div class="sel-name">' +
        esc(m.name) +
        '</div><div class="sel-detail">' +
        esc(m.number) +
        ' · ' +
        esc(m.plan || 'No plan') +
        ' · ' +
        esc(m.status || '') +
        sess +
        '</div></div>' +
        '<button class="sel-remove" id="removeSelection"><i class="ti ti-x"></i></button>';
      document.getElementById('removeSelection').addEventListener('click', clearSelection);

      document.getElementById('reasonSection').style.display = 'block';
      document.getElementById('btnCheckin').disabled = false;
      clearCheckinResult();
    }

    function clearSelection() {
      selectedMemberId = null;
      selectedMemberData = null;
      document.getElementById('selectedMember').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('btnCheckin').disabled = true;
      const notes = document.getElementById('notes');
      if (notes) notes.value = '';
    }

    document.querySelectorAll('.reason-card').forEach(function (card) {
      card.addEventListener('click', function () {
        document.querySelectorAll('.reason-card').forEach(function (c) {
          c.classList.remove('selected');
        });
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        const val = this.querySelector('input').value;
        document.getElementById('notesField').style.display = val === '4' ? 'block' : 'none';
      });
    });

    // MAC-P0 — desk barcode scan (exact MemberNumber → barcode-checkin)
    const barcodeInput = document.getElementById('barcodeScanInput');
    let barcodeBusy = false;
    let manualBusy = false;

    async function submitBarcodeScan() {
      if (!barcodeInput || !Gfp || barcodeBusy) return;
      const code = (barcodeInput.value || '').trim();
      if (!code) return;

      barcodeBusy = true;
      barcodeInput.disabled = true;
      setScanProcessing(true);

      const res = await Gfp.post('/attendance/barcode-checkin', { code: code });

      barcodeInput.value = '';
      barcodeInput.disabled = false;
      barcodeBusy = false;
      setScanProcessing(false);
      focusBarcode();

      if (res && res.ok) {
        markPrepareCheckin();
        // Soft toast only — do not steal focus from scanner
        toast(
          (res.data && (res.data.message || res.data.messageAr)) || 'Check-in successful!',
          'success'
        );
        try {
          if (globalThis.GfpAnalytics && typeof globalThis.GfpAnalytics.track === 'function') {
            globalThis.GfpAnalytics.track('checkin_completed', { method: 'barcode' });
          }
        } catch (_) { /* ignore */ }
        renderCheckinResult({
          ok: true,
          method: 'barcode',
          data: res.data,
          scannedCode: code
        });
        if (res.data) {
          mergeCheckedInEvent({
            attendanceId: res.data.attendanceId,
            memberId: res.data.memberId,
            memberName: res.data.memberName,
            memberNameAr: res.data.memberNameAr,
            memberNumber: code,
            checkInAtUtc: res.data.checkInAtUtc,
            entryMethod: 'barcode',
            planName: res.data.planName
          });
        }
        loadAttendance();
      } else {
        const msg = errMsg(res);
        renderCheckinResult({
          ok: false,
          method: 'barcode',
          errorMsg: msg,
          scannedCode: code
        });
        toast(msg, 'error');
      }
      focusBarcode();
    }

    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitBarcodeScan();
        }
      });
      setTimeout(focusBarcode, 200);
    }

    document.getElementById('btnCheckin').addEventListener('click', async function () {
      if (!selectedMemberId || !Gfp || manualBusy || barcodeBusy) return;
      const reasonInput = document.querySelector('input[name="reason"]:checked');
      const reason = parseInt(reasonInput && reasonInput.value, 10);
      if (!(reason >= 1 && reason <= 4)) {
        toast('Select a reason (1–4)', 'error');
        return;
      }
      const notes = (document.getElementById('notes') && document.getElementById('notes').value.trim()) || '';
      if (reason === 4 && !notes) {
        toast('Notes are required for "Other" / الملاحظات مطلوبة لـ «أخرى»', 'error');
        document.getElementById('notesField').style.display = 'block';
        document.getElementById('notes')?.focus();
        return;
      }

      manualBusy = true;
      this.disabled = true;
      this.innerHTML =
        '<i class="ti ti-loader-2 spin"></i> Checking in...';

      const body = { memberId: selectedMemberId, reason: reason };
      if (reason === 4 || notes) body.notes = notes;
      const memberNumber = selectedMemberData && selectedMemberData.number;

      const res = await Gfp.post('/attendance/manual-checkin', body);
      if (res && res.ok) {
        markPrepareCheckin();
        toast((res.data && (res.data.message || res.data.messageAr)) || 'Check-in successful!');
        try {
          if (globalThis.GfpAnalytics && typeof globalThis.GfpAnalytics.track === 'function') {
            globalThis.GfpAnalytics.track('checkin_completed', { method: 'manual' });
          }
        } catch (_) { /* ignore */ }
        renderCheckinResult({
          ok: true,
          method: 'manual',
          data: res.data,
          memberNumber: memberNumber,
          scannedCode: memberNumber
        });
        document.getElementById('selectedMember').style.display = 'none';
        document.getElementById('reasonSection').style.display = 'none';
        if (res.data) {
          mergeCheckedInEvent({
            attendanceId: res.data.attendanceId,
            memberId: selectedMemberId,
            memberName: res.data.memberName || selectedMemberData?.name,
            memberNameAr: res.data.memberNameAr,
            memberNumber: memberNumber,
            checkInAtUtc: res.data.checkInAtUtc,
            entryMethod: 'manual',
            planName: res.data.planName || selectedMemberData?.plan
          });
        }
        selectedMemberId = null;
        selectedMemberData = null;
        loadAttendance();
        focusBarcode();
      } else {
        const msg = errMsg(res);
        renderCheckinResult({
          ok: false,
          method: 'manual',
          errorMsg: msg,
          scannedCode: memberNumber
        });
        toast(msg, 'error');
      }
      manualBusy = false;
      this.disabled = false;
      this.innerHTML = '<i class="ti ti-login"></i> Check In';
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) searchResults.classList.remove('show');
    });
  }

  // ── Heatmap (members.view analytics — optional panel) ──
  async function loadHeatmap() {
    if (!canViewToday || !Gfp) return;
    const r = await Gfp.get('/analytics/heatmap');
    // API returns AttendanceHeatmapDto: { data: int[7][24] } — not a bare array.
    const matrix = r.ok && r.data ? r.data.data : null;
    renderHeatmap(Array.isArray(matrix) ? matrix : null);
  }

  function renderHeatmap(data) {
    const wrap = document.getElementById('heatmapWrap');
    if (!wrap) return;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const grid =
      Array.isArray(data) && data.length === 7
        ? data
        : days.map(function () {
            return new Array(24).fill(0);
          });

    let max = 1;
    grid.forEach(function (row) {
      (Array.isArray(row) ? row : []).forEach(function (v) {
        if (v > max) max = v;
      });
    });

    let html = '<div class="heatmap">';
    grid.forEach(function (row, di) {
      html += '<div class="hm-row"><span class="hm-label">' + days[di] + '</span>';
      (Array.isArray(row) ? row : new Array(24).fill(0)).forEach(function (val, hi) {
        const intensity = val / max;
        const bg =
          intensity === 0 ? 'var(--ls3)' : 'rgba(122,204,0,' + (0.15 + intensity * 0.85) + ')';
        html +=
          '<div class="hm-cell" style="background:' +
          bg +
          '" data-day="' +
          days[di] +
          '" data-hour="' +
          hi +
          '" data-val="' +
          val +
          '"></div>';
      });
      html += '</div>';
    });
    html += '<div class="hm-hours">';
    for (let h = 0; h < 24; h++) {
      const show = h % 6 === 0 || h === 23;
      html += '<span class="hm-hour-label">' + (show ? h + 'h' : '') + '</span>';
    }
    html += '</div></div>';
    wrap.innerHTML = html;

    const tooltip = document.createElement('div');
    tooltip.className = 'hm-tooltip';
    document.body.appendChild(tooltip);
    wrap.querySelectorAll('.hm-cell').forEach(function (cell) {
      cell.addEventListener('mouseenter', function (e) {
        tooltip.textContent =
          this.dataset.day +
          ' ' +
          parseInt(this.dataset.hour, 10).toString().padStart(2, '0') +
          ':00 — ' +
          this.dataset.val +
          ' check-ins';
        tooltip.style.display = 'block';
        tooltip.style.left = e.clientX + 12 + 'px';
        tooltip.style.top = e.clientY - 30 + 'px';
      });
      cell.addEventListener('mousemove', function (e) {
        tooltip.style.left = e.clientX + 12 + 'px';
        tooltip.style.top = e.clientY - 30 + 'px';
      });
      cell.addEventListener('mouseleave', function () {
        tooltip.style.display = 'none';
      });
    });
  }

  // Init: reconcile poll is source of truth; SignalR is optimistic only
  setSignalStatus('offline');
  loadAttendance();
  loadHeatmap();
  startSignalR();
  reconcileTimer = setInterval(loadAttendance, 15000);
  window.addEventListener('gfp:locale', function () {
    if (window.GfpI18n && window.GfpI18n.applyDocumentLocale) window.GfpI18n.applyDocumentLocale();
    renderTable(allRecords || []);
    updateLiveBar(allRecords || []);
  });

  // ── Guest invite redeem (INV-2) — no GymMember / attendance row ──
  (function initGuestInviteRedeem() {
    const card = document.getElementById('guestInviteCard');
    if (!card || card.hidden) return;

    if (!canManual) {
      card.innerHTML =
        '<div class="panel-header"><h2 class="panel-title"><i class="ti ti-lock"></i> Guest invite redeem</h2></div>' +
        '<div class="checkin-body" style="padding:24px;color:var(--ltt);font-size:13px">' +
        'Requires <code>checkin.manual</code> permission.<br>' +
        '<span style="font-family:var(--fa);direction:rtl;display:block;margin-top:6px">يتطلب صلاحية التسجيل اليدوي</span></div>';
      return;
    }

    const searchInput = document.getElementById('guestInviteSearch');
    const resultsEl = document.getElementById('guestInviteResults');
    const selectedEl = document.getElementById('selectedGuestInvite');
    const btnRedeem = document.getElementById('btnRedeemGuest');
    const successEl = document.getElementById('guestRedeemSuccess');
    let selectedInvite = null;
    let guestSearchTimeout;

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(guestSearchTimeout);
        const q = this.value.trim();
        selectedInvite = null;
        if (selectedEl) selectedEl.style.display = 'none';
        if (btnRedeem) {
          btnRedeem.style.display = 'none';
          btnRedeem.disabled = true;
        }
        if (successEl) successEl.style.display = 'none';
        if (q.length < 2) {
          resultsEl.classList.remove('show');
          return;
        }
        guestSearchTimeout = setTimeout(function () {
          searchPendingGuests(q);
        }, 300);
      });
    }

    async function searchPendingGuests(query) {
      if (!Gfp) return;
      const r = await Gfp.get('/invitation/pending?q=' + encodeURIComponent(query));
      if (!r.ok) {
        resultsEl.innerHTML =
          '<div style="padding:16px;text-align:center;color:var(--dng500);font-size:12px">' +
          esc(errMsg(r)) +
          '</div>';
        resultsEl.classList.add('show');
        return;
      }
      const rows = Array.isArray(r.data) ? r.data : [];
      if (!rows.length) {
        resultsEl.innerHTML =
          '<div style="padding:16px;text-align:center;color:var(--ltt);font-size:12px">No pending guest invites</div>';
        resultsEl.classList.add('show');
        return;
      }
      resultsEl.innerHTML = rows
        .map(function (inv) {
          const visit = inv.visitDate || inv.VisitDate || '—';
          const name = inv.guestName || inv.GuestName || '';
          const phone = inv.guestPhoneNumber || inv.GuestPhoneNumber || '';
          const host = inv.invitingMemberName || inv.InvitingMemberName || '';
          const hostNum = inv.invitingMemberNumber || inv.InvitingMemberNumber || '';
          const id = inv.id || inv.Id;
          return (
            '<div class="sr-item" data-id="' +
            id +
            '" data-name="' +
            esc(name) +
            '" data-phone="' +
            esc(phone) +
            '" data-visit="' +
            esc(String(visit)) +
            '" data-host="' +
            esc(host) +
            '" data-host-num="' +
            esc(hostNum) +
            '">' +
            '<div class="sr-av" style="background:var(--orange100);color:var(--orange)">' +
            esc(initials(name)) +
            '</div>' +
            '<div class="sr-info"><div class="sr-name">' +
            esc(name) +
            '</div>' +
            '<div class="sr-meta">' +
            esc(phone) +
            ' · visit ' +
            esc(String(visit)) +
            '</div>' +
            '<div class="sr-meta" style="margin-top:2px">Host: ' +
            esc(host) +
            (hostNum ? ' (' + esc(hostNum) + ')' : '') +
            '</div></div></div>'
          );
        })
        .join('');
      resultsEl.classList.add('show');

      resultsEl.querySelectorAll('.sr-item').forEach(function (el) {
        el.addEventListener('click', function () {
          selectedInvite = {
            id: this.getAttribute('data-id'),
            name: this.getAttribute('data-name'),
            phone: this.getAttribute('data-phone'),
            visit: this.getAttribute('data-visit'),
            host: this.getAttribute('data-host')
          };
          resultsEl.classList.remove('show');
          if (searchInput) searchInput.value = selectedInvite.name;
          selectedEl.innerHTML =
            '<div class="sel-av" style="background:var(--orange100);color:var(--orange)">' +
            esc(initials(selectedInvite.name)) +
            '</div><div class="sel-info"><div class="sel-name">' +
            esc(selectedInvite.name) +
            '</div><div class="sel-detail">' +
            esc(selectedInvite.phone) +
            ' · ' +
            esc(selectedInvite.visit) +
            '</div><div class="sel-detail">Host: ' +
            esc(selectedInvite.host) +
            '</div></div>';
          selectedEl.style.display = 'flex';
          btnRedeem.style.display = 'flex';
          btnRedeem.disabled = false;
          if (successEl) successEl.style.display = 'none';
        });
      });
    }

    if (btnRedeem) {
      btnRedeem.addEventListener('click', async function () {
        if (!selectedInvite || !Gfp) return;
        btnRedeem.disabled = true;
        const r = await Gfp.post(
          '/invitation/' + encodeURIComponent(selectedInvite.id) + '/redeem-visit',
          {}
        );
        if (!r.ok) {
          toast(errMsg(r), 'error');
          btnRedeem.disabled = false;
          return;
        }
        const data = r.data || {};
        toast(data.messageAr || data.message || 'Guest visit recorded', 'success');
        successEl.innerHTML =
          '<i class="ti ti-circle-check"></i><div><strong>' +
          esc(data.guestName || selectedInvite.name) +
          '</strong> marked visited<br><span style="font-size:12px;color:var(--ltt)">No membership check-in row created</span></div>';
        successEl.style.display = 'flex';
        selectedEl.style.display = 'none';
        btnRedeem.style.display = 'none';
        selectedInvite = null;
        if (searchInput) searchInput.value = '';
      });
    }
  })();
})();
