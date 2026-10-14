import type { NightInventory } from "./DirectBookingQuote";

export interface DirectBookingQuoteSnapshot {
  checkin: string;
  checkout: string;
  guests: number;
  total: number;
  currency: "JPY";
  inventoryVersion: string;
  validUntil: string;
  requiresInventoryRecheck: boolean;
  bookingConfirmed: false;
  nightsDetail: NightInventory[];
}

export interface PendingDirectBooking {
  bookingId: string;
  checkin: string;
  checkout: string;
  guests: number;
  amount: number;
  currency: "JPY";
  inventoryVersion: string;
  locationId: string;
  squareOrderId?: string;
  paymentLinkId?: string;
  paymentLinkUrl?: string;
  state: "QUOTED" | "CHECKOUT_CREATED" | "PAID_PENDING_FINAL_INVENTORY" | "CONFIRMED";
}

function assertSafeBookingId(value: string) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw new Error("BOOKING_ID_INVALID");
}

function assertNotExpired(validUntil: string, now: Date) {
  const expiry = Date.parse(validUntil);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiry) || expiry <= now.getTime())
    throw new Error("QUOTE_EXPIRED");
}

export function prepareDirectBookingCheckout(input: {
  bookingId: string;
  quote: DirectBookingQuoteSnapshot;
  recheckedInventoryVersion: string;
  locationId: string;
  propertyName: string;
  now: Date;
}) {
  assertSafeBookingId(input.bookingId);
  assertNotExpired(input.quote.validUntil, input.now);
  if (!input.quote.requiresInventoryRecheck) throw new Error("INVENTORY_RECHECK_REQUIRED");
  if (!input.recheckedInventoryVersion.trim()) throw new Error("INVENTORY_VERSION_INVALID");
  if (input.recheckedInventoryVersion !== input.quote.inventoryVersion)
    throw new Error("INVENTORY_CHANGED");
  if (!input.locationId.trim() || !input.propertyName.trim())
    throw new Error("CHECKOUT_INPUT_INVALID");
  if (!Number.isSafeInteger(input.quote.total) || input.quote.total <= 0)
    throw new Error("CHECKOUT_AMOUNT_INVALID");
  if (input.quote.currency !== "JPY") throw new Error("CURRENCY_INVALID");

  const pending: PendingDirectBooking = {
    bookingId: input.bookingId,
    checkin: input.quote.checkin,
    checkout: input.quote.checkout,
    guests: input.quote.guests,
    amount: input.quote.total,
    currency: "JPY",
    inventoryVersion: input.quote.inventoryVersion,
    locationId: input.locationId,
    state: "QUOTED",
  };

  return {
    pending,
    square: {
      idempotencyKey: "direct-" + input.bookingId,
      locationId: input.locationId,
      name: input.propertyName + " " + input.quote.checkin + "〜" + input.quote.checkout,
      amount: input.quote.total,
      note: "Direct booking " + input.bookingId + " / " + input.quote.guests + " guests",
    },
  };
}

export function attachCheckoutLink(
  pending: PendingDirectBooking,
  link: { id: string; order_id: string; url: string },
): PendingDirectBooking {
  if (pending.state !== "QUOTED") throw new Error("BOOKING_STATE_INVALID");
  if (!link.id || !link.order_id || !/^https:\/\/[^\s]+$/.test(link.url))
    throw new Error("CHECKOUT_LINK_INVALID");
  return {
    ...pending,
    squareOrderId: link.order_id,
    paymentLinkId: link.id,
    paymentLinkUrl: link.url,
    state: "CHECKOUT_CREATED",
  };
}

export function confirmDirectBookingPayment(
  pending: PendingDirectBooking,
  payment: {
    status?: string;
    order_id?: string;
    location_id?: string;
    amount_money?: { amount?: number; currency?: string };
  },
): PendingDirectBooking {
  if (pending.state !== "CHECKOUT_CREATED") throw new Error("BOOKING_STATE_INVALID");
  if (payment.status !== "COMPLETED") throw new Error("PAYMENT_NOT_COMPLETED");
  if (!pending.squareOrderId || payment.order_id !== pending.squareOrderId)
    throw new Error("PAYMENT_ORDER_MISMATCH");
  if (payment.location_id !== pending.locationId) throw new Error("PAYMENT_LOCATION_MISMATCH");
  if (
    payment.amount_money?.amount !== pending.amount ||
    payment.amount_money?.currency !== pending.currency
  )
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  return { ...pending, state: "PAID_PENDING_FINAL_INVENTORY" };
}

export function finalizeDirectBooking(input: {
  pending: PendingDirectBooking;
  finalInventoryVersion: string;
  nights: NightInventory[];
}) {
  const { pending } = input;
  if (pending.state !== "PAID_PENDING_FINAL_INVENTORY")
    throw new Error("BOOKING_STATE_INVALID");
  if (!input.finalInventoryVersion.trim()) throw new Error("INVENTORY_VERSION_INVALID");
  const required = new Set<string>();
  for (
    let t = Date.parse(pending.checkin + "T00:00:00Z");
    t < Date.parse(pending.checkout + "T00:00:00Z");
    t += 86400000
  )
    required.add(new Date(t).toISOString().slice(0, 10));
  for (const date of required) {
    const rows = input.nights.filter((x) => x.date === date);
    if (rows.length !== 1 || !rows[0].available) throw new Error("FINAL_INVENTORY_UNAVAILABLE");
  }
  return {
    ...pending,
    inventoryVersion: input.finalInventoryVersion,
    state: "CONFIRMED" as const,
    bookingConfirmed: true as const,
  };
}
