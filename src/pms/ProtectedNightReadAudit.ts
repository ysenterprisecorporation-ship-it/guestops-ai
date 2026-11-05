import { VerifiedStay, bookedNightProtection } from "./VerifiedBookingNightProtection";

/** Read-only. Compare individually verified Booking.com nights against Beds24 booking nights.
 * Never interpret a missing Bed24 reservation as an unoccupied sellable night.
 */
export function auditProtectedBookingNights(otaVerified: VerifiedStay[],beds24Verified: VerifiedStay[]) {
 const ota=bookedNightProtection(otaVerified);
 const beds=bookedNightProtection(beds24Verified);
 const bedsDates=new Set(beds.map(r=>r.date));
 const missingInBeds24=ota.filter(r=>!bedsDates.has(r.date)).map(r=>r.date);
 return {
  occupiedNightCount:ota.length,
  beds24NightCount:beds.length,
  missingInBeds24,
  otaOverlapDays:ota.filter(r=>r.overlap).map(r=>r.date),
  beds24OverlapDays:beds.filter(r=>r.overlap).map(r=>r.date),
  readyForCutover:false as const,
  readOnly:true as const
 };
}
