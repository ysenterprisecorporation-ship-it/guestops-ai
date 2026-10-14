import test from "node:test";
import assert from "node:assert/strict";
import {
  assertGmoSignApiReady,
  parseGmoSignCompletionWebhook,
  GmoSignAdapter,
} from "../src/adapters/gmo-sign.js";

test("GMO Sign rejects plans without API availability", () => {
  assert.throws(
    () => assertGmoSignApiReady({
      organizationId: "org_1",
      apiSecret: "secret",
      plan: "LIGHT",
    }),
    /GMO_SIGN_API_PLAN_UNSUPPORTED/,
  );
});

test("GMO Sign accepts standard plan with credentials", () => {
  assert.doesNotThrow(() => assertGmoSignApiReady({
    organizationId: "org_1",
    apiSecret: "secret",
    plan: "STANDARD",
  }));
});

test("GMO Sign completion webhook parser accepts snake_case payload", () => {
  const result = parseGmoSignCompletionWebhook({
    contract_id: "ctr_900",
    completed_at: "2026-10-15T03:00:00+09:00",
  });
  assert.equal(result.contractId, "ctr_900");
});

test("GMO Sign adapter keeps send transport injected", async () => {
  let calls = 0;
  const adapter = new GmoSignAdapter(
    {
      organizationId: "org_1",
      apiSecret: "secret",
      plan: "STANDARD",
    },
    {
      sendContract: async (input) => {
        calls += 1;
        assert.equal(input.idempotencyKey, "gtos:booking_900:CONTRACT");
        return { contractId: "ctr_900" };
      },
    },
  );

  const result = await adapter.sendContract({
    bookingId: "booking_900",
    signerEmail: "guest@example.com",
    documentRef: "gs://contracts/booking_900.pdf",
    idempotencyKey: "gtos:booking_900:CONTRACT",
  });

  assert.equal(result.contractId, "ctr_900");
  assert.equal(calls, 1);
});
