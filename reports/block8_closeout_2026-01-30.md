# Bloco 8 Closeout — 2026-01-30

## Estado
- APIs/Domain padel + torneios alinhados ao SSOT (event-based + entitlements).
- Testes do bloco: OK.

## Evidência (código)
- Checkout padel (delegado ao fluxo canônico): `app/api/padel/pairings/[id]/checkout/route.ts:23-200`
- Entitlements para inscrições padel: `domain/finance/fulfillment.ts:188-268`
- Estados canônicos de inscrição: `domain/padelRegistration.ts:1-140`

## Testes executados
- `npx vitest run tests/padel tests/tournaments tests/outbox`
  - Resultado: **OK** (20 files / 60 tests).
  - Logs de outbox em stderr são informativos (retry/dead-letter), sem falhas.
