import assert from "node:assert/strict";
import test from "node:test";
import {inspectReservationMailbox,MailReader} from "../src/pms/GtosMailReader";

test("read-only mail parser creates bounded proposals",()=>{
  let queried=false;
  const reader:MailReader={search:(_query,limit)=>{
    queried=true;assert.equal(limit,20);
    return [{id:"id1",from:"bookings@booking.com",subject:"予約 1234567890",
    body:"チェックイン：2026-12-01\nチェックアウト：2026-12-02\n宿泊人数：6"}];
  }};
  const report=inspectReservationMailbox(reader);
  assert.equal(queried,true);
  assert.equal(report.total,1);
  assert.equal(report.proposals[0].reservationCode,"1234567890");
});
test("rejects unbounded reads",()=>{
 assert.throws(()=>inspectReservationMailbox({search:()=>[]}, "all", 500), /LIMIT_INVALID/);
});
