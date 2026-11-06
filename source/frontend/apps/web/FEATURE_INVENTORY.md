# apps/web — Feature inventory & incremental prompt rule

> When a feature prompt is pasted: **survey this file + the paths below first**.  
> If the screen already exists and works → **do not rebuild**. Ship only gaps.

## How to run
```bash
cd apps/web
npm run dev
```
- UI: http://localhost:3000  
- Login: http://localhost:3000/auth/login/  
- API default: `https://localhost:5001/api` via [`src/app/shared/api-config.js`](src/app/shared/api-config.js) (injected by [`server.js`](server.js))  
- Override: set `window.API_BASE` before other scripts, or edit `api-config.js`

## Incremental rule
1. Inventory paths below for the prompted feature.
2. **Exists / works** → ignore prompt rebuild; only bugs, API mismatches, unfinished pieces.
3. **Partial** → implement missing pieces only (same HTML/JS style).
4. **Missing** → add new screen following neighboring pages.

## Inventory

| Feature | Status | Primary paths |
|--------|--------|----------------|
| Staff login + refresh | Exists (Prompt 1) | `auth/login/` + `shared/api-client.js` — bearer, `Token-Expired` silent refresh, dual errors, `PagedResult` |
| Member OTP stubs | Exists (Prompt 1) | `auth/member-otp/` — wires `member-otp` / `member-verify` (full UX Prompt 17) |
| App shell / perm nav | Exists (Prompt 2A+2B) | `shared/nav.js` (`NAV_CATEGORIES`/`useVisibleNav`/`getDefaultLandingPath`); `shell.js` renders collapsible RTL categories + empty state; login lands on first visible item |
| Dashboard (Overview) | Exists (widget grid) | `index.html` + `dashboard-home.js` — per-widget `useCan()`: revenue+`snapshotTimeUtc` (`reports.financial.view`), checkins (`members.view`), my shift (`shift.open`), my sessions (`AnyStaff`/Trainer filter on `/pt-sessions`+`/classes`), front-desk queue (`checkin.manual`\|`sales.sell`), staff activity (`settings.manage`); empty → Front Desk Quick Actions from `useVisibleNav()` |
| Members list / CRUD | Exists (Prompt 3) | `members/` — paged/search list via `GfpApi`+`PagedResult`; create/edit gated by `members.*`; Egyptian phone normalize (`phoneToLocalInput` / `formatPhoneForApi`) |
| Member detail | Exists (Prompt 3) | `members/[id]/` — `currentMembership` null OK; recentAttendance×5; credits; freeze `memberships.freeze`; DELETE OwnerOnly; Assign uses member id (not bare `memberData`) |
| Memberships | Exists (Prompt 5) | `memberships/` + member detail — current panel (expired ≠ active), paged history, assign (409 if active), renew (no startDate; +vodafone_cash), gateway pending wait/refresh (§23); freeze gated `memberships.freeze`; filters `active|frozen|expired` only |
| Plans | Exists (Prompt 4) | `plans/` — list+CRUD via `GfpApi`+`plans.manage`; type-driven form (incl. trial/day_pass); soft-delete 409 "plan in use"; TimeOnly `HH:mm:ss`; session_pack ∈ {10,20,50} |
| Attendance | Exists (Prompt 6) | `attendance/` — manual check-in (`checkin.manual`; reason 1–4; notes required for Other); today (`members.view`); SignalR `/hubs/attendance` optimistic `MemberCheckedIn` + 15s reconcile; bilingual unselectable; 429 string-safe |
| Shifts (cash drawer) | Exists (Prompt 7) | `shifts/` — blind count; never derive expected while open |
| Point of Sale | Exists (Prompt 8) | `pos/` — shift gate, idempotency, promo, discounts, split/partial pay, debt payments |
| Promo codes | Exists (Prompt 8) — legacy | `promo-codes/` — list (`sales.sell`); CRUD (`plans.manage`). Prefer Offers. |
| Offers & Promotions | Live API (2026-08-14) | `offers/` — wizard + list + Member App frames; `GET/POST/PUT /api/offers`; members `GET /api/member/offers`; promo-code redemption syncs on publish |
| Products / Purchases (owner desk) | Product Accept 2026-08-14 (existing-desk) | Catalog: Products table + Suppliers table + Purchases. Qty on the product. Warehouses/transfers/counts/insights hidden. Engines remain. `SHOP_OWNER_UX` in `features.js`. Preview: `previews/products-simplify-from-existing.html` |
| Refunds & account credit | Exists (Prompt 9) | `refunds/` — request/approve/reject; filters; gateway disabled; member Credits tab |
| Invoices & receipts | Exists (Prompt 10) | `invoices/` — paged/filter list, detail, void, resend, 80mm receipt (`?paymentId=`) |
| Daily Z-Report | Exists (Prompt 11) | `z-report/` — date picker; 404→not yet available; PDF; Manager+ regenerate |
| Trials | Exists (Prompt 12) | `trials/` — initiate → OTP confirm → seed profile; `TRIAL_ALREADY_USED` |
| Debtors | Exists (Prompt 12) | `debtors/` — paged list, KPI (`reports.financial.view`), remind throttle, CSV action |
| Call sheet | Exists (Prompt 12) | `call-sheet/` — expiring, 4 outcomes, renewal-rate (AppUser.Id, not JWT sub) |
| Bulk import wizard | Exists (Prompt 13) | `imports/` — status-driven steps; template/upload/mapping/dry-run/execute/poll/create-plans/rollback |
| Reports | Exists (Prompt 14) | `reports/` — §16 snapshots + §17 live; Trainer sees heatmap/status/invites; money needs `reports.financial.view` |
| Audit log | Exists (Prompt 15) | `audit/` — filters/paging; null actor=system; client JSON diff |
| Notifications | Exists | `notifications/` |
| Staff admin | Exists (Prompt 15 gaps) | `staff/` — Owner-only; lowercase creatable roles (no owner); deactivate ≤15m note |
| Settings & tax (§20) | Exists (Prompt 16) | `settings/` — Owner gym (gymCode RO) + tax/VAT; any-auth gym-code + QR poster PDF |
| Coming-soon stub | Unused | `(dashboard)/coming-soon.html` |

## Gaps known (not rebuild targets for existing modules)
- Next: member-app prompts (17+) or migrate remaining pages to `GfpApi`
- Hardcoded nav notification badge `"3"` on some sidebars
- Plan list for POS/Trials requires `plans.manage` (no read-only plans API) — flagged Prompt 4; sales pickers for lower roles have no endpoint
- GET `/membership-plans` returns **active plans only** (soft-deleted drop from list)
- Other dashboard pages still use local `fetch` helpers — prefer `window.GfpApi` for silent refresh

## Out of scope
- `apps/admin` (Vite) unless explicitly requested
