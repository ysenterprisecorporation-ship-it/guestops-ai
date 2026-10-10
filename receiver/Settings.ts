import type { ReceiverSettings } from "./Handler";
// 受信口の秘密値はホスト環境のシークレット注入を使う。停止中はURL未確定でも起動できる。
export function receiverSettings(
  env: Record<string, string | undefined>,
): ReceiverSettings {
  const enabled = env.RECEIVER_ENABLED === "true";
  if (!["true", "false"].includes(env.RECEIVER_ENABLED ?? "false"))
    throw new Error("RECEIVER_ENABLED_INVALID");
  const result = {
    enabled,
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "",
    notificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL ?? "",
    gasUrl: env.GAS_WEB_APP_URL ?? "",
    relayKey: env.RELAY_SHARED_SECRET ?? "",
  };
  if (enabled) {
    for (const value of Object.values(result))
      if (value === "") throw new Error("RECEIVER_SETTINGS_MISSING");
    if (!/^[A-Za-z0-9_-]{43,}$/.test(result.relayKey))
      throw new Error("RELAY_SECRET_INVALID");
    const gas = new URL(result.gasUrl),
      notification = new URL(result.notificationUrl);
    if (
      gas.protocol !== "https:" ||
      gas.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(gas.pathname) ||
      gas.search ||
      gas.hash ||
      gas.username ||
      gas.password
    )
      throw new Error("GAS_URL_INVALID");
    if (
      notification.protocol !== "https:" ||
      notification.hash ||
      notification.username ||
      notification.password
    )
      throw new Error("NOTIFICATION_URL_INVALID");
  }
  return result;
}
