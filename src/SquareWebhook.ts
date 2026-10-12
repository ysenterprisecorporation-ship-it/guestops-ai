import { BusinessError } from "./Types";
// GASは署名ヘッダーを公開しない。通知は未認証のヒント。
export function paymentHint(raw: string, merchant: string): string | null {
  if (raw.length > 32768) throw new BusinessError("BODY_TOO_LARGE");
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new BusinessError("INVALID_JSON");
  }
  if (!event || event.merchant_id !== merchant)
    throw new BusinessError("MERCHANT_MISMATCH");
  if (!["payment.created", "payment.updated"].includes(event.type)) return null;
  if (event.data?.object?.payment?.status !== "COMPLETED") return null;
  const id = event.data?.object?.payment?.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,192}$/.test(id))
    throw new BusinessError("PAYMENT_ID_INVALID");
  return id;
}
