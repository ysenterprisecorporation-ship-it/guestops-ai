// GuestOps AI Beds24 API V2 read-only adapter.
// Never send booking details, names, or credentials to a static site.
// This module performs GET only and is not activated automatically.
export const BASE='https://beds24.com/api/v2';
export function validateToken(token){
  if(typeof token!=='string'||token.length<100||/[\r\n]/.test(token))
    throw new Error('Missing or invalid Beds24 API V2 token');
  return token;
}
export async function readBookings({token, fetchImpl=globalThis.fetch, bookingId, base=BASE}){
  validateToken(token);
  if(base!==BASE)throw new Error('Noncanonical API base rejected');
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation required');
  const url=new URL(BASE+'/bookings');
  if(bookingId!==undefined){
    if(!/^\d+$/.test(String(bookingId)))throw new Error('bookingId must be numeric');
    url.searchParams.set('id',String(bookingId));
  }
  const res=await fetchImpl(url.toString(),{
    method:'GET',
    headers:{'accept':'application/json','token':token},
    redirect:'error',
    signal:AbortSignal.timeout(15000)
  });
  if(!res||!res.ok)throw new Error('Beds24 GET /bookings failed: HTTP '+(res?.status??'unknown'));
  const data=await res.json();
  if(data===null||typeof data!=='object')throw new Error('Beds24 malformed JSON response');
  return data;
}
export function summarizeBookings(data){
  const bookings=Array.isArray(data)?data:Array.isArray(data.data)?data.data:Array.isArray(data.bookings)?data.bookings:[];
  return bookings.map(b=>({
    id:String(b.id??b.bookingId??''),
    propertyId:String(b.propertyId??b.propId??''),
    status:String(b.status??b.bookingStatus??''),
    arrival:String(b.arrival??b.firstNight??b.checkIn??''),
    departure:String(b.departure??b.checkOut??'')
  })).filter(b=>b.id);
}
export function decideWebhook({booking, seen=new Set(), cleaningState={}}){
  if(!booking||typeof booking!=='object')throw new Error('Booking object required');
  const id=String(booking.id??booking.bookingId??'');
  const propertyId=String(booking.propertyId??booking.propId??'');
  if(!id||!propertyId)throw new Error('Missing booking/property identifier');
  const status=String(booking.status??booking.bookingStatus??'').toLowerCase();
  const arrival=String(booking.arrival??booking.firstNight??booking.checkIn??'');
  const departure=String(booking.departure??booking.checkOut??'');
  const fingerprint=JSON.stringify([propertyId,id,status,arrival,departure]);
  if(seen.has(fingerprint))return {kind:'duplicate',id,propertyId,externalWrites:0};
  seen.add(fingerprint);
  if(/cancel/.test(status))return {kind:'cancelled-review',id,propertyId,externalWrites:0,requiresApproval:true,reason:'Review previously scheduled cleaning; never erase automatically'};
  const marker=propertyId+'|'+arrival;
  if(cleaningState[marker]==='conflict')return {kind:'cleaning-conflict',id,propertyId,externalWrites:0,requiresApproval:true,reason:'Verify turnover window and approve cleaner assignment'};
  return {kind:'booking-review',id,propertyId,externalWrites:0,requiresApproval:true,reason:'Check if a cleaning assignment is required'};
}
