# Bloco 2 — Política de Reconciliação

Objetivo: detetar stucks e reenfileirar Operations corretas sem criar efeitos diretos, de forma auditada e segura.

## Critérios de stuck
- SaleSummary em PROCESSING há > X minutos (config ex.: 15–30 min).
- Stripe PaymentIntent `succeeded` mas SaleSummary não chegou a PAID.
- PaymentEvent recebido (status PROCESSING/OK) sem Operation concluída associada.
- Operation em RUNNING com `lockedAt` expirado ou `attempts` perto do limite.
- Backlog de Operations cresce além de limiar (alerta, não reconciliação direta).

## Job de reconciliação (periodic/on-demand)
- Entrada: lista stuck via queries determinísticas; suporta filtros (purchaseId, paymentIntentId, stripeEventId).
- Ação: criar/enfileirar novamente a Operation adequada (ex.: PROCESS_STRIPE_EVENT, UPSERT_LEDGER_FROM_PI, ISSUE_TICKETS), nunca efeitos diretos.
- Se Operation RUNNING expirou → set FAILED e requeue nova PENDING com mesmo dedupeKey (ou retomar a mesma se seguro).
- Audit: regista reconciliação em tabela (operationId, reason, actor=system/humano, timestamp).
- Safe defaults: limite de reprocessamentos por janela; backoff exponencial; não reabre REFUNDED/DISPUTED sem sinal explícito.

## Proteções
- Idempotência via dedupeKey: reenviar Operation não duplica efeitos.
- Reconciliação não altera estados finais (REFUNDED, DISPUTED) salvo job específico com aprovação.
- Stripe webhook duplicado/out-of-order 10x → sem efeitos extras (dedupe em PaymentEvent + Operation).

## Observabilidade
- Métricas: `stuck_processing_total`, `operations_backlog_total`, `dead_letter_total`, `reconciled_operations_total`.
- Logs estruturados incluem purchaseId, paymentIntentId, operationType, dedupeKey, attemptNo, reason.
- Alertas em stuck/backlog/dead-letter (ver bloco2_metrics_alerts).

## Interfaces de admin (ligação ao passo 10)
- Reprocessar por purchaseId/paymentIntentId/stripeEventId (enfileirar Operation).
- Marcar DEAD_LETTER como resolvido e reenfileirar.
- Ver fila/backlog/locks e histórico de reconciliação. 
