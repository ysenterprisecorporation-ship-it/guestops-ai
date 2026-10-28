import assert from "node:assert/strict";
import test from "node:test";
import {parseReservationEmail} from "../src/pms/ReservationEmailParser";
import {planCleaning} from "../src/pms/CleaningPlan";
const base={id:"mail-1",from:"notifications@booking.com",
 subject:"ご予約 1234567890",body:"チェックイン：2026-12-01\nチェックアウト：2026-12-04\n宿泊人数：8"};
test("parses known structured booking notifications into proposals",()=>{
 const r=parseReservationEmail(base);
 assert.equal(r.reservationCode,"1234567890");
 assert.equal(r.status,"NEW");
 assert.equal(r.guestCount,8);
 assert.equal(r.arrival,"2026-12-01");
});
test("ambiguous reservation number is not silently picked",()=>{
 const r=parseReservationEmail({...base,body:base.body+"\n別番号 9876543210"});
 assert.equal(r.reservationCode,undefined);
 assert.equal(r.status,"UNVERIFIED");
});
test("untrusted sender and cancellation require verification",()=>{
 const r=parseReservationEmail({...base,from:"attacker@example.com",
 subject:"キャンセル 1234567890"});
 assert.equal(r.provider,"unknown");assert.equal(r.status,"CANCELLED");
 assert.ok(r.evidence.includes("UNVERIFIED_SENDER_DOMAIN"));
});
test("cleaning only proposed for verified active booking",()=>{
 const ok=planCleaning({bookingId:"123",departure:"2026-12-04",propertyVerified:true,status:"confirmed"});
 assert.equal(ok.action,"PROPOSE_UPSERT");
 assert.equal(planCleaning({bookingId:"123",departure:"2026-12-04",propertyVerified:true,status:"cancelled"}).action,"REVIEW");
});
