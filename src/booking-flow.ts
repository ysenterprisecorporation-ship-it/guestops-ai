export type RentalMode = "SHORT_STAY" | "MONTHLY";

export type BookingState =
  | "INQUIRY"
  | "QUOTED"
  | "INVENTORY_CONFIRMED"
  | "PAYMENT_LINK_SENT"
  | "PAID"
  | "BOOKING_CONFIRMED"
  | "CONTRACT_SENT"
  | "CONTRACT_SIGNED"
  | "MANUAL_REVIEW"
  | "CANCELLED";

export interface BookingRecord {
  bookingId: string;
  rentalMode: RentalMode;
  state: BookingState;
  quoteAmountYen: number;
  inventoryValidUntil?: string;
  paymentId?: string;
  reservationId?: string;
  contractId?: string;
  reviewReason?: string;
}

export type BookingEvent =
  | { type: "QUOTE_ISSUED"; amountYen: number }
  | { type: "INVENTORY_RECHECKED"; available: boolean; validUntil?: string }
  | { type: "PAYMENT_LINK_CREATED" }
  | { type: "PAYMENT_CONFIRMED"; paymentId: string; amountYen: number; nowIso: string }
  | { type: "RESERVATION_CONFIRMED"; reservationId: string }
  | { type: "CONTRACT_SENT"; contractId: string }
  | { type: "CONTRACT_SIGNED"; contractId: string }
  | { type: "CANCEL" };

function requireState(record: BookingRecord, expected: BookingState) {
  if (record.state !== expected) {
    throw new Error(`INVALID_STATE:${record.state}->${expected}`);
  }
}

function validYen(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

export function applyBookingEvent(
  record: BookingRecord,
  event: BookingEvent,
): BookingRecord {
  switch (event.type) {
    case "QUOTE_ISSUED": {
      requireState(record, "INQUIRY");
      if (!validYen(event.amountYen)) throw new Error("QUOTE_AMOUNT_INVALID");
      return { ...record, quoteAmountYen: event.amountYen, state: "QUOTED" };
    }
    case "INVENTORY_RECHECKED": {
      requireState(record, "QUOTED");
      if (!event.available) {
        return {
          ...record,
          state: "MANUAL_REVIEW",
          reviewReason: "INVENTORY_UNAVAILABLE",
        };
      }
      if (!event.validUntil || !Number.isFinite(Date.parse(event.validUntil))) {
        throw new Error("INVENTORY_VALID_UNTIL_REQUIRED");
      }
      return {
        ...record,
        inventoryValidUntil: event.validUntil,
        state: "INVENTORY_CONFIRMED",
      };
    }
    case "PAYMENT_LINK_CREATED":
      requireState(record, "INVENTORY_CONFIRMED");
      return { ...record, state: "PAYMENT_LINK_SENT" };

    case "PAYMENT_CONFIRMED": {
      requireState(record, "PAYMENT_LINK_SENT");
      if (!event.paymentId.trim()) throw new Error("PAYMENT_ID_REQUIRED");
      if (!validYen(event.amountYen)) throw new Error("PAYMENT_AMOUNT_INVALID");
      if (event.amountYen !== record.quoteAmountYen) {
        return {
          ...record,
          state: "MANUAL_REVIEW",
          reviewReason: "PAYMENT_AMOUNT_MISMATCH",
        };
      }
      if (
        !record.inventoryValidUntil ||
        Date.parse(event.nowIso) > Date.parse(record.inventoryValidUntil)
      ) {
        return {
          ...record,
          state: "MANUAL_REVIEW",
          reviewReason: "INVENTORY_RECHECK_EXPIRED",
        };
      }
      return { ...record, paymentId: event.paymentId, state: "PAID" };
    }

    case "RESERVATION_CONFIRMED":
      requireState(record, "PAID");
      if (!event.reservationId.trim()) throw new Error("RESERVATION_ID_REQUIRED");
      return {
        ...record,
        reservationId: event.reservationId,
        state: "BOOKING_CONFIRMED",
      };

    case "CONTRACT_SENT":
      requireState(record, "BOOKING_CONFIRMED");
      if (record.rentalMode !== "MONTHLY") {
        throw new Error("CONTRACT_NOT_REQUIRED_FOR_SHORT_STAY");
      }
      if (!event.contractId.trim()) throw new Error("CONTRACT_ID_REQUIRED");
      return {
        ...record,
        contractId: event.contractId,
        state: "CONTRACT_SENT",
      };

    case "CONTRACT_SIGNED":
      requireState(record, "CONTRACT_SENT");
      if (event.contractId !== record.contractId) {
        return {
          ...record,
          state: "MANUAL_REVIEW",
          reviewReason: "CONTRACT_ID_MISMATCH",
        };
      }
      return { ...record, state: "CONTRACT_SIGNED" };

    case "CANCEL":
      return { ...record, state: "CANCELLED" };
  }
}

export function nextAction(record: BookingRecord):
  | "ISSUE_QUOTE"
  | "RECHECK_INVENTORY"
  | "CREATE_PAYMENT_LINK"
  | "WAIT_PAYMENT"
  | "CONFIRM_RESERVATION"
  | "PREPARE_GMO_HANDOFF"
  | "WAIT_MANUAL_GMO_SEND"
  | "WAIT_MANUAL_GMO_SIGNATURE"
  | "COMPLETE"
  | "MANUAL_REVIEW"
  | "NONE" {
  switch (record.state) {
    case "INQUIRY": return "ISSUE_QUOTE";
    case "QUOTED": return "RECHECK_INVENTORY";
    case "INVENTORY_CONFIRMED": return "CREATE_PAYMENT_LINK";
    case "PAYMENT_LINK_SENT": return "WAIT_PAYMENT";
    case "PAID": return "CONFIRM_RESERVATION";
    case "BOOKING_CONFIRMED":
      return record.rentalMode === "MONTHLY" ? "PREPARE_GMO_HANDOFF" : "COMPLETE";
    case "CONTRACT_SENT": return "WAIT_MANUAL_GMO_SIGNATURE";
    case "CONTRACT_SIGNED": return "COMPLETE";
    case "MANUAL_REVIEW": return "MANUAL_REVIEW";
    case "CANCELLED": return "NONE";
  }
}

export function idempotencyKey(
  bookingId: string,
  action: "PAYMENT_LINK" | "RESERVATION" | "CONTRACT",
) {
  const normalized = bookingId.trim();
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(normalized)) {
    throw new Error("BOOKING_ID_INVALID");
  }
  return `gtos:${normalized}:${action}`;
}
