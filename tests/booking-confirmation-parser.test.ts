import assert from "node:assert/strict";
import test from "node:test";
import {parseBookingConfirmation,collectBookingConfirmationSignals} from "../src/pms/BookingConfirmationParser";
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
