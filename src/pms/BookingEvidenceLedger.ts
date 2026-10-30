export interface BookingNotificationRecord { id:string; arrival:string; receivedAt:string; kind:"new"|"cancel" }
export interface BookingEvidenceRow { id:string; arrival:string; lastNotification:"new"|"cancel"; lastReceivedAt:string; liveStatus:"unverified"; }
const validDate=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
export function buildBookingEvidenceLedger(events:BookingNotificationRecord[]):BookingEvidenceRow[]{
 const latest=new Map<string,BookingEvidenceRow>();
 for(const e of events){
  if(!/^\d{10}$/.test(e.id)||!validDate(e.arrival)||!Number.isFinite(Date.parse(e.receivedAt)))
    throw new Error("BOOKING_EVIDENCE_INVALID");
  const old=latest.get(e.id);
  if(!old || Date.parse(e.receivedAt)>Date.parse(old.lastReceivedAt)){
   latest.set(e.id,{id:e.id,arrival:e.arrival,lastNotification:e.kind,lastReceivedAt:e.receivedAt,liveStatus:"unverified"});
  }
 }
 return [...latest.values()].sort((a,b)=>a.arrival.localeCompare(b.arrival)||a.id.localeCompare(b.id));
}
export function summarizeBookingEvidence(rows:BookingEvidenceRow[],asOf:string){
 if(!validDate(asOf))throw new Error("AS_OF_DATE_INVALID");
 const future=rows.filter(x=>x.arrival>=asOf);
 return {notificationOnly:true,total:future.length,lastNew:future.filter(x=>x.lastNotification==="new").length,
   lastCancelled:future.filter(x=>x.lastNotification==="cancel").length,allLiveStatusesUnverified:true};
}
export function exportBookingEvidenceCsv(rows:BookingEvidenceRow[]):string {
 const headers="reservation_id,arrival,last_notification,last_received_at,live_status";
 return [headers,...rows.map(r=>[r.id,r.arrival,r.lastNotification,r.lastReceivedAt,r.liveStatus].join(","))].join("\n")+"\n";
}
