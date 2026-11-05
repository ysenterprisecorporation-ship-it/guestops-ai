import assert from "node:assert/strict";
import test from "node:test";
import { auditProtectedBookingNights } from "../src/pms/ProtectedNightReadAudit";
test("empty Beds24 snapshot does not clear known OTA occupied nights",()=>{
 const ota=[{externalId:"1234567890",arrival:"2026-11-01",departure:"2026-11-03",status:"confirmed" as const}];
 const result=auditProtectedBookingNights(ota,[]);
 assert.equal(result.occupiedNightCount,2);
 assert.deepEqual(result.missingInBeds24,["2026-11-01","2026-11-02"]);
 assert.equal(result.readyForCutover,false);
});
test("fully present days do not imply complete OTA or inventory reconciliation",()=>{
 const stay={externalId:"1234567890",arrival:"2026-11-01",departure:"2026-11-02",status:"confirmed" as const};
 const result=auditProtectedBookingNights([stay],[stay]);
 assert.deepEqual(result.missingInBeds24,[]);
 assert.equal(result.readyForCutover,false);
});
