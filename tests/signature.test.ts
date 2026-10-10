import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySquare, hmac } from "../receiver/Signature";
// 公式ドキュメントの既知ベクトルに加え、1バイト改変・URL違いを検証する。
test("Square公式の署名ベクトル", () => {
  assert.equal(
    verifySquare(
      Buffer.from('{"hello":"world"}'),
      "2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=",
      "https://example.com/webhook",
      "asdf1234",
    ),
    true,
  );
});
test("raw JSONの空白変更を検出", () => {
  const url = "https://example.invalid/webhook",
    raw = '{"x":1}',
    sig = hmac(url + raw, "key");
  assert.equal(verifySquare(Buffer.from('{"x": 1}'), sig, url, "key"), false);
});
test("通知URL違い・署名なし・鍵違いを拒否", () => {
  const raw = Buffer.from("{}"),
    sig = hmac("https://example.invalid/webhook{}", "key");
  assert.equal(
    verifySquare(raw, sig, "https://other.invalid/webhook", "key"),
    false,
  );
  assert.equal(
    verifySquare(raw, "", "https://example.invalid/webhook", "key"),
    false,
  );
  assert.equal(
    verifySquare(raw, sig, "https://example.invalid/webhook", "other"),
    false,
  );
});
