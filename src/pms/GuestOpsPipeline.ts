import { PmsAdapter, PmsBooking, PmsWebhookEvent } from "./PmsAdapter";

export interface GuestOpsDraft {
  bookingId: string;
  eventType: PmsWebhookEvent["eventType"];
  status: "DRAFT" | "REVIEW" | "IGNORED";
  reasons: string[];
  messageDraft?: string;
  cleaning?: { date: string; title: string; action: "UPSERT" | "REVIEW" };
  pricing?: { action: "RECALCULATE_ONLY"; minPriceGuardRequired: true };
  audit: { provider: string; bookingId?: string; action: string; timestamp: string }[];
}

export interface PipelinePolicy {
  expectedPropertyId?: string;
  rosterUrl: string;
  maximumGuests: number;
}

function isoDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isCancelled(booking: PmsBooking): boolean {
  return /cancel|no.?show|declined/i.test(booking.status ?? "");
}

// Pure orchestration: no PMS writes, no guest messages sent, no calendar mutation.
export function planGuestOpsEvent(
  adapter: PmsAdapter,
  payload: unknown,
  policy: PipelinePolicy,
  now: string,
): GuestOpsDraft {
  const event = adapter.normalizeWebhook(payload);
  const audit: GuestOpsDraft["audit"] = [];
  const record = (action: string) => audit.push({
    provider: adapter.provider, bookingId: event.bookingId, action, timestamp: now,
  });
  const ignored = (reason: string): GuestOpsDraft => {
    record("IGNORED:" + reason);
    return { bookingId: event.bookingId ?? "", eventType: event.eventType,
      status: "IGNORED", reasons: [reason], audit };
  };

  if (!event.bookingId || !/^[A-Za-z0-9_-]{1,64}$/.test(event.bookingId))
    return ignored("INVALID_BOOKING_ID");
  if (event.eventType === "unknown") return ignored("UNKNOWN_EVENT");
  if (!adapter.capabilities().reservationsRead) {
    record("REVIEW:BOOKING_READ_UNAVAILABLE");
    return { bookingId: event.bookingId, eventType: event.eventType,
      status: "REVIEW", reasons: ["BOOKING_READ_UNAVAILABLE"], audit };
  }
  const booking = adapter.getBooking(event.bookingId);
  if (!booking || booking.id !== event.bookingId) {
    record("REVIEW:BOOKING_NOT_VERIFIED");
    return { bookingId: event.bookingId, eventType: event.eventType,
      status: "REVIEW", reasons: ["BOOKING_NOT_VERIFIED"], audit };
  }
  if (policy.expectedPropertyId && booking.propertyId !== policy.expectedPropertyId) {
    record("REVIEW:PROPERTY_MISMATCH");
    return { bookingId: event.bookingId, eventType: event.eventType,
      status: "REVIEW", reasons: ["PROPERTY_MISMATCH"], audit };
  }
  if (event.eventType === "booking.cancelled" || isCancelled(booking)) {
    record("REVIEW:CANCELLED_NEEDS_CLEANING_RECONCILIATION");
    return { bookingId: booking.id, eventType: event.eventType,
      status: "REVIEW", reasons: ["CANCELLED_NEEDS_CLEANING_RECONCILIATION"], audit };
  }
  const guests = (booking.adults ?? 0) + (booking.children ?? 0);
  const reasons: string[] = [];
  if (!isoDate(booking.arrival) || !isoDate(booking.departure) ||
    String(booking.departure) <= String(booking.arrival)) reasons.push("DATES_UNVERIFIED");
  if (guests < 1 || guests > policy.maximumGuests) reasons.push("GUEST_COUNT_REVIEW");
  if (!/^https:\/\/[^\s]+$/.test(policy.rosterUrl)) reasons.push("ROSTER_URL_UNVERIFIED");
  if (reasons.length) {
    record("REVIEW:" + reasons.join(","));
    return { bookingId: booking.id, eventType: event.eventType,
      status: "REVIEW", reasons, audit };
  }

  const messageDraft =
    "ご予約ありがとうございます。チェックイン前に宿泊者名簿をご提出ください。\n" +
    policy.rosterUrl + "\n提出状況と本人確認が完了した後、入室情報をご案内します。";
  record("MESSAGE_DRAFT_CREATED_NOT_SENT");
  record("CLEANING_TASK_DRAFT_CREATED_NOT_SCHEDULED");
  record("PRICE_RECALCULATION_REQUESTED_NO_PRICE_WRITE");
  return {
    bookingId: booking.id, eventType: event.eventType, status: "DRAFT", reasons: [],
    messageDraft,
    cleaning: { date: booking.departure!, title: "葛西清掃｜予約 " + booking.id,
      action: "UPSERT" },
    pricing: { action: "RECALCULATE_ONLY", minPriceGuardRequired: true },
    audit,
  };
}

// Event type and booking ID alone are NOT unique enough for persistent deduplication.
// Callers must use the verified provider event ID or a source-specific version.
export function eventFingerprint(event: PmsWebhookEvent): string {
  void event;
  throw new Error("PMS_EVENT_ID_REQUIRED_FOR_DEDUPLICATION");
}
