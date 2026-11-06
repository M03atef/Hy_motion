# HyMotion — Google Stitch prompt (marketing website)

> **How to use**
> 1. Open [Google Stitch](https://stitch.withgoogle.com) → New project → **Web**.
> 2. Paste **PROMPT A** (design system + brand) as the project brief / first message.
> 3. Generate screens **one at a time** using **PROMPT B** (screen list). Keep the same project so Stitch reuses the visual language.
> 4. Attach `design-system.html` or a screenshot of it if Stitch allows image refs — it is the source of truth.
> 5. Do **not** ask Stitch to invent a new palette. Hex values below are binding.
>
> **Brand split**
> - **HyMotion** = product / company site (this website). Casing exact: `HyMotion`. Never GymFlowPro. Never translate the word HyMotion in Arabic.
> - **Gym Identity** = a tenant gym inside the product (e.g. Fitness Hub / فيتنس هب). Marketing mockups of the *app* show a gym name + lime; the *marketing chrome* says HyMotion.

---

```
PROMPT A — HyMotion marketing website · DESIGN SYSTEM (binding)

You are a senior product designer generating high-fidelity marketing website screens for HyMotion in Google Stitch.

═══════════════════════════════════════════════════════════════════
PRODUCT
═══════════════════════════════════════════════════════════════════

HyMotion is a multi-tenant gym operations platform for Egypt and MENA.
Tagline: “Manage your gym with clarity.”
Arabic tagline: “أدِر صالتك بوضوح.”
Subtitle: “The operations platform built for fitness businesses.”

It is reception-first: staff at the desk run memberships, payments, POS, and check-in.
Members use a bilingual Flutter app for their gym (Gym Identity), not a generic platform shell.

Audience: gym owners, managers, reception, trainers in Egypt / GCC.
Tone: confident, operational, athletic-premium. Not playful. Not generic SaaS purple-blue.
Language: English primary on EN pages; Arabic primary on AR pages (full RTL). Never dual “Active / نشط” in one label.

Company positioning (About):
- Built for real gym floors: QR check-in, freeze/renew at reception, EGP pricing, Cairo calendar dates.
- Bilingual EN + AR with RTL as a first-class layout, not a bolt-on.
- Multi-tenant: each gym has a Gym Code + its own logo/colors (Gym Identity).
- Staff web + Member mobile + Employee app.
- Optional quiet footer line: “Powered by HyMotion” is for in-app gym chrome only — on THIS marketing site HyMotion IS the brand.

Do not invent fake Fortune-500 logos, fake US addresses, or fake “10,000 gyms” stats.
Use honest sample KPIs that match the product UI:
  Active members 150 · Revenue EGP 75K · Check-ins today 45.
Sample gym in product mockups: Fitness Hub / فيتنس هب. Sample member: Ahmed Ali / أحمد علي. Plan: Monthly Unlimited.

═══════════════════════════════════════════════════════════════════
VISUAL IDENTITY — DEEP CHARCOAL & ELECTRIC LIME
═══════════════════════════════════════════════════════════════════

This is NOT a white SaaS landing. Marketing hero + footer are DARK charcoal.
Content bands may alternate: dark hero → light FAFAFA sections → dark CTA.

LOGO MARK (draw exactly):
  Rounded square 56×56, radius 14, fill Electric Lime #A0E040 (hero) or #7ACC00 (on light).
  Inside: charcoal chevron “A” stroke — path like M18 38 L28 16 L38 38 with a crossbar M22 32 H34, stroke #0D0D0D, round caps.
  Wordmark: “HyMotion” Cairo 700, letter-spacing -1px, color #A0E040 on dark / #5EAF00 on light.

COLORS (hex only — do not substitute):
  Charcoal 900 #0D0D0D  dark page BG / hero
  Charcoal 800 #1A1A1A  dark surface 1
  Charcoal 700 #2A2A2A  dark surface 2
  Charcoal 600 #3A3A3A  dark surface 3
  Charcoal 500 #4A4A4A  dark border
  Charcoal 400 #6B6B6B  tertiary text
  Charcoal 300 #8C8C8C  muted
  Charcoal 200 #B0B0B0  dark secondary text
  Charcoal 50  #F0F0F0  light text on dark / light BG tint

  Lime 600 #5EAF00  hover on light
  Lime 500 #7ACC00  PRIMARY CTA fill
  Lime 400 #A0E040  glow, wordmark on dark, KPI numbers on dark
  Lime 300 #BEEC73  avatar wash
  Lime 100 #EDFCD8  light tint chips
  Lime glow rgba(160,224,64,0.25)

  Teal 700 #0A4D4D
  Teal 500 #148F8F  SECONDARY CTA / links
  Teal 400 #3DB5B5  links hover
  Teal 100 #D9F2F2

  Success #22C55E  Active
  Warning #F59E0B  Expiring
  Danger  #EF4444  Expired
  Info    #3B82F6
  Frozen  #22D3EE
  Pending #FBBF24

  Light BG #FAFAFA · Surface #FFFFFF · Surface 2 #F5F5F5 · Border #D4D4D4
  Light text primary #1A1A1A · secondary #4A4A4A · tertiary #8C8C8C

TYPOGRAPHY:
  All UI + marketing: Google Font “Cairo” (weights 300,400,500,600,700).
  Do not use Inter, Space Grotesk, IBM Plex, or generic system UI as the brand face.
  H1 36/700/1.1 · H2 28/700/1.2 · H3 22/600/1.3 · H4 18/600 · H6 overline 13/700 uppercase 0.8px tracking
  Body 14/400/1.6 · Caption 12 · Label 13/600 · KPI 36/700 lime on dark
  Arabic uses the same Cairo family, RTL, no Latin/Arabic mixed in one chip.

SHAPE:
  Radius: sm 6 · md 10 · lg 16 · xl 24 · pill 9999 (ALL primary buttons are PILL).
  Shadows: 0 2px 8px rgba(0,0,0,.08) cards; 0 8px 32px rgba(0,0,0,.18) dark elevation;
  lime glow 0 0 20px rgba(160,224,64,0.25) on primary hover.
  Spacing base 4px. Cards padding 24. Section padding 64–80 desktop / 32 mobile.

COMPONENTS (match product design system):
  Primary button: height 44, pill, fill #7ACC00, text #0D0D0D, weight 600. Hover #A0E040 + lime glow.
  Secondary button: pill, fill #148F8F, text white.
  Ghost: transparent, 2px border #6B6B6B, text #B0B0B0 on dark / #4A4A4A on light. Hover border lime.
  Inputs: height 44, radius 10, 2px border, focus ring 3px lime glow.
  Badges: pill, 12/600, colored wash (active green, frozen cyan, pending amber, expired red).
  Stat cards: label uppercase 12 tracking, KPI 36 bold, optional ↑ change in success green.
  Membership mock card: 4px lime bar on top, plan name, progress pill bar, “22 days remaining”.

TEXTURE (dark panels only — login brand panel language):
  Subtle 45° lime hairline grid at 3% opacity + large radial lime blob (8% opacity).
  Bottom 4px bar: gradient #7ACC00 → #148F8F.
  No neon cyberpunk, no 3D gym photos as the whole background, no purple gradients.

LAYOUT:
  Desktop 1440 artboard, content max ~1200. Mobile 390.
  Sticky nav: charcoal 900, logo left, links (Product, Solutions, About, Contact), EN|AR toggle, CTA “Book a demo” lime pill.
  Footer dark: product links, legal, “HyMotion” wordmark, Egypt / MENA line. No fake social follower counts.

FORBIDDEN:
  Purple/indigo SaaS, Inter-only, rounded-rectangle green buttons that are not pill, stock “happy gym” collages as hero,
  GymFlowPro, “Hy Motion”, HYMOTION, translating HyMotion into Arabic script,
  showing HyMotion as the gym name inside product mockups (mockups use Fitness Hub).

═══════════════════════════════════════════════════════════════════
PRODUCT MODULES TO SHOWCASE (real system)
═══════════════════════════════════════════════════════════════════

Staff web
  Dashboard KPIs · Members 360 · Memberships (assign / renew / freeze) · Plans
  Live attendance + QR check-in · Classes · Activities & quotas
  POS · Invoices · Member store orders · Promo codes · Offers · Trials
  Inventory (products, stock, warehouses, POs, transfers, counts, suppliers)
  HR (employees, departments, positions, shifts, schedule, leaves, payroll, HR attendance)
  Reports / Z-report · Call sheet · Audit · Imports · Roles · Staff · Settings (Gym Identity)

Member app (Flutter)
  Home with gym logo + occupancy · Membership remaining days · Freeze when API live
  Classes · Activities · Plans catalog (read-only, “visit reception”) · Profile · QR check-in
  Invitations · Offers · Orders · Notifications
  App chrome = Gym Identity. About/legal = HyMotion.

Roles in product: Owner · Manager · Trainer (and reception staff), plus Member.

Currency: EGP. Dates: Cairo calendar, LTR numerals on dates even in Arabic UI.
```

---

```
PROMPT B — SCREEN LIST (generate each screen in the same Stitch project)

Generate a high-fidelity desktop (1440) marketing page. Then a 390 mobile version of the same page.
Obey PROMPT A tokens. Cairo. Charcoal + lime. Pill CTAs.

───────────────────────────────────────────────────────────────────
SCREEN 1 — Home / Landing (EN)
───────────────────────────────────────────────────────────────────
Nav as specified. Hero on #0D0D0D:
  Overline: GYM OPERATIONS PLATFORM
  H1: Manage your gym with clarity
  Sub: HyMotion runs reception, memberships, attendance, POS, and the member app — in English and Arabic.
  CTAs: Book a demo (lime pill) · See the product (ghost)
  Right of hero: realistic product collage — dark staff dashboard with 3 stat cards (150 / EGP 75K / 45) + a phone mock of member Home (Fitness Hub header, occupancy, membership card 22 days left, lime CTA Check in).

Below (light #FAFAFA):
  Logo-strip none (no fake customers). Instead a 4-up “built for the floor” row: Reception desk · Owner dashboard · Trainer classes · Member phone.
  Feature grid 2×3 with teal/lime icon tiles (radius 10, lime/teal wash like login feature icons):
    Real-time dashboard · Member management · QR attendance · POS & invoices · Inventory & HR · Bilingual RTL
  Product preview band (dark): large dashboard screenshot-style UI using design-system cards, not a photo.
  Split: “Staff runs the desk” vs “Members see their gym” — explain Gym Identity (Fitness Hub), HyMotion stays on About.
  CTA band dark: “Ready to run a clearer gym?” + Book a demo.

───────────────────────────────────────────────────────────────────
SCREEN 2 — Home / Landing (AR, dir=rtl)
───────────────────────────────────────────────────────────────────
Same structure mirrored RTL. Cairo Arabic.
H1: أدِر صالتك بوضوح
Brand word HyMotion stays Latin.
Sample gym فيتنس هب. Member أحمد علي.

───────────────────────────────────────────────────────────────────
SCREEN 3 — Product (system map)
───────────────────────────────────────────────────────────────────
Title: One system. Desk, floor, and member phone.
Three columns: Staff Web · Member App · Employee App
Each column lists real modules (do not invent CRM/email-blast fluff).
Include a small IA diagram: Owner / Manager / Trainer / Member.
Callout: reception-first — members browse plans but subscribe at the desk.

───────────────────────────────────────────────────────────────────
SCREEN 4 — Feature deep-dive: Memberships & Gym Identity
───────────────────────────────────────────────────────────────────
Show membership card (status chips Active / Frozen / Expired / Pending).
Freeze extends expiry. Days remaining, session packs.
Gym Identity: logo, gymName / gymNameAr, primary #7ACC00 fallback, tenant colors.
Do not show HyMotion as the gym title in the mock UI.

───────────────────────────────────────────────────────────────────
SCREEN 5 — Feature: Attendance, Classes, Occupancy
───────────────────────────────────────────────────────────────────
Live check-ins, QR, peak hours, class booking, floor occupancy.
Dark + light mixed. KPI cards. Table row of today’s check-ins (sample Egyptian names).

───────────────────────────────────────────────────────────────────
SCREEN 6 — Feature: Commerce (POS, invoices, inventory, orders)
───────────────────────────────────────────────────────────────────
POS ticket, EGP, Z-report, member store orders, stock / warehouses / purchase orders.
Keep operational, not “Shopify clone” aesthetics.

───────────────────────────────────────────────────────────────────
SCREEN 7 — Feature: People (HR + staff roles)
───────────────────────────────────────────────────────────────────
Employees, shifts, leaves, payroll, departments. Role chips: Owner lime, Manager teal, Trainer amber — same as staff login.

───────────────────────────────────────────────────────────────────
SCREEN 8 — Solutions by role
───────────────────────────────────────────────────────────────────
Tabs or 4 cards: Owner · Manager · Reception · Member.
Owner: revenue, staff, settings, Gym Identity.
Manager: members, plans, attendance, POS.
Reception: check-in, assign/renew/freeze, collect payment.
Member: remaining days, QR, classes, “ask reception” for pay.

───────────────────────────────────────────────────────────────────
SCREEN 9 — About
───────────────────────────────────────────────────────────────────
Dark hero: About HyMotion
Story: a gym OS for Egypt and MENA — bilingual, multi-tenant, reception-first.
Values: Clarity on the floor · Honest empty states (no fake data) · The gym’s brand in the member app, HyMotion as the product.
What we build: Staff web, Member app, Employee app, shared design system (this charcoal/lime language).
Team section: use generic roles (Product, Engineering, Gym ops) with lime/teal avatars (initials), not stock headshots unless provided.
No invented founding year or office street unless left as placeholders: [City, Egypt].

───────────────────────────────────────────────────────────────────
SCREEN 10 — Contact / Book a demo
───────────────────────────────────────────────────────────────────
Light form card on charcoal split (same 40/60 language as staff login):
  Left dark: logo, tagline, 3 bullets (Dashboard, Members, Roles).
  Right light: Full name, Gym name, City, Phone, Email, message.
  Primary Submit lime pill “Request a demo”.
  Helper: Gym Code is for existing tenants logging into Staff Portal — demo form does not need it.

───────────────────────────────────────────────────────────────────
SCREEN 11 — Staff login (marketing-accurate, already designed)
───────────────────────────────────────────────────────────────────
Recreate the real staff login: 40% charcoal brand panel / 60% white form.
Fields: Email, Password, Gym Code + tooltip. Welcome back / Staff Portal.
Role chips Owner / Manager / Trainer. Lime pill Sign in.

───────────────────────────────────────────────────────────────────
SCREEN 12 — Design system snapshot (optional, for handoff)
───────────────────────────────────────────────────────────────────
A single page titled “HyMotion Design System — Deep Charcoal & Electric Lime”
showing palette swatches, type scale EN+AR, 4 button types light+dark, one stat card, one membership card, one badge row.
This is for designers implementing Stitch output — keep it faithful to tokens.
```

---

## Stitch settings (recommended)

| Setting | Value |
|---------|--------|
| Device | Web desktop first, then Mobile |
| Theme | Custom (paste hex; do not pick Stitch “green startup”) |
| Density | Comfortable, 8px grid |
| Images | UI mockups + geometric lime grid; avoid random gym stock |

## After Stitch

Export frames → implement in `apps/web` marketing routes (or a separate landing). Tokens already live in `design-tokens.json` and `design-system.html`. Reuse Cairo from `apps/web/src/app/shared/vendor/fonts/cairo.css`.
