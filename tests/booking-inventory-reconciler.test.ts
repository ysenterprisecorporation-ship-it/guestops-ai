import assert from "node:assert/strict";
import test from "node:test";
import {reconcileIntervals,seasonProtected} from "../src/pms/BookingInventoryReconciler";
const booked={start:"2026-11-01",end:"2026-11-03",kind:"reservation" as const,source:"airbnb"};
test("read-only reconciliation ignores feed labels but preserves checkout boundaries",()=>{
 assert.equal(reconcileIntervals([booked],[{...booked,source:"beds24"}]).matched,true);
 assert.equal(reconcileIntervals([booked],[{...booked,end:"2026-11-02"}]).matched,false);
});
test("unknown availability block is not assumed to be a reservation",()=>{
 const block={...booked,kind:"unknown" as const};
 assert.equal(reconcileIntervals([block],[booked]).matched,false);
});
test("monthly protection requires every day, not just distant future calendar blocks",()=>{
 assert.equal(seasonProtected([{start:"2027-02-01",end:"2027-10-14",kind:"blocked",source:"airbnb"}]),false);
 assert.equal(seasonProtected([{start:"2027-01-01",end:"2027-04-01",kind:"blocked",source:"verified"}]),true);
});

test("duplicate intervals cannot conceal mismatched booking count",()=>{
 assert.equal(reconcileIntervals([booked,booked],[booked]).matched,false);
 assert.equal(reconcileIntervals([booked],[booked,booked]).matched,false);
});
test("impossible dates are invalid and do not count toward monthly protection",()=>{
 const invalid={start:"2027-02-30",end:"2027-03-02",kind:"blocked" as const,source:"feed"};
 assert.equal(reconcileIntervals([invalid],[invalid]).matched,false);
 assert.equal(seasonProtected([invalid]),false);
});
