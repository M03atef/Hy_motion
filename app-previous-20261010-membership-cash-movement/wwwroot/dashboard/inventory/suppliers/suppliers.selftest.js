const fs = require('fs');
const path = require('path');

const here = __dirname;
const source = fs.readFileSync(path.join(here, 'suppliers-app.js'), 'utf8');
const css = fs.readFileSync(path.join(here, 'suppliers.css'), 'utf8');

function check(condition, message) {
  if (!condition) throw new Error(`Suppliers UI selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

check(source.includes("esc(t('We owe suppliers', 'إجمالي علينا للموردين'))"), 'labels the KPI as money owed by the gym');
check(source.includes('Math.max(0, s.dueTotal'), 'does not subtract supplier credit from supplier payables');
check(source.includes("t('we owe them', 'علينا للمورد')"), 'labels positive supplier balances as payable by the gym');
check(source.includes("t('they owe us', 'لنا عند المورد')"), 'labels negative supplier balances as credit for the gym');
check(source.includes('esc(money(Math.abs(due)))'), 'shows an unsigned amount beside the explicit direction label');
check(source.includes("t('Record collection', 'تسجيل تحصيل')"), 'offers a collection action only when the supplier owes the gym');
check(source.includes('paths.supplierCollections(paySupplierId)'), 'posts collections to their dedicated endpoint');
check(source.includes("Math.abs(due).toFixed(2)"), 'prefills a collection with the exact outstanding credit');
check(css.includes('input[type=tel]'), 'styles the phone field consistently with the form');
check(css.includes('.act-menu.open-up'), 'keeps bottom-row action menus visible');

console.log('\nSupplier UI regression checks passed.');
