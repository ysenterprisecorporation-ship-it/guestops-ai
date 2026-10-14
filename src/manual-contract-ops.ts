import { applyBookingEvent, type BookingRecord } from "./booking-flow.js";

export function recordManualGmoSend(
  record: BookingRecord,
  contractId: string,
): BookingRecord {
  if (record.rentalMode !== "MONTHLY") {
    throw new Error("GMO_MANUAL_MONTHLY_ONLY");
  }
  if (record.state !== "CONTRACT_READY") {
    throw new Error("GMO_MANUAL_SEND_REQUIRES_CONTRACT_READY");
  }
  return applyBookingEvent(record, {
    type: "CONTRACT_SENT",
    contractId,
  });
}

export function recordManualGmoSignature(
  record: BookingRecord,
  contractId: string,
): BookingRecord {
  if (record.rentalMode !== "MONTHLY") {
    throw new Error("GMO_MANUAL_MONTHLY_ONLY");
  }
  if (record.state !== "CONTRACT_SENT") {
    throw new Error("GMO_MANUAL_SIGNATURE_REQUIRES_CONTRACT_SENT");
  }
  return applyBookingEvent(record, {
    type: "CONTRACT_SIGNED",
    contractId,
  });
}
