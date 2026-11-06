#!/usr/bin/env node
/**
 * HyMotion branding regression check.
 * Fails if customer-facing product surfaces still contain GymFlowPro / Gym Flow Pro.
 * Intentionally ignores technical identifiers (@gymflowpro/*, gymflowpro.* storage keys,
 * package names, GymFlowProDb*, JWT issuer strings in config comments, etc.).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const backendRoot = path.resolve(frontendRoot, '..');

const FORBIDDEN = [/GymFlowPro/g, /Gym Flow Pro/g, /GymFlow Pro/g];

const SCAN_GLOBS = [
  // Frontend customer surfaces
  ['Frontend', 'apps/web/src', ['.html', '.js', '.css']],
  ['Frontend', 'apps/admin/src', ['.tsx', '.ts', '.html']],
  ['Frontend', 'apps/admin', ['.html']],
  ['Frontend', 'apps/platform-console/src', ['.tsx', '.ts', '.html']],
  ['Frontend', 'apps/platform-console', ['.html']],
  ['Frontend', 'packages/i18n/locales', ['.json']],
  ['Frontend', 'login.html', null],
  ['Frontend', 'design-system.html', null],
  ['Frontend', 'design-tokens.json', null],
  // Backend customer-facing outputs
  ['Backend', 'GMS.Api/Program.cs', null],
  ['Backend', 'GMS.Api/Extensions/ProductionHostingExtensions.cs', null],
  ['Backend', 'GMS.Application/Services/EmailOtpDeliveryStrategy.cs', null],
  ['Backend', 'GMS.Application/Services/AccessCardHtmlBuilder.cs', null],
  ['Backend', 'GMS.Application/Services/InvoiceDocumentHtmlBuilder.cs', null],
  ['Backend', 'GMS.Application/Services/InvoicePdfModelFactory.cs', null],
  ['Backend', 'GMS.Application/Common/RequestLocale.cs', null],
  ['Backend', 'GMS.Infrastructure/Services/InvoicePdfRenderer.cs', null],
  ['Backend', 'GMS.Infrastructure/Services/FourJawalyWhatsAppService.cs', null],
  ['Backend', 'GMS.Infrastructure/Services/FawryService.cs', null],
  ['Backend', 'GMS.Infrastructure/Services/PaymobService.cs', null],
];

const ALLOW_LINE = [
  /GymFlowProDbContext/,
  /GymFlowProDb\b/,
  /@gymflowpro\//,
  /gymflowpro\.(ui|session|platform)/,
  /"name":\s*"gymflowpro/,
  /Issuer.*GymFlowPro/,
  /Audience.*GymFlowPro/,
  /RedisChannelPrefix/,
  /UseGymFlowProductionPipeline/,
  /GymFlowPro-AES256/,
  /GymFlowPro-MemberAppActivation/,
  /GymFlowPro-EmployeeAppActivation/,
  /@member\.gymflowpro\.local/,
  /@employee\.gymflowpro\.local/,
];

function walk(dir, exts, out) {
  if (!fs.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    out.push(dir);
    return;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.vite' || ent.name === 'bin' || ent.name === 'obj') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exts, out);
    else if (!exts || exts.includes(path.extname(ent.name))) out.push(p);
  }
}

function resolveScan(entry) {
  const [kind, rel, exts] = entry;
  const root = kind === 'Frontend' ? frontendRoot : backendRoot;
  const full = path.join(root, rel);
  const files = [];
  walk(full, exts, files);
  return files;
}

const hits = [];
for (const entry of SCAN_GLOBS) {
  for (const file of resolveScan(entry)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (ALLOW_LINE.some((re) => re.test(line))) return;
      for (const re of FORBIDDEN) {
        re.lastIndex = 0;
        if (re.test(line)) {
          hits.push(`${path.relative(backendRoot, file)}:${i + 1}: ${line.trim().slice(0, 160)}`);
          break;
        }
      }
    });
  }
}

if (hits.length) {
  console.error('HyMotion branding check FAILED — customer-facing GymFlowPro remnants:\n');
  hits.slice(0, 80).forEach((h) => console.error('  ' + h));
  if (hits.length > 80) console.error(`  … and ${hits.length - 80} more`);
  process.exit(1);
}

console.log('HyMotion branding check OK — no customer-facing GymFlowPro remnants in scanned surfaces.');
