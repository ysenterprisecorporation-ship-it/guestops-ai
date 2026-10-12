import { test } from "node:test";
import assert from "node:assert/strict";
import { openAIReplyProvider } from "../src/OpenAIReplyProvider";
const config = {
  enabled: true,
  apiKey: "fixture-key-not-real",
  model: "fixture-model",
  maxOutputTokens: 512,
};
const request = { system: "Return JSON", user: "anonymous fixture" };
test("既定の停止設定では有料通信しない", async () => {
  let calls = 0;
  await assert.rejects(
    openAIReplyProvider({ ...config, enabled: false }, async () => {
      calls++;
      throw new Error();
    })(request),
    /DISABLED/,
  );
  assert.equal(calls, 0);
});
test("固定公式エンドポイント・出力上限・保存無効で1回だけ送信", async () => {
  let calls = 0;
  const provider = openAIReplyProvider(config, async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body as string);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 512);
    assert.equal(init.redirect, "error");
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: '{"replyDraft":"案"}' }],
          },
        ],
      }),
    );
  });
  assert.equal(await provider(request), '{"replyDraft":"案"}');
  assert.equal(calls, 1);
});
test("429と通信結果不明を自動再送せず秘密のエラー本文を返さない", async () => {
  let calls = 0;
  await assert.rejects(
    openAIReplyProvider(config, async () => {
      calls++;
      return new Response("private details", { status: 429 });
    })(request),
    /AI_HTTP_429/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    openAIReplyProvider(config, async () => {
      throw new Error("private credentials");
    })(request),
    /^Error: AI_REQUEST_RESULT_UNKNOWN$/,
  );
});
test("未完了の応答は顧客向け返信として受理しない", async () => {
  await assert.rejects(
    openAIReplyProvider(
      config,
      async () =>
        new Response(JSON.stringify({ status: "incomplete", output: [] })),
    )(request),
    /INCOMPLETE/,
  );
});
