# Reports — Architecture Audit

**Date:** 2026-08-18  
**Status:** First slice **implemented** 2026-08-18. Report Center landing live. Sales Report live (`?tab=sales`, `reports-app.js?v=sales1`). Z-Report aggregation unchanged.  
**Z-Report** is the shift closing document under Shifts, not a Reports tab. Desk `/dashboard/z-report/` lists shifts by OpenedAt and opens a per-shift closing report from shift-linked transactions. Closed cash expected/counted/difference are frozen on `Shift`. The nightly Cairo-day snapshot (`GET /api/reports/z/{date}`) is unchanged.

---

## Philosophy (keep)

| Surface | Answers |
|---|---|
| **Dashboard** | What’s happening now? |
| **Reports** | What happened? |
| **Z-Report** | What happened in this shift / Cairo day, and can I close or reconcile it? |

Reports must stay a small owner management area. Not an ERP/BI cube. Do not invent a second financial ledger.

**Source of truth (do not duplicate):**

```
Sale
SaleLine
PaymentTransaction
Refund
Membership
Product
Shift
Staff (AppUser)
        ↓
Reporting queries (read-only aggregations)
        ↓
Reports UI
```

---

## A. Current Reports architecture

### Current navigation (apps/web)

Canonical registry: `apps/web/src/app/shared/nav.js`. HTML sidebars on individual pages are leftovers; `shell.js` replaces them.

```
Overview
  Dashboard                         /dashboard/

Members
  Members                           /dashboard/members/
  Attendance                        /dashboard/attendance/

Front desk
  Sale                              /dashboard/pos/?mode=retail
  Member Orders                     /dashboard/member-orders/
  Call sheet                        /dashboard/call-sheet/

Money
  Shifts                            /dashboard/shifts/          shift.open | shift.close
  Offers & Promotions               /dashboard/offers/
  Invoices                          /dashboard/invoices/        reports.financial.view
  Z-Report                          /dashboard/z-report/        reports.financial.view   ← sibling of Reports
  Reports                           /dashboard/reports/         reports.financial.view OR members.view

Catalog
  Plans / Products / Suppliers / Purchases

Inventory (phase-hidden: PHASE_HIDE_STOCK_MANAGEMENT)
  Overview / Insights / Warehouses  Insights = /dashboard/inventory/reports/

Administration
  Import / Audit / Notifications / Staff / Roles / Settings
```

Admin React (`apps/admin`) has Money → Reports at `/app/reports` as a **placeholder page**. No Z-Report item. Not the live desk.

**Refunds** is not a nav item. Refund action lives on Invoices (and Member 360). `GET /api/refunds` exists but is gated `payments.refund.approve`.

### Current pages

| URL | Files | What it actually is |
|---|---|---|
| `/dashboard/reports/` | `reports/index.html`, `reports-app.js`, `reports.css` | One long page: §16 snapshot analytics **plus** §17 live drill-downs |
| `/dashboard/z-report/` | `z-report/index.html`, `z-report-app.js`, `z-report.css` (+ POS CSS) | Cairo-day immutable snapshot: methods, line types, discounts, refunds total, shift rows, PDF, Manager regenerate |
| `/dashboard/shifts/` | `shifts/index.html`, `shifts-app.js`, `shifts.css` | Open / blind-count close / approve. **No link to Z-Report** |
| `/dashboard/` | `dashboard-home.js` | Live ops widgets that **re-call** analytics + attendance-summary + optional today’s Z-Report |
| `/dashboard/inventory/reports/` | `inventory/reports/*` | Stock Insights (summary / top sellers / dead stock / movements). Hidden in shop UX |
| `/dashboard/invoices/` | `invoices-*` | Transactional hub (memberships / products sold / suppliers). Refund from a sale. Drill to PDF |
| `/dashboard/pos/` | `pos-*` | Create sales. Not a report |
| Admin `/app/reports` | `PlaceholderPage` | Empty |

Live Reports page sections today:

1. Overview KPIs (`GET /analytics/overview`)
2. Revenue chart (`GET /analytics/revenue`)
3. Member status pie (`GET /analytics/members-status`)
4. Attendance heatmap (`GET /analytics/heatmap`)
5. Invitation funnel (`GET /analytics/invitations`)
6. Attendance summary table + Chart.js (`GET /reports/attendance-summary`)
7. Revenue detail table + method tabs (`GET /reports/revenue-detail`)
8. Peak hours (`GET /reports/peak-hours`)
9. Member retention (`GET /reports/member-retention`)

Trials API exists (`GET /analytics/trials`). `reports-app.js` still writes `#trialMonth` on boot; **that element is not in `index.html`**, so the IIFE can throw before bindings run.

**Export:** “Export CSV” scrapes `#tbAttendance` in the browser. Attendance only. No server export for sales/refunds.

**Charts:** Chart.js 4.4.4 on Reports + Dashboard. Inventory Insights is tables/cards.

**Filters:** Reports = from/to date (browser local `input type=date`) + revenue method chips. Peak hours / retention / snapshots ignore the date range. Inventory Insights uses Cairo date inputs.

**Invoice/sale drill:** Reports revenue rows do **not** link to Invoices or the sale. Invoices is the only sale-detail surface.

### Current backend services

| Service | Reads | Writes reporting data? |
|---|---|---|
| `ReportsService` | `GymAttendance`, `Membership` (+ Plan.Price) | No |
| `AnalyticsService` | `AnalyticsSnapshot` **or** realtime `Membership` / `GymMember` / `GymAttendance`; revenue chart = `Membership.AmountPaid`; status = operational covering; invitations = `MemberInvitation`; trials = trial memberships | No |
| `AnalyticsAggregationJob` | Raw SQL into **`gym_analytics_snapshots`** | Yes — **different table** than overview reads |
| `ZReportService` | `Sale`, `SaleLine`, `PaymentTransaction`, `Refund`, `Shift` | Immutable `ZReport.PayloadJson` per (tenant, Cairo date) |
| `ZReportGenerationJob` | Via `IZReportService.BuildAsync` at 23:59 Cairo | Yes |
| `InventoryReportService` | `SaleLine` retail, stock ledger/balances | Alerts job only |
| `DebtorsService` | `Sale.AmountDue` where `partially_paid` | No (outstanding query) |
| `RefundService.GetListAsync` | `Refund` | No dedicated report UI |
| `ShiftService` | `Shift` + `CashMovement` | Close computes ExpectedCash from movements |
| `TrainerCommissionReportJob` | Nothing | Placeholder skip |

There is **no** `SalesReportService`, **no** refunds report query, **no** staff/shift management report besides Z-Report shift rows.

### Current calculations (financial)

| Number shown | Formula today | Source table |
|---|---|---|
| Reports “Revenue detail” amount | `Membership.Plan.Price` on rows with `PaymentDate` in range | Membership, not Sale |
| Analytics revenue chart | `SUM(Membership.AmountPaid)` by PaymentDate month | Membership |
| Overview “Revenue this month” (no snapshot) | `SUM(Plan.Price)` where PaymentDate this month | Membership |
| Nightly snapshot RevenueThisMonth | `SUM(AmountPaid)` into `gym_analytics_snapshots` | Membership — **unread by overview** |
| Z-Report method totals | `SUM(PaymentTransaction.Amount)` for sales **created** that Cairo day | PaymentTransaction (no Status filter) |
| Z-Report line revenue | `SUM(SaleLine.LineTotal)` for those same sales | SaleLine |
| Z-Report refunds | `SUM(Refund.Amount)` where `executed` and ExecutedAt in Cairo day | Refund |
| Z-Report outstanding added | `SUM(Sale.AmountDue)` for `partially_paid` sales created that day | Sale |
| Shift expected cash | `OpeningFloat + SUM(CashMovement.Amount)` | CashMovement (`sale` / refund / in / out) |
| Outstanding (Dashboard / Member 360) | `SUM(Sale.AmountDue)` `partially_paid` + AmountDue > 0 | Sale (`DebtorsService`) |
| Refund remainder (accounting) | `sale.Total − SUM(executed refunds)` | RefundService — **not used by Reports** |

Payment method vocabulary on money:

- `PaymentTransaction.Method`: `cash` \| `card_paymob` \| `fawry` \| `vodafone` \| `instapay` \| `account_credit`
- `Membership.PaymentMethod`: same **or** `mixed` \| `paymob` (webhook gateway name) \| `imported` \| `trial`

Reports method chips filter `Membership.PaymentMethod == card_paymob`. Gateway-activated rows stored as `paymob` miss the Paymob chip.

### Design system (reuse — do not fork)

Live desks already share:

| Token | Value (Invoices / Offers / POS / Member 360) |
|---|---|
| Display | Space Grotesk (`--fd`) |
| Body | IBM Plex Sans + Arabic (`--fb`) |
| Lime | `--l500 #7ACC00`, `--l600 #5EAF00` |
| Surfaces | `--ls1` white, `--ls2` wash, `--ls3` hairline, `--lbg` page |
| Radius | `--rmd` 10–12px, `--rlg` 16–18px, `--rpl` pill |
| Buttons | height ~36px, 2px `--ls3` border, lime fill for primary |
| Inputs | 36px, 2px `--ls3`, `--rmd` |
| Tables | uppercase 11px headers on `--ls2`, 12–14px cells, row hover sage wash |
| Badges | pill `--rpl`, status colours `--suc100` / `--wrn100` / `--dng100` / `--inf100` |
| Cards | white, 1px `--ls3`, no neon |
| Drawers | Invoices right-drawer pattern |
| Modals | `.modal-panel` overflow hidden (Assign footer lesson) |
| Empty / loading | muted copy + skeleton `.sk` / `.loading-state` |

Reports currently clones an older full-page CSS (`reports.css`) with Chart.js rainbow peak bars and a hardcoded sidebar. **Do not treat that as a second design system.** Restyle Reports like Invoices hub tabs when the UI work is accepted.

---

## B. Problems found

### Product / IA

1. **Reports is a Dashboard clone.** §16 snapshots (overview, heatmap, invitations, status pie) answer “what’s happening / what’s the stock of members,” not “what happened in this period.” Dashboard already loads the same APIs.
2. **Z-Report sits in Money next to Reports.** Shifts has no child for Z-Reports. Closing a shift and reading the day snapshot are disconnected in nav.
3. **Intended five reports do not exist as pages.** No Sales / Refunds / Memberships / Products / Staff-Shifts management reports. One undifferentiated scroll.
4. **Attendance is a Reports section** even though Attendance is already an operational module. Heatmap + peak hours + summary duplicate Dashboard/Attendance.
5. **Inventory Insights is a third island** (and currently phase-hidden). Product sales performance already exists there (`SaleLine` retail).
6. **Admin Reports is a placeholder.** Do not build a parallel admin analytics app.
7. **Export is a toy.** Attendance DOM CSV only.

### Financial truth (highest risk)

8. **Reports revenue is not cash and not sales.** It lists memberships by `PaymentDate` at **list price**. Partial cash, collect-later, retail, fees, mixed tenders, and refunds are invisible or wrong.
9. **Three “revenue this month” formulas disagree:** Plan.Price (realtime overview) vs AmountPaid (chart + unused snapshot job) vs PaymentTransaction / SaleLine (Z-Report).
10. **`Membership.AmountPaid` is first payment only.** Collect Payment does not update it (by design). The revenue chart therefore understates later collections.
11. **Snapshot job writes the wrong table.** `AnalyticsAggregationJob` MERGEs `gym_analytics_snapshots` (`GymAnalyticsSnapshot`). Overview reads `AnalyticsSnapshots`. Overview almost always falls through to realtime Plan.Price.
12. **Z-Report method totals follow Sale.CreatedAtUtc, not PaidAtUtc.** Collecting cash on yesterday’s outstanding sale does not land in today’s method totals. Shift `CashMovement` **does** record that cash. Shift close and Z-Report can disagree.
13. **Z-Report line revenue is gross LineTotal.** Not net of refunds, not cash taken, not AmountDue.
14. **Refunds are not in Reports at all.** Z-Report has a single `RefundsTotal`. No method split, no staff, no link to credit notes. Listing refunds requires `payments.refund.approve`, not `reports.financial.view`.
15. **Payment method chips don’t match stored values** (`paymob` vs `card_paymob`, `mixed`, `imported`, `trial`).

### Memberships / renewals / retention

16. **Retention is not covering-membership logic.** It counts `Status == expired` rows, then “renewed” = that member has **any** non-expired row (including cancelled / pending / scheduled). N+1 query. Ignores `PlanTransitionMode` and desk cancel.
17. **Renewals are not a report.** New vs renew vs assign vs trial convert are not distinguished. Revenue detail treats every paid membership the same.
18. **Invitation funnel on Reports still slices leftover `guest_pass` / `referral`** plus product `invitation`. Product is one Invitation type.

### Time, tenant, staff

19. **Date windows are UTC-ish, not Cairo**, except Z-Report and Inventory Insights. Attendance summary groups `DateOnly.FromDateTime(CheckInAtUtc)`. Peak hours / heatmap use UTC hour. Reports from/to uses local midnight–23:59:59 unspecified kind.
20. **Tenant isolation is OK on HTTP** (JWT tenant + EF query filters + explicit `TenantId` in services). Jobs correctly `IgnoreQueryFilters` then set tenant. Do not weaken that.
21. **Reports are not staff-scoped.** Anyone with `reports.financial.view` sees the whole gym. Shift close is the staff-scoped money surface. There is no “my sales today” management report (and there should not be a second cash drawer).
22. **`reports-app.js` can crash on load** because `#trialMonth` is missing.

### Duplication map

| Topic | Surfaces today |
|---|---|
| Revenue | Reports detail, Reports chart, Dashboard chart, Overview KPI, Z-Report methods + lines |
| Attendance volume | Reports summary + chart, Dashboard week chart, heatmap, peak hours, Attendance desk |
| Member status | Reports pie, Dashboard members-status |
| Outstanding | Dashboard debtors widgets, Member 360, Z-Report outstandingAddedToday (created that day only) |
| Retail product mix | Inventory Insights only (hidden) |
| Refunds | Invoice action, Z-Report total, no report |
| Shifts | Shifts page, Z-Report shift rows (opened that Cairo day) |

---

## C. Proposed Reports architecture

Adapt to **current** nav. Do not blindly replace Front desk or restore deleted Refunds/Debtors items.

```
Overview
  Dashboard                         now: occupancy, check-ins today, open shift, outstanding, orders

Members
  Members
  Attendance                        operational; not a Reports tab

Front desk
  Sale
  Member Orders
  Call sheet

Money
  Invoices                          what to print / refund / inspect one sale
  Reports                           what happened (management)
    ├── Sales
    ├── Refunds
    ├── Memberships
    ├── Products
    └── Staff / Shifts              read-only management view — not close
  Offers & Promotions

Shifts                              close / reconcile
  ├── Current Shift                 existing /dashboard/shifts/
  └── Z-Reports                     move from Money sibling; same /dashboard/z-report/ URL is fine
```

Inventory Insights stays hidden while shop UX is on. **Reports → Products** should reuse `InventoryReportService` retail performance (or the same `SaleLine` query), not a new cube. When Insights is un-hidden later, it remains stock ops; Reports → Products remains owner “what sold.”

### What each Reports tab answers

| Tab | Question | Grain | Read |
|---|---|---|---|
| **Sales** | What did we take in, by method and line type? | Cairo from/to | `PaymentTransaction` (cash-in) + `Sale`/`SaleLine` (booked). Show both; label them. Link row → Invoices |
| **Refunds** | What did we give back? | ExecutedAt Cairo | `Refund` executed. Method cash/credit (gateway still unsupported). Link → sale/invoice |
| **Memberships** | How are memberships performing (new vs renewals)? | Membership StartDate Cairo | `Membership` + payments on that membership. New vs renewal = `LastRenewalDate` / `PlanTransitionMode`. Revenue = PaymentTransaction − executed refunds (not Plan.Price). Desk cancel is not a refund. |
| **Products** | What products are customers buying? | Retail SaleLine on sales created in Cairo range | Same SaleLine query as Insights performance (no warehouse/margin). Full `Sale.Status=refunded` drops out. Partial refunds stay at LineTotal (no line split). |
| **Staff / Shifts** | Who handled the sales and shifts? | Payments by PaidAtUtc; refunds by ExecutedAt; shifts by OpenedAt (Z-Report grain) | `PaymentTransaction` + executed `Refund` + `Shift`. Staff = ReceivedBy / refund approver else requester. Shift Sales = payments with that ShiftId in range. Shift Refunds = cash movements Type=refund. **Does not close the drawer. No variance, scoring, or payroll.** |

### What leaves Reports

- Overview KPIs, heatmap, invitation funnel, member status pie, peak hours → Dashboard and/or Attendance. Not Reports tabs.
- Z-Report → Shifts information architecture. Keep API `/api/reports/z/{date}` (path rename is optional and risky).
- Trials funnel → Trials page or Dashboard widget. Do not invent a sixth Reports tab unless Product asks.

### Permissions (keep split)

- Money tabs (Sales, Refunds, Staff/Shifts money columns): `reports.financial.view`
- Memberships counts / Products units: `members.view` / `inventory.view` as today
- Refunds **report** should be readable with `reports.financial.view` (owner). Request/approve stay `payments.refund.*`. Do not use list-refunds-as-approver as the report gate.
- Z-Report stay `reports.financial.view`; regenerate ManagerOrAbove

---

## D. Shared reporting foundation

One read-model helper (name TBD, e.g. `ReportingQueryService`) used by Reports tabs **and** kept consistent with Z-Report labels. **Do not** persist a second ledger.

Must share:

1. **`CairoBusinessDayUtcRange(DateOnly)`** — already on `ZReportService`; lift to a shared utility (`MembershipOperational.TodayCairo` already exists for dates).
2. **Cash-in:** `PaymentTransaction` where `Status == success`, bucket by `PaidAtUtc` (not sale created). Split by `Method`. Staff = `ReceivedByUserId`. Shift = `ShiftId`.
3. **Booked lines:** `SaleLine.LineTotal` by sale `CreatedAtUtc` (or explicit “sale day”). Label “listed / booked,” never “cash.”
4. **Refunds executed:** `Refund.Amount` where `Status == executed`, bucket by `ExecutedAt`.
5. **Net cash-in:** cash-in − cash refunds (credit refunds are not drawer cash).
6. **Outstanding:** reuse `DebtorsService` / `Sale.AmountDue` query. Do not add `Member.DebtAmount`.
7. **Method enum:** `PaymentTransaction.Method` only for money reports.
8. **Membership events:** `MembershipOperational.SelectCoveringToday` / `GetEffectiveStatus` — same as list filters and status pie. Retention rewrite uses covering + a later paid membership, not “any non-expired row.”
9. **Products:** `InventoryReportService.GetProductPerformanceAsync` (retail `SaleLine`).
10. **UI kit:** Invoices hub tabs, date range, table, money format (`en-EG` EGP), empty/skeleton, row → Invoices. No new Chart.js theme. Optional one quiet bar chart later.

Z-Report **keeps its snapshot JSON**. After Accept, decide whether regenerate should switch method totals to `PaidAtUtc` — that is an accounting/reconciliation change; **do not silently change it in the Reports UI pass**. Call it out in the implement plan.

---

## E. Files to change (after Accept)

No edits in this audit. When Product Accepts, expect:

### Frontend (apps/web)

- `apps/web/src/app/shared/nav.js` — nest Z-Report under Shifts; Reports stays Money; `nav.selftest.js`
- `apps/web/src/app/(dashboard)/reports/index.html`
- `apps/web/src/app/(dashboard)/reports/reports-app.js`
- `apps/web/src/app/(dashboard)/reports/reports.css` — restyle to Invoices tokens; drop hardcoded sidebar
- `apps/web/src/app/(dashboard)/shifts/index.html` (+ `shifts-app.js` / `shifts.css`) — Current vs Z-Reports entry
- `apps/web/src/app/(dashboard)/z-report/*` — breadcrumb/copy only unless PaidAtUtc decision
- `apps/web/src/app/(dashboard)/dashboard-home.js` — keep now-widgets; do not grow into Reports
- `apps/web/src/app/shared/shell.js` / `shell.selftest.js` if routes listed
- Optional: `apps/web/src/app/shared/refund-action.js` only if Reports needs the same refund drawer (prefer link to Invoices)

### Backend (sibling GMS.*)

- New reporting queries (prefer extend `ReportsService` or a dedicated `ReportingQueryService`) — **read** Sale / PaymentTransaction / Refund / Membership / SaleLine
- `GMS.Api/Controllers/ReportsController.cs` — replace or add endpoints; keep old paths until FE cutover
- `GMS.Application/Services/ReportsService.cs` — stop using Plan.Price as revenue
- `GMS.Application/Services/AnalyticsService.cs` — optional: stop feeding Reports; keep Dashboard
- `GMS.Infrastructure/Jobs/AnalyticsAggregationJob.cs` — **separate defect**: job vs overview table mismatch (fix only if Dashboard snapshot is in scope)
- `GMS.Application/Services/ZReportService.cs` — **do not change** unless Product explicitly accepts PaidAtUtc / success-filter
- `FRONTEND_API_CONTRACTS.ts`
- Tests: new report query tests + tenant isolation; do not loosen `ZReportServiceTests`

### Do not touch in the Reports UI pass

- Sale / refund / shift close accounting
- `Member.DebtAmount`
- Debtors nav restore
- Hangfire Z-Report schedule
- Inventory engines
- Admin placeholder (or one-line “use staff web”)

---

## F. Risks

| Risk | Why it hurts | Mitigation |
|---|---|---|
| **Financial calculations** | Three revenue formulas already disagree. A pretty Sales tab that still uses Plan.Price will train the owner on the wrong number | Cash-in vs booked as two labelled columns. Tests with partial pay + collect later + retail |
| **Refunds** | Remainder is `sale.Total − executed`, not paid. Credit vs cash. Gateway unsupported. Cancel membership is **not** a refund | Report executed refunds only. Never mix desk Cancel into Refunds totals |
| **Renewals** | Covering vs operational vs expired status. AmountPaid stale after collect | Memberships tab = lifecycle counts. Money on Sales from PaymentTransaction |
| **Shift reconciliation** | ExpectedCash = movements; Z methods = payments on sales created that day. Changing Z during a Reports restyle will break close vs snapshot | Move Z in **nav only**. Any PaidAtUtc change is a dated Product decision with regenerate note |
| **Tenant isolation** | Jobs already bypass filters on purpose | Keep explicit TenantId. Never drop query filters on interactive reports |
| **Staff scope** | Receptionist with financial view would see gym-wide Sales | Keep gym-wide for Reports (owner/manager). Shift page stays “my drawer.” Do not filter Reports by JWT user unless Product asks |
| **Snapshot job table split** | Dashboard “as of” is lying / always realtime | Out of Reports UI scope; log as follow-up |
| **Permission for refunds list** | Owners with financial view cannot call `GET /api/refunds` today | New report endpoint under `reports.financial.view`, or widen list read without widening approve |

---

## Recommended first implement slice (after Accept)

1. Nav: Z-Report under Shifts (same URL).
2. Reports page: five tabs, Invoices visual language, date range = Cairo.
3. Sales tab: PaymentTransaction cash-in + method + link to Invoices. No Plan.Price.
4. Refunds tab: executed refunds.
5. Leave Z-Report aggregation math unchanged.

Wait for Product Accept before any of the above.
