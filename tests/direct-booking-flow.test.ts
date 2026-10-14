import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attachCheckoutLink,
  confirmDirectBookingPayment,
  finalizeDirectBooking,
  prepareDirectBookingCheckout,
} from "../src/DirectBookingFlow";

const quote = {
  checkin: "2026-11-01",
  checkout: "2026-11-03",
  guests: 6,
  total: 78000,
  currency: "JPY" as const,
  inventoryVersion: "inv-v1",
  validUntil: "2026-10-15T02:00:00Z",
  requiresInventoryRecheck: true,
  bookingConfirmed: false as const,
  nightsDetail: [
    { date: "2026-11-01", available: true, rate: 30000 },
    { date: "2026-11-02", available: true, rate: 40000 },
  ],
};

test("④直販: 在庫再確認後にSquare決済リンク入力を作る", () => {
  const prepared = prepareDirectBookingCheckout({
    bookingId: "BOOKING_001",
    quote,
    recheckedInventoryVersion: "inv-v1",
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  });
  assert.equal(prepared.pending.state, "QUOTED");
  assert.equal(prepared.square.amount, 78000);
  assert.equal(prepared.square.idempotencyKey, "direct-BOOKING_001");
});

test("④直販: 決済完了だけでは予約確定にしない", () => {
  const prepared = prepareDirectBookingCheckout({
    bookingId: "BOOKING_002",
    quote,
    recheckedInventoryVersion: "inv-v1",
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  });
  const linked = attachCheckoutLink(prepared.pending, {
    id: "PLINK",
    order_id: "ORDER",
    url: "https://square.link/u/test",
  });
  const paid = confirmDirectBookingPayment(linked, {
    status: "COMPLETED",
    order_id: "ORDER",
    location_id: "LOC",
    amount_money: { amount: 78000, currency: "JPY" },
  });
  assert.equal(paid.state, "PAID_PENDING_FINAL_INVENTORY");
  assert.equal("bookingConfirmed" in paid, false);
});

test("④直販: 最終在庫確認後だけCONFIRMED", () => {
  const prepared = prepareDirectBookingCheckout({
    bookingId: "BOOKING_003",
    quote,
    recheckedInventoryVersion: "inv-v1",
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  });
  const linked = attachCheckoutLink(prepared.pending, {
    id: "PLINK",
    order_id: "ORDER",
    url: "https://square.link/u/test",
  });
  const paid = confirmDirectBookingPayment(linked, {
    status: "COMPLETED",
    order_id: "ORDER",
    location_id: "LOC",
    amount_money: { amount: 78000, currency: "JPY" },
  });
  const confirmed = finalizeDirectBooking({
    pending: paid,
    finalInventoryVersion: "inv-v2",
    nights: quote.nightsDetail,
  });
  assert.equal(confirmed.state, "CONFIRMED");
  assert.equal(confirmed.bookingConfirmed, true);
});

test("④直販: 在庫差異・金額差異は停止", () => {
  assert.throws(() => prepareDirectBookingCheckout({
    bookingId: "BOOKING_004",
    quote,
    recheckedInventoryVersion: "changed",
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  }), /INVENTORY_CHANGED/);
});
