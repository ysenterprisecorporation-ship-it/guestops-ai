import { loadSettings, PROPERTY_KEYS } from "./Settings";
import { Logger } from "./Logger";
import { getRecord } from "./OrderService";
import { runJob } from "./QueueService";
import { SheetService, ORDER_HEADERS, LOG_HEADERS } from "./SheetService";
import { SquareService } from "./SquareService";
import { paymentHint } from "./SquareWebhook";
import { BusinessError } from "./Types";
// GASの同期サービスに合わせて入口・時間トリガーはPromiseを返さない。
function properties() {
  return PropertiesService.getScriptProperties();
}
function settings() {
  return loadSettings((key) => properties().getProperty(key));
}
// JSONはScript Property経由で受け取り、検証後に全設定を停止状態で保存する。
export function configureAutomation() {
  const raw = properties().getProperty("BOOTSTRAP_CONFIG_JSON");
  if (!raw) throw new Error("BOOTSTRAP_CONFIG_MISSING");
  let supplied: unknown;
  try {
    supplied = JSON.parse(raw);
  } catch {
    throw new Error("BOOTSTRAP_JSON_INVALID");
  }
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied))
    throw new Error("BOOTSTRAP_JSON_INVALID");
  const data = supplied as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !PROPERTY_KEYS.some((allowed) => allowed === key),
    ) ||
    Object.values(data).some((value) => typeof value !== "string")
  )
    throw new Error("BOOTSTRAP_KEYS_INVALID");
  const values: Record<string, string> = {};
  for (const key of PROPERTY_KEYS)
    values[key] = typeof data[key] === "string" ? data[key].trim() : "";
  values.AUTOMATION_ENABLED = "false";
  loadSettings((key) => values[key]);
  locked(() => {
    properties().setProperties(values, false);
    properties().deleteProperty("BOOTSTRAP_CONFIG_JSON");
  });
}
function locked<T>(fn: () => T): T {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
function sheets(id: string) {
  return new SheetService(SpreadsheetApp.openById(id));
}
function response(result: string) {
  return HtmlService.createHtmlOutput(result);
}
export function doPost(e: GoogleAppsScript.Events.DoPost) {
  if (properties().getProperty("AUTOMATION_ENABLED") !== "true")
    throw new Error("AUTOMATION_DISABLED");
  const config = settings();
  if (e.parameter?.key !== config.secret) return response("ignored");
  let id: string | null;
  try {
    id = paymentHint(e.postData?.contents ?? "", config.merchant);
  } catch (error) {
    if (!(error instanceof BusinessError)) throw error;
    locked(() =>
      new Logger(sheets(config.spreadsheet)).log(
        "WARN",
        "WEBHOOK_REJECTED",
        error.message,
      ),
    );
    return response("ignored");
  }
  if (!id) return response("ignored");
  return locked(() =>
    response(sheets(config.spreadsheet).enqueue(id) ? "queued" : "duplicate"),
  );
}
export function processQueue() {
  if (properties().getProperty("AUTOMATION_ENABLED") !== "true") return;
  const config = settings(),
    started = Date.now();
  return locked(() => {
    const store = sheets(config.spreadsheet),
      logger = new Logger(store),
      api = new SquareService(config.token, config.version, config.environment);
    let processed = 0;
    for (const { row, job } of store.jobs()) {
      if (Date.now() - started > 180000 || processed >= 10) break;
      if (job.state === "PENDING" && job.nextAt <= Date.now()) {
        const result = runJob(job, Date.now(), () => {
          store.save(getRecord(api, job.paymentId, config.location));
        });
        store.update(row, job);
        logger.log(result.level, "PROCESS_PAYMENT", result.code);
        processed++;
      }
      if (
        job.state === "FAILED" &&
        !job.notified &&
        (job.noticeAt ?? 0) <= Date.now()
      ) {
        try {
          MailApp.sendEmail(
            config.admin,
            "GuestOps AI：注文記録処理エラー",
            "自動化専用SpreadsheetのLogsをご確認ください。QUEUE行番号: " +
              row +
              "\n再試行回数: " +
              Math.max(0, job.attempts - 1),
          );
          job.notified = true;
          store.update(row, job);
          logger.log("INFO", "ADMIN_NOTICE", "SENT");
        } catch {
          job.noticeAt = Date.now() + 3600000;
          store.update(row, job);
          logger.log("ERROR", "ADMIN_NOTICE", "NOTICE_FAILED");
        }
      }
    }
  });
}
export function setupAutomation() {
  const config = settings();
  // 自動化専用Spreadsheetだけを指定する。既存の販売資産には設定しない。
  locked(() => {
    const book = SpreadsheetApp.openById(config.spreadsheet);
    for (const [name, headers] of [
      ["Orders", ORDER_HEADERS],
      ["Logs", LOG_HEADERS],
    ] as const) {
      const s = book.getSheetByName(name);
      if (
        s &&
        s.getLastRow() > 0 &&
        JSON.stringify(s.getRange(1, 1, 1, headers.length).getValues()[0]) !==
          JSON.stringify(headers)
      )
        throw new Error("SETUP_WOULD_CHANGE_EXISTING_SHEET");
    }
    for (const [name, headers] of [
      ["Orders", ORDER_HEADERS],
      ["Logs", LOG_HEADERS],
    ] as const) {
      const s = book.getSheetByName(name) ?? book.insertSheet(name);
      if (s.getLastRow() === 0) s.appendRow(headers);
    }
    SpreadsheetApp.flush();
    if (
      !ScriptApp.getProjectTriggers().some(
        (t) => t.getHandlerFunction() === "processQueue",
      )
    )
      ScriptApp.newTrigger("processQueue").timeBased().everyMinutes(1).create();
    new Logger(sheets(config.spreadsheet)).log("INFO", "SETUP", "SETUP_READY");
  });
}
export function stopAutomation() {
  properties().setProperty("AUTOMATION_ENABLED", "false");
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === "processQueue")
      ScriptApp.deleteTrigger(trigger);
}
