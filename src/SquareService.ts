import { BusinessError, RetryError, type Payment, type Order } from "./Types";
// API versionは確認済みの値をScript Propertiesへ設定する。
export class SquareService {
  constructor(
    private token: string,
    private version: string,
    private environment: string,
  ) {}
  private get<T>(path: string, key?: string): T {
    const host =
      this.environment === "sandbox"
        ? "https://connect.squareupsandbox.com"
        : "https://connect.squareup.com";
    let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
    try {
      response = UrlFetchApp.fetch(host + path, {
        method: "get",
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + this.token,
          "Square-Version": this.version,
          Accept: "application/json",
        },
      });
    } catch {
      throw new RetryError("SQUARE_NETWORK");
    }
    const status = response.getResponseCode();
    if (status === 429 || status >= 500)
      throw new RetryError("SQUARE_HTTP_" + status);
    if (status !== 200) throw new BusinessError("SQUARE_HTTP_" + status);
    try {
      const body = JSON.parse(response.getContentText()) as Record<string, T>;
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
      if (key === undefined) return body as T;
      if (!body[key]) throw new Error();
      return body[key];
    } catch {
      throw new RetryError("SQUARE_INVALID_RESPONSE");
    }
  }
  private post<T>(path: string, payload: Record<string, unknown>, key?: string): T {
    const host =
      this.environment === "sandbox"
        ? "https://connect.squareupsandbox.com"
        : "https://connect.squareup.com";
    let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
    try {
      response = UrlFetchApp.fetch(host + path, {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        payload: JSON.stringify(payload),
        headers: {
          Authorization: "Bearer " + this.token,
          "Square-Version": this.version,
          Accept: "application/json",
        },
      });
    } catch {
      throw new RetryError("SQUARE_NETWORK");
    }
    const status = response.getResponseCode();
    if (status === 429 || status >= 500)
      throw new RetryError("SQUARE_HTTP_" + status);
    if (status < 200 || status >= 300)
      throw new BusinessError("SQUARE_HTTP_" + status);
    try {
      const body = JSON.parse(response.getContentText()) as Record<string, T>;
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
      if (key === undefined) return body as T;
      if (!body[key]) throw new Error();
      return body[key];
    } catch {
      throw new RetryError("SQUARE_INVALID_RESPONSE");
    }
  }
  createQuickPayLink(input: {
    idempotencyKey: string;
    locationId: string;
    name: string;
    amount: number;
    redirectUrl?: string;
    note?: string;
  }) {
    if (!input.idempotencyKey || input.idempotencyKey.length > 192)
      throw new BusinessError("IDEMPOTENCY_KEY_INVALID");
    if (!input.locationId || !input.name.trim())
      throw new BusinessError("CHECKOUT_INPUT_INVALID");
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
      throw new BusinessError("CHECKOUT_AMOUNT_INVALID");
    if (input.redirectUrl && !/^https:\/\/[^\s]+$/.test(input.redirectUrl))
      throw new BusinessError("CHECKOUT_REDIRECT_INVALID");
    const payload: Record<string, unknown> = {
      idempotency_key: input.idempotencyKey,
      quick_pay: {
        name: input.name.trim(),
        price_money: { amount: input.amount, currency: "JPY" },
        location_id: input.locationId,
      },
    };
    if (input.redirectUrl)
      payload.checkout_options = { redirect_url: input.redirectUrl };
    if (input.note) payload.payment_note = input.note.slice(0, 500);
    const link = this.post<{
      id: string;
      order_id: string;
      url: string;
      long_url?: string;
    }>("/v2/online-checkout/payment-links", payload, "payment_link");
    if (!link.id || !link.order_id || !/^https:\/\/[^\s]+$/.test(link.url))
      throw new RetryError("SQUARE_INVALID_RESPONSE");
    return link;
  }
  payment(id: string): Payment {
    return this.get("/v2/payments/" + encodeURIComponent(id), "payment");
  }
  order(id: string): Order {
    return this.get("/v2/orders/" + encodeURIComponent(id), "order");
  }
  listPayments(begin: string, end: string, location: string, cursor?: string) {
    const query = [
      ["begin_time", begin],
      ["end_time", end],
      ["location_id", location],
      ["sort_order", "ASC"],
      ["limit", "100"],
    ];
    if (cursor) query.push(["cursor", cursor]);
    const page = this.get<{ payments?: Payment[]; cursor?: string }>(
      "/v2/payments?" +
        query.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&"),
    );
    if (
      (page.payments !== undefined && !Array.isArray(page.payments)) ||
      (page.cursor !== undefined && typeof page.cursor !== "string")
    )
      throw new RetryError("SQUARE_INVALID_RESPONSE");
    return { payments: page.payments ?? [], cursor: page.cursor ?? "" };
  }
}
