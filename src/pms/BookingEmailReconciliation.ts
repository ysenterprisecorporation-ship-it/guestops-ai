import { parseReservationEmail } from "./ReservationEmailParser";
export interface NotificationInput {id:string;from:string;subject:string;body:string;receivedAt:string}
export interface BookingNoticeSummary {
  reservationCode:string;
  lastEvent:"BOOKING_NEW"|"BOOKING_CANCELLED"|"BOOKING_CHANGE";
  lastMessageId:string;
  receivedAt:string;
  requiresPmsVerification:true;
}
export interface ReconciliationReport {
  bookings:BookingNoticeSummary[];
  messageOnlyCount:number;
  invalidCount:number;
  issues:string[];
}
// Observational mail replay only. It does NOT open inventory or authorize cleaning.
export function reconcileBookingNotifications(messages:NotificationInput[]):ReconciliationReport {
 const byCode=new Map<string,BookingNoticeSummary>();
 const issues:string[]=[];
 let messageOnlyCount=0,invalidCount=0;
 const sorted=[...messages].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.id.localeCompare(b.id));
 for(const message of sorted) {
  const event=parseReservationEmail(message);
  if (event.eventType==="GUEST_MESSAGE") {messageOnlyCount++;continue;}
  if (event.eventType==="UNKNOWN" || event.provider==="unknown" || !event.reservationCode ||
    !Number.isFinite(Date.parse(message.receivedAt))) {
    invalidCount++;issues.push("UNVERIFIABLE_NOTIFICATION:"+message.id);continue;
  }
  const existing=byCode.get(event.reservationCode);
  if (existing && message.receivedAt===existing.receivedAt && existing.lastEvent!==event.eventType) {
    issues.push("SAME_TIME_CONFLICT:"+event.reservationCode);continue;
  }
  byCode.set(event.reservationCode,{
   reservationCode:event.reservationCode,
   lastEvent:event.eventType,
   lastMessageId:message.id,
   receivedAt:message.receivedAt,
   requiresPmsVerification:true,
  });
 }
 return {bookings:[...byCode.values()],messageOnlyCount,invalidCount,issues};
}
