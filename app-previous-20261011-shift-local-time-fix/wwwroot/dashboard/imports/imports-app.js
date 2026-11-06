(function () {
  'use strict';
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';
  const MAX_BYTES = 5 * 1024 * 1024;

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  const FIELD_LABELS = {
    '': { en: '(ignore)', ar: 'تجاهل' },
    fullName: { en: 'Full name', ar: 'الاسم الكامل' },
    phoneNumber: { en: 'Phone number', ar: 'رقم الهاتف' },
    planName: { en: 'Plan name', ar: 'اسم الباقة' },
    startDate: { en: 'Start date', ar: 'تاريخ البدء' },
    endDate: { en: 'End date', ar: 'تاريخ الانتهاء' },
    sessionsRemaining: { en: 'Sessions remaining', ar: 'الحصص المتبقية' },
    dateOfBirth: { en: 'Date of birth', ar: 'تاريخ الميلاد' },
  };
  function fieldLabel(key) {
    const f = FIELD_LABELS[key] || { en: key, ar: key };
    return t(f.en, f.ar);
  }

  const PLAN_TYPE_LABELS = {
    monthly_unlimited: { en: 'Monthly Unlimited', ar: 'شهري غير محدود' },
    session_pack: { en: 'Session Pack', ar: 'باقة جلسات' },
    time_limited: { en: 'Time Limited', ar: 'محدود بالوقت' },
    pt_credits: { en: 'Private Training', ar: 'برايفت' },
    family: { en: 'Family', ar: 'عائلية' },
    trial: { en: 'Trial', ar: 'تجريبي' },
    day_pass: { en: 'Day Pass', ar: 'يوم واحد' },
  };
  function planTypeLabel(key) {
    const p = PLAN_TYPE_LABELS[key] || { en: key, ar: key };
    return t(p.en, p.ar);
  }

  const STATUS_LABELS = {
    none: { en: 'Upload', ar: 'رفع الملف' },
    validating: { en: 'Validating', ar: 'جارٍ التحقق' },
    dry_run_ready: { en: 'Preview', ar: 'المراجعة' },
    importing: { en: 'Importing', ar: 'جارٍ الاستيراد' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    failed: { en: 'Failed', ar: 'فشل' },
    rolled_back: { en: 'Rolled back', ar: 'تم التراجع' },
  };
  function statusLabel(status) {
    const s = STATUS_LABELS[status];
    return s ? t(s.en, s.ar) : status;
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      const I18n = window.GfpI18n;
      const loc = I18n && I18n.getLocale && I18n.getLocale() === 'ar' ? 'ar-EG' : 'en-GB';
      return d.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (_) {
      return String(iso);
    }
  }
  const TARGET_FIELDS = [
    '',
    'fullName',
    'phoneNumber',
    'planName',
    'startDate',
    'endDate',
    'sessionsRemaining',
    'dateOfBirth',
  ];
  const PLAN_TYPES = [
    'monthly_unlimited',
    'session_pack',
    'time_limited',
    'pt_credits',
    'family',
    'trial',
    'day_pass',
  ];
  const STEP_ORDER = [
    'none',
    'validating',
    'dry_run_ready',
    'importing',
    'completed',
    'failed',
    'rolled_back',
  ];
  const BATCH_KEY = 'gfp_import_batch_id';

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH(opts) {
    const t = getToken();
    const h = {};
    if (!(opts && opts.noJson)) h['Content-Type'] = 'application/json';
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (_) {
      return null;
    }
  }
  function decodeJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {
      return null;
    }
  }
  function getPerms() {
    const p = decodeJwt(getToken() || '');
    const set = new Set();
    if (!p) return set;
    const raw = p.perm;
    if (Array.isArray(raw)) raw.forEach((x) => set.add(String(x)));
    else if (raw) set.add(String(raw));
    return set;
  }

  const user = getUser();
  const perms = getPerms();
  const role = (user && user.role) || '';
  const canImport = perms.has('settings.manage') || /Owner/i.test(role);
  const canPlans = perms.has('plans.manage') || /Owner/i.test(role);
  const canRollback = /Owner|Manager/i.test(role);

  /** Server batch — ONLY source of wizard step. */
  let batch = null;
  let pollTimer = null;
  let unmatchedPlans = [];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  function problemMessage(data, status) {
    const fallback = t('Something went wrong. Please try again.', 'حدث خطأ ما. حاول مرة أخرى.');
    if (!data) return fallback;
    const title = data.title || '';
    const detail = data.detail || data.message || '';
    const map = {
      BATCH_NOT_FOUND: t('We could not find this import.', 'تعذر العثور على هذا الاستيراد.'),
      INVALID_STATUS: t(
        'This action is not available right now.',
        'هذا الإجراء غير متاح في الوقت الحالي.',
      ),
      FILE_TOO_LARGE: t('File too large (max 5 MB).', 'الملف كبير جدًا (الحد الأقصى 5 ميجابايت).'),
      TOO_MANY_ROWS: t('Too many rows (max 10,000).', 'عدد الصفوف كبير جدًا (الحد الأقصى 10,000).'),
      UNSUPPORTED_FILE_TYPE: t(
        'That file type is not supported — use an Excel (.xlsx) or CSV file.',
        'نوع الملف غير مدعوم — استخدم ملف إكسل (.xlsx) أو CSV.',
      ),
      ROLLBACK_WINDOW_EXPIRED: t(
        'You can no longer undo this import — the 7-day window has passed.',
        'لم يعد بإمكانك التراجع عن هذا الاستيراد — انتهت مهلة الـ 7 أيام.',
      ),
      FEATURE_DISABLED: t(
        "Bulk import isn't turned on for your gym.",
        'الاستيراد الجماعي غير مفعّل لناديك.',
      ),
    };
    if (map[title]) return map[title];
    return detail || title || fallback;
  }

  async function api(method, path, body, opts) {
    const headers = getH(opts);
    const fetchOpts = { method, headers };
    if (body !== undefined && !(opts && opts.formData)) {
      fetchOpts.body = JSON.stringify(body);
    }
    if (opts && opts.formData) {
      fetchOpts.body = opts.formData;
      // browser sets multipart boundary
    }
    const res = await fetch(API_BASE + path, fetchOpts);
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null, blob: null };
    }
    if (opts && opts.asBlob) {
      if (!res.ok) {
        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) data = await res.json().catch(() => null);
        return { ok: false, status: res.status, data, blob: null };
      }
      return { ok: true, status: res.status, data: null, blob: await res.blob() };
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data, blob: null };
  }

  function setBatchIdInUrl(id) {
    const u = new URL(location.href);
    if (id) u.searchParams.set('batch', id);
    else u.searchParams.delete('batch');
    history.replaceState(null, '', u.pathname + u.search);
    if (id) localStorage.setItem(BATCH_KEY, id);
    else localStorage.removeItem(BATCH_KEY);
  }

  function readBatchIdFromUrl() {
    const u = new URL(location.href);
    return u.searchParams.get('batch') || localStorage.getItem(BATCH_KEY) || null;
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPollIfNeeded() {
    stopPoll();
    if (!batch) return;
    if (batch.status === 'validating' || batch.status === 'importing') {
      pollTimer = setInterval(() => refreshBatch(false), 2000);
    }
  }

  function renderStepTrack() {
    const status = batch ? batch.status : 'none';
    const el = document.getElementById('stepTrack');
    el.innerHTML = STEP_ORDER.map((s) => {
      let cls = 'step-pill';
      if (s === status) cls += ' on';
      else if (
        STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(status) &&
        status !== 'failed' &&
        status !== 'rolled_back'
      )
        cls += ' done';
      return '<span class="' + cls + '">' + esc(statusLabel(s)) + '</span>';
    }).join('');
  }

  function kpisHtml(b) {
    return (
      '<div class="kpi"><span class="lbl">' +
      esc(t('Total', 'الإجمالي')) +
      '</span><strong>' +
      esc(String(b.totalRows || 0)) +
      '</strong></div>' +
      '<div class="kpi"><span class="lbl">' +
      esc(t('OK', 'سليم')) +
      '</span><strong>' +
      esc(String(b.okRows || 0)) +
      '</strong></div>' +
      '<div class="kpi"><span class="lbl">' +
      esc(t('Problems', 'مشاكل')) +
      '</span><strong>' +
      esc(String(b.errorRows || 0)) +
      '</strong></div>' +
      '<div class="kpi"><span class="lbl">' +
      esc(t('Status', 'الحالة')) +
      '</span><strong><span class="st-chip ' +
      esc(b.status) +
      '">' +
      esc(statusLabel(b.status)) +
      '</span></strong></div>'
    );
  }

  /** Drive visible panels ONLY from batch.status */
  function applyStatusUi() {
    renderStepTrack();
    const status = batch ? batch.status : 'none';
    const meta = document.getElementById('batchMeta');
    if (batch) {
      meta.style.display = 'flex';
      document.getElementById('metaTitle').textContent =
        (batch.fileName || t('Import', 'استيراد')) + ' · ' + statusLabel(batch.status);
      document.getElementById('metaLine').innerHTML =
        esc(t('Started', 'بدأ في')) +
        ' ' +
        esc(fmtDateTime(batch.createdAtUtc) || '—') +
        (batch.completedAt
          ? ' · ' + esc(t('Finished', 'انتهى في')) + ' ' + esc(fmtDateTime(batch.completedAt))
          : '');
    } else {
      meta.style.display = 'none';
    }

    document.querySelectorAll('.panel').forEach((panel) => {
      const when = (panel.getAttribute('data-show-when') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const show = when.includes(status);
      panel.style.display = show ? 'block' : 'none';
    });

    document.getElementById('validatingNote').style.display =
      status === 'validating' ? 'inline' : 'none';

    if (status === 'validating' || status === 'dry_run_ready' || status === 'failed') {
      renderMappingFromServer();
    }
    if (status === 'dry_run_ready') {
      document.getElementById('dryKpis').innerHTML = kpisHtml(batch);
    }
    if (status === 'importing') {
      document.getElementById('importingKpis').innerHTML = kpisHtml(batch);
    }
    if (status === 'completed') {
      document.getElementById('doneKpis').innerHTML = kpisHtml(batch);
      updateRollbackUi();
    }
    if (status === 'rolled_back') {
      document.getElementById('rolledKpis').innerHTML = kpisHtml(batch);
    }

    startPollIfNeeded();
  }

  function renderMappingFromServer() {
    const wrap = document.getElementById('mappingRows');
    const mapping = (batch && batch.mapping) || {};
    const headers = Object.keys(mapping);
    if (!headers.length) {
      wrap.innerHTML =
        '<p class="muted">' +
        esc(t("Columns haven't been set yet.", 'لم يتم ضبط الأعمدة بعد.')) +
        '</p>';
      return;
    }
    // Always render the server's current column matching — never a local cache copy
    wrap.innerHTML = headers
      .map((src) => {
        const cur = mapping[src] || '';
        const opts = TARGET_FIELDS.map(
          (fieldKey) =>
            '<option value="' +
            esc(fieldKey) +
            '"' +
            (fieldKey === cur ? ' selected' : '') +
            '>' +
            esc(fieldLabel(fieldKey)) +
            '</option>',
        ).join('');
        return (
          '<div class="map-row">' +
          '<label>' +
          esc(t('Column in your file', 'العمود في ملفك')) +
          '<input class="map-src" readonly dir="ltr" value="' +
          esc(src) +
          '"></label>' +
          '<label>' +
          esc(t('Matches to', 'يطابق')) +
          '<select class="map-tgt">' +
          opts +
          '</select></label>' +
          '</div>'
        );
      })
      .join('');
  }

  function readMappingFromForm() {
    const rows = document.querySelectorAll('#mappingRows .map-row');
    const mapping = {};
    rows.forEach((row) => {
      const src = row.querySelector('.map-src').value;
      const tgt = row.querySelector('.map-tgt').value;
      if (src) mapping[src] = tgt;
    });
    return mapping;
  }

  function updateRollbackUi() {
    const btn = document.getElementById('btnRollback');
    const note = document.getElementById('rollbackNote');
    if (!canRollback) {
      btn.style.display = 'none';
      note.textContent = t(
        'Only a Manager or Owner can undo an import.',
        'التراجع عن الاستيراد متاح للمدير أو المالك فقط.',
      );
      return;
    }
    if (!batch || !batch.completedAt) {
      btn.style.display = 'none';
      note.textContent = '';
      return;
    }
    const completed = new Date(batch.completedAt);
    const msLeft = completed.getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now();
    if (msLeft <= 0) {
      btn.style.display = 'none';
      note.textContent = t(
        "It's too late to undo this import (7-day limit passed).",
        'انتهت مهلة التراجع عن هذا الاستيراد (الحد 7 أيام).',
      );
      return;
    }
    btn.style.display = 'inline-flex';
    const days = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    note.textContent = t(
      '~' + days + ' day(s) left to undo this import.',
      'يتبقى ~' + days + ' يوم للتراجع عن هذا الاستيراد.',
    );
  }

  async function refreshBatch(showErr) {
    if (!batch || !batch.id) return;
    const res = await api('GET', '/imports/' + batch.id);
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      if (showErr) toast(problemMessage(res.data, res.status), 'err');
      if (res.status === 404) {
        batch = null;
        setBatchIdInUrl(null);
        applyStatusUi();
      }
      return;
    }
    document.getElementById('featureDisabled').style.display = 'none';
    batch = res.data;
    applyStatusUi();
  }

  async function loadBatch(id) {
    const res = await api('GET', '/imports/' + id);
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      toast(problemMessage(res.data, res.status), 'err');
      batch = null;
      setBatchIdInUrl(null);
      applyStatusUi();
      return;
    }
    document.getElementById('featureDisabled').style.display = 'none';
    batch = res.data;
    setBatchIdInUrl(batch.id);
    applyStatusUi();
  }

  async function downloadTemplate() {
    if (!canImport) {
      toast(
        t(
          "You don't have permission to do this. Ask your Manager or Owner.",
          'ليس لديك صلاحية لهذا الإجراء. اطلب من المدير أو المالك.',
        ),
        'err',
      );
      return;
    }
    const res = await api('GET', '/imports/template.xlsx', undefined, {
      asBlob: true,
      noJson: true,
    });
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadFile() {
    if (!canImport) {
      toast(
        t(
          "You don't have permission to do this. Ask your Manager or Owner.",
          'ليس لديك صلاحية لهذا الإجراء. اطلب من المدير أو المالك.',
        ),
        'err',
      );
      return;
    }
    const input = document.getElementById('fileInput');
    const file = input.files && input.files[0];
    if (!file) {
      toast(t('Choose a file first.', 'اختر ملفًا أولًا.'), 'err');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast(
        t('File too large (max 5 MB).', 'الملف كبير جدًا (الحد الأقصى 5 ميجابايت).'),
        'err',
      );
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await api('POST', '/imports', undefined, { formData: fd, noJson: true });
    if (!res.ok) {
      if (res.data && res.data.title === 'FEATURE_DISABLED') {
        document.getElementById('featureDisabled').style.display = 'flex';
      }
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    batch = res.data;
    setBatchIdInUrl(batch.id);
    toast(t('Uploaded — checking your file…', 'تم الرفع — جارٍ التحقق من ملفك…'), 'ok');
    applyStatusUi();
  }

  async function saveMapping() {
    if (!batch) return;
    const mapping = readMappingFromForm();
    const res = await api('POST', '/imports/' + batch.id + '/mapping', { mapping });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    batch = res.data;
    toast(t('Saved — checking your file again…', 'تم الحفظ — إعادة التحقق من ملفك…'), 'ok');
    applyStatusUi();
  }

  async function downloadErrors() {
    if (!batch) return;
    const res = await api('GET', '/imports/' + batch.id + '/errors.csv', undefined, {
      asBlob: true,
      noJson: true,
    });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function executeImport() {
    if (!batch) return;
    // Ack only — then poll status (double-execute safe when already importing/completed)
    const res = await api('POST', '/imports/' + batch.id + '/execute');
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      await refreshBatch(false);
      return;
    }
    toast(
      res.data && res.data.message
        ? res.data.message
        : t('Import started — this may take a moment.', 'بدأ الاستيراد — قد يستغرق بعض الوقت.'),
      'ok',
    );
    await refreshBatch(false);
  }

  async function rollback() {
    if (!batch || !canRollback) return;
    if (
      !confirm(
        t(
          'Undo this import? Members who have no other activity will be removed.',
          'هل تريد التراجع عن هذا الاستيراد؟ سيتم حذف الأعضاء الذين ليس لديهم أي نشاط آخر.',
        ),
      )
    )
      return;
    const res = await api('POST', '/imports/' + batch.id + '/rollback');
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    batch = res.data;
    toast(t('Import undone.', 'تم التراجع عن الاستيراد.'), 'ok');
    applyStatusUi();
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  async function scanUnmatchedPlans() {
    if (!batch) return;
    if (!canPlans) {
      toast(
        t(
          "You don't have permission to create plans. Ask your Manager or Owner.",
          'ليس لديك صلاحية لإنشاء الباقات. اطلب من المدير أو المالك.',
        ),
        'err',
      );
      return;
    }
    const res = await api('GET', '/imports/' + batch.id + '/errors.csv', undefined, {
      asBlob: true,
      noJson: true,
    });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    const text = await res.blob.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast(t('No row problems found.', 'لم يتم العثور على مشاكل في الصفوف.'), 'err');
      return;
    }
    const header = parseCsvLine(lines[0]);
    const idxCodes = header.findIndex((h) => /errorcodes/i.test(h));
    const idxPlan = header.findIndex((h) => /planname/i.test(h));
    const names = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const codes = (cols[idxCodes] || '').toUpperCase();
      if (codes.indexOf('PLAN_UNMATCHED') === -1) continue;
      const name = (cols[idxPlan] || '').trim();
      if (name) names.add(name);
    }
    unmatchedPlans = Array.from(names);
    renderPlanSpecs();
    if (!unmatchedPlans.length) {
      toast(t('No missing plan names found.', 'لم يتم العثور على أسماء باقات مفقودة.'), 'err');
    } else {
      toast(
        t(
          'Found ' + unmatchedPlans.length + ' missing plan name(s).',
          'تم العثور على ' + unmatchedPlans.length + ' اسم باقة مفقود.',
        ),
        'ok',
      );
    }
  }

  function renderPlanSpecs() {
    const wrap = document.getElementById('planSpecs');
    const btn = document.getElementById('btnCreatePlans');
    if (!unmatchedPlans.length) {
      wrap.innerHTML = '';
      btn.style.display = 'none';
      return;
    }
    btn.style.display = canPlans ? 'inline-flex' : 'none';
    wrap.innerHTML = unmatchedPlans
      .map((name, i) => {
        const typeOpts = PLAN_TYPES.map(
          (planTypeKey) =>
            '<option value="' +
            planTypeKey +
            '"' +
            (planTypeKey === 'monthly_unlimited' ? ' selected' : '') +
            '>' +
            esc(planTypeLabel(planTypeKey)) +
            '</option>',
        ).join('');
        return (
          '<div class="plan-spec" data-i="' +
          i +
          '">' +
          '<label>' +
          esc(t('Name', 'الاسم')) +
          '<input class="ps-name" value="' +
          esc(name) +
          '"></label>' +
          '<label>' +
          esc(t('Type', 'النوع')) +
          '<select class="ps-type">' +
          typeOpts +
          '</select></label>' +
          '<label>' +
          esc(t('Days', 'الأيام')) +
          '<input type="number" class="ps-days" value="30" min="1"></label>' +
          '<label>' +
          esc(t('Price', 'السعر')) +
          '<input type="number" class="ps-price" value="0" min="0" step="0.01"></label>' +
          '</div>'
        );
      })
      .join('');
  }

  async function createPlans() {
    if (!batch || !canPlans) return;
    const specs = [];
    document.querySelectorAll('#planSpecs .plan-spec').forEach((row) => {
      specs.push({
        name: row.querySelector('.ps-name').value.trim(),
        planType: row.querySelector('.ps-type').value,
        durationDays: Number(row.querySelector('.ps-days').value) || 30,
        price: Number(row.querySelector('.ps-price').value) || 0,
      });
    });
    if (!specs.length) {
      toast(t('No plans to create.', 'لا توجد باقات لإنشائها.'), 'err');
      return;
    }
    const res = await api('POST', '/imports/' + batch.id + '/create-plans', { plans: specs });
    if (!res.ok) {
      toast(problemMessage(res.data, res.status), 'err');
      return;
    }
    batch = res.data;
    unmatchedPlans = [];
    renderPlanSpecs();
    toast(
      t('Plans created — checking your file again…', 'تم إنشاء الباقات — إعادة التحقق من ملفك…'),
      'ok',
    );
    applyStatusUi();
  }

  function newBatch() {
    stopPoll();
    batch = null;
    unmatchedPlans = [];
    renderPlanSpecs();
    setBatchIdInUrl(null);
    document.getElementById('fileInput').value = '';
    applyStatusUi();
  }

  // Wire events
  document.getElementById('btnTemplate').onclick = downloadTemplate;
  document.getElementById('btnUpload').onclick = uploadFile;
  document.getElementById('btnSaveMapping').onclick = saveMapping;
  document.getElementById('btnErrorsCsv').onclick = downloadErrors;
  document.getElementById('btnErrorsCsvDone').onclick = downloadErrors;
  document.getElementById('btnErrorsCsvFail').onclick = downloadErrors;
  document.getElementById('btnExecute').onclick = executeImport;
  document.getElementById('btnRollback').onclick = rollback;
  document.getElementById('btnScanPlans').onclick = scanUnmatchedPlans;
  document.getElementById('btnCreatePlans').onclick = createPlans;
  document.getElementById('btnNewBatch').onclick = newBatch;

  function updateUploadHint() {
    const f = document.getElementById('fileInput').files[0];
    const hint = document.getElementById('uploadHint');
    if (!f) {
      hint.textContent = '';
      return;
    }
    const mb = (f.size / (1024 * 1024)).toFixed(2);
    hint.textContent =
      f.name +
      ' · ' +
      mb +
      ' MB' +
      (f.size > MAX_BYTES
        ? ' — ' + t('too large (max 5 MB)', 'كبير جدًا (الحد الأقصى 5 ميجابايت)')
        : '');
  }
  document.getElementById('fileInput').addEventListener('change', updateUploadHint);

  if (!canImport) {
    toast(
      t(
        "You don't have permission to use bulk import. Ask your Manager or Owner.",
        'ليس لديك صلاحية لاستخدام الاستيراد الجماعي. اطلب من المدير أو المالك.',
      ),
      'err',
    );
  }

  window.addEventListener('gfp:locale', () => {
    applyStatusUi();
    renderPlanSpecs();
    updateUploadHint();
  });

  const existing = readBatchIdFromUrl();
  if (existing) loadBatch(existing);
  else applyStatusUi();
})();
