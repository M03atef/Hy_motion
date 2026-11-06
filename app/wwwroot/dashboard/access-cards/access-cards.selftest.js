/**
 * Batch Cards workspace self-check. Run: node "src/app/(dashboard)/access-cards/access-cards.selftest.js"
 */
'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

var app = fs.readFileSync(path.join(__dirname, 'access-cards-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(__dirname, 'access-cards.css'), 'utf8');

/* workspace structure */
assert(html.indexOf('bc-kicker') !== -1 && html.indexOf('bc-title') !== -1,
  'centered hero with kicker + title');
assert(html.indexOf('id="kpiTotal"') !== -1 && html.indexOf('id="kpiAvailable"') !== -1 &&
  html.indexOf('id="kpiAssigned"') !== -1, 'KPI chips for total/available/assigned');
assert(html.indexOf('bc-seg-btn') !== -1 && html.indexOf('data-filter="Available"') !== -1 &&
  html.indexOf('data-filter="Assigned"') !== -1, 'segmented ALL/UNASSIGNED/ASSIGNED filters');
assert(html.indexOf('id="bcGrid"') !== -1 && html.indexOf('id="bcDetail"') !== -1,
  'grid + detail two-panel workspace');
assert(css.indexOf('.bc-work{display:grid') !== -1, 'two-panel grid layout styled');

/* card visual + flip */
assert(app.indexOf("cc-face cc-front") !== -1 && app.indexOf("cc-face cc-back") !== -1,
  'card visual renders front and back faces');
assert(app.indexOf("state.flip = !state.flip") !== -1 && css.indexOf('.cc.flipped{transform:rotateY(180deg)}') !== -1,
  'tap-to-flip toggles 3D rotation');
assert(app.indexOf('ccf-label-en">ACCESS CARD') !== -1 && app.indexOf('ccf-label-ar') !== -1,
  'front face has ACCESS CARD + كارنيه دخول label row (original option B)');
assert(app.indexOf('ccb-stripe') === -1 && app.indexOf('CARD NUMBER') === -1,
  'back face has no magnetic stripe / card-number strip');
assert(app.indexOf('Powered by <b>HyMotion</b>') !== -1, 'back keeps powered-by strip');
assert(app.indexOf('ccb-strip .pby') !== -1 || css.indexOf('.ccb-strip{') !== -1,
  'back powered-by strip styled');

/* branding + barcode */
assert(app.indexOf("'/settings/branding'") !== -1, 'gym identity fetched for card visual');
assert(app.indexOf('brandInk') !== -1 && app.indexOf('0.2126') !== -1,
  'auto-contrast ink from brand color luminance');
assert(app.indexOf('code128Svg') !== -1 && app.indexOf("'2331112'") !== -1 && app.indexOf('C128[c]') !== -1,
  'client Code128-B renderer for thumbnails and card visual');

/* real API integration */
assert(app.indexOf("'/access-cards/batches'") !== -1, 'batch chips load from /access-cards/batches');
assert(app.indexOf("'&batchId='") !== -1, 'card list filters by selected batch');
assert(app.indexOf("'/access-cards/inventory'") !== -1, 'KPIs from inventory endpoint');
assert(app.indexOf("'/access-cards/' + encodeURIComponent(id)") !== -1,
  'detail refreshes card from server on select');
assert(app.indexOf("'/unassign'") !== -1 && app.indexOf("useCan('members.edit')") !== -1,
  'unassign action gated by members.edit permission');
assert(app.indexOf("window.confirm(") !== -1, 'unassign asks for confirmation');
assert(app.indexOf("'ngrok-skip-browser-warning'") !== -1, 'print preview keeps auth fetch headers');

/* legacy flows preserved */
assert(html.indexOf('id="bulkModal"') !== -1 && app.indexOf("'/access-cards/bulk'") !== -1,
  'add-batch modal flow preserved');
assert(html.indexOf('id="printModal"') !== -1 && app.indexOf("'/access-cards/print-html'") !== -1,
  'print preview modal flow preserved');
assert(html.indexOf('id="btnMore"') !== -1 && app.indexOf('state.page += 1') !== -1,
  'grid paging via load-more');
assert(app.indexOf("useCan('members.view')") !== -1 && html.indexOf('id="searchQ"') !== -1,
  'permission guard + search input present');

console.log('\nAll Batch Cards self-checks passed.');
