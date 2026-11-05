# GuestOps AI — 24-hour partner-demo & independent-sales execution brief
Date: 2026-11-05 JST. Status: draft/implementation, not partner-approved or launched.

## Executive decision
Build **one read-only reservation exception engine**, then distribute as (A) Beds24 partner demonstration (PMS connection shown only where verified) and (B) stand-alone browser-based CSV diagnostic + paid asynchronous audit. Do not rebuild another PMS/AI inbox. Do not request customer Gmail/GAS setup.

### Official due diligence
- Beds24 Marketplace is a discretionary admission process: https://wiki.beds24.com/wikitest/index.php/Marketplace_for_Integration_Partners ; formal application https://www.beds24.com/reseller.html ; organization token requires support form and partner authorization.
- Beds24 API V2 GET /bookings, /bookings/messages, /inventory/calendar, booking webhooks and scoped tokens: https://wiki.beds24.com/index.php/API_V2.0 ; no API sandbox per FAQ.
- Booking.com currently pauses integrations with new Connectivity Providers: https://connect.booking.com/?lang=en ; do NOT pursue direct new Booking.com connectivity in the 24-hour sprint.
- AirHost public API is described as internal-use oriented, external cloud SaaS official integrations are not authorized; Premium / fees are hurdles: https://support.airhost.co/ja/articles/8997219-airhost-api-api-%E5%88%A9%E7%94%A8%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6 ; exclude from immediate universal SaaS sales commitments. Website and support articles differ in pricing/eligibility, obtain a written current quote.
- Market alternatives confirmed: StayReply ¥1,500/facility/month (https://stayreply.jp/), Staidea Beds24 full package ¥9,800/property/month (https://staidea.com/pricing), AssistBnB AI messaging ¥8,000/property/month (https://assistbnb.lilfires.com/?tab=message), Besty AI listing (https://beds24.com/marketplace.html?marketplaceId=1065&partner=Besty+AI). Compete on exception detection and judgment traceability, not commodity AI replies.

## Existing production candidate
- Browser-only demo: docs/guestops-audit-demo/index.html. Uses sample/fake data or anonymous five-column CSV; no API connection or actual booking writes. The 2026-11-05 patch adds explicit warning when PMS or OTA input is missing.
- Partner pack: docs/BEDS24_PARTNER_APPLICATION_PACK_2026-11-04.md
- Core algorithms: src/pms/VerifiedBookingNightProtection.ts, ProductionCutoverPreflight.ts, BookingIdentityReconciler.ts.
- Bookings from operator screenshots are not fresh live statuses. Confidential real OTA identifiers must not be in public demo/test fixtures.
- Never claim the branch-hosted demo is publicly live without validating the GitHub Pages deployment.

## 24h sprint: deliverable → acceptance
0–2h: Confirm official application, scopes, fees, product eligibility + competitor gap → sourced partner brief with no fabricated approval probability.
2–5h: Audit existing code and demo against known risks: missing OTA/PMS, double-booking, canceled booking, same-day turnover, no source timestamps → deterministic test cases. Avoid feature creep.
5–9h: Make CSV demo usable without account: show sample, accept strict anonymized CSV, prevent network calls, export classified exceptions → tested locally with fake data.
9–12h: Create one-page product positioning: product name, three scenarios, limitations, clear 'sample data' badges, no false compliant/partner claims → reviewable partner URL or file.
12–15h: Two technical evidence cases: (1) Beds24 API V2 read-only connectivity that has already been demonstrated; (2) anonymized Booking.com audit case where a missing PMS record prevents unsafe go-live → logs/test evidence without credentials/PII.
15–18h: Complete Beds24 English enquiry pack (person, sole proprietor, differential value, honest development state, features requested, security, desired Marketplace access) → user can submit via official form.
18–21h: Independent paid offering: ¥9,800 Starter bundle (existing price) + ¥29,800 per facility async exception report (proposed, price unvalidated), clear sample/report scope and terms → checkout only after payment/delivery tested.
21–24h: Demo walkthrough, tests/CI and acceptance checklist; mark partner-approved=false, auto-send=false, auto-pricing=false, live OTA cutover=false. If any critical gate fails, release only the non-integrated audited offering.

## Partner demo script (3 minutes)
1. Explain: PMS/OTA remains authoritative; GuestOps AI is the exception and decision layer.
2. Click sample: demonstrate same-day turnover, overlapping dates, conflicting cancellation, missing PMS data.
3. Show high-severity issue with what operator should check; do not auto-publish an empty night.
4. Show read-only Beds24 API V2 proof / test report; clearly separate it from the in-browser sample CSV.
5. Show 3-step customer target flow: select PMS, authorize via Marketplace/official scopes, select properties. This onboarding UX is aspirational until built.
6. Show real differentiation vs AI reply providers and roadmap for operator decision history.

## Launch/no-launch criteria
- Demo: accessible with fictional data; private-data handling and source-completeness warning tested.
- Any commercial connected SaaS: written Beds24 permission/terms + valid customer authorization + secure multi-tenant backend, plus end-to-end functional tests. This is not yet true.
- Independent sale: payment and fulfillment tested, lawful product description, sample output, no unsupported ROI claim. Not yet verified.
- Revenue: no claim of November target certainty absent conversion and revenue ledger. Price and cost model are hypotheses.

## Human inputs (only if unavoidable)
- Submit Beds24 partner inquiry from actual business identity; user alone confirms legal applicant identity and final acceptance of terms.
- Customer payment checkout authorization only after test.
No Gmail account creation, GAS code paste, raw OTA booking identifier sharing or password collection.
