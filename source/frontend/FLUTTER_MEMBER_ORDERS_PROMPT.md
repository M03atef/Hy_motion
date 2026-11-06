# HyMotion — Flutter Member App: Profile Orders (Isolation) Prompt

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Backend SoT: `docs/api/MEMBER_ORDERS_ISOLATION.md`  
> Platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`  
> Profile hub: `Frontend/FLUTTER_MEMBER_PROFILE_PROMPT.md`
>
> Member Orders API is **live** (2026-09-02):
> - `GET /api/member/orders`
> - `GET /api/member/orders/{id}`
> - Legacy aliases: `/api/member-store/orders` (+ `/{id}`) — same isolation service
>
> **Never** call staff `GET /api/member-orders` from the Member App.

---

```
PROMPT — HyMotion Member App: Profile → Orders (Isolation) (Flutter)
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt UPDATES Profile → Orders only.
It does NOT replace auth, store browse/create, classes, or other Profile sections.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE, JWT Bearer,
fonts (Cairo), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) PRODUCT (BINDING — own orders only)
═══════════════════════════════════════════════════════════════════

Profile → Orders shows ONLY the signed-in member's store orders.

FORBIDDEN:
- GET /api/member-orders          (staff inbox — all gym orders)
- Passing another member's id as an authorization source
- Trusting a client `memberId` query to change whose orders load
- Showing another member's order number, total, or items

ALLOWED:
- GET /api/member/orders
- GET /api/member/orders/{id}
- Legacy GET /api/member-store/orders (+ /{id}) only if already wired — prefer /member/orders

═══════════════════════════════════════════════════════════════════
1) LIVE API (STYLE A)
═══════════════════════════════════════════════════════════════════

API_BASE already ends with `/api`. Paths must NOT repeat `/api`.

Auth on every call:
  Authorization: Bearer <member JWT>
  ngrok-skip-browser-warning: true  (if using ngrok)

Policy: AuthenticatedMember (+ inventory feature when store is gated)

List:
  GET {API_BASE}/member/orders
  Optional query `memberId` is IGNORED by the server — do not send it.

Detail:
  GET {API_BASE}/member/orders/{id}
  Another member's id → 404 (no existence leak)

Identity resolve (server-side; you do not implement):
  JWT sub → AppUser.UserId → AppUser.Id → GymMember.AppUserId → GymMember.Id
  Do NOT compare JWT sub to GymMember.AppUserId in the app.

═══════════════════════════════════════════════════════════════════
2) UI REQUIREMENTS
═══════════════════════════════════════════════════════════════════

- OrdersSection on Profile (and /profile/orders deep link if present)
- Empty state: "No orders yet" / Arabic equivalent — NEVER show another member's data
- Error: 401 → re-auth; 400 unlinked profile → clear message; network → retry
- Detail: status, lines, totals; back to list
- Feature-gate: if inventory/store disabled, hide Orders section (same as store)

═══════════════════════════════════════════════════════════════════
3) MIGRATION FROM OLD PATHS
═══════════════════════════════════════════════════════════════════

If the app currently calls:
  GET /member-store/orders
  GET /member-orders
then:
  1) Point list/detail to GET /member/orders (+ /{id})
  2) Remove any staff inbox client
  3) Remove any UI that accepts/selects a memberId for "whose orders"

═══════════════════════════════════════════════════════════════════
4) ACCEPTANCE (FL-02)
═══════════════════════════════════════════════════════════════════

[ ] Profile Orders uses GET /member/orders (never /member-orders)
[ ] Member A never sees Member B's orders (manual + IDOR detail 404)
[ ] Empty list for a member with no orders is empty — not "all gym orders"
[ ] Unauthenticated → 401 handled
[ ] flutter analyze clean for touched files
```

---

## Task tracking

| ID | Status note |
| -- | ----------- |
| FL-02 | Prompt ready for Flutter implementation; mark DONE only after app ships |
| MB-02 | BLOCKED on FL-02 |
| QA-01 | E2E after FL-02 |
