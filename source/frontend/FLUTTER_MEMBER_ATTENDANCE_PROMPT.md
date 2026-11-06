# HyMotion — Flutter Member App: Attendance History (LIVE)

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`  
> Profile hub: `Frontend/FLUTTER_MEMBER_PROFILE_PROMPT.md`  
> Machine SoT: `docs/api/FRONTEND_API_CONTRACTS.ts` → `ATTENDANCE_ENDPOINTS.memberAttendance`  
> Live controllers: `MemberAttendanceController` (`api/member/attendance`), `AttendanceController` (QR), `MembersController` (staff only)

> **Incident (2026-09-02):** Dio **404** on `GET /api/attendance/history` — that route **never existed** and must never be called.  
> **Backend (2026-09-04):** `GET /api/member/attendance` is **LIVE** (AuthenticatedMember, own visits only).

---

```
PROMPT — HyMotion Member App: Profile Attendance History (LIVE)
You are a senior Flutter developer wiring HyMotion Member App visit history.
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt implements Profile → Attendance (and any “visit history” screen) only.
It does NOT replace auth, QR check-in success UI, occupancy, classes, or orders.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE
(API_BASE ends with `/api`; paths must NOT repeat `/api`), JWT Bearer,
fonts (Cairo), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) NEVER CALL THESE PATHS
═══════════════════════════════════════════════════════════════════

BROKEN (HTTP 404 — route was never shipped):
  GET /attendance/history
  GET /api/attendance/history

FORBIDDEN from the Member App (staff / HR — never call):
  GET /attendance/today
  GET /attendance/search-members
  POST /attendance/manual-checkin
  POST /attendance/barcode-checkin
  GET /members/{id}/attendance          ← staff MembersView; IDOR risk
  GET /members/me/attendance             ← does NOT exist
  GET /hr/employee-attendance
  GET /hr/employee-attendance/me         ← staff work-hours, NOT gym visits
  GET /reports/attendance-summary

═══════════════════════════════════════════════════════════════════
1) PRODUCT BOUNDARY
═══════════════════════════════════════════════════════════════════

A) MEMBER APP (this product)
   Auth: POST /auth/member-activate → Member JWT (role Member).
   QR: POST /attendance/qr-checkin { gymCode }
   Floor: GET /member/occupancy
   Visit history (LIVE): GET /member/attendance?page=1&pageSize=20

B) STAFF WEB — not this Flutter app
   GET /members/{gymMemberId}/attendance  (members.view)

C) HR EMPLOYEE APP — different product
   GET /hr/employee-attendance/me

If JWT roles include Manager (or other staff) AND you are in the Member App shell:
STOP. Re-login with member-activate only.

═══════════════════════════════════════════════════════════════════
2) LIVE APIs (STYLE A)
═══════════════════════════════════════════════════════════════════

API_BASE example:
  https://reach-lullaby-tighten.ngrok-free.dev/api

Auth on every call:
  Authorization: Bearer <member JWT>
  Accept: application/json
  ngrok-skip-browser-warning: true   (when using ngrok)

── Visit history (REQUIRED for Profile → Attendance) ──
GET {API_BASE}/member/attendance?page=1&pageSize=20
Policy: AuthenticatedMember
Ignore any client-side memberId query — server uses JWT only.
→ PagedResult<AttendanceSummaryDto>:
{
  "items": [
    {
      "id": "guid",
      "checkInAtUtc": "2026-09-04T12:00:00Z",
      "checkOutAtUtc": null,
      "entryMethod": "qr"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1,
  "hasNext": false,
  "hasPrevious": false
}
entryMethod values: "qr" | "manual" | "barcode" (and possibly "class").
Soft-deleted / failed check-ins are not returned.

── QR check-in (keep) ──
POST {API_BASE}/attendance/qr-checkin
Body: { "gymCode": "<from static gym QR>" }
After success: refresh GET /member/attendance (or prepend locally then refresh).

── Occupancy (Home card — not history) ──
GET {API_BASE}/member/occupancy

═══════════════════════════════════════════════════════════════════
3) PROFILE → ATTENDANCE UI
═══════════════════════════════════════════════════════════════════

1) Remove every Dio/repository call to /attendance/history.
2) AttendanceSection:
   - Title: Attendance / الحضور
   - On open + pull-to-refresh: GET /member/attendance?page=1&pageSize=20
   - List rows: Cairo date + check-in time; entryMethod label (QR / Manual / Barcode)
   - Show duration only when checkOutAtUtc is non-null
   - Empty (items.length == 0):
       EN: "No visit history yet. Check in at the gym to see visits here."
       AR: "لا يوجد سجل حضور بعد. سجّل حضورك في الصالة لتظهر الزيارات هنا."
   - Pagination: load more when hasNext (page++)
3) Errors:
   - 401 → re-auth / activate again
   - 404 (unlinked profile) → honest empty + “Contact the desk”
   - Never toast raw DioError / stack traces
4) Optional: keep last successful QR check-in in memory as optimistic row until refresh.

═══════════════════════════════════════════════════════════════════
4) TIME DISPLAY (Egypt)
═══════════════════════════════════════════════════════════════════

API timestamps are UTC ISO; may omit trailing Z.
Parse as UTC, display Africa/Cairo.

═══════════════════════════════════════════════════════════════════
5) MIGRATION CHECKLIST
═══════════════════════════════════════════════════════════════════

Search and delete/replace:
  [ ] "attendance/history"
  [ ] "/api/attendance/history"
  [ ] "members/me/attendance"
  [ ] staff /members/{id}/attendance from Member App

Wire:
  [ ] ProfileRepository.getAttendanceHistory(page, pageSize)
      → GET /member/attendance
  [ ] QR still POST /attendance/qr-checkin

═══════════════════════════════════════════════════════════════════
6) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] No request to /attendance/history (Dio logger)
[ ] Profile → Attendance loads GET /member/attendance
[ ] Empty state when totalCount=0 (not an error toast)
[ ] After QR check-in, history refresh shows the new visit
[ ] No staff /members/{id}/attendance, /attendance/today, or HR paths
[ ] Member JWT only (member-activate)
[ ] flutter analyze clean for touched files
[ ] Manual smoke on ngrok
```

---

## Quick reference

| Need | Correct call | Status |
|------|----------------|--------|
| Fix 404 | **Stop** `GET /api/attendance/history` | Required |
| Member QR check-in | `POST /api/attendance/qr-checkin` | Live |
| Member visit history | `GET /api/member/attendance` | **Live** |
| Staff one-member history | `GET /api/members/{id}/attendance` | Staff only |
| Desk today | `GET /api/attendance/today` | Staff only |
| Staff work hours | `GET /api/hr/employee-attendance/me` | HR only |

## Task tracking

| ID | Status |
| -- | ------ |
| BE | `GET /api/member/attendance` shipped (`MemberAttendanceController`) |
| FL | Paste prompt into Flutter repo and wire Profile → Attendance |
