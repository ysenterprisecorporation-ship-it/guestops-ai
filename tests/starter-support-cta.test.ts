import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// The purchase page is static GitHub Pages HTML; exercise the real inline
// support handler without sending mail, charging a card or touching Google.
const html = readFileSync(
  new URL("../docs/starter/order/index.html", import.meta.url),
  "utf8",
);

test("Starter delivery support has Gmail, mailto and copy fallbacks", async () => {
  const gmailHref = html.match(/id="starterSupportGmail"[^>]*href="([^"]+)"/)?.[1];
  assert.ok(gmailHref, "browser Gmail fallback missing");
  const gmail = new URL(gmailHref);
  assert.equal(gmail.origin, "https://mail.google.com");
  assert.equal(gmail.searchParams.get("to"), "minpaku.ai.kit@gmail.com");
  assert.equal(gmail.searchParams.get("su"), "GuestOps Starter Kit 教材受取確認");
  assert.match(html, /mailto:minpaku\.ai\.kit@gmail\.com\?subject=/);
  assert.match(html, /onclick="starterCopySupport_\(\)"/);

  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "copy handler script missing");
  const copied: string[] = [];
  const notice = { textContent: "" };
  const sandbox = {
    navigator: {
      clipboard: {
        writeText: async (value: string) => {
          copied.push(value);
        },
      },
    },
    document: { getElementById: () => notice },
  };
  runInNewContext(script, sandbox);
  await (sandbox as unknown as { starterCopySupport_: () => Promise<void> })
    .starterCopySupport_();

  assert.equal(copied.length, 1);
  const [headers, body] = copied[0].split("\n\n", 2);
  assert.match(headers, /宛先: minpaku\.ai\.kit@gmail\.com/);
  assert.match(headers, /件名: GuestOps Starter Kit 教材受取確認/);
  assert.equal(gmail.searchParams.get("body"), body);
  assert.match(body, /注文番号：/);
  assert.match(body, /決済日時（日本時間）：/);
  assert.doesNotMatch(body, /https?:\/\//);
  assert.match(notice.textContent, /コピーしました/);
});

test("Support enhancement does not change payment CTA or nest card sections", () => {
  assert.match(html, /href="https:\/\/square\.link\/u\/nwGxRxvm"/);
  assert.match(html, /9,800円/);
  assert.match(
    html,
    /<\/div><\/section>\s*<section class="card" id="delivery-checklist">/,
  );
  assert.match(html, /自動送信・自動保存は行いません/);
});
