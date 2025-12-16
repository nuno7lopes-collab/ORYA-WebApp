# Cleanup Report (ronda 1)

## DELETE ✅ (0 hits comprovado)

- app/api/internal/notifications/process/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "internal/notifications/process|notifications/process"`  
  - resultado: 0 hits  
  - ação: `git rm app/api/internal/notifications/process/route.ts`

- app/api/internal/notifications/tournament-eve/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "tournament-eve|internal/notifications/tournament-eve"`  
  - resultado: 0 hits  
  - ação: `git rm app/api/internal/notifications/tournament-eve/route.ts`

- app/api/social/following/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "/api/social/following\\b|social/following\\b"`  
  - resultado: 0 hits  
  - ação: `git rm app/api/social/following/route.ts`

## KEEP ⚠️ (tem referências)

- app/api/checkout/route.ts (já removido em commit anterior)  
  - comando: `rg -n --hidden --glob '!.git' "/api/checkout\\b|api/checkout\\b"`  
  - hits: `app/components/checkout/Step3Sucesso.tsx` (status polling), `app/api/checkout/resale/route.ts` logs.  
  - decisão: manter referências atuais (rota /api/checkout/status e revenda ativas); nada removido aqui.

- app/api/notifications/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "/api/notifications\\b|api/notifications\\b"`  
  - hits: `/app/me/edit`, `/app/me/settings`, `/app/components/notifications/NotificationBell.tsx`.  
  - decisão: KEEP (rota em uso).

- app/api/padel/matches/generate/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "padel/matches/generate|matches/generate"`  
  - hit: `app/organizador/(dashboard)/eventos/[id]/PadelTournamentSection.tsx`.  
  - decisão: KEEP (rota em uso).

- app/api/social/follow-status/route.ts  
  - comando: `rg -n --hidden --glob '!.git' "/api/social/follow-status\\b|social/follow-status\\b"`  
  - hit: `app/[username]/FollowClient.tsx`.  
  - decisão: KEEP.

## REFATORAR 🛠️ (SSOT / duplicações)

- paymentScenario  
  - hits: webhook Stripe e /api/payments/intent + padel checkout local.  
  - ação mínima desta ronda: criado wrapper SSOT `lib/payments/paymentScenario.ts` a reexportar o helper atual (no-op). Refactor completo do webhook fica para ronda seguinte.

- Webhook Stripe  
  - comando: `rg -n --hidden --glob '!.git' "ORYA PATCH|patch|legacy" app/api/stripe/webhook/route.ts`  
  - hit: linha 229 (`ORYA PATCH v1`).  
  - decisão: REFATORAR numa ronda futura (separar handlers por cenário, sem tocar agora).

## Gates

- lint: `npm run lint` **FALHOU** — 84 errors / 114 warnings (muitos `any`/hooks); não alterado nesta ronda.
- typecheck: `npm run typecheck` **FALHOU** — erro em `app/organizador/(dashboard)/tournaments/[id]/live/page.tsx` (string mal fechada).
- build: `npm run build` **FALHOU** — mesmo parse error (`"use client\";`) + falta de dependência `seedrandom` em `domain/tournaments/generation.ts` e `standings.ts`.
