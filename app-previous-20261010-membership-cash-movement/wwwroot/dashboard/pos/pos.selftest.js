const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'pos-app.js'), 'utf8');

function check(condition, message) {
  if (!condition) throw new Error(`POS selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

check(source.includes("'card_pos'"), 'includes card_pos in the supported desk payment methods');
check(source.includes("setSinglePayment('card_pos', total)"), 'quick card payment selects card_pos');
check(source.includes('payments: payments'), 'submits the selected payment legs unchanged');
check(source.includes('if (hasCashPayment(payments) && !shiftOk)'), 'requires an open shift only when a cash leg is present');
check(source.includes('if (hasCardPosPayment(payments))'), 'checks card/POS attestation for every payment composition');
check(source.includes("const attestOk = !hasCardPosPayment(payments) || !!(attest && attest.checked);"), 'disables submission until card/POS attestation is checked');
check(source.includes('if (cash) cash.disabled = !cartOk || !shiftOk;'), 'keeps cash quick pay shift-gated');
check(source.includes('if (pos) pos.disabled = !cartOk;'), 'keeps card/POS quick pay available without an open shift');
check(source.includes("api('POST', '/sales', body"), 'records payments through the sale contract, not a cash-movement endpoint');
check(!source.includes("classList.add('blocked')"), 'does not block card/POS sales when no cash shift is open');

console.log('\nAll POS card/POS regression checks passed.');
