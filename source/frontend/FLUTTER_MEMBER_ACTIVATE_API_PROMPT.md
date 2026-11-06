# Flutter — Member Activate API Prompt

> Copy everything inside the `PROMPT` fence and give it to the Flutter developer.
> Fixes the common **404** caused by calling `/api/api/auth/member-activate`.

---

```
PROMPT — HyMotion Member App Auth: POST member-activate ONLY

You are implementing Member App Stage 0 activation for HyMotion (Flutter).
Do NOT implement phone OTP. Do NOT invent endpoints.

═══════════════════════════════════════════════════════════════════
CRITICAL: BASE URL vs PATH (this caused production 404s)
═══════════════════════════════════════════════════════════════════

The API host already exposes routes under `/api/...`.

NEVER concatenate:
  base = ".../api"  +  path = "/api/auth/member-activate"
→ that becomes /api/api/auth/member-activate → HTTP 404 Not Found

Pick ONE style and use it for ALL calls (activate, refresh, check-in, etc.):

STYLE A (recommended — matches HyMotion web FE):
  API_BASE = "https://reach-lullaby-tighten.ngrok-free.dev/api"
  // or local: "https://10.0.2.2:5001/api" (Android emulator)
  // or local: "https://localhost:5001/api" (iOS sim — trust cert / use http if needed)
  path for activate = "/auth/member-activate"
  full URL = API_BASE + path
  → https://reach-lullaby-tighten.ngrok-free.dev/api/auth/member-activate

STYLE B:
  API_ORIGIN = "https://reach-lullaby-tighten.ngrok-free.dev"
  path = "/api/auth/member-activate"
  full URL = API_ORIGIN + path
  → same correct URL

FORBIDDEN:
  - path starting with "/api/..." when API_BASE already ends with "/api"
  - using MemberNumber / barcode / OTP for login

═══════════════════════════════════════════════════════════════════
ENDPOINT
═══════════════════════════════════════════════════════════════════

Method: POST
Auth: NONE (AllowAnonymous)
Rate limit: member-activate-policy (show friendly retry if 429)

Request JSON (camelCase — ASP.NET default):
{
  "gymCode": "GYM-TEST-01",
  "activationCode": "ABCD12"
}

Rules:
- gymCode: required, string, max 50 (trim). Same code printed on gym QR / settings.
- activationCode: required, string, max 32. One-time code from staff web:
  Staff desk → Member detail → "Generate Activation Code"
  (staff API: POST /api/members/{id}/app-activation-code — NOT for Member App)
- Code is shown once in web UI; hash only stored server-side; expires (config ~24h).

Success: HTTP 200 LoginResponse
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "expiresAtUtc": "2026-08-13T01:00:00Z",
  "user": {
    "id": "<guid>",          // Identity user id == JWT sub
    "email": "...",
    "fullName": "...",
    "role": "Member",
    "tenantId": "<guid>",
    "gymCode": "GYM-TEST-01"
  }
}

Failure: HTTP 401
{ "error": "Invalid or expired activation code." }
(or similar — never show raw stack traces)

Also handle:
- 400 validation (FluentValidation)
- 429 too many requests
- network / TLS errors (ngrok free may need header "ngrok-skip-browser-warning: true" on Dio)

═══════════════════════════════════════════════════════════════════
TOKEN STORAGE + REFRESH
═══════════════════════════════════════════════════════════════════

After 200:
1) Save accessToken, refreshToken, expiresAtUtc, gymCode, user in flutter_secure_storage
2) Decode JWT — use claim "sub" as identity id (NO member_id claim exists)
3) On later APIs: Authorization: Bearer {accessToken}

Refresh (same base-url style):
  STYLE A path: POST /auth/refresh
  STYLE B path: POST /api/auth/refresh
Body: { "refreshToken": "..." }
→ 200 LoginResponse | 401 → force logout → Activation screen

Access token ~15 minutes. Refresh ~30 days.

═══════════════════════════════════════════════════════════════════
FLUTTER IMPLEMENTATION REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1) Screen: ActivationScreen
   - Field Gym Code (text)
   - Field Activation Code (text)
   - Primary CTA: Activate
   - AR + EN labels; RTL when locale=ar
   - Disable button while loading; show error under form from response.error

2) Dio client:
   - baseUrl = STYLE A API_BASE (ends with /api, NO trailing slash issues)
   - All paths MUST start with /auth, /attendance, /notifications, /invitation, /member-store
     NOT /api/auth ...
   - Interceptor: attach Bearer; on 401 once → refresh → retry; else logout

3) Unit/smoke checklist:
   [ ] Full URL never contains "/api/api/"
   [ ] Activate with valid gymCode + code → 200 + tokens stored
   [ ] Wrong/expired code → 401 + friendly AR/EN message
   [ ] Second use of same code → 401
   [ ] Refresh works after access token expires
   [ ] No OTP screens anywhere

4) Example (STYLE A):

final dio = Dio(BaseOptions(
  baseUrl: 'https://reach-lullaby-tighten.ngrok-free.dev/api',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // if using ngrok free
  },
));

final res = await dio.post('/auth/member-activate', data: {
  'gymCode': gymCode.trim(),
  'activationCode': activationCode.trim(),
});
// res.data → LoginResponse map

DO NOT call:
- POST /auth/member-otp
- POST /auth/member-verify
- POST /members/{id}/app-activation-code (staff only)

When done: report the exact full URL string your Dio will hit for activate (must end with /api/auth/member-activate with a single /api).
```

---

## Quick reference

| Item | Value |
|------|--------|
| Correct full URL | `https://<host>/api/auth/member-activate` |
| Wrong (404) | `https://<host>/api/api/auth/member-activate` |
| Body | `{ gymCode, activationCode }` |
| Success | `200` + `LoginResponse` |
| Bad/expired code | `401` `{ error }` |
| Staff generates code | Web Members → Generate Activation Code |
