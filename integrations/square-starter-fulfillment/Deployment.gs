/**
 * Starter Kit production handoff helpers.
 * Add this as a separate .gs file beside Code.gs in the SAME Apps Script project.
 * No payment changes, no automatic activation of buyer email delivery.
 */
function goStarterTriggers_() {
  return ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runStarterFulfillment');
}

/** Configuration/trigger status without revealing token, IDs, or buyer data. */
function getStarterDeploymentStatus() {
  const props = PropertiesService.getScriptProperties();
  const required = [
    'SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'STARTER_CATALOG_OBJECT_ID',
    'FULFILL_SINCE_ISO', 'STARTER_GUIDE_URL', 'STARTER_PROMPT_URL',
    'STARTER_SHEET_URL'
  ];
  const status = {
    authorizedAccount: Session.getEffectiveUser().getEmail().toLowerCase() === GO_SENDER,
    missingPropertyNames: required.filter(k => !props.getProperty(k)),
    sendEnabled: props.getProperty('SEND_ENABLED') === 'true',
    triggerCount: goStarterTriggers_().length
  };
  console.log('STARTER_DEPLOYMENT_STATUS ' + JSON.stringify(status));
  return status;
}

/**
 * One-action setup for the three already-created PRIVATE migration materials.
 * Resolve by exact Drive title, never by a public GitHub URL or retired ID.
 * Must run as the Starter sender while sending is OFF. Validates all three
 * before writing any property. Does NOT enable mail, sharing or payments.
 */
function configureStarterPrivateMaterials() {
  const props = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GO_SENDER) {
    throw new Error('Run only from the authorized Starter sender account.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Pause fulfillment before configuring private materials.');
  }
  const specs = [
    {key: 'STARTER_GUIDE_URL',
      title: 'GuestOps Starter Kit｜利用ガイド（限定共有・移行版 20261031）',
      type: 'document', mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL',
      title: 'GuestOps Starter Kit｜マスタープロンプト（限定共有・移行版 20261031）',
      type: 'document', mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL',
      title: 'GuestOps Starter Kit｜施設情報・判断シート（限定共有・移行版 20261031）',
      type: 'spreadsheets', mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const updates = {};
  const seen = new Set();
  const retired = goStarterRetiredMaterialIds_();
  specs.forEach(spec => {
    const matches = DriveApp.getFilesByName(spec.title);
    if (!matches.hasNext()) throw new Error('Private material not found: ' + spec.key);
    const file = matches.next();
    if (matches.hasNext()) throw new Error('Ambiguous private material title: ' + spec.key);
    const id = file.getId();
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,}$/.test(id) ||
        seen.has(id) || retired.includes(id) ||
        file.getMimeType() !== spec.mime ||
        file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
        file.getAccess(GO_SENDER) !== DriveApp.Permission.EDIT) {
      throw new Error('Private material validation failed: ' + spec.key);
    }
    seen.add(id);
    updates[spec.key] = 'https://docs.google.com/' + spec.type + '/d/' + id + '/edit';
  });
  // Recheck the pause immediately before committing the three URLs.
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Fulfillment resumed during setup; no URLs written.');
  }
  props.setProperties(updates);
  const verified = auditStarterMaterialAccess();
  if (!verified || verified.ready !== true) {
    // Remain fail-closed. Sending was never enabled by this helper.
    throw new Error('Private material post-write audit failed; sending remains disabled.');
  }
  return {configuredPrivateMaterials: specs.length, sendEnabled: false,
    verified: true};
}

/**
 * One-time dry-run trigger installer.
 * Audits live Square READ-ONLY first. Never enables sending or creates a charge.
 * Requires all Script Properties to be configured and SEND_ENABLED=false.
 */
function installStarterDryRunTrigger() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Set SEND_ENABLED=false before dry-run trigger installation.');
  }
  const audit = auditStarterFulfillment(); // read-only, no Gmail, no property writes
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Another fulfillment run is active.');
  try {
    goRequiredConfig_(props);
    if (props.getProperty('SEND_ENABLED') === 'true') {
      throw new Error('SEND_ENABLED changed; no trigger installed.');
    }
    const existing = goStarterTriggers_();
    if (existing.length > 1) {
      throw new Error('Multiple fulfillment triggers found; no new trigger installed.');
    }
    const created = existing.length === 0;
    if (created) {
      ScriptApp.newTrigger('runStarterFulfillment')
        .timeBased().everyMinutes(15).create();
    }
    const result = {
      dryRunOnly: true,
      triggerCreated: created,
      triggerCount: goStarterTriggers_().length,
      auditedPayments: audit.scannedPayments,
      eligibleOrders: audit.uniqueEligibleOrders,
      pendingReview: audit.pendingReview
    };
    console.log('STARTER_DRY_RUN_INSTALL ' + JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Emergency pause without waiting for the running fulfillment lock.
 * The sender re-reads SEND_ENABLED before reservation and before Gmail send.
 * A Gmail operation already in progress cannot be recalled; PENDING must be
 * reconciled before any restart. No Square/price/trigger mutation occurs.
 */
function pauseStarterFulfillment() {
  PropertiesService.getScriptProperties().setProperty('SEND_ENABLED', 'false');
  console.log('STARTER_FULFILLMENT_PAUSED');
  return {sendEnabled: false};
}

/**
 * Read-only audit of paid Starter materials.
 *
 * The old "anyone with the link" permission is NOT acceptable: these URLs
 * were previously committed to a public Git repository and remain in history.
 * Require PRIVATE files and, when a buyer is supplied, explicit VIEW access
 * for that exact Square-verified mailbox. No permission changes are made.
 *
 * Do not log file IDs, URLs, or buyer email addresses.
 */
/** Immutable denylist: identifiers exposed in historical public Git commits. */
function goStarterRetiredMaterialIds_() {
  return [
    '1MjTNyh8hjvJW5Eg2wsaRPgfMQ1nWazbs_qazdkSNNjQ',
    '1SHotxS2tvQuxHSGRS4SJMqUNhKSe-W_tukvEbuZ7xuQ',
    '1X5qCRw7wOjsusOUVopX2_735z0r-WMwUDC2-Hp7Zb8c'
  ];
}

function auditStarterMaterialAccess(buyerEmail) {
  const props = PropertiesService.getScriptProperties();
  const specs = [
    {key: 'STARTER_GUIDE_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL', type: 'spreadsheets',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  if (buyerEmail !== undefined && !goBuyerEmailValid_(buyerEmail)) {
    return {ready: false, checks: [{material: 'BUYER', status: 'INVALID_BUYER_EMAIL'}]};
  }
  const seenMaterialIds = new Set();
  const checks = specs.map(spec => {
    const url = props.getProperty(spec.key);
    const pattern = new RegExp('^https://docs\\.google\\.com/' +
      spec.type + '/d/([A-Za-z0-9_-]+)(?:/|$)');
    const match = typeof url === 'string' ? url.match(pattern) : null;
    if (!match) return {material: spec.key, status: 'INVALID_URL'};
    // Historical public Git commits exposed these OLD material identifiers.
    // Never reuse them for paid fulfillment, even after changing their permissions.
    if (goStarterRetiredMaterialIds_().includes(match[1])) {
      return {material: spec.key, status: 'RETIRED_PUBLIC_MATERIAL'};
    }
    if (seenMaterialIds.has(match[1])) return {material: spec.key, status: 'DUPLICATE_MATERIAL'};
    seenMaterialIds.add(match[1]);
    try {
      const file = DriveApp.getFileById(match[1]);
      if (file.getMimeType() !== spec.mime) {
        return {material: spec.key, status: 'WRONG_FILE_TYPE'};
      }
      // Both ANYONE and ANYONE_WITH_LINK are unsafe after historical leakage.
      if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        return {material: spec.key, status: 'PUBLIC_LINK_ACCESS'};
      }
      // The Starter sender is an editor, not the owner. If the owner has
      // disabled editor sharing, unattended grants will fail AFTER PENDING.
      // Reject BEFORE any delivery guard is reserved, without changing ACLs.
      if (buyerEmail === undefined &&
          props.getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true' &&
          (typeof file.isShareableByEditors !== 'function' ||
           file.isShareableByEditors() !== true)) {
        return {material: spec.key, status: 'EDITOR_SHARING_DISABLED'};
      }
      if (buyerEmail !== undefined &&
          file.getAccess(buyerEmail) !== DriveApp.Permission.VIEW) {
        return {material: spec.key, status: 'BUYER_ACCESS_NOT_VIEW_ONLY'};
      }
      return {material: spec.key, status: 'READY'};
    } catch (e) {
      return {material: spec.key, status: 'FILE_UNAVAILABLE'};
    }
  });
  const result = {ready: checks.every(c => c.status === 'READY'), checks};
  console.log('STARTER_MATERIAL_AUDIT ' + JSON.stringify(result));
  return result;
}

/**
 * Inspect ALL local delivery guards, not only payments still returned as
 * eligible by Square. A refunded, canceled or out-of-window payment can leave
 * an unresolved PENDING guard that the payment-list audit would never count.
 * No buyer identifiers, tokens, or guard keys are logged or returned.
 */
function auditStarterDeliveryGuards() {
  const entries = PropertiesService.getScriptProperties().getProperties();
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('Cannot inspect delivery guards.');
  }
  let pendingGuardCount = 0;
  let unrecognizedGuardCount = 0;
  let sentGuardCount = 0;
  Object.keys(entries).forEach(key => {
    if (!/^GO_SENT_[A-Za-z0-9_-]+$/.test(key)) return;
    const state = entries[key];
    if (typeof state !== 'string') {
      unrecognizedGuardCount++;
    } else if (/^PENDING(?:\s|$)/.test(state)) {
      pendingGuardCount++;
    } else if (/^SENT\s+\d{4}-\d\d-\d\dT[^\s]+\s+MSG:[^\s]+$/.test(state)) {
      sentGuardCount++;
    } else {
      unrecognizedGuardCount++;
    }
  });
  return {pendingGuardCount, unrecognizedGuardCount, sentGuardCount};
}

/**
 * Read-only go-live gate. Run after installing ONE dry-run trigger.
 * This NEVER enables sending, changes Square, creates triggers, or sends mail.
 * No tokens, file IDs, email addresses, or order identifiers are returned.
 * A pass is a preflight result, NOT evidence of a live purchase or delivery.
 */
function auditStarterGoLiveReadiness() {
  const blockers = [];
  let status;
  try {
    status = getStarterDeploymentStatus();
  } catch (e) {
    const failed = {ready: false, blockers: ['DEPLOYMENT_STATUS_UNAVAILABLE'],
      checkedAt: new Date().toISOString()};
    console.log('STARTER_GO_LIVE_READINESS ' + JSON.stringify(failed));
    return failed;
  }
  if (!status.authorizedAccount) blockers.push('WRONG_GOOGLE_ACCOUNT');
  if (status.missingPropertyNames.length) blockers.push('MISSING_PROPERTIES');
  if (status.sendEnabled) blockers.push('SEND_ALREADY_ENABLED');
  if (status.triggerCount !== 1) blockers.push('EXPECTED_EXACTLY_ONE_TRIGGER');
  // A read-only materials audit proves only that files are private, not
  // that a future buyer can open them. Unattended fulfillment requires
  // buyer-specific VIEW provisioning; otherwise a real order stalls at send.
  const autoGrant = PropertiesService.getScriptProperties()
    .getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true';
  if (!autoGrant) {
    blockers.push('UNATTENDED_BUYER_ACCESS_NOT_ENABLED');
  } else if (typeof goGrantStarterBuyerAccess_ !== 'function') {
    blockers.push('BUYER_ACCESS_PROVISIONER_MISSING');
  }

  let materialReady = false;
  let paymentsAudited = false;
  let pendingReview = null;
  let pendingGuardCount = null;
  let unrecognizedGuardCount = null;
  // Do not call Square with missing, invalid or unauthorized configuration.
  if (status.authorizedAccount && status.missingPropertyNames.length === 0) {
    let configValid = false;
    try {
      goRequiredConfig_(PropertiesService.getScriptProperties());
      configValid = true;
    } catch (e) {
      blockers.push('INVALID_CONFIGURATION');
    }
    if (configValid) {
      try {
        const guards = auditStarterDeliveryGuards();
        // Never report go-live READY if the guard audit returns malformed
        // counts. Live fulfillment already rejects them; preflight must agree.
        if (!guards ||
            !Number.isSafeInteger(guards.pendingGuardCount) ||
            !Number.isSafeInteger(guards.unrecognizedGuardCount) ||
            guards.pendingGuardCount < 0 || guards.unrecognizedGuardCount < 0) {
          throw new Error('Invalid delivery guard audit counts.');
        }
        pendingGuardCount = guards.pendingGuardCount;
        unrecognizedGuardCount = guards.unrecognizedGuardCount;
        if (pendingGuardCount > 0) blockers.push('UNRESOLVED_DELIVERY_GUARDS');
        if (unrecognizedGuardCount > 0) blockers.push('UNRECOGNIZED_DELIVERY_GUARDS');
      } catch (e) {
        blockers.push('DELIVERY_GUARD_AUDIT_FAILED');
      }
      try {
        const materials = auditStarterMaterialAccess();
        materialReady = !!(materials && materials.ready === true);
        if (!materialReady) blockers.push('BUYER_MATERIALS_NOT_READY');
      } catch (e) {
        blockers.push('BUYER_MATERIAL_AUDIT_FAILED');
      }
      if (materialReady) {
        try {
          const audit = auditStarterFulfillment();
          if (!audit || !Number.isInteger(audit.pendingReview) ||
              audit.pendingReview < 0) {
            blockers.push('INVALID_SQUARE_AUDIT_RESULT');
          } else {
            paymentsAudited = true;
            pendingReview = audit.pendingReview;
            if (pendingReview > 0) blockers.push('PENDING_DELIVERY_REVIEW');
          }
        } catch (e) {
          blockers.push('SQUARE_READ_ONLY_AUDIT_FAILED');
        }
      }
    }
  }
  const result = {
    ready: blockers.length === 0,
    blockers: blockers,
    authorizedAccount: status.authorizedAccount,
    triggerCount: status.triggerCount,
    sendEnabled: status.sendEnabled,
    materialReady: materialReady,
    paymentsAudited: paymentsAudited,
    pendingReview: pendingReview,
    pendingGuardCount: pendingGuardCount,
    unrecognizedGuardCount: unrecognizedGuardCount,
    checkedAt: new Date().toISOString()
  };
  console.log('STARTER_GO_LIVE_READINESS ' + JSON.stringify(result));
  return result;
}
