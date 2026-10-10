import { createServer } from "node:http";
import { handleWebhook } from "./Handler";
import { receiverSettings } from "./Settings";
// 受信サービスのみを起動する。Square商品やGoogle資産を作成・編集しない。
const settings = receiverSettings(process.env);
const server = createServer(async (req, res) => {
  const deadline = setTimeout(() => {
    if (!res.writableEnded) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end('{"code":"DEADLINE_EXCEEDED"}');
    }
  }, 8500);
  res.on("finish", () => clearTimeout(deadline));
  res.on("close", () => clearTimeout(deadline));
  const reply = (status: number, code: string) => {
    if (res.writableEnded) return;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code }));
  };
  if (req.method === "GET" && req.url === "/health") {
    reply(200, "READY");
    return;
  }
  if (!settings.enabled) {
    reply(503, "DISABLED");
    return;
  }
  const target = new URL(settings.notificationUrl);
  if (req.url !== target.pathname + target.search) {
    reply(404, "NOT_FOUND");
    return;
  }
  if (req.method !== "POST") {
    reply(405, "METHOD_NOT_ALLOWED");
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 32768) {
        reply(413, "BODY_TOO_LARGE");
        req.resume();
        return;
      }
      chunks.push(bytes);
    }
    const header = req.headers["x-square-hmacsha256-signature"];
    const result = await handleWebhook(
      Buffer.concat(chunks),
      typeof header === "string" ? header : "",
      settings,
    );
    reply(result.status, result.code);
  } catch {
    if (!res.headersSent) reply(503, "RECEIVER_FAILURE");
  }
});
server.requestTimeout = 9000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
