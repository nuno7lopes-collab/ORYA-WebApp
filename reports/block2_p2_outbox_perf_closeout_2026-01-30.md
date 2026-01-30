# Bloco 2 P2 — Outbox batching/perf closeout (2026-01-30)

## Estado
- Batching configurável com fairness por `eventType`.
- Claim por batch com ordenação determinística e logs agregados.
- Guardrails: evita loop tight sem eventos; mantém backoff/retry e stale-claim recovery.

## Evidência (código)
- Claim + fairness + ordenação determinística:
  - `domain/outbox/publisher.ts:1-220`
- Logs por batch (batchSize/claimed/published/failed):
  - `domain/outbox/publisher.ts:221-360`
- Índice mínimo para ORDER BY (evitar sort pesado em pending):
  - `prisma/migrations/20260130192015_outbox_created_at_idx/migration.sql:1-1`
- Testes de batching/fairness/stale:
  - `tests/outbox/publisher.test.ts:1-230`
- Retry/dead-letter sem regressão:
  - `tests/outbox/loyaltyOutbox.test.ts:1-200`

## Testes executados
- `npx vitest run tests/outbox`
  - Resultado: **OK** (7 files / 24 tests).
  - Logs de outbox em stdout/stderr são informativos, sem falhas.

## Nota performance
- Índice mínimo: `outbox_events_created_at_event_idx (created_at, event_id)`.
- Justificação: cobre o `ORDER BY createdAt, eventId` no claim sem exigir índice composto por event_type, mantendo custo baixo e sem alterar semântica.
