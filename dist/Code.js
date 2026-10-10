"use strict";
var GuestOps = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/Runtime.ts
  var Runtime_exports = {};
  __export(Runtime_exports, {
    configureAutomation: () => configureAutomation,
    doPost: () => doPost,
    processQueue: () => processQueue,
    setupAutomation: () => setupAutomation,
    stopAutomation: () => stopAutomation
  });

  // src/Config.ts
  var CONFIG = {
    A_URL: "",
    P3_URL: "",
    P10_URL: "",
    UPGRADE_P3_URL: "",
    UPGRADE_P10_URL: "",
    SITE_URL: "",
    DRIVE_A: "",
    DRIVE_P3: "",
    DRIVE_P10: "",
    DRIVE_A_URL: "",
    DRIVE_P3_URL: "",
    DRIVE_P10_URL: "",
    VARIATION_A: "",
    VARIATION_P3: "",
    VARIATION_P10: "",
    VARIATION_UPGRADE_P3: "",
    VARIATION_UPGRADE_P10: ""
  };
  function products() {
    return [
      {
        key: "A",
        price: 2980,
        variation: CONFIG.VARIATION_A,
        url: CONFIG.DRIVE_A_URL
      },
      {
        key: "P3",
        price: 29800,
        variation: CONFIG.VARIATION_P3,
        url: CONFIG.DRIVE_P3_URL
      },
      {
        key: "P10",
        price: 99800,
        variation: CONFIG.VARIATION_P10,
        url: CONFIG.DRIVE_P10_URL
      },
      {
        key: "UPGRADE_P3",
        price: 26820,
        variation: CONFIG.VARIATION_UPGRADE_P3,
        url: CONFIG.DRIVE_P3_URL
      },
      {
        key: "UPGRADE_P10",
        price: 96820,
        variation: CONFIG.VARIATION_UPGRADE_P10,
        url: CONFIG.DRIVE_P10_URL
      }
    ];
  }
  function validateConfig() {
    for (const [key, value] of Object.entries(CONFIG)) {
      if (!value.trim()) throw new Error("CONFIG_UNCONFIRMED:" + key);
      if (key.endsWith("URL") && !/^https:\/\/[^\s]+$/.test(value))
        throw new Error("URL_INVALID:" + key);
    }
    if (new Set(products().map((p) => p.variation)).size !== 5)
      throw new Error("VARIATION_NOT_UNIQUE");
  }
  var CONFIG_KEYS = Object.keys(CONFIG);
  function loadConfig(read) {
    for (const key of CONFIG_KEYS) CONFIG[key] = read(key)?.trim() ?? "";
    validateConfig();
  }

  // src/Settings.ts
  var RUNTIME_KEYS = [
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_API_VERSION",
    "SQUARE_ENVIRONMENT",
    "SQUARE_LOCATION_ID",
    "SQUARE_MERCHANT_ID",
    "SPREADSHEET_ID",
    "ADMIN_EMAIL",
    "WEBHOOK_URL_SECRET",
    "ACKNOWLEDGE_UNSIGNED_WEBHOOK",
    "AUTOMATION_ENABLED"
  ];
  var PROPERTY_KEYS = [...CONFIG_KEYS, ...RUNTIME_KEYS];
  function loadSettings(read) {
    loadConfig(read);
    function required(key) {
      const value = read(key)?.trim();
      if (!value) throw new Error("PROPERTY_UNCONFIRMED:" + key);
      return value;
    }
    if (required("ACKNOWLEDGE_UNSIGNED_WEBHOOK") !== "true")
      throw new Error("UNSIGNED_WEBHOOK_NOT_ACKNOWLEDGED");
    const environment = required("SQUARE_ENVIRONMENT");
    if (!["sandbox", "production"].includes(environment))
      throw new Error("ENVIRONMENT_INVALID");
    const secret = required("WEBHOOK_URL_SECRET");
    if (!/^[A-Za-z0-9_-]{43,}$/.test(secret)) throw new Error("SECRET_TOO_SHORT");
    const version = required("SQUARE_API_VERSION");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version))
      throw new Error("API_VERSION_INVALID");
    const admin = required("ADMIN_EMAIL");
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(admin))
      throw new Error("ADMIN_EMAIL_INVALID");
    if (!["true", "false"].includes(required("AUTOMATION_ENABLED")))
      throw new Error("ENABLED_INVALID");
    return {
      environment,
      secret,
      version,
      admin,
      location: required("SQUARE_LOCATION_ID"),
      merchant: required("SQUARE_MERCHANT_ID"),
      token: required("SQUARE_ACCESS_TOKEN"),
      spreadsheet: required("SPREADSHEET_ID")
    };
  }

  // src/Logger.ts
  var Logger = class {
    constructor(sheets2) {
      this.sheets = sheets2;
    }
    log(level, action, code) {
      this.sheets.logs.appendRow([/* @__PURE__ */ new Date(), action, level, code]);
      SpreadsheetApp.flush();
    }
  };

  // src/DriveService.ts
  function deliveryUrl(key) {
    const url = products().find((p) => p.key === key)?.url;
    if (!url) throw new Error("DELIVERY_URL_UNCONFIRMED");
    return url;
  }

  // src/Types.ts
  var BusinessError = class extends Error {
  };
  var RetryError = class extends Error {
  };

  // src/OrderService.ts
  function validateOrder(payment, order, location) {
    if (payment.location_id !== location || order.location_id !== location || payment.order_id !== order.id)
      throw new BusinessError("ORDER_LOCATION_MISMATCH");
    if (payment.status !== "COMPLETED")
      throw new BusinessError("PAYMENT_NOT_COMPLETED");
    if (order.state === "OPEN") throw new RetryError("ORDER_NOT_YET_COMPLETED");
    if (order.state !== "COMPLETED")
      throw new BusinessError("ORDER_NOT_COMPLETED");
    const items = order.line_items ?? [];
    if (items.length !== 1 || items[0].quantity !== "1")
      throw new BusinessError("UNSUPPORTED_CART");
    const product = products().find(
      (p) => p.variation === items[0].catalog_object_id
    );
    if (!product) throw new BusinessError("PRODUCT_UNKNOWN");
    if ([payment.amount_money, order.total_money, items[0].base_price_money].some(
      (m) => !m || m.currency !== "JPY" || m.amount !== product.price
    ) || (payment.tip_money?.amount ?? 0) !== 0)
      throw new BusinessError("PRICE_MISMATCH");
    const email = payment.buyer_email_address?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BusinessError("EMAIL_MISSING");
    if (!Number.isFinite(Date.parse(order.created_at)))
      throw new BusinessError("DATE_INVALID");
    return {
      date: order.created_at,
      orderId: order.id,
      email,
      product: product.key,
      amount: product.price,
      url: deliveryUrl(product.key),
      status: "RECORDED"
    };
  }
  function getRecord(api, id, location) {
    const payment = api.payment(id);
    if (payment.id !== id) throw new BusinessError("PAYMENT_ID_MISMATCH");
    if (!payment.order_id) throw new BusinessError("ORDER_MISSING");
    return validateOrder(payment, api.order(payment.order_id), location);
  }

  // src/QueueService.ts
  function runJob(job, now, process) {
    if (job.state !== "PENDING" || job.nextAt > now)
      throw new Error("JOB_NOT_DUE");
    job.attempts++;
    try {
      process();
      job.state = "DONE";
      return { level: "INFO", code: "ORDER_RECORDED_OR_DUPLICATE" };
    } catch (error) {
      const code = error instanceof BusinessError ? error.message : "PROCESSING_RETRYABLE_FAILURE";
      if (error instanceof BusinessError || job.attempts >= 4) {
        job.state = "FAILED";
        return { level: "ERROR", code };
      }
      job.nextAt = now + 6e4 * 2 ** (job.attempts - 1);
      return { level: "WARN", code };
    }
  }

  // src/SheetService.ts
  var ORDER_HEADERS = [
    "\u65E5\u6642",
    "Square\u6CE8\u6587ID",
    "\u30E1\u30FC\u30EB",
    "\u5546\u54C1",
    "\u91D1\u984D",
    "URL",
    "\u72B6\u614B"
  ];
  var LOG_HEADERS = ["\u65E5\u6642", "\u51E6\u7406", "\u7D50\u679C", "\u5185\u5BB9"];
  function textCell(value) {
    return /^[=+@\-]/.test(value) ? "'" + value : value;
  }
  var SheetService = class {
    constructor(book) {
      const orders = book.getSheetByName("Orders"), logs = book.getSheetByName("Logs");
      if (!orders || !logs) throw new Error("SHEETS_NOT_INITIALIZED");
      this.orders = orders;
      this.logs = logs;
      for (const [sheet, headers] of [
        [orders, ORDER_HEADERS],
        [logs, LOG_HEADERS]
      ])
        if (JSON.stringify(
          sheet.getRange(1, 1, 1, headers.length).getValues()[0]
        ) !== JSON.stringify(headers))
          throw new Error("SHEET_HEADER_MISMATCH");
    }
    hasOrder(id) {
      return this.orders.getLastRow() > 1 && this.orders.getRange(2, 2, this.orders.getLastRow() - 1, 1).getValues().some((r) => r[0] === id);
    }
    save(record) {
      if (this.hasOrder(record.orderId)) return false;
      this.orders.appendRow(
        [
          new Date(record.date),
          record.orderId,
          record.email,
          record.product,
          record.amount,
          record.url,
          record.status
        ].map((v) => typeof v === "string" ? textCell(v) : v)
      );
      SpreadsheetApp.flush();
      return true;
    }
    jobs() {
      if (this.logs.getLastRow() < 2) return [];
      return this.logs.getRange(2, 1, this.logs.getLastRow() - 1, 4).getValues().flatMap(
        (r, i) => r[1] === "QUEUE" ? [{ row: i + 2, job: JSON.parse(String(r[3])) }] : []
      );
    }
    enqueue(paymentId) {
      if (this.jobs().some((j) => j.job.paymentId === paymentId)) return false;
      this.logs.appendRow([
        /* @__PURE__ */ new Date(),
        "QUEUE",
        "INFO",
        JSON.stringify({
          paymentId,
          attempts: 0,
          nextAt: 0,
          state: "PENDING",
          notified: false
        })
      ]);
      SpreadsheetApp.flush();
      return true;
    }
    update(row, job) {
      this.logs.getRange(row, 4).setValue(JSON.stringify(job));
      SpreadsheetApp.flush();
    }
  };

  // src/SquareService.ts
  var SquareService = class {
    constructor(token, version, environment) {
      this.token = token;
      this.version = version;
      this.environment = environment;
    }
    get(path, key) {
      const host = this.environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
      let response2;
      try {
        response2 = UrlFetchApp.fetch(host + path, {
          method: "get",
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + this.token,
            "Square-Version": this.version,
            Accept: "application/json"
          }
        });
      } catch {
        throw new RetryError("SQUARE_NETWORK");
      }
      const status = response2.getResponseCode();
      if (status === 429 || status >= 500)
        throw new RetryError("SQUARE_HTTP_" + status);
      if (status !== 200) throw new BusinessError("SQUARE_HTTP_" + status);
      try {
        const body = JSON.parse(response2.getContentText());
        if (!body[key]) throw new Error();
        return body[key];
      } catch {
        throw new RetryError("SQUARE_INVALID_RESPONSE");
      }
    }
    payment(id) {
      return this.get("/v2/payments/" + encodeURIComponent(id), "payment");
    }
    order(id) {
      return this.get("/v2/orders/" + encodeURIComponent(id), "order");
    }
  };

  // src/SquareWebhook.ts
  function paymentHint(raw, merchant) {
    if (raw.length > 32768) throw new BusinessError("BODY_TOO_LARGE");
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      throw new BusinessError("INVALID_JSON");
    }
    if (!event || event.merchant_id !== merchant)
      throw new BusinessError("MERCHANT_MISMATCH");
    if (!["payment.created", "payment.updated"].includes(event.type)) return null;
    if (event.data?.object?.payment?.status !== "COMPLETED") return null;
    const id = event.data?.object?.payment?.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,192}$/.test(id))
      throw new BusinessError("PAYMENT_ID_INVALID");
    return id;
  }

  // src/Runtime.ts
  function properties() {
    return PropertiesService.getScriptProperties();
  }
  function settings() {
    return loadSettings((key) => properties().getProperty(key));
  }
  function configureAutomation() {
    const raw = properties().getProperty("BOOTSTRAP_CONFIG_JSON");
    if (!raw) throw new Error("BOOTSTRAP_CONFIG_MISSING");
    let supplied;
    try {
      supplied = JSON.parse(raw);
    } catch {
      throw new Error("BOOTSTRAP_JSON_INVALID");
    }
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied))
      throw new Error("BOOTSTRAP_JSON_INVALID");
    const data = supplied;
    if (Object.keys(data).some(
      (key) => !PROPERTY_KEYS.some((allowed) => allowed === key)
    ) || Object.values(data).some((value) => typeof value !== "string"))
      throw new Error("BOOTSTRAP_KEYS_INVALID");
    const values = {};
    for (const key of PROPERTY_KEYS)
      values[key] = typeof data[key] === "string" ? data[key].trim() : "";
    values.AUTOMATION_ENABLED = "false";
    loadSettings((key) => values[key]);
    locked(() => {
      properties().setProperties(values, false);
      properties().deleteProperty("BOOTSTRAP_CONFIG_JSON");
    });
  }
  function locked(fn) {
    const lock = LockService.getScriptLock();
    lock.waitLock(5e3);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }
  function sheets(id) {
    return new SheetService(SpreadsheetApp.openById(id));
  }
  function response(result) {
    return HtmlService.createHtmlOutput(result);
  }
  function doPost(e) {
    if (properties().getProperty("AUTOMATION_ENABLED") !== "true")
      throw new Error("AUTOMATION_DISABLED");
    const config = settings();
    if (e.parameter?.key !== config.secret) return response("ignored");
    let id;
    try {
      id = paymentHint(e.postData?.contents ?? "", config.merchant);
    } catch (error) {
      if (!(error instanceof BusinessError)) throw error;
      locked(
        () => new Logger(sheets(config.spreadsheet)).log(
          "WARN",
          "WEBHOOK_REJECTED",
          error.message
        )
      );
      return response("ignored");
    }
    if (!id) return response("ignored");
    return locked(
      () => response(sheets(config.spreadsheet).enqueue(id) ? "queued" : "duplicate")
    );
  }
  function processQueue() {
    if (properties().getProperty("AUTOMATION_ENABLED") !== "true") return;
    const config = settings(), started = Date.now();
    return locked(() => {
      const store = sheets(config.spreadsheet), logger = new Logger(store), api = new SquareService(config.token, config.version, config.environment);
      let processed = 0;
      for (const { row, job } of store.jobs()) {
        if (Date.now() - started > 18e4 || processed >= 10) break;
        if (job.state === "PENDING" && job.nextAt <= Date.now()) {
          const result = runJob(job, Date.now(), () => {
            store.save(getRecord(api, job.paymentId, config.location));
          });
          store.update(row, job);
          logger.log(result.level, "PROCESS_PAYMENT", result.code);
          processed++;
        }
        if (job.state === "FAILED" && !job.notified && (job.noticeAt ?? 0) <= Date.now()) {
          try {
            MailApp.sendEmail(
              config.admin,
              "GuestOps AI\uFF1A\u6CE8\u6587\u8A18\u9332\u51E6\u7406\u30A8\u30E9\u30FC",
              "\u81EA\u52D5\u5316\u5C02\u7528Spreadsheet\u306ELogs\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002QUEUE\u884C\u756A\u53F7: " + row + "\n\u518D\u8A66\u884C\u56DE\u6570: " + Math.max(0, job.attempts - 1)
            );
            job.notified = true;
            store.update(row, job);
            logger.log("INFO", "ADMIN_NOTICE", "SENT");
          } catch {
            job.noticeAt = Date.now() + 36e5;
            store.update(row, job);
            logger.log("ERROR", "ADMIN_NOTICE", "NOTICE_FAILED");
          }
        }
      }
    });
  }
  function setupAutomation() {
    const config = settings();
    locked(() => {
      const book = SpreadsheetApp.openById(config.spreadsheet);
      for (const [name, headers] of [
        ["Orders", ORDER_HEADERS],
        ["Logs", LOG_HEADERS]
      ]) {
        const s = book.getSheetByName(name);
        if (s && s.getLastRow() > 0 && JSON.stringify(s.getRange(1, 1, 1, headers.length).getValues()[0]) !== JSON.stringify(headers))
          throw new Error("SETUP_WOULD_CHANGE_EXISTING_SHEET");
      }
      for (const [name, headers] of [
        ["Orders", ORDER_HEADERS],
        ["Logs", LOG_HEADERS]
      ]) {
        const s = book.getSheetByName(name) ?? book.insertSheet(name);
        if (s.getLastRow() === 0) s.appendRow(headers);
      }
      SpreadsheetApp.flush();
      if (!ScriptApp.getProjectTriggers().some(
        (t) => t.getHandlerFunction() === "processQueue"
      ))
        ScriptApp.newTrigger("processQueue").timeBased().everyMinutes(1).create();
      new Logger(sheets(config.spreadsheet)).log("INFO", "SETUP", "SETUP_READY");
    });
  }
  function stopAutomation() {
    properties().setProperty("AUTOMATION_ENABLED", "false");
    for (const trigger of ScriptApp.getProjectTriggers())
      if (trigger.getHandlerFunction() === "processQueue")
        ScriptApp.deleteTrigger(trigger);
  }
  return __toCommonJS(Runtime_exports);
})();
