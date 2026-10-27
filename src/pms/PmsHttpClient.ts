export interface PmsHttpResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export interface PmsHttpClient {
  request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    headers?: Record<string, string>,
    body?: string,
  ): PmsHttpResponse;
}

export class GasPmsHttpClient implements PmsHttpClient {
  request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    headers: Record<string, string> = {},
    body?: string,
  ): PmsHttpResponse {
    const response = UrlFetchApp.fetch(url, {
      method: method.toLowerCase() as GoogleAppsScript.URL_Fetch.HttpMethod,
      headers,
      payload: body,
      contentType: body ? "application/json" : undefined,
      muteHttpExceptions: true,
    });
    const responseHeaders = response.getHeaders();
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(responseHeaders))
      normalized[key] = String(value);
    return {
      status: response.getResponseCode(),
      body: response.getContentText(),
      headers: normalized,
    };
  }
}

export function parseJson<T>(body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("PMS_RESPONSE_INVALID_JSON");
  }
}

export function require2xx(status: number, body: string) {
  if (status < 200 || status >= 300)
    throw new Error(`PMS_HTTP_ERROR:${status}:${body.slice(0, 300)}`);
}
