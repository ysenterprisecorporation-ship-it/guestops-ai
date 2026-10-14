import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRevenueByLane, totalProfit } from '../src/RevenueLanes';

test('summarizes profit by lane', () => {
  const events = [
    { lane: 'A_DIRECT' as const, revenueYen: 100000, profitYen: 80000, occurredAt: '2026-10-14T00:00:00Z' },
    { lane: 'C_UPSELL' as const, revenueYen: 50000, profitYen: 45000, occurredAt: '2026-10-14T01:00:00Z' },
    { lane: 'A_DIRECT' as const, revenueYen: 20000, profitYen: 15000, occurredAt: '2026-10-14T02:00:00Z' },
  ];
  const summary = summarizeRevenueByLane(events);
  assert.equal(summary[0].lane, 'A_DIRECT');
  assert.equal(summary[0].profitYen, 95000);
  assert.equal(totalProfit(events), 140000);
});
