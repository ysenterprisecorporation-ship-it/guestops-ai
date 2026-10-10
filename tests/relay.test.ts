import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleWebhook, type ReceiverSettings } from "../receiver/Handler";
import { hmac } from "../receiver/Signature";
import { envelopeText, receiptText } from "../src/RelayProtocol";
import { verifyEnvelope } from "../src/RelayService";
import { receiverSettings } from "../receiver/Settings";
const config: ReceiverSettings = {
  enabled: true,
  signatureKey: "square-key",
  notificationUrl: "https://example.invalid/webhook",
  gasUrl: "https://script.google.com/macros/s/script/exec",
  relayKey: "x".repeat(43),
};
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
const raw = Buffer.from('{"event_id":"event-1"}');
function signature() {
  return hmac(config.notificationUrl + raw.toString(), config.signatureKey);
}
test("署名検証→GAS署名検証→永続保存応答を確認した場合だけ200", async () => {
  const mock: typeof fetch = async (_url, options) => {
    const envelope = verifyEnvelope(
      String(options?.body),
      config.relayKey,
      config.signatureKey,
      config.notificationUrl,
    );
    return new Response(
      JSON.stringify({
        nonce: envelope.nonce,
        result: "queued",
        mac: hmac(receiptText(envelope.nonce, "queued"), config.relayKey),
      }),
    );
  };
  assert.equal(
    (await handleWebhook(raw, signature(), config, mock)).status,
    200,
  );
});
test("無効なSquare署名はGASへ転送しない", async () => {
  assert.equal(
    (
      await handleWebhook(raw, "wrong", config, async () => {
        assert.fail();
      })
    ).status,
    403,
  );
});
test("HTMLエラーページの200を保存成功と誤認しない", async () => {
  assert.equal(
    (
      await handleWebhook(
        raw,
        signature(),
        config,
        async () => new Response("<html>error</html>"),
      )
    ).status,
    503,
  );
});
test("署名なしのqueued応答を拒否", async () => {
  assert.equal(
    (
      await handleWebhook(
        raw,
        signature(),
        config,
        async () => new Response('{"result":"queued"}'),
      )
    ).status,
    503,
  );
});
test("GAS応答nonce不一致を拒否", async () => {
  assert.equal(
    (
      await handleWebhook(
        raw,
        signature(),
        config,
        async () =>
          new Response(
            JSON.stringify({
              nonce: "other",
              result: "queued",
              mac: hmac("other\nqueued", config.relayKey),
            }),
          ),
      )
    ).status,
    503,
  );
});
test("転送タイムアウト・通信失敗はSquare再送対象503", async () => {
  assert.equal(
    (
      await handleWebhook(raw, signature(), config, async () => {
        throw new Error("private");
      })
    ).status,
    503,
  );
});
test("停止中は503", async () =>
  assert.equal(
    (await handleWebhook(raw, signature(), { ...config, enabled: false }))
      .status,
    503,
  ));
test("古い転送署名を拒否", () => {
  const e = {
    timestamp: 0,
    nonce: "a".repeat(32),
    squareSignature: signature(),
    rawBody: raw.toString(),
  };
  assert.throws(
    () =>
      verifyEnvelope(
        JSON.stringify({ ...e, mac: hmac(envelopeText(e), config.relayKey) }),
        config.relayKey,
        config.signatureKey,
        config.notificationUrl,
        600000,
      ),
    /RELAY_INVALID/,
  );
});
test("転送署名が有効でもSquare署名改変をGASが拒否", () => {
  const e = {
    timestamp: Date.now(),
    nonce: "a".repeat(32),
    squareSignature: hmac("wrong", "key"),
    rawBody: raw.toString(),
  };
  assert.throws(
    () =>
      verifyEnvelope(
        JSON.stringify({ ...e, mac: hmac(envelopeText(e), config.relayKey) }),
        config.relayKey,
        config.signatureKey,
        config.notificationUrl,
      ),
    /SQUARE_SIGNATURE_INVALID/,
  );
});
test("受信設定なしで有効化できない", () =>
  assert.throws(
    () => receiverSettings({ RECEIVER_ENABLED: "true" }),
    /SETTINGS_MISSING/,
  ));
test("停止中は初回URL未確定でも起動設定を生成", () =>
  assert.equal(receiverSettings({}).enabled, false));
