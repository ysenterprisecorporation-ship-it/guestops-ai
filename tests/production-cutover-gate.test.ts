import assert from "node:assert/strict";
import test from "node:test";
import {evaluateBeds24ProductionCutover,CutoverEvidence} from "../src/pms/ProductionCutoverGate";
const complete:CutoverEvidence={
 bookingChannelMapped:true,airbnbStayMapped:true,airbnbMonthlyMapped:true,
 existingBookingReconciled:true,blockedDaysReconciled:true,seasonalMonthlyDatesProtected:true,
 legacyGASOutboundDisconnected:true,oldIcalImportsDisconnected:true,authorizedByOwner:true
};
test("production cutover requires all nine independent conditions",()=>{
 assert.equal(evaluateBeds24ProductionCutover(complete).ready,true);
 for(const key of Object.keys(complete) as (keyof CutoverEvidence)[]){
  const result=evaluateBeds24ProductionCutover({...complete,[key]:false});
  assert.equal(result.ready,false,key);
  assert.equal(result.blockers.length,1,key);
 }
});
test("empty evidence cannot be considered successful",()=>{
 const empty=Object.fromEntries(Object.keys(complete).map(key=>[key,false])) as unknown as CutoverEvidence;
 assert.equal(evaluateBeds24ProductionCutover(empty).blockers.length,9);
});
