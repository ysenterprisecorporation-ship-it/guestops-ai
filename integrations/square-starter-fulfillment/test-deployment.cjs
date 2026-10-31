'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = __dirname;
const source = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(dir, 'Deployment.gs'), 'utf8');
const props = new Map([
  ['SQUARE_ACCESS_TOKEN', 'mock-token'],
  ['SQUARE_LOCATION_ID', 'L1'],
  ['STARTER_CATALOG_OBJECT_ID', 'VAR1'],
  ['FULFILL_SINCE_ISO', '2026-10-29T00:00:00Z'],
  ['STARTER_GUIDE_URL', 'https://docs.google.com/document/d/guide/edit'],
  ['STARTER_PROMPT_URL', 'https://docs.google.com/document/d/prompt/edit'],
  ['STARTER_SHEET_URL', 'https://docs.google.com/spreadsheets/d/sheet/edit'],
  ['SEND_ENABLED', 'false']
]);
const triggers = [];
let created = 0;
let account = 'minpaku.ai.kit@gmail.com';
let auditFails = false;
let auditCalls = 0;
let propertyWrites = 0;
let emails = 0;
let squareMutations = 0;
let lockAvailable = true;
const ctx = vm.createContext({
  console: {log: () => {}},
  Session: {getEffectiveUser: () => ({getEmail: () => account})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null,
    setProperty: (key, value) => {propertyWrites++; props.set(key, value);}
  })},
  LockService: {getScriptLock: () => ({
    tryLock: () => lockAvailable, releaseLock: () => {}
  })},
  ScriptApp: {
    getProjectTriggers: () => triggers,
    newTrigger: handler => ({
      timeBased: () => ({
        everyMinutes: minutes => ({
          create: () => {
            assert.equal(handler, 'runStarterFulfillment');
            assert.equal(minutes, 15);
            created++;
            triggers.push({getHandlerFunction: () => handler});
          }
        })
      })
    })
  },
  GmailApp: {sendEmail: () => {emails++; throw Error('No Gmail allowed');}},
  UrlFetchApp: {fetch: () => {squareMutations++; throw Error('No Square API allowed');}}
});
vm.runInContext(source, ctx, {filename: 'Starter Apps Script'});
ctx.auditStarterFulfillment = () => {
  auditCalls++;
  if (auditFails) throw Error('Mock audit failed');
  return {scannedPayments: 4, uniqueEligibleOrders: 2, pendingReview: 0};
};
const run = expr => vm.runInContext(expr, ctx);
assert.equal(run('getStarterDeploymentStatus().authorizedAccount'), true);
assert.equal(run('getStarterDeploymentStatus().triggerCount'), 0);
assert.equal(run('getStarterDeploymentStatus().missingPropertyNames.length'), 0);
assert.equal(run('installStarterDryRunTrigger().triggerCreated'), true);
assert.equal(created, 1);
assert.equal(run('installStarterDryRunTrigger().triggerCreated'), false);
assert.equal(created, 1, 'installer must be idempotent');
props.set('SEND_ENABLED', 'true');
assert.throws(() => run('installStarterDryRunTrigger()'), /SEND_ENABLED=false/);
assert.equal(created, 1);
assert.equal(run('pauseStarterFulfillment().sendEnabled'), false);
assert.equal(props.get('SEND_ENABLED'), 'false');
triggers.push({getHandlerFunction: () => 'runStarterFulfillment'});
assert.throws(() => run('installStarterDryRunTrigger()'), /Multiple fulfillment triggers/);
assert.equal(created, 1);
triggers.pop();
account = 'wrong@example.com';
assert.throws(() => run('installStarterDryRunTrigger()'), /Wrong Google account/);
account = 'minpaku.ai.kit@gmail.com';
// Reject wrong file types and accidental reuse of the same buyer material.
const originalGuide = props.get('STARTER_GUIDE_URL');
const originalPrompt = props.get('STARTER_PROMPT_URL');
const originalSheet = props.get('STARTER_SHEET_URL');
props.set('STARTER_GUIDE_URL', 'https://docs.google.com/spreadsheets/d/guide/edit');
assert.throws(() => run('goRequiredConfig_(PropertiesService.getScriptProperties())'), /STARTER_GUIDE_URL/);
props.set('STARTER_GUIDE_URL', originalGuide);
props.set('STARTER_PROMPT_URL', originalGuide);
assert.throws(() => run('goRequiredConfig_(PropertiesService.getScriptProperties())'), /Duplicate buyer material file ID/);
props.set('STARTER_PROMPT_URL', originalPrompt);
props.set('STARTER_SHEET_URL', 'https://docs.google.com/document/d/sheet/edit');
assert.throws(() => run('goRequiredConfig_(PropertiesService.getScriptProperties())'), /STARTER_SHEET_URL/);
props.set('STARTER_SHEET_URL', originalSheet);
assert.equal(run('goRequiredConfig_(PropertiesService.getScriptProperties()).enabled'), false);
auditFails = true;
assert.throws(() => run('installStarterDryRunTrigger()'), /Mock audit failed/);
assert.equal(created, 1);
assert.equal(propertyWrites, 1, 'only explicit pause may write SEND_ENABLED');
assert.equal(emails, 0);
assert.equal(squareMutations, 0);
assert.equal(auditCalls, 5);
// Emergency pause must not wait for the fulfillment lock; it is a stop flag.
lockAvailable = false;
props.set('SEND_ENABLED', 'true');
assert.equal(run('pauseStarterFulfillment().sendEnabled'), false);
assert.equal(props.get('SEND_ENABLED'), 'false');
lockAvailable = true;
assert.equal(propertyWrites, 2, 'pause can write immediately even with active lock');
assert.equal(emails, 0);
assert.equal(squareMutations, 0);


// Paid-material audit: PRIVATE files only; buyer-specific VIEW is required
// before sending. Historical links were public, so link-only access is unsafe.
const buyer = 'buyer@example.com';
const materialState = new Map([
  ['guide', {mime: 'application/vnd.google-apps.document', access: 'PRIVATE', permission: 'VIEW'}],
  ['prompt', {mime: 'application/vnd.google-apps.document', access: 'PRIVATE', permission: 'VIEW'}],
  ['sheet', {mime: 'application/vnd.google-apps.spreadsheet', access: 'PRIVATE', permission: 'VIEW'}]
]);
let driveReads = 0;
ctx.DriveApp = {
  Access: {PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE'},
  Permission: {VIEW: 'VIEW', EDIT: 'EDIT', NONE: 'NONE'},
  getFileById: id => {
    driveReads++;
    const file = materialState.get(id);
    if (!file) throw Error('not found');
    return {
      getMimeType: () => file.mime,
      getSharingAccess: () => file.access,
      getAccess: email => email === file.grantedTo ? file.permission : 'NONE'
    };
  }
};
const auditMaterials = email => email === undefined
  ? run('auditStarterMaterialAccess()')
  : run('auditStarterMaterialAccess(' + JSON.stringify(email) + ')');
assert.equal(auditMaterials().ready, true, 'all three source materials are private');
assert.equal(auditMaterials(buyer).ready, false, 'unshared buyer must be blocked');
assert.equal(auditMaterials(buyer).checks[0].status, 'BUYER_ACCESS_NOT_VIEW_ONLY');
for (const file of materialState.values()) file.grantedTo = buyer;
assert.equal(auditMaterials(buyer).ready, true, 'exact buyer VIEW permits delivery');
assert.equal(auditMaterials('other@example.com').ready, false, 'wrong buyer blocked');
assert.equal(auditMaterials('bad,mail@example.com').ready, false, 'invalid buyer blocked');
materialState.get('guide').mime = 'application/vnd.google-apps.spreadsheet';
assert.equal(auditMaterials(buyer).checks[0].status, 'WRONG_FILE_TYPE');
materialState.get('guide').mime = 'application/vnd.google-apps.document';
materialState.get('prompt').access = 'ANYONE_WITH_LINK';
assert.equal(auditMaterials(buyer).checks[1].status, 'PUBLIC_LINK_ACCESS');
materialState.get('prompt').access = 'ANYONE';
assert.equal(auditMaterials().checks[1].status, 'PUBLIC_LINK_ACCESS');
materialState.get('prompt').access = 'PRIVATE';
materialState.get('sheet').permission = 'EDIT';
assert.equal(auditMaterials(buyer).checks[2].status, 'BUYER_ACCESS_NOT_VIEW_ONLY');
materialState.get('sheet').permission = 'VIEW';
materialState.delete('guide');
assert.equal(auditMaterials(buyer).checks[0].status, 'FILE_UNAVAILABLE');
materialState.set('guide', {mime: 'application/vnd.google-apps.document',
  access: 'PRIVATE', permission: 'VIEW', grantedTo: buyer});
props.set('STARTER_GUIDE_URL', 'https://invalid.example/guide');
assert.equal(auditMaterials(buyer).checks[0].status, 'INVALID_URL');
props.set('STARTER_GUIDE_URL', originalGuide);
assert.equal(auditMaterials(buyer).ready, true);
// Enabling auto-grant without installing BuyerAccess.gs must fail preflight.
props.set('AUTO_GRANT_BUYER_ACCESS', 'true');
const missingHelper = run('auditStarterGoLiveReadiness()');
assert.equal(missingHelper.ready, false);
assert.ok(Array.from(missingHelper.blockers).includes('BUYER_ACCESS_PROVISIONER_MISSING'));
props.delete('AUTO_GRANT_BUYER_ACCESS');
assert.ok(driveReads > 0);
assert.equal(propertyWrites, 2, 'material audit must not change script properties');
assert.equal(emails, 0, 'material audit must not send Gmail');
assert.equal(squareMutations, 0, 'material audit must not mutate Square');

console.log('PASS: dry-run deployment status, idempotent trigger install, send gate, pause, duplicates, wrong account, audit failure; no Gmail or Square mutation');
