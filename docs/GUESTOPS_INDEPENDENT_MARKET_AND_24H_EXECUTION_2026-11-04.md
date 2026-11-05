# PMS-independent GuestOps AI alternative — competition and launch gates (2026-11-04 JST)
**Objective:** monetize existing GuestOps risk logic and Starter Kit assets without depending on Beds24 Marketplace approval, OTA direct API approval, new customer Gmail or GAS.

## Evidence / competing solutions
- Beds24 lists **Besty AI** (messaging, upselling, history, knowledgebase) and **HostBuddy AI** (automated guest communications). Sources: https://beds24.com/marketplace.html?marketplaceId=1065&partner=Besty+AI ; https://beds24.com/en/marketplace
- Japanese Beds24 add-on **Staidea** advertises base ¥3,000/property/month plus features such as cleaning ¥1,500, message AI ¥1,500, revenue management ¥1,500, dynamic pricing ¥2,500 (check current terms): https://staidea.com/pricing
- **StayReply** advertises Beds24-centered tools, base ¥1,500/facility/month and cleaning add-on ¥250/month: https://stayreply.jp/help/cleaning-management
- **AssistBnB** advertises AI message response around ¥8,000/property/month excluding tax: https://assistbnb.lilfires.com/?tab=message
- **AirHost** includes PMS scheduling, messaging and cleaning management: https://airhost.jp/products/vacation-rentals
**Implication:** avoid an undifferentiated AI messaging or cleaning checklist commodity. Focus on explainable *cross-system risk and exception handling* and facility operating memory. Do not claim the niche is devoid of competitors.

## Sellable without Beds24 partner approval — proposed (not live)
A. **Audit Starter**, proposed ¥9,800 one-time: reservation/cleaning exception checklists, an anonymous booking CSV audit demo, decision record templates, and revised GuestOps Starter Kit components. No OTA/PMS API required.
B. **Decision Review**, proposed ¥29,800 one-off per facility: asynchronous risk report on pseudonymous booking status/date exports, action priorities, exception SOP. No requirement to hand over credentials or guest PII; delivery after payment and safe handling tested.
C. **Connected SaaS**: remains Beds24 API/contract-dependent; existing GuestOps AI pricing must not be silently changed.

## Where legacy work transfers
- Existing booking date/status and same-day turnover/overlap tests: `src/pms/VerifiedBookingNightProtection.ts`.
- Booking/identity/inventory reconciliation and read-only cutover guard: `src/pms/BookingIdentityReconciler.ts`, `src/pms/BookingInventoryReconciler.ts`, `src/pms/ProductionCutoverPreflight.ts`.
- GuestOps Starter Kit v1: reusable as teaching materials only after current ZIP, delivery and content validated; never reinstate revoked shared links.
- Facility memory / operating decisions: reusable positioning, implement evidence logs before claims of automatic organizational memory.
- Kasai Booking.com cases: only sanitized patterns; never ship actual booking IDs, guest details or confidential history.

## 24h sequence / release conditions
0–4h: official partner commercial terms and competition; draft inquiries. [research + draft complete]
4–10h: Beds24 application narrative and safe product evidence. [draft complete; official submission pending applicant]
10–16h: self-contained, client-side anonymous CSV audit demo. [created and JS behavior checked]
16–22h: competitor-backed product positioning, proposed price, conversion flow. [docs complete; site publishing and checkout tests pending]
22–24h: go/no-go based on: (i) safe handling and scope, (ii) usable product, (iii) tested purchase and delivery, (iv) truthful claims. [commercial go-live NOT approved]

## Security and compliance
Do not imply CSV is a live OTA snapshot; users must independently verify OTA/PMS current availability.
No personally identifying guest data, passport or payment information. Demo runs entirely within the browser.
Japan's guest register and identity verification obligations remain with the operator. Do not present this as statutory ID verification.
No live booking/inventory/rate writes in the demo. The proprietary Beds24 implementation must be commercially authorized before offering official connected functionality.
