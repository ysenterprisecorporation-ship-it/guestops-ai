import assert from "node:assert/strict";
import test from "node:test";
import {parseReservationEmail} from "../src/pms/ReservationEmailParser";
import {planCleaning} from "../src/pms/CleaningPlan";

test("real Booking new reservation uses subject ID and requires missing details lookup",()=>{
 const v=parseReservationEmail({id:"mail1",from:"Booking.com <noreply@booking.com>",
 subject:"Booking.com - 新しい予約がありました！ (5853533688, 2026年10月28日水曜日)",
 body:"Disney Airport 3BR Designer House Max 9\nBooking confirmation\n—\n5853533688\nIATA/TIDS: PC029090"});
 assert.equal(v.eventType,"BOOKING_NEW");
 assert.equal(v.reservationCode,"5853533688");
 assert.equal(v.status,"NEW");
 assert.ok(v.evidence.includes("DATES_REQUIRE_BOOKING_LOOKUP"));
});
test("real Booking cancellation not mistaken for guest notification",()=>{
 const v=parseReservationEmail({id:"mail2",from:"noreply@booking.com",
 subject:"Booking.com - 予約のキャンセルがありました (6168274106, 2026年11月13日金曜日)",
 body:"Cancellation\n—\n6168274106"});
 assert.equal(v.status,"CANCELLED");
 assert.equal(v.eventType,"BOOKING_CANCELLED");
});
test("real Booking guest messages are not treated as new reservations",()=>{
 const v=parseReservationEmail({id:"mail3",from:"noreply@booking.com",
 subject:"ご宿泊者様からメッセージが届きました",
 body:"予約番号： [5853533688](https://admin.booking.com/?res_id=5853533688)\nチェックイン\n2026年10月28日水曜日\nチェックアウト\n2026年10月29日木曜日"});
 assert.equal(v.eventType,"GUEST_MESSAGE");
 assert.equal(v.reservationCode,"5853533688");
 assert.equal(v.arrival,"2026-10-28");
 assert.equal(v.departure,"2026-10-29");
 assert.equal(v.status,"MESSAGE");
});
test("untrusted sender does not yield booking NEW status",()=>{
 const v=parseReservationEmail({id:"mail4",from:"fake@example.com",
 subject:"Booking.com - 新しい予約がありました！ (5853533688, 2026年10月28日水曜日)",body:""});
 assert.equal(v.status,"UNVERIFIED");
});
test("cleaning only proposed for verified active booking",()=>{
 const ok=planCleaning({bookingId:"123",departure:"2026-12-04",propertyVerified:true,status:"confirmed"});
 assert.equal(ok.action,"PROPOSE_UPSERT");
 assert.equal(planCleaning({bookingId:"123",departure:"2026-12-04",propertyVerified:true,status:"cancelled"}).action,"REVIEW");
});
