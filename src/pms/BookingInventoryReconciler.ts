/**
 * Pure read-only evidence reconciliation for production cutover.
 * A calendar "Not available" entry never proves a paid booking.
 * Intervals are local ISO dates [start,end), so checkout day is not blocked.
 */
export type Interval = { start: string; end: string; kind: "reservation"|"blocked"|"unknown"; source: string };
export type Reconciliation = { matched: boolean; differences: string[] };
const dateRE=/^\d{4}-\d{2}-\d{2}$/;
export function reconcileIntervals(ota: Interval[], beds24: Interval[]): Reconciliation {
 const valid=(x:Interval)=>dateRE.test(x.start)&&dateRE.test(x.end)&&!Number.isNaN(Date.parse(x.start))&&!Number.isNaN(Date.parse(x.end))&&x.start<x.end;
 const differences:string[]=[];
 for(const [label,values] of [["OTA",ota],["BEDS24",beds24]] as const) {
  if(values.some(x=>!valid(x))) differences.push(label+"_INVALID_INTERVAL");
  if(values.some(x=>x.kind==="unknown")) differences.push(label+"_UNKNOWN_EVENT_KIND");
 }
 if(differences.length) return {matched:false,differences};
 const normalized=(arr:Interval[])=>arr.map(x=>x.kind+":"+x.start+"/"+x.end).sort();
 const left=normalized(ota),right=normalized(beds24);
 for(const item of left) if(!right.includes(item)) differences.push("MISSING_BEDS24:"+item);
 for(const item of right) if(!left.includes(item)) differences.push("MISSING_OTA:"+item);
 return {matched:differences.length===0,differences};
}
export function seasonProtected(blocks: Interval[], from="2027-01-01",to="2027-04-01"):boolean {
 // Every day must be covered by a confirmed block or reservation.
 const days=new Set<string>();
 for(const b of blocks) {
  if(b.kind==="unknown"||!dateRE.test(b.start)||!dateRE.test(b.end)||b.start>=b.end) continue;
  let t=Date.parse(b.start+"T00:00:00Z");
  const end=Date.parse(b.end+"T00:00:00Z");
  if(!Number.isFinite(t)||!Number.isFinite(end)) continue;
  for(;t<end&&days.size<1000;t+=86400000) days.add(new Date(t).toISOString().slice(0,10));
 }
 for(let t=Date.parse(from+"T00:00:00Z"),end=Date.parse(to+"T00:00:00Z");t<end;t+=86400000) {
  if(!days.has(new Date(t).toISOString().slice(0,10))) return false;
 }
 return true;
}
