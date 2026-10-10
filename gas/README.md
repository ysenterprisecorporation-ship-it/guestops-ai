# GAS deployment notes

## Required Script Properties
- SPREADSHEET_ID
- AIRHOST_GMAIL_QUERY (only for AirHost fallback)

Never commit actual values to this repository.

## Lodgify webhook receiver
1. Create/choose Google Sheet.
2. Add SPREADSHEET_ID in Apps Script Project Settings -> Script Properties.
3. Deploy as Web App.
4. Execute as: owner.
5. Access: endpoint must be reachable by Lodgify.
6. Use the /exec URL for the webhook target.
7. First test with sanitized local/curl payload before Lodgify.

Expected RAW_EVENTS columns:
- received_at
- source
- raw_json

## AirHost fallback
The email capture intentionally stores the raw plain-text notification first.
Do not implement production field parsing until an actual sanitized notification
email fixture is available.

Create a time-driven trigger for captureAirHostReservationEmails only after the
Gmail search query is narrowed enough to avoid unrelated mail.
