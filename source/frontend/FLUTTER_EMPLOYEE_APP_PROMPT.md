# HyMotion — Flutter Employee App Developer Prompt (Phase 1)

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> **Live API contract:** `GMS/EMPLOYEE_APP_PHASE1_API.md` (implemented backend).
> Stack/fonts/URL STYLE A: same conventions as `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`.
> Profile detail hub: also see `Frontend/FLUTTER_EMPLOYEE_PROFILE_PROMPT.md` (this file is the **master app** prompt).
>
> HR issues codes in web: Employees drawer → **Generate code**.

---

```
PROMPT — HyMotion Employee Mobile App (Flutter) — Phase 1
You are a senior Flutter developer building the HyMotion **Employee App** — the workforce
companion for gym employees (Egypt / MENA). Arabic primary + English secondary; RTL when locale is Arabic.

This is NOT the Member App. NOT the Staff desk / POS / HR admin web.

Backend Phase 1 is LIVE. Prefer EMPLOYEE_APP_PHASE1_API.md + live controllers over older docs.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING)
═══════════════════════════════════════════════════════════════════

OWN (build these):
- Activate with Gym Code + HR-issued one-time Activation Code
- Session (JWT role = Employee + refresh + logout)
- Home: greeting, today shift, Check in / Check out CTA, quick links
- Schedule: upcoming shift assignments (read-only)
- Attendance: history + self check-in / check-out
- Leave: balances, my requests, submit request, cancel own pending
- Payroll: own payslip lines (read-only)
- Documents: list + download own HR files
- Profile: GET /hr/employees/me header + settings (language, theme, logout)
- Bilingual EN/AR + RTL

FORBIDDEN (never call, never UI):
- POST /auth/member-activate, /member/*, invitations, member-store, QR gym check-in
- Staff login email/password (Phase 1)
- POST /auth/login for employees
- GET /hr/employees (list), GET /hr/employees/{otherId}
- Approve/reject leave, payroll calculate/approve/close
- Schedule assign / bulk / delete for others
- Document upload/delete, link-staff / unlink-staff
- Passing employeeId from the client on self-service calls
- POS, members, inventory, sales, credits

Feature gate: tenant feature flag `hr`. If APIs return FEATURE_DISABLED / 404 → show
“HR is not enabled for this gym” and stop.

═══════════════════════════════════════════════════════════════════
1) TECH STACK (required)
═══════════════════════════════════════════════════════════════════

- Flutter 3.22+ / Dart 3.4+
- State: flutter_bloc (Cubit preferred)
- HTTP: dio (+ auth interceptor)
- Storage: flutter_secure_storage (tokens + gymCode — NEVER SharedPreferences for tokens)
- Nav: go_router
- Localize: flutter_localizations + arb (ar + en)
- Fonts: google_fonts → Space Grotesk (display) + IBM Plex Sans + IBM Plex Sans Arabic

Dev / ngrok base URL (STYLE A — required):
- API_BASE must end with `/api` and paths must NOT repeat `/api`
- Example: `https://<ngrok>/api` → path `/auth/employee-activate`
- Android emulator: `https://10.0.2.2:5001/api`
- iOS simulator: `https://localhost:5001/api`
- Physical device: `https://<LAN-IP>:5001/api`

FORBIDDEN URL bug:
  base ".../api" + path "/api/auth/employee-activate" → "/api/api/..." → 404
Always use path "/auth/employee-activate" when base already includes "/api".

Optional header (ngrok free): ngrok-skip-browser-warning: true

═══════════════════════════════════════════════════════════════════
2) AUTH — Activation only (BINDING)
═══════════════════════════════════════════════════════════════════

DO NOT implement email/password login in Phase 1.
DO NOT use member-activate or OTP.

Flow:
1) HR generates code on web: POST /hr/employees/{id}/app-activation-code (staff only)
2) Employee opens app → Gym Code + Activation Code (hyphens optional; case-insensitive)
3) App calls:

POST {API_BASE}/auth/employee-activate
Body: { "gymCode": "GYM-TEST-01", "activationCode": "3PA4-A3CT" }
→ 200 LoginResponse | 401 { "error": "..." }
Rate limit: 10/min/IP — show friendly “try again shortly” on 429

LoginResponse:
{
  "accessToken": string,      // ~15 min
  "refreshToken": string,     // ~30 days
  "expiresAtUtc": string,
  "user": {
    "id": string,             // Identity user id (JWT sub) — NOT Employee.Id
    "email": string,          // often emp-0001@employee.HyMotion.local
    "fullName": string,
    "role": "Employee",
    "tenantId": string,
    "gymCode": string
  }
}

Refresh:
POST {API_BASE}/auth/refresh
Body: { "refreshToken": string }
→ 200 LoginResponse | 401

On every authenticated request:
  Authorization: Bearer {accessToken}

Dio interceptor:
- Attach Bearer
- On 401 (except refresh): try ONE refresh; on failure → clear storage → Activate screen

Store: accessToken, refreshToken, gymCode, expiresAtUtc in flutter_secure_storage.

═══════════════════════════════════════════════════════════════════
3) JWT & IDENTITY (CRITICAL)
═══════════════════════════════════════════════════════════════════

Claims: sub, email, jti, tenant_id, gym_code, first_name, last_name, role=Employee
THERE IS NO employee_id claim. Never invent Employee Guid from user.id.

Backend resolves Employee via:
  JWT sub → AppUser.UserId → Employee.EmployeeAppUserId
  (Staff AppUserId link is separate and unused by this app)

Rules:
- Never call GET /hr/employees/{id} with sub or any client-chosen id
- All HR data via /me paths only
- If Employee Suspended/Terminated → /me returns 403 — show “Contact HR; account inactive”

═══════════════════════════════════════════════════════════════════
4) API SURFACE — LIVE SELF-SERVICE
═══════════════════════════════════════════════════════════════════

API_BASE ends with `/api`. Paths below are relative to API_BASE.
All require Bearer + hr feature (except activate/refresh).

── Profile ──

GET /hr/employees/me
→ EmployeeMeDto {
     id, employeeNumber, firstName, lastName, fullName,
     phone?, email?, photoUrl?, status, departmentId?, departmentName?,
     positionId?, positionName?, hireDate, dateOfBirth?, createdAtUtc
   }
403 → not linked / not Active

photoUrl may be relative `/uploads/...` — resolve to API **origin without /api**
(same rule as Member product photos). Fallback: initials avatar.

── Attendance (work hours — NOT gym member QR) ──

GET  /hr/employee-attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD
→ EmployeeAttendanceDto[]
  { id, employeeId, employeeName, employeeNumber, scheduleId?, employeeShiftName?,
    attendanceDate, checkInAtUtc?, checkOutAtUtc?, workedMinutes, lateMinutes,
    overtimeMinutes, status, source, notes? }

POST /hr/employee-attendance/me/check-in
Body: { "notes"?: string }
→ EmployeeAttendanceDto

POST /hr/employee-attendance/me/check-out
Body: {}
→ EmployeeAttendanceDto

UX:
- Today open visit (checkIn set, checkOut null) → primary “Check out”
- Else → “Check in”
- History: default last 30 days; show worked as “Xh Ym”; late/OT when > 0

── Schedule ──

GET /hr/employee-schedules/me?from=&to=
→ EmployeeScheduleAssignmentDto[]
  { id, employeeId, employeeName, employeeShiftId, employeeShiftName,
    shiftStartTime, shiftEndTime, date, notes? }

Home: today + next 7–14 days. Full schedule screen: up to +60 days.

── Leave ──

GET  /hr/leave-balances/me?year=YYYY
→ LeaveBalanceDto[] { leaveType, year, entitledDays, usedDays, remainingDays, ... }

GET  /hr/leave-requests/me?status=
→ LeaveRequestDto[]

POST /hr/leave-requests/me
Body: { leaveType, startDate, endDate, durationDays?, reason? }
→ 201 LeaveRequestDto

POST /hr/leave-requests/me/{id}/cancel
→ LeaveRequestDto

Leave types (exact strings): Annual | Sick | Unpaid | Permission | Maternity | Paternity | Emergency
Permission: startDate == endDate; durationDays = fraction (e.g. 0.25)
Status chips: Pending | Approved | Rejected | Cancelled
Employee cannot approve/reject others.

── Payroll ──

GET /hr/payroll-periods/me?year=YYYY
→ PayrollLineDto[]
  { year, month, basicSalary, overtimeAmount, bonusAmount, allowanceAmount,
    deductionAmount, netSalary, periodStatus, ... }

Prefer showing Approved / Closed periods. Currency EGP. Read-only.

── Documents ──

GET /hr/employees/me/documents
→ EmployeeDocumentDto[] { id, documentType, fileName, issueDate?, expiryDate?, expiryStatus, ... }

GET /hr/employee-documents/me/{id}/file
→ binary (PDF/image) with Authorization — open/share via system viewer
No upload/delete in Phase 1.

═══════════════════════════════════════════════════════════════════
5) UTC / TIME (Egypt UTC+3)
═══════════════════════════════════════════════════════════════════

API timestamps are UTC ISO; many omit trailing `Z`.
Parse as UTC (append Z if missing), display Africa/Cairo for:
  checkInAtUtc, checkOutAtUtc, createdAtUtc, requestedAtUtc

Date-only (attendanceDate, hireDate, leave dates, schedule date): no TZ shift.
Shift times (shiftStartTime, shiftEndTime): wall-clock TimeOnly — display as-is.

═══════════════════════════════════════════════════════════════════
6) ERRORS
═══════════════════════════════════════════════════════════════════

Often: { "error": "..." } (sometimes bilingual in one string)
Sometimes ProblemDetails: { title, detail, status }
Handle BOTH. Never show raw JSON.
Map activate failures to AR/EN (invalid code, already used, try again).
403 on /me → inactive / not linked message.
hr feature off → dedicated empty state.

═══════════════════════════════════════════════════════════════════
7) SCREENS / NAV
═══════════════════════════════════════════════════════════════════

Unauthenticated:
- ActivateEmployeeScreen: Gym Code + Activation Code (mirror Member activate UX)
  Hint: “Ask HR for your activation code”

Authenticated shell (bottom nav):
1. Home — greeting (fullName from /me or login), today shift, Check in/out CTA,
   shortcuts to Leave / Schedule / Profile
2. Schedule — list/calendar of assignments
3. Leave — balances + requests + FAB/form “Request leave”
4. Profile — EmployeeMeDto header, attendance recent, payroll teaser, documents,
   language, theme, logout

Also:
- AttendanceHistoryScreen (optional push from Profile)
- PayslipDetail / DocumentViewer
- LeaveRequestFormScreen

═══════════════════════════════════════════════════════════════════
8) DESIGN (match HyMotion — do not invent themes)
═══════════════════════════════════════════════════════════════════

Brand: charcoal #0D0D0D + lime CTA #7ACC00 + teal #148F8F
Light bg #FAFAFA / surface #FFFFFF
Fonts: Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic

Status colors:
  Active green · Suspended amber · Terminated gray
  Leave Pending amber · Approved green · Rejected red · Cancelled gray
  Attendance Present/late/absent — use clear chips, not neon glow

FORBIDDEN: Inter/Roboto as brand, purple gradients, cream+terracotta AI look,
navy+#E94560 “gym dark” packs, emoji clutter.

Employee app = professional HR self-service (compact), not Member marketing.

═══════════════════════════════════════════════════════════════════
9) ARCHITECTURE (suggested)
═══════════════════════════════════════════════════════════════════

lib/
  core/          — dio, secure storage, theme, l10n, router
  features/
    auth/        — activate cubit + screen
    home/
    schedule/
    attendance/
    leave/
    payroll/
    documents/
    profile/     — employees/me + settings

Repositories call /me only. Never pass EmployeeId.

After activate: await GET /hr/employees/me to warm profile cache;
on 403 show blocked state.

═══════════════════════════════════════════════════════════════════
10) ACCEPTANCE CHECKLIST
═══════════════════════════════════════════════════════════════════

[ ] Activation uses ONLY POST /auth/employee-activate (no email/password, no member-activate)
[ ] Tokens in flutter_secure_storage; silent refresh; logout clears session
[ ] user.id / JWT sub never used as Employee.Id
[ ] All HR data via /me routes only
[ ] Check-in / check-out work; errors shown in AR/EN
[ ] Schedule, leave (create/cancel), payroll, documents work
[ ] GET /hr/employees/me drives Profile header
[ ] UTC → Cairo for timestamps
[ ] photoUrl resolved without /api/uploads 404
[ ] 403 / hr-disabled / 429 handled
[ ] AR + EN + RTL
[ ] flutter analyze clean; Android + iOS

═══════════════════════════════════════════════════════════════════
11) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Scaffold + theme + l10n + Dio STYLE A + secure storage + GoRouter
2. ActivateEmployeeScreen + refresh interceptor + auth gate
3. Home + check-in/out + today schedule strip
4. GET /hr/employees/me Profile header
5. Schedule screen
6. Leave balances + list + request + cancel
7. Payroll list
8. Documents list + file download
9. Settings (language, theme, logout)
10. Polish: shimmer, empty states, pull-to-refresh, offline message

Wait for go-ahead before scaffolding if pasted into an AI coding agent;
if handed to a human Flutter developer, start at step 1.
```

---

## Quick reference (for humans)

| Area | Employee App | Forbidden |
|------|--------------|-----------|
| Auth | `POST /auth/employee-activate` | member-activate, staff email/password |
| Profile | `GET /hr/employees/me` | `GET /hr/employees/{id}` |
| Attendance | `/hr/employee-attendance/me/*` | Staff attendance manage for others |
| Schedule | `GET /hr/employee-schedules/me` | Assign/bulk schedule |
| Leave | `/hr/leave-*/me` | Approve/reject |
| Payroll | `GET /hr/payroll-periods/me` | Calculate/approve periods |
| Documents | `/hr/employees/me/documents` + file | Upload/delete |

**HR web:** Employees drawer → Generate code (show once).

**Backend SoT:** `EMPLOYEE_APP_PHASE1_API.md`
