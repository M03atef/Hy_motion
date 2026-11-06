# Inventory System — Conflicts + Implementation Prompts

> Grounded in live HyMotion codebase review (as of 2026-08-07).
> **Rule for every prompt:** extend existing POS / Sales / Refunds / Permissions / tenant EF patterns; do **not** invent a parallel checkout, invoice engine, or branch SaaS stack.

---

## A. Reality check (roadmap vs code)

| Roadmap assumption | Live reality |
|--------------------|--------------|
| Product catalog already exists | **False.** No `Product`, SKU, barcode, category, brand, or supplier tables. Admin “Catalog” nav = **membership plans** only. |
| Warehouse / Branch locations | **No `Branch` entity.** Platform `UsageMetrics.Branches` exists with seed caps, but `TierEnforcementService` hard-codes branch count = 1 (“Branch CRUD deferred”). Stock locations must be invented as **`Warehouse`** (tenant-scoped), optionally `BranchId` nullable for later. |
| Stock / inventory module | **Absent.** No stock levels, ledgers, POs, GRNs, transfers, or adjustments. |
| POS can sell products | **Partially reserved only.** `SaleLine.LineType` docs allow `'membership' \| 'trial' \| 'day_pass' \| 'retail' \| 'fee'`. Production writers create **`membership`** (`SaleService`) and **`trial`** (`TrialService`) only. No retail writer. |
| `CreateSaleRequest` multi-line cart | **False.** `POST /api/sales` requires `PlanId`; no product/lines array. One plan → one membership → one sale line. |
| `Sale.MemberId` walk-in | Entity already documents **nullable** `MemberId` (walk-in). Current create path still forces MemberId **or** NewMember. |
| Refund restores stock | **N/A today.** `RefundService.ApproveAsync` cancels **membership** via membership sale line; never touches stock. |
| Payment for retail-only cart | **Blocked by schema.** `PaymentTransaction.MembershipId` is **required** (EF + FK). Retail-only sales need this nullable (or a synthetic membership — prefer **nullable**). |
| Invoices / accounting | Tenant invoices snapshot sale lines (`InvoiceService` + Hangfire). No supplier AP, inventory asset, or COGS ledger. Valuation = **new domain**, not platform billing. |
| Permissions / feature flags | No `inventory.*` perms. No `FeatureKeys.Inventory`. Pattern: `Permissions.cs` + `DefaultPermissionProvider` + `[HasPermission]` + admin `PermissionKey`; flags via `FeatureKeys` + `FeatureFlagsDto` + `[FeatureFlag("inventory")]`. |
| Notifications for low stock | Reuse `INotificationService.CreateForStaffAsync` (`AppUserId` recipient) and/or WhatsApp templates (Z-report long-open-shift pattern). |
| Ledger pattern to mirror | `MemberCredit` = append-only financial ledger. Stock must use the same idea: **append-only `stock_movements`**; on-hand = sum, never overwrite as sole truth. |

### Critical seams to extend (do not rebuild)

1. **`Sale` / `SaleLine`** — retail lines: `LineType = "retail"`, `ReferenceId = ProductId` (polymorphic, no FK — already by design).
2. **`SaleService.CreateSaleAsync`** — atomic transaction today for membership sale; stock deduction must commit **in the same transaction** as retail lines.
3. **`RefundService.ApproveAsync`** — restore stock when refund reaches `executed` (not on request/reject).
4. **`Permissions` / `DefaultPermissionProvider` / admin nav** — add inventory claims; Receptionist sells retail via existing `sales.sell`.
5. **`FeatureKeys` + tenant `feature_flags`** — gate inventory controllers.
6. **EF conventions** — `BaseEntity`, soft-delete + tenant `HasQueryFilter`, snake_case tables, migrations under `GMS.Infrastructure/Persistence/Migrations/`.

### Critical bugs / traps before coding retail POS

1. **`PaymentTransaction.MembershipId` NOT NULL** — must be made nullable for retail-only (or mixed lines without forcing a membership).
2. **Idempotency** — sales use idempotency keys; stock movements must be keyed to `SaleId`/`SaleLineId` so retries do not double-decrement.
3. **Partial refunds** are **amount-based**, not line-based today — INVS-7 must define restore policy explicitly.
4. Do **not** confuse Frontend `FEATURE_INVENTORY.md` (feature checklist) with a stock module.

---

## B. Conflict register (INVS-0 — binding)

| ID | Conflict | Resolution (binding) |
|----|----------|----------------------|
| C1 | Greenfield inventory vs reserved retail LineType | **Invent** product/warehouse/ledger tables; **extend** `SaleLine`/`SaleService`/`RefundService`. Never create a second POS table. |
| C2 | Multi-warehouse vs missing Branch entity | Implement **`Warehouse`** per tenant (`Code`, `Name`, `IsDefault`, `IsActive`). Do **not** wait for Branch CRUD. Optional nullable `BranchId` column for future map only. |
| C3 | Quantity column vs ledger | **Ledger is source of truth** (`stock_movements`). Optional denormalized `stock_balances` cache refreshed in same transaction — never trust cache alone. |
| C4 | Catalog “products” vs membership plans | Separate entity `Product`. Never overload `MembershipPlan` as retail SKU. |
| C5 | Barcode / units / brands / images in INVS-1 | **MVP columns in INVS-1** (see F-locks): primary `Barcode` VARCHAR(64), `Brand`/`ImageUrl` nullable, `Description*`, money+currency, `TrackStock`/`TrackBatch`/`TrackExpiry`/`AllowFractionalQty`/`IsSellable`/`IsPurchasable`. Multi-barcode table additive later. No on-hand on product. |
| C6 | PO invoice vs tenant `Invoice` | Gym legal invoices stay sale/credit-note documents. Supplier “invoice” on PO receive = **purchase document** (`purchase_invoices` or PO fields) — not `InvoiceService` INV- sequence. |
| C7 | Supplier balance vs MemberCredit | New lightweight **`supplier_ledger_entries`** (or balance on supplier maintained from PO/payments/returns). Do **not** put supplier AP into `member_credits`. |
| C8 | Sell without stock | Default: **reject** retail line if available qty &lt; requested (configurable tenant setting later). Opening stock via adjustments (INVS-4) before sell. |
| C9 | Walk-in retail | Allow `MemberId` null for retail-only carts once create-sale is generalized; cash still requires open shift (`payments.cash.accept` path unchanged). |
| C10 | Mixed cart (membership + retail) | Supported after INVS-6: one `Sale`, multiple `SaleLine`s; membership activation rules unchanged for membership lines; stock only for retail lines. |
| C11 | Batch / expiry | Optional on **goods receipt** and movements from INVS-5; FIFO consumption deferred until sell path can pick batches (INVS-6 may use simple qty first; FIFO hardens when batches exist). |
| C12 | Platform `branches` cap | Do **not** invent Branch writes in inventory prompts. Warehouse count may be soft-capped later; ignore `UsageMetrics.Branches` until Branch CRUD exists. |
| C13 | COGS / GL accounting | Out of scope until after INVS-10. Persist `UnitCost` on movements for **valuation reports**; no full double-entry GL. |
| C14 | Feature flag gating | All inventory controllers: `[FeatureFlag("inventory")]` + inventory permissions. Sales retail deduct still requires `sales` feature + `sales.sell`. |
| C15 | Web UI vs API-first | Backend prompts ship with contracts updates in `FRONTEND_API_CONTRACTS.ts`. Desk UI can follow per prompt; Flutter not blocking. |
| C16 | Soft delete products with stock history | Soft-delete (`IsDeleted`) + **Archived** flag for catalog; never hard-delete rows referenced by movements. |
| C17 | Adjustments approval | Opening stock / small adjustments: Manager+ may post directly. Larger / count variance (INVS-9): draft → approved. |
| C18 | Service items vs stocked SKUs | `TrackStock=false` for towel/locker fees sold via retail line without ledger; never overload `SaleLine` `fee` until catalog can represent both. |

---

## C. Agent preamble (paste above every INVS-N)

> You are implementing HyMotion inventory. Read `Frontend/INVENTORY_SYSTEM_PROMPTS.md` section B conflicts; do not create a second POS or invoice engine; retail = `SaleLine.LineType="retail"` + `ReferenceId=ProductId`; stock on-hand = sum of `stock_movements`; warehouses are not Branches; follow OpenWolf `.wolf/OPENWOLF.md`; multi-tenant EF filters + soft-delete required on new entities.

---

## D. Phased prompts

### INVS-0 — Conflict Register & Architecture Review ✅ (this document)

**Business objective:** Freeze extension points vs invent list before any migration.

**Conflict check:** Sections A–B are authoritative. Re-verify `SaleService`, `RefundService`, `PaymentTransactionConfiguration`, `Permissions`, `FeatureKeys` if the tree moved.

**Required schema changes:** None (documentation only).

**Backend implementation steps:** None.

**API changes:** None.

**Validation rules:** N/A.

**Acceptance criteria:**
1. Team agrees C1–C17.
2. No PR invents `Branch` solely to unblock warehouses.
3. No PR stores stock qty without a movement ledger (from INVS-3 onward).

**Test scenarios:** N/A.

**Rollback / compatibility:** N/A.

---

### INVS-1 — Product Catalog ✅ DONE (2026-08-07)

**Business objective:** Tenant-owned product master so Front Desk can later sell Protein / Water / Merch without overloading membership plans — and without schema breakage when ledger, PO/GRN, POS retail, refunds, and batch/expiry land.

**Conflict check:** C4, C5, C14, C16 + **forward-compat locks F1–F14** below.

#### Forward-compatibility locks (verify before coding INVS-1)

| ID | Future consumer | Catalog must already… | Breaking if we ship without it |
|----|-----------------|------------------------|--------------------------------|
| F1 | INVS-3 ledger | Use **`Guid` PK** (`BaseEntity.Id`) as the only product key referenced elsewhere | Renaming PK / surrogate SKU-as-PK later |
| F2 | INVS-3 / 6 / 7 | Treat on-hand as ledger-owned — **no `QtyOnHand` column on `products`** | Moving qty off the product row later |
| F3 | INVS-3 qty `decimal(18,3)` | Store **`ReorderMinQty` as `decimal(18,3)`**; add **`AllowFractionalQty`** (default `false`) so POS/receive can enforce integer steps when false | Expanding int→decimal under live data without clear sell rules |
| F4 | INVS-5/6/8 | Add **`TrackStock`** (default `true`). When `false` = service/fee-like sellable item: no ledger posts, no PO receive qty, no transfer | Bolting `TrackStock` later forces backfill + path forks mid-POS |
| F5 | INVS-5 batch/expiry | Keep **`TrackBatch`**, **`TrackExpiry`**. Rules: `TrackExpiry` ⇒ `TrackBatch` must be true; enabling either when `TrackStock=false` rejected; **enabling** after non-batch stock exists only if on-hand = 0 (else migrate in a later tool — block with clear error); **disabling** either flag forbidden if any `product_batches` / movement `BatchId` exists | Bools alone without immutability rules → ambiguous stock dimensions |
| F6 | INVS-6 `SaleLine` | POS identity = **`Product.Id` → `SaleLine.ReferenceId`** with `LineType="retail"`. Never put SKU in `ReferenceId`. Snapshot **Name/SKU into `Description`** at sale time (history survives rename/archive) | Changing sell identity to SKU string |
| F7 | INVS-6/7 pricing | `SellPrice` / `CostPrice` = `DECIMAL(12,2)`; **`Currency` CHAR(3) default `EGP`** (mirror `MembershipPlan`). List prices only — sale line / movement own actual unit price & unit cost | Adding currency later as non-null without default |
| F8 | INVS-6 tax | **`Taxable`** + nullable **`VatRatePercent`** (`DECIMAL(5,2)`); null = tenant default VAT | Replacing bool with rate later breaks clients |
| F9 | INVS-5 purchasing | **`IsPurchasable`** (default `true`) and **`IsSellable`** (default `true`) independent of archive. PO lines require purchasable+active; POS requires sellable+active+!archived | Using only `IsActive` for both paths |
| F10 | INVS-3+ identity | **`Sku` immutable** after first stock movement **or** any sale line / PO line reference. **`UnitOfMeasure` immutable** after first stock movement (same reason as ledger meaning). Name/NameAr always editable | Allowing UoM flip pcs↔kg after movements |
| F11 | INVS-16 barcodes | **`Barcode` VARCHAR(64) NULL** = primary scan code (unique per tenant filtered). Do **not** make barcode the PK. Multi-barcode packs = additive `product_barcodes` later **without** removing primary column | Unique(13) too short; barcode-as-PK |
| F12 | INVS-4/9 status | Prefer clear flags: **`IsArchived`** (catalog hide; not sellable/purchasable), **`IsActive`** (operational pause). Soft-delete `IsDeleted` only for mistaken creates never referenced; **prefer archive**. Selling filters: `!IsDeleted && !IsArchived && IsActive && IsSellable` | Dual archive+delete without documented precedence |
| F13 | INVS-7 refunds | No warehouse on product. Refund restore resolves warehouse from **sale stock movement** (`ReferenceType=SaleLine`). Catalog must not invent “default restore warehouse” that overrides history | Adding required `DefaultWarehouseId` used as restore target |
| F14 | INVS-5 cost | `CostPrice` = **last receipt / manual default** only (documentation). Valuation uses movement `UnitCost`. Optional later `CostingMethod` on tenant settings — **not** required on product in INVS-1 | Putting average/FIFO state only on product |

**Compatible by design (no INVS-1 change needed):** separate `product_batches` table in INVS-5; `WarehouseId` only on movements/balances; supplier tables; nullable `PaymentTransaction.MembershipId` (INVS-6 migration, not catalog).

**Required schema changes:**
- `product_categories` — `TenantId`, `Name` NVARCHAR(150), `NameAr` NVARCHAR(150) null, `SortOrder` int default 0, `IsActive` bool default true, soft-delete + tenant filter. Restrict delete if products reference (or soft-delete only).
- `products`:
  - Identity: `Id` Guid, `TenantId`, `CategoryId?` FK → categories (ON DELETE RESTRICT / NO ACTION)
  - Catalog: `Sku` VARCHAR(64), `Barcode` VARCHAR(64) NULL, `Name` NVARCHAR(150), `NameAr` NVARCHAR(150) null, `Description` NVARCHAR(500) null, `DescriptionAr` NVARCHAR(500) null, `Brand` NVARCHAR(100) null, `ImageUrl` VARCHAR(500) null, `UnitOfMeasure` VARCHAR(16) not null default `pcs`
  - Money: `SellPrice` DECIMAL(12,2), `CostPrice` DECIMAL(12,2) default 0, `Currency` CHAR(3) default `EGP`, `Taxable` bit default true, `VatRatePercent` DECIMAL(5,2) null
  - Behaviour: `TrackStock` bit default true, `TrackBatch` bit default false, `TrackExpiry` bit default false, `AllowFractionalQty` bit default false, `IsSellable` bit default true, `IsPurchasable` bit default true, `ReorderMinQty` DECIMAL(18,3) default 0
  - Status: `IsActive` bit default true, `IsArchived` bit default false, soft-delete columns from `BaseEntity`
  - Indexes: filtered unique `(TenantId, Sku)` WHERE `IsDeleted=0`; filtered unique `(TenantId, Barcode)` WHERE `IsDeleted=0 AND Barcode IS NOT NULL`; index `(TenantId, IsArchived, IsActive)`
- **Do not create:** `QtyOnHand`, `WarehouseId`, `BatchNumber`, supplier FKs on `products`.
- Seed: empty catalog (no global products).

**Backend implementation steps:**
1. Entities + configurations + DbSets + combined tenant/soft-delete filters (same lesson as `AuditEvent` / commercial entities).
2. `IProductService` / `ProductService`: list/search (`q`, category, includeArchived), get, create, update, archive/unarchive. Enforce F5/F10 on update.
3. Permissions: `inventory.view`, `inventory.manage` in `Permissions.All`; Owner+Manager manage; Receptionist view only.
4. `FeatureKeys.Inventory = "inventory"`; extend `FeatureFlagsDto` + tier seed (binding: **enabled for Growth/Pro/Enterprise**, Starter off unless overridden — document in cerebrum).
5. Audit: `product.create` / `product.update` / `product.archive`.
6. Expose read DTO flags needed by later POS (`trackStock`, `allowFractionalQty`, prices) so clients do not guess.

**API changes:**
- `GET/POST /api/inventory/products`
- `GET/PUT /api/inventory/products/{id}`
- `POST /api/inventory/products/{id}/archive` / `unarchive`
- `GET /api/inventory/products/by-barcode/{code}` — ship in INVS-1 (cheap; INVS-6 scanner depends on it; 404 if archived/inactive)
- `GET/POST /api/inventory/categories` (+ PUT)
- Controllers: `[FeatureFlag("inventory")]`, `[HasPermission(...)]`
- Update `FRONTEND_API_CONTRACTS.ts` (§ Inventory) with full product fields above

**Validation rules:**
- SKU required, trimmed, case-sensitive store / compare trimmed; unique per tenant among non-deleted.
- Barcode optional; max 64; unique when set.
- Prices ≥ 0; if `IsSellable && IsActive && !IsArchived` then `SellPrice` required (≥ 0 allowed for promos? binding: **≥ 0**, zero allowed).
- `TrackExpiry && !TrackBatch` → 400.
- `!TrackStock && (TrackBatch \|\| TrackExpiry)` → 400.
- `AllowFractionalQty=false` ⇒ callers later must send whole quantities (document; enforce at ledger/POS).
- Archive ⇒ force not sellable in queries; keep row for FKs.
- Cannot hard-delete via API.
- After stock/sale/PO reference exists: reject SKU and `UnitOfMeasure` changes; reject turning **on** batch/expiry if on-hand ≠ 0; reject turning **off** batch/expiry if batches/movements with batch exist (services may stub “has stock refs” as false until INVS-3 — keep the hooks).

**Acceptance criteria:**
1. Owner can create Category + Product with SKU/barcode + stock/batch flags.
2. Duplicate SKU/barcode → 400.
3. Default list excludes archived; `?includeArchived=true` includes them.
4. Cross-tenant isolation test.
5. Product row has **no** quantity column; DTO does not pretend on-hand exists yet (`onHand` omitted until INVS-3).
6. `TrackExpiry` without `TrackBatch` rejected.
7. `by-barcode` returns product id usable as future `SaleLine.ReferenceId`.

**Test scenarios:**
- Create/list/update/archive; unique SKU/barcode; permission matrix; F5 flag matrix; fractional flag defaults false; currency defaults EGP.

**Rollback / compatibility:**
- Additive migration only; membership POS unchanged.
- Feature flag off → existing FeatureFlag filter behavior.
- Later INVS-3+ only **add** tables/FKs to `Product.Id`; no product column renames planned.

---

### INVS-2 — Warehouses & Branch Mapping ✅ DONE (2026-08-07)



### INVS-3 — Stock Ledger Foundation ✅ DONE (2026-08-07)

**Business objective:** Every quantity change is an immutable movement; on-hand = ledger sum (per product + warehouse [+ batch later]).

**Conflict check:** C3, C13, C16.

**Required schema changes:**
- `stock_movements` — `TenantId`, `ProductId`, `WarehouseId`, `BatchId?` null, `QtyDelta` (signed decimal or int — **prefer `decimal(18,3)`** for future fractional units; MVP int OK if UnitOfMeasure is pcs-only — **binding: `decimal(18,3)`**), `UnitCost` decimal(14,2) nullable, `Reason` VARCHAR (`opening` \| `purchase_receipt` \| `purchase_return` \| `sale` \| `sale_refund` \| `adjustment` \| `transfer_out` \| `transfer_in` \| `count`), `ReferenceType` VARCHAR, `ReferenceId` Guid?, `Note?`, `OccurredAtUtc`, `CreatedByUserId?`, soft-delete **discouraged** (prefer void compensating movement — if soft-delete used, filters must exclude deleted from sums).
- `stock_balances` (cache) — `(TenantId, ProductId, WarehouseId, BatchId?)` → `QtyOnHand`, `UpdatedAtUtc`. Unique key; updated only inside movement writers.
- Indexes: `(TenantId, ProductId, WarehouseId)`, `(TenantId, ReferenceType, ReferenceId)`.

**Backend implementation steps:**
1. `IStockLedgerService.PostAsync(...)` — **only** writer of movements + balance upsert; used by all later INV prompts.
2. `GetOnHandAsync(productId, warehouseId)` = balance row or sum(movements).
3. Never expose raw balance update API.
4. Audit optional for high-value adjustments only (avoid double audit noise).

**API changes:**
- `GET /api/inventory/stock?productId=&warehouseId=` → on-hand + optional movement page.
- `GET /api/inventory/products/{id}/stock` → per-warehouse breakdown.
- No public “set quantity” endpoint.

**Validation rules:**
- `QtyDelta == 0` rejected.
- Product/warehouse must be active & same tenant.
- Idempotent posts when `(ReferenceType, ReferenceId, Reason)` already exists (for sale/refund) — return existing.

**Acceptance criteria:**
1. On-hand equals sum of deltas in tests.
2. Concurrent posts do not corrupt balance (transaction + row lock / serializable as needed).
3. No other service writes `stock_balances` directly.

**Test scenarios:**
- +100 then -5 → 95.
- Duplicate sale reference does not double-post.
- Cross-tenant product id rejected.

**Rollback / compatibility:** Additive; POS still unchanged until INVS-6.

---

### INVS-4 — Opening Stock & Adjustments ✅ DONE (2026-08-07)

**Business objective:** Seed initial quantities and correct damage/loss/expiry/manual fixes with optional approval.

**Conflict check:** C8, C17.

**Required schema changes:**
- `stock_adjustments` — header: `TenantId`, `WarehouseId`, `Status` (`draft` \| `posted` \| `cancelled`), `ReasonCode` (`opening` \| `damage` \| `lost` \| `expired` \| `manual_count` \| `other`), `Note?`, `CreatedByUserId`, `PostedByUserId?`, `PostedAtUtc?`.
- `stock_adjustment_lines` — `ProductId`, `QtyDelta`, `UnitCost?`.
- Permission: `inventory.adjust` (Owner/Manager; not Receptionist).

**Backend implementation steps:**
1. Create draft → add lines → `POST .../post` applies ledger `Reason=opening|adjustment` via `IStockLedgerService`.
2. Opening stock: allow positive only; normal adjustments allow signed deltas.
3. Posting must refuse if it would drive on-hand below 0 (unless reason `opening` on empty SKU — still no negative).
4. Wire `DefaultPermissionProvider` for `inventory.adjust`.

**API changes:**
- `POST /api/inventory/adjustments`
- `GET /api/inventory/adjustments/{id}`
- `POST /api/inventory/adjustments/{id}/post`
- `POST /api/inventory/adjustments/{id}/cancel` (draft only)

**Validation rules:**
- ManagerOrAbove + `inventory.adjust`.
- Posted adjustment immutable; corrections = new opposite adjustment.
- ReasonCode required.

**Acceptance criteria:**
1. Opening +50 Protein at Main Store → on-hand 50.
2. Damage -2 → 48; movement reasons correct.
3. Receptionist cannot post.

**Test scenarios:**
- Draft cancel; post twice rejected; negative on-hand blocked.

**Rollback / compatibility:** Does not alter sales. Feature-flagged.

---

### INVS-5 — Purchase Orders & Goods Receipt (optional Batch/Expiry) ✅

**Business objective:** Buy stock from suppliers; receive (partial OK); increase stock; capture cost / optional batch+expiry.

**Conflict check:** C6, C7, C11.

**Required schema changes:**
- `suppliers` — `TenantId`, `Name`, `NameAr?`, `Phone?`, `Email?`, `PaymentTerms?`, `Notes?`, `IsActive`, soft-delete.
- `purchase_orders` — `TenantId`, `SupplierId`, `WarehouseId` (receiving target), `Status` (`draft` \| `approved` \| `partially_received` \| `received` \| `cancelled`), `OrderedAtUtc`, `ApprovedAtUtc?`, `Notes?`.
- `purchase_order_lines` — `ProductId`, `QtyOrdered`, `QtyReceived`, `UnitCost`.
- `goods_receipts` — `TenantId`, `PurchaseOrderId`, `WarehouseId`, `ReceivedAtUtc`, `ReceivedByUserId`.
- `goods_receipt_lines` — `PurchaseOrderLineId`, `ProductId`, `Qty`, `UnitCost`, `BatchNumber?`, `ExpiresOn?` (DateOnly).
- `product_batches` (if TrackBatch/TrackExpiry) — `TenantId`, `ProductId`, `BatchNumber`, `ExpiresOn?`, unique (tenant, product, batch).
- Optional: `supplier_ledger_entries` — signed amount, `Reason` (`purchase` \| `payment` \| `return_credit`), `ReferenceType/Id`.

**Backend implementation steps:**
1. Supplier CRUD (`inventory.manage`).
2. PO workflow: draft → approve → receive.
3. Receive creates GRN + stock movements `purchase_receipt` (+ batch rows when provided).
4. Partial receive updates line `QtyReceived` and PO status.
5. Cancel PO only if nothing received.
6. Permissions: `inventory.purchase` for approve/receive (Manager+).

**API changes:**
- `/api/inventory/suppliers`
- `/api/inventory/purchase-orders` (+ approve, cancel)
- `POST /api/inventory/purchase-orders/{id}/receipts` body: lines with qty/cost/batch/expiry
- `GET` PO detail with received totals

**Validation rules:**
- Receive qty ≤ remaining ordered.
- Cost ≥ 0; update product `CostPrice` to last receipt cost (document).
- If `TrackExpiry` and expiry null → 400.
- Barcode scan is client-side resolve to `ProductId` (no separate scan API required); optional `GET /api/inventory/products/by-barcode/{code}`.

**Acceptance criteria:**
1. Approve PO 100 Protein @ 50 EGP → receive 40 → on-hand +40, status `partially_received`.
2. Receive remaining 60 → `received`.
3. Batch+expiry stored when product flags require them.

**Test scenarios:**
- Over-receive rejected; cancel after partial rejected; supplier isolation.

**Rollback / compatibility:**
- Purchase docs ≠ gym `Invoice` numbers.
- No automatic tenant sales invoice.

---

### INVS-6 — POS Retail Stock Deduction ✅

**Business objective:** When POS sells a retail product, stock decreases automatically in the sale transaction.

**Conflict check:** C1, C8, C9, C10, C14; PaymentTransaction MembershipId trap.

**Required schema changes:**
- Migrate `payment_transactions.MembershipId` → **nullable**; drop required FK behavior accordingly (keep FK when present).
- No change to `SaleLine` shape (use existing `retail` + `ReferenceId`).
- Optional: `SaleLine` snapshot `UnitCost` not required if movement stores cost from balance/avg — prefer movement `UnitCost` = product cost at sale time.

**Backend implementation steps:**
1. Extend `CreateSaleRequest` to support **either**:
   - legacy: `PlanId` (+ existing membership path), **and/or**
   - `Lines: [{ lineType, productId?, planId?, qty, unitPrice? }]`
   - Binding compatibility: keep `PlanId` working unchanged for existing web POS.
2. `SaleService`: for each retail line — validate product active, price, warehouse (default or request `WarehouseId`), on-hand ≥ qty; insert `SaleLine`; `IStockLedgerService.PostAsync` with `Reason=sale`, `ReferenceType=SaleLine`, `ReferenceId=line.Id`, `QtyDelta=-qty`.
3. Mixed carts: create membership as today for membership lines; retail lines after membership block inside same transaction.
4. Walk-in: allow null member when **no** membership/trial lines require a member (retail-only).
5. Idempotency: replay must not re-post stock (ledger idempotency key).
6. Z-report already aggregates sale totals — retail revenue appears naturally; no fake lines.

**API changes:**
- Evolve `POST /api/sales` request/response contracts; document examples for retail-only and mixed.
- `GET /api/inventory/products/by-barcode/{code}` for scanner UX.
- Update FluentValidation (`CreateSaleRequestValidator`).

**Validation rules:**
- Insufficient stock → 400 with product SKU/name.
- `sales.sell` + feature `sales`; inventory feature required when any retail line present.
- Cash payments still need open shift (existing rules).

**Acceptance criteria:**
1. Sell 2× Protein → on-hand -2; sale has `LineType=retail`, `ReferenceId=productId`.
2. Legacy PlanId-only sale still passes existing tests.
3. Double submit same idempotency key → one sale, one stock movement.
4. Payment rows work with null `MembershipId` on retail-only.

**Test scenarios:**
- Retail-only; mixed membership+retail; insufficient stock; idempotent retry; walk-in cash.

**Rollback / compatibility:**
- Nullable MembershipId is backward compatible for old rows.
- Clients omitting `Lines` keep old behavior.

---

### INVS-7 — Refund Stock Restore ✅

**Business objective:** Executed sale refunds return retail qty to stock.

**Conflict check:** C1; partial refund policy.

**Required schema changes:** None beyond ledger reasons (`sale_refund`). Optional `refund_lines` later — not required if policy is conservative.

**Backend implementation steps:**
1. In `RefundService.ApproveAsync`, after refund marked executed (same transaction):
   - Load sale lines with `LineType == "retail"`.
   - **Binding policy (MVP):** restore stock **only on full sale refund** (sale status `refunded`), restoring full `Qty` per retail line to the **original sale warehouse** (store `WarehouseId` on movement reference lookup via sale-line movement).
   - Partial amount refunds: **do not** restore stock (document); future = line-level refunds.
2. Post `QtyDelta = +qty`, `Reason=sale_refund`, `ReferenceType=Refund`, `ReferenceId=refund.Id` (unique per sale line via composite note or child ref).
3. Do not restore on `RequestAsync` / `RejectAsync`.
4. Credit-method refunds (store credit): **still restore stock** if full refund (goods returned) — product decision binding: **yes restore** unless note says “refund without return” (out of scope flag).

**API changes:** None new; refund responses may include `stockRestored: true`.

**Validation rules:**
- Idempotent restore if approve retried.
- Missing original sale movement → fail refund approve with clear error (data integrity).

**Acceptance criteria:**
1. Full refund after retail sale → stock back to pre-sale.
2. Partial amount refund → stock unchanged.
3. Membership-only refund behavior unchanged (cancel membership).

**Test scenarios:**
- Full retail refund; partial refund; mixed sale full refund restores only retail lines.

**Rollback / compatibility:** Existing membership refunds unchanged.

---

### INVS-8 — Warehouse Transfers ✅

**Business objective:** Move stock Main Store → Front Desk with pending → received completeness.

**Conflict check:** C2.

**Required schema changes:**
- `stock_transfers` — `FromWarehouseId`, `ToWarehouseId`, `Status` (`pending` \| `in_transit` \| `completed` \| `cancelled`), timestamps, users.
- `stock_transfer_lines` — `ProductId`, `Qty`, `BatchId?`.

**Backend implementation steps:**
1. Create transfer (reserve): post `transfer_out` (-qty) at source **or** two-phase: pending without stock until ship — **binding: two-phase**:
   - `submit` → status `in_transit` + `transfer_out` immediately (stock leaves source).
   - `receive` → `transfer_in` at destination + `completed`.
   - `cancel` only before submit; after submit require `reject` that posts compensating `transfer_in` back to source if not received.
2. Permission `inventory.transfer` (Manager+).

**API changes:**
- `POST /api/inventory/transfers`
- `POST /api/inventory/transfers/{id}/submit`
- `POST /api/inventory/transfers/{id}/receive`
- `POST /api/inventory/transfers/{id}/cancel`

**Validation rules:**
- From ≠ To; sufficient source qty at submit; same tenant.

**Acceptance criteria:**
1. Submit moves qty out; receive moves in; totals conserved.
2. Cannot receive twice.

**Test scenarios:**
- Happy path; insufficient source; cancel before submit.

**Rollback / compatibility:** Isolated from POS.

---

### INVS-9 — Stock Count & Adjustments ✅

**Business objective:** Periodic count → variance adjustments with approval.

**Conflict check:** C17 (stricter than INVS-4).

**Required schema changes:**
- `stock_counts` — `WarehouseId`, `Status` (`draft` \| `submitted` \| `approved` \| `cancelled`), `CountedAtUtc`.
- `stock_count_lines` — `ProductId`, `SystemQty` (snapshot), `CountedQty`, `Variance`.

**Backend implementation steps:**
1. Start count: snapshot system qty from balances.
2. Enter counted qty → variance.
3. Approve → create posted `stock_adjustments` (or direct ledger `count` reasons) for nonzero variances.
4. Permission: create/submit `inventory.adjust`; approve may require Manager (same) + audit.

**API changes:**
- `/api/inventory/counts` CRUD + submit + approve.

**Validation rules:**
- Snapshot frozen at start; approve uses variance vs snapshot, not live drift — if live changed, reject approve and ask recount (binding).

**Acceptance criteria:**
1. Count 45 vs system 50 → approved posts -5 adjustment.
2. Mid-count sale causing drift → approve fails with clear message.

**Test scenarios:**
- Zero variance no movements; approve posts; double approve rejected.

**Rollback / compatibility:** Builds on INVS-4 adjustment reasons.

---

### INVS-10 — Reports & Low Stock Alerts ✅ DONE (2026-08-07)

**Business objective:** Ops dashboard cards + staff alerts when on-hand ≤ reorder min; expiry windows when batches exist.

**Conflict check:** C13, C14; notifications pattern.

**Required schema changes:**
- Optional none; compute from `stock_balances` + `products.ReorderMinQty` + `product_batches.ExpiresOn`.
- Tenant settings keys (JSON on `Tenant.Settings`): `inventory_low_stock_notify_roles` (default Owner/Manager), `inventory_expiry_windows_days` = `[90,30,7]`.

**Backend implementation steps:**
1. `GET /api/inventory/reports/summary` — inventory value (sum qty×cost), out-of-stock count, low-stock count, expiring-soon counts.
2. `GET /api/inventory/reports/movements` — filter by date/product/warehouse/reason.
3. Hangfire daily job `inventory-low-stock` (e.g. 08:00 Cairo): for each tenant with feature on, notify staff via `CreateForStaffAsync`.
4. Permission `inventory.view` for reports; financial valuation may also require `reports.financial.view` (binding: valuation needs **both**).

**API changes:**
- Report endpoints under `/api/inventory/reports/*`
- Contracts + optional web reports widget later

**Validation rules:**
- Date range max 366 days.
- Expiry report empty-success when no batches.

**Acceptance criteria:**
1. After INVS-4/5/6 data, summary cards non-zero.
2. Product with min 10 and qty 8 triggers notification once per day (dedupe key).

**Test scenarios:**
- Low stock notify; valuation math; movement filter.

**Rollback / compatibility:** Read-only + notifications; no sales path change.

---

## E. Build order

```text
INVS-0 → INVS-1 → INVS-2 → INVS-3 → INVS-4
                                      ↓
                                   INVS-5
                                      ↓
                                   INVS-6 → INVS-7
                                      ↓
                                   INVS-8 → INVS-9 → INVS-10
```

**First vertical slice (recommended demo path):**  
INVS-1 → 2 → 3 → 4 (opening stock) → 6 (POS deduct) → 7 (refund restore) → 10 (low stock).  
Insert INVS-5 when purchasing goes live; INVS-8/9 when multi-location ops need them.

---

## F. Out of scope (defer)

- Full GL / COGS journal posting
- Branch entity + platform branch-cap enforcement
- Demand forecast / ABC / auto-PO drafts (old roadmap INVS-19–22)
- Camera/USB scanner drivers (client-only; API is barcode lookup)
- Product image CDN pipeline (nullable URL only)
- Line-level partial refunds
- Platform billing of inventory (SaaS remains `GMS.Platform`)

---

## G. Permission & feature checklist (cross-cutting)

| Claim / key | Owner | Manager | Receptionist | Used by |
|-------------|-------|---------|--------------|---------|
| `inventory.view` | ✓ | ✓ | ✓ | reads, reports (non-financial) |
| `inventory.manage` | ✓ | ✓ | | products, warehouses, suppliers |
| `inventory.adjust` | ✓ | ✓ | | adjustments, counts |
| `inventory.purchase` | ✓ | ✓ | | PO approve/receive |
| `inventory.transfer` | ✓ | ✓ | | transfers |
| `sales.sell` | ✓ | ✓ | ✓ | retail POS lines |
| feature `inventory` | tier-seeded | | | inventory controllers |
| feature `sales` | existing | | | `POST /api/sales` |

Update: `Permissions.cs`, `DefaultPermissionProvider`, permission tests, admin `PermissionKey` + nav when UI ships.

---

## H. Coding conventions reminder

- New entities: `GMS.Core/Entities` + `*Configuration.cs` + migration via  
  `dotnet ef migrations add … --project GMS.Infrastructure --startup-project GMS.Api`
- Stop running `GMS.Api` before build if DLL locked.
- Mirror invitation pack discipline: contracts in `Frontend/FRONTEND_API_CONTRACTS.ts`, tests in `GMS.Tests`, OpenWolf `cerebrum` / `memory` / `anatomy` updates each completed INVS.
