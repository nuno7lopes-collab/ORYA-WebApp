# Bloco 2 — Finality Rules

Princípios:
- Emissão é final; reversão só via refund/cancel policy.
- Refund é final (base-only, idempotente).
- Redemption é histórico; não se apaga, apenas cancela com audit se refund.
- Dispute congela ações sensíveis (payouts/release) até resolução.

Regras por entidade
- Tickets/Entries: criados apenas com SaleSummary PAID. Se refund → status REFUNDED (não delete). Reemissão só com nova compra.
- SaleSummary: PAID é estado final de compra; REFUNDED e DISPUTED preservam timeline. Sem rollback para PROCESSING sem reconciliação explícita.
- Promo redemptions: unique por promoCodeId:purchaseId; cancelamento com `cancelledAt` em caso de refund (sem delete).
- Refunds: dedupe por eventId:purchaseId (batch) ou purchaseId:reason (single). Nunca duplicar base-only; fees nunca devolvidas.
- Disputes: ao sinal DISPUTE → SaleSummary DISPUTED; bloqueio de payouts; resolução decide REFUNDED ou mantém PAID (com audit).

Políticas de alteração
- Alterações de preço/stock após PAID não afetam ledger emitido; compensações só via refund/credit.
- Alteração de data/cancel/delete evento → RefundBatch obrigatório (base-only) com dedupe.

Auditoria
- Todas as transições finais registam quem/quando/porque (refund/dispute reason, policyVersion para payouts).
- Logs e PaymentEvent refletem estado final (REFUNDED/DISPUTED) sem apagar histórico de tentativas. 
