import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLeadKpi } from "../src/LeadKpi.ts";
import type { LeadRecord } from "../src/LeadPipeline.ts";

function lead(status: LeadRecord["status"], revenueYen = 0, profitYen = 0): LeadRecord {
  return {
    project: "1",
    companyName: status,
    sourceUrl: "https://example.com/" + status,
    fitScore: 80,
    fitEvidence: [],
    deliveryRisk: "low",
    status,
    revenueYen,
    profitYen,
  };
}

test("summarizeLeadKpi calculates funnel metrics", () => {
  const result = summarizeLeadKpi([
    lead("delivered"),
    lead("human_reply"),
    lead("meeting"),
    lead("order", 49800, 40000),
    lead("bounced"),
  ]);
  assert.equal(result.total, 5);
  assert.equal(result.deliveredOrBetter, 4);
  assert.equal(result.humanReplies, 3);
  assert.equal(result.meetings, 2);
  assert.equal(result.orders, 1);
  assert.equal(result.revenueYen, 49800);
  assert.equal(result.profitYen, 40000);
  assert.equal(result.replyRate, 0.75);
  assert.equal(result.orderRate, 0.25);
});
