import assert from "node:assert/strict";
import test from "node:test";
import { MockPmsAdapter } from "../src/pms/MockPmsAdapter";
import { planGuestOpsEvent, eventFingerprint } from "../src/pms/GuestOpsPipeline";
import { PmsBooking } from "../src/pms/PmsAdapter";

const policy = { rosterUrl: "https://forms.cloud.microsoft/r/EMdPJZbqRd",
  maximumGuests: 9, expectedPropertyId: "KASAI" };
const sample: PmsBooking = { id: "1234567890", propertyId: "KASAI",
  arrival: "2026-12-01", departure: "2026-12-03", adults: 6, children: 2,
  status: "confirmed" };
function run(booking: PmsBooking, event: unknown = { bookingId: "1234567890" }) {
  return planGuestOpsEvent(new MockPmsAdapter([booking]), event, policy,
    "2026-10-28T10:00:00Z");
}

test("creates drafts without sending or modifying prices", () => {
  const adapter = new MockPmsAdapter([sample]);
  const plan = planGuestOpsEvent(adapter, { bookingId: sample.id }, policy,
    "2026-10-28T10:00:00Z");
  assert.equal(plan.status, "DRAFT");
  assert.equal(plan.cleaning?.date, "2026-12-03");
  assert.match(plan.messageDraft ?? "", /宿泊者名簿/);
  assert.equal(adapter.sent.length, 0);
  assert.equal(adapter.priceUpdates.length, 0);
  assert.equal(plan.pricing?.minPriceGuardRequired, true);
});

test("blocks wrong property and over-capacity reservations", () => {
  assert.deepEqual(run({ ...sample, propertyId: "OTHER" }).reasons, ["PROPERTY_MISMATCH"]);
  assert.deepEqual(run({ ...sample, adults: 10 }).reasons, ["GUEST_COUNT_REVIEW"]);
});

test("does not auto-process cancellations or missing dates", () => {
  assert.equal(run({ ...sample, status: "cancelled" }).status, "REVIEW");
  assert.deepEqual(run({ ...sample, departure: undefined }).reasons,
    ["DATES_UNVERIFIED"]);
  assert.equal(run(sample, {}).status, "IGNORED");
});

test("stable fingerprint independent of guest PII", () => {
  assert.equal(eventFingerprint({provider:"beds24",eventType:"booking.updated",
    bookingId:"B1",raw:{name:"sensitive"}}), "beds24:booking.updated:B1");
});
