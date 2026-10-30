export interface AvailabilitySignal {
  source: "booking" | "airbnb" | "monthly" | "calendar-import";
  status: "confirmed" | "cancelled" | "tentative" | "unknown";
  start: string;
  end: string;
  reservationId?: string;
  verified: boolean;
}
export interface AvailabilityAssessment {
  safeToSell: boolean;
  reasons: string[];
  conflictingSignals: AvailabilitySignal[];
}
const validDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
};
export function assessAvailability(input: {
  start: string; end: string; signals: AvailabilitySignal[];
  allPrimaryChannelsVerified: boolean;
  allImportFeedsVerified: boolean;
}): AvailabilityAssessment {
  const reasons: string[] = [];
  if (!validDate(input.start) || !validDate(input.end) || input.end <= input.start)
    reasons.push("INVALID_DATE_RANGE");
  if (!input.allPrimaryChannelsVerified) reasons.push("CHANNEL_SYNC_UNVERIFIED");
  if (!input.allImportFeedsVerified) reasons.push("CALENDAR_IMPORT_UNVERIFIED");
  const conflictingSignals: AvailabilitySignal[] = [];
  for (const signal of input.signals) {
    if (!validDate(signal.start) || !validDate(signal.end) || signal.end <= signal.start) {
      reasons.push("INVALID_SIGNAL"); continue;
    }
    if (!signal.verified) reasons.push("UNVERIFIED_RESERVATION_SIGNAL");
    if (signal.status === "unknown" || signal.status === "tentative")
      reasons.push("AMBIGUOUS_RESERVATION_STATUS");
    if (input.start < signal.end && signal.start < input.end &&
      signal.status !== "cancelled") {
      conflictingSignals.push(signal);
      reasons.push("OVERLAPPING_RESERVATION");
    }
  }
  return {safeToSell: reasons.length === 0, reasons: [...new Set(reasons)], conflictingSignals};
}
// Do not infer channel availability from an empty Google Calendar.
// Calendar import feeds are observational only and must never be a booking authority.
