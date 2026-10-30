import { Beds24TokenManager, GasBeds24TokenStore } from "./Beds24TokenManager";
import { GasPmsHttpClient } from "./PmsHttpClient";
import { Beds24Adapter } from "./Beds24Adapter";

function requireReadOnly(): void {
 const value=PropertiesService.getScriptProperties().getProperty("GTOS_BEDS24_READ_ENABLED");
 if (value !== "true") throw new Error("GTOS_BEDS24_READ_DISABLED");
}
export function beds24ReadOnlyStatus() {
 const props=PropertiesService.getScriptProperties();
 return {
  mode:"READ_ONLY",
  enabled: props.getProperty("GTOS_BEDS24_READ_ENABLED")==="true",
  refreshTokenConfigured:!!props.getProperty("BEDS24_REFRESH_TOKEN"),
  propertyIdConfigured:!!props.getProperty("GTOS_BEDS24_TEST_PROPERTY_ID"),
  anyOutboundWritesEnabled:false,
 };
}
export function beds24ReadOnlyBooking(bookingId: string) {
 requireReadOnly();
 if (!/^\d{1,20}$/.test(bookingId)) throw new Error("BEDS24_BOOKING_ID_INVALID");
 const props=PropertiesService.getScriptProperties();
 const expectedProperty=props.getProperty("GTOS_BEDS24_TEST_PROPERTY_ID");
 if(!expectedProperty) throw new Error("GTOS_TEST_PROPERTY_NOT_CONFIGURED");
 const http=new GasPmsHttpClient();
 const token=new Beds24TokenManager(http,new GasBeds24TokenStore()).accessToken();
 const booking=new Beds24Adapter({token},http).getBooking(bookingId);
 if(!booking) return {found:false,bookingId};
 if(String(booking.propertyId)!==expectedProperty)
   throw new Error("BEDS24_TEST_PROPERTY_MISMATCH");
 // Do not return guest PII, raw OTA payload, or security credentials.
 return {found:true,bookingId:booking.id,propertyId:booking.propertyId,
  arrival:booking.arrival,departure:booking.departure,status:booking.status};
}

export function beds24SetupInviteCode() {
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty("GTOS_BEDS24_SETUP_ENABLED")!=="true")
   throw new Error("GTOS_BEDS24_SETUP_DISABLED");
 const code=props.getProperty("BEDS24_INVITE_CODE");
 if(!code) throw new Error("BEDS24_INVITE_CODE_MISSING");
 new Beds24TokenManager(new GasPmsHttpClient(),new GasBeds24TokenStore()).exchangeInviteCode(code);
 props.deleteProperty("BEDS24_INVITE_CODE");
 props.deleteProperty("GTOS_BEDS24_SETUP_ENABLED");
 return {setup:"SUCCESS",inviteCodeRemoved:true};
}

export function beds24ConnectionTest() {
 requireReadOnly();
 const http=new GasPmsHttpClient();
 const token=new Beds24TokenManager(http,new GasBeds24TokenStore()).accessToken();
 const response=http.request("GET","https://beds24.com/api/v2/bookings?limit=1",
   {token,accept:"application/json"});
 if(response.status<200 || response.status>=300)
   throw new Error("BEDS24_LIVE_TEST_HTTP_"+response.status);
 let parsed:unknown;
 try { parsed=JSON.parse(response.body); }
 catch { throw new Error("BEDS24_LIVE_TEST_INVALID_JSON"); }
 if(!Array.isArray(parsed) && !(parsed && typeof parsed==="object" &&
   Array.isArray((parsed as {data?:unknown}).data)))
   throw new Error("BEDS24_LIVE_TEST_UNEXPECTED_RESPONSE");
 return {connected:true,readOnly:true,responseSchema:"BOOKINGS_ARRAY",
   // No guest names, booking IDs, OTA payloads, or tokens returned.
   accessTokenRefreshValidated:true};
}

export function beds24PropertyReadAudit() {
 requireReadOnly();
 const props=PropertiesService.getScriptProperties();
 const propertyId=props.getProperty("GTOS_BEDS24_TEST_PROPERTY_ID");
 if(!propertyId || !/^\d+$/.test(propertyId)) throw new Error("BEDS24_TEST_PROPERTY_NOT_CONFIGURED");
 const http=new GasPmsHttpClient();
 const token=new Beds24TokenManager(http,new GasBeds24TokenStore()).accessToken();
 const response=http.request("GET",
   "https://beds24.com/api/v2/properties?id="+encodeURIComponent(propertyId),
   {token,accept:"application/json"});
 if(response.status<200 || response.status>=300) throw new Error("BEDS24_PROPERTY_HTTP_"+response.status);
 let data:unknown;
 try {data=JSON.parse(response.body);} catch {throw new Error("BEDS24_PROPERTY_INVALID_JSON");}
 const rows=Array.isArray(data)?data:
   data && typeof data==="object" && Array.isArray((data as {data?:unknown}).data)
     ?(data as {data:unknown[]}).data:[];
 const matches=rows.filter(row=>row && typeof row==="object" &&
   String((row as {id?:unknown}).id)===propertyId);
 if(matches.length!==1) throw new Error("BEDS24_PROPERTY_ID_NOT_UNIQUELY_VERIFIED");
 return {propertyId,apiVerified:true,recordsMatched:1,readOnly:true};
}

/** No-argument read-only snapshot; paginates, rejects loops and unexpected hosts. */
export function beds24PropertyBookingSnapshot() {
 requireReadOnly();
 const props=PropertiesService.getScriptProperties();
 const propertyId=props.getProperty("GTOS_BEDS24_TEST_PROPERTY_ID");
 if(!propertyId || !/^\d+$/.test(propertyId)) throw new Error("BEDS24_TEST_PROPERTY_NOT_CONFIGURED");
 const http=new GasPmsHttpClient();
 const token=new Beds24TokenManager(http,new GasBeds24TokenStore()).accessToken();
 const counts:Record<string,number>={};
 const seen=new Set<string>();
 let next="https://beds24.com/api/v2/bookings?propertyId="+encodeURIComponent(propertyId)+"&limit=100";
 let recordCount=0;
 let pages=0;
 while(next && pages<20){
  // Apps Script V8 does not consistently expose the WHATWG URL global.
  const endpoint=next;
  if(!/^https:\/\/beds24\.com\/api\/v2\/bookings(?:\?|$)/.test(endpoint))
    throw new Error("BEDS24_UNTRUSTED_NEXT_PAGE");
  const match=endpoint.match(/[?&]propertyId=([^&]+)/);
  if(!match || decodeURIComponent(match[1])!==propertyId)
    throw new Error("BEDS24_PAGINATION_PROPERTY_FILTER_LOST");
  if(seen.has(endpoint)) throw new Error("BEDS24_PAGINATION_LOOP");
  seen.add(endpoint);
  const response=http.request("GET",endpoint,{token,accept:"application/json"});
  if(response.status<200||response.status>=300) throw new Error("BEDS24_SNAPSHOT_HTTP_"+response.status);
  let parsed:unknown;
  try {parsed=JSON.parse(response.body);}catch{throw new Error("BEDS24_SNAPSHOT_JSON_INVALID");}
  const value=parsed && typeof parsed==="object"&&!Array.isArray(parsed)
    ? parsed as {data?:unknown;nextPageLink?:unknown}:null;
  const rows=Array.isArray(parsed)?parsed: value && Array.isArray(value.data)?value.data:null;
  if(!rows) throw new Error("BEDS24_SNAPSHOT_SCHEMA_UNKNOWN");
  for(const entry of rows){
   if(!entry || typeof entry!=="object") throw new Error("BEDS24_SNAPSHOT_ROW_INVALID");
   const row=entry as {propertyId?:unknown;status?:unknown};
   if(String(row.propertyId)!==propertyId)throw new Error("BEDS24_SNAPSHOT_CROSS_PROPERTY");
   const status=typeof row.status==="string"?row.status:"UNKNOWN";
   counts[status]=(counts[status]??0)+1;
   recordCount++;
  }
  pages++;
  if(Array.isArray(parsed) && rows.length>=100) throw new Error("BEDS24_SNAPSHOT_PAGINATION_UNVERIFIED");
  if(value && value.nextPageLink!==undefined && value.nextPageLink!==null && typeof value.nextPageLink!=="string")
    throw new Error("BEDS24_SNAPSHOT_NEXT_LINK_INVALID");
  next=value && typeof value.nextPageLink==="string" && value.nextPageLink
    ? value.nextPageLink.startsWith("/") ? "https://beds24.com"+value.nextPageLink : value.nextPageLink : "";
  if(!next && rows.length===100) throw new Error("BEDS24_SNAPSHOT_TRUNCATION_POSSIBLE");
 }
 if(next)throw new Error("BEDS24_SNAPSHOT_PAGE_LIMIT_EXCEEDED");
 return {propertyId,readOnly:true,recordCount,statuses:counts,pages,complete:true,
  guestDataReturned:false};
}
