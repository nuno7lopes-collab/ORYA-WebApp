# Finance Checkout Money Runbook

## Scope
- Checkout and payment intent flows for `TICKET_ORDER`, `BOOKING`, `PADEL_REGISTRATION`, `STORE_ORDER`.
- Refunds, disputes, split payments, ledger, reconciliation, and outbox DLQ.

## Alerts to Watch
- DLQ growth (`/api/internal/outbox/dlq`).
- Webhook lag and failed processing (`/api/internal/ops/health`, `/api/internal/ops/slo`).
- Ledger vs payment snapshot drift.
- Any non-canonical payload contract errors in checkout.

## Incident: Unresolved org on Stripe webhook
1. Confirm event is dead-lettered with `reasonCode=ORG_NOT_RESOLVED`.
2. Validate metadata contains `orgId`, `paymentId`, `sourceType`, `sourceId`.
3. Fix mapping source (payment metadata, event linkage, store/booking/event relation).
4. Replay via `POST /api/internal/outbox/replay` with `eventId`.
5. Confirm status transition and no duplicate side effects.

## Incident: Reconciliation Drift
1. Run reconciliation endpoint/job for affected window.
2. Compare Payment, LedgerEntry, PaymentSnapshot for same `paymentId`.
3. If mismatch persists, inspect outbox events for missing `payment.status.changed` or `payment.fees.reconciled`.
4. Replay dead-lettered outbox event(s) after root cause fix.
5. Validate read models and sale summaries after replay.

## Incident: Dispute State Inconsistency
1. Confirm internal event shape is canonical:
   - `payment.dispute_opened`
   - `payment.dispute_closed` with `outcome=WON|LOST`
2. Verify payment status transition:
   - opened -> `DISPUTED`
   - closed WON -> `CHARGEBACK_WON`
   - closed LOST -> `CHARGEBACK_LOST`
3. Verify entitlement/ticket side effects and ledger dispute fee entries.
4. Replay event if transition did not apply.

## Rollback: Finance Hard-Cut Migration
1. Stop deploy pipeline for finance mutations.
2. Snapshot affected tables (`payments`, `ledger_entries`, `payment_snapshots`, `entitlements`).
3. Revert application to previous release only if migration has not been applied.
4. If migration already applied, do forward-fix only:
   - convert invalid fee/source/policy data to canonical values,
   - replay outbox and reconciliation.

## Validation Gate (10 cycles)
- Run 10 full cycles per source type.
- Each cycle must cover checkout -> payment -> ledger -> refund/dispute -> reconciliation.
- Acceptance criteria:
  - No drift in financial totals.
  - No forbidden contract/state values (`policyVersionApplied=0`, `ON_TOP`).
  - No unintended duplicate side effects.

### Automated gate command
- Strict (fails CI if any rule is not met):
  - `npm run gate:finance-ops`
- Report-only (non-blocking diagnostics):
  - `npm run gate:finance-ops:report`
- End-to-end proof (seed + strict gate):
  - `npm run finance:prove-cycles`

Environment knobs:
- `FINANCE_SOURCE_TYPES` (default: `TICKET_ORDER,BOOKING,PADEL_REGISTRATION,STORE_ORDER`)
- `FINANCE_MIN_CYCLES` (default: `10`)
- `FINANCE_LOOKBACK_DAYS` (default: `30`)
- `FINANCE_MAX_DLQ_24H` (default: `0`)
- `FINANCE_MAX_PENDING_OUTBOX_OLDEST_MIN` (default: `15`)
- `FINANCE_CYCLES_STRICT` (`1` default, `0` for report-only)
