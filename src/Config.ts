// 空欄は未確認。実値は環境変数/Script Propertiesから読み込み、コードへ埋め込まない。
import { PRODUCT_CATALOG } from "./ProductCatalog";

export const CONFIG = {
  A_URL: "",
  P3_URL: "",
  P10_URL: "",
  P30_URL: "",
  UPGRADE_P3_URL: "",
  UPGRADE_P10_URL: "",
  UPGRADE_P30_URL: "",
  SITE_URL: "",
  DRIVE_A: "",
  DRIVE_P3: "",
  DRIVE_P10: "",
  DRIVE_P30: "",
  DRIVE_A_URL: "",
  DRIVE_P3_URL: "",
  DRIVE_P10_URL: "",
  DRIVE_P30_URL: "",
  VARIATION_A: "",
  VARIATION_P3: "",
  VARIATION_P10: "",
  VARIATION_P30: "",
  VARIATION_UPGRADE_P3: "",
  VARIATION_UPGRADE_P10: "",
  VARIATION_UPGRADE_P30: "",
};

export function products() {
  return [
    {
      key: "A",
      price: PRODUCT_CATALOG.A.priceYen,
      variation: CONFIG.VARIATION_A,
      url: CONFIG.DRIVE_A_URL,
    },
    {
      key: "P3",
      price: PRODUCT_CATALOG.P3.priceYen,
      variation: CONFIG.VARIATION_P3,
      url: CONFIG.DRIVE_P3_URL,
    },
    {
      key: "P10",
      price: PRODUCT_CATALOG.P10.priceYen,
      variation: CONFIG.VARIATION_P10,
      url: CONFIG.DRIVE_P10_URL,
    },
    {
      key: "P30",
      price: PRODUCT_CATALOG.P30.priceYen,
      variation: CONFIG.VARIATION_P30,
      url: CONFIG.DRIVE_P30_URL,
    },
    {
      key: "UPGRADE_P3",
      price: PRODUCT_CATALOG.UPGRADE_P3_FROM_A.priceYen,
      variation: CONFIG.VARIATION_UPGRADE_P3,
      url: CONFIG.DRIVE_P3_URL,
    },
    {
      key: "UPGRADE_P10",
      price: PRODUCT_CATALOG.UPGRADE_P10_FROM_A.priceYen,
      variation: CONFIG.VARIATION_UPGRADE_P10,
      url: CONFIG.DRIVE_P10_URL,
    },
    {
      key: "UPGRADE_P30",
      price: PRODUCT_CATALOG.UPGRADE_P30_FROM_A.priceYen,
      variation: CONFIG.VARIATION_UPGRADE_P30,
      url: CONFIG.DRIVE_P30_URL,
    },
  ];
}

export function validateConfig() {
  for (const [key, value] of Object.entries(CONFIG)) {
    if (!value.trim()) throw new Error("CONFIG_UNCONFIRMED:" + key);
    if (key.endsWith("URL") && !/^https:\/\/[^\s]+$/.test(value))
      throw new Error("URL_INVALID:" + key);
  }
  if (new Set(products().map((p) => p.variation)).size !== products().length)
    throw new Error("VARIATION_NOT_UNIQUE");
}

export const CONFIG_KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];
// GASはprocess.envを提供しないため、呼出し元が設定取得方法を渡す。
export function loadConfig(read: (key: string) => string | null | undefined) {
  for (const key of CONFIG_KEYS) CONFIG[key] = read(key)?.trim() ?? "";
  validateConfig();
}
