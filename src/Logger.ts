import type { SheetService } from "./SheetService";
// レスポンス本文、購入者メール、秘密値をログに出力しない。
export class Logger {
  constructor(private sheets: SheetService) {}
  log(level: "INFO" | "WARN" | "ERROR", action: string, code: string) {
    this.sheets.logs.appendRow([new Date(), action, level, code]);
    SpreadsheetApp.flush();
  }
}
