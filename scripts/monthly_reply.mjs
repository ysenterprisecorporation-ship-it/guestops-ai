import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { generateMonthlyReply } from "../src/MonthlyReply.ts";
import { openAIReplyProvider } from "../src/OpenAIReplyProvider.ts";

// 内部運用専用。Webから受け取った契約・施設情報を直接渡さない。
// fixtureは架空検証。liveは既存API設定と明示的な有効化が必要。
const mode = process.argv[2];
const privateRoot = resolve(".local");
const output = resolve(process.argv[4] || ".local/monthly-reply.json");
try {
  if (!output.startsWith(privateRoot + sep))
    throw new Error("PRIVATE_OUTPUT_REQUIRED");
  let input, provider;
  if (mode === "fixture") {
    input = {
      access: {
        authorizedFacilityIds: ["fictional-facility"],
        activeUntil: "2099-01-01T00:00:00Z",
      },
      context: {
        facilityId: "fictional-facility",
        profileVersion: "fiction-v1",
        approvedFacts: { checkin: "16時" },
        escalationRules: ["返金は管理者判断"],
      },
      scenarios: ["チェックイン"],
      scenario: "チェックイン",
      anonymizedMessage: "チェックイン時刻を教えてください。",
    };
    provider = async () =>
      JSON.stringify({
        replyDraft: "チェックインは16時です。",
        factsUsed: ["checkin"],
        questions: [],
        escalations: [],
      });
  } else if (mode === "live") {
    if (process.env.MONTHLY_AI_ENABLED !== "true")
      throw new Error("AI_CALLS_DISABLED");
    const source = resolve(process.argv[3] || "");
    if (!source.startsWith(privateRoot + sep))
      throw new Error("PRIVATE_INPUT_REQUIRED");
    const raw = await readFile(source, "utf8");
    if (raw.length > 40000) throw new Error("INPUT_TOO_LARGE");
    input = JSON.parse(raw);
    if (input.entitlementSource !== "server_verified_square")
      throw new Error("VERIFIED_ENTITLEMENT_REQUIRED");
    provider = openAIReplyProvider({
      enabled: true,
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.MONTHLY_AI_MODEL || "",
      maxOutputTokens: Number(process.env.MONTHLY_MAX_OUTPUT_TOKENS || "0"),
    });
  } else throw new Error("MODE_MUST_BE_FIXTURE_OR_LIVE");
  const result = await generateMonthlyReply(
    input.access,
    input.context,
    input.scenarios,
    input.scenario,
    input.anonymizedMessage,
    new Date(),
    provider,
  );
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(
    output,
    JSON.stringify(
      { mode, liveAI: mode === "live", customerDelivered: false, result },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({ status: "DRAFT_CREATED", mode, customerDelivered: false }),
  );
} catch {
  // 例外には匿名化前入力・API応答・認証情報が含まれる可能性がある。
  console.error(
    JSON.stringify({ status: "BLOCKED", mode, liveVerified: false }),
  );
  process.exitCode = 1;
}
