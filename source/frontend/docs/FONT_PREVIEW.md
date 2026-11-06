# Font Preview

Internal typography comparison tool.

## Open

```text
http://localhost:3000/dev/font-preview/
```

Not linked in staff nav. Dev/design only.

## Production fonts (live)

```text
Display / Body / Arabic: Cairo (OFL, Google Fonts)
```

Applied across staff web (`apps/web`), admin, and platform console. Monospace for technical tokens may still use IBM Plex Mono on the platform console only.

## Features

- EN / AR toggle via `GfpI18n` (LTR / RTL)
- Same HyMotion-like UI in every card (KPIs, buttons, badges, dense table, stress text, scales, weights)
- Compare checkboxes (side-by-side same content)
- Lazy Google Fonts load per selected candidate
- DIN Next LT Pro marked **unavailable** (commercial license)
- Evaluation notes persisted in `localStorage`

## Tests

```bash
cd Frontend
npm run i18n:sync
npm run i18n:ci
node apps/web/src/app/dev/font-preview/font-preview.selftest.js
```
