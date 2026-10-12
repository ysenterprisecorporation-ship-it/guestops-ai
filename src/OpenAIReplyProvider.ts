// OpenAI Responses API接続候補。プロバイダ・モデル・費用承認は別途必要。
// このモジュールは既存GAS入口には接続しない。認証値・応答本文をログに出さない。
type Transport = (url: string, init: RequestInit) => Promise<Response>;
export function openAIReplyProvider(
  config: {
    enabled: boolean;
    apiKey: string;
    model: string;
    maxOutputTokens: number;
  },
  transport: Transport = fetch,
) {
  return async (request: { system: string; user: string }): Promise<string> => {
    if (!config.enabled) throw new Error("AI_CALLS_DISABLED");
    if (!config.apiKey.trim() || !config.model.trim())
      throw new Error("AI_CONFIGURATION_REQUIRED");
    if (
      !Number.isInteger(config.maxOutputTokens) ||
      config.maxOutputTokens < 16 ||
      config.maxOutputTokens > 4096
    )
      throw new Error("AI_OUTPUT_LIMIT_INVALID");
    let response: Response;
    try {
      response = await transport("https://api.openai.com/v1/responses", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: "Bearer " + config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          instructions: request.system,
          input: request.user,
          max_output_tokens: config.maxOutputTokens,
          store: false,
          text: { format: { type: "json_object" } },
        }),
      });
    } catch {
      throw new Error("AI_REQUEST_RESULT_UNKNOWN");
    }
    // タイムアウト・429・5xxでも勝手に再送しない。二重課金の可能性を残す。
    if (!response.ok) throw new Error("AI_HTTP_" + response.status);
    const raw = await response.text();
    if (raw.length > 100000) throw new Error("AI_RESPONSE_TOO_LARGE");
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("AI_RESPONSE_INVALID");
    }
    if (!value || typeof value !== "object")
      throw new Error("AI_RESPONSE_INVALID");
    const result = value as Record<string, unknown>;
    if (result.status !== "completed" || !Array.isArray(result.output))
      throw new Error("AI_RESPONSE_INCOMPLETE");
    const messages: string[] = [];
    for (const item of result.output) {
      if (
        !item ||
        item.type !== "message" ||
        item.role !== "assistant" ||
        !Array.isArray(item.content)
      )
        continue;
      for (const block of item.content) {
        if (block.type === "refusal") throw new Error("AI_REFUSED");
        if (block.type === "output_text" && typeof block.text === "string")
          messages.push(block.text);
      }
    }
    if (messages.length !== 1) throw new Error("AI_OUTPUT_AMBIGUOUS");
    return messages[0];
  };
}
