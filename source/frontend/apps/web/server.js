const express = require('express');
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function normalizeApiBase(raw) {
  if (!raw) return '';
  const c = String(raw).trim().replace(/\/+$/, '');
  if (!c) return '';
  return c.endsWith('/api') ? c : `${c}/api`;
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'));

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIGURED_API_BASE = normalizeApiBase(
  process.env.GFP_API_BASE || process.env.NEXT_PUBLIC_API_URL || ''
);
const STATIC_ROOT = path.join(__dirname, 'src', 'app');
const DASH_ROOT = path.join(STATIC_ROOT, '(dashboard)');
const MEMBER_ROOT = path.join(STATIC_ROOT, 'member');
const SHARED_ROOT = path.join(STATIC_ROOT, 'shared');
const DEV_ROOT = path.join(STATIC_ROOT, 'dev');
const SHARED_SCRIPTS = [
  '/shared/api-config.js',
  '/shared/api-client.js?v=session1',
  '/shared/authz.js',
  '/shared/features.js?v=8',
  '/shared/i18n-catalog.js',
  '/shared/i18n.js?v=loc2',
  '/shared/theme.js?v=1',
  '/shared/feedback.js?v=1',
  '/shared/nav.js?v=nav-ia1',
  '/shared/inventory-api.js',
  '/shared/member-orders-api.js',
  '/shared/gfp-branding.js?v=5',
  '/shared/analytics.js?v=1',
  '/shared/shell.js?v=nav-ia1',
  '/shared/staff-notifications.js?v=2',
  '/shared/quick-actions.js?v=6',
  '/shared/refund-action.js?v=3',
  '/shared/toast.js?v=1',
  '/shared/network-status.js?v=1',
  '/shared/error-handler.js?v=1',
  '/shared/session-guard.js?v=session1',
  '/shared/app-version.js?v=1',
  '/shared/local-nav-gate.js?v=session1',
  '/shared/prepare-gym.js?v=3',
];

const SHARED_STYLES = [
  '/shared/rtl.css',
  '/shared/typography.css?v=1',
  '/shared/refund-action.css',
  '/shared/theme.css?v=4',
  '/shared/feedback.css?v=1',
  '/shared/responsive.css?v=1',
  '/shared/shell-layout.css?v=session1',
  '/shared/shell-header.css?v=1',
  '/shared/dashboard-layout.css?v=1',
  '/shared/table-layout.css?v=1',
  '/shared/form-layout.css?v=1',
  '/shared/modal-layout.css?v=2',
  '/shared/sweep-layout.css?v=2',
  '/shared/prepare-gym.css?v=1',
];

// Member App pages have no staff nav/shell/quick-actions/inventory context.
const MEMBER_SHARED_SCRIPTS = [
  '/shared/api-config.js',
  '/shared/api-client.js',
  '/shared/authz.js',
  '/shared/i18n-catalog.js',
  '/shared/i18n.js?v=loc2',
  '/shared/theme.js?v=1',
];
const MEMBER_SHARED_STYLES = [
  '/shared/rtl.css',
  '/shared/typography.css?v=1',
  '/shared/theme.css?v=4',
  '/shared/responsive.css?v=1',
  '/shared/form-layout.css?v=1',
  '/shared/sweep-layout.css?v=2',
];

function sharedScriptTags() {
  return SHARED_SCRIPTS.map((src) => `<script src="${src}"></script>`).join('\n') + '\n';
}

function hasScriptSrc(html, src) {
  // Must match a real <script src="..."> tag — not comments / console.error text that
  // mention the same path (login page cites api-client.js in comments and blocked injection).
  const esc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('<script[^>]+src=["\']' + esc + '["\']', 'i').test(html);
}

function hasStylesheetHref(html, href) {
  const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('<link[^>]+href=["\']' + esc + '["\']', 'i').test(html);
}

function sendHtml(res, filePath, memberScope = false) {
  let html = fs.readFileSync(filePath, 'utf8');

  const scripts = memberScope ? MEMBER_SHARED_SCRIPTS : SHARED_SCRIPTS;
  const styles = memberScope ? MEMBER_SHARED_STYLES : SHARED_STYLES;
  const missingCss = styles.filter((href) => !hasStylesheetHref(html, href));
  const missingJs = scripts.filter((src) => !hasScriptSrc(html, src));
  const needEarly = !html.includes('data-gfp-early-locale');
  const needThemeBoot = !html.includes('data-gfp-theme-boot');
  const needFavicon = !/rel=["']icon["']/i.test(html);

  // Early locale/theme/branding must run before first paint → top of <head>.
  // Shared CSS (esp. typography + theme) must load AFTER page styles → end of <head>.
  const headStart = [];
  const headEnd = [];
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    headStart.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  if (!/<meta[^>]+name=["']gfp-api-base["']/i.test(html)) {
    // Always inject this (not just when GFP_API_BASE/.env is explicitly set): this dev server
    // serves the frontend from its own origin (default localhost:3000), separate from the .NET
    // API's origin - shared/api-config.js can no longer guess "the API is on localhost:5001"
    // for every localhost page (that broke HyMotion Local Edition, which serves its dashboard AND
    // API together from one process on a different port). This meta tag is now the only thing
    // telling pages served by *this* dev server where the separately-running API actually is.
    const apiBase = CONFIGURED_API_BASE || 'http://localhost:5000/api';
    const safe = apiBase.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    headStart.push(`<meta name="gfp-api-base" content="${safe}">`);
  }
  if (needThemeBoot) {
    headStart.push(
      '<style data-gfp-theme-boot>html[data-theme="dark"]{color-scheme:dark;background:#151716;--lbg:#151716;--ls1:#1C201D;--ls2:#222722;--ls3:#2E342F;--ltp:#E8EBE6;--lts:#B5BBB4;--ltt:#8C948A;--suc100:#16351F;--dng100:#3A1C1C;--wrn100:#3A2E12;--inf100:#1A2A44;--l100:rgba(122,204,0,.16);--sh1:0 1px 2px rgba(0,0,0,.28)}html[data-theme="dark"] body{background:#151716;color:#E8EBE6}</style>'
    );
  }
  if (needEarly) {
    headStart.push(
      '<script data-gfp-early-locale>(function(){try{var h=document.documentElement;var l=localStorage.getItem("gfp_locale");if(l!=="ar"&&l!=="en")l="en";h.lang=l;h.dir=l==="ar"?"rtl":"ltr";var pref=localStorage.getItem("gfp_appearance");try{var u0=JSON.parse(localStorage.getItem("gfp_user")||"null");var uid=u0&&(u0.id||u0.Id||u0.userId||u0.UserId);if(uid){var p2=localStorage.getItem("gfp_appearance:"+uid);if(p2==="light"||p2==="dark"||p2==="system")pref=p2;}}catch(e0){}if(pref!=="light"&&pref!=="dark"&&pref!=="system")pref="light";var dark=pref==="dark"||(pref==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);h.setAttribute("data-theme",dark?"dark":"light");h.setAttribute("data-appearance",pref);h.style.colorScheme=dark?"dark":"light";var u=JSON.parse(localStorage.getItem("gfp_user")||"null");var tid=u&&(u.tenantId||u.TenantId);var raw=tid&&localStorage.getItem("gfp_branding:"+tid);if(!raw)raw=localStorage.getItem("gfp_branding");if(!raw)return;var b=JSON.parse(raw);var p=b.primaryColor||b.PrimaryColor||"#7ACC00";var a=b.accentColor||b.AccentColor||"#A0E040";h.style.setProperty("--gfp-brand-primary",p);h.style.setProperty("--gfp-brand-accent",a);h.style.setProperty("--l500",p);h.style.setProperty("--l400",a);h.style.setProperty("--l600",p);h.style.setProperty("--l300",a);}catch(e){}})();</script>'
    );
  }
  if (needFavicon) headEnd.push('<link rel="icon" href="/shared/favicon.ico">');
  missingCss.forEach((href) => headEnd.push(`<link rel="stylesheet" href="${href}">`));
  missingJs.forEach((src) => headEnd.push(`<script src="${src}"></script>`));

  if (headStart.length && /<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + headStart.join('\n') + '\n');
  } else if (headStart.length) {
    html = headStart.join('\n') + '\n' + html;
  }

  if (headEnd.length) {
    const inject = headEnd.join('\n') + '\n';
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, inject + '</head>');
    } else if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + inject);
    } else {
      html = inject + html;
    }
  }
  res.type('html').send(html);
}

// ── CORS ──
const CORS_ALLOWED_ORIGINS_RAW = process.env.GFP_CORS_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '';
const CORS_ALLOWED_ORIGINS = String(CORS_ALLOWED_ORIGINS_RAW)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CORS_IS_PROD = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const portSuffix =
    PORT && String(PORT) !== '80' && String(PORT) !== '443' ? ':' + String(PORT) : '';
  const selfOrigin = `${req.protocol}://${req.hostname}${portSuffix}`;

  if (origin) {
    if (CORS_ALLOWED_ORIGINS.length) {
      if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    } else if (!CORS_IS_PROD) {
      // Development convenience: wildcard if no explicit allowlist is configured.
      res.header('Access-Control-Allow-Origin', '*');
    } else if (origin === selfOrigin) {
      // Production safety fallback: allow only same-origin when allowlist is missing.
      res.header('Access-Control-Allow-Origin', origin);
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Expose-Headers', 'Token-Expired');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Shared assets (api-config.js, vendor/tabler-icons/*, vendor/fonts/*, etc.) ──
// Was `/shared/:file` (path.basename only) - Express params only capture one path segment, so
// any nested asset (every /shared/vendor/... reference in every page - Tabler icon font/CSS,
// Cairo/Inter webfonts, chart.js, jsbarcode, signalr) 404'd on this dev server. The .NET-hosted
// build never hit this because prepare-wwwroot.mjs flattens vendor assets before publish: it
// still matters here since apps/web/server.js is what actually serves this src tree directly.
// Regex route (not a '/shared/*' string pattern) - Express 5's path-to-regexp requires a named
// wildcard ('/shared/*splat') for string patterns; a plain '*' throws "Missing parameter name" at
// startup. A regex sidesteps that version-specific syntax entirely.
app.get(/^\/shared\/(.+)$/, (req, res) => {
  const rel = req.params[0];
  const f = path.join(SHARED_ROOT, rel);
  if (!f.startsWith(SHARED_ROOT + path.sep) && f !== SHARED_ROOT) {
    res.status(400).end();
    return;
  }
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.sendFile(f);
    return;
  }
  res.status(404).end();
});

// ── / → redirect ──
app.get('/', (req, res) => res.redirect('/dashboard/'));

// ── All routing via middleware ──
app.use((req, res, next) => {
  const url = decodeURIComponent(req.path);

  // -- AUTH --
  if (url === '/auth/login' || url === '/auth/login/') {
    const f = path.join(STATIC_ROOT, 'auth', 'login', 'index.html');
    if (fs.existsSync(f)) {
      sendHtml(res, f);
      return;
    }
  }
  if (url.startsWith('/auth/')) {
    const rel = url.slice(6).replace(/\/+$/, ''); // strip '/auth/' and trailing slash
    // Exact file
    const f = path.join(STATIC_ROOT, 'auth', rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      if (f.endsWith('.html')) sendHtml(res, f);
      else res.sendFile(f);
      return;
    }
    // Directory → index.html (/auth/member-otp/ → auth/member-otp/index.html)
    const idx = path.join(STATIC_ROOT, 'auth', rel, 'index.html');
    if (fs.existsSync(idx)) {
      if (!url.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, '/auth/' + rel + '/' + q);
        return;
      }
      sendHtml(res, idx);
      return;
    }
  }

  // -- DASHBOARD --
  if (url.startsWith('/dashboard')) {
    const sub = url.replace(/^\/dashboard\/?/, '').replace(/\/+$/, '');

    // Root
    if (!sub) {
      // Prefer trailing slash so relative CSS/JS under /dashboard/ resolve correctly
      if (url === '/dashboard') {
        res.redirect(301, '/dashboard/');
        return;
      }
      const f = path.join(DASH_ROOT, 'index.html');
      if (fs.existsSync(f)) {
        sendHtml(res, f);
        return;
      }
    }

    // Exact file (CSS, JS, images)
    const exact = path.join(DASH_ROOT, sub);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) {
      if (exact.endsWith('.html')) sendHtml(res, exact);
      else res.sendFile(exact);
      return;
    }

    // Directory → index.html
    const idx = path.join(DASH_ROOT, sub, 'index.html');
    if (fs.existsSync(idx)) {
      // /dashboard/settings (no slash) breaks relative href="settings.css" → /dashboard/settings.css
      if (!url.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, '/dashboard/' + sub + '/' + q);
        return;
      }
      sendHtml(res, idx);
      return;
    }

    // Dynamic: /dashboard/members/abc → (dashboard)/members/[id]/index.html
    const parts = sub.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const parent = parts.slice(0, -1).join(path.sep);
      const dynIdx = path.join(DASH_ROOT, parent, '[id]', 'index.html');
      if (fs.existsSync(dynIdx)) {
        sendHtml(res, dynIdx);
        return;
      }

      // Asset in [id] folder
      const file = parts[parts.length - 1];
      const dynAsset = path.join(DASH_ROOT, parent, '[id]', file);
      if (fs.existsSync(dynAsset) && fs.statSync(dynAsset).isFile()) {
        res.sendFile(dynAsset);
        return;
      }
    }

    // 3-level: /dashboard/members/abc/style.css → (dashboard)/members/[id]/style.css
    if (parts.length >= 3) {
      const gp = parts.slice(0, -2).join(path.sep);
      const file = parts[parts.length - 1];
      const dynAsset = path.join(DASH_ROOT, gp, '[id]', file);
      if (fs.existsSync(dynAsset) && fs.statSync(dynAsset).isFile()) {
        res.sendFile(dynAsset);
        return;
      }
    }
  }

  // -- MEMBER APP --
  if (url.startsWith('/member')) {
    const sub = url.replace(/^\/member\/?/, '').replace(/\/+$/, '');

    if (!sub) {
      if (url === '/member') {
        res.redirect(301, '/member/');
        return;
      }
      const f = path.join(MEMBER_ROOT, 'index.html');
      if (fs.existsSync(f)) {
        sendHtml(res, f, true);
        return;
      }
    }

    const exact = path.join(MEMBER_ROOT, sub);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) {
      if (exact.endsWith('.html')) sendHtml(res, exact, true);
      else res.sendFile(exact);
      return;
    }

    const idx = path.join(MEMBER_ROOT, sub, 'index.html');
    if (fs.existsSync(idx)) {
      if (!url.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, '/member/' + sub + '/' + q);
        return;
      }
      sendHtml(res, idx, true);
      return;
    }
  }

  // -- DEV TOOLS (font preview — not in customer nav) --
  if (url.startsWith('/dev')) {
    const sub = url.replace(/^\/dev\/?/, '').replace(/\/+$/, '');

    if (!sub) {
      if (url === '/dev') {
        res.redirect(301, '/dev/');
        return;
      }
      res.redirect(302, '/dev/font-preview/');
      return;
    }

    const exact = path.join(DEV_ROOT, sub);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) {
      if (exact.endsWith('.html')) sendHtml(res, exact, true);
      else res.sendFile(exact);
      return;
    }

    const idx = path.join(DEV_ROOT, sub, 'index.html');
    if (fs.existsSync(idx)) {
      if (!url.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, '/dev/' + sub + '/' + q);
        return;
      }
      sendHtml(res, idx, true);
      return;
    }
  }

  next();
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).send(`<!DOCTYPE html><html><head><title>404</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0D0D0D;color:#F0F0F0}
.c{text-align:center}.c h1{font-size:72px;color:#7ACC00;margin:0}.c p{color:#888;margin:8px 0 24px}
.c a{padding:10px 24px;background:#7ACC00;color:#0D0D0D;text-decoration:none;border-radius:8px;font-weight:700}</style>
</head><body><div class="c"><h1>404</h1><p>${req.originalUrl} not found</p><a href="/dashboard/">← Dashboard</a></div></body></html>`);
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║           HyMotion Dev Server                ║
  ╠═══════════════════════════════════════════════╣
  ║  Local:  http://localhost:${PORT}                  ║
  ║  Login:  http://localhost:${PORT}/auth/login/      ║
  ║  Admin:  http://localhost:${PORT}/dashboard/       ║
  ║  Fonts:  http://localhost:${PORT}/dev/font-preview/ ║
  ║  API:    ${CONFIGURED_API_BASE || 'http://localhost:5000/api'}
  ╚═══════════════════════════════════════════════╝
  `);
});
