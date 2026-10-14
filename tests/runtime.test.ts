import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { CONFIG, products } from "../src/Config";
import {
  doPost,
  processQueue,
  setupAutomation,
  configureAutomation,
  stopAutomation,
} from "../src/Runtime";
// Apps Script境界を模擬し、通知からAPI再照合・シート・ログ・管理者通知まで通す。
class Sheet {
  rows: unknown[][] = [];
  getLastRow() {
    return this.rows.length;
  }
  appendRow(row: unknown[]) {
    this.rows.push(row);
  }
  getRange(r: number, c: number, n = 1, w = 1) {
    return {
      getValues: () =>
        this.rows.slice(r - 1, r - 1 + n).map((v) => v.slice(c - 1, c - 1 + w)),
      setValue: (v: unknown) => {
        this.rows[r - 1][c - 1] = v;
      },
    };
  }
}
let sheets: Map<string, Sheet>,
  props: Map<string, string>,
  mail: { to: string; body: string }[],
  triggers: string[],
  requests: number;
let priceOffset: number, networkFail: boolean;
beforeEach(() => {
  for (const k of Object.keys(CONFIG) as (keyof typeof CONFIG)[])
    CONFIG[k] = k.endsWith("URL") ? "https://example.invalid/" + k : k;
  sheets = new Map();
  mail = [];
  triggers = [];
  requests = 0;
  priceOffset = 0;
  networkFail = false;
  props = new Map(
    Object.entries({
      ...CONFIG,
      AUTOMATION_ENABLED: "true",
      SQUARE_WEBHOOK_SIGNATURE_KEY: "square-key",
      SQUARE_WEBHOOK_NOTIFICATION_URL: "https://example.invalid/webhook",
      BUYER_EMAIL_ENABLED: "false",
      WEBHOOK_VERIFICATION_MODE: "API_RECHECK",
      SQUARE_ENVIRONMENT: "sandbox",
      WEBHOOK_URL_SECRET: "x".repeat(43),
      SQUARE_API_VERSION: "2026-01-22",
      ADMIN_EMAIL: "admin@example.invalid",
      SQUARE_LOCATION_ID: "loc",
      SQUARE_MERCHANT_ID: "merchant",
      SQUARE_ACCESS_TOKEN: "mock-only",
      SPREADSHEET_ID: "book",
    }),
  );
  const book = {
    getSheetByName: (n: string) => sheets.get(n),
    insertSheet: (n: string) => {
      const s = new Sheet();
      sheets.set(n, s);
      return s;
    },
  };
  Object.assign(globalThis, {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
        setProperties: (data: Record<string, string>) => {
          for (const [key, value] of Object.entries(data))
            props.set(key, value);
        },
        deleteProperty: (key: string) => props.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
    SpreadsheetApp: { openById: () => book, flush: () => {} },
    HtmlService: { createHtmlOutput: (value: string) => ({ value }) },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (value: string) => ({
        value,
        setMimeType() {
          return this;
        },
      }),
    },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      computeHmacSha256Signature: (text: string, key: string) =>
        Array.from(createHmac("sha256", key).update(text).digest()),
      base64Encode: (bytes: number[]) => Buffer.from(bytes).toString("base64"),
    },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map((n) => ({ getHandlerFunction: () => n })),
      newTrigger: (n: string) => ({
        timeBased: () => ({
          everyMinutes: () => ({ create: () => triggers.push(n) }),
        }),
      }),
      deleteTrigger: () => {
        triggers = [];
      },
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: (
        to: string | { to: string; body: string },
        _subject?: string,
        body?: string,
      ) =>
        mail.push(
          typeof to === "string"
            ? { to, body: body ?? "" }
            : { to: to.to, body: to.body },
        ),
    },
    UrlFetchApp: {
      fetch: (url: string) => {
        requests++;
        if (networkFail) throw new Error("private message must not leak");
        const index = Number(url.split("-").pop()),
          product = products()[index];
        const payment = {
          id: "pay-" + index,
          status: "COMPLETED",
          order_id: "order-" + index,
          location_id: "loc",
          amount_money: {
            amount: product.price + priceOffset,
            currency: "JPY",
          },
          buyer_email_address: "buyer@example.invalid",
        };
        const order = {
          id: "order-" + index,
          state: "COMPLETED",
          location_id: "loc",
          created_at: "2026-10-10T00:00:00Z",
          total_money: { amount: product.price, currency: "JPY" },
          line_items: [
            {
              catalog_object_id: product.variation,
              quantity: "1",
              base_price_money: { amount: product.price, currency: "JPY" },
            },
          ],
        };
        return {
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify(
              url.includes("/payments/") ? { payment } : { order },
            ),
        };
      },
    },
  });
  setupAutomation();
});
function event(index = 0, key = "x".repeat(43)) {
  return {
    parameter: { key },
    postData: {
      contents: JSON.stringify({
        merchant_id: "merchant",
        type: "payment.updated",
        data: {
          object: { payment: { id: "pay-" + index, status: "COMPLETED" } },
        },
      }),
    },
  } as unknown as GoogleAppsScript.Events.DoPost;
}
test("5商品：Webhook→Square再照合→Orders→Logs、購入者メール送信なし", () => {
  for (let i = 0; i < products().length; i++) doPost(event(i));
  processQueue();
  assert.equal(sheets.get("Orders")!.rows.length, 6);
  assert.equal(requests, 10);
  assert.equal(mail.length, 0);
  assert.equal(
    sheets.get("Logs")!.rows.filter((r) => r[1] === "PROCESS_PAYMENT").length,
    products().length,
  );
});
test("Webhook重複と再処理でも注文1行", () => {
  doPost(event());
  doPost(event());
  processQueue();
  processQueue();
  assert.equal(sheets.get("Orders")!.rows.length, 2);
  assert.equal(requests, 2);
});
test("秘密不一致でAPI・QUEUEにアクセスしない", () => {
  const count = sheets.get("Logs")!.rows.length;
  doPost(event(0, "wrong"));
  processQueue();
  assert.equal(requests, 0);
  assert.equal(sheets.get("Logs")!.rows.length, count);
});
test("価格違いは管理者のみ通知", () => {
  priceOffset = 1;
  doPost(event());
  processQueue();
  processQueue();
  assert.equal(sheets.get("Orders")!.rows.length, 1);
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, "admin@example.invalid");
});
test("通信失敗を3回再試行後に管理者通知", () => {
  networkFail = true;
  doPost(event());
  for (let i = 0; i < 4; i++) {
    const queue = sheets.get("Logs")!.rows.find((r) => r[1] === "QUEUE")!;
    const state = JSON.parse(String(queue[3]));
    state.nextAt = 0;
    queue[3] = JSON.stringify(state);
    processQueue();
  }
  assert.equal(requests, 4);
  assert.equal(mail.length, 1);
  assert.equal(sheets.get("Orders")!.rows.length, 1);
  assert.ok(
    !JSON.stringify(sheets.get("Logs")!.rows).includes("private message"),
  );
});
test("セットアップ再実行はトリガーを増やさない", () => {
  setupAutomation();
  assert.equal(triggers.length, 1);
});
test("停止時はAPIにアクセスしない", () => {
  doPost(event());
  stopAutomation();
  processQueue();
  assert.equal(requests, 0);
  assert.equal(props.get("AUTOMATION_ENABLED"), "false");
  assert.equal(triggers.length, 0);
});

test("JSONセットアップは設定保存後も停止状態、秘密JSONは削除", () => {
  const values = Object.fromEntries(props);
  values.AUTOMATION_ENABLED = "true";
  props.set("BOOTSTRAP_CONFIG_JSON", JSON.stringify(values));
  configureAutomation();
  assert.equal(props.get("AUTOMATION_ENABLED"), "false");
  assert.equal(props.has("BOOTSTRAP_CONFIG_JSON"), false);
});
test("不正JSONは既存設定を上書きしない", () => {
  props.set("BOOTSTRAP_CONFIG_JSON", JSON.stringify({ unexpected: "value" }));
  assert.throws(configureAutomation, /KEYS_INVALID/);
  assert.equal(props.get("AUTOMATION_ENABLED"), "true");
});

test("商品別Drive案内を購入者へ送信、重複再送なし", () => {
  props.set("BUYER_EMAIL_ENABLED", "true");
  for (let i = 0; i < 5; i++) doPost(event(i));
  processQueue();
  processQueue();
  assert.equal(mail.length, products().length);
  assert.ok(mail.every((m) => m.to === "buyer@example.invalid"));
  assert.equal(
    sheets.get("Orders")!.rows.filter((r) => r[6] === "DELIVERED").length,
    5,
  );
  assert.ok(mail[0].body.includes(CONFIG.UPGRADE_P3_URL));
});
test("署名必須モードは直接通知を処理しない", () => {
  props.set("WEBHOOK_VERIFICATION_MODE", "REQUIRE_SIGNATURE");
  assert.throws(() => doPost(event()), /SQUARE_SIGNATURE_HEADER_UNAVAILABLE/);
  assert.equal(sheets.get("Orders")!.rows.length, 1);
  assert.equal(
    sheets.get("Logs")!.rows.filter((r) => r[1] === "QUEUE").length,
    0,
  );
  assert.equal(mail.length, 0);
});
test("body/queryへ署名を付けても標準署名として扱わない", () => {
  props.set("WEBHOOK_VERIFICATION_MODE", "REQUIRE_SIGNATURE");
  const e = event();
  e.parameter.signature = "fake";
  assert.throws(() => doPost(e), /SQUARE_SIGNATURE_HEADER_UNAVAILABLE/);
});

test("署名必須へ切替後は既存の未検証QUEUEも処理しない", () => {
  doPost(event());
  props.set("WEBHOOK_VERIFICATION_MODE", "REQUIRE_SIGNATURE");
  assert.throws(processQueue, /SQUARE_SIGNATURE_HEADER_UNAVAILABLE/);
  assert.equal(requests, 0);
  assert.equal(mail.length, 0);
  assert.equal(sheets.get("Orders")!.rows.length, 1);
});
