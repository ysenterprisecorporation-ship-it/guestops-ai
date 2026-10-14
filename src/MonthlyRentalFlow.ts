export type MonthlyRentalState =
  | "DRAFT"
  | "READY_FOR_GMO_SIGN"
  | "SENT_FOR_SIGNATURE"
  | "SIGNED";

export interface MonthlyRentalCase {
  caseId: string;
  propertyName: string;
  tenantName: string;
  tenantEmail: string;
  startDate: string;
  endDate: string;
  rentYen: number;
  cleaningFeeYen: number;
  depositYen: number;
  templateId: string;
  identityChecked: boolean;
  termsReviewed: boolean;
  state: MonthlyRentalState;
  gmoEnvelopeId?: string;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

export function prepareMonthlyRentalForGmoSign(input: Omit<MonthlyRentalCase, "state">) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.caseId)) throw new Error("CASE_ID_INVALID");
  if (!input.propertyName.trim() || !input.tenantName.trim()) throw new Error("PARTY_INVALID");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.tenantEmail)) throw new Error("EMAIL_INVALID");
  if (!validDate(input.startDate) || !validDate(input.endDate)) throw new Error("DATE_INVALID");
  if (Date.parse(input.endDate) <= Date.parse(input.startDate)) throw new Error("PERIOD_INVALID");
  for (const amount of [input.rentYen, input.cleaningFeeYen, input.depositYen]) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("AMOUNT_INVALID");
  }
  if (!input.templateId.trim()) throw new Error("GMO_TEMPLATE_REQUIRED");
  if (!input.identityChecked) throw new Error("IDENTITY_CHECK_REQUIRED");
  if (!input.termsReviewed) throw new Error("TERMS_REVIEW_REQUIRED");
  return { ...input, state: "READY_FOR_GMO_SIGN" as const };
}

export function markMonthlyRentalSent(
  rental: MonthlyRentalCase,
  gmoEnvelopeId: string,
): MonthlyRentalCase {
  if (rental.state !== "READY_FOR_GMO_SIGN") throw new Error("RENTAL_STATE_INVALID");
  if (!/^[A-Za-z0-9_-]{4,192}$/.test(gmoEnvelopeId)) throw new Error("GMO_ENVELOPE_INVALID");
  return { ...rental, gmoEnvelopeId, state: "SENT_FOR_SIGNATURE" };
}

export function markMonthlyRentalSigned(rental: MonthlyRentalCase): MonthlyRentalCase {
  if (rental.state !== "SENT_FOR_SIGNATURE" || !rental.gmoEnvelopeId)
    throw new Error("RENTAL_STATE_INVALID");
  return { ...rental, state: "SIGNED" };
}
