import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDirectBookingCheckout,
  processDirectBookingPayment,
  type DirectBookingStore,
  type DirectInventoryGateway,
} from "../src/DirectBookingAutomation";
import type { PendingDirectBooking } from "../src/DirectBookingFlow";

function makeStore(): DirectBookingStore & { rows: PendingDirectBooking[] } {
  const rows: PendingDirectBooking[] = [];
  return {
    rows,
    save(record) {
      const i = rows.findIndex((x) => x.bookingId === record.bookingId);
      if (i >= 0) rows[i] = record;
      else rows.push(record);
    },
    bySquareOrderId(orderId) {
      return rows.find((x) => x.squareOrderId === orderId) ?? null;
    },
  };
}

function inventory(): DirectInventoryGateway & { commits: number } {
  return {
    commits: 0,
    read() {
      return {
        version: "inv-v1",
        validUntil: "2026-10-15T02:00:00Z",
        nights: [
          { date: "2026-11-01", available: true, rate: 30000 },
          { date: "2026-11-02", available: true, rate: 40000 },
        ],
      };
    },
    commit(input) {
      assert.equal(input.expectedVersion, "inv-v1");
      this.commits += 1;
      return {
        version: "inv-v2",
        nights: [
          { date: "2026-11-01", available: true, rate: 30000 },
          { date: "2026-11-02", available: true, rate: 40000 },
        ],
      };
    },
  };
}

test("④自動化: 見積→在庫再確認→Squareリンク→保存", () => {
  const store = makeStore();
  const inv = inventory();
  const square = {
    createQuickPayLink: () => ({
      id: "PLINK",
      order_id: "ORDER",
      url: "https://square.link/u/test",
    }),
    payment: () => {
      throw new Error("unused");
    },
  };
  const result = createDirectBookingCheckout({
    bookingId: "BOOKING_100",
    checkin: "2026-11-01",
    checkout: "2026-11-03",
    guests: 6,
    maxGuests: 9,
    minimumNights: 2,
    cleaningFee: 8000,
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  }, { inventory: inv, square, store });

  assert.equal(result.quote.total, 78000);
  assert.equal(result.pending.state, "CHECKOUT_CREATED");
  assert.equal(store.rows.length, 1);
});

test("④自動化: Square決済後、PMS在庫確保成功時だけ予約確定", () => {
  const store = makeStore();
  const inv = inventory();
  const square = {
    createQuickPayLink: () => ({
      id: "PLINK",
      order_id: "ORDER",
      url: "https://square.link/u/test",
    }),
    payment: () => ({
      status: "COMPLETED",
      order_id: "ORDER",
      location_id: "LOC",
      amount_money: { amount: 78000, currency: "JPY" },
    }),
  };
  createDirectBookingCheckout({
    bookingId: "BOOKING_101",
    checkin: "2026-11-01",
    checkout: "2026-11-03",
    guests: 6,
    maxGuests: 9,
    minimumNights: 2,
    cleaningFee: 8000,
    locationId: "LOC",
    propertyName: "Tokyo Designer House",
    now: new Date("2026-10-15T01:00:00Z"),
  }, { inventory: inv, square, store });

  const result = processDirectBookingPayment({ paymentId: "PAY" }, {
    inventory: inv,
    square,
    store,
  });
  assert.equal(inv.commits, 1);
  assert.equal(result.state, "CONFIRMED");
  assert.equal(store.rows[0].state, "CONFIRMED");
});
