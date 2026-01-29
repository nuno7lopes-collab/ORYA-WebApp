# Runbook - Outbox DLQ (deadLetteredAt)

Objetivo: quando aparecem eventos em DLQ, ter um procedimento curto, seguro e repetivel
para identificar causa e reprocessar sem quebrar idempotencia.

## Como identificar (deadLetteredAt)
- Sinal: `deadLetteredAt` preenchido e `publishedAt == null`.
- Campos uteis: `eventId`, `eventType`, `attempts`, `correlationId`, `createdAt`.
- Chaves de idempotencia: `dedupeKey` usa formato canonico `eventType:causationId`.
- Onde ver:
  - Endpoint interno: `GET /api/internal/outbox/dlq`
  - Logs do worker: `domain/outbox/publisher.ts` emite `[outbox] dead-letter`.

## Como listar (read-only)
Endpoint (path exato):
- `GET /api/internal/outbox/dlq?limit=50&eventType=...&before=...`
- Header obrigatorio: `X-ORYA-CRON-SECRET`

Exemplo curl:
```bash
curl -s \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<base>/api/internal/outbox/dlq?limit=50"
```

## Como fazer replay (rearmar)
Endpoint (path exato):
- `POST /api/internal/outbox/replay` com `{ "eventId": "..." }`
- Header obrigatorio: `X-ORYA-CRON-SECRET`

Exemplo curl:
```bash
curl -s -X POST \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt_123"}' \
  "https://<base>/api/internal/outbox/replay"
```

Checklist antes do replay:
- [ ] Causa raiz identificada e corrigida
- [ ] Consumer idempotente (dedupe por `dedupeKey=eventType:causationId`)
- [ ] Nao ha side-effects irreversiveis sem idempotencia
- [ ] Confirmar que `publishedAt == null`

## Crash recovery (claims "presos")
- Sinal: `claimedAt` muito antigo e `publishedAt == null`.
- Mecanismo: o publisher re-clama eventos com `claimedAt` antigo (stale) automaticamente.
- Acao: garantir que o worker esta a correr; nao mexer manualmente em `claimedAt`.

## O que NAO fazer
- NAO editar rows do outbox/ledger manualmente.
- NAO reprocessar sem entender a causa (loop de falhas).
- NAO criar Outbox/EventLog fora dos helpers canonicos.
- NAO apagar eventos em DLQ; rearmar e a via segura.
