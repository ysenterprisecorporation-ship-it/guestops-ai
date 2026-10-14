import { test } from "node:test";
import assert from "node:assert/strict";
import { SquareService } from "../src/SquareService";
import { BusinessError, RetryError } from "../src/Types";
// APIのURL・版・HTTPエラー分類を模擬する。実トークンは使用しない。
function response(status: number, body: string) {
  Object.assign(globalThis, {
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => status,
        getContentText: () => body,
      }),
    },
  });
}
for (const status of [429, 500, 503])
  test("Square一時エラー " + status, () => {
    response(status, "{}");
    assert.throws(
      () => new SquareService("mock", "test-version", "sandbox").payment("p"),
      RetryError,
    );
  });
for (const status of [400, 401, 403, 404])
  test("Square確定エラー " + status, () => {
    response(status, "{}");
    assert.throws(
      () => new SquareService("mock", "test-version", "sandbox").payment("p"),
      BusinessError,
    );
  });
test("通信例外に秘密メッセージを引き継がない", () => {
  Object.assign(globalThis, {
    UrlFetchApp: {
      fetch: () => {
        throw new Error("private");
      },
    },
  });
  assert.throws(
    () => new SquareService("mock", "test-version", "sandbox").payment("p"),
    /SQUARE_NETWORK/,
  );
});
test("壊れたAPI JSONは再試行", () => {
  response(200, "{");
  assert.throws(
    () => new SquareService("mock", "test-version", "sandbox").payment("p"),
    RetryError,
  );
});
test("空のAPIレスポンスは再試行", () => {
  response(200, "{}");
  assert.throws(
    () => new SquareService("mock", "test-version", "sandbox").payment("p"),
    RetryError,
  );
});
test("GETのみ、Sandboxホストと指定API版を使う", () => {
  Object.assign(globalThis, {
    UrlFetchApp: {
      fetch: (
        url: string,
        options: { method: string; headers: Record<string, string> },
      ) => {
        assert.equal(
          url,
          "https://connect.squareupsandbox.com/v2/orders/order%2Fid",
        );
        assert.equal(options.method, "get");
        assert.equal(options.headers["Square-Version"], "confirmed-version");
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ order: { id: "order/id" } }),
        };
      },
    },
  });
  assert.equal(
    new SquareService("mock", "confirmed-version", "sandbox").order("order/id")
      .id,
    "order/id",
  );
});


test("直販見積をSquareホスト型決済リンクへ変換する", () => {
  Object.assign(globalThis, {
    UrlFetchApp: {
      fetch: (
        url: string,
        options: {
          method: string;
          headers: Record<string, string>;
          contentType: string;
          payload: string;
        },
      ) => {
        assert.equal(
          url,
          "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
        );
        assert.equal(options.method, "post");
        assert.equal(options.contentType, "application/json");
        const body = JSON.parse(options.payload);
        assert.equal(body.quick_pay.price_money.amount, 87500);
        assert.equal(body.quick_pay.price_money.currency, "JPY");
        assert.equal(body.quick_pay.location_id, "LOC");
        assert.equal(body.checkout_options.redirect_url, "https://example.com/thanks");
        return {
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              payment_link: {
                id: "PLINK",
                order_id: "ORDER",
                url: "https://square.link/u/example",
              },
            }),
        };
      },
    },
  });
  const link = new SquareService("mock", "confirmed-version", "sandbox")
    .createQuickPayLink({
      idempotencyKey: "quote-abc",
      locationId: "LOC",
      name: "Tokyo Designer House 2 nights",
      amount: 87500,
      redirectUrl: "https://example.com/thanks",
      note: "direct-booking quote abc",
    });
  assert.equal(link.order_id, "ORDER");
  assert.equal(link.url, "https://square.link/u/example");
});

test("直販決済リンクの金額・redirectを事前検証する", () => {
  const service = new SquareService("mock", "confirmed-version", "sandbox");
  assert.throws(
    () =>
      service.createQuickPayLink({
        idempotencyKey: "x",
        locationId: "LOC",
        name: "stay",
        amount: 0,
      }),
    /CHECKOUT_AMOUNT_INVALID/,
  );
  assert.throws(
    () =>
      service.createQuickPayLink({
        idempotencyKey: "x",
        locationId: "LOC",
        name: "stay",
        amount: 1000,
        redirectUrl: "http://unsafe.example",
      }),
    /CHECKOUT_REDIRECT_INVALID/,
  );
});
