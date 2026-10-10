import { createHmac, timingSafeEqual } from "node:crypto";
// Square公式仕様：購読URLの完全一致文字列＋再シリアライズ前のraw body。
export function hmac(value: string | Buffer, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64");
}
export function equalMac(actual: string, expected: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(actual)) return false;
  const a = Buffer.from(actual, "base64"),
    b = Buffer.from(expected, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifySquare(
  raw: Buffer,
  signature: string,
  url: string,
  key: string,
): boolean {
  const expected = createHmac("sha256", key)
    .update(url, "utf8")
    .update(raw)
    .digest("base64");
  return equalMac(signature, expected);
}
