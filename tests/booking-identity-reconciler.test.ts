import assert from "node:assert/strict";
import test from "node:test";
import {compareBookingSnapshots,BookingSnapshot} from "../src/pms/BookingIdentityReconciler";
const ota:BookingSnapshot={provider:"airbnb-stay",externalId:"AB-42",beds24Id:"B24-9",propertyId:"364051",arrival:"2026-11-02",departure:"2026-11-05",status:"confirmed"};
const pms:BookingSnapshot={...ota,provider:"beds24",externalId:"B24-9",beds24Id:"B24-9"};
test("mapped reservations with matching dates and lifecycle pass",()=>assert.equal(compareBookingSnapshots([ota],[pms],"364051").safe,true));
test("same dates but cancelled status fails",()=>assert.equal(compareBookingSnapshots([{...ota,status:"cancelled"}],[pms],"364051").safe,false));
test("unresolved identity and wrong property fail closed",()=>{
 assert.equal(compareBookingSnapshots([{...ota,beds24Id:undefined}],[pms],"364051").safe,false);
 assert.equal(compareBookingSnapshots([{...ota,propertyId:"other"}],[pms],"364051").safe,false);
});
test("duplicate external booking IDs fail even if dates agree",()=>assert.equal(compareBookingSnapshots([ota,ota],[pms],"364051").safe,false));
test("unaccounted PMS bookings prohibit cutover",()=>assert.equal(compareBookingSnapshots([], [pms],"364051").safe,false));
