import assert from "node:assert/strict";import test from "node:test";
import {buildBookingEvidenceLedger,summarizeBookingEvidence,exportBookingEvidenceCsv} from "../src/pms/BookingEvidenceLedger";
test("new then cancellation yields cancelled notice, not confirmed live status",()=>{
 const records=buildBookingEvidenceLedger([
 {id:"1234567890",arrival:"2026-11-30",receivedAt:"2026-10-09T09:00:00Z",kind:"new"},
 {id:"1234567890",arrival:"2026-11-30",receivedAt:"2026-10-13T09:00:00Z",kind:"cancel"}]);
 assert.equal(records.length,1);
 assert.equal(records[0].lastNotification,"cancel");
 assert.equal(records[0].liveStatus,"unverified");
 assert.deepEqual(summarizeBookingEvidence(records,"2026-10-30"),{notificationOnly:true,total:1,lastNew:0,lastCancelled:1,allLiveStatusesUnverified:true,arrivalConflicts:0});
 assert.match(exportBookingEvidenceCsv(records),/reservation_id,arrival/);
});
test("reject invalid reservation IDs and impossible calendar dates",()=>{
 assert.throws(()=>buildBookingEvidenceLedger([{id:"ABC",arrival:"2026-11-01",receivedAt:"2026-10-10T00:00:00Z",kind:"new"}]));
 assert.throws(()=>buildBookingEvidenceLedger([{id:"1234567890",arrival:"2027-02-30",receivedAt:"2026-10-10T00:00:00Z",kind:"new"}]));
});

test("record conflicting dates for the same booking rather than silently discarding the older date",()=>{
 const rows=buildBookingEvidenceLedger([
  {id:"1234567890",arrival:"2026-11-13",receivedAt:"2026-10-01T00:00:00Z",kind:"new"},
  {id:"1234567890",arrival:"2026-11-29",receivedAt:"2026-10-02T00:00:00Z",kind:"cancel"}
 ]);
 assert.equal(rows[0].arrivalConflict,true);
 assert.equal(rows[0].arrival,"2026-11-29");
 assert.equal(summarizeBookingEvidence(rows,"2026-10-30").arrivalConflicts,1);
 assert.match(exportBookingEvidenceCsv(rows),/arrival_conflict/);
});
