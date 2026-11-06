/**
 * Responsive shared CSS contract (Task 9). Run: node src/app/shared/responsive.selftest.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

var sharedDir = __dirname;
var files = [
  'responsive.css',
  'shell-layout.css',
  'shell-header.css',
  'dashboard-layout.css',
  'table-layout.css',
  'form-layout.css',
  'modal-layout.css',
  'sweep-layout.css'
];

files.forEach(function (f) {
  assert(fs.existsSync(path.join(sharedDir, f)), f + ' exists');
});

var responsive = fs.readFileSync(path.join(sharedDir, 'responsive.css'), 'utf8');
var shellLayout = fs.readFileSync(path.join(sharedDir, 'shell-layout.css'), 'utf8');
var tableLayout = fs.readFileSync(path.join(sharedDir, 'table-layout.css'), 'utf8');
var formLayout = fs.readFileSync(path.join(sharedDir, 'form-layout.css'), 'utf8');
var modalLayout = fs.readFileSync(path.join(sharedDir, 'modal-layout.css'), 'utf8');
var sweepLayout = fs.readFileSync(path.join(sharedDir, 'sweep-layout.css'), 'utf8');
var serverSrc = fs.readFileSync(path.join(sharedDir, '..', '..', '..', 'server.js'), 'utf8');

assert(responsive.indexOf('overflow-x: clip') !== -1, 'page clips horizontal overflow');
assert(shellLayout.indexOf('data-gfp-sb') !== -1, 'sidebar modes are data-driven');
assert(shellLayout.indexOf('gfp-sb-resizer') !== -1, 'sidebar resize handle exists');
assert(tableLayout.indexOf('overflow-x: auto') !== -1, 'tables scroll in container');
assert(formLayout.indexOf('@media (max-width: 767.98px)') !== -1, 'forms stack on phone');
assert(modalLayout.indexOf('max-height: min(90vh') !== -1, 'modals cap height');
assert(sweepLayout.indexOf('.toast') !== -1, 'sweep constrains notifications');
assert(serverSrc.indexOf('/shared/sweep-layout.css?v=2') !== -1, 'server injects sweep v2');
assert(serverSrc.indexOf('shell.js?v=footer2') !== -1, 'server injects shell qa cache bust');

console.log('responsive.selftest: OK');
