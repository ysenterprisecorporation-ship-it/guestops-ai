import assert from "node:assert/strict";
import test from "node:test";
import {applyCleaningTransition,CleaningCalendar,CleaningCalendarEvent} from "../src/pms/CleaningCalendarWriter";
import {transitionBooking} from "../src/pms/BookingState";
const notice={bookingId:"5853533688",sourceMessageId:"m1",
 receivedAt:"2026-10-28T10:00:00Z",status:"CONFIRMED" as const,
 departure:"2026-10-30",propertyVerified:true};
function memory() {
 const events:CleaningCalendarEvent[]=[];
 const api:CleaningCalendar={
  findByBookingId:id=>events.filter(e=>e.bookingId===id),
  create:e=>{events.push({...e,eventId:"evt-"+events.length});return events[events.length - 1].eventId;},
  update:(id,e)=>{const i=events.findIndex(x=>x.eventId===id);events[i]={...e,eventId:id};},
 };
 return {api,events};
}
const flags={enableWrites:true,calendarVerified:true,propertyVerified:true};
test("requires explicit calendar and property authorization",()=>{
 const {api,events}=memory(), transition=transitionBooking(undefined,notice);
 assert.equal(applyCleaningTransition(api,transition,{...flags,enableWrites:false}).action,"BLOCKED");
 assert.equal(events.length,0);
});
test("creates then idempotently replays safely",()=>{
 const {api,events}=memory(), t=transitionBooking(undefined,notice);
 assert.equal(applyCleaningTransition(api,t,flags).action,"CREATED");
 assert.equal(applyCleaningTransition(api,t,flags).action,"UNCHANGED");
 assert.equal(events.length,1);
});
test("updates existing event instead of making duplicate",()=>{
 const {api,events}=memory(), before=transitionBooking(undefined,notice);
 applyCleaningTransition(api,before,flags);
 const after=transitionBooking(before.next,{...notice,sourceMessageId:"m2",
 receivedAt:"2026-10-28T11:00:00Z",departure:"2026-10-31"});
 assert.equal(applyCleaningTransition(api,after,flags).action,"UPDATED");
 assert.equal(events.length,1);assert.equal(events[0].date,"2026-10-31");
});
test("cancellation never silently deletes a calendar event",()=>{
 const {api,events}=memory();
 const cancelled=transitionBooking(undefined,{...notice,status:"CANCELLED"});
 assert.equal(applyCleaningTransition(api,cancelled,flags).action,"BLOCKED");
 assert.equal(events.length,0);
});
