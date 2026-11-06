# HyMotion — Flutter Member App: Profile & Member Data Hub

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md` (auth, STYLE A API_BASE, JWT `sub`, forbidden staff routes).
> Staff UX reference (read-only inspiration): `Frontend/apps/web/src/app/(dashboard)/members/[id]/member-detail.js` + `index.html`.
> DTO shapes: `GMS.Application/DTOs/Members/MemberDetailDto.cs`, `MemberStoreDtos.cs`, `InvitationQuotaDto.cs`, `MemberActivityDtos.cs`.
> **Attendance 404 fix:** `Frontend/FLUTTER_MEMBER_ATTENDANCE_PROMPT.md` — never call `GET /api/attendance/history` (route does not exist).
>
> **There is no `GET /api/member/me` today.** This prompt defines the full Profile hub UI **and** how to ship Phase 1 with existing member APIs, then wire Phase 2 when backend adds self-read endpoints.

---

```
PROMPT — HyMotion Member App: Profile & all member data (Flutter)
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt REPLACES the minimal “Profile = name + gym + logout” stub in
Frontend/FLUTTER_MEMBER_APP_PROMPT.md section 6 with a **Member 360 hub** —
everything a member is allowed to see about themselves, read-only.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE,
JWT identity (`sub` = Identity user id, NOT GymMember.Id), fonts, and charcoal + lime design.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING)
═══════════════════════════════════════════════════════════════════

Build a **Profile hub** (bottom-nav “Profile” tab) that aggregates:

  A) Identity header     — photo/initials, names EN/AR, member #, contact, join date
  B) Current membership  — plan, status chip, dates, sessions remaining, freeze window (read-only)
  C) Invitations         — quota meter + history (+ deep link to Invite flow)
  D) Attendance          — paginated check-in history (check-in/out times, entry method)
  E) Store orders        — my orders list (+ order detail — reuse Store module)
  F) Class bookings      — my upcoming/past bookings (activity-bookings API)
  G) App settings        — language, theme, gym name, logout
  H) Quick links         — Notifications unread, Offers (if enabled), Check-in CTA

Staff Member 360 (`GET /api/members/{id}` and tabs in member-detail.js) is the **visual reference**
for layout density and field labels — but most of those APIs are **staff-only**.

FORBIDDEN in the Member App (never call, never UI):
- GET/PUT/DELETE /api/members/{id}          (MembersView)
- GET /api/members/{id}/membership|attendance|credits
- GET /api/memberships/{memberId}/current|history
- POST assign / renew / freeze / unfreeze / cancel membership
- GET /api/debtors*, /api/refunds*, POST /api/sales/*/payments
- POST /api/members/{id}/app-activation-code
- GET /api/invitation/members/{memberId}    (staff 360 — use member /summary + /history)
- Edit/archive member, financial collect, staff notifications send-bulk
- Credits ledger, shifts, inventory management

Membership is **display-only**. No commercial actions (renew, freeze, pay balance in app).

═══════════════════════════════════════════════════════════════════
1) STAFF REFERENCE → MEMBER APP MAPPING
═══════════════════════════════════════════════════════════════════

Staff web tabs (member-detail.js)          Member App Profile section
────────────────────────────────────────   ─────────────────────────────
Profile card (MemberDetailDto)           ProfileHeaderSection
  fullName, fullNameAr, memberNumber         ← GET /member/me (Phase 2) or partial Phase 1
  phone, email, dateOfBirth, createdAtUtc
  profilePhotoUrl, invitationQuotaRemaining
  currentMembership (summary)              MembershipSection (read-only)
Tab: Membership                            same — status, plan, dates, sessions, freeze dates
Tab: Invitations                           InvitationsSection — existing APIs
Tab: Attendance                            AttendanceSection — Phase 2 GET /member/attendance; NEVER /attendance/history (see FLUTTER_MEMBER_ATTENDANCE_PROMPT.md)
Tab: Orders (Member App only)              OrdersSection — GET /member/orders (see FLUTTER_MEMBER_ORDERS_PROMPT.md; never staff /member-orders)
Tab: History (membership history)          MembershipHistorySection — Phase 2 API
Financial 360, refunds, collect            OMIT (staff)
Member App activation code                 OMIT (member already activated)
Access barcode / reprint card              OMIT (desk card; optional Phase 2 if /member/me ships)
Edit / archive / notify                    OMIT

Also surface (not staff tabs):
- GET /api/member/activity-bookings        BookingsSection
- GET /api/notifications                   badge + link to Notifications screen
- GET /api/member/offers                   optional “Offers near you” row (see FLUTTER_MEMBER_OFFERS_PROMPT.md)

═══════════════════════════════════════════════════════════════════
2) API SURFACE — WHAT EXISTS TODAY (Phase 1)
═══════════════════════════════════════════════════════════════════

API_BASE ends with `/api`. Paths must NOT repeat `/api`.
Authorization: Bearer {accessToken} on every call.

── Identity (partial — no dedicated profile GET) ──

POST /auth/member-activate → LoginResponse.user { id, email, fullName, role, tenantId, gymCode }
JWT claims: sub, email, tenant_id, gym_code, first_name, last_name, role

Use for header until /member/me exists:
  displayName = user.fullName OR JWT first_name + last_name
  gymCode     = user.gymCode OR JWT gym_code
  email       = user.email OR JWT email

DO NOT treat LoginResponse.user.id or JWT sub as GymMember.Id.

── First GymMember.Id discovery (safe) ──

GET /invitation/summary
Policy: AuthenticatedMember
→ InvitationQuotaDto {
     memberId,          // ← this IS GymMember.Id — cache in ProfileRepository
     membershipId?, planId?, planName?,
     total, used, remaining,
     membershipStatus   // active | frozen | expired | cancelled | pending | none
   }

Use planName + membershipStatus for membership card when /member/me is missing.

── Membership hints from check-in ──

POST /attendance/qr-checkin { gymCode }
→ QrCheckinResponse { planName, planNameAr, sessionsRemaining, checkInAtUtc, ... }

Cache last successful check-in response locally (secure storage or in-memory) to enrich Home + Profile membership chip.

── Invitations ──

GET /invitation/summary   (quota — see above)
GET /invitation/history
→ InvitationHistoryResponse[] { id, name, phoneNumber, status, createdAtUtc, contactedAtUtc?, convertedAtUtc? }
  status: new | contacted | interested | not_interested | converted

POST /invitation/send { name, phoneNumber, nationalId?, notes? }  (from Invite screen, not Profile edit)

── Store orders (feature-gated: inventory) ──

Preferred (isolation SoT — see FLUTTER_MEMBER_ORDERS_PROMPT.md + docs/api/MEMBER_ORDERS_ISOLATION.md):
GET /member/orders → MemberOrderListItemDto[]
GET /member/orders/{id} → MemberOrderDto

Legacy aliases (same service; OK if already wired — migrate to /member/orders):
GET /member-store/orders → MemberOrderListItemDto[]
GET /member-store/orders/{id} → MemberOrderDto

FORBIDDEN from Member App: GET /member-orders (staff inbox — all gym members)

── Class bookings ──

GET /member/activity-bookings → MemberBookingDto[]
  { id, sessionId, status, quotaConsumed, activityId, activityName, activityKind,
    startsAtUtc, endsAtUtc, coachName?, createdAtUtc, cancelledAtUtc?, checkedInAtUtc?, quotaRemaining? }

── Notifications (badge only in Profile) ──

GET /notifications?page=1&pageSize=1  → use totalCount or first-page unread for badge
POST /notifications/{id}/read

── Occupancy / Offers (optional profile rows) ──

GET /member/occupancy   — gym name AR/EN for header subtitle
GET /member/offers      — “{n} offers” teaser row

═══════════════════════════════════════════════════════════════════
3) BACKEND GAPS — Phase 2 endpoints (coordinate with backend team)
═══════════════════════════════════════════════════════════════════

Implement ProfileRepository with an interface so Phase 2 is a swap, not a rewrite.

Recommended new routes (AuthenticatedMember; resolve GymMember via sub → AppUser → GymMember.AppUserId):

── GET /member/me ──
Returns a **member-safe** subset of MemberDetailDto (no staff notes edit, no MemberApp activation secrets):

{
  "id": guid,
  "memberNumber": string,
  "fullName": string,
  "fullNameAr": string,
  "phone": string,
  "email": string,
  "dateOfBirth": "YYYY-MM-DD",
  "profilePhotoUrl": string | null,   // relative /uploads/... — resolve like product photos
  "isActive": bool,
  "invitationQuotaRemaining": int,
  "referralCode": string | null,
  "successfulReferralCount": int,
  "referralTier": string | null,
  "createdAtUtc": string,
  "currentMembership": MembershipSummaryDto | null,
  "recentAttendance": AttendanceSummaryDto[]   // last 5 — optional convenience
}

MembershipSummaryDto:
  id, planName, planNameAr, planType, status, startDate, endDate,
  sessionsRemaining?, frozenFromDate?, frozenUntilDate?, amountPaid, paymentMethod

AttendanceSummaryDto:
  id, checkInAtUtc, checkOutAtUtc?, entryMethod

── GET /member/membership/current ──
Same shape as staff GET /memberships/{memberId}/current but scoped to JWT member.
Use when currentMembership on /member/me is null but a covering plan exists (frozen/pending).

── GET /member/membership/history?page=1&pageSize=20 ──
Paged past memberships (read-only list for History section).

── GET /member/attendance?page=1&pageSize=20 ──
Paged attendance for self (same fields as AttendanceSummaryDto + totalCount pagination).

FORBIDDEN dead path (Flutter already hit this — HTTP 404):
  GET /attendance/history   ← does not exist; remove from Dio clients immediately
  See FLUTTER_MEMBER_ATTENDANCE_PROMPT.md for migration + empty-state UX.

Until Phase 2 ships:
- Show honest empty states (“Membership details will appear after your next visit” / AR equivalent)
- Attendance: empty or local cache of successful qr-checkin only — never staff /members/{id}/attendance
- Do NOT call staff URLs with guessed memberId
- Do NOT block Profile tab — render Phase 1 sections that work (invitations, orders, bookings, settings)

═══════════════════════════════════════════════════════════════════
4) UTC / TIME DISPLAY (Egypt UTC+3)
═══════════════════════════════════════════════════════════════════

API timestamps are UTC ISO strings; many omit trailing `Z`.
Always parse as UTC then display in **Africa/Cairo** local time for:
  checkInAtUtc, checkOutAtUtc, createdAtUtc, session startsAtUtc, order createdAtUtc.

Flutter: use `DateTime.parse` only after appending `Z` when missing, or `DateTime.parse(...).toUtc()`.
Display with `timezone` package or `intl` + fixed offset +3 if package not added yet.

Date-only fields (dateOfBirth, startDate, endDate): render as calendar dates — no timezone shift.

═══════════════════════════════════════════════════════════════════
5) UI — Profile hub structure
═══════════════════════════════════════════════════════════════════

Route: /profile (authenticated shell tab index 4 or 5 depending on Store visibility)

┌─────────────────────────────────────┐
│  [Avatar / photo]                   │
│  Full Name (locale picks EN or AR)   │
│  Secondary name (other locale)      │
│  #MemberNumber · Gym name           │
│  [Membership status chip]           │
├─────────────────────────────────────┤
│  ▼ Membership (expandable card)     │
│     Plan name, dates, progress bar  │
│     Sessions remaining (if session) │
│     Frozen until (if frozen)        │
├─────────────────────────────────────┤
│  ▼ Invitations                      │
│     Quota ring: remaining / total   │
│     [Invite a friend] → /invitations│
│     Last 3 history rows + “See all” │
├─────────────────────────────────────┤
│  ▼ Attendance                       │
│     Paginated list OR recent 5      │
│     Row: date, check-in, duration   │
├─────────────────────────────────────┤
│  ▼ My orders (if inventory enabled) │
│     Reuse MemberOrderListItem cards │
├─────────────────────────────────────┤
│  ▼ My class bookings                │
│     Upcoming first, then past       │
│     Tap → booking detail / cancel   │
├─────────────────────────────────────┤
│  Settings                           │
│     Language AR | EN                │
│     Theme Light | Dark | System     │
│     Notifications → /notifications  │
│     Offers → /offers (if feature on)│
│     Log out                         │
└─────────────────────────────────────┘

Pull-to-refresh refreshes all sections in parallel (Future.wait).
Use shimmer skeletons per section; failed section shows inline retry — do not fail whole screen.

Profile photo:
- If profilePhotoUrl relative (`/uploads/...`), resolve to API **origin without /api** (same rule as product photos — FLUTTER_MEMBER_PRODUCT_PHOTOS_PROMPT.md).
- Fallback: initials avatar on lime-tinted circle.

Membership status chips (match staff web colors):
  active → green   expired → red   frozen → cyan
  pending → amber  cancelled → gray  none → neutral

Contact rows:
  phone → url_launcher tel:
  email → mailto: (if present)

═══════════════════════════════════════════════════════════════════
6) ARCHITECTURE (Flutter)
═══════════════════════════════════════════════════════════════════

Packages: same as FLUTTER_MEMBER_APP_PROMPT.md (bloc/cubit, dio, go_router, secure_storage).

Suggested structure:

lib/features/profile/
  data/profile_repository.dart          // abstract
  data/profile_repository_impl.dart     // Phase 1 aggregate + Phase 2 /member/me
  data/models/member_profile_view.dart  // UI aggregate (not necessarily 1:1 API)
  presentation/profile_cubit.dart
  presentation/profile_screen.dart
  presentation/widgets/                 // section widgets

ProfileRepository.getProfile() returns MemberProfileView built from:
  Phase 2: GET /member/me (+ optional parallel /membership/current)
  Phase 1: combine AuthSession + GET /invitation/summary + cached QrCheckin + GET /member/occupancy (gym names)

Cache memberId from invitation/summary in secure storage key `gfp_member_id` after first successful fetch.
Never derive memberId from JWT sub.

Section loaders (can lazy-load on expand):
  loadInvitations()  → summary + history take 5
  loadOrders()         → member-store/orders
  loadBookings()       → member/activity-bookings
  loadAttendance()     → Phase 2 /member/attendance OR recentAttendance from /member/me

Error handling:
  { "error": "..." } and ProblemDetails { title, detail } — map to AR/EN snackbars.
  403 FEATURE_DISABLED on store → hide orders section.

═══════════════════════════════════════════════════════════════════
7) DTO REFERENCE (camelCase; accept PascalCase defensively)
═══════════════════════════════════════════════════════════════════

InvitationQuotaDto — see section 2.
InvitationHistoryResponse — see section 2.
MemberOrderListItemDto — id, orderNumber, status, total, currency, lineCount, createdAtUtc.
MemberBookingDto — see section 2.
NotificationDto — id, title, titleAr, body, bodyAr, channel, sentAt, isRead.

Order status display (member-store): submitted | accepted | ready | completed | rejected | cancelled
Booking status: booked | checked_in | cancelled | cancelled_late | no_show (confirm from API strings)

═══════════════════════════════════════════════════════════════════
8) DESIGN (match HyMotion — do not invent themes)
═══════════════════════════════════════════════════════════════════

Brand: charcoal #0D0D0D + lime CTA #7ACC00 + teal accent #148F8F
Fonts: Space Grotesk (headings) + IBM Plex Sans + IBM Plex Sans Arabic
Light bg #FAFAFA / surface #FFFFFF; section cards with subtle border #EBEBEB, radius 16
Profile header: dark charcoal band OR white card with lime accent underline — stay consistent with Home.

FORBIDDEN: Inter/Roboto defaults, purple gradients, navy+#E94560 gym-dark packs.

═══════════════════════════════════════════════════════════════════
9) NAVIGATION INTEGRATION
═══════════════════════════════════════════════════════════════════

Update bottom nav Profile tab from settings-only to this hub.

Deep links:
  /profile → full hub
  /profile/orders → scroll to orders section
  /profile/bookings → scroll to bookings section

From Home membership card → push /profile with membership section expanded.

Invitations “Invite a friend” → existing InvitationsScreen (POST /invitation/send).
Order row tap → existing OrderDetailScreen.
Booking row tap → existing booking detail / cancel flow (FLUTTER_MEMBER_ACTIVITIES_PROMPT.md).

═══════════════════════════════════════════════════════════════════
10) ACCEPTANCE CHECKLIST
═══════════════════════════════════════════════════════════════════

[ ] Profile tab loads without calling staff /api/members/* or /api/memberships/*
[ ] GymMember.Id sourced only from GET /invitation/summary (or Phase 2 /member/me) — never JWT sub
[ ] Membership section read-only; status chip from summary.membershipStatus + planName
[ ] Invitations quota + history visible; Invite CTA navigates to send flow
[ ] Orders section uses GET /member-store/orders only; hidden when inventory disabled
[ ] Bookings section uses GET /member/activity-bookings
[ ] Attendance: Phase 2 API wired OR empty state — no staff attendance URL
[ ] UTC timestamps displayed in Cairo local time
[ ] profilePhotoUrl resolved correctly (no /api/uploads 404)
[ ] Language + theme + logout work; pull-to-refresh updates sections
[ ] Phase 2: ProfileRepository switches to GET /member/me without UI rewrite
[ ] AR + EN + RTL; bilingual API fields (fullNameAr, planNameAr, titleAr)
[ ] flutter analyze clean; Android + iOS

═══════════════════════════════════════════════════════════════════
11) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. ProfileRepository interface + Phase 1 aggregate (auth + invitation/summary + occupancy)
2. ProfileScreen shell + header + membership card (partial data OK)
3. Invitations section (summary + history preview)
4. Orders + Bookings sections (reuse existing store/activities repositories if present)
5. Settings block + logout
6. Attendance section stub → wire GET /member/attendance when backend ships
7. Phase 2: GET /member/me + membership/history; replace partial header/membership/attendance
8. Polish: shimmer, empty states, pull-to-refresh, profile photo, deep links

If backend can prioritize one endpoint, ship GET /member/me first — it unlocks header, membership, and recent attendance in one round trip.
```

---

## Quick reference (for humans)

| Profile section | Phase 1 (today) | Phase 2 (backend) |
|-----------------|-----------------|-------------------|
| Header (name, #, contact) | LoginResponse + JWT; partial | `GET /api/member/me` |
| Membership | `GET /invitation/summary` + cached QR check-in | `/member/me` or `/member/membership/current` |
| Invitations | `GET /invitation/summary` + `/history` | same |
| Attendance | Empty / recent from `/member/me` when available | `GET /api/member/attendance` |
| Orders | `GET /api/member-store/orders` | same |
| Bookings | `GET /api/member/activity-bookings` | same |
| Membership history | Empty state | `GET /api/member/membership/history` |
| Settings | Local prefs + logout | same |

**Staff reference:** `apps/web/src/app/(dashboard)/members/[id]/member-detail.js` — Member 360 tabs: Membership, Invitations, Attendance, Orders, History.

**Master app prompt:** `FLUTTER_MEMBER_APP_PROMPT.md` — update Profile bullet to point here.
