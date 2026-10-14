import type { BookingRecord } from "./booking-flow.js";

export interface InventoryProvider {
  recheck(record: BookingRecord): Promise<{
    available: boolean;
    validUntil: string;
  }>;
}

export interface PaymentProvider {
  createLink(record: BookingRecord, idempotencyKey: string): Promise<{
    paymentLinkId: string;
    url: string;
  }>;
  getStatus(record: BookingRecord): Promise<{
    paid: boolean;
    paymentId?: string;
    amountYen?: number;
    paidAtIso?: string;
  }>;
}

export interface ReservationProvider {
  confirm(record: BookingRecord, idempotencyKey: string): Promise<{
    reservationId: string;
  }>;
}

export interface ContractHandoffProvider {
  prepare(record: BookingRecord): Promise<{
    contractFileName: string;
    recipientEmail: string;
    recipientName: string;
  }>;
}
