# HyMotion — Flutter Member App: Product Rebrand Prompt

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Web + API customer-facing rebrand is already live in this monorepo (`docs/HYMOTION_REBRAND_AUDIT.md`).  
> This prompt is for the **Flutter Member App repo only** (not staff web).
>
> Rule: **Rename what the member sees. Preserve what the system depends on.**

---

```
PROMPT — HyMotion Member App: GymFlowPro → HyMotion product rebrand (Flutter)
You are a senior Flutter developer applying a PRODUCT/BRAND rename only.

Old customer-facing brand: GymFlowPro (also “Gym Flow Pro”, “GymFlow Pro”)
New official brand: HyMotion

Casing (strict — use exactly this everywhere in UI):
  HyMotion
Do NOT introduce: Hy Motion | HYMOTION | Hymotion | Hy-Motion
Do NOT translate the brand in Arabic UI — keep Latin “HyMotion” in both EN and AR.

This is NOT an architecture rename. Do not break auth, API contracts, package ids, or store listings without an explicit store-migration project.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE,
Member JWT (member-activate), fonts (Cairo), charcoal #0D0D0D + lime #7ACC00.

═══════════════════════════════════════════════════════════════════
0) SEARCH FIRST — DO NOT BLIND GLOBAL REPLACE
═══════════════════════════════════════════════════════════════════

Search the whole Flutter project (case-insensitive) for:
  GymFlowPro
  Gym Flow Pro
  GymFlow Pro
  GYMFLOWPRO
  gymflowpro
  gym-flow-pro
  Gym-flow-pro

Classify every hit:

A) CUSTOMER-FACING → MUST change to HyMotion
B) TECHNICAL IDENTIFIERS → leave unchanged unless a dedicated migration exists
C) HISTORICAL / LEGAL entity names → leave unless product/legal asks

═══════════════════════════════════════════════════════════════════
1) MUST RENAME (customer-facing)
═══════════════════════════════════════════════════════════════════

App chrome
- MaterialApp / CupertinoApp title
- Splash / onboarding headlines that say GymFlowPro
- Login / activation screens (“Welcome to …”, about copy)
- Profile / Settings / About / Help / Support
- Empty states, error copy that name the product
- In-app notification titles/bodies that say GymFlowPro
- SnackBars / dialogs / permission rationale strings that name the product

Localization (ARB / l10n)
- English AND Arabic string catalogs
- Brand stays “HyMotion” in both locales (do not Arabic-ize the brand)

Platform display name (VISIBLE only)
Android:
  - android:label / application label in AndroidManifest.xml
  - launcher name / strings.xml app_name
  - splash branding text if any
iOS:
  - CFBundleDisplayName (Info.plist / build settings)
  - splash branding text if any
Flutter Web (if used):
  - <title>, manifest name / short_name, PWA application name
  - meta description / OG title if present

Assets
- Logos / splash / icons that visibly contain the word GymFlowPro
  Preferred safety: keep filename temporarily; replace visual contents
  OR add hymotion-* assets and update references without leaving broken paths
- Do NOT regenerate unrelated images

Docs in the Flutter repo that members/devs read as current product name
- README title / app description → HyMotion
- Keep historical commit messages alone

═══════════════════════════════════════════════════════════════════
2) DO NOT RENAME (technical — preserve unless separate migration)
═══════════════════════════════════════════════════════════════════

- Android applicationId / package name (e.g. com.…gymflowpro…)
- iOS bundle identifier / provisioning / certificates / signing
- Dart package name in pubspec.yaml (name: …) if changing breaks imports
- Folder/repo remotes, CI secrets keyed to old names
- Deep link schemes already shipped to production (unless dual-scheme planned)
- Secure storage keys already on devices (changing wipes sessions)
- API base hostnames already in use (api.gymflowpro.com etc.) — change only
  if ops give a new production host; prefer config/env, not hardcode churn
- JWT claim names, role strings, header names
- Any path that talks to the backend (/auth/member-activate, /member/attendance, …)

Safest product rule:
  Change the DISPLAYED product name to HyMotion.
  Keep the technical app identity stable for App Store / Play continuity.

═══════════════════════════════════════════════════════════════════
3) IMPLEMENTATION STEPS
═══════════════════════════════════════════════════════════════════

1) Inventory
   rg -i "gymflowpro|gym flow pro|gymflow pro" .
   Save a short audit: Changed vs Intentionally Not Changed.

2) Strings / l10n
   Replace customer-facing GymFlowPro → HyMotion in arb/json/dart UI strings.
   Prefer one brand constant, e.g.:
     const kProductName = 'HyMotion';
   Use it for titles instead of scattering literals.

3) Platform labels
   Android app_name / android:label → HyMotion
   iOS CFBundleDisplayName → HyMotion
   Do NOT change applicationId / bundle id in this task.

4) Splash + About
   Splash text, About screen, Support email subject templates → HyMotion

5) Assets
   Only assets that SHOW the old brand. Keep filenames if references would break.

6) Regression search
   After edits, search again. Zero unintended customer-facing GymFlowPro in:
     lib/**  arb/**  assets text overlays  Android label  iOS display name
   Technical ids may remain (document them).

═══════════════════════════════════════════════════════════════════
4) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

[ ] Launcher name shows HyMotion (Android + iOS)
[ ] Splash shows HyMotion
[ ] Activation / login shows HyMotion
[ ] Home / Profile / Settings / About show HyMotion (no GymFlowPro)
[ ] EN + AR l10n: brand is HyMotion (not translated)
[ ] Push / local notification product title (if any) says HyMotion
[ ] Web/PWA title (if applicable) says HyMotion
[ ] applicationId / bundle id UNCHANGED
[ ] Secure storage keys UNCHANGED
[ ] API paths / auth flow UNCHANGED
[ ] flutter analyze clean for touched files
[ ] Manual smoke: cold start → activate → home → profile → settings
[ ] Short rename audit committed or pasted in PR description

═══════════════════════════════════════════════════════════════════
5) OUT OF SCOPE
═══════════════════════════════════════════════════════════════════

- Renaming Play/App Store listing (separate store console task)
- Renaming GitHub repo / CI package ids
- Staff web / Platform Console (already handled in web monorepo)
- Backend JWT issuer GymFlowPro.API (must stay for token compatibility)
- Changing API hosts without ops approval
```

---

## Quick reference

| Surface | Action |
|---------|--------|
| Visible app name / splash / About | → **HyMotion** |
| EN + AR UI brand | → **HyMotion** (not translated) |
| `applicationId` / iOS bundle id | **Keep** |
| Secure storage / API paths | **Keep** |
| Staff web desk | Already HyMotion in monorepo |

## Related

- Web/API audit: [`docs/HYMOTION_REBRAND_AUDIT.md`](docs/HYMOTION_REBRAND_AUDIT.md)
- Member app base prompt: [`FLUTTER_MEMBER_APP_PROMPT.md`](FLUTTER_MEMBER_APP_PROMPT.md)
