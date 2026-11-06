/**
 * Backup & Recovery — owner-first Local Edition page (OwnerOnly).
 * Restore stays a PC command (API cannot stop its own Windows service).
 */
(function () {
  'use strict';
  var API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
  var healthState = null;
  var historyState = [];
  var restoreTarget = null;
  var savePollTimer = null;
  var saving = false;
  var seenBackupAt = null;

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return (I18n && I18n.getLocale && I18n.getLocale() === 'ar') ? (ar || en) : (en || ar);
  }

  function dateLocale() {
    var I18n = window.GfpI18n;
    return (I18n && I18n.getLocale && I18n.getLocale() === 'ar') ? 'ar-EG' : 'en-GB';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function getToken() {
    try {
      if (window.GfpApi && window.GfpApi.tokens && window.GfpApi.tokens.getAccess) {
        return window.GfpApi.tokens.getAccess();
      }
      return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
    } catch (e) { return null; }
  }

  function getH() {
    var tok = getToken();
    var h = { 'Content-Type': 'application/json' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }

  async function api(method, path) {
    var res = await fetch(API_BASE + path, { method: method, headers: getH() });
    if (res.status === 401) { location.href = '/auth/login/'; return { ok: false, status: 401, data: null }; }
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('json') !== -1) data = await res.json().catch(function () { return null; });
    return { ok: res.ok, status: res.status, data: data };
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(dateLocale(), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return iso;
    }
  }

  function copyText(text) {
    var value = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function friendlyApiMessage(msg) {
    var m = String(msg || '');
    if (/Backup script not found/i.test(m)) {
      return t(
        'Save did not start because backup files are missing on this PC. Call HyMotion.',
        'الحفظ ما بدأش لأن ملفات النسخ مش على الجهاز. كلّم HyMotion.'
      );
    }
    if (/Could not start backup/i.test(m)) {
      return t('Could not start a save.', 'مش قادرين نبدأ الحفظ.');
    }
    if (/Backup started/i.test(m)) {
      return t('Saving a copy now. Stay on this page.', 'بيحفظ نسخة دلوقتي. استنى على الصفحة.');
    }
    return m;
  }

  function ownerFailure(text) {
    var s = String(text || '');
    if (/CREATE DATABASE permission denied/i.test(s) || /VERIFY DATABASE is terminating/i.test(s)) {
      return t(
        'A copy was written, but we could not fully check it. Save a new copy. If it fails again, call HyMotion.',
        'اتكتبت نسخة، بس مقدرتش نتأكد منها بالكامل. احفظ نسخة جديدة. لو فشلت تاني، كلّم HyMotion.'
      );
    }
    if (/Backup script not found/i.test(s)) {
      return t(
        'Save did not start because backup files are missing on this PC. Call HyMotion.',
        'الحفظ ما بدأش لأن ملفات النسخ مش على الجهاز. كلّم HyMotion.'
      );
    }
    return t(
      'A save did not finish. Try Save a copy now. If it fails again, call HyMotion.',
      'الحفظ ما كملش. جرّب احفظ نسخة دلوقتي. لو فشلت تاني، كلّم HyMotion.'
    );
  }

  function setBanner(kind, text) {
    var el = document.getElementById('bkBanner');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-err', 'is-ok');
      return;
    }
    el.classList.toggle('is-err', kind === 'err');
    el.classList.toggle('is-ok', kind === 'ok');
    el.innerHTML = '<i class="ti ' +
      (kind === 'err' ? 'ti-alert-circle' : (kind === 'ok' ? 'ti-circle-check' : 'ti-alert-triangle')) +
      '" aria-hidden="true"></i><p>' + esc(text) + '</p>';
    el.hidden = false;
  }

  function showToast(msg, type) {
    if (typeof globalThis.toastShared === 'function') {
      globalThis.toastShared(msg, type === 'err' ? 'err' : 'ok');
      return;
    }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 4000);
  }

  function statusLabel(status) {
    switch (status) {
      case 'Healthy': return t('Looks good', 'تمام');
      case 'Warning': return t('Needs a check', 'محتاج مراجعة');
      case 'Critical': return t('No copy yet', 'لسه مفيش نسخة');
      case 'Failed': return t('Cannot use', 'مش تتنفع');
      case 'Partial': return t('Incomplete', 'ناقصة');
      case 'Running': return t('Saving…', 'بيحفظ…');
      default: return status || '—';
    }
  }

  function typeLabel(kind) {
    var k = String(kind || '').toLowerCase();
    if (k === 'manual' || k === 'on-demand' || k === 'ondemand') return t('You saved it', 'أنت حفظتها');
    if (k === 'scheduled' || k === 'nightly' || k === 'automatic') return t('Nightly', 'ليلي');
    return kind || '—';
  }

  function helperUrl(action, backupId) {
    var url = 'hymotion-backup:' + action;
    if (backupId) url += '?id=' + encodeURIComponent(String(backupId));
    return url;
  }

  function openBackupHelper(action, backupId) {
    var url = helperUrl(action, backupId);
    var fallback = document.getElementById('restoreFallback');
    try {
      window.location.href = url;
      showToast(t('Windows may ask to open HyMotion Backup. Allow it.', 'ويندوز ممكن يطلب فتح HyMotion Backup. اسمح له.'), 'ok');
      if (fallback && action === 'restore') fallback.hidden = false;
    } catch (e) {
      showToast(t('Open Start → HyMotion Backup.', 'افتح ابدأ ← HyMotion Backup.'), 'err');
      if (fallback) fallback.hidden = false;
    }
  }

  function canRestore(row) {
    return row && (row.status === 'Healthy' || row.status === 'Partial');
  }

  function setBackupBtn(mode) {
    var btn = document.getElementById('btnBackupNow');
    if (!btn) return;
    if (mode === 'saving') {
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader-2"></i> ' + esc(t('Saving…', 'بيحفظ…'));
      return;
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-database-export"></i> <span>' + esc(t('Save a copy now', 'احفظ نسخة دلوقتي')) + '</span>';
  }

  function paintHero(h) {
    var card = document.getElementById('heroCard');
    if (!card || !h) return;

    var kind = 'warn';
    var icon = 'ti-alert-circle';
    var title = t('Saved, with one thing to do', 'محفوظ، وفيه حاجة ناقصة');
    var body = t(
      'There is a copy on this PC. Finish the USB step, or save again if the last copy is not marked Looks good.',
      'فيه نسخة على الجهاز. كمّل خطوة الـ USB، أو احفظ تاني لو آخر نسخة مش مكتوب عليها تمام.'
    );

    if (!h.lastBackupAtUtc || h.overallStatus === 'Critical') {
      kind = 'bad';
      icon = 'ti-alert-triangle';
      title = t('No saved copy yet', 'لسه مفيش نسخة محفوظة');
      body = t(
        'Click Save a copy now. That keeps members, sales, and photos on this PC.',
        'اضغط احفظ نسخة دلوقتي. ده بيحفظ الأعضاء والمبيعات والصور على الجهاز.'
      );
    } else if (h.lastBackupStatus === 'Failed') {
      kind = 'bad';
      icon = 'ti-alert-triangle';
      title = t('Last save did not work', 'آخر حفظ ما اشتغلش');
      body = ownerFailure((h.recentFailures && h.recentFailures[0]) || '');
    } else if (h.lastBackupStatus === 'Partial') {
      kind = 'warn';
      icon = 'ti-alert-circle';
      title = t('Last copy is incomplete', 'آخر نسخة ناقصة');
      body = t(
        'The gym data was saved, but some photos or files were skipped. Save again when you can.',
        'بيانات النادي اتحفظت، بس بعض الصور أو الملفات اتعدّت. احفظ تاني لما تقدر.'
      );
    } else if (h.overallStatus === 'Healthy') {
      kind = 'ok';
      icon = 'ti-shield-check';
      title = t('Your gym is saved', 'ناديكم محفوظ');
      body = t('Last copy: ', 'آخر نسخة: ') + fmtDate(h.lastBackupAtUtc);
    } else if (h.lastBackupAtUtc) {
      body = t('Last copy: ', 'آخر نسخة: ') + fmtDate(h.lastBackupAtUtc) + '. ' + body;
    }

    if (saving) {
      kind = 'warn';
      icon = 'ti-loader-2';
      title = t('Saving a copy now', 'بيحفظ نسخة دلوقتي');
      body = t('Stay on this page. This usually takes about a minute.', 'استنى على الصفحة. عادةً بتاخد حوالي دقيقة.');
    }

    var nightly = h.scheduledTaskFound
      ? (h.nextScheduledRunAtUtc
        ? fmtDate(h.nextScheduledRunAtUtc)
        : t('On', 'شغّالة'))
      : t('Off — use Save a copy now, or ask HyMotion to turn nightly save on.', 'مطفية — استخدم احفظ نسخة دلوقتي، أو اطلب من HyMotion تشغيل الحفظ الليلي.');

    var usb = h.offPcConfigured
      ? (h.offPcLastCopyVerified
        ? t('A copy off this PC is set.', 'فيه نسخة برا الجهاز.')
        : t('Off-PC folder is set, but the last copy was not confirmed.', 'مجلد برا الجهاز متظبط، بس آخر نسخة مش متأكدين منها.'))
        : t('Not set. Click Save to USB (step 2).', 'مش متظبطة. اضغط احفظ على USB (الخطوة 2).');

    card.className = 'bk-hero is-' + kind;
    card.innerHTML =
      '<div class="bk-hero-top">' +
        '<div class="bk-hero-icon"><i class="ti ' + icon + '" aria-hidden="true"></i></div>' +
        '<div>' +
          '<h2>' + esc(title) + '</h2>' +
          '<p>' + esc(body) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="bk-facts">' +
        '<div class="bk-fact"><div class="lbl">' + esc(t('Good copies on this PC', 'نسخ تمام على الجهاز')) + '</div>' +
          '<div class="val">' + esc(String(h.healthyBackupCount != null ? h.healthyBackupCount : '—')) + '</div></div>' +
        '<div class="bk-fact' + (h.scheduledTaskFound ? '' : ' is-bad') + '"><div class="lbl">' + esc(t('Nightly save', 'الحفظ الليلي')) + '</div>' +
          '<div class="val">' + esc(nightly) + '</div></div>' +
        '<div class="bk-fact' + (h.offPcConfigured ? '' : ' is-bad') + '"><div class="lbl">' + esc(t('USB / other disk', 'USB أو قرص تاني')) + '</div>' +
          '<div class="val">' + esc(usb) + '</div></div>' +
      '</div>';

    var pathEl = document.getElementById('backupPath');
    if (pathEl) pathEl.textContent = h.backupLocation || '—';

    if (saving) {
      setBanner('warn', t('Saving a copy now. Stay on this page.', 'بيحفظ نسخة دلوقتي. استنى على الصفحة.'));
    } else if (!h.lastBackupAtUtc) {
      setBanner('warn', t('No copy yet. Click Save a copy now.', 'لسه مفيش نسخة. اضغط احفظ نسخة دلوقتي.'));
    } else if (h.lastBackupStatus === 'Failed') {
      setBanner('err', ownerFailure((h.recentFailures && h.recentFailures[0]) || ''));
    } else if (!h.offPcConfigured) {
      setBanner('warn', t(
        'This copy lives only on this PC. Plug in a USB and click Save to USB so it survives if the machine dies.',
        'النسخة على الجهاز ده بس. وصل USB واضغط احفظ على USB عشان متضيعش لو الجهاز عطل.'
      ));
    } else if (!h.scheduledTaskFound) {
      setBanner('warn', t(
        'Nightly save is off. Click Save a copy now when you close the gym, or ask HyMotion to turn it on.',
        'الحفظ الليلي مطفي. اضغط احفظ نسخة دلوقتي وأنت بتقفل النادي، أو اطلب من HyMotion تشغيله.'
      ));
    } else {
      setBanner('', '');
    }
  }

  function paintSupport(h) {
    var el = document.getElementById('supportDetails');
    if (!el) return;
    if (!h) {
      el.innerHTML = '';
      return;
    }
    var fails = (h.recentFailures || []).map(function (f) {
      return '<li class="bk-raw">' + esc(f) + '</li>';
    }).join('');
    el.innerHTML =
      '<div><strong>' + esc(t('Folder', 'المجلد')) + '</strong></div>' +
      '<code class="bk-path">' + esc(h.backupLocation || '—') + '</code>' +
      '<div>' + esc(t('Nightly task found', 'المهمة الليلية موجودة')) + ': ' + esc(h.scheduledTaskFound ? t('Yes', 'نعم') : t('No', 'لا')) + '</div>' +
      '<div>' + esc(t('Off-PC path', 'مسار برا الجهاز')) + ': ' + esc(h.offPcDestination || t('Not set', 'مش متظبط')) + '</div>' +
      (fails
        ? ('<div style="margin-top:8px"><strong>' + esc(t('Raw recent failures', 'الأعطال الخام')) + '</strong></div><ul>' + fails + '</ul>')
        : '');
  }

  function paintHistory(items) {
    var tbody = document.getElementById('historyBody');
    if (!tbody) return;
    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ltt);padding:24px">' +
        esc(t('No copies yet. Click Save a copy now.', 'لسه مفيش نسخ. اضغط احفظ نسخة دلوقتي.')) + '</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function (b, i) {
      var savedBits = [];
      if (b.databaseVerified) savedBits.push(t('Gym data', 'بيانات النادي'));
      else savedBits.push(t('Gym data not checked', 'بيانات النادي مش متأكدين منها'));
      if (b.uploadsVerified) savedBits.push((b.uploadFileCount || 0) + ' ' + t('files', 'ملف'));
      var restoreBtn = canRestore(b)
        ? '<button type="button" class="btn secondary" data-restore="' + i + '">' +
            esc(t('Restore…', 'استعادة…')) + '</button>'
        : '<span class="muted">—</span>';
      return (
        '<tr>' +
        '<td>' + esc(fmtDate(b.createdAtUtc)) + '</td>' +
        '<td>' + esc(typeLabel(b.backupType)) + '</td>' +
        '<td><span class="badge ' + esc(b.status) + '">' + esc(statusLabel(b.status)) + '</span></td>' +
        '<td>' + esc(savedBits.join(' · ')) + '</td>' +
        '<td>' + restoreBtn + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function closeRestore() {
    var modal = document.getElementById('restoreModal');
    if (modal) modal.hidden = true;
    restoreTarget = null;
    var ack = document.getElementById('restoreAck');
    if (ack) ack.checked = false;
    var openBtn = document.getElementById('btnOpenRestore');
    if (openBtn) openBtn.disabled = true;
    var fallback = document.getElementById('restoreFallback');
    if (fallback) fallback.hidden = true;
  }

  function openRestore(row) {
    restoreTarget = row || null;
    var modal = document.getElementById('restoreModal');
    var lead = document.getElementById('restoreLead');
    var ack = document.getElementById('restoreAck');
    var fallback = document.getElementById('restoreFallback');
    if (!modal || !row) return;
    if (lead) {
      var when = fmtDate(row.createdAtUtc);
      if (row.status === 'Partial') {
        lead.textContent = t(
          'This copy from ' + when + ' is incomplete. Some photos may be missing after restore.',
          'النسخة دي من ' + when + ' ناقصة. ممكن صور تبقى ناقصة بعد الاستعادة.'
        );
      } else {
        lead.textContent = t(
          'This replaces today’s gym with the copy from ' + when + '.',
          'ده هيبدّل نادي النهارده بالنسخة من ' + when + '.'
        );
      }
    }
    if (ack) ack.checked = false;
    if (fallback) fallback.hidden = true;
    var openBtn = document.getElementById('btnOpenRestore');
    if (openBtn) openBtn.disabled = true;
    modal.hidden = false;
  }

  function stopSavePoll() {
    if (savePollTimer) {
      clearInterval(savePollTimer);
      savePollTimer = null;
    }
    saving = false;
    setBackupBtn('idle');
  }

  function startSavePoll(prevAt) {
    var tries = 0;
    if (savePollTimer) clearInterval(savePollTimer);
    savePollTimer = setInterval(function () {
      tries += 1;
      load({ quiet: true }).then(function () {
        var nextAt = healthState && healthState.lastBackupAtUtc;
        var changed = nextAt && nextAt !== prevAt;
        if (changed) {
          stopSavePoll();
          paintHero(healthState);
          var st = healthState.lastBackupStatus;
          if (st === 'Healthy') {
            setBanner('ok', t('Copy saved. Now plug in a USB and click Save to USB.', 'النسخة اتحفظت. دلوقتي وصل USB واضغط احفظ على USB.'));
            showToast(t('Copy saved.', 'النسخة اتحفظت.'), 'ok');
          } else if (st === 'Partial') {
            setBanner('warn', t('Copy saved, but some files were skipped. You can save again.', 'النسخة اتحفظت، بس بعض الملفات اتعدّت. تقدر تحفظ تاني.'));
            showToast(t('Copy saved, incomplete.', 'النسخة اتحفظت وناقصة.'), 'ok');
          } else {
            setBanner('err', ownerFailure((healthState.recentFailures && healthState.recentFailures[0]) || ''));
            showToast(t('Save did not finish.', 'الحفظ ما كملش.'), 'err');
          }
          return;
        }
        if (tries >= 20) {
          stopSavePoll();
          paintHero(healthState);
          setBanner('warn', t('Still working. Click Refresh in a minute.', 'لسه شغال. اضغط تحديث بعد دقيقة.'));
        }
      });
    }, 3000);
  }

  async function load(opts) {
    opts = opts || {};
    var healthRes = await api('GET', '/backup/health');
    var gate = document.getElementById('editionGate');
    var main = document.getElementById('mainContent');
    if (healthRes.status === 404) {
      if (gate) gate.hidden = false;
      if (main) main.style.display = 'none';
      return;
    }
    if (gate) gate.hidden = true;
    if (main) main.style.display = '';
    if (healthRes.status === 403) {
      if (main) {
        main.innerHTML = '<div class="card empty-state"><i class="ti ti-lock"></i>' +
          esc(t('Owner access required.', 'الصفحة دي للمالك بس.')) + '</div>';
      }
      return;
    }
    if (healthRes.ok && healthRes.data) {
      healthState = healthRes.data;
      if (!seenBackupAt) seenBackupAt = healthState.lastBackupAtUtc || null;
      paintHero(healthState);
      paintSupport(healthState);
    } else if (!opts.quiet) {
      var card = document.getElementById('heroCard');
      if (card) {
        card.className = 'bk-hero is-warn';
        card.innerHTML = '<h2>' + esc(t('Could not load status', 'مش قادرين نحمّل الحالة')) +
          '</h2><p>' + esc(t('Try Refresh. If it keeps failing, restart HyMotion Local.', 'جرّب تحديث. لو فضلت تفشل، أعد تشغيل HyMotion المحلي.')) + '</p>';
      }
    }

    var historyRes = await api('GET', '/backup/history?take=30');
    if (historyRes.ok && historyRes.data) {
      historyState = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data.items || historyRes.data.Items || []);
      paintHistory(historyState);
    }
  }

  var btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', function () {
      load();
    });
  }

  var btnNow = document.getElementById('btnBackupNow');
  if (btnNow) {
    btnNow.addEventListener('click', async function () {
      if (saving) return;
      saving = true;
      setBackupBtn('saving');
      var prevAt = healthState && healthState.lastBackupAtUtc;
      paintHero(healthState || {});
      try {
        var res = await api('POST', '/backup/run');
        if (res.ok && res.data && res.data.started) {
          showToast(friendlyApiMessage(res.data.message) || t('Saving a copy now. Stay on this page.', 'بيحفظ نسخة دلوقتي. استنى على الصفحة.'), 'ok');
          startSavePoll(prevAt || null);
        } else {
          stopSavePoll();
          var failMsg = friendlyApiMessage((res.data && res.data.message) || '') || t('Could not start a save.', 'مش قادرين نبدأ الحفظ.');
          setBanner('err', failMsg);
          showToast(failMsg, 'err');
          paintHero(healthState || {});
        }
      } catch (e) {
        stopSavePoll();
        var errMsg = t('Could not start a save.', 'مش قادرين نبدأ الحفظ.');
        setBanner('err', errMsg);
        showToast(errMsg, 'err');
      }
    });
  }

  var btnSaveUsb = document.getElementById('btnSaveUsb');
  if (btnSaveUsb) {
    btnSaveUsb.addEventListener('click', function () {
      var latest = null;
      for (var i = 0; i < historyState.length; i++) {
        if (canRestore(historyState[i])) { latest = historyState[i]; break; }
      }
      if (!latest) {
        showToast(t('Save a copy on this PC first, then save it to USB.', 'احفظ نسخة على الجهاز الأول، وبعدين احفظها على USB.'), 'err');
        return;
      }
      openBackupHelper('usb', latest.backupId);
    });
  }

  var historyBody = document.getElementById('historyBody');
  if (historyBody) {
    historyBody.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-restore]');
      if (!btn) return;
      var idx = Number(btn.getAttribute('data-restore'));
      var row = historyState[idx];
      if (row) openRestore(row);
    });
  }

  function bindClose(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', closeRestore);
  }
  bindClose('btnRestoreClose');
  bindClose('btnRestoreCancel');

  var ov = document.getElementById('restoreModal');
  if (ov) {
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) closeRestore();
    });
  }

  var ack = document.getElementById('restoreAck');
  if (ack) {
    ack.addEventListener('change', function () {
      var openBtn = document.getElementById('btnOpenRestore');
      if (openBtn) openBtn.disabled = !ack.checked;
    });
  }

  var btnOpenRestore = document.getElementById('btnOpenRestore');
  if (btnOpenRestore) {
    btnOpenRestore.addEventListener('click', function () {
      if (!restoreTarget) return;
      openBackupHelper('restore', restoreTarget.backupId);
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeRestore();
  });

  window.addEventListener('gfp:locale', function () {
    setBackupBtn(saving ? 'saving' : 'idle');
    if (healthState) {
      paintHero(healthState);
      paintSupport(healthState);
    }
    paintHistory(historyState);
    if (restoreTarget && !(document.getElementById('restoreModal') || {}).hidden) {
      openRestore(restoreTarget);
    }
  });

  load();
})();
