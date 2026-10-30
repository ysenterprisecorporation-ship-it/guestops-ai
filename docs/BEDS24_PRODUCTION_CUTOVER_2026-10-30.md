# GuestOps AI / Beds24 V2 — production cutover decision record (2026-10-30 JST)

## Fixed goal
Use Beds24 API v2 with the real Kasai operation to validate GuestOps AI for sale to Beds24 operators; adapt to AirHost afterwards. Owner explicitly authorized production OTA switch **only if** existing bookings, blocked dates and monthly periods reconcile, and legacy GAS/iCal competing sync is disconnected.

## Verified / not verified
- Verified previously by operator: invite-code exchange and GET /bookings read-only succeeded; property ID `364051` set in dedicated GAS script properties. This does **not** verify mapping to each OTA listing.
- Google Calendar linked account `edogawa.stay.info@gmail.com` has calendars `airbnb葛西マンスリー` (read-only imported) and `Airbnb宿泊（実予約のみ）` (owner), plus the primary calendar.
- Imported monthly calendar showed an `Airbnb (Not available)` 2027-02-01 to 2027-10-14. This is **not** proof of a booked stay or a legally valid monthly lease, and Jan 1-31 is **not covered** by that event.
- Operator observed zero triggers in the legacy GAS project under this account. Zero visible triggers is **not** evidence that no other-account triggers or Airbnb-side iCal imports exist.
- Booking.com / Airbnb stay / Airbnb monthly: real channel mapping and OTA-side imported/exported calendar configuration **not yet independently verified**.
- Sharing a calendar URL in a bidirectional feed risks circular blocks. Beds24 must be the **only writer of OTA inventory and rates** after cutover. GAS and Google Calendar must be **read-only with respect to OTA inventory**.

## Mandatory no-write transition gate
Use `src/pms/ProductionCutoverGate.ts`. All nine checks must be independently evidenced. The owner authorization is already conditional; do not interpret it as permission to set evidence booleans true.
1. Booking.com mapped to correct Beds24 room and rate plans.
2. Airbnb stay mapped to same physical stock.
3. Airbnb monthly mapped and rules for *same stock* explicitly reconciled; no parallel sale.
4. Existing confirmed, cancelled and modified reservations reconciled across source systems.
5. Manual blocks, availability settings, minimum stays and 180-day constraints reconciled.
6. Jan 1–Mar 31 2027 rental period protected from transient lodging OTA sales until monthly legal strategy is confirmed.
7. Legacy GAS outbound calendar/OTA modifications and **all owning accounts' triggers** disabled.
8. Historical iCal imports and reverse-feed loops removed or proven disconnected, without deleting evidence.
9. Owner's conditional authorization recorded.
If any check is missing, cutover remains `ready:false`. Never disable existing confirmed reservations to make tests pass.

## Execution order
1. **Read only:** export inventory and reservations from three OTA listings and Beds24 (source IDs, listing IDs, room IDs, rate IDs, stay local dates [checkin, checkout), state, and timestamp). Do not include guest PII in diagnostics.
2. **Read only:** record every iCal import and export endpoint and whether it targets an Airbnb listing, Booking.com or GAS, plus availability window settings.
3. **Reconcile:** run `reconcileIntervals` and `seasonProtected`; do not label imported `Not available` records as confirmed bookings. Compare booking IDs and lifecycle states as separate evidence; date equality alone is insufficient.
4. **Prepare switch:** snapshot live OTA states, ensure ability to restore existing rates/availability, and preflight API tokens and access.
5. **Owner-approved change window:** remove *only redundant* iCal paths after proving the Beds24 channel API will replace them. Map OTA room/rate/listing IDs. Verify preexisting bookings were imported before allowing inventory writes.
6. **Post-switch check:** compare actual OTA saleable dates, booking changes, cancels, stay restrictions, and floor prices with Beds24 readback. Roll back/stop on any unexplained discrepancy.
7. **GuestOps AI validation:** readonly webhook event ingestion -> deduplication -> cleaning calendar export (one way only) -> guest-message draft with manual send gate -> audit log. No automatic guest contact or pricing changes without distinct explicit permissions and tests.
8. **Distribution:** Beds24 operator onboarding and permission-scoped product documentation. AirHost port is separate and must not block Beds24 cutover testing.

## Human-only decisions
- Any required OTA account authentication/authorization that cannot be completed through connected tools.
- Any production inventory write or irreversible channel reassignment **outside** the already-granted conditional constraints.
- Selection of the legal monthly letting arrangement, where it would change contract rights.

## Status at writing
Coding and CI do not imply production operation. OTA-side access and source-system reconciliation evidence are missing; production OTA cutover is **not complete** and must remain blocked.
