/** Create a conservative set of occupied nights from verified OTA reservations.
 * Departure date is not occupied; no OTA write is performed.
 */
export interface VerifiedStay { externalId:string; arrival:string; departure:string; status:"confirmed"|"cancelled"; }
const parseDay=(day:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error("DATE_FORMAT_INVALID");
 const ms=Date.parse(day+"T00:00:00Z");
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)throw new Error("DATE_VALUE_INVALID");
 return ms;
};
export function bookedNightProtection(stays:VerifiedStay[]){
 const occupied=new Map<string,string[]>();
 for(const stay of stays){
  if(!/^\d{10}$/.test(stay.externalId))throw new Error("RESERVATION_ID_INVALID");
  const start=parseDay(stay.arrival),end=parseDay(stay.departure);
  if(start>=end||end-start>366*86400000)throw new Error("RESERVATION_RANGE_INVALID");
  if(stay.status!=="confirmed")continue;
  for(let time=start;time<end;time+=86400000){
   const date=new Date(time).toISOString().slice(0,10);
   occupied.set(date,[...(occupied.get(date)??[]),stay.externalId]);
  }
 }
 return [...occupied].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,bookingIds])=>({date,bookingIds,overlap:bookingIds.length>1}));
}
