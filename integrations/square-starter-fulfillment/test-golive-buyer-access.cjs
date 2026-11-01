'use strict';
// Prevent a false READY when a private file is not automatically shared with buyers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = __dirname;
const sources = ['Deployment.gs', 'StarterCompanions.gs'].map(name =>
  fs.readFileSync(path.join(dir, name), 'utf8'));
const fn = source => {
  const match = source.match(/^function auditStarterGoLiveReadiness\(\) \{[\s\S]*?^\}/m);
  assert.ok(match, 'go-live readiness function must exist');
  return match[0];
};
for (const source of sources) {
  function run(autoGrant, withProvisioner = true, overrides = {}) {
    const state = {autoGrant, ...overrides};
    const ctx = {
      Date,
      console: {log() {}},
      PropertiesService: {getScriptProperties: () => ({
        getProperty: key => key === 'AUTO_GRANT_BUYER_ACCESS' ? state.autoGrant : null
      })},
      getStarterDeploymentStatus: () => ({
        authorizedAccount: state.account !== false,
        missingPropertyNames: state.missing ? ['SQUARE_ACCESS_TOKEN'] : [],
        sendEnabled: false, triggerCount: 1
      }),
      goRequiredConfig_: () => ({}),
      auditStarterDeliveryGuards: () => ({
        pendingGuardCount: state.pending ? 1 : 0, unrecognizedGuardCount: 0
      }),
      auditStarterMaterialAccess: () => ({ready: true}),
      auditStarterFulfillment: () => ({
        pendingReview: 0, readyToDeliver: 0
      })
    };
    if (withProvisioner) ctx.goGrantStarterBuyerAccess_ = () => {};
    return vm.runInNewContext(fn(source) + '\nauditStarterGoLiveReadiness()', ctx);
  }
  const disabled = run('false');
  assert.equal(disabled.ready, false);
  assert.ok(disabled.blockers.includes('UNATTENDED_BUYER_ACCESS_NOT_ENABLED'));
  assert.equal(disabled.paymentsAudited, true, 'Square read-only audit can still run');
  const enabled = run('true');
  assert.equal(enabled.ready, true);
  assert.equal(enabled.blockers.length, 0);
  const missingHelper = run('true', false);
  assert.equal(missingHelper.ready, false);
  assert.ok(missingHelper.blockers.includes('BUYER_ACCESS_PROVISIONER_MISSING'));
  const pending = run('true', true, {pending: true});
  assert.equal(pending.ready, false);
  assert.ok(pending.blockers.includes('UNRESOLVED_DELIVERY_GUARDS'));
  const noConfig = run('true', true, {missing: true});
  assert.equal(noConfig.ready, false);
  assert.ok(noConfig.blockers.includes('MISSING_PROPERTIES'));
}
console.log('PASS: two GAS source variants reject false unattended readiness, missing helper, pending guards and missing configuration');
