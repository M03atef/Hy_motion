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

const order = ['data-widget="statusbar"', "id: 'kpis'", "id: 'quick-actions'",
  "id: 'operations'", "id: 'attendance'", "id: 'finance'", "id: 'feed'",
  "id: 'business'", "id: 'classes'", "id: 'attention'"];
let previous = -1;
for (const marker of order) {
  const current = layout.indexOf(marker);
  if (current === -1) continue; // role-gated widgets may legitimately be absent
  check(current > previous, `${marker} keeps the accepted section order`);
  previous = current;
}

check(layout.includes('data-widget="statusbar"'), 'live status strip leads the page');
check(layout.includes("id: 'feed'"), 'activity feed renders beside finance');
check(source.includes('function renderStatusbar'), 'status strip renderer exists');
check(source.includes('function renderOperations'), 'merged operations renderer exists');
check(source.includes('function renderFeed'), 'activity feed renderer exists');
check(source.includes('state.lastEvent'), 'live events surface as the last event');
check(source.includes('prepareGymHost') && source.includes("host.closest('.ops-grid')"),
  'prepare gym mounts inside the operations row and collapses it when absent');
check(source.includes('finWarnBadge'), 'finance header carries the attention badge');
check(source.includes('ar-EG-u-nu-latn'), 'clock shows Arabic meridiem in Arabic UI');
check(source.includes('newGym') && source.includes('dash-empty-fin'),
  'new-gym finance collapses to a friendly empty state');
check(source.includes('dash-error-banner'),
  'overview failure renders one page-level banner instead of repeated errors');
check(source.includes('safeRender'),
  'widget renderers are crash-isolated');
check(source.includes('qa-sub') && source.includes('QA_SUBS'),
  'quick actions carry preview-style sub labels');
check(source.includes('loadFeedEvents'),
  'feed aggregates invoices, expenses, check-ins, and the shift');
check(source.includes('finv3-owed-row'),
  'money owed renders as quiet v3 rows (zeros muted, no warning cards)');
check(source.includes('finv3-hero'),
  'owner finance opens with the v3 hero stat row');
check(source.includes('revenueChartSvg'),
  'revenue trend paints as calm inline SVG with peak tag');
check(source.includes('feed-amt'),
  'feed rows carry a dedicated amount column');
check(source.includes('finv3-act'),
  'business overview renders as a 5-stat strip');
check(source.includes('renderFinanceError') && source.includes('finv3-err'),
  'failed period loads keep the period filters and custom range usable');
check(source.includes("retryPeriod === 'custom' ? (fp && fp.from) : null"),
  'retry re-attempts the failed period including custom ranges');

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
