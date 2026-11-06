# HyMotion — Frontend Build Walkthrough
### How to apply every section of `FRONTEND_INTEGRATION_PROMPTS.md` with an AI coding assistant

This walkthrough turns the 24-section integration contract into an ordered, one-prompt-per-PR
execution plan — the same discipline used for the backend prompt pack: **Master Context first,
one prompt per PR, append a DONE line after each merge.**

Two apps are built from this document:

- **Admin Dashboard** — React 18 + TypeScript + Vite + Tailwind + shadcn/ui (Prompts 1–16)
- **Member App** — React Native + Expo (Prompts 17–19)

---

## Step 0 — Build the Master Context Prompt (do this once, reuse every session)

Before any feature prompt, paste a Master Context into every new coding session. It is assembled
almost entirely from **§0 (Cross-Cutting Concerns)** of the integration doc. It must contain:

1. **Stack declaration:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, React Query (server
   state), Zustand (UI state), RTL/Arabic-first bilingual UI.
2. **Transport rules (§0.1):** all REST under `/api`, SignalR at `/hubs/attendance` with
   `?access_token=` on the handshake.
3. **Tenancy rule (§0.2):** JWT carries `gym_code` — no tenant header needed after login. Store
   `gymCode` only for display/pre-auth.
4. **Auth rules (§0.3):** 15-min access token, 30-day rotating refresh token, refresh interceptor
   triggered by `401 + Token-Expired: true` header, refresh failure = hard logout (never retry).
5. **Permission model (§0.4):** dual-layer — role policies AND `perm` claims. UI gates from the
   login response's claims; 403 = "shouldn't have been reachable," never parsed for a reason.
6. **Error envelope handler (§0.5):** parse `title`/`detail` (ProblemDetails) first, fall back to
   `error`/`message`. Include the full machine-readable code catalog table verbatim.
7. **Pagination convention (§0.6):** `PagedResult<T>` shape, `?page=&pageSize=`, 1-based.
8. **Idempotency (§0.7):** only `POST /api/sales` supports it; key via header or body, header wins.
9. **Feature flags (§0.8, §24):** `FEATURE_DISABLED` 404 = hide the module; probe once per session
   and cache availability; Call Sheet is never flag-gated.
10. **Session hygiene footer:** a `## PROGRESS` block listing every prompt below; after each merged
    PR, append `DONE — Prompt N — <date> — <PR link>`.

> **Rule:** the Master Context never contains feature details. Feature details come only from the
> single section you paste for the current prompt. This keeps context small and prevents the
> assistant from prematurely building screens out of order.

---

## Phase 1 — Foundation (nothing else works without this)

### Prompt 1 — API Client & Auth Infrastructure  *(§0 + §1)*
- **Paste:** Master Context + full §1 (Authentication & Session Management).
- **Build:** typed API client (axios/fetch wrapper) with: bearer injection, silent-refresh
  interceptor keyed on `Token-Expired: true`, dual-shape error parser, `PagedResult<T>` generic,
  token/user persistence, staff login screen (email + password + gymCode), member OTP flow stubs.
- **Gotchas:** persist the *newest* refresh token immediately (rotation revokes the old one);
  refresh failure = logout, not retry.
- **Done when:** §1 acceptance criteria pass — a login token succeeds against a permissioned
  endpoint; an expired token silently refreshes at least once transparently.

### Prompt 2 — App Shell, Routing & Permission Gating
- **Paste:** Master Context + §0.4 table + §0.8/§24.
- **Build:** authenticated layout, role/permission-driven nav (Owner/Manager/Trainer/Receptionist),
  a `useCan(permission)` hook reading `perm` claims, feature-flag availability probe + cached
  module registry, RTL toggle, bilingual message display convention (`message` / `messageAr`).
- **Done when:** a Receptionist token hides plans/settings nav; a `FEATURE_DISABLED` probe hides
  the module entirely (never clickable-but-broken).

---

## Phase 2 — Core Entities

### Prompt 3 — Member Management  *(§2)*
- **Prereq:** Prompts 1–2.
- **Build:** paged/searchable member list, member profile (embedded `currentMembership`, 5-item
  `recentAttendance`, credits card), create/edit forms, freeze/unfreeze, Owner-only deactivate.
- **Gotchas:** DELETE is `OwnerOnly` role policy, not a `members.*` permission — a full-permission
  Manager still can't deactivate. Re-fetch the list after mutations (`ActivePlan`/`MembershipStatus`
  are server-derived). `currentMembership: null` is a valid state.
- **Done when:** §2 acceptance criteria pass.

### Prompt 4 — Membership Plans  *(§3)*
- **Build:** plans list + type-driven create/edit form (conditional fields per `planType`),
  soft-delete with a distinct 409 "plan in use" message.
- **Gotchas:** reading plans requires `plans.manage` — flag this now: any sales-screen plan picker
  for a lower-privilege role has no read-only endpoint. `session_pack` count ∈ {10, 20, 50};
  `time_limited` needs both time bounds; `TimeOnly` serializes as `"HH:mm:ss"`.
- **Done when:** §3 acceptance criteria pass.

### Prompt 5 — Memberships: Assign / Renew  *(§4)*
- **Build:** current-membership panel, paged history, assign (blocked with distinct 409 if one is
  active), renew (no start date supplied — backend chains from prior `EndDate`).
- **Gotchas:** payment-method sets differ between assign and renew; gateway methods leave a
  `pending` membership with **no push** — build an explicit "waiting for payment / refresh"
  affordance (§23). A non-null `current` response may be the *last expired* membership.
- **Done when:** §4 acceptance criteria pass.

---

## Phase 3 — Check-In & Live Dashboard

### Prompt 6 — Attendance: Manual Check-In + Live Dashboard  *(§5 + §0.9)*
- **Build:** manual check-in screen (member search honoring `isSelectable` + bilingual
  unselectable reasons, reason enum 1–4, notes required client-side for "Other"), today's
  attendance dashboard, SignalR connection joining `tenant-{tenantId}` and merging
  `MemberCheckedIn` pushes optimistically with periodic reconciliation re-fetch.
- **Gotchas:** the push is best-effort — never depend on it for correctness. Confirm the exact
  route/policy for manual check-in against `AttendanceController` before wiring (the doc flags
  this as unverified). 429 body is a raw bilingual string — parse defensively.
- **Done when:** §5 acceptance criteria pass.

---

## Phase 4 — Money Path (strict order: Shifts → Sales → Refunds → Invoices → Z-Report)

### Prompt 7 — Cash Drawer / Shifts  *(§8)*
- **Why first:** cash sales and cash refunds 409 with `OPEN_SHIFT_REQUIRED` — shift state must
  exist before the POS screen does.
- **Build:** open shift (float), current-shift view (blind: `expectedCash` is genuinely null —
  never compute it client-side from movements), movements form (`paid_in`/`paid_out`/`float_adjust`
  sign rules), blind-count close revealing variance, approve, force-close, shifts history,
  open-summary card.
- **Gotchas:** four distinct 409 codes each need a distinct message; `paid_out` above the tenant
  threshold is the API's only *conditional* permission check.
- **Done when:** §8 acceptance criteria pass — the count UI can never see or derive the expected
  total before submit.

### Prompt 8 — Point of Sale  *(§6 + §7)*
- **Build:** POS flow (plan → existing/new member → promo validate-then-apply → permission-gated
  manual discount → split payment legs incl. `account_credit` → explicit partial-payment opt-in),
  promo-codes CRUD screen, debt-payment recording (`POST /api/sales/{id}/payments`).
- **Gotchas:** generate one idempotency key per user submit and reuse it across retries.
  `PROMO_RACE_LOST` at submit ≠ preview failure — clear/re-validate the code. Underpay without
  `partialPayment` = `PAYMENT_INCOMPLETE`. Check shift state *before* showing the screen.
  `invoiceStatus: "queued"` means the invoice does not exist yet. `warnings[]` are non-blocking.
- **Done when:** §6 + §7 acceptance criteria pass — same key never double-sells; no-shift attempt
  is pre-empted.

### Prompt 9 — Refunds & Account Credit  *(§9)*
- **Build:** request → approve/reject workflow, refunds list (flat, filterable), credit ledger
  surfaced on the member profile (already stubbed in Prompt 3).
- **Gotchas:** hide or clearly disable the `gateway` method (`GATEWAY_REFUND_UNSUPPORTED` is
  guaranteed today). `SELF_APPROVAL_FORBIDDEN` except Owner. Null `creditNoteInvoiceId` on
  credit-method refunds is correct, not a bug. Re-fetch sale + credits after approval.
- **Done when:** §9 acceptance criteria pass.

### Prompt 10 — Invoices & Receipts  *(§10)*
- **Build:** filtered/paged invoice list, invoice detail (snapshotted values), void
  (`payments.refund.approve`), resend, 80mm receipt via iframe/webview print of the raw HTML
  (with `?paymentId=` for debt-payment receipts — no new invoice number).
- **Gotchas:** null `pdfUrl` = "not ready yet," not error. Credit-note `total` is stored positive —
  `type` drives netting, never the sign.
- **Done when:** §10 acceptance criteria pass.

### Prompt 11 — Daily Z-Report  *(§11)*
- **Build:** date-picker report view, PDF download, Manager+ regenerate.
- **Gotchas:** 404 `ZREPORT_NOT_FOUND` for today-before-23:59-Cairo is normal — render "not yet
  available," not an error. Immutable snapshot; only regenerate changes it.
- **Done when:** §11 acceptance criteria pass.

---

## Phase 5 — Front-Desk Operations

### Prompt 12 — Trials + Debtors + Call Sheet  *(§12 + §13 + §14)*
Three small modules, one PR (or split if sessions run long):
- **Trials:** initiate (name/phone/trial-plan) → OTP confirm → seed the profile view directly from
  the confirm response. `TRIAL_ALREADY_USED` keyed by phone.
- **Debtors:** paged list, KPI summary card (needs `reports.financial.view` separately), throttled
  remind (429 = "already reminded recently"), CSV export as an explicit action only.
- **Call Sheet:** expiring list (`days` param), closed 4-value outcome logging, renewal-rate report
  (**`staffUserId` is the domain `AppUser.Id`, not the JWT `sub`** — resolve it first). Not
  feature-flag-gated.
- **Done when:** all three sections' acceptance criteria pass.

### Prompt 13 — Bulk Import Wizard  *(§15)*
- **Build:** template download → upload (≤5 MB, ≤10,000 rows) → mapping review/override (always
  render the *server's* current mapping) → dry-run error review + errors.csv → execute (ack only —
  poll batch status) → create-missing-plans branch → rollback (7-day window).
- **Gotchas:** `status` on `ImportBatchDto` is the single source of truth for which wizard step to
  show — never local wizard state. Double-execute is safe (idempotent sweep).
- **Done when:** §15 acceptance criteria pass.

---

## Phase 6 — Insight & Administration

### Prompt 14 — Analytics + Detailed Reports  *(§16 + §17)*
- **Build:** overview KPIs displaying `snapshotTimeUtc` ("as of HH:mm"), revenue chart
  (parallel `labels`/`values` arrays — feed the chart lib directly), Mon-first 7×24 heatmap,
  status pie, invitation funnel, trial cohort funnel (`month` required); plus live drill-downs:
  attendance summary, revenue detail (narrow default date range — no pagination), top-5 peak
  hours, retention.
- **Gotchas:** §16 is snapshot-based (don't poll aggressively); §17 is live per-request. Permission
  split means a Trainer sees heatmap/status/invitations but not money views. All-zero = empty
  state, not error.
- **Done when:** §16 + §17 acceptance criteria pass.

### Prompt 15 — Audit Log + Staff Admin  *(§18 + §19)*
- **Build:** filterable paged audit table with a **generic JSON diff viewer** for
  `beforeJson`/`afterJson` (raw strings — parse client-side); Owner-only staff CRUD +
  password reset. Never offer `owner` as a creatable role.
- **Gotchas:** null `actorUserId` = system/Hangfire action. Verify role-string casing against a
  real create call before hard-coding (doc flags lowercase-vs-PascalCase ambiguity). Deactivation
  is not instant lockout — sessions live ≤15 min.
- **Done when:** §18 + §19 acceptance criteria pass.

### Prompt 16 — Tenant Settings & Tax  *(§20)*
- **Build:** Owner settings form (gymCode read-only), tax/VAT config (audited), plus the two
  any-authenticated conveniences: gym-code display and QR-poster fetch for front-desk print.
- **Done when:** §20 acceptance criteria pass.

---

## Phase 7 — Member App (React Native / Expo)

### Prompt 17 — Member Auth + QR Check-In  *(§1 member flow + §5 QR)*
- **Build:** gymCode entry → phone OTP login (same refresh mechanics), camera scan of the gym's
  static QR → `POST /api/attendance/qr-checkin` with `{ gymCode }` only (identity from JWT) →
  green/red bilingual result screen with `sessionsRemaining` for session packs.
- **Gotchas:** rate limiter is per-IP — gym Wi-Fi NAT shares the bucket; handle 429 gracefully.

### Prompt 18 — Member Notifications Inbox  *(§21)*
- **Build:** paged inbox (member JWT only — staff tokens 401 here), optimistic mark-as-read with
  reconciliation. Staff bulk-send composer goes in the **admin** app (Manager+, one targeting
  mode: `memberIds` OR `allMembers`).

### Prompt 19 — Guest Invitations  *(§22)*
- **Build:** send form (name/phone/visit date), quota display driven entirely by the response's
  `quotaUsed`/`quotaRemaining` (never computed client-side from the plan), flat history list with
  defensive status mapping.
- **Gotchas:** route is singular `/api/invitation` — do not "fix" it.

---

## Cross-Cutting Verification Pass (final prompt of each phase)

After each phase, run a short verification session pasting only the Master Context + the phase's
acceptance-criteria bullets, asking the assistant to write/execute:
- error-envelope tests (both shapes, plus the specific 409/429/403 codes for that phase),
- a permission matrix test (each role token vs. each new endpoint),
- for the money phase: the idempotency replay test and the no-shift 409 pre-emption test.

---

## Progress Tracker (copy into Master Context)

```
## PROGRESS
Prompt 1  — API Client & Auth ................ [x] apps/web
Prompt 2  — Shell, Routing, Permissions ...... [x] apps/web
Prompt 3  — Members .......................... [x] apps/web
Prompt 4  — Plans ............................ [x]
Prompt 5  — Memberships Assign/Renew ......... [x]
Prompt 6  — Attendance + SignalR ............. [x]
Prompt 7  — Shifts ........................... [ ]
Prompt 8  — POS + Promo Codes ................ [ ]
Prompt 9  — Refunds & Credit ................. [x] apps/web
Prompt 10 — Invoices & Receipts .............. [x] apps/web
Prompt 11 — Z-Report ......................... [x] apps/web
Prompt 12 — Trials / Debtors / Call Sheet .... [x] apps/web
Prompt 13 — Bulk Import ...................... [x] apps/web
Prompt 14 — Analytics + Reports .............. [x] apps/web
Prompt 15 — Audit + Staff Admin .............. [x] apps/web
Prompt 16 — Settings & Tax ................... [x]
Prompt 17 — Member App: Auth + QR ............ [ ]
Prompt 18 — Member App: Notifications ........ [ ]
Prompt 19 — Member App: Invitations .......... [ ]
```

---

## Session Rules (same discipline as the backend pack)

1. **One prompt = one PR.** Never let the assistant "also start" the next module.
2. **Paste order every session:** Master Context → PROGRESS block → the single feature section
   from `FRONTEND_INTEGRATION_PROMPTS.md` → the prompt's build/gotcha list from this walkthrough.
3. **Acceptance criteria are the definition of done** — quote them back to the assistant and
   require it to demonstrate each one before closing the PR.
4. **Backend is the source of truth.** Where the integration doc flags something unverified
   (manual check-in policy, staff role casing, invitation status set), have the assistant confirm
   against the live API or controller code inside that prompt's session — never assume.
5. After merge: append the `DONE` line, update the tracker, start a fresh session.
