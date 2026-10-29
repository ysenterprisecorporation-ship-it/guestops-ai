import { BookingSnapshot, compareBookingSnapshots } from "./BookingIdentityReconciler";
import { Interval, reconcileIntervals, seasonProtected } from "./BookingInventoryReconciler";
import { CutoverEvidence, CutoverGate, evaluateBeds24ProductionCutover } from "./ProductionCutoverGate";

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
  if(!input.snapshotsComplete) blockers.push("SOURCE_SNAPSHOTS_INCOMPLETE");
  if(!input.expectedPropertyId.trim()) blockers.push("PROPERTY_ID_MISSING");
  return {ready:blockers.length===0,blockers,
    bookingDifferences:bookings.blockers,inventoryDifferences:inventory.differences,monthlyProtected:monthly};
}
