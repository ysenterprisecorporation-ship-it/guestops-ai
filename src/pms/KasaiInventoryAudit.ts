import { parseReservationEmail } from "./ReservationEmailParser";
import { assessAvailability, AvailabilitySignal } from "./AvailabilityGuard";

export interface LodgingSafetyReport {
  status: "BLOCKED" | "READY_FOR_MANUAL_COMPARISON";
  account: string;
  messageCount: number;
  recognizedBookings: number;
  recognizedCancellations: number;
  excludedMessages: number;
  reasons: string[];
}

// This function reads a bounded sample only; it does not write OTA inventory.
// A primary OTA channel's authoritative availability cannot be proven by Gmail alone.
export function auditKasaiMailbox(
  mailbox: { getRecentMessages(limit: number): { id: string; from: string; subject: string; body: string }[] },
  account: string,
): LodgingSafetyReport {
  if (account.toLowerCase() !== "edogawa.stay.info@gmail.com")
    throw new Error("KASAI_ACCOUNT_REQUIRED");
  const messages = mailbox.getRecentMessages(50);
  const parsed = messages.map(parseReservationEmail);
  const bookings = parsed.filter(m => m.eventType === "BOOKING_NEW");
  const cancellations = parsed.filter(m => m.eventType === "BOOKING_CANCELLED");
  const excluded = parsed.filter(m => !["BOOKING_NEW", "BOOKING_CANCELLED", "BOOKING_CHANGE"].includes(m.eventType));
  const reasons = ["OTA_LIVE_AVAILABILITY_NOT_VERIFIED", "PMS_CHANNEL_CONNECTION_NOT_VERIFIED"];
  if (parsed.some(m => m.evidence.includes("RESERVATION_CODE_MISSING")))
    reasons.push("INCOMPLETE_RESERVATION_IDENTIFIERS");
  return {
    status: "BLOCKED", account, messageCount: messages.length,
    recognizedBookings: bookings.length,
    recognizedCancellations: cancellations.length,
    excludedMessages: excluded.length,
    reasons,
  };
}

export function disallowCalendarAsInventorySource(
  start: string, end: string, calendarSignals: AvailabilitySignal[],
) {
  return assessAvailability({
    start, end, signals: calendarSignals,
    allPrimaryChannelsVerified: false,
    allImportFeedsVerified: false,
  });
}
