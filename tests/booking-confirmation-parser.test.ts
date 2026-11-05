import assert from "node:assert/strict";
import test from "node:test";
import {parseBookingConfirmation,collectBookingConfirmationSignals,parseBookingCancellation,latestBookingNoticeStates} from "../src/pms/BookingConfirmationParser";
const subject="Booking.com - 新しい予約がありました！ (1234567890, 2026年11月2日月曜日)";
const body="Disney Airport Designer House\\nBooking confirmation\\n—\\n1234567890\\n";
test("extract only confirmed new booking signal from matching subject and message body",()=>{
 assert.deepEqual(parseBookingConfirmation(subject,body),{identifier:"1234567890",source:"booking-com",state:"new"});
});
test("reject mail whose body disagrees with booking ID",()=>{
 assert.equal(parseBookingConfirmation(subject,body.replace("1234567890","9876543210")),null);
});
test("avoid false positives and duplicate notification counts",()=>{
 assert.equal(parseBookingConfirmation("Newsletter Booking.com",body),null);
 assert.equal(collectBookingConfirmationSignals([{subject,body},{subject,body}]).length,1);
});

test("cancellation notice supersedes earlier confirmation as notification evidence only",()=>{
 const cancel=parseBookingCancellation("Booking.com - 予約のキャンセルがありました (1234567890, 2026年11月30日月曜日)","Cancellation\n1234567890");
 assert.deepEqual(cancel,{identifier:"1234567890",source:"booking-com",state:"cancel"});
 const timeline=latestBookingNoticeStates([
  {notice:cancel!,timestamp:"2026-10-13T23:06:24+02:00"},
  {notice:{identifier:"1234567890",source:"booking-com",state:"new"},timestamp:"2026-10-09T09:58:48+02:00"},
 ]);
 assert.deepEqual(timeline,[{identifier:"1234567890",lastNotification:"cancel",liveOTAStatusVerified:false}]);
});
test("cancellation body must match its booking reference",()=>{
 assert.equal(parseBookingCancellation("Booking.com - 予約のキャンセルがありました (1234567890, 2026年11月30日月曜日)","Cancellation\n9876543210"),null);
});
