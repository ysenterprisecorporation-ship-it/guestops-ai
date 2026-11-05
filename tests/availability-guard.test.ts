import assert from "node:assert/strict";
import test from "node:test";
import { assessAvailability, AvailabilitySignal } from "../src/pms/AvailabilityGuard";
const range={start:"2026-11-01",end:"2026-11-04",allPrimaryChannelsVerified:true,allImportFeedsVerified:true};
const booked:AvailabilitySignal={source:"airbnb",status:"confirmed",start:"2026-11-02",end:"2026-11-05",verified:true};
test("overlapping booking blocks sale",()=>assert.equal(assessAvailability({...range,signals:[booked]}).safeToSell,false));
test("empty calendar is insufficient when primary OTA verification absent",()=>{
 const result=assessAvailability({...range,signals:[],allPrimaryChannelsVerified:false});
 assert.equal(result.safeToSell,false);assert.ok(result.reasons.includes("CHANNEL_SYNC_UNVERIFIED"));
});
test("disconnected import cannot be assumed available",()=>{
 assert.equal(assessAvailability({...range,signals:[],allImportFeedsVerified:false}).safeToSell,false);
});
test("adjacent checkout and checkin is not overlap",()=>{
 const earlier={...booked,start:"2026-10-30",end:"2026-11-01"};
 assert.equal(assessAvailability({...range,signals:[earlier]}).safeToSell,true);
});
test("uncertain or invalid events block sale",()=>{
 assert.equal(assessAvailability({...range,signals:[{...booked,verified:false,status:"unknown"}]}).safeToSell,false);
});
