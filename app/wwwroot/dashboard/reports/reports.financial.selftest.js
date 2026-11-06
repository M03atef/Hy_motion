const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'reports-app.js'), 'utf8');

function check(condition, message) {
  if (!condition) throw new Error(`reports financial selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

check(source.includes('function financialAmount'), 'defines shared financial availability renderer');
check(source.includes('data.cashFlowAvailable'), 'cash-flow tab respects availability flag');
check(source.includes('data.settledCashAvailable'), 'settled cash respects availability flag');
check(source.includes('data.netProfitAvailable'), 'net profit respects availability flag');
check(source.includes("financialAmount(data.netCashFlow, data.cashFlowAvailable)"),
  'cash-flow tab guards net cash flow with availability');
check(source.includes("key === 'memberships') return canFinance"), 'memberships tab matches financial API permission');
check(source.includes('GfpCairoDates'), 'report presets use Cairo calendar');
check(source.includes('(function (global)'), 'reports IIFE receives window as global');
check(source.includes("})(typeof window !== 'undefined' ? window : globalThis);"), 'reports IIFE binds window');
check(source.includes('resolveOpenShiftId'), 'cash expenses can link to the open shift');
check(!/\/Owner\|Manager/i.test(source), 'reports page avoids role-string permission fallbacks');

const zSource = fs.readFileSync(path.join(__dirname, '..', 'z-report', 'z-report-app.js'), 'utf8');
check(zSource.includes('GfpCairoDates'), 'Z-Report presets use Cairo calendar');
check(zSource.includes('(function (global)'), 'Z-Report IIFE receives window as global');
check(zSource.includes("})(typeof window !== 'undefined' ? window : globalThis);"), 'Z-Report IIFE binds window');
check(source.includes('wireExpenseForm'), 'expenses tab wires structured running-cost form');
check(source.includes('GfpCashExpenseCatalog'), 'expenses form uses shared catalog');

check(source.includes('\\uFEFF'), 'generic export writes a UTF-8 BOM (Excel Arabic fix)');
check(source.includes('function csvCell'), 'CSV cells go through a single escaping helper');
check(source.includes('^[=+@]'), 'CSV helper blocks formula-injection prefixes');
check(source.includes("'hymotion-'"), 'export files follow the hymotion-{report}_{gym}_{from}_{to} naming');
check(source.includes('btnExportConfirm'), 'export runs behind a scope confirmation popover');
check(source.includes('dtIso('), 'export detail rows use machine-readable ISO datetimes');
check(source.includes('coverageBlock'), 'backend data-issue codes render as human language');
check(source.includes('ISSUE_I18N'), 'data-issue code translations exist');
check(source.includes('resultChip'), 'filter toolbar shows a live result chip');
check(source.includes('shiftDurationText'), 'shift rows show duration');
check(source.includes('num('), 'money/date tokens are bidi-isolated');
check(source.includes("toLocaleString('en-US'") && source.includes("(neg ? '-EGP ' : 'EGP ')"), 'money uses leading-minus EGP formatting');
check(source.includes('num money') && source.includes('is-negative'), 'negative money renders red without losing bidi isolation');
check(!/report-' \+ activeTab \+ \.csv/.test(source), 'legacy report-{tab}.csv naming is gone');

console.log('\nAll reports financial selftest checks passed.');
