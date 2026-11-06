# HyMotion — Flutter Member App: Classes (Read-Only) Prompt

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Backend SoT: `docs/api/MEMBER_CLASSES_API.md`  
> DTOs: `GMS.Application/DTOs/Activities/MemberClassDtos.cs`  
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`
>
> Member Classes API is **live** (2026-09-02):
> - `GET /api/member/classes`
> - `GET /api/member/classes/{id}`
>
> Do **not** use `/api/member/activity-bookings/*` for the browse-only Classes feature.

---

```
PROMPT — HyMotion Member App: Classes (Read-Only) (Flutter)
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt ADDS or UPDATES the Classes browse experience in the Member App.
It does NOT replace auth, check-in, occupancy, offers, store, or profile scaffolding.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE, JWT Bearer,
fonts (Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT (BINDING — reception-first, information only)
═══════════════════════════════════════════════════════════════════

Current business flow (do not change):

  Member App → Classes → Class Details → View information
       ↓
  Member visits gym reception → pays → receptionist books the class

YOU ARE BUILDING: browse + detail screens only.

FORBIDDEN in this task:
- POST /api/member/activity-bookings/sessions/{id}/book
- PUT  /api/member/activity-bookings/{id}/cancel
- Any payment gateway, checkout, payment intent, wallet, or fake “Pay now”
- Any “Book class”, “Reserve seat”, “Confirm booking” button that calls the API
- POST /api/sales/*, staff /api/activity-bookings, staff /api/activity-sessions
- Creating bookings or modifying capacity client-side
- Calling activity-bookings endpoints when loading list or detail (use /member/classes)

ALLOWED UX copy (informational only):
- “Visit reception to book and pay”
- “Pay at the front desk to reserve your spot”
- Show price as informational drop-in fee when price != null

If the app already has an old Classes screen wired to
GET /api/member/activity-bookings/activities or /sessions:
  MIGRATE it to GET /api/member/classes and remove book/cancel actions from this flow.

═══════════════════════════════════════════════════════════════════
1) LIVE API (STYLE A)
═══════════════════════════════════════════════════════════════════

API_BASE already ends with `/api`. Paths must NOT repeat `/api`.

Auth on every call:
  Authorization: Bearer <member JWT>
  ngrok-skip-browser-warning: true  (if using ngrok)

Policy: AuthenticatedMember (role Member + linked GymMember profile)

───────────────────────────────────────────────────────────────────
List upcoming classes
───────────────────────────────────────────────────────────────────

GET {API_BASE}/member/classes
Query (all optional):
  activityId  — filter to one activity type (Guid)
  fromUtc     — lower bound ISO UTC (defaults server-side to now)
  limit       — default 100, max 200

200 → MemberClassListItemDto[]  (camelCase JSON from ASP.NET)

Errors:
  401 — not logged in
  400 — member profile not found → show friendly “profile not linked” message

Server rules (trust the API; do not re-filter incorrectly):
- Only upcoming class sessions (past excluded)
- Cancelled sessions excluded
- Only activities visible to members (Kind = class)

───────────────────────────────────────────────────────────────────
Class details
───────────────────────────────────────────────────────────────────

GET {API_BASE}/member/classes/{id}

{id} = ActivitySession.Id (session id from list row — NOT activityId)

200 → MemberClassDetailsDto
404 → class not found / past / cancelled / not visible
401 / 400 — same as list

═══════════════════════════════════════════════════════════════════
2) JSON SHAPES (accept camelCase; tolerate PascalCase)
═══════════════════════════════════════════════════════════════════

MemberClassListItemDto:
{
  "id": "guid",              // session id — use for detail route
  "activityId": "guid",
  "name": "Yoga Flow",
  "nameAr": "يوغا",
  "description": "Morning yoga",
  "trainerName": "Coach Sam",   // nullable
  "trainerId": "guid",          // nullable
  "date": "2026-09-05",         // DateOnly — Cairo calendar date
  "startTime": "09:00:00",      // TimeOnly — Cairo local
  "endTime": "10:00:00",
  "durationMinutes": 60,
  "startsAtUtc": "2026-09-05T06:00:00Z",
  "endsAtUtc": "2026-09-05T07:00:00Z",
  "price": 200.00,              // nullable — drop-in fee; null = included / no drop-in price
  "capacity": 15,
  "bookedCount": 3,
  "availableSeats": 12,
  "status": "upcoming"          // upcoming | completed | cancelled
}

MemberClassDetailsDto:
{
  "id": "guid",
  "activityId": "guid",
  "name": "Yoga Flow",
  "nameAr": "يوغا",
  "description": "Morning yoga",
  "descriptionAr": "يوغا صباحية",
  "schedule": {
    "date": "2026-09-05",
    "startTime": "09:00:00",
    "endTime": "10:00:00",
    "durationMinutes": 60,
    "startsAtUtc": "...",
    "endsAtUtc": "..."
  },
  "trainer": {                  // nullable
    "id": "guid",
    "name": "Coach Sam"
  },
  "price": 200.00,              // nullable
  "availability": {
    "capacity": 15,
    "bookedCount": 3,
    "availableSeats": 12
  },
  "status": "upcoming",
  "bookingRequired": true
}

IMPORTANT domain notes:
- There is NO facility/room field in the API yet. Do not invent a room name.
- `id` is the SESSION id (one scheduled occurrence), not the activity template id.
- `availableSeats` is server-calculated — display as-is; never hardcode 10/20.
- `price == null` → show “Included in membership” or hide price row (do not show EGP 0 unless server sends 0).

═══════════════════════════════════════════════════════════════════
3) TECH (same as Member App)
═══════════════════════════════════════════════════════════════════

- Flutter 3.22+ / Dart 3.4+
- flutter_bloc (Cubit)
- dio + existing auth interceptor
- go_router
- flutter_localizations + arb (ar + en)
- intl for date/time formatting

Suggested files (adapt to existing layout):
- domain/member_class.dart
- domain/member_class_details.dart
- data/class_repository.dart          // abstract
- data/api_class_repository.dart      // GET /member/classes
- cubit/classes_list_cubit.dart
- cubit/class_detail_cubit.dart
- ui/classes_list_screen.dart
- ui/class_detail_screen.dart
- ui/widgets/class_card.dart
- ui/widgets/class_availability_chip.dart

═══════════════════════════════════════════════════════════════════
4) DOMAIN MODELS (Dart)
═══════════════════════════════════════════════════════════════════

class MemberClassListItem {
  final String id;           // session id
  final String activityId;
  final String name;
  final String nameAr;
  final String description;
  final String? trainerName;
  final String? trainerId;
  final DateTime date;       // parse date as local Cairo display (see §6)
  final String startTime;    // "HH:mm:ss" or format for display
  final String endTime;
  final int durationMinutes;
  final DateTime startsAtUtc;
  final DateTime endsAtUtc;
  final double? price;
  final int capacity;
  final int bookedCount;
  final int availableSeats;
  final String status;
}

class MemberClassDetails {
  final String id;
  final String activityId;
  final String name;
  final String nameAr;
  final String description;
  final String descriptionAr;
  final MemberClassSchedule schedule;
  final MemberClassTrainer? trainer;
  final double? price;
  final MemberClassAvailability availability;
  final String status;
  final bool bookingRequired;
}

Implement fromJson with camelCase keys; optional PascalCase fallback for resilience.

═══════════════════════════════════════════════════════════════════
5) UI / UX REQUIREMENTS
═══════════════════════════════════════════════════════════════════

Navigation:
- Home quick action or bottom nav → ClassesListScreen
- Tap row → ClassDetailScreen(sessionId: item.id)
- Deep link route: /classes/:sessionId

Classes list screen:
- Pull-to-refresh → re-fetch GET /member/classes
- Group optionally by date (use `date` field)
- Each card shows:
  - Localized name (nameAr if locale ar, else name)
  - Date + startTime–endTime (formatted for locale)
  - Trainer name if present
  - Availability chip: “X spots left” / “Full” when availableSeats == 0
  - Optional price badge when price != null → “EGP {price} drop-in”
- Empty state: “No upcoming classes” + AR copy
- Error state: retry button; 401 → auth flow

Class detail screen:
- Hero: class name, trainer, schedule block
- Description (localized)
- Availability section: capacity, booked, available seats (from availability object)
- Price section when price != null
- Info banner (lime/charcoal info style):
    EN: “Visit reception to book and pay for this class.”
    AR: “زُر الاستقبال للحجز والدفع لهذه الحصة.”
- NO primary CTA for booking or payment
- 404 → “This class is no longer available” + back

States for availability chip:
- availableSeats > 0  → “{n} spots left” / “متبقي {n} أماكن”
- availableSeats == 0 → “Full” / “مكتمل”
- Do not show “Book” when full — still informational only

═══════════════════════════════════════════════════════════════════
6) DATE / TIME DISPLAY
═══════════════════════════════════════════════════════════════════

Server sends:
- Cairo-local `date`, `startTime`, `endTime` for human display
- `startsAtUtc` / `endsAtUtc` for sorting and “starts in …” if needed

Preferred display on list cards:
- Format `date` + `startTime` using intl with locale ar/en
- Example EN: “Fri, 5 Sep · 9:00 AM – 10:00 AM”
- Example AR: RTL date/time with Arabic month names

Do NOT assume device timezone equals gym timezone for list labels;
prefer server `date` + `startTime`/`endTime` for display strings.

Use `startsAtUtc` only for relative sorting and “past vs upcoming” guards in UI.

═══════════════════════════════════════════════════════════════════
7) REPOSITORY CONTRACT
═══════════════════════════════════════════════════════════════════

abstract class ClassRepository {
  Future<List<MemberClassListItem>> fetchUpcoming({String? activityId, int limit = 100});
  Future<MemberClassDetails> fetchDetails(String sessionId);
}

ApiClassRepository:
- GET /member/classes with query params
- GET /member/classes/$sessionId
- Map DioException 404 on detail → ClassNotFoundException
- Map 401 → rethrow for auth interceptor

Optional MockClassRepository for widget tests only — not production default.

═══════════════════════════════════════════════════════════════════
8) CUBIT STATES
═══════════════════════════════════════════════════════════════════

ClassesListCubit:
- initial | loading | loaded(List<MemberClassListItem>) | empty | error(message)

ClassDetailCubit:
- initial | loading | loaded(MemberClassDetails) | notFound | error(message)

On refresh: emit loading → fetch → emit loaded/empty/error.
Do not cache stale detail forever; refresh on screen open.

═══════════════════════════════════════════════════════════════════
9) ROUTER (go_router example)
═══════════════════════════════════════════════════════════════════

GoRoute(
  path: '/classes',
  builder: (_, __) => const ClassesListScreen(),
  routes: [
    GoRoute(
      path: ':sessionId',
      builder: (_, state) => ClassDetailScreen(
        sessionId: state.pathParameters['sessionId']!,
      ),
    ),
  ],
),

Home quick action: context.push('/classes');

═══════════════════════════════════════════════════════════════════
10) i18n STRINGS (add to arb)
═══════════════════════════════════════════════════════════════════

classesTitle          / classesTitleAr
classDetailsTitle     / classDetailsTitleAr
noUpcomingClasses     / noUpcomingClassesAr
spotsLeft             / spotsLeftAr        // "{count} spots left"
classFull             / classFullAr
dropInPrice           / dropInPriceAr      // "EGP {price} drop-in"
includedInMembership  / includedInMembershipAr
visitReceptionToBook  / visitReceptionToBookAr
trainerLabel          / trainerLabelAr
durationLabel         / durationLabelAr
capacityLabel         / capacityLabelAr
classNotAvailable     / classNotAvailableAr
retry                 / retryAr

═══════════════════════════════════════════════════════════════════
11) MIGRATION CHECKLIST (if Classes already exists)
═══════════════════════════════════════════════════════════════════

[ ] Replace activity-bookings list URL with GET /member/classes
[ ] Replace detail lookup with GET /member/classes/{sessionId}
[ ] Remove Book / Cancel buttons and related cubit methods from Classes flow
[ ] Remove canBook / myBooking UI from browse screens (keep for future My Bookings if separate)
[ ] Use session `id` for navigation (not activityId)
[ ] Remove hardcoded capacity/price/trainers
[ ] Add reception info banner on detail screen
[ ] Verify 401 triggers existing auth refresh / re-activate flow

═══════════════════════════════════════════════════════════════════
12) TESTING (minimum)
═══════════════════════════════════════════════════════════════════

Unit:
- fromJson parses list + detail samples (camelCase)
- availability chip logic (full vs spots left)
- localized name selection (ar vs en)

Widget:
- list renders cards from mock repository
- detail shows reception banner, no book button
- empty + error states

Integration (optional):
- GET /member/classes with test member JWT returns 200

Do NOT test booking or payment — out of scope.

═══════════════════════════════════════════════════════════════════
13) DEFINITION OF DONE
═══════════════════════════════════════════════════════════════════

[ ] Classes list loads from GET /api/member/classes
[ ] Detail loads from GET /api/member/classes/{sessionId}
[ ] Real trainer, schedule, price, capacity, availableSeats displayed
[ ] Bilingual EN/AR + RTL
[ ] Pull-to-refresh on list
[ ] Reception-only info message on detail — no online book/pay
[ ] No calls to activity-bookings book/cancel from Classes screens
[ ] No hardcoded class data in production path
[ ] Handles empty, 404, 401, network error gracefully

END PROMPT
```

---

## Quick reference

| Screen | API |
|---|---|
| Classes list | `GET /api/member/classes` |
| Class detail | `GET /api/member/classes/{sessionId}` |

| Do | Don't |
|---|---|
| Show schedule, trainer, price, seats | Book or pay online |
| Tell user to visit reception | Call `POST …/book` |
| Use `id` as session id | Use `activityId` for detail route |
