/**
 * GuestOps Starter GAS companion modules (single-paste deployment artifact).
 * Add as ONE new Apps Script file named StarterCompanions.gs alongside Code.gs.
 * This file defines the existing Deployment and BuyerAccess helpers, unchanged.
 * Never paste it alongside the separate Deployment.gs / BuyerAccess.gs files:
 * that would duplicate function names. Does not execute on load.
 * Source blobs: Deployment.gs=2ec3eb472f48b6cfe3283d6c9cc1e1fa174270ee; BuyerAccess.gs=e0aecfbb89a34c4d761885277d1032eadf67053c
 */

// === BEGIN Deployment.gs ===
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
  // An enabled auto-grant option requires the companion script to be deployed.
  // Otherwise the first real purchase would become a stuck PENDING delivery.
  if (PropertiesService.getScriptProperties().getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true' &&
      typeof goGrantStarterBuyerAccess_ !== 'function') {
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

// === END Deployment.gs ===

// === BEGIN BuyerAccess.gs ===
/**
 * Optional, fail-closed buyer-specific access provisioning.
 *
 * This file must be installed alongside Code.gs and Deployment.gs.
 * Disabled unless BOTH SEND_ENABLED and AUTO_GRANT_BUYER_ACCESS are "true".
 * It never changes Square, sends email, or enables fulfillment by itself.
 * Only invoke after a fresh COMPLETED payment AND COMPLETED order have been
 * verified and BOTH delivery guards have been reserved as PENDING.
 */
function goGrantStarterBuyerAccess_(buyerEmail, orderGuardKey, paymentGuardKey) {
  const props = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GO_SENDER ||
      props.getProperty('SEND_ENABLED') !== 'true' ||
      props.getProperty('AUTO_GRANT_BUYER_ACCESS') !== 'true') {
    throw new Error('Buyer access provisioning is not enabled for this sender.');
  }
  if (!goBuyerEmailValid_(buyerEmail) ||
      buyerEmail.toLowerCase() === GO_SENDER) {
    throw new Error('Invalid buyer mailbox; no access granted.');
  }

  // Never expose this helper as a standalone "share to any address" action.
  // Both delivery guards must already be PENDING for the freshly verified
  // Square order and payment. A SENT/absent/unknown guard blocks sharing.
  const guardPattern = /^GO_SENT_[A-Za-z0-9_-]{32,}$/;
  if (typeof orderGuardKey !== 'string' ||
      typeof paymentGuardKey !== 'string' ||
      !guardPattern.test(orderGuardKey) ||
      !guardPattern.test(paymentGuardKey) ||
      orderGuardKey === paymentGuardKey ||
      !/^PENDING\s/.test(props.getProperty(orderGuardKey) || '') ||
      !/^PENDING\s/.test(props.getProperty(paymentGuardKey) || '')) {
    throw new Error('Two valid PENDING delivery guards required before sharing.');
  }

  // Validate ALL three files before changing ANY permission. These must be
  // private migration copies, never the historical public-link originals.
  const specs = [
    {key: 'STARTER_GUIDE_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL', type: 'spreadsheets',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const seen = {};
  const targets = specs.map(spec => {
    const url = props.getProperty(spec.key);
    const pattern = new RegExp('^https://docs\\.google\\.com/' +
      spec.type + '/d/([A-Za-z0-9_-]+)(?:/|$)');
    const match = typeof url === 'string' ? url.match(pattern) : null;
    if (!match || seen[match[1]]) {
      throw new Error('Invalid or duplicate buyer material URL; no access granted.');
    }
    // Even a now-private historical file is permanently retired: its URL
    // appeared in public Git history and cannot serve as paid buyer material.
    if (goStarterRetiredMaterialIds_().includes(match[1])) {
      throw new Error('Retired public buyer material ID; no access granted.');
    }
    seen[match[1]] = true;
    const file = DriveApp.getFileById(match[1]);
    if (file.getMimeType() !== spec.mime ||
        file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Buyer material is not a private expected file; no access granted.');
    }
    const access = file.getAccess(buyerEmail);
    // Never silently downgrade an editor, commenter, or owner.
    if (access !== DriveApp.Permission.NONE &&
        access !== DriveApp.Permission.VIEW) {
      throw new Error('Unexpected buyer permission; no access granted.');
    }
    return {file, access};
  });

  let grantedCount = 0;
  for (const target of targets) {
    if (target.access === DriveApp.Permission.VIEW) continue;
    // Pause requests must stop permission changes as well as Gmail.
    if (props.getProperty('SEND_ENABLED') !== 'true' ||
        props.getProperty('AUTO_GRANT_BUYER_ACCESS') !== 'true') {
      throw new Error('Buyer access provisioning paused; PENDING remains.');
    }
    target.file.addViewer(buyerEmail);
    if (target.file.getAccess(buyerEmail) !== DriveApp.Permission.VIEW ||
        target.file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Buyer VIEW access not verified; PENDING remains.');
    }
    grantedCount++;
  }
  // Independent read-only verification of all three buyer-only links.
  const audit = auditStarterMaterialAccess(buyerEmail);
  if (!audit || audit.ready !== true) {
    throw new Error('Buyer material access audit failed; PENDING remains.');
  }
  return {ready: true, grantedCount};
}

// === END BuyerAccess.gs ===

/**
 * One-action, non-sending onboarding for a newly created Starter GAS project.
 * Requires the authorized sender; never reads Square or sends mail.
 * Runs offline eligibility checks, configures only the three verified private
 * migration materials, then reports the remaining property names.
 * Does not create triggers, change prices, grant buyer access, or enable sending.
 */
function prepareStarterDryRun() {
  const props = PropertiesService.getScriptProperties();
  const email = Session.getEffectiveUser().getEmail();
  if (typeof email !== 'string' || email.toLowerCase() !== GO_SENDER) {
    throw new Error('Starter setup must run as the authorized sender.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Disable SEND_ENABLED before onboarding; no setup performed.');
  }
  testStarterFulfillmentRules();
  const configured = configureStarterPrivateMaterials();
  const access = auditStarterMaterialAccess();
  if (!configured || configured.verified !== true ||
      !access || access.ready !== true) {
    throw new Error('Private materials not verified; sending remains disabled.');
  }
  const status = getStarterDeploymentStatus();
  if (status.sendEnabled || !status.authorizedAccount) {
    throw new Error('Unexpected Starter setup status; no sending allowed.');
  }
  const result = {
    privateMaterialsReady: true,
    senderAuthorized: true,
    sendEnabled: false,
    remainingPropertyNames: status.missingPropertyNames,
    triggerCount: status.triggerCount,
    squareAudited: false,
    buyerMailSent: false
  };
  console.log('STARTER_DRY_RUN_PREPARED ' + JSON.stringify(result));
  return result;
}

/**
 * Optional one-click Square ID discovery, after storing ONLY the production
 * access token in Script Properties. Uses GET /locations and GET /catalog/list;
 * never changes Square data, creates a charge, grants Drive access or emails.
 * Requires MERCHANT_PROFILE_READ and ITEMS_READ in addition to fulfillment's
 * PAYMENTS_READ / ORDERS_READ. Ambiguity always blocks configuration.
 * Existing nonmatching IDs are never overwritten.
 */
function configureStarterSquareIdsReadOnly() {
  const props = PropertiesService.getScriptProperties();
  const sender = Session.getEffectiveUser().getEmail();
  if (typeof sender !== 'string' || sender.toLowerCase() !== GO_SENDER ||
      props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Square ID discovery requires the authorized sender and SEND_ENABLED=false.');
  }
  const token = props.getProperty('SQUARE_ACCESS_TOKEN');
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Set SQUARE_ACCESS_TOKEN privately before Square ID discovery.');
  }
  const config = {token};
  const locationResponse = goSquareGet_('locations', config);
  if (!locationResponse || Array.isArray(locationResponse) ||
      !Array.isArray(locationResponse.locations) ||
      (locationResponse.errors !== undefined &&
       (!Array.isArray(locationResponse.errors) || locationResponse.errors.length))) {
    throw new Error('Invalid Square locations response; no IDs configured.');
  }
  const activeJPY = locationResponse.locations.filter(loc =>
    loc && typeof loc.id === 'string' && loc.id.length > 0 &&
    loc.status === 'ACTIVE' && loc.currency === 'JPY');
  if (activeJPY.length !== 1) {
    throw new Error('Square requires exactly one active JPY location for automatic setup; configure IDs manually.');
  }
  const locationId = activeJPY[0].id;
  const presentAtLocation = obj =>
    obj && (obj.present_at_all_locations === true ||
      (Array.isArray(obj.present_at_location_ids) &&
       obj.present_at_location_ids.includes(locationId)));
  const candidates = new Set();
  let cursor = '';
  const cursors = new Set();
  let complete = false;
  for (let page = 0; page < 10; page++) {
    if (cursor) {
      if (cursors.has(cursor)) throw new Error('Repeated catalog cursor; no IDs configured.');
      cursors.add(cursor);
    }
    const endpoint = 'catalog/list?types=ITEM' +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const result = goSquareGet_(endpoint, config);
    if (!result || typeof result !== 'object' || Array.isArray(result) ||
        (result.objects !== undefined && !Array.isArray(result.objects)) ||
        (result.cursor !== undefined && typeof result.cursor !== 'string') ||
        (result.errors !== undefined &&
         (!Array.isArray(result.errors) || result.errors.length))) {
      throw new Error('Invalid Square catalog response; no IDs configured.');
    }
    for (const item of (result.objects || [])) {
      if (!item || item.type !== 'ITEM' || item.is_deleted === true ||
          !item.item_data || typeof item.item_data.name !== 'string' ||
          !/starter/i.test(item.item_data.name) || !presentAtLocation(item) ||
          !Array.isArray(item.item_data.variations)) continue;
      for (const variation of item.item_data.variations) {
        if (!variation || variation.type !== 'ITEM_VARIATION' ||
            variation.is_deleted === true || !presentAtLocation(variation) ||
            typeof variation.id !== 'string' || !variation.id ||
            !variation.item_variation_data ||
            (variation.item_variation_data.pricing_type !== undefined &&
             variation.item_variation_data.pricing_type !== 'FIXED_PRICING') ||
            !goMoneyEquals_(variation.item_variation_data.price_money, GO_PRICE_JPY)) continue;
        candidates.add(variation.id);
      }
    }
    cursor = result.cursor || '';
    if (!cursor) {complete = true; break;}
  }
  if (!complete) throw new Error('Catalog pagination exceeded 10 pages; no IDs configured.');
  if (candidates.size !== 1) {
    throw new Error('Starter 9800 JPY catalog variation is absent or ambiguous; configure IDs manually.');
  }
  const catalogId = [...candidates][0];
  const currentLocation = props.getProperty('SQUARE_LOCATION_ID');
  const currentCatalog = props.getProperty('STARTER_CATALOG_OBJECT_ID');
  if ((currentLocation && currentLocation !== locationId) ||
      (currentCatalog && currentCatalog !== catalogId)) {
    throw new Error('Existing Square IDs conflict with read-only discovery; no overwrite.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Fulfillment enabled during discovery; no IDs configured.');
  }
  props.setProperties({
    SQUARE_LOCATION_ID: locationId,
    STARTER_CATALOG_OBJECT_ID: catalogId
  });
  const result = {
    squareLocationConfigured: true,
    starterCatalogVariationConfigured: true,
    candidateVariations: candidates.size,
    sendEnabled: false,
    squarePaymentsAudited: false,
    buyerMailSent: false
  };
  console.log('STARTER_SQUARE_IDS_CONFIGURED ' + JSON.stringify(result));
  return result;
}
