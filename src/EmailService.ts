import { CONFIG } from "./Config";
import { BusinessError, RetryError, type OrderRecord } from "./Types";
import type { SheetService } from "./SheetService";
// 既存URLをそのまま使い、商品内容やDrive共有権限を変更しない。
export function purchaseEmail(record: OrderRecord) {
  const names: Record<string, string> = {
    A: "A",
    P3: "P3",
    P10: "P10",
    P30: "P30",
    UPGRADE_P3: "P3（差額購入）",
    UPGRADE_P10: "P10（差額購入）",
    UPGRADE_P30: "P30（差額購入）",
  };
  const name = names[record.product];
  if (!name) throw new BusinessError("EMAIL_PRODUCT_UNKNOWN");
  const lines = [
    `GuestOps AI ${name} をご購入いただきありがとうございます。`,
    "",
    `注文ID：${record.orderId}`,
    `購入金額：${record.amount.toLocaleString("ja-JP")}円`,
    "",
    "ご購入商品のGoogle Driveフォルダ：",
    record.url,
    "フォルダ内の案内PDFからお読みください。",
  ];
  if (record.product === "A")
    lines.push(
      "",
      "追加購入は任意です。今回の商品の受取に追加購入は必要ありません。",
      "A購入者向けの差額アップグレード（同じ購入者の利用施設数を拡張）：",
      "P3は最大3施設、P10は最大10施設、P30は最大30施設です。",
      "個別開発・設定代行・自動送信を追加する商品ではありません。",
      "P3差額購入：" + CONFIG.UPGRADE_P3_URL,
      "P10差額購入：" + CONFIG.UPGRADE_P10_URL,
      "P30差額購入：" + CONFIG.UPGRADE_P30_URL,
    );
  lines.push("", "ご不明な点はこのメールへ返信してください。");
  return {
    subject: `GuestOps AI ${name}：ご購入商品のご案内`,
    body: lines.join("\n"),
  };
}
// 送信前に状態を永続化。送信結果が不明な場合は自動再送せず管理者確認へ回す。
export function deliverPurchase(
  store: SheetService,
  record: OrderRecord,
  replyTo: string,
) {
  const status = store.orderStatus(record.orderId);
  if (status === "DELIVERED") return;
  if (["DELIVERY_SENDING", "DELIVERY_REVIEW"].includes(status))
    throw new BusinessError("DELIVERY_REVIEW_REQUIRED");
  if (MailApp.getRemainingDailyQuota() < 1)
    throw new RetryError("MAIL_QUOTA_EXHAUSTED");
  const message = purchaseEmail(record);
  store.setOrderStatus(record.orderId, "DELIVERY_SENDING");
  try {
    MailApp.sendEmail({
      to: record.email,
      subject: message.subject,
      body: message.body,
      replyTo,
      name: "GuestOps AI",
    });
  } catch {
    store.setOrderStatus(record.orderId, "DELIVERY_REVIEW");
    throw new BusinessError("DELIVERY_RESULT_UNCERTAIN");
  }
  store.setOrderStatus(record.orderId, "DELIVERED");
}
