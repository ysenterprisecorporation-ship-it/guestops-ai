import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {bookedNightProtection,VerifiedStay} from "../src/pms/VerifiedBookingNightProtection";
import {evaluateProductionCutover} from "../src/pms/ProductionCutoverPreflight";
const fixture=JSON.parse(readFileSync(new URL("./fixtures/kasai-booking-screen-2026-11-01.json",import.meta.url),"utf8")) as {snapshotType:string;stays:VerifiedStay[]};
test("Kasai screen-evidence fixture protects 21 unique nights without collisions",()=>{
 assert.equal(fixture.snapshotType,"historical-screen-evidence-not-live-ota");
 assert.equal(fixture.stays.length,10);
 const days=bookedNightProtection(fixture.stays);
 assert.equal(days.length,21);
 assert.equal(days.filter(x=>x.overlap).length,0);
 assert.ok(days.some(x=>x.date==="2027-01-04"));
});
test("Beds24 empty reservation result cannot reconcile screen-verified occupied nights",()=>{
 const beds24Occupied=new Set<string>();
 const missing=bookedNightProtection(fixture.stays).filter(x=>!beds24Occupied.has(x.date));
 assert.equal(missing.length,21);
});

test("actual historical 21 occupied nights cannot be treated as reconciled against empty Beds24",()=>{
 const result=evaluateProductionCutover({
  expectedPropertyId:"364051",
  evidence:{
   bookingChannelMapped:true,airbnbStayMapped:true,airbnbMonthlyMapped:true,
   existingBookingReconciled:true,blockedDaysReconciled:true,seasonalMonthlyDatesProtected:true,
   legacyGASOutboundDisconnected:true,oldIcalImportsDisconnected:true,authorizedByOwner:true
  },
  otaBookings:[],beds24Bookings:[],otaInventory:[],beds24Inventory:[],
  beds24SeasonalBlocks:[{start:"2027-01-01",end:"2027-04-01",kind:"blocked",source:"verified"}],
  snapshotsComplete:true,
  otaSourcesVerified:{bookingCom:true,airbnbStay:true,airbnbMonthly:true,beds24:true},
  sourceEvidenceTimestamp:"2026-11-01T08:00:00+09:00",evaluatedAt:"2026-11-01T08:10:00+09:00",
  notificationHistoryVerified:true,reservationNotices:[],notificationEvidenceRows:[],
  verifiedBookingComStays:fixture.stays,beds24OccupiedNights:[]
 });
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("BOOKING_COM_OCCUPIED_NIGHTS_MISSING_IN_BEDS24"));
});
