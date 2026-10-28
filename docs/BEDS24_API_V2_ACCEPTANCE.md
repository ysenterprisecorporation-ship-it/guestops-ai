# GuestOps AI Beds24 API V2 acceptance

## Fixed boundaries
- Kasai OTA inventory is NOT to be migrated; old Google Calendar hub remains disabled.
- Beds24 V2 is only for a separate test property, independent of Kasai live reservations.
- Square doPost and existing production GAS stay unchanged.

## Account-owner action needed
1. Sign into separate Beds24 test account and generate invite code with the minimum bookings scope. Add bookings-personal only for message reads.
2. Exchange invite code via GET /authentication/setup for refresh token. Store token only in dedicated private test GAS Script Properties, never in this chat or GitHub.
3. Set GTOS_BEDS24_TEST_PROPERTY_ID to an isolated test property ID; enable GTOS_BEDS24_READ_ENABLED only in test GAS.

## Acceptance gates not yet met
- Dedicated, deployable test GAS bundle (current source is not exported by the Square build).
- Actual Beds24 test account connection and property ID.
- Webhook authentication, durable deduplication and retry storage.
- Verified message and price contract in isolated test property; writes remain disabled.
- Real end-to-end proof through read-back and redacted audit.

References: https://wiki.beds24.com/index.php/Category:API_V2