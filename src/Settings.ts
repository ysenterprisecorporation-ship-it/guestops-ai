import { CONFIG_KEYS, loadConfig } from "./Config";
// ローカル環境変数とGAS Script Propertiesで同じ検証規則を使用する。
export const RUNTIME_KEYS = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_API_VERSION",
  "SQUARE_ENVIRONMENT",
  "SQUARE_LOCATION_ID",
  "SQUARE_MERCHANT_ID",
  "SPREADSHEET_ID",
  "ADMIN_EMAIL",
  "RELAY_SHARED_SECRET",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_WEBHOOK_NOTIFICATION_URL",
  "BUYER_EMAIL_ENABLED",
  "AUTOMATION_ENABLED",
] as const;
export const PROPERTY_KEYS = [...CONFIG_KEYS, ...RUNTIME_KEYS];
export function loadSettings(read: (key: string) => string | null | undefined) {
  loadConfig(read);
  function required(key: string) {
    const value = read(key)?.trim();
    if (!value) throw new Error("PROPERTY_UNCONFIRMED:" + key);
    return value;
  }
  const environment = required("SQUARE_ENVIRONMENT");
  if (!["sandbox", "production"].includes(environment))
    throw new Error("ENVIRONMENT_INVALID");
  const secret = required("RELAY_SHARED_SECRET");
  if (!/^[A-Za-z0-9_-]{43,}$/.test(secret)) throw new Error("SECRET_TOO_SHORT");
  const version = required("SQUARE_API_VERSION");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version))
    throw new Error("API_VERSION_INVALID");
  const admin = required("ADMIN_EMAIL");
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(admin))
    throw new Error("ADMIN_EMAIL_INVALID");
  if (!["true", "false"].includes(required("AUTOMATION_ENABLED")))
    throw new Error("ENABLED_INVALID");
  const signatureKey = required("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const notificationUrl = required("SQUARE_WEBHOOK_NOTIFICATION_URL");
  if (!/^https:\/\/[^\s]+$/.test(notificationUrl))
    throw new Error("NOTIFICATION_URL_INVALID");
  const buyerEmail = required("BUYER_EMAIL_ENABLED");
  if (!["true", "false"].includes(buyerEmail))
    throw new Error("BUYER_EMAIL_ENABLED_INVALID");
  return {
    signatureKey,
    notificationUrl,
    buyerEmail: buyerEmail === "true",
    environment,
    secret,
    version,
    admin,
    location: required("SQUARE_LOCATION_ID"),
    merchant: required("SQUARE_MERCHANT_ID"),
    token: required("SQUARE_ACCESS_TOKEN"),
    spreadsheet: required("SPREADSHEET_ID"),
  };
}
