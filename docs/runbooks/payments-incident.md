# Payments incident runbook (prod)

## Symptoms
- spike in payment failures
- webhook backlog / outbox retries
- mismatched ledger vs sale_summary

## Immediate checks
1) CloudWatch: error rate by requestId/correlationId.
2) Stripe dashboard: webhook delivery failures / dispute activity.
3) Ops health: `/api/internal/ops/health` (requires internal secret).

## Actions
- Pause new checkouts if needed (feature flag or maintenance banner).
- Re-run reconciliation: `/api/internal/reconcile` or batch script.
- Replay outbox DLQ: `/api/internal/outbox/replay`.
- Validate ledger entries are append-only; use `ledgerAdjustments` for refunds/chargebacks.

## Recovery commands (examples)
```bash
aws logs filter-log-events --log-group-name /ecs/orya/prod/web --filter-pattern "payment" --region eu-west-1
aws ecs update-service --cluster orya-prod --service orya-prod-worker --force-new-deployment
```

## Post-incident
- Update `reports/p1_closeout_2026-01-29.md` with requestIds.
- Create follow-up task if ledger drift detected.
