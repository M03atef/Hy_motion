/**
 * HyMotion desk feedback modal — replaces native prompt()/clipboard beta feedback.
 * Depends on: api-client (GfpApi), i18n (GfpI18n), toast (GfpToast), app-version (GfpVersion).
 */
(function (global) {
  'use strict';

  var MSG_MIN = 10;
  var MSG_MAX = 4000;
  var SUBJECT_MAX = 200;
  var CATEGORIES = ['feature', 'problem', 'general', 'other'];
  var overlayEl = null;
  var submitting = false;
  var selectedCategory = 'general';
  var clientRequestId = null;

  function t(key, vars) {
    if (global.GfpI18n && typeof global.GfpI18n.t === 'function') return global.GfpI18n.t(key, vars);
    return key;
  }

  function ensureCss() {
    if (global.document.getElementById('gfpFeedbackCss')) return;
    var link = global.document.createElement('link');
    link.id = 'gfpFeedbackCss';
    link.rel = 'stylesheet';
    link.href = '/shared/feedback.css?v=1';
    global.document.head.appendChild(link);
  }

  function newRequestId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function setError(msg) {
    var err = overlayEl && overlayEl.querySelector('[data-fb-error]');
    if (!err) return;
    if (msg) {
      err.textContent = msg;
      err.classList.add('is-on');
    } else {
      err.textContent = '';
      err.classList.remove('is-on');
    }
  }

  function updateCounter() {
    var ta = overlayEl && overlayEl.querySelector('#gfpFbMessage');
    var counter = overlayEl && overlayEl.querySelector('[data-fb-count]');
    if (!ta || !counter) return;
    var n = String(ta.value || '').length;
    counter.textContent = n + ' / ' + MSG_MAX;
  }

  function paintTypes() {
    if (!overlayEl) return;
    overlayEl.querySelectorAll('[data-fb-cat]').forEach(function (btn) {
      var on = btn.getAttribute('data-fb-cat') === selectedCategory;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function showForm() {
    var form = overlayEl.querySelector('[data-fb-form]');
    var success = overlayEl.querySelector('[data-fb-success]');
    if (form) form.hidden = false;
    if (success) success.hidden = true;
  }

  function showSuccess() {
    var form = overlayEl.querySelector('[data-fb-form]');
    var success = overlayEl.querySelector('[data-fb-success]');
    if (form) form.hidden = true;
    if (success) success.hidden = false;
  }

  function buildOverlay() {
    var el = global.document.createElement('div');
    el.className = 'gfp-fb-overlay';
    el.id = 'gfpFeedbackOverlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'gfpFbTitle');
    el.innerHTML =
      '<div class="gfp-fb-panel">' +
        '<div data-fb-form>' +
          '<div class="gfp-fb-hdr">' +
            '<div>' +
              '<h2 id="gfpFbTitle"></h2>' +
              '<p class="gfp-fb-sub" data-fb-sub></p>' +
            '</div>' +
            '<button type="button" class="gfp-fb-close" data-fb-close aria-label="Close"><i class="ti ti-x" aria-hidden="true"></i></button>' +
          '</div>' +
          '<div class="gfp-fb-body">' +
            '<div class="gfp-fb-label"><span data-fb-type-label></span>' +
              '<div class="gfp-fb-types" role="group">' +
                CATEGORIES.map(function (c) {
                  return '<button type="button" class="gfp-fb-type" data-fb-cat="' + c + '" aria-pressed="false">' +
                    '<span data-fb-cat-title></span><small data-fb-cat-hint></small></button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<label class="gfp-fb-label"><span data-fb-subject-label></span>' +
              '<input class="gfp-fb-input" id="gfpFbSubject" type="text" maxlength="' + SUBJECT_MAX + '" autocomplete="off">' +
            '</label>' +
            '<label class="gfp-fb-label"><span data-fb-message-label></span>' +
              '<textarea class="gfp-fb-textarea" id="gfpFbMessage" maxlength="' + MSG_MAX + '" required></textarea>' +
              '<div class="gfp-fb-meta"><span data-fb-required></span><span data-fb-count>0 / ' + MSG_MAX + '</span></div>' +
            '</label>' +
            '<p class="gfp-fb-err" data-fb-error role="alert"></p>' +
          '</div>' +
          '<div class="gfp-fb-ft">' +
            '<button type="button" class="btn secondary" data-fb-cancel></button>' +
            '<button type="button" class="btn primary" data-fb-submit></button>' +
          '</div>' +
        '</div>' +
        '<div class="gfp-fb-success" data-fb-success hidden>' +
          '<div class="gfp-fb-success-icon"><i class="ti ti-check" aria-hidden="true"></i></div>' +
          '<h3 data-fb-ok-title></h3>' +
          '<p data-fb-ok-body></p>' +
          '<button type="button" class="btn primary" data-fb-done></button>' +
        '</div>' +
      '</div>';
    return el;
  }

  function localize() {
    if (!overlayEl) return;
    overlayEl.querySelector('#gfpFbTitle').textContent = t('feedback.title');
    overlayEl.querySelector('[data-fb-sub]').textContent = t('feedback.subtitle');
    overlayEl.querySelector('[data-fb-type-label]').textContent = t('feedback.type');
    overlayEl.querySelector('[data-fb-subject-label]').textContent = t('feedback.subjectOptional');
    overlayEl.querySelector('[data-fb-message-label]').textContent = t('feedback.message');
    overlayEl.querySelector('[data-fb-required]').textContent = t('feedback.messageHint');
    overlayEl.querySelector('[data-fb-cancel]').textContent = t('feedback.cancel');
    overlayEl.querySelector('[data-fb-submit]').textContent = t('feedback.submit');
    overlayEl.querySelector('[data-fb-ok-title]').textContent = t('feedback.successTitle');
    overlayEl.querySelector('[data-fb-ok-body]').textContent = t('feedback.successBody');
    overlayEl.querySelector('[data-fb-done]').textContent = t('feedback.close');
    overlayEl.querySelector('[data-fb-close]').setAttribute('aria-label', t('feedback.close'));
    var subject = overlayEl.querySelector('#gfpFbSubject');
    var message = overlayEl.querySelector('#gfpFbMessage');
    if (subject) subject.placeholder = t('feedback.subjectPlaceholder');
    if (message) message.placeholder = t('feedback.messagePlaceholder');
    CATEGORIES.forEach(function (c) {
      var btn = overlayEl.querySelector('[data-fb-cat="' + c + '"]');
      if (!btn) return;
      btn.querySelector('[data-fb-cat-title]').textContent = t('feedback.cat.' + c);
      btn.querySelector('[data-fb-cat-hint]').textContent = t('feedback.catHint.' + c);
    });
    paintTypes();
    updateCounter();
  }

  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-open');
    global.document.body.style.overflow = '';
    submitting = false;
  }

  function open() {
    ensureCss();
    if (!overlayEl) {
      overlayEl = buildOverlay();
      global.document.body.appendChild(overlayEl);

      overlayEl.addEventListener('click', function (e) {
        if (e.target === overlayEl) close();
      });
      overlayEl.querySelectorAll('[data-fb-close], [data-fb-cancel], [data-fb-done]').forEach(function (btn) {
        btn.addEventListener('click', close);
      });
      overlayEl.querySelectorAll('[data-fb-cat]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selectedCategory = btn.getAttribute('data-fb-cat') || 'general';
          paintTypes();
        });
      });
      var ta = overlayEl.querySelector('#gfpFbMessage');
      if (ta) ta.addEventListener('input', updateCounter);
      overlayEl.querySelector('[data-fb-submit]').addEventListener('click', submit);
      global.document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('is-open')) close();
      });
    }

    selectedCategory = 'general';
    clientRequestId = newRequestId();
    var subject = overlayEl.querySelector('#gfpFbSubject');
    var message = overlayEl.querySelector('#gfpFbMessage');
    if (subject) subject.value = '';
    if (message) message.value = '';
    setError('');
    showForm();
    localize();
    overlayEl.classList.add('is-open');
    global.document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (message) message.focus();
    }, 50);
  }

  function submit() {
    if (submitting || !overlayEl) return;
    setError('');
    var subject = String((overlayEl.querySelector('#gfpFbSubject') || {}).value || '').trim();
    var message = String((overlayEl.querySelector('#gfpFbMessage') || {}).value || '').trim();
    if (message.length < MSG_MIN) {
      setError(t('feedback.errMessageShort'));
      return;
    }
    if (message.length > MSG_MAX) {
      setError(t('feedback.errMessageLong'));
      return;
    }
    if (subject.length > SUBJECT_MAX) {
      setError(t('feedback.errSubjectLong'));
      return;
    }

    var api = global.GfpApi || global.ApiClient;
    if (!api || typeof api.request !== 'function' && typeof api.post !== 'function') {
      // Prefer shared api-client helpers when present
      if (global.apiRequest) {
        api = { post: function (url, body) { return global.apiRequest({ method: 'POST', url: url, body: body }); } };
      }
    }

    var version = global.GfpVersion && typeof global.GfpVersion.get === 'function' ? global.GfpVersion.get() : '';
    var pageUrl = global.location && global.location.href ? String(global.location.href) : '';
    var payload = {
      category: selectedCategory,
      subject: subject || null,
      message: message,
      appVersion: version || null,
      pageUrl: pageUrl || null,
      clientRequestId: clientRequestId
    };

    var submitBtn = overlayEl.querySelector('[data-fb-submit]');
    submitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t('feedback.submitting');
    }

    function doneOk() {
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t('feedback.submit');
      }
      showSuccess();
    }
    function doneFail(errMsg) {
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t('feedback.submit');
      }
      setError(errMsg || t('feedback.errSubmit'));
    }

    function post() {
      if (global.GfpApi && typeof global.GfpApi.post === 'function') {
        return global.GfpApi.post('/feedback', payload).then(function (r) {
          if (!r || !r.ok) {
            var err = (r && r.data && (r.data.error || r.data.message)) || t('feedback.errSubmit');
            var e = new Error(err);
            e.status = r && r.status;
            e.error = err;
            throw e;
          }
          return r.data;
        });
      }
      return Promise.reject(new Error('api-missing'));
    }

    post()
      .then(function (res) {
        if (res && res.error) {
          doneFail(res.error || res.message || t('feedback.errSubmit'));
          return;
        }
        doneOk();
      })
      .catch(function (err) {
        var msg = (err && (err.error || err.message)) || t('feedback.errSubmit');
        if (err && err.status === 401) msg = t('feedback.errAuth');
        if (err && err.status === 429) msg = t('errors.rateLimited');
        doneFail(msg);
      });
  }

  global.GfpFeedback = {
    open: open,
    close: close
  };

  global.document.addEventListener('gfp:locale', function () {
    if (overlayEl && overlayEl.classList.contains('is-open')) localize();
  });
})(typeof window !== 'undefined' ? window : globalThis);
