import { collectBookingConfirmationSignals } from "./BookingConfirmationParser";
/** A pure audit of explicitly supplied notices; no Gmail account is silently assumed. */
export function auditBookingNotices(messages: {subject:string;body:string}[]) {
 const signals=collectBookingConfirmationSignals(messages);
 return {total:signals.length,ids:signals.map(s=>s.identifier).sort(),cutoverBlocked:signals.length>0,readOnly:true as const};
}
