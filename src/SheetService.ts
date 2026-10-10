import type { Job, OrderRecord } from "./Types";
export const ORDER_HEADERS = [
  "日時",
  "Square注文ID",
  "メール",
  "商品",
  "金額",
  "URL",
  "状態",
];
export const LOG_HEADERS = ["日時", "処理", "結果", "内容"];
// 数式注入を防止。状態保存をflushしてからロックを解放する。
export function textCell(value: string): string {
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}
export class SheetService {
  readonly orders: GoogleAppsScript.Spreadsheet.Sheet;
  readonly logs: GoogleAppsScript.Spreadsheet.Sheet;
  constructor(book: GoogleAppsScript.Spreadsheet.Spreadsheet) {
    const orders = book.getSheetByName("Orders"),
      logs = book.getSheetByName("Logs");
    if (!orders || !logs) throw new Error("SHEETS_NOT_INITIALIZED");
    this.orders = orders;
    this.logs = logs;
    for (const [sheet, headers] of [
      [orders, ORDER_HEADERS],
      [logs, LOG_HEADERS],
    ] as const)
      if (
        JSON.stringify(
          sheet.getRange(1, 1, 1, headers.length).getValues()[0],
        ) !== JSON.stringify(headers)
      )
        throw new Error("SHEET_HEADER_MISMATCH");
  }
  hasOrder(id: string): boolean {
    return (
      this.orders.getLastRow() > 1 &&
      this.orders
        .getRange(2, 2, this.orders.getLastRow() - 1, 1)
        .getValues()
        .some((r) => r[0] === id)
    );
  }
  save(record: OrderRecord): boolean {
    if (this.hasOrder(record.orderId)) return false;
    this.orders.appendRow(
      [
        new Date(record.date),
        record.orderId,
        record.email,
        record.product,
        record.amount,
        record.url,
        record.status,
      ].map((v) => (typeof v === "string" ? textCell(v) : v)),
    );
    SpreadsheetApp.flush();
    return true;
  }
  // 注文IDで送信状態を保存し、異なる決済通知から同じ注文へ再送しない。
  private orderRow(id: string): number {
    if (this.orders.getLastRow() > 1) {
      const rows = this.orders
        .getRange(2, 2, this.orders.getLastRow() - 1, 1)
        .getValues();
      const index = rows.findIndex((row) => row[0] === id);
      if (index >= 0) return index + 2;
    }
    throw new Error("ORDER_RECORD_MISSING");
  }
  orderStatus(id: string): string {
    return String(this.orders.getRange(this.orderRow(id), 7).getValues()[0][0]);
  }
  setOrderStatus(id: string, status: string) {
    this.orders.getRange(this.orderRow(id), 7).setValue(status);
    SpreadsheetApp.flush();
  }
  jobs(): { row: number; job: Job }[] {
    if (this.logs.getLastRow() < 2) return [];
    return this.logs
      .getRange(2, 1, this.logs.getLastRow() - 1, 4)
      .getValues()
      .flatMap((r, i) =>
        r[1] === "QUEUE"
          ? [{ row: i + 2, job: JSON.parse(String(r[3])) as Job }]
          : [],
      );
  }
  enqueue(paymentId: string): boolean {
    if (this.jobs().some((j) => j.job.paymentId === paymentId)) return false;
    this.logs.appendRow([
      new Date(),
      "QUEUE",
      "INFO",
      JSON.stringify({
        paymentId,
        attempts: 0,
        nextAt: 0,
        state: "PENDING",
        notified: false,
      } satisfies Job),
    ]);
    SpreadsheetApp.flush();
    return true;
  }
  update(row: number, job: Job) {
    this.logs.getRange(row, 4).setValue(JSON.stringify(job));
    SpreadsheetApp.flush();
  }
}
