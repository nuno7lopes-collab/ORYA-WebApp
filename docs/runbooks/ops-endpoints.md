# Ops endpoints (health/slo/dashboard)

Objetivo: endpoints internos para observabilidade minima.

## Autenticacao
- Header obrigatorio: `X-ORYA-CRON-SECRET`

## Endpoints

### Health
- `GET /api/internal/ops/health`
- Exemplo:
```bash
curl -s \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<base>/api/internal/ops/health"
```
- Sinais vermelhos:
  - `ok=false`
  - `db.ok=false`
  - `db.latencyMs` muito alto (definir threshold por ambiente)
  - `outbox.pendingCount` muito alto
  - `outbox.deadLetteredLast24h > 0`
  - `operations.failedCount` ou `operations.deadLetterCount` acima do normal
  - `payments.errorEventsLast24h` crescente

### SLO
- `GET /api/internal/ops/slo`
- Exemplo:
```bash
curl -s \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<base>/api/internal/ops/slo"
```
- Sinais vermelhos (heuristicas):
  - `outbox.pendingCountCapped == capLimit`
  - `outbox.oldestPendingAgeSec` alto (ex.: > 300s)
  - `outbox.deadLetteredLast24h > 0`
  - `outbox.backoffLagSec` positivo e a crescer

### Dashboard
- `GET /api/internal/ops/dashboard`
- Exemplo:
```bash
curl -s \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<base>/api/internal/ops/dashboard"
```
- Nota: agrega Health + SLO num unico payload.

## Nota operacional
- Todos estes endpoints sao internos e devem ser inacessiveis sem o secret.
