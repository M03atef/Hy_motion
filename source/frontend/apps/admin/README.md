# HyMotion Admin (Vite)

Prompt 1 — API client & auth infrastructure.

## Run

```bash
# from Frontend root
npm run dev:admin

# or
cd apps/admin && npm run dev
```

App: http://localhost:5173  
Proxy: `/api` and `/hubs` → `VITE_API_PROXY_TARGET` (default `https://localhost:7001`)

Copy `.env.example` → `.env` if you need a different API host.

## What's included

| Piece | Location |
|---|---|
| Axios client + bearer | `src/lib/api/client.ts` |
| Silent refresh on `Token-Expired: true` | `src/lib/api/client.ts` |
| Dual-shape error parser | `src/lib/api/errors.ts` |
| `PagedResult<T>` | `src/lib/api/types.ts` + `apiPaged()` |
| Session persistence | `src/lib/api/session.ts` |
| Staff login UI | `src/features/auth/StaffLoginPage.tsx` |
| Member OTP stubs | `src/features/auth/MemberOtpStubPage.tsx` |
| Zustand auth store | `src/stores/auth-store.ts` |

## Acceptance checks

1. Sign in with email + password + gymCode → session stored → `/api/settings/gym-code` probe succeeds → `/app`.
2. After access token expires, next API call with `Token-Expired: true` refreshes once, persists the new refresh token, retries the request.
3. Failed refresh clears session and forces re-login (no retry loop).
