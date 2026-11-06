/**
 * Live Refresh — shared SignalR client for cross-PC data-change notifications.
 *
 * Connects to /hubs/dashboard (JWT via ?access_token=, same mechanism as Attendance).
 * The hub pushes metadata-only "DataChanged" events: { entity, action, id, atUtc }.
 * This module routes them to page subscriptions; pages refetch through the normal
 * authorized API (GfpApi) — the event itself carries no data.
 *
 * Usage (inside a page's -app.js IIFE):
 *   if (window.GfpLive) {
 *     var reload = GfpLive.debounce(loadMembers, 500);
 *     GfpLive.on(['members', 'memberships'], reload);
 *   }
 *
 * Failure doctrine: Live Refresh is an optimization only. If the hub is down the
 * module degrades silently (a single shared 60s reconcile tick while disconnected);
 * pages keep working exactly as before through their normal loads and polls.
 */
(function (global) {
  'use strict';

  var RECONNECT_SCHEDULE = [0, 2000, 5000, 10000, 30000];
  var DEBOUNCE_MS = 500;
  var DISCONNECTED_TICK_MS = 60000; // ONE shared fallback — never per-page polling grids
  var RETRY_START_MS = 15000;

  var subs = [];            // { entities: {...}, fn, timer }
  var connection = null;
  var connecting = false;
  var fallbackTimer = null;
  var retryTimer = null;
  var vendorLoading = false;

  function hubBaseUrl() {
    if (global.GfpConfig && global.GfpConfig.API_BASE) {
      return String(global.GfpConfig.API_BASE).replace(/\/api\/?$/, '');
    }
    if (global.API_BASE) {
      return String(global.API_BASE).replace(/\/api\/?$/, '');
    }
    return '';
  }

  function accessToken() {
    try {
      return (
        global.localStorage.getItem('gfp_access_token') ||
        global.sessionStorage.getItem('gfp_access_token') ||
        ''
      );
    } catch (e) {
      return '';
    }
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var self = this;
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        try {
          fn.apply(self, args);
        } catch (e) { /* a page's refresh must never break the module */ }
      }, ms || DEBOUNCE_MS);
    };
  }

  function entitiesMatch(sub, entity) {
    return !!(entity && sub.entities[entity]);
  }

  function tickSub(sub, detail) {
    if (sub.timer) clearTimeout(sub.timer);
    sub.timer = setTimeout(function () {
      sub.timer = null;
      try {
        sub.fn(detail || {});
      } catch (e) { /* ignore page errors */ }
    }, DEBOUNCE_MS);
  }

  function reconcileAll(detail) {
    for (var i = 0; i < subs.length; i++) tickSub(subs[i], detail);
  }

  function handleDataChanged(msg) {
    var entity = msg && msg.entity;
    if (global.CustomEvent) {
      try {
        global.dispatchEvent(new CustomEvent('gfp:data-changed', { detail: msg || {} }));
      } catch (e) { /* ignore */ }
    }
    for (var i = 0; i < subs.length; i++) {
      if (entitiesMatch(subs[i], entity)) tickSub(subs[i], msg);
    }
  }

  function startFallback() {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(function () {
      // Reconcile tick while disconnected — bounds staleness without per-page polling.
      reconcileAll({ entity: '*', reason: 'fallback' });
    }, DISCONNECTED_TICK_MS);
  }

  function stopFallback() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function scheduleRetry(ms) {
    if (retryTimer) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      connect();
    }, ms || RETRY_START_MS);
  }

  function onReconnected() {
    stopFallback();
    // The client may have missed events while offline — refetch current data once.
    if (global.CustomEvent) {
      try {
        global.dispatchEvent(new CustomEvent('gfp:live-reconnected', {}));
      } catch (e) { /* ignore */ }
    }
    reconcileAll({ entity: '*', reason: 'reconnected' });
  }

  function buildConnection() {
    var hubBase = hubBaseUrl();
    if (!hubBase || !global.signalR || !global.signalR.HubConnectionBuilder) return null;

    var conn = new global.signalR.HubConnectionBuilder()
      .withUrl(hubBase + '/hubs/dashboard', {
        accessTokenFactory: function () {
          return accessToken();
        }
      })
      .withAutomaticReconnect(RECONNECT_SCHEDULE)
      .build();

    conn.on('DataChanged', handleDataChanged);
    conn.onreconnected(onReconnected);

    conn.start()
      .then(function () {
        connecting = false;
        stopFallback();
      })
      .catch(function () {
        // Silent — Live Refresh must never surface errors to normal users.
        connecting = false;
        connection = null; // allow the scheduled retry to rebuild a fresh connection
        if (accessToken()) {
          startFallback();
          scheduleRetry(RETRY_START_MS);
        }
      });

    conn.onclose(function () {
      // Exhausted automatic reconnects (or server restart) — fall back quietly.
      connection = null; // allow the scheduled retry to rebuild a fresh connection
      startFallback();
      if (accessToken()) scheduleRetry(30000);
    });

    return conn;
  }

  function loadVendorScript(onReady) {
    if (global.signalR) {
      onReady();
      return;
    }
    if (vendorLoading) return; // onload retries connect()
    vendorLoading = true;
    try {
      var s = global.document.createElement('script');
      s.src = '/shared/vendor/signalr/signalr.min.js';
      s.onload = function () {
        vendorLoading = false;
        onReady();
      };
      s.onerror = function () {
        vendorLoading = false;
        scheduleRetry(RETRY_START_MS);
      };
      global.document.head.appendChild(s);
    } catch (e) {
      vendorLoading = false;
    }
  }

  function connect() {
    if (connection || connecting) return;
    if (!accessToken()) return; // logged-out pages (e.g. login) never open a connection
    connecting = true;
    loadVendorScript(function () {
      try {
        connection = buildConnection();
      } catch (e) { /* ignore */ }
      if (!connection) {
        connecting = false;
        scheduleRetry(RETRY_START_MS);
      }
    });
  }

  function on(entities, fn) {
    if (typeof fn !== 'function') return function () {};
    var list = Array.isArray(entities) ? entities : [entities];
    var map = {};
    for (var i = 0; i < list.length; i++) map[list[i]] = true;
    var sub = { entities: map, fn: fn, timer: null };
    subs.push(sub);
    connect();
    return function unsubscribe() {
      var idx = subs.indexOf(sub);
      if (idx >= 0) subs.splice(idx, 1);
    };
  }

  function boot() {
    // Connect eagerly on dashboard pages so events start flowing; pages that never
    // subscribe still benefit from 'gfp:data-changed' custom events.
    if (accessToken()) connect();
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.GfpLive = {
    on: on,
    debounce: debounce,
    // Selftest/integration hook: simulate a hub "DataChanged" payload.
    _simulate: handleDataChanged,
    isConnected: function () {
      try {
        return !!(
          connection &&
          global.signalR &&
          global.signalR.HubConnectionState &&
          connection.state === global.signalR.HubConnectionState.Connected
        );
      } catch (e) {
        return false;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
