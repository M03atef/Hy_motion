# Offers & Promotions — Architecture Audit

**Date:** 2026-08-16  
**Scope:** Discovery only. Production code was not changed.  
**Clock:** Cairo calendar dates. Demo “today” in the preview is **16 Aug 2026**.

---

## 1. Current architecture

HyMotion has **two discount surfaces**. They are related, not interchangeable.

```
Offer  (offers table)                    Product concept the owner manages
  │  optional PromoCodeId
  ▼
PromoCode  (promo_codes table)           POS redemption engine (membership plan only)
  │  Sale.PromoCodeId
  ▼
Sale.DiscountAmount                      Header-level money (not per line)
  ▼
Invoice.DiscountAmount                   Copied from the sale
```

**Offer** is the staff/Member App catalog: name, dates, applies-to, discount shape, eligibility, app visibility, optional promo code.

**PromoCode** is the live checkout calculator. `POST /api/sales` and `POST /api/sales/validate-promo` never take an Offer id. They take a **code string** and a **membership plan id**.

Publishing an Offer with `redemption = promoCode` (and discount ≠ BXGY) **creates or updates** a linked `PromoCode`. Ending an Offer **deactivates** that code.

---

## 2. Entities

### `Offer` (`GMS.Core/Entities/Offer.cs`, table `offers`)

| Field | Meaning |
|---|---|
| `Name` / `NameAr` | Display name |
| `ShortDescription` / `Description` / `BannerUrl` | Copy. `BannerUrl` is a string; **no upload API** |
| `StartDate` / `EndDate` | `DateOnly`, required. Status is derived from these + `IsDraft` |
| `AppliesTo` | `memberships` \| `products` \| `both` |
| `PlanIdsJson` / `ProductIdsJson` | GUID arrays. Empty = “all in that scope” (labels only; POS does not read these for products) |
| `MembershipLabelsJson` / `ProductLabelsJson` | Optional display labels |
| `DiscountType` | `percentage` \| `fixed` \| `bxgy` |
| `Value` / `MaxDiscount` | Percent 1–100 or EGP amount. **`MaxDiscount` is stored, not used by POS** |
| `BuyQty` / `GetQty` | BXGY. Stored and labelled only |
| `AllMembers` / `NewMembersOnly` | Member App filter. POS does not re-check new-member on the Offer |
| `MinPurchase` / `UsageLimit` / `PerMemberLimit` | Copied onto linked promo when synced |
| `UsesCount` | Column exists. **Never incremented on Offer.** Staff DTO reads linked `PromoCode.UsesCount` when `PromoCodeId` is set |
| `ShowOnMemberApp` / `Featured` / `ShowBanner` / `DisplayOrder` | Member App ranking. Featured is a boolean, not a separate type |
| `Redemption` | `automatic` \| `promoCode` |
| `PromoCode` / `PromoCodeId` | Optional code + FK |
| `IsDraft` | Drafts are hidden from Member App and do not sync a promo |

Soft-delete column exists (`IsDeleted`). There is **no staff Delete endpoint**.

### `PromoCode` (`promo_codes`)

- `Type`: `percent` \| `fixed` only — **no BXGY**
- `AppliesTo`: JSON array of **membership plan ids**, or null = all plans
- Dates, `MaxUses`, `MaxUsesPerMember`, `MinPrice`, `UsesCount`, `IsActive`
- Consumed atomically on sale commit (`TryConsumeAsync`)

### `Sale`

- Header: `Subtotal`, `DiscountAmount` (promo **plus** manual override), `PromoCodeId`, `ManualDiscountAmount` / `Reason`
- `SaleLine` has `UnitPrice` + `LineTotal` at **full** unit price. **No line-level discount column**

---

## 3. APIs

### Staff — `OffersController` `/api/offers` `[Authorize]`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/api/offers` | `sales.sell` | All tenant offers, featured then `displayOrder` then created |
| GET | `/api/offers/{id}` | `sales.sell` | One offer |
| POST | `/api/offers` | `plans.manage` | Create; sync promo if published + promoCode + not BXGY |
| PUT | `/api/offers/{id}` | `plans.manage` | Full upsert |
| POST | `/api/offers/{id}/end` | `plans.manage` | `EndDate = yesterday Cairo`; deactivate linked promo |

**No DELETE. No archive. No duplicate endpoint. No activate endpoint.** Duplicate on the desk is `POST` as draft. “Publish” is `isDraft: false` on create/update.

### Member — `MemberOffersController` `/api/member/offers` `AuthenticatedMember`

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/member/offers` | `ShowOnMemberApp`, not draft, in-date Cairo, and (`!NewMembersOnly` or member has **no** `Membership` row) |
| GET | `/api/member/offers/{id}` | Same filter; 404 otherwise. **Never returns the raw code** (`promoCodeHint`: `"Have a code?"`) |

### Legacy POS promo — `PromoCodesController` `/api/promo-codes`

Still live. List/create/update/`DELETE` (soft deactivate). Feature probe for the `sales` flag hits `GET /promo-codes?page=1&pageSize=1`. Desk still has `/dashboard/promo-codes/`. Nav “Offers & Promotions” is the product home.

### Sales

| Method | Path | Role |
|---|---|---|
| POST | `/api/sales/validate-promo` | Code + **planId** + memberId → original / discount / final |
| POST | `/api/sales` | Optional `promoCode` string. Requires a membership line + member. Then `TryConsumeAsync` |

---

## 4. Frontend structure

| Path | Role |
|---|---|
| `/dashboard/offers/` | Live desk: compact table + 7-step wizard + Member App mock frames |
| `offers-app.js` | `Gfp.get/post/put('/offers')`, `POST /offers/{id}/end`, local status recompute |
| `/dashboard/promo-codes/` | Legacy code CRUD (not deleted) |
| Nav key `offers` | Money group. Access `sales.sell` **or** `plans.manage`. Feature flag `sales` |
| Quick action `add_promo_code` | Routes to `/dashboard/offers/` |
| Flutter | `FLUTTER_MEMBER_OFFERS_PROMPT.md` → `GET /api/member/offers` only |

Create/edit requires `plans.manage` (or role `Owner`). Receptionist with `sales.sell` can **see** the list, not create.

---

## 5. Operations (what exists vs not)

| Operation | Status |
|---|---|
| Create Offer | Supported (`POST`, `plans.manage`) |
| Edit Offer | Supported (`PUT`, full replace) |
| Save Draft | Supported (`isDraft: true`; no promo sync) |
| Publish | Supported (save with `isDraft: false`) |
| Duplicate | **Partial.** Desk `POST`s a copy as draft. No dedicated API |
| End Offer | Supported (`POST .../end`) |
| Activate (explicit) | **NOT CURRENTLY SUPPORTED.** Becomes Active when not draft and Cairo today is inside `[start, end]` |
| Archive | **NOT CURRENTLY SUPPORTED** |
| Delete | **NOT CURRENTLY SUPPORTED** |
| View detail | API `GET` exists. Desk has no drawer/page — Edit opens the wizard |
| Apply at POS | **Only via typed promo code on a membership sale** |
| Apply automatically at checkout | **NOT CURRENTLY SUPPORTED** (wizard copy claims it) |
| Apply to retail products | **NOT CURRENTLY SUPPORTED** at POS |
| BXGY checkout math | **NOT CURRENTLY SUPPORTED** |
| Validate Offer (staff preview of eligibility) | **NOT CURRENTLY SUPPORTED** as an Offer API. POS validates **promo codes** |
| Usage tracking | Linked **promo** `UsesCount` only |
| Usage limit / per-member | Enforced on **promo** consume, not on `Offer.UsesCount` |
| Featured | Boolean + sort. Not exclusive |
| Banner image upload | **NOT CURRENTLY SUPPORTED** (`BannerUrl` string + wizard drop-mock) |
| Arabic name fields | On entity/DTO. Desk wizard does not edit `nameAr` |

---

## 6. Business rules (server)

**Status** (`OfferService.ComputeStatus`, Cairo today):

- Draft if `IsDraft`
- Else Expired if `EndDate < today`
- Else Scheduled if `StartDate > today`
- Else Active

End sets `EndDate` to yesterday, so status becomes Expired immediately.

**Promo sync** (`SyncPromoAsync`) runs when:

- not draft, and
- redemption is `promoCode`, and
- discount is **not** BXGY, and
- code string is present

Synced fields: code, type (`percent`/`fixed`), value, **plan ids only**, dates, max uses, per-member, min price.  
**Not synced:** product ids, appliesTo `products`/`both`, `MaxDiscount`, BXGY, `NewMembersOnly`, featured/app flags.

Empty `planIds` → promo `AppliesTo = null` (all plans).

**Member “new”:** no `Membership` row for that gym member. A member with any past membership is not new.

**Identity password / staff seats:** unrelated; Offers do not touch Identity.

---

## 7. Sales integration

1. POS sends `promoCode` on `POST /api/sales`.
2. `SaleService` requires a **primary membership plan** + member. Retail-only carts cannot use a code (`PROMO_INVALID`).
3. `PromoService.ValidateAndPriceAsync` discounts **`plan.Price`**, not the sale subtotal, not product lines.
4. Discount is stored on **`Sale.DiscountAmount`**. Lines keep list price.
5. Manual discount (`sales.discount.override`) is **added into the same `DiscountAmount`**.
6. VAT is computed on `subtotal − DiscountAmount`.
7. Invoice copies sale header discount. Original vs discounted is preserved as `Subtotal` vs `Total`, not as two prices on the line.
8. Shift cash movements use the **paid** amount, not a separate “discount” movement.

**Gap:** Automatic Offers, product Offers, and BXGY never enter this path.

---

## 8. Membership integration

- Offer can target plan ids / labels (`appliesTo: memberships | both`).
- Discount is **transactional** (sale header). It does not rewrite `MembershipPlan.Price` or attach an Offer id onto `Membership`.
- Renewals: if the cashier types a still-valid code against that plan, it applies. There is **no** “new memberships only” check inside `PromoService` (that flag is Member App list-only).
- Membership stay in the Member App is read-only; Flutter prompt: cart promo is visual until the store contract carries an offer payload.

---

## 9. Products / retail

- Offer can store `productIds` and `appliesTo: products | both`.
- Member App can **display** those labels.
- POS **does not** apply Offer or promo to retail lines.
- Product **categories** as a target: **NOT CURRENTLY SUPPORTED**.

---

## 10. Payments / finance

- Discount is part of the Sale, then the Invoice.
- Payment legs pay `Total` (after discount + VAT).
- Z-Report `promoDiscountTotal` = `SUM(Sale.DiscountAmount)` — **includes manual discounts**, not promo-only.
- Separate `manualDiscountTotal` / `manualDiscountCount` also exist. Double-count risk if a reader adds both to `promoDiscountTotal`.
- No Offer-level finance report. No “discount by offer id”.

---

## 11. Permission model

| Action | Gate |
|---|---|
| Nav + list + get | `sales.sell` or `plans.manage`; feature `sales` |
| Create / update / end | `plans.manage` |
| POS validate/sell with code | `sales.sell` (+ sales feature flag on SalesController) |
| Manual discount | `sales.discount.override` |
| Member list | Authenticated member JWT |

Receptionist typically has `sales.sell` and can open Offers **read-only**. Manager usually cannot `plans.manage` (Owner/custom claim can).

---

## 12. Tests & seed

- `GMS.Tests/OfferServiceTests.cs` (5): member list filters, promo link on create, end deactivates promo, member 404, staff list includes hidden/draft.
- Promo/sale tests cover code validation and consume — **not** Offer auto-apply.
- No dedicated Offer seed in DataSeeder found for demo gym offers.

---

## 13. Frontend / backend inconsistencies

1. **Wizard redemption copy:** “Automatic — applied at checkout when eligibility matches.” Server does **not** auto-apply Offers on `POST /api/sales`.
2. **Wizard discount step:** “Checkout math stays on the server later.” Accurate for BXGY/products; misleading next to Automatic.
3. **Banner upload** UI is a mock; API only stores `bannerUrl`.
4. **Desk status** is recomputed in the browser (`todayStr()`), not Cairo and not `OfferDto.status`.
5. **Status tabs omit Draft** even though drafts exist and the API returns them.
6. **Usage `0 / 100 used`:** for promo-code offers this is promo uses / `usageLimit`. For automatic/BXGY, `usesCount` stays 0. Unlimited shows `n / ∞`, which reads as a ratio, not “no cap”.
7. **Featured** is a chip on the name; previously it was a table stripe (already flattened). Still visually competes with status.
8. **`MaxDiscount`** is collected in the wizard and stored; POS ignores it.
9. **Product / BXGY / automatic** can be saved and shown in Member App; POS cannot honour them.
10. **Legacy `/promo-codes/`** can create codes that are **not** Offers. Two sources of truth for the same POS engine.
11. **Flutter prompt** still describes Automatic as “applied when eligible”. Member API is display-only.

---

## 14. Limitations that bind the redesign

Do **not** design:

- POS auto-apply of Automatic offers
- Product or BXGY checkout
- Delete / archive
- Usage charts that imply Offer.UsesCount moves without a promo
- Banner upload
- Per-offer finance dashboards
- Category targeting
- A second “campaigns” object

**Do** design around: list/get/create/update/end/duplicate-as-draft, status from dates, featured as a flag, promo code as optional redemption, Member App visibility, honest POS vs App capability.
