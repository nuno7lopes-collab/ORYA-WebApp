# Operability checklist (producao)

Objetivo: checklist minimo para producao operavel (sem depender de legal/DSAR/safety).

## P0 vs P1 (prioridade operacional)
- P0 (bloqueia go-live):
  - backups + restore test
  - alertas minimos ativos
  - DLQ controlada + replay seguro
  - cron health confirmado
  - rollups confirmados
- P1 (operabilidade):
  - dashboards estaveis e com dados
  - runbooks completos e atualizados

## Backups / restore (infra fora do repo)
- Validar backups existentes (provider/DB):
  - confirmar politica de retencao
  - confirmar encriptacao at-rest
- Restore test (obrigatorio antes de go-live):
  - executar restore num ambiente isolado
  - correr smoke tests basicos
  - registar data/resultado

## Alertas minimos esperados
- Outbox/DLQ:
  - `deadLetteredLast24h > 0` (ver `/api/internal/ops/slo`)
  - `pendingCountCapped == capLimit`
- Webhooks:
  - falhas acima de threshold (finance/webhook)
- Payments:
  - spikes de `payment.processing`
- Rollups:
  - atraso acima do esperado (analytics rollup)

## Quando a DLQ cresce
1) Confirmar via `/api/internal/ops/slo`
2) Listar DLQ (runbook): `docs/runbooks/outbox-dlq.md`
3) Identificar causa e corrigir antes de replay
4) Replay controlado via endpoint interno

## Confirmar rollups e ops endpoints
- Analytics rollup:
  - `POST /api/internal/analytics/rollup` com `X-ORYA-CRON-SECRET`
  - verificar resposta `ok: true`
- Ops endpoints:
  - `GET /api/internal/ops/health`
  - `GET /api/internal/ops/slo`
  - `GET /api/internal/ops/dashboard`
  - auth: `X-ORYA-CRON-SECRET` (sem header e esperado 401)

## Criterio PASS/FAIL
- PASS:
  - backups e restore test documentados
  - alertas minimos configurados e verificados
  - DLQ controlada (sem backlog crescente)
  - rollups e ops endpoints respondem OK
- FAIL:
  - qualquer item acima em falta
