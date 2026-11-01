# Starter Kit production release gate — 2026-11-01 JST

Status: BLOCKED. This document is a release control, not evidence of deployment or payment.

## Owner action (single authorization point)
From the legacy materials' owning Google account, deploy the reviewed GAS code and authorize the one-run `repairLegacyStarterPrivacyAuto()` execution. Do not execute under a different account. The routine must fail closed on ambiguous folder/file matches or ownership mismatches.

## Verification required before any fulfillment
1. Re-read permissions for all three legacy files and legacy folder. Confirm no `anyone`/public reader permission remains. Do not use legacy public assets for paid delivery.
2. Confirm all three migrated materials and parent folder are private and buyer-specific reader grants work. Reject public links and editing grants.
3. Deploy GAS production version and verify actual deployed revision, authorized scopes, logs and dry-run tests. CI alone is not deployment.
4. Square production API: match actual order ID, payment ID, captured amount JPY 9,800, item, status, refund/cancellation, and purchaser email before granting access. No assumption based on Gmail notices.
5. Idempotency: one order/payment -> at most one fulfillment. On missing permissions/deployment/config, do not write PENDING, grant permissions, or send email.
6. Search Gmail all-time SENT and fulfillment ledger for duplicates; exclude opt-outs, bounces and prohibited companies. No customer email until payment and access verification.
7. For GuestOps AI recurring plans, verify actual PMS/API operation and billing configuration before any customer claim or recurring charge.

## Latest observed baseline
Previous conversation reports legacy 3 files + 1 folder publicly readable, migrated 3 files private, and safety CI passed; live permissions and deployment must be rechecked. Current Gmail search after 2026-10-30 for Square/order/GuestOps found only an unsent internal delivery draft; this does not establish zero sales. GitHub head observed `dc2e3aa8ad24ea14cb980c060bee531801579cb6`.

## Prohibited
No Square URLs in outbound sales mail body/signature; no old public-link fulfillment; no unverified payment, charge, contract, or customer email; no duplicate outreach to any company sent at any time.
