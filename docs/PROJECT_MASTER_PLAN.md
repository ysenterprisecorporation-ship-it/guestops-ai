# Group Trip OS — 2026-10-10 Rebuild Plan

## Objective
Rebuild Tokyo Designer House operations so that:
- Sales activity starts before the PMS migration is complete.
- Reservation/inventory master exists in exactly one PMS.
- GTOS automation never writes inventory back to OTAs.
- No routine manual reservation transcription is required.
- Human work is capped at 30 minutes/day.
- January–March monthly rental workflow is tested by 2026-10-25.
- Never commit API keys, guest PII, reservation exports, passwords, webhook secrets, or contract data to this repository.

## Current decisions
1. PMS selection gate:
   - First technical candidate: Lodgify, only if webhook/public API can be used without a separate high-cost API contract.
   - Fallback: AirHost ONE using reservation-notification-email -> Gmail -> Apps Script parser.
2. GAS is used only for GTOS operational automation, not OTA calendar synchronization.
3. Updated user decision (2026-10-12): SNS -> existing Square.
   - SNS traffic must use the adopted existing Square direct-sales entry point.
   - Do not substitute an OTA or PMS campaign destination without a new user decision.
   - Accommodation checkout requires confirmed dates, occupancy, inventory and booking terms before charging; the existing accommodation Square entry point is not yet identified in this workspace.
   - Existing OTA reservations remain on their original channel. This update does not move existing bookings or duplicate inventory.
4. Payment: 100% prepayment for direct bookings where supported.
5. Monthly rental Jan–Mar: fixed-term building lease workflow + GMO Sign free plan, with only the signature request kept manual.

## Non-negotiable acceptance criteria
### PMS / booking
- Existing bookings are preserved.
- Airbnb and Booking.com inventory is not dual-written by GAS.
- Test reservation, change and cancellation are reflected correctly.

### GTOS automation
- New reservation reaches RAW_EVENTS or RAW_EMAILS automatically.
- Same reservation ID is idempotently upserted.
- Parser/router failure is logged and alertable.
- Human transcription = 0 in the normal path.

### Direct booking
- Mobile user reaches availability/booking in <= 2 intentional actions from a high-intent campaign link.
- SNS campaign links use the adopted existing Square entry point; no unapproved bypass.
- UTM parameters are retained where technically possible.

### Monthly rental
- Electronic delivery consent process defined.
- Fixed-term lease pre-explanation document flow defined separately from the lease.
- GMO Sign free-plan send/receive test completed.
- Landlord/sublease permission prerequisites explicitly checked before launch.

## Delivery order
1. Revenue now: optimize current Airbnb/Booking listings and campaign links.
2. PMS technical gate.
3. Direct booking / payment.
4. GTOS automation.
5. Google vacation-rental channel.
6. Monthly rental / GMO Sign.
7. Hardening and daily-30-minute operations.

## Human-only actions
Only actions requiring account ownership, legal consent, payment authorization, external-service sign-in, or production publish confirmation should be returned to the human.

Everything else should be prepared by ChatGPT/Codex as code, configuration values, checklists, validation scripts, copy, or test plans.
