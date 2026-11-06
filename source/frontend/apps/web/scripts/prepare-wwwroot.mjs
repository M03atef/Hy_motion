/**
 * Copies staff dashboard + auth + shared assets into GMS.Api/wwwroot for IIS/MonsterASP.
 * Run: node scripts/prepare-wwwroot.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, '..');
const srcApp = path.join(webRoot, 'src', 'app');
const outRoot = path.resolve(webRoot, '../../../GMS.Api/wwwroot');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('Skip missing:', src);
    return;
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === 'node_modules' || name === 'components') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('Preparing wwwroot at', outRoot);
fs.mkdirSync(outRoot, { recursive: true });

const syncScript = path.join(__dirname, '../../../scripts/i18n/sync-web-catalog.mjs');
if (fs.existsSync(syncScript)) {
  spawnSync(process.execPath, [syncScript], { stdio: 'inherit' });
}

copyRecursive(path.join(srcApp, '(dashboard)'), path.join(outRoot, 'dashboard'));
copyRecursive(path.join(srcApp, 'auth'), path.join(outRoot, 'auth'));
copyRecursive(path.join(srcApp, 'member'), path.join(outRoot, 'member'));
copyRecursive(path.join(srcApp, 'shared'), path.join(outRoot, 'shared'));
copyRecursive(path.join(srcApp, 'dev'), path.join(outRoot, 'dev'));

for (const dir of ['uploads', 'logs']) {
  fs.mkdirSync(path.join(outRoot, dir), { recursive: true });
}

console.log('Done. Dashboard → wwwroot/dashboard, auth → wwwroot/auth, member → wwwroot/member, shared → wwwroot/shared');
