import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, products, validateConfig } from "../src/Config";
import { getRecord, validateOrder } from "../src/OrderService";
import { paymentHint } from "../src/SquareWebhook";
import { runJob } from "../src/QueueService";
import {
  BusinessError,
  RetryError,
  type Payment,
  type Order,
  type Job,
} from "../src/Types";
import { textCell } from "../src/SheetService";
// 実資産にアクセスせず、7商品とすべての異常系を確認する。
beforeEach(() => {
  for (const key of Object.keys(CONFIG) as (keyof typeof CONFIG)[])
    CONFIG[key] = key.endsWith("URL") ? "https://example.invalid/" + key : key;
});
function fixture(index = 0): { payment: Payment; order: Order } {
  const p = products()[index];
  return {
    payment: {
      id: "pay-1",
      status: "COMPLETED",
      order_id: "order-1",
      location_id: "location",
      amount_money: { amount: p.price, currency: "JPY" },
      buyer_email_address: "buyer@example.invalid",
    },
    order: {
      id: "order-1",
      state: "COMPLETED",
      location_id: "location",
      created_at: "2026-10-10T00:00:00Z",
      total_money: { amount: p.price, currency: "JPY" },
      line_items: [
        {
          catalog_object_id: p.variation,
          quantity: "1",
          base_price_money: { amount: p.price, currency: "JPY" },
        },
      ],
    },
  };
}
for (const [index, name] of [
  "A",
  "P3",
  "P10",
  "P30",
  "UPGRADE_P3",
  "UPGRADE_P10",
  "UPGRADE_P30",
].entries())
  test("購入正常：" + name, () => {
    const f = fixture(index),
      record = validateOrder(f.payment, f.order, "location");
    assert.equal(record.product, name);
    assert.equal(record.amount, products()[index].price);
    assert.equal(record.url, products()[index].url);
  });
test("価格違い", () => {
  const f = fixture();
  f.payment.amount_money.amount++;
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /PRICE_MISMATCH/,
  );
});
test("返金済みのCOMPLETED決済は納品しない", () => {
  const f = fixture();
  f.payment.refunded_money = { amount: 1, currency: "JPY" };
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /PAYMENT_REFUNDED/,
  );
});
test("返金0円のCOMPLETED決済は従来どおり通す", () => {
  const f = fixture();
  f.payment.refunded_money = { amount: 0, currency: "JPY" };
  assert.equal(validateOrder(f.payment, f.order, "location").orderId, "order-1");
});
test("不正な返金情報を納品許可に変換しない", () => {
  for (const refunded of [
    { amount: "0", currency: "JPY" },
    { amount: 0, currency: "USD" },
    null,
    { amount: -1, currency: "JPY" },
  ]) {
    const f = fixture();
    f.payment.refunded_money = refunded as Payment["refunded_money"];
    assert.throws(
      () => validateOrder(f.payment, f.order, "location"),
      /PAYMENT_REFUNDED/,
    );
  }
});
test("ゼロ円・JPYのチップは正常な決済として扱う", () => {
  const f = fixture();
  f.payment.tip_money = { amount: 0, currency: "JPY" };
  assert.equal(validateOrder(f.payment, f.order, "location").orderId, "order-1");
});
test("不正なチップ情報をゼロ円として扱わず納品を拒否", () => {
  for (const tip of [
    { amount: 0, currency: "USD" },
    { amount: "0", currency: "JPY" },
    { amount: -1, currency: "JPY" },
    { amount: 1, currency: "JPY" },
    null,
  ]) {
    const f = fixture();
    f.payment.tip_money = tip as Payment["tip_money"];
    assert.throws(
      () => validateOrder(f.payment, f.order, "location"),
      /PRICE_MISMATCH/,
    );
  }
});
test("商品なし", () => {
  const f = fixture();
  f.order.line_items = [];
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /UNSUPPORTED_CART/,
  );
});
test("未知商品を価格だけで判定しない", () => {
  const f = fixture();
  f.order.line_items![0].catalog_object_id = "other";
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /PRODUCT_UNKNOWN/,
  );
});
test("通貨違い", () => {
  const f = fixture();
  f.payment.amount_money.currency = "USD";
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /PRICE_MISMATCH/,
  );
});
test("店舗違い", () => {
  const f = fixture();
  assert.throws(
    () => validateOrder(f.payment, f.order, "other"),
    /LOCATION_MISMATCH/,
  );
});
test("メール未取得は推測で補完しない", () => {
  const f = fixture();
  delete f.payment.buyer_email_address;
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    /EMAIL_MISSING/,
  );
});
test("未完了注文は再試行", () => {
  const f = fixture();
  f.order.state = "OPEN";
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    RetryError,
  );
});
test("キャンセル済みは記録しない", () => {
  const f = fixture();
  f.order.state = "CANCELED";
  assert.throws(
    () => validateOrder(f.payment, f.order, "location"),
    BusinessError,
  );
});
test("支払ID一致を確認", () => {
  const f = fixture();
  assert.throws(
    () =>
      getRecord(
        { payment: () => f.payment, order: () => f.order },
        "wrong",
        "location",
      ),
    /PAYMENT_ID_MISMATCH/,
  );
});
test("注文IDなし", () => {
  const f = fixture();
  delete f.payment.order_id;
  assert.throws(
    () =>
      getRecord(
        { payment: () => f.payment, order: () => f.order },
        "pay-1",
        "location",
      ),
    /ORDER_MISSING/,
  );
});
function job(): Job {
  return {
    paymentId: "pay-1",
    attempts: 0,
    nextAt: 0,
    state: "PENDING",
    notified: false,
  };
}
test("通信失敗：初回＋3回、1/2/4分で永続再試行", () => {
  let j = job(),
    now = 0;
  for (let i = 1; i <= 4; i++) {
    const result = runJob(j, now, () => {
      throw new RetryError("NETWORK");
    });
    assert.equal(j.attempts, i);
    assert.equal(result.level, i === 4 ? "ERROR" : "WARN");
    if (i < 4) {
      assert.equal(j.nextAt - now, 60000 * 2 ** (i - 1));
      now = j.nextAt;
    }
    j = JSON.parse(JSON.stringify(j));
  }
  assert.equal(j.state, "FAILED");
});
test("再試行後成功", () => {
  const j = job();
  runJob(j, 0, () => {
    throw new Error();
  });
  runJob(j, j.nextAt, () => {});
  assert.equal(j.state, "DONE");
  assert.equal(j.attempts, 2);
});
test("価格違いなどは即時エラー", () => {
  const j = job();
  runJob(j, 0, () => {
    throw new BusinessError("PRICE_MISMATCH");
  });
  assert.equal(j.state, "FAILED");
  assert.equal(j.attempts, 1);
});
test("期限前にAPIを呼ばない", () => {
  const j = job();
  j.nextAt = 1000;
  assert.throws(() => runJob(j, 0, () => assert.fail()), /NOT_DUE/);
});
function event(status = "COMPLETED", type = "payment.updated") {
  return JSON.stringify({
    merchant_id: "merchant",
    type,
    data: { object: { payment: { id: "pay-1", status } } },
  });
}
test("通知の決済IDだけ使用", () =>
  assert.equal(paymentHint(event(), "merchant"), "pay-1"));
test("未完了通知を無視", () =>
  assert.equal(paymentHint(event("PENDING"), "merchant"), null));
test("対象外イベントを無視", () =>
  assert.equal(
    paymentHint(event("COMPLETED", "refund.updated"), "merchant"),
    null,
  ));
test("merchant違い", () =>
  assert.throws(() => paymentHint(event(), "other"), /MERCHANT_MISMATCH/));
test("壊れたJSON", () =>
  assert.throws(() => paymentHint("{", "merchant"), /INVALID_JSON/));
test("大きすぎる本文", () =>
  assert.throws(
    () => paymentHint("x".repeat(32769), "merchant"),
    /BODY_TOO_LARGE/,
  ));
test("設定漏れは停止", () => {
  CONFIG.A_URL = "";
  assert.throws(validateConfig, /UNCONFIRMED/);
});
test("variation ID重複", () => {
  CONFIG.VARIATION_P3 = CONFIG.VARIATION_A;
  assert.throws(validateConfig, /NOT_UNIQUE/);
});
test("設定URLのHTTPS必須", () => {
  CONFIG.A_URL = "http://example.invalid";
  assert.throws(validateConfig, /URL_INVALID/);
});
test("数式注入防止", () => {
  assert.equal(textCell("=IMPORTXML(...)"), "'=IMPORTXML(...)");
  assert.equal(textCell("buyer@example.invalid"), "buyer@example.invalid");
});
