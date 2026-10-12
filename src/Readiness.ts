import { CONFIG } from "./Config";
import { PROPERTY_KEYS, loadSettings } from "./Settings";

// Read-only diagnostic: never return property values, URLs, IDs, or credentials.
export function inspectProductionSettings(
  read: (key: string) => string | null | undefined,
) {
  const values: Record<string, string> = {};
  try {
    for (const key of PROPERTY_KEYS) values[key] = read(key)?.trim() ?? "";
  } catch {
    return {
      configurationValid: false,
      issue: "PROPERTY_READ_FAILED",
      liveAcceptanceVerified: false,
    };
  }
  const optional =
    values.WEBHOOK_VERIFICATION_MODE === "API_RECHECK"
      ? ["SQUARE_WEBHOOK_SIGNATURE_KEY"]
      : [];
  const missingKeys = PROPERTY_KEYS.filter(
    (key) => !optional.includes(key) && !values[key],
  );
  let configurationValid = false;
  const previous = { ...CONFIG };
  try {
    loadSettings((key) => values[key]);
    configurationValid = true;
  } catch {
    // Validation errors may contain future sensitive data: expose no raw error.
  } finally {
    Object.assign(CONFIG, previous);
  }
  const verificationMode = ["REQUIRE_SIGNATURE", "API_RECHECK"].includes(
    values.WEBHOOK_VERIFICATION_MODE,
  )
    ? values.WEBHOOK_VERIFICATION_MODE
    : "UNCONFIRMED";
  return {
    configurationValid,
    missingKeys,
    issue: configurationValid ? null : "SETTINGS_INVALID",
    verificationMode,
    automationEnabled: values.AUTOMATION_ENABLED === "true",
    buyerEmailEnabled: values.BUYER_EMAIL_ENABLED === "true",
    directWebhookBlocked: verificationMode !== "API_RECHECK",
    standardSignatureVerified: false,
    liveAcceptanceVerified: false,
    salesOrDeliveryVerified: false,
  };
}
