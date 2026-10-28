# Group Trip OS x GuestOps AI — booking event pipeline v1

## Implemented
- Pure `planGuestOpsEvent`: PMS normalizer -> booking read -> property/date/guest-count gates -> guest message draft -> cleaning task draft -> price-recalculation signal -> privacy-safe audit actions.
- `guestOpsDryRunWebhook(rawJson)` requires `GTOS_DRY_RUN_ENABLED=true` in GAS Script Properties. It returns metadata only, not the guest's identity.
- Tests cover capacity, cancellation, wrong property, missing dates, zero PMS writes.
- Current Square `doPost` and sales runtime **unchanged**.

## Not live
- Webhook receiver authentication, retry/dedup storage, real email sends, Calendar event writes, verified pricing engine API writes, ID-document processing, OTA live confirmation.
- Use actual provider payload fixtures and authenticated endpoint verification prior to enabling external writes. Never accept a public webhook into the Square endpoint.
- Beds24Adapter's own request payloads require real-account non-production verification before enabling writes; a green mocked CI does not verify the external PMS API contract.

## Secrets and personal information
- No ID images, passport data, facial footage, guest names, phone numbers, emails or raw OTA payloads in public repository, CI logs or GuestOps audits.
- Keep identity files private, with access controls and retention policy; verification is not automatic approval.
- Guest-facing info/door code is released only after required human verification and paid/confirmed booking checks.

## Rollout gates
1. Provider webhook authenticates independently of Square.
2. Exact booking ID + property ID verified by PMS API.
3. Persistent event idempotency, retries, failure queue and bounded logs.
4. Read-only GTOS dry run passes with redacted fixtures.
5. Human approves outbound messages and cleaning schedule in staging.
6. Pricing engine verifies discounts and floor; no automatic price updates before this.
