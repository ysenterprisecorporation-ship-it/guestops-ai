import assert from "node:assert/strict";import test from "node:test";
import {bookedNightProtection} from "../src/pms/VerifiedBookingNightProtection";
test("same-day turnover does not mark checkout day as occupied by departing stay",()=>{
 const nights=bookedNightProtection([
 {externalId:"5152984780",arrival:"2026-11-01",departure:"2026-11-02",status:"confirmed"},
 {externalId:"6100278367",arrival:"2026-11-02",departure:"2026-11-03",status:"confirmed"}]);
 assert.deepEqual(nights.map(x=>x.date),["2026-11-01","2026-11-02"]);
 assert.ok(nights.every(x=>!x.overlap));
});
test("cancelled stays do not consume occupancy",()=>{
 assert.deepEqual(bookedNightProtection([{externalId:"5418044750",arrival:"2026-11-03",departure:"2026-11-04",status:"cancelled"}]),[]);
});
test("overlapping valid reservations are flagged for manual reconciliation",()=>{
 const rows=bookedNightProtection([
 {externalId:"5152984780",arrival:"2026-11-01",departure:"2026-11-03",status:"confirmed"},
 {externalId:"6100278367",arrival:"2026-11-02",departure:"2026-11-04",status:"confirmed"}]);
 assert.equal(rows.find(x=>x.date==="2026-11-02")?.overlap,true);
});
test("invalid and impossible date intervals are rejected",()=>assert.throws(()=>bookedNightProtection([{externalId:"5152984780",arrival:"2026-02-30",departure:"2026-03-02",status:"confirmed"}])));
