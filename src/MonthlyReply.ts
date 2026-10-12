import {
  monthlyPrompt,
  type MonthlyAccess,
  type MonthlyContext,
} from "./MonthlyPrompt";

export interface ReplyDraft {
  replyDraft: string;
  factsUsed: string[];
  questions: string[];
  escalations: string[];
  reviewRequired: true;
}
export function validateReply(
  raw: string,
  context: MonthlyContext,
): ReplyDraft {
  if (raw.length > 20000) throw new Error("REPLY_TOO_LARGE");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("REPLY_JSON_INVALID");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("REPLY_SCHEMA_INVALID");
  const v = value as Record<string, unknown>;
  if (typeof v.replyDraft !== "string" || v.replyDraft.length > 6000)
    throw new Error("REPLY_SCHEMA_INVALID");
  for (const key of ["factsUsed", "questions", "escalations"])
    if (
      !Array.isArray(v[key]) ||
      v[key].length > 50 ||
      v[key].some((x) => typeof x !== "string" || x.length > 1000)
    )
      throw new Error("REPLY_SCHEMA_INVALID");
  const factsUsed = v.factsUsed as string[];
  if (
    factsUsed.some(
      (key) =>
        !Object.prototype.hasOwnProperty.call(context.approvedFacts, key),
    )
  )
    throw new Error("FACT_REFERENCE_UNKNOWN");
  // 根拠キーの形式チェックは、生成文の事実性を証明するものではない。
  return {
    replyDraft: v.replyDraft,
    factsUsed,
    questions: v.questions as string[],
    escalations: v.escalations as string[],
    reviewRequired: true,
  };
}
export async function generateMonthlyReply(
  access: MonthlyAccess,
  context: MonthlyContext,
  scenarios: readonly string[],
  scenario: string,
  anonymizedMessage: string,
  now: Date,
  provider: (request: { system: string; user: string }) => Promise<string>,
) {
  const request = monthlyPrompt(
    access,
    context,
    scenarios,
    scenario,
    anonymizedMessage,
    now,
  );
  // API実装は注入する。既存買い切りのGAS実行入口には接続していない。
  return validateReply(await provider(request), context);
}
