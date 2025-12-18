# Bloco 2 — Separação Ingest-only vs Worker-only

Objetivo: nenhum ponto de entrada externo cria efeitos diretos. Webhooks/API de ingestão só validam, registam PaymentEvent (telemetria/audit) e enfileiram Operations reentrantes. Qualquer efeito (ledger, emissão, promo, refunds, disputas, notificações) ocorre apenas no worker.

## Regra de ouro
- Ingest-only: validar input, dedupe por `stripeEventId`/`paymentIntentId`/`purchaseId`, persistir PaymentEvent (source=WEBHOOK/API), extrair chaves de correlação e criar/reativar Operation com dedupeKey determinística.
- Worker-only: upsert Ledger (SaleSummary/SaleLines), emitir tickets/entries, aplicar promo_redemptions, confirmar pairings/split/off-session, executar refunds/disputes, enviar notificações/emails, atualizar stock/locks.
- Proibido na ingestão: criar tickets/entries, alterar SaleSummary/SaleLines, aplicar promo_redemptions, executar refunds/disputes, confirmar pairings, enviar emails/notificações, tocar stock.

## Superfícies atuais e gaps
- `app/api/stripe/webhook/route.ts`: faz tudo (ledger + emissão + promo + notificações + refund handling). Precisa ser reduzido a ingest-only e passar efeitos para Operations.
- `app/api/payments/intent/route.ts` (FREE): emite sale_summary/tickets direto. Deve apenas registar PaymentEvent+Operation e deixar worker emitir free.
- `app/api/cron/padel/expire/route.ts`: cobra off-session, faz refund e mexe em tickets/pairings diretamente. Deve apenas agendar Operations (segunda cobrança, refund/cancel).
- `lib/refunds/refundService.ts`: executa refund Stripe base-only com dedupe. Rotas legacy removidas; refunds são enfileirados via Operations (PROCESS_REFUND_BATCH/SINGLE) no worker.
- `app/api/admin/payments/dispute/route.ts` + `domain/finance/disputes.ts`: marcam DISPUTED e criam PaymentEvent diretamente. Devem enfileirar Operation de dispute e mover lógica para worker.
- Scripts `scripts/backfillSaleSummaries.js` e `scripts/backfillStripeFees.js`: reconciliação manual (LEGACY). Devem ser substituídos por job de reconciliação (Operations) no passo 8.

## Split proposto (alvo)
- Webhook Stripe (payments): validar assinatura → persistir PaymentEvent (status=RECEIVED/PROCESSING) com dedupe `stripeEventId` → criar Operation `PROCESS_STRIPE_EVENT:{stripeEventId}` com correlations (paymentIntentId, purchaseId se existir). Zero efeitos.
- Webhook Stripe (Connect/payouts): idem, Operation `PROCESS_CONNECT_EVENT:{eventId}` (ou accountId+eventId).
- API free checkout: criar PaymentEvent source=API, dedupeKey=purchaseId, Operation `UPSERT_LEDGER_FROM_PI:{purchaseId}` com payload free. Worker emite SaleSummary/SaleLines/Tickets idempotente.
- Padel cron expire: em vez de cobrar/refundar, criar Operations `CONFIRM_SECOND_CHARGE:{pairingId}` ou `CANCEL_PAIRING_AND_REFUND:{pairingId}` conforme estado.
- Refund batch/date-changed: endpoint apenas enfileira `PROCESS_REFUND_BATCH:{eventId}:{reason}`; worker cria `PROCESS_REFUND_SINGLE:{eventId}:{purchaseId}` idempotentes.
- Disputes: endpoint/admin/webhook criam PaymentEvent DISPUTE_RECEIVED + Operation `MARK_DISPUTE:{paymentIntentId|purchaseId}`; worker ajusta ledger/timeline/bloqueios.

## Dedupe/Idempotência mínima na ingestão
- PaymentEvent: unique por `stripeEventId` (quando existe), índice por `stripePaymentIntentId`.
- Operation: dedupeKey por tipo (detalhado no catálogo do passo 3) para evitar efeitos múltiplos mesmo com retries ou eventos fora de ordem.
- Reentrança: webhook duplicado 10x → sem efeitos adicionais; worker pode ser reexecutado e chega ao mesmo estado final.

## Gates para considerar o passo 2 cumprido
- Webhook Stripe não executa mais efeitos diretos (apenas grava PaymentEvent e cria Operation).
- FREE checkout não emite tickets/SaleSummary diretamente; usa o worker.
- Padel cron e refunds/disputes admin não tocam tickets/ledger diretamente; apenas enfileiram Operations.
- Existe caminho claro para worker consumir Operations (mesmo que stub inicial) e única fonte de efeitos de emissão/refund/dispute.

## Próximos passos dependentes
- Passo 3: catálogo de Operations (tipos + dedupeKey + pré-condições) baseado nas superfícies acima.
- Passo 4: state machine do ledger alinhada com worker-only.
- Passo 5+: mover handlers de emissão/refund para o worker com constraints/idempotência. 
