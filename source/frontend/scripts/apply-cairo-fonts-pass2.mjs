/**
 * Second-pass cleanup for Cairo production font leftovers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  'apps/web/src/app/shared/rtl.css',
  'apps/web/src/app/auth/member-otp/index.html',
  'apps/web/src/app/shared/shell.js',
  'apps/web/src/app/auth/login/index.html',
  'apps/web/src/app/(dashboard)/components/membership-status-card.css',
  'apps/web/src/app/(dashboard)/offers/offers.css',
  'apps/web/src/app/(dashboard)/inventory/inventory-stub.css',
  'apps/web/src/app/(dashboard)/member-orders/member-orders.css',
  'login.html',
  'apps/platform-console/src/index.css',
  'docs/FONT_PREVIEW.md',
  'design-tokens.json',
];

const pairs = [
  [
    "var(--fa, 'IBM Plex Sans Arabic'), 'IBM Plex Sans', sans-serif",
    "var(--fa, 'Cairo'), 'Cairo', sans-serif",
  ],
  [
    'var(--fa,"IBM Plex Sans Arabic"),sans-serif',
    'var(--fa,"Cairo"),sans-serif',
  ],
  ["--fb:'IBM Plex Sans',sans-serif", "--fb:'Cairo',sans-serif"],
  ["font-family:'Space Grotesk',monospace", "font-family:'Cairo',monospace"],
  ["var(--fd, 'Space Grotesk', sans-serif)", "var(--fd, 'Cairo', sans-serif)"],
  ["var(--fd,'Space Grotesk',sans-serif)", "var(--fd,'Cairo',sans-serif)"],
  [
    "font-family: 'Space Grotesk', system-ui, sans-serif",
    "font-family: 'Cairo', system-ui, sans-serif",
  ],
  [
    "--fd:'Space Grotesk',sans-serif;--fb:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif",
    "--fd:'Cairo',sans-serif;--fb:'Cairo',sans-serif",
  ],
  [
    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap')",
    "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap')",
  ],
  ["--font: 'DM Sans', system-ui, sans-serif", "--font: 'Cairo', system-ui, sans-serif"],
  ["Space Grotesk + IBM Plex Sans / IBM Plex Sans Arabic", "Cairo"],
  ["Current Production Font:\n[ existing font ]", "Current Production Font:\nCairo"],
];

for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.log('skip', rel);
    continue;
  }
  let t = fs.readFileSync(p, 'utf8');
  const o = t;
  for (const [a, b] of pairs) t = t.split(a).join(b);
  t = t.split('Space Grotesk').join('Cairo');
  // Body fonts only — keep IBM Plex Mono
  t = t.replace(/'IBM Plex Sans'(?! Mono)/g, "'Cairo'");
  t = t.replace(/IBM Plex Sans Arabic/g, 'Cairo');
  if (t !== o) {
    fs.writeFileSync(p, t);
    console.log('fixed', rel);
  } else console.log('noop', rel);
}

// Sync i18n production label
for (const loc of ['en', 'ar']) {
  const p = path.join(root, `packages/i18n/locales/${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j['fontPreview.productionValue'] = 'Cairo';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('locale', loc);
}

console.log('done');
