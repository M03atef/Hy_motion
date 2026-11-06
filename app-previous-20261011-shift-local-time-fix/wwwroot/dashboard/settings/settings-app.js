(function () {
  const user = window.__gfpSettingsUser || (function () {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (e) {
      return null;
    }
  })();
  const role = String((user && user.role) || '').toLowerCase();
  const isOwner = role === 'owner';

  const apiGet = window.apiGet;
  const apiPut = window.apiPut;
  const apiDelete = window.apiDelete;
  const apiUpload = window.apiUpload;

  function t(en, ar) {
    var I18n = window.GfpI18n;
    if (I18n && I18n.tLabel) return I18n.tLabel(en, ar);
    return en;
  }

  function isAr() {
    var I18n = window.GfpI18n;
    return !!(I18n && I18n.getLocale && I18n.getLocale() === 'ar');
  }

  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }

  function fmtDate(d) {
    if (!d) return '';
    var I18n = window.GfpI18n;
    if (I18n && I18n.formatDate) return I18n.formatDate(d);
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function apiOrigin() {
    try {
      return new URL(window.API_BASE || window.GFP_DEFAULT_API_BASE || (window.location.origin + '/api')).origin;
    } catch (e) {
      return '';
    }
  }

  function resolvePosterUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const origin = apiOrigin();
    if (path.charAt(0) === '/') return origin + path;
    return origin + '/' + path;
  }

  function setGymCodeDisplay(code) {
    const text = (code && String(code).trim()) ? String(code).trim() : '—';
    const chip = document.getElementById('gymCodeChip');
    const qr = document.getElementById('qrGymCode');
    if (chip) chip.textContent = text;
    if (qr) qr.textContent = text;
  }

  // ── Tabs ──
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      this.classList.add('active');
      const panel = document.getElementById('tab-' + this.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  const tabBtnTax = document.getElementById('tabBtnTax');
  const tabBtnInvAlerts = document.getElementById('tabBtnInvAlerts');
  if (isOwner) {
    if (tabBtnTax) tabBtnTax.style.display = 'flex';
    if (tabBtnInvAlerts) tabBtnInvAlerts.style.display = 'flex';
  } else {
    if (tabBtnTax) tabBtnTax.style.display = 'none';
    if (tabBtnInvAlerts) tabBtnInvAlerts.style.display = 'none';
    const gate = document.getElementById('infoOwnerGate');
    if (gate) gate.style.display = 'flex';
    const infoForm = document.getElementById('infoForm');
    if (infoForm) {
      infoForm.querySelectorAll('input, textarea, button[type="submit"]').forEach(function (el) {
        if (el.id === 'copyCode') return;
        if (el.type === 'file' || el.id === 'logoBrowse') {
          el.disabled = true;
          return;
        }
        if (el.tagName === 'BUTTON' && el.type === 'submit') {
          el.style.display = 'none';
          return;
        }
        el.readOnly = true;
        el.disabled = true;
      });
    }
    const logoBrowse = document.getElementById('logoBrowse');
    if (logoBrowse) logoBrowse.style.display = 'none';
    const infoBtn = document.querySelector('.tab-btn[data-tab="info"]');
    const qrBtn = document.querySelector('.tab-btn[data-tab="qr"]');
    const tabInfo = document.getElementById('tab-info');
    const tabQr = document.getElementById('tab-qr');
    if (infoBtn) infoBtn.classList.remove('active');
    if (tabInfo) tabInfo.classList.remove('active');
    if (qrBtn) qrBtn.classList.add('active');
    if (tabQr) tabQr.classList.add('active');
  }

  // ── Gym code (any authenticated) ──
  async function loadGymCode() {
    const data = await apiGet('/settings/gym-code');
    if (data && (data.gymCode || data.GymCode)) {
      setGymCodeDisplay(data.gymCode || data.GymCode);
      return;
    }
    // Keep whatever Owner /settings already painted; only fall back if still blank
    const chip = document.getElementById('gymCodeChip');
    if (!chip || !chip.textContent || chip.textContent === '—') {
      setGymCodeDisplay(null);
    }
  }

  // ── Owner settings ──
  var lastSettingsData = null;
  async function loadSettings() {
    if (!isOwner) return;
    const data = await apiGet('/settings');
    if (!data) {
      toast(t('Could not load gym settings', 'تعذّر تحميل إعدادات النادي'), 'error');
      return;
    }
    lastSettingsData = data;
    populateForm(data);
    populateStatus(data);
  }

  var logoObjectUrl = null;

  function revokeLogoObjectUrl() {
    if (logoObjectUrl) {
      try {
        URL.revokeObjectURL(logoObjectUrl);
      } catch (e) { /* ignore */ }
      logoObjectUrl = null;
    }
  }

  function mediaUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (!u) return '';
    if (/^(https?:|blob:|data:)/i.test(u)) return u;
    var origin = apiOrigin();
    return origin + (u.charAt(0) === '/' ? u : '/' + u);
  }

  function candidateLogoUrls(url) {
    var u = String(url || '').trim();
    if (!u) return [];
    if (/^(blob:|data:)/i.test(u)) return [u];
    if (/^https?:\/\//i.test(u)) return [u];
    var path = u.charAt(0) === '/' ? u : '/' + u;
    var list = [];
    var origin = apiOrigin();
    if (origin) list.push(origin + path);
    return list;
  }

  async function resolveLogoDisplayUrl(url) {
    var candidates = candidateLogoUrls(url);
    if (!candidates.length) return '';
    if (/^(blob:|data:)/i.test(candidates[0])) return candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      try {
        var res = await fetch(candidate, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          mode: 'cors',
          cache: 'no-store'
        });
        if (!res.ok) continue;
        var blob = await res.blob();
        if (!blob || !String(blob.type || '').startsWith('image/')) continue;
        revokeLogoObjectUrl();
        logoObjectUrl = URL.createObjectURL(blob);
        return logoObjectUrl;
      } catch (e) {
        /* try next */
      }
    }
    // Last resort: direct URL (may work without CORS/fetch)
    return candidates[0] || '';
  }

  function applyBrandPreview() {
    var primary = (document.getElementById('brandPrimary') || {}).value || '#7ACC00';
    var secondary = (document.getElementById('brandSecondary') || {}).value || '#148F8F';
    var accent = (document.getElementById('brandAccent') || {}).value || '#A0E040';
    var card = (document.getElementById('cardPrimary') || {}).value || primary;
    var name = ((document.getElementById('gymName') || {}).value || '').trim() || t('Gym', 'النادي');
    var nameAr = ((document.getElementById('gymNameAr') || {}).value || '').trim();
    var rawLogo = ((document.getElementById('gymLogoUrl') || {}).value || '').trim();
    var logoImg = document.querySelector('#logoPreview img');
    var logo = (logoImg && logoImg.getAttribute('src')) || mediaUrl(rawLogo);
    var showLogo = !!(document.getElementById('showGymLogoOnCard') || {}).checked && !!rawLogo && !!logo;

    document.documentElement.style.setProperty('--l500', primary);
    document.documentElement.style.setProperty('--l400', accent);
    try {
      if (window.GfpBranding && typeof window.GfpBranding.apply === 'function') {
        window.GfpBranding.apply({
          gymName: name,
          gymNameAr: nameAr,
          shortName: ((document.getElementById('gymShortName') || {}).value || '').trim() || null,
          logoUrl: rawLogo || null,
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          cardPrimaryColor: card,
          showGymLogoOnCard: !!(document.getElementById('showGymLogoOnCard') || {}).checked
        });
      }
    } catch (e) { /* ignore */ }

    var mark = document.getElementById('brandLiveMark');
    if (mark) mark.style.background = primary;
    var liveName = document.getElementById('brandLiveName');
    if (liveName) liveName.textContent = name;
    var cta = document.getElementById('brandLiveCta');
    if (cta) cta.style.background = primary;
    var sec = document.getElementById('brandLiveSec');
    if (sec) sec.style.background = secondary;
    var acc = document.getElementById('brandLiveAcc');
    if (acc) {
      acc.style.borderColor = accent;
      acc.style.color = '#0D0D0D';
    }

    var cr80Gym = document.getElementById('cr80Gym');
    var cr80GymAr = document.getElementById('cr80GymAr');
    var cr80Mark = document.getElementById('cr80Mark');
    var cr80Logo = document.getElementById('cr80Logo');
    if (cr80Gym) cr80Gym.textContent = name;
    if (cr80GymAr) {
      cr80GymAr.textContent = nameAr;
      cr80GymAr.style.display = nameAr ? '' : 'none';
    }
    if (cr80Mark) {
      cr80Mark.style.background = card;
      cr80Mark.hidden = showLogo;
    }
    if (cr80Logo) {
      if (showLogo) {
        cr80Logo.src = logo;
        cr80Logo.hidden = false;
      } else {
        cr80Logo.removeAttribute('src');
        cr80Logo.hidden = true;
      }
    }
  }

  async function setLogoPreview(url) {
    var preview = document.getElementById('logoPreview');
    var clearBtn = document.getElementById('logoClear');
    var raw = String(url || '').trim();
    if (!raw) {
      revokeLogoObjectUrl();
      if (preview) preview.innerHTML = '<i class="ti ti-photo"></i>';
      if (clearBtn) clearBtn.style.display = 'none';
      applyBrandPreview();
      return;
    }
    if (preview) {
      preview.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i>';
    }
    var display = await resolveLogoDisplayUrl(raw);
    if (preview) {
      if (display) {
        preview.innerHTML =
          '<img src="' +
          display +
          '" alt="Logo" onerror="this.parentNode.innerHTML=\'<i class=\\\'ti ti-photo-off\\\'></i>\'">';
      } else {
        preview.innerHTML = '<i class="ti ti-photo-off"></i>';
      }
    }
    if (clearBtn) clearBtn.style.display = raw ? '' : 'none';
    applyBrandPreview();
  }

  function populateForm(s) {
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val == null ? '' : val;
    };
    set('gymName', s.gymName || s.GymName || '');
    set('gymNameAr', s.gymNameAr || s.GymNameAr || '');
    set('gymShortName', s.shortName || s.ShortName || '');
    set('gymPhone', s.phoneNumber || s.PhoneNumber || '');
    set('gymEmail', s.email || s.Email || '');
    set('gymWebsite', s.website || s.Website || '');
    set('gymAddress', s.address || s.Address || '');
    var cap = s.gymMaxCapacity;
    if (cap == null) cap = s.GymMaxCapacity;
    set('gymMaxCapacity', cap == null || cap === '' ? '' : cap);
    set('gymLogoUrl', s.logoUrl || s.LogoUrl || '');
    set('brandPrimary', s.primaryColor || s.PrimaryColor || '#7ACC00');
    set('brandSecondary', s.secondaryColor || s.SecondaryColor || '#148F8F');
    set('brandAccent', s.accentColor || s.AccentColor || '#A0E040');
    set('cardPrimary', s.cardPrimaryColor || s.CardPrimaryColor || s.primaryColor || '#7ACC00');
    var showLogo = s.showGymLogoOnCard;
    if (showLogo == null) showLogo = s.ShowGymLogoOnCard;
    if (showLogo == null) showLogo = true;
    var showEl = document.getElementById('showGymLogoOnCard');
    if (showEl) showEl.checked = !!showLogo;

    setGymCodeDisplay(s.gymCode || s.GymCode);
    setLogoPreview(s.logoUrl || s.LogoUrl || '');

    const metaCreated = document.getElementById('metaCreated');
    const metaUpdated = document.getElementById('metaUpdated');
    if (metaCreated) {
      metaCreated.innerHTML = '<i class="ti ti-calendar"></i> ' + t('Created', 'أُنشئ') + ': ' + fmtDate(s.createdAtUtc || s.CreatedAtUtc);
    }
    if (metaUpdated) {
      metaUpdated.innerHTML = '<i class="ti ti-refresh"></i> ' + t('Updated', 'آخر تحديث') + ': ' + fmtDate(s.updatedAtUtc || s.UpdatedAtUtc);
    }
  }

  function populateStatus(s) {
    const statusEl = document.getElementById('tenantStatus');
    const active = s.isActive !== false && s.IsActive !== false;
    if (statusEl && !active) {
      statusEl.innerHTML = '<span class="st-dot" style="background:var(--dng500)"></span><span data-en="Inactive" data-ar="غير نشط" data-i18n-text>' + t('Inactive', 'غير نشط') + '</span>';
      statusEl.style.background = 'var(--dng100)';
      statusEl.style.color = 'var(--dng500)';
    }
  }

  const BRAND_DEFAULTS = {
    primaryColor: '#7ACC00',
    secondaryColor: '#148F8F',
    accentColor: '#A0E040',
    cardPrimaryColor: '#7ACC00',
    showGymLogoOnCard: true
  };

  function readIdentityBody() {
    var website = ((document.getElementById('gymWebsite') || {}).value || '').trim();
    if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;
    return {
      gymName: ((document.getElementById('gymName') || {}).value || '').trim(),
      gymNameAr: ((document.getElementById('gymNameAr') || {}).value || '').trim(),
      shortName: ((document.getElementById('gymShortName') || {}).value || '').trim() || null,
      phoneNumber: ((document.getElementById('gymPhone') || {}).value || '').trim() || null,
      email: ((document.getElementById('gymEmail') || {}).value || '').trim() || null,
      website: website || null,
      address: ((document.getElementById('gymAddress') || {}).value || '').trim() || null,
      gymMaxCapacity: (function () {
        var raw = ((document.getElementById('gymMaxCapacity') || {}).value || '').trim();
        if (!raw) return null;
        var n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      logoUrl: ((document.getElementById('gymLogoUrl') || {}).value || '').trim() || null,
      primaryColor: ((document.getElementById('brandPrimary') || {}).value || '').trim() || null,
      secondaryColor: ((document.getElementById('brandSecondary') || {}).value || '').trim() || null,
      accentColor: ((document.getElementById('brandAccent') || {}).value || '').trim() || null,
      cardPrimaryColor: ((document.getElementById('cardPrimary') || {}).value || '').trim() || null,
      showGymLogoOnCard: !!(document.getElementById('showGymLogoOnCard') || {}).checked
    };
  }

  function applyBrandDefaultsToForm() {
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val;
    };
    set('brandPrimary', BRAND_DEFAULTS.primaryColor);
    set('brandSecondary', BRAND_DEFAULTS.secondaryColor);
    set('brandAccent', BRAND_DEFAULTS.accentColor);
    set('cardPrimary', BRAND_DEFAULTS.cardPrimaryColor);
    var showEl = document.getElementById('showGymLogoOnCard');
    if (showEl) showEl.checked = BRAND_DEFAULTS.showGymLogoOnCard;
    applyBrandPreview();
  }

  async function saveIdentity(opts) {
    opts = opts || {};
    if (!isOwner) return false;
    var btn = document.getElementById('btnSave');
    var resetBtns = [document.getElementById('btnResetBrand'), document.getElementById('btnResetBrandFooter')];
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i> ' + t('Saving...', 'جارٍ الحفظ...');
    }
    resetBtns.forEach(function (b) {
      if (b) b.disabled = true;
    });

    var body = readIdentityBody();
    if (!body.gymName || !body.gymNameAr) {
      toast(t('Gym name (EN + AR) is required', 'اسم النادي مطلوب بالإنجليزي والعربي'), 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + t('Save Changes', 'حفظ التغييرات');
      }
      resetBtns.forEach(function (b) {
        if (b) b.disabled = false;
      });
      return false;
    }
    if (body.gymMaxCapacity != null && (body.gymMaxCapacity < 1 || body.gymMaxCapacity > 9999)) {
      toast(t('Maximum inside must be between 1 and 9999', 'أقصى عدد بالداخل يجب أن يكون بين 1 و9999'), 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + t('Save Changes', 'حفظ التغييرات');
      }
      resetBtns.forEach(function (b) {
        if (b) b.disabled = false;
      });
      return false;
    }

    var res = await apiPut('/settings', body);
    if (res && res.ok && res.data) {
      toast(opts.successToast || t('Design saved for this gym', 'تم حفظ تصميم النادي'));
      lastSettingsData = res.data;
      populateForm(res.data);
      populateStatus(res.data);
      if (window.GfpBranding && typeof window.GfpBranding.apply === 'function') {
        try {
          await window.GfpBranding.apply(res.data);
        } catch (err) { /* ignore */ }
      } else {
        applyBrandPreview();
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + t('Save Changes', 'حفظ التغييرات');
      }
      resetBtns.forEach(function (b) {
        if (b) b.disabled = false;
      });
      return true;
    }

    var errMsg =
      (res && res.data && (res.data.message || res.data.error)) ||
      (res && res.status ? t('Save failed', 'فشل الحفظ') + ' (' + res.status + ')' : t('Save failed — check API connection', 'فشل الحفظ — تحقق من الاتصال بالخادم'));
    toast(errMsg, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + t('Save Changes', 'حفظ التغييرات');
    }
    resetBtns.forEach(function (b) {
      if (b) b.disabled = false;
    });
    return false;
  }

  async function resetBrandDefaults() {
    if (!isOwner) return;
    if (
      !window.confirm(
        t(
          'Reset brand colors to HyMotion defaults?\n\nThis restores Primary / Secondary / Accent / Card mark and keeps your gym name & logo. Changes will be saved.',
          'استعادة ألوان العلامة إلى افتراضيات HyMotion؟\n\nهذا يعيد الأساسي / الثانوي / المميز / لون البطاقة، ويحافظ على اسم النادي والشعار. سيتم حفظ التغييرات.'
        )
      )
    ) {
      return;
    }
    applyBrandDefaultsToForm();
    await saveIdentity({ successToast: t('Defaults restored for this gym', 'تم استعادة الإعدادات الافتراضية لهذا النادي') });
  }

  const infoForm = document.getElementById('infoForm');
  if (infoForm) {
    infoForm.setAttribute('novalidate', 'novalidate');
    infoForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      await saveIdentity();
    });
  }

  [document.getElementById('btnResetBrand'), document.getElementById('btnResetBrandFooter')].forEach(
    function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        resetBrandDefaults();
      });
      if (!isOwner) btn.style.display = 'none';
    }
  );

  const copyCode = document.getElementById('copyCode');
  if (copyCode) {
    copyCode.addEventListener('click', function () {
      const code = (document.getElementById('gymCodeChip') || {}).textContent;
      if (code && code !== '—') {
        const btn = this;
        navigator.clipboard.writeText(code).then(function () {
          btn.classList.add('copied');
          btn.innerHTML = '<i class="ti ti-check"></i>';
          toast(t('Gym code copied!', 'تم نسخ كود النادي!'));
          setTimeout(function () {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="ti ti-copy"></i>';
          }, 2000);
        });
      }
    });
  }

  // ── Logo upload (tenant-scoped) ──
  const logoUpload = document.getElementById('logoUpload');
  const logoFile = document.getElementById('logoFile');
  const logoBrowse = document.getElementById('logoBrowse');
  const logoClear = document.getElementById('logoClear');
  if (logoBrowse && logoFile) {
    logoBrowse.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isOwner) return;
      logoFile.click();
    });
  }
  if (logoUpload && logoFile) {
    logoUpload.addEventListener('click', function (e) {
      if (!isOwner) return;
      if (e.target && (e.target.id === 'logoClear' || (e.target.closest && e.target.closest('#logoClear')))) return;
      logoFile.click();
    });
  }
  if (logoFile) {
    logoFile.addEventListener('change', async function () {
      if (!this.files.length || !isOwner) return;
      await handleLogoFile(this.files[0]);
      this.value = '';
    });
  }
  if (logoClear) {
    logoClear.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isOwner) return;
      const res = await apiDelete('/settings/logo');
      if (res && res.ok) {
        document.getElementById('gymLogoUrl').value = '';
        setLogoPreview('');
        toast(t('Logo removed', 'تم إزالة الشعار'));
      } else {
        toast((res && res.data && (res.data.message || res.data.error)) || t('Failed to remove logo', 'تعذّرت إزالة الشعار'), 'error');
      }
    });
  }

  async function handleLogoFile(file) {
    if (!file.type || !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
      toast(t('Only JPEG/PNG/WebP/GIF', 'فقط JPEG/PNG/WebP/GIF'), 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast(t('File too large. Max 2MB', 'الملف كبير جداً. الحد الأقصى 2 ميجابايت'), 'error');
      return;
    }
    toast(t('Uploading logo…', 'جارٍ رفع الشعار…'));
    const res = await apiUpload('/settings/logo', file);
    if (!res || !res.ok) {
      toast((res && res.data && (res.data.message || res.data.error)) || t('Upload failed', 'فشل الرفع'), 'error');
      return;
    }
    const url =
      (res.data && (res.data.relativeUrl || res.data.logoUrl || res.data.LogoUrl)) || '';
    document.getElementById('gymLogoUrl').value = url;
    setLogoPreview(url);
    toast(t('Logo uploaded', 'تم رفع الشعار'));
  }

  ['brandPrimary', 'brandSecondary', 'brandAccent', 'cardPrimary', 'gymName', 'gymNameAr'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', applyBrandPreview);
  });
  var showLogoEl = document.getElementById('showGymLogoOnCard');
  if (showLogoEl) showLogoEl.addEventListener('change', applyBrandPreview);

  // ── Tax / VAT (Owner only, audited server-side) ──
  async function loadTax() {
    if (!isOwner) return;
    const data = await apiGet('/settings/tax');
    if (!data) return;
    const vatEl = document.getElementById('vatEnabled');
    if (vatEl) vatEl.checked = !!(data.vatEnabled != null ? data.vatEnabled : data.VatEnabled);
    const raw = data.vatRate != null ? data.vatRate : data.VatRate;
    const rate = typeof raw === 'number' ? raw : parseFloat(raw);
    const pctEl = document.getElementById('vatRatePct');
    if (pctEl) pctEl.value = isFinite(rate) ? (rate <= 1 ? (rate * 100) : rate) : '';
    const reg = document.getElementById('taxRegNo');
    if (reg) reg.value = data.taxRegistrationNumber || data.TaxRegistrationNumber || '';
    const foot = document.getElementById('invoiceFooter');
    if (foot) foot.value = data.invoiceFooterText || data.InvoiceFooterText || '';
    const footAr = document.getElementById('invoiceFooterAr');
    if (footAr) footAr.value = data.invoiceFooterTextAr || data.InvoiceFooterTextAr || '';
  }

  const taxForm = document.getElementById('taxForm');
  if (taxForm) {
    taxForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!isOwner) return;
      const btn = document.getElementById('btnSaveTax');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i> ' + t('Saving...', 'جارٍ الحفظ...');
      }

      let pct = parseFloat((document.getElementById('vatRatePct') || {}).value);
      if (!isFinite(pct) || pct < 0) pct = 0;
      if (pct > 100) pct = 100;

      const body = {
        vatEnabled: !!(document.getElementById('vatEnabled') || {}).checked,
        vatRate: pct / 100,
        taxRegistrationNumber: ((document.getElementById('taxRegNo') || {}).value || '').trim() || null,
        invoiceFooterText: ((document.getElementById('invoiceFooter') || {}).value || '').trim() || null,
        invoiceFooterTextAr: ((document.getElementById('invoiceFooterAr') || {}).value || '').trim() || null
      };

      const res = await apiPut('/settings/tax', body);
      if (res && res.ok) {
        toast(t('Tax settings saved (audited)', 'تم حفظ إعدادات الضريبة (مسجّلة في السجل)'));
        loadTax();
      } else {
        toast((res && res.data && (res.data.message || res.data.error)) || t('Failed to save tax settings', 'فشل حفظ إعدادات الضريبة'), 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + t('Save Tax Settings', 'حفظ إعدادات الضريبة');
      }
    });
  }

  // ── Inventory alerts (Owner only, INVS-10) ──
  async function loadInvAlerts() {
    if (!isOwner) return;
    const data = await apiGet('/settings/inventory-alerts');
    if (!data) return;
    const roles = data.lowStockNotifyRoles || data.LowStockNotifyRoles || [];
    const windows = data.expiryWindowsDays || data.ExpiryWindowsDays || [];
    const rolesEl = document.getElementById('invNotifyRoles');
    const winEl = document.getElementById('invExpiryWindows');
    if (rolesEl) rolesEl.value = Array.isArray(roles) ? roles.join(', ') : '';
    if (winEl) winEl.value = Array.isArray(windows) ? windows.join(', ') : '';
  }

  const invAlertsForm = document.getElementById('invAlertsForm');
  if (invAlertsForm) {
    invAlertsForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!isOwner) return;
      const btn = document.getElementById('btnSaveInvAlerts');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .6s linear infinite"></i> ' + t('Saving...', 'جارٍ الحفظ...');
      }
      const rolesRaw = ((document.getElementById('invNotifyRoles') || {}).value || '').trim();
      const winRaw = ((document.getElementById('invExpiryWindows') || {}).value || '').trim();
      const body = {
        lowStockNotifyRoles: rolesRaw
          ? rolesRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
          : ['Owner', 'Manager'],
        expiryWindowsDays: winRaw
          ? winRaw.split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return n > 0; })
          : [90, 30, 7]
      };
      const res = await apiPut('/settings/inventory-alerts', body);
      if (res && res.ok) {
        toast(t('Inventory alert settings saved', 'تم حفظ إعدادات تنبيهات المخزون'));
        loadInvAlerts();
      } else {
        toast((res && res.data && (res.data.message || res.data.error)) || t('Failed to save alert settings', 'فشل حفظ إعدادات التنبيه'), 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> <span data-en="Save alert settings" data-ar="حفظ إعدادات التنبيه" data-i18n-text>' + t('Save alert settings', 'حفظ إعدادات التنبيه') + '</span>';
      }
    });
  }

  // ── Live QR (any authenticated) ──
  // The QR now encodes a short-lived signed token (GET /attendance/qr/token), not the permanent
  // gym code — a printed/screenshotted QR would just go stale within ~45s, so this renders a
  // live, auto-refreshing display instead of a static downloadable poster.
  const QR_REFRESH_MARGIN_SECONDS = 8;
  let qrRefreshTimer = null;

  function currentGymCode() {
    const qr = document.getElementById('qrGymCode');
    const chip = document.getElementById('gymCodeChip');
    const fromQr = qr && qr.textContent ? qr.textContent.trim() : '';
    const fromChip = chip && chip.textContent ? chip.textContent.trim() : '';
    const code = fromQr && fromQr !== '—' ? fromQr : fromChip;
    return code && code !== '—' ? code : '';
  }

  function currentGymName() {
    const el = document.getElementById('gymName');
    if (el && el.value && el.value.trim()) return el.value.trim();
    const brand = document.querySelector('.gym-name, #gymNameDisplay');
    if (brand && brand.textContent && brand.textContent.trim()) return brand.textContent.trim();
    try {
      const u = JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user') || 'null');
      if (u && u.gymName) return String(u.gymName);
    } catch (e) { /* ignore */ }
    return 'HyMotion';
  }

  function setLiveStatus(text) {
    const el = document.getElementById('qrLiveStatus');
    if (el) el.textContent = text;
  }

  async function fetchQrToken() {
    if (!window.apiGet) return null;
    return apiGet('/attendance/qr/token');
  }

  async function renderQrToken(token, gymName) {
    const frame = document.getElementById('qrFrame');
    if (!frame || !token) return false;
    if (!document.getElementById('qrPosterLive')) {
      frame.innerHTML =
        '<div class="qr-poster-live" id="qrPosterLive">' +
        '<div class="poster-brand"></div>' +
        '<div class="poster-sub">' + t('Scan to check in', 'امسح لتسجيل الدخول') + '</div>' +
        '<canvas id="qrPosterCanvas" width="220" height="220"></canvas>' +
        '<div class="poster-hint">' + t('Members: open HyMotion → scan<br>Staff: Attendance → Scan QR', 'الأعضاء: افتح HyMotion وامسح الرمز<br>الموظفون: من شاشة الحضور امسح رمز QR') + '</div>' +
        '</div>';
    } else {
      const subEl = frame.querySelector('.poster-sub');
      if (subEl) subEl.textContent = t('Scan to check in', 'امسح لتسجيل الدخول');
      const hintEl = frame.querySelector('.poster-hint');
      if (hintEl) hintEl.innerHTML = t('Members: open HyMotion → scan<br>Staff: Attendance → Scan QR', 'الأعضاء: افتح HyMotion وامسح الرمز<br>الموظفون: من شاشة الحضور امسح رمز QR');
    }
    const brandEl = frame.querySelector('.poster-brand');
    if (brandEl) brandEl.textContent = gymName;

    const canvas = document.getElementById('qrPosterCanvas');
    if (!canvas) return false;

    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      await new Promise(function (resolve, reject) {
        window.QRCode.toCanvas(
          canvas,
          token,
          { width: 220, margin: 2, color: { dark: '#0D0D0D', light: '#FFFFFF' } },
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      // CDN fallback image if QRCode lib blocked
      const existingImg = frame.querySelector('img.qr-img');
      const img = existingImg || document.createElement('img');
      img.className = 'qr-img';
      img.alt = 'QR check-in code';
      img.src =
        'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' +
        encodeURIComponent(token);
      if (!existingImg) canvas.replaceWith(img);
      await new Promise(function (resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }
    return true;
  }

  function scheduleQrRefresh(expiresInSeconds) {
    if (qrRefreshTimer) clearTimeout(qrRefreshTimer);
    const delayMs = Math.max(3, (expiresInSeconds || 45) - QR_REFRESH_MARGIN_SECONDS) * 1000;
    qrRefreshTimer = setTimeout(loadQRPoster, delayMs);
  }

  function tickCountdown(expiresAtUtc) {
    const expiresAt = new Date(expiresAtUtc).getTime();
    const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    setLiveStatus(isAr() ? ('● مباشر — يتحدّث خلال ' + remaining + ' ث') : ('● Live — refreshes in ' + remaining + 's'));
    if (remaining > 0) setTimeout(function () { tickCountdown(expiresAtUtc); }, 1000);
  }

  async function loadQRPoster() {
    const frame = document.getElementById('qrFrame');
    if (!frame) return;
    try {
      const data = await fetchQrToken();
      if (!data || !data.token) {
        setLiveStatus('');
        frame.innerHTML =
          '<div class="qr-loading"><i class="ti ti-qrcode" style="font-size:64px;color:var(--ls4);display:block;margin-bottom:12px"></i>' +
          '<div style="color:var(--ltt);font-size:12px">' + t('Could not load a check-in QR — retrying…', 'تعذّر تحميل رمز تسجيل الدخول — جارٍ المحاولة مرة أخرى…') + '</div></div>';
        qrRefreshTimer = setTimeout(loadQRPoster, 5000);
        return;
      }
      await renderQrToken(data.token, currentGymName());
      tickCountdown(data.expiresAtUtc);
      scheduleQrRefresh(data.expiresInSeconds);
    } catch (e) {
      setLiveStatus('');
      frame.innerHTML =
        '<div class="qr-loading"><i class="ti ti-qrcode" style="font-size:64px;color:var(--ls4);display:block;margin-bottom:12px"></i>' +
        '<div style="color:var(--ltt);font-size:12px">' + t('Could not load a check-in QR — retrying…', 'تعذّر تحميل رمز تسجيل الدخول — جارٍ المحاولة مرة أخرى…') + '</div></div>';
      qrRefreshTimer = setTimeout(loadQRPoster, 5000);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && document.getElementById('qrFrame')) {
      loadQRPoster();
    }
  });

  const btnFullscreen = document.getElementById('btnFullscreenQR');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', function () {
      const el = document.querySelector('.qr-card');
      if (el && el.requestFullscreen) el.requestFullscreen().catch(function () {});
    });
  }

  // ── Appearance (browser preference — not gym identity) ──
  (function bindAppearance() {
    var root = document.getElementById('appearanceOpts');
    if (!root) return;
    function current() {
      return (window.GfpTheme && window.GfpTheme.getPref && window.GfpTheme.getPref()) || 'light';
    }
    function paint() {
      var pref = current();
      root.querySelectorAll('[data-appearance]').forEach(function (btn) {
        btn.classList.toggle('act', btn.getAttribute('data-appearance') === pref);
      });
    }
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-appearance]');
      if (!btn) return;
      var pref = btn.getAttribute('data-appearance');
      if (window.GfpTheme && window.GfpTheme.setPref) window.GfpTheme.setPref(pref);
      paint();
    });
    paint();
  })();

  // ── Live re-render on locale toggle (no page reload) ──
  window.addEventListener('gfp:locale', function () {
    if (lastSettingsData) {
      // Refresh locale-dependent labels only — do not re-populate form inputs
      // (that would clobber any unsaved edits the user is mid-typing).
      const metaCreated = document.getElementById('metaCreated');
      const metaUpdated = document.getElementById('metaUpdated');
      if (metaCreated) {
        metaCreated.innerHTML = '<i class="ti ti-calendar"></i> ' + t('Created', 'أُنشئ') + ': ' + fmtDate(lastSettingsData.createdAtUtc || lastSettingsData.CreatedAtUtc);
      }
      if (metaUpdated) {
        metaUpdated.innerHTML = '<i class="ti ti-refresh"></i> ' + t('Updated', 'آخر تحديث') + ': ' + fmtDate(lastSettingsData.updatedAtUtc || lastSettingsData.UpdatedAtUtc);
      }
      populateStatus(lastSettingsData);
    }
    var btnSaveEl = document.getElementById('btnSave');
    if (btnSaveEl && !btnSaveEl.disabled) {
      btnSaveEl.innerHTML = '<i class="ti ti-device-floppy"></i> <span data-en="Save Changes" data-ar="حفظ التغييرات" data-i18n-text>' + t('Save Changes', 'حفظ التغييرات') + '</span>';
    }
    var btnSaveTaxEl = document.getElementById('btnSaveTax');
    if (btnSaveTaxEl && !btnSaveTaxEl.disabled) {
      btnSaveTaxEl.innerHTML = '<i class="ti ti-device-floppy"></i> <span data-en="Save Tax Settings" data-ar="حفظ إعدادات الضريبة" data-i18n-text>' + t('Save Tax Settings', 'حفظ إعدادات الضريبة') + '</span>';
    }
    var btnSaveInvEl = document.getElementById('btnSaveInvAlerts');
    if (btnSaveInvEl && !btnSaveInvEl.disabled) {
      btnSaveInvEl.innerHTML = '<i class="ti ti-device-floppy"></i> <span data-en="Save alert settings" data-ar="حفظ إعدادات التنبيه" data-i18n-text>' + t('Save alert settings', 'حفظ إعدادات التنبيه') + '</span>';
    }
    var qrFrameEl = document.getElementById('qrFrame');
    if (qrFrameEl) {
      var subEl = qrFrameEl.querySelector('.poster-sub');
      if (subEl) subEl.textContent = t('Scan to check in', 'امسح لتسجيل الدخول');
      var hintEl = qrFrameEl.querySelector('.poster-hint');
      if (hintEl) hintEl.innerHTML = t('Members: open HyMotion → scan<br>Staff: Attendance → Scan QR', 'الأعضاء: افتح HyMotion وامسح الرمز<br>الموظفون: من شاشة الحضور امسح رمز QR');
      var loadingTextEl = qrFrameEl.querySelector('.qr-loading > div[style]');
      if (loadingTextEl && !document.getElementById('qrPosterLive')) {
        loadingTextEl.textContent = t('Could not load a check-in QR — retrying…', 'تعذّر تحميل رمز تسجيل الدخول — جارٍ المحاولة مرة أخرى…');
      }
    }
    applyBrandPreview();
  });

  // ── Init (Owner settings first so gymCode is not wiped by a failed gym-code call) ──
  (async function init() {
    if (isOwner) {
      await loadSettings();
      await loadTax();
      await loadInvAlerts();
    }
    await loadGymCode();
    await loadQRPoster();
  })();
})();
