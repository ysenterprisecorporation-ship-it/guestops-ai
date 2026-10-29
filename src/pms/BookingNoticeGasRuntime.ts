import { collectBookingConfirmationSignals } from "./BookingConfirmationParser";
import { ReservationNotice } from "./ReservationNoticeAudit";
/** Gmail read-only inbox scan for Booking.com reservation notices. No guest PII leaves this function. */
export function beds24BookingNoticeInboxAudit(): { total:number; ids:string[]; cutoverBlocked:boolean; readOnly:true } {
 const threads=GmailApp.search('from:(noreply@booking.com) subject:("新しい予約がありました") newer_than:120d',0,100);
 const messages:{subject:string;body:string}[]=[];
 for(const thread of threads) for(const message of thread.getMessages()){
  if(message.getFrom().toLowerCase().includes("booking.com")){
   messages.push({subject:message.getSubject(),body:message.getPlainBody()});
  }
 }
 const signals:ReservationNotice[]=collectBookingConfirmationSignals(messages);
 return {total:signals.length,ids:signals.map(s=>s.identifier).sort(),cutoverBlocked:signals.length>0,readOnly:true};
}
