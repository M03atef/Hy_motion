# HyMotion — Social media design prompts (Stitch / any image AI)

> **How to use**
> 1. Open [Google Stitch](https://stitch.withgoogle.com) → New project. Prefer **Mobile** or custom size per post (table below).
> 2. Paste **PROMPT A** once as the project brief.
> 3. Generate **one post at a time** from **PROMPT B**. Keep the same project so the system stays charcoal + lime.
> 4. For Midjourney / Ideogram / ChatGPT images: still paste **PROMPT A** + the single post block. Add `no stock gym photos, no purple SaaS, no Inter`.
> 5. Pair each visual with the **CAPTION** under that post. One language per post (EN *or* AR) — never bilingual in one graphic.
>
> Related: [`STITCH_HYMOTION_MARKETING_WEBSITE_PROMPT.md`](STITCH_HYMOTION_MARKETING_WEBSITE_PROMPT.md) · tokens: `design-tokens.json`

## Sizes

| Format | Size | Safe zone |
|--------|------|-----------|
| Instagram / Facebook feed | 1080×1080 | Keep logo + CTA 80px from edges |
| Instagram carousel slide | 1080×1080 | Same; numbered 01/04 in corner |
| Instagram / Facebook / TikTok story | 1080×1920 | Keep type out of 250px top + 200px bottom (UI chrome) |
| LinkedIn / X landscape | 1200×627 | Logo top-left, CTA bottom-right |
| LinkedIn square | 1080×1080 | Same as IG feed |
| WhatsApp status | 1080×1920 | Same as story |

---

```
PROMPT A — HyMotion SOCIAL posts · DESIGN SYSTEM (binding)

You are a senior brand designer generating social ads and organic posts for HyMotion.

PRODUCT
HyMotion = gym operations platform for Egypt / MENA.
Tagline EN: Manage your gym with clarity.
Tagline AR: أدِر صالتك بوضوح.
Subtitle: The operations platform built for fitness businesses.
Reception-first. Staff web + Member app + Employee app.
Audience: gym owners, managers, reception — not end consumers looking for a workout plan.

BRAND SPLIT
Marketing posts: brand is HyMotion (Latin in EN and AR).
If you show the member-app UI: gym name is Fitness Hub / فيتنس هب — never HyMotion as the gym title.
Never GymFlowPro. Never “Hy Motion” / HYMOTION / Arabic-script HyMotion.

TONE
Athletic-premium, operational, confident. Short headlines (max ~7 words EN, ~6 AR).
No fake “10,000 gyms” / “#1 in the world”. Honest sample KPIs only:
  150 active members · EGP 75K · 45 check-ins today.

LOOK (hex binding)
BG default: charcoal #0D0D0D
Surfaces: #1A1A1A / #2A2A2A
Text on dark: #F0F0F0 primary, #B0B0B0 secondary
Accent / wordmark / KPI: lime #A0E040
CTA pill fill: #7ACC00 text #0D0D0D
Secondary / links: teal #148F8F
Light variant posts: bg #FAFAFA, text #1A1A1A, CTA still #7ACC00
Semantic (only on UI mock chips): Active #22C55E · Frozen #22D3EE · Pending #FBBF24 · Expired #EF4444

TYPE
Cairo 600/700 for headlines. Cairo 400/500 for body.
H1 on square: ~56–72px equivalent, tight leading 1.05.
Overline: 13px, 700, uppercase, 0.8px tracking, color #8C8C8C or #A0E040.
CTA: pill 9999 radius, height ~44–56, weight 600.

LOGO (every post, small, consistent)
Rounded square, radius ~14, fill #A0E040 (on dark) or #7ACC00 (on light).
Chevron “A” + crossbar stroke #0D0D0D.
Wordmark “HyMotion” beside it on landscape; stacked or mark-only on busy squares.
Corner: usually top-left LTR, top-right on RTL Arabic posts.

TEXTURE (dark posts)
Subtle 45° lime hairline grid at ~3% opacity + soft radial lime blob.
4px bottom bar gradient #7ACC00 → #148F8F on stories and some squares.
No neon cyberpunk, no purple, no Inter, no 3D chrome, no random stock gym collages as the whole canvas.
UI mockups allowed: stat cards, membership remaining-days card, phone frame — using the same tokens.

LAYOUT RULES
One idea per frame. Huge type + one visual (phone, 3 KPIs, or one icon tile).
Primary button always pill.
Arabic posts: dir=rtl, Cairo, HyMotion stays Latin.
Do not put EN and AR in the same headline.

FORBIDDEN
Stock “happy gym” hero as 100% of the post, fake testimonials with Western stock faces,
QR codes that are not decorative placeholders labeled SAMPLE,
prices you invent, competing brand names.
```

---

```
PROMPT B — POSTS (generate one frame per block; state the pixel size in the first line)

═══════════════════════════════════════════════════════════════════
SERIES 1 — BRAND / AWARENESS
═══════════════════════════════════════════════════════════════════

POST 1.1 — IG feed 1080×1080 EN · Dark hero
Overline: GYM OPERATIONS
Headline: Manage your gym with clarity
Sub: Staff desk. Member app. English + Arabic.
Bottom: lime pill “Book a demo” + small HyMotion wordmark.
Right/bottom: 3 KPI chips on #1A1A1A cards — 150 · EGP 75K · 45 today.

POST 1.2 — IG feed 1080×1080 AR · Dark hero RTL
نفس تكوين 1.1
Headline: أدِر صالتك بوضوح
Sub: مكتب الاستقبال. تطبيق الأعضاء. عربي وإنجليزي.
CTA pill: اطلب عرضاً
HyMotion Latin. Gym mock if any: فيتنس هب.

POST 1.3 — Story 1080×1920 EN · Dark
Full-bleed charcoal + lime grid.
Top: logo mark.
Giant stacked type: CLARITY / ON THE / FLOOR
Mid: phone mock Member Home (Fitness Hub, 22 days left, Check in).
Bottom pill: See HyMotion  + 4px lime→teal bar.

POST 1.4 — Story 1080×1920 AR RTL
Headline stacked: وضوح / على أرض / الصالة
CTA: تعرّف على HyMotion

POST 1.5 — LinkedIn 1200×627 EN
Left 55%: headline + one sentence “The operations platform built for fitness businesses in Egypt and MENA.”
Right: cropped staff dashboard (3 stat cards).
CTA pill bottom-left: Book a demo.

═══════════════════════════════════════════════════════════════════
SERIES 2 — PRODUCT FEATURES (one feature = one post)
═══════════════════════════════════════════════════════════════════

POST 2.1 — Feed 1080×1080 EN · Memberships
Overline: MEMBERSHIPS
Headline: Days left. Freeze. Honest status.
Show membership card: Gold Monthly, Active chip, 22 days remaining, progress bar, lime top 4px.
Footer: Reception assigns. Members just see the truth.

POST 2.2 — Feed AR · Memberships RTL
Headline: الأيام المتبقية. التجميد. حالة واضحة.
Chip: نشط   Plan: ذهبي شهري

POST 2.3 — Feed 1080×1080 EN · QR attendance
Overline: ATTENDANCE
Headline: Check-in in one scan.
Visual: stylized SAMPLE QR on lime rounded-16 card + live “45 today” KPI.
No real scannable code.

POST 2.4 — Feed AR · QR
Headline: حضور بمسح واحد.

POST 2.5 — Feed EN · Gym Identity
Overline: GYM IDENTITY
Headline: Their gym. Not a generic shell.
Split: left HyMotion product mark (small) vs right Fitness Hub logo placeholder + name.
Caption-level idea on image: Member app chrome = the gym.

POST 2.6 — Feed AR · Gym Identity
Headline: صالتهم. مش قالب جاهز.

POST 2.7 — Feed EN · POS + EGP
Overline: FRONT DESK
Headline: POS, invoices, Z-report.
Visual: simple receipt card EGP, teal secondary button “Print”, lime “Pay”.

POST 2.8 — Feed EN · Inventory
Overline: INVENTORY
Headline: Stock that matches the floor.
Three mini cards: Products · Warehouses · Purchase orders.

POST 2.9 — Feed EN · HR
Overline: PEOPLE
Headline: Shifts, leaves, payroll.
Role chips: Owner (lime wash) · Manager (teal) · Trainer (amber #FBBF24).

POST 2.10 — Feed EN · Bilingual RTL
Overline: EN + AR
Headline: RTL is not an afterthought.
Left EN “Active members” / right AR “الأعضاء النشطون” as TWO panels, not one mixed label.

═══════════════════════════════════════════════════════════════════
SERIES 3 — CAROUSEL (4 slides, 1080×1080, same dark system)
═══════════════════════════════════════════════════════════════════

Slide 01/04 EN — Cover
HyMotion
How a clear gym runs
CTA hint: Swipe →

Slide 02/04 — Desk
Reception: check-in, freeze, collect payment.
Icon tiles radius 10, lime/teal washes (same as login feature icons).

Slide 03/04 — Member phone
They see Fitness Hub, remaining days, classes.
Footer line small: Subscribe at reception.

Slide 04/04 — Close
Headline: Ready to run a clearer gym?
Lime pill Book a demo
Handle placeholder: hymotion

AR carousel: same 4 beats, RTL, HyMotion Latin on slide 01 and 04.

═══════════════════════════════════════════════════════════════════
SERIES 4 — ROLE / PAIN
═══════════════════════════════════════════════════════════════════

POST 4.1 — Owner 1080×1080
Overline: FOR OWNERS
Headline: Revenue without spreadsheet fog.
3 KPIs + tiny sparkline in lime. Not a fake 3D chart.

POST 4.2 — Manager
Overline: FOR MANAGERS
Headline: Members, plans, today’s floor.

POST 4.3 — Reception
Overline: FOR RECEPTION
Headline: Assign. Renew. Freeze. Check in.

POST 4.4 — Member (still B2B: selling to gyms)
Overline: FOR YOUR MEMBERS
Headline: Their gym in their pocket.
Phone UI Fitness Hub — not HyMotion as gym name.

═══════════════════════════════════════════════════════════════════
SERIES 5 — CAMPAIGN / CTA
═══════════════════════════════════════════════════════════════════

POST 5.1 — Demo 1080×1080 EN
Headline: Book a 20-minute desk walkthrough.
Sub: Egypt & MENA gyms.
Lime pill: Request a demo
No fake calendar UI with US holidays.

POST 5.2 — Demo AR RTL
Headline: احجز جولة ٢٠ دقيقة على المكتب.
CTA: اطلب عرضاً

POST 5.3 — Story poll style 1080×1920 EN (static, not a real IG poll)
Top question: Still running memberships in Excel?
Bottom: Two pills Ghost “Yes” / Lime “Not anymore”
HyMotion mark + tagline.

POST 5.4 — WhatsApp status 1080×1920 EN
Ultra-simple: logo, tagline, one lime pill “Message us for a demo”.
Huge type, almost no UI chrome (WhatsApp overlays the bottom).

POST 5.5 — Quote / principle 1080×1080
Giant quote marks in #A0E040
“Don’t invent the days remaining. Show what the desk knows.”
Small: HyMotion product principle

POST 5.6 — Hiring or about (optional)
Overline: ABOUT
Headline: Built for Egypt and MENA gym floors.
No invented HQ street. Optional line: [City, Egypt] placeholder.

═══════════════════════════════════════════════════════════════════
SERIES 6 — LIGHT MODE VARIANTS (use sparingly)
═══════════════════════════════════════════════════════════════════

POST 6.1 — Light feed 1080×1080 EN
Bg #FAFAFA, cards white, border #D4D4D4, type #1A1A1A, KPI lime #5EAF00.
Headline: Same clarity. Light desk.
For LinkedIn organic that hates full-bleed black. Logo lime square still correct.
Bottom 4px lime→teal bar.
```

---

## Captions (paste with the matching post)

**1.1 EN**
HyMotion is the operations platform for gyms that want a clear desk and a member app that looks like *their* gym — not a generic shell.

Staff web + member app. English and Arabic.

→ Book a demo.

**1.2 AR**
HyMotion منصة تشغيل للصالات اللي عايزة مكتب واضح، وتطبيق أعضاء باسم الصالة نفسها.

ويب للموظفين + تطبيق للأعضاء. عربي وإنجليزي.

→ اطلب عرضاً.

**Carousel EN (post copy, not on slides)**
Most gym software looks like a generic dashboard. HyMotion is reception-first: freeze and pay at the desk, members see remaining days and their gym’s identity.

Swipe for how the floor actually runs.

**Demo EN**
20 minutes. Your memberships, attendance, and front desk — not a slide deck of fake metrics.

Owners and managers in Egypt & MENA: request a walkthrough.

**Hashtags (max 5, optional)**
`#HyMotion` `#GymManagement` `#Egypt` `#MENA` `#FitnessBusiness`
Arabic posts: skip transliterated spam tags; one `#HyMotion` is enough.

---

## Production checklist

- [ ] HyMotion casing exact; Latin in Arabic posts
- [ ] Fitness Hub only inside member-app mockups
- [ ] Pill CTA, Cairo, charcoal + lime hexes
- [ ] One language per graphic
- [ ] Sample KPIs only (150 / EGP 75K / 45)
- [ ] Story/status: type clear of top/bottom app chrome
- [ ] No real QR that opens a random URL
