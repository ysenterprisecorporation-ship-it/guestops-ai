import test from "node:test";
import assert from "node:assert/strict";
import { runBookingStep, type AutomationPorts } from "../src/automation-runner.js";
import type { BookingRecord } from "../src/booking-flow.js";

function record(state: BookingRecord["state"], mode: BookingRecord["rentalMode"] = "SHORT_STAY"): BookingRecord {
  return {
    bookingId: "booking_100",
    rentalMode: mode,
    state,
    quoteAmountYen: 100000,
    inventoryValidUntil: "2026-10-15T03:00:00+09:00",
    paymentId: state === "PAID" || state === "BOOKING_CONFIRMED" ? "pay_100" : undefined,
    reservationId: state === "BOOKING_CONFIRMED" ? "res_100" : undefined,
  };
}

function ports(overrides: Partial<AutomationPorts> = {}): AutomationPorts {
  const saved: BookingRecord[] = [];
  return {
    recheckInventory: async () => ({ available: true, validUntil: "2026-10-15T03:00:00+09:00" }),
    createPaymentLink: async () => ({ url: "https://example.invalid/pay" }),
    getPayment: async () => ({ paid: true, paymentId: "pay_100", amountYen: 100000, paidAtIso: "2026-10-15T02:00:00+09:00" }),
    confirmReservation: async () => ({ reservationId: "res_100" }),
    sendContract: async () => ({ contractId: "ctr_100" }),
    isContractSigned: async () => true,
    save: async (r) => { saved.push(r); },
    ...overrides,
  };
}

test("inventory step advances quoted booking", async () => {
  const next = await runBookingStep(record("QUOTED"), ports());
  assert.equal(next.state, "INVENTORY_CONFIRMED");
});

test("unpaid booking stays waiting", async () => {
  const next = await runBookingStep(
    record("PAYMENT_LINK_SENT"),
    ports({ getPayment: async () => ({ paid: false }) }),
  );
  assert.equal(next.state, "PAYMENT_LINK_SENT");
});

test("paid booking confirms reservation on next action", async () => {
  const next = await runBookingStep(record("PAID"), ports());
  assert.equal(next.state, "BOOKING_CONFIRMED");
  assert.equal(next.reservationId, "res_100");
});

test("monthly booking sends GMO contract", async () => {
  const r = record("BOOKING_CONFIRMED", "MONTHLY");
  const next = await runBookingStep(r, ports());
  assert.equal(next.state, "CONTRACT_SENT");
  assert.equal(next.contractId, "ctr_100");
});

test("short stay never sends contract", async () => {
  let calls = 0;
  const next = await runBookingStep(
    record("BOOKING_CONFIRMED", "SHORT_STAY"),
    ports({ sendContract: async () => { calls += 1; return { contractId: "x" }; } }),
  );
  assert.equal(next.state, "BOOKING_CONFIRMED");
  assert.equal(calls, 0);
});
