// Legacy Starter draft helper must stay disabled: it previously exposed
// public buyer-material links and lacked per-buyer Drive access validation.
// This test performs NO Square requests, Drive mutations, or Gmail sends.
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('ops/starter-fulfillment.gs', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context);
assert.throws(
  () => context.starterFulfillmentPreview(),
  /LEGACY_STARTER_FULFILLMENT_DISABLED/
);
assert.throws(
  () => context.starterFulfillmentCreateVerifiedDrafts(),
  /LEGACY_STARTER_FULFILLMENT_DISABLED/
);
assert.equal(/https:\/\/docs\.google\.com\/.*\/d\//.test(source), false,
  'legacy source must not contain paid-material links');
console.log('PASS: legacy Starter fulfillment cannot create drafts or leak links');
