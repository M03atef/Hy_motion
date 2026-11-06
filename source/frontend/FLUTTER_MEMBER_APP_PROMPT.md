# HyMotion — Flutter Member App Developer Prompt

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Machine SoT for API shapes: `Frontend/FRONTEND_API_CONTRACTS.ts` (and live controllers under `GMS.Api`).
> Prefer contracts + controllers over older docs (`FRONTEND_FLUTTER_API_DOCUMENTATION.md`, `FLUTTER_INTEGRATION_GUIDE.md`, and the legacy `flutter_member_app_prompts.md`) — those still mention **OTP** and a **`member_id` JWT claim**, which are **wrong / obsolete**.

---

```
PROMPT — HyMotion Member Mobile App (Flutter)
You are a senior Flutter developer building the HyMotion Member App — the consumer companion for gym members (Egypt / MENA). Arabic primary + English secondary; RTL when locale is Arabic.

═══════════════════════════════════════════════════════════════════
0) PRODUCT BOUNDARY (BINDING — do not invent staff workflows)
═══════════════════════════════════════════════════════════════════

This is the MEMBER app, not the staff web desk.

OWN (build these):
- Activate account with Gym Code + staff-issued one-time Activation Code
- Session (JWT + refresh), logout
- Home: greeting, gym context, current membership summary (read-only), quick actions, live gym occupancy card (GET /api/member/occupancy — see FLUTTER_MEMBER_OCCUPANCY_PROMPT.md), classes browse (GET /api/member/classes — see FLUTTER_MEMBER_CLASSES_PROMPT.md; read-only, reception books/pays)
- Profile → Orders: own orders only via GET /api/member/orders (see FLUTTER_MEMBER_ORDERS_PROMPT.md; never staff GET /api/member-orders)
- QR check-in: scan the gym’s static QR → send gymCode
- Notifications: list + mark read
- Invitations: summary, send (name + phone; National ID optional), history
- Member store (if tenant has inventory feature): browse products, place order, my orders
- Offers & Promotions (Member App visibility — GET /api/member/offers; see FLUTTER_MEMBER_OFFERS_PROMPT.md)
- Profile hub: identity, membership (read-only), invitations, attendance, orders, bookings, settings — see FLUTTER_MEMBER_PROFILE_PROMPT.md
- Attendance history: see FLUTTER_MEMBER_ATTENDANCE_PROMPT.md — **never** `GET /api/attendance/history` (404; route does not exist). Until Phase 2 `GET /api/member/attendance`, use empty/cache UX only.
- Bilingual EN/AR UI; map API bilingual fields (name / nameAr, message / messageAr)

FORBIDDEN (staff / desk only — never call, never UI):
- Staff login (email/password)
- Create / edit / archive members
- Assign plan, renew membership, freeze / unfreeze
- Manual / barcode check-in, desk redeem guest visit
- `GET /api/attendance/history`, `GET /api/attendance/today`, `GET /api/members/{id}/attendance` (staff)
- Credits ledger, sales, shifts, refunds, inventory management, PO, warehouses
- POST /api/members/{id}/app-activation-code (staff generates the code; member only consumes it)

Membership in the Member App is READ-ONLY status display. Commercial membership actions live on staff Memberships desk.

═══════════════════════════════════════════════════════════════════
1) TECH STACK (required)
═══════════════════════════════════════════════════════════════════

- Flutter 3.22+ / Dart 3.4+
- State: flutter_bloc (Cubit preferred)
- HTTP: dio (+ auth interceptor)
- Storage: flutter_secure_storage (tokens + gymCode — NEVER SharedPreferences for tokens)
- Nav: go_router
- QR scan: mobile_scanner
- Localize: flutter_localizations + arb (ar + en)
- Fonts: google_fonts → Cairo
- Optional later: firebase_messaging, flutter_local_notifications

Dev / ngrok base URL (STYLE A — recommended):
- API_BASE must end with `/api` and paths must NOT repeat `/api`
- Example ngrok: `https://reach-lullaby-tighten.ngrok-free.dev/api`
- Android emulator local: `https://10.0.2.2:5001/api` (or http)
- iOS simulator local: `https://localhost:5001/api`
- Physical device: `https://<LAN-IP>:5001/api`
Production: `https://api.gymflowpro.com/api` (confirm with team)

FORBIDDEN URL bug (causes HTTP 404):
  base ".../api" + path "/api/auth/member-activate" → "/api/api/auth/member-activate"
Always use path "/auth/member-activate" when base already includes "/api".

═══════════════════════════════════════════════════════════════════
2) AUTH — Stage 0 Activation (CURRENT — use this)
═══════════════════════════════════════════════════════════════════

DO NOT implement phone OTP.
POST /auth/member-otp and POST /auth/member-verify are Obsolete (under API_BASE .../api).
Never use MemberNumber / barcode as app login.

Flow:
1) Staff issues a one-time activation code in the web desk
   (POST /members/{id}/app-activation-code — staff only; plaintext shown once).
2) Member opens app → enters Gym Code + Activation Code.
3) App calls (STYLE A):

POST /api/auth/member-activate
Body: { "gymCode": "GYM-TEST-01", "activationCode": "ABC123" }
→ 200 LoginResponse | 401 { "error": "..." }

See also: Frontend/FLUTTER_MEMBER_ACTIVATE_API_PROMPT.md (short activate-only prompt).

LoginResponse:
{
  "accessToken": string,      // ~15 min
  "refreshToken": string,     // ~30 days
  "expiresAtUtc": string,     // ISO UTC
  "user": {
    "id": string,             // ASP.NET Identity user id (Guid string)
    "email": string,
    "fullName": string,
    "role": "Member",
    "tenantId": string,
    "gymCode": string
  }
}

Refresh (STYLE A):
POST {API_BASE}/auth/refresh
Body: { "refreshToken": string }
→ 200 LoginResponse | 401

On every authenticated request:
  Authorization: Bearer {accessToken}
Optional ngrok free header: ngrok-skip-browser-warning: true

Tenant:
- JWT carries gym_code + tenant_id.
- TenantMiddleware also accepts X-Gym-Code if needed; prefer relying on JWT after login.
- Store gymCode locally after successful activate.

Dio interceptor:
- Attach Bearer token
- On 401 (except refresh itself): try ONE refresh; on failure → clear storage → force activation screen

═══════════════════════════════════════════════════════════════════
3) JWT — CRITICAL IDENTITY RULES
═══════════════════════════════════════════════════════════════════

Decode accessToken payload. Claims that exist:
  sub, email, jti, tenant_id, gym_code, first_name, last_name, role (+ perm for staff only)

THERE IS NO reliable `member_id` claim. TokenService never emits it.
Treat JWT `sub` as the authenticated Identity user id.

Backend member-scoped APIs resolve GymMember via:
  Identity sub → AppUser.UserId → GymMember.AppUserId

Therefore:
- Pass JWT only; do NOT invent GymMember Guid from login.user.id and call staff Members routes
- LoginResponse.user.id == JWT sub (Identity id) — NOT necessarily GymMember.Id
- Never call staff endpoints that require MembersView / ManagerOrAbove / AnyStaff using user.id as a “member id”

═══════════════════════════════════════════════════════════════════
4) MEMBER-APP API SURFACE (AuthenticatedMember or member-scoped)
═══════════════════════════════════════════════════════════════════

Only these domains are for the Member App today.

--- A) QR Check-in ---
POST /api/attendance/qr-checkin
Policy: AuthenticatedMember
Body: { "gymCode": string }   // value encoded in the gym’s static QR poster
→ 200 QrCheckinResponse | 400 { error } | 401 | 429

QrCheckinResponse:
{
  "attendanceId": string,
  "memberName": string,
  "memberNameAr": string,
  "checkInAtUtc": string,
  "planName": string,
  "planNameAr": string,
  "sessionsRemaining": number | null,
  "message": string,
  "messageAr": string
}

UX: camera scan → extract gymCode string from QR payload → POST.
Show bilingual success/error (message / messageAr). Cache last successful planName + sessionsRemaining for Home if no dedicated membership GET exists yet.

DO NOT call: manual-checkin, barcode-checkin, member-search (staff).

--- B) Notifications ---
See Frontend/FLUTTER_MEMBER_NOTIFICATIONS_PROMPT.md for the full apply prompt.

GET  /api/notifications?page=1&pageSize=20
→ PagedResult<NotificationDto>
GET  /api/notifications/unread-count
→ { count }
POST /api/notifications/{id}/read
→ { message }
POST /api/notifications/read-all
→ { message }

NotificationDto: id, title, titleAr, body, bodyAr, channel ("in_app"|"push"|"whatsapp"), sentAt?, isRead

Server resolves GymMember from JWT `sub` (Identity id). Do NOT send memberId.
Do NOT call /api/staff-notifications or POST /api/notifications/send-bulk.

--- C) Invitations ---
GET  /api/invitation/summary
→ { memberId, membershipId?, planId?, planName?, total, used, remaining, membershipStatus }

GET  /api/invitation/history
→ InvitationHistoryResponse[] { id, name, phoneNumber, status, createdAtUtc, contactedAtUtc?, convertedAtUtc? }
  status: new | contacted | interested | not_interested | converted

POST /api/invitation/send
Body: { "name": string, "phoneNumber": string, "nationalId"?: string|null, "notes"?: string|null }
→ SendInvitationResponse { invitationId, name, phoneNumber, status, alreadyExisted, quotaTotal, quotaUsed, quotaRemaining, message, messageAr }
Quota is consumed on create. alreadyExisted true = return existing row, do not spend quota.
National ID is optional. Do not send visitDate.

DO NOT call: GET /invitation/guest-quota, GET /invitation/referral-share,
GET /invitation/pending, POST /invitation/{id}/redeem-visit (retired).

--- D) Member store (feature-gated: inventory) ---
Base: /api/member-store
Policy: AuthenticatedMember + FeatureFlag("inventory")
If disabled → treat as FEATURE_DISABLED / hide Store tab.

GET  /api/member-store/products?q=
→ MemberStoreProductDto[]
  { id, categoryId?, categoryName?, sku, name, nameAr?, description?, descriptionAr?,
    brand?, imageUrl?, unitOfMeasure, sellPrice, currency, allowFractionalQty,
    trackStock, availableQty, inStock }

imageUrl is often a RELATIVE path (`/uploads/products-…/file.jpg`), not a full URL.
Never load it as-is and never prefix API_BASE (that creates `/api/uploads` 404).
Fix: Frontend/FLUTTER_MEMBER_PRODUCT_PHOTOS_PROMPT.md (resolve to origin without `/api`,
rewrite localhost, send ngrok-skip-browser-warning on the image GET, BoxFit.contain).

POST /api/member-store/orders
Body: { "notes"?: string, "lines": [ { "productId": guid, "qty": number } ] }
→ 201 MemberOrderDto

GET  /api/member-store/orders
→ MemberOrderListItemDto[]

GET  /api/member-store/orders/{id}
→ MemberOrderDto
  { id, orderNumber, status, memberId, memberName?, memberNumber?, warehouseId,
    currency, subtotal, total, memberNotes?, rejectionReason?,
    createdAtUtc, acceptedAtUtc?, readyAtUtc?, completedAtUtc?, rejectedAtUtc?,
    lines: [...] }

Staff fulfill/reject paths are NOT in this app.

--- E) Membership / Person profile — READ MODEL REALITY ---

Staff APIs (DO NOT USE from Member App — they require staff perms):
- GET /api/members/{id}
- GET /api/members/{id}/membership
- GET /api/members/{id}/attendance
- GET /api/members/{id}/credits
- GET /api/memberships/{memberId}/current
- GET /api/memberships/{memberId}/history
- POST assign / renew / freeze / unfreeze

As of now there is NO dedicated AuthenticatedMember “GET /me” or “GET /my-membership”.

Until a member self-read endpoint ships, build Home membership card from:
1) LoginResponse.user (fullName, gymCode)
2) JWT first_name / last_name / gym_code
3) Last successful QrCheckinResponse (planName, planNameAr, sessionsRemaining)
4) Guest quota planName (optional hint)

Display statuses only as informational chips if you have them from check-in/error copy:
  active | expired | frozen | cancelled | none
Never offer Assign / Renew / Freeze buttons.

If Product later adds GET /api/member/me (or similar), wire it behind a repository interface without rewriting UI.

═══════════════════════════════════════════════════════════════════
5) ERRORS & PAGINATION
═══════════════════════════════════════════════════════════════════

Member/auth/attendance/invitation often return: { "error": "..." } (sometimes bilingual in one string).
Some modules use ProblemDetails: { title, detail, status }.
Handle BOTH. Never show raw JSON to users — map to AR/EN strings.

PagedResult:
{ items, totalCount, page, pageSize, totalPages, hasNext, hasPrevious }

Rate limits exist on activate + qr-checkin — show friendly “try again shortly”.

═══════════════════════════════════════════════════════════════════
6) SCREENS / NAV (suggested)
═══════════════════════════════════════════════════════════════════

Unauthenticated:
- ActivateAccountScreen: Gym Code + Activation Code → member-activate

Authenticated shell (bottom nav):
1. Home — greeting, gym occupancy card (ring + %), membership summary (read-only), Check in CTA, Invite CTA, Store (if enabled)
2. Check-in — QR scanner
3. Activity — notifications (+ optional invitation history segment)
4. Store — products / cart / my orders (hide if inventory flag off / 404 FEATURE_DISABLED)
5. Profile hub — FLUTTER_MEMBER_PROFILE_PROMPT.md (Phase 1 aggregate; Phase 2 /member/me)

Also:
- InvitationsScreen (summary + Invite a Friend + history)
- OrderDetailScreen

═══════════════════════════════════════════════════════════════════
7) DESIGN (match HyMotion staff web — do not invent a navy/red gym theme)
═══════════════════════════════════════════════════════════════════

Brand: charcoal + lime
  Lime CTA: #7ACC00 on #0D0D0D text; accents teal #148F8F
  Light bg #FAFAFA / surface #FFFFFF
  Dark optional: bg #0D0D0D / surface #1A1A1A
FORBIDDEN: Inter/Roboto/Arial as brand, purple gradients, cream+terracotta AI look, navy+#E94560 “gym dark” packs.
Status colors: Active green, Expired red, Frozen cyan, Pending amber.

═══════════════════════════════════════════════════════════════════
8) ACCEPTANCE CHECKLIST
═══════════════════════════════════════════════════════════════════

[ ] Activation uses ONLY POST /api/auth/member-activate (no OTP screens)
[ ] Tokens in flutter_secure_storage; silent refresh; logout on refresh fail
[ ] Identity = JWT sub; never call staff /api/members/{id}/* or /api/memberships/*
[ ] QR check-in posts { gymCode } from scanned poster; shows message/messageAr
[ ] No Dio call to /attendance/history (FLUTTER_MEMBER_ATTENDANCE_PROMPT.md)
[ ] Invitations use name + phoneNumber; National ID optional; GET summary for quota
[ ] No guest-quota, referral-share, or visitDate
[ ] Notifications list + mark read
[ ] Member store gated; orders create/list/detail only
[ ] Profile Orders uses GET /api/member/orders (never /api/member-orders); Member A ≠ Member B
[ ] Classes browse uses GET /api/member/classes; no book/pay side effects (FLUTTER_MEMBER_CLASSES_PROMPT.md)
[ ] No Assign / Renew / Freeze / credits / desk check-in UI
[ ] AR + EN + RTL; bilingual API fields preferred over hardcoding English-only
[ ] flutter analyze clean; works on Android + iOS simulators

═══════════════════════════════════════════════════════════════════
9) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Scaffold + theme + l10n + Dio + secure storage + GoRouter
2. Activate + refresh + auth gate
3. Home shell + Profile hub (see FLUTTER_MEMBER_PROFILE_PROMPT.md)
4. QR check-in
5. Notifications
6. Invitations (summary + send + history)
7. Member store (feature-detect)
8. Polish: empty/error/shimmer, offline message, deep-link gymCode if QR opens app

Wait for my go-ahead before scaffolding if this prompt is pasted into an AI coding agent; if handed to a human Flutter developer, start at step 1.
```

---

## Quick reference (for humans)

| Area | Member App | Staff only |
|------|------------|------------|
| Auth | `POST /api/auth/member-activate` + refresh | Login, issue activation code |
| Check-in | `POST /api/attendance/qr-checkin` | Manual / barcode |
| Visit history | Phase 2 `GET /api/member/attendance` (not `/attendance/history`) | `GET /api/members/{id}/attendance` |
| Invites | send, history, summary | staff list / status PATCH |
| Store | `/api/member-store/*` | fulfill / reject orders |
| Membership | Read-only UI from login/JWT/check-in | Assign / Renew / Freeze / Members APIs |
| Person CRUD | Display only | Create / edit / archive members |

**Stale docs to ignore for auth identity:** OTP flows, `member_id` JWT claim, calling `GET /api/members/{id}/membership` from the Member App.
