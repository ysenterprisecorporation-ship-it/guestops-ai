import assert from "node:assert/strict";
import test from "node:test";
import {evaluateProductionCutover,ProductionCutoverInput} from "../src/pms/ProductionCutoverPreflight";
import {CutoverEvidence} from "../src/pms/ProductionCutoverGate";
const evidence:CutoverEvidence={
 bookingChannelMapped:true,airbnbStayMapped:true,airbnbMonthlyMapped:true,
 existingBookingReconciled:true,blockedDaysReconciled:true,seasonalMonthlyDatesProtected:true,
 legacyGASOutboundDisconnected:true,oldIcalImportsDisconnected:true,authorizedByOwner:true
};
const input:ProductionCutoverInput={evidence,expectedPropertyId:"364051",otaBookings:[],beds24Bookings:[],
 otaInventory:[],beds24Inventory:[],beds24SeasonalBlocks:[{start:"2027-01-01",end:"2027-04-01",kind:"blocked",source:"verified"}],
 snapshotsComplete:true,otaSourcesVerified:{bookingCom:true,airbnbStay:true,airbnbMonthly:true,beds24:true},sourceEvidenceTimestamp:"2026-10-29T19:00:00+09:00"};
test("preflight blocks incomplete real-source snapshots despite approval",()=>{
 const result=evaluateProductionCutover({...input,snapshotsComplete:false});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("SOURCE_SNAPSHOTS_INCOMPLETE"));
});
test("preflight rejects invented manual reconciliation success",()=>{
 const result=evaluateProductionCutover({...input,otaInventory:[{start:"2026-11-01",end:"2026-11-02",kind:"blocked",source:"airbnb"}]});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("BLOCKED_DATES_NOT_RECONCILED"));
});
test("preflight blocks unprotected January monthly days",()=>{
 const result=evaluateProductionCutover({...input,beds24SeasonalBlocks:[{start:"2027-02-01",end:"2027-10-14",kind:"blocked",source:"import"}]});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("MONTHLY_2027_NOT_PROTECTED"));
});
test("preflight blocks unresolved booking mappings",()=>{
 const result=evaluateProductionCutover({...input,otaBookings:[{provider:"airbnb-stay",externalId:"OTA1",propertyId:"364051",arrival:"2026-11-01",departure:"2026-11-03",status:"confirmed"}]});
 assert.equal(result.ready,false);
 assert.ok(result.bookingDifferences.some(x=>x.includes("UNRESOLVED_MAPPING")));
});
test("fully reconciled verified evidence can pass",()=>{
 assert.equal(evaluateProductionCutover(input).ready,true);
});

test("empty source arrays must be backed by individual verified exports",()=>{
 assert.equal(evaluateProductionCutover({...input,otaSourcesVerified:undefined}).ready,false);
 assert.equal(evaluateProductionCutover({...input,otaSourcesVerified:{bookingCom:true,airbnbStay:false,airbnbMonthly:true,beds24:true}}).ready,false);
 assert.equal(evaluateProductionCutover({...input,sourceEvidenceTimestamp:undefined}).ready,false);
});

test("Booking.com reservation notification blocks cutover until its live OTA ID is verified",()=>{
 const notice={identifier:"1234567890",source:"booking-com" as const,state:"new" as const};
 const missing=evaluateProductionCutover({...input,reservationNotices:[notice]});
 assert.equal(missing.ready,false);
 assert.ok(missing.blockers.includes("BOOKING_COM_NOTICES_UNVERIFIED_IN_LIVE_OTA"));
 const verified=evaluateProductionCutover({...input,reservationNotices:[notice],liveBookingComReservationIds:["1234567890"]});
 assert.equal(verified.ready,true);
});
test("one unverified notification among several must block cutover",()=>{
 const notices=[{identifier:"1234567890",source:"booking-com" as const,state:"new" as const},
 {identifier:"1234567891",source:"booking-com" as const,state:"modify" as const}];
 const result=evaluateProductionCutover({...input,reservationNotices:notices,liveBookingComReservationIds:["1234567890"]});
 assert.equal(result.ready,false);
});
