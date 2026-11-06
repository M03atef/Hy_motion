/**
 * HyMotion Font Preview — developer tool.
 * Does NOT mutate production --fd/--fb/--fa or global body fonts outside cards.
 */
(function (global) {
  'use strict';

  var I18n = global.GfpI18n;
  var STORAGE_EVAL = 'gfp_font_preview_eval_v1';
  var STORAGE_COMPARE = 'gfp_font_preview_compare_v1';

  /**
   * Candidate fonts. DIN Next LT Pro is commercial (Linotype) — not loaded from Google Fonts.
   * Production reference included for fair side-by-side.
   */
  var FONTS = [
    {
      id: 'production',
      name: 'Production (current)',
      latin: 'Cairo',
      arabic: 'Cairo',
      stack: "'Cairo',sans-serif",
      google: 'family=Cairo:wght@300;400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Production (Cairo)'
    },
    {
      id: 'cairo',
      name: 'Cairo',
      latin: 'Cairo',
      arabic: 'Cairo',
      stack: "'Cairo',sans-serif",
      google: 'family=Cairo:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'tajawal',
      name: 'Tajawal',
      latin: 'Tajawal',
      arabic: 'Tajawal',
      stack: "'Tajawal',sans-serif",
      google: 'family=Tajawal:wght@400;500;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'noto-inter',
      name: 'Noto Sans Arabic + Inter',
      latin: 'Inter',
      arabic: 'Noto Sans Arabic',
      stack: "'Inter','Noto Sans Arabic',sans-serif",
      google: 'family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'ibm-inter',
      name: 'IBM Plex Sans Arabic + Inter',
      latin: 'Inter',
      arabic: 'IBM Plex Sans Arabic',
      stack: "'Inter','IBM Plex Sans Arabic',sans-serif",
      google: 'family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'almarai',
      name: 'Almarai',
      latin: 'Almarai',
      arabic: 'Almarai',
      stack: "'Almarai',sans-serif",
      google: 'family=Almarai:wght@400;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'din-next',
      name: 'DIN Next LT Pro + Noto Sans Arabic',
      latin: 'DIN Next LT Pro',
      arabic: 'Noto Sans Arabic',
      stack: null,
      google: null,
      available: false,
      license: 'License verification required — DIN Next LT Pro is commercial (Linotype/Monotype). Not bundled.',
      source: 'Unavailable (no free web license in this preview)'
    },
    {
      id: 'manrope-noto',
      name: 'Manrope + Noto Sans Arabic',
      latin: 'Manrope',
      arabic: 'Noto Sans Arabic',
      stack: "'Manrope','Noto Sans Arabic',sans-serif",
      google: 'family=Manrope:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'poppins-cairo',
      name: 'Poppins + Cairo',
      latin: 'Poppins',
      arabic: 'Cairo',
      stack: "'Poppins','Cairo',sans-serif",
      google: 'family=Poppins:wght@400;500;600;700&family=Cairo:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'montserrat-tajawal',
      name: 'Montserrat + Tajawal',
      latin: 'Montserrat',
      arabic: 'Tajawal',
      stack: "'Montserrat','Tajawal',sans-serif",
      google: 'family=Montserrat:wght@400;500;600;700&family=Tajawal:wght@400;500;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    },
    {
      id: 'heebo-noto',
      name: 'Heebo + Noto Sans Arabic',
      latin: 'Heebo',
      arabic: 'Noto Sans Arabic',
      stack: "'Heebo','Noto Sans Arabic',sans-serif",
      google: 'family=Heebo:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Google Fonts'
    }
  ];

  var loadedFonts = Object.create(null);
  var compareIds = null;

  function t(key, params) {
    if (I18n && typeof I18n.t === 'function') return I18n.t(key, params);
    return key;
  }

  function status(code) {
    if (I18n && typeof I18n.statusLabel === 'function') return I18n.statusLabel(code);
    return code;
  }

  function money(n) {
    if (I18n && typeof I18n.formatMoney === 'function') return I18n.formatMoney(n);
    return 'EGP ' + Number(n).toFixed(2);
  }

  function dateSample() {
    if (I18n && typeof I18n.formatDate === 'function') {
      return I18n.formatDate('2026-09-03T12:00:00Z');
    }
    return 'Sep 3, 2026';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadGoogle(font) {
    if (!font.available || !font.google || loadedFonts[font.id]) return;
    loadedFonts[font.id] = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + font.google + '&display=swap';
    link.setAttribute('data-fp-font', font.id);
    document.head.appendChild(link);
  }

  function readCompare() {
    try {
      var raw = localStorage.getItem(STORAGE_COMPARE);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (e) { /* ignore */ }
    return FONTS.filter(function (f) { return f.available; }).map(function (f) { return f.id; });
  }

  function writeCompare(ids) {
    try { localStorage.setItem(STORAGE_COMPARE, JSON.stringify(ids)); } catch (e) { /* ignore */ }
  }

  function readEval() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_EVAL) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeEval(map) {
    try { localStorage.setItem(STORAGE_EVAL, JSON.stringify(map)); } catch (e) { /* ignore */ }
  }

  function evalKeys() {
    return [
      ['arabic', 'fontPreview.evalArabic'],
      ['latin', 'fontPreview.evalLatin'],
      ['density', 'fontPreview.evalDensity'],
      ['dashboard', 'fontPreview.evalDashboard'],
      ['table', 'fontPreview.evalTable'],
      ['button', 'fontPreview.evalButton'],
      ['numbers', 'fontPreview.evalNumbers'],
      ['mixed', 'fontPreview.evalMixed'],
      ['rtl', 'fontPreview.evalRtl'],
      ['overall', 'fontPreview.evalOverall']
    ];
  }

  function tableRowsHtml() {
    var rows = [
      { name: t('fontPreview.sampleName'), plan: t('fontPreview.planGold'), st: 'active', amt: 1250 },
      { name: 'Sara Hassan', plan: 'Silver', st: 'pending', amt: 800 },
      { name: 'Omar Nabil', plan: 'Gold', st: 'expired', amt: 0 },
      { name: 'Lina Farouk', plan: 'Day Pass', st: 'cancelled', amt: 150 },
      { name: 'Youssef Kamal', plan: 'Annual', st: 'active', amt: 5900 },
      { name: 'Mona Adel', plan: 'Trial', st: 'pending', amt: 0 }
    ];
    return rows.map(function (r) {
      return (
        '<tr>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td>' + esc(r.plan) + '</td>' +
        '<td><span class="fp-status ' + esc(r.st) + '">' + esc(status(r.st)) + '</span></td>' +
        '<td>' + esc(dateSample()) + '</td>' +
        '<td>' + esc(money(r.amt)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function uiBlockHtml(font) {
    if (!font.available) {
      return (
        '<div class="fp-ui">' +
        '<p class="fp-body"><strong>' + esc(t('fontPreview.unavailable')) + '</strong></p>' +
        '<p class="fp-small">' + esc(font.license) + '</p>' +
        '<p class="fp-caption">' + esc(t('fontPreview.licenseRequired')) + '</p>' +
        '</div>'
      );
    }

    return (
      '<div class="fp-ui" style="--fp-stack:' + esc(font.stack) + '">' +
      '<div class="fp-display">' + esc(t('dashboard.title')) + '</div>' +
      '<div class="fp-page-h">' + esc(t('fontPreview.welcomeBack')) + '</div>' +
      '<div class="fp-kpis">' +
      '<div class="fp-kpi"><div class="lbl">' + esc(t('fontPreview.revenueToday')) + '</div><div class="val">' + esc(money(5900)) + '</div></div>' +
      '<div class="fp-kpi"><div class="lbl">' + esc(t('nav.members')) + '</div><div class="val">1,248</div></div>' +
      '<div class="fp-kpi"><div class="lbl">' + esc(t('fontPreview.activeMemberships')) + '</div><div class="val">982</div></div>' +
      '</div>' +
      '<div class="fp-actions">' +
      '<button type="button" class="fp-btn lime">' + esc(t('members.add')) + '</button>' +
      '<button type="button" class="fp-btn">' + esc(t('common.save')) + '</button>' +
      '<button type="button" class="fp-btn ghost">' + esc(t('common.cancel')) + '</button>' +
      '<button type="button" class="fp-btn danger">' + esc(t('common.delete')) + '</button>' +
      '</div>' +
      '<div class="fp-statuses">' +
      '<span class="fp-status active">' + esc(status('active')) + '</span>' +
      '<span class="fp-status expired">' + esc(status('expired')) + '</span>' +
      '<span class="fp-status pending">' + esc(status('pending')) + '</span>' +
      '<span class="fp-status cancelled">' + esc(status('cancelled')) + '</span>' +
      '</div>' +
      '<div class="fp-table-wrap"><table class="fp-table"><thead><tr>' +
      '<th>' + esc(t('fontPreview.memberCol')) + '</th>' +
      '<th>' + esc(t('fontPreview.membershipCol')) + '</th>' +
      '<th>' + esc(t('fontPreview.statusCol')) + '</th>' +
      '<th>' + esc(t('fontPreview.expiryCol')) + '</th>' +
      '<th>' + esc(t('fontPreview.amountCol')) + '</th>' +
      '</tr></thead><tbody>' + tableRowsHtml() + '</tbody></table></div>' +
      '<div class="fp-stress">' +
      '<div class="fp-section">' + esc(t('fontPreview.stressShort')) + '</div>' +
      '<div class="fp-body">' + esc(t('fontPreview.stressLong')) + '</div>' +
      '<div class="fp-body">' + esc(t('fontPreview.stressMixed')) + '</div>' +
      '<div class="fp-small">1,248 · 12,500.00 · ' + esc(money(86032)) + ' · ' + esc(dateSample()) + '</div>' +
      '<div class="fp-caption" dir="rtl" lang="ar">١٬٢٤٨ · ١٢٬٥٠٠٫٠٠ · ٣ سبتمبر ٢٠٢٦</div>' +
      '</div>' +
      '<div class="fp-scale">' +
      '<div style="font-size:32px;font-weight:700">' + esc(t('fontPreview.scaleDisplay')) + ' 32</div>' +
      '<div style="font-size:24px;font-weight:700">' + esc(t('fontPreview.scalePage')) + ' 24</div>' +
      '<div style="font-size:18px;font-weight:700">' + esc(t('fontPreview.scaleSection')) + ' 18</div>' +
      '<div style="font-size:16px">' + esc(t('fontPreview.scaleBody')) + ' 16</div>' +
      '<div style="font-size:14px">' + esc(t('fontPreview.scaleBody')) + ' 14</div>' +
      '<div style="font-size:12px">' + esc(t('fontPreview.scaleSmall')) + ' 12</div>' +
      '<div style="font-size:11px;color:#8c8c8c">' + esc(t('fontPreview.scaleCaption')) + ' 11</div>' +
      '</div>' +
      '<div class="fp-section">' + esc(t('fontPreview.weights')) + '</div>' +
      '<div class="fp-weights">' +
      '<span style="font-weight:400">' + esc(t('fontPreview.weightRegular')) + '</span>' +
      '<span style="font-weight:500">' + esc(t('fontPreview.weightMedium')) + '</span>' +
      '<span style="font-weight:600">' + esc(t('fontPreview.weightSemibold')) + '</span>' +
      '<span style="font-weight:700">' + esc(t('fontPreview.weightBold')) + '</span>' +
      '</div>' +
      '</div>'
    );
  }

  function cardHtml(font, evalMap) {
    var ev = evalMap[font.id] || {};
    var avail = font.available
      ? '<span class="fp-badge-avail">OK</span>'
      : '<span class="fp-badge-avail no">' + esc(t('fontPreview.unavailable')) + '</span>';

    var evalHtml = evalKeys().map(function (pair) {
      var k = pair[0];
      var labelKey = pair[1];
      return (
        '<label>' + esc(t(labelKey)) +
        '<input type="text" data-fp-eval="' + esc(font.id) + '" data-fp-field="' + esc(k) + '" ' +
        'placeholder="' + esc(t('fontPreview.evalPlaceholder')) + '" value="' + esc(ev[k] || '') + '">' +
        '</label>'
      );
    }).join('');

    return (
      '<article class="fp-card' + (font.available ? '' : ' is-unavailable') + '" data-font-id="' + esc(font.id) + '">' +
      '<div class="fp-card-head">' +
      '<div><h2 class="fp-card-title">' + esc(font.name) + '</h2>' +
      '<p class="fp-card-pair"><span data-i18n-skip>' + esc(t('fontPreview.latin')) + ':</span> ' + esc(font.latin) +
      '<br><span>' + esc(t('fontPreview.arabicScript')) + ':</span> ' + esc(font.arabic) + '</p></div>' +
      avail +
      '</div>' +
      uiBlockHtml(font) +
      '<p class="fp-license">' + esc(font.source) + ' — ' + esc(font.license) + '</p>' +
      '<div class="fp-eval"><h4 data-i18n="fontPreview.evalTitle">' + esc(t('fontPreview.evalTitle')) + '</h4>' +
      '<div class="fp-eval-grid">' + evalHtml + '</div></div>' +
      '</article>'
    );
  }

  function visibleFonts() {
    var set = {};
    (compareIds || []).forEach(function (id) { set[id] = true; });
    var list = FONTS.filter(function (f) { return set[f.id]; });
    if (!list.length) list = FONTS.filter(function (f) { return f.available; });
    return list;
  }

  function renderGrid() {
    var grid = document.getElementById('fpGrid');
    if (!grid) return;
    var evalMap = readEval();
    var list = visibleFonts();
    list.forEach(loadGoogle);
    grid.innerHTML = list.map(function (f) { return cardHtml(f, evalMap); }).join('');

    var sel = document.getElementById('fpSelectionLabel');
    if (sel) {
      sel.textContent = list.map(function (f) { return f.name; }).join(' · ') || '—';
    }
  }

  function renderCompareChecks() {
    var host = document.getElementById('fpCompareChecks');
    if (!host) return;
    var selected = {};
    (compareIds || []).forEach(function (id) { selected[id] = true; });
    host.innerHTML = FONTS.map(function (f) {
      var disabled = !f.available ? ' disabled' : '';
      var cls = !f.available ? ' class="is-disabled"' : '';
      var checked = selected[f.id] ? ' checked' : '';
      return (
        '<label' + cls + '>' +
        '<input type="checkbox" data-fp-compare="' + esc(f.id) + '"' + checked + disabled + '>' +
        esc(f.name) +
        '</label>'
      );
    }).join('');
  }

  function syncLangChips() {
    var loc = I18n ? I18n.getLocale() : 'en';
    var en = document.getElementById('fpLangEn');
    var ar = document.getElementById('fpLangAr');
    if (en) en.classList.toggle('is-active', loc === 'en');
    if (ar) ar.classList.toggle('is-active', loc === 'ar');
  }

  function bind() {
    compareIds = readCompare();
    renderCompareChecks();
    renderGrid();
    syncLangChips();
    if (I18n) I18n.applyDocumentLocale();

    document.getElementById('fpLangEn').addEventListener('click', function () {
      if (I18n) I18n.setLocale('en');
      syncLangChips();
      renderGrid();
    });
    document.getElementById('fpLangAr').addEventListener('click', function () {
      if (I18n) I18n.setLocale('ar');
      syncLangChips();
      renderGrid();
    });

    document.getElementById('fpSelectAll').addEventListener('click', function () {
      compareIds = FONTS.filter(function (f) { return f.available; }).map(function (f) { return f.id; });
      writeCompare(compareIds);
      renderCompareChecks();
      renderGrid();
    });
    document.getElementById('fpClearCompare').addEventListener('click', function () {
      compareIds = ['production'];
      writeCompare(compareIds);
      renderCompareChecks();
      renderGrid();
    });

    document.getElementById('fpCompareChecks').addEventListener('change', function (e) {
      var tEl = e.target;
      if (!tEl || !tEl.getAttribute) return;
      var id = tEl.getAttribute('data-fp-compare');
      if (!id) return;
      var set = {};
      (compareIds || []).forEach(function (x) { set[x] = true; });
      if (tEl.checked) set[id] = true;
      else delete set[id];
      compareIds = Object.keys(set);
      if (!compareIds.length) compareIds = ['production'];
      writeCompare(compareIds);
      renderGrid();
    });

    document.getElementById('fpGrid').addEventListener('input', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      var fontId = el.getAttribute('data-fp-eval');
      var field = el.getAttribute('data-fp-field');
      if (!fontId || !field) return;
      var map = readEval();
      map[fontId] = map[fontId] || {};
      map[fontId][field] = el.value;
      writeEval(map);
    });

    // Apply stays disabled — preview only
    var apply = document.getElementById('fpApply');
    if (apply) {
      apply.disabled = true;
      apply.title = t('fontPreview.applyDisabled');
    }

    global.addEventListener('gfp:locale', function () {
      syncLangChips();
      renderGrid();
    });
  }

  global.GfpFontPreview = {
    FONTS: FONTS,
    loadGoogle: loadGoogle,
    renderGrid: renderGrid
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : globalThis);
