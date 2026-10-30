import { BookingSnapshot, compareBookingSnapshots } from "./BookingIdentityReconciler";
import { Interval, reconcileIntervals, seasonProtected } from "./BookingInventoryReconciler";
import { CutoverEvidence, CutoverGate, evaluateBeds24ProductionCutover } from "./ProductionCutoverGate";
import { ReservationNotice, reviewReservationNotices } from "./ReservationNoticeAudit";

/** Read-only preflight: successful code tests alone never authorize live OTA writes. */
export interface ProductionCutoverInput {
  evidence: CutoverEvidence;
  expectedPropertyId: string;
  otaBookings: BookingSnapshot[];
  beds24Bookings: BookingSnapshot[];
  otaInventory: Interval[];
  beds24Inventory: Interval[];
  beds24SeasonalBlocks: Interval[];
  /** False until all independent sources have been fully extracted. */
  snapshotsComplete: boolean;
  /** Evidence must include all three OTA inventories, not merely a successful empty response. */
  otaSourcesVerified?: { bookingCom: boolean; airbnbStay: boolean; airbnbMonthly: boolean; beds24: boolean };
  /** Distinct verified timestamp of the source snapshots. */
  sourceEvidenceTimestamp?: string;
  /** Current evaluation instant, supplied by the caller; defaults to now. */
  evaluatedAt?: string;
  /** Source notification history; IDs are not current booking states. */
  reservationNotices?: ReservationNotice[];
  /** Booking.com IDs independently confirmed in the provider's live data. */
  liveBookingComReservationIds?: string[];
}
export interface ProductionCutoverResult extends CutoverGate {
  bookingDifferences: string[];
  inventoryDifferences: string[];
  monthlyProtected: boolean;
}
export function evaluateProductionCutover(input: ProductionCutoverInput): ProductionCutoverResult {
  const bookings=compareBookingSnapshots(input.otaBookings,input.beds24Bookings,input.expectedPropertyId);
  const inventory=reconcileIntervals(input.otaInventory,input.beds24Inventory);
  const monthly=seasonProtected(input.beds24SeasonalBlocks);
  // Never allow a caller to override algorithmically computed reconciliation evidence.
  const evidence:CutoverEvidence={
    ...input.evidence,
    existingBookingReconciled:input.snapshotsComplete && bookings.safe && input.evidence.existingBookingReconciled,
    blockedDaysReconciled:input.snapshotsComplete && inventory.matched && input.evidence.blockedDaysReconciled,
    seasonalMonthlyDatesProtected:monthly && input.evidence.seasonalMonthlyDatesProtected,
  };
  const gate=evaluateBeds24ProductionCutover(evidence);
  const blockers=[...gate.blockers];
  const sources=input.otaSourcesVerified;
  if(!sources || !sources.bookingCom || !sources.airbnbStay || !sources.airbnbMonthly || !sources.beds24) blockers.push("ALL_FOUR_SOURCE_EXPORTS_NOT_VERIFIED");
  const evidenceAt=Date.parse(input.sourceEvidenceTimestamp??"");
  const evaluatedAt=input.evaluatedAt===undefined?Date.now():Date.parse(input.evaluatedAt);
  if(!Number.isFinite(evidenceAt)) blockers.push("SOURCE_EVIDENCE_TIMESTAMP_MISSING");
  else if(!Number.isFinite(evaluatedAt) || evidenceAt>evaluatedAt || evaluatedAt-evidenceAt>30*60*1000)
    blockers.push("SOURCE_EVIDENCE_STALE_OR_FUTURE");
  if(!input.snapshotsComplete) blockers.push("SOURCE_SNAPSHOTS_INCOMPLETE");
  if(!input.expectedPropertyId.trim()) blockers.push("PROPERTY_ID_MISSING");
  if(input.reservationNotices && input.reservationNotices.length){
    const audit=reviewReservationNotices(input.reservationNotices);
    const verified=new Set(input.liveBookingComReservationIds??[]);
    if(audit.requiresProviderVerification.some(id=>!verified.has(id))) blockers.push("BOOKING_COM_NOTICES_UNVERIFIED_IN_LIVE_OTA");
  }
  return {ready:blockers.length===0,blockers,
    bookingDifferences:bookings.blockers,inventoryDifferences:inventory.differences,monthlyProtected:monthly};
}
