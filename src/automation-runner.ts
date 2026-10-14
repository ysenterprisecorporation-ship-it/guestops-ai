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
  sendContract(record: BookingRecord, key: string): Promise<{ contractId: string }>;
  isContractSigned(contractId: string): Promise<boolean>;
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

  if (action === "SEND_GMO_CONTRACT") {
    const result = await ports.sendContract(
      record,
      idempotencyKey(record.bookingId, "CONTRACT"),
    );
    const next = applyBookingEvent(record, {
      type: "CONTRACT_SENT",
      contractId: result.contractId,
    });
    await ports.save(next);
    return next;
  }

  if (action === "WAIT_GMO_SIGNATURE") {
    if (!record.contractId) throw new Error("CONTRACT_ID_REQUIRED");
    const signed = await ports.isContractSigned(record.contractId);
    if (!signed) return record;
    const next = applyBookingEvent(record, {
      type: "CONTRACT_SIGNED",
      contractId: record.contractId,
    });
    await ports.save(next);
    return next;
  }

  return record;
}
