# Bloco 9 Closeout — 2026-01-30

## Estado
- Revenda + carteira operacionais (rotas + UI + estados vazios).
- Entitlements continuam como SSOT de acesso/check-in (sem infra).
- Testes do bloco: OK.

## Evidência (código)
- Listar revendas por evento: `app/api/eventos/[slug]/resales/route.ts:1-140`
- Listar bilhete em revenda: `app/api/tickets/resale/list/route.ts:1-180`
- Cancelar revenda: `app/api/tickets/resale/cancel/route.ts:1-120`
- UI revenda no evento + estados: `app/eventos/[slug]/page.tsx:630-1365`
- Wallet UI + estados vazios: `app/me/carteira/WalletHubClient.tsx:150-470`
- Wallet API: `app/api/me/wallet/route.ts:1-220`
- Check-in consome entitlement: `app/api/internal/checkin/consume/route.ts:74-210`

## Testes executados
- `npx vitest run tests/entitlements tests/checkin tests/finance`
  - Resultado: **OK** (14 files / 46 tests).
  - stderr informativo em `reconciliationSweep` (logs), sem falhas.
