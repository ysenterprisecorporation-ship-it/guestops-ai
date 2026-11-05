# GuestOps AI / Beds24 verification record (2026-11-06 JST)

## Result
**Source and automated regression tests: PASS. Production end-to-end operation: NOT COMPLETE.**

### 1. Browser/CSV/public
- Public partner demo live-read verified: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/beds24-partner-demo/
- Public independent CSV checker live-read verified: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/guestops-independent/
- Public Starter sales page live-read verified: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/starter/order/
- Starter Square checkout URL live-read, product GuestOps Starter Kit, total JPY 9,800: https://square.link/u/nwGxRxvm
- CI successful: https://github.com/ysenterprisecorporation-ship-it/guestops-ai/actions/runs/42055645071
- Validated via CI: 4 decision demo cases, malformed JSON, CSV parsing, invalid quoting, duplicate exclusion, CSV output, read-only Beds24 GET mock, canonical origin, invalid-token/id rejection, PII redaction, webhook idempotency, cancellation/cleaning conflict. This is deterministic simulated-DOM smoke testing, not actual browser automation, remote API or live purchase execution.
- Github Pages successful run: https://github.com/ysenterprisecorporation-ship-it/guestops-ai/actions/runs/42055644965

### 2. Starter checkout and fulfillment
- Checkout page is reachable, correct product and total confirmed.
- Payment completion, order retrieval, buyer entitlement, private Drive permission grant, buyer email delivery and receipt confirmation NOT performed.
- Existing Starter fulfillment code includes tests for buyer-only grant and safe pause, but existing README identifies production integration as not deployed/connected and original order taxonomy as A/P3/P10 rather than current Starter.
- Drive assets verified: buyer material spreadsheet and limited-share guide exist. There is no evidence their sharing configuration grants an arbitrary new buyer access.
- Do NOT publicly share protected material or declare automatic delivery completed based on CI alone.
- There is a separate buyer-only grant mechanism requiring real order verification; preserve its least-privilege and send gates. Do not automatically enable.

### 3. Beds24 partner application
- Inquiry sent to ticket@beds24.com from authorized Beds24-account-associated mailbox; Gmail sent ID 1a1ac4f5d87a1eb5.
- Official program form acceptance, agreement, partnership approval, account conversion, organization token: NOT VERIFIED.
- Official instructions: https://wiki.beds24.com/index.php?title=Marketplace_for_Integration_Partners
- Official API read-only token: https://wiki.beds24.com/index.php/Category:API_V2
- Beds24 account registration observed in account-related Gmail; no valid scoped API token obtained.

### 4. API V2 / webhook / cleaning
- Code: integrations/beds24-readonly/index.mjs / tests/beds24-readonly.test.mjs
- Code only performs GET /bookings to Beds24 API V2 under owner-supplied read-only token and fake-fetch test; no real GET call was performed.
- Webhook function is a pure decision engine with in-memory dedup. Not a deployed HTTP receiver, persistent idempotency store, calendar creator or Beds24 live event subscriber.
- Google Calendar inspection found the primary calendar, Airbnb housing calendar, and a read-only monthly rental import. No independently named cleaning calendar was listed in this account; confirm intended destination before any writes.
- No booking or calendar events were modified.
- Google official GAS doPost event does not expose arbitrary HTTP request headers. An HTTPS receiver and verification strategy must be selected before live webhook acceptance. Beds24 supports custom header configuration, but a verified secure end-to-end receiver is not yet deployed.

## Mandatory remaining acceptance steps
1. Obtain dedicated read-only Beds24 token from SETTINGS > MARKETPLACE > API and store securely (never in chat/GitHub/web page); enable API menu via Beds24 support if unavailable.
2. Choose the authoritative cleaning calendar and establish access; protect independent Airbnb/montly calendars from mutation.
3. Verify one genuine Square Sandbox purchase in an isolated environment and private buyer-only material grant; verify receipt without double send; only then enable production.
4. Activate production-safe webhook receiver, authentication, persistent idempotency, delivery retries, and one actual booking event with no external writes; confirm authorized cleaning workflow only after calendar concurrency safety checks.
5. Beds24 team approves official application / tokens / Marketplace entry, external decision.

This file is an evidence/state record, not an assertion of production readiness.
