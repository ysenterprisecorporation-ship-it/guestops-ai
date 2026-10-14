import test from "node:test";
import assert from "node:assert/strict";
import {
  recordManualGmoSend,
  recordManualGmoSignature,
} from "../src/manual-contract-ops.js";
import type { BookingRecord } from "../src/booking-flow.js";

function ready(): BookingRecord {
  return {
    bookingId: "booking_300",
    rentalMode: "MONTHLY",
    state: "CONTRACT_READY",
    quoteAmountYen: 180000,
    paymentId: "pay_300",
    reservationId: "res_300",
  };
}

test("manual GMO send moves ready to sent", () => {
  const sent = recordManualGmoSend(ready(), "gmo_manual_300");
  assert.equal(sent.state, "CONTRACT_SENT");
  assert.equal(sent.contractId, "gmo_manual_300");
});

test("manual GMO signature moves sent to signed", () => {
  const sent = recordManualGmoSend(ready(), "gmo_manual_300");
  const signed = recordManualGmoSignature(sent, "gmo_manual_300");
  assert.equal(signed.state, "CONTRACT_SIGNED");
});

test("contract id mismatch becomes manual review", () => {
  const sent = recordManualGmoSend(ready(), "gmo_manual_300");
  const next = recordManualGmoSignature(sent, "different_id");
  assert.equal(next.state, "MANUAL_REVIEW");
  assert.equal(next.reviewReason, "CONTRACT_ID_MISMATCH");
});

test("short stay cannot use manual GMO operations", () => {
  const r = ready();
  r.rentalMode = "SHORT_STAY";
  assert.throws(() => recordManualGmoSend(r, "gmo_manual_300"), /MONTHLY_ONLY/);
});
