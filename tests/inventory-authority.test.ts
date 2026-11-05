import assert from "node:assert/strict";
import test from "node:test";
import { assessInventoryAuthority } from "../src/pms/InventoryAuthority";
const base={booking:"VERIFIED_API" as const,airbnb:"VERIFIED_API" as const,
 monthly:"EXPLICITLY_BLOCKED" as const,oldCalendarBridge:"DISABLED" as const};
test("never authorizes OTA inventory writes",()=>{
 const result=assessInventoryAuthority(base);
 assert.equal(result.allowInventoryWrite,false);
 assert.equal(result.allowNewDirectBooking,true);
});
test("old calendar GAS bridge enabled or unknown prevents direct booking",()=>{
 for(const oldCalendarBridge of ["ENABLED","UNKNOWN"] as const){
  assert.equal(assessInventoryAuthority({...base,oldCalendarBridge}).allowNewDirectBooking,false);
 }
});
test("unverified Airbnb and monthly contract block direct booking",()=>{
 assert.equal(assessInventoryAuthority({...base,airbnb:"UNVERIFIED"}).allowNewDirectBooking,false);
 assert.equal(assessInventoryAuthority({...base,monthly:"ACTIVE_CONTRACT"}).allowNewDirectBooking,false);
});
