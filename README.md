# Group Trip OS booking automation core

Branch: `group-trip-os-2026-10-10`

This branch contains the deterministic core for the approved booking flow:

1. Quote issued
2. Inventory rechecked
3. Square payment link created
4. Payment confirmed for the quoted amount while the inventory check is still valid
5. Reservation confirmed
6. Monthly rental only: contract packet prepared for GMO Sign
7. Operator sends the contract in the existing free GMO Sign account
8. Operator records sent status
9. Operator confirms signature completion and records signed status

## Current operating policy

- 100% advance payment only. The previous 30/70 split is not implemented.
- Payment amount mismatch never confirms a reservation automatically.
- If the inventory confirmation has expired before payment confirmation, the flow goes to `MANUAL_REVIEW`.
- Short stays never enter the GMO Sign contract path.
- GMO Sign remains on the current free account. Do not require or assume a paid GMO Sign API plan.
- Do not invent or call undocumented GMO Sign send APIs.
- For monthly stays, automate contract data preparation, PDF handoff metadata, recipient values, checklist generation, and booking-ledger state updates.
- The unavoidable human step is limited to uploading/sending in the GMO Sign UI and later confirming signature completion.
- External calls must use deterministic idempotency keys.
- No Square, OTA, AirHost, Lodgify, or GMO Sign credentials are stored in this branch.

## State flow

Short stay:

`INQUIRY -> QUOTED -> INVENTORY_CONFIRMED -> PAYMENT_LINK_SENT -> PAID -> BOOKING_CONFIRMED -> COMPLETE`

Monthly:

`INQUIRY -> QUOTED -> INVENTORY_CONFIRMED -> PAYMENT_LINK_SENT -> PAID -> BOOKING_CONFIRMED -> CONTRACT_READY -> CONTRACT_SENT -> CONTRACT_SIGNED -> COMPLETE`

## Commands

```bash
npm install
npm run check
npm test
```

## Files

- `src/booking-flow.ts`: state machine, guards, next action, idempotency keys
- `src/automation-runner.ts`: one-step automation runner for inventory, payment, reservation, and GMO handoff preparation
- `src/gmo-manual-handoff.ts`: prepares the free-plan GMO Sign operator packet
- `src/manual-contract-ops.ts`: records manual GMO send/signature into the booking state machine
- `src/provider-contracts.ts`: integration contracts for inventory, payment, reservation, and contract handoff
- `tests/booking-flow.test.ts`
- `tests/automation-runner.test.ts`
- `tests/gmo-manual-handoff.test.ts`
- `tests/manual-contract-ops.test.ts`

The provider-specific integration must preserve this order:

`inventory recheck -> payment confirmation -> reservation confirmation`

For monthly rentals only, reservation confirmation is followed by GMO Sign handoff preparation. The free GMO Sign UI remains the manual boundary.
