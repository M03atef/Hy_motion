# HyMotion — Flutter Member App: Offers & Promotions Prompt

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Staff desk (already shipping, not your job): `apps/web/.../offers/`
> Design SoT: `Frontend/previews/offers-promotions.html`
> Member-app platform rules: `Frontend/FLUTTER_MEMBER_APP_PROMPT.md`
>
> There **is** a Member Offers API. Call `GET /api/member/offers` with the member JWT.
> Do **not** call staff `/api/promo-codes`.

---

```
PROMPT — HyMotion Member App: Offers & Promotions (Flutter)
You are a senior Flutter developer extending the HyMotion Member App (Egypt / MENA). Arabic primary + English secondary; RTL when locale is Arabic.

This prompt ADDS Offers & Promotions to the existing Member App.
It does NOT replace auth, check-in, invitations, or store scaffolding.
Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, auth, JWT sub, and forbidden staff APIs.

═══════════════════════════════════════════════════════════════════
0) PRODUCT (BINDING)
═══════════════════════════════════════════════════════════════════

Staff gym owners now manage **Offers**, not standalone Promo Codes.

Conceptual model (display this in UI language, not as a schema dump):

Offer
 ├── Details (name, short copy, description, banner, start/end)
 ├── Applies To → Memberships | Products | Both
 ├── Discount → Percentage | Fixed amount | Buy X Get Y
 ├── Eligibility & usage limits
 ├── Member App visibility (show / featured / banner / display order)
 └── Redemption
      ├── Automatic   (applied when eligible — member does not type a code)
      └── Promo Code  (optional method ON the Offer — not a separate product)

Promo Code is ONLY a redemption method of an Offer.
NEVER build a “Promo Codes” tab, CRUD, or staff-style code manager in the Member App.

Phase reality (2026-08-14):
- Staff web exists at /dashboard/offers/ and persists via GET/POST/PUT /api/offers.
- Member Offers API is LIVE: GET /api/member/offers and GET /api/member/offers/{id}.
- Staff endpoints GET/POST/PUT/DELETE /api/promo-codes require sales.sell / plans.manage.
  FORBIDDEN from the Member App (same as all other staff routes).
- POST /api/sales/validate-promo is staff POS. FORBIDDEN.

You MUST:
1) Define OfferRepository (interface).
2) Implement ApiOfferRepository against GET /member/offers (STYLE A: API_BASE ends with /api).
3) Keep MockOfferRepository only as a last-resort fallback if the device is offline.
4) Never invent client-side discount math as source of truth for money.
   Display server fields only (discountLabel, labels, dates).
   Membership stay read-only; cart promo line is visual until store contract adds offer payload.

═══════════════════════════════════════════════════════════════════
1) WHAT TO BUILD (Member App only)
═══════════════════════════════════════════════════════════════════

OWN:
- Home: “Special Offers” strip / featured card when visibility is ON
- Offers list screen (Special Offers)
- Offer detail screen
- Membership plan card WITH offer pricing presentation (read-only commercial — no Assign/Renew)
- Product card + cart presentation WITH promotion line (member-store cart UX)
- Empty / hidden / expired states
- Promo-code ENTRY only when the offer’s redemption is Promo Code (member types code at checkout/cart — do not invent a codes catalog)

FORBIDDEN:
- Staff Offers wizard / create / edit / filters / usage admin
- Calling /api/promo-codes, /api/sales/*, /api/membership-plans (staff), /api/members/{id}/*
- Real checkout pricing engine
- Fake “you saved EGP X” calculated from percents in Dart as if it were billing truth
- Duplicate promotion systems (one for memberships, one for products)
- OTP / member_id JWT / staff login

Membership remains READ-ONLY commercially (no Assign / Renew / Freeze).
“Continue” on a membership-with-offer screen is visual / future hook — do not POST staff membership APIs.

Store orders: keep existing POST /api/member-store/orders as today (no offerId field until backend adds it).
Do NOT send promo codes to member-store orders unless a contract exists. Show the cart promotion as UI demo on mock data.

═══════════════════════════════════════════════════════════════════
2) TECH (same as Member App)
═══════════════════════════════════════════════════════════════════

- Flutter 3.22+ / Dart 3.4+
- flutter_bloc (Cubit)
- dio + existing auth interceptor
- go_router
- flutter_localizations + arb (ar + en)
- Fonts: Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic
- Brand: charcoal + lime (#7ACC00 on #0D0D0D). No navy/red gym packs.

Suggested files (adapt to existing project layout):
- domain/offer.dart
- data/offer_repository.dart
- data/mock_offer_repository.dart
- cubit/offers_cubit.dart
- ui/offers_list_screen.dart
- ui/offer_detail_screen.dart
- ui/widgets/offer_card.dart
- ui/widgets/membership_offer_price.dart
- ui/widgets/cart_promo_line.dart

═══════════════════════════════════════════════════════════════════
3) DOMAIN MODEL (client — matches staff Offer, member-visible subset)
═══════════════════════════════════════════════════════════════════

enum OfferAppliesTo { memberships, products, both }
enum OfferDiscountType { percentage, fixed, bxgy }
enum OfferRedemption { automatic, promoCode }
enum OfferStatus { active, scheduled, expired, draft }

class Offer {
  final String id;
  final String name;
  final String nameAr;          // if missing, fall back to name
  final String shortDescription;
  final String shortDescriptionAr;
  final String? description;
  final String? bannerUrl;      // nullable — use lime/charcoal gradient placeholder
  final DateTime? start;
  final DateTime? end;
  final OfferAppliesTo appliesTo;
  final List<String> membershipLabels; // e.g. ["3 Months"] — display names, not staff GUIDs
  final List<String> productLabels;    // e.g. ["Protein Bar"]
  final OfferDiscountType discountType;
  final String discountLabel;   // "20% OFF" | "EGP 50 OFF" | "Buy 2 Get 1"
  final int? buyQty;            // BXGY
  final int? getQty;
  final bool newMembersOnly;
  final bool showOnMemberApp;
  final bool featured;
  final bool showBanner;
  final int displayOrder;
  final OfferRedemption redemption;
  final String? promoCodeHint;  // may show "Have a code?" — NEVER list all gym codes
  final OfferStatus status;
}

List rules for Member App:
- Show ONLY offers where showOnMemberApp == true
- Hide draft
- Hide expired (or show a muted “ended” only on detail if deep-linked)
- Hide scheduled until start (do not tease future staff drafts)
- Sort: featured first, then displayOrder ascending
- Automatic offers: no code field on the card
- Promo Code offers: CTA “View Offer”; on detail, optional “Enter code at checkout” helper — do not require the member to know SUMMER20 unless the gym printed it on the banner copy

═══════════════════════════════════════════════════════════════════
4) MOCK SEED (required so the app feels complete)
═══════════════════════════════════════════════════════════════════

Use at least these four. Only the first two (+ merch if still active) appear in-app.

1) Summer Membership Offer
   20% OFF · Memberships · 3 Months
   Aug 15 → Sep 15, 2026
   Featured · Shown in Member App · Active
   Redemption: Promo Code (code exists for desk; member sees offer, not a codes list)
   Short: Save 20% on selected membership plans this summer.

2) Protein Bundle
   Buy 2 Get 1 · Products · Protein Bars
   Aug 20 → Sep 10, 2026
   Shown in Member App · Scheduled or Active depending on device “today”
   Redemption: Automatic
   CTA on card: Add to Cart (navigates to product / store)

3) New Member Welcome
   15% OFF · Memberships · New members · Automatic
   Active · Member App: OFF
   MUST NOT appear in Offers list or Home strip.
   (This teaches: visibility OFF = desk/POS only.)

4) Gym Merchandise Sale
   10% OFF · Products · Expired · Member App ON
   MUST NOT appear in the live list (expired).

If “today” is 2026-08-14:
- Summer = Active (if start Aug 15, treat as Scheduled until start — still OK to include as Featured in mock if you freeze clock to Aug 16 for demo; document the clock).
Prefer a DemoClock in mock repo (fixed DateTime 2026-08-16) so Summer is Active and Protein Bundle is Scheduled→hidden OR include Protein as Active for the demo. Product preference: show Summer (featured) + Protein Bundle (product card) in the list.

═══════════════════════════════════════════════════════════════════
5) SCREENS (match approved preview)
═══════════════════════════════════════════════════════════════════

--- A) Home ---
If ≥1 visible offer:
  Featured card (dark charcoal → lime border):
    🔥 SUMMER OFFER
    20% OFF
    3-Month Membership
    Save more this summer.
    [ View Offer ]
Horizontal strip of other visible offers optional.
If zero visible offers: omit the section (do not show an empty error).

--- B) Special Offers (list) ---
Title: Special Offers / العروض الخاصة
Cards:
  Featured: dark gradient, lime tag 🔥 FEATURED
  Product: light card, tag PRODUCTS / المنتجات
  Membership: tag MEMBERSHIP / الاشتراك
Empty: friendly “No special offers right now” / Arabic equivalent — not a technical 404.

--- C) Offer detail ---
Banner/gradient, discountLabel hero, short copy, applies-to chips,
validity dates, eligibility in plain language
(“All members” / “New members only”).
Redemption:
  Automatic → “Applied automatically when you qualify. No code needed.”
  Promo Code → “Redeem with a promo code at checkout.” + optional TextField
    (store locally in cubit only; do not POST anywhere yet).
CTA:
  Membership offer → View membership
  Product offer → Add to Cart / View product

--- D) Membership with offer (visual) ---
3-Month Membership
🔥 Special Offer
Original    EGP 1,500   (strikethrough)
Offer       20% OFF
You save    EGP 300
Final price EGP 1,200
[ Continue ]   // no staff membership API

These numbers are MOCK COPY from the approved preview. Label the screen
as display-only if you add a tiny caption; do not compute 20% in Dart
and present it as a live invoice.

--- E) Product + Cart (visual, member-store style) ---
Product:
  Protein Bar
  EGP 80
  Buy 2 Get 1
  [ Add to Cart ]

Cart:
  Protein Bar × 3     EGP 240
  Promotion · Buy 2 Get 1
  − EGP 80
  Total               EGP 160
  [ Checkout ]

Checkout still uses existing member-store order API WITHOUT promotion
payload until backend supports it. If you cannot attach a real discount,
show the promo line in the UI mock cart screen, and keep live orders
on unmodified API. Do not lie to the API (don’t change qty/price to fake BXGY).

═══════════════════════════════════════════════════════════════════
6) NAV
═══════════════════════════════════════════════════════════════════

Add Offers to the authenticated shell:
- Option A (preferred): Home strip + route /offers and /offers/:id
- Option B: 6th tab only if Product insists — prefer not crowding bottom nav;
  Home + Store entry points are enough.

Deep links later: HyMotion://offers/{id} — stub in go_router, ignore unknown ids.

═══════════════════════════════════════════════════════════════════
7) API CONTRACT (LIVE)
═══════════════════════════════════════════════════════════════════

GET {API_BASE}/member/offers
  Policy: AuthenticatedMember
  → MemberOfferDto[] already filtered:
      showOnMemberApp, not draft, start ≤ today Cairo ≤ end,
      newMembersOnly only if the member has no membership yet
  Sort: featured first, then displayOrder
  Does NOT include the raw promo code. promoCodeHint is "Have a code?" when redemption is promoCode.

GET {API_BASE}/member/offers/{id}
  → MemberOfferDto | 404 if hidden / expired / draft / not eligible

STYLE A: API_BASE ends with /api; path is /member/offers not /api/member/offers.

Do NOT call /api/promo-codes or /api/offers (staff).
Do NOT guess extra write endpoints.

MemberOfferDto (camelCase):
  id, name, nameAr, shortDescription, shortDescriptionAr, description, bannerUrl,
  start, end, appliesTo, membershipLabels[], productLabels[],
  discountType, discountLabel, buyQty, getQty,
  newMembersOnly, showOnMemberApp, featured, showBanner, displayOrder,
  redemption ("automatic"|"promoCode"), promoCodeHint, status ("active")

On network error: fall back to MockOfferRepository and keep Home / Store working.
A 404 on the collection path should no longer happen once this API is deployed.
Empty list → "No special offers right now" (not a technical error).

═══════════════════════════════════════════════════════════════════
8) COPY (EN / AR)
═══════════════════════════════════════════════════════════════════

EN                         AR
Special Offers             العروض الخاصة
Featured                   مميز
View Offer                 عرض العرض
Add to Cart                أضف للسلة
Special Offer              عرض خاص
You save                   وفّرت
Final price                السعر النهائي
Applied automatically      يُطبَّق تلقائياً عند الاستحقاق — بدون كود
Redeem with promo code     استخدم كود الخصم عند الدفع
No special offers right now لا توجد عروض حالياً
Hidden from app            (never shown to members — staff only)

═══════════════════════════════════════════════════════════════════
9) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] No staff promo-codes / sales / members / plans APIs
[ ] OfferRepository + MockOfferRepository with seed data
[ ] Welcome Discount (App OFF) never listed
[ ] Expired merch never listed
[ ] Featured Summer card matches charcoal/lime preview
[ ] Membership price block shows Original / Offer / You save / Final (mock numbers)
[ ] Product cart shows BXGY promo line (mock numbers)
[ ] Automatic vs Promo Code copy is understandable to a gym member
[ ] AR + EN + RTL
[ ] flutter analyze clean
[ ] Does not break activate / QR / invitations / store

═══════════════════════════════════════════════════════════════════
10) IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Domain + OfferRepository + mock seed + DemoClock
2. OffersCubit + list + detail routes
3. Home featured strip
4. Membership offer price widget (mock)
5. Product/cart promo widgets (mock, don’t mutate live order payload)
6. l10n AR/EN
7. Wire Dio GET /member/offers; mock only for offline fallback

Wait for my go-ahead before scaffolding if this is pasted into an AI coding agent; if handed to a human Flutter developer, start at step 1.
```

---

## Quick reference (for humans)

| Layer | Status |
|--------|--------|
| Staff Offers desk | Live — `/dashboard/offers/` (API-backed) |
| Member Offers API | **Live** — `GET /api/member/offers` |
| Staff `/api/promo-codes` | **Forbidden** in Member App |
| Membership buy | Still staff desk — Member App shows offer pricing only |
| Store checkout | Existing member-store orders — no offer payload yet |

Visual SoT: `Frontend/previews/offers-promotions.html` (Member App frames).
