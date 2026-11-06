const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'dashboard-home.js'), 'utf8');
const layoutStart = source.indexOf('function buildLayout');
const layoutEnd = source.indexOf('function wireRetries', layoutStart);
const layout = source.slice(layoutStart, layoutEnd);

function check(condition, message) {
  if (!condition) throw new Error(`dashboard-home selftest failed: ${message}`);
  console.log(`ok — ${message}`);
}

check(source.includes('/dashboard/overview?period='), 'uses the role-filtered dashboard contract');
check(source.includes("can('classes.view')"), 'supports Trainer class permission');
check(source.includes("can('attendance.view')"), 'supports Trainer attendance permission');
check(source.includes('financial.dashboard'), 'renders canonical financial fields');
check(source.includes('cashFlowAvailable'), 'finance panel respects cash-flow availability');
check(source.includes('settledCashAvailable'), 'finance panel respects settled-cash availability');
check(source.includes('netProfitAvailable'), 'finance panel respects net-profit availability');
check(source.includes('revenueBreakdownHint'), 'revenue card shows memberships/products breakdown hints');
check(source.includes('Accrual revenue'), 'revenue today is labeled as accrual revenue');
check(!source.includes('demoToggle') && !source.includes('role-switch'), 'ships no preview controls');
check(!source.includes('18,450') && !source.includes('286,400'), 'contains no preview KPI values');
check(source.includes('Cost to run'), 'owner hero shows cost to run');
check(source.includes('Unpaid supplier stock'), 'owner labels unpaid supplier stock');
check(source.includes('profitabilityBridgeHtml'), 'owner shows profitability bridge');
check(source.includes('ownerPeriodDisplayLabel'), 'owner period uses so-far label');
check(source.includes('dash-exec-glossary'), 'owner shows financial glossary');
check(source.includes('Financial glossary'), 'glossary uses financial-v1 language');
check(source.includes('Net profit gate'), 'glossary covers net profit gate');
check(source.includes('Payroll warning'), 'glossary covers payroll warning');
check(source.includes('mountPrepareGym'), 'dashboard hosts Prepare Your Gym on Local');
check(source.includes('prepareGymHost'), 'prepare gym mounts into prepareGymHost');

const order = ['id: \'finance\'', 'id: \'kpis\'', 'id: \'quick-actions\'',
  'id: \'business\'', 'id: \'occupancy\'', 'id: \'classes\'', 'id: \'attention\''];
let previous = -1;
for (const marker of order) {
  const current = layout.indexOf(marker);
  check(current > previous, `${marker} keeps the accepted section order`);
  previous = current;
}

check(source.includes('maintainAspectRatio: false'), 'charts fill their container height');
check(source.includes('watchChartHost'), 'charts observe host size');
check(source.includes('resizeDelay: 0'), 'charts resize without delay');

const dashCss = fs.readFileSync(
  path.join(__dirname, '..', 'shared', 'dashboard-layout.css'),
  'utf8'
);
check(dashCss.indexOf('minmax(min(100%, 140px)') !== -1, 'KPI tracks cannot overflow the card');
check(dashCss.indexOf('@media (max-width: 767.98px)') !== -1, 'dashboard stacks on phone');
check(dashCss.indexOf('grid-column: span 6') !== -1, 'tablet keeps two-up widgets');
check(dashCss.indexOf('.dash-chart-wrap canvas') !== -1, 'chart canvas follows the wrap');

console.log('\nAll dashboard-home selftest checks passed.');
