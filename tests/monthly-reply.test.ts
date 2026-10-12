import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMonthlyReply, validateReply } from "../src/MonthlyReply";
const context = {
  facilityId: "fixture",
  profileVersion: "v1",
  approvedFacts: { checkin: "16時" },
  escalationRules: ["返金は管理者判断"],
};
test("生成結果の不正JSON・不正項目・不明な根拠キーは受理しない", () => {
  for (const raw of [
    "invalid",
    "null",
    "[]",
    '{"replyDraft":1}',
    JSON.stringify({
      replyDraft: "案",
      factsUsed: ["refund"],
      questions: [],
      escalations: [],
    }),
  ])
    assert.throws(() => validateReply(raw, context));
});
test("失効契約ではAIプロバイダを呼ばない", async () => {
  let calls = 0;
  await assert.rejects(
    generateMonthlyReply(
      { authorizedFacilityIds: ["fixture"], activeUntil: "2026-10-01" },
      context,
      ["到着"],
      "到着",
      "到着",
      new Date("2026-10-12"),
      async () => {
        calls++;
        return "{}";
      },
    ),
    /EXPIRED/,
  );
  assert.equal(calls, 0);
});
test("受理した返信案でも人の確認を省かない", async () => {
  const value = await generateMonthlyReply(
    { authorizedFacilityIds: ["fixture"], activeUntil: "2026-11-01" },
    context,
    ["到着"],
    "到着",
    "到着",
    new Date("2026-10-12"),
    async () =>
      JSON.stringify({
        replyDraft: "チェックインは16時です。",
        factsUsed: ["checkin"],
        questions: [],
        escalations: [],
      }),
  );
  assert.equal(value.reviewRequired, true);
});
