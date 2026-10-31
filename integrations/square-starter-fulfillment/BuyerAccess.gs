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
      !/^PENDING\\s/.test(props.getProperty(orderGuardKey) || '') ||
      !/^PENDING\\s/.test(props.getProperty(paymentGuardKey) || '')) {
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
