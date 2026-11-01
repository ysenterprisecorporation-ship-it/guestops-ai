import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {bookedNightProtection,VerifiedStay} from "../src/pms/VerifiedBookingNightProtection";
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
