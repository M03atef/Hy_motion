# HyMotion — Flutter Employee App: Profile & Employee Data Hub

> **Prefer the master app prompt for greenfield work:** `Frontend/FLUTTER_EMPLOYEE_APP_PROMPT.md`
> (full Phase 1 app: activate, home, schedule, leave, payroll, documents, profile).
> Use this file when you only need the **Profile / data hub** deep-dive.
>
> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> **Phase 1 auth (binding):** Gym Code + **HR-issued activation code** → JWT with role **`Employee`**.
> Mirror the Member app pattern (`POST /auth/member-activate`) — do NOT use email/password in Phase 1.
>
> **Backend Phase 1 is implemented** — see `GMS/EMPLOYEE_APP_PHASE1_API.md` for the live contract:
> - `POST /api/hr/employees/{id}/app-activation-code`
> - `POST /api/auth/employee-activate`
> - `GET /api/hr/employees/me`
> - Identity via `Employee.EmployeeAppUserId` (separate from Staff `AppUserId`)
>
> Staff HR UX reference: `Frontend/apps/web/src/app/(dashboard)/hr/employees/employees-app.js`.
> DTO shapes: `GMS.Application/DTOs/Hr/*.cs`, `GMS.Api/Controllers/Hr*.cs`.

---

```
PROMPT — HyMotion Employee App: Profile & all employee data (Flutter) — Phase 1
You are a senior Flutter developer building the HyMotion **Employee App** (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

Phase 1 scope: **activation login + Employee role + self-service /me APIs**.
This is NOT the Member app. NOT the staff desk (POS / members / HR admin).

Read FLUTTER_MEMBER_APP_PROMPT.md for stack conventions (Flutter 3.22+, bloc/cubit, dio STYLE A,
secure storage, go_router, fonts, charcoal + lime). Copy the **activation UX pattern** from the
Member app — replace endpoints and forbidden routes with Employee/HR ones below.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (Phase 1)
═══════════════════════════════════════════════════════════════════

Every **Active** HR employee can use the app after HR issues a one-time activation code
(same operational model as Member app activation).

Employee app OWNS:
- Activate: Gym Code + Activation Code
- Session (JWT role Employee + refresh + logout)
- Profile hub: identity (partial until /me), schedule, attendance check-in/out, leave,
  payroll lines (own), documents (own), settings
- Self-service only — data scoped to JWT → Employee via server /me resolution

FORBIDDEN:
- Member app routes (/auth/member-activate, /member/*, qr-checkin, invitations, member-store)
- Staff desk: email/password login screen in Phase 1 (Phase 2 optional)
- HR admin: list employees, approve others' leave, payroll calculate/approve, schedule assign
- Passing employeeId query/body on self-service calls

Feature gate: tenant `hr` feature flag.

═══════════════════════════════════════════════════════════════════
1) AUTH — Phase 1: Activation (BINDING)
═══════════════════════════════════════════════════════════════════

DO NOT implement email/password login in Phase 1.
DO NOT use POST /auth/member-activate.

Flow (mirror Member app):
1) HR generates one-time code on employee record (staff web — HR only):
   POST /hr/employees/{id}/app-activation-code   ← backend to implement (parallel member route)
2) Employee opens app → Gym Code + Activation Code
3) App calls:

POST {API_BASE}/auth/employee-activate
Body: { "gymCode": string, "activationCode": string }
→ 200 LoginResponse | 401 { "error": "..." }

LoginResponse (same shape as member/staff):
{
  "accessToken": string,
  "refreshToken": string,
  "expiresAtUtc": string,
  "user": {
    "id": string,
    "email": string,
    "fullName": string,
    "role": "Employee",
    "tenantId": string,
    "gymCode": string
  }
}

Refresh: POST {API_BASE}/auth/refresh  Body: { "refreshToken": string }

On success store in flutter_secure_storage: accessToken, refreshToken, gymCode.
Optional ngrok header: ngrok-skip-browser-warning: true

Dio interceptor: Bearer token; one refresh on 401; failure → clear storage → activation screen.

Rate limits may apply (mirror member-activate policy) — show friendly “try again shortly”.

Phase 2 (later, not Phase 1): gymCode + email + password via POST /auth/login for employees
who prefer password login after HR sets credentials.

═══════════════════════════════════════════════════════════════════
2) JWT & IDENTITY (CRITICAL)
═══════════════════════════════════════════════════════════════════

After employee-activate, JWT includes role **Employee** (backend must seed this role).

Claims: sub, email, tenant_id, gym_code, first_name, last_name, role=Employee
There is NO `employee_id` claim. TokenService does not emit it (same rule as Member app).

Backend resolves Employee for /me routes:
  Identity sub → AppUser.UserId → Employee.AppUserId → Employee.Id

Activation must auto-link Employee.AppUserId when consuming the code (mirror member activation).

Flutter rules:
- JWT sub = Identity user id — NOT Employee.Id
- Never call GET /hr/employees/{id} with sub or guessed ids
- All self-service uses /me paths only

403 Forbid on /me after activate should not happen if activation linked correctly.
If it happens: show error + contact HR.

═══════════════════════════════════════════════════════════════════
3) API SURFACE — LIVE TODAY (use after activation)
═══════════════════════════════════════════════════════════════════

API_BASE ends with `/api`. Paths must NOT repeat `/api`.
Authorization: Bearer + FeatureFlag `hr`.

── Self-service (Authenticated user + linked Employee) ──

GET  /hr/employee-attendance/me?from=&to=
POST /hr/employee-attendance/me/check-in     Body: { "notes"?: string }
POST /hr/employee-attendance/me/check-out  Body: {}

GET  /hr/employee-schedules/me?from=&to=

GET  /hr/leave-balances/me?year=
GET  /hr/leave-requests/me?status=
POST /hr/leave-requests/me
POST /hr/leave-requests/me/{id}/cancel

GET  /hr/payroll-periods/me?year=

GET  /hr/employees/me/documents
GET  /hr/employee-documents/me/{id}/file

── Profile header Phase 1 fallback ──

Until GET /hr/employees/me ships:
  LoginResponse.user.fullName, user.gymCode, JWT gym_code

── Backend to implement (blocking activation flow) ──

POST /auth/employee-activate          (consume code, issue JWT role Employee)
POST /hr/employees/{id}/app-activation-code  (HR generates plaintext once)

── Backend Phase 2 (nice to have) ──

GET /hr/employees/me
GET /hr/employees/me/contracts
GET /hr/employees/me/capabilities     (job-based section visibility)

═══════════════════════════════════════════════════════════════════
4) CAPABILITIES — Phase 1 simplification
═══════════════════════════════════════════════════════════════════

Phase 1: show all self-service sections for linked Active employees.
Call each /me API; hide section only on 403 or empty — do not build job matrix yet.

Phase 2: GET /hr/employees/me/capabilities drives visibility by position/employment type.

Attendance rules (late, duplicate check-in, terminated) are **server-enforced** — display API errors.

═══════════════════════════════════════════════════════════════════
5) UI — Screens (Phase 1)
═══════════════════════════════════════════════════════════════════

Unauthenticated:
  ActivateEmployeeScreen — Gym Code + Activation Code (copy Member activate layout)

Authenticated bottom nav:
  1. Home — today shift, check-in/out CTA, quick links
  2. Schedule — /employee-schedules/me
  3. Leave — balances + requests + new request
  4. Profile — hub (attendance history, payroll, documents, settings, logout)

Check-in/out prominent on Home + Profile header.

Login fields NOT in Phase 1: email, password.

═══════════════════════════════════════════════════════════════════
6) UTC / TIME (Egypt UTC+3)
═══════════════════════════════════════════════════════════════════

Parse UTC ISO (append Z if missing); display Africa/Cairo.
Date-only fields: no timezone shift.

═══════════════════════════════════════════════════════════════════
7) DESIGN
═══════════════════════════════════════════════════════════════════

Same HyMotion tokens: charcoal #0D0D0D, lime #7ACC00, teal #148F8F,
Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic.

Employee app UI = professional HR self-service (not member marketing style).

═══════════════════════════════════════════════════════════════════
8) ACCEPTANCE CHECKLIST (Phase 1)
═══════════════════════════════════════════════════════════════════

[ ] Activation ONLY: POST /auth/employee-activate (no email/password screen)
[ ] No member-activate, no OTP
[ ] JWT role Employee; tokens in secure storage; refresh works
[ ] All HR data via /me routes only
[ ] Check-in/out, schedule, leave, payroll, documents work after activation
[ ] hr feature off → clear message
[ ] Cairo timezone on timestamps
[ ] AR + EN + RTL
[ ] flutter analyze clean

═══════════════════════════════════════════════════════════════════
9) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Scaffold + theme + l10n + Dio (wait for /auth/employee-activate or mock behind flag)
2. ActivateEmployeeScreen + refresh + auth gate
3. Home + check-in/out
4. Schedule + leave
5. Profile hub (payroll, documents, settings)
6. Wire GET /hr/employees/me when backend ships
7. Phase 2: email/password login optional; /me/capabilities
```

---

## Compatibility with your system **today**

| Item | Status |
|------|--------|
| `/hr/*/me` self-service APIs | **Live** — works when `Employee.AppUserId` is linked |
| `POST /auth/employee-activate` | **Not built yet** — implement (copy member-activate) |
| `POST /hr/employees/{id}/app-activation-code` | **Not built yet** — implement (copy members route) |
| Identity role **`Employee`** | **Not built yet** — seed + assign on activate |
| `GET /hr/employees/me` | **Not built yet** — Phase 1 uses login user for header |

**Flutter can start UI now** against `/me` routes using a **temporary staff login + linked employee** for dev/testing until `employee-activate` ships.

---

## Why activation + Employee role is enough for Phase 1

- Same proven flow as Member app — HR issues code once, employee activates phone
- No password management for cleaners / part-time staff
- **`Employee` role** keeps desk permissions out of JWT — app cannot accidentally expose POS/HR admin
- Email/password can be **Phase 2** for managers who want it

**Pair with:** `FLUTTER_MEMBER_APP_PROMPT.md` (activation pattern), `FLUTTER_MEMBER_PROFILE_PROMPT.md` (parallel product).
