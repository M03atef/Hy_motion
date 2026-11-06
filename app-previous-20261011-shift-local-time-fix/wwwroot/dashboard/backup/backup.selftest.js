/**
 * Owner-first Backup page contract.
 * Run: node src/app/(dashboard)/backup/backup.selftest.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'backup-app.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'backup.css'), 'utf8');

assert(html.indexOf('Save a copy now') !== -1, 'primary CTA missing');
assert(html.indexOf('احفظ نسخة دلوقتي') !== -1, 'AR primary CTA missing');
assert(html.indexOf('Save to USB') !== -1, 'USB button missing');
assert(html.indexOf('id="btnSaveUsb"') !== -1, 'USB button id missing');
assert(html.indexOf('Copy to a USB') !== -1, 'USB step missing');
assert(html.indexOf('Restore if something breaks') !== -1, 'restore step missing');
assert(html.indexOf('id="restoreModal"') !== -1, 'restore wizard missing');
assert(html.indexOf('Open Restore') !== -1, 'Open Restore CTA missing');
assert(html.indexOf('Details for HyMotion support') !== -1, 'support details missing');
assert(html.indexOf('Split-Path') === -1, 'PowerShell one-liner must not sit in page HTML');
assert(html.indexOf('CREATE DATABASE') === -1, 'SQL jargon must not sit in page HTML');
assert(html.indexOf('PowerShell') === -1, 'PowerShell must not sit in owner HTML');
assert(html.indexOf('backup-app.js?v=owner2') !== -1, 'cache bump missing');
assert(html.indexOf('backup.css?v=owner2') !== -1, 'css cache bump missing');

assert(js.indexOf('Looks good') !== -1, 'owner status label missing');
assert(js.indexOf('Stay on this page') !== -1, 'save polling copy missing');
assert(js.indexOf('hymotion-backup:') !== -1, 'backup helper protocol missing');
assert(js.indexOf('Restore-HyMotion.ps1') === -1, 'restore script must not be in owner JS');
assert(js.indexOf('Split-Path') === -1, 'PowerShell must not be in owner JS');
assert(/CREATE DATABASE[\s\S]*Call HyMotion/.test(js) || /Call HyMotion[\s\S]*CREATE DATABASE/.test(js), 'CREATE DATABASE must be translated, not shown raw');
assert(js.indexOf('startSavePoll') !== -1, 'save polling missing');
assert(css.indexOf('.bk-steps') !== -1, 'step layout missing');
assert(css.indexOf('.bk-ov') !== -1, 'restore overlay missing');

console.log('backup.selftest: ok');
