'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Deployment.gs'), 'utf8');
const sender = 'minpaku.ai.kit@gmail.com';
let account = sender;
let writes = 0;
let auditsPass = true;
const props = new Map([['SEND_ENABLED', 'false']]);
const specs = [
  ['GuestOps Starter Kit｜利用ガイド（限定共有・移行版 20261031）',
    'guide-private-id-20261031-abc', 'application/vnd.google-apps.document'],
  ['GuestOps Starter Kit｜マスタープロンプト（限定共有・移行版 20261031）',
    'prompt-private-id-20261031-ab', 'application/vnd.google-apps.document'],
  ['GuestOps Starter Kit｜施設情報・判断シート（限定共有・移行版 20261031）',
    'sheet-private-id-20261031-abc', 'application/vnd.google-apps.spreadsheet']
];
const materials = specs.map(([title, id, mime]) =>
  ({title, id, mime, sharing: 'PRIVATE', permission: 'EDIT'}));
const ctx = vm.createContext({
  GO_SENDER: sender,
  console: {log: () => {}},
  Session: {getEffectiveUser: () => ({getEmail: () => account})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null,
    setProperties: entries => {
      writes++;
      Object.entries(entries).forEach(([k, v]) => props.set(k, v));
    }
  })},
  DriveApp: {
    Access: {PRIVATE: 'PRIVATE', ANYONE: 'ANYONE'},
    Permission: {EDIT: 'EDIT', VIEW: 'VIEW'},
    getFilesByName: title => {
      const matches = materials.filter(m => m.title === title);
      let i = 0;
      return {
        hasNext: () => i < matches.length,
        next: () => {
          const m = matches[i++];
          return {
            getId: () => m.id,
            getMimeType: () => m.mime,
            getSharingAccess: () => m.sharing,
            getAccess: () => m.permission
          };
        }
      };
    }
  }
});
vm.runInContext(source, ctx);
ctx.auditStarterMaterialAccess = () => ({ready: auditsPass});
const run = () => vm.runInContext('configureStarterPrivateMaterials()', ctx);

account = 'wrong@example.com';
assert.throws(run, /authorized Starter sender/);
account = sender;
props.set('SEND_ENABLED', 'true');
assert.throws(run, /Pause fulfillment/);
props.set('SEND_ENABLED', 'false');
materials[0].sharing = 'ANYONE';
assert.throws(run, /validation failed/);
materials[0].sharing = 'PRIVATE';
materials[1].permission = 'VIEW';
assert.throws(run, /validation failed/);
materials[1].permission = 'EDIT';
materials[2].mime = 'application/vnd.google-apps.document';
assert.throws(run, /validation failed/);
materials[2].mime = specs[2][2];
const duplicate = {...materials[0]};
materials.push(duplicate);
assert.throws(run, /Ambiguous private material title/);
materials.pop();
materials[0].id = '1MjTNyh8hjvJW5Eg2wsaRPgfMQ1nWazbs_qazdkSNNjQ';
assert.throws(run, /validation failed/);
materials[0].id = specs[0][1];
assert.equal(writes, 0, 'invalid setup must not change any Script Property');

const result = run();
assert.equal(result.verified, true);
assert.equal(result.configuredPrivateMaterials, 3);
assert.equal(result.sendEnabled, false);
assert.equal(writes, 1, 'three URLs written together only after validation');
assert.equal(props.get('SEND_ENABLED'), 'false', 'never enable sending');
assert.equal(props.get('STARTER_GUIDE_URL'),
  'https://docs.google.com/document/d/' + specs[0][1] + '/edit');
assert.equal(props.get('STARTER_PROMPT_URL'),
  'https://docs.google.com/document/d/' + specs[1][1] + '/edit');
assert.equal(props.get('STARTER_SHEET_URL'),
  'https://docs.google.com/spreadsheets/d/' + specs[2][1] + '/edit');
auditsPass = false;
assert.throws(run, /post-write audit failed/);
assert.equal(props.get('SEND_ENABLED'), 'false', 'failed post-audit never enables sending');
console.log('PASS: private migration material setup validates all 3 before write, refuses public/retired/ambiguous files, and never enables delivery');
