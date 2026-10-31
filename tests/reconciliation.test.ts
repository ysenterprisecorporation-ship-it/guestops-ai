import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, products } from "../src/Config";
import {
  reconcilePaymentPage,
  validateReconciliationWindow,
} from "../src/PaymentReconciliation";
import { RetryError, type Payment, type Order } from "../src/Types";
import { SquareService } from "../src/SquareService";
beforeEach(() => {
  for (const key of Object.keys(CONFIG) as (keyof typeof CONFIG)[])
    CONFIG[key] = key.endsWith("URL") ? "https://example.invalid/" + key : key;
});
function fixture() {
  const p = products()[0];
  const payment: Payment = {
    id: "p",
    status: "COMPLETED",
    order_id: "o",
    location_id: "loc",
    amount_money: { amount: p.price, currency: "JPY" },
    buyer_email_address: "buyer@example.invalid",
  };
  const order: Order = {
    id: "o",
    location_id: "loc",
    state: "COMPLETED",
    created_at: "2026-10-10T00:00:00Z",
    total_money: payment.amount_money,
    line_items: [
      {
        quantity: "1",
        catalog_object_id: p.variation,
        base_price_money: payment.amount_money,
      },
    ],
  };
  return {
    payment,
    order,
    api: { payment: () => payment, order: () => order },
  };
}
test("recovery verifies API order, queues once, and makes no revenue claim", () => {
  const f = fixture();
  const ids: string[] = [];
  const r = reconcilePaymentPage([f.payment, f.payment], f.api, "loc", (id) => {
    ids.push(id);
    return true;
  });
  assert.deepEqual(ids, ["p"]);
  assert.equal(r.queued, 1);
  assert.equal(r.customerRevenueVerified, false);
});
test("unknown product and price mismatch never enqueue", () => {
  const f = fixture();
  f.order.line_items![0].catalog_object_id = "other";
  let called = false;
  assert.equal(
    reconcilePaymentPage([f.payment], f.api, "loc", () => {
      called = true;
      return true;
    }).skipped,
    1,
  );
  f.order.line_items![0].catalog_object_id = products()[0].variation;
  f.payment.amount_money = { amount: 1, currency: "JPY" };
  assert.equal(
    reconcilePaymentPage([f.payment], f.api, "loc", () => {
      called = true;
      return true;
    }).review,
    1,
  );
  assert.equal(called, false);
});
test("partially refunded COMPLETED payment never enters delivery queue", () => {
  const f = fixture();
  f.payment.refunded_money = { amount: 1, currency: "JPY" };
  let enqueued = false;
  const result = reconcilePaymentPage([f.payment], f.api, "loc", () => {
    enqueued = true;
    return true;
  });
  assert.equal(enqueued, false);
  assert.equal(result.queued, 0);
  assert.equal(result.review, 1);
  assert.equal(result.customerRevenueVerified, false);
});
test("temporary API failure aborts recovery rather than skipping payment", () => {
  const f = fixture();
  assert.throws(
    () =>
      reconcilePaymentPage(
        [f.payment],
        {
          payment: () => {
            throw new RetryError("SQUARE_NETWORK");
          },
          order: f.api.order,
        },
        "loc",
        () => true,
      ),
    RetryError,
  );
});
test("recovery rejects unbounded or future window", () => {
  validateReconciliationWindow("2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z");
  assert.throws(() =>
    validateReconciliationWindow(
      "2026-10-01T00:00:00Z",
      "2026-10-11T00:00:00Z",
    ),
  );
  assert.throws(() =>
    validateReconciliationWindow(
      "2099-10-10T00:00:00Z",
      "2099-10-11T00:00:00Z",
    ),
  );
});
test("list payments uses read-only endpoint, bounded page and opaque cursor", () => {
  Object.assign(globalThis, {
    UrlFetchApp: {
      fetch: (url: string, options: { method: string }) => {
        assert.equal(options.method, "get");
        const parsed = new URL(url);
        assert.equal(parsed.pathname, "/v2/payments");
        assert.equal(parsed.searchParams.get("location_id"), "loc");
        assert.equal(parsed.searchParams.get("cursor"), "opaque/+cursor");
        assert.equal(parsed.searchParams.get("limit"), "100");
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ cursor: "next" }),
        };
      },
    },
  });
  assert.deepEqual(
    new SquareService("mock", "confirmed", "sandbox").listPayments(
      "begin",
      "end",
      "loc",
      "opaque/+cursor",
    ),
    { payments: [], cursor: "next" },
  );
});
