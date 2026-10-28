export interface PriceFloorPolicy {
  minimumNetPerNight: number;
  discountRates: number[];
  commissionRate: number;
  paymentRate: number;
  currencyStep?: number;
}

export function requiredPublishedNightlyRate(policy: PriceFloorPolicy): number {
  if (!Number.isFinite(policy.minimumNetPerNight) || policy.minimumNetPerNight <= 0)
    throw new Error("INVALID_MINIMUM_NET");
  for (const rate of [...policy.discountRates, policy.commissionRate, policy.paymentRate])
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1)
      throw new Error("INVALID_RATE");
  const step = policy.currencyStep ?? 100;
  if (!Number.isInteger(step) || step <= 0) throw new Error("INVALID_CURRENCY_STEP");
  const afterDiscount = policy.discountRates.reduce((total, rate) => total * (1 - rate), 1);
  const afterFees = 1 - policy.commissionRate - policy.paymentRate;
  if (afterFees <= 0) throw new Error("FEE_TOTAL_EXCEEDS_REVENUE");
  const unrounded = policy.minimumNetPerNight / (afterDiscount * afterFees);
  if (!Number.isFinite(unrounded)) throw new Error("UNREPRESENTABLE_PRICE");
  return Math.ceil(unrounded / step) * step;
}

export function satisfiesPriceFloor(publishedNightly: number, policy: PriceFloorPolicy): boolean {
  if (!Number.isFinite(publishedNightly) || publishedNightly < 0) return false;
  const afterDiscount = policy.discountRates.reduce((total, rate) => total * (1 - rate), 1);
  return publishedNightly * afterDiscount * (1 - policy.commissionRate - policy.paymentRate)
    + 1e-8 >= policy.minimumNetPerNight;
}
