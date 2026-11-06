# Localization (Frontend repo)

Canonical architecture doc (sibling backend checkout): `../docs/localization.md` or monorepo `docs/localization.md`.

## Commands (this repo)

```bash
npm run i18n:validate
npm run i18n:sync
npm run i18n:test
npm run i18n:hardcoded
npm run i18n:inventory   # writes to ../docs/localization/inventory when run from monorepo layout
npm run i18n:ci
```

Package: [`packages/i18n`](../packages/i18n)  
Staff web: `apps/web/src/app/shared/i18n.js` + generated `i18n-catalog.js`  
CI: [`.github/workflows/i18n.yml`](../.github/workflows/i18n.yml)
