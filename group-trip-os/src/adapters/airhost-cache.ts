import type { BookingRecord } from "../booking-flow.js";

export interface CachedAvailability {
  bookingKey: string;
  available: boolean;
  validUntil: string;
  sourceUpdatedAt: string;
}

export interface AvailabilityStore {
  get(bookingId: string): Promise<CachedAvailability | null>;
  put(value: CachedAvailability): Promise<void>;
}

export class AirHostInventoryCacheAdapter {
  constructor(
    private readonly store: AvailabilityStore,
    private readonly maxAgeMs = 15 * 60 * 1000,
  ) {}

  async recheck(record: BookingRecord, nowIso = new Date().toISOString()) {
    const cached = await this.store.get(record.bookingId);
    if (!cached) {
      return { available: false, validUntil: nowIso, reason: "NO_CACHED_AVAILABILITY" };
    }

    const now = Date.parse(nowIso);
    const updated = Date.parse(cached.sourceUpdatedAt);
    const validUntil = Date.parse(cached.validUntil);

    if (!Number.isFinite(now) || !Number.isFinite(updated) || !Number.isFinite(validUntil)) {
      throw new Error("AIRHOST_CACHE_TIMESTAMP_INVALID");
    }

    if (now - updated > this.maxAgeMs) {
      return { available: false, validUntil: cached.validUntil, reason: "CACHE_STALE" };
    }

    if (now > validUntil) {
      return { available: false, validUntil: cached.validUntil, reason: "CACHE_EXPIRED" };
    }

    return {
      available: cached.available,
      validUntil: cached.validUntil,
      reason: cached.available ? undefined : "INVENTORY_UNAVAILABLE",
    };
  }

  async handleAvailabilityWebhook(payload: {
    bookingId: string;
    available: boolean;
    validUntil: string;
    sourceUpdatedAt: string;
  }) {
    if (!payload.bookingId.trim()) throw new Error("BOOKING_ID_REQUIRED");
    if (!Number.isFinite(Date.parse(payload.validUntil))) throw new Error("VALID_UNTIL_INVALID");
    if (!Number.isFinite(Date.parse(payload.sourceUpdatedAt))) throw new Error("SOURCE_UPDATED_AT_INVALID");

    await this.store.put({
      bookingKey: payload.bookingId,
      available: payload.available,
      validUntil: payload.validUntil,
      sourceUpdatedAt: payload.sourceUpdatedAt,
    });
  }
}
