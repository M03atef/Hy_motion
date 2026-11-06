# HyMotion Rebrand — Rename Audit Report

**Date:** 2026-09-04  
**Branches:** `Frontend/rebrand/hymotion`, `GMS/rebrand/hymotion`  
**Rule:** Rename what the customer sees. Preserve what the system depends on.

---

## Changed (customer-facing → HyMotion)

| Area | Old | New | Reason |
|------|-----|-----|--------|
| Staff/member web HTML titles (~53 pages) | `GymFlowPro — …` | `HyMotion — …` | Browser title |
| Sidebar / logo text | `GymFlowPro` | `HyMotion` | Visible brand |
| `#gymName` placeholders + JS fallbacks | `GymFlowPro` | `HyMotion` | Until tenant name loads |
| Login / OTP / member login | GymFlowPro | HyMotion | Auth UX |
| Admin + Platform Console titles/shell | GymFlowPro / GymFlow Platform | HyMotion / HyMotion Platform | Console UX |
| `packages/i18n` EN/AR beta + font preview | GymFlowPro | HyMotion | Localization (brand not translated) |
| `app-version.js` label | GymFlowPro v… | HyMotion v… | Support/feedback |
| `design-tokens.json` / design-system | GymFlowPro | HyMotion | Design system name |
| Swagger / Hangfire titles | GymFlowPro API | HyMotion API | Developer/ops facing product name |
| Email `FromName`, OTP subjects/HTML/footer | GymFlowPro | HyMotion | Customer email |
| `AppSettings:ApplicationName` | Gym Flow Pro | HyMotion | App display name |
| Invoice/PDF/access-card fallbacks | GymFlowPro Gym / product mark | HyMotion Gym / HyMotion | Documents |
| WhatsApp sender default | GymFlowPro | HyMotion | Notifications |
| Fawry sale description / Paymob last_name | GymFlowPro… | HyMotion… | Payment UX strings |
| Active FE docs (CORS, localization notes, prompts) | GymFlowPro | HyMotion | Product docs |

---

## Intentionally Not Changed (technical)

| Occurrence | Reason |
|------------|--------|
| `GymFlowProDbContext`, EF migrations, DI | Database/ORM type identity |
| Connection string DB name `GymFlowProDb` | Deployed database name |
| JWT `Issuer` / `Audience` (`GymFlowPro.API` / `.Clients`) | Token compatibility |
| `SignalR:RedisChannelPrefix` / cache `GymFlowPro:` | Redis key namespace |
| `@gymflowpro/i18n`, npm package names `gymflowpro-*` | Package resolution |
| localStorage `gymflowpro.ui` / `.session` / `.platform.*` | Session continuity |
| `@member.gymflowpro.local` synthetic Identity emails | Auth plumbing |
| Activation/AES fallback secret constants | Key material; rotate separately |
| `UseGymFlowProductionPipeline` method name | Internal API |
| Publish profile hostnames (`*.runasp.net`) | Infrastructure |
| API routes, permissions, Hangfire job type names | Contracts |
| Historical audit rows / immutable migrations | Historical integrity |
| Flutter app binary | **No Flutter `pubspec.yaml` in repo** — only prompt docs updated |

---

## Risk Assessment

| Remaining occurrence class | Classification |
|----------------------------|----------------|
| DbContext / DB name / JWT issuer | **Compatibility-sensitive** — do not rename without migration plan |
| npm scope / localStorage keys | **Safe** to keep; optional future alias cutover |
| Admin `dist/` build artifacts | **Safe** — rebuild from source (source already HyMotion) |
| Docs/archive historical mentions | **Historical** |
| Flutter mobile display name | **Requires future migration** when Flutter repo is available |

---

## Regression check

```bash
node Frontend/scripts/i18n/check-hymotion-branding.mjs
```

Scans customer-facing FE/BE surfaces and fails on unintended GymFlowPro copy while allowinglisted technical identifiers.
