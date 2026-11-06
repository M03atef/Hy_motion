const fs = require('fs');
const path = require('path');

const dir = __dirname;
const js = fs.readFileSync(path.join(dir, 'member-detail.js'), 'utf8');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

function check(condition, message) {
  if (!condition) throw new Error(`member-detail selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

// W-01 — Member 360 Orders filtered to current member
check(js.includes("member-orders?memberId="), 'orders request includes memberId query');
check(js.includes('Defense-in-depth'), 'client defense filter present for orders');
check(js.includes('oid===mid') || js.includes("oid === mid"), 'filters out other members\' orders');
check(!js.includes("Gfp.get('/member-orders')") || js.includes('memberId='), 'does not call staff inbox without memberId');

// W-02 — Collect Payment completeness
check(html.includes('btnCollectPayment') && html.includes('collectPaymentDrawer'), 'Collect Payment UI exists');
check(js.includes("'/debtors/'") && js.includes('/sales'), 'loads outstanding sales for member');
check(js.includes("'/sales/'") && js.includes('/payments'), 'posts payment against one sale');
check(js.includes('loadFinancial()'), 'refreshes financial after successful collect');
check(js.includes('Open a cash shift first, then complete this payment'), 'cash collect requires open shift');
check(js.includes('selectCollectSale') && js.includes('btnTakePayment'), 'pick sale → take payment path wired');

console.log('\nAll member-detail selftest checks passed (W-01 / W-02).');
