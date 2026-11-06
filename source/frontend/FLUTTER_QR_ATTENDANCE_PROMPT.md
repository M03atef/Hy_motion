# HyMotion — Flutter QR Attendance (Member: no change / Employee: NEW)

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Related: `Frontend/FLUTTER_MEMBER_ATTENDANCE_PROMPT.md` (visit history — unaffected by this change)
> Related: `Frontend/FLUTTER_EMPLOYEE_APP_PROMPT.md` (Employee app shell/auth/attendance screen — this prompt extends its existing Attendance section)
> Backend controllers: `AttendanceController` (`api/attendance`), `HrEmployeeAttendanceController` (`api/hr/employee-attendance`)

> **Backend context (2026-09-07):** The gym's QR code is no longer a permanent static string —
> it's now a short-lived (~45s) signed token minted by the backend and displayed live on a
> reception screen (Settings → QR in the staff web app). GPS/location is explicitly NOT part of
> this feature — the QR's short lifetime is the only "physical presence" signal for this phase.

---

```
PROMPT — HyMotion QR Attendance: Member (verify only) + Employee (NEW scan-to-check-in)
You are a senior Flutter developer. Arabic primary + English secondary, RTL when locale is Arabic.
Read Frontend/FLUTTER_MEMBER_APP_PROMPT.md and Frontend/FLUTTER_EMPLOYEE_APP_PROMPT.md first for
stack conventions, STYLE A API_BASE (ends with /api, paths must NOT repeat /api), JWT Bearer, and
existing screen/component locations before touching anything.

═══════════════════════════════════════════════════════════════════
0) WHAT ACTUALLY CHANGED ON THE BACKEND
═══════════════════════════════════════════════════════════════════

The QR image displayed at reception now encodes an opaque short-lived signed token instead of a
permanent gym code string. Nothing else about its shape changed — it's still just a string the
camera decodes and forwards.

MEMBER APP: NO CODE CHANGES REQUIRED.
  Your existing call — POST /attendance/qr-checkin { "gymCode": "<whatever the scanner decoded>" }
  — already forwards the raw scanned string verbatim. Since the backend now expects that string to
  be the signed token (not a literal gym code), and your scanner already just passes through
  whatever it reads, this keeps working with zero changes. Do NOT hardcode or cache the old static
  gym code anywhere — if you find any such caching (e.g. "remember last scanned code" logic), remove
  it, since a cached code is now stale within ~45 seconds and every scan must send a fresh read.

EMPLOYEE APP: NEW — this is the actual work in this prompt.
  There was previously no QR flow for employees at all, only a plain self-service check-in button
  (POST /hr/employee-attendance/me/check-in, no QR). That endpoint is UNCHANGED and still exists —
  do not remove or repurpose it. This prompt ADDS a QR-based path alongside it.

═══════════════════════════════════════════════════════════════════
1) EMPLOYEE QR FLOW — TWO NEW ENDPOINTS
═══════════════════════════════════════════════════════════════════

Both live under the SAME employee-attendance controller employees already call for check-in/out.
Both resolve the employee's identity from the JWT server-side — you never send an employeeId.

── Step 1: Validate (read-only preview, does NOT create attendance) ──
POST {API_BASE}/hr/employee-attendance/me/qr-validate
Headers: Authorization: Bearer <employee JWT>, Content-Type: application/json
Body: { "qrToken": "<string the camera decoded from the gym QR>" }

Success (200) — EmployeeQrCheckinPreviewDto:
{
  "hasSchedule": true,
  "shiftName": "Morning",
  "shiftStart": "09:00:00",
  "shiftEnd": "17:00:00",
  "previewCheckInAtUtc": "2026-09-07T07:02:00Z",
  "previewLateMinutes": 0,
  "previewStatus": "Present"
}
When there's no shift scheduled today, hasSchedule is false, shiftName/shiftStart/shiftEnd are
null, and previewStatus is still "Present" (this codebase's existing HR rule: no shift means
lateness can't be judged, so it's never penalized — do not invent a stricter rule).

Failure (400) — always shape { "error": "<message> / <رسالة عربية>" }, e.g.:
  "Invalid or expired QR / رمز QR غير صالح أو منتهي"
  "This QR code belongs to a different gym / رمز QR هذا يخص صالة رياضية أخرى"
  "Already checked in today / تم تسجيل الحضور بالفعل اليوم"
  "Employee not found / الموظف غير موجود"          (JWT not linked to an active Employee)
Do not parse these strings for branching logic beyond showing them — there is no separate
machine-readable error code today (matches how every other check-in endpoint in this codebase
already works: plain bilingual message, no status enum).

── Step 2: Confirm (actually creates the attendance row) ──
POST {API_BASE}/hr/employee-attendance/me/qr-check-in
Headers: same as above
Body: { "qrToken": "<the SAME token from step 1, or a fresh one if the user waited>" }

Success (200) — EmployeeAttendanceDto (existing shape, same as the plain /me/check-in response):
{
  "id": "guid", "employeeId": "guid", "employeeName": "Ahmed Mohamed", "employeeNumber": "EMP-0001",
  "scheduleId": "guid-or-null", "employeeShiftName": "Morning-or-null",
  "attendanceDate": "2026-09-07", "checkInAtUtc": "2026-09-07T07:02:14Z", "checkOutAtUtc": null,
  "workedMinutes": 0, "lateMinutes": 0, "overtimeMinutes": 0,
  "status": "Present", "source": "Qr", "notes": null
}
Failure (400): same shapes as step 1 — this call INDEPENDENTLY re-validates the QR token and the
"already checked in" guard. A stale step-1 response cannot be replayed here to create a duplicate
or backdated record — if the user waits too long, confirm will fail with the expired-QR message
and the UI should send them back to scanning.

CHECK-OUT IS UNCHANGED: still POST /hr/employee-attendance/me/check-out (no body, no QR). Do not
add a QR step to check-out — this phase is check-in only.

═══════════════════════════════════════════════════════════════════
2) EMPLOYEE UX — Attendance screen additions
═══════════════════════════════════════════════════════════════════

Existing screen (per FLUTTER_EMPLOYEE_APP_PROMPT.md): shows today's shift + a plain check-in/out
button. ADD a "Scan QR to Check In" button/tab alongside (do not remove the existing plain
check-in button — some sites may still want it as a fallback, e.g. no camera).

1) Idle: [ Scan QR to Check In ]
2) Tap → open camera scanner (reuse whatever QR scanner package/widget the Member app already
   uses for its qr-checkin flow — do not add a second scanner package to the project).
3) On a decoded QR: STOP scanning immediately (see §4 — this is the most common mobile QR bug),
   show a "Validating…" spinner, POST /me/qr-validate with that string.
4) On success → show the confirmation card:
   --------------------------------
   Ready to Check In
   Shift: 09:00 AM – 05:00 PM        (omit this line entirely when hasSchedule is false; instead
                                       show: "No shift scheduled today — this will be recorded as
                                       an unscheduled check-in." / "لا توجد وردية مجدولة اليوم")
   Check-in time: 09:02 AM           (format previewCheckInAtUtc in the device's local time)
   Status: On Time                   (map previewStatus: Present → "On Time" / "في الوقت"،
                                       Late → "Late by {previewLateMinutes} min" / "متأخر ٪د دقيقة")
   [ Cancel ]  [ Confirm Check-In ]
   --------------------------------
5) Cancel → back to idle, resume scanning is allowed again.
   Confirm → POST /me/qr-check-in with the token from step 3. Show a brief loading state on the
   Confirm button (disable it — prevent double-tap-triggered duplicate submits).
6) On success:
   ✓ Checked In
   09:02 AM
   [ Check Out ]                    (wire to the existing /me/check-out call, unchanged)
7) On failure at any step, map to a plain, non-technical message (see §5) — never show the raw
   error string or an HTTP status code to the user.

Unscheduled confirmation nuance: the backend does NOT return a distinct "UNSCHEDULED" status — it
returns the same success preview with hasSchedule=false. The "this will be recorded as unscheduled"
copy in step 4 is purely a UI presentation choice driven by hasSchedule; it is still the ONE
Confirm button, not a second confirmation dialog.

═══════════════════════════════════════════════════════════════════
3) MEMBER APP UX (reference only — confirms existing behavior, no new work)
═══════════════════════════════════════════════════════════════════

Your existing single-step flow is already correct and matches the intended design — SCAN →
VALIDATE → CHECK-IN, no second confirmation:

[ Scan QR to Check In ]
  → decode QR → POST /attendance/qr-checkin { gymCode: <decoded string> } → on success:
✓ Check-in Successful
Time: HH:mm
  → on failure, map the message (see §5).

If your current implementation shows any technical/raw error text, or retries the same scanned
string automatically on failure, fix that now per §5/§4 — otherwise this section requires no
functional change.

═══════════════════════════════════════════════════════════════════
4) SCANNER BEHAVIOR (both apps)
═══════════════════════════════════════════════════════════════════

A camera-based QR scanner fires the detection callback on MULTIPLE consecutive frames for the
same physical code. Guard against this explicitly:
- On the first successful decode, immediately pause/stop the camera stream (or set an
  `_isProcessing` flag checked at the top of the callback and returned from early).
- Do not re-arm scanning until the network call (validate, or member check-in) has resolved AND
  the user has left the result/confirmation screen (Cancel, or after seeing success/error).
- Employee flow specifically: after Cancel on the confirmation card, resume scanning; after a
  successful Confirm, do NOT resume scanning — navigate to the "Checked In" state instead.
- Never fire two /qr-validate or /qr-checkin requests for one physical scan.

═══════════════════════════════════════════════════════════════════
5) ERROR MAPPING (both apps — use the existing API-error abstraction, don't hardcode per-widget)
═══════════════════════════════════════════════════════════════════

Map backend messages (case-insensitive substring match on the English half before " / ") to:
  "invalid or expired qr"        → ✕ Invalid or expired QR / رمز QR غير صالح أو منتهي — go back to scan
  "different gym"                → ✕ This QR belongs to another gym / هذا الرمز يخص صالة أخرى
  "invalid gym qr code"          → ✕ Invalid or expired QR (same bucket as above)
  "already checked in"           → ℹ You are already checked in today / أنت مسجل حضورك بالفعل
  "membership...expired"/"not active"/"not started" (member app, from existing gauntlet)
                                  → ✕ Your membership is not active / عضويتك غير نشطة
  "employee not found"           → ✕ Your account isn't linked to a staff profile — contact your manager
  network/timeout                → ✕ Network error — check your connection and try again
  anything else (5xx, unparsed)  → ✕ Something went wrong — please try again
Never surface the raw exception, stack trace, or HTTP status code in the UI.
Camera permission denied → a dedicated "Camera access needed to scan the check-in QR" state with
a button to open app settings (not a generic error toast). Camera unavailable (no camera on
device, or hardware failure) → fall back to showing the plain check-in button only (employee app)
or a clear "Camera unavailable" message (member app has no non-QR fallback today).

═══════════════════════════════════════════════════════════════════
6) TESTS REQUIRED
═══════════════════════════════════════════════════════════════════

Employee (new):
[ ] Successful scan → validate → confirmation card renders shift/time/status correctly
[ ] No schedule today → confirmation card shows the unscheduled note, Confirm still creates attendance
[ ] Expired/invalid QR at validate → error state, no confirmation card shown
[ ] Expired QR between validate and confirm (simulate a delay) → confirm fails with expired-QR
    message, does not show "Checked In"
[ ] Already checked in → validate fails immediately with the friendly info message
[ ] Rapid double-tap on Confirm → only one network call fires (button disabled after first tap)
[ ] Scanner does not fire twice for one physical QR (mock multiple frame callbacks)
[ ] Camera permission denied → dedicated permission UI, not a crash or blank screen

Member (regression only — confirm nothing broke):
[ ] Existing successful QR check-in flow still works end-to-end against the live API
[ ] flutter analyze clean for all touched files

═══════════════════════════════════════════════════════════════════
7) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] Employee Attendance screen has a working Scan QR → validate → confirm → checked-in flow
[ ] Plain (no-QR) employee check-in/out buttons still work, untouched
[ ] Member QR check-in still works with zero code changes (only the QR image content changed,
    not the client contract)
[ ] No employeeId, memberId, checkInTime, or attendance status is ever sent by the client —
    only the scanned qrToken string and (for employee) nothing else
[ ] No GPS/location permission or API added anywhere in this work
[ ] Scanner never double-fires for one physical scan
[ ] All error states show bilingual, non-technical copy
[ ] flutter analyze clean; manual smoke test on the ngrok tunnel against the live backend
```
