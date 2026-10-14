import { test } from "node:test";
import assert from "node:assert/strict";
import {
  markMonthlyRentalSent,
  markMonthlyRentalSigned,
  prepareMonthlyRentalForGmoSign,
} from "../src/MonthlyRentalFlow";

const base = {
  caseId: "MONTHLY_001",
  propertyName: "Tokyo Designer House",
  tenantName: "Test Tenant",
  tenantEmail: "tenant@example.com",
  startDate: "2027-01-05",
  endDate: "2027-02-05",
  rentYen: 420000,
  cleaningFeeYen: 15000,
  depositYen: 100000,
  templateId: "GMO_TEMPLATE_01",
  identityChecked: true,
  termsReviewed: true,
};

test("④マンスリー: GMOサイン送信前の必須条件を固定", () => {
  const ready = prepareMonthlyRentalForGmoSign(base);
  assert.equal(ready.state, "READY_FOR_GMO_SIGN");
});

test("④マンスリー: 本人確認・契約条件レビュー無しでは送信準備しない", () => {
  assert.throws(() => prepareMonthlyRentalForGmoSign({ ...base, identityChecked: false }), /IDENTITY/);
  assert.throws(() => prepareMonthlyRentalForGmoSign({ ...base, termsReviewed: false }), /TERMS/);
});

test("④マンスリー: GMO封筒IDを付けて署名完了まで状態管理", () => {
  const ready = prepareMonthlyRentalForGmoSign(base);
  const sent = markMonthlyRentalSent(ready, "ENV_001");
  assert.equal(sent.state, "SENT_FOR_SIGNATURE");
  assert.equal(markMonthlyRentalSigned(sent).state, "SIGNED");
});
