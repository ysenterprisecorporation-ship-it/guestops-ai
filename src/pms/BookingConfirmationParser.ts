import { ReservationNotice } from "./ReservationNoticeAudit";
/** Read-only Booking.com notification parser. Never stores guests or raw bodies. */
export function parseBookingConfirmation(subject:string,body:string):ReservationNotice|null {
 if(!subject.includes("Booking.com")) return null;
 const match=subject.match(/(?:新しい予約がありました|new reservation|New booking)[^\n]*?\((\d{10})[,)]/i);
 if(!match) return null;
 const id=match[1];
 // Require the booking reference in both independent sections of the notification.
 if(!new RegExp("(?:^|\\D)"+id+"(?:\\D|$)").test(body)) return null;
 if(!/Booking confirmation/i.test(body)) return null;
 return {identifier:id,source:"booking-com",state:"new"};
}
export function collectBookingConfirmationSignals(messages:{subject:string;body:string}[]):ReservationNotice[]{
 const seen=new Set<string>();
 const signals:ReservationNotice[]=[];
 for(const message of messages){
  const notice=parseBookingConfirmation(message.subject,message.body);
  if(notice && !seen.has(notice.identifier)){
   seen.add(notice.identifier);signals.push(notice);
  }
 }
 return signals;
}

/** Cancellation notifications are separate lifecycle evidence, not inventory release authorization. */
export function parseBookingCancellation(subject:string,body:string):ReservationNotice|null {
 if(!subject.startsWith("Booking.com"))return null;
 const match=subject.match(/予約のキャンセルがありました\s*\((\d{10})[,)]/);
 if(!match)return null;
 const id=match[1];
 if(!/Cancellation/i.test(body))return null;
 if(!new RegExp("(?:^|\\D)"+id+"(?:\\D|$)").test(body))return null;
 return {identifier:id,source:"booking-com",state:"cancel"};
}
export interface DatedBookingNotice {notice:ReservationNotice;timestamp:string}
export function latestBookingNoticeStates(events:DatedBookingNotice[]){
 const sorted=[...events].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 const states=new Map<string,"new"|"cancel"|"modify">();
 for(const event of sorted){
  if(!Number.isFinite(Date.parse(event.timestamp)))throw new Error("BOOKING_NOTICE_TIMESTAMP_INVALID");
  states.set(event.notice.identifier,event.notice.state);
 }
 return [...states].map(([identifier,lastNotification])=>({identifier,lastNotification,liveOTAStatusVerified:false}));
}
