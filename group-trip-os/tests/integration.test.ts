import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBookingEvent,
  idempotencyKey,
  nextAction,
  type BookingRecord,
} from "../src/booking-flow.js";
import { SquareAdapter } from "../src/adapters/square.js";
import {
  AirHostInventoryCacheAdapter,
  type AvailabilityStore,
} from "../src/adapters/airhost-cache.js";
import { buildGmoManualPacket } from "../src/gmo-manual-handoff.js";
import {
  recordManualGmoSend,
  recordManualGmoSignature,
} from "../src/manual-contract-ops.js";

function base(mode: "SHORT_STAY" | "MONTHLY"): BookingRecord {
  return { bookingId: "booking_001", rentalMode: mode, state: "INQUIRY", quoteAmountYen: 0 };
}

function paid(mode: "SHORT_STAY" | "MONTHLY") {
  let r = base(mode);
  r = applyBookingEvent(r, { type: "QUOTE_ISSUED", amountYen: 120000 });
  r = applyBookingEvent(r, {
    type: "INVENTORY_RECHECKED",
    available: true,
    validUntil: "2026-10-15T05:00:00+09:00",
  });
  r = applyBookingEvent(r, { type: "PAYMENT_LINK_CREATED" });
  return applyBookingEvent(r, {
    type: "PAYMENT_CONFIRMED",
    paymentId: "pay_001",
    amountYen: 120000,
    nowIso: "2026-10-15T04:00:00+09:00",
  });
}

test("short stay completes after paid reservation confirmation", () => {
  let r = paid("SHORT_STAY");
  r = applyBookingEvent(r, { type: "RESERVATION_CONFIRMED", reservationId: "res_001" });
  assert.equal(nextAction(r), "COMPLETE");
});

test("monthly uses free GMO handoff after booking confirmation", () => {
  let r = paid("MONTHLY");
  r = applyBookingEvent(r, { type: "RESERVATION_CONFIRMED", reservationId: "res_002" });
  const packet = buildGmoManualPacket(r, {
    recipientEmail: "guest@example.com",
    recipientName: "Guest",
    contractFileName: "booking_001.pdf",
  });
  assert.equal(packet.status, "READY_FOR_GMO_MANUAL_SEND");
  r = applyBookingEvent(r, { type: "CONTRACT_HANDOFF_PREPARED" });
  r = recordManualGmoSend(r, "gmo_manual_001");
  r = recordManualGmoSignature(r, "gmo_manual_001");
  assert.equal(r.state, "CONTRACT_SIGNED");
});

test("payment amount mismatch goes to manual review", () => {
  let r = base("SHORT_STAY");
  r = applyBookingEvent(r, { type: "QUOTE_ISSUED", amountYen: 100000 });
  r = applyBookingEvent(r, {
    type: "INVENTORY_RECHECKED",
    available: true,
    validUntil: "2026-10-15T05:00:00+09:00",
  });
  r = applyBookingEvent(r, { type: "PAYMENT_LINK_CREATED" });
  r = applyBookingEvent(r, {
    type: "PAYMENT_CONFIRMED",
    paymentId: "pay_bad",
    amountYen: 99999,
    nowIso: "2026-10-15T04:00:00+09:00",
  });
  assert.equal(r.state, "MANUAL_REVIEW");
});

test("idempotency key is deterministic", () => {
  assert.equal(idempotencyKey("booking_001", "PAYMENT_LINK"), "gtos:booking_001:PAYMENT_LINK");
});

class MemoryStore implements AvailabilityStore {
  private readonly data = new Map<string, any>();
  async get(id: string) { return this.data.get(id) ?? null; }
  async put(value: any) { this.data.set(value.bookingKey, value); }
}

test("AirHost cache rejects stale data", async () => {
  const store = new MemoryStore();
  const adapter = new AirHostInventoryCacheAdapter(store, 5 * 60 * 1000);
  await adapter.handleAvailabilityWebhook({
    bookingId: "booking_001",
    available: true,
    sourceUpdatedAt: "2026-10-15T03:00:00+09:00",
    validUntil: "2026-10-15T05:00:00+09:00",
  });
  const result = await adapter.recheck(
    { bookingId: "booking_001", rentalMode: "SHORT_STAY", state: "QUOTED", quoteAmountYen: 80000 },
    "2026-10-15T03:10:00+09:00",
  );
  assert.equal(result.available, false);
  assert.equal(result.reason, "CACHE_STALE");
});

test("Square link uses exact JPY amount and idempotency key", async () => {
  const booking: BookingRecord = {
    bookingId: "booking_300",
    rentalMode: "SHORT_STAY",
    state: "INVENTORY_CONFIRMED",
    quoteAmountYen: 120000,
    inventoryValidUntil: "2026-10-15T05:00:00+09:00",
  };
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      payment_link: { id: "plink_1", url: "https://square.link/u/test", order_id: "order_1" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const adapter = new SquareAdapter({ accessToken: "test", locationId: "LOC1", environment: "sandbox" });
    await adapter.createPaymentLink(booking, "gtos:booking_300:PAYMENT_LINK");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.idempotency_key, "gtos:booking_300:PAYMENT_LINK");
    assert.equal(body.quick_pay.price_money.amount, 120000);
    assert.equal(body.quick_pay.price_money.currency, "JPY");
  } finally {
    globalThis.fetch = original;
  }
});


test("Square payment lookup scopes location and follows cursor", async () => {
  const booking: BookingRecord = {
    bookingId: "booking_page",
    rentalMode: "SHORT_STAY",
    state: "PAYMENT_LINK_SENT",
    quoteAmountYen: 120000,
  };
  const urls: string[] = [];
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    call++;
    const body = call === 1
      ? { payments: [], cursor: "next-page" }
      : { payments: [{ id: "pay_page", status: "COMPLETED", note: "GTOS:booking_page", order_id: "order_page", amount_money: { amount: 120000 }, created_at: "2026-10-15T04:00:00Z" }] };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const adapter = new SquareAdapter({ accessToken: "test", locationId: "LOC2", environment: "sandbox" });
    const result = await adapter.listCompletedPaymentForBooking(booking, "2026-10-15T00:00:00Z", "order_page");
    assert.equal(result.paid, true);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /location_id=LOC2/);
    assert.match(urls[1], /cursor=next-page/);
  } finally {
    globalThis.fetch = original;
  }
});
