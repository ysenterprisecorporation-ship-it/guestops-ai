// 空欄は未確認。実値は環境変数/Script Propertiesから読み込み、コードへ埋め込まない。
export const CONFIG = {
  A_URL: "",
  P3_URL: "",
  P10_URL: "",
  UPGRADE_P3_URL: "",
  UPGRADE_P10_URL: "",
  SITE_URL: "",
  DRIVE_A: "",
  DRIVE_P3: "",
  DRIVE_P10: "",
  DRIVE_A_URL: "",
  DRIVE_P3_URL: "",
  DRIVE_P10_URL: "",
  VARIATION_A: "",
  VARIATION_P3: "",
  VARIATION_P10: "",
  VARIATION_UPGRADE_P3: "",
  VARIATION_UPGRADE_P10: "",
};
export function products() {
  return [
    {
      key: "A",
      price: 2980,
      variation: CONFIG.VARIATION_A,
      url: CONFIG.DRIVE_A_URL,
    },
    {
      key: "P3",
      price: 29800,
      variation: CONFIG.VARIATION_P3,
      url: CONFIG.DRIVE_P3_URL,
    },
    {
      key: "P10",
      price: 99800,
      variation: CONFIG.VARIATION_P10,
      url: CONFIG.DRIVE_P10_URL,
    },
    {
      key: "UPGRADE_P3",
      price: 26820,
      variation: CONFIG.VARIATION_UPGRADE_P3,
      url: CONFIG.DRIVE_P3_URL,
    },
    {
      key: "UPGRADE_P10",
      price: 96820,
      variation: CONFIG.VARIATION_UPGRADE_P10,
      url: CONFIG.DRIVE_P10_URL,
    },
  ];
}
export function validateConfig() {
  for (const [key, value] of Object.entries(CONFIG)) {
    if (!value.trim()) throw new Error("CONFIG_UNCONFIRMED:" + key);
    if (key.endsWith("URL") && !/^https:\/\/[^\s]+$/.test(value))
      throw new Error("URL_INVALID:" + key);
  }
  if (new Set(products().map((p) => p.variation)).size !== 5)
    throw new Error("VARIATION_NOT_UNIQUE");
}

export const CONFIG_KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];
// GASはprocess.envを提供しないため、呼出し元が設定取得方法を渡す。
export function loadConfig(read: (key: string) => string | null | undefined) {
  for (const key of CONFIG_KEYS) CONFIG[key] = read(key)?.trim() ?? "";
  validateConfig();
}
