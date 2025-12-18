# Migração de fluxos paralelos para `/api/payments/intent`

Objetivo: remover bypasses e usar o motor único com `paymentScenario` explícito.

## Padel (`/padel/checkout` + `/api/padel/pairings/*/checkout`)
- **Estado atual**: página standalone cria PaymentIntent direto em `/api/padel/pairings/{id}/checkout`; metadata própria; não usa SaleSummary/PaymentEvent do intent central.
- **Passos de migração**:
  1) No FE (app/padel/checkout/page.tsx), trocar chamada para `/api/payments/intent` com payload:
     - `paymentScenario`: `GROUP_FULL` ou `GROUP_SPLIT` conforme `pairing.paymentMode`.
     - `checkoutUiVariant`: `PADEL_TOURNAMENT`.
     - `items`: `{ ticketTypeId, quantity: 2 ou 1, unitPriceCents, currency }`.
     - `context`: `{ eventId, eventSlug, pairingId, inviteToken? }`.
  2) No BE, mover validações de elegibilidade/deadlines/locks do endpoint `/api/padel/pairings/[id]/checkout` para um service que é chamado por `/api/payments/intent` antes de criar o PI.
  3) Gerar metadata padel no intent central (pairingId, slotId, paymentMode, deadlineAt) para processamento no webhook.
  4) Webhook Stripe passa a tratar `paymentScenario=GROUP_SPLIT|GROUP_FULL` com pairingId → emitir entries/garantias e SaleSummary únicos.
  5) Desativar criação direta de PI nos endpoints padel e mantê-los só para pré-validação/preview (LEGACY → remover).

## Resale (`/api/checkout/resale` + Payment Element)
- **Estado atual**: migrado para `/api/payments/intent` com `paymentScenario=RESALE` e fulfillment em `payment_intent.succeeded`; Checkout Session removido.
- **Notas**:
  - FE usa Payment Element em `/resale/[id]` consumindo `clientSecret` do intent.
  - Webhook `payment_intent.succeeded` transfere ticket e marca resale SOLD; branch de `checkout.session.completed` removido.

## Free placeholder (`/api/eventos/[slug]/comprar`)
- **Estado atual**: endpoint removido; FE varrido para usar apenas o modal core (Step1→Step3) com `paymentScenario=FREE_CHECKOUT` quando aplicável.
- **Notas**:
  - WavesSectionClient abre sempre o modal; free segue intent central e cria SaleSummary/tickets idempotente.
  - Não existem CTAs a apontar para o placeholder; qualquer chamada direta responde 404/410 (rota apagada).
