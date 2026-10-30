import { createPmsAdapter } from "./PmsFactory";
import { planGuestOpsEvent } from "./GuestOpsPipeline";
import { PmsProvider } from "./PmsAdapter";

export function guestOpsDryRunWebhook(rawJson: string) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("GTOS_DRY_RUN_ENABLED") !== "true")
    throw new Error("GTOS_DRY_RUN_DISABLED");
  if (rawJson.length > 100000) throw new Error("GTOS_PAYLOAD_TOO_LARGE");
  const provider = props.getProperty("PMS_PROVIDER") ?? "mock";
  if (!["beds24", "airhost", "lodgify", "mock"].includes(provider))
    throw new Error("PMS_PROVIDER_INVALID");
  let payload: unknown;
  try { payload = JSON.parse(rawJson); } catch { throw new Error("GTOS_INVALID_JSON"); }
  const adapter = createPmsAdapter({
    provider: provider as PmsProvider,
    beds24Token: props.getProperty("BEDS24_API_TOKEN") ?? "",
  });
  const result = planGuestOpsEvent(adapter, payload, {
    expectedPropertyId: props.getProperty("GTOS_PROPERTY_ID") ?? undefined,
    rosterUrl: props.getProperty("GTOS_ROSTER_URL") ??
      "https://forms.cloud.microsoft/r/EMdPJZbqRd",
    maximumGuests: 9,
  }, new Date().toISOString());
  // Never log guest name, ID documents, contact data or the raw webhook.
  return {
    provider, bookingId: result.bookingId,
    status: result.status, reasons: result.reasons,
    cleaningDate: result.cleaning?.date,
    auditActions: result.audit.map((event) => event.action),
  };
}
