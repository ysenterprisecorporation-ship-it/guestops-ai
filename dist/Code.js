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
    productionReadiness: () => productionReadiness,
    reconcilePayments: () => reconcilePayments,
    setupAutomation: () => setupAutomation,
    stopAutomation: () => stopAutomation,
    webhookCapabilities: () => webhookCapabilities
  });

  // src/ProductCatalog.ts
  var PRODUCT_CATALOG = {
    A: { priceYen: 2980 },
    P3: { priceYen: 19800 },
    P10: { priceYen: 49800 },
    P30: { priceYen: 99800 },
    UPGRADE_P3_FROM_A: { priceYen: 16820 },
    UPGRADE_P10_FROM_A: { priceYen: 46820 },
    UPGRADE_P30_FROM_A: { priceYen: 96820 }
  };

  // src/Config.ts
  var CONFIG = {
    A_URL: "",
    P3_URL: "",
    P10_URL: "",
    P30_URL: "",
    UPGRADE_P3_URL: "",
    UPGRADE_P10_URL: "",
    UPGRADE_P30_URL: "",
    SITE_URL: "",
    DRIVE_A: "",
    DRIVE_P3: "",
    DRIVE_P10: "",
    DRIVE_P30: "",
    DRIVE_A_URL: "",
    DRIVE_P3_URL: "",
    DRIVE_P10_URL: "",
    DRIVE_P30_URL: "",
    VARIATION_A: "",
    VARIATION_P3: "",
    VARIATION_P10: "",
    VARIATION_P30: "",
    VARIATION_UPGRADE_P3: "",
    VARIATION_UPGRADE_P10: "",
    VARIATION_UPGRADE_P30: ""
  };
  function products() {
    return [
      {
        key: "A",
        price: PRODUCT_CATALOG.A.priceYen,
        variation: CONFIG.VARIATION_A,
        url: CONFIG.DRIVE_A_URL
      },
      {
        key: "P3",
        price: PRODUCT_CATALOG.P3.priceYen,
        variation: CONFIG.VARIATION_P3,
        url: CONFIG.DRIVE_P3_URL
      },
      {
        key: "P10",
        price: PRODUCT_CATALOG.P10.priceYen,
        variation: CONFIG.VARIATION_P10,
        url: CONFIG.DRIVE_P10_URL
      },
      {
        key: "P30",
        price: PRODUCT_CATALOG.P30.priceYen,
        variation: CONFIG.VARIATION_P30,
        url: CONFIG.DRIVE_P30_URL
      },
      {
        key: "UPGRADE_P3",
        price: PRODUCT_CATALOG.UPGRADE_P3_FROM_A.priceYen,
        variation: CONFIG.VARIATION_UPGRADE_P3,
        url: CONFIG.DRIVE_P3_URL
      },
      {
        key: "UPGRADE_P10",
        price: PRODUCT_CATALOG.UPGRADE_P10_FROM_A.priceYen,
        variation: CONFIG.VARIATION_UPGRADE_P10,
        url: CONFIG.DRIVE_P10_URL
      },
      {
        key: "UPGRADE_P30",
        price: PRODUCT_CATALOG.UPGRADE_P30_FROM_A.priceYen,
        variation: CONFIG.VARIATION_UPGRADE_P30,
        url: CONFIG.DRIVE_P30_URL
      }
    ];
  }
  function validateConfig() {
    for (const [key, value] of Object.entries(CONFIG)) {
      if (!value.trim()) throw new Error("CONFIG_UNCONFIRMED:" + key);
      if (key.endsWith("URL") && !/^https:\/\/[^\s]+$/.test(value))
        throw new Error("URL_INVALID:" + key);
    }
    if (new Set(products().map((p) => p.variation)).size !== products().length)
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
    "WEBHOOK_VERIFICATION_MODE",
    "SQUARE_WEBHOOK_SIGNATURE_KEY",
    "SQUARE_WEBHOOK_NOTIFICATION_URL",
    "BUYER_EMAIL_ENABLED",
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
    const mode = required("WEBHOOK_VERIFICATION_MODE");
    if (!["REQUIRE_SIGNATURE", "API_RECHECK"].includes(mode))
      throw new Error("VERIFICATION_MODE_INVALID");
    const signatureKey = mode === "REQUIRE_SIGNATURE" ? required("SQUARE_WEBHOOK_SIGNATURE_KEY") : read("SQUARE_WEBHOOK_SIGNATURE_KEY")?.trim() ?? "";
    const notificationUrl = required("SQUARE_WEBHOOK_NOTIFICATION_URL");
    if (!/^https:\/\/[^\s]+$/.test(notificationUrl))
      throw new Error("NOTIFICATION_URL_INVALID");
    const buyerEmail = required("BUYER_EMAIL_ENABLED");
    if (!["true", "false"].includes(buyerEmail))
      throw new Error("BUYER_EMAIL_ENABLED_INVALID");
    return {
      verificationMode: mode,
      signatureKey,
      notificationUrl,
      buyerEmail: buyerEmail === "true",
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
    if (payment.refunded_money !== void 0) {
      const refund = payment.refunded_money;
      if (!refund || refund.currency !== "JPY" || refund.amount !== 0)
        throw new BusinessError("PAYMENT_REFUNDED");
    }
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
    const tip = payment.tip_money;
    if ([payment.amount_money, order.total_money, items[0].base_price_money].some(
      (m) => !m || m.currency !== "JPY" || m.amount !== product.price
    ) || tip !== void 0 && (!tip || tip.currency !== "JPY" || tip.amount !== 0))
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
    // 注文IDで送信状態を保存し、異なる決済通知から同じ注文へ再送しない。
    orderRow(id) {
      if (this.orders.getLastRow() > 1) {
        const rows = this.orders.getRange(2, 2, this.orders.getLastRow() - 1, 1).getValues();
        const index = rows.findIndex((row) => row[0] === id);
        if (index >= 0) return index + 2;
      }
      throw new Error("ORDER_RECORD_MISSING");
    }
    orderStatus(id) {
      return String(this.orders.getRange(this.orderRow(id), 7).getValues()[0][0]);
    }
    setOrderStatus(id, status) {
      this.orders.getRange(this.orderRow(id), 7).setValue(status);
      SpreadsheetApp.flush();
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
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error();
        if (key === void 0) return body;
        if (!body[key]) throw new Error();
        return body[key];
      } catch {
        throw new RetryError("SQUARE_INVALID_RESPONSE");
      }
    }
    post(path, payload, key) {
      const host = this.environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
      let response2;
      try {
        response2 = UrlFetchApp.fetch(host + path, {
          method: "post",
          muteHttpExceptions: true,
          contentType: "application/json",
          payload: JSON.stringify(payload),
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
      if (status < 200 || status >= 300)
        throw new BusinessError("SQUARE_HTTP_" + status);
      try {
        const body = JSON.parse(response2.getContentText());
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error();
        if (key === void 0) return body;
        if (!body[key]) throw new Error();
        return body[key];
      } catch {
        throw new RetryError("SQUARE_INVALID_RESPONSE");
      }
    }
    createQuickPayLink(input) {
      if (!input.idempotencyKey || input.idempotencyKey.length > 192)
        throw new BusinessError("IDEMPOTENCY_KEY_INVALID");
      if (!input.locationId || !input.name.trim())
        throw new BusinessError("CHECKOUT_INPUT_INVALID");
      if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
        throw new BusinessError("CHECKOUT_AMOUNT_INVALID");
      if (input.redirectUrl && !/^https:\/\/[^\s]+$/.test(input.redirectUrl))
        throw new BusinessError("CHECKOUT_REDIRECT_INVALID");
      const payload = {
        idempotency_key: input.idempotencyKey,
        quick_pay: {
          name: input.name.trim(),
          price_money: { amount: input.amount, currency: "JPY" },
          location_id: input.locationId
        }
      };
      if (input.redirectUrl)
        payload.checkout_options = { redirect_url: input.redirectUrl };
      if (input.note) payload.payment_note = input.note.slice(0, 500);
      const link = this.post("/v2/online-checkout/payment-links", payload, "payment_link");
      if (!link.id || !link.order_id || !/^https:\/\/[^\s]+$/.test(link.url))
        throw new RetryError("SQUARE_INVALID_RESPONSE");
      return link;
    }
    payment(id) {
      return this.get("/v2/payments/" + encodeURIComponent(id), "payment");
    }
    order(id) {
      return this.get("/v2/orders/" + encodeURIComponent(id), "order");
    }
    listPayments(begin, end, location, cursor) {
      const query = [
        ["begin_time", begin],
        ["end_time", end],
        ["location_id", location],
        ["sort_order", "ASC"],
        ["limit", "100"]
      ];
      if (cursor) query.push(["cursor", cursor]);
      const page = this.get(
        "/v2/payments?" + query.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&")
      );
      if (page.payments !== void 0 && !Array.isArray(page.payments) || page.cursor !== void 0 && typeof page.cursor !== "string")
        throw new RetryError("SQUARE_INVALID_RESPONSE");
      return { payments: page.payments ?? [], cursor: page.cursor ?? "" };
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

  // src/SquareSignature.ts
  function verifySquareSignature(rawBody, signature, key, notificationUrl) {
    if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const expected = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(
        notificationUrl + rawBody,
        key,
        Utilities.Charset.UTF_8
      )
    );
    if (signature.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++)
      difference |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    return difference === 0;
  }
  function directSquareSignature() {
    return null;
  }
  function webhookCapabilities() {
    return {
      rawBodyAccessible: true,
      standardSignatureHeaderAccessible: false,
      hmacComputationAvailable: true,
      standardSquareVerificationAvailable: false,
      basis: "DOCUMENTED_GAS_WEB_APP_EVENT"
    };
  }
  function verifySquareSignatureFromProperties(rawBody, signature) {
    const properties2 = PropertiesService.getScriptProperties();
    const key = properties2.getProperty("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const url = properties2.getProperty("SQUARE_WEBHOOK_NOTIFICATION_URL");
    if (!key || !url) throw new Error("SQUARE_SIGNATURE_SETTINGS_MISSING");
    return verifySquareSignature(rawBody, signature, key, url);
  }

  // src/EmailService.ts
  function purchaseEmail(record) {
    const names = {
      A: "A",
      P3: "P3",
      P10: "P10",
      P30: "P30",
      UPGRADE_P3: "P3\uFF08\u5DEE\u984D\u8CFC\u5165\uFF09",
      UPGRADE_P10: "P10\uFF08\u5DEE\u984D\u8CFC\u5165\uFF09",
      UPGRADE_P30: "P30\uFF08\u5DEE\u984D\u8CFC\u5165\uFF09"
    };
    const name = names[record.product];
    if (!name) throw new BusinessError("EMAIL_PRODUCT_UNKNOWN");
    const lines = [
      `GuestOps AI ${name} \u3092\u3054\u8CFC\u5165\u3044\u305F\u3060\u304D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002`,
      "",
      `\u6CE8\u6587ID\uFF1A${record.orderId}`,
      `\u8CFC\u5165\u91D1\u984D\uFF1A${record.amount.toLocaleString("ja-JP")}\u5186`,
      "",
      "\u3054\u8CFC\u5165\u5546\u54C1\u306EGoogle Drive\u30D5\u30A9\u30EB\u30C0\uFF1A",
      record.url,
      "\u30D5\u30A9\u30EB\u30C0\u5185\u306E\u6848\u5185PDF\u304B\u3089\u304A\u8AAD\u307F\u304F\u3060\u3055\u3044\u3002"
    ];
    if (record.product === "A")
      lines.push(
        "",
        "\u8FFD\u52A0\u8CFC\u5165\u306F\u4EFB\u610F\u3067\u3059\u3002\u4ECA\u56DE\u306E\u5546\u54C1\u306E\u53D7\u53D6\u306B\u8FFD\u52A0\u8CFC\u5165\u306F\u5FC5\u8981\u3042\u308A\u307E\u305B\u3093\u3002",
        "A\u8CFC\u5165\u8005\u5411\u3051\u306E\u5DEE\u984D\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9\uFF08\u540C\u3058\u8CFC\u5165\u8005\u306E\u5229\u7528\u65BD\u8A2D\u6570\u3092\u62E1\u5F35\uFF09\uFF1A",
        "P3\u306F\u6700\u59273\u65BD\u8A2D\u3001P10\u306F\u6700\u592710\u65BD\u8A2D\u3001P30\u306F\u6700\u592730\u65BD\u8A2D\u3067\u3059\u3002",
        "\u500B\u5225\u958B\u767A\u30FB\u8A2D\u5B9A\u4EE3\u884C\u30FB\u81EA\u52D5\u9001\u4FE1\u3092\u8FFD\u52A0\u3059\u308B\u5546\u54C1\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
        "P3\u5DEE\u984D\u8CFC\u5165\uFF1A" + CONFIG.UPGRADE_P3_URL,
        "P10\u5DEE\u984D\u8CFC\u5165\uFF1A" + CONFIG.UPGRADE_P10_URL,
        "P30\u5DEE\u984D\u8CFC\u5165\uFF1A" + CONFIG.UPGRADE_P30_URL
      );
    lines.push("", "\u3054\u4E0D\u660E\u306A\u70B9\u306F\u3053\u306E\u30E1\u30FC\u30EB\u3078\u8FD4\u4FE1\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    return {
      subject: `GuestOps AI ${name}\uFF1A\u3054\u8CFC\u5165\u5546\u54C1\u306E\u3054\u6848\u5185`,
      body: lines.join("\n")
    };
  }
  function deliverPurchase(store, record, replyTo) {
    const status = store.orderStatus(record.orderId);
    if (status === "DELIVERED") return;
    if (["DELIVERY_SENDING", "DELIVERY_REVIEW"].includes(status))
      throw new BusinessError("DELIVERY_REVIEW_REQUIRED");
    if (MailApp.getRemainingDailyQuota() < 1)
      throw new RetryError("MAIL_QUOTA_EXHAUSTED");
    const message = purchaseEmail(record);
    store.setOrderStatus(record.orderId, "DELIVERY_SENDING");
    try {
      MailApp.sendEmail({
        to: record.email,
        subject: message.subject,
        body: message.body,
        replyTo,
        name: "GuestOps AI"
      });
    } catch {
      store.setOrderStatus(record.orderId, "DELIVERY_REVIEW");
      throw new BusinessError("DELIVERY_RESULT_UNCERTAIN");
    }
    store.setOrderStatus(record.orderId, "DELIVERED");
  }

  // src/Readiness.ts
  function inspectProductionSettings(read) {
    const values = {};
    try {
      for (const key of PROPERTY_KEYS) values[key] = read(key)?.trim() ?? "";
    } catch {
      return {
        configurationValid: false,
        issue: "PROPERTY_READ_FAILED",
        liveAcceptanceVerified: false
      };
    }
    const optional = values.WEBHOOK_VERIFICATION_MODE === "API_RECHECK" ? ["SQUARE_WEBHOOK_SIGNATURE_KEY"] : [];
    const missingKeys = PROPERTY_KEYS.filter(
      (key) => !optional.includes(key) && !values[key]
    );
    let configurationValid = false;
    const previous = { ...CONFIG };
    try {
      loadSettings((key) => values[key]);
      configurationValid = true;
    } catch {
    } finally {
      Object.assign(CONFIG, previous);
    }
    const verificationMode = ["REQUIRE_SIGNATURE", "API_RECHECK"].includes(
      values.WEBHOOK_VERIFICATION_MODE
    ) ? values.WEBHOOK_VERIFICATION_MODE : "UNCONFIRMED";
    return {
      configurationValid,
      missingKeys,
      issue: configurationValid ? null : "SETTINGS_INVALID",
      verificationMode,
      automationEnabled: values.AUTOMATION_ENABLED === "true",
      buyerEmailEnabled: values.BUYER_EMAIL_ENABLED === "true",
      directWebhookBlocked: verificationMode !== "API_RECHECK",
      standardSignatureVerified: false,
      liveAcceptanceVerified: false,
      salesOrDeliveryVerified: false
    };
  }

  // src/PaymentReconciliation.ts
  function validateReconciliationWindow(begin, end) {
    const a = Date.parse(begin), b = Date.parse(end);
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    if (!iso.test(begin) || !iso.test(end) || !Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > 864e5 || b > Date.now())
      throw new BusinessError("RECONCILIATION_WINDOW_INVALID");
  }
  function reconcilePaymentPage(page, api, location, enqueue) {
    if (page.length > 100)
      throw new BusinessError("RECONCILIATION_PAGE_TOO_LARGE");
    let queued = 0, duplicates = 0, skipped = 0, review = 0;
    const seen = /* @__PURE__ */ new Set();
    for (const hint of page) {
      if (!hint || typeof hint.id !== "string" || !hint.id || seen.has(hint.id) || hint.status !== "COMPLETED" || hint.location_id !== location) {
        skipped++;
        continue;
      }
      seen.add(hint.id);
      try {
        getRecord(api, hint.id, location);
      } catch (error) {
        if (!(error instanceof BusinessError)) throw error;
        if (error.message === "PRODUCT_UNKNOWN") skipped++;
        else review++;
        continue;
      }
      if (enqueue(hint.id)) queued++;
      else duplicates++;
    }
    return {
      queued,
      duplicates,
      skipped,
      review,
      customerRevenueVerified: false
    };
  }

  // src/Runtime.ts
  function productionReadiness() {
    const report = inspectProductionSettings(
      (key) => PropertiesService.getScriptProperties().getProperty(key)
    );
    console.log(JSON.stringify(report));
    return report;
  }
  function reconcilePayments() {
    if (properties().getProperty("AUTOMATION_ENABLED") !== "true" || properties().getProperty("RECONCILIATION_ENABLED") !== "true")
      throw new Error("RECONCILIATION_DISABLED");
    const config = settings();
    if (config.verificationMode !== "API_RECHECK")
      throw new Error("SQUARE_SIGNATURE_HEADER_UNAVAILABLE");
    return locked(() => {
      const begin = properties().getProperty("RECONCILE_BEGIN_UTC") ?? "";
      const end = properties().getProperty("RECONCILE_END_UTC") ?? "";
      validateReconciliationWindow(begin, end);
      const cursor = properties().getProperty("RECONCILE_CURSOR") ?? "";
      const window = begin + "|" + end;
      if (cursor && properties().getProperty("RECONCILE_CURSOR_WINDOW") !== window)
        throw new Error("RECONCILIATION_CURSOR_WINDOW_MISMATCH");
      const api = new SquareService(
        config.token,
        config.version,
        config.environment
      );
      const page = api.listPayments(begin, end, config.location, cursor);
      const store = sheets(config.spreadsheet);
      const report = reconcilePaymentPage(
        page.payments,
        api,
        config.location,
        (id) => store.enqueue(id)
      );
      properties().setProperty("RECONCILE_CURSOR_WINDOW", window);
      properties().setProperty("RECONCILE_CURSOR", page.cursor);
      const result = { ...report, hasMore: !!page.cursor, pageCompleted: true };
      new Logger(store).log("INFO", "RECONCILIATION", JSON.stringify(result));
      return result;
    });
  }
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
    const raw = e.postData?.contents ?? "";
    if (config.verificationMode === "REQUIRE_SIGNATURE") {
      const signature = directSquareSignature();
      if (!signature) throw new Error("SQUARE_SIGNATURE_HEADER_UNAVAILABLE");
      if (!verifySquareSignatureFromProperties(raw, signature))
        throw new Error("SQUARE_SIGNATURE_INVALID");
    }
    let id;
    try {
      id = paymentHint(raw, config.merchant);
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
    return locked(() => {
      const store = sheets(config.spreadsheet);
      const queued = store.enqueue(id);
      if (queued)
        new Logger(store).log(
          "WARN",
          "WEBHOOK_SECURITY",
          "SIGNATURE_UNVERIFIED_API_RECHECK"
        );
      return response(queued ? "queued" : "duplicate");
    });
  }
  function processQueue() {
    if (properties().getProperty("AUTOMATION_ENABLED") !== "true") return;
    const config = settings(), started = Date.now();
    if (config.verificationMode === "REQUIRE_SIGNATURE")
      throw new Error("SQUARE_SIGNATURE_HEADER_UNAVAILABLE");
    return locked(() => {
      const store = sheets(config.spreadsheet), logger = new Logger(store), api = new SquareService(config.token, config.version, config.environment);
      let processed = 0;
      for (const { row, job } of store.jobs()) {
        if (Date.now() - started > 18e4 || processed >= 10) break;
        if (job.state === "PENDING" && job.nextAt <= Date.now()) {
          const result = runJob(job, Date.now(), () => {
            const record = getRecord(api, job.paymentId, config.location);
            store.save(record);
            if (config.buyerEmail) deliverPurchase(store, record, config.admin);
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
