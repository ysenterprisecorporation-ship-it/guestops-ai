import { directBookingQuote, type NightInventory } from "./DirectBookingQuote";
import {
  attachCheckoutLink,
  confirmDirectBookingPayment,
  finalizeDirectBooking,
  prepareDirectBookingCheckout,
  type PendingDirectBooking,
} from "./DirectBookingFlow";

export interface DirectInventorySnapshot {
  version: string;
  validUntil: string;
  nights: NightInventory[];
}

export interface DirectInventoryGateway {
  read(checkin: string, checkout: string): DirectInventorySnapshot;
  commit(input: {
    bookingId: string;
    checkin: string;
    checkout: string;
    guests: number;
    expectedVersion: string;
  }): { version: string; nights: NightInventory[] };
}

export interface DirectBookingStore {
  save(record: PendingDirectBooking): void;
  bySquareOrderId(orderId: string): PendingDirectBooking | null;
}

export interface DirectSquareGateway {
  createQuickPayLink(input: {
    idempotencyKey: string;
    locationId: string;
    name: string;
    amount: number;
    redirectUrl?: string;
    note?: string;
  }): { id: string; order_id: string; url: string };
  payment(id: string): {
    status: string;
    order_id?: string;
    location_id: string;
    amount_money: { amount: number; currency: string };
  };
}

export function createDirectBookingCheckout(input: {
  bookingId: string;
  checkin: string;
  checkout: string;
  guests: number;
  maxGuests: number;
  minimumNights: number;
  cleaningFee: number;
  locationId: string;
  propertyName: string;
  redirectUrl?: string;
  now: Date;
}, deps: {
  inventory: DirectInventoryGateway;
  square: DirectSquareGateway;
  store: DirectBookingStore;
}) {
  const first = deps.inventory.read(input.checkin, input.checkout);
  const quote = directBookingQuote({
    checkin: input.checkin,
    checkout: input.checkout,
    guests: input.guests,
    maxGuests: input.maxGuests,
    minimumNights: input.minimumNights,
    cleaningFee: input.cleaningFee,
    inventory: first.nights,
    inventoryVersion: first.version,
    validUntil: first.validUntil,
    now: input.now,
  });

  // 決済リンク生成の直前に在庫を再取得する。
  const rechecked = deps.inventory.read(input.checkin, input.checkout);
  const prepared = prepareDirectBookingCheckout({
    bookingId: input.bookingId,
    quote: {
      checkin: input.checkin,
      checkout: input.checkout,
      guests: input.guests,
      total: quote.total,
      currency: "JPY",
      inventoryVersion: quote.inventoryVersion,
      validUntil: quote.validUntil,
      requiresInventoryRecheck: true,
      bookingConfirmed: false,
      nightsDetail: quote.nightsDetail,
    },
    recheckedInventoryVersion: rechecked.version,
    locationId: input.locationId,
    propertyName: input.propertyName,
    now: input.now,
  });

  const link = deps.square.createQuickPayLink({
    ...prepared.square,
    redirectUrl: input.redirectUrl,
  });
  const pending = attachCheckoutLink(prepared.pending, link);
  deps.store.save(pending);
  return { quote, pending, paymentLinkUrl: link.url };
}

export function processDirectBookingPayment(input: {
  paymentId: string;
}, deps: {
  inventory: DirectInventoryGateway;
  square: DirectSquareGateway;
  store: DirectBookingStore;
}) {
  const payment = deps.square.payment(input.paymentId);
  if (!payment.order_id) throw new Error("PAYMENT_ORDER_MISSING");
  const existing = deps.store.bySquareOrderId(payment.order_id);
  if (!existing) throw new Error("DIRECT_BOOKING_NOT_FOUND");
  if (existing.state === "CONFIRMED") return existing;

  const paid = confirmDirectBookingPayment(existing, payment);
  deps.store.save(paid);

  // PMS側で expectedVersion を条件に予約確保する実装を要求する。
  // ここが成功するまで CONFIRMED へ進めない。
  const committed = deps.inventory.commit({
    bookingId: paid.bookingId,
    checkin: paid.checkin,
    checkout: paid.checkout,
    guests: paid.guests,
    expectedVersion: paid.inventoryVersion,
  });

  const confirmed = finalizeDirectBooking({
    pending: paid,
    finalInventoryVersion: committed.version,
    nights: committed.nights,
  });
  deps.store.save(confirmed);
  return confirmed;
}
