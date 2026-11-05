# GuestOps AI — Beds24 Integration Partner application and independent launch package
Version: 2026-11-05 (JST). Status: APPLICATION DRAFT / interactive demo source committed. No partner approval or live integration is claimed.

## 1. Application profile (English — ready for review)
Product name: GuestOps AI — Operations Decision & Exception Handling Layer
Product category: Complementary guest operations / workflow / AI-assisted decision-support software.
Website: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/
Interactive demonstration (simulated events, no live connection): https://ysenterprisecorporation-ship-it.github.io/guestops-ai/beds24-partner-demo/
Target customers: Independent vacation rental owners, small property managers, short-term rental operators, and Japanese-language hospitality teams.

### Application message
We are developing GuestOps AI, a complementary operations decision and exception-handling layer designed to work alongside Beds24 rather than replace its PMS, channel manager, or booking engine.

Our product focuses on operational exceptions that still require a human operator's attention: incomplete pre-arrival procedures, cleaning/turnover conflicts, guest-response triage, low-rating review responses, and explainable decision records. The product is designed for Japanese-language vacation rental operations and small multi-property management teams.

We have built an interactive proof-of-concept using fictional reservations that demonstrates four exception workflows, approval gates, and an audit trail. The demonstration is explicitly simulation-only; production Beds24 API communication and live customer deployments have not been verified yet.

Our proposed technical design uses Beds24 API V2 read-only booking/property access for initial pilots, event-driven updates via booking webhooks where enabled, least-privilege scopes, token storage exclusively on the server, bounded retries and idempotency controls. No outbound guest messages, booking mutations or pricing writes are allowed without explicit account authorization and appropriate safeguards.

We would like to apply for the Beds24 Marketplace Integration Partner program and learn the requirements for organization tokens, integration review, security assessment, and listing eligibility. We can share the demonstration, documented architecture, and test evidence as they become available.

We believe this increases the value of Beds24 to operators by reducing manual exception-handling while retaining Beds24 as their source of truth for bookings and inventory.

### Application integrity: DO NOT CLAIM
- Official Beds24 partner status, endorsement, listed Marketplace integration, issued organization tokens.
- Production API integration, successful API write, OTA live connectivity, paid users, achieved savings, measured conversion.
- AI fully autonomous actions: this prototype uses deterministic business rules; free-form AI/NLP is not implemented in it.

## 2. Evidence pack for partner review
E1. Interactive demo: docs/beds24-partner-demo/index.html — GitHub commit e7c7f3c021aec336830161c5c486183e1a110007
E2. Four fictional test scenarios: same demo, switchable from buttons.
E3. Safety: client-only; no tokens, PII, requests, external writes.
E4. Architecture: input adapter -> normalized booking event -> rules + explanatory reason -> human approval -> audit; no external action in demo.
E5. Real Beds24 API integration remains unverified; requires customer authorization and test property with production-safe access.
E6. Official application entry: https://www.beds24.com/reseller.html
E7. Official API V2 documentation: https://wiki.beds24.com/index.php/API_V2.0

## 3. Approval sequence / acceptance gates
G1 Demo: reproducible 4-case simulation, zero external writes. Built; browser E2E verification pending.
G2 API V2 read-only pilot: invite code issued by owner; exchange for refresh token on server, retrieve an authorized test booking. NOT DONE.
G3 Webhook: authorized configuration + event receipt, signature/authentication evaluation and retries. NOT DONE.
G4 Booking conflict handling: demonstrate changed/cancelled booking and idempotent processing on a safe test dataset. NOT DONE.
G5 Security: scopes, encrypted token storage, delete policy, audit retention, incident handling. Design only.
G6 Apply: integration partner form and support ticket to request organization-token application. NOT SUBMITTED.
G7 Approval: Beds24 decision. NOT OBTAINED.

## 4. Independent product — no partner approval required
Product: GuestOps AI — Guest Operations Decision Kit (manual / email / CSV intake).
Problem: short-stay operators lack consistent triage of exceptional reservations, cleaning conflicts, guest complaints, and review replies.
Scope for v1: normalize manually entered data or CSV rows; flag four types of operational issues; propose actions and reply drafts; human confirmation; retain evidence and status. No direct OTA/Beds24 platform access is represented.
Delivery: existing Starter Kit acquisition + independent monthly managed workflow; first manual/CSV pilot before any live PMS integration.
Positioning: sell exception handling and operational memory; do NOT sell generic scheduled messages or a replacement PMS.
Target buyer: 1-9 property independent operators; agency operators with a Japanese guest operations workflow.
Existing price assumptions to validate: Starter ¥9,800 one-time; monthly one property ¥9,800, two-four properties ¥7,800 per property/month; five-nine ¥6,800 per property/month; >=10 ¥4,980–5,980 per property/month. Prices need consistent terms, invoicing and checkout implementation.
Initial definition of done: real buyer can understand offer, request trial, provide consent, receive a defined v1 deliverable, and purchase it via an actually tested payment route. All are PENDING external verification; a prototype alone does not meet this criterion.

### Competitive landscape (verified official vendor feature pages, 2026-11-05)
- Hospitable: unified inbox, guest messaging, automation, guest portal, pricing and team/cleaning workflows. https://hospitable.com/pricing
- Lodgify: PMS/channel manager, guest messages, cleaning task automations, dynamic pricing. https://www.lodgify.com/
- PriceLabs: dynamic pricing, availability/pricing recommendations, and price updates in supported PMS. https://hello.pricelabs.co/

Differentiation hypothesis (not proven): cross-channel explanation-first exception triage with human approval, source evidence and Japanese vacation rental workflows. Test willingness-to-pay with actual prospects.

## 5. Product catalog — content boundaries
Starter (¥9,800 one-time): operator checklist, response examples, exception decision record / CSV workflow. The existing GuestOps Starter Kit must be reviewed before claiming this is already delivered in current ZIP.
Standard (¥9,800 per property/month for one property): assisted triage and audit history by email/CSV intake; automatic ingestion is not yet live.
Multi-property (¥7,800 per property/month, 2-4 properties): shared issue queue and facility-specific rule profiles; production implementation still pending.
API upgrade (separately scoped): Beds24 API V2 account-level authorization and read-only synchronization after successful live testing. No marketplace approval implied.

## 6. Twenty-four-hour execution order (JST 2026-11-05 to 2026-11-06)
0-4h: complete mock demo, review partner details and application package.
4-8h: add sample events, test browser flows and publish demo; safe source integration tests.
8-12h: build CSV intake and export for independent version; package delivery.
12-16h: validate privacy, terms and purchase path with no false claims.
16-20h: submit partner application + Beds24 support ticket with authorized applicant details; arrange API read-only pilot.
20-24h: end-to-end tests and sales availability, update evidence pack.
Note: steps requiring account ownership, portal approval, real credentials, payment processor confirmation and Beds24 decision cannot be truthfully marked complete without those actions.

## 7. Operator handoff
- No customer data should be pasted into the publicly hosted demo.
- Do not paste Beds24 access/refresh tokens into static HTML or GitHub.
- No booking/inventory/price write until dedicated owner approval and safe tests.
- Public outbound sales message must not contain any Square-related URL.
- Official Beds24 program: https://www.beds24.com/reseller.html .
