export interface CutoverEvidence {
  bookingChannelMapped: boolean;
  airbnbStayMapped: boolean;
  airbnbMonthlyMapped: boolean;
  existingBookingReconciled: boolean;
  blockedDaysReconciled: boolean;
  seasonalMonthlyDatesProtected: boolean;
  legacyGASOutboundDisconnected: boolean;
  oldIcalImportsDisconnected: boolean;
  authorizedByOwner: boolean;
}
export interface CutoverGate { ready: boolean; blockers: string[] }
export function evaluateBeds24ProductionCutover(e: CutoverEvidence): CutoverGate {
  const conditions: [keyof CutoverEvidence, string][] = [
    ["bookingChannelMapped","BOOKING_CHANNEL_NOT_MAPPED"],
    ["airbnbStayMapped","AIRBNB_STAY_NOT_MAPPED"],
    ["airbnbMonthlyMapped","AIRBNB_MONTHLY_NOT_MAPPED"],
    ["existingBookingReconciled","EXISTING_RESERVATIONS_NOT_RECONCILED"],
    ["blockedDaysReconciled","BLOCKED_DATES_NOT_RECONCILED"],
    ["seasonalMonthlyDatesProtected","MONTHLY_2027_NOT_PROTECTED"],
    ["legacyGASOutboundDisconnected","LEGACY_GAS_SYNC_NOT_DISABLED"],
    ["oldIcalImportsDisconnected","OLD_ICAL_IMPORTS_NOT_DISCONNECTED"],
    ["authorizedByOwner","OWNER_CUTOVER_AUTHORIZATION_MISSING"],
  ];
  const blockers=conditions.filter(([k])=>e[k]!==true).map(([,code])=>code);
  return {ready:blockers.length===0,blockers};
}
// This gate never performs a channel switch, OTA write, or calendar write.
