export interface ReservationNotice { identifier:string; source:"booking-com"; state:"new"|"cancel"|"modify"; }
export function reviewReservationNotices(notices:ReservationNotice[]) {
 const ids=[...new Set(notices.map(x=>x.identifier))];
 if(ids.some(x=>!/^\d{10}$/.test(x))) throw new Error("RESERVATION_NOTICE_ID_INVALID");
 return {requiresProviderVerification:ids,cutoverBlocked:ids.length>0};
}
// Notification messages are discovery evidence, never sufficient to mark a reservation as live or imported.
