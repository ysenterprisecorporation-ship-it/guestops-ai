// GASにはHMAC計算APIがあるが、直接doPostのHTTPヘッダー取得APIはない。
export function verifySquareSignature(
  rawBody: string,
  signature: string | null,
  key: string,
  notificationUrl: string,
): boolean {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(
      notificationUrl + rawBody,
      key,
      Utilities.Charset.UTF_8,
    ),
  );
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
// イベントのquery/bodyに署名を偽装してもSquare標準署名ヘッダーとして扱わない。
export function directSquareSignature(): null {
  return null;
}
export function webhookCapabilities() {
  return {
    rawBodyAccessible: true,
    standardSignatureHeaderAccessible: false,
    hmacComputationAvailable: true,
    standardSquareVerificationAvailable: false,
    basis: "DOCUMENTED_GAS_WEB_APP_EVENT",
  };
}

// 実鍵はコード/引数への直書きではなくScript Propertiesから取得する入口。
export function verifySquareSignatureFromProperties(
  rawBody: string,
  signature: string | null,
): boolean {
  const properties = PropertiesService.getScriptProperties();
  const key = properties.getProperty("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const url = properties.getProperty("SQUARE_WEBHOOK_NOTIFICATION_URL");
  if (!key || !url) throw new Error("SQUARE_SIGNATURE_SETTINGS_MISSING");
  return verifySquareSignature(rawBody, signature, key, url);
}
