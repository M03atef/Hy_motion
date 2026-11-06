# HyMotion — Flutter Member App: Subscription Remaining Days

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: [`FLUTTER_MEMBER_APP_PROMPT.md`](FLUTTER_MEMBER_APP_PROMPT.md)  
> Profile hub: [`FLUTTER_MEMBER_PROFILE_PROMPT.md`](FLUTTER_MEMBER_PROFILE_PROMPT.md)  
> Brand: **HyMotion** (never GymFlowPro)
>
> **Goal:** Show the member how many days are left on their gym membership (subscription), with honest empty/frozen/expired states.
>
> **LIVE today (partial)**
> - `GET /api/invitation/summary` → plan name + `membershipStatus` only (**no** `endDate` / days)
> - QR check-in success → plan name + sessions (**no** expiry)
>
> **NOT LIVE yet (required for accurate remaining days)**
> - `GET /api/member/me` (includes `currentMembership`)
> - `GET /api/member/membership/current` (preferred for this card — same shape as staff current membership)
>
> **FORBIDDEN from Member App**
> - `GET /api/members/{id}` / `.../membership` / `.../attendance`
> - `GET /api/memberships/{memberId}/current|history`
> - Using JWT `sub` as `GymMember.Id`

---

```
PROMPT — HyMotion Member App: Subscription Remaining Days
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.
Brand name in UI: HyMotion (never GymFlowPro; never translate the brand).

This prompt ADDS one focused surface:
  Home + Profile → “Membership / العضوية” card that shows remaining days
  on the member’s current gym subscription (membership period).

It does NOT replace auth, QR check-in, invitations, orders, classes, or quotas.
It does NOT invent renew / freeze / pay / buy-plan flows (reception-first).

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE
(API_BASE ends with `/api`; paths must NOT repeat `/api`), Member JWT
(member-activate only), fonts (Cairo), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING)
═══════════════════════════════════════════════════════════════════

OWN (build):
- Hero membership card on Home (and the same widget on Profile → Membership)
- Show: plan name (EN/AR by locale), status chip, days remaining, end date
- Progress bar: days used of total period (optional but preferred)
- Urgency colors for remaining days
- Session-pack plans: primary metric = sessions remaining (days still secondary)
- Frozen: show freeze window, not “days left” as if they can train
- Expired / cancelled / none: honest empty + “Ask reception” (no fake renew CTA
  that calls APIs)

FORBIDDEN:
- GET /members/{id}* , GET /memberships/{memberId}/*     (staff — IDOR risk)
- GET /membership-plans*                                 (staff plans.manage)
- POST assign / renew / freeze / cancel / pay from the app
- Inventing endDate or daysRemaining client-side without a real membership DTO
- Using JWT `sub` as GymMember.Id
- Dual EN/AR in one label (“Active / نشط”) — one string per locale

═══════════════════════════════════════════════════════════════════
1) STYLE A HTTP
═══════════════════════════════════════════════════════════════════

API_BASE example: https://<host>/api
Auth on every call:
  Authorization: Bearer <member JWT>
  Accept: application/json
  ngrok-skip-browser-warning: true   (when using ngrok)

WRONG:  API_BASE ".../api" + path "/api/member/..."
RIGHT:  path "/member/..."

═══════════════════════════════════════════════════════════════════
2) DATA SOURCES — WHAT IS LIVE vs WHAT YOU NEED
═══════════════════════════════════════════════════════════════════

A) PREFERRED (when backend ships — ask API team to confirm on your base):

  GET {API_BASE}/member/membership/current
  Policy: AuthenticatedMember (JWT → AppUser → GymMember — ignore client memberId)
  → MembershipDto (camelCase; tolerate PascalCase)

  Shape (match staff MembershipDto — GMS.Application/DTOs/Memberships/MembershipDto.cs):
  {
    "id": "guid",
    "planName": "Friends Offer",
    "planNameAr": "عرض الصحاب",
    "planType": "monthly_unlimited",   // monthly_unlimited | session_pack | day_pass | …
    "status": "active",                // active|frozen|expired|cancelled|pending|scheduled
    "startDate": "2026-09-01",         // DateOnly YYYY-MM-DD — NO timezone shift
    "endDate": "2026-10-17",
    "sessionsRemaining": null,         // int? — session_pack
    "sessionCount": null,              // int? — pack total when present
    "frozenFromDate": null,
    "frozenUntilDate": null,
    "amountPaid": 0,
    "paymentMethod": "cash",
    "daysRemaining": 43                // SERVER Cairo calendar: EndDate - TodayCairo
  }

  If daysRemaining is missing (older builds): compute client-side (§4).
  Prefer server daysRemaining when present — it uses Egypt (Cairo) business day.

  ALSO acceptable:
  GET {API_BASE}/member/me
  → { currentMembership: MembershipSummaryDto | null, ... }
  MembershipSummaryDto has startDate/endDate/status/plan* but may OMIT daysRemaining.
  Compute days from endDate (§4) when absent.

B) PARTIAL LIVE (not enough for remaining days alone):

  GET {API_BASE}/invitation/summary
  → InvitationQuotaDto:
    { planName, membershipStatus, remaining, total, used, membershipId, ... }
  Use ONLY for status chip + plan name teaser while waiting for §2A.
  Do NOT invent endDate from this DTO.

C) NEVER:

  GET /members/{gymMemberId}/membership
  GET /memberships/{gymMemberId}/current
  GET /members/{id}   ← staff MemberDetailDto

═══════════════════════════════════════════════════════════════════
3) UI — MEMBERSHIP REMAINING CARD
═══════════════════════════════════════════════════════════════════

Widget: MembershipRemainingCard (reuse on Home + Profile)

Layout (one card, surface + 1px border + radius; optional 4px top accent by status):
  ┌─────────────────────────────────────────────┐
  │  [status chip]              Plan name       │
  │                             plan type line  │
  │                                             │
  │  {N} days left          (hero number)       │
  │  Ends {formatted endDate}                   │
  │  ████░░░░  Used {u} of {t} days             │
  │                                             │
  │  (session_pack) Sessions {r} of {total}     │
  └─────────────────────────────────────────────┘

Status chip (one locale):
  active     → Active / نشط          (lime/success)
  frozen     → Frozen / مجمّد        (cyan)
  expired    → Expired / منتهٍ       (danger)
  cancelled  → Cancelled / ملغى      (muted)
  pending    → Waiting for payment / بانتظار الدفع
  scheduled  → Scheduled / مجدول
  none       → No membership / لا توجد عضوية

Copy rules:
  EN: "{n} days left" / "Ends {date}" / "Used {u} of {t} days"
  AR: "{n} يوم متبقٍ" with proper plural (§5) / "تنتهي {date}" / "مستخدم {u} من {t} أيام"
  Do NOT render “days left 43” (number after label looks broken in EN).
  Dates: format with intl for ar_EG / en_GB; wrap date Text in Directionality LTR
  so RTL does not scramble “03 Sep 2026” into “Sept 2026 03”.

Urgency (active / scheduled only):
  daysRemaining > 14  → success (default)
  daysRemaining ≤ 14  → warning
  daysRemaining ≤ 3   → danger
  daysRemaining == 0  → “Ends today” / “تنتهي اليوم” (danger)

State matrix:
  null membership     → empty: “No active membership” / “لا توجد عضوية نشطة”
                         + “Ask reception” / “اسأل الاستقبال”
  pending             → hide days hero; show waiting-for-payment
  frozen              → show “Frozen until {frozenUntilDate}”; do not treat as trainable days
  expired             → daysRemaining = 0; “Expired” + end date; no fake renew API
  cancelled           → cancelled copy; no days countdown
  session_pack active → hero = sessions remaining; still show endDate + days as secondary
  day_pass            → often 0–1 day left; still use same calculator

Progress bar (time-based plans):
  totalDays = max(1, endDate.difference(startDate).inDays)   // DateOnly calendar
  usedDays  = clamp(totalDays - daysRemaining, 0, totalDays)
  usedPct   = usedDays / totalDays
  Label: Used {used} of {total} days

Pull-to-refresh on Home/Profile reloads the membership endpoint.

═══════════════════════════════════════════════════════════════════
4) DAYS REMAINING CALCULATION (when server omits daysRemaining)
═══════════════════════════════════════════════════════════════════

endDate / startDate are DateOnly (YYYY-MM-DD). Never apply timezone shift.

Preferred client algorithm (match backend MembershipDto):
  todayCairo = DateTime.now().toUtc().add(Duration(hours: 3)).  // Africa/Cairo ≈ UTC+3
               then take year/month/day as DateOnly
  OR use package timezone → Africa/Cairo → date only

  daysRemaining = endDate.difference(todayCairo).inDays
  // Backend: EndDate.DayNumber - TodayCairo().DayNumber (may be negative if expired)
  For UI: displayDays = max(0, daysRemaining)

Do NOT use `DateTime.parse(endDate).difference(DateTime.now()).inDays` alone —
local device TZ vs Cairo midnight can be off by 1 day.

If status == expired → force display 0.

═══════════════════════════════════════════════════════════════════
5) ARABIC PLURAL (days)
═══════════════════════════════════════════════════════════════════

Use a small helper (or ICU via intl):
  0 → "تنتهي اليوم" (or "0 يوم متبقٍ" if you keep the number)
  1 → "يوم واحد متبقٍ"
  2 → "يومان متبقيان"
  3–10 → "{n} أيام متبقية"
  11+ → "{n} يوم متبقٍ"

EN:
  0 → "Ends today"
  1 → "1 day left"
  n → "{n} days left"

═══════════════════════════════════════════════════════════════════
6) REPOSITORY / STATE
═══════════════════════════════════════════════════════════════════

MembershipRepository:
  Future<MembershipDto?> getCurrent()
    → GET /member/membership/current
    → on 404: return null (no membership)
    → on 401: logout / re-activate
    → on 403/501/missing route: treat as BackendGap (see §7)

HomeCubit / ProfileCubit:
  load in parallel with other home calls when possible
  states: loading | loaded(membership) | empty | backendGap | error

Caching: OK to cache last successful membership for offline header,
but label stale data (“Updated earlier”) — do not invent newer days.

═══════════════════════════════════════════════════════════════════
7) BACKEND GAP UX (UNTIL /member/membership/current IS LIVE)
═══════════════════════════════════════════════════════════════════

Probe once per session:
  GET /member/membership/current
  If 404 route / HTML ngrok interstitial / unexpected shape → BackendGap

UI when BackendGap:
  - Still show planName + membershipStatus from GET /invitation/summary if available
  - Do NOT show a fake days number
  - Copy: “Days left will appear after your next desk update”
           / “الأيام المتبقية هتظهر بعد تحديث الاستقبال”
  - Log once (debug) that remaining-days API is missing — never spam toasts

When API team ships the route, only the repository path changes — keep the card UI.

Backend ask (minimum):
  GET /api/member/membership/current  AuthenticatedMember
  Return MembershipDto including daysRemaining (Cairo), startDate, endDate, status, planName(Ar)

═══════════════════════════════════════════════════════════════════
8) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] No staff /members/{id}/membership or /memberships/{id}/current in Dio logs
[ ] Member JWT only (member-activate)
[ ] Active membership shows days left + Ends {date} with LTR date
[ ] Urgency colors: >14 / ≤14 / ≤3 / 0
[ ] Frozen shows until-date, not fake “training days left”
[ ] Expired / none / cancelled honest — no invented renew API
[ ] session_pack prioritizes sessions remaining
[ ] Arabic plural forms for days
[ ] AR locale does not scramble date order (dir LTR on dates)
[ ] BackendGap empty state if current-membership route missing
[ ] flutter analyze clean for touched files
[ ] Manual smoke on ngrok: Home card matches staff Member 360 “days left”
```

---

## Quick reference

| Need | Call | Status |
|------|------|--------|
| Remaining days (preferred) | `GET /member/membership/current` → `daysRemaining` + `endDate` | **Ask backend / not live as of 2026-09-04** |
| Profile bundle | `GET /member/me` → `currentMembership` | Phase 2 (not live) |
| Status + plan name only | `GET /invitation/summary` | Live — **no days** |
| Staff current membership | `GET /memberships/{memberId}/current` | **Forbidden** in Member App |
| Staff member detail | `GET /members/{id}` | **Forbidden** |

## Staff visual reference

Staff Member 360 card (`member-detail.js` → `renderMembership`): “**N days left**”, “Ends {date}”, “Used X of Y days”, status badge — mirror that UX with Member App APIs only.

## Task tracking

| Task | Owner |
|------|--------|
| Ship `GET /api/member/membership/current` (+ optional `GET /api/member/me`) with `daysRemaining` | Backend |
| MembershipRemainingCard + Home/Profile wire-up | Flutter |
| Never call staff membership routes | Flutter |
