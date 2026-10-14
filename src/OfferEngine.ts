export type ProductCode = 'A' | 'P3' | 'P10' | 'P30' | 'MONTHLY';

export interface PurchaseProfile {
  purchased: ProductCode[];
  facilityCount?: number;
  needsMonthlySupport?: boolean;
}

export interface NextOffer {
  code: ProductCode;
  reason: string;
}

const order: ProductCode[] = ['A', 'P3', 'P10', 'P30', 'MONTHLY'];

export function nextBestOffer(profile: PurchaseProfile): NextOffer | null {
  const owned = new Set(profile.purchased);

  if (profile.needsMonthlySupport && !owned.has('MONTHLY')) {
    return { code: 'MONTHLY', reason: 'Recurring operational support is required.' };
  }

  if ((profile.facilityCount ?? 1) >= 3 && !owned.has('P30')) {
    return { code: 'P30', reason: 'Multiple facilities make the broader package the best fit.' };
  }

  const highestIndex = Math.max(-1, ...profile.purchased.map((p) => order.indexOf(p)));

  for (let i = highestIndex + 1; i < order.length; i += 1) {
    const code = order[i];
    if (!owned.has(code)) {
      return { code, reason: 'Natural next step in the existing product ladder.' };
    }
  }

  return null;
}

export function shouldShowUpgrade(profile: PurchaseProfile): boolean {
  return nextBestOffer(profile) !== null;
}
