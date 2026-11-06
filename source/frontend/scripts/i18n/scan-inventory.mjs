#!/usr/bin/env node
/**
 * Scan apps for candidate user-facing literals → inventory JSON.
 * Classification is heuristic (A/B/C); review remaining A rows.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'docs/localization/inventory');

const TECH = /^(https?:|\/api\/|\/dashboard|ti-|lucide|gfp_|MEMBER_|FEATURE_|jwt|guid|uuid|null|true|false|application\/|text\/|#[0-9a-f]{3,8}$)/i;
const CODEY = /^[a-z]+(\.[a-z_]+)+$/; // permission-like
const SHORT_TECH = new Set(['en', 'ar', 'ltr', 'rtl', 'id', 'ok', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function walk(dir, pred, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'uploads') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

function classify(s) {
  const t = s.trim();
  if (!t || t.length < 2) return 'B';
  if (TECH.test(t) || CODEY.test(t) || SHORT_TECH.has(t)) return 'B';
  if (/^\{/.test(t) || /^\$\{/.test(t)) return 'B';
  if (/^[A-Z0-9_]{3,}$/.test(t) && t.includes('_')) return 'B'; // ERROR_CODE
  if (/^\//.test(t) || /\.(js|css|html|png|svg)$/i.test(t)) return 'B';
  // Likely user-facing English/Arabic
  if (/[A-Za-z\u0600-\u06FF]/.test(t) && /[a-z\u0600-\u06FF]/.test(t) && t.length >= 3) return 'A';
  return 'B';
}

function extractJsStrings(content) {
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1).){2,120})\1/g;
  let m;
  while ((m = re.exec(content))) {
    const s = m[2];
    if (s.includes('${') && m[1] === '`') continue;
    if (s.includes('\\n') && s.length < 4) continue;
    out.push(s.replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return out;
}

function extractDataEn(content) {
  const out = [];
  const re = /data-en=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) out.push(m[1]);
  return out;
}

function extractToast(content) {
  const out = [];
  const re = /toast\s*\(\s*(['"`])((?:\\.|(?!\1).)+)\1/g;
  let m;
  while ((m = re.exec(content))) out.push(m[2]);
  return out;
}

function extractFailure(content) {
  const out = [];
  const re = /Failure\s*\(\s*"([^"]{3,200})"/g;
  let m;
  while ((m = re.exec(content))) out.push(m[1]);
  return out;
}

const rows = [];

function add(app, file, source, str) {
  const type = classify(str);
  rows.push({
    Application: app,
    File: path.relative(repoRoot, file).replace(/\\/g, '/'),
    RoutePage: '',
    Component: '',
    String: str.slice(0, 200),
    StringType: type,
    CurrentSource: source,
    ExistingLocalizationKey: '',
    RequiredAction: type === 'A' ? 'localize' : type === 'C' ? 'leave-user-data' : 'leave-technical',
  });
}

// apps/web
for (const file of walk(path.join(frontendRoot, 'apps/web/src/app'), (p) => /\.(js|html)$/.test(p))) {
  const c = fs.readFileSync(file, 'utf8');
  for (const s of extractDataEn(c)) add('apps/web', file, 'data-en', s);
  for (const s of extractToast(c)) add('apps/web', file, 'toast', s);
}

// admin + platform
for (const app of ['admin', 'platform-console']) {
  const base = path.join(frontendRoot, 'apps', app, 'src');
  for (const file of walk(base, (p) => /\.(tsx|ts)$/.test(p) && !p.endsWith('.d.ts'))) {
    const c = fs.readFileSync(file, 'utf8');
    // JSX text-ish: >Label<
    const jsx = c.matchAll(/>([A-Z][A-Za-z0-9 ,.'!?\-]{2,80})</g);
    for (const m of jsx) add(`apps/${app}`, file, 'jsx-text', m[1]);
    for (const s of extractJsStrings(c).filter((x) => /[A-Za-z]{4,}/.test(x) && / /.test(x))) {
      add(`apps/${app}`, file, 'string-literal', s);
    }
  }
}

// backend
const appDir = path.join(repoRoot, 'GMS.Application');
for (const file of walk(appDir, (p) => p.endsWith('.cs'))) {
  const c = fs.readFileSync(file, 'utf8');
  for (const s of extractFailure(c)) add('backend', file, 'Failure', s);
  const wm = c.matchAll(/WithMessage\s*\(\s*"([^"]{3,200})"/g);
  for (const m of wm) add('backend', file, 'WithMessage', m[1]);
}

fs.mkdirSync(outDir, { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  total: rows.length,
  byType: { A: 0, B: 0, C: 0 },
  byApp: {},
};
for (const r of rows) {
  summary.byType[r.StringType] = (summary.byType[r.StringType] || 0) + 1;
  summary.byApp[r.Application] = summary.byApp[r.Application] || { A: 0, B: 0, total: 0 };
  summary.byApp[r.Application].total++;
  summary.byApp[r.Application][r.StringType]++;
}

fs.writeFileSync(path.join(outDir, 'inventory.json'), JSON.stringify({ summary, rows }, null, 2));
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

// CSV header
const cols = ['Application', 'File', 'RoutePage', 'Component', 'String', 'StringType', 'CurrentSource', 'ExistingLocalizationKey', 'RequiredAction'];
const csv = [cols.join(',')].concat(
  rows.slice(0, 50000).map((r) =>
    cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','),
  ),
).join('\n');
fs.writeFileSync(path.join(outDir, 'inventory.csv'), csv);

console.log('Inventory written to', outDir);
console.log(JSON.stringify(summary, null, 2));
