/**
 * @gymflowpro/i18n — universal entry (Node ESM + bundlers).
 * Loads the locale catalogs via a static JSON import (with the standard import-attribute
 * syntax) instead of fs.readFileSync/fileURLToPath. That Node-only combo cannot be bundled
 * for the browser (Vite/webpack externalize "fs"/"path"/"url" as no-op stubs and throw at
 * first use), which previously left the platform-console and admin apps with a blank page.
 * A static JSON import works natively in Node 22+ and is handled natively by every bundler.
 */
import en from '../locales/en.json' with { type: 'json' };
import ar from '../locales/ar.json' with { type: 'json' };
import { createCatalogApi } from './catalog-api.js';

/** @typedef {'en'|'ar'} Locale */

const api = createCatalogApi({ en, ar });

export const {
  t,
  hasKey,
  listKeys,
  pickBilingual,
  splitSlashBilingual,
  displayBilingualText,
  tLabel,
  statusLabel,
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  catalogs,
} = api;

export default api;
