# HyMotion — Flutter Member App: Live Gym Capacity / Occupancy

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Staff desk already ships this (Dashboard ring card + Gym Identity “Maximum inside”).
> Design SoT: `Frontend/previews/gym-capacity-occupancy.html` (Member App phone frame).
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`.
>
> Member API is **live**: `GET /api/member/occupancy`.
> Do **not** call staff `/api/attendance/today`, `/api/attendance/occupancy`, or `/api/settings`.

---

```
PROMPT — HyMotion Member App: Live gym capacity (Flutter)
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt ADDS a Home occupancy card so the member can answer:
  “Is my gym crowded right now?”

It does NOT replace auth, QR check-in, membership, offers, or store.
It does NOT add a Capacity tab, settings screen, or branch picker.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE, JWT `sub`,
fonts (Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT (BINDING)
═══════════════════════════════════════════════════════════════════

Capacity belongs to THIS gym (tenant), not a branch. Members are gym-scoped via JWT gym_code.
Do not invent a location / branch selector.

Occupancy is a DERIVED view of existing Attendance (open visits today).
The Member App only DISPLAYS it. Staff Attendance remains the source of truth.

Hero visual (owner accepted — do not lead with 184/300):
  color RING (indicator)
  + occupancy PERCENTAGE in the center
  + status: Available / Getting Busy / Full
Counts (184 / 300, spots left) are secondary text.

FORBIDDEN:
- Staff login
- GET/PUT /api/settings  (Owner gym profile — configuring max capacity is staff-only)
- GET /api/attendance/today
- GET /api/attendance/occupancy   (staff members.view — 403 for members)
- POST check-in/out as part of this card
- Charts, heatmaps, history, forecasting, rooms, equipment
- A second attendance / “who is inside” list
- Fake numbers when the API fails or capacity is unset

═══════════════════════════════════════════════════════════════════
1) LIVE API (STYLE A)
═══════════════════════════════════════════════════════════════════

API_BASE already ends with `/api`. Paths must NOT repeat `/api`.

GET {API_BASE}/member/occupancy
Authorization: Bearer <member JWT>
Header: ngrok-skip-browser-warning: true  (same as other member calls)

Policy: AuthenticatedMember
200 body (camelCase; also accept PascalCase):

{
  "gymName": "Fitness Hub",
  "gymNameAr": "فتنس هب",
  "gymActive": true,
  "maxCapacity": 300,
  "currentlyInside": 184,
  "available": 116,
  "occupancyPercent": 61,
  "source": "attendance_open_visits"
}

Field rules:
- maxCapacity null  → Owner has not configured capacity. Show unavailable. Do NOT show 0%.
- gymActive false   → do not present live occupancy as if the gym is open.
- available         → null when maxCapacity is null; never negative (over-capacity still 0 spots).
- occupancyPercent  → may be > 100 (e.g. 315 inside / 300 max → 105). Show 105% in the center.
                      Ring FILL is capped at 100%.
- currentlyInside   → always a number when the request succeeds.

WRONG (404):  API_BASE ".../api" + path "/api/member/occupancy"
RIGHT:        path "/member/occupancy"

═══════════════════════════════════════════════════════════════════
2) DART MODEL + REPOSITORY
═══════════════════════════════════════════════════════════════════

class GymOccupancy {
  final String gymName;
  final String gymNameAr;
  final bool gymActive;
  final int? maxCapacity;
  final int currentlyInside;
  final int? available;
  final int? occupancyPercent;
  final String source;
}

fromJson: read gymName / GymName, maxCapacity / MaxCapacity, etc.

GymOccupancyRepository:
- ApiGymOccupancyRepository uses the existing authenticated Dio client
- GET /member/occupancy
- On 401: existing refresh / re-activate flow
- On 403/404/400/timeout/network: return failure (UI shows unavailable — no mock numbers)

Do NOT keep a MockOccupancyRepository that invents 184/300 as if it were live.

═══════════════════════════════════════════════════════════════════
3) HOME CARD UI (match the preview phone frame)
═══════════════════════════════════════════════════════════════════

Place on Home under the greeting / gym name, above or beside the membership card.
Dark card: background #1C1C1C, border #2A2A2A, radius 16.

Layout (LTR; mirror in RTL):
  Title: "Your gym" / "صالتك"
  Row:
    LEFT  circular ring, ~88dp
    RIGHT status
  Ring stroke fills with occupancyPercent (capped at 100%).
  Ring CENTER: "61%"  (big Space Grotesk)
  Status: colored DOT + "Gym is Available"
  Under status: "61% occupied" and "116 spots available"

This is a simple operational indicator. No extra screens. Tap does nothing
(optional: pull-to-refresh Home reloads occupancy with membership).

═══════════════════════════════════════════════════════════════════
4) DISPLAY BANDS (client-only — never send to the server)
═══════════════════════════════════════════════════════════════════

Use occupancyPercent + currentlyInside + available. Do not persist these labels.

Empty:      currentlyInside == 0
            green #22C55E   "Gym is Empty" / "الجيم فاضي"
            "{n} spots available" / "{n} أماكن فاضية"

Available:  percent < 80
            green #22C55E   "Gym is Available" / "الصالة متاحة"
            "{n} spots available"

Busy:       percent 80–99
            amber #F59E0B   "Gym is Getting Busy" / "الصالة تزحم"
            "{n} spots available"

Full:       percent >= 100 OR available == 0
            red #EF4444     "Gym is Full" / "الصالة ممتلئة"
            "No spots currently available" / "مفيش أماكن دلوقتي"

Over:       currentlyInside > maxCapacity
            red, ring fill 100%, CENTER still shows 105%
            "Gym is Full" / crowded copy — do not break the layout

Unavailable (show "—" in the ring, NOT 0%):
- request failed
- gymActive == false
- maxCapacity == null
  muted gray
  "Currently unavailable" / "غير متاح حالياً"
  "We won’t guess how busy it is." / "مش هنخمّن الزحمة."

═══════════════════════════════════════════════════════════════════
5) IMPLEMENTATION STEPS
═══════════════════════════════════════════════════════════════════

1) Model + repository + Cubit (load on Home; refresh on pull-to-refresh).
2) CustomPainter or CircularProgressIndicator.adaptive is OK for the ring;
   prefer a circular stroke (not a linear bar as the hero).
3) Wire onto existing Home. Do not add a bottom-nav item.
4) arb: occupancy_* strings EN + AR.
5) If inventory/offers cards already exist on Home, occupancy sits with gym context
   (greeting / gym name), not inside Store.

═══════════════════════════════════════════════════════════════════
6) DONE WHEN
═══════════════════════════════════════════════════════════════════

- Home shows ring + % for the member's gym from GET /member/occupancy
- Available / Busy / Full / Empty / unavailable match the preview
- Over-capacity (105%) does not overflow or crash
- Unset capacity never shows a fake 0% or 184/300
- No staff APIs, no branch picker, no capacity settings in the Member App
```
