# Runbook — Reservas e agenda

Objetivo: garantir consistencia de reservas e snapshots (pricing/policy/timezone).

## Entrypoints
- `GET /api/organizacao/reservas`
- `POST /api/organizacao/reservas/[id]/cancel`
- `POST /api/organizacao/reservas/[id]/no-show`
- `POST /api/organizacao/reservas/[id]/reschedule`
- `GET /api/organizacao/agenda`

## Checklist rapido
1) Confirmar `confirmationSnapshot` presente (fail-closed).
2) Validar `snapshotTimezone` no booking.
3) Para cancelamentos/no-show: usar snapshot para fees.
4) Agenda unificada: verificar range `from/to` e filtros.

## Query base
```sql
select id, status, snapshot_timezone, confirmation_snapshot_version
from app_v3.bookings
where id = <bookingId>;
```

## Notas
- Se snapshot faltar, cancelar/no-show deve falhar.
- Timezone padrao: Europe/Lisbon (sobrescrito pela organizacao).
