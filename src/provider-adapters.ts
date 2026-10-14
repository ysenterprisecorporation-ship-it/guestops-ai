import type { BookingRecord } from "./booking-flow.js";

export interface InventoryAdapter {
  recheck(record: BookingRecord): Promise<{ available: boolean; validUntil: string }>;
}

export interface PaymentAdapter {
  createLink(record: BookingRecord, idempotencyKey: string): Promise<{ id: string; url: string }>;
  status(record: BookingRecord): Promise<{ paid: boolean; paymentId?: string; amountYen?: number; paidAtIso?: string }>;
}

export interface ReservationAdapter {
  confirm(record: BookingRecord, idempotencyKey: string): Promise<{ reservationId: string }>;
}

export interface ContractAdapter {
  send(record: BookingRecord, idempotencyKey: string): Promise<{ contractId: string }>;
  signed(contractId: string): Promise<boolean>;
}
