# Offers & Promotions — UX / IA Recommendation

**Date:** 2026-08-16  
**Companion:** `OFFERS_PROMOTIONS_ARCHITECTURE_AUDIT.md`  
**Preview:** `previews/offers-promotions-redesign.html`  
**Constraint:** Design around live APIs. Do not invent checkout behaviour.

---

## 1. Current UX problems

The live desk (`/dashboard/offers/`) already flattened chrome (one Create Offer, compact table). The **row** is still hard to run a gym from.

| Problem | Why it hurts |
|---|---|
| Name cell is a junk drawer | Name, Featured, Hidden, short copy, promo code, and `0 / 100 used` share one stacked cell. The eye has no landing point. |
| Discount is a `<strong>` in a skinny column | The commercial fact (“20% OFF”) is smaller and quieter than Featured/Hidden chips. |
| `0 / 100 used` is ambiguous | Is 0 remaining? 0 redemptions? Is ∞ a quota? Automatic offers always look unused. |
| Dates are a single `Aug 1 → Sep 15` string | No “ends in 2 days”, no year, no expired styling. |
| Status is a lone pill | Draft is missing from tabs. Expiring-soon is not a state. Ended vs scheduled look like equals. |
| Featured consumes attention | It is a Member App ranking flag, not the offer’s business state. |
| Actions are three equal buttons | Edit / Duplicate / End compete; no View; End is as loud as Edit. |
| Table feels sparse | `vertical-align: top` + wrapping pills + empty columns → broken-spreadsheet, not Invoices/Products. |
| Header still splits attention | “Promo codes” + “Member App” + “Create Offer” as three peers. Promo codes is a legacy engine, not the job. |
| Wizard over-promises | Automatic / BXGY / products are catalog fields. The list never says “POS cannot apply this”. |

This is an **information hierarchy** failure, not only spacing.

---

## 2. What staff need at a glance

A gym owner (and a receptionist who can only look) is answering:

1. **What is the deal?** Name.  
2. **How much off?** Discount.  
3. **Can we still sell it?** Status + validity.  
4. **Will it run out?** Usage (when a promo tracks it).  
5. **What does it apply to?** Memberships / products / both.  
6. **How is it redeemed?** Code vs app-only.  
7. **Is it pushed in the Member App?** Featured / hidden — secondary.

Recommended priority (live system):

| Rank | Field | List treatment |
|---|---|---|
| 1 | Discount | Largest type in the row (tabular, Space Grotesk) |
| 2 | Name | Next, with one line of short copy |
| 3 | Status | Pill + optional “Ends in n days” |
| 4 | Validity | Compact range, muted if expired |
| 5 | Usage | “12 of 100” + bar, or “No cap · 12”, or “Not tracked” |
| 6 | Applies to | Quiet pill, not a wrapping paragraph |
| 7 | Promo code | Monospace chip under the name **only if** `redemption = promoCode` |
| 8 | Featured / Hidden | Tiny meta chips, never a column stripe |
| 9 | Discount type | Encoded in the discount label (`20% OFF` / `EGP 200 OFF` / `Buy 2 Get 1`) |
| 10 | Actions | One overflow control; End behind confirm |

---

## 3. Recommended page structure

Keep **one operational list** (Invoices / Staff / Products language). Do not replace it with marketing cards.

```
Header: title + subtitle
Primary: Create Offer          (plans.manage only)
Secondary: Member App preview  (existing mock frames — keep, don’t promote)
Quiet: Promo codes legacy link

Search
Type filter (%, fixed, BXGY)
Applies filter (memberships / products / both)

Status tabs: All | Active | Scheduled | Draft | Expired
  (counts from the loaded list)

Dense table
Row click → detail drawer (GET /api/offers/{id})
Overflow → Edit | Duplicate | End… | View
```

**Not recommended:** giant featured banners, KPI dashboards, campaign calendars, dual card+table.

**Hybrid allowed:** the **discount cell** may look slightly “card-like” (large number) inside a table row. The page remains a table.

---

## 4. Promotion representation (row)

```
[ 20% OFF ]   Summer Membership Offer          Memberships     1 Aug → 15 Sep     0 of 100     Active      ⋯
              Save on 3-month join              (plans)         30 days left        ▓░░░░       Featured
              SUMMER20  ·  POS
```

Rules:

- Discount always visible, even for BXGY (`Buy 2 Get 1`).
- One applies pill: `Memberships`, `Products`, or `Both`. Plan/product names belong in the drawer.
- Status `Active` + end ≤ 7 days Cairo → extra `Ending` tone (display-only; **not** a new API status).
- Featured only if `showOnMemberApp && featured`.
- Hidden if `!showOnMemberApp`.
- Capability chip:
  - Promo code + %/fixed + memberships → `POS`
  - Otherwise → `App only` (honest: POS will not apply)

---

## 5. Filters, search, status

**Search:** name, short copy, discount label, promo code (already in live JS).

**Tabs:** add **Draft**. Live desk omits it; API returns drafts.

**Type / applies:** keep as selects. No extra date-range filter unless the list grows large (no paging API today — full list).

**Empty:** “No offers yet” vs “No offers match filters” (two copy states).

**Loading:** skeleton rows, not a spinner in a cavernous cell.

---

## 6. Actions (real operations only)

| Action | Who | API |
|---|---|---|
| Create | `plans.manage` | `POST /api/offers` |
| Edit | `plans.manage` | wizard → `PUT` |
| Duplicate | `plans.manage` | `POST` as draft (existing desk behaviour) |
| End | `plans.manage` | `POST /offers/{id}/end` + confirm |
| View | `sales.sell` | drawer from list / `GET` |
| Member App | anyone who can list | existing mock view |

Do **not** show Delete, Archive, Activate, or “Apply at POS”.

Receptionist: hide Create and overflow write actions; row click still opens a read-only drawer.

---

## 7. Status model (display)

Map 1:1 from the server, plus one **derived** cue:

| Display | Source |
|---|---|
| Draft | `isDraft` |
| Scheduled | `start > today` |
| Active | in window |
| Ending | Active **and** `end` within 7 days (desk-only) |
| Expired | `end < today` or after End action |

Do not add “Paused” or “Archived”.

---

## 8. Detail experience

**Drawer**, not a new route (matches Invoices). Sections:

- Discount + status
- Validity
- Applies to (resolved plan/product names)
- Eligibility (all / new members, min purchase, per-member)
- Redemption (automatic vs code)
- Usage (tracked vs not tracked)
- Member App (shown / featured / banner / order)
- Honest note when POS cannot apply
- Footer: Edit / Duplicate / End when allowed

Create/Edit stays the **existing 7-step wizard**. This pass does not restyle the wizard as the hero. List + drawer are the broken surfaces.

Wizard copy that should change **when implementation is approved** (not now): Automatic must not say it applies at checkout; banner must not look like upload works.

---

## 9. Create / edit (keep)

Do not replace the wizard with a single mega-form in this redesign. Owners already accepted guided setup. After list approval, a later pass can:

- Collapse 7 steps to 4 (Details → Deal → Rules → Publish)
- Drop the fake banner dropzone until an upload API exists
- Warn when redemption/applies/discount cannot hit POS

Out of scope for this preview’s primary scene.

---

## 10. Responsive

- ≥1100px: full columns.
- 800–1100px: hide Applies (still in drawer); keep Discount, Name, Status, Usage, Actions.
- &lt;800px: stacked row — discount + name + status on first line; dates + usage on second; overflow menu.

---

## 11. RTL

Reuse desk conventions: `dir=rtl` on `html`, IBM Plex Sans Arabic, logical properties (`margin-inline`, `text-align: start`, overflow menu `inset-inline-end`). Status tabs and table headers flip with the document. Discount numerals stay LTR (`<bdi>` / `dir=ltr` on the amount).

---

## 12. Design-system alignment

Steal from **Invoices + Staff**, not from the Member App phone mock:

- Page title Space Grotesk 26 / lime icon
- Toolbar search 40px, radius 12, border `--ls3`
- Status tabs: dark pill for active (Staff) **or** lime outline (Invoices) — preview uses **Staff dark pill** (clearer selected state)
- Table wrap white, `--ls2` header, 11px uppercase columns
- Green row hover `rgba(160,224,64,.08)`
- Status greens/reds/blue/gray already on Offers
- Buttons 40px primary lime / secondary white
- Drawer 420px from the right (Invoices)
- Toast bottom-end, dark

Avoid: gradients on the admin list, emoji fire (“🔥 FEATURED”), giant phone columns on the list, decorative empty space.

**Visual comfort (2026-08-16, after first preview reject):** The first preview was eye-straining — black selected tabs, 18px shouty discount, inverse neon code chips, lime row hover, and a POS info banner. Owner rejected it. Second pass: cool gray page (`#F6F7F9`), underline tabs, name-first row, 14px discount, gray meta line instead of chips, status as text + dot (no filled pills), no usage bars. Lime only on Create Offer. Preview is not accepted until the owner says so.

---

## 13. Major design decisions

1. **Table, not cards** — operations screen; density first.  
2. **Discount is the hero of the row** — commercial fact before Featured.  
3. **Usage language is explicit** — “12 of 100 redemptions” / “No cap” / “Not tracked”.  
4. **POS vs App is visible** — so Automatic/BXGY/products are not mistaken for live checkout.  
5. **Drawer for View** — GET already exists; wizard is the wrong read surface.  
6. **Ending is a cue, not a new backend status.**  
7. **Wizard stays** until the list is accepted.  
8. **Legacy promo-codes stay linked, demoted.**
