import test from "node:test";
import assert from "node:assert/strict";
import { AirHostInventoryCacheAdapter, type AvailabilityStore } from "../src/adapters/airhost-cache.js";

class MemoryStore implements AvailabilityStore {
  private readonly data = new Map<string, any>();
  async get(id: string) { return this.data.get(id) ?? null; }
  async put(value: any) { this.data.set(value.bookingKey, value); }
}

const booking = {
  bookingId: "booking_200",
  rentalMode: "SHORT_STAY" as const,
  state: "QUOTED" as const,
  quoteAmountYen: 80000,
};

test("AirHost cache accepts fresh availability from webhook", async () => {
  const store = new MemoryStore();
  const adapter = new AirHostInventoryCacheAdapter(store, 15 * 60 * 1000);
  await adapter.handleAvailabilityWebhook({
    bookingId: booking.bookingId,
    available: true,
    sourceUpdatedAt: "2026-10-15T01:00:00+09:00",
    validUntil: "2026-10-15T01:20:00+09:00",
  });
  const result = await adapter.recheck(booking, "2026-10-15T01:10:00+09:00");
  assert.equal(result.available, true);
});

test("AirHost cache rejects stale availability", async () => {
  const store = new MemoryStore();
  const adapter = new AirHostInventoryCacheAdapter(store, 5 * 60 * 1000);
  await adapter.handleAvailabilityWebhook({
    bookingId: booking.bookingId,
    available: true,
    sourceUpdatedAt: "2026-10-15T01:00:00+09:00",
    validUntil: "2026-10-15T02:00:00+09:00",
  });
  const result = await adapter.recheck(booking, "2026-10-15T01:10:00+09:00");
  assert.equal(result.available, false);
  assert.equal(result.reason, "CACHE_STALE");
});
