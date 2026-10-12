import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifySquareSignature,
  directSquareSignature,
  webhookCapabilities,
} from "../src/SquareSignature";
// GAS Utilitiesの公開HMAC APIを模擬する。実ヘッダーが得られたとは主張しない。
beforeEach(() =>
  Object.assign(globalThis, {
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      computeHmacSha256Signature: (text: string, key: string) =>
        Array.from(createHmac("sha256", key).update(text).digest()),
      base64Encode: (bytes: number[]) => Buffer.from(bytes).toString("base64"),
    },
  }),
);
test("GAS HMAC関数はSquare公式ベクトルに一致", () =>
  assert.equal(
    verifySquareSignature(
      '{"hello":"world"}',
      "2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=",
      "asdf1234",
      "https://example.com/webhook",
    ),
    true,
  ));
test("本文改変を拒否", () =>
  assert.equal(
    verifySquareSignature(
      '{"hello": "world"}',
      "2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=",
      "asdf1234",
      "https://example.com/webhook",
    ),
    false,
  ));
test("署名なしでは検証成功にしない", () =>
  assert.equal(
    verifySquareSignature("{}", null, "key", "https://example.invalid"),
    false,
  ));
test("直接GASに署名取得APIがないことを明示", () => {
  assert.equal(directSquareSignature(), null);
  assert.equal(
    webhookCapabilities().standardSquareVerificationAvailable,
    false,
  );
  assert.equal(webhookCapabilities().hmacComputationAvailable, true);
});

test("署名検証入口はScript Propertiesから鍵と通知URLを読む", async () => {
  Object.assign(globalThis, {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === "SQUARE_WEBHOOK_SIGNATURE_KEY"
            ? "asdf1234"
            : key === "SQUARE_WEBHOOK_NOTIFICATION_URL"
              ? "https://example.com/webhook"
              : null,
      }),
    },
  });
  const { verifySquareSignatureFromProperties } =
    await import("../src/SquareSignature");
  assert.equal(
    verifySquareSignatureFromProperties(
      '{"hello":"world"}',
      "2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=",
    ),
    true,
  );
});
