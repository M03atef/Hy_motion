# HyMotion — Flutter Member App: Activity Quotas + Gym Plans + Activity Details

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: [`FLUTTER_MEMBER_APP_PROMPT.md`](FLUTTER_MEMBER_APP_PROMPT.md)  
> Profile hub: [`FLUTTER_MEMBER_PROFILE_PROMPT.md`](FLUTTER_MEMBER_PROFILE_PROMPT.md)  
> Classes (session browse): [`FLUTTER_MEMBER_CLASSES_PROMPT.md`](FLUTTER_MEMBER_CLASSES_PROMPT.md)  
> Brand: **HyMotion** (do not show GymFlowPro)
>
> **LIVE today**
> - Activity catalog + eligibility/quota: `GET /api/member/activity-bookings/activities`
> - Class session list/detail: `GET /api/member/classes`, `GET /api/member/classes/{sessionId}`
>
> **NOT for Member App (staff-only — never call)**
> - `GET /api/membership-plans` (`plans.manage`)
> - `GET /api/members/{id}` / memberships staff routes
>
> **Gym Plans catalog for Member App** needs member-scoped APIs (see §3). Until those are confirmed live on your API base, show an honest empty / “Ask reception for plans” state — do **not** call staff plan endpoints.

---

```
PROMPT — HyMotion Member App: Profile Activity Quotas + Gym Plans + Activity Details
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.
Brand name in UI: HyMotion (never GymFlowPro; never translate the brand).

This prompt ADDS three related read-mostly surfaces:
  A) Profile → Activity quotas (what the member’s plan still includes)
  B) Activities catalog + activity details (classes & facilities visible to members)
  C) Gym Plans browse + plan details (what this gym sells — if member plans API is live)

It does NOT replace auth, QR check-in, occupancy, invitations, orders, or offers.
It does NOT invent staff workflows (assign plan, renew, freeze, desk booking payment).

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE
(API_BASE ends with `/api`; paths must NOT repeat `/api`), Member JWT (member-activate),
fonts (Cairo), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING)
═══════════════════════════════════════════════════════════════════

OWN (build):
- Profile section: “Activities / الأنشطة” showing quota meters for entitled activities
- Activities tab/screen: list of visible activities (class + facility) with eligibility chips
- Activity detail: name EN/AR, description, kind, bookingRequired, drop-in price, eligibility/quota
- Plans tab/screen (when API live): list of this gym’s active membership plans + plan detail
  (price, duration, entitlements summary) — READ-ONLY “browse”
- Deep link from quota row → activity detail
- Deep link from plan entitlement row → activity detail (by activityId)

FORBIDDEN:
- GET/POST/PUT/DELETE /api/membership-plans*          (staff plans.manage)
- GET /api/members/{id}* , /api/memberships/{id}/*    (staff)
- Assign / renew / freeze / pay for a plan from the Member App
- Fake “Buy plan” / payment checkout unless a separate Product Accept exists
- POST book/cancel on Classes browse flow if Classes is reception-first
  (see FLUTTER_MEMBER_CLASSES_PROMPT.md — visit reception to book/pay)
- Using JWT `sub` as GymMember.Id
- Inventing quota numbers client-side

Reception-first rule for CLASSES (sessions):
  Member App shows info; booking/payment happens at desk unless Product later enables
  online book. Do not add a Book button that calls the API unless product explicitly
  switches Classes to online booking.

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
2) A) PROFILE → ACTIVITY QUOTAS  (LIVE)
═══════════════════════════════════════════════════════════════════

Source of truth (LIVE):
  GET {API_BASE}/member/activity-bookings/activities
  Policy: AuthenticatedMember
  → MemberActivityDto[]

MemberActivityDto (camelCase; tolerate PascalCase):
{
  "id": "guid",
  "name": "Yoga",
  "nameAr": "يوغا",
  "description": "...",
  "descriptionAr": "...",
  "kind": "class",                 // "class" | "facility"
  "bookingRequired": true,
  "dropInPrice": 150.00,           // nullable
  "eligibility": "limited",        // included | limited | unlimited | drop_in | not_entitled
  "quotaRemaining": 3,             // set when eligibility == limited; else null
  "quotaLimit": 8                  // set when eligibility == limited; else null
}

Profile UI — “My activity credits / رصيد الأنشطة”:
1) Call GET /member/activity-bookings/activities on Profile open + pull-to-refresh.
2) Show cards ONLY for eligibility in { included, limited, unlimited }.
   (Optional secondary list for drop_in / not_entitled — or hide them on Profile.)
3) Display rules:
   - limited:   “3 of 8 left” / “متبقي 3 من 8”  (use quotaRemaining + quotaLimit)
   - unlimited: “Unlimited” / “غير محدود”
   - included:  “Included” / “مشمول”
4) Tap row → Activity Detail (same id).
5) Empty entitled list:
   EN: “No class credits on your current plan. Ask reception about plans.”
   AR: “لا يوجد رصيد حصص على خطتك الحالية. اسأل الاستقبال عن الباقات.”
6) Errors: 401 → re-auth; 400 profile not linked → friendly message; never raw DioError.

Do NOT call staff MemberDetailDto / membership ActivityQuotas endpoints.

═══════════════════════════════════════════════════════════════════
3) B) ACTIVITIES CATALOG + ACTIVITY DETAILS  (LIVE)
═══════════════════════════════════════════════════════════════════

── Catalog ──
Same endpoint as quotas:
  GET {API_BASE}/member/activity-bookings/activities

Screen: Activities / الأنشطة
- Filter chips: All | Classes | Facilities (kind)
- Row: bilingual name (locale), eligibility chip, quota Remaining/Limit if limited,
  drop-in price if dropInPrice != null (informational “from EGP X”)
- Pull-to-refresh
- Empty: “No activities yet” / “لا توجد أنشطة بعد”

── Activity detail (by activityId) ──
There is NO separate GET /member/activities/{id} today.
Implementation:
  1) From catalog response, find dto where id == activityId (cache list in Cubit/repo).
  2) If missing (cold deep link): refetch GET .../activities then find, or show Not found.
  3) Detail layout:
     - Title: name / nameAr by locale
     - Kind badge (class / facility)
     - Description EN/AR by locale
     - Booking required yes/no
     - Eligibility + quota meter (same rules as Profile)
     - Drop-in price if any (info only — “Pay at reception”)
     - CTA (informational): “Visit reception to book” / “احجز من الاستقبال”
     - If kind == class: secondary CTA “Upcoming sessions” → Classes list filtered by
       GET /member/classes?activityId={id}  (see FLUTTER_MEMBER_CLASSES_PROMPT.md)

── Class SESSION detail (already live — different id) ──
  GET {API_BASE}/member/classes/{sessionId}
  sessionId = MemberClassListItemDto.id (NOT activityId)
  Use for “this Tuesday 6pm Yoga” detail — trainer, seats, Cairo schedule.
  Do not confuse Activity.id with ActivitySession.id.

FORBIDDEN for this browse UX (unless Product later enables online book):
  POST /member/activity-bookings/sessions/{id}/book
  PUT  /member/activity-bookings/{id}/cancel

═══════════════════════════════════════════════════════════════════
4) C) GYM PLANS LIST + PLAN DETAILS
═══════════════════════════════════════════════════════════════════

STAFF ENDPOINTS ARE FORBIDDEN:
  GET /membership-plans
  GET /membership-plans/{id}
  (require plans.manage — Member JWT will 403; do not use)

Member-scoped plans API (required for this screen):

  GET {API_BASE}/member/plans
  GET {API_BASE}/member/plans/{id}
  Policy: AuthenticatedMember
  Active plans for the current gym (tenant) only — read-only catalog.

Expected list item (MemberPlanListItemDto):
{
  "id": "guid",
  "name": "Gold Monthly",
  "nameAr": "ذهبي شهري",
  "planType": "monthly_unlimited",
  "price": 1200,
  "currency": "EGP",
  "durationDays": 30,
  "sessionCount": null,
  "referralInviteQuota": 3
}

Expected detail (MemberPlanDetailDto):
{
  "id": "guid",
  "name": "...",
  "nameAr": "...",
  "description": "...",
  "descriptionAr": "...",
  "planType": "...",
  "price": 1200,
  "currency": "EGP",
  "durationDays": 30,
  "sessionCount": null,
  "timeRestrictionStart": null,   // "HH:mm:ss" or null
  "timeRestrictionEnd": null,
  "referralInviteQuota": 3,
  "entitlements": [
    {
      "activityId": "guid",
      "activityName": "Yoga",
      "activityNameAr": "يوغا",
      "activityKind": "class",
      "accessMode": "limited",     // included | limited | unlimited
      "quotaLimit": 8,
      "quotaPeriod": "cairo_month" // cairo_month | membership | one_time | monthly
    }
  ]
}

BEFORE wiring Plans UI:
  1) Hit GET /member/plans with Member JWT on your API_BASE.
  2) If 404 → API not shipped yet:
       - Show empty state: “Plans catalog coming soon. Ask reception.” /
         “باقات الصالة قريباً. اسأل الاستقبال.”
       - Do NOT fall back to /membership-plans
  3) If 200 → build:
       - Plans list: name, price EGP, duration days, planType chip
       - Plan detail: description, price, duration, invite quota, entitlements list
       - Tap entitlement → Activity detail by activityId
       - Footer: “To subscribe, visit reception” / “للاشتراك، زر الاستقبال”
       - NO buy/pay buttons

If backend ships a slightly different field set, map defensively (null-safe) —
do not invent price/entitlements client-side.

═══════════════════════════════════════════════════════════════════
5) NAV / INFORMATION ARCHITECTURE
═══════════════════════════════════════════════════════════════════

Suggested IA (adapt to existing bottom nav):
  Home | Classes | Activities | (Plans) | Profile

Profile sections order (extend existing hub):
  Identity → Membership (read-only) → Activity quotas → Invitations → Attendance → Orders → Settings

Routes (go_router examples):
  /activities
  /activities/:activityId
  /plans
  /plans/:planId
  /classes                     (existing)
  /classes/:sessionId          (existing — session id)

═══════════════════════════════════════════════════════════════════
6) i18n (EN + AR) — brand stays HyMotion
═══════════════════════════════════════════════════════════════════

Keys (examples):
  activities.title / activities.empty / activities.quotaLeft
  activities.eligibility.included|limited|unlimited|drop_in|not_entitled
  activities.visitReception
  plans.title / plans.empty / plans.askReception / plans.subscribeAtDesk
  profile.activityCredits

eligibility / accessMode labels must be translated; product brand must not.

═══════════════════════════════════════════════════════════════════
7) STATE / REPOSITORY
═══════════════════════════════════════════════════════════════════

ActivitiesRepository:
  Future<List<MemberActivity>> listActivities();
  MemberActivity? findCached(String activityId);

PlansRepository (only when GET /member/plans returns 200):
  Future<List<MemberPlan>> listPlans();
  Future<MemberPlanDetail> getPlan(String id);

Reuse one Dio client + auth interceptor from the app shell.
Cache activities list in memory for Profile quotas + Activity detail (TTL ~45s OK).

═══════════════════════════════════════════════════════════════════
8) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] Profile shows activity quotas from GET /member/activity-bookings/activities only
[ ] Limited shows remaining/limit; unlimited/included show correct labels
[ ] Activities list filters by kind; detail shows bilingual copy + eligibility
[ ] Class session detail uses /member/classes/{sessionId} (not activityId)
[ ] Never calls /membership-plans or /members/{id}
[ ] Plans screen: either live /member/plans OR honest empty — never staff API
[ ] No Buy/Pay/Book that hits payment or book endpoints (unless Product Accept says otherwise)
[ ] EN + AR; HyMotion brand; RTL when AR
[ ] flutter analyze clean for touched files
[ ] Manual: Profile quotas → activity detail → (optional) classes for that activity
[ ] Manual: Plans list → plan detail → entitlement → activity (when plans API live)
```

---

## Quick reference

| Feature | Member API | Status |
|---------|------------|--------|
| Profile activity quotas | `GET /member/activity-bookings/activities` | **Live** |
| Activities list/detail | same list (detail = find by id) | **Live** |
| Class session detail | `GET /member/classes/{sessionId}` | **Live** |
| Gym plans catalog | `GET /member/plans`, `GET /member/plans/{id}` | **Confirm on API** — do not use staff `/membership-plans` |
| Book/pay online | — | Out of scope (reception-first) |

## Backend follow-up (if plans 404)

Ship AuthenticatedMember:

- `GET /api/member/plans` → active tenant plans (member-safe fields)
- `GET /api/member/plans/{id}` → detail + entitlements (no staff membership counts)

Reuse `MembershipPlanService` read paths; strip `ActiveMemberships` / `TotalMemberships`.
