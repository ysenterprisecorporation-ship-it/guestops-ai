'use strict';
// Regression guard for the human-operated, single-paste GAS deployment artifact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = __dirname;
const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8');
const companions = fs.readFileSync(path.join(dir, 'StarterCompanions.gs'), 'utf8');
const bundle = fs.readFileSync(path.join(dir, 'StarterSinglePaste.gs'), 'utf8');
const boundary = '\n\n// ----- STARTER COMPANIONS -----\n\n';

assert.equal(bundle.split(boundary).length, 2, 'Bundle must contain exactly one companion boundary');
const [before, after] = bundle.split(boundary);
assert.ok(before.endsWith(code + '\n'), 'Single-paste bundle Code.gs is stale or modified');
assert.equal(after, companions + '\n', 'Single-paste bundle StarterCompanions.gs is stale or modified');

const functionNames = [...bundle.matchAll(/^function\s+([\w$]+)\s*\(/gm)].map(m => m[1]);
assert.equal(new Set(functionNames).size, functionNames.length, 'Duplicate top-level GAS function names');
for (const name of [
  'runStarterFulfillment', 'auditStarterFulfillment',
  'testStarterFulfillmentRules', 'configureStarterPrivateMaterials',
  'auditStarterMaterialAccess', 'auditStarterGoLiveReadiness',
  'pauseStarterFulfillment', 'getStarterDeploymentStatus'
]) {
  assert.ok(functionNames.includes(name), 'Required GAS entrypoint missing: ' + name);
}
new vm.Script(bundle, {filename: 'StarterSinglePaste.gs'});
assert.ok(bundle.includes("props.getProperty('SEND_ENABLED') !== 'true'"),
  'Live send-time pause gate missing');
console.log('PASS: single-paste GAS is byte-aligned with both sources, syntax valid, no duplicate functions, safe send gate present');
