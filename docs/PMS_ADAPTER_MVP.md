# GuestOps AI PMS Adapter MVP

## Purpose

GuestOps AI Core must not depend directly on Beds24, AirHost, or Lodgify.
All PMS-specific I/O goes through `PmsAdapter`.

## Current implementation

- Beds24: HTTP-based booking and message READ paths, plus webhook normalization. Write paths intentionally throw until API contract, token refresh, price floor, and integration are verified. No live Beds24 account test has been completed.
- AirHost: contract placeholder only. It fails closed until the required Premium/API contract and exact API surface are available.
- Lodgify: contract placeholder only. It fails closed until the current account/API contract and exact API surface are verified.
- Mock: local/test adapter.

## Runtime switch

GAS Script Properties:

- `PMS_PROVIDER`: `beds24`, `airhost`, `lodgify`, or `mock`
- `BEDS24_API_TOKEN`: required only when provider is `beds24`; Beds24 short-lived access tokens expire and refresh handling remains unimplemented.

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
PMS write operations are disabled, and the PMS pipeline is not wired into the existing `doPost` webhook. `guestOpsDryRunWebhook` is source-level and not exported in the current GAS build.
Use `pmsSmokeTestBooking` only after setting a verified provider/token.

## Next integration slice

1. Beds24 booking webhook -> `normalizeWebhook`
2. normalized booking id -> `getBooking`
3. GuestOps AI rule/AI layer
4. draft message -> approval gate
5. `sendMessage`
6. GTOS audit log
7. price-floor calculation (implemented and tested) -> guarded write adapter (not yet implemented).
