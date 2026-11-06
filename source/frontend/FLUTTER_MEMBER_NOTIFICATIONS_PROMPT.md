# HyMotion — Flutter Member App: Notifications Inbox

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md` (auth, STYLE A API_BASE, JWT `sub`, fonts, charcoal + lime).
> Staff desk inbox is a **different** product (`/api/staff-notifications`) — never call it from the Member App.
>
> Member APIs are **live** under `/api/notifications` (AuthenticatedMember). Server resolves GymMember from JWT `sub` — there is **no** `member_id` claim.

---

```
PROMPT — HyMotion Member App: Notifications (Flutter)
You are a senior Flutter developer APPLYING the Notifications module to the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt ADDS an in-app notification inbox + badge.
It does NOT replace auth, QR check-in, invitations, offers, store, or profile.
It does NOT build staff “Send to members” compose, WhatsApp admin, or the staff desk inbox.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for:
  stack (Flutter 3.22+ / Cubit / Dio / go_router / arb),
  STYLE A API_BASE (ends with /api — paths must NOT repeat /api),
  JWT `sub` = Identity ApplicationUser.Id (NOT GymMember.Id),
  fonts (Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic),
  brand charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT (BINDING)
═══════════════════════════════════════════════════════════════════

Members receive messages from their gym (welcome, offers, desk broadcasts, system tips).
The Member App shows an INBOX of those messages, unread badge, and mark-as-read.

OWN (build these):
- Home / AppBar bell with unread count badge
- Notifications list screen (paginated, newest first)
- Unread vs read visual state
- Tap row → mark read (expand body inline OR open detail sheet — pick one, keep it simple)
- “Mark all as read”
- Empty state + error/retry
- Pull-to-refresh
- Poll unread count lightly while app is foreground (e.g. every 60s) OR refresh on resume / tab focus

FORBIDDEN:
- Staff login / Manager compose / POST /notifications/send-bulk
- GET/POST /api/staff-notifications/*  (staff desk only)
- Inventing ActionUrl / Type / Category / Priority UI (member DTO does not expose them yet)
- Deep-linking into staff dashboard paths (/dashboard/…)
- Sending memberId / tenantId in the request body or query (server resolves from JWT)
- Treating JWT `sub` as GymMember.Id
- OTP / obsolete `member_id` JWT claim
- Fake FCM as if push were already contracted — Phase 1 is IN-APP inbox only
  (firebase_messaging may be stubbed later; do not block inbox on FCM)

Phase 1 reality (2026-08-27):
- List + unread-count + mark one + mark all are LIVE.
- No member deep-link field on NotificationDto yet → tap = mark read + show full body.
- No device-token registration API documented for members → skip push until backend ships it.

═══════════════════════════════════════════════════════════════════
1) LIVE API (STYLE A)
═══════════════════════════════════════════════════════════════════

API_BASE already ends with `/api`. Paths must NOT repeat `/api`.
Authorization: Bearer <member access token>
Header: ngrok-skip-browser-warning: true  (same as other member calls)
Policy: AuthenticatedMember (role Member)

WRONG:  path "/api/notifications" when API_BASE already ends with /api
RIGHT:  path "/notifications"

── List ──
GET {API_BASE}/notifications?page=1&pageSize=20
200 → PagedResult<NotificationDto> (camelCase; also accept PascalCase):

{
  "items": [
    {
      "id": "guid",
      "title": "string",
      "titleAr": "string",
      "body": "string",
      "bodyAr": "string",
      "channel": "in_app" | "push" | "whatsapp",
      "sentAt": "2026-08-27T12:00:00Z" | null,
      "isRead": false
    }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}

pageSize max 50 (server clamps). Sort: newest first (sentAt).

── Unread badge ──
GET {API_BASE}/notifications/unread-count
200 → { "count": 3 }

── Mark one read ──
POST {API_BASE}/notifications/{id}/read
200 → { "message": "…" }
403 if not owned; 404 if missing.

── Mark all read ──
POST {API_BASE}/notifications/read-all
200 → { "message": "…" }

Do NOT call:
- POST /notifications/send-bulk
- /staff-notifications
- /members/{id}/*
- Any staff attendance / settings routes

On 401: existing refresh / re-activate flow.
On network error: show retry; keep last successful list if you already have cache (optional).
Empty list → friendly empty state (not a technical error).

═══════════════════════════════════════════════════════════════════
2) DART MODEL + REPOSITORY
═══════════════════════════════════════════════════════════════════

class MemberNotification {
  final String id;
  final String title;
  final String titleAr;
  final String body;
  final String bodyAr;
  final String channel; // in_app | push | whatsapp
  final DateTime? sentAt;
  final bool isRead;
}

Display helpers:
  displayTitle(locale) => ar ? (titleAr.isNotEmpty ? titleAr : title) : (title.isNotEmpty ? title : titleAr)
  displayBody(locale)  → same for body / bodyAr

class MemberNotificationsPage {
  final List<MemberNotification> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final int totalPages;
}

MemberNotificationRepository:
- ApiMemberNotificationRepository uses existing authenticated Dio
- getPage(page, pageSize)
- getUnreadCount()
- markRead(id)
- markAllRead()
- fromJson: read camelCase AND PascalCase (id/Id, isRead/IsRead, sentAt/SentAt, …)

Optional MockMemberNotificationRepository ONLY for offline / widget tests —
do not ship fake gym marketing as if live when API is reachable.

Suggested files (adapt to project layout):
- domain/member_notification.dart
- data/member_notification_repository.dart
- cubit/notifications_cubit.dart
- cubit/notifications_badge_cubit.dart   // or fold badge into shell cubit
- ui/notifications_screen.dart
- ui/widgets/notification_tile.dart
- ui/widgets/notification_bell_button.dart

═══════════════════════════════════════════════════════════════════
3) UI (Member App — not staff desk)
═══════════════════════════════════════════════════════════════════

Brand: dark charcoal surfaces, lime accents. No navy/red “gym pack”. No purple AI look.

--- A) Bell + badge ---
AppBar or Home header:
  Icon bell → route /notifications
  Badge when count > 0 (cap label at 99+)
  Refresh count on: app resume, after mark read / mark all, after list load, timer ~60s while foreground

--- B) Notifications screen ---
Title: Notifications / الإشعارات
Toolbar: “Mark all as read” / “تعليم الكل كمقروء” (hide or disable when count == 0)

List tiles:
  Unread: stronger weight / lime accent bar or filled dot
  Read: muted
  Title (locale), body preview 1–2 lines, relative time (Just now / 5m / Yesterday — localize)
  Channel chip optional (Push / WhatsApp / In-app) — do not over-emphasize; most will be in_app or push from desk

Tap:
  1) Optimistically set isRead locally
  2) POST …/read
  3) Show full body (expand tile OR bottom sheet / detail route)
  Do NOT navigate to staff URLs.

Pagination: load more on scroll OR Next when totalPages > 1.
Pull-to-refresh reloads page 1 + unread count.

Empty:
  EN: No notifications yet
  AR: لا توجد إشعارات بعد
  Friendly illustration / bell-off icon — not a red error.

Error:
  EN: Couldn’t load notifications
  AR: تعذر تحميل الإشعارات
  + Retry

--- C) Profile quick link (if Profile hub exists) ---
Row “Notifications” with unread pill → same /notifications route.
See FLUTTER_MEMBER_PROFILE_PROMPT.md — wire the stub if present.

═══════════════════════════════════════════════════════════════════
4) NAV
═══════════════════════════════════════════════════════════════════

Authenticated shell:
- Route: /notifications
- Entry: AppBar bell (preferred) and/or Profile row
- Do NOT add a 6th bottom-nav tab unless Product insists — badge on bell is enough

Deep links later: HyMotion://notifications — optional stub; ignore unknown ids.

═══════════════════════════════════════════════════════════════════
5) COPY (EN / AR)
═══════════════════════════════════════════════════════════════════

EN                              AR
Notifications                   الإشعارات
Mark all as read                تعليم الكل كمقروء
No notifications yet            لا توجد إشعارات بعد
Couldn’t load notifications     تعذر تحميل الإشعارات
Retry                           إعادة المحاولة
Just now                        الآن
Unread                          غير مقروء
In-app                          داخل التطبيق
Push                            إشعار
WhatsApp                        واتساب

═══════════════════════════════════════════════════════════════════
6) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] STYLE A paths only (/notifications not /api/notifications when base ends with /api)
[ ] No staff-notifications / send-bulk / members/{id} calls
[ ] Never send memberId; never trust JWT sub as GymMember.Id
[ ] List + pagination + pull-to-refresh
[ ] Unread badge matches GET /notifications/unread-count
[ ] Tap marks read; mark-all clears badge
[ ] AR + EN + RTL title/body from titleAr/bodyAr
[ ] Empty + error/retry states
[ ] flutter analyze clean
[ ] Does not break activate / QR / invitations / store / offers / occupancy

═══════════════════════════════════════════════════════════════════
7) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Domain + ApiMemberNotificationRepository (Dio)
2. NotificationsCubit + list screen + tile
3. Bell badge (unread-count + refresh hooks)
4. Mark read + mark all
5. l10n AR/EN
6. Wire Profile / Home entry points
7. (Optional later) firebase_messaging — only when device-token API exists

Wait for my go-ahead before scaffolding if this is pasted into an AI coding agent; if handed to a human Flutter developer, start at step 1.
```

---

## Quick reference (for humans)

| Layer | Status |
|--------|--------|
| Member inbox APIs | **Live** — `GET/POST /api/notifications…` (AuthenticatedMember; resolves GymMember from `sub`) |
| Unread badge | **Live** — `GET /api/notifications/unread-count` |
| Staff send-bulk | Desk only — Manager+ — **forbidden** in Member App |
| Staff inbox | `/api/staff-notifications` — **forbidden** in Member App |
| Push / FCM tokens | Not contracted for Member App yet — Phase 1 = in-app list |
| Deep links | Not on member `NotificationDto` yet — tap = read + show body |

Platform: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`
