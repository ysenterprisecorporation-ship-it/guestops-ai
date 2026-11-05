import assert from "node:assert/strict";
import test from "node:test";
import { auditKasaiMailbox, disallowCalendarAsInventorySource } from "../src/pms/KasaiInventoryAudit";
test("mail audit ignores OTA messages and does not claim inventory is synchronized", () => {
 const report = auditKasaiMailbox({getRecentMessages:() => [
 {id:"n1",from:"notification@booking.com",subject:"Booking.com - 新しい予約がありました！ (5853533688, 2026年10月28日水曜日)",body:"Booking confirmation"},
 {id:"n2",from:"notification@booking.com",subject:"ゲストからメッセージが届きました",body:"予約番号： 5853533688"},
 {id:"n3",from:"notification@booking.com",subject:"Booking.com - 予約のキャンセルがありました (6168274106, 2026年11月13日金曜日)",body:"Cancellation"},
 ]},"edogawa.stay.info@gmail.com");
 assert.equal(report.recognizedBookings,1);
 assert.equal(report.recognizedCancellations,1);
 assert.equal(report.excludedMessages,1);
 assert.equal(report.status,"BLOCKED");
});
test("calendar emptiness never proves available inventory",()=>{
 const r=disallowCalendarAsInventorySource("2026-11-01","2026-11-03",[]);
 assert.equal(r.safeToSell,false);
});
test("wrong mailbox identity is rejected",()=>{
 assert.throws(()=>auditKasaiMailbox({getRecentMessages:()=>[]},"other@example.com"),/KASAI_ACCOUNT_REQUIRED/);
});
