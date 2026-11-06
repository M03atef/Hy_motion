# Platform Console — Stage 1 Manual QA Checklist

## Auth & isolation

- [ ] PASS — Access token is never written to localStorage/sessionStorage (DevTools → Application).
- [ ] PASS — Pasting a tenant-scoped JWT into storage/state is never sent; client only uses in-memory token from platform login (`src/lib/api/token.ts`).
- [ ] PASS — First login without MFA → `/mfa-setup` with QR + manual key; cannot reach `/tenants` by URL.
- [ ] PASS — Subsequent login without code → `/mfa-challenge`; wrong code shows inline MFA_INVALID-style message.
- [ ] N/A — Refresh-token silent retry (platform plane has no refresh endpoint; 401 → logout → `/login`).

## UX

- [ ] PASS — Keyboard-only path: login → MFA → tenant list → filter → detail → back (focus rings visible).
- [ ] PASS — Dates render in Africa/Cairo; snapshot-like times use “as of HH:mm”.
- [ ] PASS — Money values use thousands separators + `EGP` (e.g. `2,199.00 EGP`).
- [ ] PASS — Tenant list has skeleton / empty / error+retry states.
- [ ] PASS — Tenant detail has not-found state for bad ids; PDF link hidden when `pdfUrl` null.
- [ ] PASS — No Stage 2 action buttons (suspend, coupon, impersonate) on detail.

## Deploy / ops

- [ ] PASS — App runs on its own port (5174) / recommended subdomain `platform.gymflow.pro`.
- [ ] DOCUMENTED — Production should IP-allowlist or VPN-gate access (infra, not app code).

## Automated

- [ ] PASS — `npm run test -w platform-console` (auth store, route guards, MSW list/detail, format).
