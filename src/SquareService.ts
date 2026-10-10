import { BusinessError, RetryError, type Payment, type Order } from "./Types";
// API versionは確認済みの値をScript Propertiesへ設定する。
export class SquareService {
  constructor(
    private token: string,
    private version: string,
    private environment: string,
  ) {}
  private get<T>(path: string, key: string): T {
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
      if (!body[key]) throw new Error();
      return body[key];
    } catch {
      throw new RetryError("SQUARE_INVALID_RESPONSE");
    }
  }
  payment(id: string): Payment {
    return this.get("/v2/payments/" + encodeURIComponent(id), "payment");
  }
  order(id: string): Order {
    return this.get("/v2/orders/" + encodeURIComponent(id), "order");
  }
}
