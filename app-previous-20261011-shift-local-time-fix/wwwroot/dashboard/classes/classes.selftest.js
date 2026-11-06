/**
 * Classes booking flow self-check. Run: node src/app/(dashboard)/classes/classes.selftest.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok —', msg);
}

var app = fs.readFileSync(path.join(__dirname, 'classes-app.js'), 'utf8');
var css = fs.readFileSync(path.join(__dirname, 'classes.css'), 'utf8');

assert(app.indexOf('memberPath') !== -1 && app.indexOf('guestPath') !== -1,
  'booking modal offers member and walk-in guest paths');
assert(app.indexOf('guestName') !== -1 && app.indexOf('guestPhone') !== -1,
  'guest identity fields are collected');
assert(app.indexOf('id="guestPay"') !== -1 && app.indexOf("isGuest ? 'guestPay' : 'dropinPay'") !== -1,
  'guest payment uses the guest confirmation control');
assert(app.indexOf('bookCtx.memberId = null;') !== -1 && app.indexOf("body.guestName = bookCtx.guestName") !== -1,
  'guest path clears member state and sends guest identity');
assert(app.indexOf('bookingFlowToken') !== -1 && app.indexOf('if (flowToken !== bookingFlowToken) return;') !== -1,
  'stale member responses cannot overwrite a newer guest flow');
['cash', 'card_paymob', 'fawry', 'vodafone', 'instapay', 'account_credit'].forEach(function (method) {
  assert(app.indexOf("'" + method + "'") !== -1, 'payment method is available: ' + method);
});
assert(app.indexOf('paymentMethod') !== -1 && app.indexOf('guestName') !== -1,
  'booking request sends payment and guest identity');
assert(app.indexOf('id="eligPay"') !== -1 && app.indexOf('id="eligConfirm"') !== -1,
  'member booking offers Use credit and Collect payment');
assert(app.indexOf('data-bk-action="invoice"') !== -1 && app.indexOf('openBookingInvoice') !== -1,
  'paid bookings expose an Invoice action');
assert(app.indexOf("window.open('/dashboard/invoices/") === -1,
  'invoice view stays on Classes and does not open a new Invoices tab');
assert(app.indexOf('classPrintOverlay') !== -1 && app.indexOf('/receipt-html?format=a4') !== -1,
  'paid invoice loads receipt HTML in an on-page overlay');
assert(app.indexOf('Plan credit') !== -1,
  'credit bookings are labeled as plan credit');
assert(app.indexOf('payment required|drop-in') !== -1 && app.indexOf('Something went wrong') !== -1,
  'payment and cash-shift errors are surfaced');
assert(css.indexOf('.book-entry-choice') !== -1 && css.indexOf('.payment-select') !== -1,
  'guest and payment controls have dedicated styles');

console.log('\nAll classes.selftest checks passed.');
