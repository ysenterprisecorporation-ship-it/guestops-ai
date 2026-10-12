import { test } from "node:test";
import assert from "node:assert/strict";
import { SheetService, ORDER_HEADERS, LOG_HEADERS } from "../src/SheetService";
// シート実装をインメモリで模擬し、重複防止と永続状態を検証する。
class FakeSheet {
  rows: unknown[][];
  constructor(headers: string[]) {
    this.rows = [[...headers]];
  }
  getLastRow() {
    return this.rows.length;
  }
  appendRow(row: unknown[]) {
    this.rows.push(row);
  }
  getRange(row: number, col: number, count = 1, width = 1) {
    return {
      getValues: () =>
        this.rows
          .slice(row - 1, row - 1 + count)
          .map((r) => r.slice(col - 1, col - 1 + width)),
      setValue: (value: unknown) => {
        this.rows[row - 1][col - 1] = value;
      },
    };
  }
}
function fixture() {
  const orders = new FakeSheet(ORDER_HEADERS),
    logs = new FakeSheet(LOG_HEADERS);
  const book = {
    getSheetByName: (name: string) => (name === "Orders" ? orders : logs),
  };
  Object.assign(globalThis, { SpreadsheetApp: { flush: () => {} } });
  return {
    orders,
    logs,
    book: book as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet,
  };
}
test("Webhook重複：別インスタンスでもQUEUEが1行", () => {
  const f = fixture();
  assert.equal(new SheetService(f.book).enqueue("pay-1"), true);
  assert.equal(new SheetService(f.book).enqueue("pay-1"), false);
  assert.equal(f.logs.rows.length, 2);
});
test("注文保存後の再実行でもOrdersは1行", () => {
  const f = fixture(),
    record = {
      date: "2026-10-10T00:00:00Z",
      orderId: "order-1",
      email: "buyer@example.invalid",
      product: "A",
      amount: 2980,
      url: "https://example.invalid",
      status: "RECORDED",
    };
  assert.equal(new SheetService(f.book).save(record), true);
  assert.equal(new SheetService(f.book).save(record), false);
  assert.equal(f.orders.rows.length, 2);
});
test("再試行状態は別インスタンスから復元", () => {
  const f = fixture(),
    s = new SheetService(f.book);
  s.enqueue("pay-1");
  const entry = s.jobs()[0];
  entry.job.attempts = 2;
  entry.job.nextAt = 180000;
  s.update(entry.row, entry.job);
  assert.equal(new SheetService(f.book).jobs()[0].job.attempts, 2);
  assert.equal(new SheetService(f.book).jobs()[0].job.nextAt, 180000);
});
test("ヘッダ違いは書込み前に停止", () => {
  const f = fixture();
  f.orders.rows[0][0] = "wrong";
  assert.throws(() => new SheetService(f.book), /HEADER_MISMATCH/);
});
