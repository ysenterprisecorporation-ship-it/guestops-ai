import { randomBytes } from "node:crypto";
import { verifySquare, hmac, equalMac } from "./Signature";
import {
  envelopeText,
  receiptText,
  type ReceiptResult,
} from "../src/RelayProtocol";
export interface ReceiverSettings {
  signatureKey: string;
  notificationUrl: string;
  gasUrl: string;
  relayKey: string;
  enabled: boolean;
}
// プラットフォーム非依存。署名検証済み通知だけGASへ転送し、永続保存の署名付き応答を待つ。
export async function handleWebhook(
  raw: Buffer,
  signature: string,
  settings: ReceiverSettings,
  request: typeof fetch = fetch,
): Promise<{ status: number; code: string }> {
  if (!settings.enabled) return { status: 503, code: "DISABLED" };
  if (raw.length > 32768) return { status: 413, code: "BODY_TOO_LARGE" };
  if (
    !verifySquare(
      raw,
      signature,
      settings.notificationUrl,
      settings.signatureKey,
    )
  )
    return { status: 403, code: "SIGNATURE_INVALID" };
  const rawBody = raw.toString("utf8");
  if (!Buffer.from(rawBody, "utf8").equals(raw))
    return { status: 400, code: "UTF8_INVALID" };
  const envelope = {
    timestamp: Date.now(),
    nonce: randomBytes(16).toString("hex"),
    squareSignature: signature,
    rawBody,
  };
  const mac = hmac(envelopeText(envelope), settings.relayKey);
  try {
    const response = await request(settings.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...envelope, mac }),
      redirect: "follow",
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return { status: 503, code: "GAS_UNAVAILABLE" };
    const text = await response.text();
    if (text.length > 4096) return { status: 503, code: "GAS_RECEIPT_INVALID" };
    const ack = JSON.parse(text) as {
      nonce?: string;
      result?: string;
      mac?: string;
    };
    if (
      ack.nonce !== envelope.nonce ||
      !["queued", "duplicate", "ignored"].includes(ack.result ?? "") ||
      typeof ack.mac !== "string" ||
      !equalMac(
        ack.mac,
        hmac(
          receiptText(envelope.nonce, ack.result as ReceiptResult),
          settings.relayKey,
        ),
      )
    )
      return { status: 503, code: "GAS_RECEIPT_INVALID" };
    return { status: 200, code: "ACCEPTED" };
  } catch {
    return { status: 503, code: "GAS_UNAVAILABLE" };
  }
}
