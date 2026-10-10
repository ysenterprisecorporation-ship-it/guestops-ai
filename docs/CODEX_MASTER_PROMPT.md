# CODEX MASTER PROMPT — Group Trip OS

You are the implementation agent for the Group Trip OS project in this repository.

## Goal
Minimize human work and get a production-capable booking/GTOS automation stack live as fast as possible, without waiting for the entire migration before sales activity starts.

## Safety / data rules
- This repository is public. NEVER commit secrets, API keys, guest PII, reservation payloads containing real personal data, passwords, access tokens, webhook secrets, or signed contracts.
- Use placeholders and sanitized fixtures only.
- Store secrets only in Apps Script Properties / service environment secrets.
- Do not create any system that writes OTA inventory through Google Calendar or GAS.
- PMS must remain the single inventory master.

## Workstreams

### A. Lodgify webhook spike — highest priority
Build and validate a minimal Apps Script-compatible webhook receiver.
Required behavior:
1. POST raw body to RAW_EVENTS with received_at, source, raw_json.
2. Return successful response.
3. Provide setup instructions for Apps Script Web App.
4. Provide a sanitized curl/local test payload.
5. Add an idempotency-ready helper but keep the first spike simple.
6. Document exactly what must be checked manually in Lodgify to determine whether Public API/Webhook access is available in the trial/current plan.

Deliverables:
- gas/lodgify_webhook.gs
- gas/README.md
- tests/lodgify_booking_fixture.json
- docs/LODGIFY_TEST.md

### B. AirHost fallback spike
Until an actual AirHost reservation notification email sample is supplied:
1. Build a Gmail poller that only captures candidate messages into RAW_EMAILS.
2. Save: received_at, gmail_message_id, subject, from, raw_plain_body.
3. Apply a processed label only after successful persistence.
4. Add error logging.
5. Do NOT invent a field parser for unknown AirHost email formats.
6. Provide one clearly isolated parseAirHostMail() TODO with fixture-driven tests to be completed once a sanitized real sample exists.

Deliverables:
- gas/airhost_mail_capture.gs
- docs/AIRHOST_EMAIL_TEST.md
- tests/airhost_email_fixture_PLACEHOLDER.txt

### C. GTOS router
Create a provider-agnostic normalized reservation event model:
- provider
- reservation_id
- status
- check_in
- check_out
- adults
- children
- total_amount
- currency
- updated_at
- raw_event_ref

Requirements:
- upsert by provider + reservation_id
- do not store unnecessary PII
- new/change/cancel must update the same record
- maintain an ERROR_LOG sheet path
- keep reservation ingestion separate from guest GTOS-form answers

Deliverables:
- gas/gtos_router.gs
- docs/GTOS_DATA_MODEL.md

### D. Direct-booking conversion layer
Create documentation/config only unless platform credentials are available.
Rules:
- High-intent links go directly to the PMS booking engine.
- Square is not mandatory in the booking path.
- If Lodgify widget can be embedded in the user's Square plan, document that optional path.
- Otherwise keep Square for trust/FAQ/legal content and use direct booking-engine URLs.
- Define UTM naming scheme and a 3-link campaign matrix: google, instagram, repeat_guest.

Deliverable:
- docs/DIRECT_BOOKING.md

### E. Operations / tests
Create an acceptance checklist for:
- new booking
- booking change
- cancellation
- duplicate webhook/email
- malformed event
- alert/error path
- mobile booking flow
- direct payment
- reservation ID join with GTOS form
- no GAS calendar write

Deliverable:
- docs/ACCEPTANCE_TESTS.md

## Definition of done
Do not report success because code exists. Report each item as:
- VERIFIED
- BLOCKED_EXTERNAL
- READY_FOR_HUMAN_1_MINUTE
- FAILED

For external blockers, return only the minimum human action required and the exact evidence needed (screenshot, status code, sanitized email sample, etc.).

## Priority
Complete A and B first. Then C. Then D/E.
Do not spend time polishing architecture before proving the ingestion path.
