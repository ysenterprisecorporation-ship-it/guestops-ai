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
    setProperties: (entries) => Object.entries(entries).forEach(([key, val]) => props.set(key, val))
  })},
  GmailApp: {sendEmail: (to, subject, body) => sent.push({to, subject, body})},
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
console.log('PASS: 16 eligibility checks + order-level idempotency, repeat, PENDING and dry-run checks');
