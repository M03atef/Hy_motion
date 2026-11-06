# HyMotion — Flutter Member App: Membership (Remaining Days + Freeze) + Plans + Gym Identity

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: [`FLUTTER_MEMBER_APP_PROMPT.md`](FLUTTER_MEMBER_APP_PROMPT.md)  
> Related: [`FLUTTER_MEMBER_SUBSCRIPTION_REMAINING_PROMPT.md`](FLUTTER_MEMBER_SUBSCRIPTION_REMAINING_PROMPT.md) · [`FLUTTER_MEMBER_QUOTAS_PLANS_ACTIVITIES_PROMPT.md`](FLUTTER_MEMBER_QUOTAS_PLANS_ACTIVITIES_PROMPT.md) · [`FLUTTER_MEMBER_PROFILE_PROMPT.md`](FLUTTER_MEMBER_PROFILE_PROMPT.md) · [`FLUTTER_MEMBER_OCCUPANCY_PROMPT.md`](FLUTTER_MEMBER_OCCUPANCY_PROMPT.md)
>
> **Brand split (critical)**
> - **HyMotion** = product / app name (launcher, About, store listing). Keep it.
> - **Gym Identity** = THIS tenant’s gym (e.g. “Fitness Hub” / “فيتـنيس هب”) — logo, colors, contact. **This is what members should see as “their gym”**, not HyMotion and not a hard-coded system name.
>
> **LIVE today (partial)**
> | Need | API | Notes |
> |------|-----|--------|
> | Gym name (partial) | `GET /api/member/occupancy` → `gymName`, `gymNameAr` | No logo/colors |
> | Plan name + status (partial) | `GET /api/invitation/summary` | No `endDate` / days |
> | Sessions hint | `POST /api/attendance/qr-checkin` | `planName`, `sessionsRemaining` |
>
> **NOT LIVE for Member App (backend must ship — see §8)**
> | Need | Required member API |
> |------|---------------------|
> | Remaining days + freeze window | `GET /api/member/membership/current` |
> | Self-service freeze / unfreeze | `POST /api/member/membership/freeze`, `POST /api/member/membership/unfreeze` |
> | Browse gym plans | `GET /api/member/plans`, `GET /api/member/plans/{id}` |
> | Full Gym Identity | `GET /api/member/gym` (or `/member/branding`) |
>
> **FORBIDDEN (staff — never call with Member JWT)**
> - `POST /api/members/{id}/freeze` · `POST /api/members/{id}/unfreeze`
> - `GET /api/members/{id}*` · `GET /api/memberships/{memberId}/*`
> - `GET /api/membership-plans*` · `GET /api/settings` · `GET /api/settings/branding` (staff)

---

```
PROMPT — HyMotion Member App: Remaining Days + Freeze + Plans Catalog + Gym Identity
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

Product brand in launcher / About: HyMotion (never GymFlowPro; never translate HyMotion).
Gym chrome in the app (Home header, splash after login, Profile “My gym”): Gym Identity
from THIS tenant — gymName / gymNameAr / logo / colors — NEVER hard-code “HyMotion”
or “GymFlowPro” as the member’s gym name.

This prompt ADDS / wires four surfaces:
  A) Membership card — remaining days + honest frozen/expired states
  B) Self-service Freeze / Unfreeze (when member freeze API is live)
  C) Plans catalog — read-only browse of this gym’s plans
  D) Gym Identity — show the gym’s name/logo/colors everywhere “my gym” appears

It does NOT invent staff Assign / Renew / Cancel / Collect payment.
It does NOT call staff routes with a Member JWT.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE
(API_BASE ends with `/api`; paths must NOT repeat `/api`), Member JWT
(member-activate only), fonts (Cairo), charcoal #0D0D0D + lime #7ACC00 as platform
defaults — Gym Identity may tint primary CTA with tenant PrimaryColor when present.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING)
═══════════════════════════════════════════════════════════════════

OWN (build):
- Home + Profile membership card: plan name (locale), status, days remaining, end date
- Freeze membership from Profile (confirm sheet → until-date + optional reason)
- Unfreeze when status == frozen (if API allows self-unfreeze)
- Plans tab/list: active plans for THIS gym — price, duration, entitlements (read-only)
- App shell gym chrome: logo + gymName (locale) from Gym Identity, not platform brand

FORBIDDEN:
- POST /members/{id}/freeze|unfreeze
- GET /members/{id}* , GET /memberships/{memberId}/*
- GET /membership-plans* , GET /settings , GET /settings/branding
- Buy / pay / assign / renew / cancel plan from the app (reception-first)
- Using JWT `sub` as GymMember.Id
- Dual EN/AR in one label (“Active / نشط”)
- Showing “HyMotion” as the gym title in Home/Profile header

Reception-first still applies for: new plan purchase, renew, cancel, desk payment.

═══════════════════════════════════════════════════════════════════
1) STYLE A HTTP
═══════════════════════════════════════════════════════════════════

API_BASE example: https://<host>/api
Auth on every authenticated call:
  Authorization: Bearer <member JWT>
  Accept: application/json
  ngrok-skip-browser-warning: true   (when using ngrok)

WRONG:  API_BASE ".../api" + path "/api/member/..."
RIGHT:  path "/member/..."

═══════════════════════════════════════════════════════════════════
2) A) GYM IDENTITY — show THIS gym, not the system name
═══════════════════════════════════════════════════════════════════

Members must feel they are inside THEIR gym (Fitness Hub / فيتنس هب), not a generic
platform shell.

── Preferred (when backend ships) ──

  GET {API_BASE}/member/gym
  // alias OK: /member/branding
  Policy: AuthenticatedMember
  → MemberGymIdentityDto:
  {
    "gymName": "Fitness Hub",
    "gymNameAr": "فيتـنيس هب",
    "shortName": "FH",
    "logoUrl": "https://.../uploads/logos-.../logo.png",  // nullable
    "primaryColor": "#7ACC00",
    "secondaryColor": "#148F8F",
    "accentColor": "#A0E040",
    "phoneNumber": "...",     // optional
    "address": "..."          // optional
  }

Wire into:
  - Splash / post-login Home app bar title = gymName (locale)
  - Profile → “My gym / ناديي” card: logo + name + optional phone/address
  - Optional: ThemeExtension primary from primaryColor (fallback #7ACC00)
  - Cache in secure storage / memory for offline header (TTL ok ~1h)

── LIVE fallback until /member/gym ships ──

  GET {API_BASE}/member/occupancy
  → GymOccupancyDto includes gymName + gymNameAr (NO logo/colors)

  Use gymName/gymNameAr for titles NOW.
  Show a muted placeholder avatar (gym initials) until logoUrl exists.
  Do NOT call GET /settings or /settings/branding (staff).

── Branding rules ──

  Locale AR → prefer gymNameAr, fallback gymName
  Locale EN → prefer gymName, fallback gymNameAr
  Platform product name “HyMotion” stays ONLY on About / store / legal
  Never paint “HyMotion — Fitness Hub” as a dual slash title — pick one job per surface:
    App bar = Gym Identity; About footer = “Powered by HyMotion” (optional, quiet)

═══════════════════════════════════════════════════════════════════
3) B) MEMBERSHIP — remaining days (Home + Profile)
═══════════════════════════════════════════════════════════════════

── Preferred ──

  GET {API_BASE}/member/membership/current
  Policy: AuthenticatedMember (resolve GymMember from JWT — ignore any client memberId)
  → MembershipDto (camelCase; tolerate PascalCase):

  {
    "id": "guid",
    "planName": "Gold Monthly",
    "planNameAr": "ذهبي شهري",
    "planType": "monthly_unlimited",
    "status": "active",
    "startDate": "2026-09-01",
    "endDate": "2026-10-17",
    "sessionsRemaining": null,
    "sessionCount": null,
    "frozenFromDate": null,
    "frozenUntilDate": null,
    "amountPaid": 0,
    "paymentMethod": "cash",
    "daysRemaining": 40
  }

Prefer SERVER daysRemaining (Cairo calendar).
If omitted: daysRemaining = endDate − TodayCairo (DateOnly; no TZ shift).
Display days = max(0, daysRemaining).

── LIVE partial (not enough alone) ──

  GET /invitation/summary → planName + membershipStatus only
  POST /attendance/qr-checkin → planName + sessionsRemaining
  Do NOT invent endDate from these.

── UI: MembershipRemainingCard ──

  [status chip]     Plan name (locale)
                    plan type line
  {N} days left     (hero)   — or sessions for session_pack
  Ends {endDate}    (LTR Directionality on date text)
  progress: Used {u} of {t} days

  Status chips (one locale):
    active → Active / نشط
    frozen → Frozen / مجمّد
    expired → Expired / منتهٍ
    cancelled → Cancelled / ملغى
    pending → Waiting for payment / بانتظار الدفع
    none → No membership / لا توجد عضوية

  Frozen: show “Frozen until {frozenUntilDate}” — do NOT treat as trainable days left.
  Expired / none / cancelled: honest empty + “Ask reception” — no fake renew API.
  session_pack: hero = sessions remaining; days secondary.
  Urgency (active only): >14 success · ≤14 warning · ≤3 danger · 0 “Ends today”.

  Arabic day plurals:
    1 → يوم واحد متبقٍ · 2 → يومان متبقيان · 3–10 → {n} أيام متبقية · 11+ → {n} يوم متبقٍ

═══════════════════════════════════════════════════════════════════
4) C) FREEZE / UNFREEZE FROM THE MEMBER APP
═══════════════════════════════════════════════════════════════════

Staff freeze today is POST /members/{id}/freeze (permission memberships.freeze).
Member App MUST NOT call that.

── Required member APIs (backend ask — §8) ──

  POST {API_BASE}/member/membership/freeze
  Body:
  {
    "frozenUntil": "2026-09-20",   // DateOnly YYYY-MM-DD preferred
    "reason": "Travel"             // optional, max ~200
  }
  Behavior (match staff MemberService.FreezeMembershipAsync):
    - Only when current membership status == active
    - frozenUntil must be AFTER today (Cairo)
    - Sets status=frozen, FrozenFromDate=today, FrozenUntilDate=frozenUntil
    - EXTENDS EndDate by freeze day count (member keeps paid days)
  Success 200:
  {
    "message": "...",
    "messageAr": "...",
    "membership": { /* MembershipDto after freeze */ }
  }
  Errors: 400 no active membership / date in past / already frozen

  POST {API_BASE}/member/membership/unfreeze
  Body: empty
  Behavior: frozen → active; clear freeze dates (match staff unfreeze rules)
  Only when status == frozen

── Flutter UI ──

  Profile → Membership card actions:
    If status == active AND freeze API live:
      Button “Freeze membership / تجميد العضوية”
      → bottom sheet:
         - Date picker (min = tomorrow Cairo; max = reasonable e.g. +90 days or gym policy)
         - Optional reason field
         - Confirm copy: “Your membership will pause until {date}. Expiry will be extended.”
                        / “هتتوقف عضويتك لحد {date}. تاريخ الانتهاء هيتأجل.”
         - Confirm → POST freeze → refresh membership card
    If status == frozen AND unfreeze API live:
      Button “Resume / إلغاء التجميد” → confirm → POST unfreeze

  While freeze APIs return 404 / BackendGap:
    Hide Freeze/Unfreeze buttons entirely (do not show disabled dead CTAs).
    Status chip still shows frozen if invitation/summary or membership DTO says so.
    Copy: freeze requests go through reception until self-service ships.

  NEVER:
    - Send GymMember.Id in the path (server resolves from JWT)
    - Call staff freeze with a guessed member id
    - Allow freeze when status != active

═══════════════════════════════════════════════════════════════════
5) D) PLANS CATALOG (read-only)
═══════════════════════════════════════════════════════════════════

FORBIDDEN: GET /membership-plans (staff plans.manage → 403 for Member JWT)

  GET {API_BASE}/member/plans
  GET {API_BASE}/member/plans/{id}
  Policy: AuthenticatedMember
  Active plans for current tenant only.

List item:
  { id, name, nameAr, planType, price, currency, durationDays, sessionCount?, referralInviteQuota? }

Detail: + description(Ar), time restrictions, entitlements[]
  { activityId, activityName, activityNameAr, activityKind, accessMode, quotaLimit?, quotaPeriod? }

UI:
  - Plans list: name (locale), EGP price, duration days, planType chip
  - Detail: description, entitlements → tap → Activity detail if Activities module exists
  - Footer: “To subscribe, visit reception” / “للاشتراك، زر الاستقبال”
  - NO Buy / Pay / Checkout

Probe once: if GET /member/plans → 404, show honest empty:
  “Plans catalog coming soon. Ask reception.” /
  “باقات الصالة قريباً. اسأل الاستقبال.”
Never fall back to staff /membership-plans.

═══════════════════════════════════════════════════════════════════
6) NAV / STATE
═══════════════════════════════════════════════════════════════════

Suggested IA:
  Home | Classes | Activities | Plans | Profile

Home header: Gym Identity logo + gymName (locale) + occupancy (existing)
Profile sections:
  My gym (identity) → Membership (+ Freeze) → Activity quotas → Invitations → …

Repositories:
  GymIdentityRepository.get()          → GET /member/gym (fallback occupancy names)
  MembershipRepository.getCurrent()    → GET /member/membership/current
  MembershipRepository.freeze(...)     → POST /member/membership/freeze
  MembershipRepository.unfreeze()      → POST /member/membership/unfreeze
  PlansRepository.list() / get(id)     → GET /member/plans*

Cubits listen to gfp-equivalent locale changes; one string per locale.
On 401 → logout / re-activate.

═══════════════════════════════════════════════════════════════════
7) BACKEND GAP UX
═══════════════════════════════════════════════════════════════════

Probe membership + plans + gym identity once per session.
Missing route → BackendGap empty for THAT feature only (other features still work).
Never invent daysRemaining, plan prices, or logo URLs.

═══════════════════════════════════════════════════════════════════
8) BACKEND ASK (minimum for Flutter to finish)
═══════════════════════════════════════════════════════════════════

AuthenticatedMember controllers (resolve GymMember from JWT `sub` → AppUser → GymMember):

1) GET  /api/member/membership/current
     → MembershipDto including daysRemaining, startDate, endDate, status,
       planName(Ar), frozenFromDate, frozenUntilDate, sessionsRemaining

2) POST /api/member/membership/freeze
     body: { frozenUntil: date, reason? }
     → same rules as staff FreezeMembershipAsync (extend EndDate)

3) POST /api/member/membership/unfreeze
     → same rules as staff UnfreezeMembershipAsync

4) GET  /api/member/plans
   GET  /api/member/plans/{id}
     → active tenant plans; member-safe fields (no ActiveMemberships counts)

5) GET  /api/member/gym   (or /member/branding)
     → gymName, gymNameAr, shortName, logoUrl, primary/secondary/accent colors,
       optional phone/address
     Reuse TenantSettingsService.GetBrandingAsync (+ contact if product wants)

Do NOT open staff /members/{id}/freeze to Member JWT.
Do NOT require client to send GymMember.Id.

═══════════════════════════════════════════════════════════════════
9) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] Home/Profile app bar shows Gym Identity name (locale), not “HyMotion” as gym title
[ ] Logo from /member/gym when live; initials placeholder otherwise
[ ] Never calls /settings or /settings/branding
[ ] Membership card shows days left + Ends {date} with LTR date when current API live
[ ] Frozen shows until-date; Freeze button only when active + freeze API live
[ ] Freeze confirm sheet posts /member/membership/freeze only (no /members/{id}/freeze)
[ ] Unfreeze only when frozen + unfreeze API live
[ ] Plans list uses /member/plans OR honest empty — never /membership-plans
[ ] No Buy/Pay/Assign/Renew/Cancel from Member App
[ ] No staff /members/{id}* or /memberships/{id}* in Dio logs
[ ] Member JWT only (member-activate)
[ ] EN + AR; one label per locale; HyMotion only as product brand
[ ] flutter analyze clean for touched files
[ ] Manual smoke: Home gym name matches staff Gym Identity; membership days match
      staff Member 360; freeze extends end date; plans list matches desk active plans
```

---

## Quick reference

| Feature | Member call | Status |
|---------|-------------|--------|
| Gym name (partial) | `GET /member/occupancy` → gymName(Ar) | **Live** |
| Full Gym Identity | `GET /member/gym` | **Backend ask** |
| Remaining days | `GET /member/membership/current` | **Backend ask** |
| Freeze / unfreeze | `POST /member/membership/freeze` · `unfreeze` | **Backend ask** |
| Plans catalog | `GET /member/plans` · `/{id}` | **Backend ask** |
| Staff freeze | `POST /members/{id}/freeze` | **Forbidden** in Member App |
| Staff plans | `GET /membership-plans` | **Forbidden** |
| Staff branding | `GET /settings/branding` | **Forbidden** |

## Task tracking

| Task | Owner |
|------|--------|
| Ship member membership current + freeze/unfreeze + plans + gym identity APIs | Backend |
| MembershipRemainingCard + Freeze sheet + Plans screens + Gym Identity chrome | Flutter |
| Never call staff membership/plans/settings routes | Flutter |

## Related prompts

- Remaining-days deep UX: [`FLUTTER_MEMBER_SUBSCRIPTION_REMAINING_PROMPT.md`](FLUTTER_MEMBER_SUBSCRIPTION_REMAINING_PROMPT.md)
- Plans + activity quotas: [`FLUTTER_MEMBER_QUOTAS_PLANS_ACTIVITIES_PROMPT.md`](FLUTTER_MEMBER_QUOTAS_PLANS_ACTIVITIES_PROMPT.md)
- Occupancy (live gymName): [`FLUTTER_MEMBER_OCCUPANCY_PROMPT.md`](FLUTTER_MEMBER_OCCUPANCY_PROMPT.md)
