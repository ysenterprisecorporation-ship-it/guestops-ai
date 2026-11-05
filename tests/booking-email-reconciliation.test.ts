import assert from "node:assert/strict";
import test from "node:test";
import {reconcileBookingNotifications} from "../src/pms/BookingEmailReconciliation";
const create={id:"a",from:"noreply@booking.com",subject:"Booking.com - 新しい予約がありました！ (5853533688, 2026年10月28日水曜日)",body:"",receivedAt:"2026-10-20T00:00:00Z"};
const cancel={...create,id:"b",subject:"Booking.com - 予約のキャンセルがありました (5853533688, 2026年10月28日水曜日)",receivedAt:"2026-10-21T00:00:00Z"};
const msg={...create,id:"c",subject:"ゲストからメッセージが届きました",receivedAt:"2026-10-22T00:00:00Z"};
test("cancel supersedes new booking; guest message is not a rebooking",()=>{
 const r=reconcileBookingNotifications([msg,cancel,create]);
 assert.equal(r.bookings.length,1);
 assert.equal(r.bookings[0].lastEvent,"BOOKING_CANCELLED");
 assert.equal(r.messageOnlyCount,1);
 assert.equal(r.bookings[0].requiresPmsVerification,true);
});
test("malformed unknown messages never create bookings",()=>{
 const r=reconcileBookingNotifications([{...create,id:"bad",from:"attacker@example.com"}]);
 assert.equal(r.bookings.length,0);
 assert.equal(r.invalidCount,1);
});
test("same timestamp opposite events require review",()=>{
 const r=reconcileBookingNotifications([create,{...cancel,receivedAt:create.receivedAt}]);
 assert.ok(r.issues.some(s=>s.startsWith("SAME_TIME_CONFLICT")));
});
