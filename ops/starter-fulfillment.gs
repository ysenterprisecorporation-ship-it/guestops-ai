/**
 * DEPRECATED — GuestOps Starter Kit legacy draft helper.
 *
 * This implementation was retired on 2026-10-31 because it embedded
 * buyer-material URLs in a PUBLIC repository and did not verify each
 * buyer's individual Drive permission before drafting delivery emails.
 *
 * Do not deploy or execute it. The maintained, fail-closed implementation
 * lives in integrations/square-starter-fulfillment/Code.gs and Deployment.gs.
 *
 * Historical Git commits may still contain the old links; removing them from
 * this file does NOT revoke their Google Drive sharing permissions.
 * No Square transactions, Gmail sends, or existing contracts are changed.
 */
function starterFulfillmentPreview() {
  throw new Error('LEGACY_STARTER_FULFILLMENT_DISABLED');
}
function starterFulfillmentCreateVerifiedDrafts() {
  throw new Error('LEGACY_STARTER_FULFILLMENT_DISABLED');
}
