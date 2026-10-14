export type RevenueLaneId = 'A_DIRECT' | 'B_SNS' | 'C_UPSELL' | 'D_PARTNER' | 'E_OTA' | 'F_DIRECT_BOOKING' | 'G_MONTHLY';

export interface RevenueEvent {
  lane: RevenueLaneId;
  revenueYen: number;
  profitYen: number;
  occurredAt: string;
}

export interface LaneSummary {
  lane: RevenueLaneId;
  revenueYen: number;
  profitYen: number;
  eventCount: number;
}

export function summarizeRevenueByLane(events: RevenueEvent[]): LaneSummary[] {
  const map = new Map<RevenueLaneId, LaneSummary>();
  for (const event of events) {
    const current = map.get(event.lane) ?? { lane: event.lane, revenueYen: 0, profitYen: 0, eventCount: 0 };
    current.revenueYen += event.revenueYen;
    current.profitYen += event.profitYen;
    current.eventCount += 1;
    map.set(event.lane, current);
  }
  return [...map.values()].sort((a,b) => b.profitYen - a.profitYen);
}

export function totalProfit(events: RevenueEvent[]): number {
  return events.reduce((sum, e) => sum + e.profitYen, 0);
}
