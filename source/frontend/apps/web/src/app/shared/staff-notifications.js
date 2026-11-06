/**
 * Staff notification unread badge + light polling / SignalR refresh.
 * Updates [data-nav-key="notifications"] with .gfp-notif-badge.
 */
(function (global) {
  'use strict';

  var POLL_MS = 60000;
  var lastCount = null;
  var timer = null;

  function apiClient() {
    return global.GfpApi || global.Gfp || null;
  }

  function setBadge(count) {
    lastCount = count;
    var links = global.document.querySelectorAll('[data-nav-key="notifications"]');
    links.forEach(function (a) {
      var badge = a.querySelector('.gfp-notif-badge');
      if (!badge) {
        badge = global.document.createElement('span');
        badge.className = 'gfp-notif-badge';
        a.appendChild(badge);
      }
      if (count > 0) {
        badge.hidden = false;
        badge.textContent = count > 99 ? '99+' : String(count);
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
    });
    global.dispatchEvent(new CustomEvent('gfp:staff-notifications-count', { detail: { count: count } }));
  }

  async function refresh() {
    var api = apiClient();
    if (!api || typeof api.get !== 'function') return;
    try {
      var r = await api.get('/staff-notifications/unread-count');
      if (r && r.ok && r.data && typeof r.data.count === 'number') {
        setBadge(r.data.count);
      }
    } catch (e) { /* ignore */ }
  }

  function start() {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, POLL_MS);
  }

  function hubBaseUrl() {
    if (global.GfpConfig && global.GfpConfig.API_BASE) {
      return String(global.GfpConfig.API_BASE).replace(/\/api\/?$/, '');
    }
    if (global.API_BASE) {
      return String(global.API_BASE).replace(/\/api\/?$/, '');
    }
    return '';
  }

  function bindSignalR() {
    if (!global.signalR) return;
    try {
      var hubBase = hubBaseUrl();
      if (!hubBase) return;
      var token =
        global.localStorage.getItem('gfp_access_token') ||
        global.sessionStorage.getItem('gfp_access_token');
      if (!token) return;

      var conn = new global.signalR.HubConnectionBuilder()
        .withUrl(hubBase + '/hubs/attendance', {
          accessTokenFactory: function () {
            return (
              global.localStorage.getItem('gfp_access_token') ||
              global.sessionStorage.getItem('gfp_access_token') ||
              ''
            );
          }
        })
        .withAutomaticReconnect()
        .build();

      conn.on('StaffNotificationCreated', function () {
        refresh();
      });
      conn.start().catch(function () { /* optional */ });
    } catch (e) { /* optional */ }
  }

  function ensureBadgeCss() {
    if (global.document.getElementById('gfp-notif-badge-css')) return;
    var s = global.document.createElement('style');
    s.id = 'gfp-notif-badge-css';
    s.textContent =
      '.gfp-notif-badge{margin-inline-start:auto;min-width:18px;height:18px;padding:0 5px;border-radius:999px;' +
      'background:#EF4444;color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;' +
      'justify-content:center;line-height:1}' +
      '.gfp-notif-badge[hidden]{display:none!important}';
    global.document.head.appendChild(s);
  }

  function boot() {
    ensureBadgeCss();
    start();
    // SignalR client may load later; retry once
    setTimeout(bindSignalR, 1500);
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.GfpStaffNotifications = {
    refresh: refresh,
    getCount: function () { return lastCount; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
