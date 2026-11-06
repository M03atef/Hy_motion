#!/usr/bin/env node
/**
 * Detect suspicious hardcoded UI strings in FE apps.
 * Uses allowlist of paths still pending migration (shrink over time).
 * Suppress inline with: // i18n-ignore-next-line  or  /* i18n-ignore *
 *
 * Also crawls critical dashboard HTML for English chrome without data-en /
 * data-en-placeholder — these pages are otherwise swallowed by the broad
 * (dashboard)/ allowlist, which is why AR locale used to leave English tables.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const allowlistPath = path.join(__dirname, 'hardcoded-allowlist.json');
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

const SUSPICIOUS = /\b(toast|alert|confirm)\s*\(\s*['"`][A-Za-z]/;
const JSX_HARD = />\s*[A-Z][a-z]+ [A-Za-z ]{2,40}\s*</;

/** Must stay wired even while the rest of dashboard is allowlisted. */
const CHROME_CRAWL_HTML = [
  'apps/web/src/app/(dashboard)/members/[id]/index.html',
  'apps/web/src/app/(dashboard)/invitations/index.html',
  'apps/web/src/app/(dashboard)/attendance/index.html',
  'apps/web/src/app/(dashboard)/member-orders/index.html',
];

const CHROME_PHRASES = [
  'Recent attendance',
  "Today's Attendance",
  'Attendance Heatmap',
  '12-Week Attendance Pattern',
  'All statuses',
  'Search name or phone',
  'Search member by name',
  'Orders placed from the Member App',
  'checked in today',
  'No attendance records',
];

function walk(dir, pred, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(frontendRoot, p).replace(/\\/g, '/');
}

const hits = [];

for (const app of ['apps/web/src/app', 'apps/admin/src', 'apps/platform-console/src']) {
  const base = path.join(frontendRoot, app);
  for (const file of walk(base, (p) => /\.(js|tsx|ts|html)$/.test(p) && !p.includes('selftest'))) {
    const r = rel(file);
    if (allowlist.paths.some((a) => r === a || r.startsWith(a.replace(/\*$/, '')))) continue;
    if (allowlist.files.includes(r)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('i18n-ignore')) continue;
      if (i > 0 && lines[i - 1].includes('i18n-ignore-next-line')) continue;
      if (SUSPICIOUS.test(line) || (file.endsWith('.tsx') && JSX_HARD.test(line))) {
        if (/GfpI18n\.t\(|\bt\(['"`][a-z]|tLabel\(/.test(line) && !SUSPICIOUS.test(line)) continue;
        if (SUSPICIOUS.test(line)) {
          hits.push({ file: r, line: i + 1, text: line.trim().slice(0, 160) });
        }
      }
    }
  }
}

/** HTML chrome crawl — ignores dashboard allowlist for known hot pages. */
for (const r of CHROME_CRAWL_HTML) {
  const file = path.join(frontendRoot, r);
  if (!fs.existsSync(file)) {
    hits.push({ file: r, line: 0, text: 'Missing critical i18n crawl target' });
    continue;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('i18n-ignore')) continue;

    // <th>English</th> without data-en
    const thMatch = line.match(/<th\b([^>]*)>([^<]{1,60})<\/th>/i);
    if (thMatch) {
      const attrs = thMatch[1] || '';
      const text = thMatch[2].trim();
      if (text && /[A-Za-z]{2,}/.test(text) && !/\bdata-en\b/.test(attrs)) {
        hits.push({
          file: r,
          line: i + 1,
          text: `HTML <th> missing data-en: ${text.slice(0, 80)}`,
        });
      }
    }

    // Multi-word English placeholders without data-en-placeholder
    // Avoid matching the "placeholder=" inside "data-en-placeholder="
    const phMatch = line.match(
      /<(?:(?!data-(?:en|ar)-placeholder=)[^>])*\splaceholder="([^"]*)"[^>]*>/
    );
    if (phMatch && !/\bdata-en-placeholder\b/.test(line)) {
      const ph = phMatch[1];
      if (/\s/.test(ph) && /[A-Za-z]{3,}/.test(ph)) {
        hits.push({
          file: r,
          line: i + 1,
          text: `placeholder missing data-en-placeholder: ${ph.slice(0, 80)}`,
        });
      }
    }

    for (const phrase of CHROME_PHRASES) {
      if (!line.includes(phrase)) continue;
      // Accept if same line (or nearby opening tag) has data-en / data-en-placeholder
      const window = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
      if (/\bdata-en(?:-placeholder)?\b/.test(window)) continue;
      hits.push({
        file: r,
        line: i + 1,
        text: `Unlocalized chrome phrase (add data-en): ${phrase}`,
      });
    }
  }
}

if (hits.length) {
  console.error('Hardcoded UI string check failed\n');
  for (const h of hits.slice(0, 80)) {
    console.error(`${h.file}:${h.line}\nHardcoded UI string detected:\n${h.text}\n`);
  }
  if (hits.length > 80) console.error(`… and ${hits.length - 80} more`);
  process.exit(1);
}
console.log('i18n:hardcoded OK (toast/JSX + critical HTML chrome crawl)');
