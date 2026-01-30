# Bloco 7 Closeout — 2026-01-30

## Estado
- Invariantes de snapshot confirmadas nas rotas de cancelamento/no-show (fail-closed).
- Backfill **BLOCKED** por ausência de `DATABASE_URL`/`DIRECT_URL` local (sem secrets).
- Testes do bloco: OK.

## Evidência (código)
- Cancelamento org (snapshot required): `app/api/organizacao/reservas/[id]/cancel/route.ts:156-200`
- No-show org (snapshot required): `app/api/organizacao/reservas/[id]/no-show/route.ts:148-172`
- Cancelamento user (snapshot required): `app/api/me/reservas/[id]/cancel/route.ts:107-156`
- Snapshot timezone exposto: `app/api/me/reservas/route.ts:143-216`
- Backfill script + lib: `scripts/backfill_booking_confirmation_snapshot.ts:1-63`, `lib/reservas/backfillConfirmationSnapshot.ts:52-179`

## Backfill (pendente)
- Dry-run (quando DB env existir):
  - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --dry-run --limit=200`
- Execução controlada:
  - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --limit=200`

## Testes executados
- `npx vitest run tests/agenda tests/outbox tests/ops`
  - Resultado: **OK** (29 files / 73 tests).
  - Logs de outbox em stderr são informativos (retry/dead-letter), sem falhas.
