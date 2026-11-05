export type BookingStatus = "CONFIRMED" | "CANCELLED" | "REVIEW";
export interface BookingNotice {
  bookingId: string;
  sourceMessageId: string;
  receivedAt: string;
  status: BookingStatus;
  departure?: string;
  propertyVerified: boolean;
}
export interface BookingRecord {
  bookingId: string;
  sourceMessageId: string;
  receivedAt: string;
  status: BookingStatus;
  departure?: string;
}
export interface BookingTransition {
  action: "CREATE_CLEANING_DRAFT" | "UPDATE_CLEANING_DRAFT" |
    "CANCEL_CLEANING_REVIEW" | "NO_CHANGE" | "MANUAL_REVIEW";
  next: BookingRecord;
  reason: string;
}
const validDate = (value: string | undefined): boolean => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(value + "T00:00:00Z");
  return !Number.isNaN(dt.valueOf()) && dt.toISOString().slice(0, 10) === value;
};
export function transitionBooking(previous: BookingRecord | undefined, notice: BookingNotice): BookingTransition {
  if (!/^\d{10}$/.test(notice.bookingId) || !notice.sourceMessageId ||
    !Number.isFinite(Date.parse(notice.receivedAt)))
    throw new Error("BOOKING_NOTICE_INVALID");
  if (previous && previous.bookingId !== notice.bookingId) throw new Error("BOOKING_ID_MISMATCH");
  if (previous && previous.sourceMessageId === notice.sourceMessageId)
    return { action: "NO_CHANGE", next: previous, reason: "DUPLICATE_MESSAGE" };
  if (previous && Date.parse(notice.receivedAt) <= Date.parse(previous.receivedAt))
    return { action: "NO_CHANGE", next: previous, reason: "STALE_NOTIFICATION" };
  if (!notice.propertyVerified || notice.status === "REVIEW")
    return { action: "MANUAL_REVIEW", next: previous ?? {
      bookingId: notice.bookingId, sourceMessageId: notice.sourceMessageId,
      receivedAt: notice.receivedAt, status: "REVIEW",
    }, reason: "RESERVATION_NOT_VERIFIED" };
  const next: BookingRecord = {
    bookingId: notice.bookingId, sourceMessageId: notice.sourceMessageId,
    receivedAt: notice.receivedAt, status: notice.status,
    departure: notice.departure ?? previous?.departure,
  };
  if (notice.status === "CANCELLED")
    return { action: "CANCEL_CLEANING_REVIEW", next, reason: "CANCELLATION_NEEDS_RECONCILIATION" };
  if (!validDate(next.departure))
    return { action: "MANUAL_REVIEW", next: previous ?? { ...next, status: "REVIEW" }, reason: "DEPARTURE_UNVERIFIED" };
  return { action: !previous || previous.status !== "CONFIRMED" ?
    "CREATE_CLEANING_DRAFT" : previous.departure !== next.departure ?
      "UPDATE_CLEANING_DRAFT" : "NO_CHANGE",
    next, reason: "VERIFIED_NOTICE" };
}
