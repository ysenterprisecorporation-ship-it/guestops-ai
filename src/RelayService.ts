import { BusinessError } from "./Types";
import {
  envelopeText,
  receiptText,
  equalSignature,
  type Envelope,
  type ReceiptResult,
} from "./RelayProtocol";
// 実鍵はScript Propertiesから取得済みの値を渡す。GASでもSquare署名を再検証する。
function hmac(text: string, key: string): string {
  return Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(text, key, Utilities.Charset.UTF_8),
  );
}
export function verifyEnvelope(
  raw: string,
  relayKey: string,
  squareKey: string,
  notificationUrl: string,
  now = Date.now(),
): Envelope {
  if (raw.length > 70000) throw new BusinessError("RELAY_BODY_TOO_LARGE");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BusinessError("RELAY_JSON_INVALID");
  }
  if (!data || typeof data !== "object")
    throw new BusinessError("RELAY_INVALID");
  const e = data as Envelope;
  if (
    !Number.isSafeInteger(e.timestamp) ||
    Math.abs(now - e.timestamp) > 300000 ||
    typeof e.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(e.nonce) ||
    typeof e.rawBody !== "string" ||
    e.rawBody.length > 32768 ||
    typeof e.squareSignature !== "string" ||
    typeof e.mac !== "string"
  )
    throw new BusinessError("RELAY_INVALID");
  if (!equalSignature(e.mac, hmac(envelopeText(e), relayKey)))
    throw new BusinessError("RELAY_SIGNATURE_INVALID");
  if (
    !equalSignature(
      e.squareSignature,
      hmac(notificationUrl + e.rawBody, squareKey),
    )
  )
    throw new BusinessError("SQUARE_SIGNATURE_INVALID");
  return e;
}
export function makeReceipt(nonce: string, result: ReceiptResult, key: string) {
  return { nonce, result, mac: hmac(receiptText(nonce, result), key) };
}
