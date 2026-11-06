/**
 * HyMotion — shared API client (§0 + §1)
 * Bearer injection, silent refresh on Token-Expired: true, dual-shape errors, PagedResult helpers.
 *
 * Gotchas:
 * - Persist the newest refresh token immediately (rotation revokes the old one).
 * - Refresh failure = logout once — never retry refresh in a loop.
 * - Only silent-refresh when the response carries Token-Expired: true (not every 401).
 * - Local keep-signed-in stores the refresh token in DPAPI (GET/POST /auth/device-session),
 *   never in localStorage. Gym identity is a separate non-secret cache (gfp_gym_identity).
 */
(function (global) {
  'use strict';

  var KEYS = {
    access: 'gfp_access_token',
    refresh: 'gfp_refresh_token',
    user: 'gfp_user',
    expires: 'gfp_expires_at',
    persist: 'gfp_persist', // '1' = keep signed in / localStorage access, '0' = sessionStorage
    gymIdentity: 'gfp_gym_identity'
  };

  var localEdition = false;

  function isStaffDesk() {
    var path = global.GFP_LOGIN_PATH || '';
    return path.indexOf('/member') === -1;
  }

  function useSecureLocalDeviceSession() {
    return localEdition && isStaffDesk();
  }

  function setLocalEdition(value) {
    localEdition = !!value;
  }

  function apiBase() {
    // REM-F3: no hardcoded remote URL. api-config.js resolves the base
    // (meta tag override / localhost dev default / same-origin '/api' in production).
    return global.API_BASE || (global.GFP_DEFAULT_API_BASE ?? '');
  }

  function storeForWrite() {
    var preferLocal = global.localStorage.getItem(KEYS.persist) !== '0';
    // If tokens already live in session only, keep writing there
    if (!preferLocal) return global.sessionStorage;
    if (global.sessionStorage.getItem(KEYS.access) && !global.localStorage.getItem(KEYS.access)) {
      return global.sessionStorage;
    }
    return global.localStorage;
  }

  function read(key) {
    return global.localStorage.getItem(key) || global.sessionStorage.getItem(key);
  }

  function writeBothClearOther(store, key, value) {
    store.setItem(key, value);
    var other = store === global.localStorage ? global.sessionStorage : global.localStorage;
    other.removeItem(key);
  }

  /** @type {{ getAccess: Function, getRefresh: Function, getUser: Function, getExpiresAt: Function, persistSession: Function, clear: Function, isAccessExpired: Function }} */
  var tokens = {
    getAccess: function () { return read(KEYS.access); },
    getRefresh: function () { return read(KEYS.refresh); },
    getExpiresAt: function () { return read(KEYS.expires); },
    getUser: function () {
      try { return JSON.parse(read(KEYS.user) || 'null'); } catch (e) { return null; }
    },
    isAccessExpired: function () {
      var exp = this.getExpiresAt();
      if (!exp) return true;
      // small skew: treat as expired 5s early
      return new Date(exp).getTime() <= Date.now() + 5000;
    },
    hasRefreshCredential: function () {
      if (this.getRefresh()) return true;
      return useSecureLocalDeviceSession() && global.localStorage.getItem(KEYS.persist) === '1';
    },
    /**
     * Persist LoginResponse / refresh result immediately (including rotated refresh token).
     * Local keep-signed-in never writes the refresh token to localStorage.
     * @param {{ accessToken: string, refreshToken: string, expiresAtUtc: string, user?: object }} data
     * @param {{ remember?: boolean }} [opts]
     */
    persistSession: function (data, opts) {
      opts = opts || {};
      var remember = opts.remember;
      if (typeof remember === 'boolean') {
        global.localStorage.setItem(KEYS.persist, remember ? '1' : '0');
      }
      var persistFlag = global.localStorage.getItem(KEYS.persist) === '1';
      var store = storeForWrite();
      if (data.accessToken) writeBothClearOther(store, KEYS.access, data.accessToken);
      if (data.expiresAtUtc) writeBothClearOther(store, KEYS.expires, data.expiresAtUtc);
      if (data.user) writeBothClearOther(store, KEYS.user, JSON.stringify(data.user));
      if (data.refreshToken) {
        if (persistFlag && useSecureLocalDeviceSession()) {
          writeBothClearOther(global.sessionStorage, KEYS.refresh, data.refreshToken);
          scheduleDeviceSessionSave(data.refreshToken);
        } else {
          writeBothClearOther(store, KEYS.refresh, data.refreshToken);
        }
      }
    },
    clear: function () {
      [KEYS.access, KEYS.refresh, KEYS.user, KEYS.expires, KEYS.persist].forEach(function (k) {
        global.localStorage.removeItem(k);
        global.sessionStorage.removeItem(k);
      });
    }
  };

  var gymIdentity = {
    get: function () {
      try { return JSON.parse(global.localStorage.getItem(KEYS.gymIdentity) || 'null'); } catch (e) { return null; }
    },
    remember: function (identity) {
      if (!identity || !identity.gymCode) return;
      var prev = this.get() || {};
      var next = {
        gymCode: String(identity.gymCode),
        gymName: identity.gymName != null ? String(identity.gymName) : (prev.gymName || ''),
        installationId: identity.installationId != null ? String(identity.installationId) : (prev.installationId || ''),
        logoUrl: identity.logoUrl != null ? String(identity.logoUrl) : (prev.logoUrl || '')
      };
      global.localStorage.setItem(KEYS.gymIdentity, JSON.stringify(next));
    },
    clear: function () {
      global.localStorage.removeItem(KEYS.gymIdentity);
    }
  };

  /**
   * Dual-shape error parser (§0):
   * A) ProblemDetails { title, detail, status }
   * B) Ad-hoc { message } | { error, message? }
   * @returns {{ code: string|null, message: string, status: number, raw: object|null }}
   */
  function parseError(status, body) {
    var raw = body && typeof body === 'object' ? body : null;
    if (!raw) {
      return { code: null, message: status === 0 ? 'Network error' : 'Request failed', status: status || 0, raw: null };
    }
    // Shape A — RFC7807 ProblemDetails
    if (typeof raw.title === 'string' && (raw.detail != null || raw.status != null)) {
      return {
        code: raw.title,
        message: String(raw.detail || raw.title),
        status: typeof raw.status === 'number' ? raw.status : status,
        raw: raw
      };
    }
    // Shape B — ad-hoc
    var msg = raw.message || raw.error || 'Request failed';
    var code = typeof raw.error === 'string' && raw.message ? raw.error : null;
    return { code: code, message: String(msg), status: status, raw: raw };
  }

  /**
   * Normalize list envelope to PagedResult<T> shape (§0).
   * @template T
   * @param {object|null} data
   * @returns {{ items: T[], totalCount: number, page: number, pageSize: number, totalPages: number, hasNext: boolean, hasPrevious: boolean }}
   */
  function asPaged(data) {
    var empty = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false
    };
    if (!data || typeof data !== 'object') return empty;
    var items = data.items || data.Items || [];
    var totalCount = data.totalCount != null ? data.totalCount : (data.TotalCount != null ? data.TotalCount : items.length);
    var page = data.page != null ? data.page : (data.Page != null ? data.Page : 1);
    var pageSize = data.pageSize != null ? data.pageSize : (data.PageSize != null ? data.PageSize : 20);
    var totalPages = data.totalPages != null ? data.totalPages : (data.TotalPages != null ? data.TotalPages : Math.ceil(totalCount / (pageSize || 1)));
    var hasNext = data.hasNext != null ? !!data.hasNext : (data.HasNext != null ? !!data.HasNext : page < totalPages);
    var hasPrevious = data.hasPrevious != null ? !!data.hasPrevious : (data.HasPrevious != null ? !!data.HasPrevious : page > 1);
    return { items: items, totalCount: totalCount, page: page, pageSize: pageSize, totalPages: totalPages, hasNext: hasNext, hasPrevious: hasPrevious };
  }

  var refreshPromise = null;

  function isTokenExpiredHeader(res) {
    try {
      var v = res.headers.get('Token-Expired') || res.headers.get('token-expired');
      return String(v || '').toLowerCase() === 'true';
    } catch (e) {
      return false;
    }
  }

  function deviceSessionHeaders() {
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };
  }

  var deviceSavePromise = null;

  function scheduleDeviceSessionSave(refreshToken) {
    if (!refreshToken || !useSecureLocalDeviceSession()) return;
    deviceSavePromise = (async function () {
      try {
        await fetch(apiBase() + '/auth/device-session', {
          method: 'POST',
          headers: deviceSessionHeaders(),
          body: JSON.stringify({ refreshToken: refreshToken })
        });
      } catch (e) { /* keep sessionStorage copy for this process */ }
    })();
  }

  async function loadDeviceRefreshToken() {
    if (!useSecureLocalDeviceSession()) return null;
    try {
      var res = await fetch(apiBase() + '/auth/device-session', {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok || res.status === 204) return null;
      var data = await res.json().catch(function () { return null; });
      var tok = data && (data.refreshToken || data.RefreshToken);
      return tok ? String(tok) : null;
    } catch (e) {
      return null;
    }
  }

  function clearDeviceSession() {
    if (!useSecureLocalDeviceSession()) return;
    try {
      fetch(apiBase() + '/auth/device-session', {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      }).catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }

  function logoutToLogin() {
    tokens.clear();
    clearDeviceSession();
    // Member App pages set window.GFP_LOGIN_PATH = '/member/login/' before this script loads
    // so an expired session bounces back to the member login, not the staff one.
    var loginPath = global.GFP_LOGIN_PATH || '/auth/login/';
    if (typeof location !== 'undefined' && location.pathname.indexOf(loginPath) === -1) {
      location.href = loginPath;
    }
  }

  /**
   * Single-flight refresh. Failure clears the auth session (no retry loop) but never gym identity.
   * @param {{ quiet?: boolean }} [opts]
   * @returns {Promise<boolean>}
   */
  function silentRefresh(opts) {
    opts = opts || {};
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async function () {
      var rt = tokens.getRefresh();
      if (!rt && useSecureLocalDeviceSession() && global.localStorage.getItem(KEYS.persist) === '1') {
        rt = await loadDeviceRefreshToken();
      }
      if (!rt) {
        if (!opts.quiet) logoutToLogin();
        return false;
      }
      try {
        var res = await fetch(apiBase() + '/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ refreshToken: rt })
        });
        var data = await res.json().catch(function () { return null; });
        if (!res.ok || !data || !data.accessToken || !data.refreshToken) {
          if (opts.quiet) {
            tokens.clear();
            clearDeviceSession();
          } else {
            logoutToLogin();
          }
          return false;
        }
        tokens.persistSession(data);
        if (deviceSavePromise) await deviceSavePromise;
        return true;
      } catch (e) {
        if (opts.quiet) {
          tokens.clear();
          clearDeviceSession();
        } else {
          logoutToLogin();
        }
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  /**
   * Core request. auth:true sends Bearer. Silent refresh only when Token-Expired: true.
   * @param {string} method
   * @param {string} path  e.g. '/members' (leading slash; under /api)
   * @param {{ body?: any, auth?: boolean, headers?: Record<string,string>, raw?: boolean, _retried?: boolean }} [opts]
   */
  async function request(method, path, opts) {
    opts = opts || {};
    var auth = opts.auth !== false;
    var headers = Object.assign({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    }, opts.headers || {});
    if (auth) {
      var at = tokens.getAccess();
      if (at) headers['Authorization'] = 'Bearer ' + at;
    }

    var init = { method: method, headers: headers };
    if (opts.body !== undefined && opts.body !== null && method !== 'GET' && method !== 'HEAD') {
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }

    var res;
    try {
      res = await fetch(apiBase() + path, init);
    } catch (e) {
      // The real cause (CORS, connection refused, timeout, mixed content, ...) was previously
      // discarded here entirely - every actual fetch failure surfaced only as a generic "Network
      // error" with nothing in the console to diagnose it by. Log it (not swallow it) so the
      // browser's own console/network tab shows what's actually wrong.
      console.error('[GfpApi] fetch failed for ' + method + ' ' + path + ':', e);
      return {
        ok: false,
        status: 0,
        data: null,
        error: parseError(0, null),
        headers: null,
        response: null
      };
    }

    // Silent refresh: ONLY when API marks Token-Expired (not arbitrary 401)
    if (res.status === 401 && auth && !opts._retried && isTokenExpiredHeader(res)) {
      var ok = await silentRefresh();
      if (ok) {
        return request(method, path, Object.assign({}, opts, { _retried: true }));
      }
      return {
        ok: false,
        status: 401,
        data: null,
        error: parseError(401, { message: 'Session expired' }),
        headers: res.headers,
        response: res
      };
    }

    var data = null;
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    var isJson =
      ct.indexOf('application/json') !== -1 ||
      ct.indexOf('+json') !== -1 ||
      ct.indexOf('application/problem') !== -1;
    if (opts.raw) {
      data = res;
    } else if (isJson) {
      data = await res.json().catch(function () { return null; });
    } else if (res.status !== 204) {
      data = await res.text().catch(function () { return null; });
      // Some proxies strip content-type; still try JSON ProblemDetails bodies.
      if (typeof data === 'string' && data.length && (data.charAt(0) === '{' || data.charAt(0) === '[')) {
        try { data = JSON.parse(data); } catch (e) { /* keep text */ }
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data: data,
      error: res.ok ? null : parseError(res.status, typeof data === 'object' ? data : { message: String(data || '') }),
      headers: res.headers,
      response: res
    };
  }

  async function getJson(path, opts) {
    var r = await request('GET', path, opts);
    return r.ok ? r.data : null;
  }

  async function getPaged(path, opts) {
    var data = await getJson(path, opts);
    return asPaged(data);
  }

  var authApi = {
    /**
     * Staff login — POST /api/auth/login
     * @param {{ email: string, password: string, gymCode: string }} body
     * @param {{ remember?: boolean }} [opts]
     */
    login: async function (body, opts) {
      var remember = !!(opts && opts.remember);
      var r = await request('POST', '/auth/login', { body: body, auth: false });
      if (r.ok && r.data && r.data.accessToken) {
        tokens.persistSession(r.data, { remember: remember });
        if (useSecureLocalDeviceSession()) {
          if (remember) {
            if (deviceSavePromise) await deviceSavePromise;
          } else {
            clearDeviceSession();
          }
        }
        var user = r.data.user || {};
        var extra = (opts && opts.gymIdentity) || {};
        gymIdentity.remember({
          gymCode: extra.gymCode || user.gymCode || user.GymCode,
          gymName: extra.gymName || user.gymName || user.GymName,
          installationId: extra.installationId,
          logoUrl: extra.logoUrl
        });
      }
      return r;
    },
    /** Explicit refresh. Pass { quiet: true } on the login page so failure stays on login. */
    refresh: function (opts) { return silentRefresh(opts || {}); },
    /** Member OTP send stub — POST /api/auth/member-otp */
    requestMemberOtp: function (body) {
      return request('POST', '/auth/member-otp', { body: body, auth: false });
    },
    /** Member OTP verify stub — POST /api/auth/member-verify → LoginResponse */
    verifyMemberOtp: async function (body, opts) {
      var r = await request('POST', '/auth/member-verify', { body: body, auth: false });
      if (r.ok && r.data && r.data.accessToken) {
        tokens.persistSession(r.data, { remember: !!(opts && opts.remember) });
      }
      return r;
    },
    /**
     * Member App Stage 0 login — staff-issued one-time activation code.
     * POST /api/auth/member-activate → LoginResponse
     * @param {{ gymCode: string, activationCode: string }} body
     * @param {{ remember?: boolean }} [opts]
     */
    activateMember: async function (body, opts) {
      var r = await request('POST', '/auth/member-activate', { body: body, auth: false });
      if (r.ok && r.data && r.data.accessToken) {
        tokens.persistSession(r.data, { remember: !!(opts && opts.remember) });
      }
      return r;
    },
    logout: function () { logoutToLogin(); }
  };

  var GfpApi = {
    tokens: tokens,
    gymIdentity: gymIdentity,
    setLocalEdition: setLocalEdition,
    isLocalEdition: function () { return localEdition; },
    parseError: parseError,
    asPaged: asPaged,
    request: request,
    get: function (path, opts) { return request('GET', path, opts); },
    post: function (path, body, opts) { return request('POST', path, Object.assign({}, opts, { body: body })); },
    put: function (path, body, opts) { return request('PUT', path, Object.assign({}, opts, { body: body })); },
    del: function (path, opts) { return request('DELETE', path, opts); },
    getJson: getJson,
    getPaged: getPaged,
    auth: authApi,
    logout: authApi.logout,
    /** Compatibility helpers matching older inline page helpers */
    apiGet: getJson,
    apiPut: async function (path, body) {
      var r = await request('PUT', path, { body: body });
      return { ok: r.ok, status: r.status, data: r.data };
    },
    apiPost: async function (path, body) {
      var r = await request('POST', path, { body: body });
      return { ok: r.ok, status: r.status, data: r.data };
    }
  };

  global.GfpApi = GfpApi;
  global.GFP_API = GfpApi; // alias
})(typeof window !== 'undefined' ? window : globalThis);
