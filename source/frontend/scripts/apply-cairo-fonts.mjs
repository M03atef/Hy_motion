/**
 * Apply Cairo as production font across Frontend source (not dist/).
 * Does not rewrite font-preview candidate pairings (Inter+IBM etc.).
 * Run: node scripts/apply-cairo-fonts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CAIRO_LINK =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap';

const stringPairs = [
  [
    'family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
    'family=Cairo:wght@300;400;500;600;700&display=swap',
  ],
  [
    'family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap',
    'family=Cairo:wght@300;400;500;600;700&display=swap',
  ],
  [
    'family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
    'family=Cairo:wght@300;400;500;600;700&display=swap',
  ],
  [
    'family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
    'family=Cairo:wght@300;400;500;600;700&display=swap',
  ],
  ["--fd:'Space Grotesk',sans-serif", "--fd:'Cairo',sans-serif"],
  ["--fd: 'Space Grotesk', sans-serif", "--fd: 'Cairo', sans-serif"],
  ["--fb:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif", "--fb:'Cairo',sans-serif"],
  ["--fb: 'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif", "--fb: 'Cairo', sans-serif"],
  ["--fa:'IBM Plex Sans Arabic',sans-serif", "--fa:'Cairo',sans-serif"],
  ["--fa: 'IBM Plex Sans Arabic', sans-serif", "--fa: 'Cairo', sans-serif"],
  [
    "font-family: 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    "font-family: 'Cairo', system-ui, sans-serif",
  ],
  [
    'Space Grotesk + IBM Plex Sans / IBM Plex Sans Arabic',
    'Cairo',
  ],
  [
    "fonts (Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic)",
    'fonts (Cairo)',
  ],
  [
    'Space Grotesk (display) + IBM Plex Sans + IBM Plex Sans Arabic',
    'Cairo',
  ],
  [
    'Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic',
    'Cairo',
  ],
  [
    "Display: <b>Space Grotesk</b> (headings, KPIs) — Body: <b>IBM Plex Sans</b> + <b>IBM Plex Sans Arabic</b>",
    'Display + Body + Arabic: <b>Cairo</b>',
  ],
  [
    "/* Fonts */     display: 'Space Grotesk' | body: 'IBM Plex Sans' | arabic: 'IBM Plex Sans Arabic'",
    "/* Fonts */     display/body/arabic: 'Cairo'",
  ],
];

const skipDirs = new Set(['node_modules', 'dist', '.git', 'uploads']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(html|css|js|tsx|ts|md|json)$/i.test(name)) acc.push(p);
  }
  return acc;
}

const files = [
  ...walk(path.join(root, 'apps')),
  ...walk(path.join(root, 'packages')),
  ...walk(path.join(root, 'docs')),
  path.join(root, 'design-system.html'),
  path.join(root, 'FLUTTER_MEMBER_APP_PROMPT.md'),
  path.join(root, 'FLUTTER_MEMBER_ATTENDANCE_PROMPT.md'),
  path.join(root, 'FLUTTER_MEMBER_PROFILE_PROMPT.md'),
  path.join(root, 'FLUTTER_MEMBER_ORDERS_PROMPT.md'),
].filter((f) => fs.existsSync(f));

let changed = 0;
for (const file of files) {
  // Keep font-preview candidate definitions intact except production row (handled below)
  const rel = path.relative(root, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;

  for (const [from, to] of stringPairs) {
    if (text.includes(from)) text = text.split(from).join(to);
  }

  text = text.replace(
    /https:\/\/fonts\.googleapis\.com\/css2\?family=Space\+Grotesk:[^\s"']+/g,
    CAIRO_LINK,
  );
  text = text.replace(/--fd:\s*'Space Grotesk',\s*sans-serif/g, "--fd:'Cairo',sans-serif");
  text = text.replace(
    /--fb:\s*'IBM Plex Sans',\s*'IBM Plex Sans Arabic',\s*sans-serif/g,
    "--fb:'Cairo',sans-serif",
  );
  text = text.replace(/--fa:\s*'IBM Plex Sans Arabic',\s*sans-serif/g, "--fa:'Cairo',sans-serif");

  if (rel.endsWith('font-preview-app.js')) {
    text = text.replace(
      /id: 'production',\s*name: 'Production \(current\)',\s*latin: '[^']*',\s*arabic: '[^']*',\s*stack: "[^"]*",\s*google: null,\s*available: true,\s*license: '[^']*',\s*source: '[^']*'/,
      `id: 'production',
      name: 'Production (current)',
      latin: 'Cairo',
      arabic: 'Cairo',
      stack: "'Cairo',sans-serif",
      google: 'family=Cairo:wght@300;400;500;600;700',
      available: true,
      license: 'OFL via Google Fonts. Commercial web usage allowed. Arabic: yes.',
      source: 'Production (Cairo)'`,
    );
  }

  if (text !== orig) {
    fs.writeFileSync(file, text, 'utf8');
    changed++;
    console.log('updated', rel);
  }
}

console.log(`Cairo applied in ${changed} files`);
