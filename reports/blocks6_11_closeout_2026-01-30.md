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

## Guardrails por endpoint (Blocos 8–11)
### Bloco 8 — Padel/Torneios
- `app/api/padel/standings/route.ts`: `withApiEnvelope` aplicado; acesso público só quando policy permite, senão exige membro org (fail-closed). Logging permanece `console.error` (read-path público, sem PII; aceitável por agora).
- `app/api/padel/rankings/route.ts`: `respondOk/respondError` com `getRequestContext` (requestId/correlationId); gating por scope (evento público vs org com roles).
- `app/api/padel/calendar/auto-schedule/route.ts`: endpoint de org (fail-closed via auth/org context).
- `app/api/organizacao/tournaments/[id]/generate/route.ts`: endpoint de org (RBAC + org context, fail-closed).

### Bloco 9 — Revenda/Carteira (extras)
- `app/api/eventos/[slug]/resales/route.ts`: read-path público com `withApiEnvelope`; sem alterações de estado. Logging usa `console.error` (legado) — sem PII.
- `app/api/tickets/resale/list/route.ts` e `app/api/tickets/resale/cancel/route.ts`: exigem auth do utilizador e devolvem envelope canónico; logging permanece `console.error` (legado).
- `app/api/me/wallet/route.ts`: read-path autenticado com `withApiEnvelope`; sem mutações financeiras.
- Invariante: **wallet/loyalty não passa por `/api/payments/intent`** (sem créditos monetários). A wallet agrega entitlements/ressales, não cria pagamentos.

### Bloco 10 — Perfil/Notificações
- `app/api/me/settings/save/route.ts`, `app/api/me/contact-phone/route.ts`: endpoints autenticados, `withApiEnvelope` + fail-closed.
- `app/api/me/consents/route.ts`: auth obrigatória, envelope canónico.

### Bloco 11 — Search/Analytics (read-path only)
- `app/api/users/search/route.ts` + `app/api/organizations/search/route.ts`: read-path, `withApiEnvelope`, sem mutações.
- `app/api/organizacao/estatisticas/overview/route.ts` + `time-series`: org-scoped, envelope canónico.

## SSOT scans (Blocos 6–11)
- `rg "^- \\[ \\]" docs/v10_execution_checklist.md -n | rg "Bloco (6|7|8|9|10|11)" -n`
  - Resultado esperado: **apenas** o item BLOCKED do backfill (Bloco 7).

## Notas
- Bloco 7 backfill: execução em DB real permanece **BLOCKED** por ausência de `DATABASE_URL`/`DIRECT_URL` no ambiente local.
- Bloco 11: apenas read-path (search/analytics). Jobs/cron ficam fora deste escopo.
