import assert from "node:assert/strict";
import test from "node:test";
import { requiredPublishedNightlyRate, satisfiesPriceFloor } from "../src/pms/PriceFloor";
const policy = { minimumNetPerNight: 36291, discountRates: [0.1, 0.1],
  commissionRate: 0.15, paymentRate: 0, currencyStep: 100 };
test("stacked discounts cannot break net price floor", () => {
  const floor = requiredPublishedNightlyRate(policy);
  assert.equal(floor, 52800);
  assert.equal(satisfiesPriceFloor(floor, policy), true);
  assert.equal(satisfiesPriceFloor(floor - 100, policy), false);
});
test("invalid fees, discounts and steps are rejected", () => {
  assert.throws(() => requiredPublishedNightlyRate({...policy, discountRates:[1]}), /INVALID_RATE/);
  assert.throws(() => requiredPublishedNightlyRate({...policy, currencyStep:0}), /INVALID_CURRENCY_STEP/);
  assert.throws(() => requiredPublishedNightlyRate({...policy, commissionRate:0.9,paymentRate:0.2}), /FEE_TOTAL/);
});
