export interface InventoryAuthority {
  booking: "VERIFIED_API" | "UNVERIFIED";
  airbnb: "VERIFIED_API" | "UNVERIFIED";
  monthly: "EXPLICITLY_BLOCKED" | "ACTIVE_CONTRACT" | "UNKNOWN";
  oldCalendarBridge: "DISABLED" | "ENABLED" | "UNKNOWN";
}
export interface InventoryGateResult {
  allowInventoryWrite: false;
  allowNewDirectBooking: boolean;
  blockers: string[];
}
// Pure safety gate: never authorizes a PMS/OTA write; it only validates
// whether the operator can proceed to a separately controlled direct-booking flow.
export function assessInventoryAuthority(input: InventoryAuthority): InventoryGateResult {
  const blockers: string[] = [];
  if (input.oldCalendarBridge !== "DISABLED") blockers.push("LEGACY_CALENDAR_BRIDGE_NOT_VERIFIED_DISABLED");
  if (input.booking !== "VERIFIED_API") blockers.push("BOOKING_API_SYNC_UNVERIFIED");
  if (input.airbnb !== "VERIFIED_API") blockers.push("AIRBNB_API_SYNC_UNVERIFIED");
  if (input.monthly === "UNKNOWN") blockers.push("MONTHLY_INVENTORY_STATUS_UNKNOWN");
  if (input.monthly === "ACTIVE_CONTRACT") blockers.push("MONTHLY_EXCLUSIVE_OCCUPANCY");
  return {allowInventoryWrite:false,allowNewDirectBooking:blockers.length===0,blockers};
}
