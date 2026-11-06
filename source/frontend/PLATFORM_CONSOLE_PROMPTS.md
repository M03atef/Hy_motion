# HyMotion Platform Console — Prompt Pack (Backend-Aligned)

Use this pack instead of the original PF assumptions. Paste **Prompt 0** at the start of every session (Stage 1 + Stage 2 sections), then one task prompt. One prompt ≈ one PR.

**App location:** `Frontend/apps/platform-console` (npm workspace). Never share auth/session with `apps/admin` or `apps/web`.

---

## PROMPT 0 — Master Context

```
You are a senior frontend engineer building the "HyMotion Platform Console" — a standalone internal Vite React app at Frontend/apps/platform-console. It is used ONLY by GymFlow employees (platform_support | platform_ops | platform_admin). It must never share auth state with the tenant admin dashboard.

STACK: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand (UI-only), React Router.
VISUAL: darker slate theme + persistent "HyMotion Platform Console — Internal" strip on every screen.

CONFIRMED BACKEND CONTRACT (CP0–CP3 + Stage 1 read APIs):
- Base: /platform-api/*
- Auth audience: gymflow-platform. Access token ~10 min. NO refresh token — on 401 wipe memory token and redirect to /login.
- POST /platform-api/auth/login { email, password, mfaCode? }
  → 200 success + accessToken + user
  → 403 { mfaSetupRequired: true, setupToken, otpAuthUri, mfaManualKey, errorCode: "MFA_SETUP_REQUIRED" }
  → 401 { errorCode: "MFA_REQUIRED" | "MFA_INVALID" | "INVALID_CREDENTIALS", errorMessage }
- POST /platform-api/auth/mfa/setup { setupToken, mfaCode } → accessToken on success
- MFA challenge = re-submit the SAME login endpoint with mfaCode (hold email/password in memory). No mfaChallengeToken.
- GET /platform-api/tenants?status=&tier=&riskBand=&search=&page=&pageSize= → PlatformPagedResult (items include riskBand, healthScore, lastLoginAtUtc from CP7 list seam)
- GET /platform-api/tenants/{id} → PlatformTenantDetailDto (subscription nested)
- GET /platform-api/tenants/{id}/subscription/changes → SubscriptionChangeDto[]
- GET /platform-api/tenants/{id}/invoices → PlatformInvoiceDto[]
- POST /platform-api/tenants/provision (Ops+) → ProvisionTenantResponse { tenantId, gymCode, ownerUserId, ownerEmail, trialStarted, trialError? }
- GET /platform-api/risk-queue?band= → RiskQueueItemDto[]
- GET /platform-api/metrics/{mrr|movement|churn|conversion|tier-distribution}
- All JSON camelCase. Dates: DateOnly as yyyy-MM-dd; DateTime as ISO UTC — render Africa/Cairo.
- Money: "2,199.00 EGP". Stage 1 UI is READ-ONLY (no suspend/cancel/tier-change buttons even if mutation APIs exist).

HARD RULES:
- Access token in memory only (never localStorage/sessionStorage).
- Never accept or send a tenant-scoped JWT.
- Loading / error / empty states on every data view.
- No Stage 2 affordances until a Stage 2 prompt explicitly asks for them.

--- STAGE 2 CONTEXT (append; do not replace Stage 1) ---

The Stage 2 backend (Control Plane workstreams CP4–CP9) is now assumed live. Unlike Stage 1, these endpoints WERE specified with real shapes in the backend implementation plan — treat them as a real contract, not a guess, but still confirm field-level details against the actual controllers before merging since implementation may have adjusted minor details.

KEY ARCHITECTURAL RULE FOR STAGE 2: the backend's CP6 tenant-detail endpoint (GET /platform-api/tenants/{id}) is EXTENDED in Stage 2 to include usageCounters, health (+ contributingFactors), featureOverrides, priceOverrides, and recentAudit (platform_audit_log) — all in the SAME response used since Stage 1's PF4. Do NOT create parallel fetches for each new panel. Extend the existing TypeScript type and the existing React Query hook from PF4, and add new UI sections that read from fields already present in that one call. Waterfalling four separate requests for one page is the specific mistake to avoid here. (Subscription changes + invoices remain the existing separate Stage 1 fetches if already wired that way — do not also re-fetch detail fields.)

ROLE GATING IS NOW REAL:
- Conceptual matrix from product: platform_support (view + impersonate + notes), platform_ops (+ suspend/reactivate/extend-trial), platform_admin (+ coupons/feature-overrides/tier changes).
- LIVE CONTROLLER GATE (confirm before merge — as of GMS.Api):
  - PlatformSupportOrAbove: list, detail, impersonate, list feature-overrides
  - PlatformOpsOrAbove: coupon, extend-trial, force-suspend, force-reactivate, upsert/delete feature-overrides
  - PlatformAdminOnly: subscription change-tier / cancel (PlatformSubscriptionController)
  Note: coupons + feature-override writes are Ops+ on the live API, not Admin-only. Prefer the live controller policies for UI gating; if product wants Admin-only coupons later, that is a backend policy change first.
- Every action button must be gated BOTH by hiding/disabling in the UI AND by expecting a 403 from the backend if somehow reached anyway (defense in depth — backend is the real authority).
- When an action is unavailable due to role, do not hide it silently — show it disabled with a tooltip like "Requires Platform Ops" / "Requires Platform Admin" so support knows to escalate rather than assuming it is broken.

Wait for the task prompt. Do not scaffold Stage 2 UI until a PF7+ task asks for it.
```

### DONE log

- [x] Backend Stage 1 read APIs
- [x] PF1 scaffold + auth
- [x] PF2 MFA
- [x] PF3 tenant list
- [x] PF4 tenant detail
- [x] PF5 shell / client / env
- [x] PF6 tests + QA
- [x] PF7 Usage panel (usageCounters on existing detail query)
- [x] PF8 Health Score panel (health + contributingFactorsJson on same detail query)
- [x] PF9 Actions panel (mutations + role gating + confirm modals)
- [x] PF10 Impersonation + audit trail + shell session indicator
- [x] **PF11** Tenants list enrichment (riskBand / healthScore / lastLogin + filters)
- [x] **PF12** Subscription data integrity + list billing empty-state
- [x] **PF13** Provision gym from console (Ops+)
- [x] **PF14** Risk Queue page
- [x] **PF15** Business Metrics (MRR / churn) page

> Gap bridge prompts (PF11–PF15) come from the Aug 2026 QA audit of `/tenants?page=1` vs live CP6/CP7/CP8 APIs. Paste **Prompt 0** (above) + one PF prompt per session. One prompt ≈ one PR.

---

## PF1 — Scaffold + Login + Memory Token

Scaffold Vite app; slate/dark theme; internal strip; login form calling real login contract; route to `/mfa-setup` or `/mfa-challenge`; Zustand auth with memory-only access token; protected route guard preserving return URL.

## PF2 — MFA Setup & Challenge

`/mfa-setup`: QR from `otpAuthUri`, show `mfaManualKey`, OTP input → `POST .../mfa/setup`.
`/mfa-challenge`: OTP → login with stored email/password + `mfaCode`. Distinct wrong-code vs expired-setup errors. Clock-drift hint.

## PF3 — Tenant List

`/tenants` via TanStack Query + URL search params for filters. Badges for tier/status. Skeleton/empty/error. Row → `/tenants/{id}`.

## PF4 — Tenant Detail (Read-Only)

Header + subscription panel + history + invoices. View PDF when `pdfUrl` present. No action buttons. Preserve list filters on back.

## PF5 — Shell, API Client, Env, README

Nav config (Tenants only). Client attaches memory Bearer; 401 → logout. Vite proxy `/platform-api`. Env files + README (subdomain + VPN note).

## PF6 — Tests & Hardening

Auth state machine + route guards + MSW list/detail. Manual QA checklist (no refresh-token item). axe pass.

## PF7 — Usage Panel (done)

Extend `PlatformTenantDetailDto.usageCounters` (live flat shape). `UsagePanel` derives period/metrics client-side from the existing `fetchTenantDetail` query — no new network call. Progress bars green/amber/red; null cap → Unlimited; WhatsApp overage note.

## PF8 — Health Score Panel (done)

Extend `PlatformTenantDetailDto.health` (live CP7 DTO). Parse `contributingFactorsJson` (rules_v1) into factor rows sorted by weight; null health → "Not yet computed". Same detail query as PF7.

## PF9 — Actions Panel (done)

First write surface: force-suspend / reactivate / extend-trial / coupon / feature-overrides. ConfirmDialog (native `<dialog>`) for every mutation; reason ≥10 chars where API takes reason. Role gate: Support sees suspend/reactivate/extend disabled+tooltip; coupon+overrides hidden (Ops+ per live API). Invalidate tenant detail on success.

## PF10 — Impersonation + Audit Trail (done)

Confirm-then-`POST .../impersonate { reason }` (backend patched to require reason). New-tab admin handoff via `?impersonation_token=`. Audit trail from `recentAudit` on detail (no extra fetch) with JSON diff. Shell banner for active support session. Tenant admin shows "GymFlow Support is assisting" banner.

---

# Gap Bridge — Remaining Stage 2 (PF11–PF15)

Audit baseline (`tenants-page-qa-audit` canvas): list works as PF3, but ops cannot triage billing/risk because (1) list TS types omit CP7 seam fields, (2) `riskBand` query param unused, (3) live rows often have null subscription, (4) no provision UI, (5) Risk Queue + Metrics APIs have no console pages.

---

## PF11 — Tenants List Enrichment

```
CONTEXT: Prompt 0. You are closing QA gaps on /tenants. Do NOT build Risk Queue or Metrics pages here (PF14/PF15). Do NOT build provision UI (PF13).

LIVE LIST CONTRACT (confirm in GMS.Platform/DTOs/PlatformTenantDtos.cs PlatformTenantListItemDto):
GET /platform-api/tenants?status=&tier=&riskBand=&search=&page=&pageSize=
Each item: id, name, gymCode, planTier?, status?, billingCycle?, currentPeriodEnd?, priceEgp?,
  riskBand?, healthScore?, lastLoginAtUtc?

TASK:
1. Extend PlatformTenantListItemDto in apps/platform-console/src/lib/api/types.ts with:
   riskBand?: RiskBand | null; healthScore?: number | null; lastLoginAtUtc?: string | null;
2. Extend TenantListParams + fetchTenants to pass riskBand (CSV like status/tier is fine if backend ParseCsv supports it — confirm PlatformTenantReadService).
3. TenantsListPage:
   - Add Risk band filter checkboxes: healthy | watch | at_risk | critical → URL ?riskBand=
   - Add table columns: Risk (badge), Score, Last login (Cairo). Null → em dash (reuse RiskBandBadge from HealthScorePanel if exported; else extract shared badge).
   - pageSize control in URL: 20 | 50 | 100.
   - Change subtitle from "read-only" to accurate ops wording (e.g. "Platform gyms — open a row for actions").
4. Preserve existing search / status / tier / pagination / keyboard row activation.
5. MSW fixtures + unit/smoke: list type includes new fields; riskBand param reaches request URL.

ACCEPTANCE:
- Network tab shows riskBand when filter selected.
- Columns render API values without TS errors.
- Empty subscription rows still show gym name/code/lastLogin without crashing.
- No new API endpoints. No detail-page changes unless extracting a shared badge component.
```

---

## PF12 — Subscription Data Integrity (List Billing Empty-State)

```
CONTEXT: Prompt 0. QA found all local list rows with planTier/status/priceEgp null; GET /tenants/{id} for GYM-TEST-01 returned subscription: null. List filters on status/tier are useless until data exists. This prompt is FULL-STACK: prefer backend fix + small FE callout. Confirm against PlatformTenantReadService.ListAsync + platform.subscriptions.

TASK (Backend — investigate then fix, preserve architecture):
1. Determine why dbo.tenants rows lack a live platform.subscriptions row (trial never started, wrong TenantId, cancelled only, etc.).
2. Ensure Production path POST /platform-api/tenants/provision always StartTrialAsync after commit (already intended) and surface trialError in response.
3. Add a DevOps-safe repair path if missing (choose ONE, document in PLATFORM_OPS_CHECKLIST.md):
   - Ops: documented script/API to StartTrial for orphan tenants, OR
   - Dev-only: one-shot backfill when listing detects orphan (NO silent production backfill).
4. Add/extend a test: after provision (or seed+StartTrial), ListAsync returns non-null PlanTier/Status for that tenant.

TASK (Frontend — small):
5. On TenantsListPage, if totalCount > 0 and every visible row has !status && !planTier, show a non-blocking Callout:
   "No billing subscription on these gyms — provision StartTrial or open Platform Ops checklist."
   Do not fake tier/status badges.

ACCEPTANCE:
- At least one newly provisioned gym appears on /tenants with status=trialing (or active) and a tier badge.
- Orphan-empty callout appears only when the page is genuinely all-null billing.
- No redesign of tenancy / EF filters.
```

---

## PF13 — Provision Gym (Ops+)

```
CONTEXT: Prompt 0. Backend already live: POST /platform-api/tenants/provision [PlatformOpsOrAbove].
Do not call DataSeeder. Confirm request/response in GMS.Application/DTOs/Provisioning/ProvisionTenantDtos.cs and PlatformTenantsController.

REQUEST (camelCase):
{
  name, nameAr?, city, address?, phoneNumber, email,
  gymCode?, timeZone?,
  ownerFullName, ownerEmail, ownerPassword,
  tier? // default growth
}
RESPONSE 201: { tenantId, gymCode, ownerUserId, ownerEmail, trialStarted, trialError? }

TASK:
1. API client: provisionTenant(body) → apiRequest POST TENANT_ENDPOINTS.provision (add to types).
2. TenantsListPage header: "Provision gym" button visible only for Ops+ / Admin (reuse platform-roles helper from Actions panel). Support: hide or disable with "Requires Platform Ops".
3. Modal or dedicated /tenants/provision route (prefer modal + ConfirmDialog pattern consistency with PF9 — form inside <dialog> or page; pick one and match existing console UI).
4. Client validation mirror backend: required fields, password min 8, email format. Optional gymCode leave blank to auto-generate.
5. On 201: toast success; if trialStarted===false show warning with trialError; invalidate ['tenants'] queries; navigate to /tenants/{tenantId}.
6. On 400: show server message (email taken, gym code taken, etc.).
7. Never log ownerPassword. Never store provision payload in localStorage.

ACCEPTANCE:
- Support cannot provision; Ops can.
- Happy path creates row visible on list after invalidate.
- MSW or integration test for role gate + success invalidate.
```

---

## PF14 — Risk Queue Page

```
CONTEXT: Prompt 0. CP7 API live. Controllers:
GET  /platform-api/risk-queue?band=          Support+  (default bands at_risk,critical if band omitted — confirm service)
POST /platform-api/risk-queue/{tenantId}/assign   Ops+  body: { assignedPlatformUserId: guid|null }
POST /platform-api/risk-queue/{tenantId}/outcome  Support+ body: { outcome, note? }

RiskQueueItemDto: tenantId, name, gymCode, planTier?, subscriptionStatus?, score, riskBand,
  computedAtUtc, assignedPlatformUserId?, assignedAtUtc?, contributingFactorsJson?, summary?, recentOutcomes[]

TASK:
1. Add nav item Risk Queue → /risk-queue in config/nav.ts + App routes.
2. RiskQueuePage: TanStack Query list; band filter URL ?band= (multi or single — match backend string).
3. Table: gym, code, tier, sub status, score, risk badge, computed (Cairo), assignee, summary.
4. Row open → /tenants/{tenantId} (reuse list filter preservation pattern).
5. Ops+: Assign / Clear assignee via ConfirmDialog. Support: record outcome (outcome enum — confirm allowed values in service/tests before hardcoding; if free string, validate non-empty + length).
6. Parse contributingFactorsJson lightly only if needed for expand row; prefer summary column for v1.
7. Loading / empty / error states. Role tooltips for Ops-only assign.

ACCEPTANCE:
- Page loads with Support token; assign returns 403 for Support and UI prevents it.
- Ops assign + outcome invalidate queue query.
- No duplicate health fetch for tenant detail — link out instead.
```

---

## PF15 — Business Metrics Page (CP8)

```
CONTEXT: Prompt 0. CP8 API live under /platform-api/metrics (Support+). Confirm DTO field names in GMS.Platform/DTOs (MrrSnapshotDto, MrrMovementDto, ChurnMetricsDto, ConversionMetricsDto, TierDistributionDto) before coding.

ENDPOINTS:
GET /metrics/mrr?asOf=
GET /metrics/movement?from=&to=   (both required)
GET /metrics/churn?from=&to=
GET /metrics/conversion?from=&to=
GET /metrics/tier-distribution?asOf=

TASK:
1. Nav item Metrics → /metrics.
2. MetricsPage with date controls (Cairo calendar defaults: asOf=today; from=first of month; to=today). URL sync optional but preferred.
3. Parallel TanStack queries (5) with independent loading/error — do not one giant fail.
4. Display (no card spam — one composition per section):
   - MRR / ARR snapshot + as-of label
   - Movement: new / expansion / contraction / churned MRR for range
   - Churn rate + cohort note if present
   - Trial→paid conversion
   - Tier distribution (counts + MRR by tier) — simple table or bar using existing slate styles (no new chart library unless already in package.json)
5. Money format: formatEgp. Annual MRR already normalized server-side (PriceEgp/12 for annual) — do not re-divide.
6. Empty/zero states when no paying tenants.

ACCEPTANCE:
- Support can view; no write actions.
- Missing from/to shows inline validation before calling movement/churn/conversion.
- Types mirrored from live JSON; MSW smoke optional.
```

---

## Suggested PR order

| Order | Prompt | Depends on |
|------:|--------|------------|
| 1 | PF12 (data) | none — unblock billing triage |
| 2 | PF11 (list UI) | PF12 ideal but can land in parallel |
| 3 | PF13 (provision) | PF12 helps verify trialStarted |
| 4 | PF14 (risk queue) | health job producing scores |
| 5 | PF15 (metrics) | paying subscriptions exist |

Manual QA after each PR: Platform Console logged in as `platform_admin` (Dev MFA bypass OK) → `/tenants?page=1` still works; no tenant JWT ever used.

