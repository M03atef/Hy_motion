const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'refund-action.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'refund-action.css'), 'utf8');

function check(condition, message) {
  if (!condition) throw new Error(`Refund UI selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

check(source.includes('function canExecuteDirectly()'), 'recognizes users who can request and approve');
check(source.includes("t('Refund now', 'استرد واعتمد الآن')"), 'shows one clear direct-refund action');
check(source.includes("'/refunds/' + encodeURIComponent(created.id) + '/approve'"), 'approves the saved refund immediately for authorized users');
check(source.includes("t('Note (optional)', 'ملاحظة (اختيارية)')"), 'does not force an unnecessary note');
check(source.includes("t('Available to refund now', 'المتاح للاسترداد الآن')"), 'keeps the refund summary concise');
check(!source.includes("esc(t('Reason', 'السبب')) +\n        '<textarea id=\"gfpRfReason\" rows=\"2\" required>"), 'removes the required reason field');
check(!source.includes('modeToggleHtml'), 'removes the money-only / no-stock-return mode from new refunds');
check(!source.includes('gfpRfAmount'), 'removes the unnecessary extra-money field');
check(source.includes('<option value="cash" selected>'), 'defaults the refund method to cash');
check(source.includes('amount: 0') && source.includes('lines: linesPayload'), 'sends only selected product-return lines for new refunds');
check(css.includes('box-sizing:border-box;width:100%'), 'keeps refund inputs inside their layout cells');
check(css.includes('grid-template-columns:minmax(0,1.45fr)'), 'uses non-overlapping product-return columns');

console.log('\nRefund UI regression checks passed.');
