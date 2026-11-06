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
check(source.includes("['Net cash flow', financialAmount(data.netCashFlow, data.cashFlowAvailable)]"),
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

console.log('\nAll reports financial selftest checks passed.');
