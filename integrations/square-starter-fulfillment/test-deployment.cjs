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
const ctx = vm.createContext({
  console: {log: () => {}},
  Session: {getEffectiveUser: () => ({getEmail: () => account})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null,
    setProperty: (key, value) => {propertyWrites++; props.set(key, value);}
  })},
  LockService: {getScriptLock: () => ({
    tryLock: () => true, releaseLock: () => {}
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
console.log('PASS: dry-run deployment status, idempotent trigger install, send gate, pause, duplicates, wrong account, audit failure; no Gmail or Square mutation');
