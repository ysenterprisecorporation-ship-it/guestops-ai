# GuestOps AI — Beds24 Integration Partner application demo & independent product (2026-11-05 JST)
Status: technical demonstration published to main/docs; **not** connected to Beds24; partnership **not approved**; customer checkout/delivery **not validated**.

## Target outcomes (24-hour engineering sprint, not an approval SLA)
- Track A: customer-facing read-only demo; decision-risk case, screenshots, no real booking IDs; truthful application narrative; partner eligibility inquiry ready.
- Track B: PMS/API-independent GuestOps Audit standalone prospect/diagnostic demo; anonymized CSV; no Gmail or GAS; test usability and commercial landing/checkout separately.
- No license or marketplace badges in advance of Beds24 written approval.

## Official prerequisites (sources verified 2026-11-05)
- https://wiki.beds24.com/index.php?title=Marketplace_for_Integration_Partners : apply, discretionary acceptance, sign agreement, partner account, marketplace entry, org token; marketplace user enables authorized room types.
- https://wiki.beds24.com/index.php/API_V2.0 : booking reads / writes, messages, room calendar, booking webhooks; no standalone sandbox.
- https://www.beds24.com/reseller.html : Integration Partner distinct from Reseller/White-label.
- https://www.beds24.com/useragreement.html : authorization and restrictions; commercial third-party SaaS before Marketplace agreement must be confirmed with Beds24.
- https://beds24.com/en/marketplace : HostBuddy AI / Besty AI; avoid commodity AI-reply positioning.

## A. Application narrative (copy ready, honest)
Product: GuestOps AI — risk-aware operations decision support for Japan-based small vacation-rental operators.
Category: complementary integration to existing Beds24 PMS; **not** a channel manager or alternative PMS.
Core use cases:
1. Detect mismatched reservation/cancellation dates and unavailable PMS inventory.
2. Detect same-day turnovers, potential cleaning handoff failures and cross-source occupancy conflicts.
3. Document each unresolved exception, the source/date and operator action for operational learning.
Evidence:
- API V2 read-only access was validated in owner's test environment.
- Historic Booking.com screen evidence shows 10 active reservations spanning 21 occupied nights while earlier Beds24 read-only snapshot showed zero records; this is *not* proof of current live inventory and must not be represented as a production integration.
- Automated guard tests exist. The demo uses invented identifiers, no PII.
Limitations: no multi-tenant product, no Marketplace token, no production OTA messaging or rate writes; AI decision drafting and operating-memory feature are roadmap, not live product.
Request: early eligibility review for Japan sole proprietor; minimum demonstration acceptance, security documentation, fees/revenue share, contract, permitted paid invite-code integration before official approval, token access and scopes. Request separate onboarding-path advice.

## B. Demo acceptance
- Open /guestops-audit-demo/ in browser. Verify all input is synthetic or anonymized.
- Click example data. Show: 1) confirmed status, 2) cross-system PMS missing reservation, 3) same-day cleaning turnover, 4) overlapping occupancy, 5) output CSV.
- Upload anonymized CSV with exactly source,id,arrival,departure,status. No guest names, contacts, documents, payment fields.
- No data transmitted off client; no GAS, Gmail, external JS or dependencies.
- Reject invalid/negative dates and malformed file. Limit 1000 rows, 200KB.
- State that missing source export does not verify real inventory; never enable OTA writes.
- Verify keyboard/mobile usability and file download in a browser. CI alone does not test the web UI.

## C. 24-hour execution sequence (timebox)
0-2h: final legal/API/public-market review; choose Integration Partner not reseller; create truthful eligibility inquiry.
2-6h: produce and self-test local browser demo with synthetic property/booking scenarios and read-only data import; no live writes.
6-10h: website staging, responsive/accessibility smoke tests, download results, no network requests, edge-case input tests.
10-13h: record screenshot/click-through for 3 scenarios; prepare 2-page English application pitch / FAQ / architecture.
13-16h: publish standalone diagnostic demo, link only after Pages deployment confirmed; add source limitations and contact route.
16-20h: launch independent offer as separate product only after checkout/delivery and legal notices actually tested.
20-24h: signed acceptance matrix and one partner inquiry submitted with applicant authorization. External approval beyond developer control.

## D. Independent paid product without Beds24 partnership (PROPOSALS NOT LIVE)
1. Existing Starter Kit 9,800 JPY one-time: templates, checklists and guest-response decision SOP. Keep existing purchased product scope unchanged without user approval.
2. GuestOps Audit standalone one-time 29,800 JPY proposed: anonymized booking/cleaning CSV import, exception priority report, SOP suggestions, human review. Not yet a validated paid SKU.
3. Connected GuestOps AI monthly subscription remains a separate PMS-dependent future offering; no scope or price change without user approval.
Buyer: 1-9-property Japanese owner-operators and small managers with multiple OTA/PMS/iCal/manual cleaning workflows.
Competition: Staidea 9,800JPY/prop/mo full bundle (https://staidea.com/pricing), StayReply 1,500JPY/facility/mo AI response, 250JPY/mo cleaning add-on (https://stayreply.jp/help/cleaning-management), AirHost native messaging+cleaning (https://airhost.jp/products/vacation-rentals/pms). Do not compete on basic messaging alone.
Proof points: user-submitted anonymized CSV, deterministic cross-source exception rules; no claims about automated official OTA connections in independent product.
Value proposition: preempt costly operational contradictions and document exceptions, **not** guaranteed double-booking elimination without complete live data.

## E. Unresolved blockers and required human actions
- Technical: independent demo should pass a real browser smoke test and publication status check, not just GitHub file commit.
- Commercial: to sell, complete purchase/test-order/delivery/privacy policy and support route. The current new product price is a proposal.
- Partner: business owner submits inquiry, signs any agreement, authenticates Beds24 account, approves production scopes. No new Gmail/GAS.
- Production: real Beds24 OTA discrepancies and Airbnb/monthly availability must be reconciled; current screen snapshots are historical.
