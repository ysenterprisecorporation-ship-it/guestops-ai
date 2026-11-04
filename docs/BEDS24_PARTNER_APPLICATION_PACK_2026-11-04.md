# Beds24 Integration Partner Application — GuestOps AI (2026-11-04)
**Draft, not yet submitted; approval NOT obtained.**

## Applicant / category
Trading name: Y's enterprise corporation (Japan-based sole proprietorship, not incorporated).
Product: GuestOps AI — risk-aware hospitality operations decision support.
Website: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/
Contact: use an approved existing business contact; do NOT invent an email or request new Gmail.

## Submission statement (English, form-ready)
GuestOps AI is a Japan-focused operations decision-support product for small vacation-rental and accommodation operators. We plan to complement Beds24, not replace its PMS or channel management. Our differentiator is **risk-controlled operations**: detecting booking/cancellation and cleaning workflow mismatches, preserving facility-specific decision history, and escalating cases where the available information is incomplete. This builds on Japan-specific operating workflows and a low-friction onboarding goal with **no additional Gmail accounts or Google Apps Script for customers**.

We have demonstrated read-only Beds24 API V2 access with our own test environment and developed booking and calendar reconciliation tests. We are candid that commercial multi-tenant onboarding, Marketplace authorization, messaging writeback and automatic rate changes are **still in development**, not deployed commercial capabilities. We are requesting an early Integration Partner eligibility review and clarity on the documentation, minimum demo readiness, and scope permissions needed for formal Marketplace listing.

## 24-hour priority work package
- [x] Verify the Beds24 official Integration Partner vs Reseller distinction and application stages.
- [x] Map competition in Beds24 and Japan; refine differentiation.
- [x] Draft truthful English application narrative, scope/authorization questions, low-friction customer onboarding model.
- [x] Build privacy-preserving local CSV diagnostic demo and test its logic (demo; not OTA-connected).
- [ ] Applicant sends official partner pre-screening inquiry, using validated operator name and current contact details.
- [ ] Beds24 replies on eligibility, contract, fees, and minimum launch criteria (external decision; cannot be completed within 24h by developer).
- [ ] Build/test customer authentication and live integration after contract and scope guidance.

## Required commercial clarifications
1. Are Japanese sole proprietors eligible and what evidence is required?
2. Can an early-stage MVP be pre-screened? Is a customer-facing site/video sufficient initially?
3. What are fees, revenue share, contractual support, privacy/security and approval requirements?
4. Is third-party paid SaaS using customer-granted API invite codes permitted **before** Marketplace approval?
5. Which partner scopes/webhooks cover bookings, message read/write, inventory read and rate write?
6. How are partner authorization, customer account/property isolation, revocation and organization tokens handled?
7. Sandbox/testing options, API request credits and support expectations?

## Official steps
1. Submit "Integration Partner" inquiry via https://www.beds24.com/reseller.html or Beds24 Marketplace "Become a Partner".
2. Beds24 acceptance at its discretion; review and sign agreement.
3. Request partner account reset, Marketplace entry and organization/access tokens via support tickets.
4. Validate consent and least-privilege property selection. Do not activate OTA writes until all safety checks pass.

Official: https://wiki.beds24.com/index.php?title=Marketplace_for_Integration_Partners
API V2: https://wiki.beds24.com/index.php/API_V2.0

## Claims NOT to make
Never say "Beds24-approved", "Marketplace-listed", "automatically compliant with Japanese identity verification", "live OTA auto-write", or "production-ready multi-tenant SaaS" without verification.
Never share real booking IDs, credentials, guest PII or test account secrets in submission/demo.
