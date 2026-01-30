# v10 Blocks 7–11 Tracking (produto, sem infra)

> Scope: apenas domínios de produto (rotas/UI/SSOT/guardrails/tests/backfills). Sem AWS/Secrets/Observability.

## Bloco 7 — Reservas/Agenda/Serviços/Softblocks
- Status: IN PROGRESS (backfill BLOCKED por falta de DB env).
- SSOT/Invariantes:
  - Snapshot imutável no confirm; cancel/no-show/refund sempre por snapshot (fail-closed).
- Backfill:
  - Dry-run: `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --dry-run --limit=200`
  - Execução controlada: `... --limit=200` (repetir em batches).
- Testes:
  - `npx vitest run tests/agenda tests/outbox tests/ops`
- Smoke steps (manual):
  - Criar reserva confirmada → cancelar (user/org) → validar refund window.
  - Marcar no-show → verificar cálculo de penalty/refund.
  - API `/api/organizacao/agenda?from=...&to=...` retorna itens.

## Bloco 8 — Padel/Torneios
- Status: TODO.
- SSOT/Invariantes:
  - Torneio sempre ancorado em Event; inscrição usa checkout SSOT; entitlement emitido.
- Testes:
  - `npx vitest run tests/padel tests/tournaments tests/outbox`
- Smoke steps:
  - Criar torneio → gerar bracket → auto-schedule → pagar inscrição → entitlement.

## Bloco 9 — Loja/Tickets/Check-in/Entitlements
- Status: TODO.
- SSOT/Invariantes:
  - Entitlement é SSOT de acesso; check-in consome entitlement.
- Testes:
  - `npx vitest run tests/entitlements tests/checkin tests/finance`
- Smoke steps:
  - Comprar bilhete → entitlement ACTIVE → check-in consume OK.

## Bloco 10 — Users/Sessão/Perfil/Privacidade/Consentimentos/Notifs
- Status: TODO.
- SSOT/Invariantes:
  - Consentimentos persistidos; deleção/DSAR com confirmação; notificações via outbox.
- Testes:
  - `npx vitest run tests/location tests/notifications tests/access`
- Smoke steps:
  - Atualizar perfil → consent opt-in/out → request deletion → cancel/confirm.

## Bloco 11 — Search/Discover/SearchIndex/Analytics/CRM
- Status: TODO.
- Escopo FECHAR:
  - Search/discover (read path), searchIndex logic, analytics read/query.
- Fora de scope por agora:
  - Cron/rollups/CRM jobs que exigem secrets/config.
- Testes:
  - `npx vitest run tests/search tests/searchIndex tests/analytics`
- Smoke steps:
  - Search API retorna eventos/clubes; analytics overview retorna estrutura ok.
