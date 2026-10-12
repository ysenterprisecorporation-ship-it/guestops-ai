import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectProductionSettings } from "../src/Readiness";
import { CONFIG } from "../src/Config";

test("missing settings are listed without pretending production is verified", () => {
  const r = inspectProductionSettings(() => null);
  assert.equal(r.configurationValid, false);
  assert.equal(r.liveAcceptanceVerified, false);
  assert.ok(r.missingKeys?.includes("SQUARE_ACCESS_TOKEN"));
});
test("credentials and invalid values never appear in the diagnostic", () => {
  const secret = "PRIVATE_VALUE_NOT_FOR_OUTPUT";
  const r = inspectProductionSettings(() => secret);
  assert.equal(JSON.stringify(r).includes(secret), false);
  assert.equal(r.verificationMode, "UNCONFIRMED");
});
test("diagnostic preserves loaded product configuration and existing values", () => {
  const previous = { ...CONFIG };
  inspectProductionSettings(() => "not-valid");
  assert.deepEqual(CONFIG, previous);
});
test("property read failure is sanitized", () => {
  const r = inspectProductionSettings(() => {
    throw new Error("PRIVATE_VALUE");
  });
  assert.equal(r.issue, "PROPERTY_READ_FAILED");
  assert.equal(JSON.stringify(r).includes("PRIVATE_VALUE"), false);
});
