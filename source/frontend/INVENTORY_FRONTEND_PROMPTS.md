# Inventory Frontend Integration Prompts (`apps/web`)

> Grounded in completed backend **INVS-1…10** (2026-08-07) and live contracts in `Frontend/FRONTEND_API_CONTRACTS.ts` §22b.
> **Target app:** `Frontend/apps/web` only (static dashboard: `index.html` + `*-app.js` + optional CSS). Do **not** build inventory in `apps/admin` or Flutter for this pack.
> **Rule:** real APIs only — no mocks, no fake qty on products, no parallel POS/checkout.

---

## A. Reality check (backend done vs web UI)

| Backend (done) | `apps/web` today |
|----------------|------------------|
| Feature `inventory` + perms `inventory.*` | `GfpFeatures` / `GfpNav` have **no** `inventory` module |
| Product catalog / warehouses / stock / PO / transfers / counts / reports | **No** `/dashboard/inventory/*` routes |
| POS `CreateSaleRequest.lines` + retail + `warehouseId` | `pos-app.js` is **membership/`planId` only** |
| Refund `stockRestored` + `ORIGINAL_SALE_MOVEMENT_MISSING` | `refunds-app.js` does not surface stock restore |
| Low-stock staff notifications (Hangfire → `CreateForStaffAsync`) | Existing `/dashboard/notifications/` inbox — **no** inventory-specific UI needed beyond showing in-app rows |
| Tenant settings `inventory_low_stock_notify_roles`, `inventory_expiry_windows_days` | Settings page has **no** inventory alert config |

Catalog nav today = **Plans only**. Inventory is a new nav category (or expand Catalog) — binding choice in **FE-INVS-0**.

---

## B. Architecture constraints (`apps/web`)

Copy into every agent session:

1. Reuse `GfpApi` / `api-client.js`, `GfpAuthz` / `useCan`, `GfpFeatures`, `GfpNav` + `shell.js` — do not invent a second auth/nav stack.
2. Gate nav with `featureFlag: 'inventory'` + permission claims (`inventory.view` etc.). `FEATURE_DISABLED` 404 ⇒ hide module.
3. One feature folder pattern: `apps/web/src/app/(dashboard)/<area>/index.html` + `<area>-app.js` (+ CSS). Prefer shared helpers under `apps/web/src/app/share d/` if reused (e.g. `inventory-api.js`).
4. Bilingual where sibling pages already use `i18n.js` / EN+AR labels in nav.
5. Error UX: ProblemDetails `title`/`detail` first; map machine codes (`INSUFFICIENT_STOCK`, `INVENTORY_REQUIRED`, …).
6. **Never** show or edit on-hand on the product form — stock lives on ledger endpoints only.
7. Contracts source of truth: `Frontend/FRONTEND_API_CONTRACTS.ts` §6 (sales), §9 (refunds), §22b (inventory). Update `PermissionKey` there when adding claims.
8. Backend reference (read-only): `Frontend/INVENTORY_SYSTEM_PROMPTS.md`. Hangfire jobs have no UI.

### Agent preamble (paste above every FE-INVS-N)

> You are integrating HyMotion inventory into **`apps/web` only**. Use real `/api/inventory/*` and updated `/api/sales` / `/api/refunds`. Extend `GfpNav` / `GfpFeatures` / existing POS & refunds pages — do not scaffold `apps/admin` inventory. No QtyOnHand on product. Feature flag `inventory`. Follow OpenWolf `.wolf/OPENWOLF.md`.

### Execution discipline

- One **FE-INVS-*** prompt per PR (or tightly stacked PRs in order).
- After merge: append `DONE — FE-INVS-N — <date>` under § Progress at the bottom of this file.
- Do not skip FE-INVS-0.

---

## C. Permission & feature matrix (UI gates)

| Claim / flag | Owner | Manager | Receptionist | UI use |
|--------------|-------|---------|--------------|--------|
| feature `inventory` | tier | tier | tier | Entire inventory nav + POS retail |
| `inventory.view` | ✓ | ✓ | ✓ | Lists, stock, report cards (non-financial) |
| `inventory.manage` | ✓ | ✓ | | Products, categories, warehouses, suppliers, PO draft |
| `inventory.adjust` | ✓ | ✓ | | Adjustments, stock counts |
| `inventory.purchase` | ✓ | ✓ | | PO approve / receive / cancel |
| `inventory.transfer` | ✓ | ✓ | | Transfers |
| `sales.sell` | ✓ | ✓ | ✓ | POS retail lines |
| `reports.financial.view` | ✓ | ✓ | | Show `inventoryValueEgp` on summary |

---

## D. Endpoint → frontend coverage map (must be 100%)

| Backend area | Endpoints | Frontend prompt |
|--------------|-----------|-----------------|
| Feature + perms | `[FeatureFlag("inventory")]`, `inventory.*` claims | FE-INVS-0 |
| Categories | `GET/POST /categories`, `PUT /categories/{id}` | FE-INVS-1 |
| Products | list/get/create/update/archive/unarchive/by-barcode | FE-INVS-1 |
| Warehouses | list/default/get/create/update/set-default | FE-INVS-2 |
| Stock reads | `GET /stock`, `GET /products/{id}/stock` | FE-INVS-3 |
| Adjustments | create/get/post/cancel | FE-INVS-4 |
| Suppliers | list/get/create/update | FE-INVS-5 |
| Purchase orders | list/get/create/approve/cancel/receipts | FE-INVS-5 |
| POS retail | `POST /sales` with `lines` + `warehouseId` | FE-INVS-6 |
| Refunds stock | `RefundDto.stockRestored` + failure codes | FE-INVS-7 |
| Transfers | list/get/create/submit/receive/cancel/reject | FE-INVS-8 |
| Counts | list/get/create/update lines/submit/approve/cancel | FE-INVS-9 |
| Reports | `GET /reports/summary`, `/reports/movements` | FE-INVS-10 |
| Alerts | Hangfire + notifications inbox | FE-INVS-10 (read path only) |
| Settings keys | `inventory_low_stock_notify_roles`, `inventory_expiry_windows_days` | FE-INVS-10 |

---

## E. Phased prompts

### FE-INVS-0 — Foundations: flag, perms, nav, API helper

**Screens / files to update**
- `apps/web/src/app/shared/features.js` — add `'inventory'` to `FEATURE_MODULES` + probe
- `apps/web/src/app/shared/nav.js` (+ `nav.selftest.js`) — Inventory category + items
- `apps/web/src/app/shared/shell.js` — no logic change if nav-driven; verify routes render
- `Frontend/FRONTEND_API_CONTRACTS.ts` — extend `PermissionKey` with:
  - `inventory.view` | `inventory.manage` | `inventory.adjust` | `inventory.purchase` | `inventory.transfer`
- New: `apps/web/src/app/shared/inventory-api.js` (thin wrappers / path constants mirroring contracts)

**Recommended nav IA (Catalog → rename to Catalog or keep Plans + Inventory)**

| Item | Path | Access | Feature |
|------|------|--------|---------|
| Products | `/dashboard/inventory/products/` | `inventory.view` | `inventory` |
| Warehouses | `/dashboard/inventory/warehouses/` | `inventory.view` | `inventory` |
| Stock | `/dashboard/inventory/stock/` | `inventory.view` | `inventory` |
| Adjustments | `/dashboard/inventory/adjustments/` | `inventory.adjust` | `inventory` |
| Suppliers | `/dashboard/inventory/suppliers/` | `inventory.view` | `inventory` |
| Purchase orders | `/dashboard/inventory/purchase-orders/` | `inventory.view` | `inventory` |
| Transfers | `/dashboard/inventory/transfers/` | `inventory.transfer` | `inventory` |
| Counts | `/dashboard/inventory/counts/` | `inventory.adjust` | `inventory` |
| Inventory reports | `/dashboard/inventory/reports/` | `inventory.view` | `inventory` |

Stub each path with a minimal `index.html` that loads shell + “Coming in FE-INVS-N” **or** leave routes until the owning prompt — but **register all nav keys in FE-INVS-0** so visibility self-tests exist.

**Probe**
```text
GET /inventory/categories   (or /inventory/warehouses/default)
→ 404 + title FEATURE_DISABLED ⇒ inventory unavailable
→ any other status ⇒ available
```

**UI behaviors**
- Receptionist with `inventory.view` sees Products/Stock/Reports; no manage/adjust/purchase/transfer actions later.
- Starter/off flag: entire Inventory category hidden (same as sales flag).

**Acceptance criteria**
1. `GfpFeatures.FEATURE_MODULES` includes `inventory`; probe detects `FEATURE_DISABLED`.
2. Nav self-test: Receptionist never sees Adjustments/Transfers/PO actions that require missing claims (actions gated in later prompts; nav items for adjust/transfer hidden without claim).
3. `PermissionKey` in contracts lists all five inventory permissions.
4. No calls to mock servers.

---

### FE-INVS-1 — Product catalog & categories

**Screens (new)**
- `/dashboard/inventory/products/` — list + filters + create/edit drawer/modal
- Optional categories tab or secondary panel on same page

**APIs**
- `INVENTORY_ENDPOINTS`: categories CRUD, products list/get/create/update/archive/unarchive, `getByBarcode`

**UI behaviors / business rules**
- List: search `q`, filter `categoryId`, toggle `includeArchived` (default hide archived).
- Form fields match `CreateProductRequest` / `ProductDto` (SKU, barcode, names EN/AR, brand, UoM, sell/cost, currency, taxable, vatRatePercent, trackStock/Batch/Expiry, allowFractionalQty, isSellable/Purchasable, reorderMinQty, isActive).
- Client validation mirrors backend:
  - TrackExpiry ⇒ TrackBatch must be checked
  - !TrackStock ⇒ disable TrackBatch/TrackExpiry
  - prices ≥ 0; SKU required
- After archive: row shown only with includeArchived; Unarchive button.
- **Do not** display on-hand on product card (link “View stock” → FE-INVS-3 when ready).
- Manage actions (`inventory.manage`) only; viewers get read-only.
- Barcode lookup helper usable later by POS (export function or document path).

**Acceptance criteria**
1. Owner creates category + product; duplicate SKU shows API error toast.
2. Receptionist can list/view; create buttons hidden.
3. Archived products excluded by default; included when toggled.
4. Loading / empty (“No products”) / error states work.

---

### FE-INVS-2 — Warehouses

**Screens (new)**
- `/dashboard/inventory/warehouses/`

**APIs**
- list / get / default / create / update / set-default

**UI behaviors**
- Show `isDefault` badge; action “Set as default” (`inventory.manage`).
- Create: code + name (+ nameAr); code **immutable** after create (update form omits code).
- Do not expose branch picker (Branch deferred); ignore/`null` `branchId`.
- First warehouse can be default; switching default clears previous (server-enforced).

**Acceptance criteria**
1. Default warehouse visible; set-default succeeds and refreshes list.
2. Inactive warehouse filter via `includeInactive`.
3. No Branch CRUD invented.

---

### FE-INVS-3 — Stock on-hand & movement history

**Screens (new)**
- `/dashboard/inventory/stock/` — product + warehouse selectors → on-hand + optional movements
- Product detail deep-link: `/dashboard/inventory/products/?id=` stock panel via `GET /products/{id}/stock`

**APIs**
- `GET /api/inventory/stock?productId=&warehouseId=&includeMovements=&movementTake=`
- `GET /api/inventory/products/{id}/stock`

**UI behaviors**
- **No** “Set quantity” control — read-only.
- Movements table: qtyDelta, reason, unitCost, referenceType/Id, occurredAtUtc.
- Breakdown by warehouse on product stock view (`totalOnHand` + per-warehouse rows).
- Reason labels: map known `StockMovementReasons` codes to EN/AR friendly text.

**Acceptance criteria**
1. Selecting product+warehouse shows qty; empty warehouse shows 0/empty movements without crashing.
2. Receptionist with view can open; no write controls.
3. FEATURE_DISABLED / 403 handled.

---

### FE-INVS-4 — Opening stock & adjustments

**Screens (new)**
- `/dashboard/inventory/adjustments/` — list (by fetching get after create; if no list API, keep “Recent drafts” in session or create→detail flow)
- Detail workflow: create draft → review lines → Post / Cancel

**Note:** Backend exposes create/get/post/cancel — **no list endpoint**. UI = create wizard + open-by-id (store last IDs in sessionStorage or require id query). Document that; do not invent a fake list from products.

**APIs**
- `POST /adjustments`, `GET /adjustments/{id}`, `POST .../post`, `POST .../cancel`

**UI behaviors**
- Require `inventory.adjust`.
- `reasonCode`: `opening` | `damage` | `lost` | `expired` | `manual_count` | `other`.
- Opening: qtyDelta must be **> 0** client-side.
- Lines: product picker (TrackStock products only), qtyDelta, optional unitCost.
- Status badge: draft / posted / cancelled; Post disabled when not draft.
- On post failure (negative stock, etc.): show API detail; leave draft intact.

**Acceptance criteria**
1. Opening stock posts and FE-INVS-3 stock reflects new qty.
2. Cancel draft works; posted cannot cancel.
3. Receptionist cannot open Adjustments nav.

---

### FE-INVS-5 — Suppliers & purchase orders (receive / batch / expiry)

**Screens (new)**
- `/dashboard/inventory/suppliers/`
- `/dashboard/inventory/purchase-orders/` (+ detail view)

**APIs**
- Suppliers: list/get/create/update (`inventory.manage` for writes)
- POs: list(`?status=`), get, create (`manage`), approve/cancel/receive (`inventory.purchase`)

**UI behaviors**
- PO statuses: draft → approved → partially_received / received; cancelled.
- Create PO: supplier, warehouse, lines (purchasable products, qtyOrdered, unitCost).
- Approve / Cancel buttons only with `inventory.purchase`; hide for Receptionist.
- Receive dialog:
  - lines with `purchaseOrderLineId`, qty ≤ remaining
  - if product `trackBatch`: require `batchNumber`
  - if `trackExpiry`: require `expiresOn` (`yyyy-MM-dd`)
- Show `qtyOrdered` / `qtyReceived` / `qtyRemaining` on detail.
- After receive: optional toast linking to stock page.

**Acceptance criteria**
1. Draft → approve → partial receive → remaining updates.
2. Cancel without receipts succeeds; after receipt cancel blocked (API error shown).
3. Batch/expiry validation matches product flags.
4. Manager can purchase; Receptionist read-only on PO list if they have view.

---

### FE-INVS-6 — POS retail stock deduction

**Screens to update**
- `apps/web/src/app/(dashboard)/pos/index.html` + `pos-app.js` (+ CSS)

**APIs**
- Existing `POST /api/sales` with `CreateSaleRequest.lines` + optional `warehouseId`
- Product search: `GET /inventory/products?q=` and/or `GET /inventory/products/by-barcode/{code}`
- Default warehouse: `GET /inventory/warehouses/default` (when inventory flag on)

**UI behaviors**
- Keep membership/`planId` path working.
- Add cart mode: mix membership + retail lines when inventory available.
- Retail line: `lineType: "retail"`, `productId`, `qty`, optional `unitPrice` (default sellPrice).
- Walk-in retail-only: allow empty member when cart has only retail (no membership lines).
- Warehouse selector (default preselected); send `warehouseId`.
- If `allowFractionalQty === false`, qty stepper integers only.
- Error mapping: `INSUFFICIENT_STOCK`, `INVENTORY_REQUIRED`, `WAREHOUSE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `MEMBER_REQUIRED`.
- When inventory feature off: hide retail UI entirely (sales membership remains).
- Idempotency: keep `X-Idempotency-Key` behavior.

**Acceptance criteria**
1. Sell tracked product → stock qty decreases (verify on stock page).
2. Oversell → friendly INSUFFICIENT_STOCK message with SKU.
3. Membership-only sale still works without inventory flag.
4. Walk-in water bottle (retail-only) succeeds without member.

---

### FE-INVS-7 — Refund stock restore UX

**Screens to update**
- `apps/web/src/app/(dashboard)/refunds/refunds-app.js` (+ HTML if needed)

**APIs**
- Existing refunds endpoints; consume `RefundDto.stockRestored`
- Map `ORIGINAL_SALE_MOVEMENT_MISSING`, `STOCK_RESTORE_FAILED`

**UI behaviors**
- After approve success: if `stockRestored === true`, toast “Retail stock restored”; if full refund of retail sale but false, do not claim restore.
- List/detail badge optional: “Stock restored”.
- Document in UI helper text: **partial amount refunds do not restore stock** (backend rule).
- Full sale refund of retail carts should restore once approved.

**Acceptance criteria**
1. Approve full retail sale refund → badge/toast stock restored; stock page increases.
2. Partial refund → no “stock restored” claim.
3. New error codes surface readable messages.

---

### FE-INVS-8 — Warehouse transfers

**Screens (new)**
- `/dashboard/inventory/transfers/`

**APIs**
- list(`?status=`), get, create, submit, receive, cancel, reject — all `inventory.transfer`

**UI behaviors**
- Workflow buttons by status:
  - `pending`: Submit, Cancel
  - `in_transit`: Receive, Reject
  - `completed` / `cancelled`: read-only
- Create: from ≠ to warehouse; lines product + qty (+ batchId if batch-tracked — optional selector later; allow null when not required).
- Confirm dialogs on reject (“returns stock to source”).

**Acceptance criteria**
1. Full happy path pending → submit → receive; stock moves between warehouses.
2. Cancel pending only; reject in_transit restores source.
3. Nav hidden without `inventory.transfer`.

---

### FE-INVS-9 — Stock counts

**Screens (new)**
- `/dashboard/inventory/counts/`

**APIs**
- list, get, create, `PUT .../lines`, submit, approve, cancel — `inventory.adjust`

**UI behaviors**
- Create snapshots `systemQty` — show frozen system qty vs counted qty; variance = counted − system (display server variance).
- Draft: edit counted qtys; Submit; Approve (warn if drift: live ≠ snapshot — show API error clearly: recount).
- Cancel from draft|submitted.
- Zero-variance lines still OK; approve posts only nonzero variances (no FE ledger posts).

**Acceptance criteria**
1. Create for warehouse → enter counts → submit → approve → stock matches counted.
2. Drift reject shows actionable error (refresh/recount).
3. Receptionist cannot access.

---

### FE-INVS-10 — Reports cards, movements, alert settings

**Screens (new + update)**
- `/dashboard/inventory/reports/` — summary cards + movements table/filters
- `/dashboard/settings/` — optional inventory alert section (**Owner**)
- Notifications: verify low-stock/expiry rows appear in existing `/dashboard/notifications/` (no Hangfire UI)

**APIs**
- `GET /api/inventory/reports/summary`
- `GET /api/inventory/reports/movements?fromUtc&toUtc&productId&warehouseId&reason&take`
- Settings: whatever update path settings page already uses for `Tenant.Settings` JSON keys:
  - `inventory_low_stock_notify_roles` (string array; default Owner/Manager)
  - `inventory_expiry_windows_days` (int array; default `[90,30,7]`)

**UI behaviors**
- Cards: Out of stock, Low stock, Expiring soon (per window).  
- **Valuation:** show `inventoryValueEgp` only when `includesValuation === true` (needs `reports.financial.view`); otherwise hide or show “Financial permission required” (do not invent a number).
- Movements: date range max **366 days** (client validate); filter reason from known movement reasons.
- Empty expiry = success (zeros), not an error.
- Settings: edit notify roles + windows; persist via existing tenant settings save.

**Acceptance criteria**
1. After INVS data exists, cards non-zero for OOS/low when applicable.
2. Receptionist sees counts without valuation; Owner/Manager with financial claim sees value.
3. Movements reject >366 days client-side before call.
4. Staff notification for low stock appears in notifications inbox after job run (manual Hangfire trigger OK in QA).

---

## F. Shared UX requirements (every prompt)

- Loading skeletons/spinners; empty states; disable double-submit on mutations.
- Toast EN (and AR when page already bilingual).
- Route guards: if user opens URL without claim/flag → redirect or inline lock message (mirror reports blur overlays).
- After mutations, invalidate/refetch affected views.
- Prefer `GfpApi.get/post/put` over ad-hoc `fetch` when the page already uses them; if legacy page uses fetch (POS/refunds), stay consistent within that file but still real APIs.

---

## G. Out of scope (do not FE-build)

- Branch management / platform branch caps
- COGS / GL journals
- Camera USB scanner drivers (barcode text input + browser scan OK)
- Product image CDN upload pipeline (URL field only)
- Line-level partial refund stock
- Platform console inventory billing
- Hangfire dashboard for `inventory-low-stock`

---

## H. Traceability checklist (sign-off)

Mark each when FE done:

- [x] FE-INVS-0 Feature flag + nav + PermissionKey
- [x] FE-INVS-1 Categories + products + barcode
- [x] FE-INVS-2 Warehouses + default
- [x] FE-INVS-3 Stock query + product breakdown
- [x] FE-INVS-4 Adjustments post/cancel
- [x] FE-INVS-5 Suppliers + PO approve/receive/cancel
- [x] FE-INVS-6 POS retail lines + warehouse + errors
- [x] FE-INVS-7 Refund `stockRestored` + error codes
- [x] FE-INVS-8 Transfers full workflow
- [x] FE-INVS-9 Counts snapshot/submit/approve/drift
- [x] FE-INVS-10 Summary + movements + settings keys + notifications verify

**Coverage rule:** every row in §D maps to a checked item above. If an endpoint lacks UI, open a prompt amendment — do not silently skip.

---

## I. Progress

```text
FE-INVS-0  — Foundations ........................ [x] DONE 2026-08-07
FE-INVS-1  — Catalog ............................ [x] DONE 2026-08-07
FE-INVS-2  — Warehouses ......................... [x] DONE 2026-08-07
FE-INVS-3  — Stock reads ........................ [x] DONE 2026-08-07
FE-INVS-4  — Adjustments ........................ [x] DONE 2026-08-07
FE-INVS-5  — Purchasing ......................... [x] DONE 2026-08-07
FE-INVS-6  — POS retail ......................... [x] DONE 2026-08-07
FE-INVS-7  — Refund stock UX .................... [x] DONE 2026-08-07
FE-INVS-8  — Transfers .......................... [x] DONE 2026-08-07
FE-INVS-9  — Counts ............................. [x] DONE 2026-08-07
FE-INVS-10 — Reports + alert settings ........... [x] DONE 2026-08-07

Owner UX polish (post FE-INVS) .................. [x] 2026-08-07
  stock board, reorder→draft PO modal, reports tabs
  (perf/dead), Cairo dates, suppliers AR, PO ?id=,
  deep links reports?tab=
```

**Suggested PR order:** 0 → 1 → 2 → 3 → 4 → 6 (demo path) → 7 → 5 → 8 → 9 → 10.  
Alternate full ops order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10.
