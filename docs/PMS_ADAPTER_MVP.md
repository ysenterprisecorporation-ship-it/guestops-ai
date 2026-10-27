# GuestOps AI PMS Adapter MVP

## Purpose

GuestOps AI Core must not depend directly on Beds24, AirHost, or Lodgify.
All PMS-specific I/O goes through `PmsAdapter`.

## Current implementation

- Beds24: live HTTP adapter implemented for booking read, OTA message read/write, inventory calendar price updates, webhook normalization.
- AirHost: contract placeholder only. It fails closed until the required Premium/API contract and exact API surface are available.
- Lodgify: contract placeholder only. It fails closed until the current account/API contract and exact API surface are verified.
- Mock: local/test adapter.

## Runtime switch

GAS Script Properties:

- `PMS_PROVIDER`: `beds24`, `airhost`, `lodgify`, or `mock`
- `BEDS24_API_TOKEN`: required only when provider is `beds24`

Secrets must never be committed.

## Contract

GuestOps AI Core calls only:

- `getBooking(id)`
- `getMessages(bookingId)`
- `sendMessage(bookingId, body)`
- `updateDailyPrices(updates)`
- `normalizeWebhook(payload)`
- `capabilities()`

This is the anti-lock-in boundary.

## Safety

The existing Square/GAS production Runtime is unchanged.
PMS write operations are not wired into the existing `doPost` webhook.
Use `pmsSmokeTestBooking` only after setting a verified provider/token.

## Next integration slice

1. Beds24 booking webhook -> `normalizeWebhook`
2. normalized booking id -> `getBooking`
3. GuestOps AI rule/AI layer
4. draft message -> approval gate
5. `sendMessage`
6. GTOS audit log
7. price engine -> `updateDailyPrices` with hard-floor guard
