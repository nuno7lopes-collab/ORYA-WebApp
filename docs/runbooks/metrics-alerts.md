# Runbook — Metricas e alertas (minimo v10)

Objetivo: definir alertas basicos para operacao sem gaps.

## Fontes
- Logs estruturados (requestId/correlationId).
- `/api/internal/ops/health` e `/api/internal/ops/slo`.
- Sentry (erros server/client).

## Alertas minimos (sugestao)
- Outbox backlog:
  - `outbox.pendingCount` acima do normal por > 5 min.
  - `outbox.deadLetteredLast24h > 0`.
- Operacoes:
  - `operations.failedCount` crescente.
  - `operations.deadLetterCount` > 0.
- Pagamentos:
  - `payments.errorEventsLast24h` > 0.
- DB latency:
  - `db.latencyMs` acima do limite acordado.

## SLO basico (proposta)
- Disponibilidade API core: 99.5%/30d (checkout, webhook, worker).
- Outbox publish: < 5 min backlog em 95% do tempo.
- Check-in: 99% respostas < 2s.
 - Definicao completa: `docs/observability/slo_sli.md`.

## CloudWatch (exemplo)
- Criar metric filter em logs:
  - pattern: `"outbox"` + `"deadLetteredLast24h"`
  - threshold: > 0
- Alarmes por email/Slack.

## Sentry (exemplo)
- Eventos: `refund.ledger_append_failed`, `worker.publish_outbox_batch_failed`.
- Configurar alert rule por tag `requestId` ou `correlationId`.

## Notas
- Sem alertas -> blind spots.
- Ajustar thresholds por ambiente (staging vs prod).
