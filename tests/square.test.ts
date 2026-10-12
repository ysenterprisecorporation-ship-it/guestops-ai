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
