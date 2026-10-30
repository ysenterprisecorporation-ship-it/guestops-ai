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
let failNextMessageId = false;
let failPaymentPropertyOnce = false;
let failOrderPropertyOnce = false;
let pauseOnPaymentGuardOnce = false;
const payment = (id) => ({
  id, status: 'COMPLETED', location_id: 'L1', order_id: 'O1',
  amount_money: {amount: 9800, currency: 'JPY'},
  buyer_email_address: 'buyer@example.com',
  created_at: '2026-10-30T00:00:00Z'
});
const order = {
  id: 'O1', state: 'COMPLETED', location_id: 'L1',
  total_money: {amount: 9800, currency: 'JPY'},
  line_items: [{catalog_object_id: 'VAR1', quantity: '1'}]
};
const ctx = vm.createContext({
  console,
  __payments: [payment('P1'), payment('P2')],
  __order: order,
  __refreshedPaymentOverride: null,
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
      // Simulate an emergency pause racing with the payment PENDING write.
      if (pauseOnPaymentGuardOnce && key === 'TEST_PPAUSE') {
        pauseOnPaymentGuardOnce = false;
        props.set('SEND_ENABLED', 'false');
      }
    }
  })},
  GmailApp: {createDraft: (to, subject, body) => ({send: () => {
    if (failNextSend) throw Error('simulated Gmail failure');
    sent.push({to, subject, body});
    const id = failNextMessageId ? '' : 'mock-gmail-message-' + sent.length;
    failNextMessageId = false;
    return {getId: () => id};
  }})},
  UrlFetchApp: {fetch: () => {throw Error('External Square request attempted in test');}}
});
vm.runInContext(code, ctx, {filename: 'Code.gs'});
vm.runInContext('testStarterFulfillmentRules()', ctx);
vm.runInContext(`
  goKey_ = function(id) {return 'TEST_' + id;};
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments: __payments};
    if (url.startsWith('payments/')) {
      return {payment: __refreshedPaymentOverride ||
        __payments.find(p => p.id === decodeURIComponent(url.slice('payments/'.length)))};
    }
    if (url.startsWith('orders/')) return {order: __order};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const run = () => vm.runInContext('runStarterFulfillment()', ctx);
// The separate Deployment.gs is loaded in the same GAS project in production.
// Mock its read-only buyer-material audit for the fulfillment harness.
ctx.auditStarterMaterialAccess = () => ({ready: true});
// A permission change or Drive outage must stop before any PENDING guard/Gmail.
ctx.__payments = [{...payment('P_MATERIAL'), order_id: 'O_MATERIAL'}];
ctx.__order = {...order, id: 'O_MATERIAL'};
ctx.auditStarterMaterialAccess = () => ({ready: false});
assert.throws(run, /Buyer material access failed/);
assert.equal(sent.length, 0, 'private material must block Gmail');
assert.equal(props.has('TEST_ORDER:O_MATERIAL'), false, 'private material must not reserve order');
assert.equal(props.has('TEST_P_MATERIAL'), false, 'private material must not reserve payment');
ctx.auditStarterMaterialAccess = () => {throw Error('Drive unavailable');};
assert.throws(run, /Drive unavailable/);
assert.equal(sent.length, 0, 'Drive outage must block Gmail');
assert.equal(props.has('TEST_ORDER:O_MATERIAL'), false, 'Drive outage must not reserve order');
ctx.auditStarterMaterialAccess = () => ({ready: true});
ctx.__payments = [payment('P1'), payment('P2')];
ctx.__order = order;
// Malformed Square buyer emails must never reach Gmail's recipient parser.
// These previously passed the permissive @/dot regex, despite including
// delimiters or malformed mailbox syntax.
for (const [index, buyerEmail] of [
  'buyer@example.com,attacker',
  'buyer@example.com;attacker',
  'buyer@example.com>',
  'buyer..double@example.com',
  'buyer@example..com'
].entries()) {
  const id = 'P_BAD_' + index;
  const orderId = 'O_BAD_' + index;
  ctx.__payments = [{...payment(id), order_id: orderId, buyer_email_address: buyerEmail}];
  ctx.__order = {...order, id: orderId};
  const before = sent.length;
  run();
  assert.equal(sent.length, before, 'malformed buyer email must never send');
  assert.equal(props.has('TEST_' + id), false, 'malformed email must not reserve payment');
  assert.equal(props.has('TEST_ORDER:' + orderId), false, 'malformed email must not reserve order');
}
ctx.__payments = [payment('P1'), payment('P2')];
ctx.__order = order;
run();
assert.equal(sent.length, 1, 'same Square order must be delivered only once');
assert.equal(sent[0].to, 'buyer@example.com');
assert.match(props.get('TEST_P1'), /^SENT .* MSG:mock-gmail-message-1$/);
assert.match(props.get('TEST_ORDER:O1'), /^SENT .* MSG:mock-gmail-message-1$/);
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
// Gmail may have sent successfully while the message ID is unavailable.
// Keep PENDING and block automatic retry instead of recording an unverified SENT.
ctx.__payments = [{...payment('P8'), order_id: 'O6'}];
ctx.__order = {...order, id: 'O6'};
failNextMessageId = true;
const beforeMissingId = sent.length;
assert.throws(run, /Gmail sent without a usable message ID/);
assert.equal(sent.length, beforeMissingId + 1, 'mock Gmail sent before ID failure');
assert.match(props.get('TEST_ORDER:O6'), /^PENDING /);
assert.match(props.get('TEST_P8'), /^PENDING /);
run();
assert.equal(sent.length, beforeMissingId + 1, 'missing ID must not trigger a second email');
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
// Square OPEN orders can still be modified. Neither audit nor delivery may
// treat an OPEN or state-less order as a completed sale.
ctx.__order = {...order, id: 'O3', state: 'OPEN'};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'open order excluded by audit');
assert.equal(audit.readyToDeliver, 0);
run();
assert.equal(sent.length, sentBeforeAudit, 'open order must never receive materials');
assert.equal(props.has('TEST_ORDER:O3'), false, 'open order must not create delivery guard');
ctx.__order = {...order, id: 'O3', state: undefined};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'missing order state excluded by audit');
run();
assert.equal(sent.length, sentBeforeAudit, 'missing state must not send');
assert.equal(props.has('TEST_ORDER:O3'), false, 'missing state must not create guard');
// A completed payment may coexist with a refunded/returned Square order.
// Do not issue materials based solely on the payment's earlier status.
ctx.__order = {...order, id: 'O3', refunds: [{id: 'REF1'}]};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'refunded order excluded from audit');
assert.equal(audit.readyToDeliver, 0);
run();
assert.equal(sent.length, sentBeforeAudit, 'refunded order must not send');
assert.equal(props.has('TEST_ORDER:O3'), false, 'refunded order must not create guard');
ctx.__order = {...order, id: 'O3', returns: [{id: 'RETURN1'}]};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'returned order excluded from audit');
run();
assert.equal(sent.length, sentBeforeAudit, 'returned order must not send');
assert.equal(props.has('TEST_ORDER:O3'), false, 'returned order must not create guard');
ctx.__order = {...order, id: 'O3', refunds: {unexpected: true}};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.invalidOrders, 1, 'malformed order refund field excluded');
run();
assert.equal(sent.length, sentBeforeAudit, 'malformed refund field must not send');

// Privacy-safe audit counts explain why a payment was rejected, without PII.
ctx.__payments = [
  {...payment('PR1'), order_id: 'O7', status: 'APPROVED'},
  {...payment('PR2'), order_id: 'O7', buyer_email_address: ''},
  {...payment('PR3'), order_id: 'O7', refund_ids: ['REF1']},
  {...payment('PR4'), order_id: 'O7', location_id: 'OTHER'},
  {...payment('PR5'), order_id: 'O7'}
];
ctx.__order = {...order, id: 'O7'};
audit = vm.runInContext('auditStarterFulfillment()', ctx);
assert.equal(audit.scannedPayments, 5);
assert.equal(audit.eligiblePayments, 1);
assert.equal(audit.rejectedPayments, 4);
assert.equal(audit.refundedPayments, 1);
assert.equal(audit.missingBuyerEmail, 1);
assert.equal(audit.unsettledPayments, 1);
assert.equal(audit.otherRejectedPayments, 1);
assert.equal(audit.readyToDeliver, 1);
assert.equal(sent.length, sentBeforeAudit, 'audit breakdown must never send Gmail');

// An HTTP 200 response with a malformed page is not proof of zero payments.
assert.throws(() => vm.runInContext('goValidatePaymentPage_({payments:{bad:true}})', ctx), /Unexpected Square payment list response/);
assert.throws(() => vm.runInContext('goValidatePaymentPage_({cursor:123})', ctx), /Unexpected Square payment list response/);
assert.throws(() => vm.runInContext('goValidatePaymentPage_({errors:[{code:"FAULT"}]})', ctx), /Unexpected Square payment list response/);
assert.equal(vm.runInContext('goValidatePaymentPage_({}).payments === undefined', ctx), true,
  'empty response may omit payments field');
vm.runInContext(`
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments:{unexpected:true}};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const beforeMalformedPage = sent.length;
const propsBeforeMalformedPage = new Map(props);
assert.throws(run, /Unexpected Square payment list response/);
assert.throws(() => vm.runInContext('auditStarterFulfillment()', ctx),
  /Unexpected Square payment list response/);
assert.equal(sent.length, beforeMalformedPage, 'malformed Square page must not send');
assert.deepEqual(props, propsBeforeMalformedPage, 'malformed Square page must not write state');
// Fail closed when Square returns a JSON array or a malformed errors field.
assert.throws(() => vm.runInContext('goValidatePaymentPage_([])', ctx),
  /Unexpected Square payment list response/);
assert.throws(() => vm.runInContext('goValidatePaymentPage_({errors:{code:"FAULT"}})', ctx),
  /Unexpected Square payment list response/);
assert.throws(() => vm.runInContext('goValidatePaymentPage_({payments:null})', ctx),
  /Unexpected Square payment list response/);
assert.equal(vm.runInContext('goValidatePaymentPage_({payments:[],errors:[]}).payments.length', ctx), 0);

// A repeated cursor must not spin or silently process the same page forever.
vm.runInContext(`
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments:[],cursor:'repeat-cursor'};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const beforeRepeatedCursor = sent.length;
const propsBeforeRepeatedCursor = new Map(props);
assert.throws(run, /Repeated Square pagination cursor/);
assert.throws(() => vm.runInContext('auditStarterFulfillment()', ctx),
  /Repeated Square pagination cursor/);
assert.equal(sent.length, beforeRepeatedCursor, 'repeated cursor must not send');
assert.deepEqual(props, propsBeforeRepeatedCursor, 'repeated cursor must not write state');
console.log('PASS: 23 eligibility checks + idempotency, retries, dry-run, Gmail failure, missing message ID, guard write failures, read-only audit, rejection breakdown, malformed Square responses, repeated cursor safety');


// Payment listing can become stale before Gmail delivery. A fresh refund,
// changed recipient or missing payment must stop without guards or email.
ctx.__payments = [{...payment('PRACE'), order_id:'ORACE'}];
ctx.__order = {...order, id:'ORACE'};
vm.runInContext(`
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments: __payments};
    if (url.startsWith('payments/')) return {payment: __refreshedPaymentOverride};
    if (url.startsWith('orders/')) return {order: __order};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const beforeRace = sent.length;
ctx.__refreshedPaymentOverride = {...payment('PRACE'), order_id:'ORACE', refund_ids:['REFUND']};
assert.throws(run, /Payment changed during fulfillment/);
assert.equal(sent.length, beforeRace, 'refunded payment must not send');
assert.equal(props.has('TEST_ORDER:ORACE'), false, 'refunded payment must not reserve order');
ctx.__refreshedPaymentOverride = {...payment('PRACE'), order_id:'ORACE',
  buyer_email_address:'changed@example.com'};
assert.throws(run, /Payment changed during fulfillment/);
assert.equal(sent.length, beforeRace, 'changed recipient must not send');
assert.equal(props.has('TEST_ORDER:ORACE'), false);
ctx.__refreshedPaymentOverride = null;
assert.throws(run, /Payment changed during fulfillment/);
assert.equal(sent.length, beforeRace, 'missing payment detail must not send');
assert.equal(props.has('TEST_ORDER:ORACE'), false);
ctx.__refreshedPaymentOverride = {...payment('PRACE'), order_id:'ORACE'};
run();
assert.equal(sent.length, beforeRace + 1, 'unchanged rechecked payment is delivered once');
run();
assert.equal(sent.length, beforeRace + 1, 'rechecked payment is not resent');
console.log('PASS: payment re-read prevents refund race, changed buyer and missing payment detail');

// Order re-read race regression: a payment can remain COMPLETED even when
// the order is refunded or canceled between its first read and Gmail send.
ctx.__orderReads = 0;
ctx.__firstOrder = null;
ctx.__secondOrder = null;
vm.runInContext(`
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments: __payments};
    if (url.startsWith('payments/')) return {payment: __payments[0]};
    if (url.startsWith('orders/')) {
      __orderReads++;
      return {order: __orderReads === 1 ? __firstOrder : __secondOrder};
    }
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
function setOrderRace(paymentId, orderId, latestChanges) {
  ctx.__payments = [{...payment(paymentId), order_id: orderId}];
  ctx.__firstOrder = {...order, id: orderId};
  ctx.__secondOrder = {...ctx.__firstOrder, ...latestChanges};
  ctx.__orderReads = 0;
}
const beforeOrderRace = sent.length;
setOrderRace('PORDERREFUND', 'OORDERREFUND', {refunds: [{id:'REFUND_AFTER_FIRST_READ'}]});
assert.throws(run, /Order changed during fulfillment/);
assert.equal(ctx.__orderReads, 2, 'both order reads must occur before send');
assert.equal(sent.length, beforeOrderRace, 'late refund must block Gmail');
assert.equal(props.has('TEST_ORDER:OORDERREFUND'), false, 'late refund must not reserve order');
assert.equal(props.has('TEST_PORDERREFUND'), false, 'late refund must not reserve payment');

setOrderRace('PORDERCANCEL', 'OORDERCANCEL', {state:'CANCELED'});
assert.throws(run, /Order changed during fulfillment/);
assert.equal(ctx.__orderReads, 2);
assert.equal(sent.length, beforeOrderRace, 'late cancel must block Gmail');
assert.equal(props.has('TEST_ORDER:OORDERCANCEL'), false);

setOrderRace('PORDEROK', 'OORDEROK', {});
run();
assert.equal(ctx.__orderReads, 2, 'normal delivery also re-reads the order');
assert.equal(sent.length, beforeOrderRace + 1, 'unchanged order delivered exactly once');
assert.match(props.get('TEST_ORDER:OORDEROK'), /^SENT .* MSG:mock-gmail-message-/);
ctx.__orderReads = 0;
run();
assert.equal(ctx.__orderReads, 0, 'sent order must not be fetched again');
assert.equal(sent.length, beforeOrderRace + 1, 'no duplicate Gmail after successful delivery');
console.log('PASS: Order re-read race regression: late refund/cancel blocked, unchanged order sent once');

// Emergency pause during an active run: after the payment guard is saved,
// the live flag must be re-read before Gmail. PENDING blocks automatic retry.
setOrderRace('PPAUSE', 'OPAUSE', {});
props.set('SEND_ENABLED', 'true');
pauseOnPaymentGuardOnce = true;
const beforeEmergencyPause = sent.length;
assert.throws(run, /Fulfillment paused before Gmail/);
assert.equal(sent.length, beforeEmergencyPause, 'pause after PENDING must block Gmail');
assert.match(props.get('TEST_ORDER:OPAUSE'), /^PENDING /);
assert.match(props.get('TEST_PPAUSE'), /^PENDING /);
props.set('SEND_ENABLED', 'true');
ctx.__orderReads = 0;
run();
assert.equal(ctx.__orderReads, 0, 'unresolved PENDING blocks even after re-enabling');
assert.equal(sent.length, beforeEmergencyPause, 'no automatic retry after emergency pause');

// Pause before any PENDING write must not reserve the order or send Gmail.
setOrderRace('PPAUSEEARLY', 'OPAUSEEARLY', {});
props.set('SEND_ENABLED', 'true');
vm.runInContext(`
  goSquareGet_ = function(url) {
    if (url.startsWith('payments?')) return {payments: __payments};
    if (url.startsWith('payments/')) {
      PropertiesService.getScriptProperties().setProperty('SEND_ENABLED', 'false');
      return {payment: __payments[0]};
    }
    if (url.startsWith('orders/')) return {order: __firstOrder};
    throw Error('Unexpected Square path: ' + url);
  };
`, ctx);
const beforeEarlyPause = sent.length;
assert.throws(run, /Fulfillment paused before reserving delivery/);
assert.equal(sent.length, beforeEarlyPause);
assert.equal(props.has('TEST_ORDER:OPAUSEEARLY'), false);
assert.equal(props.has('TEST_PPAUSEEARLY'), false);
console.log('PASS: emergency pause before reservation and after PENDING blocks Gmail and automatic retry');


// Production handoff gate: isolated, read-only regression scenarios.
// No real Square, Drive, Gmail or Script Properties API is invoked.
{
  const deploymentCode = fs.readFileSync(path.join(__dirname, 'Deployment.gs'), 'utf8');
  const gateProps = new Map([
    ['SQUARE_ACCESS_TOKEN', 'fake-token'], ['SQUARE_LOCATION_ID', 'fake-location'],
    ['STARTER_CATALOG_OBJECT_ID', 'fake-item'], ['FULFILL_SINCE_ISO', '2026-10-29T00:00:00Z'],
    ['STARTER_GUIDE_URL', 'fake-guide'], ['STARTER_PROMPT_URL', 'fake-prompt'],
    ['STARTER_SHEET_URL', 'fake-sheet'], ['SEND_ENABLED', 'false']
  ]);
  let triggerCount = 1, accountOk = true, configOk = true;
  let materialsOk = true, pendingCount = 0, squareThrows = false;
  let guardScanFails = false;
  let writes = 0, sends = 0, auditCalls = 0;
  const required = [
    'SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'STARTER_CATALOG_OBJECT_ID',
    'FULFILL_SINCE_ISO', 'STARTER_GUIDE_URL', 'STARTER_PROMPT_URL',
    'STARTER_SHEET_URL'
  ];
  const gateCtx = vm.createContext({
    console: {log: () => {}},
    GO_SENDER: 'minpaku.ai.kit@gmail.com',
    Session: {getEffectiveUser: () => ({getEmail: () =>
      accountOk ? 'minpaku.ai.kit@gmail.com' : 'wrong@example.com'})},
    ScriptApp: {getProjectTriggers: () => Array.from({length: triggerCount}, () =>
      ({getHandlerFunction: () => 'runStarterFulfillment'}))},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: (k) => gateProps.get(k) || null,
      getProperties: () => {if (guardScanFails) throw Error('Guard scan unavailable'); return Object.fromEntries(gateProps);},
      setProperty: () => {writes++; throw Error('Unexpected property mutation');}
    })},
    GmailApp: {createDraft: () => {sends++; throw Error('Unexpected Gmail call');}},
    goRequiredConfig_: () => {if (!configOk) throw Error('bad config');}
  });
  vm.runInContext(deploymentCode, gateCtx, {filename: 'Deployment.gs'});
  gateCtx.auditStarterMaterialAccess = () => ({ready: materialsOk});
  gateCtx.auditStarterFulfillment = () => {
    auditCalls++;
    if (squareThrows) throw Error('Square offline');
    return {pendingReview: pendingCount};
  };
  const check = () => vm.runInContext('auditStarterGoLiveReadiness()', gateCtx);
  const has = (result, code) => result.blockers.includes(code);
  assert.equal(check().ready, true, 'fully configured dry-run gate passes');
  triggerCount = 0;
  assert.equal(has(check(), 'EXPECTED_EXACTLY_ONE_TRIGGER'), true);
  triggerCount = 2;
  assert.equal(has(check(), 'EXPECTED_EXACTLY_ONE_TRIGGER'), true);
  triggerCount = 1;
  gateProps.set('SEND_ENABLED', 'true');
  assert.equal(has(check(), 'SEND_ALREADY_ENABLED'), true);
  gateProps.set('SEND_ENABLED', 'false');
  accountOk = false;
  const callsBeforeWrongAccount = auditCalls;
  assert.equal(has(check(), 'WRONG_GOOGLE_ACCOUNT'), true);
  assert.equal(auditCalls, callsBeforeWrongAccount, 'wrong account must skip Square');
  accountOk = true;
  gateProps.delete('STARTER_GUIDE_URL');
  const callsBeforeMissing = auditCalls;
  assert.equal(has(check(), 'MISSING_PROPERTIES'), true);
  assert.equal(auditCalls, callsBeforeMissing, 'missing config must skip Square');
  gateProps.set('STARTER_GUIDE_URL', 'fake-guide');
  configOk = false;
  assert.equal(has(check(), 'INVALID_CONFIGURATION'), true);
  configOk = true;
  materialsOk = false;
  assert.equal(has(check(), 'BUYER_MATERIALS_NOT_READY'), true);
  materialsOk = true;
  pendingCount = 2;
  assert.equal(has(check(), 'PENDING_DELIVERY_REVIEW'), true);
  pendingCount = 0;
  // A PENDING guard from a now-refunded/absent payment is invisible to the
  // Square eligible-payment audit. It must still block go-live.
  gateProps.set('GO_SENT_staleOrder', 'PENDING 2026-10-30T00:00:00Z');
  assert.equal(has(check(), 'UNRESOLVED_DELIVERY_GUARDS'), true);
  gateProps.delete('GO_SENT_staleOrder');
  // Corrupt/legacy statuses must not be silently treated as completed.
  gateProps.set('GO_SENT_corrupt', 'UNKNOWN');
  assert.equal(has(check(), 'UNRECOGNIZED_DELIVERY_GUARDS'), true);
  gateProps.delete('GO_SENT_corrupt');
  gateProps.set('GO_SENT_completed', 'SENT 2026-10-30T00:00:00Z MSG:mock-gmail-id');
  assert.equal(check().ready, true, 'valid SENT guard does not block go-live');
  gateProps.delete('GO_SENT_completed');
  guardScanFails = true;
  assert.equal(has(check(), 'DELIVERY_GUARD_AUDIT_FAILED'), true);
  guardScanFails = false;
  squareThrows = true;
  assert.equal(has(check(), 'SQUARE_READ_ONLY_AUDIT_FAILED'), true);
  squareThrows = false;
  assert.equal(check().ready, true, 'gate recovers after all blockers clear');
  assert.equal(writes, 0, 'readiness audit never writes properties');
  assert.equal(sends, 0, 'readiness audit never sends Gmail');
  console.log('PASS: go-live readiness gate, 15 scenarios, zero writes/sends');
}
