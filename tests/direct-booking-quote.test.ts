import { test } from "node:test";
import assert from "node:assert/strict";
import { directBookingQuote } from "../src/DirectBookingQuote";
const input = {
  checkin: "2026-11-01",
  checkout: "2026-11-03",
  guests: 6,
  maxGuests: 9,
  minimumNights: 2,
  cleaningFee: 8000,
  inventory: [
    { date: "2026-11-01", available: true, rate: 30000 },
    { date: "2026-11-02", available: true, rate: 40000 },
  ],
  inventoryVersion: "fiction-v1",
  validUntil: "2026-10-12T09:00:00Z",
  now: new Date("2026-10-12T08:00:00Z"),
};
test("架空2泊の料金を計算しチェックアウト日は加算しない", () => {
  const quote = directBookingQuote(input);
  assert.equal(quote.total, 78000);
  assert.equal(quote.nights, 2);
  assert.equal(quote.bookingConfirmed, false);
  assert.equal(quote.requiresInventoryRecheck, true);
});
test("古い在庫・欠けた在庫・二重行・満室では課金用見積を生成しない", () => {
  assert.throws(
    () => directBookingQuote({ ...input, validUntil: input.now.toISOString() }),
    /STALE/,
  );
  assert.throws(
    () =>
      directBookingQuote({ ...input, inventory: input.inventory.slice(0, 1) }),
    /UNAVAILABLE/,
  );
  assert.throws(
    () =>
      directBookingQuote({
        ...input,
        inventory: [...input.inventory, input.inventory[0]],
      }),
    /UNAVAILABLE/,
  );
  assert.throws(
    () =>
      directBookingQuote({
        ...input,
        inventory: input.inventory.map((x) => ({ ...x, available: false })),
      }),
    /UNAVAILABLE/,
  );
});
test("定員超過・最低泊数・存在しない日付・不正金額は拒否", () => {
  for (const changed of [
    { guests: 10 },
    { checkout: "2026-11-02" },
    { checkin: "2026-02-30" },
    { cleaningFee: -1 },
  ])
    assert.throws(() => directBookingQuote({ ...input, ...changed }));
});
