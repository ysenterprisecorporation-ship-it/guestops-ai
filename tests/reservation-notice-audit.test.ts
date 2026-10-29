import assert from "node:assert/strict";import test from "node:test";import {reviewReservationNotices} from "../src/pms/ReservationNoticeAudit";
test("OTA notification must be verified against live provider",()=>{
 const result=reviewReservationNotices([{identifier:"1234567890",source:"booking-com",state:"new"}]);
 assert.equal(result.cutoverBlocked,true);
 assert.deepEqual(result.requiresProviderVerification,["1234567890"]);
});
test("duplicate notification is not another reservation",()=>{
 assert.equal(reviewReservationNotices([{identifier:"1234567890",source:"booking-com",state:"new"},{identifier:"1234567890",source:"booking-com",state:"modify"}]).requiresProviderVerification.length,1);
});
test("malformed reservation reference is rejected",()=>assert.throws(()=>reviewReservationNotices([{identifier:"invalid",source:"booking-com",state:"new"}])));
