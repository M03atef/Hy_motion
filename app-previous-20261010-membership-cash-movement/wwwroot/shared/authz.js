/**
 * HyMotion — authz (§0.4): JWT `perm` claims + role policies.
 * useCan(permission) is the React name; on static web use GfpAuthz.can / window.useCan.
 */
(function (global) {
  'use strict';

  function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = decodeURIComponent(
        atob(b64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function claimList(payload, key) {
    if (!payload) return [];
    var v = payload[key];
    if (v == null && key === 'role') {
      v = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    }
    if (v == null && key === 'perm') {
      // some stacks repeat custom claim as array
      v = payload.perm;
    }
    if (Array.isArray(v)) return v.filter(function (x) { return typeof x === 'string'; });
    if (typeof v === 'string') return [v];
    return [];
  }

  function getAccessToken() {
    if (global.GfpApi && global.GfpApi.tokens) return global.GfpApi.tokens.getAccess();
    return global.localStorage.getItem('gfp_access_token') || global.sessionStorage.getItem('gfp_access_token');
  }

  function getPermClaims(token) {
    token = token || getAccessToken();
    var payload = decodeJwtPayload(token);
    return claimList(payload, 'perm');
  }

  function hasPermission(token, permission) {
    var perms = getPermClaims(token);
    return perms.indexOf(permission) !== -1;
  }

  function canPermission(token, permission) {
    var required = Array.isArray(permission) ? permission : [permission];
    return required.some(function (p) { return hasPermission(token, p); });
  }

  function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function getUserRole() {
    if (global.GfpApi && global.GfpApi.tokens) {
      var u = global.GfpApi.tokens.getUser();
      if (u && u.role) return u.role;
    }
    try {
      var raw = global.localStorage.getItem('gfp_user') || global.sessionStorage.getItem('gfp_user');
      if (raw) return JSON.parse(raw).role || null;
    } catch (e) { /* ignore */ }
    var token = getAccessToken();
    var payload = decodeJwtPayload(token);
    var roles = claimList(payload, 'role');
    return roles[0] || null;
  }

  function matchesRolePolicy(role, policy) {
    var r = normalizeRole(role);
    switch (policy) {
      case 'OwnerOnly':
        return r === 'owner';
      case 'ManagerOrAbove':
        return r === 'owner' || r === 'manager';
      case 'AnyStaff':
        return r === 'owner' || r === 'manager' || r === 'trainer' || r === 'receptionist';
      case 'AuthenticatedMember':
        return r === 'member';
      case 'AnyAuthenticated':
        return Boolean(r);
      default:
        return false;
    }
  }

  /** Hook-shaped helper: useCan(access) | useCan('plans.manage') | useCan(['a','b']). */
  function useCan(accessOrPermission) {
    if (accessOrPermission && typeof accessOrPermission === 'object' && accessOrPermission.kind) {
      // NavAccess: never branch on role string for permission kind — claims only
      if (accessOrPermission.kind === 'permission') {
        return canPermission(getAccessToken(), accessOrPermission.value);
      }
      if (accessOrPermission.kind === 'policy') {
        return matchesRolePolicy(getUserRole(), accessOrPermission.value);
      }
      if (accessOrPermission.kind === 'any') {
        return matchesRolePolicy(getUserRole(), 'AnyStaff');
      }
      return false;
    }
    return canPermission(getAccessToken(), accessOrPermission);
  }

  function useCanRole(policy) {
    return matchesRolePolicy(getUserRole(), policy);
  }

  function useCanAccess(opts) {
    opts = opts || {};
    var permOk = opts.permission === undefined ? true : useCan(opts.permission);
    var roleOk = opts.role === undefined ? true : useCanRole(opts.role);
    return permOk && roleOk;
  }

  var GfpAuthz = {
    decodeJwtPayload: decodeJwtPayload,
    getPermClaims: getPermClaims,
    hasPermission: hasPermission,
    canPermission: canPermission,
    matchesRolePolicy: matchesRolePolicy,
    normalizeRole: normalizeRole,
    getUserRole: getUserRole,
    getAccessToken: getAccessToken,
    useCan: useCan,
    useCanRole: useCanRole,
    useCanAccess: useCanAccess,
    can: useCan
  };

  global.GfpAuthz = GfpAuthz;
  global.useCan = useCan;
  global.useCanRole = useCanRole;
  global.useCanAccess = useCanAccess;
})(typeof window !== 'undefined' ? window : globalThis);
