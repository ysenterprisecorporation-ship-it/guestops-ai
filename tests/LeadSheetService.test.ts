import test from "node:test";
import assert from "node:assert/strict";
import { leadToRow, rowToLead } from "../src/LeadSheetService.ts";
import type { LeadRecord } from "../src/LeadPipeline.ts";

const lead: LeadRecord = {
  project: "2",
  companyName: "=Danger Hotel",
  sourceUrl: "https://example.com",
  officialContact: "sales@example.com",
  contactType: "email",
  fitScore: 88,
  fitEvidence: ["multiple facilities", "24h support"],
  deliveryRisk: "low",
  status: "qualified",
  revenueYen: 0,
  profitYen: 0,
  lastEventAt: "2026-10-14T08:00:00.000Z",
};

test("leadToRow protects spreadsheet formulas", () => {
  const row = leadToRow(lead);
  assert.equal(row[1], "'=Danger Hotel");
});

test("rowToLead restores lead fields", () => {
  const restored = rowToLead(leadToRow(lead));
  assert.equal(restored.project, "2");
  assert.equal(restored.fitScore, 88);
  assert.deepEqual(restored.fitEvidence, ["multiple facilities", "24h support"]);
  assert.equal(restored.status, "qualified");
});
