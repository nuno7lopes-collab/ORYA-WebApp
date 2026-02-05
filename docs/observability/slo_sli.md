# SLO/SLI definitions (v10)

Objetivo: definir SLOs minimos por dominio para operacao e go-live.

## Fonte de dados (SLIs)
- `/api/internal/ops/health` (outbox, ops, payments, DB latency).
- `/api/internal/ops/slo` (pending backlog, oldest pending age, DLQ 24h, eventLog last1h).
- Logs estruturados com `requestId/correlationId`.
- CloudWatch logs/alarms (erros server) e Stripe dashboards.

## SLOs minimos (proposta)

### Checkout + Pagamentos
- Disponibilidade API checkout: >= 99.5% (30d).
- Taxa de erro de intent/webhook: < 0.1%/7d.
- Tempo medio de resposta checkout: p95 < 2s.

### Outbox + Worker
- Backlog outbox: 95% do tempo com oldestPendingAgeSec < 300s.
- DLQ 24h: 0 eventos sem justificacao operacional.
- Tentativas medias por evento: <= 3 (acima disso investigar).

### Check-in / Entitlements
- Disponibilidade check-in: >= 99.5% (30d).
- Latencia check-in: p95 < 2s.
- Falhas de entitlement: < 0.5%/7d.

### Reservas / Agenda
- Disponibilidade APIs de slots: >= 99.5% (30d).
- Conflitos falsos: < 0.5%/7d (monitorar via logs e tickets).

### Admin / Ops
- Ops health/slo endpoints: >= 99.9% (30d).
- Tempo de resposta admin critico: p95 < 2s.

## Alertas derivados (minimo)
- `outbox.pendingCountCapped` ou `oldestPendingAgeSec` acima do SLO por > 5 min.
- `deadLetteredLast24h > 0` sem janela de manutencao.
- `payments.errorEventsLast24h > 0`.
- `db.latencyMs` acima de 500ms por > 5 min.

## Revisao
- Rever SLOs 1x por trimestre com base em baseline real de prod.
- Ajustar thresholds apos 2 semanas de operacao.
