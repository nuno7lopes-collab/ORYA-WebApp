# Padel v2 (duplas, FULL/SPLIT) – implementação faseada

## Escopo e flags
- Aplicar apenas se `padel_v2_enabled` no `PadelTournamentConfig`; legacy intocado.
- Slug do torneio e checkout atual permanecem.

## Schema novo (Prisma)
- Organizer: `refundFeePayer` (CUSTOMER/ORGANIZER).
- PadelTournamentConfig: `padelV2Enabled`, `splitDeadlineHours`, `autoCancelUnpaid`, `allowCaptainAssume`, `defaultPaymentMode`, `refundFeePayer?`.
- Novos modelos: `PadelPairing`, `PadelPairingSlot` com enums `PadelPaymentMode`, `PadelPairingStatus`, `PadelPairingSlotStatus`, `PadelPairingPaymentStatus`, `PadelPairingSlotRole`.
- Ticket: campos opcionais `pairingId`, `pairingSlotId`, `padelSplitShareCents`, `padelPairingVersion`.

## Endpoints previstos (stubs criados)
- POST `/api/padel/pairings` – criar pairing/checkout (guardado por flag).
- GET/POST `/api/padel/pairings/[token]/claim` – preview/claim do convite.
- POST `/api/padel/pairings/[id]/assume` – capitão assume restante (stub).
- POST `/api/padel/pairings/[id]/cancel` – cancel/refund simples (stub).
- PATCH `/api/padel/pairings/[id]/public` – toggles para dupla aberta (stub).

## Taxas e invoice (para checkout)
- Se `fee_mode=ADDED`: mostrar subtotal bilhetes + linha “Taxas de serviço (ORYA+Stripe)” + total.
- Se `fee_mode=INCLUDED`: ocultar linha de taxas no cliente; guardar breakdown interno.
- Reembolsos: por defeito taxas não devolvidas ao cliente; `refund_fee_payer` define se organizer absorve custos.

## Reembolsos (MVP)
- SPLIT expirado e incompleto: refund ao capitão do bilhete dele (taxas conforme `refund_fee_payer`), pairing CANCELLED, capacidade libertada.
- FULL: cancelamento aplica refund dos bilhetes, pairing CANCELLED; transferências continuam para reatribuir parceiro.
- Sempre atualizar tickets->REFUNDED, pairing/slots status e logs.

## UX base
- Pré-checkout Padel: escolha FULL vs SPLIT.
- Checkout: invoice com linhas por categoria×qty, subtotal, taxas (se ADDED), total.
- Pós-checkout FULL: link para convidar parceiro (slot PENDING/PAID).
- Pós-checkout SPLIT: mostra prazo `locked_until` para parceiro pagar e CTA convite.
- “As minhas duplas”: estados COMPLETA/INCOMPLETA/CANCELADA, prazo, CTAs Convidar, Assumir resto, Cancelar.

## Próximos passos imediatos
- Gerar migrations (Prisma) para o novo schema.
- Implementar lógica real nos endpoints e integrar com checkout/webhooks.
- UI: toggles FULL/SPLIT no fluxo Padel e invoice discriminado no resumo.
