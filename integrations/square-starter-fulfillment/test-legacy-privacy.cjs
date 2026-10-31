'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'LegacyPrivacyRepair.gs'), 'utf8');
const keys = [
  'LEGACY_STARTER_GUIDE_ID', 'LEGACY_STARTER_PROMPT_ID',
  'LEGACY_STARTER_SHEET_ID', 'LEGACY_STARTER_FOLDER_ID',
  'PRIVATE_STARTER_GUIDE_ID', 'PRIVATE_STARTER_PROMPT_ID',
  'PRIVATE_STARTER_SHEET_ID', 'PRIVATE_STARTER_FOLDER_ID'
];
const ids = keys.map((_, i) => 'testPrivateId' + String(i).padStart(2, '0'));
const props = new Map(keys.map((key, i) => [key, ids[i]]));
const items = new Map(ids.map((id, i) => [id, {
  mime: i % 4 === 2 ? 'application/vnd.google-apps.spreadsheet' :
    'application/vnd.google-apps.document',
  access: i < 4 ? 'ANYONE_WITH_LINK' : 'PRIVATE'
}]));
let currentAccount = 'ai.kenshosho@gmail.com';
let changes = 0;
const lookup = id => {
  const item = items.get(id);
  if (!item) throw Error('missing file');
  return {
    getMimeType: () => item.mime,
    getSharingAccess: () => item.access,
    setSharing: (access, permission) => {
      assert.equal(access, 'PRIVATE');
      assert.equal(permission, 'NONE');
      item.access = access;
      changes++;
    }
  };
};
const ctx = vm.createContext({
  Session: {getEffectiveUser: () => ({getEmail: () => currentAccount})},
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null
  })},
  DriveApp: {
    Access: {PRIVATE: 'PRIVATE'},
    Permission: {NONE: 'NONE'},
    getFileById: lookup,
    getFolderById: lookup
  }
});
vm.runInContext(source, ctx);
const run = expr => vm.runInContext(expr, ctx);
assert.equal(run('auditLegacyStarterPrivacy().legacyPublicCount'), 4);
assert.equal(changes, 0, 'audit must be read-only');
items.get(ids[5]).access = 'ANYONE_WITH_LINK';
assert.throws(() => run('repairLegacyStarterPrivacy()'), /Private backup/);
assert.equal(changes, 0, 'bad backup must prevent all mutations');
items.get(ids[5]).access = 'PRIVATE';
currentAccount = 'wrong@example.com';
assert.throws(() => run('repairLegacyStarterPrivacy()'), /owner/);
assert.equal(changes, 0);
currentAccount = 'ai.kenshosho@gmail.com';
assert.equal(run('repairLegacyStarterPrivacy().changedCount'), 4);
assert.equal(changes, 4);
assert.equal(run('repairLegacyStarterPrivacy().changedCount'), 0,
  'second repair must be idempotent');
assert.equal(run('auditLegacyStarterPrivacy().allLegacyPrivate'), true);
assert.equal(changes, 4);
console.log('PASS: legacy privacy repair owner guard, private backup guard, read-only audit, 4 permission changes, idempotency');
