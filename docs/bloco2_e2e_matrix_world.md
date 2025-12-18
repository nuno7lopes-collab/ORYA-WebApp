# Bloco 2 — World E2E Matrix

Estado alvo: todas as suites verdes (ingest-only + worker-only + ledger SSOT + emissão idempotente + refunds/disputes/payout safety).

## Suite A — Stripe & rede
- Webhook antes do FE → PaymentEvent registado, Operation criada, emissão ok quando worker roda.
- Webhook depois do FE → polling vê PROCESSING, depois PAID.
- Webhook duplicado 10x → 0 efeitos extra (dedupe PaymentEvent/Operation).
- Webhook atrasado 1h → worker reprocessa e fecha PAID sem duplicar.
- PI processing prolongado → status PROCESSING até intent resolver; sem emissão prematura.

## Suite B — comportamento do utilizador
- Double-click / 2 tabs → mesmo purchaseId, sem intents múltiplos; emissão 1x.
- Promo muda e tenta pagar com secret antigo → falha controlada; sem emissão.
- Abandono e retorno → polling vê PROCESSING/RA; retoma sem duplicar.

## Suite C — stock e preços
- Wave esgota entre intent e pagamento → worker falha emissão, marca FAILED (ou DEAD_LETTER se não resolvido), sem tickets.
- PRICE_CHANGED após intent → emissão mantém preço do ledger; sem divergência.
- Cap por compra excedido → validação bloqueia; sem emissão.

## Suite D — refund massivo
- Cancelar evento 1000 compras → RefundBatch cria PROCESS_REFUND_SINGLE por purchaseId; reentrante.
- Falha parcial e rerun → dedupe evita duplicar; todos acabam REFUNDED.
- Refund nunca duplica base-only; fees retidas.

## Suite E — resale concorrente
- Duas pessoas tentam comprar a mesma revenda → dedupe/lock evita dupla transferência; apenas um buyer fica com ticket.

## Suite F — padel split corridas
- Partner paga ao mesmo tempo que off-session charge → dedupe pairing evita dupla cobrança; estado final consistente.
- Partner tenta pagar após deadline → rejeitado; se capitão cobrado off-session, pairing actualizado conforme regra.
- SCA → REQUIRES_ACTION + grace; não cancela antecipado.
- Rounding ímpar → capitão +1 cêntimo determinístico.

## Suite G — payout safety (Connect)
- Antes de releaseAt → nenhuma transferência.
- Evento cancelado com 1.000 compras → RefundBatch reentrante, sem duplicar.
- Dispute antes de release → payout bloqueado + entitlement SUSPENDED.
- Dispute depois de release → reserve cobre ou ajusta próximos payouts; histórico íntegro.

Critério de fecho: todas as suites reproduzíveis em staging/pre-prod com worker/Operations ativos e métricas/alertas ligadas. 
