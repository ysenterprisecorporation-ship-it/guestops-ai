# Starter release dependency check (2026-11-01)

Source inspection, not a live GAS or Square test.

## Verified source-level conditions

- `goRequiredConfig_` rejects missing Square and material configuration and rejects the wrong Google account.
- `runStarterFulfillment` includes a sender identity gate and checks delivery guards before processing payments when sending is enabled.
- `StarterCompanions.gs` provides private-material verification, trigger installation, emergency pause and go-live readiness audit.
- `LegacyPrivacyRepair.gs` has both ID-based and auto-discovery audit/repair paths; audit results now log counts.

## Unverified operational gates

1. Owner account GAS project has the latest privacy-repair code and has been authorized.
2. Four old Drive items no longer have anyone-with-link permissions.
3. Starter sender GAS project has the latest Code.gs and companion code.
4. Square read-only reconciliation succeeds against real payments.
5. Private materials are explicitly shared with each verified purchaser before email delivery.
6. `SEND_ENABLED` stays `false` until all gates pass.

Do not infer deployment or payment success from this file.
