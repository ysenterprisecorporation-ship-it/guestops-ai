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
