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
