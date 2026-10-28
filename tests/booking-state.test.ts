import assert from "node:assert/strict";
import test from "node:test";
import {transitionBooking,BookingNotice} from "../src/pms/BookingState";
const base:BookingNotice={bookingId:"5853533688",sourceMessageId:"m1",
  receivedAt:"2026-10-27T11:00:00Z",status:"CONFIRMED",
  departure:"2026-10-29",propertyVerified:true};
test("create once and suppress duplicate",()=>{
 const first=transitionBooking(undefined,base);
 assert.equal(first.action,"CREATE_CLEANING_DRAFT");
 assert.equal(transitionBooking(first.next,base).action,"NO_CHANGE");
});
test("changed checkout updates same cleaning draft",()=>{
 const first=transitionBooking(undefined,base);
 const changed=transitionBooking(first.next,{...base,sourceMessageId:"m2",
  receivedAt:"2026-10-27T13:00:00Z",departure:"2026-10-30"});
 assert.equal(changed.action,"UPDATE_CLEANING_DRAFT");
});
test("older notification cannot restore cancelled reservation",()=>{
 const cancelled=transitionBooking(undefined,{...base,status:"CANCELLED",
   receivedAt:"2026-10-28T11:00:00Z",sourceMessageId:"m3"});
 assert.equal(transitionBooking(cancelled.next,base).reason,"STALE_NOTIFICATION");
});
test("unverified property cannot schedule cleaning",()=>{
 assert.equal(transitionBooking(undefined,{...base,propertyVerified:false}).action,"MANUAL_REVIEW");
});
test("cancellation does not delete schedule automatically",()=>{
 assert.equal(transitionBooking(undefined,{...base,status:"CANCELLED"}).action,"CANCEL_CLEANING_REVIEW");
});
