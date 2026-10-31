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
