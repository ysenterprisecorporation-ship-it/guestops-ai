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
