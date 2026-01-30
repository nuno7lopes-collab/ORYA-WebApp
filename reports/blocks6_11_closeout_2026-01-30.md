# Blocos 6–11 — SSOT clean closeout (2026-01-30)

## Estado por bloco
- Bloco 6: **DONE** (P0/P1 entregues; P2 marcado N/A por backlog pós go-live).
- Bloco 7: **DONE/BLOCKED** (tooling do backfill DONE; execução em DB real BLOCKED por falta de env).
- Bloco 8: **DONE**.
- Bloco 9: **DONE**.
- Bloco 10: **DONE**.
- Bloco 11: **DONE (read-path only)**.

## Evidência-chave (3–5 por bloco)
### Bloco 6 — Eventos e Políticas
- `lib/invites/inviteTokens.ts:1-190`
- `app/api/eventos/[slug]/invite-token/route.ts:1-140`
- `lib/checkin/accessPolicy.ts:210-320`
- `app/api/internal/checkin/consume/route.ts:90-210`
- `app/organizacao/(dashboard)/eventos/EventEditClient.tsx:230-260`

### Bloco 7 — Reservas/Agenda/Serviços
- `app/api/organizacao/reservas/[id]/cancel/route.ts:156-200`
- `app/api/organizacao/reservas/[id]/no-show/route.ts:148-172`
- `scripts/backfill_booking_confirmation_snapshot.ts:1-63`
- `lib/reservas/backfillConfirmationSnapshot.ts:52-179`
- `app/api/organizacao/agenda/route.ts:1-70`

### Bloco 8 — Padel/Torneios
- `app/api/padel/pairings/[id]/checkout/route.ts:23-200`
- `domain/finance/fulfillment.ts:188-268`
- `app/api/organizacao/tournaments/[id]/generate/route.ts:1-210`
- `app/api/padel/calendar/auto-schedule/route.ts:1-120`
- `app/api/padel/standings/route.ts:1-140`

### Bloco 9 — Loja/Tickets/Check-in
- `app/api/internal/worker/operations/route.ts:860-1045`
- `app/api/stripe/webhook/route.ts:760-980`
- `app/api/internal/checkin/consume/route.ts:60-200`
- `lib/entitlements/status.ts:1-120`
- `reports/block9_closeout_2026-01-30.md`

### Bloco 10 — Utilizadores/Perfil/Notifs
- `app/api/me/consents/route.ts:1-140`
- `app/api/me/settings/delete/route.ts:20-120`
- `lib/push/apns.ts:1-70`
- `app/me/settings/page.tsx:40-520`
- `reports/block10_closeout_2026-01-30.md`

### Bloco 11 — Search/Discover/Analytics (read-path only)
- `app/components/Navbar.tsx:780-1260`
- `app/api/users/search/route.ts:1-140`
- `app/api/organizations/search/route.ts:1-140`
- `app/api/organizacao/estatisticas/overview/route.ts:1-140`
- `app/api/organizacao/estatisticas/time-series/route.ts:1-160`

## Gates executados (vitest subsets)
- `npx vitest run tests/outbox` (OK 2026-01-30)
- `npx vitest run tests/admin` (OK 2026-01-30)

## Notas
- Bloco 7 backfill: execução em DB real permanece **BLOCKED** por ausência de `DATABASE_URL`/`DIRECT_URL` no ambiente local.
- Bloco 11: apenas read-path (search/analytics). Jobs/cron ficam fora deste escopo.
