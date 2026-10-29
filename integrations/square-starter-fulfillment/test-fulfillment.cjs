'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const props = new Map(Object.entries({
  SQUARE_ACCESS_TOKEN: 'test-token',
  SQUARE_LOCATION_ID: 'L1',
  STARTER_CATALOG_OBJECT_ID: 'VAR1',
  FULFILL_SINCE_ISO: '2026-10-29T00:00:00Z',
  STARTER_GUIDE_URL: 'https://docs.google.com/document/d/test-guide/edit',
  STARTER_PROMPT_URL: 'https://docs.google.com/document/d/test-prompt/edit',
  STARTER_SHEET_URL: 'https://docs.google.com/spreadsheets/d/test-sheet/edit',
  SEND_ENABLED: 'true'
}));
const sent = [];
let failNextSend = false;
let failPaymentPropertyOnce = false;
let failOrderPropertyOnce = false;
const payment = (id) => ({
  id, status: 'COMPLETED', location_id: 'L1', order_id: 'O1',
  amount_money: {amount: 9800, currency: 'JPY'},
  buyer_email_address: 'buyer@example.com',
  created_at: '2026-10-30T00:00:00Z'
});
const order = {
  id: 'O1', location_id: 'L1',
  total_money: {amount: 9800, currency: 'JPY'},
  line_items: [{catalog_object_id: 'VAR1', quantity: '1'}]
};
const ctx = vm.createContext({
  console,
  __payments: [payment('P1'), payment('P2')],
  __order: order,
  Session: {getEffectiveUser: () => ({getEmail: () => 'minpaku.ai.kit@gmail.com'})},
  LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock: () => {}})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: (key) => props.get(key) || null,
    setProperties: (entries) => Object.entries(entries).forEach(([key, val]) => props.set(key, val)),
    setProperty: (key, val) => {
      if (failOrderPropertyOnce && key.startsWith('TEST_ORDER:')) {
        failOrderPropertyOnce = false;
        throw Error('simulated order-key write failure');
      }
      if (failPaymentPropertyOnce && key.startsWith('TEST_P')) {
        failPaymentPropertyOnce = false;
        throw Error('simulated payment-key write failure');
      }
      props.set(key, val);
    }
  })},
  GmailApp: {sendEmail: (to, subject, body) => {if (failNextSend) throw Error('simulated Gmail failure'); sent.push({to, subject, body});}},
  UrlFetchApp: {fetch: () => {throw Error('External Square request attempted in test');}}
});
vm.runInContext(code, ctx, {filename: 'Code.gs'});
vm.runInContext('testStarterFulfillmentRules()', ctx);
vm.runInContext(`
  goKey_ = function(id) {return 'TEST_' + id;};
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments: __payments};
    if (url.startsWith('orders/')) return {order: __order};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const run = () => vm.runInContext('runStarterFulfillment()', ctx);
run();
assert.equal(sent.length, 1, 'same Square order must be delivered only once');
assert.equal(sent[0].to, 'buyer@example.com');
assert.match(props.get('TEST_P1'), /^SENT /);
assert.match(props.get('TEST_ORDER:O1'), /^SENT /);
assert.equal(props.has('TEST_P2'), false, 'second payment should be skipped');
run();
assert.equal(sent.length, 1, 'repeat run must not resend');
props.delete('TEST_P1');
props.set('TEST_ORDER:O1', 'PENDING 2026-10-30T00:00:00Z');
run();
assert.equal(sent.length, 1, 'unresolved order PENDING must not resend');
props.delete('TEST_ORDER:O1');
props.set('SEND_ENABLED', 'false');
run();
assert.equal(sent.length, 1, 'dry run must never send');
assert.equal(props.has('TEST_P1'), false, 'dry run must not create a PENDING record');
// A Gmail API exception must preserve both PENDING keys and block automatic retries.
ctx.__payments = [{...payment('P3'), order_id: 'O2'}];
ctx.__order = {...order, id: 'O2'};
props.set('SEND_ENABLED', 'true');
failNextSend = true;
assert.throws(run, /simulated Gmail failure/);
assert.match(props.get('TEST_P3'), /^PENDING /);
assert.match(props.get('TEST_ORDER:O2'), /^PENDING /);
failNextSend = false;
run();
assert.equal(sent.length, 1, 'Gmail failure must not trigger automatic resend');
// A partial Script Properties write must never allow Gmail send or duplicate delivery.
ctx.__payments = [{...payment('P6'), order_id: 'O4'}];
ctx.__order = {...order, id: 'O4'};
failPaymentPropertyOnce = true;
const beforePartialWrite = sent.length;
assert.throws(run, /simulated payment-key write failure/);
assert.match(props.get('TEST_ORDER:O4'), /^PENDING /, 'order guard written first');
assert.equal(props.has('TEST_P6'), false, 'payment guard write was interrupted');
assert.equal(sent.length, beforePartialWrite, 'no mail after interrupted guard write');
run();
assert.equal(sent.length, beforePartialWrite, 'order PENDING prevents retry after partial write');
// If the first (order) guard write fails, delivery must not start.
ctx.__payments = [{...payment('P7'), order_id: 'O5'}];
ctx.__order = {...order, id: 'O5'};
failOrderPropertyOnce = true;
const beforeFirstWriteFailure = sent.length;
assert.throws(run, /simulated order-key write failure/);
assert.equal(props.has('TEST_ORDER:O5'), false);
assert.equal(props.has('TEST_P7'), false);
assert.equal(sent.length, beforeFirstWriteFailure, 'no email if order guard write fails');
// Read-only audit must not send, even when live sending is enabled.
ctx.__payments = [{...payment('P4'), order_id: 'O3'}, {...payment('P5'), order_id: 'O3'}];
ctx.__order = {...order, id: 'O3'};
props.set('SEND_ENABLED', 'true');
const sentBeforeAudit = sent.length;
const propsBeforeAudit = new Map(props);
let audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.scannedPayments, 2);
assert.equal(audit.eligiblePayments, 2);
assert.equal(audit.uniqueEligibleOrders, 1, 'audit deduplicates orders');
assert.equal(audit.readyToDeliver, 1);
assert.equal(sent.length, sentBeforeAudit, 'audit must never send Gmail');
assert.deepEqual(props, propsBeforeAudit, 'audit must not write Script Properties');
props.set('TEST_ORDER:O3', 'PENDING 2026-10-30T00:00:00Z');
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.pendingReview, 1, 'pending order flagged for review');
assert.equal(audit.readyToDeliver, 0);
props.set('TEST_ORDER:O3', 'SENT 2026-10-30T00:00:00Z');
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.recordedSent, 1, 'sent order not counted as ready');
assert.equal(audit.readyToDeliver, 0);
props.delete('TEST_ORDER:O3');
ctx.__order = {...order, id: 'O3', state: 'CANCELED'};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'canceled order excluded');
assert.equal(audit.readyToDeliver, 0);
assert.equal(sent.length, sentBeforeAudit, 'audit remains send-free');
console.log('PASS: 18 eligibility checks + idempotency, retries, dry-run, Gmail failure, first/second guard write failures, read-only audit');

