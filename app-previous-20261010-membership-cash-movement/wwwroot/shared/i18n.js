/**
 * HyMotion — bilingual messages (message / messageAr) + full-page RTL locale toggle.
 * Catalog keys via GfpI18n.t (from shared/i18n-catalog.js / @gymflowpro/i18n).
 * html[dir=rtl|ltr] drives shared/rtl.css for the entire page (not sidebar-only).
 */
(function (global) {
  'use strict';

  var LOCALE_KEY = 'gfp_locale';

  function getLocale() {
    var v = global.localStorage.getItem(LOCALE_KEY);
    return v === 'ar' ? 'ar' : 'en';
  }

  function setLocale(locale) {
    locale = locale === 'ar' ? 'ar' : 'en';
    global.localStorage.setItem(LOCALE_KEY, locale);
    applyDocumentLocale(locale);
    try {
      global.dispatchEvent(new CustomEvent('gfp:locale', { detail: { locale: locale } }));
    } catch (e) { /* ignore */ }
    return locale;
  }

  function applyDocumentLocale(locale) {
    locale = locale || getLocale();
    var html = global.document && global.document.documentElement;
    if (!html) return;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
    html.setAttribute('data-locale', locale);
    if (global.document.body) {
      global.document.body.classList.toggle('gfp-rtl', locale === 'ar');
      global.document.body.classList.toggle('gfp-ltr', locale !== 'ar');
    }
    normalizeLegacySlashTitles();
    applyDataLocaleAttributes(locale);
    applyDataI18nAttributes(locale);
  }

  function getCatalog() {
    return (global.GfpI18nCatalog) || { en: {}, ar: {} };
  }

  function applyPlural(template, params) {
    return String(template).replace(
      /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
      function (_, name, one, other) {
        var n = Number(params[name] != null ? params[name] : 0);
        var branch = n === 1 ? one : other;
        return branch.replace(/#/g, String(n));
      }
    );
  }

  function interpolate(template, params) {
    if (!params) return template;
    var out = applyPlural(template, params);
    return out.replace(/\{(\w+)\}/g, function (_, key) {
      return params[key] != null ? String(params[key]) : '{' + key + '}';
    });
  }

  /**
   * Catalog lookup: GfpI18n.t('members.title') or t('members.greeting', { name: 'Ali' })
   */
  function hasCatalogKey(key, locale) {
    locale = locale || getLocale();
    var cat = getCatalog();
    var primary = cat[locale] || {};
    var fallback = cat.en || {};
    return primary[key] != null || fallback[key] != null;
  }

  function t(key, params, locale) {
    locale = locale || getLocale();
    var cat = getCatalog();
    var primary = cat[locale] || cat.en || {};
    var fallback = cat.en || {};
    var template = primary[key];
    if (template == null) template = fallback[key];
    if (template == null) return key;
    return interpolate(String(template), params);
  }

  /** Convert leftover `Title <span class="title-ar">/ الترجمة</span>` into data-en/data-ar. */
  function normalizeLegacySlashTitles() {
    var root = global.document;
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.title-ar, .title-ar-sm').forEach(function (span) {
      var parent = span.parentNode;
      if (!parent || parent.nodeType !== 1) return;
      var ar = String(span.textContent || '').replace(/^\s*\/\s*/, '').trim();
      var enBits = [];
      Array.prototype.forEach.call(parent.childNodes, function (n) {
        if (n === span) return;
        if (n.nodeType === 3 && String(n.textContent).trim()) enBits.push(String(n.textContent).trim());
      });
      var en = enBits.join(' ');
      if (!parent.getAttribute('data-en') && en) parent.setAttribute('data-en', en);
      if (!parent.getAttribute('data-ar') && ar) parent.setAttribute('data-ar', ar);
      if (span.parentNode) span.parentNode.removeChild(span);
    });
  }

  function applyDataLocaleAttributes(locale) {
    locale = locale || getLocale();
    var root = global.document;
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('[data-en],[data-ar]').forEach(function (el) {
      var en = el.getAttribute('data-en');
      var ar = el.getAttribute('data-ar');
      var text = locale === 'ar' ? ar || en : en || ar;
      if (text == null) return;
      var label = el.querySelector('[data-i18n-text]');
      if (label) {
        label.textContent = text;
      } else if (!el.querySelector('input,select,textarea,button,a,i,svg,img')) {
        el.textContent = text;
      } else if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        el.textContent = text;
      } else {
        var tn = null;
        var i;
        for (i = 0; i < el.childNodes.length; i++) {
          var n = el.childNodes[i];
          if (n.nodeType === 3 && String(n.textContent).trim()) tn = n;
        }
        if (tn) tn.textContent = ' ' + text;
      }
    });

    root.querySelectorAll('[data-en-title],[data-ar-title]').forEach(function (el) {
      var en = el.getAttribute('data-en-title');
      var ar = el.getAttribute('data-ar-title');
      var tx = locale === 'ar' ? ar || en : en || ar;
      if (tx != null) el.setAttribute('title', tx);
    });

    root.querySelectorAll('[data-en-placeholder],[data-ar-placeholder]').forEach(function (el) {
      var en = el.getAttribute('data-en-placeholder');
      var ar = el.getAttribute('data-ar-placeholder');
      var tx = locale === 'ar' ? ar || en : en || ar;
      if (tx != null) el.setAttribute('placeholder', tx);
    });
  }

  /** Elements with data-i18n="common.save" use the JSON catalog. */
  function applyDataI18nAttributes(locale) {
    locale = locale || getLocale();
    var root = global.document;
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      // Missing catalog keys must NOT wipe HTML (login used to show "emailLabel").
      if (!key || !hasCatalogKey(key, locale)) return;
      var text = t(key, null, locale);
      var label = el.querySelector('[data-i18n-text]');
      if (label) label.textContent = text;
      else if (!el.querySelector('input,select,textarea,button,a,i,svg,img')) el.textContent = text;
      else if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) el.textContent = text;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key || !hasCatalogKey(key, locale)) return;
      el.setAttribute('placeholder', t(key, null, locale));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (!key || !hasCatalogKey(key, locale)) return;
      el.setAttribute('title', t(key, null, locale));
    });
  }

  function pickBilingual(message, messageAr, locale) {
    locale = locale || getLocale();
    var en = String(message || '').trim();
    var ar = String(messageAr || '').trim();
    if (en || ar) {
      if (locale === 'ar') return ar || en;
      return en || ar;
    }
    return '';
  }

  function splitSlashBilingual(combined) {
    var raw = String(combined || '').trim();
    if (!raw) return { message: '', messageAr: '' };
    var idx = raw.indexOf(' / ');
    if (idx === -1) return { message: raw, messageAr: raw };
    return {
      message: raw.slice(0, idx).trim(),
      messageAr: raw.slice(idx + 3).trim()
    };
  }

  function displayBilingualText(input, locale) {
    locale = locale || getLocale();
    if (input == null) return '';
    if (typeof input === 'string') {
      var parts = splitSlashBilingual(input);
      return pickBilingual(parts.message, parts.messageAr, locale);
    }
    if (input.message != null || input.messageAr != null) {
      return pickBilingual(input.message, input.messageAr, locale);
    }
    if (input.detail) {
      var p2 = splitSlashBilingual(input.detail);
      return pickBilingual(p2.message, p2.messageAr, locale);
    }
    if (input.error && typeof input.error === 'object') {
      return displayBilingualText(input.error, locale);
    }
    return '';
  }

  function displayApiError(resultOrError, locale) {
    locale = locale || getLocale();
    if (!resultOrError) return '';

    function fromObj(obj) {
      if (!obj || typeof obj !== 'object') return '';
      if (obj.message != null || obj.messageAr != null) {
        var picked = pickBilingual(obj.message, obj.messageAr, locale);
        if (obj.messageAr == null || String(obj.messageAr).trim() === '') {
          var parts = splitSlashBilingual(obj.message);
          if (parts.messageAr && parts.messageAr !== parts.message) {
            return pickBilingual(parts.message, parts.messageAr, locale);
          }
        }
        return picked;
      }
      if (obj.error && typeof obj.error === 'string') {
        return displayBilingualText(obj.error, locale);
      }
      if (obj.detail) {
        var p2 = splitSlashBilingual(obj.detail);
        return pickBilingual(p2.message, p2.messageAr, locale);
      }
      return '';
    }

    if (resultOrError.error) {
      var fromErr = typeof resultOrError.error === 'string'
        ? displayBilingualText(resultOrError.error, locale)
        : fromObj(resultOrError.error);
      if (fromErr) return fromErr;
    }
    if (resultOrError.data) {
      var fromData = fromObj(resultOrError.data);
      if (fromData) return fromData;
    }
    var direct = fromObj(resultOrError);
    if (direct) return direct;
    if (typeof resultOrError === 'string') {
      return displayBilingualText(resultOrError, locale);
    }
    return '';
  }

  function tLabel(en, ar, locale) {
    return pickBilingual(en, ar, locale || getLocale());
  }

  var STATUS_KEY = {
    active: 'status.active',
    expired: 'status.expired',
    pending: 'status.pending',
    frozen: 'status.frozen',
    cancelled: 'status.cancelled',
    canceled: 'status.cancelled',
    completed: 'status.completed',
    refunded: 'status.refunded',
    failed: 'status.failed',
    draft: 'status.draft',
    accepted: 'status.accepted',
    ready: 'status.ready',
    rejected: 'status.rejected',
    open: 'status.open',
    closed: 'status.closed',
    trialing: 'status.trialing',
    past_due: 'status.past_due',
    suspended: 'status.suspended',
    none: 'membership.none'
  };

  function statusLabel(code, locale) {
    locale = locale || getLocale();
    var key = STATUS_KEY[String(code || '').toLowerCase()];
    if (!key) return String(code || '');
    return t(key, null, locale);
  }

  function formatMoney(amount, locale) {
    locale = locale || getLocale();
    var n = Number(amount);
    var formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(isFinite(n) ? n : 0);
    return t('format.currency', { amount: formatted }, locale);
  }

  function formatNumber(value, locale, opts) {
    locale = locale || getLocale();
    var n = Number(value);
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', opts || {}).format(
      isFinite(n) ? n : 0
    );
  }

  function formatDate(isoOrDate, locale) {
    locale = locale || getLocale();
    var d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  }

  function formatDateTime(isoOrDate, locale) {
    locale = locale || getLocale();
    var d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  function toggleLocale() {
    return setLocale(getLocale() === 'ar' ? 'en' : 'ar');
  }

  function isRtl() {
    return getLocale() === 'ar';
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () {
        applyDocumentLocale();
      });
    } else {
      applyDocumentLocale();
    }
  }

  global.GfpI18n = {
    getLocale: getLocale,
    setLocale: setLocale,
    toggleLocale: toggleLocale,
    applyDocumentLocale: applyDocumentLocale,
    applyDataLocaleAttributes: applyDataLocaleAttributes,
    applyDataI18nAttributes: applyDataI18nAttributes,
    hasCatalogKey: hasCatalogKey,
    pickBilingual: pickBilingual,
    splitSlashBilingual: splitSlashBilingual,
    displayBilingualText: displayBilingualText,
    displayApiError: displayApiError,
    tLabel: tLabel,
    t: t,
    statusLabel: statusLabel,
    formatMoney: formatMoney,
    formatNumber: formatNumber,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    isRtl: isRtl
  };
})(typeof window !== 'undefined' ? window : globalThis);
