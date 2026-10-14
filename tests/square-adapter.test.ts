import test from "node:test";
import assert from "node:assert/strict";
import { SquareAdapter } from "../src/adapters/square.js";
import type { BookingRecord } from "../src/booking-flow.js";

const booking: BookingRecord = {
  bookingId: "booking_300",
  rentalMode: "SHORT_STAY",
  state: "INVENTORY_CONFIRMED",
  quoteAmountYen: 120000,
  inventoryValidUntil: "2026-10-15T04:00:00+09:00",
};

test("Square createPaymentLink sends exact JPY amount and idempotency key", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      payment_link: {
        id: "plink_1",
        url: "https://square.link/u/test",
        order_id: "order_1",
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const adapter = new SquareAdapter({
      accessToken: "test-token",
      locationId: "LOC1",
      environment: "sandbox",
    });
    const result = await adapter.createPaymentLink(booking, "gtos:booking_300:PAYMENT_LINK");
    assert.equal(result.paymentLinkId, "plink_1");
    assert.equal(calls.length, 1);
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.idempotency_key, "gtos:booking_300:PAYMENT_LINK");
    assert.equal(body.quick_pay.price_money.amount, 120000);
    assert.equal(body.quick_pay.price_money.currency, "JPY");
    assert.equal(body.quick_pay.location_id, "LOC1");
  } finally {
    globalThis.fetch = original;
  }
});

test("Square payment lookup accepts only completed exact-amount booking marker", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    payments: [
      {
        id: "wrong_amount",
        status: "COMPLETED",
        amount_money: { amount: 119999 },
        created_at: "2026-10-15T01:00:00Z",
        note: "GTOS:booking_300",
      },
      {
        id: "right",
        status: "COMPLETED",
        amount_money: { amount: 120000 },
        created_at: "2026-10-15T01:01:00Z",
        note: "GTOS:booking_300",
      },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const adapter = new SquareAdapter({
      accessToken: "test-token",
      locationId: "LOC1",
      environment: "sandbox",
    });
    const result = await adapter.listCompletedPaymentForBooking(
      booking,
      "2026-10-15T00:00:00Z",
    );
    assert.equal(result.paid, true);
    assert.equal(result.paymentId, "right");
    assert.equal(result.amountYen, 120000);
  } finally {
    globalThis.fetch = original;
  }
});

test("Square payment lookup never treats wrong booking marker as paid", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    payments: [
      {
        id: "other",
        status: "COMPLETED",
        amount_money: { amount: 120000 },
        created_at: "2026-10-15T01:01:00Z",
        note: "GTOS:booking_other",
      },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const adapter = new SquareAdapter({
      accessToken: "test-token",
      locationId: "LOC1",
      environment: "sandbox",
    });
    const result = await adapter.listCompletedPaymentForBooking(
      booking,
      "2026-10-15T00:00:00Z",
    );
    assert.equal(result.paid, false);
  } finally {
    globalThis.fetch = original;
  }
});
