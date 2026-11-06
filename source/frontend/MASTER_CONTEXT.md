# HyMotion — Master Context (paste into every coding session)

> **Usage:** Paste this entire file at the start of a new session. Then paste **only one** feature
> section (or feature prompt) for the current task. Do **not** paste other feature sections.
>
> **Authority:** Wire types/routes from `FRONTEND_API_CONTRACTS.ts`. Visuals from
> `design-tokens.json` + `design-system.html`. This Master Context is cross-cutting behavior only —
> no feature screens, no endpoint catalogs beyond §0.

---

## Stack

- React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- React Query for server state; Zustand for UI state
- RTL / Arabic-first bilingual UI (EN + AR)

---

## Transport (§0.1)

- All REST under `/api/...`
- SignalR hub at `/hubs/attendance` (WebSocket; client negotiation fallback)
- Authenticate SignalR with `?access_token=<JWT>` on the handshake (paths starting with `/hubs` only)
- Hangfire `/hangfire` is ops-only — not a frontend integration point

---

## Tenancy (§0.2)

- After login, JWT claim `gym_code` resolves the tenant — **no `X-Gym-Code` header** on normal authenticated calls
- `X-Gym-Code` is only a rare pre-auth fallback
- Store `gymCode` at login only for display / pre-auth UX (e.g. login screen), not because the API needs it as a header afterward
- Missing/invalid/inactive tenant → **401**

---

## Auth & Session (§0.3)

- Staff: `POST /api/auth/login` (email + password + gymCode)
- Member: `POST /api/auth/member-otp` then `POST /api/auth/member-verify`
- Access token: **15 minutes**; refresh token: **30 days**, rotating (old refresh revoked on issue)
- Persist: `accessToken`, `refreshToken`, `expiresAtUtc`, `user` from `LoginResponse`
- On **401** with response header `Token-Expired: true` → silent refresh once, then retry the request
- Refresh failure → **hard logout** (never retry refresh in a loop; never keep a stale refresh token)
- Persist the newest token pair immediately after every successful refresh
- JWT claims used by the client: `sub`, `tenant_id`, `gym_code`, `role`, `perm` (and name/email as needed)
- **Contract correction (verified):** the backend does **not** emit a `member_id` claim. Member-scoped
  identity is JWT `sub`. Never require or send `member_id`.

---

## Permissions (§0.4)

Dual layer — either may gate an endpoint:

**A. Role policies**

| Policy | Requirement |
|---|---|
| `OwnerOnly` | role = Owner |
| `ManagerOrAbove` | role = Owner or Manager |
| `AnyStaff` | role = Owner, Manager, Trainer, or Receptionist *(per contracts; Receptionist included)* |
| `AuthenticatedMember` | role = Member |
| `AnyAuthenticated` | any valid JWT |

**B. Fine-grained `perm` claims (17):**

`members.view`, `members.create`, `members.edit`, `checkin.manual`, `sales.sell`,
`sales.discount.apply`, `sales.discount.override`, `payments.cash.accept`,
`payments.refund.request`, `payments.refund.approve`, `shift.open`, `shift.close`,
`shift.reconcile.approve`, `memberships.freeze`, `plans.manage`, `reports.financial.view`,
`settings.manage`

- Gate UI from the login response / decoded `perm` + `role` claims
- Permissions are baked into the token at login — role/perm changes apply only after next login/refresh
- **403** = “shouldn’t have been reachable” — do **not** parse a 403 body for a reason code
- Receptionist capabilities come from issued `perm` claims, not from the role name alone

---

## Error Envelope (§0.5)

Parse order:

1. **ProblemDetails** — `{ title, detail, status, ... }` (`title` = machine code; `detail` = bilingual EN/AR display text)
2. Else **ad-hoc** — `{ error }` and/or `{ message }`

Do not assume one shape API-wide. Do not build against legacy `ErrorResponse`.

### Machine-readable code catalog (verbatim)

| Service | Codes |
|---|---|
| Sales | `STAFF_USER_NOT_FOUND`, `MEMBER_NOT_FOUND`, `MEMBER_CREATE_FAILED`, `PLAN_NOT_FOUND`, `FORBIDDEN_DISCOUNT_OVERRIDE` (→403), `OVERPAY`, `PAYMENT_INCOMPLETE`, `OPEN_SHIFT_REQUIRED` (→409), `PROMO_RACE_LOST`, `SALE_NOT_FOUND`, `PAYMENT_EXCEEDS_AMOUNT_DUE`, `INSUFFICIENT_CREDIT` |
| Shifts | `STAFF_USER_NOT_FOUND`, `SHIFT_ALREADY_OPEN` (→409), `NO_OPEN_SHIFT` (→409), `SHIFT_NOT_FOUND` (→404), `NOT_AWAITING_APPROVAL` (→409), `MANAGER_APPROVAL_REQUIRED` (→403), `INVALID_MOVEMENT_TYPE`, `SHIFT_NOT_OPEN` (→409) |
| Refunds | `STAFF_USER_NOT_FOUND`, `SALE_NOT_FOUND` (→404), `REFUND_NOT_FOUND` (→404), `REFUND_EXCEEDS_REMAINDER`, `SALE_FULLY_REFUNDED` (→409), `NOT_AWAITING_APPROVAL` (→409), `SELF_APPROVAL_FORBIDDEN` (→403), `OPEN_SHIFT_REQUIRED` (→409), `GATEWAY_REFUND_UNSUPPORTED` (→409), `INSUFFICIENT_CREDIT` |
| Trials | `PLAN_NOT_FOUND` (→404), `PLAN_NOT_TRIAL`, `TRIAL_ALREADY_USED` (→409), `OTP_INVALID`, `PENDING_TRIAL_NOT_FOUND` (→404), `STAFF_USER_NOT_FOUND` |
| Debtors | `MEMBER_NOT_FOUND` (→404), `NO_OUTSTANDING_BALANCE` (→404), `REMINDER_THROTTLE` (→429) |
| Call Sheet | `MEMBERSHIP_NOT_FOUND` (→404), `STAFF_USER_NOT_FOUND` (→404), `INVALID_OUTCOME` |
| Imports | `BATCH_NOT_FOUND` (→404), `INVALID_STATUS`, `FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `UNSUPPORTED_FILE_TYPE`, `ROLLBACK_WINDOW_EXPIRED` |
| Import row errors (per-row, comma-joined in `ImportRow.ErrorCodes`) | `PHONE_INVALID`, `PHONE_DUP_FILE`, `PHONE_EXISTS`, `PLAN_UNMATCHED`, `DATE_RANGE_INVALID`, `RETAINED_HAS_ACTIVITY`, `ROLLED_BACK` |
| Z-Reports | `ZREPORT_NOT_FOUND` (→404) |
| Promo validation (`POST /api/sales/validate-promo` failure body's `FailureReason` field, not a ProblemDetails title) | `CODE_NOT_FOUND`, `CODE_INACTIVE`, `DATE_RANGE_INVALID`, `MAX_USES_REACHED`, `MEMBER_MAX_USES_REACHED`, `PLAN_NOT_IN_SCOPE`, `BELOW_MIN_PRICE`, `PLAN_NOT_FOUND` |
| Feature flags | `FEATURE_DISABLED` (→404, ProblemDetails) |

Where a status code isn’t annotated above, default is **400 Bad Request**.

---

## Pagination (§0.6)

```json
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0,
  "hasNext": false,
  "hasPrevious": false
}
```

- Query: `?page=1&pageSize=20` (1-based)
- Not every list is paged — only use `PagedResult` where the feature contract says so

---

## Idempotency (§0.7)

- **Only** `POST /api/sales` supports idempotency keys
- Send via `X-Idempotency-Key` header **or** body `idempotencyKey` — **header wins** if both are set
- Same key → original `SaleResponse` with `isReplay: true`; safe to retry on network ambiguity
- Do not invent idempotency for any other endpoint

---

## Feature Flags (§0.8 / §24)

- Flagged modules: `sales`, `shifts`, `trials`, `refunds`, `debtors`, `imports` (all default **enabled**)
- **Call Sheet is never flag-gated**
- No frontend read/write API for flags — do not build a settings toggle for them
- On `404` + `title: "FEATURE_DISABLED"` → treat as “module does not exist for this tenant”; **hide nav/section**
- Probe each relevant module’s cheapest primary endpoint **once per session**, cache availability locally

---

## Real-time (§0.9) — cross-cutting only

- One hub, one event: `MemberCheckedIn` on `/hubs/attendance`
- Auto-joined to `tenant-{tenantId}` — no client subscribe call
- Best-effort only — never depend on the push for correctness; reconcile with re-fetch
- Payload shape: follow `MemberCheckedInEvent` in `FRONTEND_API_CONTRACTS.ts` (not older narrative field names)

---

## Session Rules

1. Master Context = cross-cutting only. Feature details come from the **single** section pasted for this prompt.
2. Do not preemptively build screens out of order.
3. Prefer `FRONTEND_API_CONTRACTS.ts` over prose when types/routes conflict.
4. Prefer HyMotion design tokens/system for UI; do not invent a second visual language.
5. After each merged PR, append a line under `## PROGRESS` as:
   `DONE — Prompt N — YYYY-MM-DD — <PR link>`

---

## PROGRESS

| # | Prompt | Status |
|---|---|---|
| 0 | Master Context (this file) | DONE — 2026-07-13 — (local) |
| 1 | API Client & Auth Infrastructure (§0 + §1) | DONE — 2026-07-13 — (local: `apps/admin`) |
| 2 | App Shell, Routing & Permission Gating (§0.4 / §0.8 / §24) | DONE — 2026-07-13 — (local: `apps/admin`) |
| 3 | Member Management (§2) | DONE — 2026-07-14 — (local: `apps/admin`) |
| 4 | Membership Plans (§3) | done |
| 5 | Memberships Assign / Renew (§4) | done |
| 6 | Attendance + SignalR (§5 + §0.9) | done |
| 7 | Cash Drawer / Shifts (§8) | pending |
| 8 | Point of Sale + Promo Codes (§6 + §7) | pending |
| 9 | Refunds & Account Credit (§9) | pending |
| 10 | Invoices & Receipts (§10) | pending |
| 11 | Daily Z-Report (§11) | pending |
| 12 | Trials / Debtors / Call Sheet (§12–14) | pending |
| 13 | Bulk Import (§15) | pending |
| 14 | Analytics + Reports (§16 + §17) | pending |
| 15 | Audit Log + Staff Admin (§18 + §19) | pending |
| 16 | Tenant Settings & Tax (§20) | pending |
| 17 | Member App: Auth + QR (§1 + §5) | pending |
| 18 | Member App: Notifications (§21) | pending |
| 19 | Member App: Invitations (§22) | pending |

<!-- Append DONE lines below as PRs merge, e.g.:
DONE — Prompt 1 — 2026-07-14 — https://github.com/.../pull/123
-->
