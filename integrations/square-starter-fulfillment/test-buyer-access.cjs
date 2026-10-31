'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = __dirname;
const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8');
const deployment = fs.readFileSync(path.join(dir, 'Deployment.gs'), 'utf8');
const buyerAccess = fs.readFileSync(path.join(dir, 'BuyerAccess.gs'), 'utf8');
const ids = ['buyerTestGuide123', 'buyerTestPrompt123', 'buyerTestSheet123'];
const keys = ['STARTER_GUIDE_URL', 'STARTER_PROMPT_URL', 'STARTER_SHEET_URL'];
const props = new Map([
  ['SEND_ENABLED', 'true'], ['AUTO_GRANT_BUYER_ACCESS', 'true'],
  [keys[0], 'https://docs.google.com/document/d/' + ids[0] + '/edit'],
  [keys[1], 'https://docs.google.com/document/d/' + ids[1] + '/edit'],
  [keys[2], 'https://docs.google.com/spreadsheets/d/' + ids[2] + '/edit']
]);
const files = new Map(ids.map((id, i) => [id, {
  mime: i === 2 ? 'application/vnd.google-apps.spreadsheet' :
    'application/vnd.google-apps.document',
  sharing: 'PRIVATE', buyerAccess: 'NONE'
}]));
let account = 'minpaku.ai.kit@gmail.com';
let grants = 0;
let failAt = -1;
let pauseAt = -1;
const buyer = 'buyer@example.com';
const getFileById = id => {
  const f = files.get(id);
  if (!f) throw Error('File unavailable');
  return {
    getMimeType: () => f.mime,
    getSharingAccess: () => f.sharing,
    getAccess: email => email === buyer ? f.buyerAccess : 'NONE',
    addViewer: email => {
      assert.equal(email, buyer);
      if (grants === failAt) throw Error('Injected Drive permission failure');
      f.buyerAccess = 'VIEW';
      grants++;
      if (grants === pauseAt) props.set('SEND_ENABLED', 'false');
    }
  };
};
const ctx = vm.createContext({
  Session: {getEffectiveUser: () => ({getEmail: () => account})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null
  })},
  DriveApp: {
    Access: {PRIVATE: 'PRIVATE'},
    Permission: {NONE: 'NONE', VIEW: 'VIEW', EDIT: 'EDIT'},
    getFileById
  },
  console: {log: () => {}}
});
vm.runInContext(code + '\n' + deployment + '\n' + buyerAccess, ctx);
const run = expression => vm.runInContext(expression, ctx);
const provision = () => run('goGrantStarterBuyerAccess_("buyer@example.com")');
const reset = () => {
  for (const f of files.values()) { f.sharing = 'PRIVATE'; f.buyerAccess = 'NONE'; }
  props.set('SEND_ENABLED', 'true');
  props.set('AUTO_GRANT_BUYER_ACCESS', 'true');
  grants = 0; failAt = -1; pauseAt = -1;
};

account = 'wrong@example.com';
assert.throws(provision, /not enabled/);
assert.equal(grants, 0);
account = 'minpaku.ai.kit@gmail.com';
props.set('SEND_ENABLED', 'false');
assert.throws(provision, /not enabled/);
assert.equal(grants, 0);
props.set('SEND_ENABLED', 'true');
props.set('AUTO_GRANT_BUYER_ACCESS', 'false');
assert.throws(provision, /not enabled/);
assert.equal(grants, 0);
props.set('AUTO_GRANT_BUYER_ACCESS', 'true');
assert.throws(() => run('goGrantStarterBuyerAccess_("buyer@example.com,other@example.com")'), /Invalid buyer/);
assert.equal(grants, 0);

files.get(ids[2]).sharing = 'ANYONE_WITH_LINK';
assert.throws(provision, /not a private/);
assert.equal(grants, 0);
reset();
files.get(ids[2]).buyerAccess = 'EDIT';
assert.throws(provision, /Unexpected buyer permission/);
assert.equal(grants, 0);
reset();
props.set(keys[1], props.get(keys[0]));
assert.throws(provision, /duplicate buyer material/);
assert.equal(grants, 0);
props.set(keys[1], 'https://docs.google.com/document/d/' + ids[1] + '/edit');

reset();
failAt = 1;
assert.throws(provision, /Injected Drive permission failure/);
assert.equal(grants, 1, 'partial Drive failure must not pretend success');
assert.equal(files.get(ids[0]).buyerAccess, 'VIEW');
assert.equal(files.get(ids[1]).buyerAccess, 'NONE');

reset();
pauseAt = 1;
assert.throws(provision, /paused/);
assert.equal(grants, 1, 'pause must stop additional grants');
assert.equal(props.get('SEND_ENABLED'), 'false');

reset();
const result = provision();
assert.equal(result.ready, true);
assert.equal(result.grantedCount, 3);
assert.equal(grants, 3);
assert.equal(run('auditStarterMaterialAccess("buyer@example.com").ready'), true);
assert.equal(provision().grantedCount, 0, 'repeated grant is idempotent');
assert.equal(grants, 3);

const orderGuard = code.indexOf('props.setProperty(orderKey, pendingAt);');
const paymentGuard = code.indexOf('props.setProperty(key, pendingAt);', orderGuard);
const provisionCall = code.indexOf('goGrantStarterBuyerAccess_(refreshed.payment.buyer_email_address);');
const sendCall = code.indexOf('GmailApp.createDraft(', provisionCall);
assert.ok(orderGuard >= 0 && paymentGuard > orderGuard &&
  provisionCall > paymentGuard && sendCall > provisionCall,
  'access grants must occur after BOTH PENDING guards and before Gmail');
assert.ok(code.includes("props.getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true'"),
  'auto grant must default to disabled');
console.log('PASS: buyer-only grant opt-in, private preflight, editor refusal, partial failure, pause, idempotency, PENDING-before-grant');
