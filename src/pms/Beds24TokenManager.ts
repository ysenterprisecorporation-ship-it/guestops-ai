import { PmsHttpClient, parseJson, require2xx } from "./PmsHttpClient";

export interface Beds24TokenStore {
  get(key: string): string;
  set(key: string, value: string): void;
}
type AuthReply = { token?: unknown; refreshToken?: unknown; expiresIn?: unknown };
export class Beds24TokenManager {
  constructor(private readonly http: PmsHttpClient, private readonly store: Beds24TokenStore,
    private readonly baseUrl = "https://api.beds24.com/v2") {}
  exchangeInviteCode(inviteCode: string, now = Date.now()): void {
    if (!inviteCode || inviteCode.length > 512) throw new Error("BEDS24_INVITE_CODE_INVALID");
    const response = this.http.request("GET", this.baseUrl + "/authentication/setup",
      {code:inviteCode,accept:"application/json"});
    require2xx(response.status,response.body);
    const data = parseJson<AuthReply>(response.body);
    if(typeof data.token !== "string" || !data.token ||
      typeof data.refreshToken !== "string" || !data.refreshToken ||
      typeof data.expiresIn !== "number" || data.expiresIn < 60)
      throw new Error("BEDS24_SETUP_RESPONSE_INVALID");
    this.store.set("BEDS24_REFRESH_TOKEN",data.refreshToken);
    this.store.set("BEDS24_ACCESS_TOKEN",data.token);
    this.store.set("BEDS24_ACCESS_EXPIRES_AT",String(now + data.expiresIn * 1000));
  }
  accessToken(now = Date.now()): string {
    const token = this.store.get("BEDS24_ACCESS_TOKEN");
    const expires = Number(this.store.get("BEDS24_ACCESS_EXPIRES_AT"));
    if (token && Number.isFinite(expires) && expires - now > 5 * 60_000) return token;
    const refresh = this.store.get("BEDS24_REFRESH_TOKEN");
    if (!refresh) throw new Error("BEDS24_REFRESH_TOKEN_MISSING");
    const response = this.http.request("GET", this.baseUrl + "/authentication/token",
      {refreshToken: refresh,accept:"application/json"});
    require2xx(response.status,response.body);
    const data = parseJson<AuthReply>(response.body);
    if (typeof data.token !== "string" || !data.token ||
      typeof data.expiresIn !== "number" || data.expiresIn < 60)
      throw new Error("BEDS24_TOKEN_RESPONSE_INVALID");
    this.store.set("BEDS24_ACCESS_TOKEN",data.token);
    this.store.set("BEDS24_ACCESS_EXPIRES_AT",String(now + data.expiresIn * 1000));
    if (typeof data.refreshToken === "string" && data.refreshToken)
      this.store.set("BEDS24_REFRESH_TOKEN",data.refreshToken);
    return data.token;
  }
}
export class GasBeds24TokenStore implements Beds24TokenStore {
  get(key: string): string { return PropertiesService.getScriptProperties().getProperty(key) ?? ""; }
  set(key: string,value:string):void { PropertiesService.getScriptProperties().setProperty(key,value); }
}
