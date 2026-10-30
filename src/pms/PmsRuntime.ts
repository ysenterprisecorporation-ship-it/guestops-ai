import { createPmsAdapter } from "./PmsFactory";
import { PmsProvider } from "./PmsAdapter";

function readProperty(key: string): string {
  return PropertiesService.getScriptProperties().getProperty(key)?.trim() ?? "";
}

export function activePmsProvider(): PmsProvider {
  const raw = readProperty("PMS_PROVIDER") || "mock";
  if (!["beds24", "airhost", "lodgify", "mock"].includes(raw))
    throw new Error("PMS_PROVIDER_INVALID");
  return raw as PmsProvider;
}

export function pmsCapabilities() {
  return createPmsAdapter({
    provider: activePmsProvider(),
    beds24Token: readProperty("BEDS24_API_TOKEN"),
  }).capabilities();
}

export function pmsSmokeTestBooking(bookingId: string) {
  if (!bookingId.trim()) throw new Error("PMS_BOOKING_ID_REQUIRED");
  const adapter = createPmsAdapter({
    provider: activePmsProvider(),
    beds24Token: readProperty("BEDS24_API_TOKEN"),
  });
  return adapter.getBooking(bookingId.trim());
}
