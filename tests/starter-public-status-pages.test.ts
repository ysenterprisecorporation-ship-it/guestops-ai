import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const requested = readFileSync(
  new URL("../docs/starter/requested/index.html", import.meta.url),
  "utf8",
);
const afterPurchase = readFileSync(
  new URL("../docs/starter/after-purchase/index.html", import.meta.url),
  "utf8",
);

test("public requested page does not falsely confirm an order or payment", () => {
  assert.match(requested, /このページの表示だけでは、お申し込みの受付・決済完了を確認できません/);
  assert.match(requested, /決済の成立はSquareの決済記録で確認します/);
  assert.match(requested, /9,800円の買い切り商品/);
  assert.match(requested, /二重決済を防ぐため/);
  assert.match(requested, /href="\.\.\/order\/"/);
  assert.match(requested, /注文番号と決済日時/);
  assert.doesNotMatch(requested, /お申し込みを受け付けました|ご入力いただいた内容を確認後/);
});

test("public after-purchase guide reflects actual buyer deliverables and limits", () => {
  assert.match(afterPurchase, /このページは公開ガイドです/);
  assert.match(afterPurchase, /決済確認後、購入者へ個別に受取方法をご案内します/);
  assert.match(afterPurchase, /利用ガイド、施設専用マスタープロンプト/);
  assert.match(afterPurchase, /スプレッドシート/);
  assert.match(afterPurchase, /コピーを作成/);
  assert.match(afterPurchase, /20場面の判断境界/);
  assert.match(afterPurchase, /自動納品は現在保証していません/);
  assert.match(afterPurchase, /Starter Kitには予約サイトとの自動接続、自動送信/);
  assert.match(afterPurchase, /相談だけでは契約・課金は始まりません/);
  assert.match(afterPurchase, /30日以内に月額GuestOps AIの有償契約が成立した場合/);
  assert.doesNotMatch(afterPurchase, /Excel、マスタープロンプト、READMEの3点/);
  assert.doesNotMatch(afterPurchase, /予約管理システム連携・自動返信・予約連動へ移行します/);
});

test("public status pages never expose buyer-only materials or payment URLs", () => {
  for (const page of [requested, afterPurchase]) {
    assert.doesNotMatch(page, /https:\/\/docs\.google\.com\/(?:document|spreadsheets)\/d\//);
    assert.doesNotMatch(page, /https:\/\/(?:square\.link|[^"\s]*square\.site)\//);
    assert.match(page, /name="robots" content="noindex,nofollow"/);
  }
});

test("status page links lead to the existing purchase and monthly pricing paths", () => {
  const requestedBase = "https://ysenterprisecorporation-ship-it.github.io/guestops-ai/starter/requested/";
  const afterBase = "https://ysenterprisecorporation-ship-it.github.io/guestops-ai/starter/after-purchase/";
  assert.equal(
    new URL("../order/", requestedBase).pathname,
    "/guestops-ai/starter/order/",
  );
  assert.equal(
    new URL("../../#pricing", requestedBase).hash,
    "#pricing",
  );
  assert.equal(
    new URL("../upgrade/", afterBase).pathname,
    "/guestops-ai/starter/upgrade/",
  );
  assert.equal(
    new URL("../../#pricing", afterBase).pathname,
    "/guestops-ai/",
  );
});
