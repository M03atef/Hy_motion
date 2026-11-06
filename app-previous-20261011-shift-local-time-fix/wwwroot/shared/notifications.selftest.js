/**
 * HyMotion — notifications selftest (Phase 2).
 * Run: node src/app/shared/notifications.selftest.js   (from apps/web)
 *
 * Verifies the Phase 2 presentation contract without a browser:
 *   - severity view mapping (class + icon + EN/AR labels; unknown/null → Info)
 *   - localized category labels (never raw enums)
 *   - badge = needsAttention (Info never badges, resolved handled server-side)
 *   - live refresh wiring + visibility-filtered fetch params
 *   - RTL-safe logical CSS properties
 *   - filter chips: Needs attention default, Resolved present
 * Non-destructive: reads source files only; no notifications are created or sent.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const SHARED = path.join(__dirname);
const PAGE = path.join(__dirname, '..', '(dashboard)', 'notifications');
const APP = path.join(__dirname, '..', '..', '..', 'GMS.Api', 'Hosting', 'WebDashboardHtmlInjector.cs');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

// ── 1. Load notification-view.js in a sandbox and exercise the pure mappings ──
const viewSource = read(path.join(SHARED, 'notification-view.js'));
const sandbox = { window: {}, globalThis: {} };
vm.createContext(sandbox);
vm.runInContext(viewSource + '\nthis.__view = window.GfpNotificationView || globalThis.GfpNotificationView;', sandbox);
const view = sandbox.__view;
assert(view, 'notification-view.js must expose GfpNotificationView');

// Severity mapping: stored priority → class + icon + EN/AR labels.
assert(view.severityView('Critical').cls === 'sev-critical', 'Critical must render sev-critical');
assert(view.severityView('Critical').ar === 'حرج', 'Critical must have an Arabic label');
assert(view.severityView('ActionRequired').cls === 'sev-action', 'ActionRequired must render sev-action');
assert(view.severityView('ActionRequired').en === 'Action required', 'ActionRequired EN label');
assert(view.severityView('ActionRequired').ar === 'يتطلب إجراء', 'ActionRequired AR label');
assert(view.severityView('Info').cls === 'sev-info', 'Info must render sev-info');
assert(view.severityView('Info').en === 'Info', 'Info EN label');
assert(view.severityView('Info').ar === 'معلومة', 'Info AR label');
// Unknown/null priorities degrade to Info presentation (never raw enum output).
assert(view.severityView(null).cls === 'sev-info', 'null priority degrades to Info');
assert(view.severityView('SomeFuturePriority').en === 'Info', 'unknown priority degrades to Info');

// Category labels: localized, no raw enum return.
assert(view.categoryView('Payments').ar === 'المدفوعات', 'Payments AR label');
assert(view.categoryView('Shifts').en === 'Shifts', 'Shifts EN label');
assert(view.categoryView(null) === null, 'null category → null (caller renders nothing)');
assert(view.categoryView('SomeFutureCategory') === null, 'unknown category → null (never raw enum)');

// Badge selector: needsAttention preferred; count fallback; safe defaults.
assert(view.pickBadgeCount({ count: 9, needsAttention: 2 }) === 2, 'badge must use needsAttention');
assert(view.pickBadgeCount({ count: 9 }) === 9, 'pre-Phase-2 payload fallback = count');
assert(view.pickBadgeCount({}) === 0, 'empty payload → 0');
assert(view.pickBadgeCount(null) === 0, 'null payload → 0');

// ── 2. Badge wiring: staff-notifications.js uses needsAttention + accessible label ──
const badgeSource = read(path.join(SHARED, 'staff-notifications.js'));
assert(badgeSource.includes('GfpNotificationView.pickBadgeCount'), 'badge must select needsAttention via the view helper');
assert(badgeSource.includes('needsAttention'), 'badge contract must reference needsAttention');
assert(badgeSource.includes("aria-label"), 'badge must carry an accessible label');
assert(!badgeSource.includes('unreadOnly'), 'badge must not depend on the unread-only legacy flag');

// ── 3. Inbox: severity rendering, no raw enum, filters, live refresh ──
const appSource = read(path.join(PAGE, 'notifications-app.js'));
assert(appSource.includes('GfpNotificationView.severityView'), 'inbox rows must render severity via the view helper');
assert(appSource.includes('sevLabel'), 'inbox rows must render the localized severity label');
assert(appSource.includes('catLabel'), 'inbox rows must render the localized category label');
assert(!/inbox-prio">' \+ esc\(priority\)/.test(appSource), 'raw priority enum must not be rendered');
assert(!/inbox-cat">' \+ esc\(category\)/.test(appSource), 'raw category enum must not be rendered');
assert(appSource.includes("attentionOnly="), 'inbox must fetch attention-filtered rows');
assert(appSource.includes("resolvedOnly="), 'inbox must fetch resolved-filtered rows');
assert(appSource.includes("currentFilter === 'unread'"), 'inbox must support the Unread chip');
assert(appSource.includes("'gfp:staff-notifications-count'"), 'inbox must subscribe to the live count event');
assert(/gfp:staff-notifications-count'[\s\S]*?loadInbox\(\)/.test(appSource), 'count event must reload the open inbox');
const loadInboxSource = appSource.slice(appSource.indexOf('async function loadInbox()'), appSource.indexOf('async function markRead'));
assert(!loadInboxSource.includes('GfpStaffNotifications.refresh()'), 'loading the inbox must not trigger another sidebar refresh');
assert(appSource.includes('inboxReloadTimer'), 'live count updates must be coalesced');
assert(appSource.includes("currentFilter = this.getAttribute('data-filter')"), 'chips must drive the filter state');
assert(appSource.includes("Nothing needs your attention"), 'attention empty state present (Owner clarity)');

// ── 4. RTL-safe CSS: severity edges use logical properties ──
const css = read(path.join(PAGE, 'notifications.css'));
assert(css.includes('.inbox-item.sev-critical'), 'critical severity CSS present');
assert(css.includes('.inbox-item.sev-action'), 'action severity CSS present');
assert(css.includes('.inbox-item.sev-info'), 'info severity CSS present');
assert(css.includes('border-inline-start'), 'severity edges must use RTL-safe border-inline-start');
assert(!/border-left:\s*3px solid #dc2626/.test(css), 'must not hard-code left-side severity edges');
assert(css.includes('filter-chip.act'), 'active filter chip emphasis present');

// ── 5. Page markup: chips in the approved order, Needs-attention pill ──
const html = read(path.join(PAGE, 'index.html'));
const attentionIdx = html.indexOf('data-filter="attention"');
const allIdx = html.indexOf('data-filter="all"');
const unreadIdx = html.indexOf('data-filter="unread"');
const resolvedIdx = html.indexOf('data-filter="resolved"');
assert(attentionIdx > -1 && allIdx > -1 && unreadIdx > -1 && resolvedIdx > -1, 'all four filter chips present');
assert(attentionIdx < allIdx && allIdx < unreadIdx && unreadIdx < resolvedIdx, 'chips in approved order: attention, all, unread, resolved');
assert(html.includes('notif.severity.critical') || html.indexOf('Needs attention') > -1, 'attention wording present');
assert(!html.includes('<div class="toast" id="toast">'), 'legacy dead toast markup removed');
assert(html.includes('notification-view.js'), 'notification-view.js must be loaded by the page');

// ── 6. Injector: helper loaded before the badge script (all desk pages) ──
const injectorPath = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'GMS.Api', 'Hosting', 'WebDashboardHtmlInjector.cs');
assert(fs.existsSync(injectorPath), 'injector file must exist for the load-order check');
if (fs.existsSync(injectorPath)) {
  const injector = read(injectorPath);
  const viewIdx = injector.indexOf('/shared/notification-view.js');
  const badgeIdx = injector.indexOf('/shared/staff-notifications.js');
  assert(viewIdx > -1 && badgeIdx > -1, 'injector must register notification-view.js and staff-notifications.js');
  assert(viewIdx < badgeIdx, 'notification-view.js must load before staff-notifications.js');
}

console.log('notifications.selftest.js: all assertions passed');
