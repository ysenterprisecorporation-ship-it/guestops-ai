import assert from 'node:assert/strict';
import {readBookings,summarizeBookings,decideWebhook,BASE} from '../integrations/beds24-readonly/index.mjs';

const token='A'.repeat(160);let calls=[];
const result=await readBookings({token,bookingId:123,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});return {ok:true,status:200,json:async()=>({data:[{id:123,propertyId:56,status:'confirmed',arrival:'2026-11-06',guestName:'SENSITIVE'}]})};
}});
assert.equal(calls.length,1);assert.equal(calls[0].opts.method,'GET');assert.equal(calls[0].url,BASE+'/bookings?id=123');
assert.equal(calls[0].opts.headers.token,token);
const safe=summarizeBookings(result);
assert.equal(safe.length,1);assert.equal(safe[0].id,'123');
assert.equal(JSON.stringify(safe).includes('SENSITIVE'),false);
await assert.rejects(()=>readBookings({token:'bad',fetchImpl:async()=>({ok:true})}),/invalid/);
await assert.rejects(()=>readBookings({token,base:'https://evil.example',fetchImpl:async()=>({ok:true})}),/Noncanonical/);
await assert.rejects(()=>readBookings({token,bookingId:'123;DROP',fetchImpl:async()=>({ok:true})}),/numeric/);
const seen=new Set();
const booking={id:123,propertyId:56,status:'confirmed',arrival:'2026-11-06'};
assert.equal(decideWebhook({booking,seen}).kind,'booking-review');
assert.equal(decideWebhook({booking,seen}).kind,'duplicate');
assert.equal(decideWebhook({booking:{...booking,status:'cancelled'},seen}).kind,'cancelled-review');
assert.equal(decideWebhook({booking:{...booking,id:124},seen,cleaningState:{'56|2026-11-06':'conflict'}}).kind,'cleaning-conflict');
for(const variant of [booking,{...booking,status:'cancelled'}, {...booking,id:124}]){
  const decision=decideWebhook({booking:variant,seen:new Set()});
  assert.equal(decision.externalWrites,0);
}
console.log('PASS: Beds24 read-only GET, canonical host, invalid token/ID rejection, PII redaction, webhook idempotency and cleaning conflict/cancellation');
