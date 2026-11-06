# HyMotion Platform Console (Stage 1)

Internal ops tool for GymFlow staff. **Separate auth** from the tenant admin dashboard (`apps/admin` / `apps/web`).

## Run locally

```bash
# from Frontend/
npm install
npm run dev:platform
```

App: http://localhost:5174  
Vite proxies `/platform-api` → `VITE_API_PROXY_TARGET` (default `https://localhost:5001`).

Copy `.env.example` → `.env` for local overrides.

| File | Use |
|---|---|
| `.env` | Local API (proxied) |
| `.env.staging` | Staging base URL |
| `.env.production` | Production base URL |

```bash
npm run build:platform
# or: npm run build -w platform-console -- --mode staging
```

## Auth notes (backend-aligned)

- `POST /platform-api/auth/login` — 403 setup / 401 MFA challenge / 200 token
- `POST /platform-api/auth/mfa/setup` — completes enrollment
- Access token is **memory-only** (no localStorage). There is **no refresh token** — expired sessions re-login.
- Never reuse tenant JWTs from the admin dashboard.

## Stage 1 screens

- Login, MFA setup, MFA challenge
- Tenants list (search/filter in URL)
- Tenant detail (subscription, history, invoices) — **read-only**

## Deploy recommendation

Host on a dedicated subdomain (e.g. `platform.gymflow.pro`). Because this app can see cross-tenant billing data, **IP-allowlist or VPN-gate** production access at the infrastructure layer.

## Tests

```bash
npm run test -w platform-console
```

See [QA_CHECKLIST.md](./QA_CHECKLIST.md).
