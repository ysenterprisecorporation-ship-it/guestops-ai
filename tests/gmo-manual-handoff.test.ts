import test from "node:test";
import assert from "node:assert/strict";
import { buildGmoManualPacket } from "../src/gmo-manual-handoff.js";
import type { BookingRecord } from "../src/booking-flow.js";

function monthlyConfirmed(): BookingRecord {
  return {
    bookingId: "booking_200",
    rentalMode: "MONTHLY",
    state: "BOOKING_CONFIRMED",
    quoteAmountYen: 180000,
    paymentId: "pay_200",
    reservationId: "res_200",
  };
}

test("builds a free-plan GMO Sign manual send packet", () => {
  const packet = buildGmoManualPacket(monthlyConfirmed(), {
    recipientEmail: "guest@example.com",
    recipientName: "Guest Name",
    contractFileName: "booking_200.pdf",
  });
  assert.equal(packet.status, "READY_FOR_GMO_MANUAL_SEND");
  assert.equal(packet.recipientEmail, "guest@example.com");
  assert.match(packet.subject, /booking_200/);
  assert.ok(packet.operatorChecklist.length >= 5);
});

test("short stay cannot create GMO packet", () => {
  const r = monthlyConfirmed();
  r.rentalMode = "SHORT_STAY";
  assert.throws(
    () => buildGmoManualPacket(r, {
      recipientEmail: "guest@example.com",
      recipientName: "Guest Name",
      contractFileName: "booking_200.pdf",
    }),
    /MONTHLY_ONLY/,
  );
});

test("booking must be confirmed before GMO handoff", () => {
  const r = monthlyConfirmed();
  r.state = "PAID";
  assert.throws(
    () => buildGmoManualPacket(r, {
      recipientEmail: "guest@example.com",
      recipientName: "Guest Name",
      contractFileName: "booking_200.pdf",
    }),
    /BOOKING_MUST_BE_CONFIRMED/,
  );
});
