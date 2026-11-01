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

/* Zero-configuration owner repair: all lookups scoped to the two exact folders. */
const autoOwner = 'ai.kenshosho@gmail.com';
let autoChanges = 0;
const autoFile = (id, mime, access) => ({
  id, mime, access, owner: autoOwner,
  getId() { return this.id; },
  getOwner() { return {getEmail: () => this.owner}; },
  getMimeType() { return this.mime; },
  getSharingAccess() { return this.access; },
  setSharing(access, permission) {
    assert.equal(access, 'PRIVATE');
    assert.equal(permission, 'NONE');
    this.access = access;
    autoChanges++;
  }
});
const iterator = list => {
  let pos = 0;
  return {hasNext: () => pos < list.length, next: () => list[pos++]};
};
const oldFolder = autoFile('autoLegacyFolder000000', null, 'ANYONE_WITH_LINK');
const newFolder = autoFile('autoPrivateFolder00000', null, 'PRIVATE');
const autoTitleSpec = [
  ['GuestOps Starter Kit 利用ガイド',
    'GuestOps Starter Kit｜利用ガイド（限定共有・移行版 20261031）',
    'application/vnd.google-apps.document'],
  ['GuestOps Starter Kit 施設専用マスタープロンプト',
    'GuestOps Starter Kit｜マスタープロンプト（限定共有・移行版 20261031）',
    'application/vnd.google-apps.document'],
  ['GuestOps Starter Kit v1.1（購入者用）',
    'GuestOps Starter Kit｜施設情報・判断シート（限定共有・移行版 20261031）',
    'application/vnd.google-apps.spreadsheet']
];
const oldFiles = new Map();
const newFiles = new Map();
autoTitleSpec.forEach(([oldName, newName, mime], i) => {
  oldFiles.set(oldName, autoFile('autoLegacyFile000000' + i, mime, 'ANYONE_WITH_LINK'));
  newFiles.set(newName, autoFile('autoPrivateFile00000' + i, mime, 'PRIVATE'));
});
oldFolder.getFilesByName = title => iterator(oldFiles.has(title) ? [oldFiles.get(title)] : []);
newFolder.getFilesByName = title => iterator(newFiles.has(title) ? [newFiles.get(title)] : []);
const folderNames = new Map([
  ['GuestOps Starter Kit 購入者用', [oldFolder]],
  ['GuestOps Starter Kit｜限定共有・移行保管 20261031', [newFolder]]
]);
ctx.DriveApp.getFoldersByName = title => iterator(folderNames.get(title) || []);
assert.equal(run('auditLegacyStarterPrivacyAuto().legacyPublicCount'), 4);
assert.equal(autoChanges, 0, 'auto audit must never mutate');
currentAccount = 'wrong@example.com';
assert.throws(() => run('repairLegacyStarterPrivacyAuto()'), /owner/);
currentAccount = autoOwner;
folderNames.get('GuestOps Starter Kit 購入者用').push(oldFolder);
assert.throws(() => run('repairLegacyStarterPrivacyAuto()'), /Ambiguous/);
folderNames.get('GuestOps Starter Kit 購入者用').pop();
newFolder.access = 'ANYONE_WITH_LINK';
assert.throws(() => run('repairLegacyStarterPrivacyAuto()'), /backup folder/);
newFolder.access = 'PRIVATE';
const missing = newFiles.get(autoTitleSpec[1][1]);
newFiles.delete(autoTitleSpec[1][1]);
assert.throws(() => run('repairLegacyStarterPrivacyAuto()'), /Missing Starter item/);
newFiles.set(autoTitleSpec[1][1], missing);
missing.owner = 'other@example.com';
assert.throws(() => run('repairLegacyStarterPrivacyAuto()'), /Unexpected Starter owner/);
missing.owner = autoOwner;
assert.equal(autoChanges, 0, 'all invalid preflights must leave old sharing unchanged');
assert.equal(run('repairLegacyStarterPrivacyAuto().changedCount'), 4);
assert.equal(autoChanges, 4);
assert.equal(run('repairLegacyStarterPrivacyAuto().changedCount'), 0, 'idempotent');
assert.equal(run('auditLegacyStarterPrivacyAuto().allLegacyPrivate'), true);
console.log('PASS: zero-property owner repair: 4 revoked, duplicate/missing/wrong-owner/unsafe-backup rejected, idempotent');
