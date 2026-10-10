// Node受信口とGASで共用する、raw通知と応答の署名対象を固定する。
export interface Envelope {
  timestamp: number;
  nonce: string;
  squareSignature: string;
  rawBody: string;
  mac: string;
}
export type ReceiptResult = "queued" | "duplicate" | "ignored";
export function envelopeText(
  e: Pick<Envelope, "timestamp" | "nonce" | "squareSignature" | "rawBody">,
): string {
  return `${e.timestamp}\n${e.nonce}\n${e.squareSignature}\n${e.rawBody}`;
}
export function receiptText(nonce: string, result: ReceiptResult): string {
  return nonce + "\n" + result;
}
// JSは暗号学的constant-timeを保証しないが、文字単位で途中終了しない。
export function equalSignature(actual: string, expected: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(actual) || actual.length !== expected.length)
    return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
