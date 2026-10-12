import { getRecord, type SquareReader } from "./OrderService";
import { BusinessError, type Payment } from "./Types";

export function validateReconciliationWindow(begin: string, end: string) {
  const a = Date.parse(begin),
    b = Date.parse(end);
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (
    !iso.test(begin) ||
    !iso.test(end) ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b <= a ||
    b - a > 86400000 ||
    b > Date.now()
  )
    throw new BusinessError("RECONCILIATION_WINDOW_INVALID");
}

// API results are hints only: re-fetch and use the existing exact product validator.
// Enqueue only; do not record revenue, send email, or mark delivery complete.
export function reconcilePaymentPage(
  page: Payment[],
  api: SquareReader,
  location: string,
  enqueue: (id: string) => boolean,
) {
  if (page.length > 100)
    throw new BusinessError("RECONCILIATION_PAGE_TOO_LARGE");
  let queued = 0,
    duplicates = 0,
    skipped = 0,
    review = 0;
  const seen = new Set<string>();
  for (const hint of page) {
    if (
      !hint ||
      typeof hint.id !== "string" ||
      !hint.id ||
      seen.has(hint.id) ||
      hint.status !== "COMPLETED" ||
      hint.location_id !== location
    ) {
      skipped++;
      continue;
    }
    seen.add(hint.id);
    try {
      getRecord(api, hint.id, location);
    } catch (error) {
      if (!(error instanceof BusinessError)) throw error;
      if (error.message === "PRODUCT_UNKNOWN") skipped++;
      else review++;
      continue;
    }
    if (enqueue(hint.id)) queued++;
    else duplicates++;
  }
  return {
    queued,
    duplicates,
    skipped,
    review,
    customerRevenueVerified: false,
  };
}
