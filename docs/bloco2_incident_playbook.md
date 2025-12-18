# Bloco 2 — Incident Playbook & Admin Tools

Ferramentas mínimas (admin/backoffice)
- Reprocessar por purchaseId: enfileira Operation `PROCESS_STRIPE_EVENT` ou `UPSERT_LEDGER_FROM_PI` conforme contexto.
- Reprocessar por stripeEventId/paymentIntentId: idem, preservando dedupeKey.
- Reprocessar por OperationId: retira lock/FAILED e cria nova PENDING com mesmo dedupeKey.
- Marcar DEAD_LETTER como resolvido e reenfileirar.
- Ver backlog/locks: lista Operations por status, lockedAt, attempts.
- Timeline Checkout/Fulfillment: mostra PaymentEvent + Operations + SaleSummary/Tickets por purchaseId.
- Refund/Dispute manual: enfileirar `PROCESS_REFUND_SINGLE` ou `MARK_DISPUTE` (nunca efeitos diretos).

Playbook por sintoma
- “Compra ficou em PROCESSING”: verificar timeline; se SaleSummary ausente e PaymentEvent OK → reprocess `UPSERT_LEDGER_FROM_PI`; se erro de validação → DEAD_LETTER com causa.
- “Webhook duplicado/out-of-order”: confirmar dedupeKey; se PaymentEvent único e sem efeitos → OK; caso contrário reprocess idempotente.
- “Bilhetes duplicados/faltam linhas”: validar constraints; reprocess `ISSUE_TICKETS` (idempotente) após corrigir dados de SaleSummary.
- “Refund não marcou ledger”: reprocess `PROCESS_REFUND_SINGLE` para purchaseId; verificar dedupeKey.
- “Dispute não bloqueou payout”: reprocess `MARK_DISPUTE` e `BLOCK_PAYOUTS_ON_RISK`.
- “Operation presa (lockedAt expirado)”: mover para FAILED e criar nova PENDING; auditar.
- “Dead-letter subiu”: ler lastError, corrigir payload/config, marcar resolved e reenfileirar.

Execução segura
- Todas as ações admin apenas enfileiram Operations; nenhuma mutação direta de tickets/ledger/refund.
- Auditoria: quem executou, quando, que Operation/dedupeKey foi reenfileirada, motivo.

Observabilidade associada
- Dashboards: backlog por status, dead_letter_total, stuck_processing_total, refund_failed_total.
- Alertas automáticos disparam playbooks curtos (ver bloco2_metrics_alerts).
