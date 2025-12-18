# Plano de Fecho dos Gaps (BLOCO 1)

Este plano descreve as mudanças restantes e a ordem sugerida para fechar o checkout a 100% com segurança.

## 1) Constraints/uniques de emissão (tickets/entries/promo_redemptions)
- **Tickets**: adicionar `purchaseId` (UUID) e `saleSummaryId` nas emissões; criar unique composto mínimo `purchaseId + ticketTypeId + idx` (ou `saleSummaryId + ticketTypeId + idx`). Emissão sempre dentro de transação que incrementa idx/ordem.
- **Entries (padel/tournament)**: incluir `purchaseId`/`saleSummaryId` e unique determinístico (`tournamentId + ownerUserId/ownerIdentityId + role`).
- **PromoRedemption**: adicionar `purchaseId` e unique (`purchaseId + promoCodeId`); opcional unique (`promoCodeId + userId/guestEmail`) se business permitir 1 por user.
- **Emissão**: refatorar webhook/flows para usar upsert por `purchaseId`/`saleSummaryId` e não reemitir se existe.
- **Migração**: alterar `prisma/schema.prisma`, criar migrações, ajustar criação de tickets/entries/redemptions para preencher `purchaseId`/`saleSummaryId`.

## 2) Claim apenas após emailVerifiedAt
- `claimIdentity` já aceita `requireVerified`; Supabase user metadata (`email_confirmed_at`) já é verificado nos endpoints de claim/email_verified (retorna EMAIL_NOT_VERIFIED se faltar).
- Fluxo de claim mantém idempotência (se já claimed → no-op).
- Teste manual pendente: guest compra → claim sem verificação falha; após verificação, claim funciona; repetir claim é no-op.

## 3) Refunds obrigatórios base-only com dedupe + audit
- Definir tabela `refunds` (ou utilizar existente) com campos: `id`, `purchaseId`, `paymentIntentId`, `baseAmountCents`, `feesExcludedCents`, `reason` (CANCELLED/DELETED/DATE_CHANGED), `refundedBy`, `refundedAt`, `dedupeKey` (unique), `auditPayload`.
- Implementar triggers em cancel/apagar/alteração de data (jobs/cron ou hooks nos endpoints de admin) que coletam compras afetadas e chamam service de refund:
  - Calcula base = SaleSummary.totalCents - fees (platform + stripe, se armazenadas).
  - Cria Refund record com dedupeKey (`eventId + purchaseId`).
  - Chama Stripe refund com idempotencyKey = dedupeKey.
  - Atualiza SaleSummary.status = REFUNDED e tickets/entries → REFUNDED/INACTIVE.
- Idempotência: upsert Refund por dedupeKey; reruns não duplicam Stripe refund.
- Audit: guardar `refundedBy` (admin/system), `reason`, timestamps, amounts.
- Atualizar `/api/internal/checkout/timeline` para incluir refunds (lista de Refund records).

## 4) Validação INVALID_PRICING_MODEL padel
- Hoje: valida qty=2 para GROUP_FULL, qty=1 para GROUP_SPLIT. Completar verificando incoerência de “preço por dupla”:
  - Se `checkoutUiVariant=PADEL_TOURNAMENT` e algum item tiver `unitPriceCents` que implique preço por dupla (ex.: qty=1 mas `paymentScenario=GROUP_FULL`), recusar com code `INVALID_PRICING_MODEL`.
  - Adicionar testes unitários para compute/intent com payload inconsistente.

## 5) docs/checkout_e2e_matrix.md + execução
- Completar a matriz com passos detalhados e executar em staging:
  - FREE (qty>0 total 0)
  - Paid normal
  - Multi-tab/double-click (idempotencyKey)
  - Webhook duplicado/out-of-order
  - Promo corrida (limites)
  - Refund (cancel/apagar)
  - Split rounding ímpar (+1 cent capitão)
- Registrar ✅/❌ e evidência (purchaseId/logs).

## 6) UX única (remover flows fora do modal)
- Redirecionar padel standalone para abrir o modal Step1/2/3 (ou embutir Step1 padel no modal).
- Remover `/api/eventos/[slug]/comprar` (feito) e limpar referências no FE (feito; WavesSectionClient agora abre o modal core para free/pago).
- Atualizar surface map/legacy report após remoção/refactor.

## Ordem sugerida
1) Constraints/uniques + schema/migrações (tickets/entries/redemptions) + ajuste de emissão.
2) Refunds obrigatórios (service + tabela + hooks) e timeline incluindo refunds.
3) Claim emailVerifiedAt (validar fluxo) e padel pricing gate final.
4) UX única (padel/modal) e limpeza de endpoints legacy.
5) Executar matriz E2E em staging e atualizar docs/checkout_e2e_matrix.md.

## Riscos / notas
- Alterações de schema exigem migrações e deploy coordenado.
- Refunds: requer chaves Stripe e cuidado para não duplicar refunds em produção.
- UX padel: envolve FE/UX; alinhar com stakeholders antes de remover standalone.
