/**
 * HyMotion web — shared API origin.
 * Default (any host, including localhost): same-origin, window.location.origin + '/api' - correct
 * whenever the .NET backend serves the dashboard itself (SaaS production, HyMotion Local Edition,
 * and `dotnet run` browsed directly), since the API always lives at that same origin's /api.
 * Override: <meta name="gfp-api-base" content="https://your-domain.com/api">
 * Dev persist: localStorage.gfp_api_base
 * The Node dev server (apps/web/server.js, default localhost:3000) serves the frontend from a
 * DIFFERENT origin than the .NET API, so it always injects the meta tag above itself - see its
 * CONFIGURED_API_BASE. Do not reintroduce a hardcoded "localhost means <some other port>" guess
 * here: HyMotion Local Edition also runs on localhost, on its own port (7140), and a hardcoded
 * guess broke it (Network error on every API call) since nothing else overrides this default.
 */
(function (global) {
  var LOCAL_API = 'http://localhost:5000/api'; // last-resort only, no window.location at all (non-browser context)

  function normalizeApiBase(raw) {
    if (!raw) return '';
    var c = String(raw).trim().replace(/\/+$/, '');
    if (!c) return '';
    return c.endsWith('/api') ? c : c + '/api';
  }

  function resolveDefaultBase() {
    if (typeof window === 'undefined' || !window.location || !window.location.origin) {
      return LOCAL_API;
    }
    var meta = document.querySelector('meta[name="gfp-api-base"]');
    if (meta && meta.getAttribute('content')) {
      var fromMeta = normalizeApiBase(meta.getAttribute('content'));
      if (fromMeta) return fromMeta;
    }
    try {
      var stored = normalizeApiBase(localStorage.getItem('gfp_api_base') || sessionStorage.getItem('gfp_api_base'));
      if (stored) return stored;
    } catch (e) { /* ignore */ }
    return window.location.origin + '/api';
  }

  var DEFAULT_API_BASE = resolveDefaultBase();
  if (!global.API_BASE) {
    global.API_BASE = DEFAULT_API_BASE;
  }
  global.GFP_DEFAULT_API_BASE = DEFAULT_API_BASE;
})(typeof window !== 'undefined' ? window : globalThis);
