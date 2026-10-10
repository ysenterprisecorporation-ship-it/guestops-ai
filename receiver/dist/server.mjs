// receiver/Server.ts
import { createServer } from "node:http";

// receiver/Handler.ts
import { randomBytes } from "node:crypto";

// receiver/Signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";
function hmac(value, key) {
  return createHmac("sha256", key).update(value).digest("base64");
}
function equalMac(actual, expected) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(actual)) return false;
  const a = Buffer.from(actual, "base64"), b = Buffer.from(expected, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}
function verifySquare(raw, signature, url, key) {
  const expected = createHmac("sha256", key).update(url, "utf8").update(raw).digest("base64");
  return equalMac(signature, expected);
}

// src/RelayProtocol.ts
function envelopeText(e) {
  return `${e.timestamp}
${e.nonce}
${e.squareSignature}
${e.rawBody}`;
}
function receiptText(nonce, result) {
  return nonce + "\n" + result;
}

// receiver/Handler.ts
async function handleWebhook(raw, signature, settings2, request = fetch) {
  if (!settings2.enabled) return { status: 503, code: "DISABLED" };
  if (raw.length > 32768) return { status: 413, code: "BODY_TOO_LARGE" };
  if (!verifySquare(
    raw,
    signature,
    settings2.notificationUrl,
    settings2.signatureKey
  ))
    return { status: 403, code: "SIGNATURE_INVALID" };
  const rawBody = raw.toString("utf8");
  if (!Buffer.from(rawBody, "utf8").equals(raw))
    return { status: 400, code: "UTF8_INVALID" };
  const envelope = {
    timestamp: Date.now(),
    nonce: randomBytes(16).toString("hex"),
    squareSignature: signature,
    rawBody
  };
  const mac = hmac(envelopeText(envelope), settings2.relayKey);
  try {
    const response = await request(settings2.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...envelope, mac }),
      redirect: "follow",
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) return { status: 503, code: "GAS_UNAVAILABLE" };
    const text = await response.text();
    if (text.length > 4096) return { status: 503, code: "GAS_RECEIPT_INVALID" };
    const ack = JSON.parse(text);
    if (ack.nonce !== envelope.nonce || !["queued", "duplicate", "ignored"].includes(ack.result ?? "") || typeof ack.mac !== "string" || !equalMac(
      ack.mac,
      hmac(
        receiptText(envelope.nonce, ack.result),
        settings2.relayKey
      )
    ))
      return { status: 503, code: "GAS_RECEIPT_INVALID" };
    return { status: 200, code: "ACCEPTED" };
  } catch {
    return { status: 503, code: "GAS_UNAVAILABLE" };
  }
}

// receiver/Settings.ts
function receiverSettings(env) {
  const enabled = env.RECEIVER_ENABLED === "true";
  if (!["true", "false"].includes(env.RECEIVER_ENABLED ?? "false"))
    throw new Error("RECEIVER_ENABLED_INVALID");
  const result = {
    enabled,
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "",
    notificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL ?? "",
    gasUrl: env.GAS_WEB_APP_URL ?? "",
    relayKey: env.RELAY_SHARED_SECRET ?? ""
  };
  if (enabled) {
    for (const value of Object.values(result))
      if (value === "") throw new Error("RECEIVER_SETTINGS_MISSING");
    if (!/^[A-Za-z0-9_-]{43,}$/.test(result.relayKey))
      throw new Error("RELAY_SECRET_INVALID");
    const gas = new URL(result.gasUrl), notification = new URL(result.notificationUrl);
    if (gas.protocol !== "https:" || gas.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(gas.pathname) || gas.search || gas.hash || gas.username || gas.password)
      throw new Error("GAS_URL_INVALID");
    if (notification.protocol !== "https:" || notification.hash || notification.username || notification.password)
      throw new Error("NOTIFICATION_URL_INVALID");
  }
  return result;
}

// receiver/Server.ts
var settings = receiverSettings(process.env);
var server = createServer(async (req, res) => {
  const deadline = setTimeout(() => {
    if (!res.writableEnded) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end('{"code":"DEADLINE_EXCEEDED"}');
    }
  }, 8500);
  res.on("finish", () => clearTimeout(deadline));
  res.on("close", () => clearTimeout(deadline));
  const reply = (status, code) => {
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
  const chunks = [];
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
      settings
    );
    reply(result.status, result.code);
  } catch {
    if (!res.headersSent) reply(503, "RECEIVER_FAILURE");
  }
});
server.requestTimeout = 9e3;
server.headersTimeout = 1e4;
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
