# Runbook — Check-in (entitlements)

Objetivo: diagnosticar falhas de check-in e reverter bloqueios.

## Entrypoints
- `POST /api/internal/checkin/consume`
- `GET /api/organizacao/checkin/preview`
- `POST /api/organizacao/checkin`

## Checklist rapido
1) Validar QR payload e `eventId`.
2) Confirmar entitlement por `purchaseId` + `policyVersionApplied`.
3) Verificar janela de check-in (startsAt/endsAt).
4) Validar status do entitlement (ACTIVE / SUSPENDED / REVOKED).

## Query base
```sql
select id, status, snapshot_start_at, snapshot_timezone, policy_version_applied
from app_v3.entitlements
where purchase_id = '<purchaseId>';
```

## Codes comuns
- `SUSPENDED`: disputa/chargeback ativa.
- `REVOKED`: refund/cancelamento.
- `OUTSIDE_WINDOW`: fora da janela.
- `ALREADY_USED`: check-in duplicado.

## Replay
- Para entitlements suspensos indevidamente, reprocessar payment status via
  `POST /api/internal/reprocess/purchase`.

## Notas
- Check-in respeita policy version aplicada ao entitlement.
- Sempre usar requestId/correlationId nos logs.
