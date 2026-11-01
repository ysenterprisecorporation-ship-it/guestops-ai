/**
 * One-time privacy remediation for legacy Starter Kit files.
 * Deploy this standalone script ONLY under the owning ai.kenshosho@gmail.com account.
 * No IDs, tokens, buyer emails, or paid material URLs are stored in source control.
 *
 * Script Properties (set in the owner-owned Apps Script project):
 * LEGACY_STARTER_GUIDE_ID, LEGACY_STARTER_PROMPT_ID,
 * LEGACY_STARTER_SHEET_ID, LEGACY_STARTER_FOLDER_ID,
 * PRIVATE_STARTER_GUIDE_ID, PRIVATE_STARTER_PROMPT_ID,
 * PRIVATE_STARTER_SHEET_ID, PRIVATE_STARTER_FOLDER_ID.
 *
 * Run auditLegacyStarterPrivacy() first. repairLegacyStarterPrivacy()
 * revokes link-wide access only after all four private backups are verified.
 * Does not delete files, modify contents, send email, or touch Square.
 */
const LEGACY_STARTER_OWNER = 'ai.kenshosho@gmail.com';
const LEGACY_STARTER_ITEMS = [
  {old: 'LEGACY_STARTER_GUIDE_ID', backup: 'PRIVATE_STARTER_GUIDE_ID',
    kind: 'file', mime: 'application/vnd.google-apps.document'},
  {old: 'LEGACY_STARTER_PROMPT_ID', backup: 'PRIVATE_STARTER_PROMPT_ID',
    kind: 'file', mime: 'application/vnd.google-apps.document'},
  {old: 'LEGACY_STARTER_SHEET_ID', backup: 'PRIVATE_STARTER_SHEET_ID',
    kind: 'file', mime: 'application/vnd.google-apps.spreadsheet'},
  {old: 'LEGACY_STARTER_FOLDER_ID', backup: 'PRIVATE_STARTER_FOLDER_ID',
    kind: 'folder'}
];

function legacyStarterTargets_() {
  const email = Session.getEffectiveUser().getEmail();
  if (typeof email !== 'string' ||
      email.toLowerCase() !== LEGACY_STARTER_OWNER) {
    throw new Error('Run only as the owner of the legacy Starter materials.');
  }
  const props = PropertiesService.getScriptProperties();
  const seen = {};
  return LEGACY_STARTER_ITEMS.map(spec => {
    const oldId = props.getProperty(spec.old);
    const backupId = props.getProperty(spec.backup);
    const idPattern = /^[A-Za-z0-9_-]{10,}$/;
    if (typeof oldId !== 'string' || !idPattern.test(oldId) ||
        typeof backupId !== 'string' || !idPattern.test(backupId) ||
        oldId === backupId || seen[oldId] || seen[backupId]) {
      throw new Error('Missing, invalid or duplicate legacy/private material IDs.');
    }
    seen[oldId] = true;
    seen[backupId] = true;
    const getter = spec.kind === 'folder' ? 'getFolderById' : 'getFileById';
    const oldItem = DriveApp[getter](oldId);
    const backup = DriveApp[getter](backupId);
    if (spec.mime &&
        (oldItem.getMimeType() !== spec.mime ||
         backup.getMimeType() !== spec.mime)) {
      throw new Error('Unexpected material type; no permissions changed.');
    }
    if (backup.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Private backup is broadly shared; no permissions changed.');
    }
    return {oldItem, backup};
  });
}

function auditLegacyStarterPrivacy() {
  const targets = legacyStarterTargets_();
  const publicCount = targets.filter(t =>
    t.oldItem.getSharingAccess() !== DriveApp.Access.PRIVATE).length;
  return {backupsVerified: targets.length, legacyPublicCount: publicCount,
    allLegacyPrivate: publicCount === 0};
}

function repairLegacyStarterPrivacy() {
  // Verify all private backups BEFORE making any permission changes.
  const targets = legacyStarterTargets_();
  let changedCount = 0;
  for (const target of targets) {
    if (target.oldItem.getSharingAccess() === DriveApp.Access.PRIVATE) continue;
    target.oldItem.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (target.oldItem.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Privacy change did not persist; inspect sharing settings.');
    }
    changedCount++;
  }
  const result = auditLegacyStarterPrivacy();
  if (!result.allLegacyPrivate) {
    throw new Error('Legacy Starter privacy remains unresolved.');
  }
  return {changedCount, backupsVerified: result.backupsVerified,
    allLegacyPrivate: true};
}

/**
 * Zero-Script-Properties, owner-only remediation of the four legacy links.
 * Finds the exact legacy and private backup FOLDERS first, then requires
 * exactly one expected file of each title INSIDE the correct folder.
 * All 8 objects are checked before revoking any broad sharing.
 *
 * Run auditLegacyStarterPrivacyAuto() to inspect, then
 * repairLegacyStarterPrivacyAuto() from the owner account.
 * No email, Square calls, new permissions, or file deletions.
 */
function legacyStarterAutoUnique_(iterator, label) {
  if (!iterator.hasNext()) throw new Error('Missing Starter item: ' + label);
  const item = iterator.next();
  if (iterator.hasNext()) throw new Error('Ambiguous Starter item: ' + label);
  if (!item.getOwner ||
      item.getOwner().getEmail().toLowerCase() !== LEGACY_STARTER_OWNER) {
    throw new Error('Unexpected Starter owner: ' + label);
  }
  return item;
}

function legacyStarterAutoTargets_() {
  const user = Session.getEffectiveUser().getEmail();
  if (typeof user !== 'string' ||
      user.toLowerCase() !== LEGACY_STARTER_OWNER) {
    throw new Error('Run only as the owner of the legacy Starter materials.');
  }
  const legacy = legacyStarterAutoUnique_(
    DriveApp.getFoldersByName('GuestOps Starter Kit 購入者用'), 'legacy folder');
  const backup = legacyStarterAutoUnique_(
    DriveApp.getFoldersByName('GuestOps Starter Kit｜限定共有・移行保管 20261031'),
    'private backup folder');
  const specs = [
    {old: 'GuestOps Starter Kit 利用ガイド',
      copy: 'GuestOps Starter Kit｜利用ガイド（限定共有・移行版 20261031）',
      mime: 'application/vnd.google-apps.document'},
    {old: 'GuestOps Starter Kit 施設専用マスタープロンプト',
      copy: 'GuestOps Starter Kit｜マスタープロンプト（限定共有・移行版 20261031）',
      mime: 'application/vnd.google-apps.document'},
    {old: 'GuestOps Starter Kit v1.1（購入者用）',
      copy: 'GuestOps Starter Kit｜施設情報・判断シート（限定共有・移行版 20261031）',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const seen = {};
  const validateId = (item, label) => {
    const id = item.getId();
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,}$/.test(id) || seen[id]) {
      throw new Error('Duplicate/invalid Starter ID: ' + label);
    }
    seen[id] = true;
  };
  validateId(legacy, 'legacy folder');
  validateId(backup, 'private backup folder');
  if (backup.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('Private backup folder is broadly shared.');
  }
  const targets = [{oldItem: legacy, backup: backup}];
  specs.forEach(spec => {
    const oldItem = legacyStarterAutoUnique_(
      legacy.getFilesByName(spec.old), 'legacy ' + spec.old);
    const copy = legacyStarterAutoUnique_(
      backup.getFilesByName(spec.copy), 'private ' + spec.copy);
    validateId(oldItem, spec.old);
    validateId(copy, spec.copy);
    if (oldItem.getMimeType() !== spec.mime || copy.getMimeType() !== spec.mime ||
        copy.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Wrong file type or nonprivate backup: ' + spec.old);
    }
    targets.push({oldItem: oldItem, backup: copy});
  });
  return targets;
}

function auditLegacyStarterPrivacyAuto() {
  const targets = legacyStarterAutoTargets_();
  const publicCount = targets.filter(t =>
    t.oldItem.getSharingAccess() !== DriveApp.Access.PRIVATE).length;
  return {backupsVerified: targets.length, legacyPublicCount: publicCount,
    allLegacyPrivate: publicCount === 0};
}

function repairLegacyStarterPrivacyAuto() {
  // Preflight every private backup and expected old item before any write.
  const targets = legacyStarterAutoTargets_();
  let changedCount = 0;
  for (const target of targets) {
    if (target.oldItem.getSharingAccess() === DriveApp.Access.PRIVATE) continue;
    target.oldItem.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (target.oldItem.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Legacy Starter permission revocation not verified.');
    }
    changedCount++;
  }
  const result = auditLegacyStarterPrivacyAuto();
  if (!result.allLegacyPrivate) throw new Error('Legacy privacy remains unresolved.');
  return {changedCount: changedCount, backupsVerified: result.backupsVerified,
    allLegacyPrivate: true};
}
