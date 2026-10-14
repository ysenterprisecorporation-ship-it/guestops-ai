export const PRODUCT_CATALOG = {
  A: { priceYen: 2980 },
  P3: { priceYen: 19800 },
  P10: { priceYen: 49800 },
  P30: { priceYen: 99800 },
  UPGRADE_P3_FROM_A: { priceYen: 16820 },
  UPGRADE_P10_FROM_A: { priceYen: 46820 },
  UPGRADE_P30_FROM_A: { priceYen: 96820 },
} as const;

export type ProductCatalogKey = keyof typeof PRODUCT_CATALOG;

export function catalogPrice(key: ProductCatalogKey): number {
  return PRODUCT_CATALOG[key].priceYen;
}
