# Fulfillment Legacy Report (Bloco 2)

Objetivo: listar superfícies que violam o core (ingest-only + worker-only + ledger SSOT + emissão idempotente) e que devem ser removidas/refatoradas.

## Itens LEGACY/SUSPEITOS
- `app/api/stripe/webhook/route.ts` (LEGACY): executa efeitos completos (ledger, emissão, promo, notificações, refunds). Ação: tornar ingest-only e mover lógica para worker/Operations.
- `app/api/payments/intent/route.ts` (FREE branch) (SUSPEITO): emite SaleSummary/tickets direto. Ação: mudar para PaymentEvent + Operation UPSERT_LEDGER_FROM_PI_FREE.
- `app/api/cron/padel/expire/route.ts` (SUSPEITO): cobra off-session/refunda e altera pairing/tickets direto. Ação: enfileirar Operations CONFIRM_SECOND_CHARGE / CANCEL_PAIRING_AND_REFUND.
- `lib/refunds/refundService.ts` (agora CORE: refundPurchase idempotente) — rotas legacy de refund foram removidas; refunds correm apenas via Operations.
- `app/api/admin/payments/dispute/route.ts` + `domain/finance/disputes.ts` (LEGACY): marcam DISPUTED direto. Ação: criar Operation MARK_DISPUTE.
- Scripts `scripts/backfillSaleSummaries.js` e `scripts/backfillStripeFees.js` (LEGACY): reconciliação manual. Ação: substituir por job de reconciliação (Operations) e remover dependência de scripts.
- Diretórios `app/api/checkout/reserve` e `app/api/checkout/session` vazios (LEGACY): remover ou redirecionar para fluxo core.
- Qualquer emissão direta fora do worker (handlers ad hoc) – procurar `ticket.create` / `saleSummary` fora do worker core e migrar para Operations.

## Evidência (referência)
- checkout_surface_map e fulfillment_surface_map marcam as rotas acima como LEGACY/SUSPEITO.
- Operations catalog define operações alvo para substituir cada fluxo legado.

## Ações de cleanup
- Remover/arquivar código morto (`app/padel/checkout/page.ts` já removido, confirmar deploy).
- Bloquear novas features de emissão diretamente em webhooks/API.
- Introduzir feature flag/kill switch para caminhos legacy enquanto migração não concluída.
- Documentar owners e timelines para eliminar cada item; incluir testes E2E correspondentes na matriz. 
