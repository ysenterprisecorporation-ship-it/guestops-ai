/**
 * OTA reservation identity and lifecycle reconciliation.
 * A date-only inventory match is insufficient: cancelled or duplicated
 * bookings can yield equal intervals while pointing to different reservations.
 * This module is pure and never writes to an OTA.
 */
export interface BookingSnapshot {
  provider: "beds24"|"airbnb-stay"|"airbnb-monthly"|"booking-com";
  externalId: string;
  beds24Id?: string;
  propertyId: string;
  arrival: string;
  departure: string;
  status: "confirmed"|"cancelled"|"modified"|"pending";
}
export interface BookingMatch { safe: boolean; blockers: string[] }
const iso=/^\d{4}-\d{2}-\d{2}$/;
const dateOk=(s:string)=>iso.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const key=(b:BookingSnapshot)=>b.provider+":"+b.externalId;
export function compareBookingSnapshots(ota:BookingSnapshot[],pms:BookingSnapshot[],expectedPropertyId:string):BookingMatch{
 const blockers:string[]=[];
 if(!expectedPropertyId.trim()) return {safe:false,blockers:["PROPERTY_ID_MISSING"]};
 for(const [label,rows] of [["OTA",ota],["PMS",pms]] as const){
  const seen=new Set<string>();
  for(const b of rows){
   if(!b.externalId.trim()) blockers.push(label+"_MISSING_BOOKING_ID");
   if(b.propertyId!==expectedPropertyId) blockers.push(label+"_WRONG_PROPERTY:"+key(b));
   if(!dateOk(b.arrival)||!dateOk(b.departure)||b.arrival>=b.departure) blockers.push(label+"_INVALID_DATES:"+key(b));
   if(seen.has(key(b))) blockers.push(label+"_DUPLICATE_ID:"+key(b));
   seen.add(key(b));
  }
 }
 const byPms=new Map<string,BookingSnapshot[]>();
 for(const p of pms) for(const id of [p.beds24Id,p.externalId]) {
  if(id) byPms.set(id,[...(byPms.get(id)??[]),p]);
 }
 for(const b of ota){
  const matching=byPms.get(b.beds24Id??b.externalId)??[];
  const distinct=Array.from(new Set(matching));
  if(distinct.length!==1){blockers.push("UNRESOLVED_MAPPING:"+key(b));continue;}
  const p=distinct[0];
  if(p.arrival!==b.arrival||p.departure!==b.departure) blockers.push("DATE_MISMATCH:"+key(b));
  if(p.status!==b.status) blockers.push("STATUS_MISMATCH:"+key(b));
 }
 // The system is fail closed when an unknown PMS booking is not accounted for.
 for(const p of pms){
  const matching=ota.filter(b=>(b.beds24Id??b.externalId)===(p.beds24Id??p.externalId));
  if(matching.length===0) blockers.push("UNACCOUNTED_PMS_BOOKING:"+key(p));
 }
 return {safe:blockers.length===0,blockers:Array.from(new Set(blockers))};
}
