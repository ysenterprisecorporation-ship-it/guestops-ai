import {
  applyBookingEvent,
  idempotencyKey,
  nextAction,
  type BookingRecord,
} from "./booking-flow.js";

export interface AutomationPorts {
  recheckInventory(record: BookingRecord): Promise<{ available: boolean; validUntil: string }>;
  createPaymentLink(record: BookingRecord, key: string): Promise<{ url: string }>;
  getPayment(record: BookingRecord): Promise<{ paid: boolean; paymentId?: string; amountYen?: number; paidAtIso?: string }>;
  confirmReservation(record: BookingRecord, key: string): Promise<{ reservationId: string }>;
  prepareGmoHandoff(record: BookingRecord): Promise<void>;
  save(record: BookingRecord): Promise<void>;
}

export async function runBookingStep(
  record: BookingRecord,
  ports: AutomationPorts,
): Promise<BookingRecord> {
  const action = nextAction(record);

  if (action === "RECHECK_INVENTORY") {
    const inv = await ports.recheckInventory(record);
    const next = applyBookingEvent(record, {
      type: "INVENTORY_RECHECKED",
      available: inv.available,
      validUntil: inv.validUntil,
    });
    await ports.save(next);
    return next;
  }

  if (action === "CREATE_PAYMENT_LINK") {
    await ports.createPaymentLink(record, idempotencyKey(record.bookingId, "PAYMENT_LINK"));
    const next = applyBookingEvent(record, { type: "PAYMENT_LINK_CREATED" });
    await ports.save(next);
    return next;
  }

  if (action === "WAIT_PAYMENT") {
    const payment = await ports.getPayment(record);
    if (!payment.paid) return record;
    if (!payment.paymentId || !payment.amountYen || !payment.paidAtIso) {
      throw new Error("PAYMENT_DATA_INCOMPLETE");
    }
    const next = applyBookingEvent(record, {
      type: "PAYMENT_CONFIRMED",
      paymentId: payment.paymentId,
      amountYen: payment.amountYen,
      nowIso: payment.paidAtIso,
    });
    await ports.save(next);
    return next;
  }

  if (action === "CONFIRM_RESERVATION") {
    const result = await ports.confirmReservation(
      record,
      idempotencyKey(record.bookingId, "RESERVATION"),
    );
    const next = applyBookingEvent(record, {
      type: "RESERVATION_CONFIRMED",
      reservationId: result.reservationId,
    });
    await ports.save(next);
    return next;
  }

  if (action === "PREPARE_GMO_HANDOFF") {
    await ports.prepareGmoHandoff(record);
    const next = applyBookingEvent(record, { type: "CONTRACT_HANDOFF_PREPARED" });
    await ports.save(next);
    return next;
  }

  if (action === "WAIT_MANUAL_GMO_SEND" || action === "WAIT_MANUAL_GMO_SIGNATURE") {
    return record;
  }

  return record;
}
