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
 * Read-only prelaunch audit of the three buyer materials.
 * A syntactically valid Docs URL does NOT guarantee a buyer can open it.
 * Do not log file IDs, URLs, buyer data or tokens. No permission changes.
 * A result of ready=true verifies link-view access at audit time only;
 * it is not a guarantee of future access or proof of a paid delivery.
 */
function auditStarterMaterialAccess() {
  const props = PropertiesService.getScriptProperties();
  const specs = [
    {key: 'STARTER_GUIDE_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL', type: 'spreadsheets',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const checks = specs.map(spec => {
    const url = props.getProperty(spec.key);
    const pattern = new RegExp('^https://docs\\.google\\.com/' +
      spec.type + '/d/([A-Za-z0-9_-]+)(?:/|$)');
    const match = typeof url === 'string' ? url.match(pattern) : null;
    if (!match) return {material: spec.key, status: 'INVALID_URL'};
    try {
      const file = DriveApp.getFileById(match[1]);
      if (file.getMimeType() !== spec.mime) {
        return {material: spec.key, status: 'WRONG_FILE_TYPE'};
      }
      const access = file.getSharingAccess();
      if (access !== DriveApp.Access.ANYONE_WITH_LINK &&
          access !== DriveApp.Access.ANYONE) {
        return {material: spec.key, status: 'BUYER_CANNOT_OPEN_LINK'};
      }
      if (file.getSharingPermission() !== DriveApp.Permission.VIEW) {
        return {material: spec.key, status: 'NOT_VIEW_ONLY'};
      }
      return {material: spec.key, status: 'READY'};
    } catch (e) {
      // Missing file, lost access, or Drive API error: fail closed.
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
    } else if (/^PENDING(?:\\s|$)/.test(state)) {
      pendingGuardCount++;
    } else if (/^SENT\\s+\\d{4}-\\d\\d-\\d\\dT[^\\s]+\\s+MSG:[^\\s]+$/.test(state)) {
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
