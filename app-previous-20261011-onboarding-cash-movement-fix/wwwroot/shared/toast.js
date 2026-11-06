/**
 * HyMotion — shared toast notification module.
 * Replaces per-page duplicated toast() functions with a single consistent implementation.
 *
 * Usage:  GfpToast.show('Saved successfully');
 *         GfpToast.show('Something went wrong', 'error');
 *         GfpToast.success('Member added');
 *         GfpToast.error('Could not save');
 *         GfpToast.warn('Connection is slow');
 *
 * Stacks multiple toasts. Auto-removes. RTL-safe. Bilingual-ready.
 * Error toasts stay visible longer (6s) than success (4s).
 */
(function (global) {
  'use strict';

  var CONTAINER_ID = 'gfp-toast-container';
  var DURATIONS = { success: 4000, error: 6000, warn: 5000, info: 4000 };
  var ICONS = {
    success: 'ti-check',
    error: 'ti-alert-circle',
    warn: 'ti-alert-triangle',
    info: 'ti-info-circle'
  };

  function getContainer() {
    var c = global.document.getElementById(CONTAINER_ID);
    if (c) return c;
    c = global.document.createElement('div');
    c.id = CONTAINER_ID;
    // Inline critical styles so toast works even if toast.css hasn't loaded
    c.style.cssText = 'position:fixed;bottom:24px;z-index:9999;display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;max-width:420px;width:calc(100% - 48px)';
    // RTL: right for LTR, left for RTL
    if (global.document.documentElement.dir === 'rtl') {
      c.style.left = '24px';
    } else {
      c.style.right = '24px';
    }
    global.document.body.appendChild(c);
    return c;
  }

  /**
   * @param {string} msg
   * @param {'success'|'error'|'warn'|'info'} [type='success']
   * @param {{ duration?: number, html?: string }} [opts]
   */
  function show(msg, type, opts) {
    type = type || 'success';
    opts = opts || {};
    var duration = opts.duration || DURATIONS[type] || 4000;

    var el = global.document.createElement('div');
    el.className = 'gfp-toast gfp-toast--' + type;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.style.cssText = 'pointer-events:auto;padding:14px 24px;border-radius:var(--rmd, 8px);font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;transform:translateY(20px);opacity:0;transition:all .3s ease;';

    // Type-specific colors
    var colors = {
      success: 'background:var(--suc100,#dcfce7);color:var(--suc500,#22c55e);border:1px solid rgba(34,197,94,.3)',
      error: 'background:var(--dng100,#fee2e2);color:var(--dng500,#ef4444);border:1px solid rgba(239,68,68,.3)',
      warn: 'background:var(--wrn100,#fef9c3);color:var(--wrn700,#a16207);border:1px solid rgba(234,179,8,.3)',
      info: 'background:var(--inf100,#dbeafe);color:var(--inf500,#3b82f6);border:1px solid rgba(59,130,246,.3)'
    };
    el.style.cssText += ';' + (colors[type] || colors.info);

    var iconClass = ICONS[type] || ICONS.info;
    var escaped = escapeHtml(msg);
    el.innerHTML = '<i class="ti ' + iconClass + '" style="font-size:18px;flex-shrink:0"></i><span>' + escaped + '</span>';
    if (opts.html) {
      el.innerHTML += opts.html;
    }

    var container = getContainer();
    container.appendChild(el);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
      });
    });

    // Auto-remove
    var timer = setTimeout(function () { dismiss(el); }, duration);

    // Allow click to dismiss
    el.addEventListener('click', function () {
      clearTimeout(timer);
      dismiss(el);
    });

    // Cap max visible toasts (prevent spam)
    var children = container.children;
    while (children.length > 5) {
      dismiss(children[0]);
    }

    return el;
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  function escapeHtml(s) {
    var d = global.document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  var GfpToast = {
    show: show,
    success: function (msg, opts) { return show(msg, 'success', opts); },
    error: function (msg, opts) { return show(msg, 'error', opts); },
    warn: function (msg, opts) { return show(msg, 'warn', opts); },
    info: function (msg, opts) { return show(msg, 'info', opts); },
    dismiss: dismiss
  };

  // Backward-compatibility alias:
  // Many existing pages define their own local `toast()`; after migration they can
  // delegate to this shared implementation.
  function coerceType(type) {
    if (!type) return 'success';
    if (type === 'err' || type === 'error') return 'error';
    if (type === 'warn' || type === 'warning') return 'warn';
    if (type === 'info') return 'info';
    return String(type);
  }

  global.toast = function toast(msg, type, htmlExtra) {
    if (!global.GfpToast) return null;
    var t = coerceType(type);
    var opts = {};
    if (typeof htmlExtra === 'string' && htmlExtra) opts.html = htmlExtra;
    return global.GfpToast.show(msg, t, opts);
  };

  // Stable reference for page-level wrappers that may also define a local `toast`.
  global.toastShared = global.toast;

  global.GfpToast = GfpToast;
})(typeof window !== 'undefined' ? window : globalThis);
