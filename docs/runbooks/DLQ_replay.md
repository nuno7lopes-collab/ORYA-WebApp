# Runbook — DLQ replay (Outbox)

## Objetivo
Rearmar eventos em DLQ (outbox) de forma segura, garantindo que replays sao idempotentes e nao causam efeitos duplicados.

## Quando usar
- DLQ com eventos pendentes (dead-letter) por mais de alguns minutos.
- Erros em consumidores/outbox com impacto operacional.
- Recuperacao apos falha de worker ou incidente com backlog.

## Pre-requisitos
- Acesso ao ambiente (staging/producao) e permissao para usar o secret interno.
- Variavel `ORYA_CRON_SECRET` disponivel.
- Identificar `eventId`(s) a rearmar (via DLQ list).

## Endpoints internos
- `GET /api/internal/outbox/dlq` (lista DLQ)
- `POST /api/internal/outbox/replay` (rearmar um evento)
- `POST /api/internal/ops/outbox/replay` (rearmar varios eventos + idempotencia)

## Triage rapido
1. Listar DLQ (opcionalmente filtrar por `eventType`).
2. Confirmar que o evento esta em DLQ (`deadLetteredAt` definido) e nao publicado.
3. Validar causa raiz (ex.: dependencia externa, schema, secret) antes de rearmar.

### Listar DLQ
```bash
curl -s \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<host>/api/internal/outbox/dlq?limit=50&eventType=<EVENT_TYPE>"
```

Resposta inclui `eventId`, `eventType`, `attempts`, `deadLetteredAt`, `correlationId`.

## Replay de um evento
Rearmar um unico `eventId` (limpa `deadLetteredAt`, zera `attempts`, e coloca `nextAttemptAt` para agora).

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -d '{"eventId":"<EVENT_ID>"}' \
  "https://<host>/api/internal/outbox/replay"
```

## Replay em lote (recomendado)
Usa endpoint de ops para rearmar varios eventos e garantir idempotencia via `Idempotency-Key`.

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Idempotency-Key: dlq-replay-<YYYYMMDD-HHMM>" \
  -d '{"eventIds":["<EVENT_ID_1>","<EVENT_ID_2>"]}' \
  "https://<host>/api/internal/ops/outbox/replay"
```

## Validacao pos-replay
- Voltar a listar DLQ e confirmar que os `eventId` rearmados desapareceram da lista.
- Monitorizar logs do worker/outbox para confirmacao de publicacao.
- Se necessario, acompanhar o impacto via event logs ou auditoria.

## Notas de seguranca
- Nunca rearmar eventos sem corrigir a causa raiz.
- Replays sao idempotentes, mas so para consumidores que respeitam `eventId`/`idempotencyKey`.
- Se um evento ja tiver `publishedAt`, o replay deve ser ignorado (endpoint retorna erro).

