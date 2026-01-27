# Go-live dashboard (C7)

0) Objetivo
- O minimo de sinais para dizer "producao esta viva".

1) Sinais P0 (bloqueiam go-live)
- Outbox/DLQ:
  - DLQ count = 0 ou estavel (nao crescente)
- Rollups freshness:
  - ultimo rollup < 24h (ou SLA definido)
- Ops health:
  - `GET /api/internal/ops/health` ok
- Cron liveness:
  - `POST /api/cron/operations` responde e executa (com secret)

2) Sinais P1 (operavel)
- SLO dashboard (se existir)
- Latencia/erros por endpoint interno
- Queue backlog (se medido)
- Refund/payout backlog (se existir metrica)

3) Comandos "copy/paste"

```
export ORYA_CRON_SECRET="..."

# health
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/ops/health"

# dashboard
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/ops/dashboard"

# slo
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/ops/slo"

# dlq list
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/outbox/dlq?limit=50"

# rollup trigger (manual)
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -X POST "http://localhost:3000/api/internal/analytics/rollup"

# payouts-release (manual, cuidado)
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -X POST "http://localhost:3000/api/cron/payouts/release"
```

4) Thresholds e acoes

Sinal | Threshold | Acao segura | Escalacao
---|---|---|---
DLQ > 0 e a subir | >0 e crescente | parar replay, investigar causa | on-call/ops
Rollup stale | >24h | trigger manual 1x, verificar cron | eng/ops
Ops health fail | ok=false | pausar releases, investigar DB | eng on-call
Cron operations falha | HTTP != 200 | verificar secret e runner | ops

5) Definicao de Done (go-live day)
- Ops health ok
- Ops dashboard ok
- SLO sem DLQ crescente
- Rollups frescos (<24h)
- Cron operations ok
- Payouts-release ok
- Exports ok (sem erros)
- Logs sem spikes de falha
- Runbooks atualizados
- Responsavel on-call confirmado
