# Member Outstanding Balance — Architecture Proposal

**Status:** Design preview only. Wait for Product Accept before any production work.  
**Preview:** `previews/member-outstanding-balance.html`  
**Date:** 2026-08-16

This is not a new financial subsystem. HyMotion already stores remaining amounts on sales and already records follow-on payments against a specific sale. This proposal makes that truth visible and collectable on Member 360.

---

## Verdict

**READY FOR IMPLEMENTATION** of option **B — Member Outstanding Balance derived from existing Sales / Payments.**

Not because the desk is finished (it is not), but because the financial architecture already exists and is the correct source of truth. The remaining work is a **read + UX surface**, not a debt ledger.

Do **not** start coding until Product Accept.

### Why B, not A or C

| Option | Meaning | Verdict |
|---|---|---|
| **A. Dedicated Member Debt module** | `Member.DebtAmount`, Debtors desk, write-offs, aging as product | **Reject.** Would duplicate `Sale.AmountDue` and recreate the Debtors module that was already removed from nav. |
| **B. Derived outstanding** | Sum of `Sale.AmountDue` where the buyer is this member | **Accept.** This is already how `GET /api/debtors` works. |
| **C. Both** | Derived total plus a stored member debt | **Reject.** Two truths. `GymMember` has no debt column today — keep it that way. |

### What must ship in the first implementation (after Accept)

1. **Read:** outstanding *sales* for one member (sale id, total, paid, remaining, due date, description). Today the API only returns a **member-level total**.
2. **Collect Payment** on Member 360 → `POST /api/sales/{id}/payments` against **one selected sale**.
3. Refresh Member 360 + dashboard outstanding after a successful payment.

No `Member.DebtAmount`. No Debtors nav. No auto-allocation across sales. No AR / aging / write-off product language.

---

## 1. Current Architecture

There is no separate Person table. The gym client is `GymMember` (tenant-scoped). Memberships, sales, payments, invoices, and credits all point at `GymMember.Id`.

```
GymMember  (identity of the buyer / member)
    │
    ├── Membership[]          plan assignment; AmountPaid is a snapshot at create
    ├── Sale[]                buyer = Sale.MemberId (nullable for walk-in)
    │       ├── SaleLine[]    membership | retail | trial | day_pass | fee
    │       └── AmountDue     remaining on THIS sale (stored)
    ├── PaymentTransaction[]  MemberId + optional SaleId + ShiftId
    ├── Invoice[]             snapshot of the sale (Hangfire); not the live remaining
    └── MemberCredit[]        wallet the gym owes the member (opposite direction)
```

**Member 360 today** (`/dashboard/members/{id}/`):

- Profile, membership, attendance, invitations, Member App.
- Financial card: **Outstanding** from `GET /api/debtors?memberId=` (one row, `totalDue`).
- Link to invoices (`reports.financial.view`).
- Refund history (`payments.refund.approve`).
- **No Collect Payment.** **No list of unpaid sales.**

**Member list:** no outstanding column.

**Dashboard:** Finance KPI **Outstanding (EGP)** + up to 5 members, from `/debtors/summary` and `/debtors?page=1&pageSize=5`. Click goes to Member 360.

**Debtors desk:** `/dashboard/debtors/` redirects to the dashboard. Not in the sidebar. APIs remain.

**POS / Sale:** can create a **new** sale with `partialPayment.dueDate` when paid &lt; total. “Collect balance on an older sale” was **removed** from POS on purpose. `POST /api/sales/{id}/payments` was kept.

**Supplier payables (PAP AP-1):** opening balance / supplier ledger / pay supplier. **Opposite domain.** Do not reuse for members.

---

## 2. Current Financial Flow

```
POS / assign membership
        │
        ▼
   POST /api/sales     or     MembershipService.PersistPaidMembershipAsync
        │
        ├── Sale.Total, Sale.AmountDue, Sale.Status
        ├── PaymentTransaction(s)  (SaleId set)
        ├── Membership activated even when the sale is partially_paid
        ├── Shift cash movement (cash only, open shift required)
        └── Invoice snapshot queued (sale totals, not remaining)

Later collection (API exists, desk caller removed)
        │
        ▼
   POST /api/sales/{id}/payments
        ├── reject if amount > Sale.AmountDue
        ├── Sale.AmountDue -= amount; Status = completed when AmountDue = 0
        ├── new PaymentTransaction (SaleId = that sale)
        ├── cash → open shift + RecordMovementAsync
        └── receipt = original invoice HTML + ?paymentId=
```

### Status vs remaining

`Sale.Status` is `'completed' | 'partially_paid' | 'refunded' | 'partially_refunded'`.

There is **no** `'unpaid'` status. A sale with paid = 0 and `partialPayment` set is still `partially_paid` with `AmountDue = Total`.

Display language (desk):

| Paid vs Total | Stored status | Show |
|---|---|---|
| Paid = Total | `completed` | Paid |
| 0 &lt; Paid &lt; Total | `partially_paid` | Partially paid |
| Paid = 0, AmountDue &gt; 0 | `partially_paid` | Outstanding |
| Refund path | `refunded` / `partially_refunded` | Refunded (out of outstanding query) |

---

## 3. Existing Capabilities (from code, not assumption)

| # | Question | Answer |
|---|---|---|
| 1 | Can a Sale be partially paid? | **Yes.** `CreateSaleAsync`: if paid &lt; total **and** `partialPayment` is present → `status = partially_paid`, `AmountDue = total − paid`. Without `partialPayment` → `PaymentIncomplete`. |
| 2 | Can a Sale have multiple payments? | **Yes.** Create accepts `payments[]`. Follow-on payments each add a `PaymentTransaction` with the same `SaleId`. |
| 3 | Where is remaining calculated? | **On create:** `RoundHalfUp(total − paidAmount)` written to `Sale.AmountDue`. **On collect:** `AmountDue = max(0, AmountDue − request.Amount)`. **On display:** `Paid = Total − AmountDue`. |
| 4 | Stored or derived? | **Stored on the sale** (`AmountDue`). Member total is **derived** at query time: `SUM(AmountDue)` for that member’s `partially_paid` sales. |
| 5 | Allocated to a specific Sale? | **Yes.** `PaymentTransaction.SaleId`. `POST /sales/{id}/payments` is per-sale. There is no allocate-across-sales API. |
| 6 | Multiple unpaid sales per member? | **Yes.** Debtors groups by `MemberId` and sums. |
| 7 | Can membership payments be partial? | **POS membership sale: yes** (same `partialPayment`). Membership is created **active** with `AmountPaid = paidAmount` (the first payment only). **Assign/renew via MembershipService:** writes a **completed** sale with `AmountDue = 0`. |
| 8 | Are payments reflected in Shifts? | **Cash only**, and only with an **open shift**. Create and RecordPayment both `RecordMovementAsync(..., "sale", amount, saleId)`. Non-cash does not require a shift. A failed shift write after commit is logged; the payment still succeeds. |
| 9 | How are refunds handled? | Separate `Refund` entity. Remainder = `sale.Total − SUM(executed refunds)` (**not** paid, **not** AmountDue). Full refund → `refunded` + membership cancelled + retail stock restore. Partial → `partially_refunded`, no stock. **Refunds do not change `Sale.AmountDue`.** |
| 10 | Existing outstanding concept? | **Yes.** `Sale.AmountDue` + `GET /api/debtors` + `/summary` + Member 360 + dashboard KPI + POS estimate Outstanding. Feature flag `debtors` gates the query APIs. |
| 11 | Supplier payable / purchase balance? | **Yes, separately (PAP AP-1).** Supplier opening / payment / ledger. Do not mix with member outstanding. |
| 12 | Can the current architecture support member outstanding without a new subsystem? | **Yes.** That is already the implementation. Missing piece is **listing the sales** so Collect Payment has a `saleId`. |

`GymMember` has **no** `Debt`, `Outstanding`, or `Balance` field.

`MemberCredit` is an append-only **credit wallet** (gym owes member / member spends credit). It is not member debt.

---

## 4. Recommended Architecture

Keep the chain the product already has:

```
Member (GymMember)
    → Sales (buyer = Sale.MemberId)
        → Payments (PaymentTransaction.SaleId)
            → Outstanding = SUM(Sale.AmountDue)
                 where Status = partially_paid
                   and AmountDue > 0
                   and MemberId is this member
```

Surfaces (already decided, keep):

1. **Member 360** — the operational home: amount due + Collect Payment.
2. **Dashboard Finance KPI** — gym-level “who still owes”.
3. **Sale receipt** — Total / Paid / Outstanding on that ticket.

Do **not** restore `/dashboard/debtors/` as a desk.

---

## 5. Source of Truth

| Fact | Canonical store | Do not |
|---|---|---|
| How much this **sale** still needs | `Sale.AmountDue` | Recompute from payments as a second write |
| How much this **member** owes | Query: sum of those sales | `Member.DebtAmount` |
| What was paid | `PaymentTransaction` rows (`Status = success`) | Edit the member |
| Legal document | `Invoice` snapshot of original sale | Rewrite invoice total on collect |
| Gym-level outstanding | Same query as debtors summary | A Collections module |

`Paid` on responses is already `sale.Total − sale.AmountDue`. Keep that. Do not introduce a second stored `Paid` column.

**Known inconsistency (do not “fix” in this phase unless Product expands scope):** a refund flips `Status` to `refunded` / `partially_refunded` and **does not** clear `AmountDue`. Those sales **drop out** of the outstanding query. Operational meaning: after a refund, we stop treating the remainder as collectable. Documented; acceptable for v1.

---

## 6. Data Model Impact

**No new tables. No `GymMember.DebtAmount`. No migration required for the core model.**

Optional later (not required for v1):

- `Sale` concurrency token / `RowVersion` if double-collect races become real.
- Require `MemberId` when `partialPayment` is set (so walk-in remaining cannot vanish).

Existing fields to keep using:

- `Sale.AmountDue`, `Sale.DueDate`, `Sale.Status`, `Sale.MemberId`
- `PaymentTransaction.SaleId`, `Amount`, `Method`, `ShiftId`, `Status`

DTO addition (read only): outstanding **sale lines** for one member. See §14.

---

## 7. Backend Impact

### Keep as-is

- `POST /api/sales` partial payment
- `POST /api/sales/{id}/payments` (`sales.sell`)
- `GET /api/debtors`, `/summary`, `POST /debtors/{memberId}/remind`
- Feature flag `debtors` on those controllers
- Round-half-up, `PaymentExceedsAmountDue`, open-shift for cash
- Invoice-per-payment tenant setting (default off → original invoice + `?paymentId=`)

### Add (small)

`GET /api/members/{memberId}/outstanding-sales` **or** `GET /api/debtors/{memberId}/sales`

- Permission: `sales.sell` (same as collect)
- Flag: `debtors` (same query family)
- Tenant filter on `Sale.TenantId` + `MemberId`
- Same filter as `ComputeDebtorsAsync`: `partially_paid` AND `AmountDue > 0`
- Return member `totalDue` + the sales (oldest due first)

Prefer nesting under **debtors** so we do not invent a second outstanding engine. The route name in the desk should still say Outstanding / Collect Payment, not Debtor.

### Do not add

- `POST /api/members/{id}/collect` that auto-splits money across sales
- Payment reversal endpoint (refunds already exist)
- Aging buckets on Member 360
- Write-off / credit-limit APIs

### Hardening (same phase if Collect ships)

`RecordPaymentAsync` today does not check `sale.Status`. Add:

- Allow only `status == partially_paid` and `AmountDue > 0`
- Reject `refunded` / `partially_refunded` / `completed`
- Decrement `AmountDue` inside a short transaction (reload the row) so two cashiers cannot over-collect

Do **not** update `Membership.AmountPaid` on collect in v1 (stale snapshot; membership is already active). Out of scope unless Product asks.

---

## 8. Frontend Impact

### Do not

- New sidebar item
- New `/dashboard/debtors/` desk
- New visual language (no black tabs, neon chips, giant hero numbers)
- Fake “Debt payment” modal that posts to a new resource

### Do (Member 360)

Reuse `.fin-360` on the profile card.

When `totalDue > 0` and `sales.sell`:

- Show **Outstanding** in the existing danger color (`has-due`)
- Button **Collect Payment** (lime primary, same as other desk CTAs)
- Quiet list of outstanding sales (name, remaining, due date) — or only in the drawer

When `totalDue = 0`: show **EGP 0.00**, no collect button.

Invoices link stays (`reports.financial.view`). Refund history stays (approve perm).

Do **not** add Total Sales / Total Paid as required KPIs in v1. Invoices + this outstanding card already answer “what happened / what is still due.” Extra totals would need a new aggregate query and are not needed to collect.

### Dashboard

Keep the existing Outstanding KPI + 5-name list. After collect, the next dashboard load is enough; no live socket.

### POS

Keep creating partial sales. Do **not** put Collect-on-older-sale back on the Sale desk.

---

## 9. Member 360 UX

Operational copy only:

- Outstanding / المستحق
- Amount due / المبلغ المستحق
- Remaining / المتبقي
- Collect Payment / تحصيل دفعة
- Payment history → existing **View invoices**

When the member owes money, the receptionist should read:

> This member owes the gym **1,500 EGP**.

Not “Accounts receivable 1,500” and not aging buckets (`0-7` / `8-30` / `30+` exist on `DebtorDto` for CSV/API only — hide them on Member 360).

**Collect Payment** opens a right drawer (same pattern as Invoices / Staff / Offers).

Archived member: still show outstanding (money does not disappear). Collect remains available if `sales.sell` — the gym can take money without reactivating. Do not invent a block unless Product wants one.

---

## 10. Payment Collection UX

```
Member 360
  → Outstanding > 0
  → Collect Payment
  → Drawer lists outstanding sales (select one)
  → Method + amount (default = remaining on that sale)
  → Confirm
  → POST /api/sales/{saleId}/payments
  → AmountDue reduced, shift cash if cash, receipt URL if invoice exists
  → Close drawer, refresh Outstanding
```

### Option A / B / C (multiple sales)

| | Approach | Fit |
|---|---|---|
| **A** | Pay against **one** sale | **Recommend.** Matches `POST /sales/{id}/payments`. Safest. Receptionist sees which ticket they are closing. |
| B | Pay a lump sum, auto-allocate oldest-first | New allocator, race/partial-failure complexity, harder receipts. **Not v1.** |
| C | Both | Extra UI. **Not v1.** Revisit only if gyms routinely split one cash take across many tickets. |

If the member has one outstanding sale, pre-select it and skip the choice.

### Guards (already in API)

- Amount &gt; 0
- Amount ≤ `AmountDue` (`PAYMENT_EXCEEDS_AMOUNT_DUE`)
- Cash requires open shift (`OPEN_SHIFT_REQUIRED` → 409)
- Valid methods: `cash | card_paymob | fawry | vodafone | instapay | account_credit`

Desk: cap the amount input at remaining; disable confirm if over. Show the API error if two staff raced.

Overpayment of the **member** (paying more than all outstanding) is prevented because we only post against one sale’s remaining.

`account_credit` spends `MemberCredit` (gym-held wallet). Only offer it if we already do on POS for that member; do not invent a credit-vs-debt netting screen.

---

## 11. Permission Impact

Reuse existing permissions. Do not add `debtors.view` / `outstanding.collect`.

| Action | Permission | Who today |
|---|---|---|
| See Outstanding on Member 360 | `sales.sell` (current card) | Owner, Manager, Receptionist |
| Gym-level Outstanding KPI | `reports.financial.view` | Owner, Manager (not Receptionist) |
| Collect Payment | `sales.sell` | Owner, Manager, Receptionist |
| View invoices | `reports.financial.view` | Owner, Manager |
| Request refund | `payments.refund.request` | Owner, Manager, Receptionist |
| Approve refund / see refund history | `payments.refund.approve` | Owner, Manager |
| Cash collect | also needs open shift + `payments.cash.accept` is **not** checked on RecordPayment today (same as POS) | Keep consistent with POS |

**Trainer** has neither `sales.sell` nor `reports.financial.view` — finance card stays hidden. Correct.

Feature flag `debtors`: if off, outstanding APIs 403/hidden. Member 360 already shows “—” when the call fails. Keep that; do not bypass the flag with a second query.

---

## 12. Edge Cases

| Case | Behaviour |
|---|---|
| Multiple outstanding sales | List them. Collect against **one**. Member total = sum. |
| Partially paid sale | Remaining = `AmountDue`. Default collect amount = remaining. |
| Fully unpaid (paid = 0) | Same status `partially_paid`. Label **Outstanding**. API allows empty/zero payments + `partialPayment`; POS currently forces a payment line — leave POS as-is. |
| Payment reversed | No reversal API. Use **refund**. |
| Payment refunded | Sale leaves outstanding query. Do not collect on `refunded` / `partially_refunded`. |
| Sale cancelled | No sale-cancel status. Refund / void invoice are the paths. |
| Membership cancelled | Outstanding on the **sale** remains until paid or refunded. Cancelling the membership does not write `AmountDue`. |
| Member archived (`IsActive = false`) | Outstanding still computed (GymMembers loaded without an active filter in DebtorsService). Show + allow collect. |
| Member transferred | Do **not** rewrite `Sale.MemberId`. Outstanding stays with the **buyer** of the sale. |
| Owes money and renews | New sale is independent. Can create another `partially_paid` sale. Member total increases. Membership still activates on the new POS sale. |
| Buys products while owing | Allowed. Second sale can be fully paid or also partial. |
| Overpay one sale | API 400 `PAYMENT_EXCEEDS_AMOUNT_DUE`. Desk caps input. |
| Two staff collect at once | Possible over-collect today (no row version). Harden RecordPayment with a transaction + reject if `AmountDue` shrank. |
| Tenant isolation | All queries already `TenantId`. Keep. |
| Decimal / EGP | `RoundHalfUp` already on AmountDue. Display with existing `fmtEGP`. |
| Walk-in (`MemberId` null) | Excluded from member outstanding. Remaining exists on the sale but has no member home. **Recommend (small):** require a member when `partialPayment` is set. |
| WhatsApp remind | API exists, 48h throttle, no primary UI. Leave unused unless Product asks. |
| Aging buckets | Stay on API/CSV only. Not on Member 360. |

---

## 13. Migration / Compatibility Risks

| Risk | Level | Mitigation |
|---|---|---|
| Existing `partially_paid` rows | None | Already in `AmountDue` |
| `Member.DebtAmount` backfill | N/A | Do not add the column |
| Debtors flag off | Medium | Collect UI hidden / “—” ; same as today |
| Refunded sales with leftover AmountDue | Low | They already do not appear in the query |
| `Membership.AmountPaid` stale after collect | Low | Do not show AmountPaid as “paid in full” on 360; outstanding is the finance truth |
| POS vs Member 360 two collect UIs | None | POS stays new-sale-only |
| Invoice total ≠ remaining | Expected | Invoice is the original ticket; receipt shows payment received |
| CSV / remind still say “debtor” internally | Cosmetic | Do not rename controllers in v1; desk copy is Outstanding |

No data migration.

---

## 14. Recommended API Changes

### Existing (unchanged)

```
GET  /api/debtors?page&pageSize&memberId     sales.sell
GET  /api/debtors/summary                    reports.financial.view
POST /api/debtors/{memberId}/remind          sales.sell
POST /api/sales/{id}/payments                sales.sell
     body: { method, amount }
     → SaleResponse { totals.paid, totals.amountDue, receiptUrl }
```

### New read (required for Collect)

```
GET /api/debtors/{memberId}/sales            sales.sell
[FeatureFlag("debtors")]
```

```ts
interface MemberOutstandingSalesDto {
  memberId: string;
  totalDue: number;
  sales: OutstandingSaleDto[];
}
interface OutstandingSaleDto {
  saleId: string;
  createdAtUtc: string;
  dueDate?: string | null;
  status: "partially_paid";
  description: string;      // first sale line / plan name
  total: number;
  paid: number;             // total - amountDue
  amountDue: number;
}
```

Empty `sales` + `totalDue = 0` when nothing is due (200, not 404).

### Contract comments

Update `FRONTEND_API_CONTRACTS.ts` §13 only after Accept. Keep the note that Debtors is not a primary product module.

---

## 15. Recommended UI Changes

| Place | Change |
|---|---|
| Member 360 `.fin-360` | Keep Outstanding. Add **Collect Payment** when due &gt; 0 and `sales.sell`. |
| Collect drawer | Select one sale → method → amount → confirm. Success: toast + refresh. |
| Member list | **No** outstanding column in v1 (dashboard already lists who owes). |
| Sidebar / debtors page | **No change** (redirect stays). |
| POS | **No** collect-old-sale. |
| Copy | Outstanding, Amount due, Remaining, Collect Payment. Never Debtor / AR / aging. |

Visual: match Staff / Invoices / quieter Offers — gray canvas, existing `.fin-360` card, lime only on the collect button.

---

## 16. Testing Strategy

### Backend

- DebtorsService: one sale, two sales, other tenant, walk-in excluded, completed excluded, refunded excluded.
- New GET sales-for-member: order oldest due first; `paid = total − amountDue`.
- RecordPayment: exact remaining → completed; overpay 400; cash without shift 409; refunded sale rejected (after hardening).
- Concurrent payments: second request cannot drive AmountDue negative.
- Shift movement amount = payment amount, not sale total.

### Frontend (after Accept)

- Member 360: due = 0 hides Collect; due &gt; 0 shows it.
- Drawer: one sale preselected; two sales require a choice.
- Amount input cannot exceed remaining.
- After 200, Outstanding updates without full page navigation.
- Receptionist sees Collect; Trainer does not see the finance card.
- `node --check` on `member-detail.js`.

### Out of scope for v1 tests

- Auto-allocation
- Aging UI
- Remind WhatsApp
- MemberCredit netting against outstanding

---

## 17. Acceptance Criteria (for the later implement pass)

1. A member with sale 3,000 / paid 2,000 shows **Outstanding 1,000 EGP** on Member 360.
2. Two outstanding sales 1,000 + 500 show **1,500 EGP** total and two rows in the collect drawer.
3. Collect 1,000 against sale A → sale A paid; member outstanding becomes 500; a `PaymentTransaction` exists on sale A; cash hits the open shift.
4. Collect 600 against a 500 remaining sale is **blocked**.
5. Fully paid member shows **0.00** and no Collect button.
6. There is still **no** `GymMember` debt column and **no** Debtors sidebar item.
7. POS still creates partial sales; it still does **not** collect old balances.
8. Language on the desk is Outstanding / Collect Payment, not Debtor / receivable.
9. Tenant A cannot see or collect tenant B’s remaining.
10. Feature flag `debtors` off → no collect path (same as today’s outstanding query).

---

## Flow diagrams

### Create (already live)

```
Cart + pay (paid may be < total)
        │
        ├─ paid == total     → Sale completed, AmountDue 0
        └─ paid < total
               └─ partialPayment.dueDate required
                    → Sale partially_paid, AmountDue = remaining
                    → Membership still active (POS)
```

### Collect (proposed desk, existing write API)

```
Member 360 Outstanding
        → GET .../debtors/{id}/sales
        → select one sale
        → POST /sales/{saleId}/payments
        → AmountDue reduced
        → GET debtors?memberId=  (refresh card)
```

---

## Explicit non-goals (v1)

- Member Debt module, Collections module, aging product, credit limits, write-offs
- Auto-allocate one payment across many sales
- Restoring Debtors nav
- Changing refund remainder math
- Syncing `Membership.AmountPaid` on collect
- Flutter / Member App self-serve pay-off (Paymob remind already exists on API)

---

## After Product Accept

Implement in this order:

1. `GET /api/debtors/{memberId}/sales` + tests  
2. Harden `RecordPaymentAsync` (status + transaction)  
3. Member 360 Collect Payment drawer  
4. Contract comment + cache bump on member-detail  

Stop. Do not reopen POS collect-old-sale. Do not build a Debtors desk.
