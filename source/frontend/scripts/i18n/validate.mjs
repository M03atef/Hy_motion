#!/usr/bin/env node
/**
 * Validate EN/AR catalogs: key parity, placeholders, duplicates.
 * Exit 1 on failure.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/locales/ar.json'), 'utf8'));

const errors = [];

function placeholders(s) {
  const set = new Set();
  String(s).replace(/\{(\w+)(?:,\s*plural[^}]*)?\}/g, (_, name) => {
    set.add(name);
    return '';
  });
  // plural form embeds {count, plural, ...} — also capture inner #
  String(s).replace(/\{(\w+),\s*plural,/g, (_, name) => {
    set.add(name);
    return '';
  });
  return set;
}

const enKeys = Object.keys(en);
const arKeys = Object.keys(ar);

for (const k of enKeys) {
  if (!(k in ar)) errors.push(`Missing Arabic translation:\n${k}`);
}
for (const k of arKeys) {
  if (!(k in en)) errors.push(`Missing English translation:\n${k}`);
}

const seen = new Set();
for (const k of enKeys) {
  if (seen.has(k)) errors.push(`Duplicate key: ${k}`);
  seen.add(k);
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(k) && !/^[a-z][a-z0-9_]*\.[a-z0-9_.]+$/i.test(k)) {
    // allow nested like members.errors.notFound
    if (!/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(k)) {
      errors.push(`Invalid key: ${k}`);
    }
  }
  const pe = placeholders(en[k]);
  const pa = placeholders(ar[k] ?? '');
  for (const p of pe) {
    if (!pa.has(p)) errors.push(`Placeholder mismatch (${k}): EN has {${p}} missing in AR`);
  }
  for (const p of pa) {
    if (!pe.has(p)) errors.push(`Placeholder mismatch (${k}): AR has {${p}} missing in EN`);
  }
}

if (errors.length) {
  console.error('Localization validation failed\n');
  console.error(errors.join('\n\n'));
  process.exit(1);
}
console.log(`i18n:validate OK — ${enKeys.length} keys, EN/AR parity`);
