import { products } from "./Config";
// 既存Driveへのアクセス・権限変更・フォルダ変更は行わない。
export function deliveryUrl(key: string): string {
  const url = products().find((p) => p.key === key)?.url;
  if (!url) throw new Error("DELIVERY_URL_UNCONFIRMED");
  return url;
}
