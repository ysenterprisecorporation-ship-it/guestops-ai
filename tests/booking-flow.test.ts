import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBookingEvent,
  idempotencyKey,
  nextAction,
  type BookingRecord,
} from "../src/booking-flow.js";

function base(mode: "SHORT_STAY" | "MONTHLY"): BookingRecord {
  return {
    bookingId: "booking_001",
    rentalMode: mode,
    state: "INQUIRY",
    quoteAmountYen: 0,
  };
}

function paid(mode: "SHORT_STAY" | "MONTHLY") {
  let r = base(mode);
  r = applyBookingEvent(r, { type: "QUOTE_ISSUED", amountYen: 120000 });
  r = applyBookingEvent(r, {
    type: "INVENTORY_RECHECKED",
    available: true,
    validUntil: "2026-10-15T03:00:00+09:00",
  });
  r = applyBookingEvent(r, { type: "PAYMENT_LINK_CREATED" });
  return applyBookingEvent(r, {
    type: "PAYMENT_CONFIRMED",
    paymentId: "pay_001",
    amountYen: 120000,
    nowIso: "2026-10-15T02:00:00+09:00",
  });
}

test("short stay: payment after inventory recheck -> reservation -> complete", () => {
  let r = paid("SHORT_STAY");
  assert.equal(nextAction(r), "CONFIRM_RESERVATION");
  r = applyBookingEvent(r, {
    type: "RESERVATION_CONFIRMED",
    reservationId: "res_001",
  });
  assert.equal(nextAction(r), "COMPLETE");
});

test("monthly: reservation confirmed -> GMO contract -> signed", () => {
  let r = paid("MONTHLY");
  r = applyBookingEvent(r, {
    type: "RESERVATION_CONFIRMED",
    reservationId: "res_002",
  });
  assert.equal(nextAction(r), "SEND_GMO_CONTRACT");
  r = applyBookingEvent(r, { type: "CONTRACT_SENT", contractId: "ctr_001" });
  assert.equal(nextAction(r), "WAIT_GMO_SIGNATURE");
  r = applyBookingEvent(r, { type: "CONTRACT_SIGNED", contractId: "ctr_001" });
  assert.equal(nextAction(r), "COMPLETE");
});

test("payment amount mismatch never confirms reservation", () => {
  let r = base("SHORT_STAY");
  r = applyBookingEvent(r, { type: "QUOTE_ISSUED", amountYen: 100000 });
  r = applyBookingEvent(r, {
    type: "INVENTORY_RECHECKED",
    available: true,
    validUntil: "2026-10-15T03:00:00+09:00",
  });
  r = applyBookingEvent(r, { type: "PAYMENT_LINK_CREATED" });
  r = applyBookingEvent(r, {
    type: "PAYMENT_CONFIRMED",
    paymentId: "pay_bad",
    amountYen: 99999,
    nowIso: "2026-10-15T02:00:00+09:00",
  });
  assert.equal(r.state, "MANUAL_REVIEW");
  assert.equal(r.reviewReason, "PAYMENT_AMOUNT_MISMATCH");
});

test("expired inventory recheck stops automatic confirmation", () => {
  let r = base("SHORT_STAY");
  r = applyBookingEvent(r, { type: "QUOTE_ISSUED", amountYen: 100000 });
  r = applyBookingEvent(r, {
    type: "INVENTORY_RECHECKED",
    available: true,
    validUntil: "2026-10-15T01:00:00+09:00",
  });
  r = applyBookingEvent(r, { type: "PAYMENT_LINK_CREATED" });
  r = applyBookingEvent(r, {
    type: "PAYMENT_CONFIRMED",
    paymentId: "pay_late",
    amountYen: 100000,
    nowIso: "2026-10-15T02:00:00+09:00",
  });
  assert.equal(r.state, "MANUAL_REVIEW");
  assert.equal(r.reviewReason, "INVENTORY_RECHECK_EXPIRED");
});

test("short stay cannot enter GMO contract path", () => {
  let r = paid("SHORT_STAY");
  r = applyBookingEvent(r, {
    type: "RESERVATION_CONFIRMED",
    reservationId: "res_003",
  });
  assert.throws(
    () => applyBookingEvent(r, { type: "CONTRACT_SENT", contractId: "ctr_x" }),
    /CONTRACT_NOT_REQUIRED/,
  );
});

test("idempotency key is deterministic", () => {
  assert.equal(
    idempotencyKey("booking_001", "PAYMENT_LINK"),
    "gtos:booking_001:PAYMENT_LINK",
  );
});
