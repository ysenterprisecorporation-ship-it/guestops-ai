import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, products } from "../src/Config";
import { purchaseEmail, deliverPurchase } from "../src/EmailService";
import type { OrderRecord } from "../src/Types";
import type { SheetService } from "../src/SheetService";
// 商品別URL・アップセルURL、二重送信防止、送信結果不明時の挙動を検証する。
beforeEach(() => {
  CONFIG.UPGRADE_P3_URL = "https://example.invalid/upgrade-p3";
  CONFIG.UPGRADE_P10_URL = "https://example.invalid/upgrade-p10";
});
function record(index = 0): OrderRecord {
  const p = products()[index];
  return {
    date: "2026-10-10T00:00:00Z",
    orderId: "order",
    email: "buyer@example.invalid",
    product: p.key,
    amount: p.price,
    url: "https://example.invalid/drive-" + p.key,
    status: "RECORDED",
  };
}
for (let i = 0; i < 5; i++)
  test("商品別メール " + i, () => {
    const r = record(i),
      message = purchaseEmail(r);
    assert.ok(message.body.includes(r.url));
    assert.ok(message.body.includes(r.orderId));
    assert.equal(message.body.includes(CONFIG.UPGRADE_P3_URL), i === 0);
    assert.equal(message.body.includes(CONFIG.UPGRADE_P10_URL), i === 0);
  });
function store(status = "RECORDED") {
  return {
    orderStatus: () => status,
    setOrderStatus: (_id: string, value: string) => {
      status = value;
    },
  } as unknown as SheetService;
}
test("正常送信後にDELIVERED、再実行で送信しない", () => {
  const s = store();
  let sent = 0;
  Object.assign(globalThis, {
    MailApp: {
      getRemainingDailyQuota: () => 10,
      sendEmail: () => {
        assert.equal(s.orderStatus("order"), "DELIVERY_SENDING");
        sent++;
      },
    },
  });
  deliverPurchase(s, record(), "admin@example.invalid");
  deliverPurchase(s, record(), "admin@example.invalid");
  assert.equal(sent, 1);
  assert.equal(s.orderStatus("order"), "DELIVERED");
});
test("送信結果が不明なら自動再送しない", () => {
  const s = store();
  let sent = 0;
  Object.assign(globalThis, {
    MailApp: {
      getRemainingDailyQuota: () => 10,
      sendEmail: () => {
        sent++;
        throw new Error();
      },
    },
  });
  assert.throws(
    () => deliverPurchase(s, record(), "admin@example.invalid"),
    /RESULT_UNCERTAIN/,
  );
  assert.equal(s.orderStatus("order"), "DELIVERY_REVIEW");
  assert.throws(
    () => deliverPurchase(s, record(), "admin@example.invalid"),
    /REVIEW_REQUIRED/,
  );
  assert.equal(sent, 1);
});
test("送信中クラッシュ状態は再送しない", () => {
  assert.throws(
    () =>
      deliverPurchase(
        store("DELIVERY_SENDING"),
        record(),
        "admin@example.invalid",
      ),
    /REVIEW_REQUIRED/,
  );
});
test("クォータ不足は送信前に再試行へ回す", () => {
  const s = store();
  Object.assign(globalThis, {
    MailApp: {
      getRemainingDailyQuota: () => 0,
      sendEmail: () => assert.fail(),
    },
  });
  assert.throws(
    () => deliverPurchase(s, record(), "admin@example.invalid"),
    /QUOTA_EXHAUSTED/,
  );
  assert.equal(s.orderStatus("order"), "RECORDED");
});
