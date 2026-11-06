#!/usr/bin/env node
/**
 * Sync packages/i18n locales → apps/web classic script (IIFE catalog).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/locales/ar.json'), 'utf8'));

const out = path.join(root, 'apps/web/src/app/shared/i18n-catalog.js');
const body = `/** Auto-generated from packages/i18n — do not edit by hand. Run: npm run i18n:sync */
(function (global) {
  'use strict';
  global.GfpI18nCatalog = ${JSON.stringify({ en, ar }, null, 2)};
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(out, body, 'utf8');
console.log('Wrote', out);
